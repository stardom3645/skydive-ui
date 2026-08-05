import type { Node } from './Topology'
import { resolveKubernetesPodTopController } from './KubernetesWorkloadOwnership'

export const KUBERNETES_NODE_SIGNAL_WINDOW_MS = 60 * 60 * 1000
export const KUBERNETES_LONG_TERMINATING_MS = 5 * 60 * 1000

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

const dateValue = (value: any): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined
    const source = typeof value === 'object' && value.Time !== undefined ? value.Time : value
    const timestamp = typeof source === 'number' ? source : Date.parse(String(source))
    if (!Number.isFinite(timestamp)) return undefined
    return timestamp < 100000000000 ? timestamp * 1000 : timestamp
}

const podStatuses = (node: Node): any[] => ([] as any[]).concat(
    values(node.data || {}, ['K8s.Extra.Status.InitContainerStatuses']),
    values(node.data || {}, ['K8s.Extra.Status.ContainerStatuses']),
    values(node.data || {}, ['K8s.Extra.Status.EphemeralContainerStatuses'])
)

const podConditions = (node: Node): any[] => values(node.data || {}, [
    'K8s.Extra.Status.Conditions', 'K8s.Conditions', 'Conditions'
])

const podUID = (node: Node): string => String(firstRaw(node.data || {}, [
    'K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID'
]) || node.id)

const podPhase = (node: Node): string => normalized(firstRaw(node.data || {}, [
    'K8s.Extra.Status.Phase', 'K8s.Phase', 'Phase', 'K8s.Status', 'Status'
]))

const podReason = (node: Node): string => normalized(firstRaw(node.data || {}, [
    'K8s.Extra.Status.Reason', 'K8s.Reason', 'Reason'
]))

const podNodeName = (node: Node): string => String(firstRaw(node.data || {}, [
    'K8s.Extra.Spec.NodeName', 'K8s.Spec.NodeName', 'K8s.NodeName', 'K8s.Node', 'NodeName'
]) || '')

const podCluster = (node: Node): string => String(firstRaw(node.data || {}, [
    'ClusterName', 'clusterName', 'K8s.ClusterName', 'Cluster'
]) || '')

const resourceName = (node: Node): string => String(firstRaw(node.data || {}, [
    'Name', 'K8s.Name', 'K8s.Extra.ObjectMeta.Name'
]) || node.id)

const resourceNamespace = (node: Node): string => String(firstRaw(node.data || {}, [
    'K8s.Extra.ObjectMeta.Namespace', 'K8s.Namespace', 'Namespace'
]) || '')

const resourceCluster = (node: Node): string => String(firstRaw(node.data || {}, [
    'ClusterName', 'clusterName', 'K8s.ClusterName', 'Cluster'
]) || '')

const resourceType = (node: Node): string => normalized(node.data?.Type)

const deletionTimestamp = (node: Node): number | undefined => dateValue(firstRaw(node.data || {}, [
    'K8s.Extra.Metadata.DeletionTimestamp',
    'K8s.Extra.ObjectMeta.DeletionTimestamp.Time',
    'K8s.Extra.ObjectMeta.DeletionTimestamp',
    'K8s.Metadata.DeletionTimestamp',
    'K8s.DeletionTimestamp',
    'DeletionTimestamp'
]))

const readyState = (node: Node): boolean | undefined => {
    const condition = podConditions(node).find(item => normalized(item?.Type || item?.type) === 'ready')
    if (!condition) return undefined
    return normalized(condition?.Status ?? condition?.status) === 'true'
}

const waitingReasons = (node: Node): string[] => podStatuses(node)
    .map(status => normalized(status?.State?.Waiting?.Reason || status?.state?.waiting?.reason))
    .filter(Boolean)

const restartCount = (node: Node): number => podStatuses(node)
    .reduce((total, status) => total + Number(status?.RestartCount ?? status?.restartCount ?? 0), 0)

const terminationRecords = (node: Node): Array<{ current: boolean, reason: string, finishedAt?: number }> => {
    const records: Array<{ current: boolean, reason: string, finishedAt?: number }> = []
    podStatuses(node).forEach(status => {
        const current = status?.State?.Terminated || status?.state?.terminated
        const previous = status?.LastTerminationState?.Terminated || status?.lastState?.terminated
        if (current) records.push({ current: true, reason: normalized(current.Reason || current.reason), finishedAt: dateValue(current.FinishedAt || current.finishedAt) })
        if (previous) records.push({ current: false, reason: normalized(previous.Reason || previous.reason), finishedAt: dateValue(previous.FinishedAt || previous.finishedAt) })
    })
    return records
}

const explicitRestartTimes = (node: Node): number[] => [
    firstRaw(node.data || {}, ['K8s.LastRestartTime', 'LastRestartTime', 'K8s.Extra.Status.LastRestartTime']),
    ...terminationRecords(node).map(record => record.finishedAt)
].map(dateValue).filter((value): value is number => value !== undefined)

const withinWindow = (timestamp: number | undefined, now: number): boolean =>
    timestamp !== undefined && timestamp <= now && timestamp >= now - KUBERNETES_NODE_SIGNAL_WINDOW_MS

const isKubernetesPod = (node: Node): boolean =>
    normalized(node.data?.Manager) === 'k8s' && resourceType(node) === 'pod'

export interface KubernetesNodePodDataset {
    assignedPods: Node[]
    activePods: Node[]
    runningPods: Node[]
    pendingPods: Node[]
    failedPods: Node[]
    succeededPods: Node[]
    unknownPods: Node[]
    readyPods: Node[]
    notReadyPods: Node[]
    crashLoopPods: Node[]
    evictedPods: Node[]
    problemPods: Node[]
    restartHistoryPods: Node[]
    recentRestartPods: Node[]
    oomKilledHistoryPods: Node[]
    currentOOMKilledPods: Node[]
    longTerminatingPods: Node[]
}

export type KubernetesOperationalPodDataset = Omit<KubernetesNodePodDataset, 'assignedPods'>

/** Shared current/recent/history Pod classification for an already scoped Pod list. */
export const kubernetesOperationalPodDataset = (
    pods: Node[],
    now = Date.now()
): KubernetesOperationalPodDataset => {
    const scopedPods = Array.from(pods.reduce((result, pod) => {
        if (!isKubernetesPod(pod)) return result
        result.set(podUID(pod), pod)
        return result
    }, new Map<string, Node>()).values())
    const activePods: Node[] = []
    const runningPods: Node[] = []
    const pendingPods: Node[] = []
    const failedPods: Node[] = []
    const succeededPods: Node[] = []
    const unknownPods: Node[] = []
    const readyPods: Node[] = []
    const notReadyPods: Node[] = []
    const crashLoopPods: Node[] = []
    const evictedPods: Node[] = []
    const problemPods: Node[] = []
    const restartHistoryPods: Node[] = []
    const recentRestartPods: Node[] = []
    const oomKilledHistoryPods: Node[] = []
    const currentOOMKilledPods: Node[] = []
    const longTerminatingPods: Node[] = []
    const actionableWaitingReasons = new Set([
        'crashloopbackoff', 'imagepullbackoff', 'errimagepull',
        'createcontainerconfigerror', 'createcontainererror', 'runcontainererror',
        'containerstatusunknown'
    ])

    scopedPods.forEach(pod => {
        const phase = podPhase(pod)
        const reason = podReason(pod)
        const deletingAt = deletionTimestamp(pod)
        const terminatingTooLong = deletingAt !== undefined && now - deletingAt >= KUBERNETES_LONG_TERMINATING_MS
        const terminal = phase === 'succeeded' || phase === 'failed' || reason === 'evicted' || reason === 'completed'
        const active = deletingAt === undefined && !terminal
        const ready = readyState(pod)
        const podWaitingReasons = waitingReasons(pod)
        const records = terminationRecords(pod)
        const hasOOMHistory = records.some(record => record.reason === 'oomkilled')
        const currentOrRecentOOM = records.some(record => record.reason === 'oomkilled'
            && (record.current || withinWindow(record.finishedAt, now)))
        const hasRestartHistory = active && restartCount(pod) > 0
        const recentRestart = hasRestartHistory && explicitRestartTimes(pod).some(timestamp => withinWindow(timestamp, now))
        const waitingProblem = podWaitingReasons.some(waiting => actionableWaitingReasons.has(waiting))
        const problem = phase === 'pending'
            || phase === 'failed'
            || phase === 'unknown'
            || reason === 'evicted'
            || (phase === 'running' && ready === false)
            || waitingProblem
            || terminatingTooLong
            || currentOrRecentOOM

        if (active) activePods.push(pod)
        if (active && phase === 'running') runningPods.push(pod)
        if (active && phase === 'pending') pendingPods.push(pod)
        if (phase === 'failed') failedPods.push(pod)
        if (phase === 'succeeded') succeededPods.push(pod)
        if (phase === 'unknown') unknownPods.push(pod)
        if (active && ready === true) readyPods.push(pod)
        if (active && phase === 'running' && ready === false) notReadyPods.push(pod)
        if (active && podWaitingReasons.indexOf('crashloopbackoff') >= 0) crashLoopPods.push(pod)
        if (reason === 'evicted') evictedPods.push(pod)
        if (problem) problemPods.push(pod)
        if (hasRestartHistory) restartHistoryPods.push(pod)
        if (recentRestart) recentRestartPods.push(pod)
        if (hasOOMHistory) oomKilledHistoryPods.push(pod)
        if (currentOrRecentOOM) currentOOMKilledPods.push(pod)
        if (terminatingTooLong) longTerminatingPods.push(pod)
    })

    return {
        activePods,
        runningPods,
        pendingPods,
        failedPods,
        succeededPods,
        unknownPods,
        readyPods,
        notReadyPods,
        crashLoopPods,
        evictedPods,
        problemPods,
        restartHistoryPods,
        recentRestartPods,
        oomKilledHistoryPods,
        currentOOMKilledPods,
        longTerminatingPods
    }
}

export const kubernetesNodePodDataset = (
    nodes: Node[],
    nodeName: string,
    clusterName = '',
    now = Date.now()
): KubernetesNodePodDataset => {
    const assignedPods = Array.from(nodes.reduce((result, node) => {
        if (!isKubernetesPod(node) || podNodeName(node) !== nodeName) return result
        if (clusterName && podCluster(node) && podCluster(node) !== clusterName) return result
        result.set(podUID(node), node)
        return result
    }, new Map<string, Node>()).values())

    return { assignedPods, ...kubernetesOperationalPodDataset(assignedPods, now) }
}

export const kubernetesNodeConditionIsHealthy = (condition: any): boolean | undefined => {
    const type = normalized(condition?.type || condition?.Type)
    const status = normalized(condition?.status ?? condition?.Status)
    if (status !== 'true' && status !== 'false') return undefined
    if (type === 'ready') return status === 'true'
    if (['memorypressure', 'diskpressure', 'pidpressure', 'networkunavailable'].indexOf(type) >= 0) return status === 'false'
    return undefined
}

const topControllerKey = (controller: Node): string => [
    resourceCluster(controller),
    resourceNamespace(controller),
    resourceType(controller),
    resourceName(controller)
].join('\u0000').toLowerCase()

const uniqueTopControllers = (pods: Node[], nodes: Node[], allowedTypes?: Set<string>): Node[] => {
    const controllers = new Map<string, Node>()
    pods.forEach(pod => {
        const controller = resolveKubernetesPodTopController(pod, nodes)
        if (!controller || (allowedTypes && !allowedTypes.has(resourceType(controller)))) return
        controllers.set(topControllerKey(controller), controller)
    })
    return Array.from(controllers.values())
}

export const kubernetesNodeTopWorkloads = (activePods: Node[], nodes: Node[]): Node[] =>
    uniqueTopControllers(activePods, nodes, new Set(['deployment', 'statefulset', 'daemonset', 'job', 'cronjob']))

export const kubernetesNodeSingleReplicaWorkloads = (activePods: Node[], nodes: Node[]): Node[] =>
    uniqueTopControllers(activePods, nodes, new Set(['deployment', 'statefulset']))
        .filter(controller => Number(firstRaw(controller.data || {}, [
            'K8s.Extra.Spec.Replicas', 'K8s.Spec.Replicas', 'Spec.Replicas', 'DesiredReplicas', 'Replicas'
        ])) === 1)

export const isNodeLocalStorageProvisioner = (provisioner: string, storageClassName = ''): boolean => {
    const candidates = `${provisioner} ${storageClassName}`.toLowerCase()
    return /(^|[./\s-])local-path([./\s-]|$)/.test(candidates)
        || /(^|[./\s-])local([./\s-]|$)/.test(String(provisioner || '').toLowerCase())
}

const podUsesNodeLocalStorage = (pod: Node, nodes: Node[]): boolean => {
    const volumes = values(pod.data || {}, ['K8s.Extra.Spec.Volumes', 'K8s.Spec.Volumes', 'Spec.Volumes'])
    const namespace = resourceNamespace(pod)
    const cluster = resourceCluster(pod)
    const sameCluster = (node: Node) => !cluster || !resourceCluster(node) || resourceCluster(node) === cluster
    const pvcNodes = nodes.filter(node => resourceType(node) === 'persistentvolumeclaim' && sameCluster(node))
    const pvNodes = nodes.filter(node => resourceType(node) === 'persistentvolume' && sameCluster(node))
    const storageClasses = nodes.filter(node => resourceType(node) === 'storageclass' && sameCluster(node))

    return volumes.some(volume => {
        if (volume?.HostPath || volume?.hostPath) return true
        const claimName = String(firstRaw(volume || {}, [
            'PersistentVolumeClaim.ClaimName', 'persistentVolumeClaim.claimName', 'PVC.ClaimName'
        ]) || '')
        if (!claimName) return false
        const pvc = pvcNodes.find(node => resourceNamespace(node) === namespace && resourceName(node) === claimName)
        if (!pvc) return false
        const volumeName = String(firstRaw(pvc.data || {}, [
            'K8s.Extra.Spec.VolumeName', 'K8s.Spec.VolumeName', 'Spec.VolumeName', 'VolumeName'
        ]) || '')
        const pv = pvNodes.find(node => resourceName(node) === volumeName)
        if (pv && firstRaw(pv.data || {}, [
            'K8s.Extra.Spec.Local', 'K8s.Extra.Spec.HostPath', 'K8s.Spec.Local', 'K8s.Spec.HostPath', 'Spec.Local', 'Spec.HostPath'
        ])) return true
        const storageClassName = String(firstRaw(pvc.data || {}, [
            'K8s.Extra.Spec.StorageClassName', 'K8s.Spec.StorageClassName', 'Spec.StorageClassName', 'StorageClassName'
        ]) || (pv ? firstRaw(pv.data || {}, [
            'K8s.Extra.Spec.StorageClassName', 'K8s.Spec.StorageClassName', 'Spec.StorageClassName', 'StorageClassName'
        ]) : '') || '')
        const storageClass = storageClasses.find(node => resourceName(node) === storageClassName)
        const provisioner = storageClass ? String(firstRaw(storageClass.data || {}, [
            'K8s.Extra.Provisioner', 'K8s.Extra.Spec.Provisioner', 'Provisioner'
        ]) || '') : ''
        return isNodeLocalStorageProvisioner(provisioner, storageClassName)
    })
}

export interface KubernetesNodeLocalStorageResult {
    pods: Node[]
    workloads: Node[]
}

export const kubernetesNodeLocalStorageDependencies = (activePods: Node[], nodes: Node[]): KubernetesNodeLocalStorageResult => {
    const pods = activePods.filter(pod => podUsesNodeLocalStorage(pod, nodes))
    return { pods, workloads: uniqueTopControllers(pods, nodes) }
}
