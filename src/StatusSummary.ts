import type { Link, Node } from './Topology'
import { kubernetesResourceSelfStatus, kubernetesTopologyHasInactiveClusterAncestor } from './KubernetesTopologyBadgeAggregation'
import { isKubernetesTopologyData } from './KubernetesInfrastructureEvidence'
import { isCurrentKubernetesPod } from './KubernetesPodLifecycle'
import { TopologyResourceCategory, TopologyResourceDomain, topologyResourceCategory, topologyResourceDomain } from './TopologyResourceClassification'

export type SummaryStatus = 'problem' | 'attention' | 'unavailable' | 'inactive'
export interface StatusSummaryEntry {
    node: Node
    status: SummaryStatus
    reason: string
}

export interface InfrastructureAttentionResult {
    status?: SummaryStatus
    reason?: string
}

const normalized = (value: any): string => String(value ?? '').trim().toLowerCase()
const valueAt = (data: any, keys: string[]): any => {
    for (const key of keys) {
        const value = data?.[key]
        if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return undefined
}
const resourceType = (node: Node): string => normalized(valueAt(node.data || {}, ['Type', 'type']))
const rawState = (node: Node): string => normalized(valueAt(node.data || {}, [
    'State', 'Status', 'state', 'status', 'OperState', 'OperationalState', 'LinkState', 'Health'
]))
const interfaceTypes = new Set([
    'device', 'nic', 'interface', 'port', 'switchport', 'bond', 'bridge', 'ovsbridge',
    'openvswitch', 'ovsport', 'vlan', 'tun', 'tap', 'tuntap', 'veth'
])
const pathTypes = new Set(['bond', 'bridge', 'ovsbridge', 'openvswitch', 'ovsport', 'switchport', 'port'])

const collectionFailure = (node: Node): boolean => {
    const marker = normalized(valueAt(node.data || {}, [
        'CollectionState', 'collectionState', 'CollectionStatus', 'collectionStatus',
        'DataCollectionState', 'dataCollectionState'
    ]))
    return /unavailable|uncollected|not.?collected|failed|failure|error|stale|expired/.test(marker)
}

const administrativelyInactive = (node: Node): boolean => {
    const data = node.data || {}
    const admin = normalized(valueAt(data, [
        'AdminState', 'AdministrativeState', 'AdminStatus', 'adminState', 'administrativeState'
    ]))
    const enabled = valueAt(data, ['Enabled', 'enabled', 'IsEnabled', 'isEnabled'])
    const disabled = valueAt(data, ['Disabled', 'disabled', 'AdministrativelyDisabled'])
    return /down|disabled|inactive|off|false|0/.test(admin)
        || enabled === false || normalized(enabled) === 'false'
        || disabled === true || normalized(disabled) === 'true'
}

const peerNodes = (node: Node, links: Link[]): Node[] => links.reduce<Node[]>((peers, link) => {
    if (link.source.id === node.id) peers.push(link.target)
    else if (link.target.id === node.id) peers.push(link.source)
    return peers
}, [])

/** A raw interface state is actionable only when topology evidence says that
 * the interface participates in a real forwarding path. Host ownership alone
 * is deliberately not enough: unused NICs are commonly DOWN by design. */
const interfaceParticipatesInPath = (node: Node, links: Link[]): boolean => {
    const data = node.data || {}
    if (valueAt(data, [
        'Master', 'MasterName', 'Bond', 'BondName', 'Bridge', 'BridgeName',
        'PeerIntfMAC', 'PeerInterface', 'RemotePort', 'OfPort'
    ]) !== undefined) return true
    const related = [node.parent, ...(node.children || []), ...peerNodes(node, links)]
        .filter((candidate): candidate is Node => !!candidate && candidate.id !== node.id)
    return related.some(candidate => pathTypes.has(resourceType(candidate)))
}

const explicitOperationalImpact = (node: Node): boolean => {
    const data = node.data || {}
    const impact = normalized(valueAt(data, [
        'OperationalImpact', 'Impact', 'AvailabilityImpact', 'Alarm', 'Alert', 'Problem'
    ]))
    return !!impact && !/^(false|0|none|normal|healthy|ok)$/.test(impact)
}

/** Shared domain classifier for operator attention. It intentionally does not
 * equate a lone DOWN value with a fault. */
export const infrastructureAttentionStatus = (
    node: Node,
    links: Link[] = [],
    fallbackStatus?: (node: Node) => { kind: string, label: string }
): InfrastructureAttentionResult => {
    if (administrativelyInactive(node)) return { status: 'inactive', reason: '관리 설정에 따라 비활성화되었습니다.' }
    if (collectionFailure(node)) return { status: 'unavailable', reason: '상태 데이터를 수집하지 못했습니다.' }

    const type = resourceType(node)
    const fallback = fallbackStatus ? fallbackStatus(node) : undefined
    const state = rawState(node) || normalized(fallback?.label)
    if (/^(disabled|inactive|off)$/.test(state)) return { status: 'inactive', reason: '현재 비활성 상태입니다.' }
    const stopped = /stopped|shutdown|powered.?off|suspended|정지|중지/.test(state)
    if (stopped) return { status: 'inactive', reason: '현재 운영되지 않는 상태입니다.' }

    const isInterface = interfaceTypes.has(type)
    const participates = isInterface && interfaceParticipatesInPath(node, links)
    const failed = /error|failed|failure|critical|unhealthy|비정상/.test(state)
    if (failed || explicitOperationalImpact(node)) {
        if (!isInterface || participates || explicitOperationalImpact(node)) {
            return { status: 'problem', reason: '운영 영향이 있는 비정상 상태가 확인되었습니다.' }
        }
        return {}
    }

    const down = /^(down|disconnected|no.?carrier)$/.test(state)
    if (down) {
        if (type === 'libvirt') return { status: 'inactive', reason: '현재 실행되지 않는 VM입니다.' }
        if (isInterface) return participates
                ? { status: 'attention', reason: '사용 중인 연결 경로의 상태 확인이 필요합니다.' }
                : {}
        return { status: 'attention', reason: '자원의 현재 운영 상태 확인이 필요합니다.' }
    }
    if (/warning|warn|degraded|주의|경고/.test(state) || fallback?.kind === 'warning') {
        return { status: 'attention', reason: '상태 변화 또는 이상 징후의 확인이 필요합니다.' }
    }
    // A generic bad fallback without supporting state/context is not enough to
    // declare an incident. Keep normal and unknown resources out of the list.
    return {}
}

/** Builds the operator-attention list from the shared Kubernetes and
 * infrastructure domain classifiers rather than from presentation labels. */
export const statusSummaryEntries = (
    nodes: Node[],
    infrastructureStatus: (node: Node) => { kind: string, label: string },
    links: Link[] = []
): StatusSummaryEntry[] => nodes.reduce<StatusSummaryEntry[]>((entries, node) => {
    if (node.data?.IsTopologyGroup || !node.data?.Type) return entries
    if (isKubernetesTopologyData(node.data, node.tags)) {
        if (kubernetesTopologyHasInactiveClusterAncestor(node)) return entries
        if (resourceType(node) === 'pod' && !isCurrentKubernetesPod(node)) return entries
        const result = kubernetesResourceSelfStatus(node)
        const status: SummaryStatus | undefined = result.state === 'inactive' ? 'inactive'
            : result.collection !== 'collected' ? 'unavailable'
                : result.state === 'unknown' ? 'attention'
                : result.state === 'problem' ? 'problem' : undefined
        if (status) entries.push({ node, status, reason: result.findings.join(' · ') || (status === 'inactive' ? '현재 운영되지 않는 자원입니다.' : '상태를 확인할 수 없습니다.') })
    } else {
        const result = infrastructureAttentionStatus(node, links, infrastructureStatus)
        if (result.status) entries.push({ node, status: result.status, reason: result.reason || '확인이 필요합니다.' })
    }
    return entries
}, [])

export const filterStatusSummary = (
    entries: StatusSummaryEntry[],
    status: SummaryStatus | 'all',
    domain: TopologyResourceDomain | 'all',
    category: TopologyResourceCategory | 'all',
    search: string,
    name: (node: Node) => string
) => {
    const query = search.trim().toLocaleLowerCase()
    return entries.filter(entry => (status === 'all' || entry.status === status)
        && (domain === 'all' || topologyResourceDomain(entry.node) === domain)
        && (category === 'all' || topologyResourceCategory(entry.node) === category)
        && (!query || name(entry.node).toLocaleLowerCase().includes(query)))
}

export const statusSummaryResourceCounts = (entries: StatusSummaryEntry[]) => entries.reduce((counts, entry) => {
    const domain = topologyResourceDomain(entry.node)
    const category = topologyResourceCategory(entry.node)
    counts.all++
    counts[domain]++
    if (category) counts[category]++
    return counts
}, {
    all: 0,
    infrastructure: 0,
    kubernetes: 0,
    switch: 0,
    host: 0,
    vm: 0,
    cluster: 0,
    node: 0,
    pod: 0
})

export const statusSummaryCounts = (entries: StatusSummaryEntry[]) => entries.reduce((counts, entry) => {
    counts[entry.status]++
    counts.all++
    return counts
}, { problem: 0, attention: 0, unavailable: 0, inactive: 0, all: 0 })

// Graph update timestamps are not necessarily collection timestamps.
export const lastCollectionTime = (node: Node): string => {
    const value = node.data?.LastCollectedAt || node.data?.LastSeen || node.data?.lastCollectedAt
    if (value === undefined || value === null || value === '') return '확인 불가'
    const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value)
    return isNaN(date.getTime()) ? '확인 불가' : date.toLocaleString('ko-KR', { hour12: false })
}
