import * as React from 'react'
import { Tooltip } from 'antd'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'
import ViewModuleIcon from '@material-ui/icons/ViewModule'
import { HistoryOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { getPodClassification } from '../KubernetesPodLifecycle'
import { kubernetesLabelValue, matchesKubernetesSelector } from '../KubernetesSelectors'
import { collectKubernetesEventGroups, ConnectedResourceListSection, DetailBadge, DetailKeyValueList, DetailSection, KubernetesRecentEvents, KubernetesStateSeparation } from './common'
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
const POD_EVENT_TONES = {
    failedscheduling: 'warning' as const,
    crashloopbackoff: 'warning' as const,
    backoff: 'warning' as const,
    oomkilled: 'warning' as const,
    failedmount: 'warning' as const,
    imagepullbackoff: 'warning' as const,
    errimagepull: 'warning' as const,
    evicted: 'warning' as const,
    unhealthy: 'warning' as const,
    killing: 'warning' as const
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
            return matchesKubernetesSelector(selector, labels)
        }).map(node => ({ uid: node.id, name: firstValue(node.data || {}, ['Name', 'K8s.Name']) || node.id, kind: 'Service' }))
    }

    private resourceName(node: Node): string {
        return firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) || node.id
    }

    private resourceNamespace(node: Node): string {
        return firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
    }

    private ingressServiceNames(node: Node): Set<string> {
        const names = new Set<string>()
        const spec = firstRaw(node.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
        const addBackend = (backend: any) => {
            const name = backend?.Service?.Name
                || backend?.service?.name
                || backend?.ServiceName
                || backend?.serviceName
            if (name) names.add(String(name))
        }
        addBackend(spec.DefaultBackend || spec.defaultBackend)
        const rules = spec.Rules || spec.rules
        if (Array.isArray(rules)) {
            rules.forEach((rule: any) => {
                const paths = rule?.HTTP?.Paths || rule?.http?.paths
                if (Array.isArray(paths)) paths.forEach((path: any) => addBackend(path?.Backend || path?.backend))
            })
        }
        return names
    }

    private endpointSliceServiceName(node: Node): string {
        const labels = firstRaw(node.data || {}, ['K8s.Labels', 'K8s.Extra.ObjectMeta.Labels', 'Labels']) || {}
        return String(
            kubernetesLabelValue(labels, 'kubernetes.io/service-name')
            || kubernetesLabelValue(labels, 'k8s.io/service-name')
            || ''
        )
    }

    private endpointSliceTargetsPod(node: Node, podUid: string, podName: string): boolean {
        const endpoints = firstRaw(node.data || {}, ['K8s.Extra.Endpoints', 'K8s.Endpoints', 'Endpoints'])
        if (!Array.isArray(endpoints)) return false
        return endpoints.some((endpoint: any) => {
            const target = endpoint?.TargetRef || endpoint?.targetRef
            const uid = String(target?.UID || target?.uid || '')
            const name = String(target?.Name || target?.name || '')
            return (!!podUid && uid === podUid) || (!!podName && name === podName)
        })
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
            reason: status.Reason || firstValue(data, ['K8s.Extra.Status.Reason', 'Reason']),
            statusMessage: status.Message || firstValue(data, ['K8s.Extra.Status.Message', 'Message']),
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

    private resourceForReference(reference: any): Node | undefined {
        const uid = reference?.uid || reference?.UID
        const kind = String(reference?.kind || reference?.Kind || '').toLowerCase()
        const name = typeof reference === 'string' ? reference : reference?.name || reference?.Name
        const resource = this.topologyNodes().find(node => {
            if (!this.sameCluster(node)) return false
            if (uid && (node.id === uid || firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) === uid)) return true
            return kind && String(node.data?.Type || '').toLowerCase() === kind && firstValue(node.data || {}, ['Name', 'K8s.Name']) === name
        })
        if (resource) return resource
        if (['replicaset', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(kind) < 0) return undefined
        let parent = this.props.node.parent
        while (parent) {
            if (['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(String(parent.data?.Type || '').toLowerCase()) >= 0) return parent
            parent = parent.parent
        }
        return undefined
    }

    private openResource(reference: any) {
        const resource = this.resourceForReference(reference)
        const app = (window as any).App
        if (resource && app && typeof app.openResourceDetailNodeID === 'function') app.openResourceDetailNodeID(resource.id)
    }

    private openResourceNode(resource: Node) {
        const app = (window as any).App
        if (app && typeof app.openResourceDetailNodeID === 'function') app.openResourceDetailNodeID(resource.id)
    }

    private scopedResources(types: string[], namespace?: string): Node[] {
        const allowed = new Set(types.map(type => type.toLowerCase()))
        return this.topologyNodes().filter(node => {
            if (!this.sameCluster(node) || !allowed.has(String(node.data?.Type || '').toLowerCase())) return false
            const resourceNamespace = this.resourceNamespace(node)
            return !namespace || !resourceNamespace || resourceNamespace === namespace
        })
    }

    private resourceByName(types: string[], name: string, namespace?: string): Node | undefined {
        if (!name) return undefined
        return this.scopedResources(types, namespace).find(node => this.resourceName(node) === name)
    }

    private podSpec(): any {
        return firstRaw(this.props.node.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
    }

    private referencedConfiguration(spec: any, namespace: string, type: 'configmap' | 'secret'): Node[] {
        const names = new Set<string>()
        const add = (value: any) => { if (value) names.add(String(value)) }
        const volumes = Array.isArray(spec?.Volumes) ? spec.Volumes : Array.isArray(spec?.volumes) ? spec.volumes : []
        volumes.forEach((volume: any) => {
            const source = volume?.VolumeSource || volume
            if (type === 'configmap') add(source?.ConfigMap?.LocalObjectReference?.Name || source?.ConfigMap?.Name || source?.configMap?.name)
            else add(source?.Secret?.SecretName || source?.Secret?.Name || source?.secret?.secretName)
        })
        const containers = ([] as any[]).concat(spec?.InitContainers || spec?.initContainers || [], spec?.Containers || spec?.containers || [])
        containers.forEach(container => {
            ;(container?.EnvFrom || container?.envFrom || []).forEach((source: any) => {
                if (type === 'configmap') add(source?.ConfigMapRef?.LocalObjectReference?.Name || source?.ConfigMapRef?.Name || source?.configMapRef?.name)
                else add(source?.SecretRef?.LocalObjectReference?.Name || source?.SecretRef?.Name || source?.secretRef?.name)
            })
            ;(container?.Env || container?.env || []).forEach((env: any) => {
                const valueFrom = env?.ValueFrom || env?.valueFrom
                if (type === 'configmap') add(valueFrom?.ConfigMapKeyRef?.LocalObjectReference?.Name || valueFrom?.ConfigMapKeyRef?.Name || valueFrom?.configMapKeyRef?.name)
                else add(valueFrom?.SecretKeyRef?.LocalObjectReference?.Name || valueFrom?.SecretKeyRef?.Name || valueFrom?.secretKeyRef?.name)
            })
        })
        return this.scopedResources([type], namespace).filter(node => names.has(this.resourceName(node)))
    }

    private selectorMatches(selector: any, labels: any): boolean {
        return matchesKubernetesSelector(selector, labels)
    }

    private boundStorageResources(pvcs: Node[]): { pvs: Node[], storageClasses: Node[] } {
        const pvNames = new Set<string>()
        const storageClassNames = new Set<string>()
        pvcs.forEach(pvc => {
            const data = pvc.data || {}
            const volumeName = firstValue(data, ['K8s.Extra.Spec.VolumeName', 'K8s.Spec.VolumeName', 'Spec.VolumeName'])
            const storageClassName = firstValue(data, ['K8s.Extra.Spec.StorageClassName', 'K8s.Spec.StorageClassName', 'Spec.StorageClassName'])
            if (volumeName) pvNames.add(volumeName)
            if (storageClassName) storageClassNames.add(storageClassName)
        })
        const pvs = this.scopedResources(['persistentvolume']).filter(node => pvNames.has(this.resourceName(node)))
        pvs.forEach(pv => {
            const storageClassName = firstValue(pv.data || {}, ['K8s.Extra.Spec.StorageClassName', 'K8s.Spec.StorageClassName', 'Spec.StorageClassName'])
            if (storageClassName) storageClassNames.add(storageClassName)
        })
        const storageClasses = this.scopedResources(['storageclass']).filter(node => storageClassNames.has(this.resourceName(node)))
        return { pvs, storageClasses }
    }

    private connectedListItems(resources: Node[], kind: string) {
        return resources.map(resource => ({
            key: resource.id,
            name: this.resourceName(resource),
            description: this.resourceNamespace(resource) || firstValue(resource.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Status', 'Status']) || undefined,
            icon: this.topologyIcon(resource),
            tooltip: `${kind} · ${this.resourceName(resource)}`,
            onClick: () => this.openResourceNode(resource)
        }))
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
            const probes = [container.livenessProbeConfigured && 'Liveness', container.readinessProbeConfigured && 'Readiness', container.startupProbeConfigured && 'Startup'].filter(Boolean).join(' · ')
            return <div className={`netdive-k8s-pod-detail__container ${problem ? 'is-problem' : ''}`} key={`${container.type}:${container.name}`}>
                <div className="netdive-k8s-pod-detail__container-main"><strong>{container.name}</strong><span>{container.type}</span></div>
                <div className="netdive-k8s-pod-detail__container-state">{problem ? <DetailBadge tone={reason === 'OOMKilled' || container.state === 'TERMINATED' ? 'danger' : 'warning'}>{stateLabel}</DetailBadge> : <span className="netdive-k8s-node-detail__normal"><i />{stateLabel === 'RUNNING' ? 'Running' : stateLabel}</span>}</div>
                <div className="netdive-k8s-pod-detail__container-restarts"><span>{translate('kubernetesRestarts')}</span><strong className={Number(container.restartCount || 0) > 0 ? 'is-warning' : ''}>{optionalNumber(container.restartCount)}</strong></div>
                <Tooltip title={container.image || ''} placement="top"><small>{container.image || translate('kubernetesNotCollected')}</small></Tooltip>
                {probes && <small className="netdive-k8s-pod-detail__container-meta">{translate('kubernetesConfiguredProbes')} {probes}</small>}
            </div>
        })}</div>
    }

    private renderContainerResources(detail: any) {
        if (!Array.isArray(detail.containers) || !detail.containers.length) return null
        return <div className="netdive-k8s-pod-detail__resources">{detail.containers.map((container: any) => <div key={`${container.type}:${container.name}`}>
            <strong>{container.name}</strong>
            <dl>
                <div><dt>CPU Requests</dt><dd>{container.cpuRequest || '–'}</dd></div>
                <div><dt>CPU Limits</dt><dd>{container.cpuLimit || '–'}</dd></div>
                <div><dt>Memory Requests</dt><dd>{container.memoryRequest || '–'}</dd></div>
                <div><dt>Memory Limits</dt><dd>{container.memoryLimit || '–'}</dd></div>
            </dl>
        </div>)}</div>
    }

    render() {
        const detail = this.state.detail || {}
        const phase = String(detail.phase || '').toLowerCase()
        const podClassification = getPodClassification(this.props.node)
        const evicted = podClassification.evicted
        const ready = this.readyCondition(detail)
        const containers = Array.isArray(detail.containers) ? detail.containers : []
        const readyContainers = containers.filter((container: any) => container.ready).length
        const problemContainers = containers.filter((container: any) => {
            const completed = phase === 'succeeded' && container.state === 'TERMINATED' && (!container.terminatedReason || container.terminatedReason === 'Completed')
            return !completed && (container.state !== 'RUNNING' || !container.ready || container.waitingReason)
        })
        const critical = podClassification.problemPod && problemContainers.some((container: any) => container.terminatedReason === 'OOMKilled')
        const warning = podClassification.problemPod && !critical
        const known = !!phase
        const statusTone = evicted ? 'default' : critical ? 'danger' : warning ? 'warning' : known ? 'success' : 'default'
        const statusLabel = evicted ? '종료됨' : critical ? translate('kubernetesHealthCritical') : warning ? translate('kubernetesHealthWarning') : known ? translate('kubernetesHealthNormal') : translate('kubernetesHealthUnknown')
        const conclusion = evicted
            ? 'Evicted로 종료된 파드입니다. 현재 영향은 대체 파드 상태를 기준으로 확인합니다.'
            : critical
            ? translate('kubernetesPodCriticalConclusion')
            : warning ? translate('kubernetesPodWarningConclusion')
            : known ? translate('kubernetesPodNoCurrentImpact') : translate('kubernetesPodStatusUnavailable')
        const selectedServices = Array.isArray(detail.selectedByServices) ? detail.selectedByServices : []
        const replacementPods = evicted ? this.topologyNodes().filter(node => {
            if (node.id === this.props.node.id || !this.sameCluster(node) || String(node.data?.Type || '').toLowerCase() !== 'pod') return false
            if (firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) !== detail.namespace) return false
            const owners = firstRaw(node.data || {}, ['K8s.Extra.ObjectMeta.OwnerReferences'])
            return Array.isArray(owners) && owners.some(owner => (detail.ownerUid && owner?.UID === detail.ownerUid) || (detail.ownerName && owner?.Name === detail.ownerName))
        }).filter(node => {
            const status = getPodClassification(node)
            return status.runningPod && !status.problemPod
        }) : []
        const currentImpact = selectedServices.length > 0 && replacementPods.length === 0
        const serviceTargets = selectedServices.map((reference: any) => this.resourceForReference(
            typeof reference === 'string' ? { name: reference, kind: 'service' } : reference
        )).filter((resource: Node | undefined): resource is Node => !!resource)
        const pvcNames = new Set<string>(Array.isArray(detail.pvcReferences) ? detail.pvcReferences.map(String) : [])
        const pvcTargets = this.topologyNodes().filter(node => this.sameCluster(node)
            && String(node.data?.Type || '').toLowerCase() === 'persistentvolumeclaim'
            && firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) === detail.namespace
            && pvcNames.has(firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'])))
        const spec = this.podSpec()
        const podVolumes = Array.isArray(spec.Volumes) ? spec.Volumes : Array.isArray(spec.volumes) ? spec.volumes : []
        const podContainers = ([] as any[]).concat(spec.InitContainers || spec.initContainers || [], spec.Containers || spec.containers || [])
        const volumeDetailRows = podVolumes.map((volume: any) => {
            const volumeName = String(volume.Name || volume.name || '')
            const source = volume.VolumeSource || volume
            const claimName = String(source?.PersistentVolumeClaim?.ClaimName || source?.persistentVolumeClaim?.claimName || '')
            const claim = claimName ? pvcTargets.find(item => this.resourceName(item) === claimName) : undefined
            const mountPaths = podContainers.reduce((paths: string[], container: any) => {
                const mounts = container?.VolumeMounts || container?.volumeMounts || []
                mounts.forEach((mount: any) => {
                    if (String(mount.Name || mount.name || '') === volumeName) {
                        const path = String(mount.MountPath || mount.mountPath || '')
                        if (path) paths.push(path)
                    }
                })
                return paths
            }, [])
            const storageClass = claim ? firstValue(claim.data || {}, ['K8s.Extra.Spec.StorageClassName', 'K8s.Spec.StorageClassName', 'Spec.StorageClassName']) : ''
            const boundPV = claim ? firstValue(claim.data || {}, ['K8s.Extra.Spec.VolumeName', 'K8s.Spec.VolumeName', 'Spec.VolumeName']) : ''
            const accessModes = claim ? firstValue(claim.data || {}, ['K8s.Extra.Spec.AccessModes', 'K8s.Spec.AccessModes', 'Spec.AccessModes']) : ''
            const capacity = claim ? firstValue(claim.data || {}, ['K8s.Extra.Status.Capacity.storage', 'K8s.Status.Capacity.storage', 'K8s.Extra.Spec.Resources.Requests.storage']) : ''
            const phase = claim ? firstValue(claim.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Status', 'Status']) : ''
            return {
                label: volumeName || translate('kubernetesVolumes'),
                value: [
                    claimName ? `PVC ${claimName}` : '',
                    mountPaths.length ? `Mount ${Array.from(new Set(mountPaths)).join(', ')}` : '',
                    accessModes ? `Access ${accessModes}` : '',
                    storageClass ? `StorageClass ${storageClass}` : '',
                    boundPV ? `PV ${boundPV}` : '',
                    [capacity, phase].filter(Boolean).join(' · ')
                ].filter(Boolean).join(' · ') || translate('kubernetesInformationUnavailable')
            }
        })
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
        const recentEventGroups = collectKubernetesEventGroups([
            detail.events,
            detail.recentEvents,
            detail.podEvents,
            firstRaw(this.props.node.data || {}, ['K8s.Extra.Events', 'K8s.Events', 'Events'])
        ], POD_EVENT_TONES)
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
                {evicted && <KubernetesStateSeparation items={[
                    { key: 'terminated', label: '종료 상태', value: '종료됨', tone: 'history', tooltip: '이 파드는 실행 중인 객체가 아닙니다.' },
                    { key: 'reason', label: '원본 상태', value: 'Evicted', tone: 'history', tooltip: detail.statusMessage || 'Kubernetes 원본 종료 사유입니다.' },
                    { key: 'impact', label: '현재 영향 여부', value: currentImpact ? '확인 필요' : '없음', tone: currentImpact ? 'danger' : 'success', tooltip: '연결 서비스와 대체 파드의 현재 상태를 기준으로 판단합니다.' },
                    { key: 'replacement', label: '대체 파드 상태', value: replacementPods.length ? `Running ${replacementPods.length}` : '확인되지 않음', tone: replacementPods.length ? 'success' : 'default' }
                ]} />}
            </DetailSection>

            <DetailSection icon={<ViewModuleIcon />} title={translate('kubernetesContainerStatus')}>
                {this.renderContainers(detail)}
                <div className="netdive-k8s-node-detail__subsection-title">{translate('kubernetesPodConditions')}</div>
                {this.renderConditions(detail)}
            </DetailSection>
            <DetailSection icon={<StorageIcon />} title={translate('kubernetesPodResources')}>
                {this.renderContainerResources(detail)}
                <div className="netdive-k8s-node-detail__subsection-title">QoS</div>
                <DetailKeyValueList rows={[{ label: 'QoS Class', value: detail.qosClass || translate('kubernetesNotCollected') }]} />
            </DetailSection>
            <DetailSection icon={<StorageIcon />} title={translate('kubernetesPodVolumesAndNetwork')}>
                <DetailKeyValueList rows={volumeDetailRows.length ? volumeDetailRows : storageRows.slice(0, 2)} />
            </DetailSection>
            <ConnectedResourceListSection
                icon={<AccountTreeIcon />}
                title={translate('hostConnectedResources')}
                emptyText={translate('hostNoConnectedResources')}
                groups={[
                    {
                        key: 'services',
                        title: 'Service',
                        items: this.connectedListItems(serviceTargets, 'Service')
                    }
                ]} />
            {recentEventGroups.length > 0 && <DetailSection icon={<HistoryOutlined />} title={translate('kubernetesPodRecentEvents')}><KubernetesRecentEvents groups={recentEventGroups} onResourceClick={group => this.openResource({ uid: group.resourceUid, name: group.resourceName, kind: group.resourceKind })} /></DetailSection>}

            {this.state.error && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesPodDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-k8s-node-detail__notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesPodDetailPanel
