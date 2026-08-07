import * as React from 'react'
import { Tooltip } from 'antd'
import InfoIcon from '@material-ui/icons/Info'
import LinkIcon from '@material-ui/icons/Link'
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet'
import { HistoryOutlined, LeftOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { kubernetesLabelValue, matchesKubernetesSelector } from '../KubernetesSelectors'
import { resolveKubernetesPodController } from '../KubernetesWorkloadOwnership'
import {
    BasicInfoRows,
    collectKubernetesEventGroups,
    CompactEmptyState,
    DetailAdvancedInfo,
    DetailBadgeTone,
    DetailCopyButton,
    DetailInlineSectionHeader,
    DetailLayerIcon,
    DetailSectionCard,
    DetailStatusIndicator,
    KubernetesRecentEvents,
    KubernetesMetadataRows,
    KubernetesSelectorSummary,
    KUBERNETES_DETAIL_LABELS,
    RelatedResourceGrid,
    StatusEvidenceList,
    StatusEvidenceRow,
    StatusSummaryGrid
} from './common'
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
    basicInfoAdvanced: boolean
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
    syncloadbalancerfailed: 'warning' as const,
    failedtoloadbalancer: 'warning' as const,
    unhealthy: 'warning' as const,
    updatedloadbalancer: 'success' as const
}

class KubernetesServiceDetailPanel extends React.Component<Props, State> {
    state: State = { loading: false, error: false, requestKey: '', basicCollapsed: false, basicInfoAdvanced: false }

    componentDidMount() { this.loadDetail() }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id || this.clusterFrom(prevProps)?.id !== this.cluster()?.id) {
            this.setState({ basicCollapsed: false, basicInfoAdvanced: false })
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

    private returnClusterNode(): Node | undefined {
        return (this.props.node as any).__netdiveReturnClusterNode
    }

    private returnToClusterServices = () => {
        const clusterNode = this.returnClusterNode()
        if (!clusterNode) return
        ;(clusterNode as any).__netdiveInitialDetailTab = 'services'
        const topology = (window as any).App?.tc
        if (topology && typeof topology.selectNode === 'function') {
            topology.selectNode(this.props.node.id, false)
            topology.selectNode(clusterNode.id, true, true)
            return
        }
        const app = (window as any).App
        if (app && typeof app.openResourceDetailNodeID === 'function') app.openResourceDetailNodeID(clusterNode.id)
    }

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
                return matchesKubernetesSelector(selector, labels)
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
            labels: objectMeta.Labels || data.K8s?.Labels || data.Labels || {},
            annotations: objectMeta.Annotations || data.K8s?.Annotations || data.Annotations || {},
            endpointDataAvailable: false,
            relationshipSource: related.source,
            source: 'TOPOLOGY'
        }
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        if (attrs.href) return <img className="netdive-detail-topology-icon-image" src={attrs.href} alt="" />
        return <span className={`netdive-detail-topology-icon ${attrs.iconClass || ''}`} aria-hidden="true">{attrs.icon}</span>
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

    private openResource(resource?: Node) {
        if (!resource) return
        const app = (window as any).App
        if (app && typeof app.openResourceDetailNodeID === 'function') app.openResourceDetailNodeID(resource.id)
    }

    private openResourceList(resources: Node[]) {
        if (!resources.length) return
        const app = (window as any).App
        if (resources.length === 1 && app && typeof app.openResourceDetailNodeID === 'function') {
            app.openResourceDetailNodeID(resources[0].id)
        } else if (app && typeof app.openKubernetesResourceExplorer === 'function') {
            app.openKubernetesResourceExplorer(resources)
        }
    }

    private scopedResources(types: string[]): Node[] {
        const namespace = firstValue(this.props.node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
        const allowed = new Set(types.map(type => type.toLowerCase()))
        return this.topologyNodes().filter(node => {
            if (!this.sameCluster(node) || !allowed.has(String(node.data?.Type || '').toLowerCase())) return false
            const resourceNamespace = firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
            return !namespace || !resourceNamespace || resourceNamespace === namespace
        })
    }

    private resourceByName(type: string, name: string): Node | undefined {
        if (!name) return undefined
        return this.scopedResources([type]).find(node => firstValue(node.data || {}, ['Name', 'K8s.Name']) === name)
    }

    private workloadTargets(pods: Node[]): Node[] {
        const topologyNodes = this.topologyNodes()
        const results = new Map<string, Node>()
        pods.forEach(pod => {
            const controller = resolveKubernetesPodController(pod, topologyNodes)
            if (controller) results.set(controller.id, controller)
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
                || String(kubernetesLabelValue(labels, 'kubernetes.io/service-name') || '')
            if (relatedService === serviceName) matched.set(node.id, node)
        })
        return Array.from(matched.values())
    }

    private ingressTargets(serviceName: string): Node[] {
        return this.scopedResources(['ingress']).filter(node => {
            const spec = firstRaw(node.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
            const backendNames = new Set<string>()
            const add = (backend: any) => {
                const name = backend?.Service?.Name || backend?.service?.name || backend?.ServiceName || backend?.serviceName
                if (name) backendNames.add(String(name))
            }
            add(spec.DefaultBackend || spec.defaultBackend)
            const rules = spec.Rules || spec.rules
            if (Array.isArray(rules)) rules.forEach((rule: any) => {
                const paths = rule?.HTTP?.Paths || rule?.http?.paths
                if (Array.isArray(paths)) paths.forEach((path: any) => add(path?.Backend || path?.backend))
            })
            return backendNames.has(serviceName)
        })
    }

    private renderPorts(ports: any[]) {
        if (!ports.length) return <CompactEmptyState description={translate('kubernetesServicePortsUnavailable')} compact />
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
                            {podTarget ? <button type="button" onClick={() => this.openResource(podTarget)}>{podName}</button> : <strong>{podName}</strong>}
                        </Tooltip>
                        <DetailStatusIndicator tone={ready ? 'success' : 'danger'}>{ready ? 'Ready' : 'NotReady'}</DetailStatusIndicator>
                    </div>
                    <div className="netdive-k8s-service-detail__endpoint-secondary">
                        <span className="netdive-k8s-service-detail__endpoint-ip"><small>{endpoint.address || translate('kubernetesNotCollected')}</small>{endpoint.address && <DetailCopyButton value={String(endpoint.address)} tooltip={translate('copy')} />}</span>
                        {(endpoint.port || endpoint.protocol) && <span><small>{[endpoint.port, endpoint.protocol].filter(Boolean).join(' / ')}</small></span>}
                    </div>
                    <div className="netdive-k8s-service-detail__endpoint-node">
                        <span>{translate('kubernetesScheduledNodes')}</span>
                        <Tooltip title={nodeName || translate('kubernetesNotCollected')} placement="top">
                            {nodeTarget ? <button type="button" onClick={() => this.openResource(nodeTarget)}>{nodeName}</button> : <b>{nodeName || translate('kubernetesNotCollected')}</b>}
                        </Tooltip>
                    </div>
                    {(endpoint.serving !== undefined || endpoint.terminating !== undefined || endpoint.zone || endpoint.sliceName) && <div className="netdive-k8s-service-detail__endpoint-meta">
                        {endpoint.serving !== undefined && <span>Serving {endpoint.serving ? 'True' : 'False'}</span>}
                        {endpoint.terminating !== undefined && <span>Terminating {endpoint.terminating ? 'True' : 'False'}</span>}
                        {endpoint.zone && <span>Zone {endpoint.zone}</span>}
                        {endpoint.sliceName && <span>Slice {endpoint.sliceName}</span>}
                    </div>}
                </div>
            })}</div>
        }
        const pods = Array.isArray(detail.selectedPods) ? detail.selectedPods : []
        if (!pods.length) return <CompactEmptyState description={translate('kubernetesServiceEndpointsUnavailable')} compact />
        return <div className="netdive-k8s-service-detail__endpoints">{pods.map((pod: any) => {
            const podTarget = this.resourceForReference(pod)
            const nodeTarget = this.resourceByName('node', pod.nodeName)
            return <div className="netdive-k8s-service-detail__endpoint" key={pod.uid || pod.name}>
                <div className="netdive-k8s-service-detail__endpoint-primary">
                    <Tooltip title={pod.name} placement="top">
                        {podTarget ? <button type="button" onClick={() => this.openResource(podTarget)}>{pod.name}</button> : <strong>{pod.name}</strong>}
                    </Tooltip>
                    <DetailStatusIndicator tone={pod.ready === true ? 'success' : pod.ready === false ? 'danger' : 'default'}>{pod.ready === true ? 'Ready' : pod.ready === false ? 'NotReady' : translate('kubernetesUnknown')}</DetailStatusIndicator>
                </div>
                <div className="netdive-k8s-service-detail__endpoint-secondary">
                    <span className="netdive-k8s-service-detail__endpoint-ip"><small>{translate('kubernetesNotCollected')}</small></span>
                </div>
                <div className="netdive-k8s-service-detail__endpoint-node">
                    <span>{translate('kubernetesScheduledNodes')}</span>
                    <Tooltip title={pod.nodeName || translate('kubernetesNotCollected')} placement="top">
                        {nodeTarget ? <button type="button" onClick={() => this.openResource(nodeTarget)}>{pod.nodeName}</button> : <b>{pod.nodeName || translate('kubernetesNotCollected')}</b>}
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
        const ingressTargets = this.ingressTargets(serviceName)
        const basicRows = [
            { label: translate('kubernetesServiceName'), value: <Tooltip title={serviceName} placement="top"><span className="netdive-k8s-service-detail__service-name">{serviceName}</span></Tooltip>, textValue: serviceName, copyText: serviceName },
            { label: translate('kubernetesTopologyNamespaces'), value: displayOptional(detail.namespace) },
            { label: translate('kubernetesServiceType'), value: displayOptional(serviceTypeValue) },
            { label: 'Cluster IP', value: clusterIpValue, textValue: clusterIps.join(', '), copyText: clusterIps[0] }
        ]
        const advancedRows = [
            { label: 'IP Family', value: displayOptional(stringList(detail.ipFamilies).join(', ') || detail.ipFamilyPolicy) },
            { label: KUBERNETES_DETAIL_LABELS.selector, value: <KubernetesSelectorSummary selector={detail.selector} mode="simpleMap" resourceName={serviceName} resourceKind="Service" title="Service 선택자" />, wrap: true },
            { label: translate('kubernetesPublishNotReadyAddresses'), value: detail.publishNotReadyAddresses === undefined ? translate('kubernetesNone') : detail.publishNotReadyAddresses ? translate('yes') : translate('no') },
            { label: translate('kubernetesCreatedAt'), value: detail.createdAt ? new Date(detail.createdAt).toLocaleString() : translate('kubernetesNotCollected') }
        ]
        const recentEventGroups = collectKubernetesEventGroups([
            detail.events,
            detail.recentEvents,
            detail.serviceEvents,
            firstRaw(this.props.node.data || {}, ['K8s.Extra.Events', 'K8s.Events', 'Events'])
        ], SERVICE_EVENT_TONES)
        return <div className="netdive-k8s-service-detail">
            {this.returnClusterNode() && <div className="netdive-k8s-service-detail__return">
                <button type="button" onClick={this.returnToClusterServices}><LeftOutlined />서비스 목록</button>
                <span>{firstValue(this.returnClusterNode()!.data || {}, ['Name', 'K8s.Name', 'ClusterName']) || this.returnClusterNode()!.id}</span>
            </div>}
            <DetailSectionCard icon={<InfoIcon />} title={translate('kubernetesServiceBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <BasicInfoRows density="compact" rows={basicRows} labelWidth={122} copyTooltip={translate('copy')} />
                <DetailAdvancedInfo
                    title={translate('kubernetesAdvancedInformation')}
                    active={this.state.basicInfoAdvanced}
                    onChange={basicInfoAdvanced => this.setState({ basicInfoAdvanced })}>
                    <BasicInfoRows density="compact" rows={advancedRows} labelWidth={122} copyTooltip={translate('copy')} />
                    <KubernetesMetadataRows items={[
                        { key: 'labels', label: KUBERNETES_DETAIL_LABELS.labels, resourceName: serviceName, resourceKind: 'Service', metadataKind: 'label', data: detail.labels, modalTitle: 'Service 라벨' },
                        { key: 'annotations', label: KUBERNETES_DETAIL_LABELS.annotations, resourceName: serviceName, resourceKind: 'Service', metadataKind: 'annotation', data: detail.annotations, modalTitle: 'Service 어노테이션' }
                    ]} />
                </DetailAdvancedInfo>
            </DetailSectionCard>

            <DetailSectionCard icon={this.topologyIcon(this.props.node)} title={translate('kubernetesServiceOperationalStatus')}>
                <StatusSummaryGrid
                    verdict={statusLabel}
                    verdictTone={statusTone as DetailBadgeTone}
                    rawStatus={detail.type || '–'}
                    rawStatusLabel={translate('kubernetesServiceType')}
                    impact={conclusion}
                    impactTooltip={conclusion}
                    metrics={[
                        { key: 'ports', label: translate('kubernetesServicePorts'), value: optionalNumber(detail.ports === undefined ? undefined : ports.length), tooltip: 'Service가 외부에 제공하는 포트 수입니다.' },
                        { key: 'endpoints', label: translate('kubernetesAllEndpoints'), value: endpointKnown ? optionalNumber(endpointCount) : '–', tooltip: '현재 수집된 전체 Endpoint 수입니다.' },
                        { key: 'ready', label: translate('kubernetesReadyEndpoints'), value: readySummary, tone: hasEndpointsWithoutReady ? 'danger' : endpointKnown && Number(readyEndpointCount || 0) < Number(endpointCount || 0) ? 'warning' : 'default', tooltip: '트래픽을 전달할 수 있는 Ready Endpoint 수입니다.' },
                        { key: 'pods', label: translate('kubernetesTargetPods'), value: optionalNumber(detail.selectedPods === undefined ? undefined : pods.length), tooltip: 'Selector 또는 토폴로지 관계로 연결된 Pod 수입니다.' }
                    ]}
                />
            </DetailSectionCard>

            <DetailSectionCard icon={<LinkIcon />} title={translate('kubernetesServiceEndpointAvailability')}>
                <div className="netdive-k8s-service-detail__endpoint-region">
                    <DetailInlineSectionHeader title="Endpoint" />
                    {this.renderEndpoints(detail)}
                </div>
                {availabilityState && <React.Fragment>
                    <div className="netdive-k8s-service-detail__availability-region">
                        <DetailInlineSectionHeader title={translate('kubernetesRiskAvailability')} />
                        <StatusEvidenceList>
                            <StatusEvidenceRow
                                title={availabilityState.title}
                                evidence={availabilityState.description}
                                state={<DetailStatusIndicator tone={availabilityState.tone as DetailBadgeTone}>{availabilityState.tone === 'warning' ? translate('kubernetesAvailabilityWarning') : translate('kubernetesAvailabilityNormal')}</DetailStatusIndicator>}
                                value={readyEndpointCount}
                                valueVariant="number"
                                tone={availabilityState.tone as DetailBadgeTone}
                                tooltip="Ready Endpoint 수를 기준으로 가용성을 판단합니다."
                            />
                            <StatusEvidenceRow
                                title={translate('kubernetesScheduledNodes')}
                                evidence="Ready Endpoint가 분산된 노드 수입니다."
                                state={<DetailStatusIndicator tone={availabilityState.tone as DetailBadgeTone}>{availabilityState.label}</DetailStatusIndicator>}
                                value={uniqueReadyNodeNames.size}
                                valueVariant="number"
                                tone={availabilityState.tone as DetailBadgeTone}
                            />
                        </StatusEvidenceList>
                    </div>
                </React.Fragment>}
            </DetailSectionCard>
            <DetailSectionCard icon={<SettingsEthernetIcon />} title={translate('kubernetesServicePortsTraffic')}>
                {this.renderPorts(ports)}
                <DetailInlineSectionHeader title={translate('kubernetesServiceNetworkExposure')} />
                <BasicInfoRows density="compact" rows={networkRows} labelWidth={122} />
            </DetailSectionCard>
            <RelatedResourceGrid
                icon={<LinkIcon />}
                title={translate('hostConnectedResources')}
                emptyText={translate('hostNoConnectedResources')}
                groups={[{
                    key: 'kubernetes',
                    title: translate('kubernetesConnectedResourceGroup'),
                    icon: <img src="assets/icons/k8s.png" alt="" />,
                    items: [
                        ...(podTargets.length ? [{ key: 'pods', label: translate('kubernetesTopologyPods'), count: podTargets.length, icon: this.topologyIcon(podTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.openResourceList(podTargets) }] : []),
                        ...(workloadTargets.length ? [{ key: 'workloads', label: translate('kubernetesTopologyWorkloadControllers'), count: workloadTargets.length, icon: <DetailLayerIcon glyph={'\uf5fd'} />, iconTone: 'kubernetes' as const, onClick: () => this.openResourceList(workloadTargets) }] : []),
                        ...(nodeTargets.length ? [{ key: 'nodes', label: translate('kubernetesTopologyNodes'), count: nodeTargets.length, icon: this.topologyIcon(nodeTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.openResourceList(nodeTargets) }] : []),
                        ...(endpointSliceTargets.length ? [{ key: 'endpoint-slices', label: 'EndpointSlice', count: endpointSliceTargets.length, icon: this.topologyIcon(endpointSliceTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.openResource(endpointSliceTargets[0]) }] : []),
                        ...(ingressTargets.length ? [{ key: 'ingresses', label: 'Ingress', count: ingressTargets.length, icon: this.topologyIcon(ingressTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.openResource(ingressTargets[0]) }] : [])
                    ]
                }]} />
            <DetailSectionCard icon={<HistoryOutlined />} title={translate('kubernetesServiceRecentEvents')}><KubernetesRecentEvents groups={recentEventGroups} emptyText="최근 발생한 중요 이벤트가 없습니다." onResourceClick={group => {
                const target = this.resourceForReference({ uid: group.resourceUid, name: group.resourceName, kind: group.resourceKind })
                if (target) this.focusResources([target])
            }} /></DetailSectionCard>

            {this.state.error && <div className="netdive-detail-notice"><InfoIcon /><span>{translate('kubernetesServiceDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-detail-notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesServiceDetailPanel
