import * as React from 'react'
import { Button, Card, Empty, Tag, Tooltip, Typography } from 'antd'
import { CopyOutlined, DownOutlined, RightOutlined } from '@ant-design/icons'

import './DetailComponents.css'

const joinClassNames = (...classNames: Array<string | undefined | false>) => classNames.filter(Boolean).join(' ')

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

export interface DetailResourceCardProps {
    label: React.ReactNode
    value: React.ReactNode
    icon?: React.ReactNode
    description?: React.ReactNode
    interactive?: boolean
    onClick?: () => void
    iconTone?: DetailResourceIconTone
    className?: string
}

export type DetailResourceIconTone = 'host' | 'user-vm' | 'system-vm' | 'router' | 'network' | 'interface' | 'bridge' | 'switch' | 'kubernetes'

export const DetailResourceCard = ({
    label,
    value,
    icon,
    description,
    interactive = false,
    onClick,
    iconTone,
    className
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
                <Tooltip title={typeof label === 'string' ? label : undefined} placement="top">
                    <Typography.Text className="netdive-detail-resource__label">{label}</Typography.Text>
                </Tooltip>
                {description && <Typography.Text className="netdive-detail-resource__description">{description}</Typography.Text>}
            </span>
        </span>
        <Typography.Text className="netdive-detail-resource__value">{value}</Typography.Text>
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
