import * as React from 'react'
import { Popover, Tabs, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

export const TOPOLOGY_STATUS_BADGE_RADIUS = 15
export const TOPOLOGY_STATUS_BADGE_STEP = 34
const TOPOLOGY_STATUS_BADGE_LIST_GAP = 4
const TOPOLOGY_STATUS_BADGE_LIST_VIEWPORT_SCALE = 0.6
const TOPOLOGY_STATUS_BADGE_VIEWBOX_PADDING = 2

export interface TopologyStatusBadgeTooltip {
    title: string
    description?: string
    summary?: Array<{ label: string, value: string }>
    detailsTitle?: string
    details?: Array<{ label?: string, value: string }>
}

export interface TopologyStatusBadgeProps {
    x: number
    y: number
    radius?: number
    tone: string
    text: string
    tooltip: React.ReactNode | TopologyStatusBadgeTooltip
    ariaLabel: string
}

export interface TopologyStatusBadgeItem {
    key: string
    tone: string
    count: number
    displayText?: string
    tooltip: React.ReactNode | TopologyStatusBadgeTooltip
    label?: string
}

export interface TopologyStatusBadgeGroupSummary {
    title: string
    totalLabel: string
    states: Array<{
        key: string
        tone: string
        label: string
        count: number
    }>
}

export interface TopologyStatusBadgeGroupProps {
    badges: TopologyStatusBadgeItem[]
    summary: TopologyStatusBadgeGroupSummary
    className?: string
}

export interface TopologyStatusBadgeRailProps {
    badges: TopologyStatusBadgeItem[]
    summary: TopologyStatusBadgeGroupSummary
    x: number
    y: number
    radius?: number
    step?: number
}

const isStructuredTooltip = (value: any): value is TopologyStatusBadgeTooltip =>
    !!value && typeof value === 'object' && !React.isValidElement(value) && typeof value.title === 'string'

const tooltipContent = (tooltip: React.ReactNode | TopologyStatusBadgeTooltip): React.ReactNode => {
    if (!isStructuredTooltip(tooltip)) return tooltip
    return <div className="netdive-topology-badge-tooltip__content">
        <div className="netdive-topology-badge-tooltip__title">{tooltip.title}</div>
        {tooltip.description ? <div className="netdive-topology-badge-tooltip__description">{tooltip.description}</div> : null}
        {tooltip.summary && tooltip.summary.length > 0 ? <div className="netdive-topology-badge-tooltip__summary">
            {tooltip.summary.map(item => <div className="netdive-topology-badge-tooltip__row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
            </div>)}
        </div> : null}
        {tooltip.details && tooltip.details.length > 0 ? <div className="netdive-topology-badge-tooltip__details">
            {tooltip.detailsTitle ? <div className="netdive-topology-badge-tooltip__details-title">{tooltip.detailsTitle}</div> : null}
            {tooltip.details.map((item, index) => <div
                className={`netdive-topology-badge-tooltip__row ${item.label ? '' : 'is-description'}`.trim()}
                key={`${item.label || 'detail'}-${index}`}>
                <span className={item.label ? '' : 'netdive-topology-badge-tooltip__bullet'}>{item.label || '•'}</span>
                <strong>{item.value}</strong>
            </div>)}
        </div> : null}
    </div>
}

const tooltipAriaLabel = (tooltip: React.ReactNode | TopologyStatusBadgeTooltip): string => {
    if (typeof tooltip === 'string') return tooltip.split('\n')[0]
    if (isStructuredTooltip(tooltip)) return tooltip.title
    return 'Kubernetes 상태 상세'
}

const TopologyStatusBadgeGlyph = ({
    x,
    y,
    radius,
    tone,
    text,
    pointerEvents = 'none'
}: {
    x: number
    y: number
    radius: number
    tone: string
    text: string
    pointerEvents?: 'all' | 'none'
}) => <g className={`node-exco-badge is-${tone}`} pointerEvents={pointerEvents}>
    <circle className="node-exco-circle" cx={x} cy={y} r={radius} />
    {text ? <text
        className="node-exco-children"
        x={x}
        y={y + 5}
        style={text.length >= 3 ? { fontSize: 12 } : undefined}>
        {text}
    </text> : null}
</g>

const topologyStatusLegendItems = [
    {
        key: 'self', tone: 'problem', text: '!', label: '현재 리소스 이상',
        description: '선택한 리소스 자체에 이상이 있는 상태'
    },
    {
        key: 'problem', tone: 'problem', text: '1', label: '자체 이상',
        description: '현재 단계에서 자체 이상인 자원 수'
    },
    {
        key: 'warning', tone: 'warning', text: '1', label: '하위 자원 이상',
        description: '자체는 정상이나 아래 계층에 이상이 있는 자원 수'
    },
    {
        key: 'healthy', tone: 'running', text: '1', label: '정상',
        description: '자체와 아래 계층 모두 이상이 없는 자원 수'
    },
    {
        key: 'inactive', tone: 'inactive', text: '1', label: '비활성',
        description: '정지 등으로 현재 운영되지 않는 자원'
    }
]

const topologyNodeLegendItems = [
    {
        key: 'resource',
        label: '일반 리소스 노드',
        description: '실제 인프라 또는 Kubernetes 리소스를 나타냅니다.'
    },
    {
        key: 'group',
        label: '그룹 노드',
        description: '같은 종류의 자원을 묶은 화면 구성용 그룹이며, 펼치면 포함된 자원을 확인할 수 있습니다.'
    },
    {
        key: 'selected',
        label: '선택된 노드',
        description: '파란 테두리로 표시되며, 상세 정보는 우측 패널에서 확인할 수 있습니다.'
    },
    {
        key: 'supporting',
        label: '보조 정보',
        description: '노드 이름 아래의 작은 텍스트는 자원 유형 또는 소속 정보를 나타냅니다.'
    }
]

const topologyStatusLegendContent = () => <div className="netdive-topology-status-legend__panel">
    <div className="netdive-topology-status-legend__title">상태 배지 의미</div>
    <div className="netdive-topology-status-legend__items" role="list">
        {topologyStatusLegendItems.map(item => <div
            className="netdive-topology-status-legend__item"
            role="listitem"
            key={item.key}>
            <svg
                className="netdive-topology-status-legend__badge"
                width={TOPOLOGY_STATUS_BADGE_RADIUS * 2 + 2}
                height={TOPOLOGY_STATUS_BADGE_RADIUS * 2 + 2}
                viewBox={`0 0 ${TOPOLOGY_STATUS_BADGE_RADIUS * 2 + 2} ${TOPOLOGY_STATUS_BADGE_RADIUS * 2 + 2}`}
                aria-hidden="true">
                <TopologyStatusBadgeGlyph
                    x={TOPOLOGY_STATUS_BADGE_RADIUS + 1}
                    y={TOPOLOGY_STATUS_BADGE_RADIUS + 1}
                    radius={TOPOLOGY_STATUS_BADGE_RADIUS}
                    tone={item.tone}
                    text={item.text} />
            </svg>
            <span className="netdive-topology-status-legend__item-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
            </span>
        </div>)}
    </div>
    <div className="netdive-topology-status-legend__description">
        숫자는 현재 단계의 자원 상태 개수를 나타냅니다.
    </div>
</div>

const topologyNodeLegendContent = () => <div className="netdive-topology-status-legend__panel">
    <div className="netdive-topology-status-legend__title">노드 표현 의미</div>
    <div className="netdive-topology-node-legend__items" role="list">
        {topologyNodeLegendItems.map(item => <div className="netdive-topology-node-legend__item" role="listitem" key={item.key}>
            <strong>{item.label}</strong>
            <span>{item.description}</span>
        </div>)}
    </div>
</div>

/** Global topology help. Its samples reuse the exact card badge glyph, radius
 * and tone classes instead of maintaining a second legend-only badge style. */
export const TopologyStatusBadgeLegend = () => {
    const [open, setOpen] = React.useState(false)
    return <Popover
        content={<div className="netdive-topology-status-legend">
            <Tabs className="netdive-topology-status-legend__tabs" defaultActiveKey="status">
                <Tabs.TabPane tab="상태 배지" key="status">{topologyStatusLegendContent()}</Tabs.TabPane>
                <Tabs.TabPane tab="노드 표현" key="node">{topologyNodeLegendContent()}</Tabs.TabPane>
            </Tabs>
        </div>}
        placement="bottom"
        trigger="click"
        visible={open}
        onVisibleChange={setOpen}
        overlayClassName="netdive-topology-status-legend-popover"
        getPopupContainer={() => document.body}
        autoAdjustOverflow>
        <Tooltip title="토폴로지 범례" placement="bottom" visible={open ? false : undefined}>
            <button
                type="button"
                className="netdive-topology-status-legend-trigger"
                aria-label="토폴로지 범례 보기">
                <InfoCircleOutlined aria-hidden="true" />
            </button>
        </Tooltip>
    </Popover>
}

const badgeGroupSummaryContent = (summary: TopologyStatusBadgeGroupSummary): React.ReactNode =>
    <div className="netdive-topology-badge-tooltip__content netdive-topology-badge-summary">
        <div className="netdive-topology-badge-tooltip__title">{summary.title}</div>
        <div className="netdive-topology-badge-summary__total">{summary.totalLabel}</div>
        <div className="netdive-topology-badge-summary__states">
            {summary.states.filter(state => state.count > 0).map(state => <div className="netdive-topology-badge-summary__state" key={state.key}>
                <svg className="netdive-topology-badge-summary__marker" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <TopologyStatusBadgeGlyph x={6} y={6} radius={5} tone={state.tone} text="" />
                </svg>
                <span>{state.label}</span>
                <strong>{state.count}개</strong>
            </div>)}
        </div>
    </div>

/** One circle is both the visible badge and the only Tooltip trigger. */
export const TopologyStatusBadge = ({
    x,
    y,
    radius = TOPOLOGY_STATUS_BADGE_RADIUS,
    tone,
    text,
    tooltip,
    ariaLabel
}: TopologyStatusBadgeProps) => <Tooltip
    title={tooltipContent(tooltip)}
    placement="top"
    arrowPointAtCenter
    autoAdjustOverflow
    trigger={['hover', 'focus']}
    overlayClassName="netdive-topology-badge-tooltip"
    getPopupContainer={() => document.body}>
    <g
        className={`node-exco-badge is-${tone}`}
        pointerEvents="all"
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}>
        <TopologyStatusBadgeGlyph x={x} y={y} radius={radius} tone={tone} text={text} pointerEvents="all" />
    </g>
</Tooltip>

/** The self-problem marker keeps its own Tooltip. All numeric badges share one
 * bounding-box trigger and one state-distribution Tooltip. */
export const TopologyStatusBadgeRail = ({
    badges,
    summary,
    x,
    y,
    radius = TOPOLOGY_STATUS_BADGE_RADIUS,
    step = TOPOLOGY_STATUS_BADGE_STEP
}: TopologyStatusBadgeRailProps) => {
    if (badges.length === 0) return null
    const centerX = (index: number) => x + (index - Math.max(0, badges.length - 1)) * step
    const selfBadges = badges.map((badge, index) => ({ badge, index }))
        .filter(item => item.badge.key === 'self-problem' || item.badge.key === 'self-inactive')
    const numericBadges = badges.map((badge, index) => ({ badge, index }))
        .filter(item => item.badge.key !== 'self-problem' && item.badge.key !== 'self-inactive')
    const numericLeft = numericBadges.length > 0 ? centerX(numericBadges[0].index) - radius : 0
    const numericRight = numericBadges.length > 0 ? centerX(numericBadges[numericBadges.length - 1].index) + radius : 0
    return <g className="netdive-topology-badge-rail">
        {selfBadges.map(({ badge, index }) => <TopologyStatusBadge
            key={badge.key}
            x={centerX(index)}
            y={y}
            radius={radius}
            tone={badge.tone}
            text={badge.displayText !== undefined ? badge.displayText : String(badge.count)}
            tooltip={badge.tooltip}
            ariaLabel={badge.label || tooltipAriaLabel(badge.tooltip)} />)}
        {numericBadges.length > 0 ? <Tooltip
            title={badgeGroupSummaryContent(summary)}
            placement="top"
            arrowPointAtCenter
            autoAdjustOverflow
            trigger={['hover', 'focus']}
            overlayClassName="netdive-topology-badge-tooltip"
            getPopupContainer={() => document.body}>
            <g
                className="netdive-topology-numeric-badge-group"
                pointerEvents="all"
                role="img"
                aria-label={`${summary.title}, ${summary.totalLabel}`}
                tabIndex={0}>
                <rect
                    className="netdive-topology-numeric-badge-group__trigger"
                    x={numericLeft}
                    y={y - radius}
                    width={numericRight - numericLeft}
                    height={radius * 2}
                    rx={radius}
                    fill="transparent" />
                {numericBadges.map(({ badge, index }) => <TopologyStatusBadgeGlyph
                    key={badge.key}
                    x={centerX(index)}
                    y={y}
                    radius={radius}
                    tone={badge.tone}
                    text={badge.displayText !== undefined ? badge.displayText : String(badge.count)} />)}
            </g>
        </Tooltip> : null}
    </g>
}

/** Shared inline SVG rail for list rows. It reuses the exact card badge and
 * Tooltip renderer while keeping every badge as its own hover/focus target. */
export const TopologyStatusBadgeGroup = ({
    badges,
    summary,
    className = ''
}: TopologyStatusBadgeGroupProps) => {
    if (badges.length === 0) return null
    const radius = TOPOLOGY_STATUS_BADGE_RADIUS
    const gap = TOPOLOGY_STATUS_BADGE_LIST_GAP
    const step = radius * 2 + gap
    const width = radius * 2 + Math.max(0, badges.length - 1) * step
    const height = radius * 2
    const paddedWidth = width + TOPOLOGY_STATUS_BADGE_VIEWBOX_PADDING * 2
    const paddedHeight = height + TOPOLOGY_STATUS_BADGE_VIEWBOX_PADDING * 2
    return <svg
        className={`netdive-topology-badge-group ${className}`.trim()}
        width={paddedWidth * TOPOLOGY_STATUS_BADGE_LIST_VIEWPORT_SCALE}
        height={paddedHeight * TOPOLOGY_STATUS_BADGE_LIST_VIEWPORT_SCALE}
        viewBox={`0 0 ${paddedWidth} ${paddedHeight}`}
        shapeRendering="geometricPrecision"
        aria-label="Kubernetes 상태 배지">
        <TopologyStatusBadgeRail
            badges={badges}
            summary={summary}
            x={TOPOLOGY_STATUS_BADGE_VIEWBOX_PADDING + radius + Math.max(0, badges.length - 1) * step}
            y={TOPOLOGY_STATUS_BADGE_VIEWBOX_PADDING + radius}
            radius={radius}
            step={step} />
    </svg>
}
