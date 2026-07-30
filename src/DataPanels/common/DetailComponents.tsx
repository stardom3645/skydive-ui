import * as React from 'react'
import { Button, Card, Empty, Tag, Tooltip, Typography } from 'antd'
import { CopyOutlined, DownOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons'

import './DetailComponents.css'

const joinClassNames = (...classNames: Array<string | undefined | false>) => classNames.filter(Boolean).join(' ')
const copyTextToClipboard = (value: string) => {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    if (clipboard && clipboard.writeText) clipboard.writeText(value)
}

export interface DetailSectionProps {
    icon?: React.ReactNode
    title: React.ReactNode
    description?: React.ReactNode
    action?: React.ReactNode
    children: React.ReactNode
    className?: string
    bodyClassName?: string
    collapsible?: boolean
    collapsed?: boolean
    onToggle?: () => void
}

export const DetailSection = ({
    icon,
    title,
    description,
    action,
    children,
    className,
    bodyClassName,
    collapsible = false,
    collapsed = false,
    onToggle
}: DetailSectionProps) => {
    const toggle = (event?: React.SyntheticEvent<HTMLElement>) => {
        if (event) {
            event.preventDefault()
            event.stopPropagation()
        }
        if (collapsible && onToggle) onToggle()
    }

    const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!collapsible || (event.key !== 'Enter' && event.key !== ' ')) return
        toggle(event)
    }

    const header = (
        <div
            className={joinClassNames('netdive-detail-section__header', collapsible && 'netdive-detail-section__header--collapsible')}
            onClick={collapsible ? toggle : undefined}
            onKeyDown={handleHeaderKeyDown}
            role={collapsible ? 'button' : undefined}
            tabIndex={collapsible ? 0 : undefined}
            aria-expanded={collapsible ? !collapsed : undefined}>
            <div className="netdive-detail-section__heading">
                {icon && <span className="netdive-detail-section__icon">{icon}</span>}
                <div className="netdive-detail-section__title-block">
                    <Typography.Text className="netdive-detail-section__title">{title}</Typography.Text>
                    {description && (
                        <Typography.Text className="netdive-detail-section__description">
                            {description}
                        </Typography.Text>
                    )}
                </div>
            </div>
            {(action || collapsible) && (
                <div className="netdive-detail-section__actions" onClick={event => event.stopPropagation()}>
                    {action}
                    {collapsible && (
                        <Button
                            type="text"
                            size="small"
                            className="netdive-detail-section__toggle"
                            icon={collapsed ? <RightOutlined /> : <DownOutlined />}
                            aria-label={collapsed ? 'Expand section' : 'Collapse section'}
                            onClick={toggle}
                        />
                    )}
                </div>
            )}
        </div>
    )

    return (
        <Card
            bordered
            className={joinClassNames('netdive-detail-section', className)}
            title={header}
            bodyStyle={{ padding: 0 }}>
            {!collapsed && (
                <div className={joinClassNames('netdive-detail-section__body', bodyClassName)}>
                    {children}
                </div>
            )}
        </Card>
    )
}

export interface DetailCopyButtonProps {
    value: string
    tooltip?: React.ReactNode
    onCopy?: (value: string) => void
    className?: string
}

export const DetailCopyButton = ({ value, tooltip = 'Copy', onCopy, className }: DetailCopyButtonProps) => {
    const copy = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault()
        event.stopPropagation()
        if (onCopy) {
            onCopy(value)
            return
        }
        const clipboard = navigator && navigator.clipboard
        if (clipboard && clipboard.writeText) clipboard.writeText(value)
    }

    return (
        <Tooltip title={tooltip} placement="top">
            <Button
                type="text"
                size="small"
                className={joinClassNames('netdive-detail-copy', className)}
                icon={<CopyOutlined />}
                aria-label={typeof tooltip === 'string' ? tooltip : 'Copy'}
                onClick={copy}
            />
        </Tooltip>
    )
}

export interface DetailKeyValueRow {
    key?: React.Key
    label: React.ReactNode
    value: React.ReactNode
    textValue?: string
    copyText?: string
    tooltip?: React.ReactNode
}

export interface DetailKeyValueListProps {
    rows: DetailKeyValueRow[]
    emptyText?: React.ReactNode
    labelWidth?: number | string
    copyTooltip?: React.ReactNode
    onCopy?: (value: string) => void
    className?: string
}

export const DetailKeyValueList = ({
    rows,
    emptyText = '-',
    labelWidth = 116,
    copyTooltip,
    onCopy,
    className
}: DetailKeyValueListProps) => {
    if (!rows.length) return <DetailEmpty description={emptyText} compact />
    const labelColumn = typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth

    return (
        <div className={joinClassNames('netdive-detail-kv', className)}>
            {rows.map((row, index) => {
                const value = row.tooltip || row.textValue
                    ? <Tooltip title={row.tooltip || row.textValue} placement="top"><span className="netdive-detail-kv__value-text">{row.value}</span></Tooltip>
                    : <span className="netdive-detail-kv__value-text">{row.value}</span>
                return (
                    <div
                        className="netdive-detail-kv__row"
                        key={row.key !== undefined ? row.key : index}
                        style={{ gridTemplateColumns: `${labelColumn} minmax(0, 1fr)` }}>
                        <Typography.Text className="netdive-detail-kv__label">{row.label}</Typography.Text>
                        <div className="netdive-detail-kv__value">
                            {value}
                            {row.copyText && (
                                <DetailCopyButton
                                    value={row.copyText}
                                    tooltip={copyTooltip}
                                    onCopy={onCopy}
                                />
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export type DetailBadgeTone = 'default' | 'info' | 'success' | 'warning' | 'danger'

export interface DetailBadgeProps {
    children: React.ReactNode
    tone?: DetailBadgeTone
    className?: string
}

export const DetailBadge = ({ children, tone = 'default', className }: DetailBadgeProps) => (
    <Tag className={joinClassNames('netdive-detail-badge', `netdive-detail-badge--${tone}`, className)}>
        {children}
    </Tag>
)

export interface DetailOperationalMetric {
    key?: React.Key
    label: React.ReactNode
    value: React.ReactNode
    tooltip?: React.ReactNode
    tone?: DetailBadgeTone
    onClick?: () => void
}

export interface DetailOperationalSummaryProps {
    verdict: React.ReactNode
    verdictTone?: DetailBadgeTone
    rawStatus: React.ReactNode
    impact: React.ReactNode
    verdictLabel?: React.ReactNode
    rawStatusLabel?: React.ReactNode
    impactLabel?: React.ReactNode
    tooltip?: React.ReactNode
    verdictTooltip?: React.ReactNode
    rawStatusTooltip?: React.ReactNode
    impactTooltip?: React.ReactNode
    metrics?: DetailOperationalMetric[]
    className?: string
}

export const KUBERNETES_DETAIL_LABELS = Object.freeze({
    verdict: 'Netdive 판정',
    rawStatus: 'Kubernetes/API 원본 상태',
    impact: '현재 영향',
    affectedServices: '영향받은 서비스',
    pod: '파드',
    workloadController: '워크로드 컨트롤러'
})

export const KUBERNETES_UTILIZATION_THRESHOLDS = Object.freeze({
    warning: 75,
    danger: 90
})

/**
 * Shared Kubernetes operational status header.
 *
 * Netdive's interpreted verdict, the Kubernetes/API raw status, and the
 * currently observed impact are deliberately rendered as separate fields so
 * structural risk or historical events cannot be mistaken for a live outage.
 */
export const DetailOperationalSummary = ({
    verdict,
    verdictTone = 'default',
    rawStatus,
    impact,
    verdictLabel = KUBERNETES_DETAIL_LABELS.verdict,
    rawStatusLabel = KUBERNETES_DETAIL_LABELS.rawStatus,
    impactLabel = KUBERNETES_DETAIL_LABELS.impact,
    tooltip,
    verdictTooltip,
    rawStatusTooltip,
    impactTooltip,
    metrics = [],
    className
}: DetailOperationalSummaryProps) => {
    const stateLabel = (label: React.ReactNode, stateTooltip?: React.ReactNode) => (
        <span className="netdive-operational-summary__label">
            {label}
            {stateTooltip && <Tooltip title={stateTooltip} placement="top"><InfoCircleOutlined className="netdive-operational-summary__info" /></Tooltip>}
        </span>
    )
    const content = (
        <div className={joinClassNames('netdive-operational-summary', className)}>
            <div className="netdive-operational-summary__states">
                <div className="netdive-operational-summary__state netdive-operational-summary__state--verdict">
                    {stateLabel(verdictLabel, verdictTooltip)}
                    <strong className={`is-${verdictTone}`}><i />{verdict}</strong>
                </div>
                <div className="netdive-operational-summary__state">
                    {stateLabel(rawStatusLabel, rawStatusTooltip)}
                    <strong>{rawStatus}</strong>
                </div>
                <div className="netdive-operational-summary__state">
                    {stateLabel(impactLabel, impactTooltip)}
                    <strong>{impact}</strong>
                </div>
            </div>
            {metrics.length > 0 && <div className={`netdive-operational-summary__metrics items-${Math.min(4, metrics.length)}`}>
                {metrics.map((metric, index) => {
                    const metricContent = (
                        <button
                            type="button"
                            aria-disabled={!metric.onClick}
                            tabIndex={metric.onClick ? 0 : -1}
                            className={`netdive-operational-summary__metric is-${metric.tone || 'default'}`}
                            onClick={metric.onClick}>
                            <span className="netdive-operational-summary__label">
                                {metric.label}
                                {metric.tooltip && <Tooltip title={metric.tooltip} placement="top"><InfoCircleOutlined className="netdive-operational-summary__info" /></Tooltip>}
                            </span>
                            <strong>{metric.value}</strong>
                        </button>
                    )
                    return <React.Fragment key={metric.key !== undefined ? metric.key : index}>{metricContent}</React.Fragment>
                })}
            </div>}
        </div>
    )
    return tooltip ? <Tooltip title={tooltip} placement="top">{content}</Tooltip> : content
}

export interface DetailResourceCardProps {
    label: React.ReactNode
    value: React.ReactNode
    icon?: React.ReactNode
    description?: React.ReactNode
    interactive?: boolean
    onClick?: () => void
    iconTone?: DetailResourceIconTone
    className?: string
    copyText?: string
    copyTooltip?: React.ReactNode
    labelTooltip?: React.ReactNode
}

export type DetailResourceIconTone = 'host' | 'user-vm' | 'system-vm' | 'router' | 'network' | 'interface' | 'bridge' | 'switch' | 'kubernetes'

export interface DetailLayerIconProps {
    glyph: string
    className?: string
}

export const DetailLayerIcon = ({ glyph, className }: DetailLayerIconProps) => (
    <span className={joinClassNames('netdive-detail-layer-icon', 'fa', 'fas', 'fa-fw', className)} aria-hidden="true">{glyph}</span>
)

export const DetailResourceCard = ({
    label,
    value,
    icon,
    description,
    interactive = false,
    onClick,
    iconTone,
    className,
    copyText,
    copyTooltip,
    labelTooltip
}: DetailResourceCardProps) => (
    <Button
        type="text"
        block
        disabled={!interactive}
        className={joinClassNames(
            'netdive-detail-resource',
            interactive ? 'netdive-detail-resource--interactive' : 'netdive-detail-resource--static',
            className
        )}
        onClick={interactive ? onClick : undefined}>
        <span className="netdive-detail-resource__main">
            {icon && (
                <span className={joinClassNames(
                    'netdive-detail-resource__icon',
                    iconTone && `netdive-detail-resource__icon--${iconTone}`
                )}>{icon}</span>
            )}
            <span className="netdive-detail-resource__text">
                <Tooltip title={labelTooltip !== undefined ? labelTooltip : typeof label === 'string' ? label : undefined} placement="top">
                    <Typography.Text className="netdive-detail-resource__label">{label}</Typography.Text>
                </Tooltip>
                {description && <Typography.Text className="netdive-detail-resource__description">{description}</Typography.Text>}
            </span>
        </span>
        <Typography.Text className="netdive-detail-resource__value">{value}</Typography.Text>
        {copyText && <Tooltip title={copyTooltip} placement="top">
            <span
                className="netdive-detail-resource__copy"
                role="button"
                tabIndex={0}
                onClick={event => {
                    event.preventDefault()
                    event.stopPropagation()
                    copyTextToClipboard(copyText)
                }}
                onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        copyTextToClipboard(copyText)
                    }
                }}>
                <CopyOutlined />
            </span>
        </Tooltip>}
        <span className={joinClassNames('netdive-detail-resource__action', !interactive && 'netdive-detail-resource__action--hidden')}>
            <RightOutlined />
        </span>
    </Button>
)

export interface DetailResourceGridProps {
    children: React.ReactNode
    className?: string
    compact?: boolean
}

export const DetailResourceGrid = ({ children, className, compact = false }: DetailResourceGridProps) => (
    <div className={joinClassNames('netdive-detail-resource-grid', compact && 'netdive-detail-resource-grid--compact', className)}>{children}</div>
)

export interface ConnectedResourceItem {
    key?: React.Key
    label: React.ReactNode
    count: React.ReactNode
    icon?: React.ReactNode
    iconTone?: DetailResourceIconTone
    onClick?: () => void
    tooltip?: React.ReactNode
}

export interface ConnectedResourceGroup {
    key?: React.Key
    title: React.ReactNode
    icon?: React.ReactNode
    items: ConnectedResourceItem[]
    hint?: React.ReactNode
}

export interface ConnectedResourcesSectionProps {
    title: React.ReactNode
    icon?: React.ReactNode
    groups: ConnectedResourceGroup[]
    emptyText?: React.ReactNode
    className?: string
}

export const ConnectedResourcesSection = ({ title, icon, groups, emptyText = '-', className }: ConnectedResourcesSectionProps) => {
    const visibleGroups = groups.map(group => ({ ...group, items: group.items.filter(item => item.count !== undefined && item.count !== null) })).filter(group => group.items.length > 0)
    return (
        <DetailSection icon={icon} title={title} className={joinClassNames('netdive-connected-resources', className)}>
            {visibleGroups.length ? <div className="netdive-connected-resources__groups">{visibleGroups.map((group, groupIndex) => (
                <div className="netdive-connected-resources__group" key={group.key !== undefined ? group.key : groupIndex}>
                    <div className="netdive-connected-resources__group-header">
                        {group.icon && <span className="netdive-connected-resources__group-icon">{group.icon}</span>}
                        <Typography.Text className="netdive-connected-resources__group-title">{group.title}</Typography.Text>
                        {group.hint && <span className="netdive-connected-resources__group-hint">{group.hint}</span>}
                    </div>
                    <DetailResourceGrid compact>{group.items.map((item, itemIndex) => {
                        const card = <DetailResourceCard
                            key={item.key !== undefined ? item.key : itemIndex}
                            label={item.label}
                            value={item.count}
                            icon={item.icon}
                            iconTone={item.iconTone}
                            className="netdive-connected-resources__item"
                            interactive={!!item.onClick}
                            onClick={item.onClick} />
                        return item.tooltip ? <Tooltip key={item.key !== undefined ? item.key : itemIndex} title={item.tooltip} placement="top">{card}</Tooltip> : card
                    })}</DetailResourceGrid>
                </div>
            ))}</div> : <DetailEmpty description={emptyText} compact />}
        </DetailSection>
    )
}

export interface ConnectedResourceListItem {
    key?: React.Key
    kind?: React.ReactNode
    name: React.ReactNode
    description?: React.ReactNode
    icon?: React.ReactNode
    onClick?: () => void
    tooltip?: React.ReactNode
    className?: string
}

export interface ConnectedResourceListGroup {
    key?: React.Key
    title?: React.ReactNode
    icon?: React.ReactNode
    items: ConnectedResourceListItem[]
}

export interface ConnectedResourceListSectionProps {
    title: React.ReactNode
    icon?: React.ReactNode
    groups: ConnectedResourceListGroup[]
    emptyText?: React.ReactNode
    className?: string
}

export const ConnectedResourceListSection = ({ title, icon, groups, emptyText = '-', className }: ConnectedResourceListSectionProps) => {
    const visibleGroups = groups.filter(group => group.items.length > 0)
    return (
        <DetailSection icon={icon} title={title} className={joinClassNames('netdive-connected-resource-list', className)}>
            {visibleGroups.length ? <div className="netdive-connected-resource-list__groups">{visibleGroups.map((group, groupIndex) => (
                <div className="netdive-connected-resource-list__group" key={group.key !== undefined ? group.key : groupIndex}>
                    {(group.title || group.icon) && <div className="netdive-connected-resource-list__group-header">
                        {group.icon && <span className="netdive-connected-resource-list__group-icon">{group.icon}</span>}
                        <Typography.Text>{group.title}</Typography.Text>
                    </div>}
                    <div className="netdive-connected-resource-list__items">{group.items.map((item, itemIndex) => {
                        const row = (
                            <Button
                                type="text"
                                className={joinClassNames('netdive-connected-resource-list__item', item.className)}
                                onClick={item.onClick}
                                disabled={!item.onClick}>
                                {item.icon && <span className="netdive-connected-resource-list__item-icon">{item.icon}</span>}
                                <span className="netdive-connected-resource-list__item-main">
                                    {item.kind && <Typography.Text className="netdive-connected-resource-list__item-kind">{item.kind}</Typography.Text>}
                                    <Typography.Text className="netdive-connected-resource-list__item-name">{item.name}</Typography.Text>
                                    {item.description && <Typography.Text className="netdive-connected-resource-list__item-description">{item.description}</Typography.Text>}
                                </span>
                                <RightOutlined className="netdive-connected-resource-list__item-action" />
                            </Button>
                        )
                        return item.tooltip
                            ? <Tooltip key={item.key !== undefined ? item.key : itemIndex} title={item.tooltip} placement="top">{row}</Tooltip>
                            : <React.Fragment key={item.key !== undefined ? item.key : itemIndex}>{row}</React.Fragment>
                    })}</div>
                </div>
            ))}</div> : <DetailEmpty description={emptyText} compact />}
        </DetailSection>
    )
}

export interface DetailEmptyProps {
    description: React.ReactNode
    compact?: boolean
    className?: string
}

export const DetailEmpty = ({ description, compact = false, className }: DetailEmptyProps) => (
    <Empty
        className={joinClassNames('netdive-detail-empty', compact && 'netdive-detail-empty--compact', className)}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={description}
    />
)
