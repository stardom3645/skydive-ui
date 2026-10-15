import * as React from 'react'
import { Input, Popover, Tooltip, Empty, Segmented, Dropdown, Button } from 'antd'
import { ApartmentOutlined, SearchOutlined, CheckOutlined, NodeIndexOutlined, UnorderedListOutlined, DownOutlined } from '@ant-design/icons'
import { moldNetworkChoices, moldNetworkChoiceName, moldNetworkChoiceCatalog, moldNetworkChoiceMetadata, moldNetworkCommonZone, MoldNetworkTypeFilter, MoldNetworkSort } from './MoldNetworkChoices'
import { MoldNICNetwork } from './MoldTopologyNetworks'
import { TopologyToolbarButton } from './TopologyToolbarButton'
import './MoldNetworkViewControl.css'

const NetworkChoiceName = ({ name }: { name: string }) => {
    const ref = React.useRef<HTMLElement>(null)
    const [truncated, setTruncated] = React.useState(false)
    const measure = () => setTruncated(!!ref.current && ref.current.scrollWidth > ref.current.clientWidth)
    React.useLayoutEffect(() => {
        measure()
        const observer = new ResizeObserver(measure)
        if (ref.current) observer.observe(ref.current)
        return () => observer.disconnect()
    }, [name])
    return <Tooltip title={truncated ? name : undefined} mouseEnterDelay={0.35}>
        <strong ref={ref} onMouseEnter={measure}>{name}</strong>
    </Tooltip>
}

export const MoldNetworkViewControl = ({ networks, linkedNetworks, value, onChange, classes }: {
    networks: MoldNICNetwork[]; linkedNetworks?: MoldNICNetwork[]; value?: string; onChange: (value?: string) => void; classes?: Record<string, string>
}) => {
    const [open, setOpen] = React.useState(false), [search, setSearch] = React.useState('')
    const [type, setType] = React.useState<MoldNetworkTypeFilter>('all')
    const [sort, setSort] = React.useState<MoldNetworkSort>('oldest')
    const [sortOpen, setSortOpen] = React.useState(false)
    const triggerRef = React.useRef<HTMLButtonElement>(null), listRef = React.useRef<HTMLDivElement>(null)
    const menuID = React.useId()
    const choices = React.useMemo(() => moldNetworkChoiceCatalog(networks, linkedNetworks).filter(network => !!network.networkId), [networks, linkedNetworks])
    const selected = choices.find(network => network.networkId!.toLowerCase() === value?.toLowerCase())
    const commonZone = React.useMemo(() => moldNetworkCommonZone(choices), [choices])
    const filtered = React.useMemo(() => moldNetworkChoices(choices, search, type, sort), [choices, search, type, sort])
    const choose = (id?: string) => { onChange(id); setOpen(false); setSortOpen(false); setSearch(''); triggerRef.current?.focus({ preventScroll: true }) }
    const navigate = (event: React.KeyboardEvent) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        const options = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button[role="option"]') || [])
        if (!options.length) return
        event.preventDefault()
        const index = options.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
            : event.key === 'ArrowDown' ? (index + 1) % options.length : index < 0 ? options.length - 1 : (index + options.length - 1) % options.length
        options[next].focus()
    }
    return <Popover trigger="click" placement="bottomLeft" open={open}
        getPopupContainer={trigger => trigger.parentElement || document.body}
        onOpenChange={next => { setOpen(next); if (next) setSearch(''); else setSortOpen(false) }}
        classNames={{ root: 'netdive-mold-popover mold-network-view-popover' }}
        content={<div className="mold-network-view-menu" id={menuID} role="dialog" aria-label="네트워크별 보기"
            onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); setSortOpen(false); triggerRef.current?.focus({ preventScroll: true }) } }}>
            <div className="mold-network-view-menu__header"><strong className="mold-network-view-menu__title">네트워크별 보기</strong><ApartmentOutlined aria-hidden="true" /></div>
            <Input size="middle" allowClear value={search} onChange={event => setSearch(event.target.value)} prefix={<SearchOutlined />}
                onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); (listRef.current?.querySelector<HTMLButtonElement>('button[aria-selected="true"]') || listRef.current?.querySelector<HTMLButtonElement>('button[role="option"]'))?.focus() } }}
                aria-label="Mold 네트워크 검색" placeholder="네트워크 이름, CIDR, Zone 검색" />
            <div className="mold-network-view-menu__filters">
                <Segmented block size="middle" aria-label="네트워크 유형" value={type}
                    options={[{ label: '전체', value: 'all' }, 'Isolated', 'L2', 'Shared']}
                    onChange={value => setType(value as MoldNetworkTypeFilter)} />
            </div>
            <div className="mold-network-view-menu__count">
                <span>네트워크 {filtered.length}개{filtered.length !== choices.length ? ` / 전체 ${choices.length}개` : ''}</span>
                <Dropdown trigger={['click']} placement="bottomRight" open={sortOpen} onOpenChange={setSortOpen}
                    getPopupContainer={trigger => trigger.closest('.mold-network-view-menu') as HTMLElement || document.body}
                    menu={{ selectable: true, selectedKeys: [sort], items: [{ key: 'oldest', label: '오래된 순' }, { key: 'newest', label: '최신 순' }],
                        onClick: ({ key }) => { setSort(key as MoldNetworkSort); setSortOpen(false) } }}>
                    <Button type="text" size="small" className="mold-network-view-menu__sort" aria-label="네트워크 생성일 정렬"
                        aria-haspopup="menu" aria-expanded={sortOpen}>{sort === 'oldest' ? '오래된 순' : '최신 순'}<DownOutlined aria-hidden="true" /></Button>
                </Dropdown>
            </div>
            <div className="mold-network-view-menu__list" role="listbox" aria-label="Mold 네트워크" ref={listRef} onKeyDown={navigate}>
                <button type="button" role="option" aria-selected={!value} className="mold-network-view-menu__option" onClick={() => choose()}>
                    <UnorderedListOutlined className="mold-network-view-menu__network-icon" aria-hidden="true" />
                    <span><strong>전체 보기</strong><small>네트워크 강조 해제</small></span>{!value && <CheckOutlined />}
                </button>
                {filtered.map(network => <button key={network.networkId} type="button" role="option" aria-selected={network.networkId!.toLowerCase() === value?.toLowerCase()}
                        className="mold-network-view-menu__option" onClick={() => choose(network.networkId!.toLowerCase())}>
                        <NodeIndexOutlined className="mold-network-view-menu__network-icon" aria-hidden="true" />
                        <span><NetworkChoiceName name={moldNetworkChoiceName(network)} />
                            <small>
                                <span>{moldNetworkChoiceMetadata(network).join(' · ')}</span>
                                {!commonZone && network.zoneName?.trim() && <span className="mold-network-view-menu__zone">
                                    {moldNetworkChoiceMetadata(network).length > 0 ? ' · ' : ''}{network.zoneName.trim()}
                                </span>}
                            </small></span>
                        {network.networkId!.toLowerCase() === value?.toLowerCase() && <CheckOutlined />}
                    </button>)}
                {!filtered.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search || type !== 'all' ? '조건에 맞는 네트워크가 없습니다.' : '조회된 Mold 네트워크가 없습니다.'} />}
            </div>
        </div>}>
        <TopologyToolbarButton ref={triggerRef} classes={classes} title="네트워크별 보기" icon={<ApartmentOutlined />}
            data-netdive-network-view="true"
            aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? menuID : undefined}
            summary={selected ? moldNetworkChoiceName(selected) : (value ? '선택 네트워크' : '전체 보기')} />
    </Popover>
}
