import * as React from 'react'

import {
    StatusEvidenceList,
    StatusEvidenceRow
} from './DetailComponents'
import {
    kubernetesConditionPresentation,
    KubernetesConditionDefinition
} from './KubernetesConditionPresentation'

export interface KubernetesConditionRowsProps {
    conditions: any[]
    definitions?: Record<string, KubernetesConditionDefinition>
    showRawValue?: boolean
}

/** Shared Kubernetes Condition renderer. Resource panels supply only the
 * semantic True/False policy and user-facing wording for their Condition set. */
export const KubernetesConditionRows = ({ conditions, definitions = {}, showRawValue = true }: KubernetesConditionRowsProps) =>
    <StatusEvidenceList columnHeaders={{ state: '상태', value: showRawValue ? '원본 값' : undefined }}>
        {conditions.map(condition => {
            const presentation = kubernetesConditionPresentation(condition, definitions)
            return <StatusEvidenceRow
                key={presentation.key}
                title={presentation.title}
                evidence={presentation.summary}
                status={{ label: presentation.stateLabel, tone: presentation.tone }}
                value={presentation.rawStatus}
                hideValue={!showRawValue}
                valueVariant="grade"
                tone={presentation.tone}
                tooltip="Kubernetes Condition의 원본 진단 정보입니다."
                tooltipDetail={presentation.detail}
                tooltipRawValue={`type=${presentation.rawType}, status=${presentation.rawStatus}`}
            />
        })}
    </StatusEvidenceList>
