import * as React from 'react'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'
import ViewModuleIcon from '@material-ui/icons/ViewModule'
import { RightOutlined } from '@ant-design/icons'

import { translate } from '../Config'
import { Node } from '../Topology'
import { DetailBadge, DetailKeyValueList, DetailSection } from './common'
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
type PodStatusTone = 'success' | 'warning' | 'danger' | 'unknown'
interface PodDisplayStatus { label: string, tone: PodStatusTone, nodeName: string, restarts: number }

class KubernetesWorkloadDetailPanel extends React.Component<Props, State> {
    state: State = { basicCollapsed: true }

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
            const keys = selector && typeof selector === 'object' ? Object.keys(selector) : []
            return keys.length > 0 && keys.every(key => String(labels[key]) === String(selector[key]))
        })
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        if (attrs.href) return <img className="netdive-k8s-node-detail__topology-icon-image" src={attrs.href} alt="" />
        return <span className={`netdive-k8s-node-detail__topology-icon ${attrs.iconClass || ''}`} aria-hidden="true">{attrs.icon}</span>
    }

    private focusPod(pod: Node) {
        const app = (window as any).App
        if (app && typeof app.focusInfrastructureNodeIDs === 'function') app.focusInfrastructureNodeIDs([pod.id], this.props.node.id)
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
                { label: translate('kubernetesAvailableReplicas'), value: intOrUndefined(status.AvailableReplicas) },
                { label: translate('kubernetesUpdatedReplicas'), value: intOrUndefined(status.UpdatedReplicas) },
                { label: translate('kubernetesUnavailableReplicas'), value: intOrUndefined(status.UnavailableReplicas), problem: Number(status.UnavailableReplicas || 0) > 0 }
            ]
            case 'statefulset': return [
                { label: translate('kubernetesDesiredReplicas'), value: intOrUndefined(spec.Replicas) },
                { label: translate('kubernetesReadyReplicas'), value: intOrUndefined(status.ReadyReplicas) },
                { label: translate('kubernetesCurrentReplicas'), value: intOrUndefined(status.CurrentReplicas) },
                { label: translate('kubernetesUpdatedReplicas'), value: intOrUndefined(status.UpdatedReplicas) }
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

    render() {
        const data = this.props.node.data || {}
        const extra = firstRaw(data, ['K8s.Extra']) || {}
        const spec = extra.Spec || {}
        const status = extra.Status || {}
        const meta = extra.ObjectMeta || {}
        const kind = String(data.Type || '').toLowerCase()
        const kindLabel = WORKLOAD_KIND_LABELS[kind] || kind
        const pods = this.pods()
        const podStatuses = new Map(pods.map(pod => [pod.id, this.podDisplayStatus(pod)]))
        const problemPods = Array.from(podStatuses.values()).filter(status => status.tone === 'warning' || status.tone === 'danger').length
        const metrics = this.metrics(kind, spec, status)
        const metricProblem = metrics.some(metric => metric.problem)
        const critical = kind === 'job' && Number(status.Failed || 0) > 0 && Number(status.Active || 0) === 0
        const warning = metricProblem || problemPods > 0
        const statusTone = critical ? 'danger' : warning ? 'warning' : 'success'
        const statusLabel = critical ? translate('kubernetesHealthCritical') : warning ? translate('kubernetesHealthWarning') : translate('kubernetesHealthNormal')
        const conclusion = critical ? translate('kubernetesWorkloadFailedConclusion') : warning ? translate('kubernetesWorkloadWarningConclusion') : translate('kubernetesWorkloadNormalConclusion')
        const placements = new Set(pods.map(pod => firstValue(pod.data || {}, ['K8s.Extra.Spec.NodeName', 'K8s.Node', 'NodeName'])).filter(Boolean))
        const ownerNames = new Set<string>()
        pods.forEach(pod => {
            const owners = firstRaw(pod.data || {}, ['K8s.Extra.ObjectMeta.OwnerReferences']) || []
            if (Array.isArray(owners)) owners.forEach(owner => owner?.Name && ownerNames.add(owner.Name))
        })
        const distribution = pods.length === 0 || placements.size === 0
            ? translate('kubernetesEvaluationUnavailable')
            : pods.length === 1
                ? translate('kubernetesSinglePod')
                : placements.size <= 1
                    ? <DetailBadge tone="warning">{translate('kubernetesConcentrated')}</DetailBadge>
                    : translate('kubernetesDistributed')
        const relatedOwnerNames = Array.from(ownerNames).filter(name => name !== String(data.Name || ''))
        const relationRows: any[] = [
            { label: translate('kubernetesPlacementNodes'), value: placements.size },
            { label: translate('kubernetesPodDistribution'), value: distribution }
        ]
        if (relatedOwnerNames.length) {
            const ownerValue = relatedOwnerNames.join(', ')
            relationRows.push({ label: kind === 'deployment' ? 'ReplicaSet' : translate('kubernetesPodOwners'), value: ownerValue, textValue: ownerValue })
        }
        const basicRows = [
            { label: translate('kubernetesWorkloadName'), value: data.Name || this.props.node.id, textValue: data.Name || this.props.node.id, copyText: data.Name || this.props.node.id },
            { label: 'Kind', value: kindLabel },
            { label: 'UID', value: meta.UID || this.props.node.id, textValue: meta.UID || this.props.node.id, copyText: meta.UID || this.props.node.id },
            { label: translate('kubernetesTopologyNamespaces'), value: data.K8s?.Namespace || meta.Namespace || translate('kubernetesNotCollected') },
            { label: translate('kubernetesCreatedAt'), value: formatDate(meta.CreationTimestamp?.Time) || translate('kubernetesNotCollected') }
        ]

        return <div className="netdive-k8s-node-detail netdive-k8s-workload-detail">
            <DetailSection icon={this.topologyIcon(this.props.node)} title={`${kindLabel} ${translate('kubernetesOperationalStatusShort')}`}>
                <div className={`netdive-k8s-node-detail__hero netdive-k8s-node-detail__hero--${statusTone}`}><i /><strong>{statusLabel}</strong><span>{conclusion}</span></div>
                <div className="netdive-k8s-node-detail__summary">{metrics.map(metric => <div key={metric.label}><span>{metric.label}</span><strong className={metric.problem ? 'is-danger' : ''}>{metric.value === undefined || metric.value === null ? '–' : metric.value}</strong></div>)}</div>
            </DetailSection>
            <DetailSection icon={<ViewModuleIcon />} title={translate('kubernetesWorkloadConfiguration')}><DetailKeyValueList rows={this.configurationRows(kind, spec, status)} /></DetailSection>
            <DetailSection icon={<AccountTreeIcon />} title={translate('kubernetesConnectedPods')}>
                {pods.length > 0 ? <div className="netdive-k8s-workload-detail__pod-list">{pods.map(pod => {
                    const podStatus = podStatuses.get(pod.id)!
                    const podName = String(pod.data?.Name || pod.id)
                    const podMeta = [podStatus.nodeName, podStatus.restarts > 0 ? `Restart ${podStatus.restarts}` : ''].filter(Boolean).join(' · ')
                    return <button type="button" key={pod.id} className="netdive-k8s-workload-detail__pod" onClick={() => this.focusPod(pod)} aria-label={podName}>
                        <span className="netdive-k8s-workload-detail__pod-icon">{this.topologyIcon(pod)}</span>
                        <span className="netdive-k8s-workload-detail__pod-main">
                            <strong title={podName}>{podName}</strong>
                            {podMeta && <small title={podMeta}>{podMeta}</small>}
                        </span>
                        <span className={`netdive-k8s-workload-detail__pod-status is-${podStatus.tone}`}><i />{podStatus.label}</span>
                        <RightOutlined className="netdive-k8s-workload-detail__pod-action" />
                    </button>
                })}</div> : <div className="netdive-k8s-workload-detail__empty">{translate('kubernetesNoConnectedPods')}</div>}
            </DetailSection>
            <DetailSection icon={<StorageIcon />} title={translate('kubernetesPlacementAndRelations')}><DetailKeyValueList rows={relationRows} /></DetailSection>
            <DetailSection icon={<ErrorOutlineIcon />} title={translate('kubernetesWorkloadConditions')}>
                {Array.isArray(status.Conditions) && status.Conditions.length ? <div className="netdive-k8s-workload-detail__conditions">{status.Conditions.map((condition: any) => <div key={condition.Type}><strong>{condition.Type}</strong><span className={String(condition.Status).toLowerCase() === 'true' ? 'is-normal' : 'is-warning'}>{condition.Status}</span><small>{condition.Reason || '–'}</small></div>)}</div> : <div className="netdive-k8s-workload-detail__empty">{translate('kubernetesNoConditions')}</div>}
            </DetailSection>
            <DetailSection icon={<InfoIcon />} title={translate('kubernetesWorkloadBasicInfo')} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}><DetailKeyValueList rows={basicRows} copyTooltip={translate('copy')} /></DetailSection>
        </div>
    }
}

export default KubernetesWorkloadDetailPanel
