import * as React from 'react'
import DnsIcon from '@material-ui/icons/Dns'

import {
    DetailSectionCard,
    KUBERNETES_DETAIL_LABELS,
    StatusEvidenceList,
    StatusEvidenceRow
} from './DetailComponents'
import {
    kubernetesConfiguredResourceTotalPresentation,
    kubernetesConfigurationCoveragePresentation,
    kubernetesResourceConfigurationCollectionState,
    KubernetesCollectionState
} from './KubernetesDataPresentation'
import { formatPodCpuUsage, formatPodMemoryUsage } from './KubernetesPodUsageMetrics'

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
    descriptionMode?: 'aggregate' | 'single'
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
    descriptionMode = 'aggregate'
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
            })
        }
    })
    return <StatusEvidenceList columnHeaders={descriptionMode === 'single' ? {
        state: '상태',
        value: '설정값',
        valueTooltip: '컨테이너 ResourceList에 명시된 실제 요청량 또는 제한량입니다.'
    } : {
        state: '상태',
        value: '설정 컨테이너',
        secondaryValue: '설정 합계',
        valueTooltip: '설정 컨테이너는 해당 값이 명시된 컨테이너 수와 평가 대상 전체 컨테이너 수의 비율입니다.'
    }}>
        {rows.map(row => <StatusEvidenceRow
            key={row.key}
            title={row.label}
            tooltip={descriptionMode === 'single' ? row.tooltip.replace('활성 파드', '이 컨테이너') : row.tooltip}
            status={{ label: row.status, tone: row.tone }}
            value={descriptionMode === 'single' ? row.total : row.configured}
            valueVariant="grade"
            secondaryValue={descriptionMode === 'single' ? undefined : row.total}
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
        <KubernetesResourceConfigurationRows coverage={coverage} />
    </DetailSectionCard>
}
