import * as React from 'react'

import { DetailMetricSummaryRow } from './DetailComponents'
import { kubernetesReplicaLabel, KubernetesReplicaTerm } from './KubernetesDataPresentation'

export interface KubernetesReplicaSummaryProps {
    desired?: number
    ready?: number
    current?: number
    updated?: number
    unavailable?: number
}

const terms: KubernetesReplicaTerm[] = ['desired', 'ready', 'current', 'updated', 'unavailable']

const descriptions: Record<KubernetesReplicaTerm, string> = {
    desired: 'spec.replicas에 지정된 목표 복제본 수입니다.',
    ready: 'Ready 조건이 True인 복제본 수입니다.',
    current: '현재 리비전으로 유지되는 복제본 수입니다.',
    updated: '업데이트 리비전이 적용된 복제본 수입니다.',
    unavailable: '목표 복제본 중 Ready 상태가 아닌 복제본 수입니다.'
}

/** Fixed-order, equal-width Replica evidence strip shared by Replica workloads. */
export const KubernetesReplicaSummary = (props: KubernetesReplicaSummaryProps) =>
    <DetailMetricSummaryRow items={terms.map(term => {
        const value = props[term]
        const warning = term === 'ready'
            ? value !== undefined && props.desired !== undefined && value < props.desired
            : term === 'unavailable' && value !== undefined && value > 0
        return {
            key: term,
            label: kubernetesReplicaLabel(term, true),
            value: value === undefined ? '–' : value,
            tone: warning ? (term === 'unavailable' ? 'danger' as const : 'warning' as const) : undefined,
            tooltip: descriptions[term]
        }
    })} />
