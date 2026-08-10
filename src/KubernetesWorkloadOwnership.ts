import type { Node } from './Topology'
import { isCurrentKubernetesPod } from './KubernetesPodLifecycle'
import { kubernetesLabelValue, matchesKubernetesSelector } from './KubernetesSelectors'

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
const resourceNamespace = (node: Node): string => String(firstRaw(node.data || {}, [
    'K8s.Namespace',
    'Namespace',
    'K8s.Extra.ObjectMeta.Namespace',
    'K8s.Extra.Metadata.Namespace',
    'K8s.Extra.metadata.namespace'
]) || '')
const resourceCluster = (node: Node): string => String(firstRaw(node.data || {}, [
    'ClusterName',
    'clusterName',
    'K8s.ClusterName',
    'Cluster'
]) || '')
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
    return value.slice().sort((left, right) => Number(!!right?.Controller) - Number(!!left?.Controller))
}

const ownerMatches = (owner: any, expectedKind: string, ownerNode: Node): boolean => {
    const kind = String(owner?.Kind || owner?.kind || '').toLowerCase()
    const uid = String(owner?.UID || owner?.uid || '')
    const name = String(owner?.Name || owner?.name || '')
    if (kind && kind !== expectedKind.toLowerCase()) return false
    if (uid && uid === resourceUID(ownerNode)) return true
    return !!name && name === resourceName(ownerNode)
}

const sameScope = (left: Node, right: Node): boolean => {
    const leftNamespace = resourceNamespace(left)
    const rightNamespace = resourceNamespace(right)
    const leftCluster = resourceCluster(left)
    const rightCluster = resourceCluster(right)
    return (!leftNamespace || !rightNamespace || leftNamespace === rightNamespace)
        && (!leftCluster || !rightCluster || leftCluster === rightCluster)
}

const findOwnerNode = (owner: any, child: Node, nodes: Node[]): Node | undefined => {
    const ownerUID = String(owner?.UID || owner?.uid || '')
    const ownerName = String(owner?.Name || owner?.name || '')
    const ownerKind = String(owner?.Kind || owner?.kind || '').toLowerCase()
    return nodes.find(candidate => {
        if (String(candidate.data?.Manager || '').toLowerCase() !== 'k8s' || !sameScope(candidate, child)) return false
        if (ownerKind && resourceType(candidate) !== ownerKind) return false
        if (ownerUID && resourceUID(candidate) === ownerUID) return true
        return !!ownerName && resourceName(candidate) === ownerName
    })
}

const labels = (node: Node): Record<string, any> => {
    const value = firstRaw(node.data || {}, [
        'K8s.Labels',
        'K8s.Extra.ObjectMeta.Labels',
        'Labels'
    ])
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

const controllerSelectorMatches = (controller: Node, pod: Node): boolean => {
    const selector = firstRaw(controller.data || {}, [
        'K8s.Extra.Spec.Selector.MatchLabels',
        'K8s.Spec.Selector.MatchLabels',
        'Spec.Selector.MatchLabels',
        'K8s.Extra.Spec.Selector',
        'K8s.Spec.Selector',
        'Spec.Selector'
    ])
    const podLabels = labels(pod)
    return matchesKubernetesSelector(selector, podLabels)
}

const deploymentForMissingReplicaSet = (owner: any, pod: Node, nodes: Node[]): Node | undefined => {
    const replicaSetName = String(owner?.Name || owner?.name || '')
    if (!replicaSetName) return undefined
    // Some collectors retain the Pod -> ReplicaSet OwnerReference but omit the
    // ReplicaSet object itself. In that case only accept a Deployment when both
    // the generated ReplicaSet name prefix and the Deployment selector match.
    return nodes
        .filter(candidate => resourceType(candidate) === 'deployment'
            && sameScope(candidate, pod)
            && replicaSetName.indexOf(`${resourceName(candidate)}-`) === 0
            && controllerSelectorMatches(candidate, pod))
        .sort((left, right) => resourceName(right).length - resourceName(left).length)[0]
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
        if (!ownerNode) {
            const deployment = deploymentForMissingReplicaSet(owner, pod, nodes)
            if (deployment) return deployment
            continue
        }

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
    nodes.filter(node => resourceType(node) === 'pod' && (
        String(node.data?.TopologyWorkloadControllerID || '') === controller.id
        || resolveKubernetesPodController(node, nodes)?.id === controller.id
    ))

export const currentKubernetesPodsForController = (controller: Node, nodes: Node[]): Node[] =>
    kubernetesPodsForController(controller, nodes).filter(isCurrentKubernetesPod)

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
