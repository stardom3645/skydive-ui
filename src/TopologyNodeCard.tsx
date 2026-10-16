import * as React from 'react'
import { ConfigProvider, Progress, Tag, Tooltip } from 'antd'
import { ThunderboltOutlined, BlockOutlined, AppstoreOutlined, WindowsOutlined, LinuxOutlined, AppleOutlined, CodeOutlined, QuestionCircleOutlined,
    ApartmentOutlined, DatabaseOutlined, FolderOutlined, HddOutlined, DeploymentUnitOutlined,
    CloudServerOutlined, LinkOutlined, BranchesOutlined, TagsOutlined, PoweroffOutlined, GlobalOutlined, SafetyOutlined, ReloadOutlined } from '@ant-design/icons'
import { TopologyNodePresentation, TopologyMetric } from './TopologyNodePresentation'
import { TOPOLOGY_TOOLTIP_DISMISS_EVENT, watchTopologyTooltipAnchor } from './TopologyTooltipAnchor'
import { TopologyStatusBadgeRail, TOPOLOGY_STATUS_BADGE_RADIUS } from './TopologyStatusBadge'
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

const TopologyVMIcons = ({ model, icon, iconClass, href }: { model: TopologyNodePresentation; icon: string; iconClass?: string; href?: string }) => {
    const os = model.operatingSystem
    const vm = <TopologyTypeIcon icon={icon} iconClass={iconClass} href={href} />
    if (!os) return vm
    const icons = { windows: WindowsOutlined, apple: AppleOutlined, linux: LinuxOutlined,
        other: CodeOutlined, unknown: QuestionCircleOutlined }
    const Icon = icons[os.family]
    return <span className="topology-object-card__vm-icons">{vm}<TopologyCardTooltip title={os.name}>
        <span className="topology-object-icon topology-object-card__os-icon" role="img" aria-label={`운영체제: ${os.name}`}><Icon aria-hidden="true" /></span>
    </TopologyCardTooltip></span>
}

const metricIcons = {
    cpu: ThunderboltOutlined, memory: BlockOutlined, pods: AppstoreOutlined, children: ApartmentOutlined,
    capacity: DatabaseOutlined, storage: DatabaseOutlined, 'root-disk': HddOutlined, 'storage-class': TagsOutlined,
    'access-modes': SafetyOutlined, 'reclaim-policy': ReloadOutlined,
    namespaces: FolderOutlined, nodes: CloudServerOutlined, workloads: DeploymentUnitOutlined,
    vms: CloudServerOutlined, endpoints: LinkOutlined, replicas: BranchesOutlined,
    'service-role': DeploymentUnitOutlined, 'service-state': PoweroffOutlined,
    'service-ip': GlobalOutlined, 'service-host': CloudServerOutlined, 'service-agent': LinkOutlined
}

export const TopologyMetricChip = ({ metric, emptyMeter = true, showSource = true }: { metric: TopologyMetric; emptyMeter?: boolean; showSource?: boolean }) => {
    const Icon = metricIcons[metric.key] || ApartmentOutlined
    const resource = ['cpu', 'memory', 'root-disk'].includes(metric.key)
    const tone = metric.percent !== undefined && metric.percent >= 90 ? 'critical'
        : metric.percent !== undefined && metric.percent >= 75 ? 'warning' : metric.key === 'cpu' ? 'cpu' : 'memory'
    const count = ['pods', 'children', 'namespaces', 'nodes', 'workloads', 'storage', 'vms', 'endpoints', 'replicas'].includes(metric.key)
    return <div className={`topology-metric-chip ${count ? 'is-count' : ''} ${resource ? 'is-resource' : ''} ${metric.key === 'root-disk' ? 'is-root-disk' : metric.key === 'vms' ? 'is-vm-count' : ''} is-${tone} ${metric.percent !== undefined ? 'has-meter' : metric.description && metric.value !== '미수집' ? 'is-quantity' : ''}`}
        title={`${metric.label}: ${metric.value}${showSource && metric.description ? ` · ${metric.description}` : ''}`}>
        <span className="topology-metric-chip__line">
            <span className="topology-metric-chip__label"><Icon aria-hidden="true" /><span>{metric.label}</span></span>
            {metric.key.startsWith('service-') ? <TopologyCardTooltip title={metric.value} block>
                <strong className="topology-service-information__value">{metric.value}</strong>
            </TopologyCardTooltip> : <strong>{metric.value}</strong>}
        </span>
        {resource && metric.source !== 'inventory' && (metric.percent !== undefined
            ? <Progress percent={metric.percent} showInfo={false} size={['100%', 7]}
                strokeColor={tone === 'critical' ? '#ff8a80' : tone === 'warning' ? '#ffc36b' : tone === 'cpu' ? '#35c99b' : '#5795ff'} railColor="var(--topology-metric-rail, #e9eff6)" />
            : emptyMeter ? <span className="topology-metric-chip__unavailable" aria-label="실시간 사용률 미수집" /> : null)}
        {showSource && metric.sourceLabel && <span className="topology-metric-chip__source">{metric.sourceLabel}</span>}
    </div>
}

export const TopologyObjectStatusBadge = ({ status }: { status: TopologyNodePresentation['status'] }) =>
    <TopologyCardTooltip title={status.description}>
        <Tag className={`topology-object-status is-${status.tone}`}>
            <span className="topology-object-status__dot" /><span className="topology-object-status__label">{status.label}</span>
        </Tag>
    </TopologyCardTooltip>

export const TopologyGroupHeaderSummary = ({ children, compactLabels = false, separateInactive = false, normalLabel = '정상' }: {
    children: NonNullable<TopologyNodePresentation['children']>; compactLabels?: boolean; separateInactive?: boolean; normalLabel?: string
}) =>
    <div className="topology-group-summary" aria-label={`직전 하위 자원 ${children.total}개`}>
        <span className="topology-group-summary__total">자원 수 <strong>{children.total}</strong></span>
        <div className="topology-group-summary__states">{([
            ['normal', normalLabel], ['warning', '하위 이상·확인 필요'], ['critical', '자체 이상'], ['inactive', '비활성']
        ] as const).filter(([key]) => key !== 'inactive' || (children.inactive > 0 && !separateInactive)).map(([key, label]) =>
            <TopologyCardTooltip key={key} title={`${key === 'normal' ? '자체와 하위 계층 모두 이상이 없는 자원' : key === 'warning' ? '자체 상태 확인이 필요하거나 하위 계층에 이상·미확인 상태가 있는 자원' : key === 'critical' ? '자체 상태에 이상이 있는 자원' : '현재 운영되지 않는 자원'} ${children[key]}개. 숫자는 직전 하위 자원(바로 아래 계층) 기준입니다.`}>
                <span className={`topology-group-summary__state is-${key}`} aria-label={`${label} ${children[key]}개`}>
                    <span className="topology-object-status__dot" /><span className="topology-group-summary__state-label">{compactLabels && key === 'warning' ? '하위 이상' : label}</span><strong>{children[key]}</strong>
                </span>
            </TopologyCardTooltip>)}</div>
        {separateInactive && children.inactive > 0 && <TopologyCardTooltip title={`현재 운영되지 않는 직전 하위 자원 ${children.inactive}개입니다.`} block>
            <span className="topology-group-summary__inactive">비활성 <strong>{children.inactive}</strong></span>
        </TopologyCardTooltip>}
    </div>

const TopologyLinkStateSummary = ({ states }: { states: NonNullable<TopologyNodePresentation['linkStates']> }) =>
    <TopologyCardTooltip title="직전 하위 네트워크 자원의 실제 동작 상태입니다. Down은 연결이 내려간 상태이며, 자체로 오류를 뜻하지 않습니다. 이상 판정과 별도로 집계합니다." block>
        <div className="topology-link-state-summary" aria-label={`동작 상태 Up ${states.up}개, Down ${states.down}개, 미확인 ${states.unknown}개`}>
            <span>동작 상태</span><span>Up <strong>{states.up}</strong></span><span>Down <strong>{states.down}</strong></span>
            {states.unknown > 0 && <span>미확인 <strong>{states.unknown}</strong></span>}
        </div>
    </TopologyCardTooltip>

const TopologyResourceGroupSummary = ({ model }: { model: TopologyNodePresentation }) => {
    const counts = model.children!
    return <div className={`topology-resource-group-summary ${model.linkStates ? 'has-link-state' : ''} ${counts.inactive > 0 ? 'has-inactive' : ''}`}>
        <div className="topology-resource-group-summary__counts">
            <TopologyCardTooltip title="그룹과 그 아래 모든 계층에서 수집된 전체 자원 수입니다. 화면 구성용 그룹과 종료된 Kubernetes Pod는 제외합니다." block>
                <span>전체 자원</span><strong>{model.groupResourceCount ?? counts.total}</strong>
            </TopologyCardTooltip>
            <TopologyCardTooltip title="직전 하위 자원은 그룹의 바로 아래 계층에 속한 자원입니다. 더 아래 계층은 제외하며, 상태 분포도 이 자원들을 기준으로 집계합니다." block>
                <span>직전 하위 자원</span><strong>{counts.total}</strong>
            </TopologyCardTooltip>
        </div>
        <div className="topology-resource-group-summary__distribution">
            <div className="topology-resource-group-summary__heading"><span>{model.infrastructure ? '이상 판정' : '상태 분포'}</span></div>
            <TopologyGroupHeaderSummary children={counts} compactLabels separateInactive normalLabel={model.infrastructure ? '이상 없음' : '정상'} />
            {!model.infrastructure && model.linkStates && model.height < 460 && <TopologyLinkStateSummary states={model.linkStates} />}
        </div>
        {model.infrastructure && !!model.linkStates && <TopologyLinkStateSummary states={model.linkStates} />}
    </div>
}

const TopologySystemVMServiceSummary = ({ information }: {
    information: NonNullable<TopologyNodePresentation['systemVMInformation']>
}) => <div className="topology-system-vm-information">
    <div className="topology-system-vm-information__role-row">
        <span className="topology-system-vm-information__role">{information.role}</span>
    </div>
    <div className="topology-system-vm-information__states topology-service-information">
        {[information.state, information.agent].map(metric => <TopologyMetricChip key={metric.key} metric={metric} />)}
    </div>
    <div className="topology-system-vm-information__footer" title={information.purpose}>
        {information.sessions !== undefined ? <TopologyCardTooltip title="Mold가 보고한 현재 활성 콘솔 세션 수입니다. 0은 연결 중인 콘솔이 없다는 뜻이며 이상 상태가 아닙니다." block>
            <span className="topology-system-vm-information__sessions"><span>활성 콘솔 세션</span><strong>{information.sessions}<small>개</small></strong></span>
        </TopologyCardTooltip> : <span className="topology-system-vm-information__purpose">{information.purpose}</span>}
    </div>
</div>

/** D3 owns positions and input delegation; this
 * component keeps the same presentation inside one SVG foreignObject. */
export const TopologyNodeCard = React.memo(({ model, icon, iconClass, href }: {
    model: TopologyNodePresentation; icon: string; iconClass?: string; href?: string
}) => {
    const storage = !model.group && !model.infrastructure && ['persistentvolume', 'persistentvolumeclaim'].includes(model.resourceType)
    return <><foreignObject className="topology-object-foreign" x={-model.width / 2} y={-model.height / 2}
    width={model.width} height={model.height}>
    <ConfigProvider theme={{ token: { fontSize: 14, fontFamily: 'var(--netdive-font-family)' },
        components: { Tooltip: { colorBgSpotlight: '#374151' } } }}>
        <article className={`topology-object-card is-${model.size} ${model.group && !model.namespaceSummary ? `is-resource-group ${model.infrastructure ? 'is-infrastructure-resource-group' : 'is-kubernetes-resource-group'} ${!model.infrastructure && model.height < 360 ? 'is-short-kubernetes-group' : ''} ${model.height < 280 ? 'is-dense-group' : ''} ${model.height >= 460 ? 'is-tall-group' : ''}` : ''} ${!model.group ? `is-object-identity ${model.infrastructure ? 'is-infrastructure-object' : model.resourceType !== 'libvirt' ? 'is-kubernetes-object' : ''}` : ''} ${!model.group && model.resourceType === 'host' ? 'is-host' : ''} ${!model.group && !model.infrastructure && model.resourceType === 'cluster' ? 'is-cluster' : ''} ${!model.group && model.resourceType === 'libvirt' ? 'is-vm' : ''} ${model.group ? `is-group ${model.fullyExpanded ? 'is-group-expanded' : ''}` : model.size === 'large' ? '' : 'is-tile'}`}
            data-storage-information={storage || undefined}
            data-kubernetes-node={!model.infrastructure && !model.group && model.resourceType === 'node' || undefined}
            data-node-metric-source-hidden={!model.infrastructure && !model.group && model.resourceType === 'node'
                && model.metrics.some(metric => !!metric.sourceLabel) || undefined}
            aria-label={`${model.kind}: ${model.name}`}>
            <div className="topology-object-card__header" style={model.headerHeight ? { height: model.headerHeight } : undefined}>
                {model.linkState ? <span className="topology-object-card__operation">
                    <TopologyTypeIcon icon={icon} iconClass={iconClass} href={href} />
                    <TopologyCardTooltip title={`동작 상태 ${model.linkState}. Up/Down은 연결 상태이며 이상 판정과는 별개입니다.`}>
                        <Tag className="topology-object-link-state">{model.linkState}</Tag>
                    </TopologyCardTooltip>
                </span> : <TopologyVMIcons model={model} icon={icon} iconClass={iconClass} href={href} />}
                <div className="topology-object-card__identity">
                    <TopologyCardTooltip title={model.name} block>
                        <strong className="topology-object-card__name">{model.name}</strong>
                    </TopologyCardTooltip>
                    {(!model.infrastructure || model.group) && <span className="topology-object-card__subtitle" title={model.subtitle}>{model.subtitle}</span>}
                </div>
                {(!model.group || model.namespaceSummary || model.status.tone === 'critical' || model.status.tone === 'inactive') && <TopologyObjectStatusBadge status={model.status} />}
                {model.group && model.fullyExpanded && <span className="topology-object-card__group-state">전체 펼침</span>}
            </div>
            {!model.group && (model.infrastructure ? !!model.networkHeight || !!model.networkSummary?.trim() : model.resourceType === 'libvirt') && <div className="topology-object-card__network"
                style={model.networkHeight ? { height: model.networkHeight } : undefined}
                title={model.networkSummary || '연결 네트워크 정보가 없습니다.'}>
                <span className="topology-object-card__network-label">네트워크</span>
                {model.infrastructure ? <TopologyCardTooltip title={model.networkSummary || ''} block>
                    <span className="topology-object-card__network-name">{model.networkCount && model.networkCount > 1 ? `${model.networkCount}개` : model.networkSummary || '정보 없음'}</span>
                </TopologyCardTooltip> : <span className="topology-object-card__network-name">{model.networkCount && model.networkCount > 1 ? `${model.networkCount}개` : model.networkSummary || '정보 없음'}</span>}
            </div>}
            {model.group && !model.namespaceSummary && model.children ? <TopologyResourceGroupSummary model={model} /> : model.group && model.children ? <TopologyGroupHeaderSummary children={model.children} /> :
                model.systemVMInformation ? <TopologySystemVMServiceSummary information={model.systemVMInformation} /> :
                model.metrics.length > 0 && <div className={`topology-object-card__metrics ${model.serviceVM ? 'topology-service-information' : ''}`}
                    style={storage ? { gridTemplateRows: `repeat(${model.metrics.length}, minmax(0, 1fr))` }
                        : model.metricRowHeights ? { gridTemplateRows: model.metricRowHeights.map(height => `${height}px`).join(' ') } : undefined}>
                    {model.metrics.map(metric => <TopologyMetricChip key={metric.key} metric={metric}
                        showSource={model.infrastructure || model.group || model.resourceType !== 'node'} />)}
                </div>}
        </article>
    </ConfigProvider>
</foreignObject>
    {(!model.group || model.namespaceSummary) && <TopologyStatusBadgeRail badges={model.badges} summary={model.badgeSummary}
        x={model.width / 2 - TOPOLOGY_STATUS_BADGE_RADIUS} y={-model.height / 2 - TOPOLOGY_STATUS_BADGE_RADIUS / 2} />}
</>})
