/** Semantic graph traversal. No screen coordinates, display parents, name/IP matching or traffic inference. */
export type ConnectionScope = 'direct' | 'all'
export interface RelationNode { id: string; data: any }
export interface RelationEdge { id: string; source: RelationNode; target: RelationNode; data: any }
type Phase = 'seed' | 'up' | 'down' | 'both' | 'reference' | 'terminal'
type Kind = 'owner' | 'network' | 'reference' | 'placement' | 'unknown'
export interface ConnectionTraversal {
    nodeIDs: Set<string>; linkIDs: Set<string>; truncated: boolean; examined: number; unknownRelations: number
}
export function connectionEvidenceLabel(node: RelationNode | undefined, relatedCount: number): string {
    const collection = String(node?.data?.K8s?.CollectionStatus || node?.data?.CollectionStatus || node?.data?.CollectionState || '').toLowerCase()
    const unknown = /failed|stale|unavailable|disconnected|pending|inactive|unknown|unconfigured/.test(collection)
    return relatedCount ? `관련 ${relatedCount}개${unknown ? ' · 수집 확인 필요' : ''}` : unknown ? '수집/관계 미확인' : '수집된 관계 없음'
}
const type = (node: RelationNode) => String(node.data?.Type || '').toLowerCase()
const kube = (node: RelationNode) => ['k8s', 'kubernetes'].includes(String(node.data?.Manager || '').toLowerCase())
const cluster = (node: RelationNode, key: 'ClusterName' | 'ClusterID') => String(node.data?.[key] || node.data?.K8s?.[key] || '').toLowerCase()
const controllers = new Set(['deployment', 'replicaset', 'replicationcontroller', 'daemonset', 'statefulset', 'job', 'cronjob'])
const networkTypes = new Set(['switch', 'switchport', 'host', 'device', 'nic', 'interface', 'bond', 'bridge', 'ovsbridge', 'openvswitch', 'vlan', 'ovsport', 'port', 'tuntap', 'tun', 'tap', 'veth', 'internal', 'patch', 'libvirt'])
const physicalRelations = new Set(['layer2', 'vlayer2', 'manual', 'vf', 'mapping', 'patch', 'veth', 'tunnel'])
const active = (edge: RelationEdge, now: number) => {
    const expires = edge.data?.LLDP?.ExpiresAt
    return !edge.data?.DeletedAt && !(expires !== undefined && expires !== null && Number.isFinite(Number(expires)) && Number(expires) <= now)
}

const raw = (node: RelationNode, paths: string[]) => {
    for (const path of paths) { const value = path.split('.').reduce((item, key) => item?.[key], node.data); if (value !== undefined && value !== null && value !== '') return String(value) }
    return ''
}
const validStoragePair = (edge: RelationEdge) => {
    const claim = type(edge.source) === 'persistentvolumeclaim' ? edge.source : edge.target
    const volume = type(edge.source) === 'persistentvolume' ? edge.source : edge.target
    if (type(claim) !== 'persistentvolumeclaim' || type(volume) !== 'persistentvolume') return true
    for (const node of [claim, volume]) if (/^(released|failed|lost)$/i.test(raw(node, ['K8s.Extra.Status.Phase', 'K8s.Extra.status.phase', 'Status.Phase']))) return false
    const expectedUID = raw(volume, ['K8s.Extra.Spec.ClaimRef.UID', 'K8s.Extra.spec.claimRef.uid'])
    const uid = raw(claim, ['K8s.UID', 'K8s.Extra.ObjectMeta.UID', 'K8s.Extra.metadata.uid'])
    const volumeName = raw(claim, ['K8s.Extra.Spec.VolumeName', 'K8s.Extra.spec.volumeName'])
    return !(expectedUID && uid && expectedUID !== uid) && !(volumeName && volume.data?.Name && volumeName !== String(volume.data.Name))
}

/** Parent/child orientation is validated by endpoint kinds, not by layout depth. */
export function connectionRelationKind(edge: RelationEdge): Kind {
    const a = type(edge.source), b = type(edge.target), relation = String(edge.data?.RelationType || '').toLowerCase()
    if (kube(edge.source) !== kube(edge.target)) return ['node', 'container', 'ownership'].includes(relation) ? 'placement' : 'unknown'
    if (relation === 'ownership' || relation === 'vownership') return 'owner'
    if (!kube(edge.source)) return physicalRelations.has(relation) && networkTypes.has(a) && networkTypes.has(b) ? 'network' : 'unknown'
    if ((a === 'node' && b === 'pod') || (a === 'persistentvolume' && b === 'node') || relation === 'container') return 'placement'
    if (relation === a && ((a === 'deployment' && b === 'replicaset') || (a === 'cronjob' && b === 'job')
        || (controllers.has(a) && !['deployment', 'cronjob'].includes(a) && b === 'pod'))) return 'owner'
    const pairs: Record<string, string[]> = { ingress: ['service'], service: ['pod', 'endpoints', 'endpointslice'],
        pod: ['persistentvolumeclaim', 'configmap', 'secret', 'serviceaccount'], persistentvolumeclaim: ['persistentvolume'],
        storageclass: ['persistentvolumeclaim', 'persistentvolume'], networkpolicy: ['pod'], horizontalpodautoscaler: [...controllers], poddisruptionbudget: ['pod'] }
    return relation === a && pairs[a]?.includes(b) ? 'reference' : 'unknown'
}

export class TopologyRelationGraph {
    private adjacent = new Map<string, RelationEdge[]>()
    private tiers = new Map<string, number | undefined>()
    constructor(private nodes: Map<string, RelationNode>, edges: Iterable<RelationEdge>) {
        for (const edge of edges) {
            if (!nodes.has(edge.source.id) || !nodes.has(edge.target.id) || edge.source.id === edge.target.id) continue
            if ([edge.source, edge.target].some(node => node.id === 'root' || node.data?.IsTopologyGroup)) continue
            if (kube(edge.source) && kube(edge.target) && (['ClusterName', 'ClusterID'] as const).some(key => cluster(edge.source, key) && cluster(edge.target, key) && cluster(edge.source, key) !== cluster(edge.target, key))) continue
            if (!validStoragePair(edge)) continue
            for (const node of [edge.source, edge.target]) {
                const list = this.adjacent.get(node.id) || []; list.push(edge); this.adjacent.set(node.id, list)
            }
        }
    }
    private tier(node: RelationNode): number | undefined {
        if (this.tiers.has(node.id)) return this.tiers.get(node.id)
        const t = type(node)
        const value = t === 'bridge'
            ? (this.adjacent.get(node.id) || []).some(edge => type(edge.source) === 'vlan' || type(edge.target) === 'vlan') ? 6 : 4
            : ({ switch: 0, switchport: 1, host: 1, device: 2, nic: 2, interface: 2, bond: 3,
                vlan: 5, ovsport: 5, port: 5, ovsbridge: 6, openvswitch: 6, tuntap: 7, tun: 7, tap: 7, veth: 7, internal: 7, patch: 7, libvirt: 8 } as Record<string, number>)[t]
        this.tiers.set(node.id, value)
        return value
    }
    traverse(seed: string, scope: ConnectionScope, limits: { nodes?: number; edges?: number; depth?: number; now?: number } = {}): ConnectionTraversal {
        const result: ConnectionTraversal = { nodeIDs: new Set([seed]), linkIDs: new Set(), truncated: false, examined: 0, unknownRelations: 0 }
        if (!this.nodes.has(seed)) return result
        const maxNodes = limits.nodes ?? 500, maxEdges = limits.edges ?? 10000, maxDepth = limits.depth ?? 32, now = limits.now ?? Date.now()
        const queue: Array<{ id: string; phase: Phase; depth: number }> = [{ id: seed, phase: 'seed', depth: 0 }]
        const visited = new Set<string>()
        for (let index = 0; index < queue.length; index++) {
            const step = queue[index], key = `${step.id}:${step.phase}`
            if (visited.has(key) || step.phase === 'terminal') continue
            visited.add(key)
            if (step.depth >= maxDepth) { result.truncated = true; continue }
            for (const edge of this.adjacent.get(step.id) || []) {
                if (result.examined >= maxEdges) { result.truncated = true; return result }
                result.examined++
                if (!active(edge, now)) continue
                const forward = edge.source.id === step.id, current = forward ? edge.source : edge.target, next = forward ? edge.target : edge.source
                const kind = connectionRelationKind(edge)
                let phase: Phase = 'terminal'
                if (scope === 'all') {
                    if (kind === 'unknown') { if (step.phase !== 'seed') continue; result.unknownRelations++ }
                    else if (kind === 'placement') {
                        // A Node anchor may inspect its own scheduled Pods. Reaching a Node from a Pod/PV/host stops here.
                        if (step.phase === 'seed' && kube(current) && type(current) === 'node' && type(next) === 'pod') phase = 'down'
                    }
                    else if (kind === 'owner') {
                        if (forward) {
                            if (['up', 'reference'].includes(step.phase)) continue
                            phase = !kube(current) && step.phase === 'seed' ? 'both' : 'down'
                        } else phase = 'up'
                    } else if (kind === 'reference') {
                        if (forward) { if (step.phase === 'up') continue; phase = 'reference' }
                        else { if (step.phase === 'reference') continue; phase = ['seed', 'up'].includes(step.phase) ? 'up' : 'terminal' }
                    } else if (kind === 'network') {
                        const a = this.tier(current), b = this.tier(next)
                        if (a === undefined || b === undefined || step.phase === 'reference') continue
                        const vf = String(edge.data?.RelationType).toLowerCase() === 'vf'
                        const upstream = vf ? !forward : b <= a, downstream = vf ? forward : b >= a
                        if (step.phase === 'up' && !upstream || step.phase === 'down' && !downstream) continue
                        phase = upstream ? 'up' : 'down'
                    }
                }
                if (!result.nodeIDs.has(next.id) && result.nodeIDs.size >= maxNodes) { result.truncated = true; continue }
                result.nodeIDs.add(next.id); result.linkIDs.add(edge.id)
                if (scope === 'all' && phase !== 'terminal') queue.push({ id: next.id, phase, depth: step.depth + 1 })
            }
        }
        return result
    }
}
