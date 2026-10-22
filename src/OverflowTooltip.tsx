import * as React from 'react'
import { Tooltip } from 'antd'
import type { TooltipProps, TooltipRef } from 'antd'

/** Check the painted text, including line clamps and nested name cells. Inline
 * wrappers without a layout box are not themselves evidence of truncation. */
export const hasClippedText = (root: HTMLElement | null | undefined, selector?: string): boolean => {
    if (!root) return false
    const elements = selector ? Array.from(root.querySelectorAll<HTMLElement>(selector))
        : [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
    return elements.some(element => (element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1)
        || (element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1))
}

type Props = Omit<TooltipProps, 'open' | 'defaultOpen' | 'onOpenChange'> & {
    children: React.ReactElement
    overflowSelector?: string
    /** Explicit extra information or a name shortened before DOM rendering. */
    force?: boolean
}

/** Adds no layout wrapper. Measure at hover/focus time so resizing, wrapping
 * and freshly updated values never leave a stale "truncated" decision. */
export const OverflowTooltip = ({ children, overflowSelector, force = false, ...props }: Props) => {
    const anchor = React.useRef<TooltipRef>(null)
    const [open, setOpen] = React.useState(false)
    React.useEffect(() => setOpen(false), [props.title])
    return <Tooltip {...props} ref={anchor} open={open} destroyOnHidden
        onOpenChange={next => setOpen(next && (force || hasClippedText(anchor.current?.nativeElement, overflowSelector)))}>
        {children}
    </Tooltip>
}
