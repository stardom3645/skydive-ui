import * as React from 'react'
import { Button, Modal, Tag, Typography } from 'antd'
import { InfoCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import type { DetailBadgeTone } from './DetailComponents'
import './KubernetesVerdictCriteria.css'

import { kubernetesVerdictRules } from '../../KubernetesVerdictRules'
export { kubernetesVerdictRules } from '../../KubernetesVerdictRules'

const tagColor = (tone?: DetailBadgeTone) => tone === 'danger' ? 'error' : tone === 'warning' ? 'warning'
    : tone === 'success' ? 'success' : undefined

/** One overlay shell for resource and cluster criteria. Only its body scrolls. */
export const VerdictCriteriaModal = ({ title, subtitle = '상태 판정 결과 및 기준 안내', open, onClose, children, className = '' }: {
    title: React.ReactNode; subtitle?: React.ReactNode; open: boolean; onClose: () => void; children: React.ReactNode; className?: string
}) => <Modal title={<div className="netdive-verdict-dialog__heading">
    <SafetyCertificateOutlined aria-hidden="true" />
    <div><span className="netdive-verdict-dialog__heading-title">{title}</span>
        <Typography.Text type="secondary" className="netdive-verdict-dialog__subtitle">{subtitle}</Typography.Text></div>
</div>} open={open} onCancel={onClose} width={720} centered destroyOnHidden zIndex={1500}
    className={`netdive-verdict-dialog ${className}`}
    classNames={{ container: 'netdive-verdict-dialog__surface', header: 'netdive-verdict-dialog__header',
        title: 'netdive-verdict-dialog__title', body: 'netdive-verdict-dialog__body',
        footer: 'netdive-verdict-dialog__footer', close: 'netdive-verdict-dialog__close' }}
    footer={<Button onClick={onClose}>닫기</Button>}>
    {children}
</Modal>

export const VerdictCriteriaResult = ({ items, children }: {
    items: Array<{ key: string; label: React.ReactNode; value: React.ReactNode }>; children?: React.ReactNode
}) => <section className="netdive-verdict-result" aria-label="현재 판정 결과">
    <Typography.Title level={5} className="netdive-verdict-section-title">현재 판정 결과</Typography.Title>
    <dl className="netdive-verdict-result__rows">{items.map(item => <div key={item.key} className="netdive-verdict-result__row">
        <dt>{item.label}</dt><dd>{item.value}</dd>
    </div>)}</dl>
    {children}
</section>

export const VerdictCriteriaRules = ({ rules, verdict, tone }: {
    rules: Array<{ label: string; description: React.ReactNode }>; verdict: React.ReactNode; tone?: DetailBadgeTone
}) => <section className="netdive-verdict-rule-section" aria-label="상태별 판정 기준">
    <Typography.Title level={5} className="netdive-verdict-section-title">상태별 판정 기준</Typography.Title>
    <div className="netdive-verdict-rules__heading" aria-hidden="true"><span>판정</span><span>판정 조건 및 설명</span></div>
    <dl className="netdive-verdict-rules">{rules.map(rule => {
    const current = typeof verdict === 'string' && rule.label === verdict.trim()
    return <div key={rule.label} className="netdive-verdict-rules__row" aria-current={current || undefined}>
        <dt><Tag color={current ? tagColor(tone) : undefined}>{rule.label}</Tag></dt>
        <dd>{rule.description}</dd>
    </div>
})}</dl>
</section>

export const VerdictCriteriaNote = ({ children }: { children: React.ReactNode }) =>
    <div className="netdive-verdict-note"><InfoCircleOutlined aria-hidden="true" />
        <Typography.Paragraph type="secondary">{children}</Typography.Paragraph>
    </div>

const kindLabel = (kind: string) => ({ persistentvolume: 'PV', persistentvolumeclaim: 'PVC', pod: 'Pod',
    node: 'Node', namespace: 'Namespace', service: 'Service' }[kind.toLowerCase()] || kind)

/** A verdict always has an explicit criteria action, even without a tooltip. */
export const VerdictCriteriaLabel = ({ label = 'Netdive 판정', onOpen }: {
    label?: React.ReactNode; onOpen: () => void
}) => <Button type="text" size="small" className="netdive-verdict-criteria-label" onClick={onOpen}
    aria-label="Netdive 판정 기준 보기">
    <span>{label}</span><InfoCircleOutlined aria-hidden="true" />
</Button>

/** Criteria opened by the verdict label, shared by resource panels. */
export const KubernetesVerdictCriteria = ({ kind, verdict, tone, rawStatus, impact, explanation, open: controlledOpen, onOpenChange }: {
    kind: string; verdict: React.ReactNode; tone?: DetailBadgeTone; rawStatus: React.ReactNode;
    impact: React.ReactNode; explanation?: React.ReactNode
    open?: boolean; onOpenChange?: (open: boolean) => void
}) => {
    const [internalOpen, setInternalOpen] = React.useState(false)
    const open = controlledOpen ?? internalOpen
    const setOpen = onOpenChange || setInternalOpen
    return <>
        <VerdictCriteriaModal title={`Netdive ${kindLabel(kind)} 판정 기준`} open={open} onClose={() => setOpen(false)}
            subtitle={`${kindLabel(kind)} 상태 판정 결과 및 기준 안내`}
            className="netdive-verdict-criteria">
            <VerdictCriteriaResult items={[
                { key: 'verdict', label: '현재 판정', value: <Tag color={tagColor(tone)}>{verdict}</Tag> },
                { key: 'status', label: '현재 표시 상태', value: rawStatus },
                { key: 'impact', label: '현재 영향', value: impact }
            ]} />
            {explanation && <Typography.Paragraph type="secondary" className="netdive-verdict-explanation">{explanation}</Typography.Paragraph>}
            <VerdictCriteriaRules rules={kubernetesVerdictRules(kind)} verdict={verdict} tone={tone} />
            <VerdictCriteriaNote>판정은 현재 수집된 상태를 기준으로 하며 서비스 전체의 가용성을 보장하지 않습니다. 데이터 수집 실패·미수집, 최근 불안정성과 누적 이력은 현재 장애와 구분합니다. 실제 원본 상태와 수집 범위는 상세 패널에서 확인할 수 있습니다.</VerdictCriteriaNote>
        </VerdictCriteriaModal>
    </>
}
