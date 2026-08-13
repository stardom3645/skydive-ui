import * as React from 'react'

import { translate } from '../../Config'
import { DetailBadge, DetailBadgeTone, DetailInfoTooltip } from './DetailComponents'
import './KubernetesAnalysisConfidence.css'

export type KubernetesAnalysisConfidenceState = 'sufficient' | 'partial' | 'insufficient' | 'unavailable'

interface Props {
    state: KubernetesAnalysisConfidenceState
    collected: string[]
    missing: string[]
    contextNote?: React.ReactNode
}

const STATE_META: Record<KubernetesAnalysisConfidenceState, { labelKey: string, summaryKey: string, tone: DetailBadgeTone }> = {
    sufficient: { labelKey: 'kubernetesConfidenceSufficient', summaryKey: 'kubernetesConfidenceSufficientSummary', tone: 'success' },
    partial: { labelKey: 'kubernetesConfidencePartial', summaryKey: 'kubernetesConfidencePartialSummary', tone: 'warning' },
    insufficient: { labelKey: 'kubernetesConfidenceInsufficient', summaryKey: 'kubernetesConfidenceInsufficientSummary', tone: 'danger' },
    unavailable: { labelKey: 'kubernetesConfidenceUnavailable', summaryKey: 'kubernetesConfidenceUnavailableSummary', tone: 'default' }
}

const CriteriaTooltip = ({ contextNote }: { contextNote?: React.ReactNode }) => <div className="netdive-k8s-confidence-tooltip">
    <strong>{translate('kubernetesAnalysisConfidence')}</strong>
    <p>{translate('kubernetesConfidenceDefinition')}</p>
    {contextNote && <p>{contextNote}</p>}
    {(['sufficient', 'partial', 'insufficient', 'unavailable'] as KubernetesAnalysisConfidenceState[]).map(state => <div key={state}>
        <b>{translate(STATE_META[state].labelKey)}</b>
        <span>{translate(`kubernetesConfidence${state.charAt(0).toUpperCase()}${state.slice(1)}Description`)}</span>
    </div>)}
</div>

export const KubernetesAnalysisConfidence = ({ state, collected, missing, contextNote }: Props) => {
    const meta = STATE_META[state]
    const label = translate(meta.labelKey)
    const evidence = <div className="netdive-k8s-confidence-tooltip netdive-k8s-confidence-tooltip--evidence">
        <strong>{translate('kubernetesConfidenceCurrent').replace('{state}', label)}</strong>
        {collected.length > 0 && <div><b>{translate('kubernetesConfidenceCollectedData')}</b><ul>{collected.map(item => <li key={item}>{item}</li>)}</ul></div>}
        {missing.length > 0
            ? <div><b>{translate('kubernetesConfidenceMissingData')}</b><ul>{missing.map(item => <li key={item}>{item}</li>)}</ul></div>
            : <p>{translate('kubernetesConfidenceNoMissingData')}</p>}
        {contextNote && <div><b>기간별 분석</b><span>{contextNote}</span></div>}
    </div>
    return <div className="netdive-k8s-confidence">
        <div className="netdive-k8s-confidence__label">
            <span>{translate('kubernetesAnalysisConfidence')}</span>
            <DetailInfoTooltip description={<CriteriaTooltip contextNote={contextNote} />} ariaLabel="분석 신뢰도 기준 정보" />
        </div>
        <div className="netdive-k8s-confidence__result">
            <span><DetailBadge tone={meta.tone}><i />{label}</DetailBadge><DetailInfoTooltip description={evidence} ariaLabel="현재 분석 신뢰도 정보" /></span>
            <small>{translate(meta.summaryKey)}</small>
        </div>
    </div>
}
