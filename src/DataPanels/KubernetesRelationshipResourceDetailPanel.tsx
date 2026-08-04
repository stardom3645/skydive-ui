import * as React from 'react'
import InfoIcon from '@material-ui/icons/Info'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import SecurityIcon from '@material-ui/icons/Security'
import SettingsIcon from '@material-ui/icons/Settings'

import { Node } from '../Topology'
import { kubernetesLabelValue, matchesKubernetesSelector } from '../KubernetesSelectors'
import { BasicInfoRows, ConnectedResourceListSection, DetailAdvancedInfo, DetailSectionCard } from './common'
import './KubernetesRelationshipResourceDetailPanel.css'

interface Props {
    node: Node
}

const valueAtPath = (data: any, path: string): any =>
    path.split('.').reduce((value, key) => value === undefined || value === null ? undefined : value[key], data)

const firstRaw = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const value = valueAtPath(data, path)
        if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return undefined
}

const displayValue = (value: any): string => {
    if (value === undefined || value === null || value === '') return '정보 없음'
    if (Array.isArray(value)) return value.length ? value.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ') : '없음'
    if (typeof value === 'object') return Object.keys(value).length
        ? Object.keys(value).map(key => `${key}=${typeof value[key] === 'object' ? JSON.stringify(value[key]) : value[key]}`).join(', ')
        : '없음'
    return String(value)
}

const firstValue = (data: any, paths: string[]): string => displayValue(firstRaw(data, paths))
const resourceName = (node: Node): string => firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'])
const resourceNamespace = (node: Node): string => firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
const resourceType = (node: Node): string => String(node.data?.Type || '').toLowerCase()

const topologyNodes = (): Node[] => {
    const nodes = (window as any).App?.tc?.nodes
    return nodes instanceof Map ? Array.from(nodes.values()) : Array.isArray(nodes) ? nodes : []
}

const sameScope = (source: Node, candidate: Node): boolean => {
    const sourceCluster = firstValue(source.data || {}, ['ClusterName', 'K8s.ClusterName', 'Cluster'])
    const targetCluster = firstValue(candidate.data || {}, ['ClusterName', 'K8s.ClusterName', 'Cluster'])
    const sourceNamespace = resourceNamespace(source)
    const targetNamespace = resourceNamespace(candidate)
    return (sourceCluster === '정보 없음' || targetCluster === '정보 없음' || sourceCluster === targetCluster)
        && (sourceNamespace === '정보 없음' || targetNamespace === '정보 없음' || sourceNamespace === targetNamespace)
}

const ingressBackends = (spec: any): Array<{ service: string, port: string, host: string, path: string, pathType: string }> => {
    const result: Array<{ service: string, port: string, host: string, path: string, pathType: string }> = []
    const readBackend = (backend: any, host = '', path = '', pathType = '') => {
        const service = backend?.Service?.Name || backend?.service?.name || backend?.ServiceName || backend?.serviceName
        const port = backend?.Service?.Port?.Name || backend?.Service?.Port?.Number
            || backend?.service?.port?.name || backend?.service?.port?.number || backend?.ServicePort || backend?.servicePort
        if (service) result.push({ service: String(service), port: displayValue(port), host, path: path || '/', pathType: pathType || '정보 없음' })
    }
    readBackend(spec?.DefaultBackend || spec?.defaultBackend)
    const rules = spec?.Rules || spec?.rules
    if (Array.isArray(rules)) rules.forEach((rule: any) => {
        const host = String(rule?.Host || rule?.host || '')
        const paths = rule?.HTTP?.Paths || rule?.http?.paths
        if (Array.isArray(paths)) paths.forEach((item: any) =>
            readBackend(item?.Backend || item?.backend, host, item?.Path || item?.path, item?.PathType || item?.pathType))
    })
    return result
}

const selectorMatches = (selector: any, labels: any): boolean => {
    return matchesKubernetesSelector(selector, labels)
}

const iconFor = (node: Node) => {
    const type = resourceType(node)
    const imageByType: Record<string, string> = {
        ingress: 'ingress.png',
        endpoints: 'endpoints.png',
        endpointslice: 'endpoints.png',
        configmap: 'configmap.png',
        secret: 'secret.png',
        networkpolicy: 'networkpolicy.png'
    }
    return imageByType[type]
        ? <img src={`assets/icons/${imageByType[type]}`} alt="" />
        : <AccountTreeIcon />
}

const openResource = (node: Node) => {
    const app = (window as any).App
    if (app && typeof app.openResourceDetailNodeID === 'function') app.openResourceDetailNodeID(node.id)
}

const connectedItems = (resources: Node[], kind: string) => resources.map(resource => ({
    key: resource.id,
    name: resourceName(resource),
    description: resourceNamespace(resource) === '정보 없음' ? undefined : resourceNamespace(resource),
    icon: iconFor(resource),
    tooltip: `${kind} · ${resourceName(resource)}`,
    onClick: () => openResource(resource)
}))

const KubernetesRelationshipResourceDetailPanel = ({ node }: Props) => {
    const [basicCollapsed, setBasicCollapsed] = React.useState(false)
    const [basicInfoAdvanced, setBasicInfoAdvanced] = React.useState(false)
    React.useEffect(() => {
        setBasicCollapsed(false)
        setBasicInfoAdvanced(false)
    }, [node.id])
    const data = node.data || {}
    const type = resourceType(node)
    const spec = firstRaw(data, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
    const status = firstRaw(data, ['K8s.Extra.Status', 'K8s.Status', 'Status']) || {}
    const labels = firstRaw(data, ['K8s.Labels', 'K8s.Extra.ObjectMeta.Labels', 'Labels']) || {}
    const annotations = firstRaw(data, ['K8s.Annotations', 'K8s.Extra.ObjectMeta.Annotations', 'Annotations']) || {}
    const kindLabels: Record<string, string> = {
        ingress: 'Ingress',
        endpoints: 'Endpoint',
        endpointslice: 'EndpointSlice',
        configmap: 'ConfigMap',
        secret: 'Secret',
        serviceaccount: 'ServiceAccount',
        networkpolicy: 'NetworkPolicy',
        horizontalpodautoscaler: 'HPA',
        hpa: 'HPA',
        poddisruptionbudget: 'PDB',
        pdb: 'PDB'
    }
    const kind = kindLabels[type] || String(data.Type || 'Kubernetes Resource')
    const allNodes = topologyNodes()
    const scoped = (types: string[]) => allNodes.filter(candidate => sameScope(node, candidate) && types.indexOf(resourceType(candidate)) >= 0)
    const backends = type === 'ingress' ? ingressBackends(spec) : []
    const backendNames = new Set(backends.map(item => item.service))
    const backendServices = type === 'ingress' ? scoped(['service']).filter(service => backendNames.has(resourceName(service))) : []
    const podLabels = (candidate: Node) => firstRaw(candidate.data || {}, ['K8s.Labels', 'K8s.Extra.ObjectMeta.Labels', 'Labels']) || {}
    const policyTargets = type === 'networkpolicy'
        ? scoped(['pod']).filter(candidate => selectorMatches(spec.PodSelector || spec.podSelector, podLabels(candidate)))
        : []
    const hpaTarget = ['horizontalpodautoscaler', 'hpa'].indexOf(type) >= 0
        ? scoped(['deployment', 'statefulset', 'daemonset']).filter(candidate =>
            resourceName(candidate) === String(spec?.ScaleTargetRef?.Name || spec?.scaleTargetRef?.name || ''))
        : []
    const pdbTargets = ['poddisruptionbudget', 'pdb'].indexOf(type) >= 0
        ? scoped(['pod']).filter(candidate => selectorMatches(spec.Selector || spec.selector, podLabels(candidate)))
        : []
    const referencedBy = ['configmap', 'secret'].indexOf(type) >= 0
        ? scoped(['pod', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob']).filter(candidate =>
            JSON.stringify(firstRaw(candidate.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}).indexOf(resourceName(node)) >= 0)
        : []
    const serviceAccountBindings = type === 'serviceaccount'
        ? allNodes.filter(candidate => ['rolebinding', 'clusterrolebinding'].indexOf(resourceType(candidate)) >= 0
            && JSON.stringify(firstRaw(candidate.data || {}, ['K8s.Extra.Subjects', 'K8s.Extra.Spec.Subjects', 'Subjects']) || [])
                .indexOf(resourceName(node)) >= 0)
        : []

    const baseRows = [
        { label: '이름', value: resourceName(node), textValue: resourceName(node), copyText: resourceName(node) },
        { label: '종류', value: kind },
        { label: '네임스페이스', value: resourceNamespace(node) }
    ]
    const advancedRows = [
        { label: '생성 시간', value: firstValue(data, ['K8s.Extra.ObjectMeta.CreationTimestamp.Time', 'K8s.Extra.ObjectMeta.CreationTimestamp', 'CreatedAt']) },
        { label: 'Labels', value: displayValue(labels) },
        { label: 'Annotations', value: displayValue(annotations) }
    ]

    let detailRows: any[] = []
    if (type === 'ingress') {
        detailRows = [
            { label: 'Ingress Class', value: displayValue(spec.IngressClassName || spec.ingressClassName) },
            { label: 'LoadBalancer Address', value: displayValue(status?.LoadBalancer?.Ingress || status?.loadBalancer?.ingress) },
            { label: 'TLS', value: displayValue(spec.TLS || spec.tls) },
            { label: 'Host', value: displayValue(backends.map(item => item.host).filter(Boolean)) },
            { label: 'Path / Path Type', value: displayValue(backends.map(item => `${item.path} · ${item.pathType}`)) },
            { label: 'Backend Service / Port', value: displayValue(backends.map(item => `${item.service} · ${item.port}`)) }
        ]
    } else if (type === 'endpointslice' || type === 'endpoints') {
        const endpointData = firstRaw(data, ['K8s.Extra.Endpoints', 'K8s.Endpoints', 'Endpoints', 'K8s.Extra.Subsets']) || []
        detailRows = [
            { label: 'Service', value: kubernetesLabelValue(labels, 'kubernetes.io/service-name') || (type === 'endpoints' ? resourceName(node) : '정보 없음') },
            { label: 'Address Type', value: displayValue(spec.AddressType || spec.addressType) },
            { label: 'Endpoint', value: Array.isArray(endpointData) ? endpointData.length : '정보 없음' },
            { label: 'Port / Protocol', value: displayValue(firstRaw(data, ['K8s.Extra.Ports', 'K8s.Ports', 'Ports'])) }
        ]
    } else if (type === 'configmap' || type === 'secret') {
        const stored = firstRaw(data, ['K8s.Extra.Data', 'K8s.Data', 'Data']) || {}
        detailRows = [
            ...(type === 'secret' ? [{ label: 'Secret Type', value: firstValue(data, ['K8s.Extra.Type', 'K8s.Type', 'TypeName']) }] : []),
            { label: 'Key 목록', value: Object.keys(stored).join(', ') || '없음' },
            ...(type === 'secret' ? [{ label: '값', value: '보안 정책에 따라 표시하지 않음' }] : [])
        ]
    } else if (type === 'serviceaccount') {
        detailRows = [
            { label: 'Automount Token', value: displayValue(spec.AutomountServiceAccountToken ?? spec.automountServiceAccountToken) },
            { label: 'ImagePullSecrets', value: displayValue(firstRaw(data, ['K8s.Extra.ImagePullSecrets', 'K8s.ImagePullSecrets', 'ImagePullSecrets'])) },
            { label: 'RoleBinding', value: serviceAccountBindings.length || '없음' }
        ]
    } else if (type === 'networkpolicy') {
        detailRows = [
            { label: '표현 범위', value: '정책 정의 (실제 차단 여부를 판정하지 않음)' },
            { label: 'Pod Selector', value: displayValue(spec.PodSelector || spec.podSelector) },
            { label: 'Policy Type', value: displayValue(spec.PolicyTypes || spec.policyTypes) },
            { label: 'Ingress Rule', value: Array.isArray(spec.Ingress || spec.ingress) ? (spec.Ingress || spec.ingress).length : 0 },
            { label: 'Egress Rule', value: Array.isArray(spec.Egress || spec.egress) ? (spec.Egress || spec.egress).length : 0 }
        ]
    } else if (['horizontalpodautoscaler', 'hpa'].indexOf(type) >= 0) {
        detailRows = [
            { label: '대상 Workload', value: displayValue(spec?.ScaleTargetRef?.Name || spec?.scaleTargetRef?.name) },
            { label: 'Min / Max Replicas', value: `${displayValue(spec.MinReplicas ?? spec.minReplicas)} / ${displayValue(spec.MaxReplicas ?? spec.maxReplicas)}` },
            { label: 'Current / Desired', value: `${displayValue(status.CurrentReplicas ?? status.currentReplicas)} / ${displayValue(status.DesiredReplicas ?? status.desiredReplicas)}` },
            { label: 'Target Metric', value: displayValue(spec.Metrics || spec.metrics) },
            { label: 'Current Metric', value: displayValue(status.CurrentMetrics || status.currentMetrics) },
            { label: 'Last Scale Time', value: displayValue(status.LastScaleTime?.Time || status.lastScaleTime) },
            { label: 'Condition', value: displayValue(status.Conditions || status.conditions) }
        ]
    } else if (['poddisruptionbudget', 'pdb'].indexOf(type) >= 0) {
        detailRows = [
            { label: 'Min Available', value: displayValue(spec.MinAvailable ?? spec.minAvailable) },
            { label: 'Max Unavailable', value: displayValue(spec.MaxUnavailable ?? spec.maxUnavailable) },
            { label: 'Current / Desired Healthy', value: `${displayValue(status.CurrentHealthy ?? status.currentHealthy)} / ${displayValue(status.DesiredHealthy ?? status.desiredHealthy)}` },
            { label: 'Disruptions Allowed', value: displayValue(status.DisruptionsAllowed ?? status.disruptionsAllowed) },
            { label: 'Expected Pods', value: displayValue(status.ExpectedPods ?? status.expectedPods) },
            { label: 'Condition', value: displayValue(status.Conditions || status.conditions) }
        ]
    }

    const relatedGroups = [
        ...(backendServices.length ? [{ key: 'backend', title: 'Backend Service', items: connectedItems(backendServices, 'Service') }] : []),
        ...(policyTargets.length ? [{ key: 'policy-targets', title: '적용 대상 파드', items: connectedItems(policyTargets, 'Pod') }] : []),
        ...(hpaTarget.length ? [{ key: 'hpa-target', title: '스케일링 대상', items: connectedItems(hpaTarget, 'Workload') }] : []),
        ...(pdbTargets.length ? [{ key: 'pdb-targets', title: '보호 대상 파드', items: connectedItems(pdbTargets, 'Pod') }] : []),
        ...(referencedBy.length ? [{ key: 'references', title: '참조 리소스', items: connectedItems(referencedBy, 'Resource') }] : []),
        ...(serviceAccountBindings.length ? [{ key: 'bindings', title: '권한 바인딩', items: connectedItems(serviceAccountBindings, 'Binding') }] : [])
    ]

    return (
        <div className="netdive-k8s-relationship-detail">
            <DetailSectionCard icon={<InfoIcon />} title={`${kind} 기본 정보`} collapsible collapsed={basicCollapsed} onToggle={() => setBasicCollapsed(!basicCollapsed)}>
                <BasicInfoRows density="compact" rows={baseRows} labelWidth={122} copyTooltip="복사" />
                <DetailAdvancedInfo title="고급 정보" active={basicInfoAdvanced} onChange={setBasicInfoAdvanced}>
                    <BasicInfoRows density="compact" rows={advancedRows} labelWidth={122} copyTooltip="복사" />
                </DetailAdvancedInfo>
            </DetailSectionCard>
            {detailRows.length > 0 && (
                <DetailSectionCard icon={type === 'networkpolicy' || type === 'serviceaccount' ? <SecurityIcon /> : <SettingsIcon />} title={`${kind} 구성`}>
                    <BasicInfoRows density="compact" rows={detailRows} labelWidth={122} />
                </DetailSectionCard>
            )}
            <ConnectedResourceListSection
                icon={<AccountTreeIcon />}
                title="연결 자원"
                emptyText="연결된 Kubernetes 자원이 없습니다."
                groups={relatedGroups} />
        </div>
    )
}

export default KubernetesRelationshipResourceDetailPanel
