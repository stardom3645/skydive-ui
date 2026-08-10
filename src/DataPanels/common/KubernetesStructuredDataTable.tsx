import * as React from 'react'
import { Button, Collapse, Divider, Table, Typography } from 'antd'
import { DownOutlined, RightOutlined } from '@ant-design/icons'

import { DetailCopyButton, DetailEmpty } from './DetailComponents'
import { toggleKubernetesStructuredExpandedKey } from './KubernetesStructuredDataState'

export interface KubernetesStructuredDataRow {
    id: string
    keyLabel: React.ReactNode
    keySecondary?: React.ReactNode
    operator?: React.ReactNode
    value: React.ReactNode
    copyValue?: string
    copyTooltip?: React.ReactNode
    expandedValue?: string
}

export interface KubernetesStructuredDataTableProps {
    rows: KubernetesStructuredDataRow[]
    keyTitle?: React.ReactNode
    operatorTitle?: React.ReactNode
    valueTitle: React.ReactNode
    actionTitle?: React.ReactNode
    emptyText: React.ReactNode
    columnWidths?: {
        key?: string | number
        operator?: string | number
        action?: string | number
    }
}

/** Mold-standard compact Ant Table for metadata and selector key/value rows. */
export const KubernetesStructuredDataTable = ({
    rows,
    keyTitle = '키',
    operatorTitle,
    valueTitle,
    actionTitle = '',
    emptyText,
    columnWidths
}: KubernetesStructuredDataTableProps) => {
    const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>([])
    const hasExpandableRows = rows.some(row => !!row.expandedValue)
    const rowIdentity = rows.map(row => row.id).join('\u0001')
    React.useEffect(() => {
        const available = new Set(rows.map(row => row.id))
        setExpandedKeys(current => current.filter(key => available.has(String(key))))
    }, [rowIdentity])
    if (!rows.length) return <DetailEmpty description={emptyText} compact className="netdive-k8s-structured-table__empty" />
    const toggle = (row: KubernetesStructuredDataRow) => {
        if (!row.expandedValue) return
        setExpandedKeys(current => toggleKubernetesStructuredExpandedKey(current, row.id))
    }
    const columns: any[] = [
        {
            title: keyTitle,
            key: 'key',
            width: columnWidths?.key || (operatorTitle ? '38%' : '42%'),
            render: (_value: any, row: KubernetesStructuredDataRow) => <span className="netdive-k8s-structured-table__key">
                <Typography.Text strong>{row.keyLabel}</Typography.Text>
                {row.keySecondary && <Typography.Text type="secondary">{row.keySecondary}</Typography.Text>}
            </span>
        },
        ...(operatorTitle ? [{
            title: operatorTitle,
            key: 'operator',
            width: columnWidths?.operator || '17%',
            render: (_value: any, row: KubernetesStructuredDataRow) => <Typography.Text>{row.operator || '–'}</Typography.Text>
        }] : []),
        {
            title: valueTitle,
            key: 'value',
            render: (_value: any, row: KubernetesStructuredDataRow) => <Typography.Text className="netdive-k8s-structured-table__value">{row.value}</Typography.Text>
        },
        {
            title: actionTitle,
            key: 'actions',
            // Includes the Table cell padding so one or two 24px actions are
            // never clipped by the common modal's fixed-layout table.
            width: columnWidths?.action || (hasExpandableRows ? 72 : 44),
            align: 'right' as const,
            render: (_value: any, row: KubernetesStructuredDataRow) => <span className="netdive-k8s-structured-table__actions">
                {row.copyValue !== undefined && <DetailCopyButton value={row.copyValue} tooltip={row.copyTooltip || '행 전체 복사'} />}
                {row.expandedValue && <Button
                    type="text"
                    size="small"
                    icon={expandedKeys.indexOf(row.id) >= 0 ? <DownOutlined /> : <RightOutlined />}
                    aria-label={expandedKeys.indexOf(row.id) >= 0 ? '값 접기' : '값 펼치기'}
                    onClick={event => { event.stopPropagation(); toggle(row) }} />}
            </span>
        }
    ]
    return <Table<KubernetesStructuredDataRow>
        className="netdive-modal-table netdive-k8s-structured-table"
        columns={columns}
        dataSource={rows}
        rowKey="id"
        childrenColumnName="__netdiveNoTreeChildren"
        pagination={false}
        size="small"
        tableLayout="fixed"
        onRow={row => ({
            className: row.expandedValue ? 'is-expandable' : '',
            onClick: () => toggle(row)
        })}
        expandable={{
            expandedRowKeys: expandedKeys,
            expandIcon: () => null,
            expandIconColumnIndex: -1,
            expandedRowRender: row => row.expandedValue
                ? <pre className="netdive-k8s-common-modal__code">{row.expandedValue}</pre>
                : null
        }}
    />
}

export interface KubernetesRawJsonCollapseProps {
    value: string
    copyTooltip?: React.ReactNode
    title?: React.ReactNode
}

export const KubernetesRawJsonCollapse = ({
    value,
    copyTooltip = '원본 JSON 복사',
    title = '원본 JSON 보기'
}: KubernetesRawJsonCollapseProps) => {
    const [open, setOpen] = React.useState(false)
    return <section className="netdive-k8s-modal-section netdive-k8s-modal-section--raw">
        <Divider />
        <Collapse
            bordered={false}
            className="netdive-k8s-raw-json-collapse"
            activeKey={open ? ['raw'] : []}
            onChange={keys => setOpen((Array.isArray(keys) ? keys : [keys]).indexOf('raw') >= 0)}
            expandIconPosition="right"
            destroyInactivePanel>
            <Collapse.Panel
                header={<Typography.Text strong>{title}</Typography.Text>}
                extra={<DetailCopyButton value={value} tooltip={copyTooltip} />}
                key="raw">
                <pre className="netdive-k8s-common-modal__code">{value}</pre>
            </Collapse.Panel>
        </Collapse>
    </section>
}

export interface KubernetesModalResourceContextProps {
    resourceKind: React.ReactNode
    resourceName: string
    copyTooltip?: React.ReactNode
    contextLabel?: React.ReactNode
    contextValue?: string
    contextCopyTooltip?: React.ReactNode
    variant?: 'resource' | 'subject'
}

export const KubernetesModalResourceContext = ({
    resourceKind,
    resourceName,
    copyTooltip = '자원명 복사',
    contextLabel,
    contextValue,
    contextCopyTooltip = '컨텍스트 값 복사',
    variant = 'resource'
}: KubernetesModalResourceContextProps) => {
    const nameRow = <div className="netdive-k8s-modal-resource-context__name-row">
        <Typography.Text className="netdive-k8s-modal-resource-context__name">{resourceName}</Typography.Text>
        <DetailCopyButton value={resourceName} tooltip={copyTooltip} />
    </div>
    const kind = <Typography.Text strong className="netdive-k8s-modal-resource-context__kind">{resourceKind}</Typography.Text>
    return <div className={`netdive-k8s-modal-resource-context is-${variant}`}>
        {variant === 'subject' ? <React.Fragment>{nameRow}{kind}</React.Fragment> : <React.Fragment>{kind}{nameRow}</React.Fragment>}
        {contextValue && <div className="netdive-k8s-modal-resource-context__supporting-row">
            {contextLabel && <Typography.Text type="secondary" className="netdive-k8s-modal-resource-context__supporting-label">{contextLabel}</Typography.Text>}
            <div className="netdive-k8s-modal-resource-context__supporting-name-row">
                <Typography.Text type="secondary" className="netdive-k8s-modal-resource-context__supporting-value">{contextValue}</Typography.Text>
                <DetailCopyButton value={contextValue} tooltip={contextCopyTooltip} />
            </div>
        </div>}
    </div>
}

export interface KubernetesModalSectionProps {
    title: React.ReactNode
    description?: React.ReactNode
    children: React.ReactNode
}

export const KubernetesModalSection = ({ title, description, children }: KubernetesModalSectionProps) => <section className="netdive-k8s-modal-section">
    <Divider />
    <div className="netdive-k8s-modal-section__heading">
        <Typography.Text strong className="netdive-k8s-modal-section__title">{title}</Typography.Text>
        {description && <Typography.Text type="secondary" className="netdive-k8s-modal-section__description">{description}</Typography.Text>}
    </div>
    {children}
</section>
