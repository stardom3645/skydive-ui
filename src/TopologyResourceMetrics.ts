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
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim()) || typeof value === 'boolean') return undefined
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
// Capacity and allocatable are Kubernetes API inventory, not utilization.
const kubernetesResourceMetric = (key: string, usage: number | undefined, allocatable?: number,
    capacity?: number, percent?: number): TopologyMetric => {
    const result = metric(key, usage, allocatable ?? capacity, percent)
    const measured = usage !== undefined || percent !== undefined
    const inventory = allocatable !== undefined || capacity !== undefined
    return { ...result, source: measured || !inventory ? 'usage' : 'inventory',
        description: measured ? [result.description, capacity !== undefined ? `전체 용량 ${format(capacity, key === 'memory')}` : undefined].filter(Boolean).join(' · ') : inventory ? ['Kubernetes API',
            allocatable !== undefined ? `할당 가능 자원 ${format(allocatable, key === 'memory')}` : undefined,
            capacity !== undefined ? `전체 용량 ${format(capacity, key === 'memory')}` : undefined].filter(Boolean).join(' · ') : result.description }
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

// Query capability comes from the existing summary/Node usage response, not
// Mold inventory capacities or the topology collector's enabled flag.
export const kubernetesMetricsAvailable = (node: Node, snapshot: TopologyResourceSnapshot = {}): boolean => {
    if (String(node.data?.Manager).toLowerCase() !== 'k8s') return false
    const resources = snapshot.summary?.resources
    if (resources?.metricsAvailable === true) return true
    if (Array.isArray(resources?.podUsage) && resources.podUsage.some(record =>
        numeric(record.usageCpuCores) !== undefined || numeric(record.usageMemoryBytes) !== undefined)) return true
    if (String(node.data?.Type).toLowerCase() !== 'node') return false
    const usage = snapshot.detail?.usage || snapshot.detail?.currentUsage || snapshot.detail?.metrics?.usage
        || raw(node.data, ['K8s.Metrics.Usage', 'K8s.Extra.Usage', 'Metrics.Usage']) || {}
    return kubernetesCpuCores(usage.cpu) !== undefined || kubernetesMemoryBytes(usage.memory) !== undefined
        || ['CPUUsagePercent', 'CPUPercent', 'CpuUsagePercent', 'cpuUsagePercent', 'CPUUsage', 'cpuUsage',
            'Metrics.CPUUsagePercent', 'K8s.Metrics.CPUUsagePercent', 'MemoryUsagePercent', 'MemoryPercent',
            'memoryPercent', 'memoryUsagePercent', 'Metrics.MemoryUsagePercent', 'K8s.Metrics.MemoryUsagePercent']
            .some(path => { const value = numeric(raw(node.data, [path])); return value !== undefined && value <= 100 })
}

/** One lazy index per card-update pass. Never retain mutable graph/snapshot
 * lookups across renders: ownership, Pod phase and metrics may all change. */
export const createTopologyResourceMetricsIndex = (allNodes: Node[],
    snapshotForNode: (node: Node) => TopologyResourceSnapshot | undefined = () => undefined,
    clusterScope?: (node: Node) => string | undefined) => {
    let currentPods: Node[] | undefined
    const clusters = new WeakMap<Node, string>()
    const controllers = new WeakMap<Node, Node | undefined>()
    const recordsBySnapshot = new WeakMap<any[], Map<string, any>>()
    const nodeRows = new WeakMap<Node, number>()
    let availableClusters: Set<string> | undefined
    const cluster = (node: Node) => {
        if (!clusters.has(node)) clusters.set(node, clusterScope?.(node) || clusterName(node))
        return clusters.get(node)!
    }
    return {
        nodeResourceRowHeight(node: Node) {
            if (!nodeRows.has(node)) nodeRows.set(node, kubernetesNodeResourceRowHeight(node, snapshotForNode(node)))
            return nodeRows.get(node)!
        },
        metricsAvailable(node: Node, snapshot?: TopologyResourceSnapshot) {
            if (kubernetesMetricsAvailable(node, snapshot)) return true
            if (!availableClusters) {
                availableClusters = new Set()
                allNodes.forEach(resource => {
                    const scope = cluster(resource)
                    if (scope && kubernetesMetricsAvailable(resource, snapshotForNode(resource))) availableClusters!.add(scope)
                })
            }
            const scope = cluster(node)
            return !!scope && availableClusters.has(scope)
        },
        scopedPods(node: Node) {
            if (!currentPods) currentPods = allNodes.filter(pod => String(pod.data?.Type).toLowerCase() === 'pod'
                && String(pod.data?.Manager).toLowerCase() === 'k8s' && isCurrentKubernetesPod(pod))
            const scope = cluster(node)
            return scope ? currentPods.filter(pod => cluster(pod) === scope) : currentPods
        },
        controller(pod: Node) {
            if (!controllers.has(pod)) controllers.set(pod, resolveKubernetesPodTopController(pod, allNodes))
            return controllers.get(pod)
        },
        record(records: any[], pod: Node) {
            let index = recordsBySnapshot.get(records)
            if (!index) {
                index = new Map()
                records.forEach(record => {
                    const key = JSON.stringify([record.namespace, record.name])
                    if (!index!.has(key)) index!.set(key, record)
                })
                recordsBySnapshot.set(records, index)
            }
            return index.get(JSON.stringify([namespace(pod), String(pod.data?.Name || pod.data?.K8s?.Name || '')]))
        }
    }
}
export type TopologyResourceMetricsIndex = ReturnType<typeof createTopologyResourceMetricsIndex>

export const topologyResourceMetrics = (node: Node, snapshot: TopologyResourceSnapshot = {}, allNodes: Node[] = [], index?: TopologyResourceMetricsIndex): TopologyMetric[] => {
    const data = topologyInfrastructureData(node, snapshot), type = String(data.Type || '').toLowerCase()
    if (type === 'cluster') {
        const resources = snapshot.summary?.resources || {}
        if (String(data.Manager).toLowerCase() !== 'k8s') return [
            metric('cpu', resources.metricsAvailable === true ? numeric(resources.usageCpuCores) : undefined, numeric(resources.allocatableCpuCores)),
            metric('memory', resources.metricsAvailable === true ? numeric(resources.usageMemoryBytes) : undefined, numeric(resources.allocatableMemoryBytes))]
        return [kubernetesResourceMetric('cpu', resources.metricsAvailable === true ? numeric(resources.usageCpuCores) : undefined, numeric(resources.allocatableCpuCores), numeric(resources.capacityCpuCores)),
            kubernetesResourceMetric('memory', resources.metricsAvailable === true ? numeric(resources.usageMemoryBytes) : undefined, numeric(resources.allocatableMemoryBytes), numeric(resources.capacityMemoryBytes))]
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
            if (type === 'node' && String(data.Manager).toLowerCase() === 'k8s') {
                const parse = key === 'cpu' ? kubernetesCpuCores : kubernetesMemoryBytes
                const quantity = (values: any[]) => values.map(parse).find(value => value !== undefined)
                // A partial detail response must not hide a collected native
                // measurement or API capacity for the other resource.
                const amount = quantity([detail.usage?.[key], detail.currentUsage?.[key], detail.metrics?.usage?.[key],
                    raw(data, [`K8s.Metrics.Usage.${key}`, `K8s.Extra.Usage.${key}`, `Metrics.Usage.${key}`])])
                const nativeRate = numeric(raw(data, paths))
                const nativePercent = nativeRate !== undefined && nativeRate <= 100 ? nativeRate : undefined
                const result = kubernetesResourceMetric(key, amount,
                    quantity([detail.allocatable?.[key], raw(data, [`K8s.Extra.Status.Allocatable.${key}`, `K8s.Extra.status.allocatable.${key}`, `K8s.Status.Allocatable.${key}`])]),
                    quantity([detail.capacity?.[key], raw(data, [`K8s.Extra.Status.Capacity.${key}`, `K8s.Extra.status.capacity.${key}`, `K8s.Status.Capacity.${key}`])]), nativePercent)
                if (amount !== undefined || nativePercent !== undefined) return { ...result,
                    label: `${key === 'cpu' ? 'CPU' : '메모리'} ${result.percent !== undefined ? '사용률' : '사용량'}`,
                    sourceLabel: 'Kubernetes', description: `Kubernetes 노드 메트릭 · ${result.description}` }
                const vmRate = numeric(series?.lastValue)
                // Historical trend data must not masquerade as a current value.
                const fresh = typeof series?.timestamp === 'number' && Math.abs(Date.now() / 1000 - series.timestamp) <= 300
                if (snapshot.nodeVM && fresh && vmRate !== undefined && vmRate <= 100) {
                    const vmMetric = metric(key, undefined, undefined, vmRate)
                    const exporter = snapshot.wall?.source === 'node_exporter'
                    return { ...vmMetric, label: `${key === 'cpu' ? 'CPU' : '메모리'} 사용률`, source: 'vm-usage' as const,
                        sourceLabel: 'Wall · VM', description: [`Mold VM · Wall / ${exporter ? 'node_exporter' : 'libvirt'}`,
                            exporter ? '게스트 OS 사용률' : key === 'cpu' ? '하이퍼바이저 CPU 시간 / VM vCPU 수 · 최근 1분' : 'VM 메모리 통계 사용률',
                            'Kubernetes 할당 가능 자원 기준 사용률과 다를 수 있습니다.',
                            `${snapshot.nodeVM.matchedBy} UUID 일치 · ${snapshot.nodeVM.uuid} · ${snapshot.nodeVM.domain}`,
                            `최근 표본 ${new Date(series.timestamp * 1000).toLocaleString()}`].join(' · ') }
                }
                return result
            }
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
    // Missing measurements cannot produce a workload/namespace total. Avoid
    // resolving every Pod's ownership for every card when metrics are absent.
    if (!records.length) return type === 'pod' ? [metric('cpu'), metric('memory')] : []
    // A Pod needs only its own record, never a scan of the complete graph.
    const scoped = type === 'pod' ? [] : index ? index.scopedPods(node) : allNodes.filter(pod => String(pod.data?.Type).toLowerCase() === 'pod'
        && String(pod.data?.Manager).toLowerCase() === 'k8s' && isCurrentKubernetesPod(pod)
        && (!clusterName(node) || clusterName(node) === clusterName(pod)))
    const pods = type === 'pod' ? (isCurrentKubernetesPod(node) ? [node] : []) : type === 'namespace'
        ? scoped.filter(pod => namespace(pod) === String(data.Name || ''))
        : scoped.filter(pod => (index ? index.controller(pod) : resolveKubernetesPodTopController(pod, allNodes))?.id === node.id)
    const matched = pods.map(pod => index ? index.record(records, pod) : records.find(record => record.namespace === namespace(pod) && record.name === String(pod.data?.Name || pod.data?.K8s?.Name || '')))
    // A missing Pod measurement is not a zero, nor a complete workload total.
    if (!pods.length || matched.some(record => !record)) return type === 'pod' ? [metric('cpu'), metric('memory')] : []
    const total = (key: string) => matched.every(record => numeric(record[key]) !== undefined)
        ? matched.reduce((sum, record) => sum + numeric(record[key])!, 0) : undefined
    return [metric('cpu', total('usageCpuCores')), metric('memory', total('usageMemoryBytes'))]
}

/** Node-only measurement, shared by SVG sizing and the card renderer. */
export const kubernetesNodeResourceRowHeight = (node: Node, snapshot: TopologyResourceSnapshot = {}): number => {
    const resources = topologyResourceMetrics(node, snapshot).filter(item => ['cpu', 'memory'].includes(item.key) && item.value !== '미수집')
    return resources.some(item => item.sourceLabel) ? 136 : resources.length ? 112 : 0
}
