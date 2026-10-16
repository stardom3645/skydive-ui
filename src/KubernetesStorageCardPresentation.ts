import type { TopologyMetric } from './TopologyNodePresentation'
import { formatKubernetesQuantity } from './DataPanels/common/kubernetesQuantity'
import { kubernetesAccessModesLabel, kubernetesReclaimPolicyLabel } from './DataPanels/common/KubernetesDataPresentation'
import { kubernetesStorageObservation } from './KubernetesStorageStatus'

const at = (data: any, path: string): any => path.split('.').reduce((value, key) => value?.[key], data)
const firstText = (data: any, paths: string[]): string => {
    for (const path of paths) {
        const value = at(data, path)
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return ''
}
const quantity = (data: any, paths: string[]): string | undefined => {
    let provided = false
    for (const path of paths) {
        // Go Quantity can arrive as { Format: 'BinarySI' } without a number.
        // Skip that unusable object and try the collector's normalized value.
        const source = at(data, path)
        if (source !== undefined && source !== null && source !== '') provided = true
        const value = formatKubernetesQuantity(source, '', '')
        if (value) return value
    }
    return provided ? '' : undefined
}
const specs = ['K8s.Extra.Spec', 'K8s.Extra.spec', 'K8s.Spec', 'Spec', 'spec']
const statuses = ['K8s.Extra.Status', 'K8s.Extra.status', 'K8s.StatusObject', 'StatusObject', 'Status', 'status']
const paths = (sources: string[], names: string[]) => sources.reduce((result, source) => result.concat(names.map(name => `${source}.${name}`)), [] as string[])

/** Configuration and API-reported allocation only; no usage, rate or graph scan. */
export const kubernetesStorageCardMetrics = (data: any): TopologyMetric[] => {
    const pv = String(data.Type || '').toLowerCase() === 'persistentvolume'
    const pending = !pv && String(kubernetesStorageObservation(data).phase || '').toLowerCase() === 'pending'
    const capacity = pv ? quantity(data, [
        'K8s.capacity', 'capacity', 'K8s.Capacity.storage', 'K8s.Capacity.Storage', 'Capacity.storage', 'Capacity.Storage',
        ...paths(specs, ['Capacity.storage', 'Capacity.Storage', 'capacity.storage'])
    ]) : pending ? quantity(data, [
        'K8s.requestStorage', 'requestStorage', 'K8s.RequestedCapacity', 'RequestedCapacity',
        ...paths(specs, ['Resources.Requests.storage', 'resources.requests.storage'])
    ]) : quantity(data, [
        'K8s.actualCapacity', 'actualCapacity', 'K8s.StatusCapacity', 'StatusCapacity',
        'K8s.StatusCapacity.storage', 'StatusCapacity.storage',
        ...paths(statuses, ['Capacity.storage', 'Capacity.Storage', 'capacity.storage'])
    ])
    const metrics: TopologyMetric[] = capacity === undefined ? [] : [{ key: 'capacity', label: pv ? '볼륨 용량' : pending ? '요청 용량' : '할당 용량',
        value: capacity || '확인 불가', description: pv ? 'PV에 설정된 볼륨 용량 · 실제 사용량 아님'
            : pending ? 'PVC가 요청한 용량 · 아직 할당된 용량 아님' : 'Kubernetes가 보고한 PVC 할당 용량 · 실제 사용량 아님' }]
    const accessPaths = [...paths(specs, ['AccessModes', 'accessModes']), 'K8s.AccessModes', 'K8s.accessModes', 'AccessModes', 'accessModes',
        ...paths(statuses, ['AccessModes', 'accessModes'])]
    const modes = accessPaths.map(path => at(data, path)).find(value => Array.isArray(value) && value.length)
    if (modes) metrics.push({ key: 'access-modes', label: '접근 모드',
        value: modes.map(mode => ({ ReadWriteOnce: 'RWO', ReadOnlyMany: 'ROX', ReadWriteMany: 'RWX', ReadWriteOncePod: 'RWOP' }[String(mode)] || String(mode))).join(', '),
        description: kubernetesAccessModesLabel(modes) })
    if (pv) {
        const policy = firstText(data, [...paths(specs, ['PersistentVolumeReclaimPolicy', 'persistentVolumeReclaimPolicy']),
            'K8s.ReclaimPolicy', 'K8s.reclaimPolicy', 'ReclaimPolicy', 'reclaimPolicy'])
        if (policy) metrics.push({ key: 'reclaim-policy', label: '회수 정책', value: kubernetesReclaimPolicyLabel(policy), description: policy })
    } else {
        const storageClass = firstText(data, [...paths(specs, ['StorageClassName', 'storageClassName']),
            'K8s.StorageClassName', 'K8s.storageClassName', 'StorageClassName', 'storageClassName'])
        if (storageClass) metrics.push({ key: 'storage-class', label: '스토리지 클래스', value: storageClass })
    }
    return metrics
}
