import type { Node } from './Topology'
import { isCurrentKubernetesPod } from './KubernetesPodLifecycle'
import { kubernetesLabelValue } from './KubernetesSelectors'

export const KUBERNETES_CONTROLLER_TYPES = new Set([
    'deployment',
    'statefulset',
    'daemonset',
    'job',
    'cronjob'
])

const valueAtPath = (source: any, path: string): any =>
    path.split('.').reduce((value, key) => value === undefined || value === null ? undefined : value[key], source)

const firstRaw = (source: any, paths: string[]): any => {
    for (const path of paths) {
        const value = valueAtPath(source, path)
        if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return undefined
}

const resourceType = (node: Node): string => String(node.data?.Type || '').toLowerCase()
const resourceName = (node: Node): string => String(firstRaw(node.data || {}, [
    'Name',
    'K8s.Name',
    'K8s.Extra.ObjectMeta.Name',
    'K8s.Extra.Metadata.Name',
    'K8s.Extra.metadata.name'
]) || '')
const resourceUID = (node: Node): string => String(firstRaw(node.data || {}, [
    'K8s.Extra.ObjectMeta.UID',
    'K8s.Extra.Metadata.UID',
    'K8s.Extra.metadata.uid',
    'K8s.UID',
    'UID'
]) || node.id)
const lineage = (node: Node): Node[] => {
    const result: Node[] = [], seen = new Set<Node>()
    let current: Node | null | undefined = node
    while (current && !seen.has(current)) { result.push(current); seen.add(current); current = current.parent }
    return result
}
const resourceNamespace = (node: Node): string => {
    const explicit = firstRaw(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace', 'K8s.Extra.Metadata.Namespace', 'K8s.Extra.metadata.namespace'])
    if (explicit) return String(explicit)
    const namespace = lineage(node).find(parent => resourceType(parent) === 'namespace')
    return namespace ? resourceName(namespace) : ''
}
const resourceCluster = (node: Node): string => {
    for (const current of lineage(node)) {
        const name = firstRaw(current.data || {}, ['ClusterName', 'clusterName', 'K8s.ClusterName', 'Cluster'])
        if (name) return String(name)
        if (resourceType(current) === 'cluster') return resourceName(current)
    }
    return ''
}
const ownerReferences = (node: Node): any[] => {
    const value = firstRaw(node.data || {}, [
        'K8s.Extra.ObjectMeta.OwnerReferences',
        'K8s.Extra.ObjectMeta.ownerReferences',
        'K8s.Extra.metadata.ownerReferences',
        'K8s.Extra.Metadata.OwnerReferences',
        'K8s.Metadata.OwnerReferences',
        'K8s.OwnerReferences',
        'OwnerReferences'
    ])
    if (!Array.isArray(value)) return []
    const controlling = value.filter(owner => (owner?.Controller ?? owner?.controller) === true)
    return controlling.length ? controlling : value.filter(owner => (owner?.Controller ?? owner?.controller) !== false)
}

const ownerMatches = (owner: any, expectedKind: string, ownerNode: Node): boolean => {
    const kind = String(owner?.Kind || owner?.kind || '').toLowerCase()
    const uid = String(owner?.UID || owner?.uid || '')
    const name = String(owner?.Name || owner?.name || '')
    if (kind !== expectedKind.toLowerCase()) return false
    if (uid) return uid === resourceUID(ownerNode)
    return !!name && name === resourceName(ownerNode)
}

const clusterID = (node: Node): string => {
    for (const current of lineage(node)) {
        const id = firstRaw(current.data || {}, ['ClusterID', 'ClusterId', 'clusterId', 'K8s.ClusterID'])
        if (id) return String(id)
    }
    return ''
}
const sameScope = (left: Node, right: Node): boolean => {
    if (resourceNamespace(left) !== resourceNamespace(right)) return false
    const leftID = clusterID(left), rightID = clusterID(right)
    if (leftID && rightID) return leftID === rightID
    const leftName = resourceCluster(left), rightName = resourceCluster(right)
    if (leftName && rightName && leftName !== rightName) return false
    const leftAnchor = lineage(left).find(node => resourceType(node) === 'cluster')?.id
    const rightAnchor = lineage(right).find(node => resourceType(node) === 'cluster')?.id
    if (leftAnchor && rightAnchor) return leftAnchor === rightAnchor
    if (leftName && rightName) return leftName === rightName
    return !leftID && !rightID && !leftName && !rightName && !leftAnchor && !rightAnchor
}

const findOwnerNode = (owner: any, child: Node, nodes: Node[]): Node | undefined => {
    const ownerUID = String(owner?.UID || owner?.uid || '')
    const ownerName = String(owner?.Name || owner?.name || '')
    const ownerKind = String(owner?.Kind || owner?.kind || '').toLowerCase()
    if (!ownerKind || (!ownerUID && !ownerName)) return undefined
    const candidates = nodes.filter(candidate => {
        if (String(candidate.data?.Manager || '').toLowerCase() !== 'k8s' || !sameScope(candidate, child)) return false
        if (resourceType(candidate) !== ownerKind) return false
        return ownerUID ? resourceUID(candidate) === ownerUID : resourceName(candidate) === ownerName
    })
    return candidates.length === 1 ? candidates[0] : undefined
}

/**
 * Resolves the controller that owns a Pod without selector inference.
 * Deployment ownership is followed through ReplicaSet. A Job remains the
 * visible owner of its Pods even when that Job itself belongs to a CronJob.
 */
export const resolveKubernetesPodController = (pod: Node, nodes: Node[]): Node | undefined => {
    if (resourceType(pod) !== 'pod') return undefined
    const owners = ownerReferences(pod)
    for (const owner of owners) {
        const ownerKind = String(owner?.Kind || owner?.kind || '').toLowerCase()
        const ownerNode = findOwnerNode(owner, pod, nodes)
        if (ownerNode && KUBERNETES_CONTROLLER_TYPES.has(resourceType(ownerNode))) return ownerNode
        if (ownerKind !== 'replicaset') continue
        if (!ownerNode) continue

        for (const replicaSetOwner of ownerReferences(ownerNode)) {
            const controller = findOwnerNode(replicaSetOwner, ownerNode, nodes)
            if (controller && resourceType(controller) === 'deployment') return controller
        }
    }
    return undefined
}

/**
 * Resolves the final visible controller for inventory/summary views.
 * Unlike the topology expansion owner, a Job owned by a CronJob is folded into
 * that CronJob so Pod -> Job -> CronJob is counted once by the final UID.
 */
export const resolveKubernetesPodTopController = (pod: Node, nodes: Node[]): Node | undefined => {
    const directController = resolveKubernetesPodController(pod, nodes)
    if (!directController || resourceType(directController) !== 'job') return directController
    for (const owner of ownerReferences(directController)) {
        const ownerNode = findOwnerNode(owner, directController, nodes)
        if (ownerNode && resourceType(ownerNode) === 'cronjob') return ownerNode
    }
    return directController
}

export const kubernetesPodsForController = (controller: Node, nodes: Node[]): Node[] =>
    nodes.filter(node => resourceType(node) === 'pod'
        && resolveKubernetesPodController(node, nodes)?.id === controller.id)

export const currentKubernetesPodsForController = (controller: Node, nodes: Node[]): Node[] =>
    kubernetesPodsForController(controller, nodes).filter(isCurrentKubernetesPod)

/** A missing intermediate owner is not an empty Pod inventory. This is an
 * observation of relationship coverage, never a new workload health rule. */
export const kubernetesControllerPodObservation = (controller: Node, nodes: Node[], hierarchyPods?: Node[]) => {
    const pods = hierarchyPods === undefined ? currentKubernetesPodsForController(controller, nodes)
        : hierarchyPods.filter(pod => resourceType(pod) === 'pod' && sameScope(controller, pod) && isCurrentKubernetesPod(pod))
    const status = firstRaw(controller.data, ['K8s.Extra.Status', 'K8s.Extra.status', 'K8s.Status']) || {}
    const reportedRaw = status.Replicas ?? status.replicas ?? controller.data?.K8s?.Replicas
    const reported = reportedRaw === undefined || reportedRaw === null || reportedRaw === '' || !Number.isFinite(Number(reportedRaw))
        ? undefined : Number(reportedRaw)
    const missingReplicaSet = resourceType(controller) === 'deployment'
        && !kubernetesReplicaSetsForDeployment(controller, nodes).length
    const incomplete = missingReplicaSet || (resourceType(controller) === 'deployment' && reported === undefined)
        || (reported !== undefined && pods.length < reported)
    return { pods, matched: pods.length, reported, missingReplicaSet, complete: !incomplete,
        count: incomplete ? undefined : pods.length,
        label: incomplete ? '관계 미확인' : String(pods.length) }
}

/** ReplicaSets directly controlled by a Deployment. Selector coincidence is
 * intentionally insufficient because an old ReplicaSet and an unrelated
 * controller can expose the same Pod labels during a rollout. */
export const kubernetesReplicaSetsForDeployment = (deployment: Node, nodes: Node[]): Node[] =>
    nodes.filter(node => resourceType(node) === 'replicaset'
        && sameScope(deployment, node)
        && ownerReferences(node).some(owner => ownerMatches(owner, 'deployment', deployment)))

/** Returns collected ReplicaSet objects plus stable relationship references
 * recovered from Pods already assigned to the Deployment by the topology
 * owner resolver. Some topology views intentionally omit ReplicaSet nodes,
 * but Pod OwnerReferences still preserve the real ReplicaSet UID and name. */
export const kubernetesReplicaSetRelationsForDeployment = (deployment: Node, nodes: Node[]): Node[] => {
    const replicaSets = kubernetesReplicaSetsForDeployment(deployment, nodes)
    const identities = new Set<string>()
    replicaSets.forEach(replicaSet => {
        identities.add(resourceUID(replicaSet))
        identities.add(resourceName(replicaSet))
    })
    const deploymentPods = kubernetesPodsForController(deployment, nodes)
    deploymentPods.forEach(pod => ownerReferences(pod).forEach(owner => {
        if (String(owner?.Kind || owner?.kind || '').toLowerCase() !== 'replicaset') return
        const uid = String(owner?.UID || owner?.uid || '')
        const name = String(owner?.Name || owner?.name || '')
        if ((!uid && !name) || (uid && identities.has(uid)) || (name && identities.has(name))) return
        const namespace = resourceNamespace(pod)
        const cluster = resourceCluster(pod) || resourceCluster(deployment)
        const reference = {
            id: uid || `${resourceUID(deployment)}:${namespace}:${name}`,
            tags: ['kubernetes'],
            data: {
                Manager: 'k8s',
                Type: 'replicaset',
                Name: name || uid,
                ClusterName: cluster,
                RelationshipReferenceOnly: true,
                K8s: {
                    UID: uid,
                    Namespace: namespace,
                    ClusterName: cluster,
                    Extra: { ObjectMeta: { UID: uid, Name: name, Namespace: namespace } }
                }
            },
            weight: 0,
            children: [],
            parent: null,
            revision: 0,
            state: { expanded: false, selected: false, mouseover: false, groupOffset: 0, groupFullSize: false },
            type: 'node',
            getWeight: () => 0
        } as Node
        replicaSets.push(reference)
        if (uid) identities.add(uid)
        if (name) identities.add(name)
    }))
    return replicaSets
}

const deploymentRevision = (node: Node): number | undefined => {
    const annotations = firstRaw(node.data || {}, [
        'K8s.Extra.ObjectMeta.Annotations',
        'K8s.Extra.ObjectMeta.annotations',
        'K8s.Extra.Metadata.Annotations',
        'K8s.Extra.metadata.annotations',
        'K8s.Metadata.Annotations',
        'K8s.Annotations',
        'Annotations'
    ]) || {}
    const raw = annotations['deployment.kubernetes.io/revision']
        ?? kubernetesLabelValue(annotations, 'deployment.kubernetes.io/revision')
    const value = Number(raw)
    return raw === undefined || !Number.isFinite(value) ? undefined : value
}

const replicaSetReplicaState = (node: Node, nodes: Node[]) => {
    const numberAt = (paths: string[]): number => {
        const raw = firstRaw(node.data || {}, paths)
        const value = Number(raw)
        return raw === undefined || !Number.isFinite(value) ? 0 : value
    }
    const desired = numberAt(['K8s.Extra.Spec.Replicas', 'K8s.Extra.spec.replicas', 'K8s.DesiredReplicas', 'DesiredReplicas'])
    const replicas = numberAt(['K8s.Extra.Status.Replicas', 'K8s.Extra.status.replicas', 'K8s.Replicas', 'Replicas'])
    const ready = numberAt(['K8s.Extra.Status.ReadyReplicas', 'K8s.Extra.status.readyReplicas', 'K8s.ReadyReplicas', 'ReadyReplicas'])
    const available = numberAt(['K8s.Extra.Status.AvailableReplicas', 'K8s.Extra.status.availableReplicas', 'K8s.AvailableReplicas', 'AvailableReplicas'])
    const podCount = kubernetesPodsForReplicaSets([node], nodes).filter(isCurrentKubernetesPod).length
    return { desired, replicas, ready, available, podCount }
}

/** Selects the current ReplicaSet by the Deployment revision annotation and
 * then by the highest collected ReplicaSet revision. This never promotes a
 * ReplicaSet that is not owned by the Deployment. */
export const currentKubernetesReplicaSetForDeployment = (deployment: Node, nodes: Node[]): Node | undefined => {
    const replicaSets = kubernetesReplicaSetRelationsForDeployment(deployment, nodes)
    const targetRevision = deploymentRevision(deployment)
    return replicaSets.slice().sort((left, right) => {
        const score = (replicaSet: Node): number => {
            const state = replicaSetReplicaState(replicaSet, nodes)
            const revision = deploymentRevision(replicaSet) ?? -1
            const active = state.desired > 0 || state.replicas > 0 || state.ready > 0 || state.available > 0 || state.podCount > 0
            const targetRevisionMatch = targetRevision !== undefined && revision === targetRevision
            return (active ? 1000000 : 0)
                + (targetRevisionMatch ? 100000 : 0)
                + state.podCount * 10000
                + state.ready * 1000
                + state.available * 100
                + state.desired * 10
                + Math.max(0, revision)
        }
        return score(right) - score(left)
    })[0]
}

/** Pods whose direct controller OwnerReference points at one of the supplied
 * ReplicaSets. No Deployment selector fallback is used. */
export const kubernetesPodsForReplicaSets = (replicaSets: Node[], nodes: Node[]): Node[] => {
    return nodes.filter(node => resourceType(node) === 'pod' && ownerReferences(node).some(owner => {
        if (String(owner?.Kind || owner?.kind || '').toLowerCase() !== 'replicaset') return false
        return replicaSets.some(replicaSet => sameScope(replicaSet, node) && ownerMatches(owner, 'replicaset', replicaSet))
    }))
}
