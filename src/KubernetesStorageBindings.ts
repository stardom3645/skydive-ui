import type { Node } from './Topology'
import { kubernetesStorageObservation } from './KubernetesStorageStatus'

const text = (data: any, paths: string[]) => {
    for (const path of paths) {
        const value = path.split('.').reduce((source, key) => source?.[key], data)
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return ''
}
const type = (node: Node) => String(node.data?.Type || '').toLowerCase()
export const isKubernetesStorageBindingPair = (left: Node, right: Node) =>
    [left, right].every(node => String(node.data?.Manager || '').toLowerCase() === 'k8s')
    && [type(left), type(right)].sort().join(':') === 'persistentvolume:persistentvolumeclaim'
export const kubernetesStorageBindingKey = (left: Node, right: Node) => JSON.stringify([left.id, right.id].sort())

const specPaths = (suffix: string, flat: string[] = []) => [
    `K8s.Extra.Spec.${suffix}`, `K8s.Extra.spec.${suffix}`, `K8s.Spec.${suffix}`, `Spec.${suffix}`, `spec.${suffix}`, ...flat
]
const name = (node: Node) => text(node.data, ['Name', 'name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name', 'K8s.Extra.metadata.name', 'metadata.name'])
const uid = (node: Node) => text(node.data, ['K8s.Extra.ObjectMeta.UID', 'K8s.Extra.ObjectMeta.uid', 'K8s.Extra.metadata.uid', 'K8s.UID', 'ObjectMeta.UID', 'metadata.uid', 'UID'])
const namespace = (node: Node) => text(node.data, ['K8s.Namespace', 'Namespace', 'namespace', 'K8s.Extra.ObjectMeta.Namespace', 'K8s.Extra.metadata.namespace', 'metadata.namespace'])
const clusterKeys = (node: Node) => {
    const keys = new Set<string>(), visited = new Set<Node>()
    for (let current: Node | null = node; current && !visited.has(current); current = current.parent) {
        visited.add(current)
        const currentKeys = new Set<string>()
        for (const path of ['ClusterID', 'ClusterId', 'ClusterName', 'clusterName', 'K8s.ClusterID', 'K8s.ClusterName']) {
            const value = text(current.data, [path]); if (value) currentKeys.add(value.toLowerCase())
        }
        if (type(current) === 'cluster' && !current.data?.IsTopologyGroup) {
            currentKeys.add(current.id.toLowerCase()); const value = name(current); if (value) currentKeys.add(value.toLowerCase())
            // A stale/wrong parent must not override explicit cluster identity.
            if (!keys.size || [...currentKeys].some(key => keys.has(key))) currentKeys.forEach(key => keys.add(key))
            break
        }
        if (!keys.size) currentKeys.forEach(key => keys.add(key))
    }
    return keys
}

/** Current one-to-one bindings only. Released claimRef is historical; Pending
 * volumeName / Available claimRef can be reservations rather than a binding.
 * A conflicting UID must never reconnect a newly created claim with an old PV. */
export const kubernetesStorageBindings = (nodes: Node[]): Array<{ source: Node; target: Node }> => {
    const storage = nodes.filter(node => String(node.data?.Manager).toLowerCase() === 'k8s' && !node.data?.IsTopologyGroup
        && ['persistentvolume', 'persistentvolumeclaim'].includes(type(node)))
    const observations = new Map(storage.map(node => [node, kubernetesStorageObservation(node.data)]))
    const scopes = new Map(storage.map(node => [node, clusterKeys(node)]))
    const claims = storage.filter(node => type(node) === 'persistentvolumeclaim')
    const pairs: Array<{ source: Node; target: Node }> = []
    storage.filter(node => type(node) === 'persistentvolume').forEach(volume => {
        const phase = String(observations.get(volume)!.phase || '').trim().toLowerCase()
        if (phase && phase !== 'bound') return
        const claimName = text(volume.data, [...specPaths('ClaimRef.Name'), ...specPaths('claimRef.name'), 'K8s.ClaimRef', 'ClaimRef.Name', 'claimRef.name'])
        const claimNamespace = text(volume.data, [...specPaths('ClaimRef.Namespace'), ...specPaths('claimRef.namespace'), 'K8s.ClaimNamespace', 'ClaimNamespace', 'ClaimRef.Namespace', 'claimRef.namespace'])
        const claimUID = text(volume.data, [...specPaths('ClaimRef.UID'), ...specPaths('claimRef.uid'), 'ClaimRef.UID', 'claimRef.uid'])
        const candidates = claims.filter(claim => {
            if (![...scopes.get(volume)!].some(key => scopes.get(claim)!.has(key))) return false
            const observed = observations.get(claim)!, claimPhase = String(observed.phase || '').trim().toLowerCase()
            if (claimPhase && claimPhase !== 'bound') return false
            if (phase !== 'bound' && claimPhase !== 'bound') return false
            const volumeName = String(observed.volumeName || ''), actualUID = uid(claim)
            if (volumeName && volumeName !== name(volume)) return false
            if (claimName && claimName !== name(claim)) return false
            if (claimNamespace && claimNamespace !== namespace(claim)) return false
            if (claimUID && actualUID && claimUID !== actualUID) return false
            return !!volumeName || !!(claimUID && actualUID === claimUID) || !!(claimName && claimNamespace)
        })
        if (candidates.length === 1) pairs.push({ source: candidates[0], target: volume })
    })
    const counts = new Map<Node, number>()
    pairs.forEach(pair => counts.set(pair.source, (counts.get(pair.source) || 0) + 1))
    return pairs.filter(pair => counts.get(pair.source) === 1)
}
