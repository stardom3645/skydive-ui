import * as React from 'react'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import HistoryIcon from '@material-ui/icons/History'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'

import { translate } from '../Config'
import { Node } from '../Topology'
import { ConnectedResourcesSection, DetailEmpty, DetailKeyValueList, DetailSection, formatKubernetesQuantity } from './common'
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
const createdAt = (value: any): string => {
    const source = value && typeof value === 'object' && value.Time ? value.Time : value
    if (!source) return translate('kubernetesNotCollected')
    const date = new Date(source)
    return Number.isNaN(date.getTime()) ? String(source) : date.toLocaleString()
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
            const expressionMatch = expressions.every(expression => {
                const key = String(expression?.Key || '')
                const operator = String(expression?.Operator || '')
                const values = Array.isArray(expression?.Values) ? expression.Values.map(String) : []
                const exists = Object.prototype.hasOwnProperty.call(labels, key)
                const value = exists ? String(labels[key]) : ''
                if (operator === 'In') return exists && values.includes(value)
                if (operator === 'NotIn') return exists && !values.includes(value)
                if (operator === 'Exists') return exists
                if (operator === 'DoesNotExist') return !exists
                return false
            })
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
        const none = translate('kubernetesNone')
        const unavailable = translate('kubernetesInformationUnavailable')
        const phase = String(status.Phase || text(data, ['K8s.Status', 'Status']) || '')
        const phaseLower = phase.toLowerCase()
        const tone = phaseLower === 'bound' ? 'success' : phaseLower === 'failed' || phaseLower === 'lost' ? 'danger' : phaseLower === 'pending' || phaseLower === 'released' ? 'warning' : 'info'
        const stateLabel = phase || (type === 'storageclass' ? translate('kubernetesCollected') : translate('kubernetesHealthUnknown'))
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
        const requested = formatKubernetesQuantity(spec?.Resources?.Requests?.storage, none, unavailable)
        const capacity = formatKubernetesQuantity(spec?.Capacity?.storage || status?.Capacity?.storage || raw(data, ['K8s.Capacity.storage', 'Capacity.storage']), none, unavailable)
        const kindLabel = type === 'persistentvolumeclaim' ? 'PVC' : type === 'persistentvolume' ? 'PV' : 'StorageClass'
        const basicRows: any[] = [
            { label: `${kindLabel} 이름`, value: name, textValue: name, copyText: name },
            ...(namespace ? [{ label: translate('kubernetesTopologyNamespaces'), value: namespace }] : []),
            ...(type !== 'storageclass' ? [{ label: 'Phase', value: phase || unavailable }] : []),
            { label: 'UID', value: meta.UID || this.props.node.id, textValue: meta.UID || this.props.node.id, copyText: meta.UID || this.props.node.id },
            { label: translate('kubernetesCreatedAt'), value: createdAt(meta.CreationTimestamp) }
        ]
        const policyRows: any[] = type === 'persistentvolumeclaim' ? [
            { label: '요청 용량', value: requested },
            { label: '실제 PV 용량', value: pv ? formatKubernetesQuantity(this.spec(pv)?.Capacity?.storage || this.status(pv)?.Capacity?.storage || raw(pv.data || {}, ['K8s.Capacity.storage']), none, unavailable) : none },
            { label: 'Access Mode', value: list(spec.AccessModes) },
            { label: 'StorageClass', value: this.storageClassName(this.props.node) || none }
        ] : type === 'persistentvolume' ? [
            { label: 'Capacity', value: capacity },
            { label: 'Access Modes', value: list(spec.AccessModes) },
            { label: 'Reclaim Policy', value: spec.PersistentVolumeReclaimPolicy || text(data, ['K8s.ReclaimPolicy', 'ReclaimPolicy']) || none },
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
        const storageItems: any[] = [
            ...(pv ? [{ key: 'pv', label: 'PersistentVolume', count: 1, icon: this.topologyIcon(pv), iconTone: 'kubernetes' as const, onClick: () => this.focus([pv]) }] : []),
            ...(pvc ? [{ key: 'pvc', label: 'PersistentVolumeClaim', count: 1, icon: this.topologyIcon(pvc), iconTone: 'kubernetes' as const, onClick: () => this.focus([pvc]) }] : []),
            ...(storageClass ? [{ key: 'storage-class', label: 'StorageClass', count: 1, icon: this.topologyIcon(storageClass), iconTone: 'kubernetes' as const, onClick: () => this.focus([storageClass]) }] : []),
            ...(storageClassPVs.length ? [{ key: 'pvs', label: 'PersistentVolume', count: storageClassPVs.length, icon: this.topologyIcon(storageClassPVs[0]), iconTone: 'kubernetes' as const, onClick: () => this.focus(storageClassPVs) }] : []),
            ...(storageClassPVCs.length ? [{ key: 'pvcs', label: 'PersistentVolumeClaim', count: storageClassPVCs.length, icon: this.topologyIcon(storageClassPVCs[0]), iconTone: 'kubernetes' as const, onClick: () => this.focus(storageClassPVCs) }] : [])
        ]
        return <div className="netdive-k8s-node-detail netdive-k8s-storage-detail">
            <DetailSection icon={<InfoIcon />} title={`${kindLabel} 기본 정보`}><DetailKeyValueList rows={basicRows} copyTooltip={translate('copy')} /></DetailSection>
            {type !== 'storageclass' && <DetailSection icon={this.topologyIcon(this.props.node)} title={`${kindLabel} 운영 상태`}>
                <div className={`netdive-k8s-node-detail__hero netdive-k8s-node-detail__hero--${tone}`}><i /><strong>{stateLabel}</strong><span>{phaseLower === 'bound' ? '스토리지 바인딩이 정상입니다.' : '스토리지 상태를 확인하세요.'}</span></div>
            </DetailSection>}
            <DetailSection icon={<StorageIcon />} title={type === 'storageclass' ? '프로비저닝 정책' : '용량 및 정책'}><DetailKeyValueList rows={policyRows} /></DetailSection>
            <ConnectedResourcesSection icon={<AccountTreeIcon />} title={translate('hostConnectedResources')} emptyText="연결된 스토리지 자원이 없습니다." groups={[
                { key: 'kubernetes', title: translate('kubernetesConnectedResourceGroup'), icon: <img src="assets/icons/k8s.png" alt="" />, items: [
                    ...(pods.length ? [{ key: 'pods', label: translate('kubernetesTopologyPods'), count: pods.length, icon: this.topologyIcon(pods[0]), iconTone: 'kubernetes' as const, onClick: () => this.focus(pods) }] : []),
                    ...(workloads.length ? [{ key: 'workloads', label: translate('kubernetesTopologyWorkloadControllers'), count: workloads.length, icon: this.topologyIcon(workloads[0]), iconTone: 'kubernetes' as const, onClick: () => this.focus(workloads) }] : [])
                ] },
                { key: 'storage', title: '스토리지', icon: <StorageIcon />, items: storageItems },
                { key: 'nodes', title: '인프라', icon: <AccountTreeIcon />, items: nodes.length ? [{ key: 'nodes', label: translate('kubernetesTopologyNodes'), count: nodes.length, icon: this.topologyIcon(nodes[0]), iconTone: 'kubernetes' as const, onClick: () => this.focus(nodes) }] : [] }
            ]} />
            {type !== 'storageclass' && <DetailSection icon={<HistoryIcon />} title="최근 이벤트"><DetailEmpty description="최근 이벤트 정보가 수집되지 않았습니다." compact /></DetailSection>}
        </div>
    }
}

export default KubernetesStorageDetailPanel
