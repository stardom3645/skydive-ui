import * as React from 'react'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'
import ViewModuleIcon from '@material-ui/icons/ViewModule'
import { HistoryOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { session } from '../Store'
import { Node } from '../Topology'
import { getPodClassification, registerKubernetesPodCurrentStatusDetail } from '../KubernetesPodLifecycle'
import { kubernetesLabelValue, matchesKubernetesSelector } from '../KubernetesSelectors'
import { kubernetesOperationalPodDataset } from '../KubernetesNodeDetailAggregation'
import { resolveKubernetesPodTopController } from '../KubernetesWorkloadOwnership'
import {
    kubernetesPodContainerKindLabel,
    kubernetesPodContainerRuntime,
    kubernetesPodPhaseLabel,
    kubernetesPodVolumePresentations,
    mergeKubernetesPodDetail
} from '../KubernetesPodDetailAggregation'
import {
    BasicInfoRows,
    collectKubernetesEventGroups,
    ConnectedResourceListSection,
    DetailAdvancedInfo,
    DetailBadgeTone,
    DetailLongValue,
    DetailSectionCard,
    KubernetesConditionRows,
    KubernetesContainerDetails,
    kubernetesContainerStateReason,
    KubernetesMetadataRows,
    KubernetesRecentEvents,
    KubernetesStateSeparation,
    KubernetesVolumeList,
    POD_CONDITION_DEFINITIONS,
    StatusSummaryGrid
} from './common'
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
    basicInfoAdvanced: boolean
}

const valueByPath = (data: any, path: string): any => path.split('.').reduce((result, key) => result === undefined || result === null ? undefined : result[key], data)
const firstRaw = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const result = valueByPath(data, path)
        if (result !== undefined && result !== null && String(result).trim() !== '') return result
    }
    return undefined
}
const firstValue = (data: any, paths: string[]): string => {
    const result = firstRaw(data, paths)
    if (result === undefined || result === null) return ''
    return typeof result === 'object' ? JSON.stringify(result) : String(result)
}
const list = (value: any): any[] => Array.isArray(value) ? value : []
const objectName = (value: any): string => String(value?.Name ?? value?.name ?? '')
const containerState = (status: any) => {
    const state = status?.State ?? status?.state ?? {}
    const running = state.Running ?? state.running
    const waiting = state.Waiting ?? state.waiting
    const terminated = state.Terminated ?? state.terminated
    if (running) return { state: 'RUNNING', waitingReason: '', terminatedReason: '', exitCode: undefined, startedAt: running.StartedAt ?? running.startedAt }
    if (waiting) return { state: 'WAITING', waitingReason: waiting.Reason ?? waiting.reason ?? '', terminatedReason: '', exitCode: undefined }
    if (terminated) return { state: 'TERMINATED', waitingReason: '', terminatedReason: terminated.Reason ?? terminated.reason ?? '', exitCode: terminated.ExitCode ?? terminated.exitCode, startedAt: terminated.StartedAt ?? terminated.startedAt, finishedAt: terminated.FinishedAt ?? terminated.finishedAt }
    return { state: 'UNKNOWN', waitingReason: '', terminatedReason: '', exitCode: undefined }
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
            firstValue(data, ['Cluster', 'ClusterName', 'clusterName', 'K8s.ClusterName'])
        ].map(item => String(item || '').toLowerCase()).filter(Boolean)
        return (props.kubernetesClusters || []).find(cluster => [cluster?.id, cluster?.name].map(item => String(item || '').toLowerCase()).some(item => keys.indexOf(item) >= 0))
    }

    private cluster() { return this.clusterFrom(this.props) }
    private uid() { return firstValue(this.props.node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID', 'uid']) || this.props.node.id }

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
            if (this.state.requestKey === requestKey) {
                registerKubernetesPodCurrentStatusDetail(detail)
                this.setState({ detail: mergeKubernetesPodDetail(fallback, detail), loading: false, error: false })
            }
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
        const selected = firstValue(this.props.node.data || {}, ['ClusterName', 'K8s.ClusterName'])
        return !selected || firstValue(node.data || {}, ['ClusterName', 'K8s.ClusterName']) === selected
    }

    private resourceName(node: Node) { return firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) || node.id }
    private resourceNamespace(node: Node) { return firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) }
    private resourceUID(node: Node) { return firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) || node.id }
    private resourceType(node: Node) { return String(node.data?.Type || '').toLowerCase() }
    private podSpec() { return firstRaw(this.props.node.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {} }

    private selectedServices(labels: any, namespace: string, podUid: string, podName: string): any[] {
        const serviceNamesFromSlices = new Set<string>()
        this.topologyNodes().forEach(node => {
            if (!this.sameCluster(node) || this.resourceType(node) !== 'endpointslice' || this.resourceNamespace(node) !== namespace) return
            const endpoints = list(firstRaw(node.data || {}, ['K8s.Extra.Endpoints', 'K8s.Endpoints', 'Endpoints']))
            const targetsPod = endpoints.some(endpoint => {
                const target = endpoint?.TargetRef ?? endpoint?.targetRef
                return String(target?.UID ?? target?.uid ?? '') === podUid || String(target?.Name ?? target?.name ?? '') === podName
            })
            if (!targetsPod) return
            const sliceLabels = firstRaw(node.data || {}, ['K8s.Labels', 'K8s.Extra.ObjectMeta.Labels', 'Labels']) || {}
            const serviceName = kubernetesLabelValue(sliceLabels, 'kubernetes.io/service-name') || kubernetesLabelValue(sliceLabels, 'k8s.io/service-name')
            if (serviceName) serviceNamesFromSlices.add(String(serviceName))
        })
        return this.topologyNodes().filter(node => {
            if (!this.sameCluster(node) || this.resourceType(node) !== 'service' || this.resourceNamespace(node) !== namespace) return false
            const selector = firstRaw(node.data || {}, ['K8s.Extra.Spec.Selector', 'K8s.Selector', 'Selector'])
            return serviceNamesFromSlices.has(this.resourceName(node)) || (!!selector && matchesKubernetesSelector(selector, labels || {}))
        }).map(node => ({ uid: this.resourceUID(node), name: this.resourceName(node), kind: 'Service' }))
    }

    private detailFromTopology(): any {
        const data = this.props.node.data || {}
        const extra = firstRaw(data, ['K8s.Extra']) || {}
        const objectMeta = extra.ObjectMeta || {}
        const spec = extra.Spec || {}
        const status = extra.Status || {}
        const namespace = firstValue(data, ['K8s.Namespace', 'Namespace']) || objectMeta.Namespace
        const labels = data.K8s?.Labels || objectMeta.Labels || {}
        const conditions = list(status.Conditions).map(condition => ({
            type: condition.Type ?? condition.type,
            status: condition.Status ?? condition.status,
            reason: condition.Reason ?? condition.reason,
            message: condition.Message ?? condition.message,
            lastProbeTime: condition.LastProbeTime?.Time ?? condition.LastProbeTime ?? condition.lastProbeTime,
            lastTransitionTime: condition.LastTransitionTime?.Time ?? condition.LastTransitionTime ?? condition.lastTransitionTime
        }))
        const specs: Array<{ container: any, type: string }> = []
        list(spec.InitContainers ?? spec.initContainers).forEach(container => specs.push({ container, type: 'INIT' }))
        list(spec.Containers ?? spec.containers).forEach(container => specs.push({ container, type: 'APPLICATION' }))
        list(spec.EphemeralContainers ?? spec.ephemeralContainers).forEach(container => specs.push({ container, type: 'EPHEMERAL' }))
        const statuses = new Map<string, any>()
        list(status.InitContainerStatuses ?? status.initContainerStatuses).forEach(item => statuses.set(`INIT:${objectName(item)}`, item))
        list(status.ContainerStatuses ?? status.containerStatuses).forEach(item => statuses.set(`APPLICATION:${objectName(item)}`, item))
        list(status.EphemeralContainerStatuses ?? status.ephemeralContainerStatuses).forEach(item => statuses.set(`EPHEMERAL:${objectName(item)}`, item))
        const containers: any[] = specs.map(item => {
            const name = objectName(item.container)
            const containerStatus = statuses.get(`${item.type}:${name}`) || {}
            statuses.delete(`${item.type}:${name}`)
            const state = containerState(containerStatus)
            const resources = item.container.Resources ?? item.container.resources ?? {}
            return {
                name,
                type: item.type,
                image: containerStatus.Image ?? containerStatus.image ?? item.container.Image ?? item.container.image,
                imageId: containerStatus.ImageID ?? containerStatus.imageID,
                containerId: containerStatus.ContainerID ?? containerStatus.containerID,
                ready: containerStatus.Ready ?? containerStatus.ready,
                started: containerStatus.Started ?? containerStatus.started,
                restartCount: Number(containerStatus.RestartCount ?? containerStatus.restartCount ?? 0),
                ...state,
                lastTerminatedReason: containerStatus.LastTerminationState?.Terminated?.Reason ?? containerStatus.lastState?.terminated?.reason,
                resources,
                resourcesCollected: true,
                pullPolicy: item.container.ImagePullPolicy ?? item.container.imagePullPolicy,
                ports: list(item.container.Ports ?? item.container.ports),
                volumeMounts: list(item.container.VolumeMounts ?? item.container.volumeMounts),
                livenessProbeConfigured: !!(item.container.LivenessProbe ?? item.container.livenessProbe),
                readinessProbeConfigured: !!(item.container.ReadinessProbe ?? item.container.readinessProbe),
                startupProbeConfigured: !!(item.container.StartupProbe ?? item.container.startupProbe)
            }
        })
        statuses.forEach((containerStatus, key) => {
            const type = key.split(':')[0]
            const state = containerState(containerStatus)
            containers.push({
                name: objectName(containerStatus), type,
                image: containerStatus.Image ?? containerStatus.image,
                ready: containerStatus.Ready ?? containerStatus.ready,
                restartCount: Number(containerStatus.RestartCount ?? containerStatus.restartCount ?? 0),
                ...state,
                resources: {}, resourcesCollected: false
            })
        })
        const owners = list(objectMeta.OwnerReferences)
        const podVolumes = list(spec.Volumes ?? spec.volumes)
        const pvcReferences = podVolumes.map(volume => {
            const source = volume.VolumeSource ?? volume
            return source?.PersistentVolumeClaim?.ClaimName ?? source?.persistentVolumeClaim?.claimName
        }).filter(Boolean)
        const nodeName = spec.NodeName ?? spec.nodeName ?? firstValue(data, ['K8s.Node', 'NodeName'])
        const node = this.topologyNodes().find(item => this.sameCluster(item) && this.resourceType(item) === 'node' && this.resourceName(item) === nodeName)
        const podUid = String(objectMeta.UID || this.props.node.id)
        const podName = firstValue(data, ['Name', 'K8s.Name']) || objectMeta.Name || this.props.node.id
        return {
            uid: podUid,
            name: podName,
            namespace,
            phase: status.Phase || firstValue(data, ['K8s.Status', 'Status']),
            reason: status.Reason || firstValue(data, ['K8s.Extra.Status.Reason', 'Reason']),
            statusMessage: status.Message || firstValue(data, ['K8s.Extra.Status.Message', 'Message']),
            podIp: status.PodIP || firstValue(data, ['K8s.IP', 'IP']),
            hostIp: status.HostIP,
            nodeName,
            qosClass: status.QOSClass,
            createdAt: objectMeta.CreationTimestamp?.Time ?? objectMeta.CreationTimestamp ?? objectMeta.creationTimestamp,
            startTime: status.StartTime?.Time ?? status.StartTime ?? status.startTime,
            ownerKind: owners[0]?.Kind ?? owners[0]?.kind,
            ownerName: owners[0]?.Name ?? owners[0]?.name,
            ownerUid: owners[0]?.UID ?? owners[0]?.uid,
            conditions,
            restartCount: containers.reduce((total, container) => total + Number(container.restartCount || 0), 0),
            volumes: podVolumes.map(objectName).filter(Boolean),
            pvcReferences,
            containers,
            selectedByServices: this.selectedServices(labels, namespace, podUid, podName),
            node: node ? { uid: this.resourceUID(node), name: nodeName, kind: 'Node' } : nodeName ? { name: nodeName, kind: 'Node' } : undefined,
            labels,
            annotations: data.K8s?.Annotations || objectMeta.Annotations || {},
            source: 'TOPOLOGY'
        }
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        if (attrs.href) return <img className="netdive-detail-topology-icon-image" src={attrs.href} alt="" />
        return <span className={`netdive-detail-topology-icon ${attrs.iconClass || ''}`} aria-hidden="true">{attrs.icon}</span>
    }

    private resourceForReference(reference: any): Node | undefined {
        const uid = reference?.uid ?? reference?.UID
        const name = typeof reference === 'string' ? reference : reference?.name ?? reference?.Name
        const kind = String(reference?.kind ?? reference?.Kind ?? '').toLowerCase()
        return this.topologyNodes().find(node => this.sameCluster(node) && (
            (!!uid && this.resourceUID(node) === String(uid))
            || (!!name && (!kind || this.resourceType(node) === kind) && this.resourceName(node) === String(name))
        ))
    }

    private openResource(reference: any) {
        const target = reference && (reference as Node).data ? reference as Node : this.resourceForReference(reference)
        const app = (window as any).App
        if (target && app && typeof app.openResourceDetailNodeID === 'function') app.openResourceDetailNodeID(target.id)
    }

    private connectedListItems(resources: Node[], kind: string) {
        return resources.map(resource => ({
            key: resource.id,
            name: this.resourceName(resource),
            description: this.resourceNamespace(resource) || undefined,
            icon: this.topologyIcon(resource),
            tooltip: `${kind} · ${this.resourceName(resource)}`,
            onClick: () => this.openResource(resource)
        }))
    }

    private serviceTargets(detail: any): Node[] {
        const references = list(detail.selectedByServices)
        const found = references.map(reference => this.resourceForReference(typeof reference === 'string' ? { name: reference, kind: 'Service' } : reference)).filter((item): item is Node => !!item)
        return Array.from(found.reduce((result, item) => result.set(this.resourceUID(item), item), new Map<string, Node>()).values())
    }

    private pvcTargets(detail: any): Node[] {
        const names = new Set(list(detail.pvcReferences).map(String))
        return this.topologyNodes().filter(node => this.sameCluster(node)
            && this.resourceType(node) === 'persistentvolumeclaim'
            && this.resourceNamespace(node) === detail.namespace
            && names.has(this.resourceName(node)))
    }

    render() {
        const detail = this.state.detail || {}
        const phase = String(detail.phase || '').toLowerCase()
        const phaseLabel = kubernetesPodPhaseLabel(detail.phase)
        const classification = getPodClassification(this.props.node)
        const operational = kubernetesOperationalPodDataset([this.props.node])
        const containers = list(detail.containers)
        const applicationContainers = containers.filter(container => String(container.type || '').toUpperCase() === 'APPLICATION')
        const initContainers = containers.filter(container => String(container.type || '').toUpperCase() === 'INIT')
        const readyContainers = applicationContainers.filter(container => container.ready === true).length
        const containerPresentations = containers.map(container => {
            const runtime = kubernetesPodContainerRuntime(container)
            const ports = list(container.ports).map(port => {
                if (typeof port === 'string') return port
                const number = port?.ContainerPort ?? port?.containerPort
                const protocol = port?.Protocol ?? port?.protocol ?? 'TCP'
                const name = port?.Name ?? port?.name
                return number === undefined ? '' : `${name ? `${name} · ` : ''}${number}/${protocol}`
            }).filter(Boolean)
            const reason = kubernetesContainerStateReason(container)
            const has = (key: string) => Object.prototype.hasOwnProperty.call(container, key)
            const resources = container.resources || {
                Requests: {
                    ...(has('cpuRequest') ? { cpu: container.cpuRequest } : {}),
                    ...(has('memoryRequest') ? { memory: container.memoryRequest } : {})
                },
                Limits: {
                    ...(has('cpuLimit') ? { cpu: container.cpuLimit } : {}),
                    ...(has('memoryLimit') ? { memory: container.memoryLimit } : {})
                }
            }
            return {
                key: `${container.type || 'APPLICATION'}:${container.name}`,
                name: container.name || '이름 없음',
                kindLabel: kubernetesPodContainerKindLabel(container.type),
                image: container.image || translate('kubernetesImageUnavailable'),
                pullPolicy: container.pullPolicy,
                ports,
                resources,
                resourcesCollected: container.resourcesCollected === undefined
                    ? !this.state.error || ['cpuRequest', 'cpuLimit', 'memoryRequest', 'memoryLimit'].some(has)
                    : !!container.resourcesCollected,
                runtime: {
                    label: runtime.label,
                    tone: runtime.tone,
                    readyLabel: runtime.readyLabel,
                    restartCount: Number(container.restartCount || 0),
                    reason,
                    exitCode: container.exitCode
                }
            }
        })
        const problemContainers = containers.filter(container => !kubernetesPodContainerRuntime(container).healthy && !(String(container.type).toUpperCase() === 'INIT' && container.state === 'TERMINATED' && Number(container.exitCode) === 0))
        const recentRestart = operational.recentRestartPods.length > 0
        const evicted = classification.evicted
        const currentProblem = classification.problemPod || problemContainers.length > 0
        const critical = problemContainers.some(container => /oomkilled|crashloopbackoff|imagepullbackoff|errimagepull/i.test(String(container.waitingReason || container.terminatedReason || '')))
        const statusTone: DetailBadgeTone = evicted ? 'default' : critical ? 'danger' : currentProblem ? 'warning' : phase ? 'success' : 'default'
        const statusLabel = evicted ? '종료됨' : critical ? '위험' : currentProblem ? '주의' : phase ? '정상' : '미확인'
        const readyCondition = list(detail.conditions).find(condition => String(condition.type ?? condition.Type).toLowerCase() === 'ready')
        const podReady = readyCondition ? String(readyCondition.status ?? readyCondition.Status).toLowerCase() === 'true' : undefined
        const terminalPod = phase === 'succeeded' || evicted
        const currentImpact = terminalPod
            ? '실행 대상 아님'
            : podReady === false || critical ? '가용성 영향 확인 필요' : '확인된 가용성 영향 없음'
        const currentImpactTooltip = terminalPod
            ? '완료되었거나 종료된 파드이므로 현재 실행 대상의 가용성 영향 판정에서 제외합니다.'
            : podReady === false || critical
                ? `파드 준비 상태와 현재 컨테이너 이상을 확인해야 합니다. 일반 컨테이너 ${readyContainers}/${applicationContainers.length}개가 준비되었습니다.`
                : `현재 파드 상태로 인해 확인된 서비스 가용성 영향이 없습니다. 일반 컨테이너 ${readyContainers}/${applicationContainers.length}개가 준비되었습니다.`
        const basicRows = [
            { label: '파드 이름', value: <DetailLongValue value={detail.name || this.props.node.id} copy />, wrap: true },
            { label: '네임스페이스', value: detail.namespace || translate('kubernetesNotCollected') },
            { label: 'Pod IP', value: detail.podIp || translate('kubernetesNotCollected'), copyText: detail.podIp },
            { label: '생성 시간', value: detail.createdAt ? new Date(detail.createdAt).toLocaleString() : translate('kubernetesNotCollected') },
            { label: '배치 노드', value: detail.nodeName ? <DetailLongValue value={String(detail.nodeName)} copy /> : translate('kubernetesNotCollected'), wrap: true }
        ]
        const advancedRows = [
            { label: 'Host IP', value: detail.hostIp || translate('kubernetesNotCollected'), copyText: detail.hostIp },
            { label: 'QoS 등급', value: detail.qosClass || translate('kubernetesNotCollected') },
            { label: '시작 시간', value: detail.startTime ? new Date(detail.startTime).toLocaleString() : translate('kubernetesNotCollected') }
        ]
        const topController = resolveKubernetesPodTopController(this.props.node, this.topologyNodes())
        const directOwner = !topController && detail.ownerName ? this.resourceForReference({ uid: detail.ownerUid, name: detail.ownerName, kind: detail.ownerKind }) : undefined
        const nodeTarget = detail.node ? this.resourceForReference(detail.node) : undefined
        const services = this.serviceTargets(detail)
        const pvcs = this.pvcTargets(detail)
        const volumePresentations = kubernetesPodVolumePresentations(
            this.podSpec(),
            containers,
            !this.state.loading && !this.state.error
        )
        const recentEventGroups = collectKubernetesEventGroups([
            detail.events,
            detail.recentEvents,
            detail.podEvents,
            firstRaw(this.props.node.data || {}, ['K8s.Extra.Events', 'K8s.Events', 'Events'])
        ], POD_EVENT_TONES)
        return <div className="netdive-k8s-pod-detail">
            <DetailSectionCard icon={<InfoIcon />} title="파드 기본 정보" collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <BasicInfoRows density="compact" rows={basicRows} labelWidth={122} copyTooltip={translate('copy')} />
                <DetailAdvancedInfo title={translate('kubernetesAdvancedInformation')} active={this.state.basicInfoAdvanced} onChange={basicInfoAdvanced => this.setState({ basicInfoAdvanced })}>
                    <BasicInfoRows density="compact" rows={advancedRows} labelWidth={122} copyTooltip={translate('copy')} />
                    <KubernetesMetadataRows items={[
                        { key: 'labels', label: '라벨', resourceName: detail.name || this.props.node.id, resourceKind: 'Pod', metadataKind: 'label', data: detail.labels, modalTitle: 'Pod 라벨' },
                        { key: 'annotations', label: '어노테이션', resourceName: detail.name || this.props.node.id, resourceKind: 'Pod', metadataKind: 'annotation', data: detail.annotations, modalTitle: 'Pod 어노테이션' }
                    ]} />
                </DetailAdvancedInfo>
            </DetailSectionCard>

            <DetailSectionCard icon={this.topologyIcon(this.props.node)} title="Pod 운영 상태">
                <StatusSummaryGrid
                    verdict={statusLabel}
                    verdictTone={statusTone}
                    rawStatus={phaseLabel}
                    rawStatusLabel="파드 상태"
                    rawStatusTooltip={`Kubernetes Pod phase를 사용자용 상태로 변환한 값입니다. 원본 Phase: ${detail.phase || '확인 불가'}`}
                    impact={currentImpact}
                    impactTooltip={currentImpactTooltip}
                    metrics={[
                        { key: 'container-ready', label: '준비 컨테이너', value: terminalPod ? '해당 없음' : applicationContainers.length ? `${readyContainers}/${applicationContainers.length}` : '확인 불가', tone: !terminalPod && readyContainers < applicationContainers.length ? 'warning' : 'default', tooltip: '일반 컨테이너만 대상으로 Ready 상태인 수를 계산합니다. 초기화 컨테이너는 별도로 구분합니다.' },
                        { key: 'pod-ready', label: '준비 상태', value: terminalPod ? '해당 없음' : podReady === undefined ? '미확인' : podReady ? '준비됨' : '준비되지 않음', tone: !terminalPod && podReady === false ? 'danger' : 'default', tooltip: 'Pod Ready Condition을 사용자용 상태로 해석한 결과입니다.' }
                    ]} />
                <KubernetesStateSeparation items={[
                    { key: 'current', label: '현재 문제', value: currentProblem ? `${problemContainers.length || 1}건 확인` : '없음', tone: currentProblem ? (critical ? 'danger' : 'warning') : 'success', tooltip: '현재 phase, Ready 상태, 대기·종료 사유를 기준으로 판단합니다.' },
                    { key: 'recent', label: '최근 불안정성', value: recentRestart ? '최근 재시작 감지' : '없음', tone: recentRestart ? 'warning' : 'success', tooltip: '최근 1시간 내 종료 시각 또는 재시작 시각이 확인된 경우만 운영 경고로 사용합니다.' },
                    { key: 'history', label: '누적 재시작 이력', value: `${Number(detail.restartCount || 0)}회`, tone: 'history', tooltip: 'Pod 생성 이후 컨테이너 restartCount의 누적 합계이며 현재 장애 판정에는 사용하지 않습니다.' }
                ]} />
            </DetailSectionCard>

            <DetailSectionCard icon={<ViewModuleIcon />} title="컨테이너 및 이미지">
                <KubernetesContainerDetails containers={containerPresentations} summaryItems={initContainers.length ? [{ key: 'init', label: '초기화 컨테이너', value: `${initContainers.filter(container => kubernetesPodContainerRuntime(container).healthy).length}/${initContainers.length} 완료` }] : undefined} />
            </DetailSectionCard>

            {list(detail.conditions).length > 0 && <DetailSectionCard icon={<InfoIcon />} title="파드 상태 조건">
                <KubernetesConditionRows conditions={detail.conditions} definitions={POD_CONDITION_DEFINITIONS} showRawValue={false} />
            </DetailSectionCard>}

            {volumePresentations.length > 0 && <DetailSectionCard icon={<StorageIcon />} title="볼륨">
                <KubernetesVolumeList resourceKind="Pod" resourceName={detail.name || this.props.node.id} volumes={volumePresentations} />
            </DetailSectionCard>}

            <ConnectedResourceListSection
                icon={<AccountTreeIcon />}
                title={translate('hostConnectedResources')}
                emptyText={translate('hostNoConnectedResources')}
                groups={[
                    { key: 'workload', title: '상위 워크로드', items: this.connectedListItems(topController ? [topController] : directOwner ? [directOwner] : [], topController ? this.resourceType(topController) : detail.ownerKind || 'Controller') },
                    { key: 'node', title: '배치 노드', items: this.connectedListItems(nodeTarget ? [nodeTarget] : [], 'Node') },
                    { key: 'services', title: '서비스', items: this.connectedListItems(services, 'Service') },
                    { key: 'storage', title: 'PVC', items: this.connectedListItems(pvcs, 'PVC') }
                ]} />

            <DetailSectionCard icon={<HistoryOutlined />} title="최근 이벤트">
                <KubernetesRecentEvents groups={recentEventGroups} lookbackLabel="최근 1시간" onResourceClick={group => this.openResource({ uid: group.resourceUid, name: group.resourceName, kind: group.resourceKind })} />
            </DetailSectionCard>

            {this.state.error && <div className="netdive-detail-notice"><InfoIcon /><span>{translate('kubernetesPodDetailFallback')}</span></div>}
            {!this.cluster() && <div className="netdive-detail-notice"><InfoIcon /><span>{translate('kubernetesClusterMoldMissing')}</span></div>}
        </div>
    }
}

export default KubernetesPodDetailPanel
