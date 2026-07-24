import * as React from 'react'
import { Tooltip } from 'antd'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'
import ViewModuleIcon from '@material-ui/icons/ViewModule'
import { HistoryOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { Node } from '../Topology'
import { collectKubernetesEventGroups, ConnectedResourcesSection, DetailBadge, DetailCopyButton, DetailKeyValueList, DetailSection, formatKubernetesQuantity, KubernetesRecentEvents } from './common'
import './KubernetesNodeDetailPanel.css'
import './KubernetesWorkloadDetailPanel.css'

interface Props {
    node: Node
    nodeAttrs: (node: Node) => any
}

interface State { basicCollapsed: boolean }

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
const formatDate = (value: any): string => {
    if (!value || (typeof value === 'object' && !Object.keys(value).length)) return ''
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}
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
    cpuRequest: string
    cpuLimit: string
    memoryRequest: string
    memoryLimit: string
    init: boolean
}
type PodStatusTone = 'success' | 'warning' | 'danger' | 'unknown'
interface PodDisplayStatus { label: string, tone: PodStatusTone, nodeName: string, restarts: number }
const WORKLOAD_EVENT_TONES = {
    successfulcreate: 'success' as const,
    failedcreate: 'danger' as const,
    progressdeadlineexceeded: 'danger' as const,
    failedscale: 'danger' as const,
    scalingreplicaset: 'success' as const,
    successfuldelete: 'success' as const,
    faileddelete: 'warning' as const,
    sawcompletedjob: 'success' as const,
    failedjob: 'danger' as const
}

const normalizeList = (value: any): any[] => Array.isArray(value) ? value : []
const conditionValue = (condition: any, key: string): any => condition?.[key] ?? condition?.[key.charAt(0).toLowerCase() + key.slice(1)]
const numberValue = (value: any, fallback = 0): number => value === undefined || value === null || Number.isNaN(Number(value)) ? fallback : Number(value)
const optionalText = (value: any): string => value === undefined || value === null || String(value).trim() === '' ? translate('kubernetesNone') : String(value)
const flattenValues = (value: any, prefix = ''): Array<{ key: string, value: string }> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [{ key: prefix, value: optionalText(value) }] : []
    return Object.keys(value).reduce((items: Array<{ key: string, value: string }>, key) => {
        const path = prefix ? `${prefix}.${key}` : key
        const child = value[key]
        if (child && typeof child === 'object' && !Array.isArray(child)) return items.concat(flattenValues(child, path))
        items.push({ key: path, value: optionalText(child) })
        return items
    }, [])
}

class KubernetesWorkloadDetailPanel extends React.Component<Props, State> {
    state: State = { basicCollapsed: false }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id) this.setState({ basicCollapsed: false })
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
        const direct = (this.props.node.children || []).filter(node => String(node.data?.Type || '').toLowerCase() === 'pod')
        if (direct.length) return direct
        const data = this.props.node.data || {}
        const uid = firstValue(data, ['K8s.Extra.ObjectMeta.UID', 'UID']) || this.props.node.id
        const kind = String(data.Type || '').toLowerCase()
        const selector = firstRaw(data, ['K8s.Extra.Spec.Selector.MatchLabels', 'K8s.Extra.Spec.Selector']) || {}
        const selectorValues = new Map(flattenValues(selector).map(item => [item.key, item.value]))
        const topologyNodes = this.topologyNodes()
        const ownedJobUIDs = kind === 'cronjob' ? new Set(topologyNodes.filter(node => {
            if (!this.sameScope(node) || String(node.data?.Type || '').toLowerCase() !== 'job') return false
            const owners = firstRaw(node.data || {}, ['K8s.Extra.ObjectMeta.OwnerReferences']) || []
            return Array.isArray(owners) && owners.some(owner => String(owner?.UID || '') === uid)
        }).map(node => firstValue(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'UID']) || node.id)) : new Set<string>()
        return topologyNodes.filter(node => {
            if (!this.sameScope(node) || String(node.data?.Type || '').toLowerCase() !== 'pod') return false
            const owners = firstRaw(node.data || {}, ['K8s.Extra.ObjectMeta.OwnerReferences']) || []
            if (Array.isArray(owners) && owners.some(owner => String(owner?.UID || '') === uid)) return true
            if (ownedJobUIDs.size && Array.isArray(owners) && owners.some(owner => ownedJobUIDs.has(String(owner?.UID || '')))) return true
            const labels = firstRaw(node.data || {}, ['K8s.Labels', 'K8s.Extra.ObjectMeta.Labels']) || {}
            const labelValues = new Map(flattenValues(labels).map(item => [item.key, item.value]))
            return selectorValues.size > 0 && Array.from(selectorValues.entries()).every(([key, value]) => labelValues.get(key) === value)
        })
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        if (attrs.href) return <img className="netdive-k8s-node-detail__topology-icon-image" src={attrs.href} alt="" />
        return <span className={`netdive-k8s-node-detail__topology-icon ${attrs.iconClass || ''}`} aria-hidden="true">{attrs.icon}</span>
    }

    private focusResources(resources: Node[]) {
        const app = (window as any).App
        const ids = resources.map(resource => resource.id)
        if (ids.length && app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs(ids, this.props.node.id, true)
    }

    private connectedServices(pods: Node[]): Node[] {
        const podIDs = new Set(pods.map(pod => pod.id))
        const serviceIDs = new Set<string>()
        const links = (window as any).App?.tc?.links
        const topologyLinks: any[] = links instanceof Map ? Array.from(links.values()) : Array.isArray(links) ? links : []
        topologyLinks.forEach(link => {
            const sourceID = typeof link?.source === 'string' ? link.source : link?.source?.id
            const targetID = typeof link?.target === 'string' ? link.target : link?.target?.id
            const remoteID = podIDs.has(sourceID) ? targetID : podIDs.has(targetID) ? sourceID : ''
            const remote = remoteID ? this.topologyNodes().find(node => node.id === remoteID) : undefined
            if (remote && this.sameScope(remote) && String(remote.data?.Type || '').toLowerCase() === 'service') serviceIDs.add(remote.id)
        })
        return this.topologyNodes().filter(node => serviceIDs.has(node.id))
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

    private replicaSetReferences(pods: Node[]): string[] {
        const names = new Set<string>()
        pods.forEach(pod => normalizeList(firstRaw(pod.data || {}, ['K8s.Extra.ObjectMeta.OwnerReferences'])).forEach((owner: any) => {
            if (String(owner?.Kind || owner?.kind || '').toLowerCase() === 'replicaset' && (owner?.Name || owner?.name)) names.add(String(owner.Name || owner.name))
        }))
        return Array.from(names)
    }

    private pvcTargets(spec: any): Node[] {
        const workloadName = firstValue(this.props.node.data || {}, ['Name', 'K8s.Name'])
        const templateNames = normalizeList(spec?.VolumeClaimTemplates)
            .map((template: any) => firstValue(template, ['ObjectMeta.Name', 'Metadata.Name', 'metadata.name']))
            .filter(Boolean)
        if (!templateNames.length) return []
        return this.scopedResources(['persistentvolumeclaim', 'pvc']).filter(node => {
            const name = firstValue(node.data || {}, ['Name', 'K8s.Name'])
            return templateNames.some(templateName => name === templateName || name.indexOf(`${templateName}-${workloadName}-`) === 0)
        })
    }

    private selectorValue(spec: any): React.ReactNode {
        const selector = spec?.Selector?.MatchLabels || spec?.Selector || {}
        const values = flattenValues(selector)
        if (!values.length) return translate('kubernetesNone')
        const visible = values.slice(0, 2)
        const hidden = values.slice(2)
        return <span className="netdive-k8s-workload-detail__selector">
            {visible.map(item => <Tooltip key={item.key} title={`${item.key}=${item.value}`} placement="top"><span>{item.key}={item.value}</span></Tooltip>)}
            {hidden.length > 0 && <Tooltip title={hidden.map(item => `${item.key}=${item.value}`).join('\n')} placement="top"><small>{translate('kubernetesAdditionalItems').replace('{count}', String(hidden.length))}</small></Tooltip>}
        </span>
    }

    private containers(spec: any): ContainerDetail[] {
        const podSpec = spec?.Template?.Spec || {}
        const toDetail = (container: any, init: boolean): ContainerDetail => {
            const ports = normalizeList(container?.Ports).map((port: any) => {
                const value = port?.ContainerPort ?? port?.containerPort
                const protocol = port?.Protocol || port?.protocol || 'TCP'
                return value === undefined || value === null ? '' : `${value} / ${protocol}`
            }).filter(Boolean)
            const image = container?.Image || container?.image
            const none = translate('kubernetesNone')
            const unavailable = translate('kubernetesInformationUnavailable')
            return {
                name: optionalText(container?.Name || container?.name),
                image: image ? String(image) : translate('kubernetesImageUnavailable'),
                pullPolicy: optionalText(container?.ImagePullPolicy || container?.imagePullPolicy),
                ports,
                cpuRequest: formatKubernetesQuantity(container?.Resources?.Requests?.cpu ?? container?.resources?.requests?.cpu, none, unavailable),
                cpuLimit: formatKubernetesQuantity(container?.Resources?.Limits?.cpu ?? container?.resources?.limits?.cpu, none, unavailable),
                memoryRequest: formatKubernetesQuantity(container?.Resources?.Requests?.memory ?? container?.resources?.requests?.memory, none, unavailable),
                memoryLimit: formatKubernetesQuantity(container?.Resources?.Limits?.memory ?? container?.resources?.limits?.memory, none, unavailable),
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
        return { tone: 'success', label: translate('kubernetesHealthNormal'), conclusion: translate('kubernetesWorkloadCapacityReady'), progress: translate('kubernetesRolloutComplete'), progressTone: 'success' }
    }

    private statefulSetHealth(spec: any, status: any, pvcTargets: Node[]): WorkloadHealth {
        const desired = numberValue(spec.Replicas)
        const ready = numberValue(status.ReadyReplicas)
        const current = numberValue(status.CurrentReplicas)
        const updated = numberValue(status.UpdatedReplicas)
        const revisionKnown = !!status.CurrentRevision && !!status.UpdateRevision
        const revisionSynced = revisionKnown && status.CurrentRevision === status.UpdateRevision
        const revisionUpdating = revisionKnown && !revisionSynced
        const failure = normalizeList(status.Conditions).some(condition => {
            const type = String(conditionValue(condition, 'Type')).toLowerCase()
            const reason = String(conditionValue(condition, 'Reason')).toLowerCase()
            return String(conditionValue(condition, 'Status')).toLowerCase() === 'true' && (/fail|error/.test(type) || /fail|error/.test(reason))
        })
        const pvcPhases = pvcTargets.map(node => firstValue(node.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Status', 'Status']).toLowerCase())
        const pvcLost = pvcPhases.some(phase => phase === 'lost')
        const pvcPending = pvcPhases.some(phase => phase === 'pending')
        if ((desired > 0 && ready === 0) || failure || pvcLost) {
            return { tone: 'danger', label: translate('kubernetesHealthCritical'), conclusion: translate('kubernetesWorkloadNoReadyReplicas'), progress: revisionKnown ? revisionSynced ? translate('kubernetesRevisionSynced') : translate('kubernetesRevisionUpdating') : translate('kubernetesNotCollected'), progressTone: 'danger' }
        }
        if (revisionUpdating || updated < desired || ready < desired) {
            return { tone: ready > 0 ? 'info' : 'warning', label: ready > 0 ? translate('kubernetesWorkloadUpdating') : translate('kubernetesHealthWarning'), conclusion: ready > 0 ? translate('kubernetesWorkloadRevisionApplying') : translate('kubernetesWorkloadPartialReplicas'), progress: translate('kubernetesRevisionUpdating'), progressTone: ready > 0 ? 'info' : 'warning' }
        }
        if (current !== desired || pvcPending) {
            return { tone: 'warning', label: translate('kubernetesHealthWarning'), conclusion: translate('kubernetesWorkloadPartialReplicas'), progress: revisionKnown ? translate('kubernetesRevisionSynced') : translate('kubernetesNotCollected'), progressTone: 'warning' }
        }
        return { tone: 'success', label: translate('kubernetesHealthNormal'), conclusion: translate('kubernetesWorkloadCapacityReady'), progress: revisionKnown ? translate('kubernetesRevisionSynced') : translate('kubernetesNotCollected'), progressTone: revisionKnown ? 'success' : 'default' }
    }

    private podDisplayStatus(pod: Node): PodDisplayStatus {
        const data = pod.data || {}
        const phase = firstValue(data, ['K8s.Extra.Status.Phase', 'K8s.Status', 'Status']) || translate('kubernetesUnknown')
        const containerStatuses = firstRaw(data, ['K8s.Extra.Status.ContainerStatuses'])
        const statuses = Array.isArray(containerStatuses) ? containerStatuses : []
        const waitingReason = statuses.map(status => firstValue(status, ['State.Waiting.Reason', 'state.waiting.reason'])).find(Boolean)
        const terminatedReason = statuses.map(status => firstValue(status, ['State.Terminated.Reason', 'state.terminated.reason'])).find(Boolean)
        const reason = waitingReason || terminatedReason
        const label = reason || phase
        const normalized = String(label).toLowerCase()
        const tone: PodStatusTone = normalized === 'running' || normalized === 'succeeded'
            ? 'success'
            : normalized === 'failed' || normalized === 'oomkilled' || normalized === 'error'
                ? 'danger'
                : normalized === 'pending' || normalized.indexOf('backoff') >= 0 || normalized.indexOf('pull') >= 0
                    ? 'warning'
                    : 'unknown'
        const restarts = statuses.reduce((sum, status) => sum + Number(status?.RestartCount ?? status?.restartCount ?? 0), 0)
        const nodeName = firstValue(data, ['K8s.Extra.Spec.NodeName', 'K8s.Node', 'NodeName'])
        return { label, tone, nodeName, restarts }
    }

    private metrics(kind: string, spec: any, status: any): Array<{ label: string, value: any, problem?: boolean }> {
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
                { label: translate('kubernetesCurrentReplicas'), value: intOrUndefined(status.CurrentReplicas), problem: numberValue(status.CurrentReplicas) < numberValue(spec.Replicas) },
                { label: translate('kubernetesUpdatedReplicas'), value: intOrUndefined(status.UpdatedReplicas), problem: numberValue(status.UpdatedReplicas) < numberValue(spec.Replicas) }
            ]
            case 'daemonset': return [
                { label: translate('kubernetesDesiredNodes'), value: intOrUndefined(status.DesiredNumberScheduled) },
                { label: translate('kubernetesReadyNodes'), value: intOrUndefined(status.NumberReady) },
                { label: translate('kubernetesAvailableNodes'), value: intOrUndefined(status.NumberAvailable) },
                { label: translate('kubernetesMisscheduledNodes'), value: intOrUndefined(status.NumberMisscheduled), problem: Number(status.NumberMisscheduled || 0) > 0 }
            ]
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
                { label: 'Max Surge', value: spec.Strategy?.RollingUpdate?.MaxSurge?.StrVal || (spec.Strategy?.RollingUpdate?.MaxSurge?.IntVal ?? translate('kubernetesNotCollected')) },
                { label: 'Max Unavailable', value: spec.Strategy?.RollingUpdate?.MaxUnavailable?.StrVal || (spec.Strategy?.RollingUpdate?.MaxUnavailable?.IntVal ?? translate('kubernetesNotCollected')) },
                { label: translate('kubernetesProgress'), value: Number(status.UnavailableReplicas || 0) > 0 ? <DetailBadge tone="warning">{translate('kubernetesInProgress')}</DetailBadge> : translate('kubernetesStable') }
            ]
            case 'statefulset': return [
                { label: 'Current Revision', value: status.CurrentRevision || translate('kubernetesNotCollected'), textValue: status.CurrentRevision || undefined },
                { label: 'Update Revision', value: status.UpdateRevision || translate('kubernetesNotCollected'), textValue: status.UpdateRevision || undefined },
                { label: 'Pod Management Policy', value: spec.PodManagementPolicy || translate('kubernetesNotCollected') },
                { label: 'PVC Template', value: Array.isArray(spec.VolumeClaimTemplates) && spec.VolumeClaimTemplates.length ? spec.VolumeClaimTemplates.map((item: any) => item?.ObjectMeta?.Name || item?.Metadata?.Name).filter(Boolean).join(', ') : translate('kubernetesNone') }
            ]
            case 'daemonset': return [
                { label: translate('kubernetesUpdateStrategy'), value: spec.UpdateStrategy?.Type || translate('kubernetesNotCollected') },
                { label: translate('kubernetesCurrentNodes'), value: optionalNumber(status.CurrentNumberScheduled) },
                { label: translate('kubernetesUpdatedNodes'), value: optionalNumber(status.UpdatedNumberScheduled) },
                { label: translate('kubernetesUnavailableNodes'), value: optionalNumber(status.NumberUnavailable) }
            ]
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

    private rolloutRows(kind: string, spec: any, status: any, health: WorkloadHealth, replicaSetNames: string[]): any[] {
        if (kind === 'deployment') {
            const rows: any[] = [
                { label: translate('kubernetesDeploymentStrategy'), value: optionalText(spec.Strategy?.Type) },
                { label: 'Max Surge', value: optionalText(spec.Strategy?.RollingUpdate?.MaxSurge?.StrVal || spec.Strategy?.RollingUpdate?.MaxSurge?.IntVal) },
                { label: 'Max Unavailable', value: optionalText(spec.Strategy?.RollingUpdate?.MaxUnavailable?.StrVal || spec.Strategy?.RollingUpdate?.MaxUnavailable?.IntVal) },
                { label: translate('kubernetesProgress'), value: <span className={`netdive-k8s-workload-detail__inline-state is-${health.progressTone}`}>{health.progress}</span> }
            ]
            if (replicaSetNames.length) rows.push({ label: translate('kubernetesCurrentReplicaSet'), value: replicaSetNames[0], textValue: replicaSetNames[0], copyText: replicaSetNames[0] })
            if (replicaSetNames.length > 1) rows.push({ label: translate('kubernetesPreviousReplicaSets'), value: replicaSetNames.length - 1 })
            return rows
        }
        if (kind === 'statefulset') {
            const currentRevision = status.CurrentRevision || ''
            const updateRevision = status.UpdateRevision || ''
            const templates = normalizeList(spec.VolumeClaimTemplates)
            return [
                { label: translate('kubernetesUpdateStrategy'), value: optionalText(spec.UpdateStrategy?.Type) },
                { label: translate('kubernetesPodManagementPolicy'), value: optionalText(spec.PodManagementPolicy) },
                ...(currentRevision ? [{ label: 'Current Revision', value: currentRevision, textValue: currentRevision, copyText: currentRevision }] : []),
                ...(updateRevision ? [{ label: 'Update Revision', value: updateRevision, textValue: updateRevision, copyText: updateRevision }] : []),
                { label: translate('kubernetesRevisionStatus'), value: <span className={`netdive-k8s-workload-detail__inline-state is-${health.progressTone}`}>{health.progress}</span> },
                { label: translate('kubernetesStartOrdinal'), value: numberValue(spec.Ordinals?.Start, 0) },
                { label: 'PVC Template', value: templates.length || translate('kubernetesNone') }
            ]
        }
        return this.configurationRows(kind, spec, status)
    }

    private conditionTone(condition: any): WorkloadTone {
        const type = String(conditionValue(condition, 'Type') || '')
        const status = String(conditionValue(condition, 'Status') || '').toLowerCase()
        const reason = String(conditionValue(condition, 'Reason') || '').toLowerCase()
        const normalized = type.toLowerCase()
        if (reason === 'progressdeadlineexceeded' || ((/failure|failed|error|degraded/.test(normalized) || /failure|failed|error/.test(reason)) && status === 'true')) return 'danger'
        if (/failure|failed|error|degraded/.test(normalized)) return status === 'false' ? 'success' : 'warning'
        if (status === 'true' && (normalized === 'available' || normalized === 'progressing' || normalized === 'ready')) return 'success'
        if (status === 'false') return 'warning'
        return 'default'
    }

    private renderConditions(status: any) {
        const conditions = normalizeList(status.Conditions)
        if (!conditions.length) return <div className="netdive-k8s-workload-detail__empty netdive-k8s-workload-detail__empty--compact"><ErrorOutlineIcon />{translate('kubernetesNoConditions')}</div>
        return <div className="netdive-k8s-workload-detail__conditions">
            <div className="netdive-k8s-workload-detail__condition-head"><span>Condition</span><span>{translate('kubernetesConditionStatus')}</span><span>Reason</span></div>
            {conditions.map((condition: any, index: number) => {
                const type = conditionValue(condition, 'Type') || translate('kubernetesUnknown')
                const state = conditionValue(condition, 'Status') || translate('kubernetesUnknown')
                const reason = conditionValue(condition, 'Reason') || '–'
                const tone = this.conditionTone(condition)
                return <Tooltip key={`${type}:${index}`} title={conditionValue(condition, 'Message') || reason} placement="top">
                    <div className="netdive-k8s-workload-detail__condition">
                        <strong>{type}</strong>
                        <span className={`netdive-k8s-workload-detail__condition-state is-${tone}`}><i />{state}</span>
                        <small>{reason}</small>
                    </div>
                </Tooltip>
            })}
        </div>
    }

    private renderContainers(containers: ContainerDetail[]) {
        if (!containers.length) return <div className="netdive-k8s-workload-detail__empty netdive-k8s-workload-detail__empty--compact">{translate('kubernetesPodContainersUnavailable')}</div>
        return <div className="netdive-k8s-workload-detail__containers">{containers.map((container, index) => {
            return <details className="netdive-k8s-workload-detail__container" open={index === 0} key={`${container.init ? 'init' : 'app'}:${container.name}`}>
                <summary><span><strong>{container.name}</strong><small>{container.init ? 'Init Container' : 'Container'}</small></span><i /></summary>
                <div className="netdive-k8s-workload-detail__container-body">
                    <div className="netdive-k8s-workload-detail__container-image">
                        <span>{translate('kubernetesContainerImage')}</span>
                        <div><Tooltip title={container.image} placement="top"><b>{container.image}</b></Tooltip>{container.image !== translate('kubernetesImageUnavailable') && <DetailCopyButton value={container.image} tooltip={translate('copy')} />}</div>
                    </div>
                    <div className="netdive-k8s-workload-detail__container-runtime">
                        <div className="netdive-k8s-workload-detail__container-row"><span>{translate('kubernetesImagePullPolicy')}</span><b>{container.pullPolicy}</b></div>
                        <div className="netdive-k8s-workload-detail__container-row">
                            <span>{translate('kubernetesContainerPorts')}</span>
                            <b className="netdive-k8s-workload-detail__container-port-list">{container.ports.length
                                ? container.ports.map((port, portIndex) => <span key={`${port}:${portIndex}`}>{port}</span>)
                                : translate('kubernetesNone')}</b>
                        </div>
                    </div>
                    <div className="netdive-k8s-workload-detail__container-subtitle">{translate('kubernetesResourceConfiguration')}</div>
                    <div className="netdive-k8s-workload-detail__container-resources">
                        <div><span>CPU Request</span><b>{container.cpuRequest}</b></div>
                        <div><span>CPU Limit</span><b>{container.cpuLimit}</b></div>
                        <div><span>Memory Request</span><b>{container.memoryRequest}</b></div>
                        <div><span>Memory Limit</span><b>{container.memoryLimit}</b></div>
                    </div>
                </div>
            </details>
        })}</div>
    }

    private renderStorage(spec: any, pvcTargets: Node[]) {
        const templates = normalizeList(spec.VolumeClaimTemplates)
        if (!templates.length) return null
        return <DetailSection icon={<StorageIcon />} title={translate('kubernetesStorageConfiguration')}>
            <div className="netdive-k8s-workload-detail__storage">{templates.map((template: any, index: number) => {
                const name = firstValue(template, ['ObjectMeta.Name', 'Metadata.Name', 'metadata.name']) || `${translate('kubernetesPvcTemplate')} ${index + 1}`
                const templateTargets = pvcTargets.filter(node => {
                    const targetName = firstValue(node.data || {}, ['Name', 'K8s.Name'])
                    return targetName === name || targetName.indexOf(`${name}-`) === 0
                })
                const bound = templateTargets.filter(node => firstValue(node.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Status', 'Status']).toLowerCase() === 'bound').length
                const storageClass = firstValue(template, ['Spec.StorageClassName', 'spec.storageClassName'])
                const requested = firstValue(template, ['Spec.Resources.Requests.storage', 'spec.resources.requests.storage'])
                const accessModes = firstRaw(template, ['Spec.AccessModes', 'spec.accessModes'])
                return <div key={`${name}:${index}`}>
                    <strong>{name}</strong>
                    <dl>
                        <div><dt>StorageClass</dt><dd>{optionalText(storageClass)}</dd></div>
                        <div><dt>{translate('kubernetesRequestedCapacity')}</dt><dd>{optionalText(requested)}</dd></div>
                        <div><dt>Access Mode</dt><dd>{Array.isArray(accessModes) && accessModes.length ? accessModes.join(', ') : translate('kubernetesNone')}</dd></div>
                        <div><dt>PVC</dt><dd>{templateTargets.length ? `${bound}/${templateTargets.length} Bound` : translate('kubernetesNotCollected')}</dd></div>
                    </dl>
                </div>
            })}</div>
        </DetailSection>
    }

    render() {
        const data = this.props.node.data || {}
        const extra = firstRaw(data, ['K8s.Extra']) || {}
        const spec = extra.Spec || {}
        const status = extra.Status || {}
        const meta = extra.ObjectMeta || {}
        const kind = String(data.Type || '').toLowerCase()
        const kindLabel = WORKLOAD_KIND_LABELS[kind] || kind
        const enhanced = kind === 'deployment' || kind === 'statefulset'
        const pods = this.pods()
        const linkedServices = this.connectedServices(pods)
        const declaredService = kind === 'statefulset' && spec.ServiceName
            ? this.scopedResources(['service']).find(node => firstValue(node.data || {}, ['Name', 'K8s.Name']) === String(spec.ServiceName))
            : undefined
        const connectedServices = Array.from(new Map(linkedServices.concat(declaredService ? [declaredService] : []).map(service => [service.id, service])).values())
        const replicaSetNames = this.replicaSetReferences(pods)
        const replicaSetNameSet = new Set(replicaSetNames)
        const replicaSetTargets = this.scopedResources(['replicaset']).filter(node => replicaSetNameSet.has(firstValue(node.data || {}, ['Name', 'K8s.Name'])))
        const configMapTargets = this.referencedResources(spec, ['configmap'])
        const secretTargets = this.referencedResources(spec, ['secret'])
        const pvcTargets = kind === 'statefulset' ? this.pvcTargets(spec) : []
        const workloadContainers = enhanced ? this.containers(spec) : []
        const headlessServices = connectedServices.filter(service => {
            const serviceSpec = firstRaw(service.data || {}, ['K8s.Extra.Spec']) || {}
            const clusterIP = serviceSpec.ClusterIP || serviceSpec.ClusterIp
            const clusterIPs = normalizeList(serviceSpec.ClusterIPs)
            return String(clusterIP || '').toLowerCase() === 'none' || clusterIPs.some(value => String(value).toLowerCase() === 'none')
        })
        const headlessServiceIDs = new Set(headlessServices.map(service => service.id))
        const regularServices = connectedServices.filter(service => !headlessServiceIDs.has(service.id))
        const podStatuses = new Map(pods.map(pod => [pod.id, this.podDisplayStatus(pod)]))
        const problemPods = Array.from(podStatuses.values()).filter(status => status.tone === 'warning' || status.tone === 'danger').length
        const metrics = this.metrics(kind, spec, status)
        const metricProblem = metrics.some(metric => metric.problem)
        const critical = kind === 'job' && Number(status.Failed || 0) > 0 && Number(status.Active || 0) === 0
        const warning = metricProblem || problemPods > 0
        const statusTone = critical ? 'danger' : warning ? 'warning' : 'success'
        const statusLabel = critical ? translate('kubernetesHealthCritical') : warning ? translate('kubernetesHealthWarning') : translate('kubernetesHealthNormal')
        const conclusion = critical ? translate('kubernetesWorkloadFailedConclusion') : warning ? translate('kubernetesWorkloadWarningConclusion') : translate('kubernetesWorkloadNormalConclusion')
        const health = kind === 'deployment'
            ? this.deploymentHealth(spec, status)
            : kind === 'statefulset'
                ? this.statefulSetHealth(spec, status, pvcTargets)
                : undefined
        const desiredReplicas = numberValue(spec.Replicas)
        const readyReplicas = kind === 'deployment' ? numberValue(status.AvailableReplicas) : numberValue(status.ReadyReplicas)
        const basicRows = [
            { label: translate('kubernetesWorkloadName'), value: data.Name || this.props.node.id, textValue: data.Name || this.props.node.id, copyText: data.Name || this.props.node.id },
            { label: translate('kubernetesWorkloadType'), value: kindLabel },
            { label: translate('kubernetesTopologyNamespaces'), value: data.K8s?.Namespace || meta.Namespace || translate('kubernetesNotCollected') },
            ...(enhanced ? [
                { label: translate('kubernetesCreatedAt'), value: formatDate(meta.CreationTimestamp?.Time || meta.CreationTimestamp) || translate('kubernetesNotCollected') },
                { label: 'Selector', value: this.selectorValue(spec) }
            ] : [])
        ]
        const recentEventGroups = collectKubernetesEventGroups([
            firstRaw(data, ['K8s.Extra.Events', 'K8s.Events', 'Events'])
        ], WORKLOAD_EVENT_TONES)
        const connectedItems = kind === 'deployment'
            ? [
                ...(replicaSetTargets.length ? [{ key: 'replicasets', label: 'ReplicaSet', count: replicaSetTargets.length, icon: this.topologyIcon(replicaSetTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(replicaSetTargets) }] : []),
                ...(pods.length ? [{ key: 'pods', label: translate('kubernetesTopologyPods'), count: pods.length, icon: this.topologyIcon(pods[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(pods) }] : []),
                ...(connectedServices.length ? [{ key: 'services', label: translate('kubernetesTopologyServices'), count: connectedServices.length, icon: this.topologyIcon(connectedServices[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(connectedServices) }] : []),
                ...(configMapTargets.length ? [{ key: 'configmaps', label: 'ConfigMap', count: configMapTargets.length, icon: this.topologyIcon(configMapTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(configMapTargets) }] : []),
                ...(secretTargets.length ? [{ key: 'secrets', label: 'Secret', count: secretTargets.length, icon: this.topologyIcon(secretTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(secretTargets) }] : [])
            ]
            : kind === 'statefulset'
                ? [
                    ...(pods.length ? [{ key: 'pods', label: translate('kubernetesTopologyPods'), count: pods.length, icon: this.topologyIcon(pods[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(pods) }] : []),
                    ...(headlessServices.length ? [{ key: 'headless-services', label: 'Headless Service', count: headlessServices.length, icon: this.topologyIcon(headlessServices[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(headlessServices) }] : []),
                    ...(regularServices.length ? [{ key: 'services', label: translate('kubernetesTopologyServices'), count: regularServices.length, icon: this.topologyIcon(regularServices[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(regularServices) }] : []),
                    ...(pvcTargets.length ? [{ key: 'pvcs', label: 'PVC', count: pvcTargets.length, icon: this.topologyIcon(pvcTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(pvcTargets) }] : []),
                    ...(configMapTargets.length ? [{ key: 'configmaps', label: 'ConfigMap', count: configMapTargets.length, icon: this.topologyIcon(configMapTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(configMapTargets) }] : []),
                    ...(secretTargets.length ? [{ key: 'secrets', label: 'Secret', count: secretTargets.length, icon: this.topologyIcon(secretTargets[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(secretTargets) }] : [])
                ]
                : [
                    ...(pods.length ? [{ key: 'pods', label: translate('kubernetesTopologyPods'), count: pods.length, icon: this.topologyIcon(pods[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(pods) }] : []),
                    ...(connectedServices.length ? [{ key: 'services', label: translate('kubernetesTopologyServices'), count: connectedServices.length, icon: this.topologyIcon(connectedServices[0]), iconTone: 'kubernetes' as const, onClick: () => this.focusResources(connectedServices) }] : [])
                ]
        return <div className="netdive-k8s-node-detail netdive-k8s-workload-detail">
            <DetailSection icon={<InfoIcon />} title={translate('kubernetesWorkloadBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <DetailKeyValueList rows={basicRows} copyTooltip={translate('copy')} />
            </DetailSection>

            <DetailSection icon={this.topologyIcon(this.props.node)} title={`${kindLabel} ${translate('kubernetesOperationalStatusShort')}`}>
                <div className={`netdive-k8s-node-detail__hero netdive-k8s-node-detail__hero--${health ? health.tone : statusTone}`}><i /><strong>{health ? health.label : statusLabel}</strong><span>{health ? health.conclusion : conclusion}</span></div>
                {health && <div className="netdive-k8s-workload-detail__status-summary">
                    <div><span>{kind === 'deployment' ? translate('kubernetesAvailableReplicas') : translate('kubernetesReadyReplicas')}</span><strong>{readyReplicas}/{desiredReplicas}</strong></div>
                    <div><span>{kind === 'deployment' ? translate('kubernetesProgress') : translate('kubernetesRevisionStatus')}</span><strong className={`is-${health.progressTone}`}>{health.progress}</strong></div>
                </div>}
            </DetailSection>
            <DetailSection icon={<ViewModuleIcon />} title={translate('kubernetesReplicaRollout')}>
                <div className="netdive-k8s-node-detail__summary">{metrics.map(metric => <div key={metric.label}><span>{metric.label}</span><strong className={metric.problem ? 'is-danger' : ''}>{metric.value === undefined || metric.value === null ? '–' : metric.value}</strong></div>)}</div>
                <div className="netdive-k8s-node-detail__subsection-title">{translate('kubernetesWorkloadConfiguration')}</div>
                <DetailKeyValueList rows={enhanced && health ? this.rolloutRows(kind, spec, status, health, replicaSetNames) : this.configurationRows(kind, spec, status)} copyTooltip={translate('copy')} />
            </DetailSection>
            {enhanced && kind === 'statefulset' && this.renderStorage(spec, pvcTargets)}
            {enhanced && <DetailSection icon={<ViewModuleIcon />} title={translate('kubernetesContainersImages')}>{this.renderContainers(workloadContainers)}</DetailSection>}
            {enhanced && <DetailSection icon={<ErrorOutlineIcon />} title={translate('kubernetesWorkloadConditions')}>{this.renderConditions(status)}</DetailSection>}
            <ConnectedResourcesSection
                icon={<AccountTreeIcon />}
                title={translate('hostConnectedResources')}
                emptyText={translate('hostNoConnectedResources')}
                groups={[{
                    key: 'kubernetes',
                    title: translate('kubernetesConnectedResourceGroup'),
                    icon: <img src="assets/icons/k8s.png" alt="" />,
                    items: connectedItems
                }]} />
            {!enhanced && recentEventGroups.length > 0 && <DetailSection icon={<HistoryOutlined />} title={translate('kubernetesWorkloadRecentEvents')}><KubernetesRecentEvents groups={recentEventGroups} /></DetailSection>}
        </div>
    }
}

export default KubernetesWorkloadDetailPanel
