import * as React from 'react'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import HistoryIcon from '@material-ui/icons/History'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'

import { translate } from '../Config'
import { Node } from '../Topology'
import { matchesKubernetesSelector } from '../KubernetesSelectors'
import { resolveKubernetesPodTopController } from '../KubernetesWorkloadOwnership'
import { kubernetesPvcOperationalPresentation } from '../KubernetesPersistentVolumeClaimDetailAggregation'
import { kubernetesPvNodeAffinityPresentation, kubernetesPvOperationalPresentation, kubernetesPvSourcePresentation } from '../KubernetesPersistentVolumeDetailAggregation'
import {
    BasicInfoRows,
    connectedResourcePopoverItems,
    collectKubernetesEventGroups,
    DetailAdvancedInfo,
    DetailBadge,
    DetailBadgeTone,
    DetailLongValue,
    DetailMetaInfoRow,
    DetailSectionCard,
    formatKubernetesQuantity,
    formatKubernetesTimestamp,
    kubernetesBooleanSettingLabel,
    kubernetesAccessModesLabel,
    kubernetesCollectionPresentation,
    kubernetesCreationTimestamp,
    kubernetesDefaultStorageClass,
    KubernetesConnectedResourceModal,
    KubernetesMetadataRows,
    KubernetesRecentEvents,
    kubernetesReclaimPolicyLabel,
    kubernetesPvcPhaseLabel,
    kubernetesPvPhaseLabel,
    kubernetesVolumeModeLabel,
    kubernetesVolumeSourceTypeLabel,
    KubernetesStructuredDataModalAction,
    KubernetesStructuredDataRow,
    kubernetesVolumeBindingModePresentation,
    RelatedResourceGrid,
    StatusSummaryGrid
} from './common'
import './KubernetesStorageDetailPanel.css'

interface Props {
    node: Node
    nodeAttrs: (node: Node) => any
}

interface State {
    basicCollapsed: boolean
    basicInfoAdvanced: boolean
    policyAdvanced: boolean
    relatedModal?: 'pvc' | 'pv' | 'storageclass' | 'pod' | 'workload'
}

const raw = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const value = path.split('.').reduce((current, key) => current === undefined || current === null ? undefined : current[key], data)
        if (value !== undefined && value !== null && value !== '') return value
    }
    return undefined
}
const collectedRaw = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const segments = path.split('.')
        let current = data
        let found = true
        for (const segment of segments) {
            if (current === undefined || current === null || !Object.prototype.hasOwnProperty.call(current, segment)) {
                found = false
                break
            }
            current = current[segment]
        }
        if (found) return current
    }
    return undefined
}
const firstDefined = (...values: any[]): any => values.find(value => value !== undefined && value !== null)
const text = (data: any, paths: string[]): string => {
    const value = raw(data, paths)
    return value === undefined || value === null ? '' : String(value)
}
const field = (value: any, ...keys: string[]): any => {
    if (!value || typeof value !== 'object') return undefined
    for (const key of keys) {
        if (value[key] !== undefined && value[key] !== null && value[key] !== '') return value[key]
    }
    return undefined
}
const storageQuantity = (value: any): any => field(value, 'storage', 'Storage')
const timestampSource = (value: any, depth = 0): string | number | Date | undefined => {
    if (value === undefined || value === null || value === '' || depth > 3) return undefined
    if (value instanceof Date || typeof value === 'string' || typeof value === 'number') return value
    if (typeof value !== 'object' || Array.isArray(value)) return undefined

    const seconds = value.Seconds ?? value.seconds ?? value.Unix ?? value.unix
    if (seconds !== undefined && Number.isFinite(Number(seconds))) {
        const nanos = Number(value.Nanos ?? value.nanos ?? 0)
        return Number(seconds) * 1000 + (Number.isFinite(nanos) ? nanos / 1000000 : 0)
    }

    const candidates = [
        value.Time,
        value.time,
        value.Timestamp,
        value.timestamp,
        value.Date,
        value.date,
        value.Value,
        value.value,
        value.$date
    ]
    for (const candidate of candidates) {
        const source = timestampSource(candidate, depth + 1)
        if (source !== undefined) return source
    }
    return undefined
}
const createdAt = (value: any): string => {
    const source = timestampSource(value)
    if (source === undefined) return '-'
    const numericSource = typeof source === 'number' && Math.abs(source) < 100000000000
        ? source * 1000
        : source
    const date = new Date(numericSource)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString()
    return typeof source === 'string' ? source : '-'
}
const STORAGE_EVENT_TONES = {
    failedbinding: 'warning' as const,
    failedmount: 'warning' as const,
    failedattachvolume: 'warning' as const,
    provisioningfailed: 'warning' as const,
    externalprovisioning: 'warning' as const,
    provisioningsucceeded: 'success' as const,
    volumecreated: 'success' as const
}

class KubernetesStorageDetailPanel extends React.Component<Props, State> {
    state: State = { basicCollapsed: false, basicInfoAdvanced: false, policyAdvanced: false }
    private lastDebugSignature = ''

    private debugMapping(payload: any) {
        let enabled = !!(window as any).NETDIVE_STORAGE_DEBUG
        try {
            enabled = enabled || window.localStorage.getItem('netdive.debug.kubernetes.storage') === 'true'
        } catch (_) {
            // Storage access may be blocked by the browser privacy policy.
        }
        if (!enabled) return
        const signature = JSON.stringify(payload.display)
        if (signature === this.lastDebugSignature) return
        this.lastDebugSignature = signature
        console.debug('[Netdive][KubernetesStorageMapping]', payload)
    }

    private topologyNodes(): Node[] {
        const nodes = (window as any).App?.tc?.nodes
        return nodes instanceof Map ? Array.from(nodes.values()) : Array.isArray(nodes) ? nodes : []
    }

    private clusterName(node: Node): string {
        return text(node.data || {}, ['ClusterName', 'K8s.ClusterName'])
    }

    private sameCluster(node: Node): boolean {
        const cluster = this.clusterName(this.props.node)
        return !cluster || this.clusterName(node) === cluster
    }

    private resources(type: string): Node[] {
        return this.topologyNodes().filter(node => this.sameCluster(node) && String(node.data?.Manager || '').toLowerCase() === 'k8s' && String(node.data?.Type || '').toLowerCase() === type)
    }

    private name(node: Node): string {
        return text(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) || node.id
    }

    private namespace(node: Node): string {
        return text(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace'])
    }

    private spec(node: Node): any {
        return raw(node.data || {}, ['K8s.Extra.Spec', 'K8s.Extra.spec', 'K8s.Spec', 'Spec', 'spec']) || {}
    }

    private status(node: Node): any {
        return raw(node.data || {}, ['K8s.Extra.Status', 'K8s.Extra.status', 'K8s.StatusObject', 'StatusObject', 'status']) || {}
    }

    private podsUsingPVC(pvc: Node): Node[] {
        const pvcName = this.name(pvc)
        const namespace = this.namespace(pvc)
        return this.resources('pod').filter(pod => {
            if (this.namespace(pod) !== namespace) return false
            const podSpec = this.spec(pod)
            const volumes = field(podSpec, 'Volumes', 'volumes') || []
            return Array.isArray(volumes) && volumes.some(volume => {
                const source = field(volume, 'VolumeSource', 'volumeSource') || volume || {}
                const persistentVolumeClaim = field(source, 'PersistentVolumeClaim', 'persistentVolumeClaim')
                const claim = field(persistentVolumeClaim, 'ClaimName', 'claimName')
                return String(claim || '') === pvcName
            })
        }).filter((pod, index, all) => all.findIndex(candidate => candidate.id === pod.id) === index)
    }

    private storageClassName(node: Node): string {
        return text(node.data || {}, [
            'K8s.storageClassName',
            'K8s.StorageClassName', 'StorageClassName', 'storageClassName',
            'K8s.Extra.Spec.StorageClassName', 'K8s.Extra.Spec.storageClassName',
            'K8s.Extra.spec.storageClassName', 'K8s.Spec.StorageClassName',
            'K8s.Spec.storageClassName', 'Spec.StorageClassName', 'spec.storageClassName'
        ])
    }

    private pvForPVC(pvc: Node): Node | undefined {
        const volumeName = text(pvc.data || {}, [
            'K8s.volumeName',
            'K8s.VolumeName', 'VolumeName', 'volumeName',
            'K8s.Extra.Spec.VolumeName', 'K8s.Extra.Spec.volumeName',
            'K8s.Extra.spec.volumeName', 'K8s.Spec.VolumeName',
            'K8s.Spec.volumeName', 'Spec.VolumeName', 'spec.volumeName'
        ])
        return volumeName ? this.resources('persistentvolume').find(pv => this.name(pv) === volumeName) : undefined
    }

    private pvcForPV(pv: Node): Node | undefined {
        const spec = this.spec(pv)
        const claimRef = field(spec, 'ClaimRef', 'claimRef') || {}
        const claimName = field(claimRef, 'Name', 'name') || text(pv.data || {}, ['K8s.ClaimRef', 'ClaimRef'])
        const claimNamespace = field(claimRef, 'Namespace', 'namespace') || text(pv.data || {}, ['K8s.ClaimNamespace', 'ClaimNamespace'])
        return this.resources('persistentvolumeclaim').find(pvc => this.name(pvc) === claimName && (!claimNamespace || this.namespace(pvc) === claimNamespace))
    }

    private storageClass(node: Node): Node | undefined {
        const name = this.storageClassName(node)
        return name ? this.resources('storageclass').find(item => this.name(item) === name) : undefined
    }

    private uniqueResources(resources: Node[]): Node[] {
        const result = new Map<string, Node>()
        resources.forEach(resource => {
            const uid = text(resource.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID'])
            const key = uid || [this.clusterName(resource), String(resource.data?.Type || '').toLowerCase(), this.namespace(resource), this.name(resource)].join('\u0001')
            result.set(key, resource)
        })
        return Array.from(result.values())
    }

    private workloadPods(pods: Node[]): Node[] {
        const result = new Map<string, Node>()
        const nodes = this.topologyNodes()
        pods.forEach(pod => {
            const controller = resolveKubernetesPodTopController(pod, nodes)
            if (controller) result.set(controller.id, controller)
        })
        return Array.from(result.values())
    }

    private affinityNodes(pv: Node): Node[] {
        const affinity = field(this.spec(pv), 'NodeAffinity', 'nodeAffinity')
        const required = field(affinity, 'Required', 'required')
        const terms = field(required, 'NodeSelectorTerms', 'nodeSelectorTerms')
        if (!Array.isArray(terms)) return []
        return this.resources('node').filter(node => terms.some(term => {
            const labels = raw(node.data || {}, [
                'K8s.Labels', 'Labels', 'labels',
                'K8s.Extra.ObjectMeta.Labels', 'K8s.Extra.ObjectMeta.labels',
                'K8s.Extra.Metadata.Labels', 'K8s.Extra.metadata.labels'
            ]) || {}
            const rawExpressions = field(term, 'MatchExpressions', 'matchExpressions')
            const rawFields = field(term, 'MatchFields', 'matchFields')
            const expressions = Array.isArray(rawExpressions) ? rawExpressions : []
            const fields = Array.isArray(rawFields) ? rawFields : []
            if (!expressions.length && !fields.length) return false
            const expressionMatch = expressions.length
                ? matchesKubernetesSelector({ MatchExpressions: expressions }, labels)
                : true
            const fieldMatch = fields.every(field => {
                const key = String(field?.Key || field?.key || '')
                const operator = String(field?.Operator || field?.operator || '')
                if (key !== 'metadata.name') return false
                const sourceValues = field?.Values || field?.values
                const values = Array.isArray(sourceValues) ? sourceValues.map(String) : []
                if (operator === 'In') return values.includes(this.name(node))
                if (operator === 'NotIn') return !values.includes(this.name(node))
                return false
            })
            return expressionMatch && fieldMatch
        }))
    }

    private focus(resources: Node[]) {
        const app = (window as any).App
        if (resources.length && app && typeof app.focusInfrastructureNodeIDs === 'function') {
            app.focusInfrastructureNodeIDs(resources.map(resource => resource.id), this.props.node.id, true)
        }
    }

    private topologyIcon(node: Node) {
        const attrs = this.props.nodeAttrs(node)
        return attrs.href ? <img className="netdive-detail-topology-icon-image" src={attrs.href} alt="" /> : <span className="netdive-detail-topology-icon">{attrs.icon}</span>
    }

    private storageResourceIcon(type: 'persistentvolumeclaim' | 'persistentvolume' | 'storageclass') {
        return <img className="netdive-detail-topology-icon-image" src={`assets/icons/${type}.png`} alt="" />
    }

    render() {
        const data = this.props.node.data || {}
        const type = String(data.Type || '').toLowerCase()
        const name = this.name(this.props.node)
        const namespace = this.namespace(this.props.node)
        const specSource = raw(data, ['K8s.Extra.Spec', 'K8s.Extra.spec', 'K8s.Spec', 'Spec', 'spec'])
        const statusSource = raw(data, ['K8s.Extra.Status', 'K8s.Extra.status', 'K8s.StatusObject', 'StatusObject', 'status'])
        const spec = specSource || {}
        const status = statusSource || {}
        const metadataSource = raw(data, [
            'K8s.Extra.ObjectMeta', 'K8s.Extra.Metadata', 'K8s.Extra.metadata',
            'K8s.Metadata', 'ObjectMeta', 'metadata'
        ])
        const meta = metadataSource || {}
        const creationTimestamp = raw(data, [
            'K8s.CreationTimestamp', 'CreationTimestamp', 'creationTimestamp',
            'K8s.Extra.ObjectMeta.CreationTimestamp', 'K8s.Extra.ObjectMeta.creationTimestamp',
            'K8s.Extra.Metadata.CreationTimestamp', 'K8s.Extra.metadata.creationTimestamp',
            'K8s.Metadata.CreationTimestamp', 'metadata.creationTimestamp'
        ])
        const none = '없음'
        const empty = '-'
        const collectionFailed = '수집 실패'
        const phase = String(field(status, 'Phase', 'phase') || text(data, ['K8s.Status', 'Status']) || '')
        const pvcVolumeName = type === 'persistentvolumeclaim' ? text(data, [
            'K8s.volumeName', 'K8s.VolumeName', 'VolumeName', 'volumeName',
            'K8s.Extra.Spec.VolumeName', 'K8s.Extra.Spec.volumeName',
            'K8s.Extra.spec.volumeName', 'K8s.Spec.VolumeName',
            'K8s.Spec.volumeName', 'Spec.VolumeName', 'spec.volumeName'
        ]) : ''
        const pvc = type === 'persistentvolume' ? this.pvcForPV(this.props.node) : undefined
        const pv = type === 'persistentvolumeclaim' ? this.pvForPVC(this.props.node) : undefined
        const storageClass = type === 'storageclass' ? undefined : this.storageClass(this.props.node)
        const pods = type === 'persistentvolumeclaim'
            ? this.podsUsingPVC(this.props.node)
            : type === 'persistentvolume' && pvc ? this.podsUsingPVC(pvc) : []
        const workloads = this.workloadPods(pods)
        const nodes = type === 'persistentvolume' ? this.affinityNodes(this.props.node) : []
        const storageClassPVs = type === 'storageclass' ? this.uniqueResources(this.resources('persistentvolume').filter(item => this.storageClassName(item) === name)) : []
        const storageClassPVCs = type === 'storageclass' ? this.uniqueResources(this.resources('persistentvolumeclaim').filter(item => this.storageClassName(item) === name)) : []
        const eventSource = (node: Node | undefined) => node
            ? collectedRaw(node.data || {}, ['K8s.Extra.Events', 'K8s.Events', 'Events'])
            : undefined
        const ownEventSource = eventSource(this.props.node)
        const eventSources = type === 'storageclass'
            ? [ownEventSource, ...storageClassPVCs.map(eventSource)]
            : type === 'persistentvolumeclaim'
                ? [ownEventSource, ...(pv ? [eventSource(pv)] : []), ...pods.map(eventSource)]
                : type === 'persistentvolume'
                    ? [ownEventSource, ...(pvc ? [eventSource(pvc)] : []), ...pods.map(eventSource)]
                : [ownEventSource]
        const eventsCollected = eventSources.some(source => source !== undefined)
        const eventLookbackMs = type === 'storageclass'
            ? 24 * 60 * 60 * 1000
            : type === 'persistentvolumeclaim' || type === 'persistentvolume' ? 60 * 60 * 1000 : undefined
        const recentEventGroups = collectKubernetesEventGroups(
            eventSources.filter(source => source !== undefined),
            STORAGE_EVENT_TONES,
            { combineSources: type === 'storageclass' || type === 'persistentvolumeclaim' || type === 'persistentvolume', sinceMs: eventLookbackMs }
        )
        const cumulativeEventGroups = collectKubernetesEventGroups(
            eventSources.filter(source => source !== undefined),
            STORAGE_EVENT_TONES,
            { combineSources: type === 'storageclass' || type === 'persistentvolumeclaim' || type === 'persistentvolume' }
        )
        const storageFailureGroups = recentEventGroups.filter(group => group.tone !== 'success')
        const recentFailureCount = storageFailureGroups.reduce((sum, group) => sum + group.count, 0)
        const recentFailureKnown = eventsCollected
        const resourceRequests = field(spec, 'Resources', 'resources')
        const requestValues = field(resourceRequests, 'Requests', 'requests')
        const requestedValue = raw(data, ['K8s.requestStorage', 'requestStorage', 'K8s.RequestedCapacity', 'RequestedCapacity'])
            || storageQuantity(requestValues)
        const requested = requestedValue === undefined
            ? none
            : formatKubernetesQuantity(requestedValue, none, empty)
        const capacityValue = raw(data, ['K8s.capacity', 'capacity', 'K8s.Capacity.storage', 'K8s.Capacity.Storage', 'Capacity.storage', 'Capacity.Storage'])
            || storageQuantity(field(spec, 'Capacity', 'capacity'))
            || storageQuantity(field(status, 'Capacity', 'capacity'))
        const capacity = capacityValue === undefined
            ? empty
            : formatKubernetesQuantity(capacityValue, empty, empty)
        const pvcStatusCapacityValue = type === 'persistentvolumeclaim'
            ? raw(data, ['K8s.actualCapacity', 'actualCapacity', 'K8s.StatusCapacity', 'StatusCapacity'])
                || storageQuantity(field(status, 'Capacity', 'capacity'))
            : undefined
        const boundPVSpec = pv ? this.spec(pv) : undefined
        const boundPVStatus = pv ? this.status(pv) : undefined
        const boundPVCapacityValue = pv
            ? raw(pv.data || {}, ['K8s.capacity', 'capacity', 'K8s.Capacity.storage', 'K8s.Capacity.Storage', 'Capacity.storage', 'Capacity.Storage'])
                || storageQuantity(field(boundPVSpec, 'Capacity', 'capacity'))
                || storageQuantity(field(boundPVStatus, 'Capacity', 'capacity'))
            : undefined
        const actualPVCapacityValue = pvcStatusCapacityValue !== undefined
            ? pvcStatusCapacityValue
            : boundPVCapacityValue
        const boundPVCapacity = actualPVCapacityValue !== undefined
            ? formatKubernetesQuantity(actualPVCapacityValue, empty, empty)
            : pv ? empty : none
        const kindLabel = type === 'persistentvolumeclaim' ? 'PVC' : type === 'persistentvolume' ? 'PV' : 'StorageClass'
        const accessModeValues = raw(data, ['K8s.accessModes', 'accessModes', 'K8s.AccessModes', 'AccessModes'])
            || field(spec, 'AccessModes', 'accessModes')
        const volumeMode = raw(data, ['K8s.volumeMode', 'volumeMode', 'K8s.VolumeMode', 'VolumeMode'])
            || field(spec, 'VolumeMode', 'volumeMode')
            || 'Filesystem'
        const explicitSourceType = text(data, ['K8s.volumeSourceType', 'volumeSourceType'])
        const pvSource = type === 'persistentvolume' ? kubernetesPvSourcePresentation(spec) : undefined
        const resolvedPvSourceType = explicitSourceType || pvSource?.type || ''
        const pvSourceRows: any[] = type === 'persistentvolume' ? [
            {
                label: '볼륨 소스',
                value: resolvedPvSourceType ? kubernetesVolumeSourceTypeLabel(resolvedPvSourceType) : translate('kubernetesNotCollected'),
                tooltip: resolvedPvSourceType ? `Kubernetes 원본 값: ${resolvedPvSourceType}` : undefined
            },
            ...(pvSource?.fields || []).map(item => ({
                label: item.label,
                value: item.label === '읽기 전용' ? (item.value === 'true' ? '예' : '아니요') : <DetailLongValue value={item.value} copy />,
                wrap: true
            }))
        ] : []
        const pvClaimRef = type === 'persistentvolume' ? field(spec, 'ClaimRef', 'claimRef') || {} : {}
        const pvClaimName = type === 'persistentvolume'
            ? String(field(pvClaimRef, 'Name', 'name') || text(data, ['K8s.ClaimRef', 'ClaimRef']) || '')
            : ''
        const pvClaimNamespace = type === 'persistentvolume'
            ? String(field(pvClaimRef, 'Namespace', 'namespace') || text(data, ['K8s.ClaimNamespace', 'ClaimNamespace']) || '')
            : ''
        const pvNodeAffinity = type === 'persistentvolume' ? field(spec, 'NodeAffinity', 'nodeAffinity') : undefined
        const pvRequiredAffinity = field(pvNodeAffinity, 'Required', 'required')
        const pvAffinityTermsSource = field(pvRequiredAffinity, 'NodeSelectorTerms', 'nodeSelectorTerms')
        const pvAffinityTerms = Array.isArray(pvAffinityTermsSource) ? pvAffinityTermsSource : []
        const pvAffinity = kubernetesPvNodeAffinityPresentation(pvNodeAffinity)
        const pvAffinityRows: KubernetesStructuredDataRow[] = pvAffinity.conditions.map(condition => ({
            id: condition.id,
            keyLabel: condition.key || '키 수집되지 않음',
            keySecondary: `조건 그룹 ${condition.termIndex + 1} · ${condition.scope === 'label' ? '노드 라벨' : '노드 필드'}`,
            operator: condition.operator || '–',
            value: condition.values.length ? condition.values.join(', ') : '값 없음',
            copyValue: JSON.stringify(condition.raw)
        }))
        const resourceTooltip = (label: string, resources: Node[]) => resources.length
            ? <span>{label}: {resources.map(resource => this.name(resource)).join(', ')}</span>
            : undefined
        const annotations = meta.Annotations || meta.annotations
        const defaultStorageClass = kubernetesDefaultStorageClass(annotations, data.K8s?.Default ?? data.Default)
        const provisioner = firstDefined(
            field(spec, 'Provisioner', 'provisioner'),
            raw(data, ['K8s.Provisioner', 'Provisioner', 'provisioner', 'K8s.Extra.Provisioner', 'K8s.Extra.provisioner'])
        )
        const reclaimPolicy = firstDefined(
            field(spec, 'ReclaimPolicy', 'reclaimPolicy'),
            raw(data, ['K8s.ReclaimPolicy', 'ReclaimPolicy', 'reclaimPolicy', 'K8s.Extra.ReclaimPolicy', 'K8s.Extra.reclaimPolicy'])
        )
        const volumeBindingMode = firstDefined(
            field(spec, 'VolumeBindingMode', 'volumeBindingMode'),
            raw(data, ['K8s.VolumeBindingMode', 'VolumeBindingMode', 'volumeBindingMode', 'K8s.Extra.VolumeBindingMode', 'K8s.Extra.volumeBindingMode'])
        )
        const volumeBindingModePresentation = kubernetesVolumeBindingModePresentation(volumeBindingMode)
        const allowVolumeExpansion = firstDefined(
            field(spec, 'AllowVolumeExpansion', 'allowVolumeExpansion'),
            collectedRaw(data, ['K8s.AllowVolumeExpansion', 'AllowVolumeExpansion', 'allowVolumeExpansion', 'K8s.Extra.AllowVolumeExpansion', 'K8s.Extra.allowVolumeExpansion'])
        )
        const parameterSource = firstDefined(
            field(spec, 'Parameters', 'parameters'),
            collectedRaw(data, ['K8s.Parameters', 'Parameters', 'parameters', 'K8s.Extra.Parameters', 'K8s.Extra.parameters'])
        )
        const parameters: Record<string, any> = parameterSource && typeof parameterSource === 'object' && !Array.isArray(parameterSource) ? parameterSource : {}
        const parameterKeys = Object.keys(parameters).sort()
        const allowedTopologies = firstDefined(
            field(spec, 'AllowedTopologies', 'allowedTopologies'),
            collectedRaw(data, ['K8s.AllowedTopologies', 'AllowedTopologies', 'allowedTopologies', 'K8s.Extra.AllowedTopologies', 'K8s.Extra.allowedTopologies'])
        )
        const mountOptions = firstDefined(
            field(spec, 'MountOptions', 'mountOptions'),
            collectedRaw(data, ['K8s.MountOptions', 'MountOptions', 'mountOptions', 'K8s.Extra.MountOptions', 'K8s.Extra.mountOptions'])
        )
        const topologyTerms = Array.isArray(allowedTopologies) ? allowedTopologies : []
        const topologyRows: KubernetesStructuredDataRow[] = ([] as KubernetesStructuredDataRow[]).concat(...topologyTerms.map((term: any, termIndex: number) => {
            const expressions = field(term, 'MatchLabelExpressions', 'matchLabelExpressions')
            return (Array.isArray(expressions) ? expressions : []).map((expression: any, expressionIndex: number) => {
                const key = String(field(expression, 'Key', 'key') || `조건 ${expressionIndex + 1}`)
                const values = field(expression, 'Values', 'values')
                return {
                    id: `topology:${termIndex}:${expressionIndex}:${key}`,
                    keyLabel: key,
                    operator: 'In',
                    value: Array.isArray(values) ? values.map(String).join(', ') : '설정되지 않음',
                    copyValue: `${key}=${Array.isArray(values) ? values.map(String).join(',') : ''}`
                }
            })
        }))
        const mountOptionValues = Array.isArray(mountOptions) ? mountOptions.map(String) : []
        const storageClassPolicyCollected = [provisioner, reclaimPolicy, volumeBindingMode, allowVolumeExpansion, parameterSource]
            .some(value => value !== undefined && value !== null)
        const volumeExpansionLabel = kubernetesBooleanSettingLabel(allowVolumeExpansion, {
            collected: storageClassPolicyCollected,
            enabledLabel: '지원',
            disabledLabel: '지원하지 않음'
        })
        const parameterRows: KubernetesStructuredDataRow[] = parameterKeys.map(key => ({
            id: `parameter:${key}`,
            keyLabel: key,
            value: String(parameters[key]),
            copyValue: `${key}=${parameters[key]}`
        }))
        const mountOptionRows: KubernetesStructuredDataRow[] = mountOptionValues.map((option, index) => ({
            id: `mount-option:${index}:${option}`,
            keyLabel: `옵션 ${index + 1}`,
            value: option,
            copyValue: option
        }))
        const basicRows: any[] = [
            { label: type === 'storageclass' ? '스토리지 클래스 이름' : `${kindLabel} 이름`, value: <DetailLongValue value={name} copy />, wrap: true },
            ...(namespace ? [{ label: translate('kubernetesTopologyNamespaces'), value: namespace }] : []),
            ...(type === 'persistentvolumeclaim' ? [{
                label: '바인딩 상태',
                value: kubernetesPvcPhaseLabel(phase),
                tooltip: phase ? `Kubernetes 원본 값: ${phase}` : undefined
            }] : type === 'persistentvolume' ? [{ label: '바인딩 상태', value: kubernetesPvPhaseLabel(phase), tooltip: phase ? `Kubernetes 원본 값: ${phase}` : undefined }] : [])
        ]
        const advancedRows: any[] = [
            { label: 'UID', value: <DetailLongValue value={String(meta.UID || this.props.node.id)} copy />, wrap: true },
            { label: translate('kubernetesCreatedAt'), value: type === 'storageclass' ? formatKubernetesTimestamp(kubernetesCreationTimestamp(data)) || translate('kubernetesNotCollected') : createdAt(creationTimestamp) }
        ]
        const policyRows: any[] = type === 'persistentvolumeclaim' ? [
            { label: '요청 용량', value: requested, tooltip: 'PVC spec.resources.requests.storage에 선언된 용량입니다.' },
            { label: '할당 용량', value: boundPVCapacity, tooltip: 'PVC 상태 용량 또는 바인딩된 PV의 spec.capacity.storage를 기준으로 표시합니다.' },
            { label: '볼륨 모드', value: kubernetesVolumeModeLabel(volumeMode), tooltip: volumeMode ? `Kubernetes 원본 값: ${volumeMode}` : undefined },
            { label: '접근 모드', value: kubernetesAccessModesLabel(accessModeValues), tooltip: Array.isArray(accessModeValues) && accessModeValues.length ? `Kubernetes 원본 값: ${accessModeValues.join(', ')}` : undefined },
            { label: '스토리지 클래스', value: this.storageClassName(this.props.node) || '설정되지 않음' }
        ] : type === 'persistentvolume' ? [
            { label: '용량', value: capacity },
            { label: '볼륨 모드', value: kubernetesVolumeModeLabel(volumeMode), tooltip: volumeMode ? `Kubernetes 원본 값: ${volumeMode}` : undefined },
            { label: '접근 모드', value: kubernetesAccessModesLabel(accessModeValues), tooltip: Array.isArray(accessModeValues) && accessModeValues.length ? `Kubernetes 원본 값: ${accessModeValues.join(', ')}` : undefined },
            ...pvSourceRows,
            {
                label: '회수 정책',
                value: kubernetesReclaimPolicyLabel(text(data, ['K8s.reclaimPolicy', 'reclaimPolicy', 'K8s.ReclaimPolicy', 'ReclaimPolicy']) || field(spec, 'PersistentVolumeReclaimPolicy', 'persistentVolumeReclaimPolicy') || ''),
                tooltip: `Kubernetes 원본 값: ${text(data, ['K8s.reclaimPolicy', 'reclaimPolicy', 'K8s.ReclaimPolicy', 'ReclaimPolicy']) || field(spec, 'PersistentVolumeReclaimPolicy', 'persistentVolumeReclaimPolicy') || '수집되지 않음'}`
            },
            { label: '스토리지 클래스', value: this.storageClassName(this.props.node) || none },
            { label: '클레임 네임스페이스', value: pvc ? this.namespace(pvc) || none : pvClaimNamespace || none },
            { label: '클레임 이름', value: pvc ? <DetailLongValue value={this.name(pvc)} copy /> : pvClaimName ? <DetailLongValue value={pvClaimName} copy /> : none, wrap: true }
        ] : [
            { label: '프로비저너', value: provisioner ? <DetailLongValue value={String(provisioner)} copy /> : translate('kubernetesNotCollected'), wrap: true },
            { label: '회수 정책', value: reclaimPolicy ? kubernetesReclaimPolicyLabel(reclaimPolicy) : translate('kubernetesNotCollected'), tooltip: reclaimPolicy ? `Kubernetes 원본 값: ${reclaimPolicy}` : undefined },
            {
                label: '바인딩 모드',
                value: volumeBindingMode ? volumeBindingModePresentation.label : translate('kubernetesNotCollected'),
                tooltip: volumeBindingModePresentation.description,
                tooltipRawValue: volumeBindingModePresentation.rawValue
            },
            {
                label: '볼륨 확장',
                value: volumeExpansionLabel,
                tooltip: allowVolumeExpansion === undefined
                    ? storageClassPolicyCollected ? 'StorageClass에 allowVolumeExpansion 필드가 명시되지 않았습니다.' : undefined
                    : `Kubernetes 원본 값: allowVolumeExpansion=${String(allowVolumeExpansion)}`
            },
            {
                label: '매개변수',
                value: parameterKeys.length
                    ? <KubernetesStructuredDataModalAction
                        resourceKind="StorageClass"
                        resourceName={name}
                        title="StorageClass 매개변수"
                        sectionTitle={`매개변수 ${parameterKeys.length}개`}
                        description="프로비저너에 전달되는 StorageClass 매개변수입니다."
                        rows={parameterRows}
                        rawValue={parameters}
                        rawTitle="원본 매개변수 JSON 보기">
                        {`${parameterKeys.slice(0, 2).join(', ')}${parameterKeys.length > 2 ? ` 외 ${parameterKeys.length - 2}개` : ''}`}
                    </KubernetesStructuredDataModalAction>
                    : '설정되지 않음',
                wrap: true
            }
        ]
        const directItems: any[] = type === 'storageclass' ? [
            { key: 'pvcs', label: 'PVC', count: storageClassPVCs.length, icon: this.storageResourceIcon('persistentvolumeclaim'), iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(storageClassPVCs, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), onClick: storageClassPVCs.length ? () => this.setState({ relatedModal: 'pvc' }) : undefined },
            { key: 'pvs', label: 'PV', count: storageClassPVs.length, icon: this.storageResourceIcon('persistentvolume'), iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(storageClassPVs, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), onClick: storageClassPVs.length ? () => this.setState({ relatedModal: 'pv' }) : undefined }
        ] : [
            ...(pv ? [{ key: 'pv', label: 'PV', count: 1, icon: this.storageResourceIcon('persistentvolume'), iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems([pv], { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), tooltip: resourceTooltip('PV', [pv]), onClick: () => this.focus([pv]) }] : []),
            ...(pvc ? [{ key: 'pvc', label: 'PVC', count: 1, icon: this.storageResourceIcon('persistentvolumeclaim'), iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems([pvc], { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), tooltip: resourceTooltip('PVC', [pvc]), onClick: () => this.focus([pvc]) }] : []),
            ...(storageClass ? [{ key: 'storage-class', label: 'StorageClass', count: 1, icon: this.storageResourceIcon('storageclass'), iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems([storageClass], { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), tooltip: resourceTooltip('StorageClass', [storageClass]), onClick: () => this.focus([storageClass]) }] : []),
            ...(nodes.length ? [{ key: 'nodes', label: '노드', count: nodes.length, icon: this.topologyIcon(nodes[0]), iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(nodes, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), tooltip: resourceTooltip('노드', nodes), onClick: () => this.focus(nodes) }] : [])
        ]
        const indirectItems: any[] = [
            ...(pods.length ? [{ key: 'pods', label: '파드', count: pods.length, icon: this.topologyIcon(pods[0]), iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(pods, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), tooltip: resourceTooltip('파드', pods), onClick: () => this.focus(pods) }] : []),
            ...(workloads.length ? [{ key: 'workloads', label: '상위 워크로드', count: workloads.length, icon: this.topologyIcon(workloads[0]), iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(workloads, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), tooltip: resourceTooltip('상위 워크로드', workloads), onClick: () => this.focus(workloads) }] : [])
        ]
        const pvcRelatedItems: any[] = type === 'persistentvolumeclaim' ? [
            { key: 'pv', label: 'PV', count: pv ? 1 : 0, icon: this.storageResourceIcon('persistentvolume'), iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(pv ? [pv] : [], { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), onClick: pv ? () => this.setState({ relatedModal: 'pv' }) : undefined },
            { key: 'storage-class', label: '스토리지 클래스', count: storageClass ? 1 : 0, icon: this.storageResourceIcon('storageclass'), iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(storageClass ? [storageClass] : [], { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), onClick: storageClass ? () => this.setState({ relatedModal: 'storageclass' }) : undefined },
            { key: 'pods', label: '파드', count: pods.length, icon: pods.length ? this.topologyIcon(pods[0]) : <img className="netdive-detail-topology-icon-image" src="assets/icons/pod.png" alt="" />, iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(pods, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), onClick: pods.length ? () => this.setState({ relatedModal: 'pod' }) : undefined },
            { key: 'workloads', label: '상위 워크로드', count: workloads.length, icon: workloads.length ? this.topologyIcon(workloads[0]) : <AccountTreeIcon />, iconTone: 'kubernetes' as const, resources: connectedResourcePopoverItems(workloads, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs }), onClick: workloads.length ? () => this.setState({ relatedModal: 'workload' }) : undefined }
        ] : []
        const relatedGroups = type === 'storageclass'
            ? [{ key: 'usage', items: directItems }]
            : type === 'persistentvolumeclaim'
                ? [{ key: 'usage', items: pvcRelatedItems }]
                : type === 'persistentvolume'
                    ? [{ key: 'usage', items: [...directItems, ...indirectItems] }]
            : [
                { key: 'direct', title: '직접 연결', icon: <StorageIcon />, items: directItems },
                { key: 'indirect', title: '간접 사용 관계', icon: <img src="assets/icons/k8s.png" alt="" />, items: indirectItems }
            ]
        const selectedRelatedResources = this.state.relatedModal === 'pvc'
            ? (type === 'storageclass' ? storageClassPVCs : pvc ? [pvc] : [])
            : this.state.relatedModal === 'pv'
                ? (type === 'storageclass' ? storageClassPVs : pv ? [pv] : [])
                : this.state.relatedModal === 'storageclass' ? (storageClass ? [storageClass] : [])
                    : this.state.relatedModal === 'pod' ? pods
                        : this.state.relatedModal === 'workload' ? workloads : []
        const selectedRelatedLabel = this.state.relatedModal === 'pvc' ? 'PVC'
            : this.state.relatedModal === 'pv' ? 'PV'
                : this.state.relatedModal === 'storageclass' ? '스토리지 클래스'
                    : this.state.relatedModal === 'pod' ? '파드'
                        : this.state.relatedModal === 'workload' ? '상위 워크로드' : '연결 자원'
        this.debugMapping({
            resource: { type: kindLabel, name },
            raw: {
                metadataCreationTimestamp: creationTimestamp,
                requestedStorage: requestedValue,
                pvcStatusCapacity: pvcStatusCapacityValue,
                volumeName: raw(data, ['K8s.volumeName', 'K8s.VolumeName', 'K8s.Extra.Spec.VolumeName', 'K8s.Extra.spec.volumeName']),
                pvCapacity: capacityValue,
                boundPVCapacity: boundPVCapacityValue
            },
            display: {
                creationTimestamp: createdAt(creationTimestamp),
                requestedCapacity: requested,
                capacity,
                boundPVCapacity
            }
        })
        const storageTone: DetailBadgeTone = !recentFailureKnown
            ? 'default'
            : recentFailureCount > 0 || (phase && phase.toLowerCase() !== 'bound' && phase.toLowerCase() !== 'available')
                ? 'warning'
                : 'success'
        const storageVerdict = storageTone === 'success' ? translate('kubernetesHealthNormal') : storageTone === 'warning' ? translate('kubernetesHealthWarning') : translate('kubernetesHealthUnknown')
        const storageImpact = !recentFailureKnown
            ? collectionFailed
            : recentFailureCount > 0
                ? `최근 오류 ${recentFailureCount}건`
                : '최근 오류 없음'
        const pvcOperational = kubernetesPvcOperationalPresentation({
            phase,
            volumeName: pvcVolumeName,
            boundPvFound: !!pv
        })
        const pvcBasicCollected = !!name && !!namespace
        const pvcBindingCollected = !!phase
        const pvcStorageClassName = this.storageClassName(this.props.node)
        const requestedCapacityCollected = requestedValue !== undefined
        const allocatedCapacityRequired = String(phase).toLowerCase() === 'bound'
        const allocatedCapacityCollected = !allocatedCapacityRequired || actualPVCapacityValue !== undefined
        const pvcCapacityState: 'collected' | 'partial' | 'uncollected' = requestedCapacityCollected && allocatedCapacityCollected
            ? 'collected'
            : requestedCapacityCollected || actualPVCapacityValue !== undefined ? 'partial' : 'uncollected'
        const pvcPolicyCollected = specSource !== undefined
            || accessModeValues !== undefined
            || !!pvcStorageClassName
        const pvcPvRelationState: 'collected' | 'partial' | 'uncollected' = !pvcVolumeName
            ? pvcBindingCollected ? 'collected' : 'uncollected'
            : pv ? 'collected' : 'partial'
        const pvcStorageClassRelationState: 'collected' | 'partial' | 'uncollected' = !pvcStorageClassName
            ? pvcPolicyCollected ? 'collected' : 'uncollected'
            : storageClass ? 'collected' : 'partial'
        const podInventoryCollected = pods.length > 0 || this.resources('pod').length > 0
        const pvcPodRelationState: 'collected' | 'partial' | 'uncollected' = podInventoryCollected
            ? 'collected'
            : 'uncollected'
        const pvcWorkloadRelationState: 'collected' | 'partial' | 'uncollected' = pvcPodRelationState
        const collectedEventSourceCount = eventSources.filter(source => source !== undefined).length
        const pvcEventCollectionState: 'collected' | 'partial' | 'uncollected' = collectedEventSourceCount === eventSources.length && eventSources.length > 0
            ? 'collected'
            : collectedEventSourceCount > 0 ? 'partial' : 'uncollected'
        const pvcCollection = kubernetesCollectionPresentation([
            { key: 'basic', label: 'PVC 기본 정보', collected: pvcBasicCollected, essential: true },
            { key: 'binding', label: '바인딩 상태', collected: pvcBindingCollected, essential: true },
            { key: 'capacity', label: '요청/할당 용량', state: pvcCapacityState, essential: true },
            { key: 'policy', label: '스토리지 정책', collected: pvcPolicyCollected, essential: true },
            { key: 'pv', label: 'PV 관계', state: pvcPvRelationState },
            { key: 'storage-class', label: 'StorageClass 관계', state: pvcStorageClassRelationState },
            { key: 'pods', label: 'Pod 관계', state: pvcPodRelationState },
            { key: 'workloads', label: '상위 워크로드 관계', state: pvcWorkloadRelationState },
            { key: 'recent-events', label: '최근 불안정성', state: pvcEventCollectionState },
            { key: 'event-history', label: '과거 스토리지 이벤트 이력', state: pvcEventCollectionState }
        ])
        const cumulativeFailureCount = cumulativeEventGroups
            .filter(group => group.tone !== 'success')
            .reduce((sum, group) => sum + group.count, 0)
        const pvOperational = kubernetesPvOperationalPresentation(phase, pvClaimName)
        const pvPolicyCollected = specSource !== undefined || capacityValue !== undefined || !!resolvedPvSourceType
        const pvClaimRelationState: 'collected' | 'partial' | 'uncollected' = !pvClaimName
            ? phase.toLowerCase() === 'available' ? 'collected' : 'uncollected'
            : pvc ? 'collected' : 'partial'
        const pvStorageClassName = this.storageClassName(this.props.node)
        const pvStorageClassRelationState: 'collected' | 'partial' | 'uncollected' = !pvStorageClassName
            ? pvPolicyCollected ? 'collected' : 'uncollected'
            : storageClass ? 'collected' : 'partial'
        const pvNodeRelationState: 'collected' | 'partial' | 'uncollected' = !pvAffinityTerms.length
            ? pvPolicyCollected ? 'collected' : 'uncollected'
            : nodes.length ? 'collected' : 'partial'
        const pvEventCollectionState: 'collected' | 'partial' | 'uncollected' = collectedEventSourceCount === eventSources.length && eventSources.length > 0
            ? 'collected'
            : collectedEventSourceCount > 0 ? 'partial' : 'uncollected'
        const pvCollection = kubernetesCollectionPresentation([
            { key: 'basic', label: 'PV 기본 정보', collected: !!name, essential: true },
            { key: 'binding', label: '바인딩 상태', collected: !!phase, essential: true },
            { key: 'policy', label: '용량/정책 및 볼륨 소스', collected: pvPolicyCollected, essential: true },
            { key: 'claim', label: 'PVC 관계', state: pvClaimRelationState },
            { key: 'storage-class', label: 'StorageClass 관계', state: pvStorageClassRelationState },
            { key: 'nodes', label: '노드 관계', state: pvNodeRelationState },
            { key: 'recent-events', label: '최근 불안정성', state: pvEventCollectionState },
            { key: 'event-history', label: '과거 스토리지 이벤트 이력', state: pvEventCollectionState }
        ])
        return <div className="netdive-k8s-storage-detail">
            <DetailSectionCard icon={<InfoIcon />} title={type === 'storageclass' ? '스토리지 클래스 기본 정보' : `${kindLabel} 기본 정보`} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <BasicInfoRows density="compact" rows={basicRows} labelWidth={122} copyTooltip={translate('copy')} />
                <DetailAdvancedInfo title={translate('kubernetesAdvancedInformation')} active={this.state.basicInfoAdvanced} onChange={basicInfoAdvanced => this.setState({ basicInfoAdvanced })}>
                    <BasicInfoRows density="compact" rows={advancedRows} labelWidth={122} copyTooltip={translate('copy')} />
                    <KubernetesMetadataRows items={[
                        { key: 'labels', label: '라벨', resourceName: name, resourceKind: kindLabel, metadataKind: 'label', data: meta.Labels || meta.labels, modalTitle: `${kindLabel} 라벨`, collected: metadataSource !== undefined },
                        { key: 'annotations', label: '어노테이션', resourceName: name, resourceKind: kindLabel, metadataKind: 'annotation', data: meta.Annotations || meta.annotations, modalTitle: `${kindLabel} 어노테이션`, collected: metadataSource !== undefined }
                    ]} />
                </DetailAdvancedInfo>
            </DetailSectionCard>
            {type !== 'storageclass' && <DetailSectionCard icon={this.topologyIcon(this.props.node)} title={`${kindLabel} 운영 상태`}>
                {type === 'persistentvolumeclaim' ? <React.Fragment>
                    <StatusSummaryGrid
                        verdict={pvcOperational.verdict}
                        verdictTone={pvcOperational.tone}
                        verdictTooltip="PVC의 현재 phase, 바인딩된 PV 이름과 실제 PV 관계를 기준으로 판정합니다. 이벤트 수집 상태는 이 판정에 포함하지 않습니다."
                        rawStatus={kubernetesPvcPhaseLabel(phase)}
                        rawStatusLabel="바인딩 상태"
                        rawStatusTooltip={phase ? `Kubernetes 원본 값: ${phase}` : 'PVC phase가 수집되지 않았습니다.'}
                        impact={pvcOperational.impact}
                        impactTooltip={pvcOperational.tone === 'success'
                            ? 'PVC가 Bound 상태이고 spec.volumeName에 해당하는 PV 관계가 확인되었습니다. 실제 서비스 영향은 별도 워크로드 관측 범위에 따라 달라질 수 있습니다.'
                            : '현재 PVC 바인딩 상태와 PV 관계만으로 서비스 가용성 영향을 확정할 수 없습니다.'}
                        metrics={[
                            { key: 'recent', label: '최근 불안정성', value: recentFailureCount, visible: eventsCollected, tone: recentFailureCount > 0 ? 'warning' : 'default', tooltip: '최근 1시간 동안 PVC 자체, 바인딩된 PV, PVC를 사용하는 파드에서 수집된 Binding·Mount·Attach·Provisioning 이상 이벤트 수입니다.' },
                            { key: 'history', label: '누적 이력', value: cumulativeFailureCount, visible: eventsCollected, tooltip: '현재 수집 데이터에 보관된 스토리지 이상 이벤트의 누적 건수이며 현재 장애 판정에는 사용하지 않습니다.' }
                        ]} />
                    <DetailMetaInfoRow items={[
                        {
                            key: 'current-problem',
                            label: '현재 문제',
                            value: pvcOperational.currentProblem,
                            tooltip: '현재 Pending·Lost 상태 또는 Bound 상태의 PV 관계 불일치를 표시합니다.'
                        },
                        {
                            key: 'collection',
                            label: '데이터 수집 상태',
                            value: pvcCollection.label,
                            tone: pvcCollection.tone,
                            tooltip: 'PVC 자체 상태 판정과 별도로, 상세 근거에 사용하는 데이터 소스의 수집 범위를 표시합니다.',
                            tooltipDetail: pvcCollection.detail
                        }
                    ]} />
                </React.Fragment> : type === 'persistentvolume' ? <React.Fragment>
                    <StatusSummaryGrid
                        verdict={pvOperational.verdict}
                        verdictTone={pvOperational.tone}
                        verdictTooltip="PV의 현재 phase와 claimRef를 기준으로 바인딩 상태를 판정합니다. 이벤트 수집 상태는 이 판정에 포함하지 않습니다."
                        rawStatus={kubernetesPvPhaseLabel(phase)}
                        rawStatusLabel="바인딩 상태"
                        rawStatusTooltip={phase ? `Kubernetes 원본 값: ${phase}` : 'PV phase가 수집되지 않았습니다.'}
                        impact={pvOperational.impact}
                        impactTooltip={pvOperational.tone === 'success'
                            ? 'PV의 바인딩 상태와 클레임 참조를 기준으로 현재 확인된 스토리지 영향이 없습니다. 실제 서비스 영향은 연결 파드 관측 범위에 따라 달라질 수 있습니다.'
                            : '현재 PV 바인딩 상태와 클레임 관계를 기준으로 영향 확인이 필요합니다.'}
                        metrics={[
                            { key: 'recent', label: '최근 불안정성', value: recentFailureCount, visible: eventsCollected, tone: recentFailureCount > 0 ? 'warning' : 'default', tooltip: '최근 1시간 동안 PV 자체, 연결 PVC와 해당 PVC를 사용하는 파드에서 수집된 Binding·Mount·Attach·Provisioning 이상 이벤트 수입니다.' },
                            { key: 'history', label: '누적 이력', value: cumulativeFailureCount, visible: eventsCollected, tooltip: '현재 수집 데이터에 보관된 스토리지 이상 이벤트의 누적 건수이며 현재 장애 판정에는 사용하지 않습니다.' }
                        ]} />
                    <DetailMetaInfoRow items={[
                        {
                            key: 'current-problem',
                            label: '현재 문제',
                            value: pvOperational.currentProblem,
                            tooltip: '현재 Failed·Released 상태 또는 Bound 상태의 클레임 참조 불일치를 표시합니다.'
                        },
                        {
                            key: 'collection',
                            label: '데이터 수집 상태',
                            value: pvCollection.label,
                            tone: pvCollection.tone,
                            tooltip: 'PV 자체 상태 판정과 별도로, 상세 근거에 사용하는 데이터 소스의 수집 범위를 표시합니다.',
                            tooltipDetail: pvCollection.detail
                        }
                    ]} />
                </React.Fragment> : <StatusSummaryGrid
                    verdict={storageVerdict}
                    verdictTone={storageTone}
                    rawStatus={phase || empty}
                    rawStatusLabel="Phase"
                    impact={storageImpact}
                    impactTooltip="최근 24시간 내 Binding·Mount·Attach 오류를 기준으로 표시합니다."
                    metrics={[
                        { key: 'recent', label: '최근 불안정성', value: recentFailureKnown ? recentFailureCount : collectionFailed, tone: recentFailureKnown ? (recentFailureCount > 0 ? 'warning' : 'default') : 'default', tooltip: '최근 24시간 내 발생한 Binding·Mount·Attach 오류 건수입니다.' },
                        { key: 'history', label: '누적 이력', value: recentEventGroups.reduce((sum, group) => sum + group.count, 0), tooltip: '보관 중인 전체 스토리지 이벤트의 누적 건수입니다.' }
                    ]} />}
            </DetailSectionCard>}
            <DetailSectionCard
                icon={<StorageIcon />}
                title={type === 'storageclass' ? '프로비저닝 정책' : '용량 및 정책'}
                action={type === 'storageclass' && defaultStorageClass === true
                    ? <DetailBadge
                        tone="default"
                        tooltip="PVC에 StorageClass가 지정되지 않은 경우 기본으로 사용될 수 있습니다.">
                        기본 스토리지 클래스
                    </DetailBadge>
                    : undefined}>
                <BasicInfoRows density="compact" rows={policyRows} labelWidth={122} copyTooltip={translate('copy')} />
                {type === 'persistentvolume' && pvAffinity.showPolicyDetail && <DetailAdvancedInfo
                    title="고급 정보"
                    hierarchy="supporting"
                    active={this.state.policyAdvanced}
                    onChange={policyAdvanced => this.setState({ policyAdvanced })}>
                    <BasicInfoRows density="compact" labelWidth={122} rows={[{
                        label: '노드 배치 조건',
                        value: <KubernetesStructuredDataModalAction
                            resourceKind="PV"
                            resourceName={name}
                            title="PV 노드 배치 조건"
                            sectionTitle={`노드 배치 조건 ${pvAffinity.conditionCount}개`}
                            description="PV spec.nodeAffinity의 조건 그룹과 노드 라벨·필드 선택 조건입니다. 조건 그룹 간에는 OR, 같은 그룹 안의 조건에는 AND가 적용됩니다."
                            rows={pvAffinityRows}
                            operatorTitle="연산자"
                            rawValue={pvNodeAffinity}
                            rawTitle="원본 nodeAffinity JSON 보기">
                            {`${pvAffinity.conditionCount}개`}
                        </KubernetesStructuredDataModalAction>
                    }]} />
                </DetailAdvancedInfo>}
                {type === 'storageclass' && (topologyRows.length > 0 || mountOptionRows.length > 0) && <DetailAdvancedInfo
                    title="고급 정책"
                    hierarchy="supporting"
                    active={this.state.policyAdvanced}
                    onChange={policyAdvanced => this.setState({ policyAdvanced })}>
                    <BasicInfoRows density="compact" labelWidth={122} rows={[
                        ...(topologyRows.length ? [{
                            label: '허용 토폴로지',
                            value: <KubernetesStructuredDataModalAction
                                resourceKind="StorageClass"
                                resourceName={name}
                                title="StorageClass 허용 토폴로지"
                                sectionTitle={`허용 토폴로지 ${topologyRows.length}개 조건`}
                                description="볼륨을 프로비저닝할 수 있는 zone·node topology 조건입니다."
                                rows={topologyRows}
                                operatorTitle="연산자"
                                rawValue={allowedTopologies}
                                rawTitle="원본 allowedTopologies JSON 보기">
                                {`${topologyRows.length}개 조건`}
                            </KubernetesStructuredDataModalAction>
                        }] : []),
                        ...(mountOptionRows.length ? [{
                            label: '마운트 옵션',
                            value: <KubernetesStructuredDataModalAction
                                resourceKind="StorageClass"
                                resourceName={name}
                                title="StorageClass 마운트 옵션"
                                sectionTitle={`마운트 옵션 ${mountOptionRows.length}개`}
                                description="이 StorageClass로 생성된 볼륨에 적용되는 마운트 옵션입니다."
                                rows={mountOptionRows}
                                rawValue={mountOptions}
                                rawTitle="원본 mountOptions JSON 보기">
                                {`${mountOptionRows.length}개`}
                            </KubernetesStructuredDataModalAction>
                        }] : [])
                    ]} />
                </DetailAdvancedInfo>}
            </DetailSectionCard>
            <RelatedResourceGrid icon={<AccountTreeIcon />} title={translate('hostConnectedResources')} emptyText="연결된 스토리지 자원이 없습니다." groups={relatedGroups} />
            {((type !== 'storageclass' && type !== 'persistentvolumeclaim' && type !== 'persistentvolume') || eventsCollected) && <DetailSectionCard icon={<HistoryIcon />} title="최근 이벤트">
                <KubernetesRecentEvents
                    groups={recentEventGroups}
                    lookbackLabel={type === 'storageclass' ? '최근 24시간' : type === 'persistentvolumeclaim' || type === 'persistentvolume' ? '최근 1시간' : undefined}
                    emptyText={type === 'persistentvolumeclaim' || type === 'persistentvolume' ? '최근 1시간 동안 발생한 스토리지 관련 중요 이벤트가 없습니다.' : type === 'storageclass' ? undefined : '최근 스토리지 관련 이벤트가 없습니다.'}
                    onResourceClick={group => {
                    const target = this.topologyNodes().find(node => (!group.resourceUid || node.id === group.resourceUid || text(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'UID']) === group.resourceUid)
                        && (!group.resourceName || this.name(node) === group.resourceName))
                    if (target) this.focus([target])
                }} />
            </DetailSectionCard>}
            {(type === 'storageclass' || type === 'persistentvolumeclaim' || type === 'persistentvolume') && <KubernetesConnectedResourceModal
                visible={!!this.state.relatedModal}
                title={`${kindLabel} 연결 ${selectedRelatedLabel}`}
                resourceLabel={selectedRelatedLabel}
                items={selectedRelatedResources.map(resource => ({
                    key: resource.id,
                    kind: this.state.relatedModal === 'workload' ? String(resource.data?.Type || '워크로드') : selectedRelatedLabel,
                    name: this.name(resource),
                    description: this.namespace(resource) || (selectedRelatedLabel === 'PV' ? '클러스터 범위' : undefined),
                    icon: this.state.relatedModal === 'pvc' ? this.storageResourceIcon('persistentvolumeclaim')
                        : this.state.relatedModal === 'pv' ? this.storageResourceIcon('persistentvolume')
                            : this.state.relatedModal === 'storageclass' ? this.storageResourceIcon('storageclass')
                                : this.topologyIcon(resource),
                    onClick: () => this.focus([resource])
                }))}
                onCancel={() => this.setState({ relatedModal: undefined })} />}
        </div>
    }
}

export default KubernetesStorageDetailPanel
