/** Keep the whole card readable, without changing its content at overview zoom.
 * Layout and edge bounds use this same scale to reserve space for the card. */
export function topologyCardPresentationScale(zoom: number): number {
    const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
    return Math.max(1, 0.72 / safeZoom)
}
