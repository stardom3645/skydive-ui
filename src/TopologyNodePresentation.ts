import type { Node, Link } from './Topology'
import { kubernetesResourceSelfStatus, kubernetesTopologyDirectChildSummary, kubernetesTopologyCountBadges, kubernetesTopologyBadgeGroupSummary } from './KubernetesTopologyBadgeAggregation'
import type { TopologyStatusBadgeItem, TopologyStatusBadgeGroupSummary } from './TopologyStatusBadge'
import { isCurrentKubernetesPod } from './KubernetesPodLifecycle'
import { infrastructureAttentionStatus } from './StatusSummary'
import { formatKubernetesQuantity } from './DataPanels/common/kubernetesQuantity'
import { topologyResourceMetrics } from './TopologyResourceMetrics'
import type { TopologyResourceSnapshot } from './TopologyResourceData'
import { topologyInfrastructureData } from './TopologyResourceData'
import { topologyLayerKind } from './TopologyLayerIcons'

export type TopologyCardSize = 'large' | 'medium' | 'compact'
export type TopologyCardTone = 'normal' | 'warning' | 'critical' | 'unknown' | 'inactive'
export interface TopologyMetric { key: string; label: string; value: string; percent?: number; description?: string }
export interface TopologyNodePresentation {
    name: string; subtitle: string; kind: string; size: TopologyCardSize
    width: number; height: number; group: boolean; expanded: boolean; expandable: boolean
    status: { tone: TopologyCardTone; label: string; description: string }
    metrics: TopologyMetric[]
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
const read = (data: any, paths: string[]) => {
    for (const path of paths) {
        const value = path.split('.').reduce((source, key) => source?.[key], data)
        if (value !== undefined && value !== null && value !== '') return value
    }
}

export const topologyCardDimensions = (node: Node, group = false) => {
    const type = typeOf(node)
    group = group || (type === 'namespace' && (node.children || []).length > 0)
    const size: TopologyCardSize = ['cluster', 'host'].includes(type) && !group ? 'large'
        : group || ['node', 'namespace', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob', 'libvirt', 'switch'].includes(type) ? 'medium' : 'compact'
    if (group) return { size, width: TOPOLOGY_CARD_SIZES.large.width, height: TOPOLOGY_CARD_SIZES.large.height }
    // Keep room for actual details; a name/status-only resource needs no empty
    // metric area. Layout and SVG rendering use this same measurement.
    const data = node.data || {}
    const hasMetrics = ['cluster', 'node', 'host', 'libvirt', 'namespace', 'pod', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(type)
        || (type === 'service' ? read(data, ['EndpointCount', 'K8s.EndpointCount', 'K8s.Extra.Spec.Type', 'K8s.Extra.Spec.type']) !== undefined
            : ['persistentvolume', 'persistentvolumeclaim'].includes(type)
                ? read(data, ['K8s.Extra.Status.Capacity.storage', 'K8s.Extra.Status.capacity.storage', 'K8s.Extra.Spec.Capacity.storage', 'K8s.Extra.Spec.capacity.storage', 'K8s.Extra.Spec.StorageClassName', 'K8s.Extra.Spec.storageClassName']) !== undefined
                : (node.children || []).length > 0)
    return { size, ...TOPOLOGY_CARD_SIZES[size], ...(type === 'host' ? { height: 340 } : {}),
        ...(type === 'pod' ? { height: 328 } : {}), ...(!hasMetrics ? { height: 224 } : {}) }
}

/** A view model only: graph ownership and the shared status classifiers remain
 * authoritative. Absent measurements never become zero or a fabricated rate. */
export const topologyNodePresentation = (node: Node, options: {
    name: string; group?: boolean; scope?: string; children?: Node[]; links?: Link[]
    resourceData?: TopologyResourceSnapshot; allNodes?: Node[]; infrastructureSummary?: any
}): TopologyNodePresentation => {
    const type = typeOf(node), data = topologyInfrastructureData(node, options.resourceData)
    const group = !!options.group || (type === 'namespace' && (node.children || []).length > 0)
    const kubernetes = String(data.Manager || '').toLowerCase() === 'k8s'
    const namespace = String(read(data, ['Namespace', 'namespace', 'K8s.Namespace', 'K8s.Extra.ObjectMeta.Namespace', 'K8s.Extra.metadata.namespace']) || '')
    const kind = (!kubernetes ? topologyLayerKind(node.getWeight?.()) : undefined)
        || kinds[String(data.GroupType || type).toLowerCase()] || String(data.GroupType || data.Type || '리소스')
    const lines = options.name.split('\n').filter(Boolean)
    const rawName = String(data.Name || '')
    // The legacy config shortened plain names before rendering. Let the card
    // apply ellipsis itself while preserving operator-facing VM/network labels.
    const primaryName = rawName.length > 24 && lines[0] === `${rawName.slice(0, 24)}.` ? rawName : lines[0]
    const status: TopologyNodePresentation['status'] = { tone: 'unknown', label: '알 수 없음', description: '상태 데이터가 없습니다.' }
    if (kubernetes && !options.group) {
        const current = kubernetesResourceSelfStatus(node)
        status.tone = current.collection !== 'collected' ? 'unknown' : current.state === 'problem' ? 'critical'
            : current.state === 'healthy' ? 'normal' : current.state === 'inactive' ? 'inactive' : 'unknown'
        status.description = current.findings.join(' · ') || (status.tone === 'normal' ? '현재 리소스 자체에 이상이 없습니다.' : '현재 리소스 상태')
    } else if (!options.group) {
        const current = infrastructureAttentionStatus({ ...node, data } as Node, options.links)
        status.tone = current.status === 'problem' ? 'critical' : current.status === 'attention' ? 'warning'
            : current.status === 'inactive' ? 'inactive' : current.status === 'unavailable' ? 'unknown'
                : (type === 'host' ? /^(up|running|ok|connected|enabled|healthy|normal)$/i.test(String(read(data, ['State', 'Status', 'OperState', 'Health']) || ''))
                    : read(data, ['State', 'Status', 'OperState', 'Health']) !== undefined) ? 'normal' : 'unknown'
        status.description = current.reason || (status.tone === 'normal' ? '현재 운영 이상이 확인되지 않았습니다.' : '상태 데이터가 없습니다.')
        if (type === 'host') {
            const state = read(data, ['State', 'Status', 'AgentStatus'])
            const resourceState = read(data, ['ResourceState', 'AllocationState'])
            if (/^(maintenance|disabled)$/i.test(String(resourceState))) status.tone = 'inactive'
            else if (/maintenance|error/i.test(String(resourceState)) && status.tone !== 'critical') status.tone = 'warning'
            status.description = [state && `호스트 상태 ${state}`, resourceState && `자원 상태 ${resourceState}`, current.reason].filter(Boolean).join(' · ') || status.description
        }
    }
    status.label = { normal: '정상', warning: '주의', critical: '장애', unknown: '알 수 없음', inactive: '비활성' }[status.tone]
    const children = options.children || node.children || []
    if (kubernetes && !options.group && children.length && status.tone === 'normal') status.label = '자체 정상'
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
        metrics.push(...topologyResourceMetrics(node, options.resourceData, options.allNodes))
        if (type === 'node') count('pods', '파드', options.resourceData?.detail?.podCount ?? read(data, ['PodCount', 'K8s.PodCount', 'K8s.Extra.Status.PodCount']))
        else {
            count('vms', '가상머신', options.infrastructureSummary?.userVMs ?? read(data, ['UserVMCount', 'userVmCount', 'RunningVMCount', 'runningVmCount']))
            if (type === 'host') {
                count('system-vms', '시스템 VM', options.infrastructureSummary?.systemVMs ?? read(data, ['SystemVMCount', 'systemVmCount']))
                count('routers', '가상 라우터', options.infrastructureSummary?.routers ?? read(data, ['VirtualRouterCount', 'virtualRouterCount']))
            }
            count('children', '연결 자원', children.length)
        }
    } else if (type === 'namespace' && !group) {
        count('workloads', '워크로드', children.filter(item => ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(typeOf(item))).length)
        count('children', '자원', children.length)
    } else if (['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(type) && !group) {
        const ready = read(data, ['K8s.Extra.Status.ReadyReplicas', 'K8s.Extra.Status.readyReplicas', 'K8s.Extra.Status.NumberReady', 'K8s.Extra.Status.numberReady'])
        const desired = read(data, ['K8s.Extra.Spec.Replicas', 'K8s.Extra.Spec.replicas', 'K8s.Extra.Status.DesiredNumberScheduled', 'K8s.Extra.Status.desiredNumberScheduled'])
        if (desired !== undefined) count('replicas', 'Replica', `${ready === undefined ? '–' : ready}/${desired}`)
        count('pods', '파드', children.filter(isCurrentKubernetesPod).length)
    } else if (type === 'service' && !group) {
        count('endpoints', 'Endpoint', read(data, ['EndpointCount', 'K8s.EndpointCount']))
        count('service-type', '유형', read(data, ['K8s.Extra.Spec.Type', 'K8s.Extra.Spec.type']))
    } else if (['persistentvolume', 'persistentvolumeclaim'].includes(type) && !group) {
        const capacity = read(data, ['K8s.Extra.Status.Capacity.storage', 'K8s.Extra.Status.capacity.storage', 'K8s.Extra.Spec.Capacity.storage', 'K8s.Extra.Spec.capacity.storage'])
        count('capacity', '용량', formatKubernetesQuantity(capacity, '', '확인 불가'))
        count('storage-class', '클래스', read(data, ['K8s.Extra.Spec.StorageClassName', 'K8s.Extra.Spec.storageClassName']))
    } else if (!group && type !== 'pod' && children.length) count('children', '연결 자원', distribution?.total)
    if (!group && !['node', 'host', 'libvirt'].includes(type)) metrics.push(...topologyResourceMetrics(node, options.resourceData, options.allNodes))
    const dimensions = topologyCardDimensions(node, group)
    const badges: TopologyStatusBadgeItem[] = kubernetes ? kubernetesTopologyCountBadges(node, children)
        : children.length ? [{ key: 'children', count: children.length, tone: 'running', label: '연결 자원', tooltip: `연결된 자원 ${children.length}개` }] : []
    const badgeSummary: TopologyStatusBadgeGroupSummary = kubernetes ? kubernetesTopologyBadgeGroupSummary(node, badges as any, children)
        : { title: '연결 자원', totalLabel: `연결 자원 총 ${children.length}개`, states: badges.map(badge => ({ key: badge.key, tone: badge.tone, label: '연결 자원', count: badge.count })) }
    if (distribution?.total) status.description += ` · 바로 아래 자원 ${distribution.total}개: 정상 ${distribution.normal}, 주의 ${distribution.warning}, 장애 ${distribution.critical}, 비활성 ${distribution.inactive}`
    return { ...dimensions, group, name: (!options.group && kubernetes ? String(data.Name || lines[0] || node.id).replace(/\s*\n\s*/g, ' ') : primaryName) || node.id,
        kind, subtitle: options.scope || (group ? `${kind} · ${distribution?.total || 0}개 자원` : type === 'cluster' ? kind : namespace ? `${kind} · ${namespace}` : lines[1] || kind),
        expanded: !!node.state.expanded, expandable: children.length > 0, status,
        metrics: metrics.slice(0, dimensions.size === 'large' ? 6 : 4), children: distribution, badges, badgeSummary }
}
