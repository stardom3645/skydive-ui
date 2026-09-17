export const TOPOLOGY_TOOLTIP_DISMISS_EVENT = 'netdive:topology-tooltip-dismiss'

type AnchorRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>

export const topologyTooltipAnchorValid = (
    connected: boolean,
    rect: AnchorRect,
    initial: AnchorRect,
    viewport: { width: number, height: number }
): boolean => connected
    && [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
    && rect.width > 0 && rect.height > 0
    && rect.left < viewport.width && rect.top < viewport.height
    && rect.left + rect.width > 0 && rect.top + rect.height > 0
    && Math.abs(rect.left - initial.left) <= 0.5
    && Math.abs(rect.top - initial.top) <= 0.5
    && Math.abs(rect.width - initial.width) <= 0.5
    && Math.abs(rect.height - initial.height) <= 0.5

/** SVG transforms do not notify ResizeObserver or Ant's window-resize alignment.
 * Watch only while a tooltip is open; dispose the frame on close/unmount. */
export const watchTopologyTooltipAnchor = (
    anchor: Pick<Element, 'isConnected' | 'getBoundingClientRect'>,
    dismiss: () => void,
    environment = {
        request: (callback: FrameRequestCallback) => window.requestAnimationFrame(callback),
        cancel: (id: number) => window.cancelAnimationFrame(id),
        viewport: () => ({ width: window.innerWidth, height: window.innerHeight })
    }
): (() => void) => {
    const initial = anchor.getBoundingClientRect()
    let frame = 0
    let stopped = false
    const check = () => {
        if (stopped) return
        if (!topologyTooltipAnchorValid(anchor.isConnected, anchor.getBoundingClientRect(), initial, environment.viewport())) {
            stopped = true
            dismiss()
            return
        }
        frame = environment.request(check)
    }
    check()
    return () => {
        stopped = true
        environment.cancel(frame)
    }
}
