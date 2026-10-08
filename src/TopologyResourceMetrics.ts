import type { Node } from './Topology'
import type { TopologyMetric } from './TopologyNodePresentation'
import type { TopologyResourceSnapshot } from './TopologyResourceData'
import { topologyInfrastructureData } from './TopologyResourceData'
import { kubernetesCpuCores, kubernetesMemoryBytes } from './DataPanels/common/kubernetesQuantity'
import { formatPodCpuUsage, formatPodMemoryUsage } from './DataPanels/common/KubernetesPodUsageMetrics'
import { isCurrentKubernetesPod } from './KubernetesPodLifecycle'
import { resolveKubernetesPodTopController } from './KubernetesWorkloadOwnership'
import { rootDiskResources, formatRootDiskBytes, rootDiskDescription } from './DataPanels/common/RootDiskResources'

const raw = (data: any, paths: string[]) => {
    for (const path of paths) {
        const value = path.split('.').reduce((source, key) => source?.[key], data)
        if (value !== undefined && value !== null && value !== '') return value
    }
}
const numeric = (value: any): number | undefined => {
    if (value === undefined || value === null || value === '' || typeof value === 'boolean') return undefined
    const result = Number(String(value).replace(/%$/, ''))
    return Number.isFinite(result) && result >= 0 ? result : undefined
}
const format = (value: number, memory: boolean) =>
    (memory ? formatPodMemoryUsage(value) : formatPodCpuUsage(value)).replace(/ /g, '')
// Mold VM memory is in MiB when unitless, unlike Kubernetes byte quantities.
export const vmMemoryBytes = (value: any) => {
    const mib = numeric(value)
    return mib !== undefined ? mib * 1024 * 1024
        : typeof value === 'string' ? kubernetesMemoryBytes(value.trim().replace(/B$/i, '')) : undefined
}
const metric = (key: string, usage?: number, basis?: number, directPercent?: number): TopologyMetric => {
    const memory = key === 'memory'
    const percent = usage !== undefined && basis !== undefined && basis > 0 ? usage / basis * 100 : directPercent
    const measured = usage !== undefined || percent !== undefined
    const label = `${memory ? '메모리' : 'CPU'}${!measured && basis !== undefined ? ' 용량' : ''}`
    return { key, label, value: percent !== undefined ? `${Number(percent.toFixed(1))}%`
        : usage !== undefined ? !memory && usage < 1 ? `${Math.round(usage * 1000)}m` : format(usage, memory)
            : basis !== undefined ? format(basis, memory) : '미수집', percent,
        description: [measured ? '현재 사용량' : '실시간 사용량 미수집', usage !== undefined ? format(usage, memory) : undefined,
            basis !== undefined ? `할당 가능 용량 ${format(basis, memory)}` : undefined].filter(Boolean).join(' · ') }
}
const namespace = (node: Node) => String(raw(node.data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) || '')
const clusterName = (node: Node) => {
    const visited = new Set<Node>()
    for (let parent: Node | null = node; parent && !visited.has(parent); parent = parent.parent) {
        visited.add(parent)
        const value = raw(parent.data, ['ClusterID', 'K8s.ClusterID', 'ClusterName', 'K8s.ClusterName'])
        if (value) return String(value)
        if (String(parent.data?.Type).toLowerCase() === 'cluster') return parent.id
    }
    return ''
}

export const topologyResourceMetrics = (node: Node, snapshot: TopologyResourceSnapshot = {}, allNodes: Node[] = []): TopologyMetric[] => {
    const data = topologyInfrastructureData(node, snapshot), type = String(data.Type || '').toLowerCase()
    if (type === 'cluster') {
        const resources = snapshot.summary?.resources || {}
        return [metric('cpu', resources.metricsAvailable === true ? numeric(resources.usageCpuCores) ?? 0 : undefined, numeric(resources.allocatableCpuCores)),
            metric('memory', resources.metricsAvailable === true ? numeric(resources.usageMemoryBytes) ?? 0 : undefined, numeric(resources.allocatableMemoryBytes))]
    }
    if (['node', 'host', 'libvirt'].includes(type)) {
        const detail = snapshot.detail || {}
        const usage = detail.usage || detail.currentUsage || detail.metrics?.usage
            || raw(data, ['K8s.Metrics.Usage', 'K8s.Extra.Usage', 'Metrics.Usage']) || {}
        const basis = detail.allocatable || raw(data, ['K8s.Extra.Status.Allocatable', 'K8s.Extra.status.allocatable', 'K8s.Status.Allocatable']) || {}
        const metrics = ['cpu', 'memory'].map(key => {
            const series = snapshot.wall?.series?.find(item => item.key === key)
            const paths = key === 'cpu' ? ['CPUUsagePercent', 'CPUPercent', 'CpuUsagePercent', 'cpuUsagePercent', 'CPUUsage', 'cpuUsage', 'Metrics.CPUUsagePercent', 'K8s.Metrics.CPUUsagePercent']
                : ['MemoryUsagePercent', 'MemoryPercent', 'memoryPercent', 'memoryUsagePercent', 'Metrics.MemoryUsagePercent', 'K8s.Metrics.MemoryUsagePercent']
            const rate = numeric(series?.lastValue) ?? numeric(raw(data, paths))
            const result = metric(key, key === 'cpu' ? kubernetesCpuCores(usage.cpu) : kubernetesMemoryBytes(usage.memory),
                key === 'cpu' ? kubernetesCpuCores(basis.cpu) ?? (['host', 'libvirt'].includes(type) ? numeric(data.CpuNumber) : undefined)
                    : kubernetesMemoryBytes(basis.memory) ?? (type === 'host' ? kubernetesMemoryBytes(data.MemoryTotal)
                        : type === 'libvirt' ? vmMemoryBytes(data.Memory) : undefined),
                rate !== undefined && rate <= 100 ? rate : undefined)
            if (type === 'libvirt') return { ...result, label: result.label.replace(' 용량', ' 할당'),
                description: result.description?.replace('할당 가능 용량', '할당 자원') }
            if (type === 'host' && result.percent === undefined) {
                const allocated = numeric(data[key === 'cpu' ? 'CPUAllocatedPercent' : 'MemoryAllocatedPercent'])
                const used = numeric(data[key === 'cpu' ? 'CPUAllocated' : 'MemoryAllocated'])
                const total = numeric(data[key === 'cpu' ? 'CPUTotal' : 'MemoryTotal'])
                const allocation = allocated ?? (used !== undefined && total !== undefined && total > 0 ? used / total * 100 : undefined)
                if (allocation !== undefined) return { key, label: key === 'cpu' ? 'CPU 할당' : '메모리 할당',
                    value: `${Number(allocation.toFixed(1))}%`, percent: allocation,
                    description: 'Mold 자원 할당률 · 실시간 사용률 미수집' }
            }
            return result
        })
        const disk = ['host', 'libvirt'].includes(type) ? rootDiskResources(snapshot.wall) : undefined
        if (disk) metrics.push({ key: 'root-disk', label: '루트 디스크',
            value: disk.used !== undefined ? `${formatRootDiskBytes(disk.used)} / ${formatRootDiskBytes(disk.total)}` : formatRootDiskBytes(disk.total),
            percent: disk.percent, description: rootDiskDescription(disk) })
        return metrics
    }
    const supported = ['pod', 'namespace', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(type)
    if (!supported) return []
    const records: any[] = snapshot.summary?.resources?.podUsage || []
    const scoped = allNodes.filter(pod => String(pod.data?.Type).toLowerCase() === 'pod'
        && String(pod.data?.Manager).toLowerCase() === 'k8s' && isCurrentKubernetesPod(pod)
        && (!clusterName(node) || clusterName(node) === clusterName(pod)))
    const pods = type === 'pod' ? (isCurrentKubernetesPod(node) ? [node] : []) : type === 'namespace'
        ? scoped.filter(pod => namespace(pod) === String(data.Name || ''))
        : scoped.filter(pod => resolveKubernetesPodTopController(pod, allNodes)?.id === node.id)
    const matched = pods.map(pod => records.find(record => record.namespace === namespace(pod) && record.name === String(pod.data?.Name || pod.data?.K8s?.Name || '')))
    // A missing Pod measurement is not a zero, nor a complete workload total.
    if (!pods.length || matched.some(record => !record)) return type === 'pod' ? [metric('cpu'), metric('memory')] : []
    return [metric('cpu', matched.reduce((sum, record) => sum + (numeric(record.usageCpuCores) ?? 0), 0)),
        metric('memory', matched.reduce((sum, record) => sum + (numeric(record.usageMemoryBytes) ?? 0), 0))]
}
