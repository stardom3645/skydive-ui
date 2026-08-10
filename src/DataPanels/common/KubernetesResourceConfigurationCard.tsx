import * as React from 'react'
import DnsIcon from '@material-ui/icons/Dns'

import {
    BasicInfoRows,
    DetailSectionCard,
    KUBERNETES_DETAIL_LABELS,
    StatusEvidenceList,
    StatusEvidenceRow
} from './DetailComponents'
import {
    kubernetesConfiguredResourceTotalPresentation,
    kubernetesConfigurationCoveragePresentation,
    kubernetesResourceConfigurationCollectionState,
    kubernetesSingleResourceValuePresentation,
    KubernetesCollectionState
} from './KubernetesDataPresentation'
import { formatPodCpuUsage, formatPodMemoryUsage } from './KubernetesPodUsageMetrics'
import { kubernetesCpuCores, kubernetesMemoryBytes } from './kubernetesQuantity'

export interface KubernetesResourceConfigurationCoverage {
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

export interface KubernetesResourceConfigurationCardProps {
    coverage: KubernetesResourceConfigurationCoverage
    icon?: React.ReactNode
    title?: React.ReactNode
    description?: React.ReactNode
    descriptionTooltip?: React.ReactNode
}

export interface KubernetesResourceConfigurationRowsProps {
    coverage: KubernetesResourceConfigurationCoverage
    mode?: 'aggregate' | 'single'
}

/** Converts one collected Container ResourceRequirements object into the same
 * coverage contract used by aggregate namespace metrics. Presence of a key is
 * kept separate from parsing its numeric value so an invalid collected value
 * becomes "확인 불가", not "수집되지 않음". */
export const kubernetesSingleContainerResourceCoverage = (
    resources: any,
    collected: boolean
): KubernetesResourceConfigurationCoverage => {
    const requests = resources?.Requests ?? resources?.requests ?? {}
    const limits = resources?.Limits ?? resources?.limits ?? {}
    const has = (value: any, key: string) => !!value && Object.prototype.hasOwnProperty.call(value, key)
    return {
        total: 1,
        cpuRequests: has(requests, 'cpu') ? 1 : 0,
        cpuLimits: has(limits, 'cpu') ? 1 : 0,
        memoryRequests: has(requests, 'memory') ? 1 : 0,
        memoryLimits: has(limits, 'memory') ? 1 : 0,
        cpuRequestsCollected: collected,
        cpuLimitsCollected: collected,
        memoryRequestsCollected: collected,
        memoryLimitsCollected: collected,
        cpuRequestsCores: has(requests, 'cpu') ? kubernetesCpuCores(requests.cpu) : undefined,
        cpuLimitsCores: has(limits, 'cpu') ? kubernetesCpuCores(limits.cpu) : undefined,
        memoryRequestsBytes: has(requests, 'memory') ? kubernetesMemoryBytes(requests.memory) : undefined,
        memoryLimitsBytes: has(limits, 'memory') ? kubernetesMemoryBytes(limits.memory) : undefined
    }
}

const resourceMetrics = (coverage: KubernetesResourceConfigurationCoverage) => [
    {
        key: 'cpu-requests',
        label: KUBERNETES_DETAIL_LABELS.cpuRequests,
        configuredContainers: coverage.cpuRequests,
        collected: coverage.cpuRequestsCollected,
        aggregate: coverage.cpuRequestsCores,
        format: formatPodCpuUsage,
        tooltip: '활성 파드가 스케줄링 시 요청하는 CPU 설정입니다.'
    },
    {
        key: 'cpu-limits',
        label: KUBERNETES_DETAIL_LABELS.cpuLimits,
        configuredContainers: coverage.cpuLimits,
        collected: coverage.cpuLimitsCollected,
        aggregate: coverage.cpuLimitsCores,
        format: formatPodCpuUsage,
        tooltip: '활성 파드 컨테이너가 사용할 수 있는 CPU 상한입니다.'
    },
    {
        key: 'memory-requests',
        label: KUBERNETES_DETAIL_LABELS.memoryRequests,
        configuredContainers: coverage.memoryRequests,
        collected: coverage.memoryRequestsCollected,
        aggregate: coverage.memoryRequestsBytes,
        format: formatPodMemoryUsage,
        tooltip: '활성 파드가 스케줄링 시 요청하는 메모리 설정입니다.'
    },
    {
        key: 'memory-limits',
        label: KUBERNETES_DETAIL_LABELS.memoryLimits,
        configuredContainers: coverage.memoryLimits,
        collected: coverage.memoryLimitsCollected,
        aggregate: coverage.memoryLimitsBytes,
        format: formatPodMemoryUsage,
        tooltip: '활성 파드 컨테이너가 사용할 수 있는 메모리 상한입니다.'
    }
]

export const kubernetesResourceConfigurationCoverageState = (
    coverage: KubernetesResourceConfigurationCoverage
): KubernetesCollectionState => kubernetesResourceConfigurationCollectionState(
    resourceMetrics(coverage).map(metric => ({
        configuredContainers: metric.configuredContainers,
        collected: metric.collected,
        aggregate: metric.aggregate
    }))
)

export const KubernetesResourceConfigurationRows = ({
    coverage,
    mode = 'aggregate'
}: KubernetesResourceConfigurationRowsProps) => {
    const rows = resourceMetrics(coverage).map(metric => {
        const state = kubernetesConfigurationCoveragePresentation(metric.configuredContainers, coverage.total, metric.collected)
        return {
            ...metric,
            status: state.label,
            tone: state.tone,
            configured: state.value,
            total: kubernetesConfiguredResourceTotalPresentation({
                configuredContainers: metric.configuredContainers,
                collected: metric.collected,
                aggregate: metric.aggregate,
                format: metric.format
            }),
            singleValue: kubernetesSingleResourceValuePresentation({
                configuredContainers: metric.configuredContainers,
                collected: metric.collected,
                aggregate: metric.aggregate,
                format: metric.format
            })
        }
    })
    if (mode === 'single') return <BasicInfoRows
        density="compact"
        labelWidth={122}
        rows={rows.map(row => ({
            key: row.key,
            label: row.label,
            value: row.singleValue,
            tooltip: row.tooltip.replace('활성 파드', '이 컨테이너')
        }))}
    />
    return <StatusEvidenceList columnHeaders={{
        state: '상태',
        value: '설정 컨테이너',
        secondaryValue: '설정 합계',
        valueTooltip: '설정 컨테이너는 해당 값이 명시된 컨테이너 수와 평가 대상 전체 컨테이너 수의 비율입니다.'
    }}>
        {rows.map(row => <StatusEvidenceRow
            key={row.key}
            title={row.label}
            tooltip={row.tooltip}
            status={{ label: row.status, tone: row.tone }}
            value={row.configured}
            valueVariant="grade"
            secondaryValue={row.total}
            secondaryValueVariant="grade"
            valuesUnavailable={!row.collected}
            tone={row.tone}
        />)}
    </StatusEvidenceList>
}

export const KubernetesResourceConfigurationCard = ({
    coverage,
    icon = <DnsIcon />,
    title = '리소스 요청량 및 제한량',
    description = '활성 파드 컨테이너의 요청량·제한량 설정 현황입니다.',
    descriptionTooltip = '활성 파드를 UID로 중복 제거하고 종료 파드를 제외합니다. 설정 비율에는 고유 일반 컨테이너와 initContainer를 포함하며, 설정 합계는 Kubernetes 스케줄링 기준에 따라 일반 컨테이너 합계와 initContainer 최댓값 중 큰 값을 파드별로 합산합니다.'
}: KubernetesResourceConfigurationCardProps) => {
    return <DetailSectionCard
        icon={icon}
        title={title}
        description={description}
        descriptionTooltip={descriptionTooltip}>
        <KubernetesResourceConfigurationRows coverage={coverage} mode="aggregate" />
    </DetailSectionCard>
}
