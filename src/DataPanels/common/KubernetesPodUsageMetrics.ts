import { kubernetesCpuCores, kubernetesMemoryBytes } from './kubernetesQuantity'

export interface KubernetesCpuBasisRatios {
    requestPercent?: number
    limitPercent?: number
}

export interface KubernetesMemoryBasisRatios {
    requestPercent?: number
    limitPercent?: number
}

export const formatPodCpuUsage = (cores: number): string => {
    const normalized = Number.isFinite(cores) && cores > 0 ? cores : 0
    if (normalized < 1) return `${Math.round(normalized * 1000)} mCore`
    return `${normalized.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0$/, '$1')} Core`
}

export const safeUsagePercent = (usage: number, basis?: number): number | undefined => {
    if (!Number.isFinite(usage) || !Number.isFinite(basis) || Number(basis) <= 0) return undefined
    return Math.max(0, usage / Number(basis) * 100)
}

export const relativePodUsagePercent = (usage: number, maximumUsage: number): number => {
    if (!Number.isFinite(usage) || usage <= 0 || !Number.isFinite(maximumUsage) || maximumUsage <= 0) return 0
    return Math.max(0, usage / maximumUsage * 100)
}

export const progressPercent = (percent?: number): number =>
    percent === undefined || !Number.isFinite(percent)
        ? 0
        : Math.max(0, Math.min(100, percent))

export const cpuBasisRatios = (
    usageCpuCores: number,
    requestCpuCores?: number,
    limitCpuCores?: number
): KubernetesCpuBasisRatios => ({
    requestPercent: safeUsagePercent(usageCpuCores, requestCpuCores),
    limitPercent: safeUsagePercent(usageCpuCores, limitCpuCores)
})

export const formatPodMemoryUsage = (bytes: number): string => {
    const normalized = Number.isFinite(bytes) && bytes > 0 ? bytes : 0
    if (normalized < Math.pow(1024, 3)) return `${Math.round(normalized / Math.pow(1024, 2))} MiB`
    const gibibytes = normalized / Math.pow(1024, 3)
    return `${gibibytes.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0$/, '$1')} GiB`
}

export const memoryBasisRatios = (
    usageMemoryBytes: number,
    requestMemoryBytes?: number,
    limitMemoryBytes?: number
): KubernetesMemoryBasisRatios => ({
    requestPercent: safeUsagePercent(usageMemoryBytes, requestMemoryBytes),
    limitPercent: safeUsagePercent(usageMemoryBytes, limitMemoryBytes)
})

const resourceCpu = (container: any, resource: 'Requests' | 'Limits'): number | undefined => {
    const resources = container?.Resources || container?.resources || {}
    const values = resources[resource] || resources[resource.toLowerCase()] || {}
    return kubernetesCpuCores(values.cpu ?? values.Cpu ?? values.CPU)
}

const totalContainerCpu = (containers: any[], resource: 'Requests' | 'Limits'): number | undefined => {
    const values = containers
        .map(container => resourceCpu(container, resource))
        .filter((value): value is number => value !== undefined)
    return values.length ? values.reduce((total, value) => total + value, 0) : undefined
}

// Kubernetes Pod resource 기준: 일반 컨테이너 합계와 init 컨테이너의
// 최대값 중 큰 값을 사용합니다. 어떤 컨테이너에도 값이 없으면 0이
// 아니라 undefined를 반환해 "미설정" 상태를 보존합니다.
export const podCpuResourceCores = (
    spec: any,
    resource: 'Requests' | 'Limits'
): number | undefined => {
    const podResources = spec?.Resources || spec?.resources || {}
    const podResourceValues = podResources[resource] || podResources[resource.toLowerCase()] || {}
    const podLevelValue = kubernetesCpuCores(
        podResourceValues.cpu ?? podResourceValues.Cpu ?? podResourceValues.CPU
    )
    if (podLevelValue !== undefined) return podLevelValue

    const containers = spec?.Containers || spec?.containers || []
    const initContainers = spec?.InitContainers || spec?.initContainers || []
    const applicationTotal = totalContainerCpu(Array.isArray(containers) ? containers : [], resource)
    const initValues = (Array.isArray(initContainers) ? initContainers : [])
        .map((container: any) => resourceCpu(container, resource))
        .filter((value: number | undefined): value is number => value !== undefined)
    const initMaximum = initValues.length ? Math.max(...initValues) : undefined

    if (applicationTotal === undefined) return initMaximum
    if (initMaximum === undefined) return applicationTotal
    return Math.max(applicationTotal, initMaximum)
}

const resourceMemory = (container: any, resource: 'Requests' | 'Limits'): number | undefined => {
    const resources = container?.Resources || container?.resources || {}
    const values = resources[resource] || resources[resource.toLowerCase()] || {}
    return kubernetesMemoryBytes(values.memory ?? values.Memory ?? values.MEMORY)
}

const totalContainerMemory = (containers: any[], resource: 'Requests' | 'Limits'): number | undefined => {
    const values = containers
        .map(container => resourceMemory(container, resource))
        .filter((value): value is number => value !== undefined)
    return values.length ? values.reduce((total, value) => total + value, 0) : undefined
}

export const podMemoryResourceBytes = (
    spec: any,
    resource: 'Requests' | 'Limits'
): number | undefined => {
    const podResources = spec?.Resources || spec?.resources || {}
    const podResourceValues = podResources[resource] || podResources[resource.toLowerCase()] || {}
    const podLevelValue = kubernetesMemoryBytes(
        podResourceValues.memory ?? podResourceValues.Memory ?? podResourceValues.MEMORY
    )
    if (podLevelValue !== undefined) return podLevelValue

    const containers = spec?.Containers || spec?.containers || []
    const initContainers = spec?.InitContainers || spec?.initContainers || []
    const applicationTotal = totalContainerMemory(Array.isArray(containers) ? containers : [], resource)
    const initValues = (Array.isArray(initContainers) ? initContainers : [])
        .map((container: any) => resourceMemory(container, resource))
        .filter((value: number | undefined): value is number => value !== undefined)
    const initMaximum = initValues.length ? Math.max(...initValues) : undefined

    if (applicationTotal === undefined) return initMaximum
    if (initMaximum === undefined) return applicationTotal
    return Math.max(applicationTotal, initMaximum)
}
