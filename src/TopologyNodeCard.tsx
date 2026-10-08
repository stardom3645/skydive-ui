import * as React from 'react'
import { Button, ConfigProvider, Progress, Tag, Tooltip } from 'antd'
import { DownOutlined, UpOutlined, ThunderboltOutlined, BlockOutlined, AppstoreOutlined,
    ApartmentOutlined, DatabaseOutlined, FolderOutlined, HddOutlined, DeploymentUnitOutlined,
    CloudServerOutlined, LinkOutlined, BranchesOutlined, TagsOutlined } from '@ant-design/icons'
import { TopologyNodePresentation, TopologyMetric } from './TopologyNodePresentation'
import { TOPOLOGY_TOOLTIP_DISMISS_EVENT, watchTopologyTooltipAnchor } from './TopologyTooltipAnchor'
import { TopologyStatusBadgeRail } from './TopologyStatusBadge'
import './TopologyNodeCard.css'

/** Ant overlays live outside the SVG. Close them when their D3 anchor moves,
 * rather than leaving the previous position visible during pan or collapse. */
const TopologyCardTooltip = ({ title, block = false, children }: {
    title: string; block?: boolean; children: React.ReactNode
}) => {
    const anchor = React.useRef<HTMLSpanElement>(null)
    const [open, setOpen] = React.useState(false)
    React.useEffect(() => { setOpen(false) }, [title])
    React.useEffect(() => {
        if (!open || !anchor.current) return undefined
        const dismiss = () => setOpen(false)
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss() }
        const stop = watchTopologyTooltipAnchor(anchor.current, dismiss)
        window.addEventListener(TOPOLOGY_TOOLTIP_DISMISS_EVENT, dismiss)
        window.addEventListener('blur', dismiss)
        window.addEventListener('resize', dismiss)
        document.addEventListener('mousedown', dismiss, true)
        document.addEventListener('wheel', dismiss, true)
        document.addEventListener('scroll', dismiss, true)
        document.addEventListener('visibilitychange', dismiss)
        document.addEventListener('keydown', escape)
        return () => {
            stop()
            window.removeEventListener(TOPOLOGY_TOOLTIP_DISMISS_EVENT, dismiss)
            window.removeEventListener('blur', dismiss)
            window.removeEventListener('resize', dismiss)
            document.removeEventListener('mousedown', dismiss, true)
            document.removeEventListener('wheel', dismiss, true)
            document.removeEventListener('scroll', dismiss, true)
            document.removeEventListener('visibilitychange', dismiss)
            document.removeEventListener('keydown', escape)
        }
    }, [open])
    return <Tooltip title={title} destroyOnHidden open={open} mouseEnterDelay={0.25}
        onOpenChange={visible => {
            if (visible && !anchor.current?.matches(':hover')) return
            if (visible) window.dispatchEvent(new Event(TOPOLOGY_TOOLTIP_DISMISS_EVENT))
            setOpen(visible)
        }}>
        <span ref={anchor} className={`topology-card-tooltip-anchor ${block ? 'is-block' : ''}`}>{children}</span>
    </Tooltip>
}

export const TopologyTypeIcon = ({ icon, iconClass, href }: { icon: string; iconClass?: string; href?: string }) =>
    <span className="topology-object-icon" aria-hidden="true">
        {href ? <img src={href} alt="" /> : <span className={`fa ${iconClass || ''}`}>{icon}</span>}
    </span>

const metricIcons = {
    cpu: ThunderboltOutlined, memory: BlockOutlined, pods: AppstoreOutlined, children: ApartmentOutlined,
    capacity: DatabaseOutlined, storage: DatabaseOutlined, 'storage-class': TagsOutlined,
    namespaces: FolderOutlined, nodes: HddOutlined, workloads: DeploymentUnitOutlined,
    vms: CloudServerOutlined, endpoints: LinkOutlined, replicas: BranchesOutlined
}

export const TopologyMetricChip = ({ metric }: { metric: TopologyMetric }) => {
    const Icon = metricIcons[metric.key] || ApartmentOutlined
    const resource = metric.key === 'cpu' || metric.key === 'memory'
    const tone = metric.percent !== undefined && metric.percent >= 90 ? 'critical'
        : metric.percent !== undefined && metric.percent >= 75 ? 'warning' : metric.key === 'cpu' ? 'cpu' : 'memory'
    return <div className={`topology-metric-chip ${resource ? 'is-resource' : ''} is-${tone} ${metric.percent !== undefined ? 'has-meter' : metric.description && metric.value !== '미수집' ? 'is-quantity' : ''}`}
        title={`${metric.label}: ${metric.value}${metric.description ? ` · ${metric.description}` : ''}`}>
        <span className="topology-metric-chip__line">
            <span className="topology-metric-chip__label"><Icon aria-hidden="true" /><span>{metric.label}</span></span>
            <strong>{metric.value}</strong>
        </span>
        {resource && (metric.percent !== undefined
            ? <Progress percent={metric.percent} showInfo={false} size={['100%', 7]}
                strokeColor={tone === 'critical' ? '#ff8a80' : tone === 'warning' ? '#ffc36b' : tone === 'cpu' ? '#35c99b' : '#5795ff'} railColor="var(--topology-metric-rail, #e9eff6)" />
            : <span className="topology-metric-chip__unavailable" aria-label="실시간 사용률 미수집" />)}
    </div>
}

export const TopologyObjectStatusBadge = ({ status }: { status: TopologyNodePresentation['status'] }) =>
    <TopologyCardTooltip title={status.description}>
        <Tag className={`topology-object-status is-${status.tone}`}>
            <span className="topology-object-status__dot" /><span className="topology-object-status__label">{status.label}</span>
        </Tag>
    </TopologyCardTooltip>

export const TopologyGroupHeaderSummary = ({ children }: { children: NonNullable<TopologyNodePresentation['children']> }) =>
    <div className="topology-group-summary" aria-label={`바로 아래 자원 ${children.total}개`}>
        <span className="topology-group-summary__total">자원 수 <strong>{children.total}</strong></span>
        <div className="topology-group-summary__states">{([
            ['normal', '정상'], ['warning', '하위 이상·확인 필요'], ['critical', '자체 이상'], ['inactive', '비활성']
        ] as const).filter(([key]) => key !== 'inactive' || children.inactive > 0).map(([key, label]) =>
            <TopologyCardTooltip key={key} title={`${key === 'normal' ? '자체와 하위 계층 모두 이상이 없는 자원' : key === 'warning' ? '자체 상태 확인이 필요하거나 하위 계층에 이상·미확인 상태가 있는 자원' : key === 'critical' ? '자체 상태에 이상이 있는 자원' : '현재 운영되지 않는 자원'} ${children[key]}개. 숫자는 바로 아래 자원 기준입니다.`}>
                <span className={`topology-group-summary__state is-${key}`} aria-label={`${label} ${children[key]}개`}>
                    <span className="topology-object-status__dot" /><span>{label}</span><strong>{children[key]}</strong>
                </span>
            </TopologyCardTooltip>)}</div>
    </div>

/** D3 owns positions and input delegation; this
 * component keeps the same presentation inside one SVG foreignObject. */
export const TopologyNodeCard = React.memo(({ model, icon, iconClass, href, onToggle }: {
    model: TopologyNodePresentation; icon: string; iconClass?: string; href?: string; onToggle: () => void
}) => <><foreignObject className="topology-object-foreign" x={-model.width / 2} y={-model.height / 2}
    width={model.width} height={model.height}>
    <ConfigProvider theme={{ token: { fontSize: 14, fontFamily: 'var(--netdive-font-family)' } }}>
        <article className={`topology-object-card is-${model.size} ${model.group ? 'is-group' : model.size === 'large' ? '' : 'is-tile'}`}
            aria-label={`${model.kind}: ${model.name}`}>
            <div className="topology-object-card__header">
                <TopologyTypeIcon icon={icon} iconClass={iconClass} href={href} />
                <div className="topology-object-card__identity">
                    <TopologyCardTooltip title={model.name} block>
                        <strong className="topology-object-card__name">{model.name}</strong>
                    </TopologyCardTooltip>
                    <span className="topology-object-card__subtitle" title={model.subtitle}>{model.subtitle}</span>
                </div>
                {(!model.group || model.status.tone === 'critical' || model.status.tone === 'inactive') && <TopologyObjectStatusBadge status={model.status} />}
                {model.expandable && <Button type="text" size="small" className="topology-object-card__toggle"
                    aria-label={model.expanded ? '하위 자원 접기' : '하위 자원 펼치기'}
                    aria-expanded={model.expanded} title={model.expanded ? '하위 자원 접기' : '하위 자원 펼치기'}
                    icon={model.expanded ? <UpOutlined /> : <DownOutlined />}
                    onMouseDown={event => event.stopPropagation()}
                    onDoubleClick={event => event.stopPropagation()}
                    onClick={event => { event.stopPropagation(); onToggle() }} />}
            </div>
            {model.group && model.children ? <TopologyGroupHeaderSummary children={model.children} /> :
                model.metrics.length > 0 && <div className="topology-object-card__metrics">
                    {model.metrics.map(metric => <TopologyMetricChip key={metric.key} metric={metric} />)}
                </div>}
        </article>
    </ConfigProvider>
</foreignObject>
    {!model.group && <TopologyStatusBadgeRail badges={model.badges} summary={model.badgeSummary}
        x={model.width / 2 - 15} y={-model.height / 2} />}
</>)
