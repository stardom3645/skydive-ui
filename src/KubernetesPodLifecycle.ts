import type { Node } from './Topology'

export type KubernetesPodLifecycleKind = 'problem' | 'running' | 'current' | 'terminated'
export type KubernetesPodTimeAccuracy = '정확' | '추정' | '확인 불가'

export interface KubernetesPodLifecycle {
    kind: KubernetesPodLifecycleKind
    phase: string
    reason: string
    label: string
    originalReason?: string
}

export interface KubernetesPodClassification {
    phase: string
    reason: string
    activePod: boolean
    runningPod: boolean
    pendingPod: boolean
    problemPod: boolean
    terminatedPod: boolean
    problemReason: string
    problemReasons: string[]
    historicalReasons: string[]
    evicted: boolean
    restartHistoryPod: boolean
    currentOOMKilledPod: boolean
    completed: boolean
    deletionTimestamp: boolean
}

export interface KubernetesPodCurrentStatusSnapshot {
    uid: string
    name?: string
    namespace?: string
    phase?: string
    reason?: string
    nodeName?: string
    ready?: boolean
    problem?: boolean
    crashLoop?: boolean
    currentOOMKilled?: boolean
    deleting?: boolean
    observedAt?: string
}

export interface KubernetesPodTime {
    value?: number
    text: string
    accuracy: KubernetesPodTimeAccuracy
    source: string
}

export interface KubernetesPodStatusEntry {
    node: Node
    lifecycle: KubernetesPodLifecycle
    podName: string
    namespace: string
    nodeName: string
    workload: string
    time: KubernetesPodTime
}

export interface KubernetesPodStatusGroup {
    key: string
    label: string
    entries: KubernetesPodStatusEntry[]
}

export interface KubernetesPodAggregate {
    total: number
    active: number
    running: number
    pending: number
    problems: number
    evicted: number
    restartHistory: number
    currentOOMKilled: number
    unscheduledPending: number
    current: number
    currentProblems: number
    terminated: number
    activeEntries: KubernetesPodStatusEntry[]
    pendingEntries: KubernetesPodStatusEntry[]
    problemEntries: KubernetesPodStatusEntry[]
    evictedEntries: KubernetesPodStatusEntry[]
    restartHistoryEntries: KubernetesPodStatusEntry[]
    currentOOMKilledEntries: KubernetesPodStatusEntry[]
    unscheduledPendingEntries: KubernetesPodStatusEntry[]
    currentProblemEntries: KubernetesPodStatusEntry[]
    runningEntries: KubernetesPodStatusEntry[]
    currentEntries: KubernetesPodStatusEntry[]
    terminatedEntries: KubernetesPodStatusEntry[]
    currentProblemGroups: KubernetesPodStatusGroup[]
    terminationHistoryGroups: KubernetesPodStatusGroup[]
}

/**
 * Canonical Pod data dictionary shared by topology and detail panels.
 * Consumers must use getPodClassification/aggregatePods instead of inspecting
 * phase, reason, conditions or container states independently.
 */
export const KUBERNETES_POD_DOMAIN_RULES = Object.freeze({
    activePhases: ['pending', 'running', 'unknown'],
    terminatedPhases: ['succeeded', 'failed'],
    actionableWaitingReasons: [
        'crashloopbackoff',
        'imagepullbackoff',
        'errimagepull',
        'createcontainerconfigerror',
        'createcontainererror',
        'runcontainererror',
        'containerstatusunknown'
    ],
    identity: 'metadata.uid'
})

const valueByPath = (data: any, path: string): any =>
    path.split('.').reduce((current, key) => current === undefined || current === null ? undefined : current[key], data)

const firstValue = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const value = valueByPath(data, path)
        if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return ''
}

const arrayValue = (data: any, paths: string[]): any[] => {
    const value = firstValue(data, paths)
    return Array.isArray(value) ? value : []
}

const normalized = (value: any): string => String(value || '').trim().toLowerCase()

// Namespace and Pod detail APIs observe Kubernetes directly and are fresher
// than topology snapshots. Keeping the latest UID-scoped observation here lets
// Namespace, Deployment and Pod panels share one current-state decision.
const currentPodStatusByUID = new Map<string, KubernetesPodCurrentStatusSnapshot>()

const podUID = (node: Node): string => String(firstValue(node.data || {}, [
    'K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID'
]) || node.id)

export const registerKubernetesPodCurrentStatusSnapshots = (snapshots: any[]): void => {
    ;(Array.isArray(snapshots) ? snapshots : []).forEach(snapshot => {
        const uid = String(snapshot?.uid ?? snapshot?.UID ?? '').trim()
        if (!uid) return
        const candidate: KubernetesPodCurrentStatusSnapshot = {
            uid,
            name: snapshot?.name ?? snapshot?.Name,
            namespace: snapshot?.namespace ?? snapshot?.Namespace,
            phase: snapshot?.phase ?? snapshot?.Phase,
            reason: snapshot?.reason ?? snapshot?.Reason,
            nodeName: snapshot?.nodeName ?? snapshot?.NodeName,
            ready: typeof (snapshot?.ready ?? snapshot?.Ready) === 'boolean' ? (snapshot?.ready ?? snapshot?.Ready) : undefined,
            problem: typeof (snapshot?.problem ?? snapshot?.Problem) === 'boolean' ? (snapshot?.problem ?? snapshot?.Problem) : undefined,
            crashLoop: typeof (snapshot?.crashLoop ?? snapshot?.CrashLoop) === 'boolean' ? (snapshot?.crashLoop ?? snapshot?.CrashLoop) : undefined,
            currentOOMKilled: typeof (snapshot?.currentOOMKilled ?? snapshot?.CurrentOOMKilled) === 'boolean' ? (snapshot?.currentOOMKilled ?? snapshot?.CurrentOOMKilled) : undefined,
            deleting: typeof (snapshot?.deleting ?? snapshot?.Deleting) === 'boolean' ? (snapshot?.deleting ?? snapshot?.Deleting) : undefined,
            observedAt: snapshot?.observedAt ?? snapshot?.ObservedAt
        }
        const previous = currentPodStatusByUID.get(uid)
        const previousTime = previous?.observedAt ? Date.parse(previous.observedAt) : 0
        const candidateTime = candidate.observedAt ? Date.parse(candidate.observedAt) : Date.now()
        if (!previous || !Number.isFinite(previousTime) || !Number.isFinite(candidateTime) || candidateTime >= previousTime) {
            currentPodStatusByUID.set(uid, candidate)
        }
    })
}

export const registerKubernetesPodCurrentStatusDetail = (detail: any): void => {
    if (!detail) return
    const conditions = Array.isArray(detail.conditions) ? detail.conditions : []
    const readyCondition = conditions.find((condition: any) => normalized(condition?.type ?? condition?.Type) === 'ready')
    const containers = (Array.isArray(detail.containers) ? detail.containers : [])
        .filter((container: any) => normalized(container?.type) === 'application')
    const ready = readyCondition
        ? normalized(readyCondition.status ?? readyCondition.Status) === 'true'
        : containers.length > 0 && containers.every((container: any) => container?.ready === true)
            ? true
            : undefined
    const actionable = new Set(KUBERNETES_POD_DOMAIN_RULES.actionableWaitingReasons)
    const waitingReasons = containers
        .map((container: any) => normalized(container?.waitingReason))
        .filter(Boolean)
    const crashLoop = waitingReasons.indexOf('crashloopbackoff') >= 0
    const currentOOMKilled = containers.some((container: any) =>
        normalized(container?.state) === 'terminated' && normalized(container?.terminatedReason) === 'oomkilled')
    const phase = normalized(detail.phase)
    registerKubernetesPodCurrentStatusSnapshots([{
        uid: detail.uid,
        name: detail.name,
        namespace: detail.namespace,
        phase: detail.phase,
        reason: detail.reason,
        nodeName: detail.nodeName,
        ready,
        problem: phase === 'pending' || phase === 'failed' || phase === 'unknown'
            || (phase === 'running' && ready === false)
            || waitingReasons.some(reason => actionable.has(reason))
            || currentOOMKilled,
        crashLoop,
        currentOOMKilled,
        observedAt: detail.observedAt || new Date().toISOString()
    }])
}

export const kubernetesPodCurrentStatusSnapshot = (node: Node): KubernetesPodCurrentStatusSnapshot | undefined =>
    currentPodStatusByUID.get(podUID(node))

const podStatuses = (data: any): any[] => ([] as any[]).concat(
    arrayValue(data, ['K8s.Extra.Status.InitContainerStatuses']),
    arrayValue(data, ['K8s.Extra.Status.ContainerStatuses']),
    arrayValue(data, ['K8s.Extra.Status.EphemeralContainerStatuses'])
)

const podConditions = (data: any): any[] =>
    arrayValue(data, ['K8s.Extra.Status.Conditions', 'K8s.Conditions', 'Conditions'])

export const kubernetesPodReady = (data: any): boolean | undefined => {
    const ready = podConditions(data).find(condition => normalized(condition?.Type || condition?.type) === 'ready')
    if (ready) return normalized(ready?.Status ?? ready?.status) === 'true'
    // Only application containers participate in the Pod readiness fallback.
    // Completed init containers and ephemeral containers cannot make a current
    // Running Pod Not Ready.
    const statuses = arrayValue(data, ['K8s.Extra.Status.ContainerStatuses'])
    if (statuses.length > 0 && statuses.every(status => (status?.Ready ?? status?.ready) === true)) return true
    return undefined
}

const dateValue = (value: any): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined
    const source = typeof value === 'object' && value.Time !== undefined ? value.Time : value
    const timestamp = typeof source === 'number' ? source : Date.parse(String(source))
    if (!Number.isFinite(timestamp)) return undefined
    return timestamp < 100000000000 ? timestamp * 1000 : timestamp
}

const waitingReasonsOf = (data: any): string[] =>
    podStatuses(data).map(status => normalized(status?.State?.Waiting?.Reason || status?.state?.waiting?.reason)).filter(Boolean)

const terminatedReasonsOf = (data: any): string[] =>
    podStatuses(data).reduce((reasons: string[], status) => {
        const current = status?.State?.Terminated?.Reason || status?.state?.terminated?.reason
        const previous = status?.LastTerminationState?.Terminated?.Reason || status?.lastState?.terminated?.reason
        if (current) reasons.push(String(current))
        if (previous) reasons.push(String(previous))
        return reasons
    }, [])

const restartCountOf = (data: any): number =>
    podStatuses(data).reduce((total, status) => total + Number(status?.RestartCount ?? status?.restartCount ?? 0), 0)

const isTerminating = (data: any): boolean =>
    !!firstValue(data, [
        'K8s.Extra.Metadata.DeletionTimestamp',
        'K8s.Extra.ObjectMeta.DeletionTimestamp.Time',
        'K8s.Extra.ObjectMeta.DeletionTimestamp',
        'K8s.Metadata.DeletionTimestamp',
        'K8s.DeletionTimestamp',
        'DeletionTimestamp'
    ])

const terminalCategory = (phase: string, rawReason: string, reasons: string[]): { key: string, label: string } | undefined => {
    const candidates = [rawReason, ...reasons].map(normalized)
    if (candidates.indexOf('evicted') >= 0) return { key: 'evicted', label: 'Evicted' }
    if (candidates.indexOf('oomkilled') >= 0) return { key: 'oomkilled', label: 'OOMKilled' }
    if (candidates.indexOf('deadlineexceeded') >= 0) return { key: 'deadlineexceeded', label: 'DeadlineExceeded' }
    if (candidates.indexOf('nodelost') >= 0) return { key: 'nodelost', label: 'NodeLost' }
    if (candidates.indexOf('error') >= 0) return { key: 'error', label: 'Error' }
    if (phase === 'succeeded') return { key: 'succeeded', label: 'Succeeded' }
    if (phase === 'failed') return { key: 'failed', label: '기타 Failed' }
    return undefined
}

// This is the single frontend domain rule for Pod counts. Resource panels and
// topology badges must consume these flags rather than inspect phase/reason.
export const getPodClassification = (node: Node): KubernetesPodClassification => {
    const data = node.data || {}
    const currentStatus = kubernetesPodCurrentStatusSnapshot(node)
    const phase = normalized(currentStatus?.phase || firstValue(data, ['K8s.Extra.Status.Phase', 'K8s.Phase', 'Phase', 'K8s.Status', 'Status']))
    const reason = normalized(currentStatus?.reason || firstValue(data, ['K8s.Extra.Status.Reason', 'K8s.Reason', 'Reason']))
    const deletionTimestamp = currentStatus?.deleting !== undefined ? currentStatus.deleting : isTerminating(data)
    const terminalReason = reason === 'evicted' || reason === 'completed'
    const activePod = !deletionTimestamp && !terminalReason && (phase === 'pending' || phase === 'running' || phase === 'unknown')
    const statuses = podStatuses(data)
    const waitingReasons = waitingReasonsOf(data)
    const historicalReasons = terminatedReasonsOf(data)
    const actionableReasons = new Set(KUBERNETES_POD_DOMAIN_RULES.actionableWaitingReasons)
    const problemReasons: string[] = []
    waitingReasons.forEach(item => {
        if (actionableReasons.has(item)) problemReasons.push(item)
    })
    let currentOOMKilledPod = false
    statuses.forEach(status => {
        const current = normalized(status?.State?.Terminated?.Reason || status?.state?.terminated?.reason)
        const previous = normalized(status?.LastTerminationState?.Terminated?.Reason || status?.lastState?.terminated?.reason)
        if (current === 'oomkilled' || previous === 'oomkilled') {
            currentOOMKilledPod = activePod
            problemReasons.push('oomkilled')
        }
    })
    const ready = currentStatus?.ready !== undefined ? currentStatus.ready : kubernetesPodReady(data)
    if (ready === false) problemReasons.push('ready=false')
    if (currentStatus?.crashLoop === true) problemReasons.push('crashloopbackoff')
    if (currentStatus?.currentOOMKilled === true) problemReasons.push('oomkilled')
    if (currentStatus?.problem === true && problemReasons.length === 0) problemReasons.push('api-current-problem')
    if (currentStatus?.problem === false) problemReasons.splice(0, problemReasons.length)
    const uniqueProblemReasons = Array.from(new Set(problemReasons))
    const evicted = reason === 'evicted'
    const completed = phase === 'succeeded' || reason === 'completed'
    const terminatedPod = deletionTimestamp || phase === 'succeeded' || phase === 'failed' || terminalReason
    return {
        phase,
        reason,
        activePod,
        runningPod: activePod && phase === 'running',
        pendingPod: activePod && phase === 'pending',
        problemPod: activePod && uniqueProblemReasons.length > 0,
        terminatedPod,
        problemReason: uniqueProblemReasons[0] || '',
        problemReasons: uniqueProblemReasons,
        historicalReasons,
        evicted,
        restartHistoryPod: activePod && restartCountOf(data) > 0,
        currentOOMKilledPod,
        completed,
        deletionTimestamp
    }
}

export const isKubernetesPod = (node: Node): boolean =>
    String(node.data?.Manager || '').toLowerCase() === 'k8s'
    && String(node.data?.Type || '').toLowerCase() === 'pod'

export const kubernetesPodLifecycle = (node: Node): KubernetesPodLifecycle => {
    const data = node.data || {}
    const classification = getPodClassification(node)
    const phase = classification.phase
    const rawReason = String(firstValue(data, ['K8s.Extra.Status.Reason', 'K8s.Reason', 'Reason']) || '')
    const terminatedReasons = terminatedReasonsOf(data)
    const terminal = terminalCategory(phase, rawReason, terminatedReasons)
    if (classification.terminatedPod) {
        const resolvedTerminal = terminal || { key: 'terminated', label: '종료됨' }
        return {
            kind: 'terminated',
            phase,
            reason: resolvedTerminal.key,
            label: resolvedTerminal.label,
            originalReason: rawReason || terminatedReasons[0] || resolvedTerminal.label
        }
    }

    const waitingLabels: Record<string, string> = {
        crashloopbackoff: 'CrashLoopBackOff',
        imagepullbackoff: 'ImagePullBackOff',
        errimagepull: 'ErrImagePull',
        createcontainerconfigerror: 'CreateContainerConfigError',
        createcontainererror: 'CreateContainerError',
        runcontainererror: 'RunContainerError',
        containerstatusunknown: 'Unknown',
        oomkilled: 'OOMKilled',
        'ready=false': 'Ready=false'
    }
    if (classification.problemPod) {
        const activeReason = classification.problemReason
        return {
            kind: 'problem',
            phase,
            reason: activeReason,
            label: waitingLabels[activeReason] || activeReason,
            originalReason: waitingLabels[activeReason] || activeReason
        }
    }

    if (classification.runningPod) return { kind: 'running', phase, reason: '', label: 'Running' }
    return { kind: 'current', phase, reason: rawReason, label: phase || '현재 상태' }
}

export const kubernetesPodTime = (node: Node): KubernetesPodTime => {
    const data = node.data || {}
    const terminatedTimes = podStatuses(data).reduce((values: any[], status) => {
        values.push(
            status?.State?.Terminated?.FinishedAt,
            status?.state?.terminated?.finishedAt,
            status?.LastTerminationState?.Terminated?.FinishedAt,
            status?.lastState?.terminated?.finishedAt
        )
        return values
    }, [
        firstValue(data, ['K8s.FinishedAt', 'FinishedAt'])
    ]).map(dateValue).filter((value): value is number => value !== undefined)
    const finishedAt = terminatedTimes.length ? Math.max(...terminatedTimes) : undefined
    if (finishedAt !== undefined) {
        return { value: finishedAt, text: new Date(finishedAt).toLocaleString(), accuracy: '정확', source: '종료 시각' }
    }

    const transitionTimes = [
        firstValue(data, ['K8s.LastTransitionTimestamp', 'LastTransitionTimestamp']),
        ...podConditions(data)
        .map(condition => dateValue(condition?.LastTransitionTime || condition?.lastTransitionTime))
    ].map(dateValue).filter((value): value is number => value !== undefined)
    const transitionAt = transitionTimes.length ? Math.max(...transitionTimes) : undefined
    if (transitionAt !== undefined) {
        return { value: transitionAt, text: new Date(transitionAt).toLocaleString(), accuracy: '정확', source: '상태 전환 시각' }
    }

    const rawEvents = firstValue(data, ['K8s.Extra.Events', 'K8s.Events', 'Events'])
    const events = Array.isArray(rawEvents)
        ? rawEvents
        : Array.isArray(rawEvents?.items)
            ? rawEvents.items
            : Array.isArray(rawEvents?.Items) ? rawEvents.Items : []
    const terminalReasons = new Set(['evicted', 'oomkilled', 'error', 'deadlineexceeded', 'nodelost', 'killing'])
    const eventTimes = [
        firstValue(data, ['K8s.EvictionTimestamp', 'EvictionTimestamp']),
        ...events
            .filter(event => terminalReasons.has(normalized(firstValue(event, ['reason', 'Reason']))))
            .map(event => firstValue(event, [
                'lastTimestamp', 'LastTimestamp', 'eventTime', 'EventTime',
                'lastObservedTime', 'LastObservedTime', 'series.lastObservedTime',
                'Series.LastObservedTime', 'metadata.creationTimestamp',
                'ObjectMeta.CreationTimestamp'
            ]))
    ].map(dateValue).filter((value): value is number => value !== undefined)
    const eventAt = eventTimes.length ? Math.max(...eventTimes) : undefined
    if (eventAt !== undefined) {
        return { value: eventAt, text: new Date(eventAt).toLocaleString(), accuracy: '정확', source: '이벤트 시각' }
    }

    const createdAt = dateValue(firstValue(data, [
        'K8s.Extra.Metadata.CreationTimestamp',
        'K8s.Extra.ObjectMeta.CreationTimestamp.Time',
        'K8s.Extra.ObjectMeta.CreationTimestamp',
        'K8s.Metadata.CreationTimestamp',
        'K8s.CreationTimestamp',
        'CreationTimestamp',
        'CreatedAt'
    ]))
    if (createdAt !== undefined) {
        return { value: createdAt, text: new Date(createdAt).toLocaleString(), accuracy: '추정', source: '생성 시각' }
    }
    return { text: '확인 불가', accuracy: '확인 불가', source: '시간 정보 없음' }
}

const podNamespace = (data: any): string => String(firstValue(data, [
    'K8s.Extra.ObjectMeta.Namespace', 'K8s.Extra.Metadata.Namespace', 'K8s.Metadata.Namespace', 'K8s.Namespace', 'Namespace'
]) || '정보 없음')

const podNodeName = (data: any): string => String(firstValue(data, [
    'K8s.Extra.Spec.NodeName', 'K8s.Spec.NodeName', 'K8s.NodeName', 'NodeName'
]) || '정보 없음')

const podWorkload = (data: any): string => {
    const owners = arrayValue(data, [
        'K8s.Extra.ObjectMeta.OwnerReferences',
        'K8s.Extra.Metadata.OwnerReferences',
        'K8s.Metadata.OwnerReferences',
        'K8s.OwnerReferences',
        'OwnerReferences'
    ])
    const owner = owners.find(item => item?.Controller === true || item?.controller === true) || owners[0]
    return String(owner?.Name || owner?.name || firstValue(data, ['K8s.WorkloadName', 'WorkloadName']) || '정보 없음')
}

export const kubernetesPodStatusEntry = (node: Node): KubernetesPodStatusEntry => ({
    node,
    lifecycle: kubernetesPodLifecycle(node),
    podName: String(firstValue(node.data || {}, [
        'K8s.Extra.ObjectMeta.Name', 'K8s.Extra.Metadata.Name', 'K8s.Name', 'Name'
    ]) || node.id),
    namespace: podNamespace(node.data || {}),
    nodeName: podNodeName(node.data || {}),
    workload: podWorkload(node.data || {}),
    time: kubernetesPodTime(node)
})

const groupEntries = (entries: KubernetesPodStatusEntry[]): KubernetesPodStatusGroup[] => {
    const groups = new Map<string, KubernetesPodStatusGroup>()
    entries.forEach(entry => {
        const key = entry.lifecycle.reason || entry.lifecycle.label || 'unknown'
        const existing = groups.get(key)
        if (existing) {
            existing.entries.push(entry)
        } else {
            groups.set(key, { key, label: entry.lifecycle.label || '기타', entries: [entry] })
        }
    })
    return Array.from(groups.values())
        .map(group => ({
            ...group,
            entries: group.entries.sort((left, right) =>
                (right.time.value || 0) - (left.time.value || 0))
        }))
        .sort((left, right) => right.entries.length - left.entries.length || left.label.localeCompare(right.label))
}

export interface KubernetesPodAggregateScope {
    nodeName?: string
    namespace?: string
    ownerUID?: string
    resolveOwnerUID?: (node: Node) => string | undefined
    predicate?: (node: Node) => boolean
}

export const aggregatePods = (nodes: Node[], scope: KubernetesPodAggregateScope = {}): KubernetesPodAggregate => {
    const uniqueNodes = Array.from(nodes.reduce((result, node) => {
        if (!isKubernetesPod(node)) return result
        const data = node.data || {}
        const nodeName = String(firstValue(data, ['K8s.Extra.Spec.NodeName', 'K8s.Spec.NodeName', 'K8s.NodeName', 'NodeName']) || '')
        const namespace = podNamespace(data)
        if (scope.nodeName !== undefined && nodeName !== scope.nodeName) return result
        if (scope.namespace !== undefined && namespace !== scope.namespace) return result
        if (scope.ownerUID !== undefined && scope.resolveOwnerUID?.(node) !== scope.ownerUID) return result
        if (scope.predicate && !scope.predicate(node)) return result
        const uid = String(firstValue(data, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) || node.id)
        result.set(uid, node)
        return result
    }, new Map<string, Node>()).values())
    const classifiedEntries = uniqueNodes.map(node => ({
        entry: kubernetesPodStatusEntry(node),
        classification: getPodClassification(node)
    }))
    const entries = classifiedEntries.map(item => item.entry)
    const activeEntries = classifiedEntries.filter(item => item.classification.activePod).map(item => item.entry)
    const pendingEntries = classifiedEntries.filter(item => item.classification.pendingPod).map(item => item.entry)
    const currentProblemEntries = classifiedEntries.filter(item => item.classification.problemPod).map(item => item.entry)
    const runningEntries = classifiedEntries.filter(item => item.classification.runningPod).map(item => item.entry)
    const currentEntries = entries.filter(entry => entry.lifecycle.kind === 'current')
    const terminatedEntries = classifiedEntries.filter(item => item.classification.terminatedPod).map(item => item.entry)
    const evictedEntries = classifiedEntries.filter(item => item.classification.evicted).map(item => item.entry)
    const restartHistoryEntries = classifiedEntries.filter(item => item.classification.restartHistoryPod).map(item => item.entry)
    const currentOOMKilledEntries = classifiedEntries.filter(item => item.classification.currentOOMKilledPod).map(item => item.entry)
    const unscheduledPendingEntries = classifiedEntries
        .filter(item => item.classification.pendingPod && item.entry.nodeName === '정보 없음')
        .map(item => item.entry)
    return {
        total: entries.length,
        active: activeEntries.length,
        running: runningEntries.length,
        pending: pendingEntries.length,
        problems: currentProblemEntries.length,
        evicted: evictedEntries.length,
        restartHistory: restartHistoryEntries.length,
        currentOOMKilled: currentOOMKilledEntries.length,
        unscheduledPending: unscheduledPendingEntries.length,
        current: activeEntries.length,
        currentProblems: currentProblemEntries.length,
        terminated: terminatedEntries.length,
        activeEntries,
        pendingEntries,
        problemEntries: currentProblemEntries,
        evictedEntries,
        restartHistoryEntries,
        currentOOMKilledEntries,
        unscheduledPendingEntries,
        currentProblemEntries,
        runningEntries,
        currentEntries,
        terminatedEntries,
        currentProblemGroups: groupEntries(currentProblemEntries),
        terminationHistoryGroups: groupEntries(terminatedEntries)
    }
}

export const aggregateKubernetesPods = aggregatePods

export const isCurrentKubernetesPod = (node: Node): boolean =>
    !isKubernetesPod(node) || getPodClassification(node).activePod
