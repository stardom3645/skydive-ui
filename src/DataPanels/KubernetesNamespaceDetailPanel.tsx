import * as React from 'react'
import { Tooltip } from 'antd'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import DnsIcon from '@material-ui/icons/Dns'
import InfoIcon from '@material-ui/icons/Info'
import LinkIcon from '@material-ui/icons/Link'
import StorageIcon from '@material-ui/icons/Storage'
import { HistoryOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { DetailBadge, DetailEmpty, DetailKeyValueList, DetailResourceCard, DetailResourceGrid, DetailSection } from './common'
import './KubernetesNodeDetailPanel.css'
import './KubernetesNamespaceDetailPanel.css'

interface Props {
    node: Node
    nodeAttrs: (node: Node) => any
    session: session
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
const optionalNumber = (value: any): React.ReactNode => value === undefined || value === null ? '–' : Number(value)
const stringify = (value: any): string => {
    if (value === undefined || value === null) return ''
    if (typeof value === 'string') return value
    try { return JSON.stringify(value) } catch (_) { return String(value) }
}
const memoryQuantity = (value: any): string => {
    if (value === undefined || value === null || value === '') return translate('kubernetesNotCollected')
    const bytes = Number(value)
    if (!Number.isFinite(bytes)) return String(value)
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(bytes % (1024 * 1024 * 1024) ? 1 : 0)} GiB`
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) ? 1 : 0)} MiB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(bytes % 1024 ? 1 : 0)} KiB`
    return `${bytes} B`
}
const quantityIsPresent = (value: any): boolean => value !== undefined && value !== null && value !== ''
const quantityIsPositive = (value: any): boolean => {
    if (!quantityIsPresent(value)) return false
    const raw = typeof value === 'object' && value.string !== undefined ? value.string : value
    const amount = Number.parseFloat(String(raw))
    return Number.isFinite(amount) && amount > 0
}
const displayQuantity = (value: any, memory = false): string => quantityIsPresent(value)
    ? memory ? memoryQuantity(value) : (typeof value === 'object' && value.string !== undefined ? String(value.string) : String(value))
    : translate('kubernetesNotCollected')
type NamespaceEventTone = 'warning' | 'danger'
interface NamespaceEventGroup {
    reason: string
    tone: NamespaceEventTone
    resourceKind: string
    resourceName: string
    count: number
    time: any
}
const IMPORTANT_EVENT_REASONS = new Set([
    'failedscheduling', 'crashloopbackoff', 'backoff', 'oomkilled',
    'failedmount', 'imagepullbackoff', 'errimagepull', 'evicted'
])
const CRITICAL_EVENT_REASONS = new Set(['crashloopbackoff', 'oomkilled', 'evicted'])

class KubernetesNamespaceDetailPanel extends React.Component<Props, State> {
    state: State = { loading: false, error: false, requestKey: '', basicCollapsed: false }

    componentDidMount() { this.loadDetail() }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id || this.clusterFrom(prevProps)?.id !== this.cluster()?.id) {
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
        const fallback = this.detailFromTopology()
        if (!cluster?.id || !uid) {
            this.setState({ detail: fallback, loading: false, error: !!uid, requestKey })
            return
        }
        if (this.state.requestKey === requestKey) return
        const endpoint = this.props.session?.endpoint || `${window.location.protocol}//${window.location.host}`
        this.setState({ detail: fallback, loading: true, error: false, requestKey })
        fetch(`${endpoint}/api/mold/kubernetes-clusters/namespaces/detail?id=${encodeURIComponent(cluster.id)}&uid=${encodeURIComponent(uid)}`, {
            cache: 'no-store',
            headers: this.props.session?.token ? { 'X-Auth-Token': this.props.session.token } : undefined
        }).then(response => {
            if (!response.ok) throw new Error(`namespace detail unavailable: ${response.status}`)
            return response.json()
        }).then(detail => {
            if (this.state.requestKey === requestKey) this.setState({ detail: { ...fallback, ...detail }, loading: false, error: false })
        }).catch(() => {
            if (this.state.requestKey === requestKey) this.setState({ detail: this.detailFromTopology(), loading: false, error: true })
        })
    }

    private topologyNodes(): Node[] {
        const nodes = (window as any).App?.tc?.nodes
        if (nodes instanceof Map) return Array.from(nodes.values())
        return Array.isArray(nodes) ? nodes : []
    }

    private namespaceResources(type: 'pod' | 'service'): Node[] {
        const name = firstValue(this.props.node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'])
        const clusterName = firstValue(this.props.node.data || {}, ['ClusterName', 'K8s.ClusterName'])
        return this.topologyNodes().filter(node => {
            const data = node.data || {}
            if (String(data.Manager || '').toLowerCase() !== 'k8s' || String(data.Type || '').toLowerCase() !== type) return false
            if (clusterName && firstValue(data, ['ClusterName', 'K8s.ClusterName']) !== clusterName) return false
            return firstValue(data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) === name
        })
    }

    private detailFromTopology(): any {
        const data = this.props.node.data || {}
        const extra = firstRaw(data, ['K8s.Extra']) || {}
        const objectMeta = extra.ObjectMeta || {}
        const status = extra.Status || {}
        const name = firstValue(data, ['Name', 'K8s.Name']) || objectMeta.Name || this.props.node.id
        const pods = this.namespaceResources('pod')
        const services = this.namespaceResources('service')
        let runningPodCount = 0
        let pendingPodCount = 0
        let failedPodCount = 0
        let crashLoopPodCount = 0
        let oomKilledPodCount = 0
        const problemPods: any[] = []
        const scheduledNodes = new Set<string>()
        pods.forEach(pod => {
            const podData = pod.data || {}
            const phase = firstValue(podData, ['K8s.Extra.Status.Phase', 'K8s.Status', 'Status']).toLowerCase()
            if (phase === 'running' || phase === 'succeeded') runningPodCount++
            else if (phase === 'pending') pendingPodCount++
            else if (phase === 'failed') failedPodCount++
            const nodeName = firstValue(podData, ['K8s.Extra.Spec.NodeName', 'K8s.Node', 'NodeName'])
            if (nodeName && phase === 'running') scheduledNodes.add(nodeName)
            const containerStatuses = ([] as any[]).concat(
                firstRaw(podData, ['K8s.Extra.Status.InitContainerStatuses']) || [],
                firstRaw(podData, ['K8s.Extra.Status.ContainerStatuses']) || []
            )
            let crashLoop = false
            let oomKilled = false
            containerStatuses.forEach(container => {
                if (container?.State?.Waiting?.Reason === 'CrashLoopBackOff') crashLoop = true
                const terminated = container?.State?.Terminated?.Reason || container?.LastTerminationState?.Terminated?.Reason
                if (terminated === 'OOMKilled') oomKilled = true
            })
            if (crashLoop) crashLoopPodCount++
            if (oomKilled) oomKilledPodCount++
            if (phase === 'pending' || phase === 'failed' || crashLoop || oomKilled) {
                problemPods.push({ uid: pod.id, name: firstValue(podData, ['Name', 'K8s.Name']) || pod.id })
            }
        })
        return {
            uid: objectMeta.UID || this.props.node.id,
            name,
            phase: status.Phase || firstValue(data, ['K8s.Status', 'Status']),
            createdAt: objectMeta.CreationTimestamp?.Time,
            labels: data.K8s?.Labels || objectMeta.Labels || {},
            terminating: !!objectMeta.DeletionTimestamp,
            podCount: pods.length,
            serviceCount: services.length,
            runningPodCount,
            pendingPodCount,
            failedPodCount,
            crashLoopPodCount,
            oomKilledPodCount,
            scheduledNodeCount: scheduledNodes.size,
            problemPods,
            source: 'TOPOLOGY'
        }
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        if (attrs.href) return <img className="netdive-k8s-node-detail__topology-icon-image" src={attrs.href} alt="" />
        return <span className={`netdive-k8s-node-detail__topology-icon ${attrs.iconClass || ''}`} aria-hidden="true">{attrs.icon}</span>
    }

    private focusResource(uid: string) {
        const resource = this.topologyNodes().find(node => node.id === uid || firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) === uid)
        const app = (window as any).App
        if (resource && app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs([resource.id], this.props.node.id)
    }

    private renderLabels(value: any): React.ReactNode {
        if (!value || typeof value !== 'object' || !Object.keys(value).length) return translate('kubernetesNone')
        return <span className="netdive-k8s-namespace-detail__labels">{Object.keys(value).sort().map(key => <span key={key}>
            <strong title={key}>{key}</strong>
            <span title={stringify(value[key])}>{stringify(value[key])}</span>
        </span>)}</span>
    }

    private eventCandidates(detail: any): any[] {
        const sources = [
            detail.events,
            detail.recentEvents,
            detail.namespaceEvents,
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

    private importantEventGroups(detail: any): NamespaceEventGroup[] {
        const groups = new Map<string, NamespaceEventGroup>()
        this.eventCandidates(detail).forEach(event => {
            const reason = firstValue(event, ['reason', 'Reason'])
            const normalizedReason = reason.toLowerCase()
            if (!IMPORTANT_EVENT_REASONS.has(normalizedReason)) return
            const resourceKind = firstValue(event, ['involvedObject.kind', 'InvolvedObject.Kind', 'regarding.kind', 'Regarding.Kind']) || translate('kubernetesResource')
            const resourceName = firstValue(event, ['involvedObject.name', 'InvolvedObject.Name', 'regarding.name', 'Regarding.Name']) || translate('kubernetesUnknown')
            const countValue = firstRaw(event, ['count', 'Count', 'series.count', 'Series.Count'])
            const count = Math.max(1, Number(countValue || 1))
            const time = this.eventTime(event)
            const key = `${normalizedReason}:${resourceKind.toLowerCase()}:${resourceName}`
            const existing = groups.get(key)
            if (!existing) {
                groups.set(key, { reason, tone: CRITICAL_EVENT_REASONS.has(normalizedReason) ? 'danger' : 'warning', resourceKind, resourceName, count, time })
                return
            }
            existing.count += count
            const existingTime = new Date(existing.time || 0).getTime()
            const nextTime = new Date(time || 0).getTime()
            if (!Number.isNaN(nextTime) && (Number.isNaN(existingTime) || nextTime > existingTime)) existing.time = time
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

    private renderImportantEvents(detail: any): React.ReactNode {
        const groups = this.importantEventGroups(detail)
        if (!groups.length) return <DetailEmpty description={translate('kubernetesNamespaceNoImportantEvents')} compact />
        return <div className="netdive-k8s-namespace-detail__events">{groups.map(group => <div key={`${group.reason}:${group.resourceKind}:${group.resourceName}`} className={`is-${group.tone}`}>
            <span className="netdive-k8s-namespace-detail__event-dot" />
            <div className="netdive-k8s-namespace-detail__event-main">
                <div><strong>{group.reason}</strong><DetailBadge tone={group.tone}>{group.tone === 'danger' ? translate('kubernetesHealthCritical') : translate('kubernetesHealthWarning')}</DetailBadge></div>
                <span>{group.resourceKind}: {group.resourceName}</span>
                <small>{translate('kubernetesEventOccurrenceCount').replace('{count}', String(group.count))}</small>
            </div>
            <time title={String(group.time || '')}>{this.relativeEventTime(group.time)}</time>
        </div>)}</div>
    }

    render() {
        const detail = this.state.detail || {}
        const data = this.props.node.data || {}
        const problemCount = detail.problemPods === undefined
            ? undefined
            : Array.isArray(detail.problemPods) ? detail.problemPods.length : Number(detail.problemPods)
        const endpointUnavailable = detail.endpointUnavailableServiceCount
        const terminating = !!detail.terminating || String(detail.phase || '').toLowerCase() === 'terminating'
        const hasProblem = terminating
            || Number(detail.pendingPodCount || 0) > 0
            || Number(detail.failedPodCount || 0) > 0
            || Number(detail.crashLoopPodCount || 0) > 0
            || Number(detail.oomKilledPodCount || 0) > 0
            || Number(endpointUnavailable || 0) > 0
        const statusKnown = !!detail.phase
        const statusTone = terminating ? 'danger' : hasProblem ? 'warning' : statusKnown ? 'success' : 'default'
        const statusLabel = terminating
            ? translate('kubernetesHealthCritical')
            : hasProblem ? translate('kubernetesHealthWarning') : statusKnown ? translate('kubernetesHealthNormal') : translate('kubernetesHealthUnknown')
        const conclusion = terminating
            ? translate('kubernetesNamespaceTerminatingConclusion')
            : Number(endpointUnavailable || 0) > 0 ? translate('kubernetesNamespaceEndpointImpact').replace('{count}', String(endpointUnavailable))
            : Number(problemCount || 0) > 0 ? translate('kubernetesNamespaceProblemConclusion').replace('{count}', String(problemCount))
            : statusKnown ? translate('kubernetesNamespaceNoCurrentImpact') : translate('kubernetesNamespaceStatusUnavailable')
        const resourceValues = [detail.cpuRequests, detail.cpuLimits, detail.memoryRequests, detail.memoryLimits]
        const resourcesExplicitlyEmpty = resourceValues.every(quantityIsPresent) && !resourceValues.some(quantityIsPositive)
        const placementConcentrated = detail.scheduledNodeCount !== undefined && Number(detail.scheduledNodeCount) <= 1 && Number(detail.runningPodCount || 0) > 1
        const placementKnown = detail.scheduledNodeCount !== undefined && Number(detail.runningPodCount || 0) > 0
        const placementLabel = placementKnown
            ? placementConcentrated ? <DetailBadge tone="warning">{translate('kubernetesConcentrated')}</DetailBadge> : translate('kubernetesDistributed')
            : translate('kubernetesEvaluationUnavailable')
        const placementDescription = placementKnown
            ? placementConcentrated ? translate('kubernetesNamespacePlacementConcentratedDescription') : translate('kubernetesNamespacePlacementDistributedDescription')
            : ''
        const availabilityRows = [
            { label: translate('kubernetesScheduledNodes'), value: optionalNumber(detail.scheduledNodeCount) },
            { label: translate('kubernetesEndpointUnavailableServices'), value: optionalNumber(endpointUnavailable) },
            { label: translate('kubernetesNamespacePlacement'), value: placementDescription ? <Tooltip title={placementDescription} placement="top"><span className="netdive-k8s-namespace-detail__placement">{placementLabel}</span></Tooltip> : placementLabel }
        ]
        const name = detail.name || firstValue(data, ['Name', 'K8s.Name']) || this.props.node.id
        const basicRows = [
            { label: translate('kubernetesNamespaceName'), value: name, textValue: name, copyText: name },
            { label: translate('kubernetesNamespacePhase'), value: detail.phase || translate('kubernetesNotCollected') },
            { label: translate('kubernetesLabels'), value: this.renderLabels(detail.labels) }
        ]
        return <div className="netdive-k8s-node-detail netdive-k8s-namespace-detail">
            <DetailSection icon={<InfoIcon />} title={translate('kubernetesNamespaceBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <DetailKeyValueList rows={basicRows} copyTooltip={translate('copy')} />
            </DetailSection>

            <DetailSection icon={this.topologyIcon(this.props.node)} title={translate('kubernetesNamespaceOperationalStatus')}>
                <div className={`netdive-k8s-node-detail__hero netdive-k8s-node-detail__hero--${statusTone}`}><i /><strong>{statusLabel}</strong><span>{conclusion}</span></div>
                <div className="netdive-k8s-node-detail__summary netdive-k8s-namespace-detail__status-summary">
                    <div><span>{translate('kubernetesProblemPods')}</span><strong className={Number(problemCount || 0) > 0 ? 'is-danger' : ''}>{optionalNumber(problemCount)}</strong></div>
                    <div><span>{translate('kubernetesAffectedServices')}</span><strong className={Number(endpointUnavailable || 0) > 0 ? 'is-danger' : ''}>{optionalNumber(endpointUnavailable)}</strong></div>
                    <div><span>{translate('kubernetesDataCollectionStatus')}</span><strong className="netdive-k8s-namespace-detail__collection-status">{this.state.loading ? translate('loading') : this.state.error ? translate('kubernetesTopologyFallbackStatus') : translate('kubernetesCollected')}</strong></div>
                </div>
            </DetailSection>

            <DetailSection icon={<LinkIcon />} title={translate('kubernetesNamespaceAvailability')}><DetailKeyValueList rows={availabilityRows} /></DetailSection>

            <DetailSection icon={<DnsIcon />} title={translate('kubernetesNamespaceWorkloads')}>
                <div className="netdive-k8s-node-detail__metric-rows">
                    {[
                        [translate('kubernetesRunningPods'), detail.runningPodCount, 'default'],
                        ['Pending', detail.pendingPodCount, Number(detail.pendingPodCount || 0) > 0 ? 'warning' : 'default'],
                        ['Failed', detail.failedPodCount, Number(detail.failedPodCount || 0) > 0 ? 'danger' : 'default'],
                        ['CrashLoopBackOff', detail.crashLoopPodCount, Number(detail.crashLoopPodCount || 0) > 0 ? 'danger' : 'default'],
                        ['OOMKilled', detail.oomKilledPodCount, Number(detail.oomKilledPodCount || 0) > 0 ? 'danger' : 'default'],
                        [translate('kubernetesTopologyServices'), detail.serviceCount, 'default']
                    ].map((item: any[]) => <div key={item[0]} className={`is-${item[2]}`}><span>{item[0]}</span><strong>{optionalNumber(item[1])}</strong></div>)}
                </div>
                {Array.isArray(detail.problemPods) && detail.problemPods.length > 0 && <div className="netdive-k8s-node-detail__problem-list-title">{translate('kubernetesProblemPods')}</div>}
                {Array.isArray(detail.problemPods) && detail.problemPods.length > 0 && <DetailResourceGrid compact>{detail.problemPods.map((pod: any) => <DetailResourceCard key={pod.uid} label={pod.name} value="" icon={<AccountTreeIcon />} iconTone="kubernetes" interactive onClick={() => this.focusResource(pod.uid)} />)}</DetailResourceGrid>}
            </DetailSection>

            <DetailSection icon={<HistoryOutlined />} title={translate('kubernetesNamespaceRecentEvents')}>{this.renderImportantEvents(detail)}</DetailSection>

            <DetailSection icon={<StorageIcon />} title={translate('kubernetesNamespaceResourcePolicy')}>{resourcesExplicitlyEmpty ? <DetailEmpty description={translate('kubernetesNamespaceResourcePolicyEmpty')} compact /> : <div className="netdive-k8s-namespace-detail__resources">
                <div><strong>CPU</strong><dl><div><dt>Requests</dt><dd>{displayQuantity(detail.cpuRequests)}</dd></div><div><dt>Limits</dt><dd>{displayQuantity(detail.cpuLimits)}</dd></div></dl></div>
                <div><strong>{translate('kubernetesMemory')}</strong><dl><div><dt>Requests</dt><dd>{displayQuantity(detail.memoryRequests, true)}</dd></div><div><dt>Limits</dt><dd>{displayQuantity(detail.memoryLimits, true)}</dd></div></dl></div>
            </div>}</DetailSection>

            {this.state.error && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesNamespaceDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesNamespaceDetailPanel
