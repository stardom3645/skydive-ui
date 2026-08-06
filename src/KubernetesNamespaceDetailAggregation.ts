import type { Node } from './Topology'
import { resolveKubernetesPodTopController } from './KubernetesWorkloadOwnership'
import { podCpuResourceCores, podMemoryResourceBytes } from './DataPanels/common/KubernetesPodUsageMetrics'
import { kubernetesCpuCores, kubernetesMemoryBytes } from './DataPanels/common/kubernetesQuantity'

const valueAtPath = (source: any, path: string): any =>
    path.split('.').reduce((value, key) => value === undefined || value === null ? undefined : value[key], source)

const firstRaw = (source: any, paths: string[]): any => {
    for (const path of paths) {
        const value = valueAtPath(source, path)
        if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return undefined
}

const values = (source: any, paths: string[]): any[] => {
    const value = firstRaw(source, paths)
    return Array.isArray(value) ? value : []
}

const normalized = (value: any): string => String(value || '').trim().toLowerCase()
const resourceType = (node: Node): string => normalized(node.data?.Type)
const resourceName = (node: Node): string => String(firstRaw(node.data || {}, ['Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name']) || node.id)
const resourceNamespace = (node: Node): string => String(firstRaw(node.data || {}, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace']) || '')
const resourceCluster = (node: Node): string => String(firstRaw(node.data || {}, ['ClusterName', 'clusterName', 'K8s.ClusterName', 'Cluster']) || '')
const resourceUID = (node: Node): string => String(firstRaw(node.data || {}, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) || node.id)
const numberAt = (source: any, paths: string[], fallback = 0): number => {
    const value = firstRaw(source, paths)
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
}
const conditions = (node: Node): any[] => values(node.data || {}, ['K8s.Extra.Status.Conditions', 'K8s.Status.Conditions', 'Status.Conditions'])
const conditionTrue = (node: Node, type: string): boolean => conditions(node).some(condition =>
    normalized(condition?.Type || condition?.type) === normalized(type)
    && normalized(condition?.Status ?? condition?.status) === 'true')
const ownerReferences = (node: Node): any[] => values(node.data || {}, [
    'K8s.Extra.ObjectMeta.OwnerReferences', 'K8s.Extra.Metadata.OwnerReferences', 'K8s.OwnerReferences', 'OwnerReferences'
])
const ownedBy = (node: Node, owner: Node): boolean => ownerReferences(node).some(reference => {
    const kind = normalized(reference?.Kind || reference?.kind)
    const uid = String(reference?.UID || reference?.uid || '')
    const name = String(reference?.Name || reference?.name || '')
    return kind === resourceType(owner) && ((uid && uid === resourceUID(owner)) || (!uid && name === resourceName(owner)))
})
const timestamp = (value: any): number => {
    const source = typeof value === 'object' && value?.Time !== undefined ? value.Time : value
    const parsed = new Date(source || 0).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
}
const workloadTime = (node: Node): number => timestamp(firstRaw(node.data || {}, [
    'K8s.Extra.Status.CompletionTime', 'K8s.Extra.Status.StartTime',
    'K8s.Extra.ObjectMeta.CreationTimestamp.Time', 'K8s.Extra.ObjectMeta.CreationTimestamp'
]))

export const kubernetesNamespaceResourceKey = (node: Node): string => [
    resourceCluster(node), resourceNamespace(node), resourceType(node), resourceName(node)
].join('\u0000').toLowerCase()

export const uniqueKubernetesNamespaceResources = (nodes: Node[]): Node[] =>
    Array.from(nodes.reduce((result, node) => {
        result.set(kubernetesNamespaceResourceKey(node), node)
        return result
    }, new Map<string, Node>()).values())

export interface KubernetesNamespaceWorkloadHealth {
    workloads: Node[]
    unavailableWorkloads: Node[]
    evaluatedWorkloads: Node[]
}

export const kubernetesNamespaceWorkloadHealth = (nodes: Node[]): KubernetesNamespaceWorkloadHealth => {
    const workloads = uniqueKubernetesNamespaceResources(nodes).filter(node =>
        ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(resourceType(node)) >= 0)
    const unavailableWorkloads: Node[] = []
    const evaluatedWorkloads: Node[] = []

    workloads.forEach(workload => {
        const data = workload.data || {}
        const type = resourceType(workload)
        const rawStatus = firstRaw(data, ['K8s.Extra.Status', 'K8s.Status', 'Status'])
        const status = rawStatus || {}
        const spec = firstRaw(data, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec']) || {}
        let unavailable = false
        let evaluated = rawStatus !== undefined || type === 'cronjob'
        if (!evaluated) return
        if (type === 'deployment') {
            const desired = numberAt(spec, ['Replicas', 'replicas'], numberAt(status, ['Replicas', 'replicas']))
            const available = numberAt(status, ['AvailableReplicas', 'availableReplicas'])
            const updated = numberAt(status, ['UpdatedReplicas', 'updatedReplicas'])
            const explicitlyUnavailable = numberAt(status, ['UnavailableReplicas', 'unavailableReplicas'])
            unavailable = available < desired || updated < desired || explicitlyUnavailable > 0
        } else if (type === 'statefulset') {
            const desired = numberAt(spec, ['Replicas', 'replicas'], numberAt(status, ['Replicas', 'replicas']))
            const ready = numberAt(status, ['ReadyReplicas', 'readyReplicas'])
            const updated = numberAt(status, ['UpdatedReplicas', 'updatedReplicas'])
            const currentRevision = String(firstRaw(status, ['CurrentRevision', 'currentRevision']) || '')
            const updateRevision = String(firstRaw(status, ['UpdateRevision', 'updateRevision']) || '')
            unavailable = ready < desired || updated < desired || (!!currentRevision && !!updateRevision && currentRevision !== updateRevision)
        } else if (type === 'daemonset') {
            const desired = numberAt(status, ['DesiredNumberScheduled', 'desiredNumberScheduled'])
            const ready = numberAt(status, ['NumberReady', 'numberReady'])
            const unavailableCount = numberAt(status, ['NumberUnavailable', 'numberUnavailable'])
            const misscheduled = numberAt(status, ['NumberMisscheduled', 'numberMisscheduled'])
            unavailable = ready < desired || unavailableCount > 0 || misscheduled > 0
        } else if (type === 'job') {
            const complete = conditionTrue(workload, 'Complete') || numberAt(status, ['Succeeded', 'succeeded']) > 0
            const failed = conditionTrue(workload, 'Failed') || numberAt(status, ['Failed', 'failed']) > 0
            unavailable = !complete && failed
        } else if (type === 'cronjob') {
            const suspended = !!(spec.Suspend ?? spec.suspend)
            const activeJobs = values(status, ['Active', 'active'])
            const childJobs = workloads.filter(candidate => resourceType(candidate) === 'job' && ownedBy(candidate, workload))
                .sort((left, right) => workloadTime(right) - workloadTime(left))
            const latestJob = childJobs[0]
            const latestFailed = !!latestJob && (conditionTrue(latestJob, 'Failed') || numberAt(latestJob.data || {}, [
                'K8s.Extra.Status.Failed', 'K8s.Status.Failed', 'Status.Failed'
            ]) > 0)
            const latestSucceeded = !!latestJob && (conditionTrue(latestJob, 'Complete') || numberAt(latestJob.data || {}, [
                'K8s.Extra.Status.Succeeded', 'K8s.Status.Succeeded', 'Status.Succeeded'
            ]) > 0)
            unavailable = !suspended && activeJobs.length === 0 && latestFailed && !latestSucceeded
        } else {
            evaluated = false
        }
        if (evaluated) evaluatedWorkloads.push(workload)
        if (unavailable) unavailableWorkloads.push(workload)
    })
    return { workloads, unavailableWorkloads, evaluatedWorkloads }
}

const podNodeName = (pod: Node): string => String(firstRaw(pod.data || {}, [
    'K8s.Extra.Spec.NodeName', 'K8s.Spec.NodeName', 'K8s.NodeName', 'K8s.Node', 'NodeName'
]) || '')

const hasPlacementPolicy = (workload: Node): boolean => {
    const data = workload.data || {}
    const spread = values(data, [
        'K8s.Extra.Spec.Template.Spec.TopologySpreadConstraints',
        'K8s.Spec.Template.Spec.TopologySpreadConstraints',
        'Spec.Template.Spec.TopologySpreadConstraints'
    ])
    const antiAffinity = firstRaw(data, [
        'K8s.Extra.Spec.Template.Spec.Affinity.PodAntiAffinity',
        'K8s.Spec.Template.Spec.Affinity.PodAntiAffinity',
        'Spec.Template.Spec.Affinity.PodAntiAffinity'
    ])
    return spread.length > 0 || !!antiAffinity
}

export interface KubernetesNamespaceDistribution {
    multiReplicaWorkloads: Node[]
    concentratedWorkloads: Node[]
    evaluated: boolean
}

export const kubernetesNamespaceDistribution = (
    workloads: Node[],
    activePods: Node[],
    allNodes: Node[],
    availableNodeCount: number
): KubernetesNamespaceDistribution => {
    const multiReplicaWorkloads = workloads.filter(workload => {
        const type = resourceType(workload)
        if (type !== 'deployment' && type !== 'statefulset') return false
        return numberAt(workload.data || {}, [
            'K8s.Extra.Spec.Replicas', 'K8s.Spec.Replicas', 'Spec.Replicas', 'DesiredReplicas', 'Replicas'
        ]) > 1
    })
    if (!multiReplicaWorkloads.length) return { multiReplicaWorkloads, concentratedWorkloads: [], evaluated: true }
    const concentratedWorkloads = multiReplicaWorkloads.filter(workload => {
        const pods = activePods.filter(pod => resolveKubernetesPodTopController(pod, allNodes)?.id === workload.id)
        const scheduledNodes = new Set(pods.map(podNodeName).filter(Boolean))
        if (pods.length < 2 || scheduledNodes.size !== 1 || availableNodeCount <= 1) return false
        return !hasPlacementPolicy(workload)
    })
    return { multiReplicaWorkloads, concentratedWorkloads, evaluated: true }
}

export interface KubernetesContainerResourceCoverage {
    collected: boolean
    total: number
    cpuRequests: number
    cpuLimits: number
    memoryRequests: number
    memoryLimits: number
    cpuRequestsCollected: boolean
    cpuLimitsCollected: boolean
    memoryRequestsCollected: boolean
    memoryLimitsCollected: boolean
    cpuRequestsCores?: number
    cpuLimitsCores?: number
    memoryRequestsBytes?: number
    memoryLimitsBytes?: number
}

export interface KubernetesNamespaceResourceConfigurationDetail {
    collected?: boolean
    totalContainers?: number
    cpuRequests?: { configuredContainers?: number, cores?: number }
    cpuLimits?: { configuredContainers?: number, cores?: number }
    memoryRequests?: { configuredContainers?: number, bytes?: number }
    memoryLimits?: { configuredContainers?: number, bytes?: number }
}

/** Converts the namespace API resource contract without inferring missing
 * counts from legacy aggregate strings. All four rows originate from the same
 * active-Pod container dataset. */
export const kubernetesNamespaceResourceCoverageFromDetail = (
    detail: KubernetesNamespaceResourceConfigurationDetail | undefined | null
): KubernetesContainerResourceCoverage | undefined => {
    if (!detail || detail.collected !== true) return undefined
    const total = Number(detail.totalContainers)
    const metrics = [detail.cpuRequests, detail.cpuLimits, detail.memoryRequests, detail.memoryLimits]
    const configured = metrics.map(metric => Number(metric?.configuredContainers))
    if (!Number.isFinite(total) || total < 0 || configured.some(value => !Number.isFinite(value) || value < 0)) return undefined
    return {
        collected: true,
        total,
        cpuRequests: configured[0],
        cpuLimits: configured[1],
        memoryRequests: configured[2],
        memoryLimits: configured[3],
        cpuRequestsCollected: true,
        cpuLimitsCollected: true,
        memoryRequestsCollected: true,
        memoryLimitsCollected: true,
        cpuRequestsCores: Number.isFinite(Number(detail.cpuRequests?.cores)) ? Number(detail.cpuRequests?.cores) : 0,
        cpuLimitsCores: Number.isFinite(Number(detail.cpuLimits?.cores)) ? Number(detail.cpuLimits?.cores) : 0,
        memoryRequestsBytes: Number.isFinite(Number(detail.memoryRequests?.bytes)) ? Number(detail.memoryRequests?.bytes) : 0,
        memoryLimitsBytes: Number.isFinite(Number(detail.memoryLimits?.bytes)) ? Number(detail.memoryLimits?.bytes) : 0
    }
}

export interface KubernetesNamespacePolicyCoverage {
    collected: boolean
    count: number
}

export const kubernetesNamespacePolicyCoverage = (
    topologyResources: Node[],
    detailCollected: any,
    detailResources: any,
    detailCount: any
): KubernetesNamespacePolicyCoverage => {
    const topologyCount = uniqueKubernetesNamespaceResources(topologyResources).length
    const detailListCollected = Array.isArray(detailResources)
    const collected = detailCollected === true || topologyCount > 0 || detailListCollected
    if (!collected) return { collected: false, count: 0 }
    const reportedCount = Number(detailCount)
    return {
        collected: true,
        count: Math.max(
            topologyCount,
            detailListCollected ? detailResources.length : 0,
            Number.isFinite(reportedCount) && reportedCount >= 0 ? reportedCount : 0
        )
    }
}

export const kubernetesNamespaceContainerResourceCoverage = (pods: Node[]): KubernetesContainerResourceCoverage => {
    const uniquePods = Array.from(pods.reduce((result, pod) => {
        result.set(resourceUID(pod), pod)
        return result
    }, new Map<string, Node>()).values())
    let collectedPodSpecs = 0
    let total = 0
    let cpuRequests = 0
    let cpuLimits = 0
    let memoryRequests = 0
    let memoryLimits = 0
    let cpuRequestsCores: number | undefined
    let cpuLimitsCores: number | undefined
    let memoryRequestsBytes: number | undefined
    let memoryLimitsBytes: number | undefined
    let resourceSpecsCollected = true
    let cpuRequestsValid = true
    let cpuLimitsValid = true
    let memoryRequestsValid = true
    let memoryLimitsValid = true
    const sum = (current: number | undefined, value: number | undefined): number | undefined =>
        value === undefined ? current : (current || 0) + value
    const configured = (resourceValues: any, key: 'cpu' | 'memory'): boolean => {
        if (!resourceValues || typeof resourceValues !== 'object') return false
        const value = resourceValues[key] ?? resourceValues[key[0].toUpperCase() + key.slice(1)] ?? resourceValues[key.toUpperCase()]
        return value !== undefined && value !== null && value !== ''
    }
    const resourceValue = (resourceValues: any, key: 'cpu' | 'memory'): any =>
        resourceValues?.[key] ?? resourceValues?.[key[0].toUpperCase() + key.slice(1)] ?? resourceValues?.[key.toUpperCase()]
    uniquePods.forEach(pod => {
        const spec = firstRaw(pod.data || {}, ['K8s.Extra.Spec', 'K8s.Spec', 'Spec'])
        const containers = spec?.Containers || spec?.containers
        // A valid active Kubernetes Pod always has at least one regular
        // container. An empty array therefore means the container Spec was not
        // collected, not that the Namespace genuinely has a 0 / 0 baseline.
        if (!spec || !Array.isArray(containers) || containers.length === 0) return
        collectedPodSpecs += 1
        const initContainers = spec.InitContainers || spec.initContainers || []
        const uniqueContainers = (items: any[], prefix: string): any[] => Array.from(items.reduce((result, container, index) => {
            const name = container?.Name || container?.name
            const key = `${prefix}:${name || index}`
            if (!result.has(key)) result.set(key, container)
            return result
        }, new Map<string, any>()).values())
        const regularContainers = uniqueContainers(containers, 'container')
        const policyInitContainers = uniqueContainers(Array.isArray(initContainers) ? initContainers : [], 'initContainer')
        const countedContainers = regularContainers.concat(policyInitContainers)
        const effectiveContainerSpec = {
            Containers: regularContainers,
            InitContainers: policyInitContainers
        }
        countedContainers.forEach((container: any) => {
            total += 1
            if (!Object.prototype.hasOwnProperty.call(container || {}, 'Resources')
                && !Object.prototype.hasOwnProperty.call(container || {}, 'resources')) resourceSpecsCollected = false
            const resources = container?.Resources || container?.resources || {}
            const requests = resources.Requests || resources.requests || {}
            const limits = resources.Limits || resources.limits || {}
            if (configured(requests, 'cpu')) {
                cpuRequests += 1
                if (kubernetesCpuCores(resourceValue(requests, 'cpu')) === undefined) cpuRequestsValid = false
            }
            if (configured(limits, 'cpu')) {
                cpuLimits += 1
                if (kubernetesCpuCores(resourceValue(limits, 'cpu')) === undefined) cpuLimitsValid = false
            }
            if (configured(requests, 'memory')) {
                memoryRequests += 1
                if (kubernetesMemoryBytes(resourceValue(requests, 'memory')) === undefined) memoryRequestsValid = false
            }
            if (configured(limits, 'memory')) {
                memoryLimits += 1
                if (kubernetesMemoryBytes(resourceValue(limits, 'memory')) === undefined) memoryLimitsValid = false
            }
        })
        cpuRequestsCores = sum(cpuRequestsCores, podCpuResourceCores(effectiveContainerSpec, 'Requests'))
        cpuLimitsCores = sum(cpuLimitsCores, podCpuResourceCores(effectiveContainerSpec, 'Limits'))
        memoryRequestsBytes = sum(memoryRequestsBytes, podMemoryResourceBytes(effectiveContainerSpec, 'Requests'))
        memoryLimitsBytes = sum(memoryLimitsBytes, podMemoryResourceBytes(effectiveContainerSpec, 'Limits'))
    })
    const baseCollected = (uniquePods.length === 0 || collectedPodSpecs === uniquePods.length) && resourceSpecsCollected
    const cpuRequestsCollected = baseCollected && cpuRequestsValid
    const cpuLimitsCollected = baseCollected && cpuLimitsValid
    const memoryRequestsCollected = baseCollected && memoryRequestsValid
    const memoryLimitsCollected = baseCollected && memoryLimitsValid
    const collected = cpuRequestsCollected && cpuLimitsCollected && memoryRequestsCollected && memoryLimitsCollected
    return {
        collected,
        total,
        cpuRequests,
        cpuLimits,
        memoryRequests,
        memoryLimits,
        cpuRequestsCollected,
        cpuLimitsCollected,
        memoryRequestsCollected,
        memoryLimitsCollected,
        cpuRequestsCores: cpuRequestsCollected ? cpuRequestsCores : undefined,
        cpuLimitsCores: cpuLimitsCollected ? cpuLimitsCores : undefined,
        memoryRequestsBytes: memoryRequestsCollected ? memoryRequestsBytes : undefined,
        memoryLimitsBytes: memoryLimitsCollected ? memoryLimitsBytes : undefined
    }
}

export const kubernetesResourceUID = resourceUID
export const kubernetesResourceName = resourceName
