import type { CompactRoute, RoutePoint, RoutingCard, RoutingEdge } from './InfrastructureCompactRouting'
import { verticalCurve } from './InfrastructureVMInterfaceRouting'

const ascending = (route: CompactRoute) => route.points[0].y > route.points[route.points.length - 1].y
    ? route.points.slice().reverse() : route.points

/** Detect an order reversal before the common endpoint, rather than counting
 * the legitimate meeting of two connections at the same card as a crossing. */
export const convergenceRoutesCross = (a: RoutePoint[], b: RoutePoint[]): boolean => {
    const xAt = (points: RoutePoint[], y: number) => {
        const i = points.findIndex((p, i) => i > 0 && p.y >= y)
        if (i < 1) return points[0].x
        const p = points[i - 1], q = points[i]
        return p.x + (q.x - p.x) * (y - p.y) / (q.y - p.y || 1)
    }
    const lower = Math.max(a[0].y, b[0].y), upper = Math.min(a[a.length - 1].y, b[b.length - 1].y)
    let side = 0
    for (const y of Array.from(new Set([...a, ...b].map(p => p.y))).sort((a, b) => a - b)) {
        if (y < lower || y >= upper - 1) continue
        const dx = xAt(a, y) - xAt(b, y)
        if (Math.abs(dx) < 0.01) continue
        if (side && side !== Math.sign(dx)) return true
        side = Math.sign(dx)
    }
    return false
}

/** Coordinate only crossed bridge arrivals at one VM. Reuse an existing safe
 * curve's bend proportions across its siblings; endpoints and edge identities
 * remain intact, and the caller validates every card and protected VM region. */
export function coordinateBridgeArrivals(cards: RoutingCard[], edges: RoutingEdge[], routes: Map<string, CompactRoute>,
    preferred: Map<string, CompactRoute>, clear: (edge: RoutingEdge, route: CompactRoute) => boolean): void {
    const byID = new Map(cards.map(card => [card.id, card]))
    const families = new Map<string, Array<{ edge: RoutingEdge; route: CompactRoute; points: RoutePoint[] }>>()
    for (const edge of edges) {
        if (edge.hierarchy || preferred.has(edge.id)) continue
        const a = byID.get(edge.sourceID), b = byID.get(edge.targetID), route = routes.get(edge.id)
        if (!a || !b || !route || !route.path.includes(' C')) continue
        const bridge = ['bridge', 'ovsbridge', 'openvswitch'].includes(a.type || '') ? a : b
        const vm = bridge === a ? b : a
        if (bridge.group || !['bridge', 'ovsbridge', 'openvswitch'].includes(bridge.type || '')
            || vm.type !== 'libvirt' || vm.y <= bridge.y) continue
        const points = ascending(route)
        if (points.some((p, i) => i > 0 && p.y < points[i - 1].y)) continue
        // Shared vertical intervals let a common bend template preserve the
        // left-to-right order throughout, including reverse-directed links.
        const key = JSON.stringify([vm.id, points[0].y, points[points.length - 1].y])
        const family = families.get(key) || []
        family.push({ edge, route, points }); families.set(key, family)
    }
    for (const family of families.values()) {
        family.sort((a, b) => a.points[0].x - b.points[0].x || a.edge.id.localeCompare(b.edge.id))
        if (!family.some((a, i) => family.slice(i + 1).some(b => convergenceRoutesCross(a.points, b.points)))) continue
        let best: Map<string, CompactRoute> | undefined, bestLength = Infinity
        for (const template of family) {
            const points = template.points, start = points[0], end = points[points.length - 1]
            const curves = (template.route.path.match(/ C/g) || []).length
            if (points.length !== curves * 16 + 1 || Math.abs(end.x - start.x) < 1) continue
            const knots = points.filter((_, i) => i > 0 && i < points.length - 1 && i % 16 === 0)
                .map(p => ({ x: (p.x - start.x) / (end.x - start.x), y: (p.y - start.y) / (end.y - start.y) }))
            if (knots.some(p => p.x < 0 || p.x > 1 || p.y <= 0 || p.y >= 1)) continue
            const proposed = new Map<string, CompactRoute>()
            let length = 0
            for (const entry of family) {
                const first = entry.points[0], last = entry.points[entry.points.length - 1]
                const stops = [first, ...knots.map(p => ({ x: first.x + (last.x - first.x) * p.x,
                    y: first.y + (last.y - first.y) * p.y })), last]
                const reverse = entry.route.points[0].y > entry.route.points[entry.route.points.length - 1].y
                if (reverse) stops.reverse()
                const legs = stops.slice(1).map((p, i) => verticalCurve(stops[i], p))
                const route = { ...entry.route, path: legs[0].path + legs.slice(1).map(leg => leg.path.slice(leg.path.indexOf(' C'))).join(''),
                    points: legs[0].points.concat(...legs.slice(1).map(leg => leg.points.slice(1))) }
                if (!clear(entry.edge, route)) break
                length += route.points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - route.points[i].x, p.y - route.points[i].y), 0)
                proposed.set(entry.edge.id, route)
            }
            if (proposed.size === family.length && length < bestLength
                && !family.some((a, i) => family.slice(i + 1).some(b =>
                    convergenceRoutesCross(ascending(proposed.get(a.edge.id)!), ascending(proposed.get(b.edge.id)!))))) {
                best = proposed; bestLength = length
            }
        }
        best?.forEach((route, id) => routes.set(id, route))
    }
}
