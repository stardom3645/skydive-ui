import * as React from 'react'
import { Button, Card, ConfigProvider, Space, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import './ResourcePresentation.css'

export const RESOURCE_PRESENTATION_COLORS = { primary: 'var(--netdive-ant-primary, #1677ff)' }

interface ResourceSectionProps {
    title: React.ReactNode
    icon?: React.ReactNode
    action?: React.ReactNode
    empty?: boolean
    children: React.ReactNode
}

export const ResourceSectionCard = ({ title, icon, action, children }: ResourceSectionProps) => (
    <ConfigProvider theme={{ token: { fontSize: 12, fontSizeSM: 11 }, components: { Card: { headerFontSizeSM: 14 } } }}>
        <Card size="small" className="netdive-ant-detail-section" title={<Space>{icon}{title}</Space>} extra={action}>{children}</Card>
    </ConfigProvider>
)

interface ResourceTileProps {
    title: React.ReactNode
    headerRight?: React.ReactNode
    children: React.ReactNode
    className?: string
}

export const ResourceMetricTile = ({ title, headerRight, children, className = '' }: ResourceTileProps) => (
    <Card size="small" className={`netdive-resource-metric ${className}`} title={title} extra={headerRight}
        styles={{ header: { fontSize: 12 } }}>{children}</Card>
)

export const ResourceInfoTooltip = ({ description, ariaLabel }: { description?: React.ReactNode, ariaLabel: string }) => {
    if (!description) return null
    return <Tooltip title={description} placement="top" getPopupContainer={() => document.body}>
        <Button type="text" size="small" icon={<InfoCircleOutlined />} aria-label={ariaLabel} />
    </Tooltip>
}

export const ResourceMetricStack = ({ children }: { children: React.ReactNode }) => (
    <div className="netdive-resource-stack">{children}</div>
)

export const ResourceComparisonBody = ({ children }: { children: React.ReactNode }) => (
    <div className="netdive-resource-comparison">{children}</div>
)
