import * as React from 'react'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import HistoryIcon from '@material-ui/icons/History'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'

import { translate } from '../Config'
import { Node } from '../Topology'
import { matchesKubernetesSelector } from '../KubernetesSelectors'
import {
    BasicInfoRows,
    collectKubernetesEventGroups,
    DetailAdvancedInfo,
    DetailBadge,
    DetailBadgeTone,
    DetailSectionCard,
    formatKubernetesQuantity,
    KubernetesMetadataRows,
    KubernetesRecentEvents,
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
}

const raw = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const value = path.split('.').reduce((current, key) => current === undefined || current === null ? undefined : current[key], data)
        if (value !== undefined && value !== null && value !== '') return value
    }
    return undefined
}
const text = (data: any, paths: string[]): string => {
    const value = raw(data, paths)
    return value === undefined || value === null ? '' : String(value)
}
const list = (value: any): string => Array.isArray(value) && value.length ? value.map(String).join(', ') : translate('kubernetesNone')
const field = (value: any, ...keys: string[]): any => {
    if (!value || typeof value !== 'object') return undefined
    for (const key of keys) {
        if (value[key] !== undefined && value[key] !== null && value[key] !== '') return value[key]
    }
    return undefined
}
const storageQuantity = (value: any): any => field(value, 'storage', 'Storage')
const volumeSourceDetails = (spec: any): Array<{ label: string, value: React.ReactNode, textValue?: string, copyText?: string, tooltip?: React.ReactNode }> => {
    const source = field(spec, 'PersistentVolumeSource', 'persistentVolumeSource') || spec || {}
    const definitions = [
        { type: 'CSI', keys: ['CSI', 'csi'] },
        { type: 'Local', keys: ['Local', 'local'] },
        { type: 'HostPath', keys: ['HostPath', 'hostPath'] },
        { type: 'NFS', keys: ['NFS', 'nfs'] },
        { type: 'iSCSI', keys: ['ISCSI', 'iSCSI', 'iscsi'] },
        { type: 'CephFS', keys: ['CephFS', 'cephfs'] },
        { type: 'RBD', keys: ['RBD', 'rbd'] },
        { type: 'FC', keys: ['FC', 'fc'] },
        { type: 'AzureDisk', keys: ['AzureDisk', 'azureDisk'] },
        { type: 'GCE Persistent Disk', keys: ['GCEPersistentDisk', 'gcePersistentDisk'] },
        { type: 'AWS EBS', keys: ['AWSElasticBlockStore', 'awsElasticBlockStore'] }
    ]
    for (const definition of definitions) {
        const detail = field(source, ...definition.keys)
        if (!detail || typeof detail !== 'object') continue
        const driver = field(detail, 'Driver', 'driver')
        const volumeHandle = field(detail, 'VolumeHandle', 'volumeHandle')
        const path = field(detail, 'Path', 'path')
        const server = field(detail, 'Server', 'server')
        return [
            { label: '볼륨 소스', value: definition.type },
            ...(driver ? [{ label: '드라이버', value: String(driver) }] : []),
            ...(volumeHandle ? [{ label: '볼륨 핸들', value: String(volumeHandle), textValue: String(volumeHandle), copyText: String(volumeHandle) }] : []),
            ...(path ? [{ label: '경로', value: String(path), textValue: String(path), tooltip: String(path), copyText: String(path) }] : []),
            ...(server ? [{ label: '서버', value: String(server) }] : [])
        ]
    }
    return []
}
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
    state: State = { basicCollapsed: false, basicInfoAdvanced: false }
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
            const volumes = this.spec(pod).Volumes || []
            return Array.isArray(volumes) && volumes.some(volume => {
                const claim = volume?.PersistentVolumeClaim?.ClaimName || volume?.VolumeSource?.PersistentVolumeClaim?.ClaimName
                return String(claim || '') === pvcName
            })
        })
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
        const claimName = spec?.ClaimRef?.Name || text(pv.data || {}, ['K8s.ClaimRef', 'ClaimRef'])
        const claimNamespace = spec?.ClaimRef?.Namespace || text(pv.data || {}, ['K8s.ClaimNamespace', 'ClaimNamespace'])
        return this.resources('persistentvolumeclaim').find(pvc => this.name(pvc) === claimName && (!claimNamespace || this.namespace(pvc) === claimNamespace))
    }

    private storageClass(node: Node): Node | undefined {
        const name = this.storageClassName(node)
        return name ? this.resources('storageclass').find(item => this.name(item) === name) : undefined
    }

    private workloadPods(pods: Node[]): Node[] {
        const result = new Map<string, Node>()
        pods.forEach(pod => {
            let parent = pod.parent
            while (parent) {
                if (['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(String(parent.data?.Type || '').toLowerCase())) {
                    result.set(parent.id, parent)
                    break
                }
                parent = parent.parent
            }
        })
        return Array.from(result.values())
    }

    private affinityNodes(pv: Node): Node[] {
        const terms = this.spec(pv)?.NodeAffinity?.Required?.NodeSelectorTerms
        if (!Array.isArray(terms)) return []
        return this.resources('node').filter(node => terms.some(term => {
            const labels = raw(node.data || {}, ['K8s.Labels', 'Labels', 'K8s.Extra.ObjectMeta.Labels']) || {}
            const expressions = Array.isArray(term?.MatchExpressions) ? term.MatchExpressions : []
            const fields = Array.isArray(term?.MatchFields) ? term.MatchFields : []
            if (!expressions.length && !fields.length) return false
            const expressionMatch = expressions.length
                ? matchesKubernetesSelector({ MatchExpressions: expressions }, labels)
                : true
            const fieldMatch = fields.every(field => {
                if (field?.Key !== 'metadata.name') return false
                const values = Array.isArray(field?.Values) ? field.Values.map(String) : []
                if (field?.Operator === 'In') return values.includes(this.name(node))
                if (field?.Operator === 'NotIn') return !values.includes(this.name(node))
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
        const spec = this.spec(this.props.node)
        const status = this.status(this.props.node)
        const meta = raw(data, [
            'K8s.Extra.ObjectMeta', 'K8s.Extra.Metadata', 'K8s.Extra.metadata',
            'K8s.Metadata', 'ObjectMeta', 'metadata'
        ]) || {}
        const creationTimestamp = raw(data, [
            'K8s.CreationTimestamp', 'CreationTimestamp', 'creationTimestamp',
            'K8s.Extra.ObjectMeta.CreationTimestamp', 'K8s.Extra.ObjectMeta.creationTimestamp',
            'K8s.Extra.Metadata.CreationTimestamp', 'K8s.Extra.metadata.creationTimestamp',
            'K8s.Metadata.CreationTimestamp', 'metadata.creationTimestamp'
        ])
        const none = '없음'
        const empty = '-'
        const collectionFailed = '수집 실패'
        const phase = String(status.Phase || text(data, ['K8s.Status', 'Status']) || '')
        const recentEventGroups = collectKubernetesEventGroups([
            raw(data, ['K8s.Extra.Events', 'K8s.Events', 'Events'])
        ], STORAGE_EVENT_TONES)
        const storageFailureGroups = recentEventGroups.filter(group => group.tone !== 'success')
        const recentStorageFailureGroups = storageFailureGroups.filter(group => {
            const time = new Date(group.time || 0).getTime()
            return !Number.isNaN(time) && time > 0 && time >= Date.now() - 24 * 60 * 60 * 1000
        })
        const recentFailureCount = recentStorageFailureGroups.reduce((sum, group) => sum + group.count, 0)
        const recentFailureKnown = storageFailureGroups.length === 0 || storageFailureGroups.some(group => {
            const time = new Date(group.time || 0).getTime()
            return !Number.isNaN(time) && time > 0
        })
        const pvc = type === 'persistentvolume' ? this.pvcForPV(this.props.node) : undefined
        const pv = type === 'persistentvolumeclaim' ? this.pvForPVC(this.props.node) : undefined
        const storageClass = type === 'storageclass' ? undefined : this.storageClass(this.props.node)
        const pods = type === 'persistentvolumeclaim'
            ? this.podsUsingPVC(this.props.node)
            : type === 'persistentvolume' && pvc ? this.podsUsingPVC(pvc) : []
        const workloads = this.workloadPods(pods)
        const nodes = type === 'persistentvolume' ? this.affinityNodes(this.props.node) : []
        const storageClassPVs = type === 'storageclass' ? this.resources('persistentvolume').filter(item => this.storageClassName(item) === name) : []
        const storageClassPVCs = type === 'storageclass' ? this.resources('persistentvolumeclaim').filter(item => this.storageClassName(item) === name) : []
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
        const explicitDriver = text(data, ['K8s.driver', 'driver'])
        const explicitPath = text(data, ['K8s.path', 'path'])
        const explicitVolumeHandle = text(data, ['K8s.volumeHandle', 'volumeHandle'])
        const pvSourceRows = type === 'persistentvolume'
            ? explicitSourceType
                ? [
                    { label: '볼륨 소스', value: explicitSourceType },
                    ...(explicitDriver ? [{ label: '드라이버', value: explicitDriver }] : []),
                    ...(explicitVolumeHandle ? [{ label: '볼륨 핸들', value: explicitVolumeHandle, textValue: explicitVolumeHandle, copyText: explicitVolumeHandle }] : []),
                    ...(explicitPath ? [{ label: '경로', value: explicitPath, textValue: explicitPath, tooltip: explicitPath, copyText: explicitPath }] : [])
                ]
                : volumeSourceDetails(spec)
            : []
        const fullNodeNames = nodes.map(node => this.name(node))
        const shortNodeName = (nodeName: string) => {
            if (nodeName.length <= 28) return nodeName
            const segments = nodeName.split('-')
            return segments.length > 2 ? segments.slice(-2).join('-') : nodeName
        }
        const fixedNodeValue = nodes.length
            ? <button type="button" className="netdive-k8s-storage-detail__node-link" onClick={() => this.focus(nodes)}>
                {fullNodeNames.map(shortNodeName).join(', ')}
            </button>
            : none
        const resourceTooltip = (label: string, resources: Node[]) => resources.length
            ? <span>{label}: {resources.map(resource => this.name(resource)).join(', ')}</span>
            : undefined
        const defaultStorageClass = data.K8s?.Default
            ?? data.Default
            ?? (meta.Annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true')
        const basicRows: any[] = [
            { label: type === 'storageclass' ? '스토리지 클래스 이름' : `${kindLabel} 이름`, value: name, textValue: name, copyText: name },
            ...(namespace ? [{ label: translate('kubernetesTopologyNamespaces'), value: namespace }] : []),
            ...(type !== 'storageclass' ? [{ label: '상태', value: phase || empty }] : [])
        ]
        const advancedRows: any[] = [
            { label: 'UID', value: meta.UID || this.props.node.id, textValue: meta.UID || this.props.node.id, copyText: meta.UID || this.props.node.id },
            { label: translate('kubernetesCreatedAt'), value: createdAt(creationTimestamp) }
        ]
        const policyRows: any[] = type === 'persistentvolumeclaim' ? [
            { label: '요청 용량', value: requested },
            { label: '실제 PV 용량', value: boundPVCapacity },
            { label: '볼륨 모드', value: String(volumeMode) },
            { label: '접근 모드', value: list(accessModeValues) },
            { label: '스토리지 클래스', value: this.storageClassName(this.props.node) || none }
        ] : type === 'persistentvolume' ? [
            { label: '용량', value: capacity },
            { label: '볼륨 모드', value: String(volumeMode) },
            { label: '접근 모드', value: list(accessModeValues) },
            ...pvSourceRows,
            { label: '회수 정책', value: text(data, ['K8s.reclaimPolicy', 'reclaimPolicy', 'K8s.ReclaimPolicy', 'ReclaimPolicy']) || field(spec, 'PersistentVolumeReclaimPolicy', 'persistentVolumeReclaimPolicy') || none },
            { label: '스토리지 클래스', value: this.storageClassName(this.props.node) || none },
            { label: '클레임 네임스페이스', value: pvc ? this.namespace(pvc) || none : text(data, ['K8s.ClaimNamespace', 'ClaimNamespace']) || none },
            { label: '클레임 이름', value: pvc ? this.name(pvc) : text(data, ['K8s.ClaimRef', 'ClaimRef']) || none },
            { label: '고정 노드', value: fixedNodeValue, tooltip: fullNodeNames.length ? fullNodeNames.join(', ') : undefined }
        ] : [
            { label: '기본 스토리지 클래스', value: <DetailBadge tone={defaultStorageClass ? 'info' : 'default'}>{defaultStorageClass ? '기본값' : '일반'}</DetailBadge> },
            { label: '프로비저너', value: spec.Provisioner || data.K8s?.Provisioner || data.Provisioner || none },
            { label: '회수 정책', value: spec.ReclaimPolicy || data.K8s?.ReclaimPolicy || data.ReclaimPolicy || none },
            { label: '바인딩 모드', value: spec.VolumeBindingMode || data.K8s?.VolumeBindingMode || data.VolumeBindingMode || none },
            { label: '볼륨 확장', value: spec.AllowVolumeExpansion === true || data.K8s?.AllowVolumeExpansion === true ? translate('yes') : translate('no') },
            { label: '매개변수', value: spec.Parameters && Object.keys(spec.Parameters).length ? Object.keys(spec.Parameters).map(key => `${key}=${spec.Parameters[key]}`).join(', ') : none }
        ]
        const directItems: any[] = [
            ...(pv ? [{ key: 'pv', label: 'PV', count: 1, icon: this.storageResourceIcon('persistentvolume'), iconTone: 'kubernetes' as const, tooltip: resourceTooltip('PV', [pv]), onClick: () => this.focus([pv]) }] : []),
            ...(pvc ? [{ key: 'pvc', label: 'PVC', count: 1, icon: this.storageResourceIcon('persistentvolumeclaim'), iconTone: 'kubernetes' as const, tooltip: resourceTooltip('PVC', [pvc]), onClick: () => this.focus([pvc]) }] : []),
            ...(storageClass ? [{ key: 'storage-class', label: 'StorageClass', count: 1, icon: this.storageResourceIcon('storageclass'), iconTone: 'kubernetes' as const, tooltip: resourceTooltip('StorageClass', [storageClass]), onClick: () => this.focus([storageClass]) }] : []),
            ...(storageClassPVCs.length ? [{ key: 'pvcs', label: 'PVC', count: storageClassPVCs.length, icon: this.storageResourceIcon('persistentvolumeclaim'), iconTone: 'kubernetes' as const, tooltip: resourceTooltip('PVC', storageClassPVCs), onClick: () => this.focus(storageClassPVCs) }] : []),
            ...(storageClassPVs.length ? [{ key: 'pvs', label: 'PV', count: storageClassPVs.length, icon: this.storageResourceIcon('persistentvolume'), iconTone: 'kubernetes' as const, tooltip: resourceTooltip('PV', storageClassPVs), onClick: () => this.focus(storageClassPVs) }] : []),
            ...(nodes.length ? [{ key: 'nodes', label: '노드', count: nodes.length, icon: this.topologyIcon(nodes[0]), iconTone: 'kubernetes' as const, tooltip: resourceTooltip('노드', nodes), onClick: () => this.focus(nodes) }] : [])
        ]
        const indirectItems: any[] = [
            ...(pods.length ? [{ key: 'pods', label: '파드', count: pods.length, icon: this.topologyIcon(pods[0]), iconTone: 'kubernetes' as const, tooltip: resourceTooltip('파드', pods), onClick: () => this.focus(pods) }] : []),
            ...(workloads.length ? [{ key: 'workloads', label: '워크로드', count: workloads.length, icon: this.topologyIcon(workloads[0]), iconTone: 'kubernetes' as const, tooltip: resourceTooltip('워크로드', workloads), onClick: () => this.focus(workloads) }] : [])
        ]
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
        return <div className="netdive-k8s-storage-detail">
            <DetailSectionCard icon={<InfoIcon />} title={`${kindLabel} 기본 정보`} collapsible collapsed={this.state.basicCollapsed} onToggle={() => this.setState({ basicCollapsed: !this.state.basicCollapsed })}>
                <BasicInfoRows density="compact" rows={basicRows} labelWidth={122} copyTooltip={translate('copy')} />
                <DetailAdvancedInfo title={translate('kubernetesAdvancedInformation')} active={this.state.basicInfoAdvanced} onChange={basicInfoAdvanced => this.setState({ basicInfoAdvanced })}>
                    <BasicInfoRows density="compact" rows={advancedRows} labelWidth={122} copyTooltip={translate('copy')} />
                    <KubernetesMetadataRows items={[
                        { key: 'labels', label: '라벨', resourceName: name, resourceKind: kindLabel, metadataKind: 'label', data: meta.Labels || meta.labels, modalTitle: `${kindLabel} 라벨` },
                        { key: 'annotations', label: '어노테이션', resourceName: name, resourceKind: kindLabel, metadataKind: 'annotation', data: meta.Annotations || meta.annotations, modalTitle: `${kindLabel} 어노테이션` }
                    ]} />
                </DetailAdvancedInfo>
            </DetailSectionCard>
            {type !== 'storageclass' && <DetailSectionCard icon={this.topologyIcon(this.props.node)} title={`${kindLabel} 운영 상태`}>
                <StatusSummaryGrid
                    verdict={storageVerdict}
                    verdictTone={storageTone}
                    rawStatus={phase || empty}
                    rawStatusLabel="Phase"
                    impact={storageImpact}
                    impactTooltip="최근 24시간 내 Binding·Mount·Attach 오류를 기준으로 표시합니다."
                    metrics={[
                        { key: 'recent', label: '최근 불안정성', value: recentFailureKnown ? recentFailureCount : collectionFailed, tone: recentFailureKnown ? (recentFailureCount > 0 ? 'warning' : 'default') : 'default', tooltip: '최근 24시간 내 발생한 Binding·Mount·Attach 오류 건수입니다.' },
                        { key: 'history', label: '누적 이력', value: recentEventGroups.reduce((sum, group) => sum + group.count, 0), tooltip: '보관 중인 전체 스토리지 이벤트의 누적 건수입니다.' }
                    ]}
                />
            </DetailSectionCard>}
            <DetailSectionCard icon={<StorageIcon />} title={type === 'storageclass' ? '프로비저닝 정책' : '용량 및 정책'}>
                <BasicInfoRows density="compact" rows={policyRows} labelWidth={122} copyTooltip={translate('copy')} />
            </DetailSectionCard>
            <RelatedResourceGrid icon={<AccountTreeIcon />} title={translate('hostConnectedResources')} emptyText="연결된 스토리지 자원이 없습니다." groups={[
                { key: 'direct', title: '직접 연결', icon: <StorageIcon />, items: directItems },
                { key: 'indirect', title: '간접 사용 관계', icon: <img src="assets/icons/k8s.png" alt="" />, items: indirectItems }
            ]} />
            <DetailSectionCard icon={<HistoryIcon />} title={type === 'storageclass' ? '프로비저닝 이력' : '최근 이벤트'}>
                <KubernetesRecentEvents groups={recentEventGroups} emptyText={type === 'storageclass' ? '수집된 프로비저닝 실패 이력이 없습니다.' : '최근 스토리지 관련 이벤트가 없습니다.'} onResourceClick={group => {
                    const target = this.topologyNodes().find(node => (!group.resourceUid || node.id === group.resourceUid || text(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'UID']) === group.resourceUid)
                        && (!group.resourceName || this.name(node) === group.resourceName))
                    if (target) this.focus([target])
                }} />
            </DetailSectionCard>
        </div>
    }
}

export default KubernetesStorageDetailPanel
