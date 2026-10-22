import { kubernetesStorageObservation, kubernetesStorageOperationalPresentation } from './KubernetesStorageStatus'
import type { Node, Link } from './Topology'
import { kubernetesResourceSelfStatus, kubernetesTopologyDirectChildSummary, kubernetesTopologyCountBadges, kubernetesTopologyBadgeGroupSummary } from './KubernetesTopologyBadgeAggregation'
import type { TopologyStatusBadgeItem, TopologyStatusBadgeGroupSummary } from './TopologyStatusBadge'
import { isCurrentKubernetesPod } from './KubernetesPodLifecycle'
import { kubernetesControllerPodObservation } from './KubernetesWorkloadOwnership'
import { infrastructureAttentionStatus } from './StatusSummary'
import { kubernetesStorageCardMetrics } from './KubernetesStorageCardPresentation'
import { kubernetesMetricsAvailable, kubernetesNodeResourceRowHeight, topologyResourceMetrics, TopologyResourceMetricsIndex } from './TopologyResourceMetrics'
import type { TopologyResourceSnapshot } from './TopologyResourceData'
import { topologyInfrastructureData } from './TopologyResourceData'
import { vmOperatingSystem, vmShowsOperatingSystem, VMOperatingSystem } from './VMOperatingSystem'
import { topologyLayerKind } from './TopologyLayerIcons'
import { topologyServiceVMRole, topologyServiceVMInformation, topologySystemVMInformation } from './TopologyServiceVM'
import type { TopologySystemVMInformation } from './TopologyServiceVM'
import { topologyHostChildBreakdown } from './TopologyHostChildBreakdown'

export type TopologyCardSize = 'large' | 'medium' | 'compact'
export type TopologyCardTone = 'normal' | 'warning' | 'critical' | 'unknown' | 'inactive'
export interface TopologyMetric { key: string; label: string; value: string; percent?: number; description?: string; source?: 'inventory' | 'usage' | 'vm-usage'; sourceLabel?: string }
export interface TopologyCardLayout { height: number; headerHeight?: number; networkHeight?: number; kubernetesMetricsAvailable?: boolean; nodeResourceRowHeight?: number }
export interface TopologyNodePresentation {
    serviceVM?: boolean
    systemVMInformation?: TopologySystemVMInformation
    infrastructure?: boolean
    namespaceSummary?: boolean
    groupResourceCount?: number
    linkState?: 'Up' | 'Down'
    linkStates?: { up: number; down: number; unknown: number }
    lldpDiscoveryCount?: number
    resourceType: string
    name: string; subtitle: string; kind: string; size: TopologyCardSize; networkSummary?: string; networkCount?: number
    operatingSystem?: VMOperatingSystem
    width: number; height: number; group: boolean; expanded: boolean; fullyExpanded: boolean; expandable: boolean
    status: { tone: TopologyCardTone; label: string; description: string }
    metrics: TopologyMetric[]
    metricRowHeights?: number[]
    headerHeight?: number
    networkHeight?: number
    badges: TopologyStatusBadgeItem[]
    badgeSummary: TopologyStatusBadgeGroupSummary
    children?: { total: number; normal: number; warning: number; critical: number; inactive: number }
}

export const TOPOLOGY_CARD_SIZES = {
    large: { width: 580, height: 380 },
    medium: { width: 440, height: 384 },
    compact: { width: 340, height: 304 }
}
const kinds: Record<string, string> = {
    cluster: '쿠버네티스 클러스터', node: '쿠버네티스 노드', namespace: '네임스페이스',
    deployment: 'Deployment', statefulset: 'StatefulSet', daemonset: 'DaemonSet',
    job: 'Job', cronjob: 'CronJob', pod: '파드', container: '컨테이너', service: '서비스',
    persistentvolumeclaim: 'PVC', persistentvolume: 'PV', storageclass: 'StorageClass',
    host: '호스트', bridge: '호스트 브리지', ovsbridge: '가상 스위치', switch: '스위치',
    libvirt: '가상머신', bond: '본딩 인터페이스', tun: '가상 인터페이스',
    device: '네트워크 인터페이스', vlan: 'VLAN', port: '포트', switchport: '스위치 포트'
}
const typeOf = (node: Node) => String(node.data?.Type || '').toLowerCase()
const networkTypes = new Set(['device', 'nic', 'interface', 'port', 'switchport', 'bond', 'bridge', 'ovsbridge',
    'openvswitch', 'ovsport', 'vlan', 'tun', 'tap', 'tuntap', 'veth'])
const isNetworkResource = (node: Node) => String(node.data?.Manager || '').toLowerCase() !== 'k8s' && networkTypes.has(typeOf(node))
/** Link state describes operation, independently from the incident classifier. */
export const topologyNetworkLinkState = (node: Node): 'Up' | 'Down' | undefined => {
    if (!isNetworkResource(node)) return undefined
    const state = String(read(node.data, ['OperState', 'OperationalState', 'LinkState', 'State', 'Status', 'state', 'status']) || '').trim().toLowerCase()
    return state === 'up' ? 'Up' : /^(down|disconnected|no.?carrier)$/.test(state) ? 'Down' : undefined
}
const isVMInterface = (node: Node) => String(node.data?.Manager || '').toLowerCase() !== 'k8s'
    && node.parent?.data?.Type === 'libvirt'
    && (['tuntap', 'tun', 'veth'].includes(typeOf(node))
        || (['device', 'interface', 'port'].includes(typeOf(node))
            && ['tun', 'tuntap', 'tap', 'veth'].includes(String(node.data?.Driver || '').toLowerCase())))
const isNamespaceSummary = (node: Node, group = false) => !group && !node.data?.IsTopologyGroup
    && String(node.data?.Manager || '').toLowerCase() === 'k8s' && typeOf(node) === 'namespace'
export const topologyGroupFullyExpanded = (node: Node) => !!node.state?.expanded && !!node.state?.groupFullSize
const read = (data: any, paths: string[]) => {
    for (const path of paths) {
        const value = path.split('.').reduce((source, key) => source?.[key], data)
        if (value !== undefined && value !== null && value !== '') return value
    }
}

let cardMeasureContext: CanvasRenderingContext2D | null | undefined
const cardTextWidths = new Map<string, number>()
const cardTextWidth = (text: string, fontSize: number) => {
    const key = `${fontSize}:${text}`
    const cached = cardTextWidths.get(key)
    if (cached !== undefined) return cached
    let width = Array.from(text).reduce((total, char) => total + (/[^\x00-\x7f]/.test(char) ? fontSize : fontSize * 0.61), 0)
    if (typeof document !== 'undefined') {
        if (cardMeasureContext === undefined) cardMeasureContext = document.createElement('canvas').getContext('2d')
        if (cardMeasureContext) {
            const family = getComputedStyle(document.body).getPropertyValue('--netdive-font-family') || 'sans-serif'
            cardMeasureContext.font = `${fontSize === 29.5 ? 600 : 400} ${fontSize}px ${family}`
            width = cardMeasureContext.measureText(text).width
        }
    }
    if (cardTextWidths.size > 512) cardTextWidths.clear()
    cardTextWidths.set(key, width)
    return width
}

export const topologyNetworkInfoHeight = (width: number, summary?: string, count?: number) => {
    if (!summary?.trim()) return 0
    const text = count && count > 1 ? `${count}개` : summary.trim()
    return 44 + 36 * Math.min(2, Math.max(1, Math.ceil(cardTextWidth(text, 28) / (width - 62))))
}
const infrastructureHeaderHeight = (width: number, name: string) =>
    60 + 36 * cardTextRows(name, width - 40, 29.5, 3)

const cardTextRowCache = new Map<string, number>()
const cardTextRows = (text: string, width: number, font: number, max: number) => {
    const key = `${width}:${font}:${text}`
    let rows = cardTextRowCache.get(key)
    if (rows === undefined) {
        rows = Math.max(1, Math.ceil(cardTextWidth(text, font) / width))
        if (typeof document !== 'undefined' && document.body) {
            // Browser wrapping prefers hyphens and word boundaries before
            // overflow-wrap. Measuring total string width alone misses that.
            const measure = document.createElement('div')
            measure.setAttribute('aria-hidden', 'true')
            Object.assign(measure.style, { position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden',
                contain: 'layout style paint', width: `${width}px`, padding: '0', border: '0',
                fontFamily: getComputedStyle(document.body).getPropertyValue('--netdive-font-family') || 'sans-serif',
                fontSize: `${font}px`, fontWeight: font === 29.5 ? '600' : '400', lineHeight: '36px',
                whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'normal' })
            measure.textContent = text
            document.body.appendChild(measure)
            rows = Math.max(1, Math.round(measure.getBoundingClientRect().height / 36))
            measure.remove()
        }
        // Keep a large topology's names cached across metric renders, while
        // bounding retained strings as resources are replaced over time.
        if (cardTextRowCache.size >= 4096) cardTextRowCache.delete(cardTextRowCache.keys().next().value!)
        cardTextRowCache.set(key, rows)
    }
    return Math.min(max, rows)
}

const cardHeaderHeight = (node: Node, width: number, name?: string) => {
    const rawName = String(node.data?.Name || '')
    const display = String(name || rawName).split('\n')[0]
    const fullName = display === `${rawName.slice(0, 24)}.` ? rawName : display
    if (String(node.data?.Manager || '').toLowerCase() !== 'k8s')
        return infrastructureHeaderHeight(width, fullName || node.id)
    const type = typeOf(node)
    const namespace = String(read(node.data, ['Namespace', 'namespace', 'K8s.Namespace', 'K8s.Extra.ObjectMeta.Namespace', 'K8s.Extra.metadata.namespace']) || '')
    const subtitle = namespace ? `${kinds[type] || type} · ${namespace}` : kinds[type] || type
    return 60 + 36 * cardTextRows(rawName || node.id, width - 40, 29.5, 3)
        + 8 + 36 * cardTextRows(subtitle, width - 40, 28, 2)
}

/** Share the smallest sufficient content slots across a whole canonical layer,
 * including collapsed children. Kubernetes usage rows can shrink independently
 * while preserving the shared name/header slots. */
export const topologyLayerCardLayouts = (entries: Array<{ node: Node; name?: string; networkSummary?: string; networkCount?: number; kubernetesMetricsAvailable?: boolean; nodeResourceRowHeight?: number }>) => {
    const layers = new Map<string, Array<{ id: string; header: number; network: number; body: number; dynamic: boolean; metrics?: boolean; nodeResourceRowHeight?: number }>>()
    entries.forEach(entry => {
        const { node } = entry
        if (node.data?.IsTopologyGroup || isNamespaceSummary(node)) return
        const infrastructure = String(node.data?.Manager || '').toLowerCase() !== 'k8s'
        const dimensions = topologyCardDimensions(node, false, entry)
        const header = cardHeaderHeight(node, dimensions.width, entry.name)
        const network = infrastructure ? topologyNetworkInfoHeight(dimensions.width, entry.networkSummary, entry.networkCount) : 0
        const router = infrastructure && topologyServiceVMRole(node) === '가상 라우터'
        const body = router ? 18 + 92 : infrastructure && typeOf(node) === 'libvirt' ? 18 + 112 * 2 + 10
            : Math.max(0, dimensions.height - 40 - header - network - (network ? 18 : 0))
        // Compact NICs intentionally inherit their owner's graph weight, but
        // they occupy the row below the VM and need their own compact slots.
        const key = `${infrastructure ? 'infrastructure' : 'kubernetes'}:${node.getWeight?.() ?? typeOf(node)}:${router ? 'router' : isVMInterface(node) ? 'vm-interface' : 'resource'}`
        const layer = layers.get(key) || []
        layer.push({ id: node.id, header, network, body,
            dynamic: !infrastructure && ['node', 'pod', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(typeOf(node)),
            nodeResourceRowHeight: entry.nodeResourceRowHeight,
            metrics: infrastructure ? undefined : entry.kubernetesMetricsAvailable })
        layers.set(key, layer)
    })
    const layouts = new Map<string, TopologyCardLayout>()
    layers.forEach(layer => {
        const headerHeight = Math.max(...layer.map(item => item.header))
        const networkHeight = Math.max(...layer.map(item => item.network))
        const height = 40 + headerHeight + networkHeight + (networkHeight ? 18 : 0) + Math.max(...layer.map(item => item.body))
        layer.forEach(item => layouts.set(item.id, {
            height: item.dynamic ? 40 + headerHeight + item.body : height, headerHeight, networkHeight,
            ...(item.nodeResourceRowHeight !== undefined ? { nodeResourceRowHeight: item.nodeResourceRowHeight } : {}),
            ...(item.metrics !== undefined ? { kubernetesMetricsAvailable: item.metrics } : {})
        }))
    })
    return layouts
}

export const topologyCardDimensions = (node: Node, group = false, options: { name?: string; kubernetesMetricsAvailable?: boolean; nodeResourceRowHeight?: number; networkSummary?: string; networkCount?: number; memberNetworkSummary?: (member: Node) => string | undefined; cardLayout?: TopologyCardLayout; memberCardLayout?: (member: Node) => TopologyCardLayout | undefined } = {}) => {
    if (!group && options.cardLayout) return { ...topologyCardDimensions(node, false, { ...options, kubernetesMetricsAvailable: options.cardLayout.kubernetesMetricsAvailable ?? options.kubernetesMetricsAvailable, nodeResourceRowHeight: options.cardLayout.nodeResourceRowHeight ?? options.nodeResourceRowHeight, cardLayout: undefined }), ...options.cardLayout }
    const type = typeOf(node)
    const infrastructure = String(node.data?.Manager || '').toLowerCase() !== 'k8s'
    const vmNIC = isVMInterface(node)
    const namespaceSummary = isNamespaceSummary(node, group)
    group = group || namespaceSummary || (type === 'namespace' && (node.children || []).length > 0)
    const size: TopologyCardSize = ['cluster', 'host'].includes(type) && !group ? 'large'
        : group || ['node', 'namespace', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob', 'libvirt', 'switch'].includes(type) ? 'medium' : 'compact'
    // Pod names include controller/hash suffixes. Give them the workload
    // width while retaining compact typography and content-driven height.
    const width = vmNIC || type === 'libvirt' ? 480
        : !infrastructure && type === 'pod' ? TOPOLOGY_CARD_SIZES.medium.width : TOPOLOGY_CARD_SIZES[size].width
    if (group) {
        // A namespace is a real resource with a direct-child summary. Its
        // silhouette must not switch when children are empty or unfolded.
        if (namespaceSummary) return { size, width: TOPOLOGY_CARD_SIZES.large.width, height: 340 }
        // Match larger members, while Infrastructure summaries keep enough
        // room for their header and two information blocks beside tiny NICs.
        // Expansion changes visibility, never the summary silhouette.
        const members = (node.children || []).filter(member => !member.data?.IsTopologyGroup)
        const fallback: Node = Object.assign(Object.create(Object.getPrototypeOf(node)), node,
            { data: { ...node.data, IsTopologyGroup: false, Type: node.data?.GroupType || type }, children: [] })
        const dimensions = (members.length ? members : [fallback]).map(member => topologyCardDimensions(member, false,
            { networkSummary: options.memberNetworkSummary?.(member), cardLayout: options.memberCardLayout?.(member) }))
        const largest = dimensions.reduce((largest, item) => item.width > largest.width ? item : largest)
        return { size: infrastructure && largest.size === 'compact' ? 'medium' as TopologyCardSize : largest.size,
            width: Math.max(infrastructure ? 440 : 0, largest.width),
            height: Math.max(infrastructure ? members.some(isNetworkResource) ? 416 : 340 : 0, ...dimensions.map(item => item.height)) }
    }
    const rawName = String(node.data?.Name || '')
    const displayName = String(options.name || rawName).split('\n')[0]
    const fullName = displayName === `${rawName.slice(0, 24)}.` ? rawName : displayName
    if (!infrastructure && type !== 'libvirt') {
        const identityHeight = cardHeaderHeight(node, width, options.name)
        // API inventory rows are independent of real-time collection. Only
        // Pod/workload usage rows disappear when collection is unavailable.
        const showUsage = options.kubernetesMetricsAvailable ?? kubernetesMetricsAvailable(node)
        const nodeRow = options.nodeResourceRowHeight ?? (type === 'node' ? kubernetesNodeResourceRowHeight(node) : 0)
        const metricRowHeights = type === 'cluster' ? [56, 56, 112]
            : type === 'node' ? (nodeRow ? [nodeRow, 56] : [56])
            : ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(type) ? (showUsage ? [112, 56] : [56])
            : type === 'pod' ? (showUsage ? [112] : [])
            : ['persistentvolume', 'persistentvolumeclaim'].includes(type) ? [128]
            : type === 'service' && read(node.data, ['EndpointCount', 'K8s.EndpointCount', 'K8s.Extra.Spec.Type', 'K8s.Extra.Spec.type']) !== undefined ? [92]
            : (node.children || []).length ? [56] : []
        return { size, width, height: 40 + identityHeight + (metricRowHeights.length
            ? 18 + metricRowHeights.reduce((sum, height) => sum + height, 0) + (metricRowHeights.length - 1) * 10 : 0), metricRowHeights }
    }
    const headerHeight = infrastructure ? infrastructureHeaderHeight(width, fullName) : 0
    if (infrastructure && topologyServiceVMRole(node) === '가상 라우터') {
        const networkHeight = topologyNetworkInfoHeight(width, options.networkSummary, options.networkCount)
        return { size, width, height: 40 + headerHeight + (networkHeight ? networkHeight + 18 : 0) + 18 + 92,
            headerHeight, networkHeight, metricRowHeights: [92] }
    }
    // Switch cards show identity/status and a connection count, not VM metrics.
    // Infrastructure needs at most three name lines and one metric row.
    if (type === 'switch') return { size, width: TOPOLOGY_CARD_SIZES[size].width,
        height: infrastructure ? (40 + headerHeight + ((node.children || []).length ? 74 : 0))
            : (node.children || []).length ? 264 + (String(node.data?.Name || '').length > 24 ? 36 : 0) : 224 }
    // Keep room for actual details; a name/status-only resource needs no empty
    // metric area. Layout and SVG rendering use this same measurement.
    const data = node.data || {}
    const hasMetrics = ['cluster', 'node', 'host', 'libvirt', 'namespace', 'pod', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(type)
        || (type === 'service' ? read(data, ['EndpointCount', 'K8s.EndpointCount', 'K8s.Extra.Spec.Type', 'K8s.Extra.Spec.type']) !== undefined
            : ['persistentvolume', 'persistentvolumeclaim'].includes(type)
                ? read(data, ['K8s.Extra.Status.Capacity.storage', 'K8s.Extra.Status.capacity.storage', 'K8s.Extra.Spec.Capacity.storage', 'K8s.Extra.Spec.capacity.storage', 'K8s.Extra.Spec.StorageClassName', 'K8s.Extra.Spec.storageClassName']) !== undefined
                : (node.children || []).length > 0)
    return { size, ...TOPOLOGY_CARD_SIZES[size], ...(infrastructure && hasMetrics ? { height: Math.max(TOPOLOGY_CARD_SIZES[size].height, 40 + headerHeight + 116) } : {}), ...(type === 'host' ? { height: infrastructure ? 340 + headerHeight : 404 } : {}),
        ...(!infrastructure && type === 'cluster' ? { height: 440 } : {}),
        // Other VM kinds retain their fixed information slots; router cards
        // use the compact content-driven measurement above.
        ...(type === 'libvirt' ? { width: 480, height: infrastructure ? (460 + (options.networkSummary?.trim() ? topologyNetworkInfoHeight(480, options.networkSummary, options.networkCount) + 18 : 0)) : 556 } : {}),
        ...(type === 'pod' ? { height: 352 } : {}),
        ...(['persistentvolume', 'persistentvolumeclaim'].includes(type) ? { height: 416 } : {}),
        ...(!hasMetrics ? { height: infrastructure ? 40 + headerHeight : 224 } : {}),
        ...(vmNIC ? { width: 480 } : {}),
        ...(infrastructure && type !== 'libvirt' && options.networkSummary?.trim()
            ? { height: (hasMetrics ? Math.max(TOPOLOGY_CARD_SIZES[size].height, 40 + headerHeight + 116) : 40 + headerHeight) + topologyNetworkInfoHeight(vmNIC ? 480 : TOPOLOGY_CARD_SIZES[size].width, options.networkSummary, options.networkCount) + 18 } : {}) }
}

/** The same lightweight status model is used by cards and command search. */
export const topologyNodeStatusPresentation = (node: Node, options: {
    group?: boolean; children?: Node[]; links?: Link[]; resourceData?: TopologyResourceSnapshot
} = {}): TopologyNodePresentation['status'] => {
    const type = typeOf(node), data = topologyInfrastructureData(node, options.resourceData)
    const kubernetes = String(data.Manager || '').toLowerCase() === 'k8s'
    const children = options.children || node.children || []
    const status: TopologyNodePresentation['status'] = { tone: 'unknown', label: '알 수 없음', description: '상태 데이터가 없습니다.' }
    let lldpDiscovered = false
    let manuallyMapped = false
    if (kubernetes && !options.group) {
        const current = kubernetesResourceSelfStatus(node)
        status.tone = current.collection !== 'collected' ? 'unknown' : current.state === 'problem' ? 'critical'
            : current.state === 'attention' ? 'warning' : current.state === 'healthy' ? 'normal' : current.state === 'inactive' ? 'inactive' : 'unknown'
        status.description = current.findings.join(' · ') || (status.tone === 'normal' ? '현재 리소스 자체에 이상이 없습니다.' : '현재 리소스 상태')
    } else if (!options.group) {
        const current = infrastructureAttentionStatus({ ...node, data } as Node, options.links)
        status.tone = current.status === 'problem' ? 'critical' : current.status === 'attention' ? 'warning'
            : current.status === 'inactive' ? 'inactive' : current.status === 'unavailable' ? 'unknown'
                : (type === 'host' ? /^(up|running|ok|connected|enabled|healthy|normal)$/i.test(String(read(data, ['State', 'Status', 'OperState', 'Health']) || ''))
                    : read(data, ['State', 'Status', 'OperState', 'Health']) !== undefined) ? 'normal' : 'unknown'
        status.description = current.reason || (status.tone === 'normal' ? '현재 운영 이상이 확인되지 않았습니다.' : '상태 데이터가 없습니다.')
        // Discovery does not establish current reachability or device health.
        // Keep explicit operational and collection states authoritative.
        // Remote switch ports carry LLDP.PortID but do not carry Probe.
        const lldpResource = ['switch', 'switchport'].includes(type)
            && (String(data.Probe || '').trim().toLowerCase() === 'lldp'
                || (type === 'switchport' && read(data, ['LLDP.PortID']) !== undefined))
        const identityOnly = status.tone === 'unknown' && current.status === undefined
            && read(data, ['State', 'Status', 'state', 'status', 'OperState', 'OperationalState', 'LinkState', 'Health']) === undefined
        lldpDiscovered = lldpResource && identityOnly
        manuallyMapped = type === 'switchport' && data.ManualPortMappingPort === true && identityOnly
        if (type === 'host') {
            const state = read(data, ['State', 'Status', 'AgentStatus'])
            const resourceState = read(data, ['ResourceState', 'AllocationState'])
            if (/^(maintenance|disabled)$/i.test(String(resourceState))) status.tone = 'inactive'
            else if (/maintenance|error/i.test(String(resourceState)) && status.tone !== 'critical') status.tone = 'warning'
            status.description = [state && `호스트 상태 ${state}`, resourceState && `자원 상태 ${resourceState}`, current.reason].filter(Boolean).join(' · ') || status.description
        }
    }
    status.label = { normal: kubernetes ? '정상' : '이상 없음', warning: '주의', critical: '장애', unknown: '알 수 없음', inactive: '비활성' }[status.tone]
    if (manuallyMapped) {
        status.label = '수동'
        status.description = '운영자가 등록한 수동 포트입니다. 실제 배선은 자동 검증하지 않으며, 연결 상태와 트래픽은 매핑한 호스트 NIC 기준입니다. 스위치 포트의 실제 Up/Down 상태는 직접 수집하지 않습니다.'
    } else if (lldpDiscovered) {
        status.label = 'LLDP 발견'
        status.description = type === 'switchport'
            ? '연결된 호스트에서 수신한 네트워크 정보를 통해 스위치 포트와 연결 위치를 확인했습니다. LLDP 발견은 포트의 현재 동작 상태(Up/Down)를 의미하지 않습니다.'
            : '연결된 호스트에서 수신한 네트워크 정보를 통해 스위치를 식별했습니다. LLDP 발견은 스위치의 현재 정상 동작 여부를 의미하지 않습니다.'
    }
    if (kubernetes && !options.group && children.length && status.tone === 'normal') status.label = '자체 정상'
    if (kubernetes && !options.group && ['persistentvolume', 'persistentvolumeclaim'].includes(type)) {
        status.label = status.tone === 'unknown' ? '미확인' : kubernetesStorageOperationalPresentation(kubernetesStorageObservation(node.data)).verdict
    }
    return status
}

/** A view model only: graph ownership and the shared status classifiers remain
 * authoritative. Absent measurements never become zero or a fabricated rate. */
export const topologyNodePresentation = (node: Node, options: {
    name: string; group?: boolean; scope?: string; children?: Node[]; links?: Link[]
    resourceData?: TopologyResourceSnapshot; allNodes?: Node[]; infrastructureSummary?: any; networkSummary?: string; networkCount?: number
    resourceMetricsIndex?: TopologyResourceMetricsIndex
    memberNetworkSummary?: (member: Node) => string | undefined
    cardLayout?: TopologyCardLayout; memberCardLayout?: (member: Node) => TopologyCardLayout | undefined
}): TopologyNodePresentation => {
    const type = typeOf(node), data = topologyInfrastructureData(node, options.resourceData)
    const namespaceSummary = isNamespaceSummary(node, !!options.group)
    const group = !!options.group || namespaceSummary || (type === 'namespace' && (node.children || []).length > 0)
    const kubernetes = String(data.Manager || '').toLowerCase() === 'k8s'
    const namespace = String(read(data, ['Namespace', 'namespace', 'K8s.Namespace', 'K8s.Extra.ObjectMeta.Namespace', 'K8s.Extra.metadata.namespace']) || '')
    const kind = (!kubernetes ? topologyLayerKind(node.getWeight?.()) : undefined)
        || kinds[String(data.GroupType || type).toLowerCase()] || String(data.GroupType || data.Type || '리소스')
    const lines = options.name.split('\n').filter(Boolean)
    const rawName = String(data.Name || '')
    // The legacy config shortened plain names before rendering. Let the card
    // apply ellipsis itself while preserving operator-facing VM/network labels.
    const primaryName = rawName.length > 24 && lines[0] === `${rawName.slice(0, 24)}.` ? rawName : lines[0]
    const status = topologyNodeStatusPresentation(node, options)
    const children = options.children || node.children || []
    const networkChildren = !kubernetes && group ? children.filter(isNetworkResource) : []
    const linkStates = networkChildren.length ? networkChildren.reduce((counts, child) => {
        const state = topologyNetworkLinkState(child)
        counts[state === 'Up' ? 'up' : state === 'Down' ? 'down' : 'unknown']++
        return counts
    }, { up: 0, down: 0, unknown: 0 }) : undefined
    const lldpDiscoveryCount = !kubernetes && group && children.length > 0
        && children.every(child => typeOf(child) === 'switchport'
            && topologyNodeStatusPresentation(child, { links: options.links }).label === 'LLDP 발견')
        ? children.length : undefined
    let groupResourceCount: number | undefined
    if (group && !namespaceSummary) {
        const seen = new Set<Node>([node]), resources = new Set<string>()
        const collect = (member: Node) => {
            if (seen.has(member)) return
            seen.add(member)
            if (!member.data?.IsTopologyGroup && (String(member.data?.Manager || '').toLowerCase() !== 'k8s'
                || typeOf(member) !== 'pod' || isCurrentKubernetesPod(member)))
                resources.add(String(member.data?.K8s?.Extra?.ObjectMeta?.UID || member.id))
            ;(member.children || []).forEach(collect)
        }
        ;(node.children || []).forEach(collect)
        groupResourceCount = resources.size
    }
    let distribution: TopologyNodePresentation['children']
    if (group || children.length) {
        if (kubernetes) {
            const summary = kubernetesTopologyDirectChildSummary(node, children)
            distribution = { total: summary.total, normal: summary.healthy.length,
                warning: summary.attentionRequired.length + summary.descendantProblematic.length,
                critical: summary.selfProblematic.length, inactive: summary.inactive.length }
        } else {
            distribution = { total: children.length, normal: 0, warning: 0, critical: 0, inactive: 0 }
            children.forEach(child => {
                const attention = infrastructureAttentionStatus(child, options.links)
                const key = attention.status === 'problem' ? 'critical' : attention.status === 'inactive' ? 'inactive'
                    : attention.status ? 'warning' : 'normal'
                distribution![key]++
            })
        }
    }
    const metrics: TopologyMetric[] = []
    const serviceRole = !group ? topologyServiceVMRole(node, data) : undefined
    const systemVMInformation = serviceRole && serviceRole !== '가상 라우터'
        ? topologySystemVMInformation(node, data, serviceRole, options.resourceData) : undefined
    const count = (key: string, label: string, value: any) => {
        if (value !== undefined && value !== null && value !== '') metrics.push({ key, label, value: String(value) })
    }
    if (type === 'cluster' && !group) {
        const collected: Node[] = [], visited = new Set<string>()
        const walk = (resource: Node) => {
            if (visited.has(resource.id)) return
            visited.add(resource.id)
            ;(resource.children || []).forEach(child => { collected.push(child); walk(child) })
        }
        walk(node)
        for (const [key, label, types] of [
            ['namespaces', '네임스페이스', ['namespace']], ['nodes', '노드', ['node']],
            ['workloads', '워크로드', ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob']],
            ['storage', '스토리지', ['persistentvolume', 'persistentvolumeclaim', 'storageclass']]
        ] as Array<[string, string, string[]]>) {
            count(key, label, new Set(collected.filter(item => types.includes(typeOf(item))).map(item => item.data?.K8s?.Extra?.ObjectMeta?.UID || item.id)).size)
        }
    } else if (['node', 'host', 'libvirt'].includes(type) && !group) {
        metrics.push(...(systemVMInformation ? []
            : serviceRole ? topologyServiceVMInformation(node, data, serviceRole).filter(metric => metric.key === 'service-ip')
            : topologyResourceMetrics(node, options.resourceData, options.allNodes, options.resourceMetricsIndex)))
        if (type === 'node') count('pods', '파드', options.resourceData?.detail?.podCount ?? read(data, ['PodCount', 'K8s.PodCount', 'K8s.Extra.Status.PodCount']) ?? '미수집')
        else if (type === 'host') {
            count('vms', '가상머신', options.infrastructureSummary?.userVMs ?? read(data, ['UserVMCount', 'userVmCount', 'RunningVMCount', 'runningVmCount']))
            // Host cards summarize capacity and user VMs. System VM/router
            // counts remain in details; the connection count is on the badge.
        }
    } else if (type === 'namespace' && !group) {
        count('workloads', '워크로드', children.filter(item => ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(typeOf(item))).length)
        count('children', '자원', children.length)
    } else if (['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(type) && !group) {
        const ready = read(data, ['K8s.Extra.Status.ReadyReplicas', 'K8s.Extra.Status.readyReplicas', 'K8s.Extra.Status.NumberReady', 'K8s.Extra.Status.numberReady'])
        const desired = read(data, ['K8s.Extra.Spec.Replicas', 'K8s.Extra.Spec.replicas', 'K8s.Extra.Status.DesiredNumberScheduled', 'K8s.Extra.Status.desiredNumberScheduled'])
        if (desired !== undefined) count('replicas', 'Replica', `${ready === undefined ? '–' : ready}/${desired}`)
        if (type === 'deployment') {
            const observation = kubernetesControllerPodObservation(node, options.allNodes || children, node.children || [])
            metrics.push({ key: 'pods', label: '파드', value: observation.complete ? observation.label : '-',
                description: observation.complete ? undefined : '파드 소유 관계를 확인하지 못해 개수를 표시할 수 없습니다.' })
        } else count('pods', '파드', children.filter(isCurrentKubernetesPod).length)
    } else if (type === 'service' && !group) {
        count('endpoints', 'Endpoint', read(data, ['EndpointCount', 'K8s.EndpointCount']))
        count('service-type', '유형', read(data, ['K8s.Extra.Spec.Type', 'K8s.Extra.Spec.type']))
    } else if (['persistentvolume', 'persistentvolumeclaim'].includes(type) && !group) {
        metrics.push(...kubernetesStorageCardMetrics(data))
    } else if (!group && type !== 'pod' && children.length) count('children', '연결 자원', distribution?.total)
    if (!group && !['node', 'host', 'libvirt'].includes(type)) metrics.push(...topologyResourceMetrics(node, options.resourceData, options.allNodes, options.resourceMetricsIndex))
    if (kubernetes && !group && ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(type)) {
        const resources = ['cpu', 'memory'].map(key => metrics.find(metric => metric.key === key)
            || { key, label: key === 'cpu' ? 'CPU' : '메모리', value: '미수집', description: '실시간 사용량 미수집' })
        metrics.splice(0, metrics.length, ...resources, ...metrics.filter(metric => !['cpu', 'memory'].includes(metric.key)))
    }
    if (type === 'libvirt' && !group && !serviceRole && !metrics.some(metric => metric.key === 'root-disk')) {
        metrics.push({ key: 'root-disk', label: '루트 디스크', value: '미수집',
            description: '루트 파일시스템 용량 미수집' })
    }
    const showKubernetesMetrics = !kubernetes || (options.resourceMetricsIndex
        ? options.resourceMetricsIndex.metricsAvailable(node, options.resourceData)
        : kubernetesMetricsAvailable(node, options.resourceData))
    if (!showKubernetesMetrics) {
        for (let i = metrics.length - 1; i >= 0; i--) {
            if (['cpu', 'memory'].includes(metrics[i].key) && !['inventory', 'vm-usage'].includes(metrics[i].source || '')) metrics.splice(i, 1)
        }
    }
    if (kubernetes && type === 'node' && !group) {
        for (let i = metrics.length - 1; i >= 0; i--) {
            if (['cpu', 'memory'].includes(metrics[i].key) && metrics[i].value === '미수집') metrics.splice(i, 1)
        }
    }
    const dimensions = topologyCardDimensions(node, !!options.group,
        { ...options, kubernetesMetricsAvailable: showKubernetesMetrics,
            ...(kubernetes && type === 'node' ? { nodeResourceRowHeight: kubernetesNodeResourceRowHeight(node, options.resourceData) } : {}) })
    // Root storage belongs directly below CPU/memory, ahead of object counts.
    const rootDisk = metrics.find(metric => metric.key === 'root-disk')
    if (rootDisk) { metrics.splice(metrics.indexOf(rootDisk), 1); metrics.splice(2, 0, rootDisk) }
    const badges: TopologyStatusBadgeItem[] = kubernetes ? kubernetesTopologyCountBadges(node, children)
        : children.length ? [{ key: 'children', count: children.length, tone: 'running', label: '연결 자원', tooltip: `연결된 자원 ${children.length}개` }] : []
    const badgeSummary: TopologyStatusBadgeGroupSummary = kubernetes ? kubernetesTopologyBadgeGroupSummary(node, badges as any, children)
        : { variant: 'connections', title: '연결 자원', totalLabel: `연결 자원 총 ${children.length}개`, states: badges.map(badge => ({ key: badge.key, tone: badge.tone, label: '연결 자원', count: badge.count })) }
    if (!kubernetes && !group && type === 'host' && children.length) {
        badgeSummary.title = '하위 자원 구성'
        badgeSummary.breakdown = topologyHostChildBreakdown(children)
    }
    if (distribution?.total && lldpDiscoveryCount === undefined) status.description += ` · 직전 하위 자원 ${distribution.total}개: ${kubernetes ? '정상' : '이상 없음'} ${distribution.normal}, 주의 ${distribution.warning}, 장애 ${distribution.critical}, 비활성 ${distribution.inactive}`
    return { ...dimensions, infrastructure: !kubernetes, namespaceSummary, groupResourceCount, resourceType: type, group, name: (!options.group && kubernetes ? String(data.Name || lines[0] || node.id).replace(/\s*\n\s*/g, ' ') : primaryName) || node.id,
        systemVMInformation, serviceVM: !!serviceRole, kind, subtitle: options.scope || (group ? `${kind} · ${distribution?.total || 0}개 자원` : type === 'cluster' ? kind : namespace ? `${kind} · ${namespace}` : lines[1] || kind),
        expanded: !!node.state.expanded, fullyExpanded: group && !namespaceSummary && topologyGroupFullyExpanded(node), expandable: children.length > 0, status,
        linkState: !group ? topologyNetworkLinkState({ ...node, data } as Node) : undefined, linkStates, lldpDiscoveryCount,
        networkSummary: !group && (!kubernetes || type === 'libvirt') ? options.networkSummary : undefined,
        networkCount: !group && type === 'libvirt' ? options.networkCount : undefined,
        operatingSystem: !kubernetes && !group && type === 'libvirt' && vmShowsOperatingSystem(node.data) ? vmOperatingSystem(data) : undefined,
        metrics: metrics.slice(0, dimensions.size === 'large' ? 7 : type === 'libvirt' ? 5 : 4), children: distribution, badges, badgeSummary }
}
