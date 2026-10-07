import * as React from 'react'
import { Badge, Button, Card, Collapse, Progress, Space, Statistic, Table, Tag, Typography } from 'antd'
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
export const ClusterOperationalSummary = (props: DetailOperationalSummaryProps) => {
    const label = (text: React.ReactNode, tooltip?: React.ReactNode) => <span className="netdive-cluster-ant-summary-label">
        <span>{text}</span><DetailInfoTooltip description={tooltip} ariaLabel={`${String(text)} 상세 정보`} />
    </span>
    return <div className="netdive-cluster-ant-summary">
        <ClusterOperationalSection title={props.summaryTitle} grid className="netdive-cluster-ant-summary-status">
            {[
                { label: props.verdictLabel || 'Netdive 판정', value: <Badge status={status(props.verdictTone)} text={props.verdict} />, tooltip: props.verdictTooltip || props.tooltip },
                { label: props.rawStatusLabel || 'Kubernetes/API 원본 상태', value: props.rawStatus, tooltip: props.rawStatusTooltip },
                { label: props.impactLabel || '현재 영향', value: props.impact, tooltip: props.impactTooltip }
            ].map((item, index) => <Card.Grid key={index} hoverable={false}
                style={{ width: index === 2 ? '100%' : '50%' }} className="netdive-cluster-ant-summary-state">
                <Statistic className={isKubernetesUnavailableValue(item.value) ? 'is-unavailable' : undefined}
                    title={label(item.label, item.tooltip)} value={0} formatter={() => item.value} />
            </Card.Grid>)}
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

/** Row descriptors are rendered by the native Ant table below. */
export const ClusterEvidenceRow = (_props: StatusEvidenceRowProps) => null

export const ClusterEvidenceTable = ({ children, columnHeaders }: {
    children: React.ReactNode
    columnHeaders?: { state?: React.ReactNode, value?: React.ReactNode, action?: boolean }
}) => {
    const rows = React.Children.toArray(children).filter(React.isValidElement)
        .map((child: React.ReactElement<StatusEvidenceRowProps>, index) => ({ key: index, ...child.props }))
    const evaluation = (row: StatusEvidenceRowProps) => <span className="netdive-cluster-ant-evidence-value-content">
        <span className="netdive-cluster-ant-evidence-value-text">{!row.onClick && row.valuesUnavailable ? '확인 불가' : row.value}</span>
        <span className="netdive-cluster-ant-evidence-value-action" aria-hidden="true">{row.onClick && <RightOutlined />}</span>
    </span>
    return <Table size="small" pagination={false} tableLayout="fixed" className="netdive-cluster-ant-evidence"
        rowClassName={row => row.onClick ? 'is-interactive' : ''}
        onRow={row => ({ onClick: event => {
            if (!(event.target as Element).closest('button')) row.onClick?.()
        } })}
        dataSource={rows} columns={[
            { key: 'title', title: '', render: (_, row) => <Space orientation="vertical" size={2}>
                <div className="netdive-cluster-ant-evidence-title"><Typography.Text>{row.title}</Typography.Text>
                    <DetailInfoTooltip description={row.tooltip} detail={row.tooltipDetail} rawValue={row.tooltipRawValue} />
                </div>
                {row.evidence && <Typography.Text type="secondary">{row.evidence}</Typography.Text>}
            </Space> },
            { key: 'state', title: columnHeaders?.state || '상태', width: 82, align: 'center',
                render: (_, row) => row.status ? <Tag color={color(row.status.tone || row.tone)}>{row.status.label}</Tag> : row.state },
            { key: 'value', title: <span className="netdive-cluster-ant-evidence-value-heading">{columnHeaders?.value || '평가'}</span>, width: 100, align: 'right',
                render: (_, row) => row.hideValue ? null : row.onClick ? <Button type="link" size="small" block
                    className="netdive-cluster-ant-evidence-value" onClick={row.onClick}>
                    {evaluation(row)}
                </Button> : <span className="netdive-cluster-ant-evidence-value">{evaluation(row)}</span> }
        ]} />
}
