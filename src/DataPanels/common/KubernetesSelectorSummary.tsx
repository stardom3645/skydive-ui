import * as React from 'react'
import { RightOutlined } from '@ant-design/icons'

import {
    DetailInfoTooltip,
    HistoryModal
} from './DetailComponents'
import {
    KubernetesModalResourceContext,
    KubernetesModalSection,
    KubernetesRawJsonCollapse,
    KubernetesStructuredDataRow,
    KubernetesStructuredDataTable
} from './KubernetesStructuredDataTable'
import {
    KubernetesSelectorExpression,
    KubernetesSelectorMode,
    normalizeKubernetesLabelSelector,
    normalizeKubernetesSimpleSelector
} from './KubernetesSelectorPresentation'

export interface KubernetesSelectorModalProps {
    visible: boolean
    onCancel: () => void
    title: React.ReactNode
    description?: React.ReactNode
    resourceName: string
    resourceKind: string
    mode: KubernetesSelectorMode
    matchLabels?: Record<string, any>
    matchExpressions?: KubernetesSelectorExpression[] | any[]
    simpleSelector?: Record<string, any>
    rawSelector?: unknown
}

const SelectorRows = ({ rows, emptyText }: { rows: Array<{ key: string, operator: string, values: string[] }>, emptyText: React.ReactNode }) => {
    const occurrences = new Map<string, number>()
    const structuredRows: KubernetesStructuredDataRow[] = rows.map(row => {
        const baseId = `${row.key}\u0000${row.operator}\u0000${row.values.join('\u0000')}`
        const occurrence = occurrences.get(baseId) || 0
        occurrences.set(baseId, occurrence + 1)
        return {
            id: occurrence ? `${baseId}\u0000duplicate-${occurrence}` : baseId,
            keyLabel: row.key,
            operator: row.operator,
            value: row.values.length ? row.values.join(', ') : '값 없음',
            copyValue: `${row.key} ${row.operator}${row.values.length ? ` ${row.values.join(', ')}` : ''}`
        }
    })
    return <KubernetesStructuredDataTable
        rows={structuredRows}
        operatorTitle="연산자"
        valueTitle="값"
        emptyText={emptyText}
    />
}

export const KubernetesSelectorModal = ({
    visible,
    onCancel,
    title,
    description,
    resourceName,
    resourceKind,
    mode,
    matchLabels = {},
    matchExpressions = [],
    simpleSelector = {},
    rawSelector
}: KubernetesSelectorModalProps) => {
    const normalized = mode === 'simpleMap'
        ? normalizeKubernetesSimpleSelector(simpleSelector)
        : normalizeKubernetesLabelSelector({ matchLabels, matchExpressions })
    const serialized = JSON.stringify(rawSelector === undefined
        ? mode === 'simpleMap' ? simpleSelector : { matchLabels, matchExpressions }
        : rawSelector, null, 2)
    return <HistoryModal visible={visible} title={title} onCancel={onCancel} className="netdive-k8s-selector-modal">
        <KubernetesModalResourceContext resourceKind={resourceKind} resourceName={resourceName} />
        {mode === 'simpleMap' ? <KubernetesModalSection title={`단순 라벨 선택자 ${normalized.labels.length}개`} description={description || 'Service가 연결할 파드를 선택하는 라벨 기준입니다.'}>
                <SelectorRows rows={normalized.labels.map(label => ({ key: label.key, operator: '=', values: [label.value] }))} emptyText="설정된 선택자가 없습니다." />
            </KubernetesModalSection>
        : <React.Fragment>
                <KubernetesModalSection title={`라벨 선택자 ${normalized.labels.length}개`} description={description || '키와 값이 모두 일치하는 파드를 선택합니다.'}>
                    <SelectorRows rows={normalized.labels.map(label => ({ key: label.key, operator: '=', values: [label.value] }))} emptyText="설정된 라벨 선택자가 없습니다." />
                </KubernetesModalSection>
                <KubernetesModalSection title={`조건 선택자 ${normalized.expressions.length}개`} description="연산자와 값 목록으로 파드를 선택하는 추가 조건입니다.">
                    <SelectorRows rows={normalized.expressions.map(expression => ({ key: expression.key, operator: expression.operator, values: expression.values }))} emptyText="설정된 조건이 없습니다." />
                </KubernetesModalSection>
        </React.Fragment>}
        {(normalized.labels.length > 0 || normalized.expressions.length > 0) && <KubernetesRawJsonCollapse value={serialized} copyTooltip="선택자 원본 복사" title="원본 보기" />}
    </HistoryModal>
}

export interface KubernetesSelectorSummaryProps {
    selector: any
    mode?: KubernetesSelectorMode
    resourceName?: string
    resourceKind?: string
    title?: React.ReactNode
    description?: React.ReactNode
    emptyText?: React.ReactNode
}

/** Compact selector trigger backed by the shared, mode-aware selector Modal. */
export const KubernetesSelectorSummary = ({
    selector,
    mode = 'labelSelector',
    resourceName = '',
    resourceKind = 'Kubernetes 자원',
    title = '선택자',
    description,
    emptyText = '설정되지 않음'
}: KubernetesSelectorSummaryProps) => {
    const [open, setOpen] = React.useState(false)
    const normalized = mode === 'simpleMap'
        ? normalizeKubernetesSimpleSelector(selector)
        : normalizeKubernetesLabelSelector(selector)
    if (!normalized.labels.length && !normalized.expressions.length) return <span>{emptyText}</span>
    const short = normalized.labels.length === 1 && normalized.expressions.length === 0
        ? `${normalized.labels[0].key} = ${normalized.labels[0].value}` : ''
    const summary = short.length > 0 && short.length <= 48
        ? short
        : mode === 'simpleMap'
            ? `선택자 ${normalized.labels.length}개`
            : [`라벨 ${normalized.labels.length}개`, normalized.expressions.length ? `조건 ${normalized.expressions.length}개` : ''].filter(Boolean).join(' · ')
    const tooltip = description || (mode === 'simpleMap'
        ? 'Service가 연결할 파드를 라벨로 선택하는 기준입니다.'
        : '워크로드가 관리할 파드를 라벨과 조건으로 선택하는 기준입니다.')
    return <React.Fragment>
        <button type="button" className="netdive-k8s-selector-summary" onClick={() => setOpen(true)}>
            <span>{summary}<DetailInfoTooltip description={tooltip} ariaLabel="선택자 정보" /></span><RightOutlined />
        </button>
        <KubernetesSelectorModal
            visible={open}
            onCancel={() => setOpen(false)}
            title={title}
            description={description}
            resourceName={resourceName}
            resourceKind={resourceKind}
            mode={mode}
            matchLabels={mode === 'labelSelector' ? selector?.MatchLabels || selector?.matchLabels || selector : undefined}
            matchExpressions={mode === 'labelSelector' ? selector?.MatchExpressions || selector?.matchExpressions : undefined}
            simpleSelector={mode === 'simpleMap' ? selector : undefined}
            rawSelector={selector}
        />
    </React.Fragment>
}
