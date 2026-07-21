import * as React from 'react'
import { Progress, Tooltip } from 'antd'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'
import TimelineIcon from '@material-ui/icons/Timeline'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import {
    DetailBadge,
    DetailBadgeTone,
    DetailEmpty,
    DetailKeyValueList,
    DetailResourceCard,
    DetailResourceGrid,
    DetailSection
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
    summary?: any
    summaryLoading?: boolean
    summaryError?: boolean
    summaryClusterID?: string
}

type ResourceType = 'node' | 'namespace' | 'pod' | 'service'

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

const clampPercent = (value: any): number => Math.max(0, Math.min(100, Number(value) || 0))

const endpointID = (endpoint: any): string => typeof endpoint === 'string' ? endpoint : endpoint?.id || ''

class KubernetesClusterDetailPanel extends React.Component<Props, State> {
    state: State = { basicCollapsed: true }

    componentDidMount() {
        this.loadClusterSummary()
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id) {
            this.setState({ basicCollapsed: true, summary: undefined, summaryError: false, summaryClusterID: undefined }, () => this.loadClusterSummary())
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
        return (['node', 'namespace', 'pod', 'service'] as ResourceType[]).map(type => ({
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
            app.focusInfrastructureNodeIDs(ids, this.props.node.id)
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
        return translate('kubernetesTopologyServices')
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
                            <div className="netdive-k8s-cluster-detail__capacity-title"><strong>CPU</strong><span>{translate('kubernetesRequestRate')} {requestCpuPercent.toFixed(1)}%</span></div>
                            <Progress percent={requestCpuPercent} showInfo={false} strokeColor="#1677ff" trailColor="#eef2f6" />
                            {this.renderCapacityMetrics([
                                { label: translate('kubernetesCurrentUsage'), value: metricsAvailable ? `${Number(resources.usageCpuCores || 0).toFixed(2)} Core` : translate('kubernetesNotCollected') },
                                { label: 'Allocatable', value: allocatableCpu > 0 ? `${allocatableCpu.toFixed(2)} Core` : translate('kubernetesUnknown') },
                                { label: 'Requests', value: `${requestsCpu.toFixed(2)} Core` },
                                { label: 'Limits', value: `${limitsCpu.toFixed(2)} Core` },
                                { label: translate('kubernetesReservable'), value: allocatableCpu > 0 ? `${Math.max(0, allocatableCpu - requestsCpu).toFixed(2)} Core` : translate('kubernetesUnknown') }
                            ])}
                        </div>
                        <div className="netdive-k8s-cluster-detail__capacity-card">
                            <div className="netdive-k8s-cluster-detail__capacity-title"><strong>{translate('kubernetesMemory')}</strong><span>{translate('kubernetesRequestRate')} {requestMemoryPercent.toFixed(1)}%</span></div>
                            <Progress percent={requestMemoryPercent} showInfo={false} strokeColor="#1677ff" trailColor="#eef2f6" />
                            {this.renderCapacityMetrics([
                                { label: translate('kubernetesCurrentUsage'), value: metricsAvailable ? formatBytes(resources.usageMemoryBytes || 0) : translate('kubernetesNotCollected') },
                                { label: 'Allocatable', value: allocatableMemory > 0 ? formatBytes(allocatableMemory) : translate('kubernetesUnknown') },
                                { label: 'Requests', value: formatBytes(requestsMemory) },
                                { label: 'Limits', value: formatBytes(limitsMemory) },
                                { label: translate('kubernetesReservable'), value: allocatableMemory > 0 ? formatBytes(Math.max(0, allocatableMemory - requestsMemory)) : translate('kubernetesUnknown') }
                            ])}
                        </div>
                    </div>
                )}
                <div className="netdive-k8s-cluster-detail__capacity-compare">
                    {provisionedCores || provisionedMemory ? <span><small>{translate('kubernetesMoldVmAllocation')}</small><strong>{provisionedCores ? `${provisionedCores} vCPU` : translate('kubernetesNotCollected')} / {provisionedMemory ? formatBytes(provisionedMemory * 1024 * 1024) : translate('kubernetesNotCollected')}</strong></span> : null}
                    {allocatableCpu || allocatableMemory ? <span><small>Kubernetes Allocatable</small><strong>{allocatableCpu ? `${allocatableCpu.toFixed(2)} Core` : translate('kubernetesNotCollected')} / {allocatableMemory ? formatBytes(allocatableMemory) : translate('kubernetesNotCollected')}</strong></span> : null}
                </div>
            </div>
        )
    }

    private renderCapacityMetrics(items: Array<{ label: string, value: string }>) {
        return (
            <div className="netdive-k8s-cluster-detail__capacity-metrics">
                {items.map(item => (
                    <div key={item.label} className="netdive-k8s-cluster-detail__capacity-metric">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
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

    private renderRecentChanges() {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        const changes = Array.isArray(this.state.summary?.recentChanges)
            ? this.state.summary.recentChanges.filter(change => {
                const time = new Date(change.time).getTime()
                return !Number.isNaN(time) && time >= cutoff
            })
            : []
        if (!changes.length) return <DetailEmpty description={translate('kubernetesNoRecentChanges')} compact />
        return (
            <div className="netdive-k8s-cluster-detail__change-list">
                {changes.map((change, index) => (
                    <div key={`${change.resource}-${change.time}-${index}`}>
                        <span className={`netdive-k8s-cluster-detail__change-dot netdive-k8s-cluster-detail__change-dot--${change.severity || 'info'}`} />
                        <div><strong>{change.resource}</strong><span>{change.message}</span></div>
                        <time>{formatDate(change.time)}</time>
                    </div>
                ))}
            </div>
        )
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
        const nodeSummary = this.state.summary?.nodes || this.topologyStatus(resources, 'node')
        const podSummary = this.state.summary?.pods || this.topologyStatus(resources, 'pod')
        const controlPlane = this.state.summary?.controlPlane || this.controlPlaneStatus(resources)
        const nodeResource = summaries.find(summary => summary.type === 'node') as ResourceSummary
        const namespaceResource = summaries.find(summary => summary.type === 'namespace') as ResourceSummary
        const podResource = summaries.find(summary => summary.type === 'pod') as ResourceSummary
        const serviceResource = summaries.find(summary => summary.type === 'service') as ResourceSummary
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
        const placementConfidenceLimited = !hostPlacementEvaluated || !networkPlacementEvaluated
            || knownHostNodeCount < nodeSummary.total
            || knownNetworkNodeCount < nodeSummary.total
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
        const basicRows: any[] = [
            { label: translate('kubernetesClusterName'), value: name, textValue: name, copyText: name },
            { label: translate('kubernetesVersion'), value: version || translate('kubernetesUnknown') },
            this.state.summary?.apiConnectionStatus ? { label: translate('kubernetesApiConnectionStatus'), value: this.state.summary.apiConnectionStatus } : null,
            moldCluster?.state ? { label: translate('kubernetesMoldDeploymentStatus'), value: <DetailBadge tone={/running/i.test(moldCluster.state) ? 'success' : 'warning'}>{moldCluster.state}</DetailBadge> } : null,
            { label: translate('kubernetesClusterUid'), value: uid || translate('kubernetesNotCollected'), textValue: uid, copyText: uid || undefined },
            { label: translate('kubernetesMoldClusterId'), value: moldCluster?.id || translate('kubernetesNoConnectionInfo'), textValue: moldCluster?.id, copyText: moldCluster?.id },
            { label: translate('kubernetesApiServer'), value: apiServer || translate('kubernetesNoConnectionInfo'), textValue: apiServer, copyText: apiServer || undefined },
            moldCluster?.zoneName ? { label: translate('kubernetesZone'), value: moldCluster.zoneName } : null,
            moldCluster?.networkName ? { label: translate('kubernetesNetwork'), value: moldCluster.networkName } : null,
            moldCluster?.serviceOffering ? { label: translate('kubernetesServiceOffering'), value: moldCluster.serviceOffering } : null,
            createdAt ? { label: translate('kubernetesCreatedAt'), value: createdAt } : null
        ].filter(Boolean)

        return (
            <div className="netdive-k8s-cluster-detail">
                <DetailSection icon={this.topologyIcon(this.props.node)} title={translate('kubernetesOperationalStatus')}>
                    <div className={`netdive-k8s-cluster-detail__operation-hero netdive-k8s-cluster-detail__operation-hero--${health.tone}`}>
                        <span className="netdive-k8s-cluster-detail__operation-dot" />
                        <strong>{health.label}</strong>
                        <p>{heroConclusion}</p>
                    </div>
                    <div className="netdive-k8s-cluster-detail__availability-strip">
                        <div className="netdive-k8s-cluster-detail__availability-item netdive-k8s-cluster-detail__availability-item--control-plane">
                            <span>Control Plane</span>
                            <div className="netdive-k8s-cluster-detail__availability-value">
                                <strong>{controlPlane.total ? `${controlPlane.ready || 0}/${controlPlane.total}` : '–'}</strong>
                                {!controlPlane.total
                                    ? <small className="is-unknown">{translate('kubernetesNotCollected')}</small>
                                    : (controlPlane.notReady || 0) > 0
                                    ? <DetailBadge tone="danger">NotReady {controlPlane.notReady}</DetailBadge>
                                    : null}
                            </div>
                        </div>
                        <div className="netdive-k8s-cluster-detail__availability-item netdive-k8s-cluster-detail__availability-item--nodes">
                            <span>{translate('kubernetesTopologyNodes')}</span>
                            <div className="netdive-k8s-cluster-detail__availability-value">
                                <strong>{nodeSummary.total ? `${nodeSummary.ready || 0}/${nodeSummary.total}` : '–'}</strong>
                                {!nodeSummary.total
                                    ? <small className="is-unknown">{translate('kubernetesNotCollected')}</small>
                                    : (nodeSummary.notReady || 0) > 0
                                    ? <DetailBadge tone="danger">NotReady {nodeSummary.notReady}</DetailBadge>
                                    : null}
                            </div>
                        </div>
                        <div className="netdive-k8s-cluster-detail__availability-item netdive-k8s-cluster-detail__availability-item--pods">
                            <span>{translate('kubernetesTopologyPods')}</span>
                            <div className="netdive-k8s-cluster-detail__availability-value">
                                <strong>{podSummary.total || (this.state.summary || podResource.nodes.length > 0) ? podSummary.total : '–'}</strong>
                                <div className="netdive-k8s-cluster-detail__availability-alerts">
                                    {(podSummary.pending || 0) > 0 && <DetailBadge tone="warning">Pending {podSummary.pending}</DetailBadge>}
                                    {(podSummary.failed || 0) > 0 && <DetailBadge tone="danger">Failed {podSummary.failed}</DetailBadge>}
                                    {(podSummary.unknown || 0) > 0 && <DetailBadge>Unknown {podSummary.unknown}</DetailBadge>}
                                </div>
                            </div>
                        </div>
                        <div className="netdive-k8s-cluster-detail__availability-item netdive-k8s-cluster-detail__availability-item--services">
                            <span>{translate('kubernetesAffectedServiceKpi')}</span>
                            <div className="netdive-k8s-cluster-detail__availability-value">
                                <strong>{affectedServices}</strong>
                                {affectedServices > 0 && <DetailBadge tone="danger">{translate('kubernetesImpactDetected')}</DetailBadge>}
                            </div>
                        </div>
                    </div>
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
                    <div className="netdive-k8s-cluster-detail__confidence">
                        <span>{translate('kubernetesAnalysisConfidence')}</span>
                        <strong>{placementConfidenceLimited ? translate('kubernetesConfidenceLimited') : translate('kubernetesConfidenceSufficient')}</strong>
                        {placementConfidenceLimited && <Tooltip title={translate('kubernetesConfidenceLimitedDescription')}><InfoIcon /></Tooltip>}
                    </div>
                </DetailSection>

                <DetailSection
                    icon={<AccountTreeIcon />}
                    title={translate('kubernetesResourceStatus')}>
                    <div className="netdive-k8s-cluster-detail__resource-navigation">
                        <DetailResourceGrid compact>
                                <Tooltip title={translate('kubernetesFocusNodes')} placement="top">
                                    <DetailResourceCard
                                        label={this.resourceLabel('node')}
                                        value={nodeSummary.total}
                                        icon={this.resourceIcon(nodeResource)}
                                        iconTone="kubernetes"
                                        interactive={nodeResource.nodes.length > 0}
                                        onClick={() => this.focusResources(nodeResource.nodes)} />
                                </Tooltip>
                                <Tooltip title={translate('kubernetesFocusNamespaces')} placement="top">
                                    <DetailResourceCard
                                        label={this.resourceLabel('namespace')}
                                        value={namespaceCount}
                                        icon={this.resourceIcon(namespaceResource)}
                                        iconTone="kubernetes"
                                        interactive={namespaceResource.nodes.length > 0}
                                        onClick={() => this.focusResources(namespaceResource.nodes)} />
                                </Tooltip>
                                <Tooltip title={translate('kubernetesFocusPods')} placement="top">
                                    <DetailResourceCard
                                        label={this.resourceLabel('pod')}
                                        value={podSummary.total}
                                        icon={this.resourceIcon(podResource)}
                                        iconTone="kubernetes"
                                        interactive={podResource.nodes.length > 0}
                                        onClick={() => this.focusResources(podResource.nodes)} />
                                </Tooltip>
                                <Tooltip title={translate('kubernetesFocusServices')} placement="top">
                                    <DetailResourceCard
                                        label={this.resourceLabel('service')}
                                        value={serviceCount}
                                        icon={this.resourceIcon(serviceResource)}
                                        iconTone="kubernetes"
                                        interactive={serviceResource.nodes.length > 0}
                                        onClick={() => this.focusResources(serviceResource.nodes)} />
                                </Tooltip>
                        </DetailResourceGrid>
                    </div>
                    <div className="netdive-k8s-cluster-detail__resource-capacity-title">{translate('kubernetesResourceCapacity')}</div>
                    {this.renderResourceCapacity(moldCluster)}
                </DetailSection>

                <DetailSection icon={<TimelineIcon />} title={translate('kubernetesRecentChanges')}>
                    {this.renderRecentChanges()}
                </DetailSection>

                <DetailSection
                    icon={<InfoIcon />}
                    title={translate('kubernetesClusterBasicInfo')}
                    collapsible
                    collapsed={this.state.basicCollapsed}
                    onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                    <DetailKeyValueList rows={basicRows} copyTooltip={translate('copy')} />
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
