import * as React from 'react'
import { Tooltip } from 'antd'
import InfoIcon from '@material-ui/icons/Info'
import LinkIcon from '@material-ui/icons/Link'
import LanguageIcon from '@material-ui/icons/Language'
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet'
import { RightOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { DetailBadge, DetailKeyValueList, DetailSection } from './common'
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
    if (value === undefined || value === null || value === '') return '–'
    if (typeof value !== 'object') return String(value)
    return String(value.StrVal || value.strVal || value.IntVal || value.intVal || '–')
}
const stringList = (value: any): string[] => Array.isArray(value) ? value.filter(item => item !== undefined && item !== null && String(item) !== '').map(String) : value ? [String(value)] : []

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

    private renderPorts(ports: any[]) {
        if (!ports.length) return <div className="netdive-k8s-service-detail__empty-row">{translate('kubernetesServicePortsUnavailable')}</div>
        return <div className="netdive-k8s-service-detail__ports">
            <div className="netdive-k8s-service-detail__port-head"><span>{translate('kubernetesPortName')}</span><span>{translate('kubernetesServicePort')}</span><span>Target</span><span>NodePort</span></div>
            {ports.map((port, index) => <div className="netdive-k8s-service-detail__port" key={`${port.Name || port.name || index}:${port.Port || port.port}`}>
                <strong>{port.Name || port.name || '–'}</strong>
                <span>{port.Port ?? port.port ?? '–'} / {port.Protocol || port.protocol || 'TCP'}</span>
                <span>{targetPort(port.TargetPort ?? port.targetPort)}</span>
                <span>{Number(port.NodePort ?? port.nodePort ?? 0) || '–'}</span>
            </div>)}
        </div>
    }

    private renderEndpoints(detail: any) {
        const endpoints = Array.isArray(detail.endpoints) ? detail.endpoints : []
        if (detail.endpointDataAvailable && endpoints.length) {
            return <div className="netdive-k8s-service-detail__endpoints">{endpoints.map((endpoint: any, index: number) => {
                const ready = endpoint.ready === true
                return <div className="netdive-k8s-service-detail__endpoint" key={`${endpoint.address}:${index}`}>
                    <div><strong>{endpoint.podName || endpoint.address}</strong><small>{endpoint.podName ? endpoint.address : endpoint.nodeName || '–'}</small></div>
                    {ready ? <span className="netdive-k8s-node-detail__normal"><i />Ready</span> : <DetailBadge tone="warning">NotReady</DetailBadge>}
                    <b>{endpoint.nodeName || '–'}</b>
                </div>
            })}</div>
        }
        const pods = Array.isArray(detail.selectedPods) ? detail.selectedPods : []
        if (!pods.length) return <div className="netdive-k8s-service-detail__empty-row">{translate('kubernetesServiceEndpointsUnavailable')}</div>
        return <div className="netdive-k8s-service-detail__endpoints">{pods.map((pod: any) => <button type="button" className="netdive-k8s-service-detail__endpoint netdive-k8s-service-detail__endpoint--link" key={pod.uid || pod.name} onClick={() => this.focusResource(pod)}>
            <div><strong>{pod.name}</strong><small>{pod.phase || translate('kubernetesNotCollected')}</small></div>
            {pod.ready === true ? <span className="netdive-k8s-node-detail__normal"><i />Ready</span> : pod.ready === false ? <DetailBadge tone="warning">NotReady</DetailBadge> : <span>–</span>}
            <span className="netdive-k8s-service-detail__endpoint-action"><RightOutlined /></span>
        </button>)}</div>
    }

    render() {
        const detail = this.state.detail || {}
        const endpointKnown = detail.endpointDataAvailable === true
        const endpoints = Array.isArray(detail.endpoints) ? detail.endpoints : []
        const pods = Array.isArray(detail.selectedPods) ? detail.selectedPods : []
        const ports = Array.isArray(detail.ports) ? detail.ports : []
        const selectorKeys = detail.selector && typeof detail.selector === 'object' ? Object.keys(detail.selector) : []
        const hasSelector = selectorKeys.length > 0
        const isExternalName = String(detail.type || '').toLowerCase() === 'externalname'
        const noReady = endpointKnown && !isExternalName && Number(detail.readyEndpointCount || 0) === 0
        const partial = endpointKnown && Number(detail.notReadyEndpointCount || 0) > 0 && Number(detail.readyEndpointCount || 0) > 0
        const inferredReady = !endpointKnown && pods.length > 0 && pods.every((pod: any) => pod.ready === true)
        const inferredProblem = !endpointKnown && pods.some((pod: any) => pod.ready === false || /failed|pending/i.test(String(pod.phase || '')))
        const known = endpointKnown || isExternalName || inferredReady || inferredProblem
        const statusTone = noReady ? 'danger' : partial || inferredProblem ? 'warning' : known ? 'success' : 'default'
        const statusLabel = noReady ? translate('kubernetesHealthCritical') : partial || inferredProblem ? translate('kubernetesHealthWarning') : known ? translate('kubernetesHealthNormal') : translate('kubernetesHealthUnknown')
        const conclusion = noReady
            ? translate('kubernetesServiceNoReadyEndpoints')
            : partial ? translate('kubernetesServicePartialEndpoints')
            : endpointKnown ? translate('kubernetesServiceEndpointsAvailable')
            : isExternalName ? translate('kubernetesServiceExternalNameConfigured')
            : inferredReady ? translate('kubernetesServicePodsReadyInferred')
            : inferredProblem ? translate('kubernetesServicePodsProblemInferred')
            : translate('kubernetesServiceStatusUnavailable')
        const readySummary = endpointKnown ? `${Number(detail.readyEndpointCount || 0)}/${Number(detail.endpointCount || endpoints.length)}` : '–'
        const ingress = Array.isArray(detail.loadBalancerIngress) ? detail.loadBalancerIngress.map((item: any) => item.IP || item.ip || item.Hostname || item.hostname).filter(Boolean) : []
        const networkRows = [
            { label: 'Cluster IP', value: stringList(detail.clusterIps).join(', ') || translate('kubernetesNone'), textValue: stringList(detail.clusterIps).join(', '), copyText: stringList(detail.clusterIps)[0] },
            { label: 'External IP', value: stringList(detail.externalIps).join(', ') || translate('kubernetesNone'), textValue: stringList(detail.externalIps).join(', ') },
            { label: 'LoadBalancer', value: ingress.join(', ') || translate('kubernetesNone'), textValue: ingress.join(', ') },
            { label: 'ExternalName', value: detail.externalName || translate('kubernetesNone'), textValue: detail.externalName },
            { label: translate('kubernetesExternalTrafficPolicy'), value: detail.externalTrafficPolicy || translate('kubernetesNotApplicable') },
            { label: translate('kubernetesInternalTrafficPolicy'), value: detail.internalTrafficPolicy || translate('kubernetesNotCollected') },
            { label: translate('kubernetesSessionAffinity'), value: detail.sessionAffinity || translate('kubernetesNotCollected') }
        ]
        const relationRows = [
            { label: 'Selector', value: hasSelector ? selectorKeys.map(key => `${key}=${detail.selector[key]}`).join(', ') : translate('kubernetesNone'), textValue: hasSelector ? selectorKeys.map(key => `${key}=${detail.selector[key]}`).join(', ') : '' },
            { label: translate('kubernetesRelationshipSource'), value: <DetailBadge tone={detail.relationshipSource === 'ENDPOINT_SLICE' ? 'success' : detail.relationshipSource === 'UNKNOWN' ? 'default' : 'warning'}>{detail.relationshipSource || 'UNKNOWN'}</DetailBadge> },
            { label: translate('kubernetesEndpointData'), value: endpointKnown ? <span className="netdive-k8s-node-detail__normal"><i />{translate('kubernetesCollected')}</span> : <DetailBadge tone="default">{translate('kubernetesNotCollected')}</DetailBadge> },
            { label: translate('kubernetesEndpointNodeDistribution'), value: endpointKnown ? (detail.singleNodeConcentration ? translate('kubernetesSingleNodeConcentration') : translate('kubernetesDistributedOrSingleEndpoint')) : translate('kubernetesEvaluationUnavailable') }
        ]
        const basicRows = [
            { label: translate('kubernetesServiceName'), value: detail.name || this.props.node.id, textValue: detail.name || this.props.node.id, copyText: detail.name || this.props.node.id },
            { label: translate('kubernetesTopologyNamespaces'), value: detail.namespace || translate('kubernetesNotCollected') },
            { label: 'Type', value: detail.type || translate('kubernetesNotCollected') },
            { label: 'IP Family', value: stringList(detail.ipFamilies).join(', ') || detail.ipFamilyPolicy || translate('kubernetesNotCollected') },
            { label: translate('kubernetesPublishNotReadyAddresses'), value: detail.publishNotReadyAddresses === undefined ? translate('kubernetesNotCollected') : detail.publishNotReadyAddresses ? translate('yes') : translate('no') }
        ]
        return <div className="netdive-k8s-node-detail netdive-k8s-service-detail">
            <DetailSection icon={<InfoIcon />} title={translate('kubernetesServiceBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <DetailKeyValueList rows={basicRows} copyTooltip={translate('copy')} />
            </DetailSection>

            <DetailSection icon={this.topologyIcon(this.props.node)} title={translate('kubernetesServiceOperationalStatus')}>
                <div className={`netdive-k8s-node-detail__hero netdive-k8s-node-detail__hero--${statusTone}`}><i /><strong>{statusLabel}</strong><Tooltip title={conclusion} placement="top"><span>{conclusion}</span></Tooltip></div>
                <div className="netdive-k8s-node-detail__summary">
                    <div><span>{translate('kubernetesPorts')}</span><strong>{optionalNumber(detail.ports === undefined ? undefined : ports.length)}</strong></div>
                    <div><span>Endpoint</span><strong>{endpointKnown ? optionalNumber(detail.endpointCount === undefined ? endpoints.length : detail.endpointCount) : '–'}</strong></div>
                    <div><span>Ready</span><strong className={noReady ? 'is-danger' : partial ? 'is-warning' : ''}>{readySummary}</strong></div>
                    <div><span>{translate('kubernetesConnectedPods')}</span><strong>{optionalNumber(detail.selectedPods === undefined ? undefined : pods.length)}</strong></div>
                </div>
            </DetailSection>

            <DetailSection icon={<LinkIcon />} title={translate('kubernetesServiceSelectionAndResilience')}><DetailKeyValueList rows={relationRows} /></DetailSection>
            <DetailSection icon={<LanguageIcon />} title={translate('kubernetesServiceNetworkExposure')}><DetailKeyValueList rows={networkRows} /></DetailSection>
            <DetailSection icon={<LinkIcon />} title={translate('kubernetesServiceEndpoints')}>{this.renderEndpoints(detail)}</DetailSection>
            <DetailSection icon={<SettingsEthernetIcon />} title={translate('kubernetesServicePortsAndRouting')}>{this.renderPorts(ports)}</DetailSection>

            {this.state.error && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesServiceDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesServiceDetailPanel
