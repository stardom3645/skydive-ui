import * as React from 'react'

import { DetailCardSubsectionHeader, DetailMetricSummaryRow } from './DetailComponents'
import { kubernetesDaemonSetNodeLabel, KubernetesDaemonSetNodeTerm } from './KubernetesDataPresentation'

export interface KubernetesDaemonSetPlacementSummaryProps {
    desired?: number
    current?: number
    ready?: number
    available?: number
    updated?: number
    unavailable?: number
    misscheduled?: number
}

const placementTerms: KubernetesDaemonSetNodeTerm[] = ['desired', 'current', 'ready', 'available', 'updated']
const anomalyTerms: KubernetesDaemonSetNodeTerm[] = ['unavailable', 'misscheduled']

const descriptions: Record<KubernetesDaemonSetNodeTerm, string> = {
    desired: 'DaemonSet 파드를 배치해야 하는 대상 노드 수입니다. Kubernetes 원본 필드: status.desiredNumberScheduled',
    current: '현재 DaemonSet 파드가 배치된 노드 수입니다. Kubernetes 원본 필드: status.currentNumberScheduled',
    ready: '배치된 파드가 Ready 상태인 노드 수입니다. Kubernetes 원본 필드: status.numberReady',
    available: '최소 준비 시간 조건을 충족해 가용한 노드 수입니다. Kubernetes 원본 필드: status.numberAvailable',
    updated: '현재 DaemonSet 템플릿이 적용된 노드 수입니다. Kubernetes 원본 필드: status.updatedNumberScheduled',
    unavailable: '배치 대상 중 가용하지 않은 노드 수입니다. Kubernetes 원본 필드: status.numberUnavailable',
    misscheduled: 'DaemonSet 배치 대상이 아닌 노드에서 실행 중인 파드 수입니다. Kubernetes 원본 필드: status.numberMisscheduled'
}

const summaryItems = (props: KubernetesDaemonSetPlacementSummaryProps, terms: KubernetesDaemonSetNodeTerm[]) => terms.map(term => {
        const value = props[term]
        const deficit = term === 'current' || term === 'ready' || term === 'available' || term === 'updated'
        const warning = deficit
            ? value !== undefined && props.desired !== undefined && value < props.desired
            : (term === 'unavailable' || term === 'misscheduled') && value !== undefined && value > 0
        return {
            key: term,
            label: kubernetesDaemonSetNodeLabel(term, true),
            value: value === undefined ? '–' : value,
            tone: warning ? (term === 'misscheduled' ? 'danger' as const : 'warning' as const) : undefined,
            tooltip: descriptions[term]
        }
    })

/** Meaning-grouped DaemonSet placement evidence composed from shared summary primitives. */
export const KubernetesDaemonSetPlacementSummary = (props: KubernetesDaemonSetPlacementSummaryProps) => <>
    <DetailCardSubsectionHeader title="배치 현황" first />
    <DetailMetricSummaryRow items={summaryItems(props, placementTerms)} />
    <DetailCardSubsectionHeader title="이상 현황" />
    <DetailMetricSummaryRow variant="supporting" items={summaryItems(props, anomalyTerms)} />
</>
