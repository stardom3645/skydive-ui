import * as React from 'react'
import { Collapse, Modal, Popover, Progress, Select, Tabs, Tooltip } from 'antd'
import { HistoryOutlined, InfoCircleOutlined } from '@ant-design/icons'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import {
    ConnectedResourcesSection,
    ConnectedResourceListSection,
    DetailBadge,
    DetailBadgeTone,
    DetailEmpty,
    DetailKeyValueList,
    DetailLayerIcon,
    DetailSection,
    KubernetesAnalysisConfidence
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
    activeDetailTab: 'overview' | 'services'
    serviceNamespaceFilter: string
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
    state: State = {
        basicCollapsed: false,
        basicInfoActiveKey: '',
        expandedRecentChangeKey: '',
        recentChangesModalOpen: false,
        instabilityWindow: '1h',
        podStatusModalMode: '',
        podStatusModalKey: '',
        activeDetailTab: (this.props.node as any).__netdiveInitialDetailTab === 'services' ? 'services' : 'overview',
        serviceNamespaceFilter: 'all'
    }

    componentDidMount() {
        delete (this.props.node as any).__netdiveInitialDetailTab
        this.loadClusterSummary()
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id) {
            this.setState({ basicCollapsed: false, basicInfoActiveKey: '', expandedRecentChangeKey: '', recentChangesModalOpen: false, instabilityWindow: '1h', podStatusModalMode: '', podStatusModalKey: '', activeDetailTab: 'overview', serviceNamespaceFilter: 'all', summary: undefined, summaryError: false, summaryClusterID: undefined }, () => this.loadClusterSummary())
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

    private loadClusterSummary() {
        const cluster = this.moldCluster()
        if (!cluster?.id || this.state.summaryLoading || this.state.summaryClusterID === cluster.id) return
        const endpoint = this.props.session?.endpoint || `${window.location.protocol}//${window.location.host}`
        this.setState({ summaryLoading: true, summaryError: false, summaryClusterID: cluster.id })
        fetch(`${endpoint}/api/mold/kubernetes-clusters/summary?id=${encodeURIComponent(cluster.id)}`, {
            cache: 'no-store',
            headers: this.props.session?.token ? { 'X-Auth-Token': this.props.session.token } : undefined
        }).then(response => {
            if (!response.ok) throw new Error(`cluster summary unavailable: ${response.status}`)
            return response.json()
        }).then(summary => {
            if (this.state.summaryClusterID === cluster.id) {
                this.setState({ summary, summaryLoading: false, summaryError: false })
            }
        }).catch(() => {
            if (this.state.summaryClusterID === cluster.id) {
                this.setState({ summaryLoading: false, summaryError: true })
            }
        })
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
        const status: StatusSummary = { total: nodes.length, running: 0, pending: 0, failed: 0, unknown: 0 }
        nodes.forEach(node => {
            const phase = firstValue(node.data || {}, ['K8s.Status', 'K8s.Extra.Status.Phase', 'Status', 'Phase']).toLowerCase()
            if (phase === 'running' || phase === 'succeeded') status.running = (status.running || 0) + 1
            else if (phase === 'pending') status.pending = (status.pending || 0) + 1
            else if (phase === 'failed') status.failed = (status.failed || 0) + 1
            else status.unknown = (status.unknown || 0) + 1
        })
        return status
    }

    private podTimestamp(node: Node): PodHistoryTimestamp {
        const data = node.data || {}
        const timestampValue = (candidate: any): number | undefined => {
            const source = candidate && typeof candidate === 'object' && candidate.Time !== undefined ? candidate.Time : candidate
            const value = new Date(source).getTime()
            return Number.isNaN(value) ? undefined : value
        }
        const newest = (candidates: any[]): number | undefined => {
            const values = candidates.map(timestampValue).filter((value): value is number => value !== undefined)
            return values.length ? Math.max(...values) : undefined
        }
        const statuses = ([] as any[]).concat(
            firstRaw(data, ['K8s.Extra.Status.InitContainerStatuses']) || [],
            firstRaw(data, ['K8s.Extra.Status.ContainerStatuses']) || [],
            firstRaw(data, ['K8s.Extra.Status.EphemeralContainerStatuses']) || []
        )
        const finishedAt = newest([
            firstRaw(data, ['K8s.FinishedAt', 'FinishedAt']),
            ...statuses.map(status => status?.State?.Terminated?.FinishedAt || status?.state?.terminated?.finishedAt)
        ])
        if (finishedAt !== undefined) return { value: finishedAt, estimated: false, source: '종료 시각' }

        const conditions = firstRaw(data, ['K8s.Extra.Status.Conditions', 'K8s.Conditions', 'Conditions'])
        const lastTransitionTime = newest([
            firstRaw(data, ['K8s.LastTransitionTimestamp', 'LastTransitionTimestamp']),
            ...(Array.isArray(conditions) ? conditions : []).map(condition =>
                condition?.LastTransitionTime || condition?.lastTransitionTime)
        ])
        if (lastTransitionTime !== undefined) return { value: lastTransitionTime, estimated: false, source: '상태 전환' }

        const eventSource = firstRaw(data, ['K8s.Extra.Events', 'K8s.Events', 'Events'])
        const events = Array.isArray(eventSource)
            ? eventSource
            : Array.isArray(eventSource?.items)
                ? eventSource.items
                : Array.isArray(eventSource?.Items) ? eventSource.Items : []
        const terminalEventReasons = new Set(['evicted', 'oomkilled', 'error', 'deadlineexceeded', 'nodelost', 'killing'])
        const terminalEventTime = newest([
            firstRaw(data, ['K8s.EvictionTimestamp', 'EvictionTimestamp']),
            ...events
                .filter(event => terminalEventReasons.has(firstValue(event, ['reason', 'Reason']).toLowerCase()))
                .map(event => firstRaw(event, [
                'lastTimestamp', 'LastTimestamp', 'eventTime', 'EventTime',
                'lastObservedTime', 'LastObservedTime', 'series.lastObservedTime',
                'Series.LastObservedTime', 'metadata.creationTimestamp',
                'ObjectMeta.CreationTimestamp'
                ]))
        ])
        if (terminalEventTime !== undefined) return { value: terminalEventTime, estimated: false, source: '이벤트' }

        const creationTimestamp = newest([
            firstRaw(data, [
                'K8s.Extra.ObjectMeta.CreationTimestamp.Time',
                'K8s.Extra.ObjectMeta.CreationTimestamp',
                'K8s.CreationTimestamp',
                'CreationTimestamp'
            ])
        ])
        if (creationTimestamp !== undefined) return { value: creationTimestamp, estimated: true, source: '생성 시각' }
        return { estimated: false, source: '확인 불가' }
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

    private podContainerStatuses(node: Node): any[] {
        const data = node.data || {}
        return ([] as any[]).concat(
            firstRaw(data, ['K8s.Extra.Status.InitContainerStatuses']) || [],
            firstRaw(data, ['K8s.Extra.Status.ContainerStatuses']) || [],
            firstRaw(data, ['K8s.Extra.Status.EphemeralContainerStatuses']) || []
        )
    }

    private podAge(node: Node): number {
        const created = firstRaw(node.data || {}, [
            'K8s.Extra.ObjectMeta.CreationTimestamp.Time',
            'K8s.Extra.ObjectMeta.CreationTimestamp',
            'K8s.CreationTimestamp',
            'CreationTimestamp'
        ])
        const timestamp = new Date(created && typeof created === 'object' && created.Time !== undefined ? created.Time : created).getTime()
        return Number.isNaN(timestamp) ? 0 : Math.max(0, Date.now() - timestamp)
    }

    private podIsReady(node: Node): boolean | undefined {
        const conditions = firstRaw(node.data || {}, ['K8s.Extra.Status.Conditions', 'K8s.Conditions', 'Conditions'])
        if (!Array.isArray(conditions)) return undefined
        const ready = conditions.find(condition => String(condition?.Type || condition?.type || '').toLowerCase() === 'ready')
        if (!ready) return undefined
        return String(ready?.Status ?? ready?.status ?? '').toLowerCase() === 'true'
    }

    private podCurrentProblemKeys(node: Node): string[] {
        const data = node.data || {}
        const phase = firstValue(data, ['K8s.Extra.Status.Phase', 'K8s.Phase', 'Phase', 'K8s.Status']).toLowerCase()
        const reason = firstValue(data, ['K8s.Extra.Status.Reason', 'K8s.Status', 'Reason']).toLowerCase()
        const statuses = this.podContainerStatuses(node)
        const waitingReasons = statuses.map(status =>
            String(status?.State?.Waiting?.Reason || status?.state?.waiting?.reason || '').toLowerCase())
        const conditions = firstRaw(data, ['K8s.Extra.Status.Conditions', 'K8s.Conditions', 'Conditions'])
        const unschedulable = reason === 'unschedulable' || (Array.isArray(conditions) && conditions.some(condition =>
            String(condition?.Type || condition?.type || '').toLowerCase() === 'podscheduled'
            && String(condition?.Status ?? condition?.status ?? '').toLowerCase() === 'false'
            && String(condition?.Reason || condition?.reason || '').toLowerCase() === 'unschedulable'))
        const deletionTimestamp = firstRaw(data, ['K8s.Extra.ObjectMeta.DeletionTimestamp', 'K8s.DeletionTimestamp', 'DeletionTimestamp'])
        const deletingSince = deletionTimestamp ? new Date(deletionTimestamp && typeof deletionTimestamp === 'object' && deletionTimestamp.Time !== undefined ? deletionTimestamp.Time : deletionTimestamp).getTime() : NaN
        const restartCount = statuses.reduce((sum, status) => sum + Number(status?.RestartCount ?? status?.restartCount ?? 0), 0)
        const oomKilled = statuses.some(status => {
            const current = status?.State?.Terminated?.Reason || status?.state?.terminated?.reason
            const previous = status?.LastTerminationState?.Terminated?.Reason || status?.lastState?.terminated?.reason
            return String(current || previous || '').toLowerCase() === 'oomkilled'
        })
        const age = this.podAge(node)
        const fiveMinutes = 5 * 60 * 1000
        const tenMinutes = 10 * 60 * 1000
        const keys: string[] = []
        if (waitingReasons.indexOf('crashloopbackoff') >= 0) keys.push('crash-loop')
        if (waitingReasons.some(item => item === 'imagepullbackoff' || item === 'errimagepull')) keys.push('image-pull')
        if (unschedulable) keys.push('unschedulable')
        if (waitingReasons.indexOf('containercreating') >= 0 && age >= fiveMinutes) keys.push('long-container-creating')
        if (phase === 'pending' && age >= fiveMinutes && !unschedulable && waitingReasons.indexOf('containercreating') < 0) keys.push('long-pending')
        if (phase === 'unknown' || waitingReasons.indexOf('containerstatusunknown') >= 0) keys.push('unknown')
        if (!Number.isNaN(deletingSince) && Date.now() - deletingSince >= tenMinutes) keys.push('long-terminating')
        if (phase === 'running' && this.podIsReady(node) === false) keys.push('running-not-ready')
        if (oomKilled && restartCount >= 2 && phase !== 'failed' && phase !== 'succeeded') keys.push('repeated-oom')
        return Array.from(new Set(keys))
    }

    private podTerminationHistoryKeys(node: Node): string[] {
        const data = node.data || {}
        const phase = firstValue(data, ['K8s.Extra.Status.Phase', 'K8s.Phase', 'Phase', 'K8s.Status']).toLowerCase()
        const reasons = [
            firstValue(data, ['K8s.Extra.Status.Reason', 'K8s.Status', 'Reason']),
            ...this.podContainerStatuses(node).reduce((items: string[], status) => {
                const current = status?.State?.Terminated?.Reason || status?.state?.terminated?.reason
                const previous = status?.LastTerminationState?.Terminated?.Reason || status?.lastState?.terminated?.reason
                if (current) items.push(String(current))
                if (previous) items.push(String(previous))
                return items
            }, [])
        ].map(item => item.toLowerCase()).filter(Boolean)
        const keys: string[] = []
        reasons.forEach(reason => {
            if (reason === 'evicted') keys.push('evicted')
            else if (reason === 'oomkilled') keys.push('oomkilled')
            else if (reason === 'deadlineexceeded') keys.push('deadline-exceeded')
            else if (reason === 'nodelost') keys.push('node-lost')
            else if (reason === 'error') keys.push('error')
            else if (phase === 'failed') keys.push('failed-other')
        })
        if (phase === 'failed' && !keys.length) keys.push('failed-other')
        return Array.from(new Set(keys))
    }

    private podPrimaryReason(node: Node): string {
        const currentLabels: Record<string, string> = {
            'crash-loop': 'CrashLoopBackOff',
            'image-pull': 'ImagePullBackOff / ErrImagePull',
            'long-pending': '장기 Pending',
            'unschedulable': 'Unschedulable',
            'long-container-creating': '장기 ContainerCreating',
            'unknown': 'Unknown',
            'long-terminating': '장기 Terminating',
            'running-not-ready': 'Running · NotReady',
            'repeated-oom': '반복 OOMKilled',
            'unrecovered-termination': '대체 파드 없음'
        }
        const historyLabels: Record<string, string> = {
            evicted: 'Evicted',
            oomkilled: 'OOMKilled',
            error: 'Error',
            'deadline-exceeded': 'DeadlineExceeded',
            'node-lost': 'NodeLost',
            'failed-other': '기타 Failed'
        }
        const keys = this.podCurrentProblemKeys(node)
        if (keys.length) return currentLabels[keys[0]]
        const historyKeys = this.podTerminationHistoryKeys(node)
        return historyKeys.length ? historyLabels[historyKeys[0]] : firstValue(node.data || {}, ['K8s.Extra.Status.Reason', 'Reason']) || '상태 확인'
    }

    private podHealth(resources: Node[], windowMs: number): PodHealthSummary {
        const workloads = resources.filter(node => ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(String(node.data?.Type || '').toLowerCase()) >= 0)
        const uniquePods = new Map<string, Node>()
        resources.filter(node => String(node.data?.Type || '').toLowerCase() === 'pod').forEach(node => {
            const uid = firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) || node.id
            uniquePods.set(uid, node)
        })
        const pods = Array.from(uniquePods.values())
        const currentDefinitions = [
            ['crash-loop', 'CrashLoopBackOff'],
            ['image-pull', 'ImagePullBackOff / ErrImagePull'],
            ['long-pending', '장기 Pending'],
            ['unschedulable', 'Unschedulable'],
            ['long-container-creating', '장기 ContainerCreating'],
            ['unknown', 'Unknown'],
            ['long-terminating', '장기 Terminating'],
            ['running-not-ready', 'Running · NotReady'],
            ['repeated-oom', '반복 OOMKilled'],
            ['unrecovered-termination', '대체 파드 없음']
        ]
        const historyDefinitions = [
            ['evicted', 'Evicted 파드'],
            ['oomkilled', 'OOMKilled'],
            ['error', 'Error'],
            ['deadline-exceeded', 'DeadlineExceeded'],
            ['node-lost', 'NodeLost'],
            ['failed-other', '기타 Failed']
        ]
        const currentMap = new Map<string, Node[]>()
        const historyMap = new Map<string, Node[]>()
        currentDefinitions.forEach(([key]) => currentMap.set(key, []))
        historyDefinitions.forEach(([key]) => historyMap.set(key, []))
        const pendingNodes: Node[] = []
        const unknownNodes: Node[] = []
        let running = 0
        let succeeded = 0
        pods.forEach(node => {
            const data = node.data || {}
            const phase = firstValue(data, ['K8s.Extra.Status.Phase', 'K8s.Phase', 'Phase', 'K8s.Status']).toLowerCase()
            if (phase === 'running') running++
            if (phase === 'succeeded') succeeded++
            if (phase === 'pending') pendingNodes.push(node)
            if (phase === 'unknown') unknownNodes.push(node)
            this.podCurrentProblemKeys(node).forEach(key => currentMap.get(key)?.push(node))
            this.podTerminationHistoryKeys(node).forEach(key => historyMap.get(key)?.push(node))
        })
        const healthyWorkloads = new Set(pods.filter(node => {
            const phase = firstValue(node.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Phase', 'Phase', 'K8s.Status']).toLowerCase()
            return phase === 'running' && this.podIsReady(node) && this.podCurrentProblemKeys(node).length === 0
        }).map(node => {
            const namespace = firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
            const workload = this.podWorkloadName(node, workloads)
            return workload ? `${namespace}/${workload}` : ''
        }).filter(Boolean))
        pods.forEach(node => {
            const historyKeys = this.podTerminationHistoryKeys(node)
            if (!historyKeys.length) return
            const data = node.data || {}
            const namespace = firstValue(data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
            const workload = this.podWorkloadName(node, workloads)
            const owners = firstRaw(data, ['K8s.Extra.ObjectMeta.OwnerReferences'])
            const owner = Array.isArray(owners) ? owners.find(item => item?.Controller) || owners[0] : undefined
            const jobOwned = String(owner?.Kind || '').toLowerCase() === 'job'
            if (workload && !jobOwned && !healthyWorkloads.has(`${namespace}/${workload}`)) {
                currentMap.get('unrecovered-termination')?.push(node)
            }
        })
        const unique = (nodes: Node[]): Node[] => Array.from(new Map(nodes.map(node => [node.id, node])).values())
        const currentProblemGroups = currentDefinitions.map(([key, label]) => ({
            key,
            label,
            nodes: unique(currentMap.get(key) || [])
        })).filter(group => group.nodes.length).sort((a, b) => b.nodes.length - a.nodes.length)
        const terminationHistoryGroups = historyDefinitions.map(([key, label]) => ({
            key,
            label,
            nodes: unique(historyMap.get(key) || [])
        })).filter(group => group.nodes.length).sort((a, b) => b.nodes.length - a.nodes.length)
        const activeProblemNodes = unique(currentProblemGroups.reduce((items: Node[], group) => items.concat(group.nodes), []))
        const terminationHistoryNodes = unique(terminationHistoryGroups.reduce((items: Node[], group) => items.concat(group.nodes), []))
        const now = Date.now()
        const recentTerminationNodes = terminationHistoryNodes.filter(node => {
            const timestamp = this.podTimestamp(node).value
            return timestamp !== undefined && timestamp >= now - windowMs
        }).sort((a, b) => (this.podTimestamp(b).value || 0) - (this.podTimestamp(a).value || 0))
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
            const timestamp = this.podTimestamp(node)
            if (timestamp.value !== undefined) timestampAvailableCount++
            if (timestamp.estimated && timestamp.value !== undefined) {
                timestampFallbackCount++
                timestampEstimatedCount++
            } else if (timestamp.value !== undefined) {
                timestampExactCount++
            }
            if (timestamp.value !== undefined && (latestTerminationAt === undefined || timestamp.value > latestTerminationAt)) {
                latestTerminationAt = timestamp.value
                latestTerminationEstimated = timestamp.estimated
            }
        })
        terminationHistoryNodes.sort((a, b) => (this.podTimestamp(b).value || 0) - (this.podTimestamp(a).value || 0))
        const operationalPodTotal = pods.filter(node => {
            const phase = firstValue(node.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Phase', 'Phase', 'K8s.Status']).toLowerCase()
            const currentPhases = ['running', 'pending', 'succeeded', 'unknown']
            return phase !== 'failed' && (!this.podTerminationHistoryKeys(node).length || currentPhases.indexOf(phase) >= 0)
        }).length
        return {
            objectTotal: pods.length,
            total: operationalPodTotal,
            running,
            succeeded,
            pending: pendingNodes.length,
            failed: activeProblemNodes.filter(node => firstValue(node.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Phase', 'Phase', 'K8s.Status']).toLowerCase() === 'failed').length,
            unknown: unknownNodes.length,
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
            recentTimestampExactCount: recentTerminationNodes.filter(node => !this.podTimestamp(node).estimated).length,
            recentTimestampEstimatedCount: recentTerminationNodes.filter(node => this.podTimestamp(node).estimated).length
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

    private affectedServiceCount(resources: Node[], nodeStatus: StatusSummary, activeProblemPods: Node[]): number {
        const collectedCount = this.state.summary?.currentlyImpactedServiceCount !== undefined
            ? Number(this.state.summary.currentlyImpactedServiceCount) || 0
            : this.state.summary?.affectedServices !== undefined
                ? Number(this.state.summary.affectedServices) || 0
                : 0
        const failedNodeNames = new Set(resources.filter(node => String(node.data?.Type || '').toLowerCase() === 'node' && !this.nodeReady(node)).map(node => firstValue(node.data || {}, ['Name', 'K8s.Name'])))
        const impactedPodIDs = new Set([
            ...resources.filter(node => String(node.data?.Type || '').toLowerCase() === 'pod' && failedNodeNames.has(firstValue(node.data || {}, ['K8s.Node', 'NodeName']))).map(node => node.id),
            ...activeProblemPods.map(node => node.id)
        ])
        if (!impactedPodIDs.size && !nodeStatus.notReady) return collectedCount
        const serviceIDs = new Set<string>()
        const adjacency = new Map<string, string[]>()
        this.topologyLinks().forEach(link => {
            const sourceID = endpointID(link?.source)
            const targetID = endpointID(link?.target)
            if (!sourceID || !targetID) return
            adjacency.set(sourceID, [...(adjacency.get(sourceID) || []), targetID])
            adjacency.set(targetID, [...(adjacency.get(targetID) || []), sourceID])
        })
        const nodeMap = new Map(this.topologyNodes().map(node => [node.id, node]))
        impactedPodIDs.forEach(podID => {
            const visited = new Set<string>([podID])
            let frontier = [podID]
            for (let depth = 0; depth < 2; depth++) {
                const next: string[] = []
                frontier.forEach(id => (adjacency.get(id) || []).forEach(relatedID => {
                    if (visited.has(relatedID)) return
                    visited.add(relatedID)
                    const related = nodeMap.get(relatedID)
                    if (related && String(related.data?.Type || '').toLowerCase() === 'service') serviceIDs.add(related.id)
                    else next.push(relatedID)
                }))
                frontier = next
            }
        })
        return Math.max(collectedCount, serviceIDs.size)
    }

    private moldCluster(): any | undefined {
        return this.moldClusterFrom(this.props)
    }

    private focusResources(nodes: Node[]) {
        const ids = nodes.map(node => node.id)
        const app = (window as any).App
        if (ids.length && app && typeof app.focusInfrastructureNodeIDs === 'function') {
            app.focusInfrastructureNodeIDs(ids, this.props.node.id, true)
        }
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
        if (type === 'namespace') return translate('kubernetesTopologyNamespaces')
        if (type === 'pod') return translate('kubernetesTopologyPods')
        if (type === 'service') return translate('kubernetesTopologyServices')
        if (type === 'persistentvolume') return 'PV'
        if (type === 'persistentvolumeclaim') return 'PVC'
        return 'StorageClass'
    }

    private storageResourceIcon(type: 'persistentvolume' | 'persistentvolumeclaim' | 'storageclass') {
        if (type === 'persistentvolumeclaim') return <DetailLayerIcon glyph={'\uf0a0'} />
        if (type === 'persistentvolume') return <DetailLayerIcon glyph={'\uf1c0'} />
        return <DetailLayerIcon glyph={'\uf013'} />
    }

    private renderMetadataItems(items: Array<{ key: string, value: string }>, emptyText: string) {
        if (!items.length) return <DetailEmpty description={emptyText} compact />
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

    private renderResourceCapacity(moldCluster: any) {
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
        const usageCpu = Number(resources?.usageCpuCores) || 0
        const usageMemory = Number(resources?.usageMemoryBytes) || 0
        const usageCpuPercent = metricsAvailable && allocatableCpu > 0 ? usageCpu / allocatableCpu * 100 : undefined
        const usageMemoryPercent = metricsAvailable && allocatableMemory > 0 ? usageMemory / allocatableMemory * 100 : undefined
        const currentUsageTooltip = translate('kubernetesCurrentUsageDescription')
        const allocatableTooltip = translate('kubernetesAllocatableDescription')
        const reservableTooltip = translate('kubernetesReservableDescription')
        const reservationRateTooltip = translate('kubernetesReservationRateDescription')
        const cpuProgressTooltip = `${translate('kubernetesCpuReservationRate')}\n\nRequests ${requestsCpu.toFixed(2)} Core ÷ ${translate('kubernetesAllocatableCapacity')} ${allocatableCpu.toFixed(2)} Core\n= ${requestCpuPercent.toFixed(1)}%`
        const memoryProgressTooltip = `${translate('kubernetesMemoryReservationRate')}\n\nRequests ${formatBinaryBytes(requestsMemory, 'MiB')} ÷ ${translate('kubernetesAllocatableCapacity')} ${formatGiB(allocatableMemory)}\n= ${requestMemoryPercent.toFixed(1)}%`
        const memoryRequestTooltip = `${translate('kubernetesRequestDescription')}\n\n${translate('kubernetesDisplayedValue')}: ${formatGiB(requestsMemory)}\n${translate('kubernetesOriginalValue')}: ${formatBinaryBytes(requestsMemory, 'MiB')}`
        const memoryLimitTooltip = `${translate('kubernetesLimitDescription')}\n\n${translate('kubernetesDisplayedValue')}: ${formatGiB(limitsMemory)}\n${translate('kubernetesOriginalValue')}: ${formatBinaryBytes(limitsMemory, 'MiB')}`
        const metricsState = this.metricsState()

        if (!resources && !provisionedCores && !provisionedMemory) {
            return this.renderMetricsUnavailable(metricsState)
        }

        return (
            <div className="netdive-k8s-cluster-detail__capacity">
                {!metricsAvailable && this.renderMetricsUnavailable(metricsState, true)}
                {resources && (
                    <div className="netdive-k8s-cluster-detail__capacity-grid">
                        <div className="netdive-k8s-cluster-detail__capacity-card">
                            <div className="netdive-k8s-cluster-detail__capacity-title"><Tooltip overlayClassName="netdive-k8s-cluster-detail__capacity-tooltip" title={translate('kubernetesCpuUnitDescription')}><strong>CPU</strong></Tooltip><span><Tooltip overlayClassName="netdive-k8s-cluster-detail__capacity-tooltip" title={reservationRateTooltip}><span className="netdive-k8s-cluster-detail__tooltip-label">{translate('kubernetesRequestRate')}</span></Tooltip> <b>{requestCpuPercent.toFixed(1)}%</b></span></div>
                            <Tooltip overlayClassName="netdive-k8s-cluster-detail__capacity-tooltip" title={cpuProgressTooltip}><Progress percent={requestCpuPercent} showInfo={false} strokeColor="#1677ff" trailColor="#eef2f6" /></Tooltip>
                            {this.renderCapacityMetrics([
                                { label: translate('kubernetesCurrentUsage'), value: metricsAvailable ? usageCpu.toFixed(2) : translate('kubernetesNotCollected'), unit: metricsAvailable ? 'Core' : undefined, meta: usageCpuPercent !== undefined ? `${translate('kubernetesUsageRate')} ${usageCpuPercent.toFixed(1)}%` : undefined, current: true, tooltip: currentUsageTooltip },
                                { label: translate('kubernetesAllocatableLabel'), value: allocatableCpu > 0 ? `${allocatableCpu.toFixed(2)} Core` : translate('kubernetesUnknown'), tooltip: allocatableTooltip, tooltipOnLabel: true },
                                { label: 'Requests', value: `${requestsCpu.toFixed(2)} Core`, tooltip: translate('kubernetesRequestDescription') },
                                { label: 'Limits', value: `${limitsCpu.toFixed(2)} Core`, tooltip: translate('kubernetesLimitDescription') },
                                { label: translate('kubernetesReservable'), value: allocatableCpu > 0 ? `${Math.max(0, allocatableCpu - requestsCpu).toFixed(2)} Core` : translate('kubernetesUnknown'), tooltip: reservableTooltip, emphasis: 'reservable' }
                            ])}
                        </div>
                        <div className="netdive-k8s-cluster-detail__capacity-card">
                            <div className="netdive-k8s-cluster-detail__capacity-title"><Tooltip overlayClassName="netdive-k8s-cluster-detail__capacity-tooltip" title={translate('kubernetesMemoryUnitDescription')}><strong>{translate('kubernetesMemory')}</strong></Tooltip><span><Tooltip overlayClassName="netdive-k8s-cluster-detail__capacity-tooltip" title={reservationRateTooltip}><span className="netdive-k8s-cluster-detail__tooltip-label">{translate('kubernetesRequestRate')}</span></Tooltip> <b>{requestMemoryPercent.toFixed(1)}%</b></span></div>
                            <Tooltip overlayClassName="netdive-k8s-cluster-detail__capacity-tooltip" title={memoryProgressTooltip}><Progress percent={requestMemoryPercent} showInfo={false} strokeColor="#1677ff" trailColor="#eef2f6" /></Tooltip>
                            {this.renderCapacityMetrics([
                                { label: translate('kubernetesCurrentUsage'), ...this.metricValueWithUnit(metricsAvailable ? formatGiB(usageMemory) : translate('kubernetesNotCollected'), metricsAvailable), meta: usageMemoryPercent !== undefined ? `${translate('kubernetesUsageRate')} ${usageMemoryPercent.toFixed(1)}%` : undefined, current: true, tooltip: currentUsageTooltip },
                                { label: translate('kubernetesAllocatableLabel'), value: allocatableMemory > 0 ? formatGiB(allocatableMemory) : translate('kubernetesUnknown'), tooltip: allocatableTooltip, tooltipOnLabel: true },
                                { label: 'Requests', value: formatGiB(requestsMemory), tooltip: memoryRequestTooltip },
                                { label: 'Limits', value: formatGiB(limitsMemory), tooltip: memoryLimitTooltip },
                                { label: translate('kubernetesReservable'), value: allocatableMemory > 0 ? formatGiB(Math.max(0, allocatableMemory - requestsMemory)) : translate('kubernetesUnknown'), tooltip: reservableTooltip, emphasis: 'reservable' }
                            ])}
                        </div>
                    </div>
                )}
                <div className="netdive-k8s-cluster-detail__capacity-compare">
                    {provisionedCores || provisionedMemory ? <span>
                        <span className="netdive-k8s-cluster-detail__capacity-compare-label"><small>{translate('kubernetesMoldVmAllocation')} <Tooltip overlayClassName="netdive-k8s-cluster-detail__capacity-tooltip" title={translate('kubernetesMoldVmAllocationDescription')}><InfoCircleOutlined className="netdive-k8s-cluster-detail__metric-info" /></Tooltip></small></span>
                        <span className="netdive-k8s-cluster-detail__capacity-compare-values"><span><small>CPU</small><strong>{provisionedCores ? `${provisionedCores} vCPU` : translate('kubernetesNotCollected')}</strong></span><span><small>Memory</small><strong>{provisionedMemory ? formatBinaryBytes(provisionedMemory * 1024 * 1024, 'GiB') : translate('kubernetesNotCollected')}</strong></span></span>
                    </span> : null}
                    {allocatableCpu || allocatableMemory ? <span>
                        <span className="netdive-k8s-cluster-detail__capacity-compare-label"><small>{translate('kubernetesAllocatableCapacity')} <Tooltip overlayClassName="netdive-k8s-cluster-detail__capacity-tooltip" title={translate('kubernetesAllocatableCapacityDescription')}><InfoCircleOutlined className="netdive-k8s-cluster-detail__metric-info" /></Tooltip></small></span>
                        <span className="netdive-k8s-cluster-detail__capacity-compare-values"><span><small>CPU</small><strong>{allocatableCpu ? `${allocatableCpu.toFixed(2)} Core` : translate('kubernetesNotCollected')}</strong></span><span><small>Memory</small><strong>{allocatableMemory ? formatGiB(allocatableMemory) : translate('kubernetesNotCollected')}</strong></span></span>
                    </span> : null}
                </div>
            </div>
        )
    }

    private metricValueWithUnit(value: string, separateUnit: boolean): { value: string, unit?: string } {
        if (!separateUnit) return { value }
        const separator = value.lastIndexOf(' ')
        if (separator <= 0) return { value }
        return { value: value.slice(0, separator), unit: value.slice(separator + 1) }
    }

    private renderCapacityMetrics(items: Array<{ label?: string, value?: string, unit?: string, meta?: string, current?: boolean, emphasis?: 'reservable', tooltip?: React.ReactNode, tooltipOnLabel?: boolean }>) {
        return (
            <div className="netdive-k8s-cluster-detail__capacity-metrics">
                {items.map((item, index) => (
                    <div key={item.label || index} className={`netdive-k8s-cluster-detail__capacity-metric ${item.current ? 'is-current' : ''} ${item.emphasis === 'reservable' ? 'is-reservable' : ''}`}>
                        <React.Fragment>
                            <span>{item.tooltipOnLabel ? <Tooltip overlayClassName="netdive-k8s-cluster-detail__capacity-tooltip" title={item.tooltip}><span className="netdive-k8s-cluster-detail__tooltip-label">{item.label}</span></Tooltip> : item.label}{item.tooltip && !item.tooltipOnLabel && <Tooltip overlayClassName="netdive-k8s-cluster-detail__capacity-tooltip" title={item.tooltip}><InfoCircleOutlined className="netdive-k8s-cluster-detail__metric-info" /></Tooltip>}</span>
                            <strong><span className="netdive-k8s-cluster-detail__metric-primary"><span className="netdive-k8s-cluster-detail__metric-number">{item.value}</span>{item.unit && <span className="netdive-k8s-cluster-detail__metric-unit">{item.unit}</span>}</span>{item.meta && <small className="netdive-k8s-cluster-detail__metric-meta">{item.meta}</small>}</strong>
                        </React.Fragment>
                    </div>
                ))}
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

    private operationalStatus(controlPlane: StatusSummary, nodes: StatusSummary, pods: PodHealthSummary, unavailableWorkloads: Node[], affectedServices: number, recentNodeSignals: number): { label: string, tone: DetailBadgeTone } {
        if (!nodes.total && !pods.total && !controlPlane.total) return { label: translate('kubernetesHealthUnknown'), tone: 'default' }
        if ((controlPlane.notReady || 0) > 0 || (nodes.notReady || 0) > 0 || pods.unknownNodes.length > 0 || unavailableWorkloads.length > 0 || affectedServices > 0) return { label: translate('kubernetesHealthCritical'), tone: 'danger' }
        if (pods.activeProblemNodes.length > 0 || recentNodeSignals > 0) return { label: translate('kubernetesHealthWarning'), tone: 'warning' }
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

    private renderResilienceRow(title: string, label: string, tone: DetailBadgeTone, value: React.ReactNode, short: string, tooltip?: React.ReactNode) {
        const state = tone === 'success'
            ? <span className="netdive-k8s-cluster-detail__impact-normal"><i />{label}</span>
            : tone === 'default'
            ? <span className="netdive-k8s-cluster-detail__impact-unknown">{label}</span>
            : <DetailBadge tone={tone}>{label}</DetailBadge>
        const content = (
            <div className={`netdive-k8s-cluster-detail__resilience-row netdive-k8s-cluster-detail__resilience-row--${tone}`}>
                <span>{title}</span>
                <div>{state}</div>
                <strong>{value}</strong>
                <small className="netdive-k8s-cluster-detail__resilience-evidence">
                    <b>근거</b>
                    <span>{short}</span>
                </small>
            </div>
        )
        return tooltip ? <Tooltip title={tooltip} placement="top">{content}</Tooltip> : content
    }

    private heroConclusion(controlPlane: StatusSummary, nodes: StatusSummary, pods: PodHealthSummary, unavailableWorkloads: Node[], affectedServices: number, recentNodeSignals: number, currentRiskTitle?: string): string {
        if (controlPlane.notReady) return translate('kubernetesHeroControlPlaneFailure').replace('{count}', String(controlPlane.notReady))
        const workerNotReady = Math.max(0, (nodes.notReady || 0) - (controlPlane.notReady || 0))
        if (workerNotReady) return translate('kubernetesHeroWorkerFailure').replace('{count}', String(workerNotReady))
        if (affectedServices) return translate('kubernetesHeroServiceImpact').replace('{count}', String(affectedServices))
        if (unavailableWorkloads.length) return `가용 Replica가 부족한 워크로드 ${unavailableWorkloads.length}개가 있습니다.`
        if (pods.unknownNodes.length) return `Unknown 파드 ${pods.unknownNodes.length}개를 확인해야 합니다.`
        if (pods.activeProblemNodes.length) return `현재 문제 파드 ${pods.activeProblemNodes.length}개를 확인해야 합니다.`
        if (recentNodeSignals) return `최근 ${this.instabilityWindowLabel()} 동안 노드 상태 전환이 확인되었습니다. 현재 서비스 영향은 없습니다.`
        if (currentRiskTitle) return currentRiskTitle
        return translate('kubernetesHeroNoImpact')
    }

    private instabilityWindowMs(): number {
        const windows: Record<string, number> = {
            '10m': 10 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        }
        return windows[this.state.instabilityWindow] || windows['1h']
    }

    private instabilityWindowLabel(): string {
        const labels: Record<string, string> = { '10m': '10분', '1h': '1시간', '6h': '6시간', '24h': '24시간', '7d': '7일' }
        return labels[this.state.instabilityWindow] || labels['1h']
    }

    private podTerminationRecovery(node: Node, resources: Node[], unavailableWorkloads: Node[]): { label: string, tone: string } {
        const workloads = resources.filter(item => ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(String(item.data?.Type || '').toLowerCase()) >= 0)
        const workloadName = this.podWorkloadName(node, workloads)
        if (!workloadName) return { label: '확인 필요', tone: 'default' }
        const unavailable = unavailableWorkloads.some(item => firstValue(item.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) === workloadName)
        if (unavailable) return { label: '영향 중', tone: 'danger' }
        const namespace = firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
        const replacement = resources.some(item => {
            if (String(item.data?.Type || '').toLowerCase() !== 'pod') return false
            if (firstValue(item.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) !== namespace) return false
            if (firstValue(item.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Phase', 'Phase', 'K8s.Status']).toLowerCase() !== 'running') return false
            return this.podWorkloadName(item, workloads) === workloadName
        })
        return replacement ? { label: '복구됨', tone: 'success' } : { label: '확인 필요', tone: 'default' }
    }

    private renderPodStatusList(nodes: Node[], resources: Node[], unavailableWorkloads: Node[], reasonLabel?: string, currentProblem = false) {
        if (!nodes.length) return <DetailEmpty description="선택한 상태의 파드가 없습니다." compact />
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

    private renderPodStatusSummary(summary: PodHealthSummary) {
        const groups = [
            { key: 'current', label: '현재 문제', description: '운영 상태 및 서비스 영향 판정에 반영', items: summary.currentProblemGroups },
            { key: 'history', label: '종료 이력', description: '현재 장애 판정에서 제외', items: summary.terminationHistoryGroups }
        ].filter(group => group.items.length)
        if (!groups.length) return null
        return <div className="netdive-k8s-cluster-detail__pod-status-summary">
            <strong className="netdive-k8s-cluster-detail__pod-status-title">파드 상태 요약</strong>
            {groups.map(group => <div key={group.key} className={`netdive-k8s-cluster-detail__pod-status-group is-${group.key}`}>
                <div className="netdive-k8s-cluster-detail__pod-status-group-head">
                    <b>{group.label}</b>
                    <small>{group.description}</small>
                </div>
                <div className="netdive-k8s-cluster-detail__pod-status-items">
                    {group.items.map(item => <button
                        type="button"
                        key={item.key}
                        onClick={() => this.setState({ podStatusModalMode: group.key as 'current' | 'history', podStatusModalKey: item.key })}>
                        <span>{item.label}</span>
                        <strong>{item.nodes.length}</strong>
                    </button>)}
                </div>
            </div>)}
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
        if (!groups.length) return <DetailEmpty description={translate('kubernetesNoRecentChanges')} compact />
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
        const serviceResource = summaries.find(summary => summary.type === 'service') as ResourceSummary
        const persistentVolumeResource = summaries.find(summary => summary.type === 'persistentvolume') as ResourceSummary
        const persistentVolumeClaimResource = summaries.find(summary => summary.type === 'persistentvolumeclaim') as ResourceSummary
        const storageClassResource = summaries.find(summary => summary.type === 'storageclass') as ResourceSummary
        const workloadNodes = resources.filter(node => ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(String(node.data?.Type || '').toLowerCase()) >= 0)
        const unavailableWorkloads = this.unavailableWorkloads(resources)
        const recentNodeSignals = this.recentNodeSignalNodes(resources, this.instabilityWindowMs())
        const namespaceCount = this.state.summary?.namespaceCount !== undefined ? this.state.summary.namespaceCount : this.state.summary?.namespaces !== undefined ? this.state.summary.namespaces : namespaceResource.nodes.length
        const serviceCount = this.state.summary?.serviceCount !== undefined ? this.state.summary.serviceCount : this.state.summary?.services !== undefined ? this.state.summary.services : serviceResource.nodes.length
        const hostPlacements = this.nodePlacements(resources)
        const switchPlacements = this.switchPlacements(hostPlacements)
        const affectedServices = this.affectedServiceCount(resources, nodeSummary, podSummary.activeProblemNodes)
        const externalPathCount = Number(this.state.summary?.externalPathCount) || 0
        const impactScore = Math.min(100, (nodeSummary.notReady || 0) * 30 + (podSummary.activeProblemNodes.length + unavailableWorkloads.length) * 10 + affectedServices * 10)
        const hostAnalysis = this.placementAnalysis(hostPlacements, nodeSummary.total)
        const networkAnalysis = this.placementAnalysis(switchPlacements, nodeSummary.total, true)
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
            <strong>구조적 취약도 {potentialEvaluated ? `${potentialScore} / 100` : '평가 불가'}</strong>
            <p>현재 장애 점수와 별도로 구조적 배치·연결 취약성만 평가한 점수입니다.</p>
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
            this.state.summary?.apiConnectionStatus ? { label: translate('kubernetesApiConnectionStatus'), value: this.state.summary.apiConnectionStatus } : null,
            moldCluster?.state ? { label: translate('kubernetesMoldDeploymentStatus'), value: <DetailBadge tone={/running/i.test(moldCluster.state) ? 'success' : 'warning'}>{moldCluster.state}</DetailBadge> } : null,
            { label: translate('kubernetesApiServer'), value: apiServer || translate('kubernetesNoConnectionInfo'), textValue: apiServer, copyText: apiServer || undefined },
            moldCluster?.zoneName ? { label: translate('kubernetesZone'), value: moldCluster.zoneName } : null,
            moldCluster?.networkName ? { label: translate('kubernetesNetwork'), value: moldCluster.networkName } : null
        ].filter(Boolean)
        const advancedRows: any[] = [
            { label: translate('kubernetesClusterUid'), value: uid || translate('kubernetesNotCollected'), textValue: uid, copyText: uid || undefined },
            { label: translate('kubernetesMoldClusterId'), value: moldCluster?.id || translate('kubernetesNoConnectionInfo'), textValue: moldCluster?.id, copyText: moldCluster?.id },
            moldCluster?.serviceOffering ? { label: translate('kubernetesServiceOffering'), value: moldCluster.serviceOffering } : null,
            createdAt ? { label: translate('kubernetesCreatedAt'), value: createdAt } : null
        ].filter(Boolean)
        const podStatusCollectedForDisplay = podResource.nodes.length > 0
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
                value: podStatusCollectedForDisplay ? podSummary.total : '–',
                details: [
                    { label: 'Running', value: podStatusCollectedForDisplay ? podSummary.running || 0 : '–' },
                    { label: 'Pending', value: podStatusCollectedForDisplay ? podSummary.pending || 0 : '–' },
                    { label: '현재 문제', value: podStatusCollectedForDisplay ? podSummary.activeProblemNodes.length : '–' },
                    { label: 'Unknown', value: podStatusCollectedForDisplay ? podSummary.unknownNodes.length : '–' },
                    { label: '완료', value: podStatusCollectedForDisplay ? podSummary.succeeded : '–' }
                ]
            },
            {
                key: 'services',
                label: translate('kubernetesAffectedServiceKpi'),
                value: serviceStatusCollectedForDisplay ? affectedServices : '–',
                details: [
                    { label: translate('kubernetesNoServiceImpact'), value: serviceStatusCollectedForDisplay ? Math.max(0, serviceCount - affectedServices) : '–' },
                    { label: translate('kubernetesServiceAffected'), value: serviceStatusCollectedForDisplay ? affectedServices : '–' }
                ]
            }
        ]
        const abnormalItems = [
            ...(controlPlane.notReady ? [{ key: 'control-plane', label: 'Control Plane', status: 'Degraded', value: controlPlane.notReady, tone: 'danger' }] : []),
            ...(nodeSummary.notReady ? [{ key: 'nodes', label: translate('kubernetesTopologyNodes'), status: 'NotReady', value: nodeSummary.notReady, tone: 'danger' }] : []),
            ...(podSummary.activeProblemNodes.length ? [{ key: 'pods-active', label: '현재 문제 파드', status: '활성 문제', value: podSummary.activeProblemNodes.length, tone: podSummary.unknownNodes.length ? 'danger' : 'warning', nodes: podSummary.activeProblemNodes }] : []),
            ...(podSummary.unknownNodes.length ? [{ key: 'pods-unknown', label: translate('kubernetesTopologyPods'), status: 'Unknown', value: podSummary.unknownNodes.length, tone: 'danger', nodes: podSummary.unknownNodes }] : []),
            ...(unavailableWorkloads.length ? [{ key: 'workloads-unavailable', label: '워크로드', status: 'Replica 부족', value: unavailableWorkloads.length, tone: 'danger', nodes: unavailableWorkloads }] : []),
            ...(affectedServices ? [{ key: 'services', label: translate('kubernetesAffectedServiceKpi'), status: translate('kubernetesServiceAffected'), value: affectedServices, tone: 'danger' }] : [])
        ]
        const recentAffectedNodeNames = new Set(podSummary.recentTerminationNodes.map(node => firstValue(node.data || {}, ['K8s.Node', 'NodeName', 'K8s.Extra.Spec.NodeName'])).filter(Boolean))
        const historyNodeTargets = nodeResource.nodes.filter(node => recentAffectedNodeNames.has(firstValue(node.data || {}, ['Name', 'K8s.Name'])))
        const recentAffectedWorkloadNames = new Set(podSummary.recentTerminationNodes.map(node => this.podWorkloadName(node, workloadNodes)).filter(Boolean))
        const historyWorkloadTargets = workloadNodes.filter(node => recentAffectedWorkloadNames.has(firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'])))
        const unrecoveredWorkloadTargets = unavailableWorkloads.filter(node => recentAffectedWorkloadNames.has(firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'])))
        const selectedPodStatusGroup = this.state.podStatusModalMode === 'current'
            ? podSummary.currentProblemGroups.find(group => group.key === this.state.podStatusModalKey)
            : podSummary.terminationHistoryGroups.find(group => group.key === this.state.podStatusModalKey)
        const selectedPodStatusNodes = this.state.podStatusModalMode === 'recent'
            ? podSummary.recentTerminationNodes
            : selectedPodStatusGroup?.nodes || []
        const historyWindowAvailable = !podSummary.terminationHistoryNodes.length || podSummary.timestampAvailableCount > 0
        const nodeWindowAvailable = this.nodeSignalTimestampsAvailable(resources)
        const instabilityWindowAvailable = historyWindowAvailable || nodeWindowAvailable
        const historyTimeQualityTooltip = <div className="netdive-k8s-cluster-detail__risk-score-tooltip">
            <strong>최근 {this.instabilityWindowLabel()} 종료 이력 {podSummary.recentTerminationNodes.length}</strong>
            <p>정확 {podSummary.recentTimestampExactCount}건 · 추정 {podSummary.recentTimestampEstimatedCount}건</p>
            <span>시간 산정 우선순위</span>
            <ul>
                <li><span>종료 시각</span><b>terminated.finishedAt</b></li>
                <li><span>상태 전환</span><b>condition.lastTransitionTime</b></li>
                <li><span>이벤트</span><b>종료 관련 Event 시간</b></li>
                <li><span>생성 시각</span><b>creationTimestamp · 추정</b></li>
            </ul>
        </div>
        const healthEvidence = <div className="netdive-k8s-cluster-detail__health-evidence">
            <strong>현재 상태: {health.label}</strong>
            <span>현재 영향</span>
            <ul>
                <li>비정상 Node {nodeSummary.notReady || 0}</li>
                <li>현재 문제 파드 {podSummary.activeProblemNodes.length}</li>
                <li>가용 Replica 부족 {unavailableWorkloads.length}</li>
                <li>영향 서비스 {affectedServices}</li>
            </ul>
            {instabilityWindowAvailable && <React.Fragment>
                <span>최근 이상 · {this.instabilityWindowLabel()}</span>
                <ul><li>파드 종료 이력 {podSummary.recentTerminationNodes.length}</li><li>노드 상태 전환 {recentNodeSignals.length}</li><li>영향 노드 {recentAffectedNodeNames.size}</li></ul>
            </React.Fragment>}
            <span>누적 이력</span>
            <ul><li>종료 파드 {podSummary.terminationHistoryNodes.length}</li></ul>
            <span>구조적 위험</span>
            <ul><li>Control Plane {controlPlane.total || '미수집'}</li><li>네트워크 경로 {networkAnalysis.known.length || '미수집'}</li></ul>
            <span>마지막 수집 · {collectedAt || updatedAt || translate('kubernetesNoCollectionRecord')}</span>
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
                <DetailSection
                    icon={<InfoIcon />}
                    title={translate('kubernetesClusterBasicInfo')}
                    collapsible
                    collapsed={this.state.basicCollapsed}
                    onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                    <DetailKeyValueList rows={overviewRows} copyTooltip={translate('copy')} />
                    <Collapse
                        accordion
                        bordered={false}
                        className="netdive-k8s-cluster-detail__basic-collapse"
                        activeKey={this.state.basicInfoActiveKey}
                        expandIconPosition="right"
                        onChange={key => this.setState({ basicInfoActiveKey: Array.isArray(key) ? String(key[0] || '') : String(key || '') })}>
                        <Collapse.Panel header={translate('kubernetesAdvancedInformation')} key="advanced">
                            <DetailKeyValueList rows={advancedRows} copyTooltip={translate('copy')} />
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
                </DetailSection>

                <DetailSection icon={this.topologyIcon(this.props.node)} title={translate('kubernetesOperationalStatus')}>
                    <Tooltip title={healthEvidence} placement="top">
                        <div className={`netdive-k8s-cluster-detail__operation-hero netdive-k8s-cluster-detail__operation-hero--${health.tone}`}>
                            <span className="netdive-k8s-cluster-detail__operation-dot" />
                            <strong>{health.label}</strong>
                            <p>{heroConclusion}</p>
                        </div>
                    </Tooltip>
                    <div className="netdive-k8s-cluster-detail__availability-strip">
                        {availabilityItems.map(item => (
                            <Popover
                                key={item.key}
                                trigger="click"
                                placement="bottom"
                                overlayClassName="netdive-k8s-cluster-detail__status-popover"
                                title={item.label}
                                content={<div className="netdive-k8s-cluster-detail__status-distribution">
                                    {item.details.map(detail => <div key={detail.label}><span>{detail.label}</span><strong>{detail.value}</strong></div>)}
                                </div>}>
                                <button type="button" className={`netdive-k8s-cluster-detail__availability-item netdive-k8s-cluster-detail__availability-item--${item.key}`} aria-label={`${item.label} ${translate('kubernetesStatusDistribution')}`}>
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                </button>
                            </Popover>
                        ))}
                    </div>
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
                        <div className="netdive-k8s-cluster-detail__instability-head">
                            <strong>최근 불안정성</strong>
                            <span className="netdive-k8s-cluster-detail__instability-controls">
                                {podSummary.recentTimestampEstimatedCount > 0 && <Tooltip title={historyTimeQualityTooltip} placement="top">
                                    <span><DetailBadge tone="warning">추정 포함</DetailBadge></span>
                                </Tooltip>}
                                <Tooltip title="기간별 종료 이력과 영향을 다시 계산합니다.">
                                    <span><Select size="small" value={this.state.instabilityWindow} onChange={instabilityWindow => this.setState({ instabilityWindow })}>
                                    <Select.Option value="10m">10분</Select.Option>
                                    <Select.Option value="1h">1시간</Select.Option>
                                    <Select.Option value="6h">6시간</Select.Option>
                                    <Select.Option value="24h">24시간</Select.Option>
                                    <Select.Option value="7d">7일</Select.Option>
                                    </Select></span>
                                </Tooltip>
                            </span>
                        </div>
                        <Tooltip title={historyTimeQualityTooltip} placement="top">
                            <div className="netdive-k8s-cluster-detail__instability-quality">
                                최근 {this.instabilityWindowLabel()} 종료 이력 <strong>{podSummary.recentTerminationNodes.length}</strong>
                                <span>정확 {podSummary.recentTimestampExactCount} · 추정 {podSummary.recentTimestampEstimatedCount}</span>
                            </div>
                        </Tooltip>
                        <div className="netdive-k8s-cluster-detail__instability-grid">
                            <button type="button" disabled={!podSummary.recentTerminationNodes.length} onClick={() => this.setState({ podStatusModalMode: 'recent', podStatusModalKey: '' })}>
                                <span>종료 파드</span>
                                <strong className={podSummary.recentTerminationNodes.length ? 'is-warning' : ''}>{podSummary.recentTerminationNodes.length}</strong>
                            </button>
                            <button type="button" disabled={!historyNodeTargets.length} onClick={() => this.focusResources(historyNodeTargets)}>
                                <span>영향 노드</span>
                                <strong>{recentAffectedNodeNames.size}</strong>
                            </button>
                            <button type="button" disabled={!historyWorkloadTargets.length} onClick={() => this.focusResources(historyWorkloadTargets)}>
                                <span>영향 워크로드</span>
                                <strong>{recentAffectedWorkloadNames.size}</strong>
                            </button>
                            <button type="button" disabled={!unrecoveredWorkloadTargets.length} onClick={() => this.focusResources(unrecoveredWorkloadTargets)}>
                                <span>미복구 워크로드</span>
                                <strong className={unrecoveredWorkloadTargets.length ? 'is-warning' : ''}>{unrecoveredWorkloadTargets.length}</strong>
                            </button>
                        </div>
                    </div>}
                    <div className="netdive-k8s-cluster-detail__collection-status">
                        <span>{translate('kubernetesDataCollectionStatus')}</span>
                        <Tooltip title={metricState.description}><span><DetailBadge tone={metricState.tone}>{metricState.label}</DetailBadge></span></Tooltip>
                        <strong>{collectedAt ? <Tooltip title={`판정 기준 ${collectedAt}`}><span>{formatRelativeDate(this.state.summary?.lastSyncAt || this.state.summary?.collectedAt)}</span></Tooltip> : (updatedAt || translate('kubernetesNoCollectionRecord'))}</strong>
                    </div>
                </DetailSection>

                <DetailSection icon={<ErrorOutlineIcon />} title={translate('kubernetesRiskResilience')}>
                    <div className={`netdive-k8s-cluster-detail__alert-summary ${currentRisks.length ? 'has-alert' : ''}`}>
                        <span className="netdive-k8s-cluster-detail__alert-dot" />
                        <strong>{currentRisks.length ? currentRisks[0].title : translate('kubernetesNoCurrentAlerts')}</strong>
                        {currentRisks.length > 1 && <small>+{currentRisks.length - 1}</small>}
                    </div>
                    <div className="netdive-k8s-cluster-detail__resilience-rows">
                        {this.renderResilienceRow(translate('kubernetesCurrentFailureImpact'), currentImpactGrade.label, currentImpactGrade.tone, `${impactScore} / 100`, `영향 점수 ${impactScore}/100 · 현재 상태 기준`, translate('kubernetesCurrentFailureImpactTooltip'))}
                        {instabilityWindowAvailable && this.renderResilienceRow('최근 불안정성', podSummary.recentTerminationNodes.length || recentNodeSignals.length ? translate('kubernetesHealthWarning') : translate('kubernetesHealthNormal'), podSummary.recentTerminationNodes.length || recentNodeSignals.length ? 'warning' : 'success', podSummary.recentTerminationNodes.length + recentNodeSignals.length, `종료 이력 ${podSummary.recentTerminationNodes.length}건, 노드 상태 전환 ${recentNodeSignals.length}건 · 최근 ${this.instabilityWindowLabel()} 기준`)}
                        {this.renderResilienceRow(translate('kubernetesPotentialInfrastructureRisk'), potentialEvaluated && potentialScore >= 75 ? '매우 높음' : potentialGrade.label, potentialGrade.tone, potentialEvaluated ? `${potentialScore} / 100` : '–', potentialEvaluated ? `구조적 취약도 ${potentialScore}/100 · 현재 장애 점수와 분리` : '분석 데이터 미수집 · 평가 불가', potentialScoreTooltip)}
                        {this.renderResilienceRow(
                            translate('kubernetesHostDistributionShort'),
                            hostAnalysis.tone === 'warning' ? translate('kubernetesResilienceRecommended') : hostAnalysis.label,
                            hostAnalysis.tone,
                            hostPlacementEvaluated ? (hostAnalysis.tone === 'warning' ? '낮음' : '양호') : '–',
                            !hostPlacementEvaluated
                                ? '호스트 배치 미수집 · 평가 불가'
                                : hostAnalysis.known.length === 1
                                    ? '호스트 수 1대 · 단일 호스트 집중'
                                    : `호스트 수 ${hostAnalysis.known.length}대 · 분산 배치`)}
                        {this.renderResilienceRow(
                            '네트워크 복원력',
                            networkAnalysis.tone === 'warning' ? translate('kubernetesResilienceRecommended') : networkAnalysis.label,
                            networkAnalysis.tone,
                            networkPlacementEvaluated ? (networkAnalysis.tone === 'warning' ? '매우 낮음' : '양호') : '–',
                            !networkPlacementEvaluated
                                ? '네트워크 경로 미수집 · 평가 불가'
                                : networkAnalysis.known.length === 1
                                    ? `단일 경로 비율 ${networkAnalysis.topPercent}% · 연결 스위치 1대`
                                    : `최대 경로 집중도 ${networkAnalysis.topPercent}% · 연결 스위치 ${networkAnalysis.known.length}대`)}
                        {this.renderResilienceRow(
                            translate('kubernetesControlPlaneResilience'),
                            !controlPlane.total ? translate('kubernetesResilienceUnavailable') : controlPlane.total === 1 ? translate('kubernetesResilienceRecommended') : translate('kubernetesResilienceGood'),
                            !controlPlane.total ? 'default' : controlPlane.total === 1 ? 'warning' : 'success',
                            !controlPlane.total ? '–' : controlPlane.total === 1 ? '낮음' : '양호',
                            !controlPlane.total ? 'Control Plane 미수집 · 평가 불가' : controlPlane.total === 1 ? 'Control Plane 노드 1대 · 이중화 없음' : `Control Plane 노드 ${controlPlane.total}대 · 다중 구성`)}
                        {this.renderResilienceRow(translate('kubernetesExternalPaths'), externalAnalysis.label, externalAnalysis.tone, externalAnalysis.value, externalAnalysis.short, externalAnalysis.description)}
                    </div>
                    <KubernetesAnalysisConfidence
                        state={confidenceState}
                        collected={confidenceCollected}
                        missing={confidenceMissing}
                        contextNote={podSummary.timestampEstimatedCount > 0
                            ? `현재 상태·구조 분석과 별도로 파드 종료 이력의 기간 분석에는 정확 시각 ${podSummary.timestampExactCount}건과 생성 시각 기반 추정 ${podSummary.timestampEstimatedCount}건이 사용됩니다.`
                            : undefined} />
                </DetailSection>

                <ConnectedResourcesSection
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
                            ...(workloadNodes.length ? [{ key: 'workloads', label: translate('kubernetesTopologyWorkloadControllers'), count: workloadNodes.length, icon: <DetailLayerIcon glyph={'\uf5fd'} />, iconTone: 'kubernetes' as const, onClick: () => this.focusResources(workloadNodes) }] : []),
                            { key: 'pods', label: this.resourceLabel('pod'), count: podSummary.objectTotal, icon: this.resourceIcon(podResource), iconTone: 'kubernetes', onClick: podResource.nodes.length ? () => this.focusResources(podResource.nodes) : undefined, tooltip: translate('kubernetesFocusPods') },
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
                                ...(storageClassResource.nodes.length ? [{ key: 'storage-classes', label: this.resourceLabel('storageclass'), count: storageClassResource.nodes.length, icon: this.storageResourceIcon('storageclass'), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(storageClassResource.nodes), tooltip: 'StorageClass' }] : [])
                            ]
                        }
                    ]} />

                <DetailSection icon={<AccountTreeIcon />} title={translate('kubernetesResourceCapacity')}>
                    {this.renderResourceCapacity(moldCluster)}
                </DetailSection>

                <DetailSection
                    icon={<HistoryOutlined />}
                    title={translate('kubernetesRecentChanges')}
                    action={recentChangeGroups.length > 4 ? <button
                        type="button"
                        className="netdive-k8s-cluster-detail__change-view-all"
                        onClick={() => this.setState({ recentChangesModalOpen: true, expandedRecentChangeKey: '' })}>
                        {translate('kubernetesRecentChangesViewAll')}
                    </button> : undefined}>
                    {this.renderRecentChanges(recentChangeGroups, 4)}
                </DetailSection>
                </React.Fragment> : this.renderServiceBrowser(serviceResource.nodes)}

                <Modal
                    visible={!!this.state.podStatusModalMode}
                    className="netdive-k8s-cluster-detail__eviction-modal"
                    title={this.state.podStatusModalMode === 'recent'
                        ? `최근 ${this.instabilityWindowLabel()} 종료 파드`
                        : `${this.state.podStatusModalMode === 'current' ? '현재 문제' : '종료 이력'} · ${selectedPodStatusGroup?.label || '파드'}`}
                    width={620}
                    footer={null}
                    destroyOnClose
                    onCancel={() => this.setState({ podStatusModalMode: '', podStatusModalKey: '' })}>
                    {this.state.podStatusModalMode === 'recent' && podSummary.terminationHistoryGroups.length > 0 && <div className="netdive-k8s-cluster-detail__eviction-causes">
                        <strong>상태 분류</strong>
                        {podSummary.terminationHistoryGroups.slice(0, 6).map(group => <span key={group.key}><small>{group.label}</small><b>{group.nodes.length}</b></span>)}
                    </div>}
                    {this.state.podStatusModalMode !== 'current' && podSummary.timestampEstimatedCount > 0 && <div className="netdive-k8s-cluster-detail__eviction-time-notice">
                        정확 {podSummary.timestampExactCount}건 · 추정 {podSummary.timestampEstimatedCount}건입니다. 추정 항목은 Pod 생성 시각을 기준으로 정렬합니다.
                    </div>}
                    {this.renderPodStatusList(selectedPodStatusNodes, resources, unavailableWorkloads, selectedPodStatusGroup?.label, this.state.podStatusModalMode === 'current')}
                </Modal>

                <Modal
                    visible={this.state.recentChangesModalOpen}
                    className="netdive-k8s-cluster-detail__change-modal"
                    title={<span className="netdive-k8s-cluster-detail__change-modal-title"><HistoryOutlined />{translate('kubernetesRecentChangesAllTitle')}</span>}
                    width={540}
                    footer={null}
                    destroyOnClose
                    onCancel={() => this.setState({ recentChangesModalOpen: false, expandedRecentChangeKey: '' })}>
                    {this.renderRecentChanges(recentChangeGroups, undefined, 'modal')}
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
