import * as React from 'react'
import { Button, Table, Tabs } from 'antd'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import DnsIcon from '@material-ui/icons/Dns'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'
import LinkIcon from '@material-ui/icons/Link'
import { HistoryOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { aggregatePods, getPodClassification } from '../KubernetesPodLifecycle'
import {
    BasicInfoRows,
    classifyKubernetesPod,
    collectKubernetesEventGroups,
    CompactEmptyState,
    ConnectedResourceListSection,
    DetailAdvancedInfo,
    DetailBadgeTone,
    DetailLayerIcon,
    DetailMetricRow,
    DetailModalResourceCell,
    DetailModalTextCell,
    DetailSectionCard,
    DetailStatusIndicator,
    HistoryModal,
    KubernetesEventGroup,
    KubernetesRecentEvents,
    KubernetesStateSeparation,
    RelatedResourceGrid,
    ResourceMetricBlock,
    StatusEvidenceList,
    StatusEvidenceRow,
    StatusSummaryGrid,
    summarizeKubernetesPods
} from './common'
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
    basicInfoAdvanced: boolean
    podModal: NamespacePodModalKey
    activeDetailTab: 'overview' | 'workloads' | 'pods' | 'services' | 'ingress' | 'configuration' | 'storage'
}

type NamespacePodModalKey = '' | 'problem' | 'pending' | 'crashloop' | 'oom-killed'

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
const IMPORTANT_EVENT_REASONS = new Set([
    'failedscheduling', 'crashloopbackoff', 'backoff', 'oomkilled',
    'failedmount', 'imagepullbackoff', 'errimagepull', 'evicted'
])
const IMPORTANT_EVENT_TONES = Array.from(IMPORTANT_EVENT_REASONS).reduce((tones, reason) => {
    tones[reason] = 'warning'
    return tones
}, {} as Record<string, 'warning'>)

class KubernetesNamespaceDetailPanel extends React.Component<Props, State> {
    state: State = {
        loading: false,
        error: false,
        requestKey: '',
        basicCollapsed: false,
        basicInfoAdvanced: false,
        podModal: '',
        activeDetailTab: 'overview'
    }

    componentDidMount() { this.loadDetail() }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id || this.clusterFrom(prevProps)?.id !== this.cluster()?.id) {
            this.setState({ basicCollapsed: false, basicInfoAdvanced: false, podModal: '', activeDetailTab: 'overview' })
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

    private namespaceResources(type: string): Node[] {
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
        const podAggregate = aggregatePods(pods, { namespace: name })
        const activePods = podAggregate.activeEntries.map(entry => entry.node)
        const scheduledNodes = new Set<string>()
        activePods.forEach(pod => {
            const podData = pod.data || {}
            const podState = getPodClassification(pod)
            const nodeName = firstValue(podData, ['K8s.Extra.Spec.NodeName', 'K8s.Node', 'NodeName'])
            if (nodeName && podState.runningPod) scheduledNodes.add(nodeName)
        })
        return {
            uid: objectMeta.UID || this.props.node.id,
            name,
            phase: status.Phase || firstValue(data, ['K8s.Status', 'Status']),
            createdAt: objectMeta.CreationTimestamp?.Time,
            labels: data.K8s?.Labels || objectMeta.Labels || {},
            terminating: !!objectMeta.DeletionTimestamp,
            podCount: podAggregate.current,
            serviceCount: services.length,
            runningPodCount: podAggregate.running,
            pendingPodCount: podAggregate.activeEntries.filter(entry => getPodClassification(entry.node).pendingPod).length,
            failedPodCount: 0,
            crashLoopPodCount: podAggregate.activeEntries.filter(entry => getPodClassification(entry.node).problemReasons.indexOf('crashloopbackoff') >= 0).length,
            oomKilledPodCount: podAggregate.activeEntries.filter(entry => getPodClassification(entry.node).problemReasons.indexOf('oomkilled') >= 0).length,
            scheduledNodeCount: scheduledNodes.size,
            problemPods: podAggregate.currentProblemEntries.map(entry => ({ uid: entry.node.id, name: entry.podName })),
            source: 'TOPOLOGY'
        }
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        if (attrs.href) return <img className="netdive-detail-topology-icon-image" src={attrs.href} alt="" />
        return <span className={`netdive-detail-topology-icon ${attrs.iconClass || ''}`} aria-hidden="true">{attrs.icon}</span>
    }

    private focusResource(uid: string) {
        const resource = this.topologyNodes().find(node => node.id === uid || firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) === uid)
        const app = (window as any).App
        if (resource && app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs([resource.id], this.props.node.id, true)
    }

    private focusResources(resources: Node[]) {
        const app = (window as any).App
        const ids = resources.map(resource => resource.id)
        if (ids.length && app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs(ids, this.props.node.id, true)
    }

    private openResourceDetail(resource: Node) {
        const app = (window as any).App
        if (app && typeof app.openResourceDetailNodeID === 'function') app.openResourceDetailNodeID(resource.id)
    }

    private resourceTabNodes(tab: State['activeDetailTab']): Node[] {
        if (tab === 'workloads') return ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob']
            .reduce((items, type) => items.concat(this.namespaceResources(type)), [] as Node[])
        if (tab === 'pods') return aggregatePods(this.namespaceResources('pod')).activeEntries.map(entry => entry.node)
        if (tab === 'services') return this.namespaceResources('service')
        if (tab === 'ingress') return this.namespaceResources('ingress')
        if (tab === 'configuration') return this.namespaceResources('configmap').concat(this.namespaceResources('secret'))
        if (tab === 'storage') return this.namespaceResources('persistentvolumeclaim')
        return []
    }

    private renderResourceTab(tab: State['activeDetailTab']) {
        const nodes = this.resourceTabNodes(tab)
        const labels: Record<string, string> = {
            workloads: '워크로드',
            pods: 'Pod',
            services: 'Service',
            ingress: 'Ingress',
            configuration: '설정',
            storage: '스토리지'
        }
        const executionTypes = new Set(['deployment', 'statefulset', 'daemonset', 'job', 'cronjob', 'pod'])
        return <ConnectedResourceListSection
            icon={<AccountTreeIcon />}
            title={`${labels[tab] || tab} ${nodes.length}`}
            emptyText={`수집된 ${labels[tab] || tab} 자원이 없습니다.`}
            groups={[{
                key: tab,
                title: labels[tab] || tab,
                items: nodes
                    .slice()
                    .sort((left, right) => firstValue(left.data || {}, ['Name', 'K8s.Name']).localeCompare(firstValue(right.data || {}, ['Name', 'K8s.Name'])))
                    .map(node => {
                        const type = String(node.data?.Type || '').toLowerCase()
                        const name = firstValue(node.data || {}, ['Name', 'K8s.Name']) || node.id
                        const showKind = tab === 'workloads' || tab === 'configuration' || tab === 'storage'
                        return {
                            key: node.id,
                            kind: showKind ? type : undefined,
                            name,
                            icon: this.topologyIcon(node),
                            tooltip: name,
                            onClick: executionTypes.has(type) ? () => this.focusResources([node]) : () => this.openResourceDetail(node)
                        }
                    })
            }]} />
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

    private importantEventGroups(detail: any): KubernetesEventGroup[] {
        return collectKubernetesEventGroups([this.eventCandidates(detail)], IMPORTANT_EVENT_TONES)
    }

    private focusEventResource(group: KubernetesEventGroup) {
        const target = this.topologyNodes().find(node => {
            const uid = firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID'])
            if (group.resourceUid && (node.id === group.resourceUid || uid === group.resourceUid)) return true
            return !!group.resourceKind
                && String(node.data?.Type || '').toLowerCase() === group.resourceKind.toLowerCase()
                && firstValue(node.data || {}, ['Name', 'K8s.Name']) === group.resourceName
        })
        if (target) this.focusResources([target])
    }

    private renderImportantEvents(detail: any): React.ReactNode {
        return <KubernetesRecentEvents
            groups={this.importantEventGroups(detail)}
            emptyText={translate('kubernetesNamespaceNoImportantEvents')}
            onResourceClick={group => this.focusEventResource(group)}
        />
    }

    render() {
        const detail = this.state.detail || {}
        const data = this.props.node.data || {}
        const connectedPods = this.namespaceResources('pod')
        const activeConnectedPods = aggregatePods(connectedPods).activeEntries.map(entry => entry.node)
        const podStatus = summarizeKubernetesPods(connectedPods)
        const problemCount = podStatus.activeProblems.length
        const endpointUnavailable = detail.endpointUnavailableServiceCount
        const terminating = !!detail.terminating || String(detail.phase || '').toLowerCase() === 'terminating'
        const hasProblem = terminating || problemCount > 0 || Number(endpointUnavailable || 0) > 0
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
            ? placementConcentrated ? translate('kubernetesConcentrated') : translate('kubernetesDistributed')
            : translate('kubernetesEvaluationUnavailable')
        const placementDescription = placementKnown
            ? placementConcentrated ? translate('kubernetesNamespacePlacementConcentratedDescription') : translate('kubernetesNamespacePlacementDistributedDescription')
            : ''
        const name = detail.name || firstValue(data, ['Name', 'K8s.Name']) || this.props.node.id
        const connectedServices = this.namespaceResources('service')
        const connectedClaims = this.namespaceResources('persistentvolumeclaim')
        const connectedWorkloads = ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].reduce((items, type) => items.concat(this.namespaceResources(type)), [] as Node[])
        const basicRows = [
            { label: translate('kubernetesNamespaceName'), value: name, textValue: name, copyText: name },
            { label: translate('kubernetesNamespacePhase'), value: detail.phase || translate('kubernetesNotCollected') }
        ]
        const advancedRows = [
            { label: translate('kubernetesLabels'), value: this.renderLabels(detail.labels) }
        ]
        const namespaceEventGroups = this.importantEventGroups(detail)
        const recentNamespaceEventGroups = namespaceEventGroups.filter(group => {
            const time = new Date(group.time || 0).getTime()
            return !Number.isNaN(time) && time > 0 && time >= Date.now() - 24 * 60 * 60 * 1000
        })
        const recentEventCount = recentNamespaceEventGroups.reduce((count, group) => count + group.count, 0)
        const recentInstabilityKnown = podStatus.timestampAvailable && (namespaceEventGroups.length === 0 || namespaceEventGroups.some(group => {
            const time = new Date(group.time || 0).getTime()
            return !Number.isNaN(time) && time > 0
        }))
        const pendingPods = activeConnectedPods.filter(pod => getPodClassification(pod).pendingPod)
        const crashLoopPods = podStatus.activeProblems.filter(pod => classifyKubernetesPod(pod).activeReason.toLowerCase() === 'crashloopbackoff')
        const currentOOMKilledPods = activeConnectedPods.filter(pod => getPodClassification(pod).problemReasons.indexOf('oomkilled') >= 0)
        const crashLoopCount = crashLoopPods.length
        const collectionStatus = this.state.loading
            ? translate('loading')
            : this.state.error ? translate('kubernetesTopologyFallbackStatus') : translate('kubernetesCollected')
        const scheduledNodeKnown = detail.scheduledNodeCount !== undefined
        const scheduledNodeTone: DetailBadgeTone = !scheduledNodeKnown
            ? 'default'
            : placementConcentrated ? 'warning' : 'success'
        const endpointTone: DetailBadgeTone = endpointUnavailable === undefined
            ? 'default'
            : Number(endpointUnavailable || 0) > 0 ? 'danger' : 'success'
        const placementTone: DetailBadgeTone = !placementKnown
            ? 'default'
            : placementConcentrated ? 'warning' : 'success'
        const statusText = (tone: DetailBadgeTone) => tone === 'danger'
            ? translate('kubernetesHealthCritical')
            : tone === 'warning'
                ? '보완 권장'
                : tone === 'success'
                    ? translate('kubernetesHealthNormal')
                    : translate('kubernetesHealthUnknown')
        const podModalConfigs: Record<Exclude<NamespacePodModalKey, ''>, { title: string, data: Node[], count: number }> = {
            problem: { title: translate('kubernetesProblemPods'), data: podStatus.activeProblems, count: problemCount },
            pending: { title: 'Pending Pod', data: pendingPods, count: podStatus.pending },
            crashloop: { title: 'CrashLoopBackOff Pod', data: crashLoopPods, count: crashLoopCount },
            'oom-killed': { title: '현재 OOMKilled Pod', data: currentOOMKilledPods, count: Number(detail.oomKilledPodCount || 0) }
        }
        const podModal = this.state.podModal ? podModalConfigs[this.state.podModal] : undefined
        const podModalColumns = [
            {
                title: 'Pod',
                key: 'pod',
                width: '52%',
                render: (_value: any, pod: Node) => <DetailModalResourceCell
                    namespace={name}
                    name={firstValue(pod.data || {}, ['Name', 'K8s.Name']) || pod.id}
                />
            },
            {
                title: '상태',
                key: 'status',
                width: '24%',
                render: (_value: any, pod: Node) => <DetailModalTextCell
                    value={classifyKubernetesPod(pod).activeReason || getPodClassification(pod).phase || translate('kubernetesHealthUnknown')}
                />
            },
            {
                title: '',
                key: 'action',
                width: '24%',
                align: 'right' as const,
                render: (_value: any, pod: Node) => <Button type="link" size="small" onClick={() => this.focusResources([pod])}>강조</Button>
            }
        ]

        return <div className="netdive-k8s-namespace-detail">
            <Tabs
                className="netdive-k8s-namespace-detail__navigation"
                activeKey={this.state.activeDetailTab}
                onChange={activeDetailTab => this.setState({ activeDetailTab: activeDetailTab as State['activeDetailTab'] })}>
                <Tabs.TabPane tab="개요" key="overview" />
                <Tabs.TabPane tab="워크로드" key="workloads" />
                <Tabs.TabPane tab="Pod" key="pods" />
                <Tabs.TabPane tab="Service" key="services" />
                <Tabs.TabPane tab="Ingress" key="ingress" />
                <Tabs.TabPane tab="설정" key="configuration" />
                <Tabs.TabPane tab="스토리지" key="storage" />
            </Tabs>
            {this.state.activeDetailTab === 'overview' ? <React.Fragment>
            <DetailSectionCard icon={<InfoIcon />} title={translate('kubernetesNamespaceBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <BasicInfoRows density="compact" rows={basicRows} labelWidth={122} copyTooltip={translate('copy')} />
                <DetailAdvancedInfo
                    title={translate('kubernetesAdvancedInformation')}
                    active={this.state.basicInfoAdvanced}
                    onChange={basicInfoAdvanced => this.setState({ basicInfoAdvanced })}>
                    <BasicInfoRows density="compact" rows={advancedRows} labelWidth={122} copyTooltip={translate('copy')} />
                </DetailAdvancedInfo>
            </DetailSectionCard>

            <DetailSectionCard icon={this.topologyIcon(this.props.node)} title={translate('kubernetesNamespaceOperationalStatus')}>
                <StatusSummaryGrid
                    verdict={statusLabel}
                    verdictTone={statusTone}
                    rawStatus={detail.phase || translate('kubernetesNotCollected')}
                    rawStatusLabel={translate('kubernetesNamespacePhase')}
                    impact={conclusion}
                    metrics={[
                        {
                            key: 'problem-pods',
                            label: translate('kubernetesProblemPods'),
                            value: optionalNumber(problemCount),
                            tone: Number(problemCount || 0) > 0 ? 'danger' : 'default',
                            tooltip: '현재 네임스페이스의 활성 Pod 중 비정상 상태로 판정된 Pod 수입니다.',
                            onClick: podStatus.activeProblems.length ? () => this.setState({ podModal: 'problem' }) : undefined
                        },
                        {
                            key: 'affected-services',
                            label: translate('kubernetesAffectedServices'),
                            value: optionalNumber(endpointUnavailable),
                            tone: Number(endpointUnavailable || 0) > 0 ? 'danger' : 'default',
                            tooltip: '사용 가능한 Endpoint가 없어 현재 영향을 받을 수 있는 Service 수입니다.'
                        },
                        {
                            key: 'collection',
                            label: translate('kubernetesDataCollectionStatus'),
                            value: collectionStatus,
                            tone: this.state.error ? 'warning' : 'default',
                            tooltip: '현재 네임스페이스 상세 데이터의 수집 상태입니다.'
                        }
                    ]}
                />
                <KubernetesStateSeparation items={[
                    { key: 'current', label: '현재 문제', value: problemCount + Number(endpointUnavailable || 0), tone: problemCount + Number(endpointUnavailable || 0) > 0 ? 'danger' : 'success', tooltip: '현재 Pending·Unknown·활성 컨테이너 오류와 Endpoint 손실만 반영합니다.' },
                    { key: 'recent', label: '최근 불안정성', value: recentInstabilityKnown ? podStatus.recentEvicted.length + recentEventCount : '확인 불가', tone: recentInstabilityKnown ? (podStatus.recentEvicted.length + recentEventCount > 0 ? 'warning' : 'success') : 'default', tooltip: '최근 24시간의 Kubernetes Event와 Eviction 이력입니다.' },
                    { key: 'history', label: '누적 이력', value: `Evicted ${podStatus.evicted.length}`, tone: 'history', tooltip: '누적 Evicted 파드는 현재 운영 상태에서 제외합니다.' }
                ]} />
            </DetailSectionCard>

            <DetailSectionCard icon={<LinkIcon />} title={translate('kubernetesNamespaceAvailability')}>
                <StatusEvidenceList>
                    <StatusEvidenceRow
                        title={translate('kubernetesScheduledNodes')}
                        evidence={placementDescription || '실행 중인 Pod가 배치된 고유 노드 수입니다.'}
                        state={<DetailStatusIndicator tone={scheduledNodeTone}>{statusText(scheduledNodeTone)}</DetailStatusIndicator>}
                        value={optionalNumber(detail.scheduledNodeCount)}
                        tone={scheduledNodeTone}
                    />
                    <StatusEvidenceRow
                        title={translate('kubernetesEndpointUnavailableServices')}
                        evidence="사용 가능한 Endpoint가 없는 Service 수입니다."
                        state={<DetailStatusIndicator tone={endpointTone}>{statusText(endpointTone)}</DetailStatusIndicator>}
                        value={optionalNumber(endpointUnavailable)}
                        tone={endpointTone}
                    />
                    <StatusEvidenceRow
                        title={translate('kubernetesNamespacePlacement')}
                        evidence={placementDescription || '실행 중인 Pod의 노드 분산 상태입니다.'}
                        state={<DetailStatusIndicator tone={placementTone}>{statusText(placementTone)}</DetailStatusIndicator>}
                        value={placementLabel}
                        valueVariant="grade"
                        tone={placementTone}
                    />
                </StatusEvidenceList>
            </DetailSectionCard>

            <DetailSectionCard icon={<ErrorOutlineIcon />} title={translate('kubernetesNamespaceWorkloads')}>
                <StatusEvidenceList>
                    {[
                        [translate('kubernetesRunningPods'), podStatus.running, 'success', '현재 정상 실행 중인 활성 Pod 수입니다.', ''],
                        ['Pending Pod', podStatus.pending, podStatus.pending > 0 ? 'danger' : 'success', '아직 실행 단계에 도달하지 못한 활성 Pod 수입니다.', 'pending'],
                        ['CrashLoopBackOff Pod', crashLoopCount, crashLoopCount > 0 ? 'danger' : 'success', '반복적으로 컨테이너 시작에 실패한 활성 Pod 수입니다.', 'crashloop'],
                        ['현재 OOMKilled Pod', detail.oomKilledPodCount, Number(detail.oomKilledPodCount || 0) > 0 ? 'warning' : 'success', '현재 또는 직전 컨테이너 종료 상태가 OOMKilled인 Pod 수입니다.', 'oom-killed']
                    ].map((item: any[]) => {
                        const tone = item[2] as DetailBadgeTone
                        return <StatusEvidenceRow
                            key={item[0]}
                            title={item[0]}
                            evidence={item[3]}
                            state={<DetailStatusIndicator tone={tone}>{statusText(tone)}</DetailStatusIndicator>}
                            value={optionalNumber(item[1])}
                            tone={tone}
                            onClick={item[4] ? () => this.setState({ podModal: item[4] as NamespacePodModalKey }) : undefined}
                        />
                    })}
                </StatusEvidenceList>
            </DetailSectionCard>

            <DetailSectionCard icon={<DnsIcon />} title={translate('kubernetesNamespaceResourcePolicy')}>
                {resourcesExplicitlyEmpty
                    ? <CompactEmptyState description={translate('kubernetesNamespaceResourcePolicyEmpty')} compact />
                    : <div className="netdive-k8s-namespace-detail__resource-policy">
                        <ResourceMetricBlock title="CPU">
                            <DetailMetricRow label="Requests" value={displayQuantity(detail.cpuRequests)} ratio="" />
                            <DetailMetricRow label="Limits" value={displayQuantity(detail.cpuLimits)} ratio="" muted />
                        </ResourceMetricBlock>
                        <ResourceMetricBlock title={translate('kubernetesMemory')}>
                            <DetailMetricRow label="Requests" value={displayQuantity(detail.memoryRequests, true)} ratio="" />
                            <DetailMetricRow label="Limits" value={displayQuantity(detail.memoryLimits, true)} ratio="" muted />
                        </ResourceMetricBlock>
                    </div>}
            </DetailSectionCard>

            <RelatedResourceGrid
                icon={<AccountTreeIcon />}
                title={translate('hostConnectedResources')}
                emptyText={translate('hostNoConnectedResources')}
                groups={[
                    {
                        key: 'kubernetes',
                        title: translate('kubernetesConnectedResourceGroup'),
                        icon: <img src="assets/icons/k8s.png" alt="" />,
                        items: [
                        ...(connectedWorkloads.length ? [{ key: 'workloads', label: translate('kubernetesTopologyWorkloadControllers'), count: connectedWorkloads.length, icon: <DetailLayerIcon glyph={'\uf5fd'} />, iconTone: 'kubernetes' as const, onClick: () => this.focusResources(connectedWorkloads) }] : []),
                        ...(activeConnectedPods.length ? [{ key: 'pods', label: translate('kubernetesTopologyPods'), count: activeConnectedPods.length, icon: this.topologyIcon(activeConnectedPods[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(activeConnectedPods) }] : []),
                        ...(connectedServices.length ? [{ key: 'services', label: translate('kubernetesTopologyServices'), count: connectedServices.length, icon: this.topologyIcon(connectedServices[0]), iconTone: 'kubernetes' as const, onClick: () => this.setState({ activeDetailTab: 'services' }) }] : [])
                        ]
                    },
                    ...(connectedClaims.length ? [{
                        key: 'storage',
                        title: '스토리지',
                        icon: <DetailLayerIcon glyph={'\uf1c0'} />,
                        items: [{ key: 'pvcs', label: 'PVC', count: connectedClaims.length, icon: this.topologyIcon(connectedClaims[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(connectedClaims), tooltip: 'PersistentVolumeClaim (PVC)' }]
                    }] : [])
                ]} />

            <DetailSectionCard icon={<HistoryOutlined />} title={translate('kubernetesNamespaceRecentEvents')}>{this.renderImportantEvents(detail)}</DetailSectionCard>
            </React.Fragment> : this.renderResourceTab(this.state.activeDetailTab)}

            <HistoryModal
                visible={!!podModal}
                title={podModal ? `${podModal.title} ${podModal.count}개` : ''}
                width={680}
                onCancel={() => this.setState({ podModal: '' })}>
                {podModal && podModal.data.length > 0
                    ? <Table
                        className="netdive-modal-table"
                        columns={podModalColumns}
                        dataSource={podModal.data}
                        rowKey={(pod: Node) => pod.id}
                        pagination={false}
                        size="small"
                    />
                    : podModal && <CompactEmptyState
                        description={podModal.count > 0
                            ? '집계 결과는 있으나 연결된 Pod를 현재 토폴로지에서 확인할 수 없습니다.'
                            : '해당 조건에 해당하는 Pod가 없습니다.'}
                        compact />}
            </HistoryModal>

            {this.state.error && <div className="netdive-detail-notice"><InfoIcon /><span>{translate('kubernetesNamespaceDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-detail-notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesNamespaceDetailPanel
