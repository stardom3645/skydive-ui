import * as React from 'react'
import { Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

import { translate } from '../../Config'
import { DetailBadge, DetailBadgeTone } from './DetailComponents'
import './KubernetesAnalysisConfidence.css'

export type KubernetesAnalysisConfidenceState = 'sufficient' | 'partial' | 'insufficient' | 'unavailable'

interface Props {
    state: KubernetesAnalysisConfidenceState
    collected: string[]
    missing: string[]
}

const STATE_META: Record<KubernetesAnalysisConfidenceState, { labelKey: string, summaryKey: string, tone: DetailBadgeTone }> = {
    sufficient: { labelKey: 'kubernetesConfidenceSufficient', summaryKey: 'kubernetesConfidenceSufficientSummary', tone: 'success' },
    partial: { labelKey: 'kubernetesConfidencePartial', summaryKey: 'kubernetesConfidencePartialSummary', tone: 'warning' },
    insufficient: { labelKey: 'kubernetesConfidenceInsufficient', summaryKey: 'kubernetesConfidenceInsufficientSummary', tone: 'danger' },
    unavailable: { labelKey: 'kubernetesConfidenceUnavailable', summaryKey: 'kubernetesConfidenceUnavailableSummary', tone: 'default' }
}

const CriteriaTooltip = () => <div className="netdive-k8s-confidence-tooltip">
    <strong>{translate('kubernetesAnalysisConfidence')}</strong>
    <p>{translate('kubernetesConfidenceDefinition')}</p>
    {(['sufficient', 'partial', 'insufficient', 'unavailable'] as KubernetesAnalysisConfidenceState[]).map(state => <div key={state}>
        <b>{translate(STATE_META[state].labelKey)}</b>
        <span>{translate(`kubernetesConfidence${state.charAt(0).toUpperCase()}${state.slice(1)}Description`)}</span>
    </div>)}
</div>

export const KubernetesAnalysisConfidence = ({ state, collected, missing }: Props) => {
    const meta = STATE_META[state]
    const label = translate(meta.labelKey)
    const evidence = <div className="netdive-k8s-confidence-tooltip netdive-k8s-confidence-tooltip--evidence">
        <strong>{translate('kubernetesConfidenceCurrent').replace('{state}', label)}</strong>
        {collected.length > 0 && <div><b>{translate('kubernetesConfidenceCollectedData')}</b><ul>{collected.map(item => <li key={item}>{item}</li>)}</ul></div>}
        {missing.length > 0
            ? <div><b>{translate('kubernetesConfidenceMissingData')}</b><ul>{missing.map(item => <li key={item}>{item}</li>)}</ul></div>
            : <p>{translate('kubernetesConfidenceNoMissingData')}</p>}
    </div>
    return <div className="netdive-k8s-confidence">
        <div className="netdive-k8s-confidence__label">
            <span>{translate('kubernetesAnalysisConfidence')}</span>
            <Tooltip title={<CriteriaTooltip />} placement="top"><InfoCircleOutlined /></Tooltip>
        </div>
        <div className="netdive-k8s-confidence__result">
            <Tooltip title={evidence} placement="top"><span><DetailBadge tone={meta.tone}><i />{label}</DetailBadge></span></Tooltip>
            <small>{translate(meta.summaryKey)}</small>
        </div>
    </div>
}
