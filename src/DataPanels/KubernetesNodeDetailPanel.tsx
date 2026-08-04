import * as React from 'react'
import { Button, Select, Table, Tooltip } from 'antd'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'
import { HistoryOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { aggregatePods } from '../KubernetesPodLifecycle'
import { aggregateKubernetesDetail } from '../KubernetesDetailAggregation'
import { resolveKubernetesPodTopController } from '../KubernetesWorkloadOwnership'
import {
    BasicInfoRows,
    CollapsibleSummaryRow,
    CompactEmptyState,
    DetailAdvancedInfo,
    DetailBadge,
    DetailBadgeTone,
    DetailLayerIcon,
    DetailModalResourceCell,
    DetailModalTextCell,
    DetailMetricRow,
    DetailSectionCard,
    DetailStatusIndicator,
    KUBERNETES_DETAIL_LABELS,
    KUBERNETES_UTILIZATION_THRESHOLDS,
    HistoryModal,
    RelatedResourceGrid,
    ResourceMetricBlock,
    StatusEvidenceRow,
    StatusEvidenceList,
    StatusSummaryGrid,
    summarizeKubernetesPods
} from './common'
import './KubernetesNodeDetailPanel.css'

interface Props {
    node: Node
    nodeAttrs: (node: Node) => any
    session: session
    vmDetailMap?: Record<string, any>
    kubernetesClusters?: any[]
}

interface State {
    detail?: any
    loading: boolean
    error: boolean
    requestKey: string
    basicCollapsed: boolean
    basicInfoAdvanced: boolean
    podModalOpen: boolean
    riskModal: RiskModalKey
    workloadModalOpen: boolean
    workloadFilter: string
    conditionsExpanded: boolean
    focusActive: boolean
}

type RiskModalKey = '' | 'single-replica' | 'local-storage' | 'pending' | 'restart' | 'oom-killed'

const valueByPath = (data: any, path: string): any => path.split('.').reduce((value, key) => value === undefined || value === null ? undefined : value[key], data)
const firstRaw = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const value = valueByPath(data, path)
        if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return undefined
}
const firstValue = (data: any, paths: string[]): string => {
    const value = firstRaw(data, paths)
    if (value === undefined || value === null) return ''
    if (Array.isArray(value)) return value.map(String).join(', ')
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
const quantity = (resources: any, key: string): string => {
    const value = resources && resources[key]
    if (value === undefined || value === null || value === '') return '–'
    return typeof value === 'object' && value.string ? value.string : String(value)
}
const formatCapacityMemory = (value: string): string => {
    if (!value || value === '–') return value || '–'
    const match = value.trim().match(/^([0-9.]+)(Ki|Mi|Gi|Ti)$/i)
    if (!match) return value
    const amount = Number(match[1])
    if (!Number.isFinite(amount)) return value
    const unit = match[2].toLowerCase()
    const bytes = amount * (unit === 'ti' ? Math.pow(1024, 4) : unit === 'gi' ? Math.pow(1024, 3) : unit === 'mi' ? Math.pow(1024, 2) : 1024)
    if (bytes >= Math.pow(1024, 3)) return `${(bytes / Math.pow(1024, 3)).toFixed(2).replace(/\.00$/, '')} GiB`
    return `${(bytes / Math.pow(1024, 2)).toFixed(1).replace(/\.0$/, '')} MiB`
}
const formatCapacityCpu = (value: string): string => {
    if (!value || value === '–') return value || '–'
    const match = value.trim().match(/^([0-9.]+)(n|u|m)?$/i)
    if (!match) return value
    const amount = Number(match[1])
    const unit = (match[2] || '').toLowerCase()
    const cores = unit === 'n' ? amount / 1000000000 : unit === 'u' ? amount / 1000000 : unit === 'm' ? amount / 1000 : amount
    if (!Number.isFinite(cores)) return value
    const precision = cores > 0 && cores < 0.1 ? 3 : 2
    const display = cores.toFixed(precision).replace(/\.0+$/, '').replace(/(\.[0-9]*[1-9])0+$/, '$1')
    return `${display} Core`
}
const formatDate = (value: any): string => {
    if (value === undefined || value === null || value === '') return ''
    const source = typeof value === 'object' && value.Time ? value.Time : value
    const numeric = Number(source)
    const milliseconds = !Number.isNaN(numeric) && numeric > 0 && numeric < 100000000000 ? numeric * 1000 : numeric
    const date = !Number.isNaN(milliseconds) ? new Date(milliseconds) : new Date(source)
    return Number.isNaN(date.getTime()) ? String(source) : date.toLocaleString()
}
const cpuCores = (value: string): number | undefined => {
    if (!value || value === '–') return undefined
    const match = value.trim().match(/^([0-9.]+)(n|u|m)?$/i)
    if (!match) return undefined
    const amount = Number(match[1])
    if (!Number.isFinite(amount)) return undefined
    switch ((match[2] || '').toLowerCase()) {
    case 'n': return amount / 1000000000
    case 'u': return amount / 1000000
    case 'm': return amount / 1000
    default: return amount
    }
}
const memoryBytes = (value: string): number | undefined => {
    if (!value || value === '–') return undefined
    const match = value.trim().match(/^([0-9.]+)(Ki|Mi|Gi|Ti|K|M|G|T)?$/i)
    if (!match) return undefined
    const amount = Number(match[1])
    if (!Number.isFinite(amount)) return undefined
    const unit = (match[2] || '').toLowerCase()
    const multiplier = unit === 'ti' ? Math.pow(1024, 4)
        : unit === 'gi' ? Math.pow(1024, 3)
        : unit === 'mi' ? Math.pow(1024, 2)
        : unit === 'ki' ? 1024
        : unit === 't' ? 1e12
        : unit === 'g' ? 1e9
        : unit === 'm' ? 1e6
        : unit === 'k' ? 1e3 : 1
    return amount * multiplier
}
const utilization = (usage: number | undefined, allocatable: number | undefined): number | undefined =>
    usage !== undefined && allocatable !== undefined && allocatable > 0
        ? Math.max(0, usage / allocatable * 100)
        : undefined
// Node detail metric mapping. Keep UI labels and their source fields together so
// the panel cannot silently mix API counts with a different topology criterion.
const NODE_METRIC_MAPPING = {
    currentPods: '현재 노드에 배치되어 있고 종료 처리 중이 아닌 Pod 수입니다.',
    runningPods: '활성 파드 중 phase가 Running인 파드입니다.',
    problemPods: '현재 노드의 활성 Pod 중 비정상 상태로 판정된 Pod 수입니다.',
    restartPods: '현재 활성 파드 중 모든 컨테이너의 restartCount 합계가 1 이상인 고유 파드 수입니다.',
    singleReplica: '복제본이 하나뿐이어서 장애 시 서비스 중단 가능성이 있는 워크로드입니다.',
    singleReplicaRaw: '최종 상위 Deployment/StatefulSet의 spec.replicas == 1, metadata.uid 기준 중복 제거',
    localStorage: '특정 노드의 로컬 스토리지에 의존해 다른 노드로 이동하기 어려운 워크로드입니다.',
    localStorageRaw: 'hostPath, local PV 또는 local-path StorageClass 사용, 최종 상위 컨트롤러 metadata.uid 기준 중복 제거',
    cpuUsage: 'metrics.k8s.io Node.usage.cpu / Node.status.allocatable.cpu',
    memoryUsage: 'metrics.k8s.io Node.usage.memory / Node.status.allocatable.memory'
} as const
const resourceUID = (node: Node): string => firstValue(node.data || {}, [
    'K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID'
]) || node.id
const resourceNamespace = (node: Node): string => firstValue(node.data || {}, [
    'K8s.Extra.ObjectMeta.Namespace', 'K8s.Namespace', 'Namespace'
])
const canonicalWorkloadKind = (value: any): string => {
    const normalized = String(value || '').toLowerCase()
    const kinds: Record<string, string> = {
        deployment: 'Deployment',
        statefulset: 'StatefulSet',
        daemonset: 'DaemonSet',
        job: 'Job',
        cronjob: 'CronJob'
    }
    return kinds[normalized] || String(value || 'Workload')
}
const optionalNumber = (value: any): React.ReactNode => value === undefined || value === null ? '–' : Number(value)
const formatOsImage = (value: string): string => value.replace(/^Debian GNU\/Linux\s+/i, 'Debian ')
type NodeEventTone = 'success' | 'warning' | 'danger'
interface NodeEventGroup {
    reason: string
    tone: NodeEventTone
    description: string
    count: number
    time: any
}
const NODE_EVENT_TONES: Record<string, NodeEventTone> = {
    nodeready: 'success',
    nodenotready: 'warning',
    reboot: 'warning',
    rebooted: 'warning',
    memorypressure: 'warning',
    nodehasmemorypressure: 'warning',
    diskpressure: 'warning',
    nodehasdiskpressure: 'warning',
    pidpressure: 'warning',
    nodehaspidpressure: 'warning',
    kubeletrestart: 'warning',
    kubeletrestarted: 'warning',
    starting: 'warning',
    networkunavailable: 'warning'
}

const nodeConditionDescription = (condition: any): string => {
    const reason = String(condition?.reason || '').toLowerCase().replace(/[\s_-]+/g, '')
    const reasonDescriptions: Record<string, string> = {
        kubeletready: 'Kubelet이 정상적으로 동작 중입니다.',
        kubeletnotready: 'Kubelet이 정상적으로 동작하지 않습니다.',
        calicoisup: 'Calico 네트워크가 정상적으로 동작 중입니다.',
        flannelisup: 'Flannel 네트워크가 정상적으로 동작 중입니다.',
        ciliumisup: 'Cilium 네트워크가 정상적으로 동작 중입니다.',
        nodehassufficientmemory: '사용 가능한 메모리가 충분합니다.',
        kubelethassufficientmemory: '사용 가능한 메모리가 충분합니다.',
        nodehasnomemorypressure: '메모리 압박이 감지되지 않았습니다.',
        nodehasnodiskpressure: '디스크 압박이 감지되지 않았습니다.',
        kubelethasnodiskpressure: '디스크 압박이 감지되지 않았습니다.',
        nodehassufficientpid: '사용 가능한 프로세스 ID가 충분합니다.',
        kubelethassufficientpid: '사용 가능한 프로세스 ID가 충분합니다.',
        routecreated: '노드 네트워크 경로가 정상적으로 구성되었습니다.',
        noderoutecreated: '노드 네트워크 경로가 정상적으로 구성되었습니다.'
    }
    if (reasonDescriptions[reason]) return reasonDescriptions[reason]

    const type = String(condition?.type || '').toLowerCase()
    const active = String(condition?.status || '').toLowerCase() === 'true'
    if (type === 'ready') return active ? '노드가 정상적으로 요청을 처리할 수 있습니다.' : '노드가 정상적으로 요청을 처리할 수 없습니다.'
    if (type === 'networkunavailable') return active ? '노드 네트워크를 사용할 수 없습니다.' : '노드 네트워크를 사용할 수 있습니다.'
    if (type === 'memorypressure') return active ? '메모리 압박이 감지되었습니다.' : '메모리 압박이 감지되지 않았습니다.'
    if (type === 'diskpressure') return active ? '디스크 압박이 감지되었습니다.' : '디스크 압박이 감지되지 않았습니다.'
    if (type === 'pidpressure') return active ? '프로세스 ID 압박이 감지되었습니다.' : '프로세스 ID 압박이 감지되지 않았습니다.'
    return active ? '해당 노드 상태 조건이 활성화되어 있습니다.' : '해당 노드 상태 조건이 감지되지 않았습니다.'
}

class KubernetesNodeDetailPanel extends React.Component<Props, State> {
    state: State = {
        loading: false,
        error: false,
        requestKey: '',
        basicCollapsed: false,
        basicInfoAdvanced: false,
        podModalOpen: false,
        riskModal: '',
        workloadModalOpen: false,
        workloadFilter: 'all',
        conditionsExpanded: false,
        focusActive: false
    }

    componentDidMount() { this.loadDetail() }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id || this.cluster()?.id !== this.clusterFrom(prevProps)?.id) {
            this.setState({ basicCollapsed: false, basicInfoAdvanced: false, podModalOpen: false, riskModal: '', workloadModalOpen: false, workloadFilter: 'all', conditionsExpanded: false, focusActive: false })
            this.loadDetail()
        }
    }

    private clusterFrom(props: Props): any | undefined {
        let parent = props.node.parent
        let clusterNode: Node | undefined
        while (parent) {
            if (String(parent.data?.Manager || '').toLowerCase() === 'k8s' && String(parent.data?.Type || '').toLowerCase() === 'cluster') { clusterNode = parent; break }
            parent = parent.parent
        }
        const data = props.node.data || {}
        const keys = [
            clusterNode?.id,
            clusterNode && firstValue(clusterNode.data, ['Name', 'ClusterName', 'clusterName']),
            firstValue(data, ['ClusterID', 'ClusterId', 'clusterId', 'K8s.ClusterID']),
            firstValue(data, ['Cluster', 'ClusterName', 'clusterName', 'K8s.ClusterName'])
        ].map(value => String(value || '').toLowerCase()).filter(Boolean)
        return (props.kubernetesClusters || []).find(cluster => [cluster?.id, cluster?.name].map(value => String(value || '').toLowerCase()).some(value => keys.indexOf(value) >= 0))
    }

    private cluster() { return this.clusterFrom(this.props) }

    private uid(): string {
        return firstValue(this.props.node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID', 'uid']) || this.props.node.id
    }

    private loadDetail() {
        const cluster = this.cluster()
        const uid = this.uid()
        const requestKey = `${cluster?.id || ''}:${uid}`
        if (!cluster?.id || !uid || this.state.requestKey === requestKey) return
        const endpoint = this.props.session?.endpoint || `${window.location.protocol}//${window.location.host}`
        this.setState({ detail: this.detailFromTopology(), loading: true, error: false, requestKey })
        fetch(`${endpoint}/api/mold/kubernetes-clusters/nodes/detail?id=${encodeURIComponent(cluster.id)}&uid=${encodeURIComponent(uid)}`, {
            cache: 'no-store',
            headers: this.props.session?.token ? { 'X-Auth-Token': this.props.session.token } : undefined
        }).then(response => {
            if (!response.ok) throw new Error(`node detail unavailable: ${response.status}`)
            return response.json()
        }).then(detail => {
            if (this.state.requestKey === requestKey) {
                const topologyDetail = this.detailFromTopology()
                this.setState({
                    detail: {
                        ...topologyDetail,
                        ...detail,
                        capacity: detail.capacity || topologyDetail.capacity,
                        allocatable: detail.allocatable || topologyDetail.allocatable,
                        usage: detail.usage || topologyDetail.usage
                    },
                    loading: false,
                    error: false
                })
            }
        }).catch(() => {
            if (this.state.requestKey === requestKey) this.setState({ detail: this.detailFromTopology(), loading: false, error: true })
        })
    }

    private topologyNodes(): Node[] {
        const topologyNodes = (window as any).App?.tc?.nodes
        if (topologyNodes instanceof Map) return Array.from(topologyNodes.values())
        if (Array.isArray(topologyNodes)) return topologyNodes
        return []
    }

    private detailFromTopology(): any {
        const data = this.props.node.data || {}
        const extra = firstRaw(data, ['K8s.Extra']) || {}
        const status = extra.Status || {}
        const spec = extra.Spec || {}
        const objectMeta = extra.ObjectMeta || {}
        const name = firstValue(data, ['Name', 'K8s.Name']) || objectMeta.Name || this.props.node.id
        const addresses = Array.isArray(status.Addresses) ? status.Addresses : []
        const internalAddress = addresses.find(address => String(address?.Type || '').toLowerCase() === 'internalip')
        const conditions = Array.isArray(status.Conditions) ? status.Conditions.map(condition => ({
            type: condition.Type,
            status: condition.Status,
            reason: condition.Reason,
            message: condition.Message,
            lastHeartbeatTime: condition.LastHeartbeatTime?.Time,
            lastTransitionTime: condition.LastTransitionTime?.Time
        })) : []
        const labels = data.K8s?.Labels || objectMeta.Labels || {}
        const roles = Object.keys(labels).filter(key => key.indexOf('node-role.kubernetes.io/') === 0).map(key => key.replace('node-role.kubernetes.io/', '')).filter(Boolean)
        if (!roles.length) roles.push('worker')
        const clusterName = firstValue(data, ['ClusterName', 'K8s.ClusterName'])
        const scopedPods = this.topologyNodes().filter(node => {
            if (String(node.data?.Manager || '').toLowerCase() !== 'k8s' || String(node.data?.Type || '').toLowerCase() !== 'pod') return false
            if (clusterName && firstValue(node.data || {}, ['ClusterName', 'K8s.ClusterName']) !== clusterName) return false
            return firstValue(node.data || {}, ['K8s.Extra.Spec.NodeName', 'K8s.Node', 'NodeName']) === name
        })
        const podAggregate = aggregatePods(scopedPods, { nodeName: name })
        const nodeInfo = status.NodeInfo || {}
        const createdAt = objectMeta.CreationTimestamp?.Time
        return {
            uid: objectMeta.UID || this.props.node.id,
            name,
            roles,
            internalIp: internalAddress?.Address,
            podCidrs: spec.PodCIDRs || (spec.PodCIDR ? [spec.PodCIDR] : []),
            kubernetesVersion: nodeInfo.KubeletVersion,
            osImage: nodeInfo.OSImage,
            kernelVersion: nodeInfo.KernelVersion,
            architecture: nodeInfo.Architecture,
            containerRuntime: nodeInfo.ContainerRuntimeVersion,
            createdAt,
            conditions,
            unschedulable: !!spec.Unschedulable,
            taints: Array.isArray(spec.Taints) ? spec.Taints.map(taint => ({ key: taint.Key, value: taint.Value, effect: taint.Effect })) : [],
            labels,
            capacity: status.Capacity,
            allocatable: status.Allocatable,
            podCount: podAggregate.current,
            runningPodCount: podAggregate.running,
            pendingPodCount: podAggregate.pending,
            failedPodCount: 0,
            restartPodCount: podAggregate.restartHistory,
            oomKilledPodCount: podAggregate.currentOOMKilled,
            impactedPodCount: podAggregate.currentProblems,
            problemPods: podAggregate.currentProblemEntries.map(entry => ({ uid: entry.node.id, kind: 'Pod', name: entry.podName, namespace: entry.namespace })),
            relationshipConfidence: 'UNKNOWN',
            source: 'TOPOLOGY'
        }
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        if (attrs.href) return <img className="netdive-k8s-node-detail__topology-icon-image" src={attrs.href} alt="" />
        return <span className={`netdive-k8s-node-detail__topology-icon ${attrs.iconClass || ''}`} aria-hidden="true">{attrs.icon}</span>
    }

    private ready(): boolean | undefined {
        const conditions = this.state.detail?.conditions
        if (Array.isArray(conditions)) {
            const ready = conditions.find(condition => String(condition.type).toLowerCase() === 'ready')
            if (ready) return String(ready.status).toLowerCase() === 'true'
        }
        const raw = firstValue(this.props.node.data || {}, ['Ready', 'Status', 'State']).toLowerCase()
        if (/^(true|ready|running|active|up)$/.test(raw)) return true
        if (/^(false|notready|down|failed|error)$/.test(raw)) return false
        return undefined
    }

    private conditionTone(condition: any): DetailBadgeTone {
        const type = String(condition?.type || '').toLowerCase()
        const status = String(condition?.status || '').toLowerCase()
        if (type === 'ready') return status === 'true' ? 'success' : 'danger'
        return status === 'true' ? 'warning' : 'success'
    }

    private duration(seconds: any): string {
        const value = Number(seconds)
        if (!Number.isFinite(value) || value < 0) return '–'
        const days = Math.floor(value / 86400)
        const hours = Math.floor(value % 86400 / 3600)
        const minutes = Math.floor(value % 3600 / 60)
        if (days) return `${days}d ${hours}h`
        if (hours) return `${hours}h ${minutes}m`
        return `${minutes}m`
    }

    private eventCandidates(detail: any): any[] {
        const sources = [
            detail.events,
            detail.recentEvents,
            detail.nodeEvents,
            detail.kubernetesEvents,
            firstRaw(this.props.node.data || {}, ['K8s.Extra.Events', 'K8s.Events', 'Events'])
        ]
        for (const source of sources) {
            const events = Array.isArray(source) ? source : Array.isArray(source?.items) ? source.items : Array.isArray(source?.Items) ? source.Items : []
            if (events.length) return events
        }
        return []
    }

    private eventTime(event: any): any {
        const value = firstRaw(event, [
            'lastTimestamp', 'LastTimestamp', 'eventTime', 'EventTime',
            'lastObservedTime', 'LastObservedTime', 'metadata.creationTimestamp',
            'ObjectMeta.CreationTimestamp'
        ])
        return value && typeof value === 'object' && value.Time ? value.Time : value
    }

    private importantEventGroups(detail: any): NodeEventGroup[] {
        const groups = new Map<string, NodeEventGroup>()
        this.eventCandidates(detail).forEach(event => {
            const reason = firstValue(event, ['reason', 'Reason'])
            const normalizedReason = reason.toLowerCase().replace(/[\s_-]+/g, '')
            const tone = NODE_EVENT_TONES[normalizedReason]
            if (!tone) return
            const description = firstValue(event, ['message', 'Message', 'note', 'Note']) || translate('kubernetesNoReason')
            const countValue = firstRaw(event, ['count', 'Count', 'series.count', 'Series.Count'])
            const count = Math.max(1, Number(countValue || 1))
            const time = this.eventTime(event)
            const existing = groups.get(normalizedReason)
            if (!existing) {
                groups.set(normalizedReason, { reason, tone, description, count, time })
                return
            }
            existing.count += count
            const existingTime = new Date(existing.time || 0).getTime()
            const nextTime = new Date(time || 0).getTime()
            if (!Number.isNaN(nextTime) && (Number.isNaN(existingTime) || nextTime > existingTime)) {
                existing.time = time
                existing.description = description
            }
        })
        const priority: Record<NodeEventTone, number> = { danger: 0, warning: 1, success: 2 }
        return Array.from(groups.values()).sort((left, right) => {
            const severity = priority[left.tone] - priority[right.tone]
            return severity || new Date(right.time || 0).getTime() - new Date(left.time || 0).getTime()
        })
    }

    private relativeEventTime(value: any): string {
        const time = new Date(value || 0).getTime()
        if (Number.isNaN(time) || time <= 0) return translate('kubernetesNotCollected')
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
        if (elapsedSeconds < 60) return translate('kubernetesEventJustNow')
        const minutes = Math.floor(elapsedSeconds / 60)
        if (minutes < 60) return translate('kubernetesEventMinutesAgo').replace('{count}', String(minutes))
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return translate('kubernetesEventHoursAgo').replace('{count}', String(hours))
        return translate('kubernetesEventDaysAgo').replace('{count}', String(Math.floor(hours / 24)))
    }

    private renderImportantEvents() {
        const groups = this.importantEventGroups(this.state.detail || {})
        if (!groups.length) return <CompactEmptyState description={translate('kubernetesNodeNoImportantEvents')} compact />
        return <div className="netdive-k8s-node-detail__events">{groups.map(group => <div key={group.reason} className={`is-${group.tone}`}>
            <span className="netdive-k8s-node-detail__event-dot" />
            <div className="netdive-k8s-node-detail__event-main">
                <Tooltip title={<div>원본 상태: {group.reason}<br />발생 시각: {String(group.time || translate('kubernetesNotCollected'))}<br />{group.description}</div>} placement="top">
                    <div><strong>{group.reason}</strong>{group.tone === 'success' ? <span className="netdive-k8s-node-detail__normal"><i />{translate('kubernetesHealthNormal')}</span> : <DetailBadge tone={group.tone}>{group.tone === 'danger' ? translate('kubernetesHealthCritical') : translate('kubernetesHealthWarning')}</DetailBadge>}</div>
                </Tooltip>
                <span>{group.description}</span>
                <small>{translate('kubernetesEventOccurrenceCount').replace('{count}', String(group.count))}</small>
            </div>
            <time title={String(group.time || '')}>{this.relativeEventTime(group.time)}</time>
        </div>)}</div>
    }

    private renderConditions() {
        const conditions = this.state.detail?.conditions
        if (!Array.isArray(conditions) || !conditions.length) return <CompactEmptyState description={translate('kubernetesNodeConditionsUnavailable')} compact />
        const supported = ['ready', 'networkunavailable', 'memorypressure', 'diskpressure', 'pidpressure']
        const orderedConditions = conditions
            .filter(condition => supported.indexOf(String(condition?.type || '').toLowerCase()) >= 0)
            .slice()
            .sort((left, right) => {
                const leftTone = this.conditionTone(left)
                const rightTone = this.conditionTone(right)
                const toneOrder = { danger: 0, warning: 1, default: 2, info: 2, success: 3 }
                const severity = toneOrder[leftTone] - toneOrder[rightTone]
                if (severity !== 0) return severity
                return supported.indexOf(String(left?.type || '').toLowerCase()) - supported.indexOf(String(right?.type || '').toLowerCase())
            })
        if (!orderedConditions.length) return <CompactEmptyState description={translate('kubernetesNodeConditionsUnavailable')} compact />
        const abnormalConditions = orderedConditions.filter(condition => this.conditionTone(condition) !== 'success')
        if (!abnormalConditions.length && !this.state.conditionsExpanded) {
            return <CollapsibleSummaryRow
                title={<span className="netdive-k8s-node-detail__normal"><i />전체 정상</span>}
                summary={`${orderedConditions.length}개 조건`}
                expanded={false}
                onToggle={() => this.setState({ conditionsExpanded: true })}
                density="compact"
            />
        }
        const visibleConditions = abnormalConditions.length ? orderedConditions : orderedConditions
        return <React.Fragment>
            <div className="netdive-k8s-node-detail__condition-rows">{visibleConditions.map(condition => {
            const tone = this.conditionTone(condition)
            const state = <DetailStatusIndicator tone={tone}>
                {tone === 'success' ? translate('kubernetesHealthNormal') : tone === 'danger' ? translate('kubernetesHealthCritical') : translate('kubernetesHealthWarning')}
            </DetailStatusIndicator>
            const conditionDescription = nodeConditionDescription(condition)
            const rawCondition = `${condition.type}=${String(condition.status)}${condition.reason ? `, Reason=${condition.reason}` : ''}`
            return <StatusEvidenceRow
                key={condition.type}
                title={condition.type}
                evidence={conditionDescription}
                state={state}
                value={this.duration(condition.durationSeconds)}
                tone={tone}
                tooltip="Kubernetes가 보고한 노드 상태 조건을 운영 의미로 해석한 결과입니다."
                tooltipDetail={condition.message || `${conditionDescription} lastTransitionTime 이후 경과 시간을 표시합니다.`}
                tooltipRawValue={rawCondition}
            />
            })}</div>
            {!abnormalConditions.length && <div className="netdive-k8s-node-detail__condition-collapse">
                <Button type="link" size="small" onClick={() => this.setState({ conditionsExpanded: false })}>정상 조건 접기</Button>
            </div>}
        </React.Fragment>
    }

    private renderCapacity(currentPodCount: number) {
        const detail = this.state.detail
        if (!detail?.capacity && !detail?.allocatable) return <CompactEmptyState description={translate('kubernetesNodeCapacityUnavailable')} compact />
        const cpuCapacity = quantity(detail.capacity, 'cpu')
        const cpuAllocatable = quantity(detail.allocatable, 'cpu')
        const memoryCapacity = quantity(detail.capacity, 'memory')
        const memoryAllocatable = quantity(detail.allocatable, 'memory')
        const usage = detail.usage || detail.currentUsage || detail.metrics?.usage || {}
        const cpuUsage = quantity(usage, 'cpu')
        const memoryUsage = quantity(usage, 'memory')
        const podCapacity = quantity(detail.capacity, 'pods')
        const podAllocatable = quantity(detail.allocatable, 'pods')
        const metrics = [
            {
                key: 'cpu',
                label: 'CPU',
                usage: cpuUsage === '–' ? undefined : formatCapacityCpu(cpuUsage),
                allocatable: cpuAllocatable === '–' ? undefined : formatCapacityCpu(cpuAllocatable),
                capacity: cpuCapacity === '–' ? undefined : formatCapacityCpu(cpuCapacity),
                percent: utilization(cpuCores(cpuUsage), cpuCores(cpuAllocatable))
            },
            {
                key: 'memory',
                label: translate('kubernetesMemory'),
                usage: memoryUsage === '–' ? undefined : formatCapacityMemory(memoryUsage),
                allocatable: memoryAllocatable === '–' ? undefined : formatCapacityMemory(memoryAllocatable),
                capacity: memoryCapacity === '–' ? undefined : formatCapacityMemory(memoryCapacity),
                percent: utilization(memoryBytes(memoryUsage), memoryBytes(memoryAllocatable))
            },
            {
                key: 'pods',
                label: 'Pod 사용량',
                usage: String(currentPodCount),
                allocatable: podAllocatable === '–' ? undefined : podAllocatable,
                capacity: podCapacity === '–' ? undefined : podCapacity,
                percent: utilization(currentPodCount, Number(podAllocatable))
            }
        ]
        return <div className="netdive-k8s-node-detail__resource-overview">
            {metrics.map(metric => {
                const percentLabel = metric.percent === undefined ? '–' : `${metric.percent.toFixed(1)}%`
                const tone: DetailBadgeTone = metric.percent === undefined
                    ? 'default'
                    : metric.percent >= KUBERNETES_UTILIZATION_THRESHOLDS.danger
                    ? 'danger'
                    : metric.percent >= KUBERNETES_UTILIZATION_THRESHOLDS.warning
                    ? 'warning'
                    : 'success'
                const strokeColor = tone === 'danger' ? '#d92d20' : tone === 'warning' ? '#f79009' : '#1677ff'
                return <ResourceMetricBlock
                    key={metric.key}
                    title={metric.label}
                    tooltip={<div>
                        <div>Capacity: {metric.capacity || '없음'}</div>
                        <div>Allocatable: {metric.allocatable || '없음'}</div>
                        {metric.key === 'memory' && <div>사용률 기준: 주의 {KUBERNETES_UTILIZATION_THRESHOLDS.warning}% 이상 · 위험 {KUBERNETES_UTILIZATION_THRESHOLDS.danger}% 이상</div>}
                    </div>}
                    className={`netdive-k8s-node-detail__resource-block is-${tone}`}>
                    <DetailMetricRow
                        primary
                        label={metric.key === 'pods' ? '활성 파드' : '현재 사용량'}
                        value={`${metric.usage || '없음'} / ${metric.allocatable || '없음'}`}
                        ratio={percentLabel}
                        progressPercent={metric.percent === undefined ? 0 : Math.min(100, metric.percent)}
                        progressColor={strokeColor}
                    />
                </ResourceMetricBlock>
            })}
        </div>
    }

    private focusNodes(nodes: Node[]) {
        const ids = nodes.map(node => node.id)
        const app = (window as any).App
        if (ids.length && app && typeof app.focusInfrastructureNodeIDs === 'function') {
            app.focusInfrastructureNodeIDs(ids, this.props.node.id, true)
            this.setState({ focusActive: true })
        }
    }

    private clearFocusedResources() {
        const app = (window as any).App
        if (app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs([])
        this.setState({ focusActive: false })
    }

    private openWorkloadWithRelation(controller: Node, pods: Node[]) {
        const relatedPods = pods.filter(pod => resolveKubernetesPodTopController(pod, this.topologyNodes())?.id === controller.id)
        this.focusNodes([this.props.node, controller, ...relatedPods])
        const app = (window as any).App
        if (app && typeof app.openResourceDetailNodeID === 'function') app.openResourceDetailNodeID(controller.id)
    }

    private openPodWithRelation(pod: Node) {
        const controller = resolveKubernetesPodTopController(pod, this.topologyNodes())
        this.focusNodes([this.props.node, ...(controller ? [controller] : []), pod])
        const app = (window as any).App
        if (app && typeof app.openResourceDetailNodeID === 'function') app.openResourceDetailNodeID(pod.id)
    }

    private connectedKubernetesResources(): { pods: Node[], workloads: Node[], workloadPodCounts: Map<string, number>, pendingPods: Node[], restartHistoryPods: Node[], currentOOMKilledPods: Node[] } {
        const allNodes = this.topologyNodes()
        const nodeName = firstValue(this.props.node.data || {}, ['Name', 'K8s.Name'])
        const clusterName = firstValue(this.props.node.data || {}, ['ClusterName', 'K8s.ClusterName'])
        const aggregate = aggregateKubernetesDetail(allNodes, {
            nodeName,
            predicate: node => !clusterName || firstValue(node.data || {}, ['ClusterName', 'K8s.ClusterName']) === clusterName
        })
        return {
            pods: aggregate.activePodNodes,
            workloads: aggregate.workloadControllers,
            workloadPodCounts: aggregate.workloadPodCounts,
            pendingPods: aggregate.pods.pendingEntries.map(entry => entry.node),
            restartHistoryPods: aggregate.pods.restartHistoryEntries.map(entry => entry.node),
            currentOOMKilledPods: aggregate.pods.currentOOMKilledEntries.map(entry => entry.node)
        }
    }

    private singleReplicaTargets(workloads: Array<{ kind: string, node?: Node }>): Node[] {
        return workloads
            .filter(workload => ['Deployment', 'StatefulSet'].indexOf(workload.kind) >= 0 && workload.node)
            .filter(workload => Number(firstRaw(workload.node!.data || {}, [
                'K8s.Extra.Spec.Replicas', 'K8s.Spec.Replicas', 'DesiredReplicas', 'Replicas'
            ])) === 1)
            .map(workload => workload.node!)
    }

    private localStorageDependencyTargets(pods: Node[], workloads: Array<{ node?: Node }>, allNodes: Node[]): Node[] {
        const targetIDs = new Set<string>()
        const pvcNodes = allNodes.filter(node => String(node.data?.Type || '').toLowerCase() === 'persistentvolumeclaim')
        const pvNodes = allNodes.filter(node => String(node.data?.Type || '').toLowerCase() === 'persistentvolume')
        const storageClassNodes = allNodes.filter(node => String(node.data?.Type || '').toLowerCase() === 'storageclass')
        const workloadByID = new Map(workloads.filter(workload => workload.node).map(workload => [workload.node!.id, workload.node!]))

        pods.forEach(pod => {
            const volumes = firstRaw(pod.data || {}, ['K8s.Extra.Spec.Volumes', 'K8s.Spec.Volumes'])
            if (!Array.isArray(volumes)) return
            const namespace = resourceNamespace(pod)
            let local = false
            const related: Node[] = []
            volumes.forEach(volume => {
                if (volume?.HostPath || volume?.hostPath) local = true
                const claimName = firstValue(volume || {}, [
                    'PersistentVolumeClaim.ClaimName', 'persistentVolumeClaim.claimName', 'PVC.ClaimName'
                ])
                if (!claimName) return
                const pvc = pvcNodes.find(node => resourceNamespace(node) === namespace
                    && firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) === claimName)
                if (!pvc) return
                related.push(pvc)
                const volumeName = firstValue(pvc.data || {}, ['K8s.Extra.Spec.VolumeName', 'K8s.Spec.VolumeName', 'VolumeName'])
                const pv = pvNodes.find(node => firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) === volumeName)
                if (pv) {
                    related.push(pv)
                    if (firstRaw(pv.data || {}, ['K8s.Extra.Spec.Local', 'K8s.Extra.Spec.HostPath', 'K8s.Spec.Local', 'K8s.Spec.HostPath'])) local = true
                }
                const storageClassName = firstValue(pvc.data || {}, [
                    'K8s.Extra.Spec.StorageClassName', 'K8s.Spec.StorageClassName', 'StorageClassName'
                ]) || (pv ? firstValue(pv.data || {}, ['K8s.Extra.Spec.StorageClassName', 'K8s.Spec.StorageClassName', 'StorageClassName']) : '')
                const storageClass = storageClassNodes.find(node => firstValue(node.data || {}, ['Name', 'K8s.Name']) === storageClassName)
                if (storageClass) {
                    related.push(storageClass)
                    const provisioner = firstValue(storageClass.data || {}, ['K8s.Extra.Provisioner', 'K8s.Extra.Spec.Provisioner', 'Provisioner'])
                    if (/local(?:-path)?/i.test(provisioner) || /local-path/i.test(storageClassName)) local = true
                }
            })
            if (!local) return
            targetIDs.add(pod.id)
            related.forEach(node => targetIDs.add(node.id))
            const controller = resolveKubernetesPodTopController(pod, allNodes)
            if (controller && workloadByID.has(controller.id)) targetIDs.add(controller.id)
        })
        return allNodes.filter(node => targetIDs.has(node.id))
    }

    render() {
        const detail = this.state.detail || {}
        const data = this.props.node.data || {}
        const name = detail.name || firstValue(data, ['Name', 'K8s.Name']) || this.props.node.id
        const ready = this.ready()
        const statusLabel = ready === true ? translate('kubernetesNodeReady') : ready === false ? translate('kubernetesNodeNotReady') : translate('kubernetesHealthUnknown')
        const connected = this.connectedKubernetesResources()
        const podStatus = summarizeKubernetesPods(connected.pods)
        const currentPodCount = detail.podCount !== undefined ? Number(detail.podCount) : connected.pods.length
        const problemCount = Array.isArray(detail.problemPods) ? detail.problemPods.length : podStatus.activeProblems.length
        const pendingPodCount = detail.pendingPodCount !== undefined ? Number(detail.pendingPodCount) : podStatus.pending
        const roles = Array.isArray(detail.roles) ? detail.roles : detail.roles ? String(detail.roles).split(',').map(role => role.trim()).filter(Boolean) : []
        const missingValue = this.state.error ? '조회 실패' : '없음'
        const roleValue = roles.length ? <span className="netdive-k8s-node-detail__roles">{roles.map(role => <DetailBadge key={role} tone="default">{role}</DetailBadge>)}</span> : missingValue
        const osImage = String(detail.osImage || '')
        const overviewRows: any[] = [
            { label: translate('kubernetesNodeName'), value: name, textValue: name, copyText: name },
            { label: translate('kubernetesNodeRoles'), value: roleValue },
            { label: '내부 IP', value: detail.internalIp || missingValue, copyText: detail.internalIp },
            { label: translate('kubernetesVersion'), value: detail.kubernetesVersion || missingValue },
            { label: '생성 시각', value: formatDate(detail.createdAt) || missingValue }
        ]
        const advancedRows: any[] = [
            { label: 'Pod CIDR', value: Array.isArray(detail.podCidrs) && detail.podCidrs.length ? detail.podCidrs.join(', ') : missingValue },
            { label: 'OS', value: osImage ? formatOsImage(osImage) : missingValue, tooltip: osImage || undefined },
            { label: translate('kubernetesContainerRuntime'), value: detail.containerRuntime || missingValue },
            { label: 'Kernel', value: detail.kernelVersion || missingValue },
            { label: 'Architecture', value: detail.architecture || missingValue }
        ]
        const taintValue = Array.isArray(detail.taints) && detail.taints.length
            ? detail.taints.map(taint => `${taint.key}${taint.value ? `=${taint.value}` : ''}:${taint.effect}`).join(', ')
            : '없음'
        const problemCriteria = '판정 기준: Ready=false, CrashLoopBackOff, ImagePullBackOff, ErrImagePull, CreateContainerConfigError, CreateContainerError, RunContainerError, OOMKilled'
        const allNodes = this.topologyNodes()
        const workloadNodeByUID = new Map<string, Node>(allNodes.map(node => [resourceUID(node), node]))
        const apiWorkloads = Array.isArray(detail.assignedWorkloads) ? detail.assignedWorkloads : []
        const workloadInventory = new Map<string, { uid: string, kind: string, name: string, namespace: string, node?: Node }>()
        if (apiWorkloads.length) {
            apiWorkloads.forEach((workload: any) => {
                const uid = String(workload.uid || `${workload.namespace}/${workload.kind}/${workload.name}`)
                workloadInventory.set(uid, {
                    uid,
                    kind: canonicalWorkloadKind(workload.kind),
                    name: String(workload.name || uid),
                    namespace: String(workload.namespace || ''),
                    node: workloadNodeByUID.get(String(workload.uid || ''))
                })
            })
        } else {
            connected.workloads.forEach(node => {
                const uid = resourceUID(node)
                workloadInventory.set(uid, {
                    uid,
                    kind: canonicalWorkloadKind(firstValue(node.data || {}, ['K8s.Kind', 'Kind', 'Type'])),
                    name: firstValue(node.data || {}, ['Name', 'K8s.Name']) || node.id,
                    namespace: resourceNamespace(node),
                    node
                })
            })
        }
        const workloadKindOrder = ['Deployment', 'StatefulSet', 'DaemonSet', 'CronJob', 'Job']
        const workloads = Array.from(workloadInventory.values())
        const problemControllerIDs = new Set(podStatus.activeProblems
            .map(pod => resolveKubernetesPodTopController(pod, allNodes)?.id)
            .filter(Boolean) as string[])
        const singleReplicaTargets = this.singleReplicaTargets(workloads)
        const localStorageTargets = this.localStorageDependencyTargets(connected.pods, workloads, allNodes)
        const singleReplicaTargetIDs = new Set(singleReplicaTargets.map(node => node.id))
        const localStorageTargetIDs = new Set(localStorageTargets.map(node => node.id))
        const singleReplicaRiskWorkloads = workloads.filter(workload => workload.node && singleReplicaTargetIDs.has(workload.node.id))
        const localStorageRiskWorkloads = workloads.filter(workload => workload.node && localStorageTargetIDs.has(workload.node.id))
        const localStorageRiskPods = connected.pods.filter(pod => localStorageTargetIDs.has(pod.id))
        const localStorageRiskKind: 'workload' | 'pod' = localStorageRiskWorkloads.length ? 'workload' : 'pod'
        const localStorageRiskData = localStorageRiskWorkloads.length ? localStorageRiskWorkloads : localStorageRiskPods
        const riskControllerIDs = new Set<string>([
            ...singleReplicaRiskWorkloads.map(workload => workload.node!.id),
            ...localStorageRiskWorkloads.map(workload => workload.node!.id)
        ])
        const riskPods = [
            ...(pendingPodCount > 0 ? connected.pendingPods : []),
            ...(Number(detail.restartPodCount || 0) > 0 ? connected.restartHistoryPods : []),
            ...(Number(detail.oomKilledPodCount || 0) > 0 ? connected.currentOOMKilledPods : [])
        ]
        riskPods.forEach(pod => {
            const controller = resolveKubernetesPodTopController(pod, allNodes)
            if (controller) riskControllerIDs.add(controller.id)
        })
        workloads.sort((left, right) => {
            const leftProblem = left.node && problemControllerIDs.has(left.node.id) ? 0 : 1
            const rightProblem = right.node && problemControllerIDs.has(right.node.id) ? 0 : 1
            if (leftProblem !== rightProblem) return leftProblem - rightProblem
            const leftRisk = left.node && riskControllerIDs.has(left.node.id) ? 0 : 1
            const rightRisk = right.node && riskControllerIDs.has(right.node.id) ? 0 : 1
            if (leftRisk !== rightRisk) return leftRisk - rightRisk
            return left.name.localeCompare(right.name)
        })
        const workloadFilterKinds = ['Deployment', 'StatefulSet', 'DaemonSet']
        const workloadCounts = workloadFilterKinds
            .map(kind => ({ kind, count: workloads.filter(workload => workload.kind === kind).length }))
        const filteredWorkloads = this.state.workloadFilter === 'all'
            ? workloads
            : workloads.filter(workload => workload.kind === this.state.workloadFilter)
        const workloadPodCounts = connected.workloadPodCounts
        const currentImpact = ready === false || Number(problemCount || 0) > 0 ? '현재 영향 확인 필요' : '현재 영향 없음'
        const netdiveTone: DetailBadgeTone = ready === false
            ? 'danger'
            : Number(problemCount || 0) > 0 || detail.unschedulable
            ? 'warning'
            : ready === true
            ? 'success'
            : 'default'
        const netdiveVerdict = ready === false
            ? translate('kubernetesHealthCritical')
            : Number(problemCount || 0) > 0 || detail.unschedulable
            ? translate('kubernetesHealthWarning')
            : ready === true
            ? translate('kubernetesHealthNormal')
            : translate('kubernetesHealthUnknown')
        const workloadModalColumns: any[] = [
            {
                title: '워크로드',
                key: 'workload',
                width: '52%',
                render: (_value: any, workload: any) => <DetailModalResourceCell
                    namespace={workload.namespace || '없음'}
                    name={workload.name}
                />
            },
            {
                title: '타입',
                dataIndex: 'kind',
                key: 'kind',
                width: '18%',
                render: (value: string) => <DetailModalTextCell value={value || '없음'} />
            },
            {
                title: '연결 파드',
                key: 'pods',
                width: '15%',
                align: 'right' as const,
                render: (_value: any, workload: any) => workloadPodCounts.get(workload.uid) || 0
            },
            {
                title: '',
                key: 'action',
                width: '15%',
                align: 'right' as const,
                render: (_value: any, workload: any) => <Button
                    type="link"
                    size="small"
                    disabled={!workload.node}
                    onClick={() => workload.node && this.openWorkloadWithRelation(workload.node, connected.pods)}>
                    보기
                </Button>
            }
        ]
        const podModalColumns: any[] = [
            {
                title: 'Pod',
                key: 'pod',
                width: '52%',
                render: (_value: any, pod: Node) => <DetailModalResourceCell
                    namespace={resourceNamespace(pod) || 'default'}
                    name={firstValue(pod.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) || pod.id}
                />
            },
            {
                title: '상태',
                key: 'status',
                width: '24%',
                render: (_value: any, pod: Node) => <DetailModalTextCell value={firstValue(pod.data || {}, [
                    'K8s.Extra.Status.Phase', 'K8s.Status.Phase', 'Status', 'State'
                ]) || '미확인'} />
            },
            {
                title: '',
                key: 'action',
                width: '24%',
                align: 'right' as const,
                render: (_value: any, pod: Node) => <Button type="link" size="small" onClick={() => this.openPodWithRelation(pod)}>보기</Button>
            }
        ]
        const riskModalConfigs: Record<Exclude<RiskModalKey, ''>, { title: string, kind: 'workload' | 'pod', data: any[], count: number }> = {
            'single-replica': { title: '단일 Replica 워크로드', kind: 'workload', data: singleReplicaRiskWorkloads, count: Number(detail.singleReplicaWorkloadCount || 0) },
            'local-storage': { title: '로컬 스토리지 의존 워크로드', kind: localStorageRiskKind, data: localStorageRiskData, count: Number(detail.localStorageDependentWorkloadCount || 0) },
            pending: { title: 'Pending Pod', kind: 'pod', data: connected.pendingPods, count: pendingPodCount },
            restart: { title: '재시작 이력 Pod', kind: 'pod', data: connected.restartHistoryPods, count: Number(detail.restartPodCount || 0) },
            'oom-killed': { title: '현재 OOMKilled Pod', kind: 'pod', data: connected.currentOOMKilledPods, count: Number(detail.oomKilledPodCount || 0) }
        }
        const riskModal = this.state.riskModal ? riskModalConfigs[this.state.riskModal] : undefined
        return <div className="netdive-k8s-node-detail">
            <DetailSectionCard icon={<InfoIcon />} title={translate('kubernetesNodeBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <BasicInfoRows density="compact" rows={overviewRows} labelWidth={122} copyTooltip={translate('copy')} />
                <DetailAdvancedInfo
                    title={translate('kubernetesAdvancedInformation')}
                    active={this.state.basicInfoAdvanced}
                    onChange={basicInfoAdvanced => this.setState({ basicInfoAdvanced })}>
                    <BasicInfoRows density="compact" rows={advancedRows} labelWidth={122} copyTooltip={translate('copy')} />
                </DetailAdvancedInfo>
            </DetailSectionCard>

            <DetailSectionCard icon={this.topologyIcon(this.props.node)} title={translate('kubernetesNodeOperationalStatus')}>
                <StatusSummaryGrid
                    verdict={netdiveVerdict}
                    verdictTone={netdiveTone}
                    rawStatus={statusLabel}
                    rawStatusLabel="Kubernetes 상태"
                    impact={currentImpact}
                    metrics={[
                        { key: 'active-pods', label: '활성 파드', value: currentPodCount, tooltip: NODE_METRIC_MAPPING.currentPods, tooltipRawValue: 'spec.nodeName=현재 노드, metadata.deletionTimestamp 없음', onClick: connected.pods.length ? () => this.focusNodes(connected.pods) : undefined },
                        { key: 'problem-pods', label: translate('kubernetesProblemPods'), value: optionalNumber(problemCount), tooltip: NODE_METRIC_MAPPING.problemPods, tooltipDetail: problemCriteria, tone: Number(problemCount || 0) > 0 ? 'danger' : 'default', onClick: podStatus.activeProblems.length ? () => this.focusNodes(podStatus.activeProblems) : undefined },
                        { key: 'scheduling', label: '스케줄링', value: detail.unschedulable ? '제한' : '허용', tone: detail.unschedulable ? 'warning' : 'default', tooltip: detail.unschedulable ? '이 노드에는 새 Pod를 배치할 수 없습니다.' : '이 노드에 새 Pod를 배치할 수 있는 상태입니다.', tooltipRawValue: `spec.unschedulable=${String(!!detail.unschedulable)}` },
                        { key: 'taint', label: 'Taint', value: Array.isArray(detail.taints) && detail.taints.length ? `${detail.taints.length}개` : '없음', tone: 'default', tooltip: '노드에 설정된 Taint 수이며 Pod 스케줄링 제약에 영향을 줄 수 있습니다.', tooltipRawValue: `spec.taints=${taintValue}` }
                    ]} />
            </DetailSectionCard>

            <DetailSectionCard icon={<StorageIcon />} title="리소스 현황">
                {this.renderCapacity(currentPodCount)}
            </DetailSectionCard>

            <DetailSectionCard icon={<ErrorOutlineIcon />} title={translate('kubernetesNodeConditions')}>
                {this.renderConditions()}
            </DetailSectionCard>

            <DetailSectionCard icon={<AccountTreeIcon />} title="위험 및 종속성">
                <StatusEvidenceList>
                    <StatusEvidenceRow
                        title={translate('kubernetesSingleReplicaWorkloads')}
                        evidence={NODE_METRIC_MAPPING.singleReplica}
                        state={Number(detail.singleReplicaWorkloadCount || 0) > 0 ? <DetailStatusIndicator tone="warning">보완 권장</DetailStatusIndicator> : <DetailStatusIndicator tone="success">정상</DetailStatusIndicator>}
                        value={optionalNumber(detail.singleReplicaWorkloadCount)}
                        tone={Number(detail.singleReplicaWorkloadCount || 0) > 0 ? 'warning' : 'success'}
                        tooltip={translate('kubernetesSingleReplicaWorkloadsDescription')}
                        tooltipRawValue={NODE_METRIC_MAPPING.singleReplicaRaw}
                        onClick={() => this.setState({ riskModal: 'single-replica' })}
                    />
                    <StatusEvidenceRow
                        title={translate('kubernetesLocalStorageWorkloads')}
                        evidence={NODE_METRIC_MAPPING.localStorage}
                        state={Number(detail.localStorageDependentWorkloadCount || 0) > 0 ? <DetailStatusIndicator tone="warning">보완 권장</DetailStatusIndicator> : <DetailStatusIndicator tone="success">정상</DetailStatusIndicator>}
                        value={optionalNumber(detail.localStorageDependentWorkloadCount)}
                        tone={Number(detail.localStorageDependentWorkloadCount || 0) > 0 ? 'warning' : 'success'}
                        tooltip={translate('kubernetesLocalStorageWorkloadsDescription')}
                        tooltipRawValue={NODE_METRIC_MAPPING.localStorageRaw}
                        onClick={() => this.setState({ riskModal: 'local-storage' })}
                    />
                    {[
                        ['Pending 파드', pendingPodCount, pendingPodCount > 0 ? 'danger' : 'success', '현재 노드에 배치되었지만 아직 실행 단계에 도달하지 못한 활성 Pod입니다.', connected.pendingPods, 'pending'],
                        ['재시작 이력 파드', detail.restartPodCount, Number(detail.restartPodCount || 0) > 0 ? 'warning' : 'success', NODE_METRIC_MAPPING.restartPods, connected.restartHistoryPods, 'restart'],
                        ['현재 OOMKilled 파드', detail.oomKilledPodCount, Number(detail.oomKilledPodCount || 0) > 0 ? 'warning' : 'success', '현재 활성 파드 중 현재 또는 직전 컨테이너 종료 상태가 OOMKilled인 고유 파드 수입니다.', connected.currentOOMKilledPods, 'oom-killed'],
                    ].map((item: any[]) => {
                        const count = Number(item[1] || 0)
                        const tone = item[2] as DetailBadgeTone
                        return <StatusEvidenceRow
                            key={item[0]}
                            title={item[0]}
                            evidence={item[3]}
                            state={count > 0
                                ? <DetailStatusIndicator tone={tone === 'danger' ? 'danger' : 'warning'}>{tone === 'danger' ? '위험' : '보완 권장'}</DetailStatusIndicator>
                                : <DetailStatusIndicator tone="success">정상</DetailStatusIndicator>}
                            value={optionalNumber(item[1])}
                            tone={tone}
                            onClick={() => this.setState({ riskModal: item[5] as RiskModalKey })}
                        />
                    })}
                </StatusEvidenceList>
            </DetailSectionCard>
            {this.state.focusActive && <div className="netdive-k8s-detail__focus-reset"><Button type="link" size="small" onClick={() => this.clearFocusedResources()}>강조 초기화</Button></div>}

            <RelatedResourceGrid
                icon={<AccountTreeIcon />}
                title={translate('hostConnectedResources')}
                emptyText={translate('hostNoConnectedResources')}
                groups={[{
                    key: 'kubernetes',
                    title: translate('kubernetesConnectedResourceGroup'),
                    icon: <img src="assets/icons/k8s.png" alt="" />,
                    items: [
                        { key: 'pods', label: 'Pod', count: connected.pods.length, icon: <DetailLayerIcon glyph={'\uf1b3'} />, iconTone: 'kubernetes', onClick: connected.pods.length ? () => this.setState({ podModalOpen: true }) : undefined, tooltip: '전체 Pod 목록 보기' },
                        { key: 'workloads', label: KUBERNETES_DETAIL_LABELS.workloadController, count: workloads.length, icon: <DetailLayerIcon glyph={'\uf5fd'} />, iconTone: 'kubernetes', onClick: workloads.length ? () => this.setState({ workloadModalOpen: true, workloadFilter: 'all' }) : undefined, tooltip: KUBERNETES_DETAIL_LABELS.workloadController }
                    ]
                }]} />

            <DetailSectionCard icon={<HistoryOutlined />} title={translate('kubernetesNodeRecentEvents')}>{this.renderImportantEvents()}</DetailSectionCard>

            <HistoryModal
                visible={!!riskModal}
                className="netdive-k8s-node-detail__risk-modal"
                title={riskModal ? `${riskModal.title} ${riskModal.count}개` : ''}
                width={riskModal?.kind === 'workload' ? 720 : 680}
                onCancel={() => this.setState({ riskModal: '' })}>
                {riskModal && riskModal.data.length > 0 ? <Table
                    className="netdive-modal-table netdive-k8s-node-detail__risk-modal-table"
                    columns={riskModal.kind === 'workload' ? workloadModalColumns : podModalColumns}
                    dataSource={riskModal.data}
                    rowKey={riskModal.kind === 'workload' ? 'uid' : (pod: Node) => pod.id}
                    pagination={false}
                    size="small"
                /> : riskModal && <CompactEmptyState
                    description={riskModal.count > 0
                        ? '집계 결과는 있으나 연결된 리소스를 현재 토폴로지에서 확인할 수 없습니다.'
                        : '해당 조건에 해당하는 리소스가 없습니다.'}
                    compact />}
            </HistoryModal>

            <HistoryModal
                visible={this.state.podModalOpen}
                className="netdive-k8s-node-detail__pod-modal"
                title={`전체 Pod ${connected.pods.length}개`}
                width={680}
                onCancel={() => this.setState({ podModalOpen: false })}>
                <Table
                    className="netdive-modal-table netdive-k8s-node-detail__pod-modal-table"
                    columns={podModalColumns}
                    dataSource={connected.pods}
                    rowKey={(pod: Node) => pod.id}
                    pagination={false}
                    size="small"
                />
            </HistoryModal>

            <HistoryModal
                visible={this.state.workloadModalOpen}
                className="netdive-k8s-node-detail__workload-modal"
                title={`전체 워크로드 컨트롤러 ${workloads.length}개`}
                width={720}
                onCancel={() => this.setState({ workloadModalOpen: false, workloadFilter: 'all' })}>
                <div className="netdive-k8s-node-detail__workload-modal-toolbar">
                    <Select
                        size="small"
                        value={this.state.workloadFilter}
                        onChange={workloadFilter => this.setState({ workloadFilter: String(workloadFilter) })}>
                        <Select.Option value="all">전체 {workloads.length}</Select.Option>
                        {workloadCounts.map(group => <Select.Option key={group.kind} value={group.kind}>{group.kind} {group.count}</Select.Option>)}
                    </Select>
                    <span>{filteredWorkloads.length}개 표시</span>
                </div>
                <Table
                    className="netdive-modal-table netdive-k8s-node-detail__workload-modal-table"
                    columns={workloadModalColumns}
                    dataSource={filteredWorkloads}
                    rowKey="uid"
                    pagination={false}
                    size="small"
                />
            </HistoryModal>

            {this.state.error && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesNodeDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesNodeDetailPanel
