import * as React from 'react'
import { Button, Card, Collapse, Dropdown, Empty, Menu, Modal, Progress, Tabs, Tag, Tooltip, Typography } from 'antd'
import { CopyOutlined, DownOutlined, EllipsisOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons'

import './DetailComponents.css'

const joinClassNames = (...classNames: Array<string | undefined | false>) => classNames.filter(Boolean).join(' ')

const copyTextWithLegacySelection = (value: string) => {
    if (typeof document === 'undefined' || !document.body) return false
    const input = document.createElement('textarea')
    input.value = value
    input.setAttribute('readonly', '')
    input.style.position = 'fixed'
    input.style.top = '0'
    input.style.left = '-9999px'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.focus()
    input.select()
    input.setSelectionRange(0, input.value.length)
    let copied = false
    try {
        copied = document.execCommand('copy')
    } catch (_error) {
        copied = false
    }
    document.body.removeChild(input)
    return copied
}

const copyTextToClipboard = (value: string) => {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    if (!clipboard || !clipboard.writeText) {
        copyTextWithLegacySelection(value)
        return
    }
    try {
        const result = clipboard.writeText(value)
        if (result && typeof result.catch === 'function') result.catch(() => copyTextWithLegacySelection(value))
    } catch (_error) {
        copyTextWithLegacySelection(value)
    }
}

const textWithPreferredBreaks = (value: string) => {
    const parts = String(value || '').split(/([/-])/)
    return parts.map((part, index) => <React.Fragment key={`${part}-${index}`}>
        {part}
        {(part === '/' || part === '-') && <wbr />}
    </React.Fragment>)
}

export interface DetailPanelHeaderProps {
    title: React.ReactNode
    fullTitle?: string
    subtitle?: React.ReactNode
    copyValue?: string
    copyTooltip?: React.ReactNode
    onCopy?: (value: string) => void
    className?: string
    titleRowClassName?: string
    titleClassName?: string
    subtitleClassName?: string
    copyClassName?: string
    titleMaxLines?: 1 | 2
}

/**
 * Shared title/subtitle/copy content for the SelectionPanel tab header.
 * The surrounding tab owns its icon and active indicator; resource panels only
 * provide display data so every Kubernetes detail uses the same header grammar.
 */
export const DetailPanelHeader = ({
    title,
    fullTitle,
    subtitle,
    copyValue,
    copyTooltip = 'Copy',
    onCopy,
    className,
    titleRowClassName,
    titleClassName,
    subtitleClassName,
    copyClassName,
    titleMaxLines = 1
}: DetailPanelHeaderProps) => {
    const copy = (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
        event.preventDefault()
        event.stopPropagation()
        if (!copyValue) return
        if (onCopy) onCopy(copyValue)
        else copyTextToClipboard(copyValue)
    }
    const content = (
        <span className={joinClassNames('netdive-detail-panel-header', className)}>
            <span className={joinClassNames('netdive-detail-panel-header__title-row', titleRowClassName)}>
                <span className={joinClassNames('netdive-detail-panel-header__title', `netdive-detail-panel-header__title--lines-${titleMaxLines}`, titleClassName)}>{title}</span>
                {copyValue && <span
                    className={joinClassNames('netdive-detail-panel-header__copy', copyClassName)}
                    role="button"
                    tabIndex={0}
                    aria-label={typeof copyTooltip === 'string' ? copyTooltip : 'Copy'}
                    onClick={copy}
                    onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') copy(event)
                    }}>
                    <CopyOutlined />
                </span>}
            </span>
            {subtitle && <span className={joinClassNames('netdive-detail-panel-header__subtitle', subtitleClassName)}>{subtitle}</span>}
        </span>
    )
    return fullTitle ? <Tooltip title={fullTitle} placement="bottom">{content}</Tooltip> : content
}

export interface DetailModalResourceCellProps {
    namespace?: string
    name: string
    secondary?: React.ReactNode
}

export const DetailModalResourceCell = ({ namespace, name, secondary }: DetailModalResourceCellProps) => {
    const fullName = namespace ? `${namespace}/${name}` : name
    return <Tooltip title={fullName}>
        <span className="netdive-modal-table__resource-cell">
            {namespace && <small>{textWithPreferredBreaks(namespace)}</small>}
            <strong>{textWithPreferredBreaks(name)}</strong>
            {secondary && <span className="netdive-modal-table__cell-secondary">{secondary}</span>}
        </span>
    </Tooltip>
}

export interface DetailModalTextCellProps {
    value: string
    secondary?: React.ReactNode
}

export const DetailModalTextCell = ({ value, secondary }: DetailModalTextCellProps) => (
    <Tooltip title={value}>
        <span className="netdive-modal-table__text-cell">
            <strong>{textWithPreferredBreaks(value || '없음')}</strong>
            {secondary && <span className="netdive-modal-table__cell-secondary">{secondary}</span>}
        </span>
    </Tooltip>
)

export interface DetailSectionProps {
    icon?: React.ReactNode
    title: React.ReactNode
    description?: React.ReactNode
    descriptionTooltip?: React.ReactNode
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
    descriptionTooltip,
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
                    {description && (descriptionTooltip
                        ? <Tooltip title={<DetailTooltipContent description={descriptionTooltip} />} overlayClassName="netdive-operational-tooltip">
                            <Typography.Text className="netdive-detail-section__description">{description}</Typography.Text>
                        </Tooltip>
                        : <Typography.Text className="netdive-detail-section__description">{description}</Typography.Text>)}
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
        copyTextToClipboard(value)
    }

    return (
        <Tooltip
            title={tooltip}
            placement="topRight"
            overlayClassName="netdive-detail-copy-tooltip"
            getPopupContainer={() => document.body}
            autoAdjustOverflow>
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
    wrap?: boolean
    labelWrap?: boolean
}

export interface DetailLongValueProps {
    value: string
    copy?: boolean
    copyTooltip?: React.ReactNode
    maxLines?: 1 | 2
    className?: string
}

/** Shared long-value presentation for resource names, selectors, revisions and
 * image references. It preserves two readable lines while Tooltip and copy
 * retain the complete source value. */
export const DetailLongValue = ({
    value,
    copy = false,
    copyTooltip = '복사',
    maxLines = 2,
    className
}: DetailLongValueProps) => (
    <span className={joinClassNames('netdive-detail-long-value', className)}>
        <Tooltip title={value} placement="top" overlayClassName="netdive-detail-tooltip">
            <span className={joinClassNames('netdive-detail-long-value__text', `lines-${maxLines}`)}>{textWithPreferredBreaks(value)}</span>
        </Tooltip>
        {copy && <DetailCopyButton value={value} tooltip={copyTooltip} />}
    </span>
)

export const DetailModalAction = ({ children, onClick }: { children: React.ReactNode, onClick: () => void }) => (
    <Button type="text" className="netdive-detail-modal-action" onClick={onClick}>
        <span>{children}</span><RightOutlined />
    </Button>
)

export interface DetailKeyValueListProps {
    rows: DetailKeyValueRow[]
    emptyText?: React.ReactNode
    labelWidth?: number | string
    density?: 'default' | 'compact'
    copyTooltip?: React.ReactNode
    onCopy?: (value: string) => void
    className?: string
}

export const DetailKeyValueList = ({
    rows,
    emptyText = '-',
    labelWidth = 116,
    density = 'default',
    copyTooltip,
    onCopy,
    className
}: DetailKeyValueListProps) => {
    if (!rows.length) return <DetailEmpty description={emptyText} compact />
    const labelColumn = typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth

    return (
        <div className={joinClassNames('netdive-detail-kv', density === 'compact' && 'netdive-detail-kv--compact', className)}>
            {rows.map((row, index) => {
                const value = row.tooltip || row.textValue
                    ? <Tooltip title={row.tooltip || row.textValue} placement="top"><span className="netdive-detail-kv__value-text">{row.value}</span></Tooltip>
                    : <span className="netdive-detail-kv__value-text">{row.value}</span>
                return (
                    <div
                        className={joinClassNames('netdive-detail-kv__row', row.wrap && 'netdive-detail-kv__row--wrap')}
                        key={row.key !== undefined ? row.key : index}
                        style={{ gridTemplateColumns: `${labelColumn} minmax(0, 1fr)` }}>
                        <Typography.Text className={joinClassNames('netdive-detail-kv__label', row.labelWrap && 'netdive-detail-kv__label--wrap')}>{row.label}</Typography.Text>
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

export interface DetailAdvancedInfoProps {
    title: React.ReactNode
    children: React.ReactNode
    active: boolean
    onChange: (active: boolean) => void
    className?: string
    hierarchy?: 'default' | 'supporting'
}

/**
 * Shared compact advanced-information disclosure used below basic information.
 * It intentionally mirrors the established Kubernetes cluster spacing and
 * chevron behavior without requiring resource-specific CSS overrides.
 */
export const DetailAdvancedInfo = ({ title, children, active, onChange, className, hierarchy = 'default' }: DetailAdvancedInfoProps) => (
    <Collapse
        accordion
        bordered={false}
        className={joinClassNames('netdive-detail-advanced-collapse', hierarchy === 'supporting' && 'is-supporting', className)}
        activeKey={active ? 'advanced' : ''}
        expandIconPosition="right"
        onChange={key => onChange((Array.isArray(key) ? String(key[0] || '') : String(key || '')) === 'advanced')}>
        <Collapse.Panel header={title} key="advanced">
            {children}
        </Collapse.Panel>
    </Collapse>
)

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
    tooltipDetail?: React.ReactNode
    tooltipRawValue?: React.ReactNode
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

export interface DetailTooltipContentProps {
    description?: React.ReactNode
    detail?: React.ReactNode
    rawValue?: React.ReactNode
    className?: string
}

export const DetailTooltipContent = ({
    description,
    detail,
    rawValue,
    className
}: DetailTooltipContentProps) => (
    <div className={joinClassNames('netdive-detail-tooltip__content', className)}>
        {description && <div className="netdive-detail-tooltip__description">{description}</div>}
        {detail && <div className="netdive-detail-tooltip__detail">{detail}</div>}
        {rawValue && <div className="netdive-detail-tooltip__raw">원본 값: {rawValue}</div>}
    </div>
)

const operationalTooltip = (
    description?: React.ReactNode,
    detail?: React.ReactNode,
    rawValue?: React.ReactNode
) => description || detail || rawValue
    ? <DetailTooltipContent description={description} detail={detail} rawValue={rawValue} />
    : undefined

const operationalTooltipTrigger = (content: React.ReactElement, description?: React.ReactNode, detail?: React.ReactNode, rawValue?: React.ReactNode) => {
    const title = operationalTooltip(description, detail, rawValue)
    return title
        ? <Tooltip title={title} placement="top" overlayClassName="netdive-operational-tooltip">{content}</Tooltip>
        : content
}

export const KUBERNETES_DETAIL_LABELS = Object.freeze({
    verdict: 'Netdive 판정',
    rawStatus: 'Kubernetes/API 원본 상태',
    impact: '현재 영향',
    affectedServices: '영향받은 서비스',
    controlPlane: 'Control Plane',
    namespace: '네임스페이스',
    pod: '파드',
    pods: '파드',
    service: '서비스',
    services: '서비스',
    workloadsAndPods: '워크로드·파드',
    workloadController: '워크로드 컨트롤러',
    persistentVolume: 'PV',
    persistentVolumeClaim: 'PVC',
    storageClass: 'StorageClass',
    endpointSlice: 'EndpointSlice',
    nodePressure: '노드 압박',
    namespaceStatus: '네임스페이스 상태',
    active: '활성',
    runningPods: '실행 중 파드',
    notReadyPods: '준비되지 않은 파드',
    pendingPods: '대기 중 파드',
    recentRestartPods: '최근 재시작 파드',
    crashLoopBackOffPods: 'CrashLoopBackOff 상태 파드',
    oomKilledPods: '현재·최근 OOMKilled 발생 파드',
    cpuRequests: 'CPU 요청량',
    cpuLimits: 'CPU 제한량',
    memoryRequests: '메모리 요청량',
    memoryLimits: '메모리 제한량',
    labels: '라벨',
    annotations: '어노테이션',
    selector: '선택자',
    resourceQuota: '리소스 할당량',
    limitRange: '기본 리소스 제한'
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
            {stateTooltip && operationalTooltipTrigger(
                <InfoCircleOutlined className="netdive-operational-summary__info" />,
                stateTooltip
            )}
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
                                {(metric.tooltip || metric.tooltipDetail || metric.tooltipRawValue) && operationalTooltipTrigger(
                                    <InfoCircleOutlined className="netdive-operational-summary__info" />,
                                    metric.tooltip,
                                    metric.tooltipDetail,
                                    metric.tooltipRawValue
                                )}
                            </span>
                            <strong>{metric.value}</strong>
                        </button>
                    )
                    return <React.Fragment key={metric.key !== undefined ? metric.key : index}>{metricContent}</React.Fragment>
                })}
            </div>}
        </div>
    )
    return tooltip
        ? operationalTooltipTrigger(content, tooltip)
        : content
}

export interface DetailMetricRowProps {
    label: React.ReactNode
    value: React.ReactNode
    ratio?: React.ReactNode
    primary?: boolean
    muted?: boolean
    onClick?: () => void
    progressPercent?: number
    progressColor?: string
    progressTrailColor?: string
    className?: string
}

/**
 * Shared three-column metric row used by Kubernetes utilization sections.
 * Keeping the row and Progress in one unit prevents vertical drift between
 * resource types when their labels or values have different lengths.
 */
export const DetailMetricRow = ({
    label,
    value,
    ratio,
    primary = false,
    muted = false,
    onClick,
    progressPercent,
    progressColor,
    progressTrailColor = '#f0f0f0',
    className
}: DetailMetricRowProps) => {
    const content = (
        <React.Fragment>
            <Typography.Text type="secondary" className="netdive-detail-metric-row__label">{label}</Typography.Text>
            <Typography.Text strong={primary} className="netdive-detail-metric-row__value">{value}</Typography.Text>
            <Typography.Text strong={primary} type={primary ? undefined : 'secondary'} className="netdive-detail-metric-row__ratio">
                {ratio}
            </Typography.Text>
        </React.Fragment>
    )
    const rowClassName = joinClassNames(
        'netdive-detail-metric-row',
        primary && 'netdive-detail-metric-row--primary',
        muted && 'netdive-detail-metric-row--muted',
        onClick && 'netdive-detail-metric-row--interactive'
    )
    return (
        <div className={joinClassNames('netdive-detail-metric', className)}>
            {onClick
                ? <button type="button" className={rowClassName} onClick={onClick}>{content}</button>
                : <div className={rowClassName}>{content}</div>}
            {progressPercent !== undefined && (
                <Progress
                    size="small"
                    percent={progressPercent}
                    showInfo={false}
                    strokeColor={progressColor}
                    trailColor={progressTrailColor}
                />
            )}
        </div>
    )
}

export interface ResourceMetricBlockProps {
    title: React.ReactNode
    basis?: React.ReactNode
    basisTooltip?: React.ReactNode
    tooltip?: React.ReactNode
    tooltipOverlayClassName?: string
    children: React.ReactNode
    className?: string
}

export const ResourceMetricBlock = ({ title, basis, basisTooltip, tooltip, tooltipOverlayClassName, children, className }: ResourceMetricBlockProps) => (
    <section className={joinClassNames('netdive-detail-resource-metric-block', className)}>
        <div className="netdive-detail-resource-metric-block__header">
            {tooltip
                ? <Tooltip title={tooltip} placement="top" overlayClassName={tooltipOverlayClassName}><Typography.Text strong>{title}</Typography.Text></Tooltip>
                : <Typography.Text strong>{title}</Typography.Text>}
            {basis && (basisTooltip
                ? <Tooltip title={basisTooltip} placement="top" overlayClassName="netdive-detail-tooltip"><small className="netdive-detail-resource-metric-block__basis">기준: {basis}</small></Tooltip>
                : <small className="netdive-detail-resource-metric-block__basis">기준: {basis}</small>)}
        </div>
        <div className="netdive-detail-resource-metric-block__body">{children}</div>
    </section>
)

export interface StatusEvidenceRowProps {
    title: React.ReactNode
    evidence?: React.ReactNode
    metadata?: ReadonlyArray<{
        key?: React.Key
        label: React.ReactNode
        value: React.ReactNode
    }>
    state?: React.ReactNode
    status?: {
        label: React.ReactNode
        tone?: DetailBadgeTone
    }
    value?: React.ReactNode
    hideValue?: boolean
    valueVariant?: StatusEvidenceValueVariant
    secondaryValue?: React.ReactNode
    secondaryValueVariant?: StatusEvidenceValueVariant
    valuesUnavailable?: boolean
    tone?: DetailBadgeTone
    tooltip?: React.ReactNode
    tooltipDetail?: React.ReactNode
    tooltipRawValue?: React.ReactNode
    onClick?: () => void
    className?: string
}

export interface DetailNavigationTab {
    key: string
    label: React.ReactNode
    count?: React.ReactNode
}

export interface DetailNavigationTabsProps {
    activeKey: string
    tabs: DetailNavigationTab[]
    overflowTabs?: DetailNavigationTab[]
    onChange: (key: string) => void
    className?: string
}

/** Canonical Ant Design navigation extracted from the established Kubernetes
 * cluster panel. Native Ant Tabs overflow stays portalled outside the panel. */
export const DetailNavigationTabs = ({
    activeKey,
    tabs,
    overflowTabs = [],
    onChange,
    className
}: DetailNavigationTabsProps) => {
    const overflowActive = overflowTabs.some(tab => tab.key === activeKey)
    const menu = <Menu selectedKeys={overflowActive ? [activeKey] : []} onClick={({ key }) => onChange(String(key))}>
        {overflowTabs.map(tab => <Menu.Item key={tab.key}>{tab.label}</Menu.Item>)}
    </Menu>
    const overflowTrigger = overflowTabs.length > 0
        ? <Dropdown
            overlay={menu}
            overlayClassName="netdive-mold-dropdown"
            trigger={['click']}
            placement="bottomRight"
            getPopupContainer={() => document.body}>
            <Button
                type="text"
                aria-label="추가 탭"
                aria-current={overflowActive ? 'page' : undefined}
                icon={<EllipsisOutlined />}
                className={joinClassNames(
                    'netdive-detail-navigation-tabs__overflow-trigger',
                    overflowActive && 'is-active'
                )}
            />
        </Dropdown>
        : undefined
    return <Tabs
        className={joinClassNames('netdive-detail-navigation-tabs', overflowTabs.length > 0 && 'has-explicit-overflow', className)}
        activeKey={overflowActive ? '__overflow_active__' : activeKey}
        onChange={onChange}
        tabBarExtraContent={overflowTrigger}
        moreIcon={<EllipsisOutlined />}>
        {tabs.map(tab => <Tabs.TabPane
            tab={<span className="netdive-detail-navigation-tabs__label">
                <span>{tab.label}</span>
                {tab.count !== undefined && <small>{tab.count}</small>}
            </span>}
            key={tab.key} />)}
    </Tabs>
}

export interface DetailMetaInfoItem {
    key?: React.Key
    label: React.ReactNode
    value: React.ReactNode
    tone?: DetailBadgeTone
    tooltip?: React.ReactNode
    tooltipDetail?: React.ReactNode
}

export interface DetailMetricSummaryItem {
    key?: React.Key
    label: React.ReactNode
    value: React.ReactNode
    tone?: DetailBadgeTone
    tooltip?: React.ReactNode
}

/** Compact metric strip for secondary summaries such as Replica snapshots.
 * It deliberately stays below KPI emphasis and wraps at narrow panel widths. */
export interface DetailMetricSummaryRowProps {
    items: DetailMetricSummaryItem[]
    className?: string
    /** Maximum columns before the equal-width summary wraps to another row. */
    columns?: number
    /** Low-emphasis horizontal form for secondary evidence below a primary strip. */
    variant?: 'default' | 'supporting'
}

export const DetailMetricSummaryRow = ({ items, className, columns, variant = 'default' }: DetailMetricSummaryRowProps) => {
    const columnCount = Math.max(1, Math.min(columns || items.length, items.length || 1))
    return <div
        className={joinClassNames('netdive-detail-metric-summary-row', variant === 'supporting' && 'is-supporting', items.length > columnCount && 'is-wrapped', className)}
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
        {items.map((item, index) => {
            const content = <span className={joinClassNames(
                'netdive-detail-metric-summary-row__item',
                item.tone && `is-${item.tone}`,
                (index + 1) % columnCount === 0 && 'is-row-end',
                index >= columnCount && 'is-wrapped-row'
            )}>
                <span>{item.label}</span><strong>{item.value}</strong>
            </span>
            return item.tooltip
                ? <Tooltip key={item.key === undefined ? index : item.key} title={<DetailTooltipContent description={item.tooltip} />} overlayClassName="netdive-operational-tooltip">{content}</Tooltip>
                : <React.Fragment key={item.key === undefined ? index : item.key}>{content}</React.Fragment>
        })}
    </div>
}

export const DetailMetaInfoRow = ({ items, className }: { items: DetailMetaInfoItem[], className?: string }) => (
    <div className={joinClassNames('netdive-detail-meta-info-row', className)}>
        {items.map((item, index) => {
            const value = item.tone
                ? <DetailStatusIndicator tone={item.tone}>{item.value}</DetailStatusIndicator>
                : <strong>{item.value}</strong>
            return <span key={item.key === undefined ? index : item.key}>
                <span>{item.label}</span>
                {operationalTooltipTrigger(value, item.tooltip, item.tooltipDetail)}
            </span>
        })}
    </div>
)

export interface DetailMetadataSummaryProps {
    value: Record<string, any> | undefined | null
    excludedKeys?: string[]
}

/** Non-interactive count used in basic information. Metadata exploration is
 * intentionally kept in the advanced clickable rows below. */
export const DetailMetadataSummary = ({
    value,
    excludedKeys = []
}: DetailMetadataSummaryProps) => {
    const metadata = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    const keys = Object.keys(metadata).filter(key => excludedKeys.indexOf(key) < 0).sort()
    return <span className="netdive-detail-metadata-summary">{keys.length}개</span>
}

export interface DetailCollectionStatusRowProps {
    label?: React.ReactNode
    value: React.ReactNode
    tone?: DetailBadgeTone
    tooltip?: React.ReactNode
    tooltipDetail?: React.ReactNode
    className?: string
}

export const DetailCollectionStatusRow = ({
    label = '데이터 수집 상태',
    value,
    tone = 'default',
    tooltip,
    tooltipDetail,
    className
}: DetailCollectionStatusRowProps) => (
    <div className={joinClassNames('netdive-detail-collection-status-row', className)}>
        <span>{label}</span>
        {operationalTooltipTrigger(
            <DetailStatusIndicator tone={tone}>{value}</DetailStatusIndicator>,
            tooltip,
            tooltipDetail
        )}
    </div>
)

export type StatusEvidenceValueVariant = 'number' | 'grade' | 'score'

export interface DetailStatusIndicatorProps {
    tone?: DetailBadgeTone
    children: React.ReactNode
    className?: string
}

export const DetailStatusIndicator = ({
    tone = 'default',
    children,
    className
}: DetailStatusIndicatorProps) => (
    <span className={joinClassNames('netdive-detail-status-indicator', `is-${tone}`, className)}>
        <i />
        <span>{children}</span>
    </span>
)

export interface StatusEvidenceListProps {
    children: React.ReactNode
    columnHeaders?: {
        state: React.ReactNode
        value?: React.ReactNode
        secondaryValue?: React.ReactNode
        valueTooltip?: React.ReactNode
        secondaryValueTooltip?: React.ReactNode
    }
    className?: string
}

export const StatusEvidenceList = ({ children, columnHeaders, className }: StatusEvidenceListProps) => {
    const withoutValue = !!columnHeaders && columnHeaders.value === undefined
    return <div className={joinClassNames('netdive-detail-evidence-list', columnHeaders?.secondaryValue !== undefined && 'has-secondary-value', withoutValue && 'without-value', className)}>
        {columnHeaders && <div className={joinClassNames('netdive-detail-evidence-list__column-headers', columnHeaders.secondaryValue !== undefined && 'has-secondary-value', withoutValue && 'without-value')}>
            <span aria-hidden="true" />
            <span>{columnHeaders.state}</span>
            {columnHeaders.value !== undefined && <span className="netdive-detail-evidence-list__header-label">
                {columnHeaders.value}
                {columnHeaders.valueTooltip && <Tooltip title={<DetailTooltipContent description={columnHeaders.valueTooltip} />} overlayClassName="netdive-operational-tooltip"><InfoCircleOutlined /></Tooltip>}
            </span>}
            {columnHeaders.secondaryValue !== undefined && <span className="netdive-detail-evidence-list__header-label">
                {columnHeaders.secondaryValue}
                {columnHeaders.secondaryValueTooltip && <Tooltip title={<DetailTooltipContent description={columnHeaders.secondaryValueTooltip} />} overlayClassName="netdive-operational-tooltip"><InfoCircleOutlined /></Tooltip>}
            </span>}
        </div>}
        {children}
    </div>
}

export const StatusEvidenceRow = ({
    title,
    evidence,
    metadata,
    state,
    status,
    value,
    hideValue = false,
    valueVariant = 'number',
    secondaryValue,
    secondaryValueVariant = 'grade',
    valuesUnavailable = false,
    tone = 'default',
    tooltip,
    tooltipDetail,
    tooltipRawValue,
    onClick,
    className
}: StatusEvidenceRowProps) => {
    const renderedState = status
        ? <DetailStatusIndicator tone={status.tone || tone}>{status.label}</DetailStatusIndicator>
        : state
    const renderedValue = valuesUnavailable ? '확인 불가' : value
    const renderedSecondaryValue = valuesUnavailable ? '확인 불가' : secondaryValue
    const content = (
        <div className={joinClassNames('netdive-detail-evidence-row', secondaryValue !== undefined && 'has-secondary-value', hideValue && 'without-value', valuesUnavailable && 'has-unavailable-values', `netdive-detail-evidence-row--${tone}`, className)}>
            <div className="netdive-detail-evidence-row__info">
                <span className="netdive-detail-evidence-row__title">
                    {title}
                    {(tooltip || tooltipDetail || tooltipRawValue) && <Tooltip
                        title={<DetailTooltipContent description={tooltip} detail={tooltipDetail} rawValue={tooltipRawValue} />}
                        placement="top"
                        overlayClassName="netdive-detail-tooltip">
                        <InfoCircleOutlined />
                    </Tooltip>}
                </span>
                {evidence && <small className="netdive-detail-evidence-row__evidence">{evidence}</small>}
                {metadata && metadata.length > 0 && <dl className="netdive-detail-evidence-row__metadata">
                    {metadata.map((item, index) => <div key={item.key === undefined ? index : item.key} className="netdive-detail-evidence-row__metadata-item">
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                    </div>)}
                </dl>}
            </div>
            <div className="netdive-detail-evidence-row__state">{renderedState}</div>
            {!hideValue && <strong className={joinClassNames('netdive-detail-evidence-row__value', `is-${valueVariant}`)}>{renderedValue}</strong>}
            {secondaryValue !== undefined && <strong className={joinClassNames('netdive-detail-evidence-row__value', 'netdive-detail-evidence-row__secondary-value', `is-${secondaryValueVariant}`)}>{renderedSecondaryValue}</strong>}
        </div>
    )
    if (!onClick) return content
    return <div
        className="netdive-detail-evidence-row__interactive"
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
            }
        }}>
        {content}
    </div>
}

export interface CollapsibleSummaryRowProps {
    title: React.ReactNode
    summary?: React.ReactNode
    expanded: boolean
    onToggle: () => void
    children?: React.ReactNode
    className?: string
    density?: 'default' | 'compact'
    expandLabel?: string
    collapseLabel?: string
}

export const CollapsibleSummaryRow = ({
    title,
    summary,
    expanded,
    onToggle,
    children,
    className,
    density = 'default',
    expandLabel = '펼치기',
    collapseLabel = '접기'
}: CollapsibleSummaryRowProps) => (
    <div className={joinClassNames(
        'netdive-detail-collapsible-summary',
        density === 'compact' && 'netdive-detail-collapsible-summary--compact',
        expanded && 'is-expanded',
        className
    )}>
        <button
            type="button"
            className="netdive-detail-collapsible-summary__header"
            aria-expanded={expanded}
            onClick={onToggle}>
            <span className="netdive-detail-collapsible-summary__title">{title}</span>
            {summary && <span className="netdive-detail-collapsible-summary__value">{summary}</span>}
            <span className="netdive-detail-collapsible-summary__chevron" aria-label={expanded ? collapseLabel : expandLabel}>
                <RightOutlined />
            </span>
        </button>
        {expanded && children}
    </div>
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
    copyText?: string
    copyTooltip?: React.ReactNode
    labelTooltip?: React.ReactNode
    selected?: boolean
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
    labelTooltip,
    selected = false
}: DetailResourceCardProps) => (
    <Button
        type="text"
        block
        disabled={!interactive}
        className={joinClassNames(
            'netdive-detail-resource',
            interactive ? 'netdive-detail-resource--interactive' : 'netdive-detail-resource--static',
            selected && 'netdive-detail-resource--selected',
            copyText && 'netdive-detail-resource--copyable',
            className
        )}
        aria-pressed={interactive ? selected : undefined}
        onClick={interactive ? onClick : undefined}>
        <span className="netdive-detail-resource__main">
            {icon && (
                <span className={joinClassNames(
                    'netdive-detail-resource__icon',
                    iconTone && `netdive-detail-resource__icon--${iconTone}`
                )}>{icon}</span>
            )}
            <span className="netdive-detail-resource__text">
                {interactive || labelTooltip !== undefined
                    ? <Tooltip title={labelTooltip !== undefined ? labelTooltip : typeof label === 'string' ? label : undefined} placement="top">
                        <Typography.Text className="netdive-detail-resource__label">{label}</Typography.Text>
                    </Tooltip>
                    : <Typography.Text className="netdive-detail-resource__label">{label}</Typography.Text>}
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

export interface DetailInlineSectionHeaderProps {
    title: React.ReactNode
    action?: React.ReactNode
    className?: string
}

export const DetailInlineSectionHeader = ({ title, action, className }: DetailInlineSectionHeaderProps) => (
    <div className={joinClassNames('netdive-detail-inline-section-header', className)}>
        <strong>{title}</strong>
        {action && <span className="netdive-detail-inline-section-header__action">{action}</span>}
    </div>
)

export interface DetailCardSubsectionHeaderProps extends DetailInlineSectionHeaderProps {
    first?: boolean
}

/** First-level hierarchy inside a shared detail card. It stays visibly below
 * the card title and above supporting disclosure rows. */
export const DetailCardSubsectionHeader = ({ title, action, className, first = false }: DetailCardSubsectionHeaderProps) => (
    <div className={joinClassNames('netdive-detail-card-subsection-header', first && 'is-first', className)}>
        <strong>{title}</strong>
        {action && <span className="netdive-detail-card-subsection-header__action">{action}</span>}
    </div>
)

export interface DetailCompactResourceItemProps {
    name: React.ReactNode
    metadata: React.ReactNode
    onClick?: () => void
    copyText?: string
    copyTooltip?: React.ReactNode
    className?: string
}

export const DetailCompactResourceItem = ({
    name,
    metadata,
    onClick,
    copyText,
    copyTooltip,
    className
}: DetailCompactResourceItemProps) => (
    <div className={joinClassNames('netdive-detail-compact-resource', className)}>
        <button
            type="button"
            className="netdive-detail-compact-resource__main"
            disabled={!onClick}
            onClick={onClick}>
            <span className="netdive-detail-compact-resource__text">
                <strong>{name}</strong>
                <small>{metadata}</small>
            </span>
            <RightOutlined className="netdive-detail-compact-resource__action" />
        </button>
        {copyText && <Tooltip title={copyTooltip} placement="top" overlayClassName="netdive-detail-tooltip">
            <button
                type="button"
                className="netdive-detail-compact-resource__copy"
                aria-label={typeof copyTooltip === 'string' ? copyTooltip : 'Copy'}
                onClick={() => copyTextToClipboard(copyText)}>
                <CopyOutlined />
            </button>
        </Tooltip>}
    </div>
)

export interface DetailCompactResourceListProps {
    children: React.ReactNode
    className?: string
}

export const DetailCompactResourceList = ({ children, className }: DetailCompactResourceListProps) => (
    <div className={joinClassNames('netdive-detail-compact-resource-list', className)}>{children}</div>
)

export interface ConnectedResourceItem {
    key?: React.Key
    label: React.ReactNode
    count: React.ReactNode
    icon?: React.ReactNode
    iconTone?: DetailResourceIconTone
    onClick?: () => void
    tooltip?: React.ReactNode
    selected?: boolean
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
                            selected={item.selected}
                            onClick={item.onClick} />
                        return item.tooltip && item.onClick ? <Tooltip key={item.key !== undefined ? item.key : itemIndex} title={item.tooltip} placement="top">{card}</Tooltip> : card
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
                        const rowContent = <span className="netdive-connected-resource-list__item-layout">
                                {item.icon && <span className="netdive-connected-resource-list__item-icon">{item.icon}</span>}
                                <span className="netdive-connected-resource-list__item-main">
                                    {item.kind && <Typography.Text className="netdive-connected-resource-list__item-kind">{item.kind}</Typography.Text>}
                                    <Typography.Text className="netdive-connected-resource-list__item-name">{item.name}</Typography.Text>
                                    {item.description && <Typography.Text className="netdive-connected-resource-list__item-description">{item.description}</Typography.Text>}
                                </span>
                                {item.onClick && <RightOutlined className="netdive-connected-resource-list__item-action" />}
                            </span>
                        const row = item.onClick
                            ? <Button type="text" className={joinClassNames('netdive-connected-resource-list__item', item.className)} onClick={item.onClick}>{rowContent}</Button>
                            : <div className={joinClassNames('netdive-connected-resource-list__item', 'is-static', item.className)}>{rowContent}</div>
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

export const DetailEmpty = ({ description, compact = false, className }: DetailEmptyProps) => {
    if (compact) {
        return (
            <div
                className={joinClassNames('netdive-detail-empty', 'netdive-detail-empty--compact', className)}
                role="status">
                <span>{description}</span>
            </div>
        )
    }
    return (
        <Empty
            className={joinClassNames('netdive-detail-empty', className)}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={description}
        />
    )
}

export type HistoryModalProps = React.ComponentProps<typeof Modal>

export const HistoryModal = ({ className, ...props }: HistoryModalProps) => (
    <Modal
        className={joinClassNames('netdive-list-modal', className)}
        footer={null}
        destroyOnClose
        keyboard
        getContainer={() => document.body}
        {...props}
    />
)

// Canonical product-language aliases. Existing names remain exported for
// compatibility while new Kubernetes panels use this fixed UI vocabulary.
export const DetailSectionCard = DetailSection
export const BasicInfoRows = DetailKeyValueList
export const StatusSummaryGrid = DetailOperationalSummary
export const RelatedResourceGrid = ConnectedResourcesSection
export const RelatedResourceItem = DetailResourceCard
export const CompactEmptyState = DetailEmpty
export const CopyButton = DetailCopyButton
