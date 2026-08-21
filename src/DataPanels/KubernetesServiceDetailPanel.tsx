import * as React from 'react'
import InfoIcon from '@material-ui/icons/Info'
import LinkIcon from '@material-ui/icons/Link'
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet'
import { HistoryOutlined, LeftOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { kubernetesLabelValue, matchesKubernetesSelector } from '../KubernetesSelectors'
import { resolveKubernetesPodController } from '../KubernetesWorkloadOwnership'
import { aggregateKubernetesServiceOperationalStatus } from '../KubernetesServiceDetailAggregation'
import {
    BasicInfoRows,
    connectedResourcePopoverItems,
    collectKubernetesEventGroups,
    CompactEmptyState,
    DetailAdvancedInfo,
    DetailBadgeTone,
    DetailLongValue,
    DetailInlineSectionHeader,
    DetailLayerIcon,
    DetailSectionCard,
    DetailStatusIndicator,
    KubernetesRecentEvents,
    KubernetesEndpointList,
    KubernetesMetadataRows,
    KubernetesSelectorSummary,
    KUBERNETES_DETAIL_LABELS,
    RelatedResourceGrid,
    StatusEvidenceList,
    StatusEvidenceRow,
    StatusSummaryGrid,
    kubernetesTrafficPolicyLabel
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

    private renderPorts(ports: any[], serviceType: string) {
        if (!ports.length) return <CompactEmptyState description={translate('kubernetesServicePortsUnavailable')} compact />
        const nodePortApplicable = ['nodeport', 'loadbalancer'].indexOf(String(serviceType || '').toLowerCase()) >= 0
        return <BasicInfoRows density="compact" labelWidth={122} rows={ports.map((port, index) => {
            const servicePort = port.Port ?? port.port
            const nodePort = Number(port.NodePort ?? port.nodePort ?? 0)
            const parts = [
                `서비스 ${servicePort === undefined || servicePort === null || servicePort === '' ? translate('kubernetesNone') : `${servicePort}/${port.Protocol || port.protocol || 'TCP'}`}`,
                `대상 ${targetPort(port.TargetPort ?? port.targetPort) || translate('kubernetesNone')}`,
                ...(nodePortApplicable ? [`NodePort ${nodePort || '해당 없음'}`] : [])
            ]
            return {
                key: `${port.Name || port.name || index}:${servicePort}`,
                label: port.Name || port.name || `포트 ${index + 1}`,
                value: parts.join(' · '),
                wrap: true
            }
        })} />
    }

    private renderEndpoints(detail: any) {
        const endpoints = Array.isArray(detail.endpoints) ? detail.endpoints : []
        return <KubernetesEndpointList
            collected={detail.endpointDataAvailable === true}
            endpoints={endpoints.map((endpoint: any) => ({
                ...endpoint,
                targetKind: endpoint.targetKind || endpoint.targetRef?.kind || endpoint.targetRef?.Kind || (endpoint.podName ? 'Pod' : undefined),
                targetName: endpoint.targetName || endpoint.podName || endpoint.targetRef?.name || endpoint.targetRef?.Name
            }))}
            isTargetClickable={endpoint => !!this.resourceForReference({ uid: (endpoint as any).targetUid || (endpoint as any).podUid, kind: endpoint.targetKind, name: endpoint.targetName || endpoint.podName })}
            isNodeClickable={endpoint => !!this.resourceByName('node', String(endpoint.nodeName || ''))}
            onTargetClick={endpoint => {
                const target = this.resourceForReference({ uid: (endpoint as any).targetUid || (endpoint as any).podUid, kind: endpoint.targetKind, name: endpoint.targetName || endpoint.podName })
                if (target) this.openResource(target)
            }}
            onNodeClick={endpoint => {
                const target = this.resourceByName('node', String(endpoint.nodeName || ''))
                if (target) this.openResource(target)
            }} />
    }

    render() {
        const detail = this.state.detail || {}
        const endpointKnown = detail.endpointDataAvailable === true
        const endpoints = Array.isArray(detail.endpoints) ? detail.endpoints : []
        const pods = Array.isArray(detail.selectedPods) ? detail.selectedPods : []
        const ports = Array.isArray(detail.ports) ? detail.ports : []
        const operational = aggregateKubernetesServiceOperationalStatus(detail)
        const endpointCount = operational.endpointCount
        const readyEndpointCount = operational.readyEndpointCount
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
            ...(stringList(detail.externalIps).length ? [{ label: 'External IP', value: normalizedList(detail.externalIps), textValue: stringList(detail.externalIps).join(', ') }] : []),
            ...(ingress.length ? [{ label: 'LoadBalancer', value: normalizedList(ingress), textValue: ingress.join(', ') }] : []),
            ...(detail.externalName ? [{ label: 'ExternalName', value: displayOptional(detail.externalName), textValue: detail.externalName }] : []),
            ...(detail.externalTrafficPolicy ? [{ label: translate('kubernetesExternalTrafficPolicy'), value: kubernetesTrafficPolicyLabel(detail.externalTrafficPolicy), tooltip: 'Service 외부 트래픽이 전달될 수 있는 노드 범위를 나타냅니다.', tooltipRawValue: detail.externalTrafficPolicy }] : []),
            { label: translate('kubernetesInternalTrafficPolicy'), value: kubernetesTrafficPolicyLabel(detail.internalTrafficPolicy || 'Cluster'), tooltip: '클러스터 내부 트래픽이 전달될 수 있는 Endpoint 범위를 나타냅니다.', tooltipRawValue: detail.internalTrafficPolicy || 'Cluster' },
            { label: translate('kubernetesSessionAffinity'), value: displayOptional(detail.sessionAffinity) }
        ]
        const podTargets = pods.map((reference: any) => this.resourceForReference(reference)).filter((resource: Node | undefined): resource is Node => !!resource)
        const workloadTargets = this.workloadTargets(podTargets)
        const endpointSliceTargets = this.endpointSliceTargets(detail)
        const endpointSliceReferences = Array.isArray(detail.endpointSlices) ? detail.endpointSlices : []
        const serviceName = String(detail.name || this.props.node.id)
        const ingressTargets = this.ingressTargets(serviceName)
        const ingressReferences = Array.isArray(detail.ingresses) ? detail.ingresses : []
        const basicRows = [
            { label: translate('kubernetesServiceName'), value: <DetailLongValue value={serviceName} maxLines={2} />, copyText: serviceName },
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
        ], SERVICE_EVENT_TONES, { combineSources: true, sinceMs: 60 * 60 * 1000, fallbackResourceKind: 'Service', fallbackResourceName: serviceName, fallbackResourceUid: detail.uid })
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
                    verdict={operational.verdict}
                    verdictTone={operational.tone as DetailBadgeTone}
                    rawStatus={detail.type || '–'}
                    rawStatusLabel={translate('kubernetesServiceType')}
                    rawStatusTooltip="Kubernetes Service가 트래픽을 노출하는 방식을 나타냅니다."
                    impact={operational.impact}
                    impactTooltip={operational.impactDescription}
                    metrics={[
                        { key: 'problems', label: '현재 문제', value: operational.currentProblemCount === undefined ? '확인 불가' : operational.currentProblemCount, tone: Number(operational.currentProblemCount || 0) > 0 ? 'danger' : 'default', tooltip: 'Ready가 아닌 Endpoint 수를 기준으로 현재 문제를 집계합니다. Endpoint 자체가 없으면 제공 대상 없음 1건으로 표시합니다.' },
                        { key: 'ready', label: 'Ready Endpoint', value: operational.readySummary, tone: operational.tone === 'danger' ? 'danger' : endpointKnown && Number(readyEndpointCount || 0) < Number(endpointCount || 0) ? 'warning' : 'default', tooltip: operational.selectorlessDirectEndpoints ? 'Pod selector 없이 직접 Endpoint 주소로 트래픽을 제공하는 Service입니다.' : '전체 Endpoint 중 현재 트래픽을 전달할 수 있는 Ready Endpoint 수입니다.' }
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
                {this.renderPorts(ports, String(detail.type || ''))}
                <DetailInlineSectionHeader title={translate('kubernetesServiceNetworkExposure')} />
                <BasicInfoRows density="compact" rows={networkRows} labelWidth={122} />
            </DetailSectionCard>
            <RelatedResourceGrid
                icon={<LinkIcon />}
                title={translate('hostConnectedResources')}
                emptyText={detail.endpointDataAvailable === true && detail.podRelationshipAvailable === true && detail.ingressRelationshipAvailable === true
                    ? '실제 Kubernetes 관계로 확인된 연결 자원이 없습니다.'
                    : '연결 자원 관계가 모두 수집되지 않았습니다.'}
                groups={[{
                    key: 'kubernetes',
                    items: [
                        ...(pods.length ? [{ key: 'pods', label: translate('kubernetesTopologyPods'), count: pods.length, icon: podTargets.length ? this.topologyIcon(podTargets[0]) : <img src="assets/icons/k8s.png" alt="" />, iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(podTargets, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), onClick: podTargets.length ? () => this.openResourceList(podTargets) : undefined }] : []),
                        ...(workloadTargets.length ? [{ key: 'workloads', label: translate('kubernetesTopologyWorkloadControllers'), count: workloadTargets.length, icon: <DetailLayerIcon glyph={'\uf5fd'} />, iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(workloadTargets, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), onClick: () => this.openResourceList(workloadTargets) }] : []),
                        ...(endpointSliceReferences.length ? [{ key: 'endpoint-slices', label: 'EndpointSlice', count: endpointSliceReferences.length, icon: endpointSliceTargets.length ? this.topologyIcon(endpointSliceTargets[0]) : <img src="assets/icons/k8s.png" alt="" />, iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(endpointSliceTargets, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), onClick: endpointSliceTargets.length ? () => this.openResourceList(endpointSliceTargets) : undefined }] : []),
                        ...(ingressReferences.length ? [{ key: 'ingresses', label: 'Ingress', count: ingressReferences.length, icon: ingressTargets.length ? this.topologyIcon(ingressTargets[0]) : <img src="assets/icons/k8s.png" alt="" />, iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(ingressTargets, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), onClick: ingressTargets.length ? () => this.openResourceList(ingressTargets) : undefined }] : [])
                    ]
                }]} />
            <DetailSectionCard icon={<HistoryOutlined />} title={translate('kubernetesServiceRecentEvents')}><KubernetesRecentEvents
                groups={recentEventGroups}
                lookbackLabel={detail.eventDataAvailable === true || recentEventGroups.length ? '최근 1시간' : undefined}
                emptyText={detail.eventDataAvailable === true || recentEventGroups.length ? undefined : '최근 이벤트 데이터가 수집되지 않았습니다.'}
                onResourceClick={group => {
                const target = this.resourceForReference({ uid: group.resourceUid, name: group.resourceName, kind: group.resourceKind })
                if (target) this.focusResources([target])
            }} /></DetailSectionCard>

            {this.state.error && <div className="netdive-detail-notice"><InfoIcon /><span>{translate('kubernetesServiceDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-detail-notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesServiceDetailPanel
