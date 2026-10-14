import * as React from 'react'
import { Input, Popover, Tooltip, Empty } from 'antd'
import { ApartmentOutlined, SearchOutlined, CheckOutlined } from '@ant-design/icons'
import { MoldNICNetwork } from './MoldTopologyNetworks'
import { TopologyToolbarButton } from './TopologyToolbarButton'
import './MoldNetworkViewControl.css'

export const MoldNetworkViewControl = ({ networks, value, onChange, classes }: {
    networks: MoldNICNetwork[]; value?: string; onChange: (value?: string) => void; classes?: Record<string, string>
}) => {
    const [open, setOpen] = React.useState(false), [search, setSearch] = React.useState('')
    const triggerRef = React.useRef<HTMLButtonElement>(null), listRef = React.useRef<HTMLDivElement>(null)
    const menuID = React.useId()
    const choices = networks.filter(network => !!network.networkId)
    const selected = choices.find(network => network.networkId!.toLowerCase() === value?.toLowerCase())
    const filtered = choices.filter(network => [network.networkName, network.networkId, network.networkType, network.cidr,
        network.zoneName, network.vlan].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase()))
    const choose = (id?: string) => { onChange(id); setOpen(false); setSearch(''); triggerRef.current?.focus({ preventScroll: true }) }
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
        onOpenChange={next => { setOpen(next); if (next) setSearch('') }}
        classNames={{ root: 'netdive-mold-popover mold-network-view-popover' }}
        content={<div className="mold-network-view-menu" id={menuID} role="dialog" aria-label="네트워크별 보기"
            onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus({ preventScroll: true }) } }}>
            <strong className="mold-network-view-menu__title">네트워크별 보기</strong>
            <Input allowClear value={search} onChange={event => setSearch(event.target.value)} prefix={<SearchOutlined />}
                onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); (listRef.current?.querySelector<HTMLButtonElement>('button[aria-selected="true"]') || listRef.current?.querySelector<HTMLButtonElement>('button[role="option"]'))?.focus() } }}
                aria-label="Mold 네트워크 검색" placeholder="네트워크 이름, CIDR, Zone 검색" />
            <div className="mold-network-view-menu__list" role="listbox" aria-label="Mold 네트워크" ref={listRef} onKeyDown={navigate}>
                <button type="button" role="option" aria-selected={!value} className="mold-network-view-menu__option" onClick={() => choose()}>
                    <span><strong>전체 보기</strong><small>네트워크 강조 해제</small></span>{!value && <CheckOutlined />}
                </button>
                {filtered.map(network => <Tooltip key={network.networkId} title={[network.networkName, network.networkType, network.cidr, network.zoneName].filter(Boolean).join(' · ')}>
                    <button type="button" role="option" aria-selected={network.networkId!.toLowerCase() === value?.toLowerCase()}
                        className="mold-network-view-menu__option" onClick={() => choose(network.networkId!.toLowerCase())}>
                        <span><strong>{network.networkName || network.networkId}</strong>
                            <small>{[network.networkType, network.cidr, network.zoneName].filter(Boolean).join(' · ') || '네트워크 정보'}</small></span>
                        {network.networkId!.toLowerCase() === value?.toLowerCase() && <CheckOutlined />}
                    </button>
                </Tooltip>)}
                {!filtered.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search ? '일치하는 네트워크가 없습니다.' : '조회된 Mold 네트워크가 없습니다.'} />}
            </div>
        </div>}>
        <TopologyToolbarButton ref={triggerRef} classes={classes} title="네트워크별 보기" icon={<ApartmentOutlined />}
            data-netdive-network-view="true"
            aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? menuID : undefined}
            summary={selected?.networkName || (value ? '선택 네트워크' : '전체 보기')} />
    </Popover>
}
