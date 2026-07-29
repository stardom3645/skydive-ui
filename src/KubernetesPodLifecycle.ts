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
    activePhases: ['pending', 'running'],
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

const podStatuses = (data: any): any[] => ([] as any[]).concat(
    arrayValue(data, ['K8s.Extra.Status.InitContainerStatuses']),
    arrayValue(data, ['K8s.Extra.Status.ContainerStatuses']),
    arrayValue(data, ['K8s.Extra.Status.EphemeralContainerStatuses'])
)

const podConditions = (data: any): any[] =>
    arrayValue(data, ['K8s.Extra.Status.Conditions', 'K8s.Conditions', 'Conditions'])

const podReady = (data: any): boolean | undefined => {
    const ready = podConditions(data).find(condition => normalized(condition?.Type || condition?.type) === 'ready')
    if (!ready) return undefined
    return normalized(ready?.Status ?? ready?.status) === 'true'
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
    const phase = normalized(firstValue(data, ['K8s.Extra.Status.Phase', 'K8s.Phase', 'Phase', 'K8s.Status', 'Status']))
    const reason = normalized(firstValue(data, ['K8s.Extra.Status.Reason', 'K8s.Reason', 'Reason']))
    const deletionTimestamp = isTerminating(data)
    const terminalReason = reason === 'evicted' || reason === 'completed'
    const activePod = !deletionTimestamp && !terminalReason && (phase === 'pending' || phase === 'running')
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
    if (podReady(data) === false) problemReasons.push('ready=false')
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
