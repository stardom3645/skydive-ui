import * as React from 'react'
import { Button, theme } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import './ScrollableDetailTabBar.css'

interface Item { key: string; label: React.ReactNode; disabled?: boolean }
interface Props {
    id?: string; activeKey: string; items: Item[]; rtl?: boolean
    onTabClick: (key: string, event: React.MouseEvent | React.KeyboardEvent) => void
}

/** Native scrolling navigation for Ant Tabs' public renderTabBar API.
 * Ant Tabs continues to own selection and panel mounting. */
export function ScrollableDetailTabBar({ id, activeKey, items, rtl = false, onTabClick }: Props) {
    const { token } = theme.useToken()
    const viewportRef = React.useRef<HTMLDivElement>(null)
    const listRef = React.useRef<HTMLDivElement>(null)
    const buttons = React.useRef(new Map<string, HTMLButtonElement>())
    const [edges, setEdges] = React.useState({ overflow: false, left: false, right: false })
    const [focusKey, setFocusKey] = React.useState<string>()
    const keys = JSON.stringify(items.map(item => [item.key, !!item.disabled]))
    const fallbackID = React.useId()
    const tabID = id || fallbackID

    const measure = React.useCallback(() => {
        const viewport = viewportRef.current
        if (!viewport) return
        const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
        const position = rtl ? max + viewport.scrollLeft : viewport.scrollLeft
        const next = { overflow: max > 1, left: position > 1, right: position < max - 1 }
        setEdges(old => old.overflow === next.overflow && old.left === next.left && old.right === next.right ? old : next)
    }, [rtl])
    const reveal = React.useCallback((key: string) => {
        const viewport = viewportRef.current, button = buttons.current.get(key)
        if (!viewport || !button) return
        const view = viewport.getBoundingClientRect(), tab = button.getBoundingClientRect()
        const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
        const position = rtl ? max + viewport.scrollLeft : viewport.scrollLeft
        // Keep a revealed label clear of the overflow fades at either edge.
        const left = view.left + (position > 1 ? 20 : 0), right = view.right - (position < max - 1 ? 20 : 0)
        const delta = tab.width > right - left || tab.left < left ? tab.left - left : tab.right > right ? tab.right - right : 0
        if (Math.abs(delta) > 0.5) viewport.scrollBy({ left: delta, behavior: 'auto' })
        measure()
    }, [measure, rtl])
    React.useLayoutEffect(() => { reveal(activeKey) }, [activeKey, keys, reveal, edges.overflow])
    React.useEffect(() => {
        const viewport = viewportRef.current, list = listRef.current
        if (!viewport || !list) return
        const resize = () => { measure(); reveal(activeKey) }
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : undefined
        observer?.observe(viewport)
        observer?.observe(list)
        window.addEventListener('resize', resize)
        // A non-passive listener maps a vertical mouse wheel to horizontal
        // scrolling, while preserving normal page scrolling at either edge.
        const wheel = (event: WheelEvent) => {
            if (event.ctrlKey || viewport.scrollWidth <= viewport.clientWidth + 1) return
            const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientWidth : 1
            const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * scale
            const max = viewport.scrollWidth - viewport.clientWidth
            const position = rtl ? max + viewport.scrollLeft : viewport.scrollLeft
            if (!delta || delta < 0 && position <= 1 || delta > 0 && position >= max - 1) return
            event.preventDefault()
            viewport.scrollBy({ left: delta, behavior: 'auto' })
        }
        viewport.addEventListener('wheel', wheel, { passive: false })
        return () => { observer?.disconnect(); window.removeEventListener('resize', resize); viewport.removeEventListener('wheel', wheel) }
    }, [activeKey, measure, reveal, rtl])

    const page = (direction: number) => {
        const viewport = viewportRef.current
        if (!viewport) return
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        viewport.scrollBy({ left: direction * Math.max(80, viewport.clientWidth * .75), behavior: reduced ? 'auto' : 'smooth' })
    }
    const navigate = (event: React.KeyboardEvent<HTMLButtonElement>, key: string) => {
        const enabled = items.filter(item => !item.disabled)
        const index = enabled.findIndex(item => item.key === key)
        let target: Item | undefined
        if (event.key === 'Home') target = enabled[0]
        else if (event.key === 'End') target = enabled[enabled.length - 1]
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            const step = (event.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1)
            target = enabled[(index + step + enabled.length) % enabled.length]
        }
        if (target) {
            event.preventDefault()
            buttons.current.get(target.key)?.focus({ preventScroll: true })
            reveal(target.key)
        }
        // Native button Enter/Space activation preserves Ant Tabs' manual
        // keyboard activation, without changing selection on arrow navigation.
    }
    const variables = {
        '--detail-tabs-color': token.colorTextSecondary, '--detail-tabs-active': token.colorPrimary,
        '--detail-tabs-border': token.colorBorderSecondary, '--detail-tabs-hover': token.colorFillQuaternary,
        '--detail-tabs-pill': token.colorFillSecondary, '--detail-tabs-pill-text': token.colorTextSecondary,
        '--detail-tabs-pill-active': token.colorPrimaryBg, '--detail-tabs-radius': `${token.borderRadiusSM}px`,
        '--detail-tabs-font': `${token.fontSizeSM}px`, '--detail-tabs-height': `${token.controlHeightLG}px`,
        '--detail-tabs-gap': `${token.marginXS}px`, '--detail-tabs-padding': `${token.paddingSM}px`,
        '--detail-tabs-outline': token.colorPrimaryBorder, '--detail-tabs-surface': token.colorBgContainer
    } as React.CSSProperties
    return <div className="netdive-detail-tab-bar" style={variables}>
        {edges.overflow && <Button type="text" size="small" className="netdive-detail-tab-bar__arrow" aria-label="이전 탭 보기"
            disabled={!edges.left} icon={<LeftOutlined />} onClick={() => page(-1)} />}
        <div className="netdive-detail-tab-bar__scroller">
            <div ref={viewportRef} className="netdive-detail-tab-bar__viewport" role="tablist" aria-label="객체 상세 정보" aria-orientation="horizontal"
                onScroll={measure} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocusKey(undefined) }}>
                <div ref={listRef} className="netdive-detail-tab-bar__list">
                    {items.map(item => <button key={item.key} ref={node => { if (node) buttons.current.set(item.key, node); else buttons.current.delete(item.key) }}
                        type="button" role="tab" className="netdive-detail-tab" id={`${tabID}-tab-${item.key}`} aria-controls={`${tabID}-panel-${item.key}`}
                        aria-selected={item.key === activeKey} aria-disabled={item.disabled || undefined} disabled={item.disabled}
                        tabIndex={!item.disabled && item.key === (focusKey || activeKey) ? 0 : -1}
                        onFocus={() => { setFocusKey(item.key); reveal(item.key) }} onKeyDown={event => navigate(event, item.key)}
                        onClick={event => onTabClick(item.key, event)}>{item.label}</button>)}
                </div>
            </div>
            {edges.overflow && edges.left && <span className="netdive-detail-tab-bar__fade is-left" aria-hidden="true" />}
            {edges.overflow && edges.right && <span className="netdive-detail-tab-bar__fade is-right" aria-hidden="true" />}
        </div>
        {edges.overflow && <Button type="text" size="small" className="netdive-detail-tab-bar__arrow" aria-label="다음 탭 보기"
            disabled={!edges.right} icon={<RightOutlined />} onClick={() => page(1)} />}
    </div>
}
