import type { Node } from './Topology'
import { aggregatePods } from './KubernetesPodLifecycle'
import type { KubernetesPodAggregate, KubernetesPodAggregateScope } from './KubernetesPodLifecycle'
import { resolveKubernetesPodTopController } from './KubernetesWorkloadOwnership'

const valueByPath = (data: any, path: string): any =>
    path.split('.').reduce((value, key) => value === undefined || value === null ? undefined : value[key], data)

const firstValue = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const value = valueByPath(data, path)
        if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return undefined
}

export const kubernetesResourceUID = (node: Node): string => String(firstValue(node.data || {}, [
    'K8s.Extra.ObjectMeta.UID',
    'K8s.UID',
    'UID'
]) || node.id)

export interface KubernetesDetailAggregate {
    pods: KubernetesPodAggregate
    activePodNodes: Node[]
    problemPodNodes: Node[]
    terminatedPodNodes: Node[]
    workloadControllers: Node[]
    workloadPodCounts: Map<string, number>
}

/**
 * Screen-independent aggregate used by cluster/node now and by
 * Namespace/Workload later. Pod state never gets re-evaluated here: it consumes
 * the canonical lifecycle aggregate and only resolves owner relationships.
 */
export const aggregateKubernetesDetail = (
    nodes: Node[],
    scope: KubernetesPodAggregateScope = {}
): KubernetesDetailAggregate => {
    const pods = aggregatePods(nodes, scope)
    const workloadByUID = new Map<string, Node>()
    const workloadPodCounts = new Map<string, number>()
    pods.activeEntries.forEach(entry => {
        const controller = resolveKubernetesPodTopController(entry.node, nodes)
        if (!controller) return
        const uid = kubernetesResourceUID(controller)
        workloadByUID.set(uid, controller)
        workloadPodCounts.set(uid, (workloadPodCounts.get(uid) || 0) + 1)
    })
    return {
        pods,
        activePodNodes: pods.activeEntries.map(entry => entry.node),
        problemPodNodes: pods.problemEntries.map(entry => entry.node),
        terminatedPodNodes: pods.terminatedEntries.map(entry => entry.node),
        workloadControllers: Array.from(workloadByUID.values()),
        workloadPodCounts
    }
}
