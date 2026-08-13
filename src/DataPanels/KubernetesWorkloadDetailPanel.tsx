import * as React from 'react'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'
import SettingsIcon from '@material-ui/icons/Settings'
import ViewModuleIcon from '@material-ui/icons/ViewModule'
import { HistoryOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { Node } from '../Topology'
import { aggregateKubernetesPods } from '../KubernetesPodLifecycle'
import {
    currentKubernetesReplicaSetForDeployment,
    kubernetesPodsForController,
    kubernetesReplicaSetRelationsForDeployment
} from '../KubernetesWorkloadOwnership'
import { isCurrentKubernetesPod } from '../KubernetesPodLifecycle'
import { kubernetesResourceSelfStatus } from '../KubernetesTopologyBadgeAggregation'
import { kubernetesLabelValue, matchesKubernetesSelector } from '../KubernetesSelectors'
import {
    KubernetesDaemonSetPlacementSnapshot,
    kubernetesDaemonSetPlacementHasProblem,
    kubernetesDaemonSetPlacementSnapshot
} from '../KubernetesDaemonSetDetailAggregation'
import {
    BasicInfoRows,
    collectKubernetesEventGroups,
    ConnectedResourceListSection,
    DetailAdvancedInfo,
    DetailBadgeTone,
    DetailLongValue,
    DetailModalAction,
    DetailCardSubsectionHeader,
    DetailSectionCard,
    DetailStatusIndicator,
    HistoryModal,
    KubernetesMetadataRows,
    KubernetesSelectorSummary,
    KUBERNETES_DETAIL_LABELS,
    kubernetesCreationTimestamp,
    formatKubernetesTimestamp,
    KubernetesRecentEvents,
    KubernetesDaemonSetPlacementSummary,
    KubernetesReplicaSummary,
    KubernetesConditionRows,
    KubernetesContainerDetails,
    DAEMONSET_CONDITION_DEFINITIONS,
    DEPLOYMENT_CONDITION_DEFINITIONS,
    KUBERNETES_DAEMONSET_PLACEMENT_ROLLOUT_TITLE,
    kubernetesDaemonSetNodeLabel,
    KubernetesSchedulingModalAction,
    normalizeKubernetesSchedulingConfiguration,
    KubernetesStateSeparation,
    StatusEvidenceList,
    StatusEvidenceRow,
    StatusSummaryGrid,
    summarizeKubernetesPods
} from './common'
import {
    evaluateStatefulSetRollout,
    statefulSetRelatedPvcNames,
    statefulSetRelatedServiceNames,
    statefulSetPersistentVolumeClaimNames,
    statefulSetPvcTemplateSummaries
} from '../KubernetesStatefulSetDetailAggregation'
import './KubernetesWorkloadDetailPanel.css'

interface Props {
    node: Node
    nodeAttrs: (node: Node) => any
}

interface State {
    basicCollapsed: boolean
    basicInfoAdvanced: boolean
    rolloutAdvanced: boolean
    pvcModalOpen: boolean
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
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
const optionalNumber = (value: any): React.ReactNode => value === undefined || value === null ? '–' : Number(value)
const formatDate = formatKubernetesTimestamp
const intOrUndefined = (value: any): number | undefined => value === undefined || value === null ? undefined : Number(value)
const WORKLOAD_KIND_LABELS: Record<string, string> = { deployment: 'Deployment', statefulset: 'StatefulSet', daemonset: 'DaemonSet', job: 'Job', cronjob: 'CronJob' }
type WorkloadTone = 'success' | 'info' | 'warning' | 'danger' | 'default'
interface WorkloadHealth {
    tone: WorkloadTone
    label: string
    conclusion: string
    progress: string
    progressTone: WorkloadTone
}
interface ContainerDetail {
    name: string
    image: string
    pullPolicy: string
    ports: string[]
    resourcesCollected: boolean
    resources: any
    init: boolean
}
const WORKLOAD_EVENT_TONES = {
    successfulcreate: 'success' as const,
    failedcreate: 'warning' as const,
    progressdeadlineexceeded: 'warning' as const,
    failedscale: 'warning' as const,
    scalingreplicaset: 'success' as const,
    successfuldelete: 'success' as const,
    faileddelete: 'warning' as const,
    sawcompletedjob: 'success' as const,
    failedjob: 'warning' as const
}

const normalizeList = (value: any): any[] => Array.isArray(value) ? value : []
const conditionValue = (condition: any, key: string): any => condition?.[key] ?? condition?.[key.charAt(0).toLowerCase() + key.slice(1)]
const numberValue = (value: any, fallback = 0): number => value === undefined || value === null || Number.isNaN(Number(value)) ? fallback : Number(value)
const optionalText = (value: any): string => value === undefined || value === null || String(value).trim() === '' ? translate('kubernetesNone') : String(value)
const intOrStringValue = (value: any): any => value?.StrVal ?? value?.strVal ?? value?.IntVal ?? value?.intVal ?? value

class KubernetesWorkloadDetailPanel extends React.Component<Props, State> {
    state: State = { basicCollapsed: false, basicInfoAdvanced: false, rolloutAdvanced: false, pvcModalOpen: false }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id) this.setState({ basicCollapsed: false, basicInfoAdvanced: false, rolloutAdvanced: false, pvcModalOpen: false })
    }

    private topologyNodes(): Node[] {
        const nodes = (window as any).App?.tc?.nodes
        if (nodes instanceof Map) return Array.from(nodes.values())
        return Array.isArray(nodes) ? nodes : []
    }

    private sameScope(node: Node): boolean {
        const data = this.props.node.data || {}
        const other = node.data || {}
        const cluster = firstValue(data, ['ClusterName', 'K8s.ClusterName'])
        const namespace = firstValue(data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
        return (!cluster || firstValue(other, ['ClusterName', 'K8s.ClusterName']) === cluster)
            && firstValue(other, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) === namespace
    }

    private pods(): Node[] {
        const topologyNodes = this.topologyNodes()
        return kubernetesPodsForController(this.props.node, topologyNodes)
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        if (attrs.href) return <img className="netdive-detail-topology-icon-image" src={attrs.href} alt="" />
        return <span className={`netdive-detail-topology-icon ${attrs.iconClass || ''}`} aria-hidden="true">{attrs.icon}</span>
    }

    private focusResources(resources: Node[]) {
        const app = (window as any).App
        const ids = resources.map(resource => resource.id)
        if (ids.length && app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs(ids, this.props.node.id, true)
    }

    private openResource(resource: Node) {
        const app = (window as any).App
        if (app && typeof app.openResourceDetailNodeID === 'function') app.openResourceDetailNodeID(resource.id)
    }

    private resourceName(node: Node): string {
        return firstValue(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) || node.id
    }

    private resourceNamespace(node: Node): string {
        return firstValue(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
    }

    private selectorMatches(selector: any, labels: any): boolean {
        return matchesKubernetesSelector(selector, labels)
    }

    private connectedServices(pods: Node[], statefulSetSpec?: any): Node[] {
        const serviceIDs = new Set<string>()
        const services = this.scopedResources(['service'])
        const podIDs = new Set(pods.map(pod => pod.id))
        const podNames = new Set(pods.map(pod => this.resourceName(pod)))
        const podUIDs = new Set(pods.map(pod => firstValue(pod.data || {}, ['K8s.Extra.ObjectMeta.UID', 'UID'])).filter(Boolean))
        const selectorMatchedNames = new Set<string>()
        const endpointSliceServiceNames = new Set<string>()
        const declaredName = String(statefulSetSpec?.ServiceName || statefulSetSpec?.serviceName || '')
        pods.forEach(pod => {
            const labels = firstRaw(pod.data || {}, ['K8s.Labels', 'K8s.Extra.ObjectMeta.Labels', 'Labels']) || {}
            services.forEach(service => {
                const selector = firstRaw(service.data || {}, ['K8s.Extra.Spec.Selector', 'K8s.Spec.Selector', 'Spec.Selector'])
                if (this.selectorMatches(selector, labels)) selectorMatchedNames.add(this.resourceName(service))
            })
        })
        this.scopedResources(['endpointslice']).forEach(slice => {
            const sliceSpec = firstRaw(slice.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
            const targetsControllerPod = normalizeList(sliceSpec.Endpoints || sliceSpec.endpoints).some(endpoint =>
                normalizeList(endpoint?.TargetRefs || endpoint?.targetRefs || (endpoint?.TargetRef || endpoint?.targetRef ? [endpoint?.TargetRef || endpoint?.targetRef] : []))
                    .some((target: any) => {
                        const uid = String(target?.UID || target?.uid || '')
                        return podIDs.has(uid) || podUIDs.has(uid) || podNames.has(String(target?.Name || target?.name || ''))
                    }))
            if (!targetsControllerPod) return
            const labels = firstRaw(slice.data || {}, ['K8s.Labels', 'K8s.Extra.ObjectMeta.Labels', 'Labels']) || {}
            const serviceName = String(kubernetesLabelValue(labels, 'kubernetes.io/service-name') || kubernetesLabelValue(labels, 'k8s.io/service-name') || '')
            if (serviceName) endpointSliceServiceNames.add(serviceName)
        })
        const relatedNames = new Set(statefulSetSpec ? statefulSetRelatedServiceNames(
            declaredName,
            Array.from(selectorMatchedNames),
            Array.from(endpointSliceServiceNames)
        ) : [...Array.from(selectorMatchedNames), ...Array.from(endpointSliceServiceNames)])
        services.filter(service => relatedNames.has(this.resourceName(service))).forEach(service => serviceIDs.add(service.id))
        return services.filter(node => serviceIDs.has(node.id))
    }

    private scopedResources(types: string[]): Node[] {
        const allowed = new Set(types.map(type => type.toLowerCase()))
        return this.topologyNodes().filter(node => this.sameScope(node) && allowed.has(String(node.data?.Type || '').toLowerCase()))
    }

    private referencedResources(spec: any, types: string[]): Node[] {
        const podSpec = spec?.Template?.Spec || {}
        const names = new Set<string>()
        const expectedTypes = new Set(types.map(type => type.toLowerCase()))
        normalizeList(podSpec.Volumes).forEach((volume: any) => {
            const source = volume?.VolumeSource || volume || {}
            const configMapName = source?.ConfigMap?.LocalObjectReference?.Name || source?.ConfigMap?.Name
            const secretName = source?.Secret?.SecretName || source?.Secret?.Name
            if (configMapName && expectedTypes.has('configmap')) names.add(String(configMapName))
            if (secretName && expectedTypes.has('secret')) names.add(String(secretName))
        })
        ;([] as any[]).concat(normalizeList(podSpec.InitContainers), normalizeList(podSpec.Containers)).forEach((container: any) => {
            normalizeList(container?.EnvFrom).forEach((source: any) => {
                const configMapName = source?.ConfigMapRef?.LocalObjectReference?.Name || source?.ConfigMapRef?.Name
                const secretName = source?.SecretRef?.LocalObjectReference?.Name || source?.SecretRef?.Name
                if (configMapName && expectedTypes.has('configmap')) names.add(String(configMapName))
                if (secretName && expectedTypes.has('secret')) names.add(String(secretName))
            })
            normalizeList(container?.Env).forEach((env: any) => {
                const configMapName = env?.ValueFrom?.ConfigMapKeyRef?.LocalObjectReference?.Name || env?.ValueFrom?.ConfigMapKeyRef?.Name
                const secretName = env?.ValueFrom?.SecretKeyRef?.LocalObjectReference?.Name || env?.ValueFrom?.SecretKeyRef?.Name
                if (configMapName && expectedTypes.has('configmap')) names.add(String(configMapName))
                if (secretName && expectedTypes.has('secret')) names.add(String(secretName))
            })
        })
        return this.scopedResources(types).filter(node => names.has(firstValue(node.data || {}, ['Name', 'K8s.Name'])))
    }

    private pvcTargets(spec: any, pods: Node[] = []): Node[] {
        const workloadName = firstValue(this.props.node.data || {}, ['Name', 'K8s.Name'])
        const templateNames = normalizeList(spec?.VolumeClaimTemplates || spec?.volumeClaimTemplates)
            .map((template: any) => firstValue(template, ['ObjectMeta.Name', 'Metadata.Name', 'metadata.name']))
            .filter(Boolean)
        const claimsFromPods = new Set<string>()
        const collectClaims = (podSpec: any) => {
            statefulSetPersistentVolumeClaimNames(podSpec).forEach(claim => claimsFromPods.add(claim))
        }
        collectClaims(spec?.Template?.Spec || spec?.template?.spec || {})
        pods.forEach(pod => collectClaims(firstRaw(pod.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}))
        if (!templateNames.length && !claimsFromPods.size) return []
        const candidates = this.scopedResources(['persistentvolumeclaim', 'pvc'])
        const relatedNames = new Set(statefulSetRelatedPvcNames(
            workloadName,
            templateNames,
            Array.from(claimsFromPods),
            candidates.map(node => this.resourceName(node))
        ))
        return candidates.filter(node => relatedNames.has(this.resourceName(node)))
    }

    private ingressTargets(services: Node[]): Node[] {
        const serviceNames = new Set(services.map(service => this.resourceName(service)))
        return this.scopedResources(['ingress']).filter(node => {
            const ingressSpec = firstRaw(node.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
            const names = new Set<string>()
            const add = (backend: any) => {
                const name = backend?.Service?.Name || backend?.service?.name || backend?.ServiceName || backend?.serviceName
                if (name) names.add(String(name))
            }
            add(ingressSpec.DefaultBackend || ingressSpec.defaultBackend)
            normalizeList(ingressSpec.Rules || ingressSpec.rules).forEach(rule => {
                normalizeList(rule?.HTTP?.Paths || rule?.http?.paths).forEach(path => add(path?.Backend || path?.backend))
            })
            return Array.from(names).some(name => serviceNames.has(name))
        })
    }

    private endpointTargets(services: Node[]): Node[] {
        const serviceNames = new Set(services.map(service => this.resourceName(service)))
        return this.scopedResources(['endpoints', 'endpointslice']).filter(node => {
            const type = String(node.data?.Type || '').toLowerCase()
            if (type === 'endpoints') return serviceNames.has(this.resourceName(node))
            const labels = firstRaw(node.data || {}, ['K8s.Labels', 'K8s.Extra.ObjectMeta.Labels', 'Labels']) || {}
            return serviceNames.has(String(
                kubernetesLabelValue(labels, 'kubernetes.io/service-name')
                || kubernetesLabelValue(labels, 'k8s.io/service-name')
                || ''
            ))
        })
    }

    private serviceAccountTargets(spec: any): Node[] {
        const podSpec = spec?.Template?.Spec || {}
        const name = String(podSpec.ServiceAccountName || podSpec.serviceAccountName || podSpec.ServiceAccount || podSpec.serviceAccount || '')
        return name ? this.scopedResources(['serviceaccount']).filter(node => this.resourceName(node) === name) : []
    }

    private networkPolicyTargets(spec: any): Node[] {
        const labels = spec?.Template?.ObjectMeta?.Labels || spec?.Template?.Metadata?.Labels || spec?.Template?.metadata?.labels || {}
        return this.scopedResources(['networkpolicy']).filter(node => {
            const policySpec = firstRaw(node.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
            return this.selectorMatches(policySpec.PodSelector || policySpec.podSelector, labels)
        })
    }

    private operationalPolicyTargets(spec: any): { hpas: Node[], pdbs: Node[] } {
        const workloadName = this.resourceName(this.props.node)
        const hpas = this.scopedResources(['horizontalpodautoscaler', 'hpa']).filter(node => {
            const target = firstRaw(node.data || {}, ['K8s.Extra.Spec.ScaleTargetRef', 'K8s.Spec.ScaleTargetRef', 'Spec.ScaleTargetRef']) || {}
            return String(target.Name || target.name || '') === workloadName
        })
        const labels = spec?.Template?.ObjectMeta?.Labels || spec?.Template?.Metadata?.Labels || spec?.Template?.metadata?.labels || {}
        const pdbs = this.scopedResources(['poddisruptionbudget', 'pdb']).filter(node => {
            const pdbSpec = firstRaw(node.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
            return this.selectorMatches(pdbSpec.Selector || pdbSpec.selector, labels)
        })
        return { hpas, pdbs }
    }

    private boundStorageResources(pvcs: Node[]): { pvs: Node[], storageClasses: Node[] } {
        const volumeNames = new Set<string>()
        const storageClassNames = new Set<string>()
        pvcs.forEach(pvc => {
            const volumeName = firstValue(pvc.data || {}, ['K8s.Extra.Spec.VolumeName', 'K8s.Spec.VolumeName', 'Spec.VolumeName'])
            const storageClassName = firstValue(pvc.data || {}, ['K8s.Extra.Spec.StorageClassName', 'K8s.Spec.StorageClassName', 'Spec.StorageClassName'])
            if (volumeName) volumeNames.add(volumeName)
            if (storageClassName) storageClassNames.add(storageClassName)
        })
        const pvs = this.topologyNodes().filter(node => String(node.data?.Type || '').toLowerCase() === 'persistentvolume' && volumeNames.has(this.resourceName(node)))
        pvs.forEach(pv => {
            const storageClassName = firstValue(pv.data || {}, ['K8s.Extra.Spec.StorageClassName', 'K8s.Spec.StorageClassName', 'Spec.StorageClassName'])
            if (storageClassName) storageClassNames.add(storageClassName)
        })
        const storageClasses = this.topologyNodes().filter(node => String(node.data?.Type || '').toLowerCase() === 'storageclass' && storageClassNames.has(this.resourceName(node)))
        return { pvs, storageClasses }
    }

    private connectedListItems(resources: Node[], kind: string) {
        return resources.map(resource => ({
            key: resource.id,
            name: this.resourceName(resource),
            description: this.resourceNamespace(resource) || firstValue(resource.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Status', 'Status']) || undefined,
            icon: this.topologyIcon(resource),
            tooltip: `${kind} · ${this.resourceName(resource)}`,
            onClick: resource.data?.RelationshipReferenceOnly ? undefined : () => this.openResource(resource)
        }))
    }

    private containers(spec: any): ContainerDetail[] {
        const podSpec = spec?.Template?.Spec || {}
        const toDetail = (container: any, init: boolean): ContainerDetail => {
            const ports = normalizeList(container?.Ports || container?.ports).map((port: any) => {
                const value = port?.ContainerPort ?? port?.containerPort
                const protocol = port?.Protocol || port?.protocol || 'TCP'
                const name = port?.Name || port?.name
                return value === undefined || value === null ? '' : `${name ? `${name} · ` : ''}${value}/${protocol}`
            }).filter(Boolean)
            const image = container?.Image || container?.image
            const resources = container?.Resources ?? container?.resources
            return {
                name: optionalText(container?.Name || container?.name),
                image: image ? String(image) : translate('kubernetesImageUnavailable'),
                pullPolicy: optionalText(container?.ImagePullPolicy || container?.imagePullPolicy),
                ports,
                // Container objects originate from the collected StatefulSet PodTemplate.
                // Kubernetes omits an empty ResourceRequirements field, so absence here
                // means "not configured", not a collection failure.
                resourcesCollected: !!container && typeof container === 'object',
                resources: resources || {},
                init
            }
        }
        return normalizeList(podSpec.InitContainers).map(container => toDetail(container, true))
            .concat(normalizeList(podSpec.Containers).map(container => toDetail(container, false)))
    }

    private deploymentHealth(spec: any, status: any): WorkloadHealth {
        const desired = numberValue(spec.Replicas)
        const available = numberValue(status.AvailableReplicas)
        const updated = numberValue(status.UpdatedReplicas)
        const unavailable = numberValue(status.UnavailableReplicas)
        const conditions = normalizeList(status.Conditions)
        const deadlineExceeded = conditions.some(condition => String(conditionValue(condition, 'Reason')).toLowerCase() === 'progressdeadlineexceeded')
        const replicaFailure = conditions.some(condition => String(conditionValue(condition, 'Type')).toLowerCase() === 'replicafailure' && String(conditionValue(condition, 'Status')).toLowerCase() === 'true')
        const progressing = conditions.some(condition => String(conditionValue(condition, 'Type')).toLowerCase() === 'progressing' && String(conditionValue(condition, 'Status')).toLowerCase() === 'true')
        if ((desired > 0 && available === 0) || deadlineExceeded || replicaFailure) {
            return { tone: 'danger', label: translate('kubernetesHealthCritical'), conclusion: translate('kubernetesWorkloadNoAvailableReplicas'), progress: deadlineExceeded || replicaFailure ? translate('kubernetesRolloutFailed') : translate('kubernetesRolloutDelayed'), progressTone: 'danger' }
        }
        if (spec.Paused === true) {
            return { tone: 'info', label: translate('kubernetesWorkloadUpdating'), conclusion: translate('kubernetesWorkloadRevisionApplying'), progress: translate('kubernetesRolloutPaused'), progressTone: 'info' }
        }
        if (updated < desired || available < desired) {
            const activeRollout = progressing && available > 0
            return {
                tone: activeRollout ? 'info' : 'warning',
                label: activeRollout ? translate('kubernetesWorkloadUpdating') : translate('kubernetesHealthWarning'),
                conclusion: activeRollout ? translate('kubernetesWorkloadRevisionApplying') : translate('kubernetesWorkloadPartialReplicas'),
                progress: activeRollout ? translate('kubernetesRolloutInProgress') : translate('kubernetesRolloutDelayed'),
                progressTone: activeRollout ? 'info' : 'warning'
            }
        }
        if (unavailable > 0) {
            return { tone: 'warning', label: translate('kubernetesHealthWarning'), conclusion: translate('kubernetesWorkloadPartialReplicas'), progress: translate('kubernetesRolloutDelayed'), progressTone: 'warning' }
        }
        return { tone: 'success', label: translate('kubernetesHealthNormal'), conclusion: '목표 복제본 충족', progress: translate('kubernetesRolloutComplete'), progressTone: 'success' }
    }

    private statefulSetHealth(spec: any, status: any, pvcTargets: Node[]): WorkloadHealth {
        const failure = normalizeList(status.Conditions).some(condition => {
            const type = String(conditionValue(condition, 'Type')).toLowerCase()
            const reason = String(conditionValue(condition, 'Reason')).toLowerCase()
            return String(conditionValue(condition, 'Status')).toLowerCase() === 'true' && (/fail|error/.test(type) || /fail|error/.test(reason))
        })
        const pvcPhases = pvcTargets.map(node => firstValue(node.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Status', 'Status']).toLowerCase())
        const pvcLost = pvcPhases.some(phase => phase === 'lost')
        const pvcPending = pvcPhases.some(phase => phase === 'pending')
        const rollout = evaluateStatefulSetRollout({
            desired: intOrUndefined(spec.Replicas),
            ready: intOrUndefined(status.ReadyReplicas),
            current: intOrUndefined(status.CurrentReplicas),
            updated: intOrUndefined(status.UpdatedReplicas),
            unavailable: intOrUndefined(status.UnavailableReplicas),
            currentRevision: status.CurrentRevision,
            updateRevision: status.UpdateRevision,
            failed: failure || pvcLost
        })
        if (pvcPending && rollout.tone === 'success') {
            return { tone: 'warning', label: '주의', conclusion: 'PVC 연결 대기 중', progress: rollout.label, progressTone: 'warning' }
        }
        return { tone: rollout.tone, label: rollout.verdict, conclusion: rollout.impact, progress: rollout.label, progressTone: rollout.tone }
    }

    private daemonSetHealth(placement: KubernetesDaemonSetPlacementSnapshot): WorkloadHealth {
        if (!placement.collected) {
            return { tone: 'default', label: translate('kubernetesHealthUnknown'), conclusion: '영향 확인 불가', progress: '상태 확인 불가', progressTone: 'default' }
        }
        if (kubernetesDaemonSetPlacementHasProblem(placement)) {
            const updating = placement.desired !== undefined && placement.updated !== undefined && placement.updated < placement.desired
            return {
                tone: 'warning',
                label: translate('kubernetesHealthWarning'),
                conclusion: '노드 배치 확인 필요',
                progress: updating ? translate('kubernetesRolloutInProgress') : '배치 상태 확인 필요',
                progressTone: 'warning'
            }
        }
        return { tone: 'success', label: translate('kubernetesHealthNormal'), conclusion: '배치 대상 노드 충족', progress: translate('kubernetesRolloutComplete'), progressTone: 'success' }
    }

    private metrics(kind: string, spec: any, status: any, daemonPlacement?: KubernetesDaemonSetPlacementSnapshot): Array<{ label: string, value: any, problem?: boolean }> {
        switch (kind) {
            case 'deployment': return [
                { label: translate('kubernetesDesiredReplicas'), value: intOrUndefined(spec.Replicas) },
                { label: translate('kubernetesAvailableReplicas'), value: intOrUndefined(status.AvailableReplicas), problem: numberValue(status.AvailableReplicas) < numberValue(spec.Replicas) },
                { label: translate('kubernetesUpdatedReplicas'), value: intOrUndefined(status.UpdatedReplicas), problem: numberValue(status.UpdatedReplicas) < numberValue(spec.Replicas) },
                { label: translate('kubernetesUnavailableReplicas'), value: intOrUndefined(status.UnavailableReplicas), problem: Number(status.UnavailableReplicas || 0) > 0 }
            ]
            case 'statefulset': return [
                { label: translate('kubernetesDesiredReplicas'), value: intOrUndefined(spec.Replicas) },
                { label: translate('kubernetesReadyReplicas'), value: intOrUndefined(status.ReadyReplicas), problem: numberValue(status.ReadyReplicas) < numberValue(spec.Replicas) },
                { label: translate('kubernetesUpdatedReplicas'), value: intOrUndefined(status.UpdatedReplicas), problem: numberValue(status.UpdatedReplicas) < numberValue(spec.Replicas) },
                {
                    label: translate('kubernetesUnavailableReplicas'),
                    value: spec.Replicas === undefined || status.ReadyReplicas === undefined ? undefined : Math.max(0, numberValue(spec.Replicas) - numberValue(status.ReadyReplicas)),
                    problem: spec.Replicas !== undefined && status.ReadyReplicas !== undefined && numberValue(status.ReadyReplicas) < numberValue(spec.Replicas)
                }
            ]
            case 'daemonset': {
                const placement = daemonPlacement || kubernetesDaemonSetPlacementSnapshot(status)
                return [
                    { label: kubernetesDaemonSetNodeLabel('desired'), value: placement.desired },
                    { label: kubernetesDaemonSetNodeLabel('current'), value: placement.current, problem: placement.current !== undefined && placement.desired !== undefined && placement.current < placement.desired },
                    { label: kubernetesDaemonSetNodeLabel('ready'), value: placement.ready, problem: placement.ready !== undefined && placement.desired !== undefined && placement.ready < placement.desired },
                    { label: kubernetesDaemonSetNodeLabel('available'), value: placement.available, problem: placement.available !== undefined && placement.desired !== undefined && placement.available < placement.desired },
                    { label: kubernetesDaemonSetNodeLabel('updated'), value: placement.updated, problem: placement.updated !== undefined && placement.desired !== undefined && placement.updated < placement.desired },
                    { label: kubernetesDaemonSetNodeLabel('unavailable'), value: placement.unavailable, problem: placement.unavailable !== undefined && placement.unavailable > 0 },
                    { label: kubernetesDaemonSetNodeLabel('misscheduled'), value: placement.misscheduled, problem: placement.misscheduled !== undefined && placement.misscheduled > 0 }
                ]
            }
            case 'job': return [
                { label: 'Active', value: intOrUndefined(status.Active) },
                { label: 'Succeeded', value: intOrUndefined(status.Succeeded) },
                { label: 'Failed', value: intOrUndefined(status.Failed), problem: Number(status.Failed || 0) > 0 },
                { label: translate('kubernetesParallelism'), value: intOrUndefined(spec.Parallelism) }
            ]
            case 'cronjob': return [
                { label: translate('kubernetesSchedule'), value: spec.Schedule || '–' },
                { label: translate('kubernetesSuspend'), value: spec.Suspend ? translate('yes') : translate('no'), problem: !!spec.Suspend },
                { label: translate('kubernetesActiveJobs'), value: Array.isArray(status.Active) ? status.Active.length : intOrUndefined(status.Active) },
                { label: translate('kubernetesLastSchedule'), value: formatDate(status.LastScheduleTime?.Time) || '–' }
            ]
            default: return []
        }
    }

    private configurationRows(kind: string, spec: any, status: any): any[] {
        switch (kind) {
            case 'deployment': return [
                { label: translate('kubernetesDeploymentStrategy'), value: spec.Strategy?.Type || translate('kubernetesNotCollected') },
                { label: '최대 추가 배포', value: spec.Strategy?.RollingUpdate?.MaxSurge?.StrVal || (spec.Strategy?.RollingUpdate?.MaxSurge?.IntVal ?? translate('kubernetesNotCollected')) },
                { label: '최대 미가용', value: spec.Strategy?.RollingUpdate?.MaxUnavailable?.StrVal || (spec.Strategy?.RollingUpdate?.MaxUnavailable?.IntVal ?? translate('kubernetesNotCollected')) },
                {
                    label: translate('kubernetesProgress'),
                    value: Number(status.UnavailableReplicas || 0) > 0
                        ? <DetailStatusIndicator tone="warning">{translate('kubernetesInProgress')}</DetailStatusIndicator>
                        : <DetailStatusIndicator tone="success">{translate('kubernetesStable')}</DetailStatusIndicator>
                }
            ]
            case 'daemonset': {
                const collected = !!spec && typeof spec === 'object' && Object.keys(spec).length > 0
                const absent = collected ? '설정되지 않음' : translate('kubernetesNotCollected')
                const configuredValue = (value: any) => value === undefined || value === null || String(value).trim() === '' ? absent : String(value)
                const maxUnavailable = intOrStringValue(spec.UpdateStrategy?.RollingUpdate?.MaxUnavailable ?? spec.updateStrategy?.rollingUpdate?.maxUnavailable)
                const maxSurge = intOrStringValue(spec.UpdateStrategy?.RollingUpdate?.MaxSurge ?? spec.updateStrategy?.rollingUpdate?.maxSurge)
                return [
                    { label: '업데이트 전략', value: configuredValue(spec.UpdateStrategy?.Type ?? spec.updateStrategy?.type) },
                    {
                        label: '최대 미가용',
                        value: configuredValue(maxUnavailable),
                        tooltip: !collected
                            ? 'DaemonSet spec 데이터가 수집되지 않아 설정값을 확인할 수 없습니다.'
                            : maxUnavailable === undefined
                            ? 'spec.updateStrategy.rollingUpdate.maxUnavailable에 명시된 값이 없습니다. RollingUpdate에서는 Kubernetes API 서버의 기본화 규칙이 적용될 수 있습니다.'
                            : 'Kubernetes 원본 필드: spec.updateStrategy.rollingUpdate.maxUnavailable'
                    },
                    {
                        label: '최대 추가 배포',
                        value: configuredValue(maxSurge),
                        tooltip: !collected
                            ? 'DaemonSet spec 데이터가 수집되지 않아 설정값을 확인할 수 없습니다.'
                            : maxSurge === undefined
                            ? 'spec.updateStrategy.rollingUpdate.maxSurge에 명시된 값이 없습니다. RollingUpdate에서는 Kubernetes API 서버의 기본화 규칙이 적용될 수 있습니다.'
                            : 'Kubernetes 원본 필드: spec.updateStrategy.rollingUpdate.maxSurge'
                    },
                    {
                        label: '노드 선택 조건',
                        value: (() => {
                            const scheduling = normalizeKubernetesSchedulingConfiguration(spec.Template?.Spec ?? spec.template?.spec)
                            return scheduling.nodeSelectionCount ? `${scheduling.nodeSelectionCount}개` : absent
                        })()
                    },
                    {
                        label: '허용 조건',
                        value: (() => {
                            const scheduling = normalizeKubernetesSchedulingConfiguration(spec.Template?.Spec ?? spec.template?.spec)
                            return scheduling.tolerationCount ? `${scheduling.tolerationCount}개` : absent
                        })()
                    }
                ]
            }
            case 'job': return [
                { label: 'Completions', value: optionalNumber(spec.Completions) },
                { label: translate('kubernetesParallelism'), value: optionalNumber(spec.Parallelism) },
                { label: 'BackoffLimit', value: optionalNumber(spec.BackoffLimit) },
                { label: translate('kubernetesCompletionMode'), value: spec.CompletionMode || translate('kubernetesNotCollected') }
            ]
            case 'cronjob': return [
                { label: translate('kubernetesSchedule'), value: spec.Schedule || translate('kubernetesNotCollected') },
                { label: translate('kubernetesSuspend'), value: spec.Suspend ? translate('yes') : translate('no') },
                { label: translate('kubernetesLastSchedule'), value: formatDate(status.LastScheduleTime?.Time) || translate('kubernetesNotCollected') },
                { label: translate('kubernetesLastSuccessful'), value: formatDate(status.LastSuccessfulTime?.Time) || translate('kubernetesNotCollected') }
            ]
            default: return []
        }
    }

    private rolloutRows(kind: string, spec: any, status: any, health: WorkloadHealth, currentReplicaSet?: Node): any[] {
        if (kind === 'deployment') {
            const rows: any[] = [
                { label: translate('kubernetesDeploymentStrategy'), value: optionalText(spec.Strategy?.Type) },
                { label: '최대 추가 배포', value: optionalText(spec.Strategy?.RollingUpdate?.MaxSurge?.StrVal || spec.Strategy?.RollingUpdate?.MaxSurge?.IntVal), tooltip: 'Kubernetes 원본 필드: spec.strategy.rollingUpdate.maxSurge' },
                { label: '최대 미가용', value: optionalText(spec.Strategy?.RollingUpdate?.MaxUnavailable?.StrVal || spec.Strategy?.RollingUpdate?.MaxUnavailable?.IntVal), tooltip: 'Kubernetes 원본 필드: spec.strategy.rollingUpdate.maxUnavailable' },
                { label: translate('kubernetesProgress'), value: <span className={`netdive-k8s-workload-detail__inline-state is-${health.progressTone}`}>{health.progress}</span> }
            ]
            if (currentReplicaSet) {
                const name = this.resourceName(currentReplicaSet)
                rows.push({ label: translate('kubernetesCurrentReplicaSet'), value: <DetailLongValue value={name} copy />, wrap: true })
            } else rows.push({ label: translate('kubernetesCurrentReplicaSet'), value: translate('kubernetesNotCollected') })
            return rows
        }
        if (kind === 'statefulset') {
            const templates = normalizeList(spec.VolumeClaimTemplates || spec.volumeClaimTemplates)
            const serviceName = spec.ServiceName || spec.serviceName
            return [
                { label: '서비스 이름', value: serviceName ? <DetailLongValue value={String(serviceName)} copy /> : '설정되지 않음', wrap: true },
                { label: '업데이트 전략', value: optionalText(spec.UpdateStrategy?.Type) },
                { label: '파드 관리 정책', value: optionalText(spec.PodManagementPolicy) },
                { label: '리비전 상태', value: <DetailStatusIndicator tone={health.progressTone}>{health.progress}</DetailStatusIndicator> },
                { label: 'PVC 템플릿', value: templates.length ? `${templates.length}개` : '설정되지 않음' }
            ]
        }
        return this.configurationRows(kind, spec, status)
    }

    private renderPvcTemplateModal(spec: any) {
        const templates = statefulSetPvcTemplateSummaries(normalizeList(spec.VolumeClaimTemplates || spec.volumeClaimTemplates))
        return <HistoryModal visible={this.state.pvcModalOpen} title="PVC 템플릿" onCancel={() => this.setState({ pvcModalOpen: false })}>
            {templates.map((template, index) => <DetailSectionCard key={`${template.name}:${index}`} title={template.name}>
                <BasicInfoRows density="compact" labelWidth={112} rows={[
                    { label: 'StorageClass', value: template.storageClass, textValue: template.storageClass, copyText: template.storageClass !== '설정되지 않음' ? template.storageClass : undefined, wrap: true },
                    { label: '요청 용량', value: template.requestedStorage },
                    { label: '접근 모드', value: template.accessModes, wrap: true },
                    { label: '볼륨 모드', value: template.volumeMode }
                ]} />
            </DetailSectionCard>)}
        </HistoryModal>
    }

    render() {
        const data = this.props.node.data || {}
        const extra = firstRaw(data, ['K8s.Extra']) || {}
        const spec = extra.Spec || extra.spec || {}
        const status = extra.Status || extra.status || {}
        const meta = extra.ObjectMeta || extra.Metadata || extra.metadata || {}
        const kind = String(data.Type || '').toLowerCase()
        const kindLabel = WORKLOAD_KIND_LABELS[kind] || kind
        const enhanced = kind === 'deployment' || kind === 'statefulset' || kind === 'daemonset'
        const topologyNodes = this.topologyNodes()
        const ownedReplicaSets = kind === 'deployment'
            ? kubernetesReplicaSetRelationsForDeployment(this.props.node, topologyNodes)
            : []
        const currentReplicaSet = kind === 'deployment'
            ? currentKubernetesReplicaSetForDeployment(this.props.node, topologyNodes)
            : undefined
        const pods = this.pods()
        const currentPods = pods.filter(isCurrentKubernetesPod)
        const connectedServices = this.connectedServices(currentPods, kind === 'statefulset' ? spec : undefined)
        const configMapTargets = this.referencedResources(spec, ['configmap'])
        const secretTargets = this.referencedResources(spec, ['secret'])
        const pvcTargets = kind === 'statefulset' ? this.pvcTargets(spec, currentPods) : []
        const ingressTargets = this.ingressTargets(connectedServices)
        const endpointTargets = this.endpointTargets(connectedServices)
        const serviceAccountTargets = this.serviceAccountTargets(spec)
        const networkPolicyTargets = this.networkPolicyTargets(spec)
        const operationalPolicies = this.operationalPolicyTargets(spec)
        const boundStorage = this.boundStorageResources(pvcTargets)
        const workloadContainers = enhanced ? this.containers(spec) : []
        const podSummary = summarizeKubernetesPods(pods)
        const topologyPodSummary = aggregateKubernetesPods(pods)
        const problemPods = topologyPodSummary.currentProblems
        const daemonPlacement = kubernetesDaemonSetPlacementSnapshot(status)
        const selfStatus = kubernetesResourceSelfStatus(this.props.node, extra)
        const metrics = this.metrics(kind, spec, status, daemonPlacement)
        const metricProblem = metrics.some(metric => metric.problem)
        const critical = kind === 'job' && Number(status.Failed || 0) > 0 && Number(status.Active || 0) === 0
        const warning = metricProblem || problemPods > 0
        const statusTone = critical ? 'danger' : selfStatus.state === 'problem' || warning ? 'warning' : selfStatus.state === 'healthy' ? 'success' : 'default'
        const statusLabel = critical ? translate('kubernetesHealthCritical') : selfStatus.state === 'problem' || warning ? translate('kubernetesHealthWarning') : selfStatus.state === 'healthy' ? translate('kubernetesHealthNormal') : translate('kubernetesHealthUnknown')
        const conclusion = critical ? translate('kubernetesWorkloadFailedConclusion') : warning ? translate('kubernetesWorkloadWarningConclusion') : translate('kubernetesWorkloadNormalConclusion')
        const health = kind === 'deployment'
            ? this.deploymentHealth(spec, status)
            : kind === 'statefulset'
                ? this.statefulSetHealth(spec, status, pvcTargets)
                : kind === 'daemonset'
                    ? this.daemonSetHealth(daemonPlacement)
                    : undefined
        const workloadName = String(data.Name || this.props.node.id)
        const labels = meta.Labels || meta.labels || data.K8s?.Labels || {}
        const annotations = meta.Annotations || meta.annotations || {}
        const creationTimestamp = kubernetesCreationTimestamp(data)
        const selector = spec.Selector || spec.selector || {}
        const pvcTemplates = normalizeList(spec.VolumeClaimTemplates || spec.volumeClaimTemplates)
        const scheduling = normalizeKubernetesSchedulingConfiguration(spec.Template?.Spec ?? spec.template?.spec)
        const basicRows = [
            { label: translate('kubernetesWorkloadName'), value: <DetailLongValue value={workloadName} copy />, wrap: true },
            { label: translate('kubernetesWorkloadType'), value: kindLabel },
            { label: translate('kubernetesTopologyNamespaces'), value: data.K8s?.Namespace || meta.Namespace || translate('kubernetesNotCollected') },
            { label: translate('kubernetesCreatedAt'), value: formatDate(creationTimestamp) || translate('kubernetesNotCollected') },
            { label: KUBERNETES_DETAIL_LABELS.selector, value: <KubernetesSelectorSummary selector={selector} mode="labelSelector" resourceName={workloadName} resourceKind={kindLabel} title={`${kindLabel} 선택자`} />, wrap: true }
        ]
        const recentEventGroups = collectKubernetesEventGroups([
            firstRaw(data, ['K8s.Extra.Events', 'K8s.Events', 'Events']),
            ...(kind === 'deployment' ? ownedReplicaSets.map(replicaSet => firstRaw(replicaSet.data || {}, ['K8s.Extra.Events', 'K8s.Events', 'Events'])) : []),
            ...((kind === 'deployment' || kind === 'daemonset') ? currentPods.map(pod => firstRaw(pod.data || {}, ['K8s.Extra.Events', 'K8s.Events', 'Events'])) : [])
        ], WORKLOAD_EVENT_TONES, { sinceMs: 60 * 60 * 1000 })
        const recentWorkloadEventGroups = recentEventGroups
        const recentInstabilityKnown = podSummary.timestampAvailable && (recentEventGroups.length === 0 || recentEventGroups.some(group => {
            const time = new Date(group.time || 0).getTime()
            return !Number.isNaN(time) && time > 0
        }))
        const operationalPolicyRows = [
            ...operationalPolicies.hpas.map(hpa => {
                const hpaSpec = firstRaw(hpa.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
                const hpaStatus = firstRaw(hpa.data || {}, ['K8s.Extra.Status', 'K8s.Status', 'Status']) || {}
                return {
                    label: `HPA · ${this.resourceName(hpa)}`,
                    value: `Min ${optionalText(hpaSpec.MinReplicas ?? hpaSpec.minReplicas)} · Max ${optionalText(hpaSpec.MaxReplicas ?? hpaSpec.maxReplicas)} · Current ${optionalText(hpaStatus.CurrentReplicas ?? hpaStatus.currentReplicas)} · Desired ${optionalText(hpaStatus.DesiredReplicas ?? hpaStatus.desiredReplicas)}`
                }
            }),
            ...operationalPolicies.pdbs.map(pdb => {
                const pdbSpec = firstRaw(pdb.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
                const pdbStatus = firstRaw(pdb.data || {}, ['K8s.Extra.Status', 'K8s.Status', 'Status']) || {}
                return {
                    label: `PDB · ${this.resourceName(pdb)}`,
                    value: `Min ${optionalText(pdbSpec.MinAvailable ?? pdbSpec.minAvailable)} · Max unavailable ${optionalText(pdbSpec.MaxUnavailable ?? pdbSpec.maxUnavailable)} · Disruptions ${optionalText(pdbStatus.DisruptionsAllowed ?? pdbStatus.disruptionsAllowed)}`
                }
            })
        ]
        const verdictTone = (selfStatus.state === 'unknown' ? 'default' : health ? health.tone : statusTone) as DetailBadgeTone
        const verdictLabel = selfStatus.state === 'unknown' ? translate('kubernetesHealthUnknown') : health ? health.label : statusLabel
        const impact = health ? health.conclusion : conclusion
        const desiredReplicas = intOrUndefined(spec.Replicas)
        const readyReplicas = intOrUndefined(status.ReadyReplicas)
        const availableReplicas = intOrUndefined(status.AvailableReplicas)
        const currentReplicas = intOrUndefined(status.CurrentReplicas)
        const updatedReplicas = intOrUndefined(status.UpdatedReplicas)
        const unavailableReplicas = kind === 'deployment'
            ? intOrUndefined(status.UnavailableReplicas) ?? (desiredReplicas === undefined || availableReplicas === undefined
                ? undefined
                : Math.max(0, desiredReplicas - availableReplicas))
            : desiredReplicas === undefined || readyReplicas === undefined
                ? undefined
                : Math.max(0, desiredReplicas - readyReplicas)
        const impactTooltip = kind === 'statefulset'
            ? `목표 복제본 ${desiredReplicas === undefined ? '확인 불가' : desiredReplicas}개, 준비 복제본 ${readyReplicas === undefined ? '확인 불가' : readyReplicas}개, 미가용 복제본 ${unavailableReplicas === undefined ? '확인 불가' : unavailableReplicas}개, 업데이트 복제본 ${updatedReplicas === undefined ? '확인 불가' : updatedReplicas}개를 기준으로 가용성 영향을 판정합니다.`
            : kind === 'deployment'
                ? `목표 복제본 ${desiredReplicas === undefined ? '확인 불가' : desiredReplicas}개, 가용 복제본 ${availableReplicas === undefined ? '확인 불가' : availableReplicas}개, 업데이트 복제본 ${updatedReplicas === undefined ? '확인 불가' : updatedReplicas}개, 미가용 복제본 ${unavailableReplicas === undefined ? '확인 불가' : unavailableReplicas}개를 기준으로 현재 가용성 영향을 판정합니다.`
                : kind === 'daemonset'
                    ? `배치 대상 노드 ${daemonPlacement.desired === undefined ? '확인 불가' : daemonPlacement.desired}개, 현재 배치 노드 ${daemonPlacement.current === undefined ? '확인 불가' : daemonPlacement.current}개, 준비 노드 ${daemonPlacement.ready === undefined ? '확인 불가' : daemonPlacement.ready}개, 가용 노드 ${daemonPlacement.available === undefined ? '확인 불가' : daemonPlacement.available}개, 미가용 노드 ${daemonPlacement.unavailable === undefined ? '확인 불가' : daemonPlacement.unavailable}개, 비대상 배치 ${daemonPlacement.misscheduled === undefined ? '확인 불가' : daemonPlacement.misscheduled}개를 기준으로 현재 영향을 판정합니다.`
                    : impact
        const operationalMetrics = kind === 'statefulset' || kind === 'deployment' || kind === 'daemonset' ? [] : metrics.map(metric => ({
            key: metric.label,
            label: metric.label,
            value: metric.value === undefined || metric.value === null ? '–' : metric.value,
            tone: metric.problem ? 'danger' as const : 'default' as const,
            tooltip: `${metric.label}의 현재 집계값입니다.`
        }))
        const rolloutConfigurationRows = (enhanced && health
            ? this.rolloutRows(kind, spec, status, health, currentReplicaSet)
            : this.configurationRows(kind, spec, status)).map((row: any) => {
            if (row.label === 'PVC 템플릿' && pvcTemplates.length) {
                return { ...row, value: <DetailModalAction onClick={() => this.setState({ pvcModalOpen: true })}>{pvcTemplates.length}개</DetailModalAction> }
            }
            if (kind === 'daemonset' && row.label === '노드 선택 조건' && scheduling.nodeSelectionCount > 0) {
                return { ...row, value: <KubernetesSchedulingModalAction resourceKind={kindLabel} resourceName={workloadName} configuration={scheduling}>{scheduling.nodeSelectionCount}개</KubernetesSchedulingModalAction> }
            }
            if (kind === 'daemonset' && row.label === '허용 조건' && scheduling.tolerationCount > 0) {
                return { ...row, value: <KubernetesSchedulingModalAction resourceKind={kindLabel} resourceName={workloadName} configuration={scheduling}>{scheduling.tolerationCount}개</KubernetesSchedulingModalAction> }
            }
            return row
        })
        return <div className="netdive-k8s-workload-detail">
            <DetailSectionCard icon={<InfoIcon />} title={translate('kubernetesWorkloadBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <BasicInfoRows density="compact" rows={basicRows} labelWidth={122} copyTooltip={translate('copy')} />
                <DetailAdvancedInfo
                    title={translate('kubernetesAdvancedInformation')}
                    active={this.state.basicInfoAdvanced}
                    onChange={basicInfoAdvanced => this.setState({ basicInfoAdvanced })}>
                    <KubernetesMetadataRows items={[
                        { key: 'labels', label: KUBERNETES_DETAIL_LABELS.labels, resourceName: workloadName, resourceKind: kindLabel, metadataKind: 'label', data: labels, modalTitle: `${kindLabel} 라벨` },
                        { key: 'annotations', label: KUBERNETES_DETAIL_LABELS.annotations, resourceName: workloadName, resourceKind: kindLabel, metadataKind: 'annotation', data: annotations, modalTitle: `${kindLabel} 어노테이션` }
                    ]} />
                </DetailAdvancedInfo>
            </DetailSectionCard>

            <DetailSectionCard icon={this.topologyIcon(this.props.node)} title={`${kindLabel} ${translate('kubernetesOperationalStatusShort')}`}>
                <StatusSummaryGrid
                    verdict={verdictLabel}
                    verdictTone={verdictTone}
                    rawStatus={health ? health.progress : statusLabel}
                    rawStatusLabel={health ? translate('kubernetesProgress') : 'Kubernetes 상태'}
                    impact={impact}
                    impactTooltip={impactTooltip}
                    metrics={operationalMetrics}
                />
                <KubernetesStateSeparation items={[
                    { key: 'current', label: '현재 문제', value: metricProblem || critical ? (kind === 'daemonset' ? '노드 배치/롤아웃' : '복제본/롤아웃') : problemPods, tone: metricProblem || critical || problemPods > 0 ? 'danger' : 'success', tooltip: kind === 'daemonset' ? '배치 대상·현재 배치·준비·가용·업데이트·미가용·비대상 배치와 현재 파드 상태를 기준으로 판정합니다.' : '목표·준비·가용 복제본과 현재 롤아웃 상태를 우선하여 판정합니다.' },
                    { key: 'recent', label: '최근 불안정성', value: recentInstabilityKnown ? podSummary.recentEvicted.length + recentWorkloadEventGroups.reduce((count, group) => count + group.count, 0) : '확인 불가', tone: recentInstabilityKnown ? (podSummary.recentEvicted.length + recentWorkloadEventGroups.length > 0 ? 'warning' : 'success') : 'default', tooltip: '최근 1시간의 Eviction과 워크로드 Event입니다.' },
                    { key: 'history', label: '누적 Evicted 파드', value: podSummary.evicted.length, tone: 'history', tooltip: '파드 UID로 중복 제거한 누적 Evicted 파드 수입니다. 현재 장애 판정에는 사용하지 않습니다.' }
                ]} />
            </DetailSectionCard>
            <DetailSectionCard icon={<ViewModuleIcon />} title={kind === 'daemonset' ? KUBERNETES_DAEMONSET_PLACEMENT_ROLLOUT_TITLE : translate('kubernetesReplicaRollout')}>
                {kind === 'statefulset' ? <KubernetesReplicaSummary
                    desired={desiredReplicas}
                    ready={readyReplicas}
                    current={currentReplicas}
                    updated={updatedReplicas}
                    unavailable={unavailableReplicas} /> : kind === 'deployment' ? <KubernetesReplicaSummary
                        desired={desiredReplicas}
                        available={availableReplicas}
                        updated={updatedReplicas}
                        unavailable={unavailableReplicas}
                        terms={['desired', 'available', 'updated', 'unavailable']} /> : kind === 'daemonset' ? <KubernetesDaemonSetPlacementSummary {...daemonPlacement} /> : <StatusEvidenceList columnHeaders={{ state: '상태', value: '결과' }}>
                    {(metrics as any[]).map((metric: any) => {
                        const unknown = metric.value === undefined || metric.value === null
                        const tone: DetailBadgeTone = unknown ? 'default' : metric.problem ? 'danger' : 'success'
                        return <StatusEvidenceRow
                            key={metric.label}
                            title={metric.label}
                            evidence={metric.evidence || `${kindLabel}의 현재 Replica/Rollout 집계입니다.`}
                            state={<DetailStatusIndicator tone={tone}>{unknown ? translate('kubernetesHealthUnknown') : metric.problem ? translate('kubernetesHealthCritical') : translate('kubernetesHealthNormal')}</DetailStatusIndicator>}
                            value={metric.value === undefined || metric.value === null ? '–' : metric.value}
                            tone={tone}
                            tooltipRawValue={metric.raw}
                        />
                    })}
                </StatusEvidenceList>}
                <DetailCardSubsectionHeader title={translate('kubernetesWorkloadConfiguration')} />
                <BasicInfoRows
                    density="compact"
                    rows={rolloutConfigurationRows}
                    labelWidth={122}
                    copyTooltip={translate('copy')}
                />
                {kind === 'statefulset' && <DetailAdvancedInfo
                    title={translate('kubernetesAdvancedInformation')}
                    hierarchy="supporting"
                    active={this.state.rolloutAdvanced}
                    onChange={rolloutAdvanced => this.setState({ rolloutAdvanced })}>
                    <BasicInfoRows density="compact" labelWidth={122} copyTooltip={translate('copy')} rows={[
                        { label: '현재 리비전', value: status.CurrentRevision ? <DetailLongValue value={String(status.CurrentRevision)} copy /> : translate('kubernetesNotCollected'), wrap: true },
                        { label: '업데이트 리비전', value: status.UpdateRevision ? <DetailLongValue value={String(status.UpdateRevision)} copy /> : translate('kubernetesNotCollected'), wrap: true },
                        { label: '시작 순번', value: spec.Ordinals?.Start === undefined ? 0 : Number(spec.Ordinals.Start) }
                    ]} />
                </DetailAdvancedInfo>}
                {kind === 'daemonset' && <DetailAdvancedInfo
                    title={translate('kubernetesAdvancedInformation')}
                    hierarchy="supporting"
                    active={this.state.rolloutAdvanced}
                    onChange={rolloutAdvanced => this.setState({ rolloutAdvanced })}>
                    <BasicInfoRows density="compact" labelWidth={122} rows={[
                        { label: '최소 준비 시간', value: spec.MinReadySeconds ?? spec.minReadySeconds ?? '설정되지 않음' },
                        { label: '리비전 이력 한도', value: spec.RevisionHistoryLimit ?? spec.revisionHistoryLimit ?? '설정되지 않음' }
                    ]} />
                </DetailAdvancedInfo>}
            </DetailSectionCard>
            {enhanced && <DetailSectionCard icon={<ViewModuleIcon />} title={translate('kubernetesContainersImages')}><KubernetesContainerDetails containers={workloadContainers.map(container => ({
                key: `${container.init ? 'init' : 'app'}:${container.name}`,
                name: container.name,
                kindLabel: container.init ? '초기화 컨테이너' : '일반 컨테이너',
                image: container.image,
                pullPolicy: container.pullPolicy,
                ports: container.ports,
                resources: container.resources,
                resourcesCollected: container.resourcesCollected
            }))} /></DetailSectionCard>}
            {enhanced && normalizeList(status.Conditions).length > 0 && <DetailSectionCard icon={<ErrorOutlineIcon />} title={translate('kubernetesWorkloadConditions')}>
                <KubernetesConditionRows
                    conditions={normalizeList(status.Conditions)}
                    definitions={kind === 'deployment' ? DEPLOYMENT_CONDITION_DEFINITIONS : kind === 'daemonset' ? DAEMONSET_CONDITION_DEFINITIONS : undefined} />
            </DetailSectionCard>}
            {operationalPolicyRows.length > 0 && <DetailSectionCard icon={<SettingsIcon />} title="운영 정책">
                <BasicInfoRows density="compact" rows={operationalPolicyRows} labelWidth={122} />
            </DetailSectionCard>}
            <ConnectedResourceListSection
                icon={<AccountTreeIcon />}
                title={translate('hostConnectedResources')}
                emptyText={translate('hostNoConnectedResources')}
                groups={kind === 'statefulset' ? [
                    { key: 'pods', title: '파드', items: this.connectedListItems(currentPods, 'Pod') },
                    { key: 'services', title: '서비스', items: this.connectedListItems(connectedServices, 'Service') },
                    { key: 'pvcs', title: 'PVC', items: this.connectedListItems(pvcTargets, 'PVC') }
                ] : kind === 'deployment' ? [
                    { key: 'replicaSets', title: 'ReplicaSet', items: this.connectedListItems(ownedReplicaSets, 'ReplicaSet') },
                    { key: 'pods', title: '파드', items: this.connectedListItems(currentPods, 'Pod') },
                    { key: 'services', title: '서비스', items: this.connectedListItems(connectedServices, 'Service') }
                ] : kind === 'daemonset' ? [
                    { key: 'pods', title: '파드', items: this.connectedListItems(currentPods, 'Pod') },
                    { key: 'services', title: '서비스', items: this.connectedListItems(connectedServices, 'Service') }
                ] : [
                    {
                        key: 'execution',
                        title: '실행 자원',
                        items: this.connectedListItems(currentPods, 'Pod')
                    },
                    {
                        key: 'network',
                        title: '네트워크',
                        items: [
                            ...this.connectedListItems(connectedServices, 'Service'),
                            ...this.connectedListItems(ingressTargets, 'Ingress'),
                            ...this.connectedListItems(endpointTargets, 'Endpoint')
                        ]
                    },
                    {
                        key: 'configuration',
                        title: '설정',
                        items: [
                            ...this.connectedListItems(configMapTargets, 'ConfigMap'),
                            ...this.connectedListItems(secretTargets, 'Secret')
                        ]
                    },
                    {
                        key: 'security',
                        title: '보안 및 권한',
                        items: [
                            ...this.connectedListItems(serviceAccountTargets, 'ServiceAccount'),
                            ...this.connectedListItems(networkPolicyTargets, 'NetworkPolicy')
                        ]
                    },
                    {
                        key: 'policy',
                        title: '운영 정책',
                        items: [
                            ...this.connectedListItems(operationalPolicies.hpas, 'HPA'),
                            ...this.connectedListItems(operationalPolicies.pdbs, 'PDB')
                        ]
                    },
                    {
                        key: 'storage',
                        title: '스토리지',
                        items: [
                            ...this.connectedListItems(pvcTargets, 'PVC'),
                            ...this.connectedListItems(boundStorage.pvs, 'PV'),
                            ...this.connectedListItems(boundStorage.storageClasses, 'StorageClass')
                        ]
                    }
                ]} />
            <DetailSectionCard icon={<HistoryOutlined />} title={translate('kubernetesWorkloadRecentEvents')}><KubernetesRecentEvents groups={recentEventGroups} lookbackLabel="최근 1시간" onResourceClick={group => {
                const target = this.topologyNodes().find(node => (!group.resourceUid || node.id === group.resourceUid || firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'UID']) === group.resourceUid)
                    && (!group.resourceName || firstValue(node.data || {}, ['Name', 'K8s.Name']) === group.resourceName))
                if (target) this.focusResources([target])
            }} /></DetailSectionCard>
            {kind === 'statefulset' && this.renderPvcTemplateModal(spec)}
        </div>
    }
}

export default KubernetesWorkloadDetailPanel
