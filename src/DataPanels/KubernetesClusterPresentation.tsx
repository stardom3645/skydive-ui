import * as React from 'react'
import { Badge, Button, Card, Collapse, Progress, Space, Statistic, Modal, Tag, Typography } from 'antd'
import { RightOutlined } from '@ant-design/icons'
import { isKubernetesUnavailableValue } from './common/KubernetesDataPresentation'
import {
    CollapsibleSummaryRowProps, DetailMetricRowProps, DetailOperationalSummaryProps,
    StatusEvidenceRowProps, DetailInfoTooltip
} from './common/DetailComponents'

const status = (tone?: string): 'success' | 'warning' | 'error' | 'default' =>
    tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : tone === 'danger' ? 'error' : 'default'
const color = (tone?: string) => tone === 'danger' ? 'error' : tone === 'info' ? 'processing' : tone === 'default' ? undefined : tone

export const ClusterOperationalSection = ({ title, action, children, grid = false, className = '' }: {
    title?: React.ReactNode, action?: React.ReactNode, children: React.ReactNode, grid?: boolean, className?: string
}) => <Card size="small" className={`netdive-cluster-ant-operational-section ${className}`}
    title={title && <Typography.Text strong className="netdive-cluster-ant-operational-title">{title}</Typography.Text>}
    extra={action} styles={{ body: { padding: grid ? 0 : 12 } }}>
    {children}
</Card>

/** Cluster-only presentation keeps other resource panels' behavior intact. */
export const ClusterOperationalSummary = (props: DetailOperationalSummaryProps & { verdictDetails?: React.ReactNode }) => {
    const label = (text: React.ReactNode, tooltip?: React.ReactNode) => <span className="netdive-cluster-ant-summary-label">
        <span>{text}</span><DetailInfoTooltip description={tooltip} ariaLabel={`${String(text)} 상세 정보`} />
    </span>
    return <div className="netdive-cluster-ant-summary">
        <ClusterOperationalSection title={props.summaryTitle} action={props.verdictDetails} grid className="netdive-cluster-ant-summary-status">
            {[
                { label: props.verdictLabel || 'Netdive 판정', value: <Badge status={status(props.verdictTone)} text={props.verdict} />, tooltip: props.verdictTooltip || props.tooltip },
                { label: props.rawStatusLabel || 'Kubernetes/API 원본 상태', value: props.rawStatus, tooltip: props.rawStatusTooltip },
                { label: props.impactLabel || '현재 영향', value: props.impact, tooltip: props.impactTooltip }
            ].map((item, index) => <div key={index} className={`netdive-cluster-ant-summary-state ${index === 2 ? 'is-impact' : ''}`}>
                <Typography.Text type="secondary" className="netdive-cluster-ant-summary-label">{label(item.label, item.tooltip)}</Typography.Text>
                <div className="netdive-cluster-ant-summary-value">{item.value}</div>
            </div>)}
        </ClusterOperationalSection>
        <ClusterOperationalSection title={props.metricsTitle} grid>
            {(props.metrics || []).filter(item => item.visible !== false).map((item, index, items) =>
                <Card.Grid key={item.key || index} hoverable={false}
                    style={{ width: items.length === 1 ? '100%' : '50%' }} className="netdive-cluster-ant-summary-metric">
                    <Statistic className={isKubernetesUnavailableValue(item.value) ? 'is-unavailable' : undefined}
                        title={label(item.label, item.tooltip)} value={0}
                        formatter={() => item.onClick ? <Button type="link" size="small" onClick={item.onClick}>
                            {item.value}
                        </Button> : item.value} />
                </Card.Grid>)}
        </ClusterOperationalSection>
    </div>
}

export const ClusterMetricRow = (props: DetailMetricRowProps) => <div className={`netdive-cluster-ant-metric ${props.primary ? 'is-primary' : ''} ${props.unavailable ? 'is-unavailable' : ''} ${props.className || ''}`}>
    <div className="netdive-cluster-ant-metric-heading">
        <Typography.Text type="secondary">{props.label}</Typography.Text>
        <Space size={8}>
            {!props.primary && <Typography.Text>{props.value}</Typography.Text>}
            <Typography.Text type="secondary">{props.ratio}</Typography.Text>
        </Space>
    </div>
    {props.primary && <Statistic value={0} formatter={() => props.onClick
        ? <Button type="link" size="small" onClick={props.onClick}>{props.value}</Button>
        : props.value} />}
    {props.progressPercent !== undefined && <Progress size="small" percent={props.progressPercent}
        showInfo={false} strokeColor={props.progressColor} railColor={props.progressTrailColor} />}
</div>

export const ClusterCollapsibleSummary = (props: CollapsibleSummaryRowProps) => <Collapse
    size="small" className={`netdive-cluster-ant-collapse ${props.className || ''}`}
    activeKey={props.expanded ? ['details'] : []} expandIconPlacement="end"
    onChange={() => props.onToggle()}
    items={[{ key: 'details', label: props.title, extra: props.summary, children: props.children }]} />

export const ClusterVerdictCriteria = ({ verdict, tone, reasons, collected, missing }: {
    verdict: string; tone: string; reasons: string[]; collected: string[]; missing: string[]
}) => {
    const [open, setOpen] = React.useState(false)
    return <>
        <Button type="link" size="small" className="netdive-cluster-verdict-criteria-trigger" onClick={() => setOpen(true)}>판정 기준</Button>
        <Modal title="Netdive 클러스터 판정 기준" open={open} onCancel={() => setOpen(false)} width={620} destroyOnHidden
            className="netdive-cluster-verdict-criteria" footer={<Button onClick={() => setOpen(false)}>닫기</Button>}>
            <div className="netdive-cluster-verdict-current">
                <Typography.Text strong>현재 판정</Typography.Text><Tag color={color(tone)}>{verdict}</Tag>
                <ul>{(reasons.length ? reasons : tone === 'default' ? ['운영 상태를 판정할 수집 데이터가 없습니다.'] : ['수집된 자원에서 현재 가용성 이상이 확인되지 않았습니다.']).map(reason => <li key={reason}>{reason}</li>)}</ul>
            </div>
            <Typography.Paragraph>현재 Node·Control Plane의 Ready 상태, 활성 Pod, 워크로드 가용 Replica와 서비스 영향을 종합합니다. 최근 이력과 구성 위험은 각각의 영역에서 평가합니다.</Typography.Paragraph>
            <div className="netdive-cluster-verdict-rules">
                <div><Tag color="error">심각</Tag><span>Ready가 아닌 Node·Control Plane, Unknown Pod, 가용 Replica 부족 또는 서비스 영향이 확인된 경우</span></div>
                <div><Tag color="warning">주의</Tag><span>위의 가용성 저하 없이 활성 문제 Pod 등 현재 운영 경보가 확인된 경우</span></div>
                <div><Tag color="success">정상</Tag><span>수집된 자원에서 현재 가용성 이상이나 운영 경보가 확인되지 않은 경우</span></div>
                <div><Tag>미확인</Tag><span>확인 가능한 Node·Control Plane·활성 Pod 상태가 없는 경우</span></div>
            </div>
            <Typography.Text strong>확인한 데이터 수집 범위</Typography.Text>
            <Typography.Paragraph>{collected.length ? collected.join(' · ') : '확인된 수집 데이터가 없습니다.'}</Typography.Paragraph>
            {missing.length > 0 && <Typography.Paragraph type="secondary">미수집 또는 부분 수집: {missing.join(' · ')}. 확인된 데이터 범위의 판정입니다.</Typography.Paragraph>}
            <Typography.Paragraph type="secondary">Succeeded·Completed와 과거 종료 이력은 현재 장애 대상에서 제외하며, 구조적 위험 점수는 현재 운영 판정과 별도로 제공합니다.</Typography.Paragraph>
        </Modal>
    </>
}

/** Row descriptors keep the existing counts, evaluation and navigation handlers. */
export const ClusterEvidenceRow = (_props: StatusEvidenceRowProps) => null

export const ClusterEvidenceTable = ({ children, columnHeaders }: {
    children: React.ReactNode
    columnHeaders?: { state?: React.ReactNode, value?: React.ReactNode, action?: boolean }
}) => {
    const rows = React.Children.toArray(children).filter(React.isValidElement)
        .map((child: React.ReactElement<StatusEvidenceRowProps>, index) => ({ key: index, ...child.props }))
    return <div className="netdive-cluster-ant-evidence" role="list">
        {rows.map(row => <div key={row.key} className="netdive-cluster-ant-evidence-row" role="listitem">
            <div className="netdive-cluster-ant-evidence-heading">
                <div className="netdive-cluster-ant-evidence-title"><Typography.Text strong>{row.title}</Typography.Text>
                    <DetailInfoTooltip description={row.tooltip} detail={row.tooltipDetail} rawValue={row.tooltipRawValue} />
                </div>
                {row.status ? <Tag color={color(row.status.tone || row.tone)}>{row.status.label}</Tag> : row.state}
                {!row.hideValue && (row.valueVariant !== 'grade' || row.onClick) && <div className="netdive-cluster-ant-evidence-result">
                    {row.onClick ? <Button type="link" size="small" onClick={row.onClick}
                        aria-label={`${typeof row.title === 'string' ? row.title : '평가'} 관련 자원 보기`}>
                        {row.valueVariant === 'grade' ? '관련 자원' : row.value}<RightOutlined />
                    </Button> : <Typography.Text>{row.valuesUnavailable ? '확인 불가' : row.value}</Typography.Text>}
                </div>}
            </div>
            {row.evidence && <Typography.Paragraph type="secondary" className="netdive-cluster-ant-evidence-description">{row.evidence}</Typography.Paragraph>}
        </div>)}
    </div>
}
