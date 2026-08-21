import * as React from 'react'

import { Node } from '../../Topology'
import { aggregatePods, getPodClassification, kubernetesPodTime } from '../../KubernetesPodLifecycle'
import { DetailInfoTooltip } from './DetailComponents'
import { kubernetesOperationalValueTone } from './KubernetesDataPresentation'
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
            const tone = kubernetesOperationalValueTone(item.label, item.value, item.tone)
            const content = <div className={`is-${tone}`}>
                <span>{item.label}<DetailInfoTooltip description={item.tooltip} ariaLabel={`${String(item.label)} 상세 정보`} /></span>
                <strong>{item.value}</strong>
            </div>
            return <React.Fragment key={item.key}>{content}</React.Fragment>
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

export const classifyKubernetesPod = (node: Node): KubernetesPodClassification => {
    const classification = getPodClassification(node)
    return {
        phase: classification.phase,
        reason: classification.reason,
        evicted: classification.evicted,
        completed: classification.completed,
        activeProblem: classification.problemPod,
        activeReason: classification.problemReason,
        historicalReasons: classification.historicalReasons,
        timestamp: kubernetesPodTime(node).value
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
    const aggregate = aggregatePods(nodes)
    const classifications = nodes.map(node => ({ node, status: classifyKubernetesPod(node), domain: getPodClassification(node) }))
    const evicted = classifications.filter(item => item.status.evicted)
    const cutoff = Date.now() - recentWindowMs
    return {
        total: aggregate.current,
        running: aggregate.running,
        pending: classifications.filter(item => item.domain.pendingPod).length,
        unknown: 0,
        activeFailed: 0,
        activeProblems: aggregate.currentProblemEntries.map(item => item.node),
        evicted: evicted.map(item => item.node),
        recentEvicted: evicted.filter(item => item.status.timestamp !== undefined && item.status.timestamp >= cutoff).map(item => item.node),
        completed: classifications.filter(item => item.status.completed).length,
        historicalRestartOrTermination: classifications.filter(item => item.status.historicalReasons.length > 0).length,
        timestampAvailable: evicted.length === 0 || evicted.some(item => item.status.timestamp !== undefined)
    }
}
