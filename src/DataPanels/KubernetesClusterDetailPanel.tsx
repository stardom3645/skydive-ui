import * as React from 'react'
import { Badge, Button, Col, Collapse, Divider, Modal, Row, Select, Space, Spin, Table, Tabs, Tag, Tooltip, Typography } from 'antd'
import { HistoryOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { aggregatePods, getPodClassification, kubernetesPodLifecycle, kubernetesPodTime } from '../KubernetesPodLifecycle'
import {
    BasicInfoRows,
    CollapsibleSummaryRow,
    CompactEmptyState,
    ConnectedResourceListSection,
    DetailBadge,
    DetailBadgeTone,
    DetailLayerIcon,
    DetailModalResourceCell,
    DetailModalTextCell,
    DetailMetricRow,
    DetailSectionCard,
    HistoryModal,
    KUBERNETES_DETAIL_LABELS,
    KUBERNETES_UTILIZATION_THRESHOLDS,
    KubernetesAnalysisConfidence,
    KubernetesModalResourceCell,
    KubernetesPodUsageTable,
    RelatedResourceGrid,
    ResourceMetricBlock,
    StatusEvidenceRow,
    StatusEvidenceList,
    StatusSummaryGrid,
    kubernetesCpuCores,
    kubernetesMemoryBytes,
    podCpuResourceCores,
    podMemoryResourceBytes
} from './common'
import './KubernetesClusterDetailPanel.css'

interface Props {
    node: Node
    nodeAttrs: (node: Node) => any
    session: session
    vmDetailMap?: Record<string, any>
    kubernetesClusters?: any[]
}

interface State {
    basicCollapsed: boolean
    basicInfoActiveKey: string
    expandedRecentChangeKey: string
    recentChangesModalOpen: boolean
    summary?: any
    summaryLoading?: boolean
    summaryError?: boolean
    summaryClusterID?: string
    instabilityWindow: string
    podStatusModalMode: '' | 'recent' | 'current' | 'history'
    podStatusModalKey: string
    resourceUsageModal: '' | 'cpu' | 'memory' | 'memory-unset'
    memoryRequestInsightVisible: boolean
    memoryRequestInsightExpanded: boolean
    terminationHistoryExpanded: boolean
    activeDetailTab: 'overview' | 'services'
    serviceNamespaceFilter: string
    focusActive: boolean
}

type ResourceType = 'node' | 'namespace' | 'pod' | 'service' | 'persistentvolume' | 'persistentvolumeclaim' | 'storageclass'

interface ResourceSummary {
    type: ResourceType
    nodes: Node[]
}

interface StatusSummary {
    total: number
    ready?: number
    notReady?: number
    running?: number
    pending?: number
    failed?: number
    unknown?: number
}

interface PodHealthSummary extends StatusSummary {
    objectTotal: number
    succeeded: number
    activeProblemNodes: Node[]
    unknownNodes: Node[]
    pendingNodes: Node[]
    currentProblemGroups: PodStatusGroup[]
    terminationHistoryGroups: PodStatusGroup[]
    terminationHistoryNodes: Node[]
    recentTerminationNodes: Node[]
    affectedNodeNames: string[]
    affectedNamespaces: string[]
    affectedWorkloadNames: string[]
    latestTerminationAt?: number
    latestTerminationEstimated: boolean
    timestampFallbackCount: number
    timestampAvailableCount: number
    timestampExactCount: number
    timestampEstimatedCount: number
    recentTimestampExactCount: number
    recentTimestampEstimatedCount: number
}

interface PodStatusGroup {
    key: string
    label: string
    nodes: Node[]
}

interface PodHistoryTimestamp {
    value?: number
    estimated: boolean
    source: '종료 시각' | '상태 전환' | '이벤트' | '생성 시각' | '확인 불가'
}

type RecentChangeTone = 'success' | 'warning' | 'danger' | 'default'

interface RecentChangeGroup {
    resource: string
    message: string
    time: any
    tone: RecentChangeTone
    events: any[]
}

interface PlacementSummary {
    label: string
    count: number
}

const isBlank = (value: any): boolean => {
    if (value === undefined || value === null) return true
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'string') return value.trim() === ''
    return false
}

const stringify = (value: any): string => {
    if (isBlank(value)) return ''
    if (Array.isArray(value)) return value.map(stringify).filter(Boolean).join(', ')
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch (e) {
            return String(value)
        }
    }
    return String(value)
}

const valueByPath = (data: any, path: string): any => {
    return path.split('.').reduce((current, key) => current === undefined || current === null ? undefined : current[key], data)
}

const firstRaw = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const value = valueByPath(data, path)
        if (!isBlank(value)) return value
    }
    return undefined
}

const firstValue = (data: any, paths: string[]): string => stringify(firstRaw(data, paths))

const podHasUnsetMemoryRequest = (node: Node): boolean => {
    const data = node.data || {}
    const containers = firstRaw(data, [
        'K8s.Extra.Spec.Containers',
        'K8s.Extra.Spec.containers',
        'K8s.Spec.Containers',
        'K8s.Spec.containers',
        'Spec.Containers',
        'Spec.containers'
    ])
    const initContainers = firstRaw(data, [
        'K8s.Extra.Spec.InitContainers',
        'K8s.Extra.Spec.initContainers',
        'K8s.Spec.InitContainers',
        'K8s.Spec.initContainers',
        'Spec.InitContainers',
        'Spec.initContainers'
    ])
    const allContainers = ([] as any[])
        .concat(Array.isArray(containers) ? containers : [])
        .concat(Array.isArray(initContainers) ? initContainers : [])
    if (!allContainers.length) return false

    return allContainers.some(container => isBlank(firstRaw(container, [
        'Resources.Requests.memory',
        'Resources.Requests.Memory',
        'resources.requests.memory',
        'resources.requests.Memory'
    ])))
}

const formatDate = (value: any): string => {
    if (isBlank(value)) return ''
    const numeric = Number(value)
    const milliseconds = !Number.isNaN(numeric) && numeric > 0 && numeric < 100000000000 ? numeric * 1000 : numeric
    const date = !Number.isNaN(milliseconds) ? new Date(milliseconds) : new Date(value)
    if (Number.isNaN(date.getTime())) return stringify(value)
    return date.toLocaleString()
}

const formatRelativeDate = (value: any): string => {
    if (isBlank(value)) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return formatDate(value)
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
    if (seconds < 60) return translate('kubernetesCollectedJustNow')
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}${translate('kubernetesMinutesAgo')}`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}${translate('kubernetesHoursAgo')}`
    return formatDate(value)
}

const formatBytes = (value: any): string => {
    const bytes = Number(value)
    if (!Number.isFinite(bytes) || bytes < 0) return translate('kubernetesUnknown')
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unit = 0
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024
        unit++
    }
    return `${size.toFixed(size >= 10 ? 1 : 2).replace(/\.0$/, '')} ${units[unit]}`
}

const formatBinaryBytes = (value: any, unit: 'MiB' | 'GiB'): string => {
    const bytes = Number(value)
    if (!Number.isFinite(bytes) || bytes < 0) return translate('kubernetesUnknown')
    const divisor = unit === 'GiB' ? 1024 * 1024 * 1024 : 1024 * 1024
    const size = bytes / divisor
    const precision = unit === 'GiB' ? 2 : (Number.isInteger(size) ? 0 : 1)
    return `${size.toFixed(precision).replace(/\.0+$/, '')} ${unit}`
}

const formatGiB = (value: any): string => {
    const bytes = Number(value)
    if (!Number.isFinite(bytes) || bytes < 0) return translate('kubernetesUnknown')
    if (bytes === 0) return '0 GiB'
    const size = bytes / (1024 * 1024 * 1024)
    if (size < 0.01) return '<0.01 GiB'
    return `${size.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0$/, '$1')} GiB`
}

const formatCoreNumber = (value: any): string => {
    const cores = Number(value)
    if (!Number.isFinite(cores)) return translate('kubernetesUnknown')
    return cores.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0$/, '$1')
}

const quantityNumber = (value: any): number => {
    const source = value && typeof value === 'object'
        ? value.string ?? value.String ?? value.value ?? value.Value
        : value
    const parsed = Number(source)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const KUBERNETES_RESOURCE_PROGRESS_COLORS = Object.freeze({
    usage: '#1677ff',
    secondary: '#bfbfbf',
    warning: '#f79009',
    danger: '#d92d20'
})
const KUBERNETES_REQUEST_OVERAGE_GUIDANCE_RATIO = 1.2
const KUBERNETES_MEMORY_REQUEST_INSIGHT_MIN_DURATION_MS = 5 * 60 * 1000
const KUBERNETES_CLUSTER_SUMMARY_REFRESH_MS = 60 * 1000

const clampPercent = (value: any): number => Math.max(0, Math.min(100, Number(value) || 0))

const endpointID = (endpoint: any): string => typeof endpoint === 'string' ? endpoint : endpoint?.id || ''

const ServiceName = ({ value }: { value: string }) => {
    const nameRef = React.useRef<HTMLSpanElement>(null)
    const [truncated, setTruncated] = React.useState(false)
    const measure = () => {
        const element = nameRef.current
        setTruncated(!!element && element.scrollWidth > element.clientWidth)
    }
    return <Tooltip
        title={truncated ? value : undefined}
        placement="top"
        mouseEnterDelay={0.35}
        overlayClassName="netdive-k8s-cluster-detail__service-name-tooltip">
        <span ref={nameRef} onMouseEnter={measure} className="netdive-k8s-cluster-detail__service-name">{value}</span>
    </Tooltip>
}

class KubernetesClusterDetailPanel extends React.Component<Props, State> {
    private summaryRefreshTimer?: number
    private memoryRequestOverageSince = 0

    state: State = {
        basicCollapsed: false,
        basicInfoActiveKey: '',
        expandedRecentChangeKey: '',
        recentChangesModalOpen: false,
        instabilityWindow: '1h',
        podStatusModalMode: '',
        podStatusModalKey: '',
        resourceUsageModal: '',
        memoryRequestInsightVisible: false,
        memoryRequestInsightExpanded: false,
        terminationHistoryExpanded: false,
        activeDetailTab: (this.props.node as any).__netdiveInitialDetailTab === 'services' ? 'services' : 'overview',
        serviceNamespaceFilter: 'all',
        focusActive: false
    }

    componentDidMount() {
        delete (this.props.node as any).__netdiveInitialDetailTab
        this.loadClusterSummary()
        this.summaryRefreshTimer = window.setInterval(
            () => this.loadClusterSummary(true, true),
            KUBERNETES_CLUSTER_SUMMARY_REFRESH_MS
        )
    }

    componentWillUnmount() {
        if (this.summaryRefreshTimer !== undefined) {
            window.clearInterval(this.summaryRefreshTimer)
        }
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id) {
            this.memoryRequestOverageSince = 0
            this.setState({ basicCollapsed: false, basicInfoActiveKey: '', expandedRecentChangeKey: '', recentChangesModalOpen: false, instabilityWindow: '1h', podStatusModalMode: '', podStatusModalKey: '', resourceUsageModal: '', memoryRequestInsightVisible: false, memoryRequestInsightExpanded: false, terminationHistoryExpanded: false, activeDetailTab: 'overview', serviceNamespaceFilter: 'all', focusActive: false, summary: undefined, summaryError: false, summaryClusterID: undefined }, () => this.loadClusterSummary())
            return
        }
        const previousCluster = this.moldClusterFrom(prevProps)
        const currentCluster = this.moldCluster()
        if (previousCluster?.id !== currentCluster?.id && currentCluster?.id) {
            this.loadClusterSummary()
        }
    }

    private moldClusterFrom(props: Props): any | undefined {
        const data = props.node.data || {}
        const normalizeKey = (value: any): string => String(value || '').trim().toLowerCase()
        const topologyKeys = [
            props.node.id,
            firstValue(data, ['Name', 'K8s.Name', 'ClusterName', 'clusterName']),
            firstValue(data, ['MoldClusterId', 'MoldClusterID', 'ClusterID', 'ClusterId', 'clusterId'])
        ].map(normalizeKey).filter(Boolean)

        return (props.kubernetesClusters || []).find(cluster => {
            const clusterKeys = [cluster?.id, cluster?.name].map(normalizeKey).filter(Boolean)
            return clusterKeys.some(key => topologyKeys.indexOf(key) >= 0)
        })
    }

    private memoryRequestInsightSustained(summary: any): boolean {
        const resources = summary?.resources
        const allocatableMemory = Number(resources?.allocatableMemoryBytes) || 0
        const usageMemory = Number(resources?.usageMemoryBytes) || 0
        const requestsMemory = Number(resources?.requestsMemoryBytes) || 0
        const usagePercent = allocatableMemory > 0 ? usageMemory / allocatableMemory * 100 : 0
        const exceedsRequests = usageMemory > 0
            && (requestsMemory <= 0 || usageMemory >= requestsMemory * KUBERNETES_REQUEST_OVERAGE_GUIDANCE_RATIO)
        const conditionActive = !!resources?.metricsAvailable
            && usagePercent >= KUBERNETES_UTILIZATION_THRESHOLDS.warning
            && exceedsRequests

        if (!conditionActive) {
            this.memoryRequestOverageSince = 0
            return false
        }
        if (!this.memoryRequestOverageSince) {
            this.memoryRequestOverageSince = Date.now()
            return false
        }
        return Date.now() - this.memoryRequestOverageSince >= KUBERNETES_MEMORY_REQUEST_INSIGHT_MIN_DURATION_MS
    }

    private loadClusterSummary(force = false, background = false) {
        const cluster = this.moldCluster()
        if (!cluster?.id || this.state.summaryLoading || (!force && this.state.summaryClusterID === cluster.id)) return
        const endpoint = this.props.session?.endpoint || `${window.location.protocol}//${window.location.host}`
        this.setState({ summaryLoading: background ? this.state.summaryLoading : true, summaryError: false, summaryClusterID: cluster.id })
        fetch(`${endpoint}/api/mold/kubernetes-clusters/summary?id=${encodeURIComponent(cluster.id)}`, {
            cache: 'no-store',
            headers: this.props.session?.token ? { 'X-Auth-Token': this.props.session.token } : undefined
        }).then(response => {
            if (!response.ok) throw new Error(`cluster summary unavailable: ${response.status}`)
            return response.json()
        }).then(summary => {
            if (this.state.summaryClusterID === cluster.id) {
                const memoryRequestInsightVisible = this.memoryRequestInsightSustained(summary)
                this.setState({
                    summary,
                    summaryLoading: false,
                    summaryError: false,
                    memoryRequestInsightVisible,
                    memoryRequestInsightExpanded: memoryRequestInsightVisible
                        ? this.state.memoryRequestInsightExpanded
                        : false
                })
            }
        }).catch(() => {
            if (this.state.summaryClusterID === cluster.id) {
                this.setState({ summaryLoading: false, summaryError: true })
            }
        })
    }

    private changeInstabilityWindow(instabilityWindow: string) {
        this.setState({ instabilityWindow }, () => this.loadClusterSummary(true))
    }

    private renderInstabilityWindowSelect() {
        return <Select
            size="small"
            value={this.state.instabilityWindow}
            onChange={instabilityWindow => this.changeInstabilityWindow(instabilityWindow)}
            getPopupContainer={trigger => trigger.parentElement as HTMLElement}>
            <Select.Option value="1h">최근 1시간</Select.Option>
            <Select.Option value="6h">최근 6시간</Select.Option>
            <Select.Option value="24h">최근 24시간</Select.Option>
            <Select.Option value="7d">최근 7일</Select.Option>
        </Select>
    }

    private topologyNodes(): Node[] {
        const topologyNodes = (window as any).App?.tc?.nodes
        if (topologyNodes instanceof Map) return Array.from(topologyNodes.values())
        if (Array.isArray(topologyNodes)) return topologyNodes

        const nodes: Node[] = []
        const visit = (node: Node) => {
            nodes.push(node)
            ;(node.children || []).forEach(visit)
        }
        visit(this.props.node)
        return nodes
    }

    private topologyLinks(): any[] {
        const links = (window as any).App?.tc?.links
        if (links instanceof Map) return Array.from(links.values())
        return Array.isArray(links) ? links : []
    }

    private clusterResources(): Node[] {
        const allNodes = this.topologyNodes()
        const nodeMap = new Map<string, Node>()
        allNodes.forEach(node => nodeMap.set(node.id, node))
        nodeMap.set(this.props.node.id, this.props.node)

        const adjacency = new Map<string, string[]>()
        this.topologyLinks().forEach(link => {
            const sourceID = endpointID(link?.source)
            const targetID = endpointID(link?.target)
            if (!sourceID || !targetID) return
            adjacency.set(sourceID, [...(adjacency.get(sourceID) || []), targetID])
            adjacency.set(targetID, [...(adjacency.get(targetID) || []), sourceID])
        })

        const visited = new Set<string>()
        const queue: string[] = [this.props.node.id]
        while (queue.length) {
            const id = queue.shift() as string
            if (visited.has(id)) continue
            const current = nodeMap.get(id)
            if (!current) continue
            const type = String(current.data?.Type || '').toLowerCase()
            const manager = String(current.data?.Manager || '').toLowerCase()
            if (id !== this.props.node.id && (manager !== 'k8s' || type === 'cluster')) continue
            visited.add(id)
            ;(current.children || []).forEach(child => {
                nodeMap.set(child.id, child)
                queue.push(child.id)
            })
            ;(adjacency.get(id) || []).forEach(relatedID => queue.push(relatedID))
        }

        // Service, Ingress and the other relationship resources intentionally
        // have no topology parent/edge. Include them in cluster detail
        // navigation by their collector scope instead of relying on canvas
        // reachability.
        const normalizedKeys = (node: Node): string[] => {
            const type = String(node.data?.Type || '').toLowerCase()
            return [
                node.data?.ClusterID,
                node.data?.ClusterId,
                node.data?.ClusterName,
                node.data?.K8s?.ClusterID,
                node.data?.K8s?.ClusterName,
                type === 'cluster' ? node.id : '',
                type === 'cluster' ? node.data?.Name : ''
            ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean)
        }
        const selectedClusterKeys = normalizedKeys(this.props.node)
        if (selectedClusterKeys.length) {
            allNodes.forEach(node => {
                if (node.id === this.props.node.id || String(node.data?.Manager || '').toLowerCase() !== 'k8s') return
                const keys = normalizedKeys(node)
                if (keys.some(key => selectedClusterKeys.indexOf(key) >= 0)) visited.add(node.id)
            })
        }

        return Array.from(visited)
            .filter(id => id !== this.props.node.id)
            .map(id => nodeMap.get(id))
            .filter((node): node is Node => !!node)
    }

    private resourceSummaries(): ResourceSummary[] {
        const resources = this.clusterResources()
        return (['node', 'namespace', 'pod', 'service', 'persistentvolume', 'persistentvolumeclaim', 'storageclass'] as ResourceType[]).map(type => ({
            type,
            nodes: resources.filter(node => String(node.data?.Type || '').toLowerCase() === type)
        }))
    }

    private nodeReady(node: Node): boolean {
        const conditions = firstRaw(node.data || {}, ['K8s.Extra.Status.Conditions', 'Conditions'])
        if (Array.isArray(conditions)) {
            const ready = conditions.find(condition => String(condition?.Type || '').toLowerCase() === 'ready')
            if (ready) return String(ready.Status || '').toLowerCase() === 'true'
        }
        const direct = firstValue(node.data || {}, ['Ready', 'Status', 'State']).toLowerCase()
        return /^(true|ready|running|active|up)$/.test(direct)
    }

    private controlPlaneNode(node: Node): boolean {
        const data = node.data || {}
        const labels = stringify(firstRaw(data, ['K8s.Labels', 'Labels', 'K8s.Extra.ObjectMeta.Labels'])).toLowerCase()
        const name = firstValue(data, ['Name', 'K8s.Name']).toLowerCase()
        return labels.indexOf('control-plane') >= 0 || labels.indexOf('master') >= 0 || /(^|-)control(-|$)/.test(name)
    }

    private topologyStatus(resources: Node[], type: 'node' | 'pod'): StatusSummary {
        const nodes = resources.filter(node => String(node.data?.Type || '').toLowerCase() === type)
        if (type === 'node') {
            const ready = nodes.filter(node => this.nodeReady(node)).length
            return { total: nodes.length, ready, notReady: nodes.length - ready }
        }
        const pods = aggregatePods(nodes)
        return {
            total: pods.current,
            running: pods.running,
            pending: pods.pending,
            failed: 0,
            unknown: 0
        }
    }

    private podTimestamp(node: Node): PodHistoryTimestamp {
        const time = kubernetesPodTime(node)
        const source: PodHistoryTimestamp['source'] = time.source === '상태 전환 시각'
            ? '상태 전환'
            : time.source === '이벤트 시각'
                ? '이벤트'
                : time.source === '시간 정보 없음'
                    ? '확인 불가'
                    : time.source as PodHistoryTimestamp['source']
        return { value: time.value, estimated: time.accuracy === '추정', source }
    }

    private podWorkloadName(node: Node, workloads: Node[]): string {
        const data = node.data || {}
        const namespace = firstValue(data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
        const owners = firstRaw(data, ['K8s.Extra.ObjectMeta.OwnerReferences'])
        const owner = Array.isArray(owners) ? owners.find(item => item?.Controller) || owners[0] : undefined
        if (!owner?.Name) return ''
        const kind = String(owner.Kind || '').toLowerCase()
        if (kind !== 'replicaset') return String(owner.Name)
        const deployment = workloads.find(workload => {
            if (String(workload.data?.Type || '').toLowerCase() !== 'deployment') return false
            const workloadNamespace = firstValue(workload.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
            const workloadName = firstValue(workload.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'])
            return workloadNamespace === namespace && String(owner.Name).indexOf(`${workloadName}-`) === 0
        })
        return deployment ? firstValue(deployment.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) : String(owner.Name)
    }

    private podPrimaryReason(node: Node): string {
        const lifecycle = kubernetesPodLifecycle(node)
        return lifecycle.label || lifecycle.originalReason || '상태 확인'
    }

    private podHealth(resources: Node[], windowMs: number): PodHealthSummary {
        const workloads = resources.filter(node => ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(String(node.data?.Type || '').toLowerCase()) >= 0)
        const podAggregate = aggregatePods(resources)
        const currentProblemGroups = podAggregate.currentProblemGroups.map(group => ({
            key: group.key,
            label: group.label,
            nodes: group.entries.map(entry => entry.node)
        }))
        const terminationHistoryGroups = podAggregate.terminationHistoryGroups.map(group => ({
            key: group.key,
            label: group.label,
            nodes: group.entries.map(entry => entry.node)
        }))
        const activeProblemNodes = podAggregate.problemEntries.map(entry => entry.node)
        const terminationHistoryNodes = podAggregate.terminatedEntries.map(entry => entry.node)
        const pendingNodes = podAggregate.pendingEntries.map(entry => entry.node)
        const unknownNodes = podAggregate.currentProblemGroups
            .filter(group => group.key === 'containerstatusunknown')
            .reduce((items: Node[], group) => items.concat(group.entries.map(entry => entry.node)), [])
        const now = Date.now()
        const timeByNodeID = new Map(podAggregate.terminatedEntries.map(entry => [entry.node.id, entry.time]))
        const recentTerminationNodes = terminationHistoryNodes
            .filter(node => {
                const timestamp = timeByNodeID.get(node.id)?.value
                return timestamp !== undefined && timestamp >= now - windowMs
            })
            .sort((a, b) => (timeByNodeID.get(b.id)?.value || 0) - (timeByNodeID.get(a.id)?.value || 0))
        const affectedNodes = new Set<string>()
        const affectedNamespaces = new Set<string>()
        const affectedWorkloads = new Set<string>()
        let latestTerminationAt: number | undefined
        let latestTerminationEstimated = false
        let timestampFallbackCount = 0
        let timestampAvailableCount = 0
        let timestampExactCount = 0
        let timestampEstimatedCount = 0
        terminationHistoryNodes.forEach(node => {
            const data = node.data || {}
            const nodeName = firstValue(data, ['K8s.Node', 'NodeName', 'K8s.Extra.Spec.NodeName'])
            const namespace = firstValue(data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
            const workload = this.podWorkloadName(node, workloads)
            if (nodeName) affectedNodes.add(nodeName)
            if (namespace) affectedNamespaces.add(namespace)
            if (workload) affectedWorkloads.add(workload)
            const timestamp = timeByNodeID.get(node.id) || { value: undefined, text: '확인 불가', accuracy: '확인 불가', source: '시간 정보 없음' }
            if (timestamp.value !== undefined) timestampAvailableCount++
            if (timestamp.accuracy === '추정' && timestamp.value !== undefined) {
                timestampFallbackCount++
                timestampEstimatedCount++
            } else if (timestamp.value !== undefined) {
                timestampExactCount++
            }
            if (timestamp.value !== undefined && (latestTerminationAt === undefined || timestamp.value > latestTerminationAt)) {
                latestTerminationAt = timestamp.value
                latestTerminationEstimated = timestamp.accuracy === '추정'
            }
        })
        terminationHistoryNodes.sort((a, b) => (timeByNodeID.get(b.id)?.value || 0) - (timeByNodeID.get(a.id)?.value || 0))
        return {
            objectTotal: podAggregate.total,
            total: podAggregate.active,
            running: podAggregate.running,
            succeeded: podAggregate.terminationHistoryGroups.find(group => group.key === 'succeeded')?.entries.length || 0,
            pending: podAggregate.pending,
            failed: 0,
            unknown: 0,
            activeProblemNodes,
            unknownNodes,
            pendingNodes,
            currentProblemGroups,
            terminationHistoryGroups,
            terminationHistoryNodes,
            recentTerminationNodes,
            affectedNodeNames: Array.from(affectedNodes),
            affectedNamespaces: Array.from(affectedNamespaces),
            affectedWorkloadNames: Array.from(affectedWorkloads),
            latestTerminationAt,
            latestTerminationEstimated,
            timestampFallbackCount,
            timestampAvailableCount,
            timestampExactCount,
            timestampEstimatedCount,
            recentTimestampExactCount: recentTerminationNodes.filter(node => timeByNodeID.get(node.id)?.accuracy === '정확').length,
            recentTimestampEstimatedCount: recentTerminationNodes.filter(node => timeByNodeID.get(node.id)?.accuracy === '추정').length
        }
    }

    private unavailableWorkloads(resources: Node[]): Node[] {
        return resources.filter(node => {
            const type = String(node.data?.Type || '').toLowerCase()
            const data = node.data || {}
            const spec = firstRaw(data, ['K8s.Extra.Spec']) || {}
            const status = firstRaw(data, ['K8s.Extra.Status']) || {}
            if (type === 'deployment') return Number(status.AvailableReplicas || 0) < Number(spec.Replicas || 0)
            if (type === 'statefulset') return Number(status.ReadyReplicas || 0) < Number(spec.Replicas || 0)
            if (type === 'daemonset') return Number(status.NumberAvailable || 0) < Number(status.DesiredNumberScheduled || 0)
            return false
        })
    }

    private recentNodeSignalNodes(resources: Node[], windowMs: number): Node[] {
        const cutoff = Date.now() - windowMs
        const signalTypes = ['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable']
        return resources.filter(node => {
            if (String(node.data?.Type || '').toLowerCase() !== 'node') return false
            const times = firstRaw(node.data || {}, ['K8s.ConditionTransitionTimes', 'ConditionTransitionTimes'])
            if (!times || typeof times !== 'object') return false
            return signalTypes.some(type => {
                const timestamp = new Date(times[type]).getTime()
                return !Number.isNaN(timestamp) && timestamp >= cutoff
            })
        })
    }

    private nodeSignalTimestampsAvailable(resources: Node[]): boolean {
        return resources.some(node => {
            if (String(node.data?.Type || '').toLowerCase() !== 'node') return false
            const times = firstRaw(node.data || {}, ['K8s.ConditionTransitionTimes', 'ConditionTransitionTimes'])
            if (!times || typeof times !== 'object') return false
            return Object.keys(times).some(type => !Number.isNaN(new Date(times[type]).getTime()))
        })
    }

    private controlPlaneStatus(resources: Node[]): StatusSummary {
        const controlNodes = resources.filter(node => String(node.data?.Type || '').toLowerCase() === 'node' && this.controlPlaneNode(node))
        const ready = controlNodes.filter(node => this.nodeReady(node)).length
        return { total: controlNodes.length, ready, notReady: controlNodes.length - ready }
    }

    private kubernetesVersion(resources: Node[], moldCluster: any): string {
        if (this.state.summary?.kubernetesVersion) return this.state.summary.kubernetesVersion
        if (this.state.summary?.version) return this.state.summary.version
        for (const node of resources) {
            if (String(node.data?.Type || '').toLowerCase() !== 'node') continue
            const version = firstValue(node.data || {}, ['K8s.Extra.Status.NodeInfo.KubeletVersion', 'K8s.KubeletVersion', 'KubernetesVersion'])
            if (version) return version
        }
        return moldCluster?.version || ''
    }

    private nodePlacements(resources: Node[]): PlacementSummary[] {
        const clusterNodes = resources.filter(node => String(node.data?.Type || '').toLowerCase() === 'node')
        const detailMap = this.props.vmDetailMap || {}
        const seen = new Set<string>()
        const details = Object.keys(detailMap).map(key => detailMap[key]).filter(detail => {
            if (!detail || typeof detail !== 'object') return false
            const id = firstValue(detail, ['uuid', 'id', 'instanceName', 'name'])
            if (id && seen.has(id)) return false
            if (id) seen.add(id)
            return true
        })
        const counts = new Map<string, number>()
        clusterNodes.forEach(node => {
            const name = firstValue(node.data || {}, ['Name', 'K8s.Name']).toLowerCase()
            const addresses = firstRaw(node.data || {}, ['K8s.Extra.Status.Addresses', 'Addresses'])
            const internalAddress = Array.isArray(addresses)
                ? addresses.find(address => String(address?.Type || '').toLowerCase() === 'internalip')?.Address
                : ''
            const ip = (internalAddress || firstValue(node.data || {}, ['K8s.InternalIP', 'InternalIP'])).split('/')[0]
            const detail = details.find(item => {
                const itemNames = [firstValue(item, ['name']), firstValue(item, ['displayName']), firstValue(item, ['instanceName'])].map(value => value.toLowerCase())
                return (name && itemNames.indexOf(name) >= 0) || (ip && firstValue(item, ['privateIp', 'privateIpAddress']) === ip)
            })
            const host = detail ? firstValue(detail, ['hostName', 'hostname', 'host']) : ''
            const label = host || translate('kubernetesPlacementUnknown')
            counts.set(label, (counts.get(label) || 0) + 1)
        })
        return Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
    }

    private switchPlacements(hostPlacements: PlacementSummary[]): PlacementSummary[] {
        const topologyNodes = this.topologyNodes()
        const links = this.topologyLinks()
        const switches = topologyNodes.filter(node => String(node.data?.Type || '').toLowerCase() === 'switch')
        const hostToSwitch = new Map<string, string>()
        const subtreeIDs = (root: Node): Set<string> => {
            const ids = new Set<string>()
            const visit = (node: Node) => {
                ids.add(node.id)
                ;(node.children || []).forEach(visit)
            }
            visit(root)
            return ids
        }
        const nearestHost = (node?: Node): Node | undefined => {
            let current = node
            while (current) {
                if (String(current.data?.Type || '').toLowerCase() === 'host') return current
                current = current.parent || undefined
            }
            return undefined
        }
        const nodeMap = new Map<string, Node>()
        topologyNodes.forEach(node => nodeMap.set(node.id, node))
        switches.forEach(switchNode => {
            const switchIDs = subtreeIDs(switchNode)
            const switchName = firstValue(switchNode.data || {}, ['Name', 'SystemName', 'ChassisID']) || switchNode.id
            links.forEach(link => {
                const sourceID = endpointID(link?.source)
                const targetID = endpointID(link?.target)
                const remoteID = switchIDs.has(sourceID) ? targetID : switchIDs.has(targetID) ? sourceID : ''
                if (!remoteID) return
                const host = nearestHost(nodeMap.get(remoteID))
                if (host) hostToSwitch.set(firstValue(host.data || {}, ['Name', 'Hostname']) || host.id, switchName)
            })
        })
        const counts = new Map<string, number>()
        hostPlacements.forEach(item => {
            const switchName = hostToSwitch.get(item.label) || translate('kubernetesPlacementUnknown')
            counts.set(switchName, (counts.get(switchName) || 0) + item.count)
        })
        return Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
    }

    private affectedServiceCount(): number {
        return this.state.summary?.currentlyImpactedServiceCount !== undefined
            ? Number(this.state.summary.currentlyImpactedServiceCount) || 0
            : this.state.summary?.affectedServices !== undefined
                ? Number(this.state.summary.affectedServices) || 0
                : 0
    }

    private moldCluster(): any | undefined {
        return this.moldClusterFrom(this.props)
    }

    private focusResources(nodes: Node[]) {
        const ids = nodes.map(node => node.id)
        const app = (window as any).App
        if (ids.length && app && typeof app.focusInfrastructureNodeIDs === 'function') {
            if (typeof app.clearKubernetesInfrastructureEvidence === 'function') {
                app.clearKubernetesInfrastructureEvidence()
            }
            app.focusInfrastructureNodeIDs(ids, this.props.node.id, true)
            this.setState({ focusActive: true })
        }
    }

    private focusInfrastructureEvidence(nodes: Node[]) {
        const ids = Array.from(new Set(nodes.map(node => node.id)))
        const app = (window as any).App
        if (ids.length && app && typeof app.focusKubernetesInfrastructureEvidenceNodeIDs === 'function') {
            app.focusKubernetesInfrastructureEvidenceNodeIDs(ids)
            this.setState({ focusActive: true })
        }
    }

    private clearFocusedResources() {
        const app = (window as any).App
        if (app && typeof app.clearKubernetesInfrastructureEvidence === 'function') {
            app.clearKubernetesInfrastructureEvidence()
        } else if (app && typeof app.focusInfrastructureNodeIDs === 'function') {
            app.focusInfrastructureNodeIDs([])
        }
        this.setState({ focusActive: false })
    }

    private openResourceDetail(node: Node) {
        const app = (window as any).App
        if (app && typeof app.openResourceDetailNodeID === 'function') app.openResourceDetailNodeID(node.id)
    }

    private openServiceDetail(service: Node) {
        ;(service as any).__netdiveReturnClusterNode = this.props.node
        this.openResourceDetail(service)
    }

    private renderServiceBrowser(services: Node[]) {
        const namespaceFor = (node: Node) => firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) || translate('kubernetesNotCollected')
        const namespaces = Array.from(new Set(services.map(namespaceFor))).sort()
        const filtered = this.state.serviceNamespaceFilter === 'all'
            ? services
            : services.filter(node => namespaceFor(node) === this.state.serviceNamespaceFilter)
        return <div className="netdive-k8s-cluster-detail__resource-browser">
            <div className="netdive-k8s-cluster-detail__resource-browser-filter">
                <span className="netdive-k8s-cluster-detail__resource-browser-filter-label">네임스페이스</span>
                <Select size="middle" value={this.state.serviceNamespaceFilter} onChange={serviceNamespaceFilter => this.setState({ serviceNamespaceFilter })}>
                    <Select.Option value="all">전체</Select.Option>
                    {namespaces.map(namespace => <Select.Option value={namespace} key={namespace}>{namespace}</Select.Option>)}
                </Select>
            </div>
            <ConnectedResourceListSection
                icon={<AccountTreeIcon />}
                title="서비스 목록"
                emptyText="수집된 Service가 없습니다."
                groups={[{
                    key: 'services',
                    items: filtered
                        .slice()
                        .sort((left, right) => {
                            const namespaceOrder = namespaceFor(left).localeCompare(namespaceFor(right))
                            return namespaceOrder || firstValue(left.data || {}, ['Name', 'K8s.Name']).localeCompare(firstValue(right.data || {}, ['Name', 'K8s.Name']))
                        })
                        .map(service => {
                            const name = firstValue(service.data || {}, ['Name', 'K8s.Name']) || service.id
                            return {
                                key: service.id,
                                name: <ServiceName value={name} />,
                                description: namespaceFor(service),
                                icon: <img className="netdive-k8s-cluster-detail__service-resource-icon" src="assets/icons/service.svg" alt="" />,
                                className: 'netdive-connected-resource-list__item--service',
                                onClick: () => this.openServiceDetail(service)
                            }
                        })
                }]} />
        </div>
    }

    private labels(): Array<{ key: string, value: string }> {
        const data = this.props.node.data || {}
        const labels = firstRaw(data, ['K8s.Labels', 'Labels', 'K8s.Extra.ObjectMeta.Labels'])
        if (!labels || typeof labels !== 'object' || Array.isArray(labels)) return []
        return Object.keys(labels).sort().map(key => ({ key, value: stringify(labels[key]) }))
    }

    private annotations(): Array<{ key: string, value: string }> {
        const data = this.props.node.data || {}
        const annotations = firstRaw(data, ['K8s.Annotations', 'Annotations', 'K8s.Extra.ObjectMeta.Annotations'])
        if (!annotations || typeof annotations !== 'object' || Array.isArray(annotations)) return []
        return Object.keys(annotations).sort().map(key => ({ key, value: stringify(annotations[key]) }))
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        if (attrs.href) {
            return (
                <img
                    className={`netdive-k8s-cluster-detail__topology-icon-image ${attrs.iconClass || ''}`}
                    src={attrs.href}
                    alt="" />
            )
        }
        return (
            <span
                className={`netdive-k8s-cluster-detail__topology-icon ${attrs.iconClass || ''}`}
                aria-hidden="true">
                {attrs.icon}
            </span>
        )
    }

    private resourceIcon(summary: ResourceSummary) {
        const representative = summary.nodes[0] || new Node(
            `kubernetes-detail-${summary.type}`,
            [],
            { Manager: 'k8s', Type: summary.type, Name: summary.type }
        )
        return this.topologyIcon(representative)
    }

    private resourceLabel(type: ResourceType): string {
        if (type === 'node') return translate('kubernetesTopologyNodes')
        if (type === 'namespace') return KUBERNETES_DETAIL_LABELS.namespace
        if (type === 'pod') return KUBERNETES_DETAIL_LABELS.pod
        if (type === 'service') return translate('kubernetesTopologyServices')
        if (type === 'persistentvolume') return KUBERNETES_DETAIL_LABELS.persistentVolume
        if (type === 'persistentvolumeclaim') return KUBERNETES_DETAIL_LABELS.persistentVolumeClaim
        return KUBERNETES_DETAIL_LABELS.storageClass
    }

    private storageResourceIcon(type: 'persistentvolume' | 'persistentvolumeclaim' | 'storageclass') {
        if (type === 'persistentvolumeclaim') return <DetailLayerIcon glyph={'\uf0a0'} />
        if (type === 'persistentvolume') return <DetailLayerIcon glyph={'\uf1c0'} />
        return <DetailLayerIcon glyph={'\uf013'} />
    }

    private renderMetadataItems(items: Array<{ key: string, value: string }>, emptyText: string) {
        if (!items.length) return <CompactEmptyState description={emptyText} compact />
        return (
            <div className="netdive-k8s-cluster-detail__metadata-list">
                {items.map(item => (
                    <Tooltip key={item.key} title={`${item.key}: ${item.value}`} placement="top">
                        <span className="netdive-k8s-cluster-detail__metadata-item">
                            <span>{item.key}</span>
                            {item.value && <strong>{item.value}</strong>}
                        </span>
                    </Tooltip>
                ))}
            </div>
        )
    }

    private renderUtilizationCard(config: {
        title: string
        unitTooltip: React.ReactNode
        allocatableValue: string
        usageValue: string
        usagePercent?: number
        requestsValue?: string
        requestsPercent?: number
        limitsValue?: string
        limitsPercent?: number
        pod?: boolean
        allocatableAvailable?: boolean
        onUsageClick?: () => void
        requestInsight?: {
            onTopUsage: () => void
            onUnsetRequests: () => void
        }
    }) {
        const usageColor = config.usagePercent !== undefined && config.usagePercent >= KUBERNETES_UTILIZATION_THRESHOLDS.danger
            ? KUBERNETES_RESOURCE_PROGRESS_COLORS.danger
            : config.usagePercent !== undefined && config.usagePercent >= KUBERNETES_UTILIZATION_THRESHOLDS.warning
                ? KUBERNETES_RESOURCE_PROGRESS_COLORS.warning
                : KUBERNETES_RESOURCE_PROGRESS_COLORS.usage
        const ratio = (value?: number) => value !== undefined ? `${value.toFixed(1)}%` : '-'
        const usageWithAllocatable = (() => {
            if (config.pod) return `${config.usageValue} / ${config.allocatableValue}개`
            const unitMatch = config.allocatableValue.match(/\s+(Core|GiB|MiB)$/)
            const numerator = unitMatch && config.usageValue.endsWith(unitMatch[0])
                ? config.usageValue.slice(0, -unitMatch[0].length)
                : config.usageValue
            return `${numerator} / ${config.allocatableValue}`
        })()
        return <ResourceMetricBlock
            className={`netdive-k8s-cluster-detail__utilization-section ${config.pod ? 'is-pod' : ''}`}
            title={config.title}
            tooltip={config.unitTooltip}
            tooltipOverlayClassName="netdive-k8s-cluster-detail__capacity-tooltip">
            {config.pod && config.allocatableAvailable === false
                ? <DetailMetricRow
                    primary
                    label="활성 Pod"
                    value={`${config.usageValue}개`}
                    ratio=""
                />
                : <React.Fragment>
                    <DetailMetricRow
                        primary
                        label={config.pod ? '활성 Pod' : '현재 사용량'}
                        value={usageWithAllocatable}
                        ratio={ratio(config.usagePercent)}
                        onClick={config.onUsageClick}
                        progressPercent={config.usagePercent !== undefined ? clampPercent(config.usagePercent) : 0}
                        progressColor={usageColor}
                    />
                    {!config.pod && <React.Fragment>
                        <DetailMetricRow
                            label={<Tooltip title="값이 설정된 컨테이너의 Requests만 합산하며, 미설정 컨테이너는 합계에서 제외합니다.">
                                <span className="netdive-k8s-cluster-detail__metric-label-with-info">
                                    설정된 Requests 합계 <InfoCircleOutlined />
                                </span>
                            </Tooltip>}
                            value={config.requestsValue}
                            ratio={ratio(config.requestsPercent)}
                            progressPercent={config.requestsPercent !== undefined ? clampPercent(config.requestsPercent) : 0}
                            progressColor={KUBERNETES_RESOURCE_PROGRESS_COLORS.secondary}
                        />
                        <DetailMetricRow
                            muted
                            className="netdive-k8s-cluster-detail__limits-metric"
                            label={<Tooltip title="값이 설정된 컨테이너의 Limits만 합산하며, 미설정 컨테이너는 합계에서 제외합니다. 따라서 Requests보다 작게 표시될 수 있습니다.">
                                <span className="netdive-k8s-cluster-detail__metric-label-with-info">
                                    설정된 Limits 합계 <InfoCircleOutlined />
                                </span>
                            </Tooltip>}
                            value={config.limitsValue}
                            ratio={ratio(config.limitsPercent)}
                        />
                        {config.requestInsight && <div className={`netdive-k8s-cluster-detail__request-insight ${this.state.memoryRequestInsightExpanded ? 'is-expanded' : ''}`}>
                            <button
                                type="button"
                                className="netdive-k8s-cluster-detail__request-insight-summary"
                                aria-expanded={this.state.memoryRequestInsightExpanded}
                                onClick={() => this.setState({ memoryRequestInsightExpanded: !this.state.memoryRequestInsightExpanded })}>
                                <span>실제 사용량이 설정된 Requests 합계를 크게 초과합니다.</span>
                                <strong>{this.state.memoryRequestInsightExpanded ? '접기' : '확인'} <RightOutlined /></strong>
                            </button>
                            {this.state.memoryRequestInsightExpanded && <div className="netdive-k8s-cluster-detail__request-insight-detail">
                                <Typography.Text type="secondary">
                                    Requests는 사용 상한이 아닙니다. 리소스가 설정되지 않은 Pod 또는 일부 Pod의 높은 점유가 원인일 수 있어 확인이 필요합니다.
                                </Typography.Text>
                                <Space size={4} wrap>
                                    <Button type="link" size="small" onClick={config.requestInsight.onTopUsage}>상위 점유 Pod 보기</Button>
                                    <Button type="link" size="small" onClick={config.requestInsight.onUnsetRequests}>리소스 미설정 Pod 보기</Button>
                                </Space>
                            </div>}
                        </div>}
                    </React.Fragment>}
                </React.Fragment>}
        </ResourceMetricBlock>
    }

    private renderResourceCapacity(moldCluster: any, activePodCount: number, allocatablePodCount: number) {
        const resources = this.state.summary?.resources
        const metricsAvailable = !!resources?.metricsAvailable
        const provisionedCores = Number(moldCluster?.cores) || 0
        const provisionedMemory = Number(moldCluster?.memoryMb) || 0
        const allocatableCpu = Number(resources?.allocatableCpuCores) || 0
        const requestsCpu = Number(resources?.requestsCpuCores) || 0
        const limitsCpu = Number(resources?.limitsCpuCores) || 0
        const allocatableMemory = Number(resources?.allocatableMemoryBytes) || 0
        const requestsMemory = Number(resources?.requestsMemoryBytes) || 0
        const limitsMemory = Number(resources?.limitsMemoryBytes) || 0
        const requestCpuPercent = allocatableCpu > 0 ? clampPercent(requestsCpu / allocatableCpu * 100) : 0
        const requestMemoryPercent = allocatableMemory > 0 ? clampPercent(requestsMemory / allocatableMemory * 100) : 0
        const limitCpuPercent = allocatableCpu > 0 ? limitsCpu / allocatableCpu * 100 : 0
        const limitMemoryPercent = allocatableMemory > 0 ? limitsMemory / allocatableMemory * 100 : 0
        const usageCpu = Number(resources?.usageCpuCores) || 0
        const usageMemory = Number(resources?.usageMemoryBytes) || 0
        const usageCpuPercent = metricsAvailable && allocatableCpu > 0 ? usageCpu / allocatableCpu * 100 : undefined
        const usageMemoryPercent = metricsAvailable && allocatableMemory > 0 ? usageMemory / allocatableMemory * 100 : undefined
        const podUsagePercent = allocatablePodCount > 0 ? activePodCount / allocatablePodCount * 100 : undefined
        const provisionedMemoryBytes = provisionedMemory * 1024 * 1024
        const reservedMemory = provisionedMemoryBytes > allocatableMemory ? provisionedMemoryBytes - allocatableMemory : 0
        const metricsState = this.metricsState()

        if (!resources && !provisionedCores && !provisionedMemory) {
            return this.renderMetricsUnavailable(metricsState)
        }

        return (
            <div className="netdive-k8s-cluster-detail__capacity">
                {!metricsAvailable && this.renderMetricsUnavailable(metricsState, true)}
                {resources && (
                    <div className="netdive-k8s-cluster-detail__utilization-flat">
                        {this.renderUtilizationCard({
                            title: 'CPU',
                            unitTooltip: translate('kubernetesCpuUnitDescription'),
                            allocatableValue: allocatableCpu > 0 ? `${formatCoreNumber(allocatableCpu)} Core` : translate('kubernetesUnknown'),
                            usageValue: metricsAvailable ? `${formatCoreNumber(usageCpu)} Core` : translate('kubernetesNotCollected'),
                            requestsValue: `${formatCoreNumber(requestsCpu)} Core`,
                            limitsValue: `${formatCoreNumber(limitsCpu)} Core`,
                            usagePercent: usageCpuPercent,
                            requestsPercent: requestCpuPercent,
                            limitsPercent: limitCpuPercent,
                            allocatableAvailable: allocatableCpu > 0,
                            onUsageClick: metricsAvailable ? () => this.setState({ resourceUsageModal: 'cpu' }) : undefined
                        })}
                        <Divider />
                        {this.renderUtilizationCard({
                            title: translate('kubernetesMemory'),
                            unitTooltip: translate('kubernetesMemoryUnitDescription'),
                            allocatableValue: allocatableMemory > 0 ? formatGiB(allocatableMemory) : translate('kubernetesUnknown'),
                            usageValue: metricsAvailable ? formatGiB(usageMemory) : translate('kubernetesNotCollected'),
                            requestsValue: formatGiB(requestsMemory),
                            limitsValue: formatGiB(limitsMemory),
                            usagePercent: usageMemoryPercent,
                            requestsPercent: requestMemoryPercent,
                            limitsPercent: limitMemoryPercent,
                            allocatableAvailable: allocatableMemory > 0,
                            onUsageClick: metricsAvailable ? () => this.setState({ resourceUsageModal: 'memory' }) : undefined,
                            requestInsight: this.state.memoryRequestInsightVisible
                                ? {
                                    onTopUsage: () => this.setState({ resourceUsageModal: 'memory' }),
                                    onUnsetRequests: () => this.setState({ resourceUsageModal: 'memory-unset' })
                                }
                                : undefined
                        })}
                        <Divider />
                        {this.renderUtilizationCard({
                            title: 'Pod',
                            unitTooltip: '활성 Pod 수를 Kubernetes Node의 Allocatable Pod 합계와 비교합니다.',
                            allocatableValue: allocatablePodCount > 0 ? String(allocatablePodCount) : translate('kubernetesUnknown'),
                            usageValue: String(activePodCount),
                            usagePercent: podUsagePercent,
                            pod: true,
                            allocatableAvailable: allocatablePodCount > 0
                        })}
                    </div>
                )}
                <Divider className="netdive-k8s-cluster-detail__capacity-compare-divider" />
                <Collapse
                    bordered={false}
                    className="netdive-k8s-cluster-detail__capacity-compare-collapse"
                    expandIconPosition="right">
                    <Collapse.Panel
                        key="allocation-basis"
                        header={<span className="netdive-k8s-cluster-detail__capacity-compare-title">
                            <Typography.Text strong>할당 기준 비교</Typography.Text>
                            <Tooltip overlayClassName="netdive-k8s-cluster-detail__capacity-tooltip" title={<div>
                                <div>왼쪽 값은 Mold에서 Kubernetes 클러스터 VM에 할당한 총 vCPU와 메모리입니다.</div>
                                <div>오른쪽 값은 OS와 Kubernetes 시스템 예약분을 제외한 Allocatable 기준입니다.</div>
                                <div>CPU는 VM 할당량을 vCPU, Kubernetes 사용 가능 자원을 Core 단위로 표시합니다.</div>
                            </div>}>
                                <InfoCircleOutlined
                                    className="netdive-k8s-cluster-detail__metric-info"
                                    onClick={event => event.stopPropagation()} />
                            </Tooltip>
                        </span>}>
                        <div className="netdive-k8s-cluster-detail__capacity-compare">
                            <div className="netdive-k8s-cluster-detail__capacity-compare-columns" aria-hidden="true">
                                <span>구분</span>
                                <span>Mold 할당량</span>
                                <span>Kubernetes Allocatable</span>
                            </div>
                            <div className="netdive-k8s-cluster-detail__capacity-compare-row">
                                <Typography.Text type="secondary">CPU</Typography.Text>
                                <strong>{provisionedCores ? `${formatCoreNumber(provisionedCores)} vCPU` : translate('kubernetesNotCollected')}</strong>
                                <strong>{allocatableCpu ? `${formatCoreNumber(allocatableCpu)} Core` : translate('kubernetesNotCollected')}</strong>
                            </div>
                            <div className="netdive-k8s-cluster-detail__capacity-compare-row">
                                <Typography.Text type="secondary">메모리</Typography.Text>
                                <strong>{provisionedMemory ? formatBinaryBytes(provisionedMemoryBytes, 'GiB') : translate('kubernetesNotCollected')}</strong>
                                <strong>{allocatableMemory ? formatGiB(allocatableMemory) : translate('kubernetesNotCollected')}</strong>
                            </div>
                            {reservedMemory > 0 && <div className="netdive-k8s-cluster-detail__capacity-compare-note">
                                <span>시스템 예약분:</span>
                                <strong>메모리 {formatGiB(reservedMemory)}</strong>
                            </div>}
                        </div>
                    </Collapse.Panel>
                </Collapse>
            </div>
        )
    }

    private metricsState(): { label: string, tone: DetailBadgeTone, description: string } {
        if (this.state.summaryLoading) return { label: translate('kubernetesMetricsPreparing'), tone: 'warning', description: translate('kubernetesMetricsPreparingDescription') }
        if (this.state.summaryError) return { label: translate('kubernetesMetricsApiUnavailable'), tone: 'danger', description: translate('kubernetesMetricsApiUnavailableDescription') }
        if (!this.moldCluster()?.collectionEnabled) return { label: translate('kubernetesMetricsNotConfigured'), tone: 'default', description: translate('kubernetesMetricsNotConfiguredDescription') }
        if (this.state.summary?.resources?.metricsAvailable) return { label: translate('kubernetesMetricsNormal'), tone: 'success', description: translate('kubernetesMetricsNormalDescription') }
        return { label: translate('kubernetesMetricsNotConfigured'), tone: 'warning', description: translate('kubernetesMetricsNotConfiguredDescription') }
    }

    private renderMetricsUnavailable(state: { label: string, tone: DetailBadgeTone, description: string }, compact = false) {
        return (
            <div className={`netdive-k8s-cluster-detail__metrics-empty ${compact ? 'netdive-k8s-cluster-detail__metrics-empty--compact' : ''}`}>
                <InfoIcon />
                <div><strong>{translate('kubernetesMetricsCannotCollect')}</strong><span>{state.description}</span></div>
                <DetailBadge tone={state.tone}>{state.label}</DetailBadge>
            </div>
        )
    }

    private riskItems(nodeStatus: StatusSummary, podStatus: PodHealthSummary, unavailableWorkloads: Node[], affectedServices: number, hostPlacements: PlacementSummary[], switchPlacements: PlacementSummary[], controlPlane: StatusSummary, externalPathCount: number, externalPathsEvaluated: boolean): any[] {
        const risks: any[] = []
        if (nodeStatus.notReady) risks.push({ severity: 'critical', kind: 'current', title: translate('kubernetesRiskNotReadyNodes'), message: translate('kubernetesRiskNotReadyNodesDescription'), count: nodeStatus.notReady })
        if (podStatus.activeProblemNodes.length) risks.push({ severity: podStatus.unknownNodes.length ? 'critical' : 'warning', kind: 'current', title: '현재 문제 파드', message: '현재 운영에 영향을 줄 수 있는 활성 파드 문제입니다.', count: podStatus.activeProblemNodes.length })
        if (unavailableWorkloads.length) risks.push({ severity: 'critical', kind: 'current', title: '가용 Replica 부족', message: 'Desired Replica보다 Available 또는 Ready Replica가 부족한 워크로드입니다.', count: unavailableWorkloads.length })
        if (affectedServices) risks.push({ severity: 'critical', kind: 'current', title: translate('kubernetesAffectedServices'), message: translate('kubernetesAffectedServicesDescription'), count: affectedServices })
        const knownHosts = hostPlacements.filter(item => item.label !== translate('kubernetesPlacementUnknown'))
        const knownSwitches = switchPlacements.filter(item => item.label !== translate('kubernetesPlacementUnknown'))
        if (nodeStatus.total > 1 && knownHosts.length === 1 && knownHosts[0].count === nodeStatus.total) {
            risks.push({ severity: 'warning', kind: 'potential', category: translate('kubernetesRiskInfrastructure'), title: translate('kubernetesHostConcentrationRisk'), message: translate('kubernetesHostConcentrationRiskDescription'), value: '100%', short: translate('kubernetesSingleHost') })
        }
        if (nodeStatus.total > 1 && knownSwitches.length === 1 && knownSwitches[0].count === nodeStatus.total) {
            risks.push({ severity: 'warning', kind: 'potential', category: translate('kubernetesRiskNetwork'), title: translate('kubernetesSwitchConcentrationRisk'), message: translate('kubernetesSwitchConcentrationRiskDescription'), value: '100%', short: translate('kubernetesSingleSwitch') })
        }
        if (controlPlane.total === 1) {
            risks.push({ severity: 'warning', kind: 'potential', category: translate('kubernetesRiskAvailability'), title: translate('kubernetesSingleControlPlaneRisk'), message: translate('kubernetesSingleControlPlaneRiskDescription'), value: '1', short: 'Control Plane' })
        }
        if (externalPathsEvaluated && externalPathCount === 1) {
            risks.push({ severity: 'warning', kind: 'potential', category: translate('kubernetesRiskNetwork'), title: translate('kubernetesSingleExternalPathRisk'), message: translate('kubernetesSingleExternalPathRiskDescription'), value: '1', short: translate('kubernetesExternalPaths') })
        }
        const seen = new Set<string>()
        return risks.filter(risk => {
            const key = `${risk.title}|${risk.message}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        }).map(risk => ({ ...risk, category: risk.category || this.riskCategory(risk), kind: risk.kind || this.riskKind(risk) }))
    }

    private riskKind(risk: any): 'current' | 'potential' | 'data' {
        const text = `${risk?.title || ''} ${risk?.message || ''}`.toLowerCase()
        if (/미수집|metrics|수집|api 접근/.test(text)) return 'data'
        if (/concentration|single host|single switch|replica|hostpath|local pv|집중|단일 호스트|단일 스위치|단일 replica/.test(text)) return 'potential'
        return 'current'
    }

    private riskCategory(risk: any): string {
        const text = `${risk?.title || ''} ${risk?.message || ''}`.toLowerCase()
        if (/network|switch|네트워크|스위치|경로/.test(text)) return translate('kubernetesRiskNetwork')
        if (/storage|volume|pv|disk|스토리지|볼륨|디스크/.test(text)) return translate('kubernetesRiskStorage')
        if (/cpu|memory|resource|pressure|자원|메모리|압박/.test(text)) return translate('kubernetesRiskResource')
        if (/host|infra|물리|호스트|인프라/.test(text)) return translate('kubernetesRiskInfrastructure')
        if (/pod|workload|파드|워크로드/.test(text)) return translate('kubernetesRiskWorkload')
        return translate('kubernetesRiskAvailability')
    }

    private operationalStatus(controlPlane: StatusSummary, nodes: StatusSummary, pods: PodHealthSummary, unavailableWorkloads: Node[], affectedServices: number, _recentNodeSignals: number): { label: string, tone: DetailBadgeTone } {
        if (!nodes.total && !pods.total && !controlPlane.total) return { label: translate('kubernetesHealthUnknown'), tone: 'default' }
        if ((controlPlane.notReady || 0) > 0 || (nodes.notReady || 0) > 0 || pods.unknownNodes.length > 0 || unavailableWorkloads.length > 0 || affectedServices > 0) return { label: translate('kubernetesHealthCritical'), tone: 'danger' }
        if (pods.activeProblemNodes.length > 0) return { label: translate('kubernetesHealthWarning'), tone: 'warning' }
        return { label: translate('kubernetesHealthNormal'), tone: 'success' }
    }

    private placementAnalysis(items: PlacementSummary[], total: number, network = false): { label: string, tone: DetailBadgeTone, description: string, known: PlacementSummary[], topPercent: number } {
        const known = items.filter(item => item.label !== translate('kubernetesPlacementUnknown'))
        const knownCount = known.reduce((sum, item) => sum + item.count, 0)
        const topPercent = knownCount > 0 && known.length ? Math.round(known[0].count / knownCount * 100) : 0
        if (!knownCount) {
            return { label: translate('kubernetesHealthUnknown'), tone: 'default', description: network ? translate('kubernetesNetworkPlacementUnknown') : translate('kubernetesHostPlacementUnknown'), known, topPercent }
        }
        const prefix = network ? translate('kubernetesKnownNetworkBasis') : (knownCount < total ? translate('kubernetesKnownHostBasis') : '')
        if (known.length > 1 && topPercent <= 60) {
            return {
                label: translate('kubernetesDistributionGood'), tone: 'success', known, topPercent,
                description: `${prefix}${translate(network ? 'kubernetesNetworkDistributionGoodDescription' : 'kubernetesHostDistributionGoodDescription').replace('{nodes}', String(knownCount)).replace('{targets}', String(known.length))}`
            }
        }
        return {
            label: translate('kubernetesDistributionCaution'), tone: 'warning', known, topPercent,
            description: `${prefix}${translate(network ? 'kubernetesNetworkDistributionCautionDescription' : 'kubernetesHostDistributionCautionDescription').replace('{percent}', String(topPercent))}`
        }
    }

    private scoreGrade(score: number): { label: string, tone: DetailBadgeTone } {
        if (score >= 75) return { label: translate('kubernetesImpactCritical'), tone: 'danger' }
        if (score >= 50) return { label: translate('kubernetesImpactHigh'), tone: 'danger' }
        if (score >= 25) return { label: translate('kubernetesImpactCaution'), tone: 'warning' }
        return { label: translate('kubernetesImpactLow'), tone: 'success' }
    }

    private resilienceGrade(score: number, evaluated: boolean): { label: string, tone: DetailBadgeTone } {
        if (!evaluated) return { label: translate('kubernetesResilienceUnavailable'), tone: 'default' }
        if (score >= 75) return { label: translate('kubernetesResilienceVeryVulnerable'), tone: 'danger' }
        if (score >= 50) return { label: translate('kubernetesResilienceVulnerable'), tone: 'danger' }
        if (score >= 20) return { label: translate('kubernetesResilienceRecommended'), tone: 'warning' }
        return { label: translate('kubernetesResilienceGood'), tone: 'success' }
    }

    private renderResilienceRow(title: string, label: string, tone: DetailBadgeTone, value: React.ReactNode, short: string, tooltip?: React.ReactNode, onClick?: () => void) {
        const valueVariant: 'number' | 'grade' | 'score' = typeof value === 'number'
            ? 'number'
            : typeof value === 'string' && /^\s*\d+\s*\/\s*\d+\s*$/.test(value)
            ? 'score'
            : 'grade'
        return <StatusEvidenceRow
            title={title}
            evidence={short}
            status={{ label, tone }}
            value={value}
            valueVariant={valueVariant}
            tone={tone}
            tooltip={tooltip}
            onClick={onClick}
        />
    }

    private heroConclusion(controlPlane: StatusSummary, nodes: StatusSummary, pods: PodHealthSummary, unavailableWorkloads: Node[], affectedServices: number, _recentNodeSignals: number, currentRiskTitle?: string): string {
        if (controlPlane.notReady) return translate('kubernetesHeroControlPlaneFailure').replace('{count}', String(controlPlane.notReady))
        const workerNotReady = Math.max(0, (nodes.notReady || 0) - (controlPlane.notReady || 0))
        if (workerNotReady) return translate('kubernetesHeroWorkerFailure').replace('{count}', String(workerNotReady))
        if (affectedServices) return translate('kubernetesHeroServiceImpact').replace('{count}', String(affectedServices))
        if (unavailableWorkloads.length) return `가용 Replica가 부족한 워크로드 ${unavailableWorkloads.length}개가 있습니다.`
        if (pods.unknownNodes.length) return `Unknown 파드 ${pods.unknownNodes.length}개를 확인해야 합니다.`
        if (pods.activeProblemNodes.length) return `현재 문제 파드 ${pods.activeProblemNodes.length}개를 확인해야 합니다.`
        if (currentRiskTitle) return currentRiskTitle
        return translate('kubernetesHeroNoImpact')
    }

    private instabilityWindowMs(): number {
        const windows: Record<string, number> = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        }
        return windows[this.state.instabilityWindow] || windows['1h']
    }

    private instabilityWindowLabel(): string {
        const labels: Record<string, string> = { '1h': '1시간', '6h': '6시간', '24h': '24시간', '7d': '7일' }
        return labels[this.state.instabilityWindow] || labels['1h']
    }

    private compactEventTime(value?: number): string {
        if (!value) return '시각 확인 불가'
        const date = new Date(value)
        const pad = (part: number) => String(part).padStart(2, '0')
        return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    private compactFullDate(value?: number): string {
        if (!value) return '확인 불가'
        const date = new Date(value)
        const pad = (part: number) => String(part).padStart(2, '0')
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

    private podTerminationRecovery(node: Node, resources: Node[], unavailableWorkloads: Node[]): { label: string, tone: string } {
        const workloads = resources.filter(item => ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(String(item.data?.Type || '').toLowerCase()) >= 0)
        const workloadName = this.podWorkloadName(node, workloads)
        if (!workloadName) return { label: '확인 필요', tone: 'default' }
        const unavailable = unavailableWorkloads.some(item => firstValue(item.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) === workloadName)
        if (unavailable) return { label: '영향 중', tone: 'danger' }
        const namespace = firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
        const replacement = aggregatePods(resources, { namespace }).runningEntries
            .some(entry => this.podWorkloadName(entry.node, workloads) === workloadName)
        return replacement ? { label: '복구됨', tone: 'success' } : { label: '확인 필요', tone: 'default' }
    }

    private renderPodStatusList(nodes: Node[], resources: Node[], unavailableWorkloads: Node[], reasonLabel?: string, currentProblem = false) {
        if (!nodes.length) return <CompactEmptyState description="선택한 상태의 파드가 없습니다." compact />
        const workloads = resources.filter(item => ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(String(item.data?.Type || '').toLowerCase()) >= 0)
        return <div className="netdive-k8s-cluster-detail__eviction-list">{nodes.map(node => {
            const data = node.data || {}
            const name = firstValue(data, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) || node.id
            const namespace = firstValue(data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) || '–'
            const nodeName = firstValue(data, ['K8s.Node', 'NodeName', 'K8s.Extra.Spec.NodeName']) || '–'
            const workload = this.podWorkloadName(node, workloads) || '확인 불가'
            const timestamp = this.podTimestamp(node)
            const recovery = currentProblem
                ? { label: '현재 문제', tone: 'warning' }
                : this.podTerminationRecovery(node, resources, unavailableWorkloads)
            const message = firstValue(data, ['K8s.Extra.Status.Message', 'Message'])
            return <button type="button" key={node.id} className="netdive-k8s-cluster-detail__eviction-item" onClick={() => this.focusResources([node])}>
                <span className="netdive-k8s-cluster-detail__eviction-item-head">
                    <strong title={`${namespace}/${name}`}>{namespace}/{name}</strong>
                    <DetailBadge tone={recovery.tone as DetailBadgeTone}>{recovery.label}</DetailBadge>
                </span>
                <span className="netdive-k8s-cluster-detail__eviction-item-meta">
                    <span title={workload}>워크로드 · {workload}</span>
                    <span title={nodeName}>노드 · {nodeName}</span>
                </span>
                <span className="netdive-k8s-cluster-detail__eviction-item-foot">
                    <span>{reasonLabel || this.podPrimaryReason(node)}</span>
                    <Tooltip title={`시간 기준: ${timestamp.source}${timestamp.estimated ? ' (추정)' : ''}`}>
                        <span className={`netdive-k8s-cluster-detail__eviction-time ${timestamp.estimated ? 'is-estimated' : 'is-exact'}`}>
                            {timestamp.value && <b>{timestamp.estimated ? '추정' : '정확'}</b>}
                            <time>{timestamp.value ? formatRelativeDate(timestamp.value) : '마지막 발생 시각 확인 불가'}</time>
                        </span>
                    </Tooltip>
                </span>
                {message && <small title={message}>{message}</small>}
            </button>
        })}</div>
    }

    private renderTerminationHistoryTable(nodes: Node[]) {
        const rows = nodes.map(node => {
            const data = node.data || {}
            const classification = getPodClassification(node)
            const timestamp = this.podTimestamp(node)
            const name = firstValue(data, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) || node.id
            const namespace = firstValue(data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) || '없음'
            const nodeName = firstValue(data, ['K8s.Node', 'NodeName', 'K8s.Extra.Spec.NodeName']) || '없음'
            const reason = this.podPrimaryReason(node)
            const type = classification.evicted
                ? 'Evicted'
                : classification.completed
                    ? 'Succeeded'
                    : reason || classification.phase || '종료'
            const status = classification.completed ? '완료' : classification.evicted ? '주의' : '종료'
            return {
                key: node.id,
                node,
                timestamp,
                type,
                namespace,
                name,
                nodeName,
                reason,
                status
            }
        }).sort((a, b) => (b.timestamp.value || 0) - (a.timestamp.value || 0))

        return <Table
            className="netdive-k8s-cluster-detail__history-table netdive-modal-table"
            dataSource={rows}
            pagination={{ pageSize: 20, size: 'small', showSizeChanger: false }}
            rowKey="key"
            size="small"
            tableLayout="fixed"
            onRow={record => ({
                onClick: () => this.focusResources([record.node])
            })}
            columns={[
                {
                    title: 'Pod',
                    key: 'pod',
                    width: '55%',
                    render: (_value: any, record: any) => <DetailModalResourceCell
                        namespace={record.namespace}
                        name={record.name}
                        secondary={<React.Fragment>
                            <Tooltip title={`시간 기준: ${record.timestamp.source}${record.timestamp.estimated ? ' (추정)' : ''}`}>
                                <time className="netdive-k8s-cluster-detail__history-table-time">{this.compactFullDate(record.timestamp.value)}</time>
                            </Tooltip>
                            <span>{record.type}</span>
                            <Tag color={record.status === '완료' ? 'green' : record.status === '주의' ? 'orange' : undefined}>{record.status}</Tag>
                        </React.Fragment>} />
                },
                {
                    title: 'Node',
                    key: 'node',
                    width: '45%',
                    render: (_value: any, record: any) => <DetailModalTextCell
                        value={record.nodeName}
                        secondary={<span>사유 · {record.reason || '없음'}</span>} />
                }
            ]} />
    }

    private renderPodStatusSummary(summary: PodHealthSummary) {
        if (!summary.currentProblemGroups.length) return null
        return <div className="netdive-k8s-cluster-detail__pod-status-summary">
                <strong className="netdive-k8s-cluster-detail__pod-status-title">현재 문제 파드</strong>
                <div className="netdive-k8s-cluster-detail__pod-status-group is-current">
                    <div className="netdive-k8s-cluster-detail__pod-status-group-head">
                        <b>현재 문제</b>
                        <small>운영 상태 및 영향받은 서비스 판정에 반영</small>
                    </div>
                    <div className="netdive-k8s-cluster-detail__pod-status-items">
                        {summary.currentProblemGroups.map(item => <button
                            type="button"
                            key={item.key}
                            onClick={() => this.setState({ podStatusModalMode: 'current', podStatusModalKey: item.key })}>
                            <span>{item.label}</span>
                            <strong>{item.nodes.length}</strong>
                        </button>)}
                    </div>
                </div>
            </div>
    }

    private renderTerminationHistory(summary: PodHealthSummary) {
        const historyTotal = summary.terminationHistoryGroups.reduce((sum, group) => sum + group.nodes.length, 0)
        if (!historyTotal) return null
        const expanded = this.state.terminationHistoryExpanded
        const toggleExpanded = () => this.setState({ terminationHistoryExpanded: !expanded })

        return <div className={`netdive-k8s-cluster-detail__history-section${expanded ? ' is-expanded' : ''}`}>
                <Divider />
                <CollapsibleSummaryRow
                    title="과거 종료 이력"
                    summary={<span className="netdive-k8s-cluster-detail__history-total">총 <strong>{historyTotal}건</strong></span>}
                    expanded={expanded}
                    onToggle={toggleExpanded}>
                    <div className="netdive-k8s-cluster-detail__history-note">
                        현재 조회 가능한 종료 Pod 기준 · 현재 장애 판정에서 제외
                    </div>
                    <div className="netdive-k8s-cluster-detail__history-reasons">
                    {summary.terminationHistoryGroups
                        .filter(item => item.key === 'evicted' || item.key === 'succeeded')
                        .map(item => {
                            const tooltip = item.key === 'evicted'
                                ? 'Evicted는 노드 압박이나 kubelet 정책 등에 의해 종료된 Pod 이력입니다. 현재 활성 Pod 및 현재 장애 판정에는 포함되지 않으며, 최근 이상징후와 미복구 상태를 함께 확인해야 합니다.'
                                : 'Succeeded는 작업을 완료하고 종료된 Pod 이력입니다. 현재 활성 Pod 및 현재 장애 판정에는 포함되지 않습니다.'
                            return <Tooltip key={item.key} title={tooltip}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        this.setState({ podStatusModalMode: 'history', podStatusModalKey: item.key })
                                    }}>
                                    <span>{item.label}</span>
                                    <strong>{item.nodes.length}건</strong>
                                </button>
                            </Tooltip>
                        })}
                    </div>
                </CollapsibleSummaryRow>
            </div>
    }

    private recentChangeGroups(): RecentChangeGroup[] {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        const changes = Array.isArray(this.state.summary?.recentChanges)
            ? this.state.summary.recentChanges.filter(change => {
                const time = new Date(change.time).getTime()
                return !Number.isNaN(time) && time >= cutoff
            })
            : []
        const groups: RecentChangeGroup[] = []
        changes.forEach(change => {
            const tone = this.recentChangeTone(change)
            const time = new Date(change.time).getTime()
            const existing = groups.find(group => group.resource === change.resource
                && group.tone === tone
                && Math.abs(new Date(group.time).getTime() - time) <= 60 * 1000)
            if (existing) {
                existing.events.push(change)
                return
            }
            groups.push({ ...change, tone, events: [change] })
        })
        return groups
    }

    private recentChangeGroupTone(change: RecentChangeGroup): RecentChangeTone {
        const priority: Record<RecentChangeTone, number> = { default: 0, success: 1, warning: 2, danger: 3 }
        return change.events.reduce((representative, event) => {
            const eventTone = this.recentChangeTone(event)
            return priority[eventTone] > priority[representative] ? eventTone : representative
        }, change.tone)
    }

    private renderRecentChanges(groups: RecentChangeGroup[], limit?: number, context = 'panel') {
        if (!groups.length) return <div className="netdive-k8s-cluster-detail__change-empty">{translate('kubernetesNoRecentChanges')}</div>
        const visibleGroups = limit ? groups.slice(0, limit) : groups
        return (
            <div className={`netdive-k8s-cluster-detail__change-list ${context === 'modal' ? 'netdive-k8s-cluster-detail__change-list--modal' : ''}`}>
                {visibleGroups.map((change, index) => {
                    const representativeTone = this.recentChangeGroupTone(change)
                    const changeKey = `${context}-${change.resource}-${change.time}-${index}`
                    const expanded = this.state.expandedRecentChangeKey === changeKey
                    const additionalEvents = change.events.slice(1)
                    return (
                        <div key={changeKey} className={expanded ? 'is-expanded' : ''}>
                            <span className={`netdive-k8s-cluster-detail__change-dot netdive-k8s-cluster-detail__change-dot--${representativeTone}`} />
                            <div className="netdive-k8s-cluster-detail__change-main">
                                <div className="netdive-k8s-cluster-detail__change-heading">
                                    <Tooltip title={change.resource} placement="top">
                                        <strong>{change.resource}</strong>
                                    </Tooltip>
                                    <time>{formatDate(change.time)}</time>
                                </div>
                                <div className="netdive-k8s-cluster-detail__change-summary">
                                    <span>{change.message}</span>
                                    <small className={`netdive-k8s-cluster-detail__change-status netdive-k8s-cluster-detail__change-status--${representativeTone}`}>
                                        {this.recentChangeToneLabel(representativeTone)}
                                    </small>
                                    {additionalEvents.length > 0 && <button
                                        type="button"
                                        className="netdive-k8s-cluster-detail__change-count"
                                        aria-expanded={expanded}
                                        onClick={() => this.setState({ expandedRecentChangeKey: expanded ? '' : changeKey })}>
                                        {expanded
                                            ? translate('kubernetesCollapseEvents')
                                            : translate('kubernetesRelatedEvents').replace('{count}', String(additionalEvents.length))}
                                    </button>}
                                </div>
                                {expanded && <div className="netdive-k8s-cluster-detail__change-details">
                                    {additionalEvents.map((event, eventIndex) => <div className={`netdive-k8s-cluster-detail__change-detail-event netdive-k8s-cluster-detail__change-detail-event--${this.recentChangeTone(event)}`} key={`${event.time}-${eventIndex}`}>
                                        <time>{formatDate(event.time)}</time>
                                        <span className="netdive-k8s-cluster-detail__change-detail-message">
                                            <span>{event.message}</span>
                                            <small className={`netdive-k8s-cluster-detail__change-status netdive-k8s-cluster-detail__change-status--${this.recentChangeTone(event)}`}>
                                                {this.recentChangeToneLabel(this.recentChangeTone(event))}
                                            </small>
                                        </span>
                                    </div>)}
                                </div>}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    private recentChangeTone(change: any): RecentChangeTone {
        const severity = String(change?.severity || '').toLowerCase()
        const message = String(change?.message || '').toLowerCase()
        const signal = `${severity} ${message}`
        if (/critical|danger|failed|error|crashloopbackoff|imagepullbackoff|errimagepull|oomkilled/.test(signal)) return 'danger'
        if (/(ready|containersready)\s*:\s*false\b/.test(message)
            || /(replicafailure|degraded)\s*:\s*true\b/.test(message)) return 'danger'
        if (/warning|warn/.test(signal)
            || /(memorypressure|diskpressure|pidpressure|networkunavailable)\s*:\s*true\b/.test(message)
            || /unschedulable\s*:\s*true\b/.test(message)
            || /(initialized|podscheduled|podreadytostartcontainers)\s*:\s*false\b/.test(message)) return 'warning'
        if (/(ready|containersready|initialized|podscheduled|podreadytostartcontainers|available|progressing)\s*:\s*true\b/.test(message)
            || /(memorypressure|diskpressure|pidpressure|networkunavailable|unschedulable|replicafailure|degraded)\s*:\s*false\b/.test(message)) return 'success'
        return 'default'
    }

    private recentChangeToneLabel(tone: string): string {
        if (tone === 'success') return translate('kubernetesHealthNormal')
        if (tone === 'warning') return translate('kubernetesHealthWarning')
        if (tone === 'danger') return translate('kubernetesHealthCritical')
        return translate('kubernetesEventInfo')
    }

    render() {
        const data = this.props.node.data || {}
        const moldCluster = this.moldCluster()
        const resources = this.clusterResources()
        const summaries = this.resourceSummaries()
        const name = firstValue(data, ['Name', 'K8s.Name', 'ClusterName', 'clusterName']) || moldCluster?.name || this.props.node.id
        const uid = this.state.summary?.clusterUid || firstValue(data, ['K8s.Extra.ObjectMeta.UID', 'UID', 'UUID', 'ID'])
        const apiServer = moldCluster?.apiServer || firstValue(data, ['APIServer', 'ApiServer', 'apiServer', 'K8s.APIServer'])
        const version = this.kubernetesVersion(resources, moldCluster)
        const createdAt = formatDate(moldCluster?.created || firstRaw(data, ['K8s.Extra.ObjectMeta.CreationTimestamp.Time', 'CreationTimestamp', 'CreatedAt', '@CreatedAt']))
        const updatedAt = formatDate(firstRaw(data, ['UpdatedAt', 'LastUpdate', 'LastSeen', '@UpdatedAt']))
        const collectedAt = formatDate(this.state.summary?.lastSyncAt || this.state.summary?.collectedAt)
        const labels = this.labels()
        const annotations = this.annotations()
        const recentChangeGroups = this.recentChangeGroups()
        const topologyNodeSummary = this.topologyStatus(resources, 'node')
        const nodeSummary = topologyNodeSummary.total ? topologyNodeSummary : this.state.summary?.nodes || topologyNodeSummary
        const podSummary = this.podHealth(resources, this.instabilityWindowMs())
        const topologyControlPlane = this.controlPlaneStatus(resources)
        const controlPlane = topologyControlPlane.total ? topologyControlPlane : this.state.summary?.controlPlane || topologyControlPlane
        const nodeResource = summaries.find(summary => summary.type === 'node') as ResourceSummary
        const namespaceResource = summaries.find(summary => summary.type === 'namespace') as ResourceSummary
        const podResource = summaries.find(summary => summary.type === 'pod') as ResourceSummary
        const activePodResources = aggregatePods(podResource.nodes).activeEntries.map(entry => entry.node)
        const memoryRequestUnsetPods = activePodResources.filter(podHasUnsetMemoryRequest)
        const nodeAllocatablePodValues = nodeResource.nodes.map(node => quantityNumber(firstRaw(node.data || {}, [
            'K8s.Extra.Status.Allocatable.pods',
            'K8s.Extra.Status.Allocatable.Pods',
            'K8s.Status.Allocatable.pods',
            'K8s.Allocatable.pods',
            'Allocatable.pods',
            'Allocatable.Pods'
        ])))
        // 최대 Pod는 고정값이나 노드 수 기반 추정치를 사용하지 않습니다.
        // 모든 Kubernetes Node에서 status.allocatable.pods가 확인될 때만
        // 합계를 노출하고, 하나라도 누락되면 compact 활성 Pod 수만 표시합니다.
        const nodeAllocatablePodCount = nodeAllocatablePodValues.length > 0
            && nodeAllocatablePodValues.every(value => value > 0)
            ? nodeAllocatablePodValues.reduce((total, value) => total + value, 0)
            : 0
        // summary.resources.allocatablePods 역시 수집기가 각 Node의
        // status.allocatable.pods를 합산한 값입니다. 토폴로지 Node 메타데이터가
        // 축약되어 있을 때만 이 원본 합계로 보완하며 노드 수×고정값 추정은 하지 않습니다.
        const collectedAllocatablePodCount = quantityNumber(firstRaw(this.state.summary?.resources || {}, [
            'allocatablePods',
            'podAllocatable',
            'allocatablePodCount'
        ]))
        const allocatablePodCount = nodeAllocatablePodCount || collectedAllocatablePodCount
        const serviceResource = summaries.find(summary => summary.type === 'service') as ResourceSummary
        const persistentVolumeResource = summaries.find(summary => summary.type === 'persistentvolume') as ResourceSummary
        const persistentVolumeClaimResource = summaries.find(summary => summary.type === 'persistentvolumeclaim') as ResourceSummary
        const storageClassResource = summaries.find(summary => summary.type === 'storageclass') as ResourceSummary
        const workloadNodes = resources.filter(node => ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(String(node.data?.Type || '').toLowerCase()) >= 0)
        const unavailableWorkloads = this.unavailableWorkloads(resources)
        const recentNodeSignals = this.recentNodeSignalNodes(resources, this.instabilityWindowMs())
        const namespaceCount = this.state.summary?.namespaceCount !== undefined ? this.state.summary.namespaceCount : this.state.summary?.namespaces !== undefined ? this.state.summary.namespaces : namespaceResource.nodes.length
        // The service tab and the connected-resource card intentionally share
        // this one collection/count so their badges cannot drift apart.
        const serviceCount = serviceResource.nodes.length
        const hostPlacements = this.nodePlacements(resources)
        const switchPlacements = this.switchPlacements(hostPlacements)
        const affectedServices = this.affectedServiceCount()
        const externalPathCount = Number(this.state.summary?.externalPathCount) || 0
        const impactScore = Math.min(100, (nodeSummary.notReady || 0) * 30 + (podSummary.activeProblemNodes.length + unavailableWorkloads.length) * 10 + affectedServices * 10)
        const hostAnalysis = this.placementAnalysis(hostPlacements, nodeSummary.total)
        const networkAnalysis = this.placementAnalysis(switchPlacements, nodeSummary.total, true)
        const topologyNodes = this.topologyNodes()
        const hostEvidenceTargets = topologyNodes.filter(node => String(node.data?.Type || '').toLowerCase() === 'host'
            && hostAnalysis.known.some(item => item.label === (firstValue(node.data || {}, ['Name', 'Hostname']) || node.id)))
        const networkEvidenceTargets = topologyNodes.filter(node => String(node.data?.Type || '').toLowerCase() === 'switch'
            && networkAnalysis.known.some(item => item.label === (firstValue(node.data || {}, ['Name', 'SystemName', 'ChassisID']) || node.id)))
        const controlPlaneTargets = nodeResource.nodes.filter(node => this.controlPlaneNode(node))
        const currentImpactInfrastructureTargets = nodeResource.nodes.filter(node => !this.nodeReady(node))
        const affectedWorkloadTargets = [
            ...podSummary.activeProblemNodes,
            ...unavailableWorkloads
        ]
        const hostDistributionEvidenceTargets = [
            ...nodeResource.nodes,
            ...hostEvidenceTargets
        ]
        const networkResilienceEvidenceTargets = [
            ...nodeResource.nodes,
            ...hostEvidenceTargets,
            ...networkEvidenceTargets
        ]
        const structuralEvidenceTargets = [
            this.props.node,
            ...hostDistributionEvidenceTargets,
            ...networkEvidenceTargets,
            ...controlPlaneTargets
        ]
        const knownHostNodeCount = hostAnalysis.known.reduce((sum, item) => sum + item.count, 0)
        const knownNetworkNodeCount = networkAnalysis.known.reduce((sum, item) => sum + item.count, 0)
        const hostPlacementEvaluated = knownHostNodeCount > 0
        const networkPlacementEvaluated = knownNetworkNodeCount > 0
        const externalPathsEvaluated = !!this.state.summary
        const hostRiskScore = knownHostNodeCount === nodeSummary.total && hostAnalysis.known.length === 1 && nodeSummary.total > 1 ? 25 : 0
        const networkRiskScore = knownNetworkNodeCount === nodeSummary.total && networkAnalysis.known.length === 1 && nodeSummary.total > 1 ? 20 : 0
        const backendInfrastructureRiskScore = this.state.summary?.infrastructureRiskScore
        const potentialScore = Math.min(100, backendInfrastructureRiskScore !== undefined
            ? Number(backendInfrastructureRiskScore) + hostRiskScore + networkRiskScore
            : hostRiskScore + networkRiskScore + (controlPlane.total === 1 ? 15 : 0) + (externalPathsEvaluated && externalPathCount === 1 ? 10 : 0))
        const potentialEvaluated = hostPlacementEvaluated || networkPlacementEvaluated || controlPlane.total > 0 || externalPathsEvaluated
        const potentialScoreFactors: Array<{ label: string, score: number }> = [
            ...(backendInfrastructureRiskScore !== undefined && Number(backendInfrastructureRiskScore) > 0
                ? [{ label: '수집된 구조적 위험 분석', score: Number(backendInfrastructureRiskScore) }]
                : []),
            ...(hostRiskScore ? [{ label: '단일 물리 호스트 집중', score: hostRiskScore }] : []),
            ...(networkRiskScore ? [{ label: '단일 스위치 경로 집중', score: networkRiskScore }] : []),
            ...(backendInfrastructureRiskScore === undefined && controlPlane.total === 1
                ? [{ label: '단일 Control Plane 구성', score: 15 }]
                : []),
            ...(backendInfrastructureRiskScore === undefined && externalPathsEvaluated && externalPathCount === 1
                ? [{ label: '단일 외부 연결 경로', score: 10 }]
                : [])
        ]
        const potentialScoreTooltip = <div className="netdive-k8s-cluster-detail__risk-score-tooltip">
            <strong>구조적 위험도 {potentialEvaluated ? `${potentialScore} / 100` : '평가 불가'}</strong>
            <p>점수가 높을수록 구조적 위험이 큽니다. 현재 장애 점수와 별도로 배치·연결 구조만 평가합니다.</p>
            <span>현재 계산에 반영된 항목</span>
            {potentialScoreFactors.length
                ? <ul>{potentialScoreFactors.map(factor => <li key={factor.label}><span>{factor.label}</span><b>+{factor.score}점</b></li>)}</ul>
                : <p>현재 확인된 가산 항목이 없습니다.</p>}
            <small>가산 항목의 합계를 최대 100점으로 제한합니다.</small>
        </div>
        const nodeStatusCollected = this.state.summary?.nodes !== undefined || nodeResource.nodes.length > 0
        const controlPlaneCollected = this.state.summary?.controlPlane !== undefined || controlPlane.total > 0
        const podStatusCollected = this.state.summary?.pods !== undefined || podResource.nodes.length > 0
        const affectedServicesCollected = this.state.summary?.currentlyImpactedServiceCount !== undefined
            || this.state.summary?.affectedServices !== undefined
            || (nodeStatusCollected && !(nodeSummary.notReady || 0))
        const confidenceSignals = [
            { key: 'node', requiredForCurrentState: true, label: translate('kubernetesConfidenceDataNodeReady'), collected: nodeStatusCollected },
            { key: 'control-plane', requiredForCurrentState: true, label: translate('kubernetesConfidenceDataControlPlane'), collected: controlPlaneCollected },
            { key: 'pods', requiredForCurrentState: true, label: translate('kubernetesConfidenceDataPodStatus'), collected: podStatusCollected },
            { key: 'services', requiredForCurrentState: true, label: translate('kubernetesConfidenceDataAffectedServices'), collected: affectedServicesCollected },
            { key: 'hosts', requiredForCurrentState: false, label: translate('kubernetesConfidenceDataHostDistribution'), collected: hostPlacementEvaluated && knownHostNodeCount >= nodeSummary.total },
            { key: 'network', requiredForCurrentState: false, label: translate('kubernetesConfidenceDataNetworkPath'), collected: networkPlacementEvaluated && knownNetworkNodeCount >= nodeSummary.total },
            { key: 'external', requiredForCurrentState: false, label: translate('kubernetesConfidenceDataExternalPath'), collected: externalPathsEvaluated }
        ]
        const confidenceCollected = confidenceSignals.filter(signal => signal.collected).map(signal => signal.label)
        const confidenceMissing = confidenceSignals.filter(signal => !signal.collected).map(signal => signal.label)
        const requiredCurrentStateCollected = confidenceSignals.filter(signal => signal.requiredForCurrentState).every(signal => signal.collected)
        const confidenceState = confidenceCollected.length === 0
            ? 'unavailable' as const
            : confidenceMissing.length === 0
                ? 'sufficient' as const
                : requiredCurrentStateCollected
                    ? 'partial' as const
                    : 'insufficient' as const
        const risks = this.riskItems(nodeSummary, podSummary, unavailableWorkloads, affectedServices, hostPlacements, switchPlacements, controlPlane, externalPathCount, externalPathsEvaluated)
        const availabilityHealth = this.operationalStatus(controlPlane, nodeSummary, podSummary, unavailableWorkloads, affectedServices, recentNodeSignals.length)
        const currentRisks = risks.filter(risk => risk.kind === 'current')
        const health = availabilityHealth.tone === 'success' && currentRisks.some(risk => risk.severity === 'critical')
            ? { label: translate('kubernetesHealthCritical'), tone: 'danger' as DetailBadgeTone }
            : availabilityHealth.tone === 'success' && currentRisks.some(risk => risk.severity === 'warning')
            ? { label: translate('kubernetesHealthWarning'), tone: 'warning' as DetailBadgeTone }
            : availabilityHealth
        const heroConclusion = this.heroConclusion(controlPlane, nodeSummary, podSummary, unavailableWorkloads, affectedServices, recentNodeSignals.length, currentRisks[0]?.title)
        const currentImpactGrade = impactScore === 0
            ? { label: translate('kubernetesHealthNormal'), tone: 'success' as DetailBadgeTone }
            : this.scoreGrade(impactScore)
        const potentialGrade = this.resilienceGrade(potentialScore, potentialEvaluated)
        const metricState = this.metricsState()
        const externalAnalysis = !externalPathsEvaluated
            ? { label: translate('kubernetesResilienceUnavailable'), tone: 'default' as DetailBadgeTone, value: '–', short: '수집 상태 미확인 · 평가 불가', description: translate('kubernetesExternalPathUnknownDescription') }
            : externalPathCount === 1
            ? { label: translate('kubernetesResilienceRecommended'), tone: 'warning' as DetailBadgeTone, value: '낮음', short: '외부 노출 경로 1개 · 단일 외부 경로', description: translate('kubernetesExternalPathSingleDescription') }
            : { label: translate('kubernetesResilienceGood'), tone: 'success' as DetailBadgeTone, value: externalPathCount ? '다중 경로' : '노출 없음', short: externalPathCount ? `외부 노출 경로 ${externalPathCount}개 · 다중 외부 경로` : '외부 노출 경로 0개 · 확인된 외부 노출 경로 없음', description: externalPathCount > 1 ? translate('kubernetesExternalPathMultipleDescription').replace('{count}', String(externalPathCount)) : translate('kubernetesExternalPathNoneDescription') }
        const overviewRows: any[] = [
            { label: translate('kubernetesClusterName'), value: name, textValue: name, copyText: name },
            { label: translate('kubernetesVersion'), value: version || translate('kubernetesUnknown') },
            moldCluster?.state ? { label: translate('kubernetesMoldDeploymentStatus'), value: <DetailBadge tone={/running/i.test(moldCluster.state) ? 'success' : 'warning'}>{moldCluster.state}</DetailBadge> } : null
        ].filter(Boolean)
        const advancedRows: any[] = [
            { label: translate('kubernetesApiServer'), value: apiServer || translate('kubernetesNoConnectionInfo'), textValue: apiServer, copyText: apiServer || undefined },
            moldCluster?.zoneName ? { label: translate('kubernetesZone'), value: moldCluster.zoneName } : null,
            moldCluster?.networkName ? { label: translate('kubernetesNetwork'), value: moldCluster.networkName } : null,
            { label: translate('kubernetesClusterUid'), value: uid || translate('kubernetesNotCollected'), textValue: uid, copyText: uid || undefined },
            { label: translate('kubernetesMoldClusterId'), value: moldCluster?.id || translate('kubernetesNoConnectionInfo'), textValue: moldCluster?.id, copyText: moldCluster?.id },
            moldCluster?.serviceOffering ? { label: translate('kubernetesServiceOffering'), value: moldCluster.serviceOffering } : null,
            createdAt ? { label: translate('kubernetesCreatedAt'), value: createdAt } : null
        ].filter(Boolean)
        const podStatusCollectedForDisplay = this.state.summary?.pods !== undefined || podResource.nodes.length > 0
        const displayedPodTotal = podResource.nodes.length > 0 ? podSummary.total : Number(this.state.summary?.pods?.total || 0)
        const displayedRunningPods = podResource.nodes.length > 0 ? podSummary.running : Number(this.state.summary?.pods?.running || 0)
        const displayedPendingPods = podResource.nodes.length > 0 ? podSummary.pending : Number(this.state.summary?.pods?.pending || 0)
        const serviceStatusCollectedForDisplay = !!this.state.summary || serviceResource.nodes.length > 0
        const availabilityItems: any[] = [
            {
                key: 'control-plane',
                label: 'Control Plane',
                value: controlPlane.total ? `${controlPlane.ready || 0}/${controlPlane.total}` : '–',
                details: [
                    { label: 'Ready', value: controlPlane.total ? controlPlane.ready || 0 : '–' },
                    { label: 'Degraded', value: controlPlane.total ? controlPlane.notReady || 0 : '–' }
                ]
            },
            {
                key: 'nodes',
                label: translate('kubernetesTopologyNodes'),
                value: nodeSummary.total ? `${nodeSummary.ready || 0}/${nodeSummary.total}` : '–',
                details: [
                    { label: 'Ready', value: nodeSummary.total ? nodeSummary.ready || 0 : '–' },
                    { label: 'NotReady', value: nodeSummary.total ? nodeSummary.notReady || 0 : '–' }
                ]
            },
            {
                key: 'pods',
                label: translate('kubernetesTopologyPods'),
                value: podStatusCollectedForDisplay ? displayedPodTotal : '–',
                details: [
                    { label: 'Running', value: podStatusCollectedForDisplay ? displayedRunningPods : '–' },
                    { label: 'Pending', value: podStatusCollectedForDisplay ? displayedPendingPods : '–' },
                    { label: '현재 문제', value: podStatusCollectedForDisplay ? podSummary.activeProblemNodes.length : '–' },
                    { label: 'Unknown', value: podStatusCollectedForDisplay ? podSummary.unknownNodes.length : '–' },
                    { label: '완료', value: podStatusCollectedForDisplay ? podSummary.succeeded : '–' }
                ]
            },
            {
                key: 'services',
                label: KUBERNETES_DETAIL_LABELS.affectedServices,
                value: serviceStatusCollectedForDisplay ? affectedServices : '–',
                tooltip: 'Ready Endpoint가 없거나 현재 문제 워크로드에만 의존하는 Service 수입니다.',
                details: [
                    { label: translate('kubernetesNoServiceImpact'), value: serviceStatusCollectedForDisplay ? Math.max(0, serviceCount - affectedServices) : '–' },
                    { label: translate('kubernetesServiceAffected'), value: serviceStatusCollectedForDisplay ? affectedServices : '–' }
                ]
            }
        ]
        const abnormalItems = [
            ...(controlPlane.notReady ? [{ key: 'control-plane', label: KUBERNETES_DETAIL_LABELS.controlPlane, status: 'Degraded', value: controlPlane.notReady, tone: 'danger' }] : []),
            ...(nodeSummary.notReady ? [{ key: 'nodes', label: translate('kubernetesTopologyNodes'), status: 'NotReady', value: nodeSummary.notReady, tone: 'danger' }] : []),
            ...(podSummary.activeProblemNodes.length ? [{ key: 'pods-active', label: '현재 문제 파드', status: '활성 문제', value: podSummary.activeProblemNodes.length, tone: podSummary.unknownNodes.length ? 'danger' : 'warning', nodes: podSummary.activeProblemNodes }] : []),
            ...(podSummary.unknownNodes.length ? [{ key: 'pods-unknown', label: translate('kubernetesTopologyPods'), status: 'Unknown', value: podSummary.unknownNodes.length, tone: 'danger', nodes: podSummary.unknownNodes }] : []),
            ...(unavailableWorkloads.length ? [{ key: 'workloads-unavailable', label: KUBERNETES_DETAIL_LABELS.workloadController, status: 'Replica 부족', value: unavailableWorkloads.length, tone: 'danger', nodes: unavailableWorkloads }] : []),
            ...(affectedServices ? [{ key: 'services', label: KUBERNETES_DETAIL_LABELS.affectedServices, status: translate('kubernetesServiceAffected'), value: affectedServices, tone: 'danger' }] : [])
        ]
        const activeAnomalyNodes = podSummary.activeProblemNodes.filter(node => {
            const classification = getPodClassification(node)
            if (!classification.problemReasons.some(reason => reason === 'crashloopbackoff' || reason === 'oomkilled')) return false
            const timestamp = this.podTimestamp(node).value
            return timestamp !== undefined && timestamp >= Date.now() - this.instabilityWindowMs()
        })
        const terminationAnomalyNodes = podSummary.recentTerminationNodes.filter(node => {
            const classification = getPodClassification(node)
            return !classification.completed && classification.reason !== 'completed'
        })
        const recentAnomalyPodNodes = Array.from([...terminationAnomalyNodes, ...activeAnomalyNodes]
            .reduce((items, node) => items.set(node.id, node), new Map<string, Node>())
            .values())
        const recentPressureSignals = recentNodeSignals.reduce<Array<{ node: Node, type: string, timestamp: number }>>((items, node) => {
            const transitionTimes = firstRaw(node.data || {}, ['K8s.ConditionTransitionTimes', 'ConditionTransitionTimes']) || {}
            const conditions = firstRaw(node.data || {}, ['K8s.Extra.Status.Conditions', 'Conditions'])
            const abnormalConditions = ['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable']
                .map(type => {
                    const condition = Array.isArray(conditions)
                        ? conditions.find(item => String(item?.Type || '').toLowerCase() === type.toLowerCase())
                        : undefined
                    const timestamp = new Date(transitionTimes[type]).getTime()
                    return { type, timestamp, active: String(condition?.Status || '').toLowerCase() === 'true' }
                })
                .filter(item => item.active && !Number.isNaN(item.timestamp) && item.timestamp >= Date.now() - this.instabilityWindowMs())
            abnormalConditions.forEach(item => items.push({ node, type: item.type, timestamp: item.timestamp }))
            return items
        }, [])
        const recentAffectedNodeNames = new Set([
            ...recentAnomalyPodNodes.map(node => firstValue(node.data || {}, ['K8s.Node', 'NodeName', 'K8s.Extra.Spec.NodeName'])),
            ...recentPressureSignals.map(item => firstValue(item.node.data || {}, ['Name', 'K8s.Name']))
        ].filter(Boolean))
        const historyNodeTargets = nodeResource.nodes.filter(node => recentAffectedNodeNames.has(firstValue(node.data || {}, ['Name', 'K8s.Name'])))
        const recentAffectedWorkloadNames = new Set(recentAnomalyPodNodes.map(node => this.podWorkloadName(node, workloadNodes)).filter(Boolean))
        const historyWorkloadTargets = workloadNodes.filter(node => recentAffectedWorkloadNames.has(firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'])))
        const unrecoveredWorkloadTargets = unavailableWorkloads.filter(node => recentAffectedWorkloadNames.has(firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'])))
        const affectedServiceFocusTargets = Array.from([
            ...podSummary.activeProblemNodes,
            ...unavailableWorkloads
        ].reduce((items, node) => items.set(node.id, node), new Map<string, Node>()).values())
        const selectedPodStatusGroup = this.state.podStatusModalMode === 'current'
            ? podSummary.currentProblemGroups.find(group => group.key === this.state.podStatusModalKey)
            : podSummary.terminationHistoryGroups.find(group => group.key === this.state.podStatusModalKey)
        const selectedPodStatusNodes = this.state.podStatusModalMode === 'recent'
            ? recentAnomalyPodNodes
            : selectedPodStatusGroup?.nodes
                || (this.state.podStatusModalMode === 'history' && !this.state.podStatusModalKey ? podSummary.terminationHistoryNodes : [])
        const historyWindowAvailable = !podSummary.terminationHistoryNodes.length || podSummary.timestampAvailableCount > 0
        const nodeWindowAvailable = this.nodeSignalTimestampsAvailable(resources)
        const instabilityWindowAvailable = historyWindowAvailable || nodeWindowAvailable
        const hasRecentInstability = recentAnomalyPodNodes.length > 0 || recentPressureSignals.length > 0
        const hasCurrentInstabilityImpact = activeAnomalyNodes.length > 0
            || recentPressureSignals.length > 0
            || unrecoveredWorkloadTargets.length > 0
        const recentInstabilityItems = [
            ...recentAnomalyPodNodes.map(node => {
                const timestamp = this.podTimestamp(node)
                const namespace = firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
                const podName = firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) || node.id
                const reason = this.podPrimaryReason(node)
                const normalizedReason = reason.toLowerCase()
                const danger = normalizedReason.indexOf('crashloop') >= 0 || normalizedReason.indexOf('oomkilled') >= 0
                return {
                    key: `pod-${node.id}`,
                    timestamp: timestamp.value || 0,
                    time: this.compactEventTime(timestamp.value),
                    resource: namespace ? `${namespace}/${podName}` : podName,
                    resourceName: podName,
                    namespace: namespace || 'default',
                    resourceType: 'Pod',
                    detail: reason,
                    severity: danger ? '위험' : '주의',
                    tone: danger ? 'danger' as const : 'warning' as const,
                    nodes: [node]
                }
            }),
            ...recentPressureSignals.map(item => {
                const nodeName = firstValue(item.node.data || {}, ['Name', 'K8s.Name']) || item.node.id
                return {
                    key: `node-${item.node.id}-${item.type}`,
                    timestamp: item.timestamp,
                    time: this.compactEventTime(item.timestamp),
                    resource: nodeName,
                    resourceName: nodeName,
                    namespace: '',
                    resourceType: 'Node',
                    detail: item.type,
                    severity: '주의',
                    tone: 'warning' as const,
                    nodes: [item.node]
                }
            })
        ].sort((a, b) => b.timestamp - a.timestamp)
        const podUsageItems = (Array.isArray(this.state.summary?.resources?.podUsage)
            ? this.state.summary.resources.podUsage
            : []).map((item: any) => {
                const nodeName = String(item.nodeName || '')
                const node = nodeResource.nodes.find(candidate =>
                    firstValue(candidate.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) === nodeName)
                const nodeData = node?.data || {}
                const namespace = String(item.namespace || '')
                const podName = String(item.name || '')
                const pod = podResource.nodes.find(candidate =>
                    firstValue(candidate.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) === podName
                    && firstValue(candidate.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) === namespace)
                const podSpec = firstRaw(pod?.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
                const responseRequest = kubernetesCpuCores(
                    item.requestCpuCores ?? item.cpuRequestCores ?? item.requestsCpuCores ?? item.cpuRequest
                )
                const responseLimit = kubernetesCpuCores(
                    item.limitCpuCores ?? item.cpuLimitCores ?? item.limitsCpuCores ?? item.cpuLimit
                )
                const responseMemoryRequest = kubernetesMemoryBytes(
                    item.requestMemoryBytes ?? item.memoryRequestBytes ?? item.requestsMemoryBytes ?? item.memoryRequest
                )
                const responseMemoryLimit = kubernetesMemoryBytes(
                    item.limitMemoryBytes ?? item.memoryLimitBytes ?? item.limitsMemoryBytes ?? item.memoryLimit
                )
                return {
                    namespace,
                    name: podName,
                    nodeName,
                    usageCpuCores: Number(item.usageCpuCores) || 0,
                    usageMemoryBytes: Number(item.usageMemoryBytes) || 0,
                    requestCpuCores: responseRequest !== undefined
                        ? responseRequest
                        : podCpuResourceCores(podSpec, 'Requests'),
                    limitCpuCores: responseLimit !== undefined
                        ? responseLimit
                        : podCpuResourceCores(podSpec, 'Limits'),
                    requestMemoryBytes: responseMemoryRequest !== undefined
                        ? responseMemoryRequest
                        : podMemoryResourceBytes(podSpec, 'Requests'),
                    limitMemoryBytes: responseMemoryLimit !== undefined
                        ? responseMemoryLimit
                        : podMemoryResourceBytes(podSpec, 'Limits'),
                    // Pod 사용률은 해당 Pod가 배치된 Kubernetes Node의
                    // status.allocatable 값을 기준으로 계산합니다.
                    nodeAllocatableCpuCores: kubernetesCpuCores(firstRaw(nodeData, [
                        'K8s.Extra.Status.Allocatable.cpu',
                        'K8s.Extra.Status.Allocatable.Cpu',
                        'K8s.Status.Allocatable.cpu',
                        'K8s.Allocatable.cpu',
                        'Allocatable.cpu',
                        'Allocatable.Cpu'
                    ])),
                    nodeAllocatableMemoryBytes: kubernetesMemoryBytes(firstRaw(nodeData, [
                        'K8s.Extra.Status.Allocatable.memory',
                        'K8s.Extra.Status.Allocatable.Memory',
                        'K8s.Status.Allocatable.memory',
                        'K8s.Allocatable.memory',
                        'Allocatable.memory',
                        'Allocatable.Memory'
                    ]))
                }
            })
        const selectedUsageItems = podUsageItems
            .slice()
            .sort((left: any, right: any) => this.state.resourceUsageModal === 'memory'
                ? right.usageMemoryBytes - left.usageMemoryBytes
                : right.usageCpuCores - left.usageCpuCores)
            .slice(0, 20)
        const podNodeForUsage = (usage: any) => podResource.nodes.find(node => {
            const podName = firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'])
            const namespace = firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
            return podName === usage.name && namespace === usage.namespace
        })
        const usageRelationshipTargets = (usage: any) => {
            const pod = podNodeForUsage(usage)
            const node = nodeResource.nodes.find(candidate => firstValue(candidate.data || {}, ['Name', 'K8s.Name']) === usage.nodeName)
            const workloadName = pod ? this.podWorkloadName(pod, workloadNodes) : ''
            const workload = workloadNodes.find(candidate => firstValue(candidate.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) === workloadName)
            return [pod, workload, node].filter((target): target is Node => !!target)
        }
        const rawClusterStatus = this.state.summary?.apiConnectionStatus || (controlPlane.total && controlPlane.ready === controlPlane.total ? 'API Healthy' : '확인 불가')
        const collectionTimeText = collectedAt
            ? `${formatRelativeDate(this.state.summary?.lastSyncAt || this.state.summary?.collectedAt)} 동기화`
            : (updatedAt || translate('kubernetesNoCollectionRecord'))
        const historyTimeQualityTooltip = <div>
            <div>정확 시각 {podSummary.recentTimestampExactCount}건 · 추정 시각 {podSummary.recentTimestampEstimatedCount}건</div>
            <div>종료 시각, 상태 전환, Event 시간을 우선 사용합니다.</div>
            <div>확인할 수 없으면 생성 시각을 추정값으로 사용합니다.</div>
        </div>

        return (
            <div className="netdive-k8s-cluster-detail">
                <Tabs
                    className="netdive-k8s-cluster-detail__navigation"
                    activeKey={this.state.activeDetailTab}
                    onChange={activeDetailTab => this.setState({ activeDetailTab: activeDetailTab as State['activeDetailTab'] })}>
                    <Tabs.TabPane tab={<span className="netdive-k8s-cluster-detail__navigation-label"><span>개요</span></span>} key="overview" />
                    <Tabs.TabPane tab={<span className="netdive-k8s-cluster-detail__navigation-label"><span>서비스</span><small>{serviceResource.nodes.length}</small></span>} key="services" />
                </Tabs>
                {this.state.activeDetailTab === 'overview' ? <React.Fragment>
                <DetailSectionCard
                    icon={<InfoIcon />}
                    title={translate('kubernetesClusterBasicInfo')}
                    collapsible
                    collapsed={this.state.basicCollapsed}
                    onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                    <BasicInfoRows density="compact" rows={overviewRows} copyTooltip={translate('copy')} />
                    <Collapse
                        accordion
                        bordered={false}
                        className="netdive-k8s-cluster-detail__basic-collapse"
                        activeKey={this.state.basicInfoActiveKey}
                        expandIconPosition="right"
                        onChange={key => this.setState({ basicInfoActiveKey: Array.isArray(key) ? String(key[0] || '') : String(key || '') })}>
                        <Collapse.Panel header={translate('kubernetesAdvancedInformation')} key="advanced">
                            <BasicInfoRows density="compact" rows={advancedRows} copyTooltip={translate('copy')} />
                        </Collapse.Panel>
                    </Collapse>
                    {(labels.length > 0 || annotations.length > 0) && <div className="netdive-k8s-cluster-detail__metadata">
                        <div className="netdive-k8s-cluster-detail__metadata-group">
                            <div className="netdive-k8s-cluster-detail__metadata-title">{translate('kubernetesLabels')}</div>
                            {this.renderMetadataItems(labels, translate('kubernetesNoLabels'))}
                        </div>
                        <div className="netdive-k8s-cluster-detail__metadata-group">
                            <div className="netdive-k8s-cluster-detail__metadata-title">{translate('kubernetesAnnotations')}</div>
                            {this.renderMetadataItems(annotations, translate('kubernetesNoAnnotations'))}
                        </div>
                    </div>}
                </DetailSectionCard>

                <DetailSectionCard
                    icon={this.topologyIcon(this.props.node)}
                    title={translate('kubernetesOperationalStatus')}
                    action={<Space size={5} className="netdive-k8s-cluster-detail__collection-summary">
                        <Tooltip title={metricState.description}>
                            <Badge
                                status={metricState.tone === 'success'
                                    ? 'success'
                                    : metricState.tone === 'warning'
                                        ? 'warning'
                                        : metricState.tone === 'danger'
                                            ? 'error'
                                            : 'default'}
                                text={metricState.label} />
                        </Tooltip>
                        <Typography.Text type="secondary">·</Typography.Text>
                        <Tooltip title={collectedAt ? `마지막 수집 시각: ${collectedAt}` : metricState.description}>
                            <Typography.Text type="secondary">{collectionTimeText}</Typography.Text>
                        </Tooltip>
                    </Space>}>
                    <StatusSummaryGrid
                        verdict={health.label}
                        verdictTone={health.tone}
                        rawStatus={rawClusterStatus}
                        rawStatusLabel="API 원본 상태"
                        impact={heroConclusion}
                        verdictTooltip="현재 Kubernetes 상태와 서비스 영향을 종합한 Netdive 운영 판정입니다."
                        rawStatusTooltip="Kubernetes API 연결과 Control Plane에서 확인한 원본 상태입니다."
                        impactTooltip="현재 문제 파드, 비정상 노드와 영향받은 서비스를 기준으로 확인한 현재 영향입니다."
                        metrics={availabilityItems.map(item => ({
                            key: item.key,
                            label: item.label,
                            value: item.value,
                            tooltip: item.tooltip
                                || (item.key === 'control-plane'
                                    ? '전체 Control Plane 중 Ready 상태인 수입니다.'
                                    : item.key === 'nodes'
                                        ? '전체 Kubernetes 노드 중 Ready 상태인 수입니다.'
                                        : '삭제 중이거나 종료된 객체를 제외한 활성 파드 수입니다.'),
                            tone: item.key === 'services' && affectedServices > 0 ? 'danger' : 'default',
                            onClick: item.key === 'nodes' && nodeResource.nodes.length
                                ? () => this.focusResources(nodeResource.nodes)
                                : item.key === 'pods' && activePodResources.length
                                ? () => this.focusResources(activePodResources)
                                : item.key === 'services' && affectedServices > 0 && affectedServiceFocusTargets.length
                                ? () => this.focusResources(affectedServiceFocusTargets)
                                : item.key === 'services'
                                ? () => this.setState({ activeDetailTab: 'services', serviceNamespaceFilter: 'all' })
                                : undefined
                        }))} />
                    {abnormalItems.length > 0 && <div className="netdive-k8s-cluster-detail__abnormal-status">
                        <span className="netdive-k8s-cluster-detail__abnormal-status-title">{translate('kubernetesAbnormalOverview')}</span>
                        <div className={`netdive-k8s-cluster-detail__abnormal-status-grid items-${Math.min(4, abnormalItems.length)}`}>
                            {abnormalItems.map(item => (
                                <button type="button" className={`netdive-k8s-cluster-detail__abnormal-status-item is-${item.tone}`} key={item.key} onClick={item.nodes?.length ? () => this.focusResources(item.nodes) : undefined}>
                                    <span>{item.label}</span>
                                    <strong>{item.status} <b>{item.value}</b></strong>
                                </button>
                            ))}
                        </div>
                    </div>}
                    {this.renderPodStatusSummary(podSummary)}
                    {instabilityWindowAvailable && <div className="netdive-k8s-cluster-detail__instability">
                        <Divider />
                        <div className="netdive-k8s-cluster-detail__instability-head">
                            <Space size={4}>
                                <Typography.Text strong>최근 이상징후</Typography.Text>
                                <Tooltip title={<React.Fragment>
                                    <div>선택한 기간의 실제 이상 Pod와 활성 {KUBERNETES_DETAIL_LABELS.nodePressure} 상태만 집계합니다.</div>
                                    <div>Succeeded·Completed는 과거 종료 이력에만 포함됩니다.</div>
                                    {podSummary.recentTimestampEstimatedCount > 0 && historyTimeQualityTooltip}
                                </React.Fragment>}>
                                    <InfoCircleOutlined className="netdive-k8s-cluster-detail__history-info" />
                                </Tooltip>
                            </Space>
                            <Space size={5} className="netdive-k8s-cluster-detail__instability-head-actions">
                                {this.renderInstabilityWindowSelect()}
                            </Space>
                        </div>
                        {this.state.summaryLoading
                            ? <div className="netdive-k8s-cluster-detail__instability-fetch-state"><Spin size="small" /><span>기간 데이터를 불러오는 중입니다.</span></div>
                            : this.state.summaryError
                                ? <div className="netdive-k8s-cluster-detail__instability-fetch-state is-error">
                                    <span>기간 데이터를 불러오지 못했습니다.</span>
                                    <Button type="link" size="small" onClick={() => this.loadClusterSummary(true)}>다시 시도</Button>
                                </div>
                                : null}
                        {hasRecentInstability && <Row gutter={[6, 6]} className="netdive-k8s-cluster-detail__instability-cards">
                            <Col span={12}><button type="button" disabled={!recentInstabilityItems.length} onClick={() => this.focusResources([...recentAnomalyPodNodes, ...recentPressureSignals.map(item => item.node)])}>
                                <span>감지된 이상징후</span><strong className={recentInstabilityItems.length ? 'is-warning' : ''}>{recentAnomalyPodNodes.length + recentPressureSignals.length}</strong>
                            </button></Col>
                            <Col span={12}><button type="button" disabled={!historyNodeTargets.length} onClick={() => this.focusResources(historyNodeTargets)}>
                                <span>영향받은 노드</span><strong>{recentAffectedNodeNames.size}</strong>
                            </button></Col>
                            <Col span={12}><button type="button" disabled={!historyWorkloadTargets.length} onClick={() => this.focusResources(historyWorkloadTargets)}>
                                <span>영향 워크로드</span><strong>{recentAffectedWorkloadNames.size}</strong>
                            </button></Col>
                            <Col span={12}><button type="button" disabled={!unrecoveredWorkloadTargets.length} onClick={() => this.focusResources(unrecoveredWorkloadTargets)}>
                                <span>미복구 상태</span><strong className={unrecoveredWorkloadTargets.length ? 'is-danger' : 'is-zero'}>{unrecoveredWorkloadTargets.length}</strong>
                            </button></Col>
                        </Row>}
                        {hasRecentInstability
                            ? <button
                                type="button"
                                className="netdive-k8s-cluster-detail__instability-detail-trigger"
                                onClick={() => this.setState({ podStatusModalMode: 'recent', podStatusModalKey: '' })}>
                                <span>이상징후 목록 보기</span>
                                <RightOutlined />
                            </button>
                            : !this.state.summaryLoading && !this.state.summaryError
                                ? <div className="netdive-k8s-cluster-detail__instability-empty">최근 {this.instabilityWindowLabel()} 동안 이상징후 없음</div>
                                : null}
                    </div>}
                    {this.renderTerminationHistory(podSummary)}
                </DetailSectionCard>

                <DetailSectionCard
                    icon={<AccountTreeIcon />}
                    title={<span className="netdive-k8s-cluster-detail__capacity-section-title">
                        {translate('kubernetesResourceCapacity')}
                        <Tooltip
                            placement="top"
                            title="노드 전체 Capacity에서 시스템 예약분을 제외하고 Pod에 할당할 수 있는 Kubernetes Allocatable 자원입니다.">
                            <InfoCircleOutlined />
                        </Tooltip>
                    </span>}>
                    {this.renderResourceCapacity(moldCluster, activePodResources.length, allocatablePodCount)}
                </DetailSectionCard>

                <DetailSectionCard icon={<ErrorOutlineIcon />} title={translate('kubernetesRiskResilience')}>
                    <div className={`netdive-k8s-cluster-detail__alert-summary ${currentRisks.length ? 'has-alert' : ''}`}>
                        <span className="netdive-k8s-cluster-detail__alert-dot" />
                        <strong>{currentRisks.length ? currentRisks[0].title : translate('kubernetesNoCurrentAlerts')}</strong>
                        {currentRisks.length > 1 && <small>+{currentRisks.length - 1}</small>}
                    </div>
                    <StatusEvidenceList columnHeaders={{ state: '상태', value: '평가' }}>
                        {this.renderResilienceRow(translate('kubernetesCurrentFailureImpact'), currentImpactGrade.label, currentImpactGrade.tone, `${impactScore} / 100`, `영향 점수 ${impactScore}/100 · 현재 상태 기준`, <div><strong>현재 장애 영향도</strong><p>높을수록 위험합니다.</p><p>{translate('kubernetesCurrentFailureImpactTooltip')}</p></div>, currentImpactInfrastructureTargets.length ? () => this.focusInfrastructureEvidence(currentImpactInfrastructureTargets) : undefined)}
                        {instabilityWindowAvailable && this.renderResilienceRow(
                            '최근 불안정성',
                            hasRecentInstability
                                ? (hasCurrentInstabilityImpact ? translate('kubernetesHealthWarning') : '이력 있음')
                                : translate('kubernetesHealthNormal'),
                            hasRecentInstability
                                ? (hasCurrentInstabilityImpact ? 'warning' : 'default')
                                : 'success',
                            recentAnomalyPodNodes.length + recentPressureSignals.length,
                            `최근 ${this.instabilityWindowLabel()} · 실제 이상 Pod ${recentAnomalyPodNodes.length}건, ${KUBERNETES_DETAIL_LABELS.nodePressure} ${recentPressureSignals.length}건`
                        )}
                        {this.renderResilienceRow('구조적 위험도', potentialEvaluated && potentialScore >= 75 ? '매우 높음' : potentialGrade.label, potentialGrade.tone, potentialEvaluated ? `${potentialScore} / 100` : '–', potentialEvaluated ? `구조적 위험도 ${potentialScore}/100 · 높을수록 위험` : '분석 데이터 미수집 · 평가 불가', potentialScoreTooltip, structuralEvidenceTargets.length ? () => this.focusInfrastructureEvidence(structuralEvidenceTargets) : undefined)}
                        {this.renderResilienceRow(
                            translate('kubernetesHostDistributionShort'),
                            hostAnalysis.tone === 'warning' ? translate('kubernetesResilienceRecommended') : hostAnalysis.label,
                            hostAnalysis.tone,
                            hostPlacementEvaluated ? (hostAnalysis.tone === 'warning' ? '낮음' : '양호') : '–',
                            !hostPlacementEvaluated
                                ? '호스트 배치 미수집 · 평가 불가'
                                : hostAnalysis.known.length === 1
                                    ? '호스트 수 1대 · 단일 호스트 집중'
                                    : `호스트 수 ${hostAnalysis.known.length}대 · 분산 배치`,
                            undefined,
                            hostEvidenceTargets.length ? () => this.focusInfrastructureEvidence(hostDistributionEvidenceTargets) : undefined)}
                        {this.renderResilienceRow(
                            '네트워크 복원력',
                            networkAnalysis.tone === 'warning' ? translate('kubernetesResilienceRecommended') : networkAnalysis.label,
                            networkAnalysis.tone,
                            networkPlacementEvaluated ? (networkAnalysis.tone === 'warning' ? '매우 낮음' : '양호') : '–',
                            !networkPlacementEvaluated
                                ? '네트워크 경로 미수집 · 평가 불가'
                                : networkAnalysis.known.length === 1
                                    ? `단일 경로 비율 ${networkAnalysis.topPercent}% · 연결 스위치 1대`
                                    : `최대 경로 집중도 ${networkAnalysis.topPercent}% · 연결 스위치 ${networkAnalysis.known.length}대`,
                            undefined,
                            networkEvidenceTargets.length ? () => this.focusInfrastructureEvidence(networkResilienceEvidenceTargets) : undefined)}
                        {this.renderResilienceRow(
                            translate('kubernetesControlPlaneResilience'),
                            !controlPlane.total ? translate('kubernetesResilienceUnavailable') : controlPlane.total === 1 ? translate('kubernetesResilienceRecommended') : translate('kubernetesResilienceGood'),
                            !controlPlane.total ? 'default' : controlPlane.total === 1 ? 'warning' : 'success',
                            !controlPlane.total ? '–' : controlPlane.total === 1 ? '낮음' : '양호',
                            !controlPlane.total ? 'Control Plane 미수집 · 평가 불가' : controlPlane.total === 1 ? 'Control Plane 노드 1대 · 이중화 없음' : `Control Plane 노드 ${controlPlane.total}대 · 다중 구성`,
                            undefined,
                            controlPlaneTargets.length ? () => this.focusInfrastructureEvidence(controlPlaneTargets) : undefined)}
                        {this.renderResilienceRow(translate('kubernetesExternalPaths'), externalAnalysis.label, externalAnalysis.tone, externalAnalysis.value, externalAnalysis.short, externalAnalysis.description)}
                    </StatusEvidenceList>
                    {affectedWorkloadTargets.length > 0 && <div className="netdive-k8s-cluster-detail__risk-actions">
                        <Button type="link" size="small" onClick={() => this.focusResources(affectedWorkloadTargets)}>
                            영향 워크로드 보기
                            <RightOutlined />
                        </Button>
                    </div>}
                    <KubernetesAnalysisConfidence
                        state={confidenceState}
                        collected={confidenceCollected}
                        missing={confidenceMissing}
                        contextNote={podSummary.timestampEstimatedCount > 0
                            ? `현재 상태·구조 분석과 별도로 파드 종료 이력의 기간 분석에는 정확 시각 ${podSummary.timestampExactCount}건과 생성 시각 기반 추정 ${podSummary.timestampEstimatedCount}건이 사용됩니다.`
                            : undefined} />
                </DetailSectionCard>
                {this.state.focusActive && <div className="netdive-k8s-detail__focus-reset"><Button type="link" size="small" onClick={() => this.clearFocusedResources()}>강조 초기화</Button></div>}

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
                            { key: 'nodes', label: this.resourceLabel('node'), count: nodeSummary.total, icon: this.resourceIcon(nodeResource), iconTone: 'kubernetes', onClick: nodeResource.nodes.length ? () => this.focusResources(nodeResource.nodes) : undefined, tooltip: translate('kubernetesFocusNodes') },
                            { key: 'namespaces', label: this.resourceLabel('namespace'), count: namespaceCount, icon: this.resourceIcon(namespaceResource), iconTone: 'kubernetes', onClick: namespaceResource.nodes.length ? () => this.focusResources(namespaceResource.nodes) : undefined, tooltip: translate('kubernetesFocusNamespaces') },
                            ...(workloadNodes.length ? [{ key: 'workloads', label: translate('kubernetesTopologyWorkloadControllers'), count: workloadNodes.length, icon: <DetailLayerIcon glyph={'\uf5fd'} />, iconTone: 'kubernetes' as const, onClick: () => this.focusResources(workloadNodes), tooltip: translate('kubernetesTopologyWorkloadControllers') }] : []),
                            { key: 'pods', label: this.resourceLabel('pod'), count: displayedPodTotal, icon: this.resourceIcon(podResource), iconTone: 'kubernetes', onClick: activePodResources.length ? () => this.focusResources(activePodResources) : undefined, tooltip: translate('kubernetesFocusPods') },
                            { key: 'services', label: this.resourceLabel('service'), count: serviceCount, icon: this.resourceIcon(serviceResource), iconTone: 'kubernetes', onClick: serviceResource.nodes.length ? () => this.setState({ activeDetailTab: 'services', serviceNamespaceFilter: 'all' }) : undefined, tooltip: translate('kubernetesFocusServices') }
                            ]
                        },
                        {
                            key: 'storage',
                            title: '스토리지',
                            icon: <DetailLayerIcon glyph={'\uf1c0'} />,
                            items: [
                                ...(persistentVolumeClaimResource.nodes.length ? [{ key: 'pvcs', label: this.resourceLabel('persistentvolumeclaim'), count: persistentVolumeClaimResource.nodes.length, icon: this.storageResourceIcon('persistentvolumeclaim'), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(persistentVolumeClaimResource.nodes), tooltip: 'PersistentVolumeClaim (PVC)' }] : []),
                                ...(persistentVolumeResource.nodes.length ? [{ key: 'pvs', label: this.resourceLabel('persistentvolume'), count: persistentVolumeResource.nodes.length, icon: this.storageResourceIcon('persistentvolume'), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(persistentVolumeResource.nodes), tooltip: 'PersistentVolume (PV)' }] : []),
                                ...(storageClassResource.nodes.length ? [{ key: 'storage-classes', label: this.resourceLabel('storageclass'), count: storageClassResource.nodes.length, icon: this.storageResourceIcon('storageclass'), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(storageClassResource.nodes), tooltip: KUBERNETES_DETAIL_LABELS.storageClass }] : [])
                            ]
                        }
                    ]} />

                <DetailSectionCard
                    icon={<HistoryOutlined />}
                    title={translate('kubernetesRecentChanges')}
                    action={recentChangeGroups.length > 4 ? <button
                        type="button"
                        className="netdive-k8s-cluster-detail__change-view-all"
                        onClick={() => this.setState({ recentChangesModalOpen: true, expandedRecentChangeKey: '' })}>
                        {translate('kubernetesRecentChangesViewAll')}
                    </button> : undefined}>
                    {this.renderRecentChanges(recentChangeGroups, 4)}
                </DetailSectionCard>
                </React.Fragment> : this.renderServiceBrowser(serviceResource.nodes)}

                <HistoryModal
                    visible={!!this.state.podStatusModalMode}
                    className={`netdive-k8s-cluster-detail__eviction-modal netdive-list-modal ${this.state.podStatusModalMode === 'recent' ? 'netdive-k8s-cluster-detail__resource-usage-modal' : ''}`}
                    title={this.state.podStatusModalMode === 'history'
                        ? `과거 종료 이력 · ${selectedPodStatusGroup?.label || '전체'}`
                        : this.state.podStatusModalMode === 'recent'
                            ? `최근 ${this.instabilityWindowLabel()} 이상징후 · ${recentInstabilityItems.length}건`
                            : `현재 문제 · ${selectedPodStatusGroup?.label || '파드'}`}
                    width={this.state.podStatusModalMode === 'history' ? 900 : this.state.podStatusModalMode === 'recent' ? 760 : 620}
                    onCancel={() => this.setState({ podStatusModalMode: '', podStatusModalKey: '' })}>
                    {this.state.podStatusModalMode === 'history' && podSummary.timestampEstimatedCount > 0 && <div className="netdive-k8s-cluster-detail__eviction-time-notice">
                        정확 {podSummary.timestampExactCount}건 · 추정 {podSummary.timestampEstimatedCount}건입니다. 추정 항목은 Pod 생성 시각을 기준으로 정렬합니다.
                    </div>}
                    {this.state.podStatusModalMode === 'history'
                        ? this.renderTerminationHistoryTable(selectedPodStatusNodes)
                        : this.state.podStatusModalMode === 'recent'
                        ? <Table
                            size="small"
                            pagination={false}
                            tableLayout="fixed"
                            rowKey="key"
                            className="netdive-k8s-pod-usage-table netdive-modal-table netdive-k8s-cluster-detail__instability-table"
                            dataSource={recentInstabilityItems}
                            onRow={item => ({
                                onClick: () => this.focusResources(item.nodes)
                            })}
                            columns={[
                                {
                                    title: '리소스',
                                    key: 'resource',
                                    width: '56%',
                                    render: (_value: any, item: any) => <KubernetesModalResourceCell
                                        namespace={item.namespace}
                                        name={item.resourceName}
                                        resourceType={item.resourceType}
                                        copyLabel={`${item.resourceType} 이름 복사`}
                                        onClick={() => this.focusResources(item.nodes)}
                                    />
                                },
                                {
                                    title: '발생 정보',
                                    key: 'event',
                                    width: '18%',
                                    render: (_value: any, item: any) => <span className="netdive-k8s-cluster-detail__instability-event">
                                        <time>{item.time}</time>
                                        <Tooltip title={item.detail}>
                                            <small>{item.detail}</small>
                                        </Tooltip>
                                    </span>
                                },
                                {
                                    title: '상태',
                                    key: 'severity',
                                    width: '26%',
                                    align: 'right' as const,
                                    render: (_value: any, item: any) => <Tag
                                        className="netdive-k8s-cluster-detail__instability-severity"
                                        color={item.tone === 'danger' ? 'red' : 'orange'}>
                                        {item.severity}
                                    </Tag>
                                }
                            ]}
                        />
                        : this.renderPodStatusList(selectedPodStatusNodes, resources, unavailableWorkloads, selectedPodStatusGroup?.label, this.state.podStatusModalMode === 'current')}
                </HistoryModal>

                <Modal
                    visible={this.state.recentChangesModalOpen}
                    className="netdive-k8s-cluster-detail__change-modal netdive-list-modal"
                    title={<span className="netdive-k8s-cluster-detail__change-modal-title"><HistoryOutlined />{translate('kubernetesRecentChangesAllTitle')}</span>}
                    width={540}
                    footer={null}
                    destroyOnClose
                    onCancel={() => this.setState({ recentChangesModalOpen: false, expandedRecentChangeKey: '' })}>
                    {this.renderRecentChanges(recentChangeGroups, undefined, 'modal')}
                </Modal>

                <Modal
                    visible={!!this.state.resourceUsageModal}
                    className="netdive-k8s-cluster-detail__resource-usage-modal netdive-list-modal"
                    title={this.state.resourceUsageModal === 'memory-unset'
                        ? '메모리 Requests 미설정 Pod'
                        : `${this.state.resourceUsageModal === 'memory' ? '메모리' : 'CPU'} 상위 사용 Pod`}
                    width={760}
                    destroyOnClose
                    footer={null}
                    keyboard
                    getContainer={() => document.body}
                    onCancel={() => this.setState({ resourceUsageModal: '' })}>
                    {this.state.resourceUsageModal === 'memory-unset'
                        ? memoryRequestUnsetPods.length
                            ? <Table
                                size="small"
                                pagination={false}
                                rowKey={(pod: Node) => pod.id}
                                dataSource={memoryRequestUnsetPods}
                                className="netdive-k8s-cluster-detail__resource-usage-table netdive-modal-table"
                                tableLayout="fixed"
                                onRow={(pod: Node) => ({
                                    onClick: () => this.focusResources([pod])
                                })}
                                columns={[
                                    {
                                        title: 'Pod',
                                        key: 'pod',
                                        width: '55%',
                                        render: (_value: any, pod: Node) => {
                                            const namespace = firstValue(pod.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
                                            const podName = firstValue(pod.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) || pod.id
                                            return <button type="button" className="netdive-k8s-cluster-detail__resource-usage-cell-button" onClick={event => {
                                                    event.stopPropagation()
                                                    this.focusResources([pod])
                                                    this.openResourceDetail(pod)
                                                }}>
                                                <DetailModalResourceCell namespace={namespace || 'default'} name={podName} />
                                            </button>
                                        }
                                    },
                                    {
                                        title: '노드',
                                        key: 'node',
                                        width: '45%',
                                        render: (_value: any, pod: Node) => {
                                            const nodeName = firstValue(pod.data || {}, ['K8s.Extra.Spec.NodeName', 'K8s.NodeName', 'NodeName'])
                                            return <DetailModalTextCell value={nodeName || '없음'} />
                                        }
                                    }
                                ]} />
                            : <CompactEmptyState description="메모리 Requests가 미설정된 활성 Pod가 없습니다." compact />
                        : selectedUsageItems.length
                        ? <KubernetesPodUsageTable
                            metric={this.state.resourceUsageModal === 'memory' ? 'memory' : 'cpu'}
                            items={selectedUsageItems}
                            onRowClick={item => {
                                const targets = usageRelationshipTargets(item)
                                if (targets.length) this.focusResources(targets)
                            }}
                            onPodClick={item => {
                                const targets = usageRelationshipTargets(item)
                                if (targets.length) this.focusResources(targets)
                                const pod = podNodeForUsage(item)
                                if (pod) this.openResourceDetail(pod)
                            }}
                        />
                        : <CompactEmptyState description="Pod별 metrics-server 사용량을 확인할 수 없습니다." compact />}
                </Modal>

                {!moldCluster && (
                    <div className="netdive-k8s-cluster-detail__notice">
                        <InfoIcon />
                        <span>{translate('kubernetesClusterMoldMissing')}</span>
                    </div>
                )}
                {!this.state.summaryLoading && moldCluster && (this.state.summaryError || !this.state.summary?.resources?.metricsAvailable) && (
                    <div className="netdive-k8s-cluster-detail__notice">
                        <InfoIcon />
                        <span><strong>{translate('kubernetesSummaryFallback')}</strong><small>{translate('kubernetesSummaryFallbackDetail')}</small></span>
                    </div>
                )}
            </div>
        )
    }
}

export default KubernetesClusterDetailPanel
