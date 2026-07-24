import * as React from 'react'
import { Tooltip } from 'antd'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'
import LinkIcon from '@material-ui/icons/Link'
import { HistoryOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { ConnectedResourcesSection, DetailBadge, DetailBadgeTone, DetailEmpty, DetailKeyValueList, DetailLayerIcon, DetailResourceCard, DetailResourceGrid, DetailSection, KubernetesAnalysisConfidence } from './common'
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
    nodenotready: 'danger',
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
    networkunavailable: 'danger'
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
            if (this.state.requestKey === requestKey) this.setState({ detail, loading: false, error: false })
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
            const phase = firstValue(pod.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Status', 'Status']).toLowerCase()
            if (phase === 'running') runningPodCount++
            else if (phase === 'pending') pendingPodCount++
            else if (phase === 'failed') failedPodCount++
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
            const problem = phase === 'pending' || phase === 'failed' || crashLoop || oomKilled
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
                <div><strong>{group.reason}</strong>{group.tone === 'success' ? <span className="netdive-k8s-node-detail__normal"><i />{translate('kubernetesHealthNormal')}</span> : <DetailBadge tone={group.tone}>{group.tone === 'danger' ? translate('kubernetesHealthCritical') : translate('kubernetesHealthWarning')}</DetailBadge>}</div>
                <span>{group.description}</span>
                <small>{translate('kubernetesEventOccurrenceCount').replace('{count}', String(group.count))}</small>
            </div>
            <time title={String(group.time || '')}>{this.relativeEventTime(group.time)}</time>
        </div>)}</div>
    }

    private renderConditions() {
        const conditions = this.state.detail?.conditions
        if (!Array.isArray(conditions) || !conditions.length) return <DetailEmpty description={translate('kubernetesNodeConditionsUnavailable')} compact />
        const orderedConditions = conditions.slice().sort((left, right) => {
            const leftReady = String(left?.type || '').toLowerCase() === 'ready' ? 0 : 1
            const rightReady = String(right?.type || '').toLowerCase() === 'ready' ? 0 : 1
            return leftReady - rightReady
        })
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

    private renderCapacity() {
        const detail = this.state.detail
        if (!detail?.capacity && !detail?.allocatable) return <DetailEmpty description={translate('kubernetesNodeCapacityUnavailable')} compact />
        const cpuCapacity = quantity(detail.capacity, 'cpu')
        const cpuAllocatable = quantity(detail.allocatable, 'cpu')
        const memoryCapacity = quantity(detail.capacity, 'memory')
        const memoryAllocatable = quantity(detail.allocatable, 'memory')
        const rows = [
            { label: 'CPU', capacity: formatCapacityCpu(cpuCapacity), capacityRaw: cpuCapacity, allocatable: formatCapacityCpu(cpuAllocatable), allocatableRaw: cpuAllocatable },
            { label: translate('kubernetesMemory'), capacity: formatCapacityMemory(memoryCapacity), capacityRaw: memoryCapacity, allocatable: formatCapacityMemory(memoryAllocatable), allocatableRaw: memoryAllocatable }
        ]
        const podCapacity = quantity(detail.capacity, 'pods')
        const podAllocatable = quantity(detail.allocatable, 'pods')
        const podLimit = podAllocatable !== '–' ? podAllocatable : podCapacity
        return <div className="netdive-k8s-node-detail__capacity"><div className="netdive-k8s-node-detail__capacity-head"><span>{translate('kubernetesCapacity')}</span><span>{translate('kubernetesAllocatableLabel')}</span></div>{rows.map(row => <div key={row.label}><strong>{row.label}</strong><Tooltip title={row.capacityRaw && row.capacityRaw !== row.capacity ? row.capacityRaw : undefined}><span>{row.capacity}</span></Tooltip><Tooltip title={row.allocatableRaw && row.allocatableRaw !== row.allocatable ? row.allocatableRaw : undefined}><b>{row.allocatable}</b></Tooltip></div>)}<div className="netdive-k8s-node-detail__capacity-pods"><strong>{translate('kubernetesPodCapacity')}</strong><b>{podLimit === '–' ? podLimit : `${podLimit} Pods`}</b></div></div>
    }

    private findInfrastructureRelation(): { vm?: any, confidence: string } {
        const detail = this.state.detail || {}
        const nodeName = String(detail.name || firstValue(this.props.node.data || {}, ['Name'])).toLowerCase()
        const internalIP = String(detail.internalIp || '').toLowerCase()
        let nameMatch: any
        for (const vm of Object.keys(this.props.vmDetailMap || {}).map(key => (this.props.vmDetailMap || {})[key])) {
            if (!vm || typeof vm !== 'object') continue
            const vmName = firstValue(vm, ['name', 'instanceName', 'displayName', 'hostname']).toLowerCase()
            const addresses: string[] = []
            const visit = (value: any, key = '') => {
                if (Array.isArray(value)) return value.forEach(item => visit(item, key))
                if (value && typeof value === 'object') return Object.keys(value).forEach(childKey => visit(value[childKey], childKey))
                if (/ip(address)?|ipv4|addr/i.test(key) && value) addresses.push(String(value).toLowerCase())
            }
            visit(vm)
            if (internalIP && addresses.indexOf(internalIP) >= 0) return { vm, confidence: 'CONFIRMED' }
            if (nodeName && vmName === nodeName) nameMatch = vm
        }
        return nameMatch ? { vm: nameMatch, confidence: 'INFERRED' } : { confidence: detail.relationshipConfidence || 'UNKNOWN' }
    }

    private focusProblemPod(uid: string) {
        const topologyNodes = (window as any).App?.tc?.nodes
        const nodes: Node[] = topologyNodes instanceof Map ? Array.from(topologyNodes.values()) : Array.isArray(topologyNodes) ? topologyNodes : []
        const pod = nodes.find(node => node.id === uid || firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID', 'uid']) === uid)
        const app = (window as any).App
        if (pod && app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs([pod.id], this.props.node.id, true)
    }

    private focusNodes(nodes: Node[]) {
        const ids = nodes.map(node => node.id)
        const app = (window as any).App
        if (ids.length && app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs(ids, this.props.node.id, true)
    }

    private connectedKubernetesResources(): { pods: Node[], workloads: Node[], services: Node[] } {
        const allNodes = this.topologyNodes()
        const nodeName = firstValue(this.props.node.data || {}, ['Name', 'K8s.Name'])
        const clusterName = firstValue(this.props.node.data || {}, ['ClusterName', 'K8s.ClusterName'])
        const sameCluster = (node: Node) => !clusterName || firstValue(node.data || {}, ['ClusterName', 'K8s.ClusterName']) === clusterName
        const pods = allNodes.filter(node => sameCluster(node)
            && String(node.data?.Type || '').toLowerCase() === 'pod'
            && firstValue(node.data || {}, ['K8s.Extra.Spec.NodeName', 'K8s.Node', 'NodeName']) === nodeName)
        const workloadTypes = new Set(['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'])
        const workloadIDs = new Set<string>()
        pods.forEach(pod => {
            let parent = pod.parent
            while (parent) {
                if (workloadTypes.has(String(parent.data?.Type || '').toLowerCase())) workloadIDs.add(parent.id)
                parent = parent.parent
            }
            const owners = firstRaw(pod.data || {}, ['K8s.Extra.ObjectMeta.OwnerReferences']) || []
            if (Array.isArray(owners)) owners.forEach(owner => {
                const match = allNodes.find(node => sameCluster(node)
                    && workloadTypes.has(String(node.data?.Type || '').toLowerCase())
                    && (node.id === owner?.UID || firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'UID']) === owner?.UID || firstValue(node.data || {}, ['Name', 'K8s.Name']) === owner?.Name))
                if (match) workloadIDs.add(match.id)
            })
        })
        const podIDs = new Set(pods.map(pod => pod.id))
        const serviceIDs = new Set<string>()
        const links = (window as any).App?.tc?.links
        const topologyLinks: any[] = links instanceof Map ? Array.from(links.values()) : Array.isArray(links) ? links : []
        topologyLinks.forEach(link => {
            const sourceID = typeof link?.source === 'string' ? link.source : link?.source?.id
            const targetID = typeof link?.target === 'string' ? link.target : link?.target?.id
            const remoteID = podIDs.has(sourceID) ? targetID : podIDs.has(targetID) ? sourceID : ''
            const remote = remoteID ? allNodes.find(node => node.id === remoteID) : undefined
            if (remote && sameCluster(remote) && String(remote.data?.Type || '').toLowerCase() === 'service') serviceIDs.add(remote.id)
        })
        return {
            pods,
            workloads: allNodes.filter(node => workloadIDs.has(node.id)),
            services: allNodes.filter(node => serviceIDs.has(node.id))
        }
    }

    private connectedStorageResources(pods: Node[]): { claims: Node[], volumes: Node[] } {
        const allNodes = this.topologyNodes()
        const nodeName = firstValue(this.props.node.data || {}, ['Name', 'K8s.Name'])
        const clusterName = firstValue(this.props.node.data || {}, ['ClusterName', 'K8s.ClusterName'])
        const sameCluster = (node: Node) => !clusterName || firstValue(node.data || {}, ['ClusterName', 'K8s.ClusterName']) === clusterName
        const claimKeys = new Set<string>()
        pods.forEach(pod => {
            const namespace = firstValue(pod.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
            const volumes = firstRaw(pod.data || {}, ['K8s.Extra.Spec.Volumes']) || []
            if (!Array.isArray(volumes)) return
            volumes.forEach(volume => {
                const name = volume?.PersistentVolumeClaim?.ClaimName || volume?.VolumeSource?.PersistentVolumeClaim?.ClaimName
                if (name) claimKeys.add(`${namespace}/${name}`)
            })
        })
        const claims = allNodes.filter(node => {
            if (!sameCluster(node) || String(node.data?.Type || '').toLowerCase() !== 'persistentvolumeclaim') return false
            const namespace = firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
            const name = firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'])
            return claimKeys.has(`${namespace}/${name}`)
        })
        const boundVolumeNames = new Set<string>(claims
            .map(claim => firstValue(claim.data || {}, ['K8s.VolumeName', 'VolumeName', 'K8s.Extra.Spec.VolumeName']))
            .filter(Boolean))
        const volumes = allNodes.filter(node => {
            if (!sameCluster(node) || String(node.data?.Type || '').toLowerCase() !== 'persistentvolume') return false
            const name = firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'])
            if (boundVolumeNames.has(name)) return true
            const terms = firstRaw(node.data || {}, ['K8s.Extra.Spec.NodeAffinity.Required.NodeSelectorTerms'])
            if (!Array.isArray(terms)) return false
            return terms.some(term => {
                const expressions = Array.isArray(term?.MatchExpressions) ? term.MatchExpressions : []
                const fields = Array.isArray(term?.MatchFields) ? term.MatchFields : []
                return expressions.some(expression => expression?.Key === 'kubernetes.io/hostname'
                    && expression?.Operator === 'In'
                    && Array.isArray(expression?.Values)
                    && expression.Values.map(String).indexOf(nodeName) >= 0)
                    || fields.some(field => field?.Key === 'metadata.name'
                        && field?.Operator === 'In'
                        && Array.isArray(field?.Values)
                        && field.Values.map(String).indexOf(nodeName) >= 0)
            })
        })
        return { claims, volumes }
    }

    private infrastructureTarget(type: string, names: string[]): Node | undefined {
        const normalized = names.map(name => String(name || '').toLowerCase()).filter(Boolean)
        if (!normalized.length) return undefined
        return this.topologyNodes().find(node => {
            const nodeType = String(node.data?.Type || '').toLowerCase()
            const typeMatches = type === 'vm'
                ? String(node.data?.Manager || '').toLowerCase() !== 'k8s' && nodeType !== 'host'
                : nodeType === type
            return typeMatches && normalized.indexOf(firstValue(node.data || {}, ['Name', 'Hostname', 'DisplayName']).toLowerCase()) >= 0
        })
    }

    render() {
        const detail = this.state.detail || {}
        const data = this.props.node.data || {}
        const name = detail.name || firstValue(data, ['Name', 'K8s.Name']) || this.props.node.id
        const ready = this.ready()
        const statusLabel = ready === true ? translate('kubernetesNodeReady') : ready === false ? translate('kubernetesNodeNotReady') : translate('kubernetesHealthUnknown')
        const statusTone: DetailBadgeTone = ready === true ? 'success' : ready === false ? 'danger' : 'default'
        const conclusion = ready === true
            ? (Number(detail.impactedServiceCount || 0) > 0 ? translate('kubernetesNodeServiceImpact').replace('{count}', String(detail.impactedServiceCount)) : translate('kubernetesNodeNoCurrentImpact'))
            : ready === false ? translate('kubernetesNodeUnavailableConclusion') : translate('kubernetesNodeStatusUnavailable')
        const problemCount = Array.isArray(detail.problemPods) ? detail.problemPods.length : undefined
        const relation = this.findInfrastructureRelation()
        const relationVM = relation.vm
        const roles = Array.isArray(detail.roles) ? detail.roles : detail.roles ? String(detail.roles).split(',').map(role => role.trim()).filter(Boolean) : []
        const roleValue = roles.length ? <span className="netdive-k8s-node-detail__roles">{roles.map(role => <DetailBadge key={role} tone="default">{role}</DetailBadge>)}</span> : translate('kubernetesNotCollected')
        const osImage = String(detail.osImage || '')
        const maxPodCapacity = detail.maxPodCount !== undefined ? detail.maxPodCount : quantity(detail.allocatable, 'pods') !== '–' ? quantity(detail.allocatable, 'pods') : undefined
        const relationNetwork = relationVM ? firstValue(relationVM, ['networkName', 'network.name', 'network.displayText', 'primaryNetwork', 'nic.networkName', 'networks.0.name']) : ''
        const confidenceLabel = relation.confidence === 'CONFIRMED'
            ? translate('kubernetesRelationshipConfirmed')
            : relation.confidence === 'INFERRED' ? translate('kubernetesRelationshipInferred') : translate('kubernetesHealthUnknown')
        const basicRows: any[] = [
            { label: translate('kubernetesNodeName'), value: name, textValue: name, copyText: name },
            { label: translate('kubernetesNodeRoles'), value: roleValue },
            { label: 'Internal IP', value: detail.internalIp || translate('kubernetesNotCollected'), copyText: detail.internalIp },
            { label: 'Pod CIDR', value: Array.isArray(detail.podCidrs) && detail.podCidrs.length ? detail.podCidrs.join(', ') : translate('kubernetesNotCollectedShort') },
            { label: translate('kubernetesVersion'), value: detail.kubernetesVersion || translate('kubernetesNotCollected') },
            { label: 'OS Image', value: osImage ? formatOsImage(osImage) : translate('kubernetesNotCollected'), tooltip: osImage || undefined },
            { label: translate('kubernetesContainerRuntime'), value: detail.containerRuntime || translate('kubernetesNotCollected') }
        ]
        const conditionAuxiliaryRows: any[] = [
            { label: 'Taints', value: Array.isArray(detail.taints) && detail.taints.length ? detail.taints.map(taint => `${taint.key}${taint.value ? `=${taint.value}` : ''}:${taint.effect}`).join(', ') : translate('kubernetesNone') },
            { label: translate('kubernetesCurrentMaxPods'), value: detail.podCount !== undefined && maxPodCapacity !== undefined ? `${detail.podCount} / ${maxPodCapacity}` : translate('kubernetesNotCollected') },
            { label: <Tooltip title={translate('kubernetesSingleReplicaWorkloadsDescription')} placement="top"><span>{translate('kubernetesSingleReplicaWorkloads')}</span></Tooltip>, value: optionalNumber(detail.singleReplicaWorkloadCount) },
            { label: <Tooltip title={translate('kubernetesLocalStorageWorkloadsDescription')} placement="top"><span>{translate('kubernetesLocalStorageWorkloads')}</span></Tooltip>, value: optionalNumber(detail.localStorageDependentWorkloadCount) }
        ]
        const connected = this.connectedKubernetesResources()
        const connectedStorage = this.connectedStorageResources(connected.pods)
        const vmName = relationVM ? firstValue(relationVM, ['name', 'instanceName', 'displayName']) : ''
        const hostName = relationVM ? firstValue(relationVM, ['hostName', 'hostname', 'host', 'physicalHostName']) : ''
        const vmTarget = this.infrastructureTarget('vm', [vmName])
        const hostTarget = this.infrastructureTarget('host', [hostName])
        const networkTarget = this.topologyNodes().find(node => ['network', 'switch', 'bridge'].indexOf(String(node.data?.Type || '').toLowerCase()) >= 0
            && firstValue(node.data || {}, ['Name', 'NetworkName']).toLowerCase() === relationNetwork.toLowerCase())
        const nodeConditions = Array.isArray(detail.conditions) ? detail.conditions : []
        const hasCondition = (type: string) => nodeConditions.some((condition: any) => String(condition?.type || '').toLowerCase() === type.toLowerCase())
        const confidenceSignals = [
            { key: 'ready', requiredState: true, label: translate('kubernetesConfidenceDataNodeReady'), collected: this.ready() !== undefined },
            { key: 'network-unavailable', requiredState: true, label: translate('kubernetesConfidenceDataNetworkUnavailable'), collected: hasCondition('NetworkUnavailable') },
            { key: 'memory-pressure', requiredState: true, label: translate('kubernetesConfidenceDataMemoryPressure'), collected: hasCondition('MemoryPressure') },
            { key: 'disk-pressure', requiredState: true, label: translate('kubernetesConfidenceDataDiskPressure'), collected: hasCondition('DiskPressure') },
            { key: 'pid-pressure', requiredState: true, label: translate('kubernetesConfidenceDataPidPressure'), collected: hasCondition('PIDPressure') },
            { key: 'pod-capacity', requiredState: false, label: translate('kubernetesConfidenceDataPodCapacity'), collected: detail.podCount !== undefined && maxPodCapacity !== undefined },
            { key: 'single-replica', requiredState: false, label: translate('kubernetesConfidenceDataSingleReplica'), collected: detail.singleReplicaWorkloadCount !== undefined },
            { key: 'local-storage', requiredState: false, label: translate('kubernetesConfidenceDataLocalStorage'), collected: detail.localStorageDependentWorkloadCount !== undefined },
            { key: 'mold-vm', requiredState: false, label: translate('kubernetesConfidenceDataMoldVm'), collected: !!vmName },
            { key: 'physical-host', requiredState: false, label: translate('kubernetesConfidenceDataPhysicalHost'), collected: !!hostName },
            { key: 'network-path', requiredState: false, label: translate('kubernetesConfidenceDataNetworkPath'), collected: !!relationNetwork }
        ]
        const confidenceCollected = confidenceSignals.filter(signal => signal.collected).map(signal => signal.label)
        const confidenceMissing = confidenceSignals.filter(signal => !signal.collected).map(signal => signal.label)
        const requiredNodeStateCollected = confidenceSignals.filter(signal => signal.requiredState).every(signal => signal.collected)
        const confidenceState = confidenceCollected.length === 0
            ? 'unavailable' as const
            : confidenceMissing.length === 0
                ? 'sufficient' as const
                : requiredNodeStateCollected
                    ? 'partial' as const
                    : 'insufficient' as const

        return <div className="netdive-k8s-node-detail">
            <DetailSection icon={<InfoIcon />} title={translate('kubernetesNodeBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <DetailKeyValueList rows={basicRows} copyTooltip={translate('copy')} />
            </DetailSection>

            <DetailSection icon={this.topologyIcon(this.props.node)} title={translate('kubernetesNodeOperationalStatus')}>
                <div className={`netdive-k8s-node-detail__hero netdive-k8s-node-detail__hero--${statusTone}`}><i /><strong>{statusLabel}</strong><span>{conclusion}</span></div>
                <div className="netdive-k8s-node-detail__summary">
                    <div><span>{translate('kubernetesRunningPods')}</span><strong>{optionalNumber(detail.runningPodCount)}</strong></div>
                    <div><span>{translate('kubernetesProblemPods')}</span><strong className={Number(problemCount || 0) > 0 ? 'is-danger' : ''}>{optionalNumber(problemCount)}</strong></div>
                    <div><span>{translate('kubernetesAffectedServiceKpi')}</span><strong className={Number(detail.impactedServiceCount || 0) > 0 ? 'is-danger' : ''}>{optionalNumber(detail.impactedServiceCount)}</strong></div>
                    <div><span>{translate('kubernetesSchedulingShort')}</span><strong className={detail.unschedulable ? 'is-warning' : ''}>{detail.unschedulable ? translate('kubernetesBlocked') : translate('kubernetesAllowed')}</strong></div>
                </div>
            </DetailSection>

            <DetailSection icon={<ErrorOutlineIcon />} title={translate('kubernetesNodeConditions')}>
                {this.renderConditions()}
                <div className="netdive-k8s-node-detail__subsection-title">{translate('kubernetesNodeConditionAuxiliary')}</div>
                <DetailKeyValueList rows={conditionAuxiliaryRows} labelWidth={215} copyTooltip={translate('copy')} />
            </DetailSection>
            <DetailSection icon={<ErrorOutlineIcon />} title={translate('kubernetesRiskResilience')}>
                <KubernetesAnalysisConfidence state={confidenceState} collected={confidenceCollected} missing={confidenceMissing} />
            </DetailSection>
            <DetailSection icon={<StorageIcon />} title={translate('kubernetesNodeResources')}>
                {this.renderCapacity()}
                <div className="netdive-k8s-node-detail__subsection-title">{translate('kubernetesNodeWorkloadStatus')}</div>
                <div className="netdive-k8s-node-detail__metric-rows">
                    {[
                        ['Pending', detail.pendingPodCount, Number(detail.pendingPodCount || 0) > 0 ? 'warning' : 'default', ''],
                        ['Failed', detail.failedPodCount, Number(detail.failedPodCount || 0) > 0 ? 'danger' : 'default', ''],
                        [translate('kubernetesRestartedPods'), detail.restartPodCount, Number(detail.restartPodCount || 0) > 0 ? 'warning' : 'default', ''],
                        ['OOMKilled', detail.oomKilledPodCount, Number(detail.oomKilledPodCount || 0) > 0 ? 'danger' : 'default', ''],
                        [translate('kubernetesImpactedPods'), detail.impactedPodCount, Number(detail.impactedPodCount || 0) > 0 ? 'danger' : 'default', '']
                    ].map((item: any[]) => <div key={item[0]} className={`is-${item[2]}`}>{item[3] ? <Tooltip title={item[3]} placement="top"><span className="netdive-k8s-node-detail__metric-help">{item[0]}</span></Tooltip> : <span>{item[0]}</span>}<strong>{optionalNumber(item[1])}</strong></div>)}
                </div>
                {Array.isArray(detail.problemPods) && detail.problemPods.length > 0 && <div className="netdive-k8s-node-detail__problem-list-title">{translate('kubernetesProblemPods')}</div>}
                {Array.isArray(detail.problemPods) && detail.problemPods.length > 0 && <DetailResourceGrid compact>{detail.problemPods.map(pod => <DetailResourceCard key={pod.uid} label={pod.name} value="" icon={<AccountTreeIcon />} iconTone="kubernetes" interactive onClick={() => this.focusProblemPod(pod.uid)} />)}</DetailResourceGrid>}
            </DetailSection>

            <ConnectedResourcesSection
                icon={<LinkIcon />}
                title={translate('hostConnectedResources')}
                emptyText={translate('hostNoConnectedResources')}
                groups={[
                    {
                        key: 'kubernetes',
                        title: translate('kubernetesConnectedResourceGroup'),
                        icon: <img src="assets/icons/k8s.png" alt="" />,
                        items: [
                            ...(connected.pods.length ? [{ key: 'pods', label: translate('kubernetesTopologyPods'), count: connected.pods.length, icon: this.topologyIcon(connected.pods[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusNodes(connected.pods) }] : []),
                            ...(connected.workloads.length ? [{ key: 'workloads', label: translate('kubernetesTopologyWorkloadControllers'), count: connected.workloads.length, icon: <DetailLayerIcon glyph={'\uf5fd'} />, iconTone: 'kubernetes' as const, onClick: () => this.focusNodes(connected.workloads) }] : []),
                            ...(connected.services.length ? [{ key: 'services', label: translate('kubernetesAffectedServices'), count: connected.services.length, icon: this.topologyIcon(connected.services[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusNodes(connected.services) }] : [])
                        ]
                    },
                    {
                        key: 'storage',
                        title: '스토리지',
                        icon: <StorageIcon />,
                        items: [
                            ...(connectedStorage.claims.length ? [{ key: 'pvcs', label: '마운트된 PVC', count: connectedStorage.claims.length, icon: this.topologyIcon(connectedStorage.claims[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusNodes(connectedStorage.claims) }] : []),
                            ...(connectedStorage.volumes.length ? [{ key: 'pvs', label: '연결된 PV', count: connectedStorage.volumes.length, icon: this.topologyIcon(connectedStorage.volumes[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusNodes(connectedStorage.volumes) }] : [])
                        ]
                    },
                    {
                        key: 'infrastructure',
                        title: translate('kubernetesInfrastructureResourceGroup'),
                        icon: <AccountTreeIcon />,
                        hint: relation.confidence === 'CONFIRMED' ? confidenceLabel : undefined,
                        items: [
                            ...(vmName ? [{ key: 'vm', label: 'Mold VM', count: 1, icon: <DetailLayerIcon glyph={'\uf108'} />, iconTone: 'user-vm' as const, onClick: vmTarget ? () => this.focusNodes([vmTarget]) : undefined, tooltip: vmName }] : []),
                            ...(hostName ? [{ key: 'host', label: translate('kubernetesPhysicalHost'), count: 1, icon: <DetailLayerIcon glyph={'\uf233'} />, iconTone: 'host' as const, onClick: hostTarget ? () => this.focusNodes([hostTarget]) : undefined, tooltip: hostName }] : []),
                            ...(relationNetwork ? [{ key: 'network', label: translate('kubernetesNetworkPathShort'), count: 1, icon: <DetailLayerIcon glyph={'\uf6ff'} />, iconTone: 'network' as const, onClick: networkTarget ? () => this.focusNodes([networkTarget]) : undefined, tooltip: relationNetwork }] : [])
                        ]
                    }
                ]} />
            <DetailSection icon={<HistoryOutlined />} title={translate('kubernetesNodeRecentEvents')}>{this.renderImportantEvents()}</DetailSection>

            {this.state.error && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesNodeDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesNodeDetailPanel
