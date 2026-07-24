import * as React from 'react'
import { Collapse, Modal, Popover, Progress, Tooltip } from 'antd'
import { HistoryOutlined, InfoCircleOutlined } from '@ant-design/icons'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import {
    ConnectedResourcesSection,
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

class KubernetesClusterDetailPanel extends React.Component<Props, State> {
    state: State = { basicCollapsed: false, basicInfoActiveKey: '', expandedRecentChangeKey: '', recentChangesModalOpen: false }

    componentDidMount() {
        this.loadClusterSummary()
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id) {
            this.setState({ basicCollapsed: false, basicInfoActiveKey: '', expandedRecentChangeKey: '', recentChangesModalOpen: false, summary: undefined, summaryError: false, summaryClusterID: undefined }, () => this.loadClusterSummary())
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

    private affectedServiceCount(resources: Node[], nodeStatus: StatusSummary): number {
        if (this.state.summary?.currentlyImpactedServiceCount !== undefined) return Number(this.state.summary.currentlyImpactedServiceCount) || 0
        if (this.state.summary?.affectedServices !== undefined) return Number(this.state.summary.affectedServices) || 0
        if (!nodeStatus.notReady) return 0
        const failedNodeNames = new Set(resources.filter(node => String(node.data?.Type || '').toLowerCase() === 'node' && !this.nodeReady(node)).map(node => firstValue(node.data || {}, ['Name', 'K8s.Name'])))
        const impactedPodIDs = new Set(resources.filter(node => String(node.data?.Type || '').toLowerCase() === 'pod' && failedNodeNames.has(firstValue(node.data || {}, ['K8s.Node', 'NodeName']))).map(node => node.id))
        const serviceIDs = new Set<string>()
        this.topologyLinks().forEach(link => {
            const sourceID = endpointID(link?.source)
            const targetID = endpointID(link?.target)
            if (!impactedPodIDs.has(sourceID) && !impactedPodIDs.has(targetID)) return
            const remoteID = impactedPodIDs.has(sourceID) ? targetID : sourceID
            const remote = this.topologyNodes().find(node => node.id === remoteID)
            if (remote && String(remote.data?.Type || '').toLowerCase() === 'service') serviceIDs.add(remote.id)
        })
        return serviceIDs.size
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
        if (type === 'persistentvolume') return 'PersistentVolume'
        if (type === 'persistentvolumeclaim') return 'PersistentVolumeClaim'
        return 'StorageClass'
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
        const cpuProgressTooltip = `${translate('kubernetesCpuReservationRate')}\n\nRequests ${requestsCpu.toFixed(2)} Core ÷ ${translate('kubernetesAllocatableLabel')} ${allocatableCpu.toFixed(2)} Core\n= ${requestCpuPercent.toFixed(1)}%`
        const memoryProgressTooltip = `${translate('kubernetesMemoryReservationRate')}\n\nRequests ${formatBinaryBytes(requestsMemory, 'MiB')} ÷ ${translate('kubernetesAllocatableLabel')} ${formatGiB(allocatableMemory)}\n= ${requestMemoryPercent.toFixed(1)}%`
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

    private riskItems(nodeStatus: StatusSummary, podStatus: StatusSummary, affectedServices: number, hostPlacements: PlacementSummary[], switchPlacements: PlacementSummary[], controlPlane: StatusSummary, externalPathCount: number, externalPathsEvaluated: boolean): any[] {
        const hasSummaryRisks = Array.isArray(this.state.summary?.risks)
        const risks: any[] = hasSummaryRisks ? this.state.summary.risks.map(risk => ({ ...risk })) : []
        if (!hasSummaryRisks) {
            if (nodeStatus.notReady) risks.push({ severity: 'critical', title: translate('kubernetesRiskNotReadyNodes'), message: translate('kubernetesRiskNotReadyNodesDescription'), count: nodeStatus.notReady })
            if (podStatus.failed) risks.push({ severity: 'critical', title: translate('kubernetesRiskFailedPods'), message: translate('kubernetesRiskFailedPodsDescription'), count: podStatus.failed })
            if (podStatus.pending) risks.push({ severity: 'warning', title: translate('kubernetesRiskPendingPods'), message: translate('kubernetesRiskPendingPodsDescription'), count: podStatus.pending })
            if (affectedServices) risks.push({ severity: 'critical', title: translate('kubernetesAffectedServices'), message: translate('kubernetesAffectedServicesDescription'), count: affectedServices })
        }
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

    private operationalStatus(controlPlane: StatusSummary, nodes: StatusSummary, pods: StatusSummary, affectedServices: number): { label: string, tone: DetailBadgeTone } {
        if (!nodes.total && !pods.total && !controlPlane.total) return { label: translate('kubernetesHealthUnknown'), tone: 'default' }
        if ((controlPlane.notReady || 0) > 0 || (nodes.notReady || 0) > 0 || (pods.failed || 0) > 0 || affectedServices > 0) return { label: translate('kubernetesHealthCritical'), tone: 'danger' }
        if ((pods.pending || 0) > 0 || (pods.unknown || 0) > 0) return { label: translate('kubernetesHealthWarning'), tone: 'warning' }
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

    private renderResilienceRow(title: string, label: string, tone: DetailBadgeTone, value: React.ReactNode, short: string, tooltip?: string) {
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
                <small>{short}</small>
            </div>
        )
        return tooltip ? <Tooltip title={tooltip} placement="top">{content}</Tooltip> : content
    }

    private heroConclusion(controlPlane: StatusSummary, nodes: StatusSummary, pods: StatusSummary, affectedServices: number, currentRiskTitle?: string): string {
        if (controlPlane.notReady) return translate('kubernetesHeroControlPlaneFailure').replace('{count}', String(controlPlane.notReady))
        const workerNotReady = Math.max(0, (nodes.notReady || 0) - (controlPlane.notReady || 0))
        if (workerNotReady) return translate('kubernetesHeroWorkerFailure').replace('{count}', String(workerNotReady))
        if (pods.failed) return translate('kubernetesHeroPodFailure').replace('{count}', String(pods.failed))
        if (affectedServices) return translate('kubernetesHeroServiceImpact').replace('{count}', String(affectedServices))
        if (pods.pending) return translate('kubernetesHeroPendingPods').replace('{count}', String(pods.pending))
        if (currentRiskTitle) return currentRiskTitle
        return translate('kubernetesHeroNoImpact')
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
                                    <strong>{change.resource}</strong>
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
        const nodeSummary = this.state.summary?.nodes || this.topologyStatus(resources, 'node')
        const podSummary = this.state.summary?.pods || this.topologyStatus(resources, 'pod')
        const controlPlane = this.state.summary?.controlPlane || this.controlPlaneStatus(resources)
        const nodeResource = summaries.find(summary => summary.type === 'node') as ResourceSummary
        const namespaceResource = summaries.find(summary => summary.type === 'namespace') as ResourceSummary
        const podResource = summaries.find(summary => summary.type === 'pod') as ResourceSummary
        const serviceResource = summaries.find(summary => summary.type === 'service') as ResourceSummary
        const persistentVolumeResource = summaries.find(summary => summary.type === 'persistentvolume') as ResourceSummary
        const persistentVolumeClaimResource = summaries.find(summary => summary.type === 'persistentvolumeclaim') as ResourceSummary
        const storageClassResource = summaries.find(summary => summary.type === 'storageclass') as ResourceSummary
        const workloadNodes = resources.filter(node => ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(String(node.data?.Type || '').toLowerCase()) >= 0)
        const namespaceCount = this.state.summary?.namespaceCount !== undefined ? this.state.summary.namespaceCount : this.state.summary?.namespaces !== undefined ? this.state.summary.namespaces : namespaceResource.nodes.length
        const serviceCount = this.state.summary?.serviceCount !== undefined ? this.state.summary.serviceCount : this.state.summary?.services !== undefined ? this.state.summary.services : serviceResource.nodes.length
        const hostPlacements = this.nodePlacements(resources)
        const switchPlacements = this.switchPlacements(hostPlacements)
        const affectedServices = this.affectedServiceCount(resources, nodeSummary)
        const externalPathCount = Number(this.state.summary?.externalPathCount) || 0
        const impactScore = this.state.summary?.currentImpactScore !== undefined
            ? Number(this.state.summary.currentImpactScore)
            : this.state.summary?.impactScore !== undefined
            ? Number(this.state.summary.impactScore)
            : Math.min(100, (nodeSummary.notReady || 0) * 30 + (podSummary.failed || 0) * 10 + affectedServices * 10)
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
        const risks = this.riskItems(nodeSummary, podSummary, affectedServices, hostPlacements, switchPlacements, controlPlane, externalPathCount, externalPathsEvaluated)
        const availabilityHealth = this.operationalStatus(controlPlane, nodeSummary, podSummary, affectedServices)
        const currentRisks = risks.filter(risk => risk.kind === 'current')
        const health = availabilityHealth.tone === 'success' && currentRisks.some(risk => risk.severity === 'critical')
            ? { label: translate('kubernetesHealthCritical'), tone: 'danger' as DetailBadgeTone }
            : availabilityHealth.tone === 'success' && currentRisks.some(risk => risk.severity === 'warning')
            ? { label: translate('kubernetesHealthWarning'), tone: 'warning' as DetailBadgeTone }
            : availabilityHealth
        const heroConclusion = this.heroConclusion(controlPlane, nodeSummary, podSummary, affectedServices, currentRisks[0]?.title)
        const currentImpactGrade = this.scoreGrade(impactScore)
        const potentialGrade = this.resilienceGrade(potentialScore, potentialEvaluated)
        const metricState = this.metricsState()
        const externalAnalysis = !externalPathsEvaluated
            ? { label: translate('kubernetesResilienceUnavailable'), tone: 'default' as DetailBadgeTone, value: '–', short: translate('kubernetesNotCollected'), description: translate('kubernetesExternalPathUnknownDescription') }
            : externalPathCount === 1
            ? { label: translate('kubernetesResilienceRecommended'), tone: 'warning' as DetailBadgeTone, value: '1', short: translate('kubernetesSinglePath'), description: translate('kubernetesExternalPathSingleDescription') }
            : { label: translate('kubernetesResilienceGood'), tone: 'success' as DetailBadgeTone, value: externalPathCount, short: externalPathCount ? translate('kubernetesMultiplePaths') : translate('kubernetesNoExternalExposure'), description: externalPathCount > 1 ? translate('kubernetesExternalPathMultipleDescription').replace('{count}', String(externalPathCount)) : translate('kubernetesExternalPathNoneDescription') }
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
        const podStatusCollectedForDisplay = !!this.state.summary || podResource.nodes.length > 0
        const serviceStatusCollectedForDisplay = !!this.state.summary || serviceResource.nodes.length > 0
        const availabilityItems = [
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
                    { label: 'Failed', value: podStatusCollectedForDisplay ? podSummary.failed || 0 : '–' },
                    { label: 'Unknown', value: podStatusCollectedForDisplay ? podSummary.unknown || 0 : '–' }
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
            ...(podSummary.pending ? [{ key: 'pods-pending', label: translate('kubernetesTopologyPods'), status: 'Pending', value: podSummary.pending, tone: 'warning' }] : []),
            ...(podSummary.failed ? [{ key: 'pods-failed', label: translate('kubernetesTopologyPods'), status: 'Failed', value: podSummary.failed, tone: 'danger' }] : []),
            ...(podSummary.unknown ? [{ key: 'pods-unknown', label: translate('kubernetesTopologyPods'), status: 'Unknown', value: podSummary.unknown, tone: 'default' }] : []),
            ...(affectedServices ? [{ key: 'services', label: translate('kubernetesAffectedServiceKpi'), status: translate('kubernetesServiceAffected'), value: affectedServices, tone: 'danger' }] : [])
        ]

        return (
            <div className="netdive-k8s-cluster-detail">
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
                    <div className={`netdive-k8s-cluster-detail__operation-hero netdive-k8s-cluster-detail__operation-hero--${health.tone}`}>
                        <span className="netdive-k8s-cluster-detail__operation-dot" />
                        <strong>{health.label}</strong>
                        <p>{heroConclusion}</p>
                    </div>
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
                                <div className={`netdive-k8s-cluster-detail__abnormal-status-item is-${item.tone}`} key={item.key}>
                                    <span>{item.label}</span>
                                    <strong>{item.status} <b>{item.value}</b></strong>
                                </div>
                            ))}
                        </div>
                    </div>}
                    <div className="netdive-k8s-cluster-detail__collection-status">
                        <span>{translate('kubernetesDataCollectionStatus')}</span>
                        <Tooltip title={metricState.description}><span><DetailBadge tone={metricState.tone}>{metricState.label}</DetailBadge></span></Tooltip>
                        <strong>{collectedAt ? <Tooltip title={collectedAt}><span>{formatRelativeDate(this.state.summary?.lastSyncAt || this.state.summary?.collectedAt)}</span></Tooltip> : (updatedAt || translate('kubernetesNoCollectionRecord'))}</strong>
                    </div>
                </DetailSection>

                <DetailSection icon={<ErrorOutlineIcon />} title={translate('kubernetesRiskResilience')}>
                    <div className={`netdive-k8s-cluster-detail__alert-summary ${currentRisks.length ? 'has-alert' : ''}`}>
                        <span className="netdive-k8s-cluster-detail__alert-dot" />
                        <strong>{currentRisks.length ? currentRisks[0].title : translate('kubernetesNoCurrentAlerts')}</strong>
                        {currentRisks.length > 1 && <small>+{currentRisks.length - 1}</small>}
                    </div>
                    <div className="netdive-k8s-cluster-detail__resilience-rows">
                        {this.renderResilienceRow(translate('kubernetesCurrentFailureImpact'), currentImpactGrade.label, currentImpactGrade.tone, `${impactScore} / 100`, translate('kubernetesCurrentState'), translate('kubernetesCurrentFailureImpactTooltip'))}
                        {this.renderResilienceRow(translate('kubernetesPotentialInfrastructureRisk'), potentialGrade.label, potentialGrade.tone, potentialEvaluated ? `${potentialScore} / 100` : '–', translate('kubernetesPlacementRisk'), translate('kubernetesPotentialInfrastructureRiskTooltip'))}
                        {this.renderResilienceRow(translate('kubernetesHostDistributionShort'), hostAnalysis.tone === 'warning' ? translate('kubernetesResilienceRecommended') : hostAnalysis.label, hostAnalysis.tone, hostPlacementEvaluated ? `${hostAnalysis.known.length} Hosts` : '–', hostPlacementEvaluated ? (hostAnalysis.topPercent > 60 ? translate('kubernetesConcentrated') : translate('kubernetesDistributed')) : translate('kubernetesNotCollected'), hostAnalysis.description)}
                        {this.renderResilienceRow(translate('kubernetesNetworkPathShort'), networkAnalysis.tone === 'warning' ? translate('kubernetesResilienceRecommended') : networkAnalysis.label, networkAnalysis.tone, networkAnalysis.known.length ? `${networkAnalysis.topPercent}%` : '–', networkAnalysis.known.length === 1 ? translate('kubernetesSingleSwitch') : networkAnalysis.known.length ? `${networkAnalysis.known.length} Switches` : translate('kubernetesNotCollected'), networkAnalysis.description)}
                        {this.renderResilienceRow(
                            translate('kubernetesControlPlaneResilience'),
                            !controlPlane.total ? translate('kubernetesResilienceUnavailable') : controlPlane.total === 1 ? translate('kubernetesResilienceRecommended') : translate('kubernetesResilienceGood'),
                            !controlPlane.total ? 'default' : controlPlane.total === 1 ? 'warning' : 'success',
                            controlPlane.total || '–',
                            !controlPlane.total ? translate('kubernetesNotCollected') : controlPlane.total === 1 ? translate('kubernetesSingleConfiguration') : translate('kubernetesMultipleConfiguration'))}
                        {this.renderResilienceRow(translate('kubernetesExternalPaths'), externalAnalysis.label, externalAnalysis.tone, externalAnalysis.value, externalAnalysis.short, externalAnalysis.description)}
                    </div>
                    <KubernetesAnalysisConfidence state={confidenceState} collected={confidenceCollected} missing={confidenceMissing} />
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
                            { key: 'pods', label: this.resourceLabel('pod'), count: podSummary.total, icon: this.resourceIcon(podResource), iconTone: 'kubernetes', onClick: podResource.nodes.length ? () => this.focusResources(podResource.nodes) : undefined, tooltip: translate('kubernetesFocusPods') },
                            { key: 'services', label: this.resourceLabel('service'), count: serviceCount, icon: this.resourceIcon(serviceResource), iconTone: 'kubernetes', onClick: serviceResource.nodes.length ? () => this.focusResources(serviceResource.nodes) : undefined, tooltip: translate('kubernetesFocusServices') }
                            ]
                        },
                        {
                            key: 'storage',
                            title: '스토리지',
                            icon: <DetailLayerIcon glyph={'\uf1c0'} />,
                            items: [
                                ...(persistentVolumeClaimResource.nodes.length ? [{ key: 'pvcs', label: this.resourceLabel('persistentvolumeclaim'), count: persistentVolumeClaimResource.nodes.length, icon: this.resourceIcon(persistentVolumeClaimResource), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(persistentVolumeClaimResource.nodes) }] : []),
                                ...(persistentVolumeResource.nodes.length ? [{ key: 'pvs', label: this.resourceLabel('persistentvolume'), count: persistentVolumeResource.nodes.length, icon: this.resourceIcon(persistentVolumeResource), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(persistentVolumeResource.nodes) }] : []),
                                ...(storageClassResource.nodes.length ? [{ key: 'storage-classes', label: this.resourceLabel('storageclass'), count: storageClassResource.nodes.length, icon: this.resourceIcon(storageClassResource), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(storageClassResource.nodes) }] : [])
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
