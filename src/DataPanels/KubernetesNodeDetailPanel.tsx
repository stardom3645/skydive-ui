import * as React from 'react'
import { Progress, Tooltip } from 'antd'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'
import { HistoryOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { isCurrentKubernetesPod } from '../KubernetesPodLifecycle'
import { resolveKubernetesPodController } from '../KubernetesWorkloadOwnership'
import { classifyKubernetesPod, DetailBadge, DetailBadgeTone, DetailEmpty, DetailKeyValueList, DetailResourceCard, DetailResourceGrid, DetailSection, summarizeKubernetesPods } from './common'
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
}

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
    const millicores = value.match(/^([0-9.]+)m$/i)
    if (millicores) return `${(Number(millicores[1]) / 1000).toFixed(2).replace(/\.00$/, '')} Core`
    return /^([0-9.]+)$/.test(value) ? `${value} Core` : value
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

class KubernetesNodeDetailPanel extends React.Component<Props, State> {
    state: State = { loading: false, error: false, requestKey: '', basicCollapsed: false }

    componentDidMount() { this.loadDetail() }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id || this.cluster()?.id !== this.clusterFrom(prevProps)?.id) {
            this.setState({ basicCollapsed: false })
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
                        usage: detail.usage || topologyDetail.usage,
                        serviceImpactAvailable: detail.impactedServiceCount !== undefined
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
        const pods = this.topologyNodes().filter(node => {
            if (String(node.data?.Manager || '').toLowerCase() !== 'k8s' || String(node.data?.Type || '').toLowerCase() !== 'pod') return false
            if (clusterName && firstValue(node.data || {}, ['ClusterName', 'K8s.ClusterName']) !== clusterName) return false
            return firstValue(node.data || {}, ['K8s.Extra.Spec.NodeName', 'K8s.Node', 'NodeName']) === name
        })
        let runningPodCount = 0
        let pendingPodCount = 0
        let failedPodCount = 0
        let restartPodCount = 0
        let oomKilledPodCount = 0
        const problemPods: any[] = []
        const impactedPodIDs = new Set<string>()
        const localStorageOwners = new Set<string>()
        const readyCondition = conditions.find(condition => String(condition.type).toLowerCase() === 'ready')
        const nodeReady = readyCondition ? String(readyCondition.status).toLowerCase() === 'true' : undefined
        pods.forEach(pod => {
            const podState = classifyKubernetesPod(pod)
            const phase = podState.phase
            if (phase === 'running') runningPodCount++
            else if (phase === 'pending') pendingPodCount++
            else if (phase === 'failed' && podState.activeProblem) failedPodCount++
            const containerStatuses = firstRaw(pod.data || {}, ['K8s.Extra.Status.ContainerStatuses']) || []
            const initStatuses = firstRaw(pod.data || {}, ['K8s.Extra.Status.InitContainerStatuses']) || []
            let restarted = false
            let oomKilled = false
            let crashLoop = false
            ;([] as any[]).concat(initStatuses || [], containerStatuses || []).forEach(container => {
                if (Number(container?.RestartCount || 0) > 0) restarted = true
                const waitingReason = container?.State?.Waiting?.Reason
                const terminatedReason = container?.State?.Terminated?.Reason || container?.LastTerminationState?.Terminated?.Reason
                if (waitingReason === 'CrashLoopBackOff') crashLoop = true
                if (terminatedReason === 'OOMKilled') oomKilled = true
            })
            if (restarted) restartPodCount++
            if (oomKilled) oomKilledPodCount++
            const problem = podState.activeProblem
            if (problem || nodeReady === false) impactedPodIDs.add(pod.id)
            if (problem) problemPods.push({ uid: pod.id, kind: 'Pod', name: firstValue(pod.data || {}, ['Name', 'K8s.Name']), namespace: firstValue(pod.data || {}, ['Namespace', 'K8s.Namespace']) })
            const volumes = firstRaw(pod.data || {}, ['K8s.Extra.Spec.Volumes']) || []
            if (Array.isArray(volumes) && volumes.some(volume => !!(volume?.HostPath || volume?.VolumeSource?.HostPath))) {
                const owners = firstRaw(pod.data || {}, ['K8s.Extra.ObjectMeta.OwnerReferences']) || []
                localStorageOwners.add(Array.isArray(owners) && owners[0]?.UID ? owners[0].UID : pod.id)
            }
        })
        const impactedServices = new Set<string>()
        const links = (window as any).App?.tc?.links
        const topologyLinks: any[] = links instanceof Map ? Array.from(links.values()) : Array.isArray(links) ? links : []
        topologyLinks.forEach(link => {
            const sourceID = typeof link?.source === 'string' ? link.source : link?.source?.id
            const targetID = typeof link?.target === 'string' ? link.target : link?.target?.id
            if (!impactedPodIDs.has(sourceID) && !impactedPodIDs.has(targetID)) return
            const remoteID = impactedPodIDs.has(sourceID) ? targetID : sourceID
            const remote = this.topologyNodes().find(node => node.id === remoteID)
            if (remote && String(remote.data?.Type || '').toLowerCase() === 'service') impactedServices.add(remote.id)
        })
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
            podCount: pods.length,
            runningPodCount,
            pendingPodCount,
            failedPodCount,
            restartPodCount,
            oomKilledPodCount,
            impactedPodCount: impactedPodIDs.size,
            impactedServiceCount: impactedServices.size,
            localStorageDependentWorkloadCount: localStorageOwners.size,
            problemPods,
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
        return Array.from(groups.values()).sort((left, right) => new Date(right.time || 0).getTime() - new Date(left.time || 0).getTime())
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
        if (!groups.length) return <DetailEmpty description={translate('kubernetesNodeNoImportantEvents')} compact />
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
        if (!Array.isArray(conditions) || !conditions.length) return <DetailEmpty description={translate('kubernetesNodeConditionsUnavailable')} compact />
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
        if (!orderedConditions.length) return <DetailEmpty description={translate('kubernetesNodeConditionsUnavailable')} compact />
        return <div className="netdive-k8s-node-detail__rows">{orderedConditions.map(condition => {
            const tone = this.conditionTone(condition)
            const state = tone === 'success'
                ? <span className="netdive-k8s-node-detail__normal"><i />{translate('kubernetesHealthNormal')}</span>
                : <DetailBadge tone={tone}>{tone === 'danger' ? translate('kubernetesHealthCritical') : translate('kubernetesHealthWarning')}</DetailBadge>
            const stateLabel = tone === 'success' ? translate('kubernetesHealthNormal') : tone === 'danger' ? translate('kubernetesHealthCritical') : translate('kubernetesHealthWarning')
            const tooltip = <div className="netdive-k8s-node-detail__condition-tooltip">
                <div><span>{translate('kubernetesConditionInterpretedStatus')}</span><strong>{stateLabel}</strong></div>
                <div><span>{translate('kubernetesConditionRawValue')}</span><strong>{condition.type}={String(condition.status)}</strong></div>
                {condition.reason && <div><span>Reason</span><strong>{condition.reason}</strong></div>}
                {condition.message && <p>{condition.message}</p>}
            </div>
            return <Tooltip key={condition.type} title={tooltip} placement="top">
                <div className={`netdive-k8s-node-detail__row netdive-k8s-node-detail__row--${tone}`}>
                    <strong>{condition.type}</strong>
                    <span className="netdive-k8s-node-detail__condition-state">{state}</span>
                    <b>{this.duration(condition.durationSeconds)}</b>
                </div>
            </Tooltip>
        })}</div>
    }

    private renderCapacity(currentPodCount: number) {
        const detail = this.state.detail
        if (!detail?.capacity && !detail?.allocatable) return <DetailEmpty description={translate('kubernetesNodeCapacityUnavailable')} compact />
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
                label: 'Pod 할당량',
                usage: String(currentPodCount),
                allocatable: podAllocatable === '–' ? undefined : podAllocatable,
                capacity: podCapacity === '–' ? undefined : podCapacity,
                percent: utilization(currentPodCount, Number(podAllocatable))
            }
        ]
        return <div className="netdive-k8s-node-detail__resource-overview">
            <div className="netdive-k8s-node-detail__resource-caption">사용량 / Allocatable · 사용률</div>
            {metrics.map(metric => {
                const percentLabel = metric.percent === undefined ? '–' : `${metric.percent.toFixed(1)}%`
                return <Tooltip
                    key={metric.key}
                    placement="top"
                    title={<div>
                        <div>Capacity: {metric.capacity || '없음'}</div>
                        <div>Allocatable: {metric.allocatable || '없음'}</div>
                    </div>}>
                    <div className="netdive-k8s-node-detail__resource-row">
                        <strong>{metric.label}</strong>
                        <div>
                            <span><b>{metric.usage || '없음'}</b> / {metric.allocatable || '없음'}</span>
                            <em>{percentLabel}</em>
                        </div>
                        <Progress percent={metric.percent === undefined ? 0 : Math.min(100, metric.percent)} showInfo={false} size="small" />
                    </div>
                </Tooltip>
            })}
        </div>
    }

    private focusNodes(nodes: Node[]) {
        const ids = nodes.map(node => node.id)
        const app = (window as any).App
        if (ids.length && app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs(ids, this.props.node.id, true)
    }

    private connectedKubernetesResources(): { pods: Node[], workloads: Node[] } {
        const allNodes = this.topologyNodes()
        const nodeName = firstValue(this.props.node.data || {}, ['Name', 'K8s.Name'])
        const clusterName = firstValue(this.props.node.data || {}, ['ClusterName', 'K8s.ClusterName'])
        const sameCluster = (node: Node) => !clusterName || firstValue(node.data || {}, ['ClusterName', 'K8s.ClusterName']) === clusterName
        const pods = allNodes.filter(node => sameCluster(node)
            && String(node.data?.Type || '').toLowerCase() === 'pod'
            && isCurrentKubernetesPod(node)
            && firstValue(node.data || {}, ['K8s.Extra.Spec.NodeName', 'K8s.Node', 'NodeName']) === nodeName)
        const workloadIDs = new Set<string>(pods
            .map(pod => resolveKubernetesPodController(pod, allNodes)?.id)
            .filter(Boolean) as string[])
        return {
            pods,
            workloads: allNodes.filter(node => workloadIDs.has(node.id))
        }
    }

    render() {
        const detail = this.state.detail || {}
        const data = this.props.node.data || {}
        const name = detail.name || firstValue(data, ['Name', 'K8s.Name']) || this.props.node.id
        const ready = this.ready()
        const statusLabel = ready === true ? translate('kubernetesNodeReady') : ready === false ? translate('kubernetesNodeNotReady') : translate('kubernetesHealthUnknown')
        const statusTone: DetailBadgeTone = ready === true ? 'success' : ready === false ? 'danger' : 'default'
        const connected = this.connectedKubernetesResources()
        const podStatus = summarizeKubernetesPods(connected.pods)
        const problemCount = podStatus.activeProblems.length
        const serviceImpactAvailable = detail.serviceImpactAvailable === true
        const currentImpactedServiceCount = serviceImpactAvailable ? Number(detail.impactedServiceCount || 0) : undefined
        const roles = Array.isArray(detail.roles) ? detail.roles : detail.roles ? String(detail.roles).split(',').map(role => role.trim()).filter(Boolean) : []
        const missingValue = this.state.error ? '조회 실패' : '없음'
        const roleValue = roles.length ? <span className="netdive-k8s-node-detail__roles">{roles.map(role => <DetailBadge key={role} tone="default">{role}</DetailBadge>)}</span> : missingValue
        const osImage = String(detail.osImage || '')
        const maxPodCapacity = detail.maxPodCount !== undefined ? detail.maxPodCount : quantity(detail.allocatable, 'pods') !== '–' ? quantity(detail.allocatable, 'pods') : undefined
        const basicRows: any[] = [
            { label: translate('kubernetesNodeName'), value: name, textValue: name, copyText: name },
            { label: translate('kubernetesNodeRoles'), value: roleValue },
            { label: '내부 IP', value: detail.internalIp || missingValue, copyText: detail.internalIp },
            { label: 'Pod CIDR', value: Array.isArray(detail.podCidrs) && detail.podCidrs.length ? detail.podCidrs.join(', ') : missingValue },
            { label: translate('kubernetesVersion'), value: detail.kubernetesVersion || missingValue },
            { label: 'OS', value: osImage ? formatOsImage(osImage) : missingValue, tooltip: osImage || undefined },
            { label: translate('kubernetesContainerRuntime'), value: detail.containerRuntime || missingValue },
            { label: '생성 시각', value: formatDate(detail.createdAt) || missingValue },
            { label: 'Kernel', value: detail.kernelVersion || missingValue },
            { label: 'Architecture', value: detail.architecture || missingValue }
        ]
        const taintValue = Array.isArray(detail.taints) && detail.taints.length
            ? detail.taints.map(taint => `${taint.key}${taint.value ? `=${taint.value}` : ''}:${taint.effect}`).join(', ')
            : '없음'
        const workloadRows: any[] = [
            { label: '현재 파드 / 최대 파드', value: maxPodCapacity !== undefined ? `${connected.pods.length} / ${maxPodCapacity}` : `${connected.pods.length} / ${missingValue}` },
            { label: <Tooltip title={translate('kubernetesSingleReplicaWorkloadsDescription')} placement="top"><span>{translate('kubernetesSingleReplicaWorkloads')}</span></Tooltip>, value: optionalNumber(detail.singleReplicaWorkloadCount) },
            { label: <Tooltip title={translate('kubernetesLocalStorageWorkloadsDescription')} placement="top"><span>{translate('kubernetesLocalStorageWorkloads')}</span></Tooltip>, value: optionalNumber(detail.localStorageDependentWorkloadCount) }
        ]
        const summaryColumns = serviceImpactAvailable ? 'netdive-k8s-node-detail__summary--4' : 'netdive-k8s-node-detail__summary--3'
        const problemCriteria = 'Pending, Failed, CrashLoopBackOff, ImagePullBackOff, ErrImagePull 또는 Ready=false인 현재 파드를 집계합니다.'

        return <div className="netdive-k8s-node-detail">
            <DetailSection icon={<InfoIcon />} title={translate('kubernetesNodeBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <DetailKeyValueList rows={basicRows} labelWidth={122} copyTooltip={translate('copy')} className="netdive-k8s-node-detail__basic-kv" />
            </DetailSection>

            <DetailSection icon={this.topologyIcon(this.props.node)} title={translate('kubernetesNodeOperationalStatus')}>
                <div className={`netdive-k8s-node-detail__hero netdive-k8s-node-detail__hero--${statusTone}`}><i /><span>원본 상태</span><strong>{statusLabel}</strong></div>
                <div className="netdive-k8s-node-detail__impact">
                    <span>현재 워크로드 영향</span>
                    <strong className={problemCount > 0 ? 'is-danger' : ''}>{problemCount > 0 ? `문제 파드 ${problemCount}개` : '영향 없음'}</strong>
                </div>
                <div className={`netdive-k8s-node-detail__summary ${summaryColumns}`}>
                    <div><span>{translate('kubernetesRunningPods')}</span><strong>{optionalNumber(detail.runningPodCount)}</strong></div>
                    <div><Tooltip title={problemCriteria}><span className="netdive-k8s-node-detail__metric-help">{translate('kubernetesProblemPods')}</span></Tooltip><strong className={Number(problemCount || 0) > 0 ? 'is-danger' : ''}>{optionalNumber(problemCount)}</strong></div>
                    {serviceImpactAvailable && <div><span>영향받은 서비스</span><strong className={Number(currentImpactedServiceCount || 0) > 0 ? 'is-danger' : ''}>{currentImpactedServiceCount}</strong></div>}
                    <div><span>{translate('kubernetesSchedulingShort')}</span><strong className={detail.unschedulable ? 'is-warning' : ''}>{detail.unschedulable ? translate('kubernetesBlocked') : translate('kubernetesAllowed')}</strong></div>
                </div>
                <div className="netdive-k8s-node-detail__scheduling">
                    <div><span>Cordoned</span><strong>{detail.unschedulable ? '예' : '아니오'}</strong></div>
                    <div><span>spec.unschedulable</span><strong>{String(!!detail.unschedulable)}</strong></div>
                    <div><span>Taint</span><Tooltip title={taintValue}><strong>{taintValue}</strong></Tooltip></div>
                </div>
            </DetailSection>

            <DetailSection icon={<StorageIcon />} title="리소스 현황">
                {this.renderCapacity(connected.pods.length)}
            </DetailSection>

            <DetailSection icon={<ErrorOutlineIcon />} title={translate('kubernetesNodeConditions')}>
                {this.renderConditions()}
            </DetailSection>

            <DetailSection icon={<AccountTreeIcon />} title="할당된 워크로드">
                <DetailKeyValueList rows={workloadRows} labelWidth={205} copyTooltip={translate('copy')} />
                <div className="netdive-k8s-node-detail__metric-rows">
                    {[
                        ['Pending', podStatus.pending, podStatus.pending > 0 ? 'danger' : 'default', ''],
                        ['현재 Failed', podStatus.activeFailed, podStatus.activeFailed > 0 ? 'danger' : 'default', 'Evicted 및 완료된 Job 파드는 제외합니다.'],
                        [translate('kubernetesRestartedPods'), detail.restartPodCount, Number(detail.restartPodCount || 0) > 0 ? 'warning' : 'default', '누적 재시작 이력입니다.'],
                        ['OOMKilled 이력', detail.oomKilledPodCount, Number(detail.oomKilledPodCount || 0) > 0 ? 'warning' : 'default', '현재 상태가 아니라 종료 이력입니다.'],
                        [translate('kubernetesImpactedPods'), problemCount, problemCount > 0 ? 'danger' : 'default', '현재 활성 문제 파드만 표시합니다.']
                    ].map((item: any[]) => <div key={item[0]} className={`is-${item[2]}`}>{item[3] ? <Tooltip title={item[3]} placement="top"><span className="netdive-k8s-node-detail__metric-help">{item[0]}</span></Tooltip> : <span>{item[0]}</span>}<strong>{optionalNumber(item[1])}</strong></div>)}
                </div>
                {podStatus.activeProblems.length > 0 && <div className="netdive-k8s-node-detail__problem-list-title">{translate('kubernetesProblemPods')}</div>}
                {podStatus.activeProblems.length > 0 && <DetailResourceGrid compact>{podStatus.activeProblems.map(pod => <DetailResourceCard key={pod.id} label={firstValue(pod.data || {}, ['Name', 'K8s.Name']) || pod.id} value="" icon={<AccountTreeIcon />} iconTone="kubernetes" interactive onClick={() => this.focusNodes([pod])} />)}</DetailResourceGrid>}
                {connected.workloads.length > 0 && <div className="netdive-k8s-node-detail__problem-list-title">워크로드 컨트롤러</div>}
                {connected.workloads.length > 0 && <DetailResourceGrid compact>{connected.workloads.map(workload => <DetailResourceCard key={workload.id} label={firstValue(workload.data || {}, ['Name', 'K8s.Name']) || workload.id} value={firstValue(workload.data || {}, ['K8s.Kind', 'Kind', 'Type'])} icon={this.topologyIcon(workload)} iconTone="kubernetes" interactive onClick={() => this.focusNodes([workload])} />)}</DetailResourceGrid>}
            </DetailSection>

            <DetailSection icon={<HistoryOutlined />} title={translate('kubernetesNodeRecentEvents')}>{this.renderImportantEvents()}</DetailSection>

            {this.state.error && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesNodeDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesNodeDetailPanel
