import * as React from 'react'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import HistoryIcon from '@material-ui/icons/History'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'

import { translate } from '../Config'
import { Node } from '../Topology'
import { matchesKubernetesSelector } from '../KubernetesSelectors'
import { collectKubernetesEventGroups, ConnectedResourcesSection, DetailKeyValueList, DetailSection, formatKubernetesQuantity, KubernetesRecentEvents, KubernetesStateSeparation } from './common'
import './KubernetesNodeDetailPanel.css'
import './KubernetesStorageDetailPanel.css'

interface Props {
    node: Node
    nodeAttrs: (node: Node) => any
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
const volumeSourceDetails = (spec: any): Array<{ label: string, value: React.ReactNode }> => {
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
            { label: 'Volume Source', value: definition.type },
            ...(driver ? [{ label: 'Driver', value: String(driver) }] : []),
            ...(volumeHandle ? [{ label: 'VolumeHandle', value: String(volumeHandle) }] : []),
            ...(path ? [{ label: 'Path', value: String(path) }] : []),
            ...(server ? [{ label: 'Server', value: String(server) }] : [])
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

class KubernetesStorageDetailPanel extends React.Component<Props> {
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
        return raw(node.data || {}, ['K8s.Extra.Spec']) || {}
    }

    private status(node: Node): any {
        return raw(node.data || {}, ['K8s.Extra.Status']) || {}
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
        return text(node.data || {}, ['K8s.StorageClassName', 'StorageClassName', 'K8s.Extra.Spec.StorageClassName'])
    }

    private pvForPVC(pvc: Node): Node | undefined {
        const volumeName = text(pvc.data || {}, ['K8s.VolumeName', 'VolumeName', 'K8s.Extra.Spec.VolumeName'])
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
        return attrs.href ? <img className="netdive-k8s-node-detail__topology-icon-image" src={attrs.href} alt="" /> : <span className="netdive-k8s-node-detail__topology-icon">{attrs.icon}</span>
    }

    render() {
        const data = this.props.node.data || {}
        const type = String(data.Type || '').toLowerCase()
        const name = this.name(this.props.node)
        const namespace = this.namespace(this.props.node)
        const spec = this.spec(this.props.node)
        const status = this.status(this.props.node)
        const meta = raw(data, ['K8s.Extra.ObjectMeta']) || {}
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
        const requested = formatKubernetesQuantity(storageQuantity(requestValues), none, collectionFailed)
        const capacityValue = storageQuantity(field(spec, 'Capacity', 'capacity'))
            || storageQuantity(field(status, 'Capacity', 'capacity'))
            || raw(data, ['K8s.Capacity.storage', 'K8s.Capacity.Storage', 'Capacity.storage', 'Capacity.Storage'])
        const capacity = capacityValue === undefined
            ? empty
            : formatKubernetesQuantity(capacityValue, empty, collectionFailed)
        const kindLabel = type === 'persistentvolumeclaim' ? 'PVC' : type === 'persistentvolume' ? 'PV' : 'StorageClass'
        const accessModeValues = field(spec, 'AccessModes', 'accessModes')
        const accessModes = Array.isArray(accessModeValues) ? accessModeValues.map(String) : []
        const persistentVolumeSource = field(spec, 'PersistentVolumeSource', 'persistentVolumeSource') || spec
        const local = field(persistentVolumeSource, 'Local', 'local')
        const hostPath = field(persistentVolumeSource, 'HostPath', 'hostPath')
        const localPath = field(local, 'Path', 'path') || field(hostPath, 'Path', 'path')
        const volumeMode = field(spec, 'VolumeMode', 'volumeMode') || 'Filesystem'
        const pvSourceRows = type === 'persistentvolume' ? volumeSourceDetails(spec) : []
        const rwo = accessModes.some(mode => mode === 'ReadWriteOnce' || mode === 'RWO')
        const structuralFeatures = type === 'persistentvolume'
            ? [localPath ? 'local-path' : '', rwo ? 'RWO' : '', nodes.length ? `Node ${nodes.length}대` : ''].filter(Boolean)
            : []
        const basicRows: any[] = [
            { label: `${kindLabel} 이름`, value: name, textValue: name, copyText: name },
            ...(namespace ? [{ label: translate('kubernetesTopologyNamespaces'), value: namespace }] : []),
            ...(type !== 'storageclass' ? [{ label: 'Phase', value: phase || empty }] : []),
            { label: 'UID', value: meta.UID || this.props.node.id, textValue: meta.UID || this.props.node.id, copyText: meta.UID || this.props.node.id },
            { label: translate('kubernetesCreatedAt'), value: createdAt(meta.CreationTimestamp) }
        ]
        const policyRows: any[] = type === 'persistentvolumeclaim' ? [
            { label: '요청 용량', value: requested },
            { label: '실제 PV 용량', value: pv
                ? (() => {
                    const pvSpec = this.spec(pv)
                    const pvStatus = this.status(pv)
                    const value = storageQuantity(field(pvSpec, 'Capacity', 'capacity'))
                        || storageQuantity(field(pvStatus, 'Capacity', 'capacity'))
                        || raw(pv.data || {}, ['K8s.Capacity.storage', 'K8s.Capacity.Storage', 'Capacity.storage', 'Capacity.Storage'])
                    return value === undefined ? empty : formatKubernetesQuantity(value, empty, collectionFailed)
                })()
                : none },
            { label: 'Volume Mode', value: String(volumeMode) },
            { label: 'Access Mode', value: list(accessModeValues) },
            { label: 'StorageClass', value: this.storageClassName(this.props.node) || none }
        ] : type === 'persistentvolume' ? [
            { label: 'Capacity', value: capacity },
            { label: 'Volume Mode', value: String(volumeMode) },
            { label: 'Access Modes', value: list(accessModeValues) },
            ...pvSourceRows,
            { label: 'Reclaim Policy', value: field(spec, 'PersistentVolumeReclaimPolicy', 'persistentVolumeReclaimPolicy') || text(data, ['K8s.ReclaimPolicy', 'ReclaimPolicy']) || none },
            { label: 'StorageClass', value: this.storageClassName(this.props.node) || none },
            { label: 'Claim Namespace', value: pvc ? this.namespace(pvc) || none : text(data, ['K8s.ClaimNamespace', 'ClaimNamespace']) || none },
            { label: 'Claim Name', value: pvc ? this.name(pvc) : text(data, ['K8s.ClaimRef', 'ClaimRef']) || none },
            { label: 'Node Affinity', value: nodes.length ? nodes.map(node => this.name(node)).join(', ') : none }
        ] : [
            { label: '기본 StorageClass', value: (data.K8s?.Default ?? data.Default ?? (meta.Annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true')) ? translate('yes') : translate('no') },
            { label: 'Provisioner', value: spec.Provisioner || data.K8s?.Provisioner || data.Provisioner || none },
            { label: 'Reclaim Policy', value: spec.ReclaimPolicy || data.K8s?.ReclaimPolicy || data.ReclaimPolicy || none },
            { label: 'Volume Binding Mode', value: spec.VolumeBindingMode || data.K8s?.VolumeBindingMode || data.VolumeBindingMode || none },
            { label: 'Volume Expansion', value: spec.AllowVolumeExpansion === true || data.K8s?.AllowVolumeExpansion === true ? translate('yes') : translate('no') },
            { label: 'Parameters', value: spec.Parameters && Object.keys(spec.Parameters).length ? Object.keys(spec.Parameters).map(key => `${key}=${spec.Parameters[key]}`).join(', ') : none }
        ]
        const directItems: any[] = [
            ...(pv ? [{ key: 'pv', label: 'PersistentVolume', count: 1, icon: this.topologyIcon(pv), iconTone: 'kubernetes' as const, onClick: () => this.focus([pv]) }] : []),
            ...(pvc ? [{ key: 'pvc', label: 'PersistentVolumeClaim', count: 1, icon: this.topologyIcon(pvc), iconTone: 'kubernetes' as const, onClick: () => this.focus([pvc]) }] : []),
            ...(storageClass ? [{ key: 'storage-class', label: 'StorageClass', count: 1, icon: this.topologyIcon(storageClass), iconTone: 'kubernetes' as const, onClick: () => this.focus([storageClass]) }] : []),
            ...(storageClassPVs.length ? [{ key: 'pvs', label: 'PersistentVolume', count: storageClassPVs.length, icon: this.topologyIcon(storageClassPVs[0]), iconTone: 'kubernetes' as const, onClick: () => this.focus(storageClassPVs) }] : []),
            ...(storageClassPVCs.length ? [{ key: 'pvcs', label: 'PersistentVolumeClaim', count: storageClassPVCs.length, icon: this.topologyIcon(storageClassPVCs[0]), iconTone: 'kubernetes' as const, onClick: () => this.focus(storageClassPVCs) }] : []),
            ...(nodes.length ? [{ key: 'nodes', label: translate('kubernetesTopologyNodes'), count: nodes.length, icon: this.topologyIcon(nodes[0]), iconTone: 'kubernetes' as const, onClick: () => this.focus(nodes) }] : [])
        ]
        const indirectItems: any[] = [
            ...(pods.length ? [{ key: 'pods', label: translate('kubernetesTopologyPods'), count: pods.length, icon: this.topologyIcon(pods[0]), iconTone: 'kubernetes' as const, onClick: () => this.focus(pods) }] : []),
            ...(workloads.length ? [{ key: 'workloads', label: translate('kubernetesTopologyWorkloadControllers'), count: workloads.length, icon: this.topologyIcon(workloads[0]), iconTone: 'kubernetes' as const, onClick: () => this.focus(workloads) }] : [])
        ]
        return <div className="netdive-k8s-node-detail netdive-k8s-storage-detail">
            <DetailSection icon={<InfoIcon />} title={`${kindLabel} 기본 정보`}><DetailKeyValueList rows={basicRows} copyTooltip={translate('copy')} /></DetailSection>
            {type !== 'storageclass' && <DetailSection icon={this.topologyIcon(this.props.node)} title={`${kindLabel} 운영 상태`}>
                <KubernetesStateSeparation items={[
                    { key: 'recent', label: '최근 불안정성', value: recentFailureKnown ? recentFailureCount : collectionFailed, tone: recentFailureKnown ? (recentFailureCount > 0 ? 'warning' : 'success') : 'default', tooltip: '최근 24시간의 Binding·Mount·Attach 오류입니다.' },
                    { key: 'history', label: '누적 이력', value: recentEventGroups.reduce((sum, group) => sum + group.count, 0), tone: 'history', tooltip: '수집된 스토리지 Event 누적 횟수입니다.' },
                    ...(type === 'persistentvolume' ? [{ key: 'structural', label: '구조적 특성', value: structuralFeatures.length ? structuralFeatures.join(' · ') : '일반', tone: 'default' as const, tooltip: 'local-path, RWO Access Mode와 Node 종속성은 현재 장애가 아닌 구조적 특성입니다.' }] : [])
                ]} />
            </DetailSection>}
            <DetailSection icon={<StorageIcon />} title={type === 'storageclass' ? '프로비저닝 정책' : '용량 및 정책'}><DetailKeyValueList rows={policyRows} /></DetailSection>
            <ConnectedResourcesSection icon={<AccountTreeIcon />} title={translate('hostConnectedResources')} emptyText="연결된 스토리지 자원이 없습니다." groups={[
                { key: 'direct', title: '직접 연결', icon: <StorageIcon />, items: directItems },
                { key: 'indirect', title: '간접 사용 관계', icon: <img src="assets/icons/k8s.png" alt="" />, items: indirectItems }
            ]} />
            <DetailSection icon={<HistoryIcon />} title={type === 'storageclass' ? '프로비저닝 이력' : '최근 이벤트'}>
                <KubernetesRecentEvents groups={recentEventGroups} emptyText={type === 'storageclass' ? '수집된 프로비저닝 실패 이력이 없습니다.' : '최근 Binding·Mount 오류가 없습니다.'} onResourceClick={group => {
                    const target = this.topologyNodes().find(node => (!group.resourceUid || node.id === group.resourceUid || text(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'UID']) === group.resourceUid)
                        && (!group.resourceName || this.name(node) === group.resourceName))
                    if (target) this.focus([target])
                }} />
            </DetailSection>
        </div>
    }
}

export default KubernetesStorageDetailPanel
