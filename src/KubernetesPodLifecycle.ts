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
    running: number
    current: number
    currentProblems: number
    terminated: number
    currentProblemEntries: KubernetesPodStatusEntry[]
    runningEntries: KubernetesPodStatusEntry[]
    currentEntries: KubernetesPodStatusEntry[]
    terminatedEntries: KubernetesPodStatusEntry[]
    currentProblemGroups: KubernetesPodStatusGroup[]
    terminationHistoryGroups: KubernetesPodStatusGroup[]
}

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

const ageMs = (data: any): number | undefined => {
    const timestamp = dateValue(firstValue(data, [
        'K8s.Extra.Metadata.CreationTimestamp',
        'K8s.Extra.ObjectMeta.CreationTimestamp.Time',
        'K8s.Extra.ObjectMeta.CreationTimestamp',
        'K8s.Metadata.CreationTimestamp',
        'K8s.CreationTimestamp',
        'CreationTimestamp',
        'CreatedAt'
    ]))
    return timestamp === undefined ? undefined : Math.max(0, Date.now() - timestamp)
}

const isOlderThan = (data: any, milliseconds: number): boolean => {
    const age = ageMs(data)
    return age !== undefined && age >= milliseconds
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
    podStatuses(data).reduce((sum, status) => sum + Number(status?.RestartCount ?? status?.restartCount ?? 0), 0)

const conditionOf = (data: any, type: string): any | undefined =>
    podConditions(data).find(condition => normalized(condition?.Type || condition?.type) === normalized(type))

const isTerminating = (data: any): boolean =>
    !!firstValue(data, [
        'K8s.Extra.Metadata.DeletionTimestamp',
        'K8s.Extra.ObjectMeta.DeletionTimestamp.Time',
        'K8s.Extra.ObjectMeta.DeletionTimestamp',
        'K8s.Metadata.DeletionTimestamp',
        'K8s.DeletionTimestamp',
        'DeletionTimestamp'
    ])

const terminatingAgeMs = (data: any): number | undefined => {
    const timestamp = dateValue(firstValue(data, [
        'K8s.Extra.ObjectMeta.DeletionTimestamp.Time',
        'K8s.Extra.ObjectMeta.DeletionTimestamp',
        'K8s.Extra.Metadata.DeletionTimestamp',
        'K8s.Metadata.DeletionTimestamp',
        'K8s.DeletionTimestamp',
        'DeletionTimestamp'
    ]))
    return timestamp === undefined ? undefined : Math.max(0, Date.now() - timestamp)
}

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

export const isKubernetesPod = (node: Node): boolean =>
    String(node.data?.Manager || '').toLowerCase() === 'k8s'
    && String(node.data?.Type || '').toLowerCase() === 'pod'

export const kubernetesPodLifecycle = (node: Node): KubernetesPodLifecycle => {
    const data = node.data || {}
    const phase = normalized(firstValue(data, ['K8s.Extra.Status.Phase', 'K8s.Phase', 'Phase', 'K8s.Status', 'Status']))
    const rawReason = String(firstValue(data, ['K8s.Extra.Status.Reason', 'K8s.Reason', 'Reason']) || '')
    const waitingReasons = waitingReasonsOf(data)
    const terminatedReasons = terminatedReasonsOf(data)
    const terminal = terminalCategory(phase, rawReason, terminatedReasons)
    if (terminal) {
        return {
            kind: 'terminated',
            phase,
            reason: terminal.key,
            label: terminal.label,
            originalReason: rawReason || terminatedReasons[0] || terminal.label
        }
    }

    const waitingLabels: Record<string, string> = {
        crashloopbackoff: 'CrashLoopBackOff',
        imagepullbackoff: 'ImagePullBackOff',
        errimagepull: 'ErrImagePull',
        containerstatusunknown: 'Unknown'
    }
    const immediateWaitingProblem = waitingReasons.find(reason => !!waitingLabels[reason])
    if (immediateWaitingProblem) {
        return {
            kind: 'problem',
            phase,
            reason: immediateWaitingProblem,
            label: waitingLabels[immediateWaitingProblem],
            originalReason: waitingLabels[immediateWaitingProblem]
        }
    }

    const scheduled = conditionOf(data, 'PodScheduled')
    if (scheduled && normalized(scheduled?.Status ?? scheduled?.status) === 'false'
        && normalized(scheduled?.Reason ?? scheduled?.reason) === 'unschedulable') {
        return { kind: 'problem', phase, reason: 'unschedulable', label: 'Unschedulable', originalReason: 'Unschedulable' }
    }
    if (waitingReasons.indexOf('containercreating') >= 0 && isOlderThan(data, 5 * 60 * 1000)) {
        return { kind: 'problem', phase, reason: 'containercreating', label: '장기 ContainerCreating' }
    }
    if (phase === 'pending' && isOlderThan(data, 5 * 60 * 1000)) {
        return { kind: 'problem', phase, reason: 'pending', label: '장기 Pending' }
    }
    if (phase === 'unknown') {
        return { kind: 'problem', phase, reason: 'unknown', label: 'Unknown' }
    }
    const terminatingAge = terminatingAgeMs(data)
    if (isTerminating(data) && terminatingAge !== undefined && terminatingAge >= 10 * 60 * 1000) {
        return { kind: 'problem', phase, reason: 'terminating', label: '장기 Terminating' }
    }
    if (phase === 'running' && podReady(data) === false) {
        return { kind: 'problem', phase, reason: 'notready', label: 'Running · NotReady' }
    }
    if (restartCountOf(data) >= 2 && terminatedReasons.map(normalized).indexOf('oomkilled') >= 0) {
        return { kind: 'problem', phase, reason: 'repeated-oomkilled', label: '반복 OOMKilled' }
    }
    if (phase === 'running') return { kind: 'running', phase, reason: '', label: 'Running' }
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

export const aggregateKubernetesPods = (nodes: Node[]): KubernetesPodAggregate => {
    const uniqueNodes = Array.from(nodes.reduce((result, node) => {
        if (isKubernetesPod(node)) result.set(node.id, node)
        return result
    }, new Map<string, Node>()).values())
    const entries = uniqueNodes.map(kubernetesPodStatusEntry)
    const currentProblemEntries = entries.filter(entry => entry.lifecycle.kind === 'problem')
    const runningEntries = entries.filter(entry => entry.lifecycle.kind === 'running')
    const currentEntries = entries.filter(entry => entry.lifecycle.kind === 'current')
    const terminatedEntries = entries.filter(entry => entry.lifecycle.kind === 'terminated')
    return {
        total: entries.length,
        running: runningEntries.length,
        current: entries.length - terminatedEntries.length,
        currentProblems: currentProblemEntries.length,
        terminated: terminatedEntries.length,
        currentProblemEntries,
        runningEntries,
        currentEntries,
        terminatedEntries,
        currentProblemGroups: groupEntries(currentProblemEntries),
        terminationHistoryGroups: groupEntries(terminatedEntries)
    }
}

export const isCurrentKubernetesPod = (node: Node): boolean =>
    !isKubernetesPod(node) || kubernetesPodLifecycle(node).kind !== 'terminated'
