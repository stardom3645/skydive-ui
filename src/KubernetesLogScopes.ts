import type { Node } from './Topology'
import { KUBERNETES_CONTROLLER_TYPES, resolveKubernetesPodController, resolveKubernetesPodTopController } from './KubernetesWorkloadOwnership'
import type { KubernetesLogContainer } from './KubernetesPodLogs'

const raw = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const value = path.split('.').reduce((part, key) => part?.[key], data)
        if (value !== undefined && value !== null && value !== '') return value
    }
}
const text = (data: any, paths: string[]) => String(raw(data, paths) || '').trim()
const kind = (node: Node) => String(node.data?.Type || '').toLowerCase()
const kubernetes = (node: Node) => String(node.data?.Manager || '').toLowerCase() === 'k8s' && !node.data?.IsTopologyGroup
const parents = (node: Node) => {
    const result: Node[] = [], seen = new Set<string>()
    let current: Node | null | undefined = node
    while (current && !seen.has(current.id)) { result.push(current); seen.add(current.id); current = current.parent }
    return result
}
export const kubernetesLogResourceName = (node: Node) => text(node.data, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name', 'K8s.Extra.metadata.name']) || node.id
const uid = (node: Node) => text(node.data, ['K8s.Extra.ObjectMeta.UID', 'K8s.Extra.metadata.uid', 'K8s.UID', 'UID', 'uid']) || node.id
const namespace = (node: Node) => text(node.data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace', 'K8s.Extra.metadata.namespace'])
    || (parents(node).find(parent => kind(parent) === 'namespace') ? kubernetesLogResourceName(parents(node).find(parent => kind(parent) === 'namespace')!) : '')
const normalize = (values: any[]) => values.map(value => typeof value === 'string' ? value.trim().toLowerCase() : '').filter(Boolean)
const identity = (node: Node) => {
    const lineage = parents(node)
    const cluster = lineage.find(parent => kubernetes(parent) && kind(parent) === 'cluster')
    const ids = normalize(lineage.reduce<any[]>((values, parent) => values.concat([parent.data?.MoldClusterId, parent.data?.MoldClusterID,
        parent.data?.ClusterID, parent.data?.ClusterId, parent.data?.clusterId, parent.data?.K8s?.ClusterID]), []))
    const names = normalize(lineage.map(parent => raw(parent.data, ['ClusterName', 'clusterName', 'K8s.ClusterName', 'Cluster'])))
    if (cluster) names.push(kubernetesLogResourceName(cluster).toLowerCase())
    return { anchor: cluster?.id, ids, names }
}
const intersects = (a: string[], b: string[]) => a.some(value => b.includes(value))
const sameCluster = (left: Node, right: Node) => {
    const a = identity(left), b = identity(right)
    if (a.anchor && b.anchor) return a.anchor === b.anchor
    if (a.ids.length && b.ids.length) return intersects(a.ids, b.ids)
    return intersects(a.names, b.names)
}

/** Resolve the existing Mold connection, preferring IDs and refusing ambiguous
 * name matches rather than selecting an arbitrary cluster's credentials. */
export function kubernetesLogCluster(scope: Node, clusters: any[]): any | undefined {
    const context = identity(scope)
    const byID = clusters.filter(cluster => normalize([cluster?.id]).some(id => [...context.ids, context.anchor?.toLowerCase()].includes(id)))
    if (byID.length) return byID.length === 1 ? byID[0] : undefined
    const byName = clusters.filter(cluster => normalize([cluster?.name]).some(name => context.names.includes(name)))
    return byName.length === 1 ? byName[0] : undefined
}

/** Scope only existing topology inventory, including completed/terminating
 * Pods whose logs can still exist. Live log requests always recheck the UID. */
export function kubernetesResourceLogPods(scope: Node, nodes: Node[]): Node[] {
    if (!kubernetes(scope)) return []
    const scoped = nodes.filter(node => kubernetes(node) && sameCluster(scope, node))
    const seen = new Set<string>(), scopeKind = kind(scope), scopeName = kubernetesLogResourceName(scope)
    const scopeNamespace = namespace(scope)
    const ownerInventory = scopeNamespace ? scoped.filter(node => namespace(node) === scopeNamespace) : scoped
    return scoped.filter(pod => {
        if (kind(pod) !== 'pod') return false
        let match = false
        if (scopeKind === 'cluster') match = true
        else if (scopeKind === 'namespace') match = namespace(pod) === scopeName
        else if (scopeKind === 'node') match = text(pod.data, ['K8s.Extra.Spec.NodeName', 'K8s.Extra.spec.nodeName', 'K8s.Spec.NodeName', 'K8s.Node', 'NodeName']) === scopeName
        else if (KUBERNETES_CONTROLLER_TYPES.has(scopeKind)) {
            if (scopeNamespace && namespace(pod) !== scopeNamespace) return false
            const owner = resolveKubernetesPodController(pod, ownerInventory), top = resolveKubernetesPodTopController(pod, ownerInventory)
            match = pod.data?.TopologyWorkloadControllerID === scope.id || owner?.id === scope.id || top?.id === scope.id
                || parents(pod).slice(1).some(parent => parent.id === scope.id)
        }
        if (!match || seen.has(uid(pod))) return false
        seen.add(uid(pod)); return true
    }).sort((a, b) => namespace(a).localeCompare(namespace(b)) || kubernetesLogResourceName(a).localeCompare(kubernetesLogResourceName(b)) || uid(a).localeCompare(uid(b)))
}

export function kubernetesPodLogTarget(pod: Node) {
    const spec = raw(pod.data, ['K8s.Extra.Spec', 'K8s.Extra.spec', 'K8s.Spec', 'Spec']) || {}
    const status = raw(pod.data, ['K8s.Extra.Status', 'K8s.Extra.status', 'K8s.Status', 'Status']) || {}
    const containers: KubernetesLogContainer[] = [], seen = new Set<string>()
    const append = (items: any, type: string) => {
        if (!Array.isArray(items)) return
        items.forEach(item => {
            const name = String(item?.Name || item?.name || '')
            if (name && !seen.has(name)) { seen.add(name); containers.push({ name, type }) }
        })
    }
    append(spec.Containers || spec.containers, 'APPLICATION')
    append(spec.InitContainers || spec.initContainers, 'INIT')
    append(spec.EphemeralContainers || spec.ephemeralContainers, 'EPHEMERAL')
    append(status.ContainerStatuses || status.containerStatuses, 'APPLICATION')
    append(status.InitContainerStatuses || status.initContainerStatuses, 'INIT')
    append(status.EphemeralContainerStatuses || status.ephemeralContainerStatuses, 'EPHEMERAL')
    return { uid: uid(pod), name: kubernetesLogResourceName(pod), namespace: namespace(pod), containers }
}
