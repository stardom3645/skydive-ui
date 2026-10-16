import { CompactRoute, RoutePoint, RoutingCard } from './InfrastructureCompactRouting'

export interface TrafficLabelBounds extends RoutingCard { route?: CompactRoute }

/** Place measured SVG label rectangles together, rather than independently
 * choosing the same midpoint for every edge in a shared corridor. */
export function separateTrafficLabels(labels: TrafficLabelBounds[], cards: RoutingCard[]): Map<string, RoutePoint> {
    const gap = 12
    const positions = new Map<string, RoutePoint>()
    const overlaps = (a: RoutingCard, b: RoutingCard) =>
        Math.abs(a.x - b.x) * 2 < a.width + b.width + gap * 2
        && Math.abs(a.y - b.y) * 2 < a.height + b.height + gap * 2
    // Query only neighboring rectangles; a dense topology must not scan all
    // cards and all earlier labels for every candidate position.
    const cells = new Map<string, RoutingCard[]>(), cellSize = 256
    const visitCells = (bounds: RoutingCard, padding: number, visit: (key: string) => boolean) => {
        for (let x = Math.floor((bounds.x - bounds.width / 2 - padding) / cellSize);
            x <= Math.floor((bounds.x + bounds.width / 2 + padding) / cellSize); x++) {
            for (let y = Math.floor((bounds.y - bounds.height / 2 - padding) / cellSize);
                y <= Math.floor((bounds.y + bounds.height / 2 + padding) / cellSize); y++) {
                if (!visit(`${x}:${y}`)) return false
            }
        }
        return true
    }
    let rightmost = -Infinity
    const reserve = (bounds: RoutingCard) => {
        rightmost = Math.max(rightmost, bounds.x + bounds.width / 2)
        visitCells(bounds, gap * 2, key => {
            const items = cells.get(key) || []
            items.push(bounds); cells.set(key, items)
            return true
        })
    }
    cards.forEach(reserve)

    // Stable edge identity prevents data arrival / DOM order from swapping
    // values between slots when the collector refreshes its measurements.
    labels.slice().sort((a, b) => a.id.localeCompare(b.id)).forEach(label => {
        const free = (point: RoutePoint) => {
            const bounds = { ...label, ...point }
            return visitCells(bounds, 0, key => !(cells.get(key) || []).some(other => overlaps(bounds, other)))
        }
        let point: RoutePoint | undefined = free(label) ? { x: label.x, y: label.y } : undefined
        if (!point && label.route && !label.route.trafficNodeID) {
            const candidates: RoutePoint[] = []
            label.route.points.slice(1).forEach((b, i) => {
                const a = label.route!.points[i]
                const horizontal = Math.abs(a.y - b.y) < 0.01
                const vertical = Math.abs(a.x - b.x) < 0.01
                if (!horizontal && !vertical) return
                const half = (horizontal ? label.width : label.height) / 2 + gap
                const min = Math.min(horizontal ? a.x : a.y, horizontal ? b.x : b.y) + half
                const max = Math.max(horizontal ? a.x : a.y, horizontal ? b.x : b.y) - half
                if (min > max) return
                const start = Math.max(min, Math.min(max, horizontal ? label.x : label.y))
                const step = (horizontal ? label.width : label.height) + gap * 2
                const append = (value: number) => candidates.push(horizontal ? { x: value, y: a.y } : { x: a.x, y: value })
                append(start)
                for (let slot = 1; slot <= labels.length; slot++) {
                    if (start + slot * step > max && start - slot * step < min) break
                    if (start + slot * step <= max) append(start + slot * step)
                    if (start - slot * step >= min) append(start - slot * step)
                }
                append(min); append(max)
            })
            candidates.sort((a, b) => Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y)
                || a.y - b.y || a.x - b.x)
            point = candidates.find(free)
        }
        // Endpoint labels stay near their own card. Short / obstructed routes
        // also use nearby rows instead of covering a card or another value.
        for (let slot = 1; !point && slot <= labels.length + cards.length; slot++) {
            const dx = slot * (label.width + gap * 2), dy = slot * (label.height + gap * 2)
            point = [{ x: label.x - dx, y: label.y }, { x: label.x + dx, y: label.y },
                { x: label.x, y: label.y - dy }, { x: label.x, y: label.y + dy }].find(free)
        }
        if (!point) {
            // Finite fallback even if unusually large cards block every local
            // candidate. Put the rectangle beyond their right edge.
            const right = Math.max(label.x, rightmost)
            point = { x: right + label.width / 2 + gap * 2, y: label.y }
        }
        positions.set(label.id, point)
        reserve({ ...label, ...point })
    })
    return positions
}
