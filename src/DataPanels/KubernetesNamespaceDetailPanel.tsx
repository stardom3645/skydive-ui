import * as React from 'react'
import { Button, Table } from 'antd'
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
import { kubernetesOperationalPodDataset, KUBERNETES_NODE_SIGNAL_WINDOW_MS } from '../KubernetesNodeDetailAggregation'
import {
    kubernetesNamespaceContainerResourceCoverage,
    kubernetesNamespaceDistribution,
    kubernetesNamespacePolicyCoverage,
    kubernetesNamespaceResourceCoverageFromDetail,
    kubernetesNamespaceWorkloadHealth,
    kubernetesResourceUID,
    uniqueKubernetesNamespaceResources
} from '../KubernetesNamespaceDetailAggregation'
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
    DetailMetaInfoRow,
    DetailMetadataSummary,
    DetailModalResourceCell,
    DetailModalTextCell,
    DetailNavigationTabs,
    DetailSectionCard,
    formatKubernetesValueState,
    HistoryModal,
    KubernetesMetadataRows,
    KubernetesEventGroup,
    KUBERNETES_DETAIL_LABELS,
    KubernetesRecentEvents,
    KubernetesResourceConfigurationCard,
    kubernetesCollectionPresentation,
    kubernetesNamespacePhaseLabel,
    kubernetesResourceConfigurationCoverageState,
    RelatedResourceGrid,
    ResourceMetricBlock,
    StatusEvidenceList,
    StatusEvidenceRow,
    StatusSummaryGrid,
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
    policyModal: '' | 'quota' | 'limitRange'
    activeDetailTab: 'overview' | 'workloads' | 'pods' | 'services' | 'ingress' | 'configuration' | 'storage'
}

type NamespacePodModalKey = '' | 'problem' | 'not-ready' | 'pending' | 'restart' | 'crashloop' | 'oom-killed'

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
const quantityIsPresent = (value: any): boolean => value !== undefined && value !== null && value !== ''
const displayDate = (value: any): string => {
    if (value === undefined || value === null || value === '') return translate('kubernetesNotCollected')
    const source = typeof value === 'object' && value.Time !== undefined ? value.Time : value
    const date = new Date(source)
    return Number.isNaN(date.getTime()) ? String(source) : date.toLocaleString()
}
const resourceMap = (resource: any, paths: string[]): Record<string, any> => {
    const value = firstRaw(resource?.data || resource || {}, paths)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
const pairValue = (used: any, hard: any, collected: boolean): string => {
    if (!collected) return '수집되지 않음'
    if (!quantityIsPresent(hard)) return '설정되지 않음'
    return `${quantityIsPresent(used) ? settingValue(used, true) : '0'} / ${settingValue(hard, true)}`
}
const mapValue = (value: Record<string, any>, keys: string[]): any => {
    for (const key of keys) if (value[key] !== undefined && value[key] !== null && value[key] !== '') return value[key]
    const normalizedKeys = keys.map(key => key.toLowerCase())
    for (const key of Object.keys(value || {})) if (normalizedKeys.indexOf(key.toLowerCase()) >= 0) return value[key]
    return undefined
}
const settingValue = (value: any, collected: boolean): string => {
    if (!collected) return '수집되지 않음'
    if (!quantityIsPresent(value)) return '설정되지 않음'
    return typeof value === 'object' && value.string !== undefined ? String(value.string) : String(value)
}
const uniqueNodes = (groups: Node[][]): Node[] => Array.from(groups.reduce((result, group) => {
    group.forEach(node => result.set(kubernetesResourceUID(node), node))
    return result
}, new Map<string, Node>()).values())
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
        policyModal: '',
        activeDetailTab: 'overview'
    }

    componentDidMount() { this.loadDetail() }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id || this.clusterFrom(prevProps)?.id !== this.cluster()?.id) {
            this.setState({ basicCollapsed: false, basicInfoAdvanced: false, podModal: '', policyModal: '', activeDetailTab: 'overview' })
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
        return uniqueKubernetesNamespaceResources(this.topologyNodes().filter(node => {
            const data = node.data || {}
            if (String(data.Manager || '').toLowerCase() !== 'k8s' || String(data.Type || '').toLowerCase() !== type) return false
            if (clusterName && firstValue(data, ['ClusterName', 'K8s.ClusterName']) !== clusterName) return false
            return firstValue(data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) === name
        }))
    }

    private detailFromTopology(): any {
        const data = this.props.node.data || {}
        const extra = firstRaw(data, ['K8s.Extra']) || {}
        const objectMeta = extra.ObjectMeta || {}
        const status = extra.Status || {}
        const name = firstValue(data, ['Name', 'K8s.Name']) || objectMeta.Name || this.props.node.id
        const pods = this.namespaceResources('pod')
        const services = this.namespaceResources('service')
        const podDataset = kubernetesOperationalPodDataset(pods)
        const activePods = podDataset.activePods
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
            annotations: data.K8s?.Annotations || objectMeta.Annotations || {},
            terminating: !!objectMeta.DeletionTimestamp,
            podCount: podDataset.activePods.length,
            serviceCount: services.length,
            runningPodCount: podDataset.runningPods.length,
            pendingPodCount: podDataset.pendingPods.length,
            failedPodCount: podDataset.failedPods.length,
            crashLoopPodCount: podDataset.crashLoopPods.length,
            oomKilledPodCount: podDataset.currentOOMKilledPods.length,
            scheduledNodeCount: scheduledNodes.size,
            problemPods: podDataset.problemPods.map(pod => ({ uid: pod.id, name: firstValue(pod.data || {}, ['Name', 'K8s.Name']) })),
            resourceQuotaCollected: this.namespaceResources('resourcequota').length > 0 ? true : undefined,
            resourceQuotaCount: this.namespaceResources('resourcequota').length,
            limitRangeCollected: this.namespaceResources('limitrange').length > 0 ? true : undefined,
            limitRangeCount: this.namespaceResources('limitrange').length,
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
        if (tab === 'configuration') return this.namespaceResources('configmap')
            .concat(this.namespaceResources('secret'))
            .concat(this.namespaceResources('resourcequota'))
            .concat(this.namespaceResources('limitrange'))
        if (tab === 'storage') return this.namespaceResources('persistentvolumeclaim')
        return []
    }

    private renderResourceTab(tab: State['activeDetailTab']) {
        const nodes = this.resourceTabNodes(tab)
        const labels: Record<string, string> = {
            workloads: '워크로드',
            pods: KUBERNETES_DETAIL_LABELS.pods,
            services: KUBERNETES_DETAIL_LABELS.services,
            ingress: 'Ingress',
            configuration: '정책 및 설정',
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

    private eventCandidates(detail: any): any[] {
        const sources = [
            detail.events,
            detail.recentEvents,
            detail.namespaceEvents,
            detail.kubernetesEvents,
            firstRaw(this.props.node.data || {}, ['K8s.Extra.Events', 'K8s.Events', 'Events'])
        ]
        const candidates: any[] = []
        for (const source of sources) {
            const events = Array.isArray(source) ? source : Array.isArray(source?.items) ? source.items : Array.isArray(source?.Items) ? source.Items : []
            events.forEach(event => candidates.push(event))
        }
        return candidates
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
        const cutoff = Date.now() - KUBERNETES_NODE_SIGNAL_WINDOW_MS
        const groups = this.importantEventGroups(detail).filter(group => {
            const time = new Date(group.time || 0).getTime()
            return !Number.isNaN(time) && time >= cutoff
        })
        return <KubernetesRecentEvents
            groups={groups}
            emptyText="최근 1시간 동안 발생한 중요 이벤트가 없습니다."
            onResourceClick={group => this.focusEventResource(group)}
        />
    }

    render() {
        const detail = this.state.detail || {}
        const data = this.props.node.data || {}
        const allTopologyNodes = this.topologyNodes()
        const connectedPods = this.namespaceResources('pod')
        const podDataset = kubernetesOperationalPodDataset(connectedPods)
        const activeConnectedPods = podDataset.activePods
        const name = detail.name || firstValue(data, ['Name', 'K8s.Name']) || this.props.node.id
        const connectedServices = this.namespaceResources('service')
        const connectedClaims = this.namespaceResources('persistentvolumeclaim')
        const connectedWorkloads = uniqueKubernetesNamespaceResources(['deployment', 'statefulset', 'daemonset', 'job', 'cronjob']
            .reduce((items, type) => items.concat(this.namespaceResources(type)), [] as Node[]))
        const workloadHealth = kubernetesNamespaceWorkloadHealth(connectedWorkloads)
        const problemResources = uniqueNodes([podDataset.problemPods, workloadHealth.unavailableWorkloads])
        const problemCount = problemResources.length
        const endpointUnavailable = detail.endpointUnavailableServiceCount === undefined
            ? connectedServices.length === 0 ? 0 : undefined
            : Number(detail.endpointUnavailableServiceCount)
        const normalizedPhase = String(detail.phase || '').toLowerCase()
        const terminating = !!detail.terminating || normalizedPhase === 'terminating'
        const hasProblem = terminating || problemCount > 0 || Number(endpointUnavailable || 0) > 0
        const statusKnown = normalizedPhase === 'active' || normalizedPhase === 'terminating'
        const statusTone = terminating ? 'danger' : hasProblem ? 'warning' : statusKnown ? 'success' : 'default'
        const statusLabel = terminating
            ? translate('kubernetesHealthCritical')
            : hasProblem ? translate('kubernetesHealthWarning') : statusKnown ? translate('kubernetesHealthNormal') : translate('kubernetesHealthUnknown')
        const impactAnalysisKnown = endpointUnavailable !== undefined
            && workloadHealth.evaluatedWorkloads.length === workloadHealth.workloads.length
        const conclusion = terminating
            ? translate('kubernetesNamespaceTerminatingConclusion')
            : Number(endpointUnavailable || 0) > 0 ? translate('kubernetesNamespaceEndpointImpact').replace('{count}', String(endpointUnavailable))
            : workloadHealth.unavailableWorkloads.length > 0 ? `현재 미가용 워크로드 ${workloadHealth.unavailableWorkloads.length}개가 확인됐습니다.`
            : impactAnalysisKnown ? '확인된 영향 없음' : '영향 분석 데이터 없음'
        const topologyResourceCoverage = kubernetesNamespaceContainerResourceCoverage(activeConnectedPods)
        const resourceCoverage = kubernetesNamespaceResourceCoverageFromDetail(detail.resourceConfiguration) || topologyResourceCoverage
        const scheduledNodeNames = new Set(activeConnectedPods.map(pod => firstValue(pod.data || {}, ['K8s.Extra.Spec.NodeName', 'K8s.Spec.NodeName', 'K8s.Node', 'NodeName'])).filter(Boolean))
        const clusterName = firstValue(data, ['ClusterName', 'K8s.ClusterName'])
        const availableNodeCount = uniqueKubernetesNamespaceResources(allTopologyNodes.filter(node => {
            if (String(node.data?.Manager || '').toLowerCase() !== 'k8s' || String(node.data?.Type || '').toLowerCase() !== 'node') return false
            return !clusterName || firstValue(node.data || {}, ['ClusterName', 'K8s.ClusterName']) === clusterName
        })).length
        const distribution = kubernetesNamespaceDistribution(connectedWorkloads, activeConnectedPods, allTopologyNodes, availableNodeCount)
        const distributionTone: DetailBadgeTone = distribution.concentratedWorkloads.length > 0 ? 'warning' : 'success'
        const quotaResources = this.namespaceResources('resourcequota')
        const limitRangeResources = this.namespaceResources('limitrange')
        const quotaCoverage = kubernetesNamespacePolicyCoverage(quotaResources, detail.resourceQuotaCollected, detail.resourceQuotas, detail.resourceQuotaCount)
        const limitRangeCoverage = kubernetesNamespacePolicyCoverage(limitRangeResources, detail.limitRangeCollected, detail.limitRanges, detail.limitRangeCount)
        const quotaCollected = quotaCoverage.collected
        const limitRangeCollected = limitRangeCoverage.collected
        const quotaCount = quotaCoverage.count
        const limitRangeCount = limitRangeCoverage.count
        const quotaConfigured = quotaCollected && quotaCount > 0
        const limitRangeConfigured = limitRangeCollected && limitRangeCount > 0
        const firstQuota = quotaResources[0] || (Array.isArray(detail.resourceQuotas) ? detail.resourceQuotas[0] : undefined)
        const quotaHard = firstQuota ? resourceMap(firstQuota, ['K8s.Extra.Status.Hard', 'K8s.Status.Hard', 'Status.Hard', 'status.hard', 'K8s.Extra.Spec.Hard', 'Spec.Hard', 'spec.hard', 'hard']) : {}
        const quotaUsed = firstQuota ? resourceMap(firstQuota, ['K8s.Extra.Status.Used', 'K8s.Status.Used', 'Status.Used', 'status.used', 'used']) : {}
        const firstLimitRange = limitRangeResources[0] || (Array.isArray(detail.limitRanges) ? detail.limitRanges[0] : undefined)
        const limitItems = firstLimitRange ? (firstRaw(firstLimitRange.data || firstLimitRange || {}, ['K8s.Extra.Spec.Limits', 'K8s.Spec.Limits', 'Spec.Limits', 'spec.limits', 'limits']) || []) : []
        const firstLimit = Array.isArray(limitItems) ? limitItems[0] || {} : {}
        const limitDefaultRequest = firstLimit.DefaultRequest || firstLimit.defaultRequest || {}
        const limitDefault = firstLimit.Default || firstLimit.default || {}
        const limitMin = firstLimit.Min || firstLimit.min || {}
        const limitMax = firstLimit.Max || firstLimit.max || {}
        const phaseLabel = kubernetesNamespacePhaseLabel(detail.phase)
        const basicRows = [
            { label: translate('kubernetesNamespaceName'), value: name, textValue: name, copyText: name },
            { label: KUBERNETES_DETAIL_LABELS.namespaceStatus, value: formatKubernetesValueState({ value: phaseLabel, collected: !!detail.phase }) },
            { label: translate('kubernetesCreatedAt'), value: displayDate(detail.createdAt) },
            { label: KUBERNETES_DETAIL_LABELS.resourceQuota, value: !quotaCollected ? '수집되지 않음' : quotaConfigured ? `설정됨 · ${quotaCount}개` : '설정되지 않음', labelWrap: true },
            { label: KUBERNETES_DETAIL_LABELS.limitRange, value: !limitRangeCollected ? '수집되지 않음' : limitRangeConfigured ? `설정됨 · ${limitRangeCount}개` : '설정되지 않음', labelWrap: true },
            { label: KUBERNETES_DETAIL_LABELS.labels, value: <DetailMetadataSummary value={detail.labels} excludedKeys={['kubernetes.io/metadata.name']} />, wrap: true },
            { label: KUBERNETES_DETAIL_LABELS.annotations, value: <DetailMetadataSummary value={detail.annotations} />, wrap: true }
        ]
        const namespaceEventGroups = this.importantEventGroups(detail)
        const recentNamespaceEventGroups = namespaceEventGroups.filter(group => {
            const time = new Date(group.time || 0).getTime()
            return !Number.isNaN(time) && time > 0 && time >= Date.now() - KUBERNETES_NODE_SIGNAL_WINDOW_MS
        })
        const recentTargetKeys = new Set<string>()
        uniqueNodes([podDataset.recentRestartPods, podDataset.crashLoopPods, podDataset.currentOOMKilledPods]).forEach(node => recentTargetKeys.add(kubernetesResourceUID(node)))
        recentNamespaceEventGroups.forEach(group => recentTargetKeys.add(group.resourceUid || `${group.resourceKind}:${group.resourceName || group.reason}`))
        const recentInstabilityCount = recentTargetKeys.size
        const historyPods = uniqueNodes([podDataset.evictedPods, podDataset.restartHistoryPods, podDataset.oomKilledHistoryPods])
        const historyCount = historyPods.length
        const detailEventFields = ['events', 'recentEvents', 'namespaceEvents', 'kubernetesEvents']
        const eventsCollected = detailEventFields.some(key => Object.prototype.hasOwnProperty.call(detail, key))
            || ['K8s.Extra.Events', 'K8s.Events', 'Events'].some(path => valueByPath(data, path) !== undefined)
        const usageMetricsCollected = detail.usageMetricsCollected === true
            || detail.metricsCollected === true
            || ['cpuUsage', 'memoryUsage', 'resourceUsage', 'usageMetrics'].some(key => detail[key] !== undefined && detail[key] !== null)
        const listCollected = (keys: string[]): boolean => keys.some(key => Array.isArray(detail[key]))
        const workloadCollected = detail.workloadCollected === true || listCollected(['workloads', 'deployments', 'statefulSets', 'daemonSets', 'jobs', 'cronJobs'])
        const podsCollected = detail.podCollected === true || listCollected(['pods'])
        const workloadObserved = connectedWorkloads.length > 0
        const podsObserved = connectedPods.length > 0
        const workloadPodCollectionState = workloadCollected && podsCollected
            ? 'collected'
            : workloadCollected || podsCollected || workloadObserved || podsObserved ? 'partial' : 'uncollected'
        const serviceCollectionState = detail.serviceCollected === true || listCollected(['services'])
            ? 'collected'
            : connectedServices.length > 0 ? 'partial' : 'uncollected'
        const requestsLimitsCollectionState = kubernetesResourceConfigurationCoverageState(resourceCoverage)
        const collection = kubernetesCollectionPresentation([
            { key: 'object', label: 'Kubernetes 객체', state: detail.phase ? 'collected' : 'uncollected' },
            { key: 'workloads-pods', label: KUBERNETES_DETAIL_LABELS.workloadsAndPods, state: workloadPodCollectionState },
            { key: 'services', label: KUBERNETES_DETAIL_LABELS.services, state: serviceCollectionState },
            { key: 'events', label: '이벤트', state: detail.eventsCollected === true || eventsCollected ? 'collected' : 'uncollected' },
            { key: 'requests-limits', label: 'Requests/Limits', state: requestsLimitsCollectionState },
            { key: 'usage', label: '사용량 메트릭', state: usageMetricsCollected ? 'collected' : 'uncollected' }
        ])
        const scheduledNodeTone: DetailBadgeTone = activeConnectedPods.length === 0 ? 'default' : 'success'
        const endpointTone: DetailBadgeTone = endpointUnavailable === undefined
            ? 'default'
            : Number(endpointUnavailable || 0) > 0 ? 'danger' : 'success'
        const statusText = (tone: DetailBadgeTone) => tone === 'danger'
            ? translate('kubernetesHealthCritical')
            : tone === 'warning'
                ? '보완 권장'
                : tone === 'success'
                    ? translate('kubernetesHealthNormal')
                    : translate('kubernetesHealthUnknown')
        const podModalConfigs: Record<Exclude<NamespacePodModalKey, ''>, { title: string, data: Node[], count: number }> = {
            problem: { title: translate('kubernetesProblemPods'), data: podDataset.problemPods, count: podDataset.problemPods.length },
            'not-ready': { title: KUBERNETES_DETAIL_LABELS.notReadyPods, data: podDataset.notReadyPods, count: podDataset.notReadyPods.length },
            pending: { title: KUBERNETES_DETAIL_LABELS.pendingPods, data: podDataset.pendingPods, count: podDataset.pendingPods.length },
            restart: { title: KUBERNETES_DETAIL_LABELS.recentRestartPods, data: podDataset.recentRestartPods, count: podDataset.recentRestartPods.length },
            crashloop: { title: KUBERNETES_DETAIL_LABELS.crashLoopBackOffPods, data: podDataset.crashLoopPods, count: podDataset.crashLoopPods.length },
            'oom-killed': { title: KUBERNETES_DETAIL_LABELS.oomKilledPods, data: podDataset.currentOOMKilledPods, count: podDataset.currentOOMKilledPods.length }
        }
        const podModal = this.state.podModal ? podModalConfigs[this.state.podModal] : undefined
        const podModalColumns = [
            {
                title: '파드',
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
            <DetailNavigationTabs
                activeKey={this.state.activeDetailTab}
                tabs={[
                    { key: 'overview', label: '개요' },
                    { key: 'workloads', label: '워크로드', count: connectedWorkloads.length },
                    { key: 'pods', label: KUBERNETES_DETAIL_LABELS.pods, count: activeConnectedPods.length },
                    { key: 'services', label: KUBERNETES_DETAIL_LABELS.services, count: connectedServices.length }
                ]}
                overflowTabs={[
                    { key: 'ingress', label: 'Ingress', count: this.namespaceResources('ingress').length },
                    { key: 'configuration', label: '정책 및 설정', count: this.resourceTabNodes('configuration').length },
                    { key: 'storage', label: '스토리지', count: connectedClaims.length }
                ]}
                onChange={activeDetailTab => this.setState({ activeDetailTab: activeDetailTab as State['activeDetailTab'] })}
            />
            {this.state.activeDetailTab === 'overview' ? <React.Fragment>
            <DetailSectionCard icon={<InfoIcon />} title={translate('kubernetesNamespaceBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <BasicInfoRows density="compact" rows={basicRows} labelWidth={122} copyTooltip={translate('copy')} />
                <DetailAdvancedInfo
                    title={translate('kubernetesAdvancedInformation')}
                    active={this.state.basicInfoAdvanced}
                    onChange={basicInfoAdvanced => this.setState({ basicInfoAdvanced })}>
                    <KubernetesMetadataRows items={[
                        { key: 'labels', label: KUBERNETES_DETAIL_LABELS.labels, resourceName: name, resourceKind: 'Namespace', metadataKind: 'label', data: detail.labels, excludedKeys: ['kubernetes.io/metadata.name'], modalTitle: '네임스페이스 라벨' },
                        { key: 'annotations', label: KUBERNETES_DETAIL_LABELS.annotations, resourceName: name, resourceKind: 'Namespace', metadataKind: 'annotation', data: detail.annotations, modalTitle: '네임스페이스 어노테이션' }
                    ]} />
                </DetailAdvancedInfo>
            </DetailSectionCard>

            <DetailSectionCard icon={this.topologyIcon(this.props.node)} title={translate('kubernetesNamespaceOperationalStatus')}>
                <StatusSummaryGrid
                    verdict={statusLabel}
                    verdictTone={statusTone}
                    rawStatus={phaseLabel || translate('kubernetesNotCollected')}
                    rawStatusLabel={KUBERNETES_DETAIL_LABELS.namespaceStatus}
                    impact={conclusion}
                    metrics={[
                        {
                            key: 'current-problems',
                            label: '현재 문제',
                            value: optionalNumber(problemCount),
                            tone: Number(problemCount || 0) > 0 ? 'danger' : 'default',
                            tooltip: '현재 비정상 파드와 미가용 워크로드를 자원 UID 기준으로 중복 제거한 대상 수입니다. 정상 완료된 Job과 과거 종료 이력은 제외합니다.',
                            onClick: problemResources.length ? () => this.focusResources(problemResources) : undefined
                        },
                        {
                            key: 'recent-instability',
                            label: '최근 불안정성',
                            value: recentInstabilityCount,
                            tone: recentInstabilityCount > 0 ? 'warning' : 'default',
                            tooltip: '최근 1시간 재시작 증가, CrashLoopBackOff, 현재·최근 OOMKilled 및 Warning 이벤트의 고유 대상을 합산합니다. 이벤트 반복 횟수는 대상 수로 중복 집계하지 않습니다.'
                        },
                        {
                            key: 'history',
                            label: '누적 이력',
                            value: historyCount,
                            tone: 'default',
                            tooltip: '파드 생성 이후 Evicted, restartCount 1 이상, 과거 OOMKilled가 확인된 파드를 합산하고 파드 UID 기준으로 중복 제거합니다. 현재 운영 판정에는 사용하지 않습니다.'
                        },
                    ]}
                />
                <DetailMetaInfoRow items={[
                    { key: 'window', label: '조회 기간', value: '최근 1시간' },
                    {
                        key: 'collection',
                        label: '데이터 수집 상태',
                        value: collection.label,
                        tone: collection.tone,
                        tooltip: '소스별 실제 수집 상태입니다.',
                        tooltipDetail: collection.detail
                    }
                ]} />
            </DetailSectionCard>

            <DetailSectionCard icon={<LinkIcon />} title={translate('kubernetesNamespaceAvailability')}>
                <StatusEvidenceList columnHeaders={{ state: '상태', value: '결과' }}>
                    <StatusEvidenceRow
                        title="배치 노드 수"
                        evidence="현재 활성 파드가 배치된 고유 노드 수입니다."
                        status={{ label: statusText(scheduledNodeTone), tone: scheduledNodeTone }}
                        value={scheduledNodeNames.size}
                        tone={scheduledNodeTone}
                    />
                    <StatusEvidenceRow
                        title="다중 Replica 워크로드 분산"
                        evidence="Replica가 2개 이상인 Deployment·StatefulSet의 노드 분산 상태입니다."
                        status={{ label: distribution.concentratedWorkloads.length > 0 ? '보완 권장' : '정상', tone: distributionTone }}
                        value={distribution.multiReplicaWorkloads.length === 0 ? '해당 없음' : distribution.concentratedWorkloads.length === 0 ? '분산됨' : `${distribution.concentratedWorkloads.length}개 집중`}
                        valueVariant="grade"
                        tone={distributionTone}
                        tooltip="활성 파드의 최상위 Deployment·StatefulSet 소유 관계를 추적하고, desired Replica가 2개 이상인 워크로드만 평가합니다. 가용 노드가 1대뿐인 경우에는 단일 노드 집중 경고를 만들지 않으며 topologySpreadConstraints와 podAntiAffinity도 함께 확인합니다."
                    />
                    <StatusEvidenceRow
                        title={translate('kubernetesEndpointUnavailableServices')}
                        evidence="사용 가능한 Endpoint가 없는 서비스 수입니다."
                        status={{ label: statusText(endpointTone), tone: endpointTone }}
                        value={optionalNumber(endpointUnavailable)}
                        tone={endpointTone}
                    />
                </StatusEvidenceList>
            </DetailSectionCard>

            <DetailSectionCard icon={<ErrorOutlineIcon />} title={translate('kubernetesNamespaceWorkloads')}>
                <StatusEvidenceList columnHeaders={{ state: '상태', value: '대상 수' }}>
                    {[
                        ['전체 워크로드', connectedWorkloads.length, 'success', '네임스페이스에 포함된 상위 워크로드 수입니다.', '', undefined, 'Deployment·StatefulSet·DaemonSet·Job·CronJob을 포함하고, 중간 소유자인 ReplicaSet은 제외하여 고유 UID 기준으로 집계합니다.'],
                        ['미가용 워크로드', workloadHealth.unavailableWorkloads.length, workloadHealth.unavailableWorkloads.length > 0 ? 'danger' : 'success', '자원 종류별 desired·available·ready·완료 조건을 충족하지 못한 워크로드입니다.', ''],
                        [KUBERNETES_DETAIL_LABELS.runningPods, podDataset.runningPods.length, 'success', '현재 실행 중인 고유 파드입니다.', ''],
                        [KUBERNETES_DETAIL_LABELS.notReadyPods, podDataset.notReadyPods.length, podDataset.notReadyPods.length > 0 ? 'danger' : 'success', '실행 중이지만 Ready 조건을 충족하지 못한 파드입니다.', 'not-ready'],
                        [KUBERNETES_DETAIL_LABELS.pendingPods, podDataset.pendingPods.length, podDataset.pendingPods.length > 0 ? 'danger' : 'success', '아직 실행 단계에 도달하지 못한 고유 파드입니다.', 'pending'],
                        [KUBERNETES_DETAIL_LABELS.recentRestartPods, podDataset.recentRestartPods.length, podDataset.recentRestartPods.length > 0 ? 'warning' : 'success', '최근 조회 기간 동안 restartCount가 증가한 파드입니다.', 'restart', [
                            { key: 'window', label: '조회 기간', value: '최근 1시간' },
                            { key: 'history', label: '누적 이력', value: `${podDataset.restartHistoryPods.length}개` }
                        ], '오른쪽 수치는 최근 1시간 내 컨테이너 종료 시각으로 restartCount 증가를 확인한 고유 파드 수입니다. 누적 이력은 파드 생성 이후 restartCount가 1 이상인 파드 수이며 운영 판정에는 사용하지 않습니다.'],
                        [KUBERNETES_DETAIL_LABELS.crashLoopBackOffPods, podDataset.crashLoopPods.length, podDataset.crashLoopPods.length > 0 ? 'danger' : 'success', '현재 컨테이너 시작이 반복적으로 실패하는 파드입니다.', 'crashloop'],
                        [KUBERNETES_DETAIL_LABELS.oomKilledPods, podDataset.currentOOMKilledPods.length, podDataset.currentOOMKilledPods.length > 0 ? 'warning' : 'success', '현재 종료 상태이거나 조회 기간 내 OOMKilled가 발생한 파드입니다.', 'oom-killed', [
                            { key: 'window', label: '조회 기간', value: '최근 1시간' },
                            { key: 'history', label: '누적 이력', value: `${podDataset.oomKilledHistoryPods.length}개` }
                        ], '오른쪽 수치는 현재 종료 원인이 OOMKilled이거나 최근 1시간 내 발생 시각이 확인된 고유 파드 수입니다. 과거 last terminated reason은 누적 이력에만 포함하고 운영 판정에는 사용하지 않습니다.']
                    ].map((item: any[]) => {
                        const tone = item[2] as DetailBadgeTone
                        return <StatusEvidenceRow
                            key={item[0]}
                            title={item[0]}
                            evidence={item[3]}
                            metadata={item[5]}
                            status={{ label: statusText(tone), tone }}
                            value={optionalNumber(item[1])}
                            tone={tone}
                            tooltip={item[6]}
                            onClick={item[4] ? () => this.setState({ podModal: item[4] as NamespacePodModalKey }) : undefined}
                        />
                    })}
                </StatusEvidenceList>
            </DetailSectionCard>

            <KubernetesResourceConfigurationCard coverage={resourceCoverage} />

            <DetailSectionCard icon={<DnsIcon />} title="네임스페이스 정책">
                <StatusEvidenceList columnHeaders={{ state: '상태', value: '설정 수' }}>
                    <StatusEvidenceRow
                        title={KUBERNETES_DETAIL_LABELS.resourceQuota}
                        evidence="네임스페이스 전체 자원 사용량과 생성 가능한 자원 수를 제한합니다."
                        status={{ label: !quotaCollected ? '수집되지 않음' : quotaConfigured ? '설정됨' : '미설정', tone: quotaConfigured ? 'success' : 'default' }}
                        value={!quotaCollected ? '확인 불가' : quotaCount}
                        valueVariant="grade"
                        valuesUnavailable={!quotaCollected}
                        tone={!quotaCollected || !quotaConfigured ? 'default' : 'success'}
                        onClick={quotaConfigured ? () => this.setState({ policyModal: 'quota' }) : undefined}
                    />
                    <StatusEvidenceRow
                        title={KUBERNETES_DETAIL_LABELS.limitRange}
                        evidence="컨테이너와 PVC에 적용되는 기본 요청량·제한량 및 최소·최대 범위입니다."
                        status={{ label: !limitRangeCollected ? '수집되지 않음' : limitRangeConfigured ? '설정됨' : '미설정', tone: limitRangeConfigured ? 'success' : 'default' }}
                        value={!limitRangeCollected ? '확인 불가' : limitRangeCount}
                        valueVariant="grade"
                        valuesUnavailable={!limitRangeCollected}
                        tone={!limitRangeCollected || !limitRangeConfigured ? 'default' : 'success'}
                        onClick={limitRangeConfigured ? () => this.setState({ policyModal: 'limitRange' }) : undefined}
                    />
                </StatusEvidenceList>
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
                            { key: 'workloads', label: translate('kubernetesTopologyWorkloadControllers'), count: connectedWorkloads.length, icon: <DetailLayerIcon glyph={'\uf5fd'} />, iconTone: 'kubernetes' as const, onClick: connectedWorkloads.length ? () => this.setState({ activeDetailTab: 'workloads' }) : undefined },
                            { key: 'pods', label: translate('kubernetesTopologyPods'), count: activeConnectedPods.length, icon: activeConnectedPods.length ? this.topologyIcon(activeConnectedPods[0]) : <DetailLayerIcon glyph={'\uf1b3'} />, iconTone: 'kubernetes' as const, onClick: activeConnectedPods.length ? () => this.setState({ activeDetailTab: 'pods' }) : undefined },
                            { key: 'services', label: translate('kubernetesTopologyServices'), count: connectedServices.length, icon: connectedServices.length ? this.topologyIcon(connectedServices[0]) : <DetailLayerIcon glyph={'\uf233'} />, iconTone: 'kubernetes' as const, onClick: connectedServices.length ? () => this.setState({ activeDetailTab: 'services' }) : undefined },
                            { key: 'pvcs', label: 'PVC', count: connectedClaims.length, icon: connectedClaims.length ? this.topologyIcon(connectedClaims[0]) : <DetailLayerIcon glyph={'\uf1c0'} />, iconTone: 'kubernetes' as const, onClick: connectedClaims.length ? () => this.setState({ activeDetailTab: 'storage' }) : undefined, tooltip: 'Namespace → PVC 관계로 집계합니다. PV와 StorageClass는 직접 자원 수에 포함하지 않습니다.' },
                            ...(this.namespaceResources('ingress').length ? [{ key: 'ingress', label: 'Ingress', count: this.namespaceResources('ingress').length, icon: <DetailLayerIcon glyph={'\uf0c1'} />, iconTone: 'kubernetes' as const, onClick: () => this.setState({ activeDetailTab: 'ingress' as const }) }] : [])
                        ]
                    }
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
                        childrenColumnName="__netdiveNoTreeChildren"
                        pagination={false}
                        size="small"
                    />
                    : podModal && <CompactEmptyState
                        description={podModal.count > 0
                            ? '집계 결과는 있으나 연결된 파드를 현재 토폴로지에서 확인할 수 없습니다.'
                            : '해당 조건에 해당하는 파드가 없습니다.'}
                        compact />}
            </HistoryModal>

            <HistoryModal
                visible={!!this.state.policyModal}
                title={this.state.policyModal === 'quota'
                    ? `${KUBERNETES_DETAIL_LABELS.resourceQuota} ${quotaCount}개`
                    : `${KUBERNETES_DETAIL_LABELS.limitRange} ${limitRangeCount}개`}
                width={620}
                onCancel={() => this.setState({ policyModal: '' })}>
                {this.state.policyModal === 'quota' && <ResourceMetricBlock title={KUBERNETES_DETAIL_LABELS.resourceQuota} basis={`${quotaCount}개`} basisTooltip="여러 ResourceQuota가 있으면 Kubernetes가 가장 제한적인 한도를 함께 적용합니다. 현재 요약은 첫 번째 수집 항목의 Used/Hard 값입니다.">
                    <DetailMetricRow label="파드" value={pairValue(mapValue(quotaUsed, ['pods']), mapValue(quotaHard, ['pods']), !!firstQuota)} ratio="" />
                    <DetailMetricRow label={KUBERNETES_DETAIL_LABELS.cpuRequests} value={pairValue(mapValue(quotaUsed, ['requests.cpu', 'cpu']), mapValue(quotaHard, ['requests.cpu', 'cpu']), !!firstQuota)} ratio="" />
                    <DetailMetricRow label={KUBERNETES_DETAIL_LABELS.cpuLimits} value={pairValue(mapValue(quotaUsed, ['limits.cpu']), mapValue(quotaHard, ['limits.cpu']), !!firstQuota)} ratio="" />
                    <DetailMetricRow label={KUBERNETES_DETAIL_LABELS.memoryRequests} value={pairValue(mapValue(quotaUsed, ['requests.memory', 'memory']), mapValue(quotaHard, ['requests.memory', 'memory']), !!firstQuota)} ratio="" />
                    <DetailMetricRow label={KUBERNETES_DETAIL_LABELS.memoryLimits} value={pairValue(mapValue(quotaUsed, ['limits.memory']), mapValue(quotaHard, ['limits.memory']), !!firstQuota)} ratio="" />
                    <DetailMetricRow label="PVC" value={pairValue(mapValue(quotaUsed, ['persistentvolumeclaims']), mapValue(quotaHard, ['persistentvolumeclaims']), !!firstQuota)} ratio="" />
                </ResourceMetricBlock>}
                {this.state.policyModal === 'limitRange' && <ResourceMetricBlock title={KUBERNETES_DETAIL_LABELS.limitRange} basis={`${limitRangeCount}개`} basisTooltip="현재 요약은 첫 번째 LimitRange 항목의 기본값과 범위이며 적용 대상을 함께 표시합니다.">
                    <DetailMetricRow label="적용 대상" value={settingValue(firstLimit.Type || firstLimit.type, !!firstLimitRange)} ratio="" />
                    <DetailMetricRow label="기본 CPU 요청량·제한량" value={`${settingValue(mapValue(limitDefaultRequest, ['cpu']), !!firstLimitRange)} / ${settingValue(mapValue(limitDefault, ['cpu']), !!firstLimitRange)}`} ratio="" />
                    <DetailMetricRow label="기본 메모리 요청량·제한량" value={`${settingValue(mapValue(limitDefaultRequest, ['memory']), !!firstLimitRange)} / ${settingValue(mapValue(limitDefault, ['memory']), !!firstLimitRange)}`} ratio="" />
                    <DetailMetricRow label="CPU 최소·최대" value={`${settingValue(mapValue(limitMin, ['cpu']), !!firstLimitRange)} / ${settingValue(mapValue(limitMax, ['cpu']), !!firstLimitRange)}`} ratio="" />
                    <DetailMetricRow label="메모리 최소·최대" value={`${settingValue(mapValue(limitMin, ['memory']), !!firstLimitRange)} / ${settingValue(mapValue(limitMax, ['memory']), !!firstLimitRange)}`} ratio="" />
                </ResourceMetricBlock>}
            </HistoryModal>

            {this.state.error && <div className="netdive-detail-notice"><InfoIcon /><span>{translate('kubernetesNamespaceDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-detail-notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesNamespaceDetailPanel
