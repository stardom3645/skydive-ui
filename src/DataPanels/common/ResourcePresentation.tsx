import * as React from 'react'
import { Card, Tooltip } from 'antd'
import InfoIcon from '@material-ui/icons/Info'
import { createStyles, Theme, withStyles } from '@material-ui/core/styles'

export const RESOURCE_PRESENTATION_COLORS = { primary: 'var(--netdive-detail-accent, #1A73E8)' }

const resourceMetricTooltipStyle = {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    color: '#f8fafc',
    borderRadius: 10,
    padding: '10px 12px',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
    fontSize: 12,
    lineHeight: 1.45,
    maxWidth: 320,
    whiteSpace: 'normal' as const,
    wordBreak: 'keep-all' as const,
    overflowWrap: 'anywhere' as const
}

const resourceMetricTooltipOverlayStyle: React.CSSProperties = {
    maxWidth: 'min(320px, calc(100vw - 24px))'
}

// Extracted unchanged from HostResourceTrendPanel. Both visualizations share this surface.
const resourcePresentationValues = (theme: Theme) => ({
    card: {
        border: '1px solid #f0f0f0',
        borderRadius: 10,
        background: '#ffffff',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(16, 24, 40, 0.035)'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(1),
        minHeight: 44,
        padding: '0 16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#ffffff'
    },
    icon: {
        width: 18,
        height: 18,
        borderRadius: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 18px',
        color: '#1677ff',
        background: 'transparent',
        '& svg': {
            fontSize: 15
        }
    },
    titleBlock: {
        minWidth: 0,
        flex: '1 1 auto'
    },
    title: {
        color: '#101828',
        fontSize: 14,
        lineHeight: 1.2,
        fontWeight: 600
    },
    body: {
        padding: '12px 14px 14px'
    },
    bodyEmpty: {
        padding: '8px 14px 14px'
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 8
    },
    trendTile: {
        minWidth: 0,
        border: '1px solid #eef0f4',
        borderRadius: 10,
        padding: '13px 15px 12px',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        transition: 'border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease',
        '&:hover': {
            borderColor: 'rgba(148, 163, 184, 0.42)',
            background: '#ffffff',
            boxShadow: '0 4px 12px rgba(16, 24, 40, 0.05)'
        }
    },
    trendHeaderBlock: {
        display: 'grid',
        gap: 8,
        minWidth: 0,
        padding: '0 5px 9px',
        borderBottom: '1px solid rgba(226, 232, 240, 0.34)'
    },
    trendTop: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minWidth: 0,
        minHeight: 26
    },
    trendLabel: {
        minWidth: 0,
        color: '#101828',
        fontSize: 12.5,
        lineHeight: 1.2,
        fontWeight: 600,
        whiteSpace: 'nowrap'
    },
    trendHeaderRight: {
        minWidth: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        marginLeft: 'auto',
        whiteSpace: 'nowrap'
    },
    trendValueNumber: {
        fontSize: 14,
        fontWeight: 600,
        color: '#111827',
        lineHeight: 1
    },
    trendValueUnit: {
        fontSize: 11.5,
        fontWeight: 650,
        color: '#64748b',
        lineHeight: 1,
        letterSpacing: 0,
        transform: 'translateY(-0.5px)'
    },
    trendInfoButton: {
        width: 22,
        height: 22,
        border: 0,
        padding: 0,
        borderRadius: 7,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: 'var(--netdive-detail-muted, #64748b)',
        cursor: 'help',
        flex: '0 0 22px',
        opacity: 0.62,
        transition: 'opacity 140ms ease, background-color 140ms ease, color 140ms ease',
        '&:hover': {
            opacity: 1,
            background: 'rgba(148, 163, 184, 0.12)',
            color: 'var(--netdive-detail-title, #0f172a)'
        }
    },
    trendInfoIcon: {
        width: 15,
        height: 15,
        color: 'currentColor'
    },
    metricTooltip: resourceMetricTooltipStyle
} as const)

export const resourcePresentationStyles = (theme: Theme) => createStyles(resourcePresentationValues(theme))

interface ResourceSectionProps {
    classes: any
    title: React.ReactNode
    icon?: React.ReactNode
    action?: React.ReactNode
    empty?: boolean
    children: React.ReactNode
}

export const ResourceSectionCard = withStyles(resourcePresentationStyles)(({ classes, title, icon, action, empty, children }: ResourceSectionProps) => (
    <Card className={classes.card} bordered={false} bodyStyle={{ padding: 0 }}>
        <div className={classes.header}>
            {icon && <span className={classes.icon}>{icon}</span>}
            <div className={classes.titleBlock}><div className={classes.title}>{title}</div></div>
            {action}
        </div>
        <div className={`${classes.body} ${empty ? classes.bodyEmpty : ''}`}>{children}</div>
    </Card>
))

interface ResourceTileProps {
    classes: any
    title: React.ReactNode
    headerRight?: React.ReactNode
    children: React.ReactNode
    className?: string
}

export const ResourceMetricTile = withStyles(resourcePresentationStyles)(({ classes, title, headerRight, children, className = '' }: ResourceTileProps) => (
    <section className={`${classes.trendTile} ${className}`}>
        <div className={classes.trendHeaderBlock}>
            <div className={classes.trendTop}>
                <div className={classes.trendLabel}>{title}</div>
                {headerRight && <div className={classes.trendHeaderRight}>{headerRight}</div>}
            </div>
        </div>
        {children}
    </section>
))

interface ResourceInfoProps {
    classes: any
    description?: React.ReactNode
    ariaLabel: string
}

export const ResourceInfoTooltip = withStyles(resourcePresentationStyles)(({ classes, description, ariaLabel }: ResourceInfoProps) => {
    if (!description) return null
    return <Tooltip
        title={description}
        placement="top"
        overlayStyle={resourceMetricTooltipOverlayStyle}
        overlayInnerStyle={resourceMetricTooltipStyle}
        getPopupContainer={() => document.body}
        autoAdjustOverflow>
        <button className={classes.trendInfoButton} type="button" aria-label={ariaLabel}>
            <InfoIcon className={classes.trendInfoIcon} />
        </button>
    </Tooltip>
})


export const ResourceMetricStack = withStyles(resourcePresentationStyles)(({ classes, children }: { classes: any, children: React.ReactNode }) => (
    <div className={classes.grid}>{children}</div>
))

// Comparison rows retain their three columns. Only their visual hierarchy is
// inherited from the host tile's value and supporting-unit styles.
const comparisonStyles = (theme: Theme) => {
    const shared = resourcePresentationValues(theme)
    return createStyles({
        body: {
            minWidth: 0,
            '& .netdive-detail-metric-row .ant-typography': {
                fontSize: shared.trendValueUnit.fontSize,
                color: shared.trendValueUnit.color,
                lineHeight: 1.35
            },
            '& .netdive-detail-metric-row__label': { wordBreak: 'keep-all' },
            '& .netdive-detail-metric-row__value': {
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums'
            },
            '& .netdive-detail-metric-row--primary .netdive-detail-metric-row__value': {
                ...shared.trendValueNumber,
                lineHeight: 1.35
            },
            '& .netdive-detail-metric-row--primary .netdive-detail-metric-row__ratio': {
                color: shared.trendValueNumber.color,
                fontWeight: shared.trendValueNumber.fontWeight
            },
            '& .netdive-detail-metric-row': { marginTop: 0 },
            '& .netdive-detail-metric + .netdive-detail-metric': { marginTop: 8 },
            '& button.netdive-detail-metric-row': { borderRadius: shared.trendInfoButton.borderRadius },
            '& button.netdive-detail-metric-row:hover, & button.netdive-detail-metric-row:focus-visible': {
                background: shared.trendInfoButton['&:hover'].background
            }
        }
    })
}

export const ResourceComparisonBody = withStyles(comparisonStyles)(({ classes, children }: { classes: any, children: React.ReactNode }) => (
    <div className={classes.body}>{children}</div>
))
