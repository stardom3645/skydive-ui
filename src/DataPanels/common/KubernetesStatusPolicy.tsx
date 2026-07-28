import * as React from 'react'
import { Tooltip } from 'antd'

import { Node } from '../../Topology'
import './KubernetesStatusPolicy.css'

export type KubernetesStateTone = 'danger' | 'warning' | 'history' | 'success' | 'default'

export interface KubernetesStateItem {
    key: React.Key
    label: React.ReactNode
    value: React.ReactNode
    tone: KubernetesStateTone
    tooltip?: React.ReactNode
}

export const KubernetesStateSeparation = ({ items }: { items: KubernetesStateItem[] }) => (
    <div className="netdive-k8s-state-separation">
        {items.map(item => {
            const content = <div className={`is-${item.tone}`}><span>{item.label}</span><strong>{item.value}</strong></div>
            return item.tooltip ? <Tooltip key={item.key} title={item.tooltip} placement="top">{content}</Tooltip> : <React.Fragment key={item.key}>{content}</React.Fragment>
        })}
    </div>
)

const valueByPath = (data: any, path: string): any => path.split('.').reduce((value, key) => value === undefined || value === null ? undefined : value[key], data)
const firstRaw = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const value = valueByPath(data, path)
        if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return undefined
}
const firstValue = (data: any, paths: string[]): string => {
    const value = firstRaw(data, paths)
    if (value === undefined || value === null) return ''
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

const ACTIVE_CONTAINER_REASONS = new Set([
    'crashloopbackoff', 'imagepullbackoff', 'errimagepull',
    'createcontainererror', 'createcontainerconfigerror',
    'containerstatusunknown', 'failedmount', 'failedattachvolume'
])

export interface KubernetesPodClassification {
    phase: string
    reason: string
    evicted: boolean
    completed: boolean
    activeProblem: boolean
    activeReason: string
    historicalReasons: string[]
    timestamp?: number
}

const podTimestamp = (node: Node): number | undefined => {
    const data = node.data || {}
    const candidates = [
        firstRaw(data, ['K8s.FinishedAt', 'FinishedAt']),
        firstRaw(data, ['K8s.DeletionTimestamp', 'DeletionTimestamp']),
        firstRaw(data, ['K8s.CreationTimestamp', 'CreationTimestamp'])
    ]
    for (const candidate of candidates) {
        const value = new Date(candidate).getTime()
        if (!Number.isNaN(value)) return value
    }
    return undefined
}

export const classifyKubernetesPod = (node: Node): KubernetesPodClassification => {
    const data = node.data || {}
    const phase = firstValue(data, ['K8s.Extra.Status.Phase', 'K8s.Status', 'Status', 'Phase']).toLowerCase()
    const reason = firstValue(data, ['K8s.Extra.Status.Reason', 'Reason']).toLowerCase()
    const statuses = ([] as any[]).concat(
        firstRaw(data, ['K8s.Extra.Status.InitContainerStatuses']) || [],
        firstRaw(data, ['K8s.Extra.Status.ContainerStatuses']) || [],
        firstRaw(data, ['K8s.Extra.Status.EphemeralContainerStatuses']) || []
    )
    const activeReasons: string[] = []
    const historicalReasons: string[] = []
    statuses.forEach(status => {
        const waiting = status?.State?.Waiting?.Reason
        const terminated = status?.State?.Terminated?.Reason
        const previous = status?.LastTerminationState?.Terminated?.Reason
        if (waiting && ACTIVE_CONTAINER_REASONS.has(String(waiting).toLowerCase())) activeReasons.push(String(waiting))
        if (terminated && ACTIVE_CONTAINER_REASONS.has(String(terminated).toLowerCase())) activeReasons.push(String(terminated))
        if (previous) historicalReasons.push(String(previous))
    })
    const owners = firstRaw(data, ['K8s.Extra.ObjectMeta.OwnerReferences'])
    const owner = Array.isArray(owners) ? owners.find(item => item?.Controller) || owners[0] : undefined
    const evicted = phase === 'failed' && reason === 'evicted'
    const completed = phase === 'succeeded'
    const failedJobPod = phase === 'failed' && String(owner?.Kind || '').toLowerCase() === 'job'
    const activeProblem = phase === 'pending'
        || phase === 'unknown'
        || (phase === 'failed' && !evicted && !failedJobPod)
        || (phase === 'running' && activeReasons.length > 0)
    return {
        phase,
        reason,
        evicted,
        completed,
        activeProblem,
        activeReason: activeReasons[0] || (activeProblem ? phase : ''),
        historicalReasons,
        timestamp: podTimestamp(node)
    }
}

export interface KubernetesPodSummary {
    total: number
    running: number
    pending: number
    unknown: number
    activeFailed: number
    activeProblems: Node[]
    evicted: Node[]
    recentEvicted: Node[]
    completed: number
    historicalRestartOrTermination: number
    timestampAvailable: boolean
}

export const summarizeKubernetesPods = (pods: Node[], recentWindowMs = 24 * 60 * 60 * 1000): KubernetesPodSummary => {
    const unique = new Map<string, Node>()
    pods.forEach(node => {
        const data = node.data || {}
        const uid = firstValue(data, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID']) || node.id
        unique.set(uid, node)
    })
    const nodes = Array.from(unique.values())
    const classifications = nodes.map(node => ({ node, status: classifyKubernetesPod(node) }))
    const evicted = classifications.filter(item => item.status.evicted)
    const cutoff = Date.now() - recentWindowMs
    return {
        total: nodes.length,
        running: classifications.filter(item => item.status.phase === 'running').length,
        pending: classifications.filter(item => item.status.phase === 'pending').length,
        unknown: classifications.filter(item => item.status.phase === 'unknown').length,
        activeFailed: classifications.filter(item => item.status.activeProblem && item.status.phase === 'failed').length,
        activeProblems: classifications.filter(item => item.status.activeProblem).map(item => item.node),
        evicted: evicted.map(item => item.node),
        recentEvicted: evicted.filter(item => item.status.timestamp !== undefined && item.status.timestamp >= cutoff).map(item => item.node),
        completed: classifications.filter(item => item.status.completed).length,
        historicalRestartOrTermination: classifications.filter(item => item.status.historicalReasons.length > 0).length,
        timestampAvailable: evicted.length === 0 || evicted.some(item => item.status.timestamp !== undefined)
    }
}
