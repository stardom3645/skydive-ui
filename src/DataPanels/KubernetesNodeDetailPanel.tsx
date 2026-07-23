import * as React from 'react'
import { Tooltip } from 'antd'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'
import ScheduleIcon from '@material-ui/icons/Schedule'
import StorageIcon from '@material-ui/icons/Storage'
import DnsIcon from '@material-ui/icons/Dns'
import LinkIcon from '@material-ui/icons/Link'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { DetailBadge, DetailBadgeTone, DetailEmpty, DetailKeyValueList, DetailResourceCard, DetailResourceGrid, DetailSection } from './common'
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
            if (phase === 'running' || phase === 'succeeded') runningPodCount++
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

    private renderConditions() {
        const conditions = this.state.detail?.conditions
        if (!Array.isArray(conditions) || !conditions.length) return <DetailEmpty description={translate('kubernetesNodeConditionsUnavailable')} compact />
        return <div className="netdive-k8s-node-detail__rows">{conditions.map(condition => {
            const tone = this.conditionTone(condition)
            const state = tone === 'success'
                ? <span className="netdive-k8s-node-detail__normal"><i />{translate('kubernetesHealthNormal')}</span>
                : <DetailBadge tone={tone}>{tone === 'danger' ? translate('kubernetesHealthCritical') : translate('kubernetesHealthWarning')}</DetailBadge>
            return <Tooltip key={condition.type} title={condition.message || condition.reason || ''} placement="top">
                <div className={`netdive-k8s-node-detail__row netdive-k8s-node-detail__row--${tone}`}>
                    <strong>{condition.type}</strong>
                    <span className="netdive-k8s-node-detail__condition-state">{state}<em>{String(condition.status)}</em></span>
                    <b>{this.duration(condition.durationSeconds)}</b>
                    <small>{condition.reason || translate('kubernetesNoReason')}</small>
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
            { label: translate('kubernetesMemory'), capacity: formatCapacityMemory(memoryCapacity), capacityRaw: memoryCapacity, allocatable: formatCapacityMemory(memoryAllocatable), allocatableRaw: memoryAllocatable },
            { label: 'Pods', capacity: quantity(detail.capacity, 'pods'), capacityRaw: '', allocatable: quantity(detail.allocatable, 'pods'), allocatableRaw: '' }
        ]
        return <div className="netdive-k8s-node-detail__capacity"><div className="netdive-k8s-node-detail__capacity-head"><span>{translate('kubernetesCapacity')}</span><span>{translate('kubernetesAllocatableLabel')}</span></div>{rows.map(row => <div key={row.label}><strong>{row.label}</strong><Tooltip title={row.capacityRaw && row.capacityRaw !== row.capacity ? row.capacityRaw : undefined}><span>{row.capacity}</span></Tooltip><Tooltip title={row.allocatableRaw && row.allocatableRaw !== row.allocatable ? row.allocatableRaw : undefined}><b>{row.allocatable}</b></Tooltip></div>)}</div>
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
        if (pod && app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs([pod.id], this.props.node.id)
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
        const basicRows: any[] = [
            { label: translate('kubernetesNodeName'), value: name, textValue: name, copyText: name },
            { label: translate('kubernetesNodeRoles'), value: Array.isArray(detail.roles) ? detail.roles.join(', ') : translate('kubernetesNotCollected') },
            { label: 'Internal IP', value: detail.internalIp || translate('kubernetesNotCollected'), copyText: detail.internalIp },
            { label: 'Pod CIDR', value: Array.isArray(detail.podCidrs) && detail.podCidrs.length ? detail.podCidrs.join(', ') : translate('kubernetesNotCollected') },
            { label: translate('kubernetesVersion'), value: detail.kubernetesVersion || translate('kubernetesNotCollected') },
            { label: 'OS Image', value: detail.osImage || translate('kubernetesNotCollected') },
            { label: translate('kubernetesContainerRuntime'), value: detail.containerRuntime || translate('kubernetesNotCollected') }
        ]
        const schedulingRows: any[] = [
            { label: translate('kubernetesScheduling'), value: detail.unschedulable ? <DetailBadge tone="warning">Unschedulable</DetailBadge> : translate('kubernetesSchedulingAllowed') },
            { label: 'Taints', value: Array.isArray(detail.taints) && detail.taints.length ? detail.taints.map(taint => `${taint.key}${taint.value ? `=${taint.value}` : ''}:${taint.effect}`).join(', ') : translate('kubernetesNone') },
            { label: translate('kubernetesMaxPodCount'), value: detail.maxPodCount !== undefined ? detail.maxPodCount : translate('kubernetesNotCollected') }
        ]
        const infrastructureRows: any[] = [
            { label: 'Mold VM', value: relationVM ? firstValue(relationVM, ['name', 'instanceName', 'displayName']) : translate('kubernetesRelationshipUnknown') },
            { label: translate('kubernetesPhysicalHost'), value: relationVM ? firstValue(relationVM, ['hostName', 'hostname', 'host', 'physicalHostName']) || translate('kubernetesRelationshipUnknown') : translate('kubernetesRelationshipUnknown') },
            { label: translate('kubernetesNetworkPathShort'), value: translate('kubernetesNotCollected') },
            { label: translate('kubernetesRelationshipConfidence'), value: <DetailBadge tone={relation.confidence === 'CONFIRMED' ? 'success' : relation.confidence === 'INFERRED' ? 'warning' : 'default'}>{relation.confidence}</DetailBadge> }
        ]

        return <div className="netdive-k8s-node-detail">
            <DetailSection icon={<InfoIcon />} title={translate('kubernetesNodeBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <DetailKeyValueList rows={basicRows} copyTooltip={translate('copy')} />
            </DetailSection>

            <DetailSection icon={this.topologyIcon(this.props.node)} title={translate('kubernetesNodeOperationalStatus')}>
                <div className={`netdive-k8s-node-detail__hero netdive-k8s-node-detail__hero--${statusTone}`}><i /><strong>{statusLabel}</strong><span>{conclusion}</span></div>
                <div className="netdive-k8s-node-detail__summary">
                    <div><span>{translate('kubernetesPlacedPods')}</span><strong>{optionalNumber(detail.podCount)}</strong></div>
                    <div><span>{translate('kubernetesProblemPods')}</span><strong className={Number(problemCount || 0) > 0 ? 'is-danger' : ''}>{optionalNumber(problemCount)}</strong></div>
                    <div><span>{translate('kubernetesAffectedServiceKpi')}</span><strong className={Number(detail.impactedServiceCount || 0) > 0 ? 'is-danger' : ''}>{optionalNumber(detail.impactedServiceCount)}</strong></div>
                    <div><span>{translate('kubernetesSchedulingShort')}</span><strong className={detail.unschedulable ? 'is-warning' : ''}>{detail.unschedulable ? translate('kubernetesBlocked') : translate('kubernetesAllowed')}</strong></div>
                </div>
            </DetailSection>

            <DetailSection icon={<ErrorOutlineIcon />} title={translate('kubernetesNodeConditions')}>{this.renderConditions()}</DetailSection>
            <DetailSection icon={<DnsIcon />} title={translate('kubernetesNodeWorkloads')}>
                <div className="netdive-k8s-node-detail__metric-rows">
                    {[
                        [translate('kubernetesRunningPods'), detail.runningPodCount, 'default'],
                        ['Pending', detail.pendingPodCount, Number(detail.pendingPodCount || 0) > 0 ? 'warning' : 'default'],
                        ['Failed', detail.failedPodCount, Number(detail.failedPodCount || 0) > 0 ? 'danger' : 'default'],
                        [translate('kubernetesRestartedPods'), detail.restartPodCount, Number(detail.restartPodCount || 0) > 0 ? 'warning' : 'default'],
                        ['OOMKilled', detail.oomKilledPodCount, Number(detail.oomKilledPodCount || 0) > 0 ? 'danger' : 'default'],
                        [translate('kubernetesImpactedPods'), detail.impactedPodCount, Number(detail.impactedPodCount || 0) > 0 ? 'danger' : 'default'],
                        [translate('kubernetesSingleReplicaWorkloads'), detail.singleReplicaWorkloadCount, Number(detail.singleReplicaWorkloadCount || 0) > 0 ? 'warning' : 'default'],
                        [translate('kubernetesLocalStorageWorkloads'), detail.localStorageDependentWorkloadCount, Number(detail.localStorageDependentWorkloadCount || 0) > 0 ? 'warning' : 'default']
                    ].map((item: any[]) => <div key={item[0]} className={`is-${item[2]}`}><span>{item[0]}</span><strong>{optionalNumber(item[1])}</strong></div>)}
                </div>
                {Array.isArray(detail.problemPods) && detail.problemPods.length > 0 && <div className="netdive-k8s-node-detail__problem-list-title">{translate('kubernetesProblemPods')}</div>}
                {Array.isArray(detail.problemPods) && detail.problemPods.length > 0 && <DetailResourceGrid compact>{detail.problemPods.map(pod => <DetailResourceCard key={pod.uid} label={pod.name} value="" icon={<AccountTreeIcon />} iconTone="kubernetes" interactive onClick={() => this.focusProblemPod(pod.uid)} />)}</DetailResourceGrid>}
            </DetailSection>

            <DetailSection icon={<ScheduleIcon />} title={translate('kubernetesSchedulingAndTaints')}><DetailKeyValueList rows={schedulingRows} copyTooltip={translate('copy')} /></DetailSection>
            <DetailSection icon={<StorageIcon />} title={translate('kubernetesCapacityAllocatable')}>{this.renderCapacity()}</DetailSection>

            <DetailSection icon={<LinkIcon />} title={translate('kubernetesInfrastructureRelationship')}><DetailKeyValueList rows={infrastructureRows} /></DetailSection>

            {this.state.error && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesNodeDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesNodeDetailPanel
