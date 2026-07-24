import * as React from 'react'
import { Tooltip } from 'antd'
import InfoIcon from '@material-ui/icons/Info'
import LinkIcon from '@material-ui/icons/Link'
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet'
import WarningIcon from '@material-ui/icons/WarningOutlined'
import { HistoryOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { collectKubernetesEventGroups, ConnectedResourcesSection, DetailCopyButton, DetailKeyValueList, DetailLayerIcon, DetailSection, KubernetesRecentEvents } from './common'
import './KubernetesNodeDetailPanel.css'
import './KubernetesServiceDetailPanel.css'

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
const targetPort = (value: any): string => {
    if (value === undefined || value === null || value === '') return ''
    if (typeof value !== 'object') return String(value)
    return String(value.StrVal || value.strVal || value.IntVal || value.intVal || '')
}
const stringList = (value: any): string[] => Array.isArray(value) ? value.filter(item => item !== undefined && item !== null && String(item) !== '').map(String) : value ? [String(value)] : []
const displayOptional = (value: any): React.ReactNode => {
    if (value === undefined || value === null || String(value).trim() === '' || String(value).trim().toLowerCase() === 'none') return translate('kubernetesNone')
    return value
}
const SERVICE_EVENT_TONES = {
    failedtoupdateendpoint: 'warning' as const,
    syncloadbalancerfailed: 'danger' as const,
    failedtoloadbalancer: 'danger' as const,
    unhealthy: 'warning' as const,
    updatedloadbalancer: 'success' as const
}

class KubernetesServiceDetailPanel extends React.Component<Props, State> {
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
            firstValue(data, ['ClusterName', 'K8s.ClusterName', 'Cluster'])
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
        fetch(`${endpoint}/api/mold/kubernetes-clusters/services/detail?id=${encodeURIComponent(cluster.id)}&uid=${encodeURIComponent(uid)}`, {
            cache: 'no-store',
            headers: this.props.session?.token ? { 'X-Auth-Token': this.props.session.token } : undefined
        }).then(response => {
            if (!response.ok) throw new Error(`service detail unavailable: ${response.status}`)
            return response.json()
        }).then(detail => {
            if (this.state.requestKey === requestKey) this.setState({ detail: { ...fallback, ...detail, source: 'KUBERNETES_API' }, loading: false, error: false })
        }).catch(() => {
            if (this.state.requestKey === requestKey) this.setState({ detail: this.detailFromTopology(), loading: false, error: true })
        })
    }

    private topologyNodes(): Node[] {
        const nodes = (window as any).App?.tc?.nodes
        if (nodes instanceof Map) return Array.from(nodes.values())
        return Array.isArray(nodes) ? nodes : []
    }

    private topologyLinks(): any[] {
        const links = (window as any).App?.tc?.links
        if (links instanceof Map) return Array.from(links.values())
        return Array.isArray(links) ? links : []
    }

    private sameCluster(node: Node): boolean {
        const selectedCluster = firstValue(this.props.node.data || {}, ['ClusterName', 'K8s.ClusterName'])
        return !selectedCluster || firstValue(node.data || {}, ['ClusterName', 'K8s.ClusterName']) === selectedCluster
    }

    private linkedPods(selector: any, namespace: string): { pods: any[], source: string } {
        const linkedIDs = new Set<string>()
        this.topologyLinks().forEach(link => {
            if (String(link?.data?.RelationType || '').toLowerCase() !== 'service') return
            const sourceID = typeof link?.source === 'string' ? link.source : link?.source?.id
            const targetID = typeof link?.target === 'string' ? link.target : link?.target?.id
            if (sourceID === this.props.node.id && targetID) linkedIDs.add(targetID)
            if (targetID === this.props.node.id && sourceID) linkedIDs.add(sourceID)
        })
        let pods = this.topologyNodes().filter(node => linkedIDs.has(node.id) && String(node.data?.Type || '').toLowerCase() === 'pod')
        let source = pods.length ? 'TOPOLOGY_LINK' : 'UNKNOWN'
        if (!pods.length && selector && typeof selector === 'object' && Object.keys(selector).length) {
            pods = this.topologyNodes().filter(node => {
                const data = node.data || {}
                if (!this.sameCluster(node) || String(data.Manager || '').toLowerCase() !== 'k8s' || String(data.Type || '').toLowerCase() !== 'pod') return false
                if (firstValue(data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) !== namespace) return false
                const labels = firstRaw(data, ['K8s.Labels', 'Labels', 'K8s.Extra.ObjectMeta.Labels']) || {}
                return Object.keys(selector).every(key => String(labels[key]) === String(selector[key]))
            })
            if (pods.length) source = 'SELECTOR'
        }
        return {
            source,
            pods: pods.map(pod => {
                const status = firstRaw(pod.data || {}, ['K8s.Extra.Status']) || {}
                const conditions = Array.isArray(status.Conditions) ? status.Conditions : []
                const readyCondition = conditions.find(condition => String(condition?.Type || '').toLowerCase() === 'ready')
                return {
                    uid: firstValue(pod.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) || pod.id,
                    kind: 'Pod',
                    name: firstValue(pod.data || {}, ['Name', 'K8s.Name']) || pod.id,
                    namespace,
                    nodeName: firstValue(pod.data || {}, ['K8s.Extra.Spec.NodeName', 'K8s.Node', 'NodeName']),
                    phase: status.Phase || firstValue(pod.data || {}, ['K8s.Status', 'Status']),
                    ready: readyCondition ? String(readyCondition.Status).toLowerCase() === 'true' : undefined
                }
            })
        }
    }

    private detailFromTopology(): any {
        const data = this.props.node.data || {}
        const extra = firstRaw(data, ['K8s.Extra']) || {}
        const objectMeta = extra.ObjectMeta || {}
        const spec = extra.Spec || {}
        const status = extra.Status || {}
        const namespace = firstValue(data, ['K8s.Namespace', 'Namespace']) || objectMeta.Namespace
        const selector = spec.Selector || firstRaw(data, ['K8s.Selector', 'Selector']) || {}
        const related = this.linkedPods(selector, namespace)
        const ports = Array.isArray(spec.Ports) ? spec.Ports : (Array.isArray(data.K8s?.Ports) ? data.K8s.Ports : [])
        const clusterIPs = stringList(spec.ClusterIPs && spec.ClusterIPs.length ? spec.ClusterIPs : spec.ClusterIP || data.K8s?.ClusterIP)
        const ingress = Array.isArray(status.LoadBalancer?.Ingress) ? status.LoadBalancer.Ingress : []
        return {
            uid: objectMeta.UID || this.props.node.id,
            name: firstValue(data, ['Name', 'K8s.Name']) || objectMeta.Name || this.props.node.id,
            namespace,
            type: spec.Type || data.K8s?.ServiceType,
            clusterIps: clusterIPs,
            externalIps: stringList(spec.ExternalIPs),
            externalName: spec.ExternalName || data.K8s?.ExternalName,
            loadBalancerIngress: ingress,
            selector,
            sessionAffinity: spec.SessionAffinity || data.K8s?.SessionAffinity,
            externalTrafficPolicy: spec.ExternalTrafficPolicy,
            internalTrafficPolicy: spec.InternalTrafficPolicy,
            ipFamilies: stringList(spec.IPFamilies),
            ipFamilyPolicy: spec.IPFamilyPolicy,
            publishNotReadyAddresses: spec.PublishNotReadyAddresses,
            ports,
            selectedPods: related.pods,
            createdAt: objectMeta.CreationTimestamp?.Time,
            endpointDataAvailable: false,
            relationshipSource: related.source,
            source: 'TOPOLOGY'
        }
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        if (attrs.href) return <img className="netdive-k8s-node-detail__topology-icon-image" src={attrs.href} alt="" />
        return <span className={`netdive-k8s-node-detail__topology-icon ${attrs.iconClass || ''}`} aria-hidden="true">{attrs.icon}</span>
    }

    private resourceForReference(reference: any): Node | undefined {
        const uid = reference?.uid || reference?.UID
        const kind = String(reference?.kind || reference?.Kind || '').toLowerCase()
        const name = reference?.name || reference?.Name
        return this.topologyNodes().find(node => {
            if (!this.sameCluster(node)) return false
            if (uid && (node.id === uid || firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) === uid)) return true
            return kind && String(node.data?.Type || '').toLowerCase() === kind && firstValue(node.data || {}, ['Name', 'K8s.Name']) === name
        })
    }

    private focusResources(resources: Node[]) {
        const app = (window as any).App
        const ids = resources.map(resource => resource.id)
        if (ids.length && app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs(ids, this.props.node.id, true)
    }

    private scopedResources(types: string[]): Node[] {
        const namespace = firstValue(this.props.node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
        const allowed = new Set(types.map(type => type.toLowerCase()))
        return this.topologyNodes().filter(node => {
            if (!this.sameCluster(node) || !allowed.has(String(node.data?.Type || '').toLowerCase())) return false
            return !namespace || firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) === namespace
        })
    }

    private resourceByName(type: string, name: string): Node | undefined {
        if (!name) return undefined
        return this.scopedResources([type]).find(node => firstValue(node.data || {}, ['Name', 'K8s.Name']) === name)
    }

    private workloadTargets(pods: Node[]): Node[] {
        const workloadTypes = ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob']
        const candidates = this.scopedResources([...workloadTypes, 'replicaset'])
        const byUID = new Map<string, Node>()
        const byKindName = new Map<string, Node>()
        candidates.forEach(node => {
            const kind = String(node.data?.Type || '').toLowerCase()
            const uid = firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) || node.id
            const name = firstValue(node.data || {}, ['Name', 'K8s.Name'])
            byUID.set(uid, node)
            if (name) byKindName.set(`${kind}:${name}`, node)
        })
        const results = new Map<string, Node>()
        const resolveOwner = (owner: any) => {
            const kind = String(owner?.Kind || owner?.kind || '').toLowerCase()
            const ownerNode = byUID.get(String(owner?.UID || owner?.uid || ''))
                || byKindName.get(`${kind}:${String(owner?.Name || owner?.name || '')}`)
            if (!ownerNode) return
            const ownerType = String(ownerNode.data?.Type || '').toLowerCase()
            if (workloadTypes.indexOf(ownerType) >= 0) {
                results.set(ownerNode.id, ownerNode)
                return
            }
            if (ownerType === 'replicaset') {
                const parentOwners = firstRaw(ownerNode.data || {}, ['K8s.Extra.ObjectMeta.OwnerReferences']) || []
                if (Array.isArray(parentOwners)) parentOwners.forEach(resolveOwner)
            }
        }
        pods.forEach(pod => {
            const owners = firstRaw(pod.data || {}, ['K8s.Extra.ObjectMeta.OwnerReferences']) || []
            if (Array.isArray(owners)) owners.forEach(resolveOwner)
            let parent: Node | null | undefined = pod.parent
            while (parent) {
                if (workloadTypes.indexOf(String(parent.data?.Type || '').toLowerCase()) >= 0) {
                    results.set(parent.id, parent)
                    break
                }
                parent = parent.parent
            }
        })
        return Array.from(results.values())
    }

    private endpointSliceTargets(detail: any): Node[] {
        const references = [
            ...(Array.isArray(detail.endpointSlices) ? detail.endpointSlices : []),
            ...(Array.isArray(detail.endpointSliceReferences) ? detail.endpointSliceReferences : []),
            ...(Array.isArray(detail.endpoints) ? detail.endpoints.map((endpoint: any) => endpoint.endpointSliceName || endpoint.sliceName).filter(Boolean) : [])
        ]
        if (!references.length) return []
        const matched = new Map<string, Node>()
        references.forEach(reference => {
            const normalized = typeof reference === 'string'
                ? { name: reference }
                : { ...reference, name: reference?.name || reference?.Name || reference?.endpointSliceName }
            const resource = this.resourceForReference({ ...normalized, kind: 'EndpointSlice' })
            if (resource) matched.set(resource.id, resource)
        })
        const serviceName = String(detail.name || firstValue(this.props.node.data || {}, ['Name', 'K8s.Name']))
        this.scopedResources(['endpointslice']).forEach(node => {
            const labels = firstRaw(node.data || {}, ['K8s.Labels', 'Labels', 'K8s.Extra.ObjectMeta.Labels']) || {}
            const relatedService = firstValue(node.data || {}, ['K8s.ServiceName', 'ServiceName'])
                || String(labels['kubernetes.io/service-name'] || '')
            if (relatedService === serviceName) matched.set(node.id, node)
        })
        return Array.from(matched.values())
    }

    private selectorValue(selector: any): React.ReactNode {
        if (!selector || typeof selector !== 'object' || Array.isArray(selector)) return translate('kubernetesNone')
        const entries = Object.keys(selector).sort().map(key => `${key}=${String(selector[key])}`)
        if (!entries.length) return translate('kubernetesNone')
        const visible = entries.slice(0, 2)
        const hidden = entries.slice(2)
        return <span className="netdive-k8s-service-detail__selectors">
            {visible.map(value => <span key={value}>{value}</span>)}
            {hidden.length > 0 && <Tooltip title={hidden.join('\n')} placement="top"><button type="button">{translate('kubernetesAdditionalItems').replace('{count}', String(hidden.length))}</button></Tooltip>}
        </span>
    }

    private renderPorts(ports: any[]) {
        if (!ports.length) return <div className="netdive-k8s-service-detail__empty-row">{translate('kubernetesServicePortsUnavailable')}</div>
        return <div className="netdive-k8s-service-detail__ports">
            <div className="netdive-k8s-service-detail__port-head"><span>{translate('kubernetesPortName')}</span><span>{translate('kubernetesServicePort')}</span><span>{translate('kubernetesTargetPort')}</span><span>NodePort</span></div>
            {ports.map((port, index) => {
                const servicePort = port.Port ?? port.port
                return <div className="netdive-k8s-service-detail__port" key={`${port.Name || port.name || index}:${servicePort}`}>
                    <strong>{port.Name || port.name || translate('kubernetesNone')}</strong>
                    <span>{servicePort === undefined || servicePort === null || servicePort === '' ? translate('kubernetesNone') : `${servicePort} / ${port.Protocol || port.protocol || 'TCP'}`}</span>
                    <span>{targetPort(port.TargetPort ?? port.targetPort) || translate('kubernetesNone')}</span>
                    <span>{Number(port.NodePort ?? port.nodePort ?? 0) || '–'}</span>
                </div>
            })}
        </div>
    }

    private renderEndpoints(detail: any) {
        const endpoints = Array.isArray(detail.endpoints) ? detail.endpoints : []
        if (detail.endpointDataAvailable && endpoints.length) {
            return <div className="netdive-k8s-service-detail__endpoints">{endpoints.map((endpoint: any, index: number) => {
                const ready = endpoint.ready === true
                const podReference = {
                    uid: endpoint.podUid || endpoint.targetRef?.uid || endpoint.targetRef?.UID,
                    kind: endpoint.targetRef?.kind || endpoint.targetRef?.Kind || 'Pod',
                    name: endpoint.podName || endpoint.targetRef?.name || endpoint.targetRef?.Name
                }
                const podTarget = this.resourceForReference(podReference)
                const podName = podReference.name || endpoint.address || translate('kubernetesNotCollected')
                const nodeName = endpoint.nodeName || ''
                const nodeTarget = this.resourceByName('node', nodeName)
                return <div className="netdive-k8s-service-detail__endpoint" key={`${endpoint.address}:${index}`}>
                    <div className="netdive-k8s-service-detail__endpoint-primary">
                        <Tooltip title={podName} placement="top">
                            {podTarget ? <button type="button" onClick={() => this.focusResources([podTarget])}>{podName}</button> : <strong>{podName}</strong>}
                        </Tooltip>
                        <span className={`netdive-k8s-service-detail__endpoint-ready ${ready ? 'is-ready' : 'is-not-ready'}`}><i />{ready ? 'Ready' : 'NotReady'}</span>
                    </div>
                    <div className="netdive-k8s-service-detail__endpoint-secondary">
                        <span className="netdive-k8s-service-detail__endpoint-ip"><small>{endpoint.address || translate('kubernetesNotCollected')}</small>{endpoint.address && <DetailCopyButton value={String(endpoint.address)} tooltip={translate('copy')} />}</span>
                    </div>
                    <div className="netdive-k8s-service-detail__endpoint-node">
                        <span>{translate('kubernetesScheduledNodes')}</span>
                        <Tooltip title={nodeName || translate('kubernetesNotCollected')} placement="top">
                            {nodeTarget ? <button type="button" onClick={() => this.focusResources([nodeTarget])}>{nodeName}</button> : <b>{nodeName || translate('kubernetesNotCollected')}</b>}
                        </Tooltip>
                    </div>
                </div>
            })}</div>
        }
        const pods = Array.isArray(detail.selectedPods) ? detail.selectedPods : []
        if (!pods.length) return <div className="netdive-k8s-service-detail__empty-row">{translate('kubernetesServiceEndpointsUnavailable')}</div>
        return <div className="netdive-k8s-service-detail__endpoints">{pods.map((pod: any) => {
            const podTarget = this.resourceForReference(pod)
            const nodeTarget = this.resourceByName('node', pod.nodeName)
            return <div className="netdive-k8s-service-detail__endpoint" key={pod.uid || pod.name}>
                <div className="netdive-k8s-service-detail__endpoint-primary">
                    <Tooltip title={pod.name} placement="top">
                        {podTarget ? <button type="button" onClick={() => this.focusResources([podTarget])}>{pod.name}</button> : <strong>{pod.name}</strong>}
                    </Tooltip>
                    <span className={`netdive-k8s-service-detail__endpoint-ready ${pod.ready === true ? 'is-ready' : pod.ready === false ? 'is-not-ready' : 'is-unknown'}`}><i />{pod.ready === true ? 'Ready' : pod.ready === false ? 'NotReady' : translate('kubernetesUnknown')}</span>
                </div>
                <div className="netdive-k8s-service-detail__endpoint-secondary">
                    <span className="netdive-k8s-service-detail__endpoint-ip"><small>{translate('kubernetesNotCollected')}</small></span>
                </div>
                <div className="netdive-k8s-service-detail__endpoint-node">
                    <span>{translate('kubernetesScheduledNodes')}</span>
                    <Tooltip title={pod.nodeName || translate('kubernetesNotCollected')} placement="top">
                        {nodeTarget ? <button type="button" onClick={() => this.focusResources([nodeTarget])}>{pod.nodeName}</button> : <b>{pod.nodeName || translate('kubernetesNotCollected')}</b>}
                    </Tooltip>
                </div>
            </div>
        })}</div>
    }

    render() {
        const detail = this.state.detail || {}
        const endpointKnown = detail.endpointDataAvailable === true
        const endpoints = Array.isArray(detail.endpoints) ? detail.endpoints : []
        const pods = Array.isArray(detail.selectedPods) ? detail.selectedPods : []
        const ports = Array.isArray(detail.ports) ? detail.ports : []
        const isExternalName = String(detail.type || '').toLowerCase() === 'externalname'
        const endpointCount = endpointKnown ? Number(detail.endpointCount === undefined ? endpoints.length : detail.endpointCount) : undefined
        const readyEndpointCount = endpointKnown
            ? Number(detail.readyEndpointCount === undefined ? endpoints.filter((endpoint: any) => endpoint.ready === true).length : detail.readyEndpointCount)
            : undefined
        const hasReadyEndpoints = endpointKnown && Number(readyEndpointCount || 0) > 0
        const hasEndpointsWithoutReady = endpointKnown && Number(endpointCount || 0) > 0 && Number(readyEndpointCount || 0) === 0
        const hasNoEndpoints = endpointKnown && Number(endpointCount || 0) === 0
        const statusTone = hasReadyEndpoints || isExternalName ? 'success' : hasEndpointsWithoutReady || hasNoEndpoints ? 'danger' : 'default'
        const statusLabel = hasReadyEndpoints || isExternalName
            ? translate('kubernetesHealthNormal')
            : hasEndpointsWithoutReady
                ? translate('kubernetesServiceStatusDanger')
                : hasNoEndpoints
                    ? translate('kubernetesHealthWarning')
                    : translate('kubernetesHealthUnknown')
        const conclusion = hasReadyEndpoints
            ? translate('kubernetesServiceReadyEndpointsServing').replace('{count}', String(readyEndpointCount))
            : hasEndpointsWithoutReady
                ? translate('kubernetesServiceNoReadyEndpointAvailable')
                : hasNoEndpoints
                    ? translate('kubernetesServiceNoEndpoints')
                    : isExternalName
                        ? translate('kubernetesServiceExternalNameConfigured')
                        : translate('kubernetesServiceStatusUnavailable')
        const readySummary = endpointKnown ? `${Number(readyEndpointCount || 0)}/${Number(endpointCount || 0)}` : '–'
        const selectedPodByName = new Map<string, any>()
        pods.forEach((pod: any) => {
            if (pod?.name) selectedPodByName.set(String(pod.name), pod)
        })
        const readyEndpoints = endpointKnown ? endpoints.filter((endpoint: any) => endpoint.ready === true) : []
        const readyEndpointNodeNames = readyEndpoints.map((endpoint: any) => {
            if (endpoint.nodeName) return String(endpoint.nodeName)
            const podName = endpoint.podName || endpoint.targetRef?.name || endpoint.targetRef?.Name
            return String(selectedPodByName.get(String(podName || ''))?.nodeName || '')
        })
        const readyEndpointNodesKnown = Number(readyEndpointCount || 0) > 0
            && readyEndpoints.length === Number(readyEndpointCount || 0)
            && readyEndpointNodeNames.every(Boolean)
        const uniqueReadyNodeNames = new Set(readyEndpointNodeNames.filter(Boolean))
        const availabilityState = !readyEndpointNodesKnown
            ? undefined
            : Number(readyEndpointCount) === 1
                ? {
                    tone: 'warning',
                    label: translate('kubernetesAvailabilitySingleEndpoint'),
                    summary: translate('kubernetesAvailabilitySingleEndpointSummary'),
                    title: translate('kubernetesAvailabilitySingleEndpoint'),
                    description: translate('kubernetesAvailabilitySingleEndpointDescription')
                }
                : uniqueReadyNodeNames.size === 1
                    ? {
                        tone: 'warning',
                        label: translate('kubernetesAvailabilityDistributionWarning'),
                        summary: translate('kubernetesAvailabilityDistributionWarningSummary'),
                        title: translate('kubernetesEndpointDistributionWarning'),
                        description: translate('kubernetesEndpointDistributionWarningDescription').replace('{count}', String(readyEndpointCount))
                    }
                    : {
                        tone: 'success',
                        label: translate('kubernetesAvailabilityDistributed'),
                        summary: translate('kubernetesAvailabilityDistributedSummary').replace('{count}', String(uniqueReadyNodeNames.size)),
                        title: translate('kubernetesAvailabilityDistributed'),
                        description: translate('kubernetesAvailabilityDistributedDescription').replace('{count}', String(uniqueReadyNodeNames.size))
                    }
        const ingress = Array.isArray(detail.loadBalancerIngress) ? detail.loadBalancerIngress.map((item: any) => item.IP || item.ip || item.Hostname || item.hostname).filter(Boolean) : []
        const rawClusterIps = stringList(detail.clusterIps)
        const isHeadless = rawClusterIps.some(ip => String(ip).toLowerCase() === 'none')
            || String(detail.clusterIP || detail.clusterIp || '').toLowerCase() === 'none'
        const clusterIps = rawClusterIps.filter(ip => String(ip).toLowerCase() !== 'none')
        const clusterIpValue = isHeadless ? translate('kubernetesNone') : clusterIps.join(', ') || translate('kubernetesNone')
        const serviceTypeValue = `${displayOptional(detail.type)}${isHeadless ? ` · Headless` : ''}`
        const normalizedList = (value: any): string => stringList(value).filter(item => item.trim().toLowerCase() !== 'none').join(', ') || translate('kubernetesNone')
        const networkRows = [
            { label: 'Cluster IP', value: isHeadless ? `${translate('kubernetesNone')} · Headless` : clusterIpValue, textValue: clusterIps.join(', '), copyText: clusterIps[0] },
            { label: 'External IP', value: normalizedList(detail.externalIps), textValue: stringList(detail.externalIps).join(', ') },
            { label: 'LoadBalancer', value: normalizedList(ingress), textValue: ingress.join(', ') },
            { label: 'ExternalName', value: displayOptional(detail.externalName), textValue: detail.externalName },
            { label: translate('kubernetesExternalTrafficPolicy'), value: displayOptional(detail.externalTrafficPolicy) },
            { label: translate('kubernetesInternalTrafficPolicy'), value: displayOptional(detail.internalTrafficPolicy) },
            { label: translate('kubernetesSessionAffinity'), value: displayOptional(detail.sessionAffinity) }
        ]
        const podTargets = pods.map((reference: any) => this.resourceForReference(reference)).filter((resource: Node | undefined): resource is Node => !!resource)
        const workloadTargets = this.workloadTargets(podTargets)
        const connectedReadyNodeNames = new Set<string>(readyEndpointNodeNames.filter(Boolean))
        const nodeTargets = Array.from(connectedReadyNodeNames).map(name => this.resourceByName('node', name)).filter((resource: Node | undefined): resource is Node => !!resource)
        const endpointSliceTargets = this.endpointSliceTargets(detail)
        const serviceName = String(detail.name || this.props.node.id)
        const basicRows = [
            { label: translate('kubernetesServiceName'), value: <Tooltip title={serviceName} placement="top"><span className="netdive-k8s-service-detail__service-name">{serviceName}</span></Tooltip>, textValue: serviceName, copyText: serviceName },
            { label: translate('kubernetesTopologyNamespaces'), value: displayOptional(detail.namespace) },
            { label: translate('kubernetesServiceType'), value: displayOptional(serviceTypeValue) },
            { label: 'Cluster IP', value: clusterIpValue, textValue: clusterIps.join(', '), copyText: clusterIps[0] },
            { label: 'IP Family', value: displayOptional(stringList(detail.ipFamilies).join(', ') || detail.ipFamilyPolicy) },
            { label: 'Selector', value: this.selectorValue(detail.selector) },
            { label: translate('kubernetesPublishNotReadyAddresses'), value: detail.publishNotReadyAddresses === undefined ? translate('kubernetesNone') : detail.publishNotReadyAddresses ? translate('yes') : translate('no') }
        ]
        const recentEventGroups = collectKubernetesEventGroups([
            detail.events,
            detail.recentEvents,
            detail.serviceEvents,
            firstRaw(this.props.node.data || {}, ['K8s.Extra.Events', 'K8s.Events', 'Events'])
        ], SERVICE_EVENT_TONES)
        return <div className="netdive-k8s-node-detail netdive-k8s-service-detail">
            <DetailSection icon={<InfoIcon />} title={translate('kubernetesServiceBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <DetailKeyValueList rows={basicRows} copyTooltip={translate('copy')} />
            </DetailSection>

            <DetailSection icon={this.topologyIcon(this.props.node)} title={translate('kubernetesServiceOperationalStatus')}>
                <div className={`netdive-k8s-node-detail__hero netdive-k8s-node-detail__hero--${statusTone}`}><i /><strong>{statusLabel}</strong><Tooltip title={conclusion} placement="top"><span>{conclusion}</span></Tooltip></div>
                <div className="netdive-k8s-node-detail__summary">
                    <div><span>{translate('kubernetesServicePorts')}</span><strong>{optionalNumber(detail.ports === undefined ? undefined : ports.length)}</strong></div>
                    <div><span>{translate('kubernetesAllEndpoints')}</span><strong>{endpointKnown ? optionalNumber(endpointCount) : '–'}</strong></div>
                    <div><span>{translate('kubernetesReadyEndpoints')}</span><strong className={hasEndpointsWithoutReady ? 'is-danger' : endpointKnown && Number(readyEndpointCount || 0) < Number(endpointCount || 0) ? 'is-warning' : ''}>{readySummary}</strong></div>
                    <div><span>{translate('kubernetesTargetPods')}</span><strong>{optionalNumber(detail.selectedPods === undefined ? undefined : pods.length)}</strong></div>
                </div>
                {availabilityState && <div className={`netdive-k8s-service-detail__availability-state is-${availabilityState.tone}`}>
                    <i />
                    <strong>{availabilityState.tone === 'warning' ? translate('kubernetesAvailabilityWarning') : translate('kubernetesAvailabilityNormal')}</strong>
                </div>}
            </DetailSection>

            <DetailSection icon={<LinkIcon />} title={translate('kubernetesServiceEndpointAvailability')}>
                <div className="netdive-k8s-service-detail__endpoint-region">
                    <div className="netdive-k8s-service-detail__region-title">Endpoint</div>
                    {this.renderEndpoints(detail)}
                </div>
                {availabilityState && <React.Fragment>
                    <div className="netdive-k8s-service-detail__availability-region">
                        <div className="netdive-k8s-service-detail__region-title">{translate('kubernetesRiskAvailability')}</div>
                        <div className={`netdive-k8s-service-detail__availability-summary is-${availabilityState.tone}`}>
                            <div className="netdive-k8s-service-detail__availability-heading">
                                {availabilityState.tone === 'warning' ? <WarningIcon /> : <i />}
                                <strong>{availabilityState.title}</strong>
                            </div>
                            <dl>
                                <div><dt>{translate('kubernetesReadyEndpoints')}</dt><dd>{readyEndpointCount}</dd></div>
                                <div><dt>{translate('kubernetesScheduledNodes')}</dt><dd>{uniqueReadyNodeNames.size}</dd></div>
                            </dl>
                            <p>{availabilityState.description}</p>
                        </div>
                    </div>
                </React.Fragment>}
            </DetailSection>
            <DetailSection icon={<SettingsEthernetIcon />} title={translate('kubernetesServicePortsTraffic')}>
                {this.renderPorts(ports)}
                <div className="netdive-k8s-node-detail__subsection-title">{translate('kubernetesServiceNetworkExposure')}</div>
                <DetailKeyValueList rows={networkRows} />
            </DetailSection>
            <ConnectedResourcesSection
                icon={<LinkIcon />}
                title={translate('hostConnectedResources')}
                emptyText={translate('hostNoConnectedResources')}
                groups={[{
                    key: 'kubernetes',
                    title: translate('kubernetesConnectedResourceGroup'),
                    icon: <img src="assets/icons/k8s.png" alt="" />,
                    items: [
                        ...(podTargets.length ? [{ key: 'pods', label: translate('kubernetesTopologyPods'), count: podTargets.length, icon: this.topologyIcon(podTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(podTargets) }] : []),
                        ...(workloadTargets.length ? [{ key: 'workloads', label: translate('kubernetesTopologyWorkloadControllers'), count: workloadTargets.length, icon: <DetailLayerIcon glyph={'\uf5fd'} />, iconTone: 'kubernetes' as const, onClick: () => this.focusResources(workloadTargets) }] : []),
                        ...(nodeTargets.length ? [{ key: 'nodes', label: translate('kubernetesTopologyNodes'), count: nodeTargets.length, icon: this.topologyIcon(nodeTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(nodeTargets) }] : []),
                        ...(endpointSliceTargets.length ? [{ key: 'endpoint-slices', label: 'EndpointSlice', count: endpointSliceTargets.length, icon: this.topologyIcon(endpointSliceTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(endpointSliceTargets) }] : [])
                    ]
                }]} />
            {recentEventGroups.length > 0 && <DetailSection icon={<HistoryOutlined />} title={translate('kubernetesServiceRecentEvents')}><KubernetesRecentEvents groups={recentEventGroups} /></DetailSection>}

            {this.state.error && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesServiceDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesServiceDetailPanel
