import * as React from 'react'
import { Button, Tooltip } from 'antd'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'
import LinkIcon from '@material-ui/icons/Link'
import StorageIcon from '@material-ui/icons/Storage'
import ViewModuleIcon from '@material-ui/icons/ViewModule'
import { RightOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { DetailBadge, DetailKeyValueList, DetailSection } from './common'
import './KubernetesNodeDetailPanel.css'
import './KubernetesPodDetailPanel.css'

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
const containerState = (status: any): { state: string, reason: string } => {
    if (status?.State?.Running) return { state: 'RUNNING', reason: '' }
    if (status?.State?.Waiting) return { state: 'WAITING', reason: status.State.Waiting.Reason || '' }
    if (status?.State?.Terminated) return { state: 'TERMINATED', reason: status.State.Terminated.Reason || '' }
    return { state: 'UNKNOWN', reason: '' }
}

class KubernetesPodDetailPanel extends React.Component<Props, State> {
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
        fetch(`${endpoint}/api/mold/kubernetes-clusters/pods/detail?id=${encodeURIComponent(cluster.id)}&uid=${encodeURIComponent(uid)}`, {
            cache: 'no-store',
            headers: this.props.session?.token ? { 'X-Auth-Token': this.props.session.token } : undefined
        }).then(response => {
            if (!response.ok) throw new Error(`pod detail unavailable: ${response.status}`)
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

    private sameCluster(node: Node): boolean {
        const selectedCluster = firstValue(this.props.node.data || {}, ['ClusterName', 'K8s.ClusterName'])
        return !selectedCluster || firstValue(node.data || {}, ['ClusterName', 'K8s.ClusterName']) === selectedCluster
    }

    private selectedServices(labels: any, namespace: string): any[] {
        if (!labels || typeof labels !== 'object') return []
        return this.topologyNodes().filter(node => {
            const data = node.data || {}
            if (!this.sameCluster(node) || String(data.Manager || '').toLowerCase() !== 'k8s' || String(data.Type || '').toLowerCase() !== 'service') return false
            if (firstValue(data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) !== namespace) return false
            const selector = firstRaw(data, ['K8s.Extra.Spec.Selector', 'K8s.Selector', 'Selector'])
            if (!selector || typeof selector !== 'object' || !Object.keys(selector).length) return false
            return Object.keys(selector).every(key => String(labels[key]) === String(selector[key]))
        }).map(node => ({ uid: node.id, name: firstValue(node.data || {}, ['Name', 'K8s.Name']) || node.id, kind: 'Service' }))
    }

    private detailFromTopology(): any {
        const data = this.props.node.data || {}
        const extra = firstRaw(data, ['K8s.Extra']) || {}
        const objectMeta = extra.ObjectMeta || {}
        const spec = extra.Spec || {}
        const status = extra.Status || {}
        const labels = data.K8s?.Labels || objectMeta.Labels || {}
        const namespace = firstValue(data, ['K8s.Namespace', 'Namespace']) || objectMeta.Namespace
        const conditions = Array.isArray(status.Conditions) ? status.Conditions.map(condition => ({
            type: condition.Type,
            status: condition.Status,
            reason: condition.Reason,
            message: condition.Message,
            lastTransitionTime: condition.LastTransitionTime?.Time
        })) : []
        const specContainers: any[] = ([] as any[]).concat(spec.InitContainers || [], spec.Containers || [])
        const specByName = new Map<string, any>()
        specContainers.forEach(container => specByName.set(container.Name || container.name, container))
        const statuses: Array<{ status: any, type: string }> = []
        ;(status.InitContainerStatuses || []).forEach((item: any) => statuses.push({ status: item, type: 'INIT' }))
        ;(status.ContainerStatuses || []).forEach((item: any) => statuses.push({ status: item, type: 'APPLICATION' }))
        ;(status.EphemeralContainerStatuses || []).forEach((item: any) => statuses.push({ status: item, type: 'EPHEMERAL' }))
        let restartCount = 0
        const containers = statuses.map(item => {
            const state = containerState(item.status)
            const specContainer = specByName.get(item.status.Name) || {}
            restartCount += Number(item.status.RestartCount || 0)
            return {
                name: item.status.Name,
                type: item.type,
                image: item.status.Image || specContainer.Image,
                imageId: item.status.ImageID,
                containerId: item.status.ContainerID,
                ready: !!item.status.Ready,
                started: item.status.Started,
                restartCount: Number(item.status.RestartCount || 0),
                state: state.state,
                waitingReason: state.state === 'WAITING' ? state.reason : '',
                terminatedReason: state.state === 'TERMINATED' ? state.reason : '',
                lastTerminatedReason: item.status.LastTerminationState?.Terminated?.Reason,
                cpuRequest: firstValue(specContainer, ['Resources.Requests.cpu']),
                cpuLimit: firstValue(specContainer, ['Resources.Limits.cpu']),
                memoryRequest: firstValue(specContainer, ['Resources.Requests.memory']),
                memoryLimit: firstValue(specContainer, ['Resources.Limits.memory']),
                livenessProbeConfigured: !!specContainer.LivenessProbe,
                readinessProbeConfigured: !!specContainer.ReadinessProbe,
                startupProbeConfigured: !!specContainer.StartupProbe
            }
        })
        const owners = Array.isArray(objectMeta.OwnerReferences) ? objectMeta.OwnerReferences : []
        const volumes = Array.isArray(spec.Volumes) ? spec.Volumes : []
        const pvcReferences = volumes.map(volume => volume?.PersistentVolumeClaim?.ClaimName || volume?.VolumeSource?.PersistentVolumeClaim?.ClaimName).filter(Boolean)
        const nodeName = spec.NodeName || firstValue(data, ['K8s.Node', 'NodeName'])
        const node = this.topologyNodes().find(item => this.sameCluster(item) && String(item.data?.Type || '').toLowerCase() === 'node' && firstValue(item.data || {}, ['Name', 'K8s.Name']) === nodeName)
        return {
            uid: objectMeta.UID || this.props.node.id,
            name: firstValue(data, ['Name', 'K8s.Name']) || objectMeta.Name || this.props.node.id,
            namespace,
            phase: status.Phase || firstValue(data, ['K8s.Status', 'Status']),
            podIp: status.PodIP || firstValue(data, ['K8s.IP', 'IP']),
            hostIp: status.HostIP,
            nodeName,
            qosClass: status.QOSClass,
            createdAt: objectMeta.CreationTimestamp?.Time,
            startTime: status.StartTime?.Time,
            ownerKind: owners[0]?.Kind,
            ownerName: owners[0]?.Name,
            ownerUid: owners[0]?.UID,
            conditions,
            restartCount,
            volumes: volumes.map(volume => volume.Name).filter(Boolean),
            pvcReferences,
            containers,
            selectedByServices: this.selectedServices(labels, namespace),
            node: node ? { uid: node.id, name: nodeName, kind: 'Node' } : nodeName ? { name: nodeName, kind: 'Node' } : undefined,
            labels,
            relationshipConfidence: node ? 'CONFIRMED' : nodeName ? 'INFERRED' : 'UNKNOWN',
            source: 'TOPOLOGY'
        }
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        if (attrs.href) return <img className="netdive-k8s-node-detail__topology-icon-image" src={attrs.href} alt="" />
        return <span className={`netdive-k8s-node-detail__topology-icon ${attrs.iconClass || ''}`} aria-hidden="true">{attrs.icon}</span>
    }

    private focusResource(reference: any) {
        const uid = reference?.uid
        const kind = String(reference?.kind || '').toLowerCase()
        const name = reference?.name
        const resource = this.topologyNodes().find(node => {
            if (!this.sameCluster(node)) return false
            if (uid && (node.id === uid || firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) === uid)) return true
            return kind && String(node.data?.Type || '').toLowerCase() === kind && firstValue(node.data || {}, ['Name', 'K8s.Name']) === name
        })
        const app = (window as any).App
        if (resource && app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs([resource.id], this.props.node.id)
    }

    private readyCondition(detail: any): boolean | undefined {
        if (!Array.isArray(detail.conditions)) return undefined
        const ready = detail.conditions.find((condition: any) => String(condition.type).toLowerCase() === 'ready')
        return ready ? String(ready.status).toLowerCase() === 'true' : undefined
    }

    private conditionTone(condition: any): 'success' | 'warning' | 'danger' {
        const status = String(condition?.status || '').toLowerCase()
        return status === 'true' ? 'success' : String(condition?.type || '').toLowerCase() === 'ready' ? 'danger' : 'warning'
    }

    private renderConditions(detail: any) {
        if (!Array.isArray(detail.conditions) || !detail.conditions.length) return <div className="netdive-k8s-pod-detail__empty-row">{translate('kubernetesPodConditionsUnavailable')}</div>
        return <div className="netdive-k8s-node-detail__rows">{detail.conditions.map((condition: any) => {
            const tone = this.conditionTone(condition)
            const state = tone === 'success'
                ? <span className="netdive-k8s-node-detail__normal"><i />{condition.status}</span>
                : <DetailBadge tone={tone}>{condition.status}</DetailBadge>
            return <Tooltip key={condition.type} title={condition.message || condition.reason || ''} placement="top"><div className={`netdive-k8s-node-detail__row netdive-k8s-node-detail__row--${tone}`}><strong>{condition.type}</strong><span>{state}</span><b>{condition.reason || '–'}</b></div></Tooltip>
        })}</div>
    }

    private renderContainers(detail: any) {
        if (!Array.isArray(detail.containers) || !detail.containers.length) return <div className="netdive-k8s-pod-detail__empty-row">{translate('kubernetesPodContainersUnavailable')}</div>
        return <div className="netdive-k8s-pod-detail__containers">{detail.containers.map((container: any) => {
            const reason = container.waitingReason || container.terminatedReason || ''
            const completed = String(detail.phase).toLowerCase() === 'succeeded' && container.state === 'TERMINATED' && (!reason || reason === 'Completed')
            const problem = !completed && (container.state !== 'RUNNING' || !container.ready)
            const stateLabel = completed ? 'Completed' : reason || container.state
            const resources = [
                container.cpuRequest || container.cpuLimit ? `CPU ${container.cpuRequest || '–'} / ${container.cpuLimit || '–'}` : '',
                container.memoryRequest || container.memoryLimit ? `Memory ${container.memoryRequest || '–'} / ${container.memoryLimit || '–'}` : ''
            ].filter(Boolean).join(' · ')
            const probes = [container.livenessProbeConfigured && 'Liveness', container.readinessProbeConfigured && 'Readiness', container.startupProbeConfigured && 'Startup'].filter(Boolean).join(' · ')
            return <div className={`netdive-k8s-pod-detail__container ${problem ? 'is-problem' : ''}`} key={`${container.type}:${container.name}`}>
                <div className="netdive-k8s-pod-detail__container-main"><strong>{container.name}</strong><span>{container.type}</span></div>
                <div className="netdive-k8s-pod-detail__container-state">{problem ? <DetailBadge tone={reason === 'OOMKilled' || container.state === 'TERMINATED' ? 'danger' : 'warning'}>{stateLabel}</DetailBadge> : <span className="netdive-k8s-node-detail__normal"><i />{stateLabel === 'RUNNING' ? 'Running' : stateLabel}</span>}</div>
                <div className="netdive-k8s-pod-detail__container-restarts"><span>{translate('kubernetesRestarts')}</span><strong className={Number(container.restartCount || 0) > 0 ? 'is-warning' : ''}>{optionalNumber(container.restartCount)}</strong></div>
                <Tooltip title={container.image || ''} placement="top"><small>{container.image || translate('kubernetesNotCollected')}</small></Tooltip>
                {(resources || probes) && <small className="netdive-k8s-pod-detail__container-meta">{resources || translate('kubernetesResourceConfigurationNone')}{resources && probes ? ' · ' : ''}{probes ? `${translate('kubernetesConfiguredProbes')} ${probes}` : ''}</small>}
            </div>
        })}</div>
    }

    private renderResourceLinks(references: any[]) {
        if (!Array.isArray(references) || !references.length) return <span>{translate('kubernetesNone')}</span>
        return <span className="netdive-k8s-pod-detail__links">{references.map(reference => <Button key={`${reference.kind}:${reference.uid || reference.name}`} type="text" onClick={() => this.focusResource(reference)}><span>{reference.name}</span><RightOutlined /></Button>)}</span>
    }

    render() {
        const detail = this.state.detail || {}
        const phase = String(detail.phase || '').toLowerCase()
        const ready = this.readyCondition(detail)
        const containers = Array.isArray(detail.containers) ? detail.containers : []
        const readyContainers = containers.filter((container: any) => container.ready).length
        const problemContainers = containers.filter((container: any) => {
            const completed = phase === 'succeeded' && container.state === 'TERMINATED' && (!container.terminatedReason || container.terminatedReason === 'Completed')
            return !completed && (container.state !== 'RUNNING' || !container.ready || container.waitingReason)
        })
        const critical = phase === 'failed' || problemContainers.some((container: any) => container.terminatedReason === 'OOMKilled')
        const warning = phase === 'pending' || ready === false || problemContainers.length > 0
        const known = !!phase
        const statusTone = critical ? 'danger' : warning ? 'warning' : known ? 'success' : 'default'
        const statusLabel = critical ? translate('kubernetesHealthCritical') : warning ? translate('kubernetesHealthWarning') : known ? translate('kubernetesHealthNormal') : translate('kubernetesHealthUnknown')
        const conclusion = critical
            ? translate('kubernetesPodCriticalConclusion')
            : warning ? translate('kubernetesPodWarningConclusion')
            : known ? translate('kubernetesPodNoCurrentImpact') : translate('kubernetesPodStatusUnavailable')
        const selectedServices = Array.isArray(detail.selectedByServices) ? detail.selectedByServices : []
        const schedulingRows = [
            { label: translate('kubernetesScheduledNode'), value: detail.node ? <Button type="link" className="netdive-k8s-pod-detail__inline-link" onClick={() => this.focusResource(detail.node)}>{detail.nodeName || detail.node.name}</Button> : detail.nodeName || translate('kubernetesNotCollected') },
            { label: translate('kubernetesOwner'), value: detail.ownerName ? <Button type="link" className="netdive-k8s-pod-detail__inline-link" onClick={() => this.focusResource({ uid: detail.ownerUid, name: detail.ownerName, kind: detail.ownerKind })}>{detail.ownerKind || ''} · {detail.ownerName}</Button> : translate('kubernetesNone') },
            { label: translate('kubernetesSelectedByServices'), value: this.renderResourceLinks(selectedServices) },
            { label: translate('kubernetesRelationshipConfidence'), value: <DetailBadge tone={detail.relationshipConfidence === 'CONFIRMED' ? 'success' : detail.relationshipConfidence === 'INFERRED' ? 'warning' : 'default'}>{detail.relationshipConfidence || 'UNKNOWN'}</DetailBadge> }
        ]
        const storageRows = [
            { label: translate('kubernetesVolumes'), value: Array.isArray(detail.volumes) && detail.volumes.length ? detail.volumes.join(', ') : translate('kubernetesNone'), textValue: Array.isArray(detail.volumes) ? detail.volumes.join(', ') : '' },
            { label: 'PVC', value: Array.isArray(detail.pvcReferences) && detail.pvcReferences.length ? detail.pvcReferences.join(', ') : translate('kubernetesNone') },
            { label: 'QoS Class', value: detail.qosClass || translate('kubernetesNotCollected') }
        ]
        const basicRows = [
            { label: translate('kubernetesPodName'), value: detail.name || this.props.node.id, textValue: detail.name || this.props.node.id, copyText: detail.name || this.props.node.id },
            { label: translate('kubernetesTopologyNamespaces'), value: detail.namespace || translate('kubernetesNotCollected') },
            { label: 'Pod IP', value: detail.podIp || translate('kubernetesNotCollected'), copyText: detail.podIp },
            { label: 'Host IP', value: detail.hostIp || translate('kubernetesNotCollected'), copyText: detail.hostIp }
        ]
        return <div className="netdive-k8s-node-detail netdive-k8s-pod-detail">
            <DetailSection icon={<InfoIcon />} title={translate('kubernetesPodBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <DetailKeyValueList rows={basicRows} copyTooltip={translate('copy')} />
            </DetailSection>

            <DetailSection icon={this.topologyIcon(this.props.node)} title={translate('kubernetesPodOperationalStatus')}>
                <div className={`netdive-k8s-node-detail__hero netdive-k8s-node-detail__hero--${statusTone}`}><i /><strong>{statusLabel}</strong><span>{conclusion}</span></div>
                <div className="netdive-k8s-node-detail__summary">
                    <div><span>Phase</span><strong className={critical ? 'is-danger' : warning ? 'is-warning' : ''}>{detail.phase || '–'}</strong></div>
                    <div><span>{translate('kubernetesContainers')}</span><strong>{containers.length ? `${readyContainers}/${containers.length}` : '–'}</strong></div>
                    <div><span>{translate('kubernetesRestarts')}</span><strong className={Number(detail.restartCount || 0) > 0 ? 'is-warning' : ''}>{optionalNumber(detail.restartCount)}</strong></div>
                    <div><span>{translate('kubernetesConnectedServices')}</span><strong>{optionalNumber(detail.selectedByServices === undefined ? undefined : selectedServices.length)}</strong></div>
                </div>
            </DetailSection>

            <DetailSection icon={<ViewModuleIcon />} title={translate('kubernetesContainerStatus')}>{this.renderContainers(detail)}</DetailSection>
            <DetailSection icon={<ErrorOutlineIcon />} title={translate('kubernetesPodConditions')}>{this.renderConditions(detail)}</DetailSection>
            <DetailSection icon={<LinkIcon />} title={translate('kubernetesSchedulingRelationships')}><DetailKeyValueList rows={schedulingRows} /></DetailSection>
            <DetailSection icon={<StorageIcon />} title={translate('kubernetesStorageAndQos')}><DetailKeyValueList rows={storageRows} /></DetailSection>

            {this.state.error && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesPodDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesPodDetailPanel
