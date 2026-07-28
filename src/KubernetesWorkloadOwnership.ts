import type { Node } from './Topology'
import { isCurrentKubernetesPod } from './KubernetesPodLifecycle'
import { matchesKubernetesSelector } from './KubernetesSelectors'

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
    'K8s.Extra.ObjectMeta.Name'
]) || '')
const resourceUID = (node: Node): string => String(firstRaw(node.data || {}, [
    'K8s.Extra.ObjectMeta.UID',
    'K8s.UID',
    'UID'
]) || node.id)
const resourceNamespace = (node: Node): string => String(firstRaw(node.data || {}, [
    'K8s.Namespace',
    'Namespace',
    'K8s.Extra.ObjectMeta.Namespace'
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
        'K8s.Extra.Metadata.OwnerReferences',
        'K8s.Metadata.OwnerReferences',
        'K8s.OwnerReferences',
        'OwnerReferences'
    ])
    if (!Array.isArray(value)) return []
    return value.slice().sort((left, right) => Number(!!right?.Controller) - Number(!!left?.Controller))
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

export const kubernetesPodsForController = (controller: Node, nodes: Node[]): Node[] =>
    nodes.filter(node => resourceType(node) === 'pod' && resolveKubernetesPodController(node, nodes)?.id === controller.id)

export const currentKubernetesPodsForController = (controller: Node, nodes: Node[]): Node[] =>
    kubernetesPodsForController(controller, nodes).filter(isCurrentKubernetesPod)
