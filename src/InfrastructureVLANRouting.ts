import { CompactRoute, RoutingCard, RoutingEdge, compactRouteFromPoints } from './InfrastructureCompactRouting'
import { verticalCurve } from './InfrastructureVMInterfaceRouting'

/** A common NIC is not a shared traffic bus. Separate coincident NIC/VLAN
 * routes without moving cards or changing measured edge identities. */
export function separateInterfaceVLANRoutes(cards: RoutingCard[], edges: RoutingEdge[], routes: Map<string, CompactRoute>,
    preferred: Map<string, CompactRoute>, clear: (edge: RoutingEdge, route: CompactRoute) => boolean): void {
    const byID = new Map(cards.map(card => [card.id, card]))
    const families = new Map<string, Array<{ edge: RoutingEdge; nic: RoutingCard; vlan: RoutingCard; route: CompactRoute }>>()
    for (const edge of edges) {
        if (edge.hierarchy || preferred.has(edge.id)) continue
        const a = byID.get(edge.sourceID), b = byID.get(edge.targetID), route = routes.get(edge.id)
        if (!a || !b || a.group || b.group || !route || route.path.includes(' C')) continue
        const vlan = a.type === 'vlan' ? a : b.type === 'vlan' ? b : undefined
        const nic = vlan === a ? b : a
        if (!vlan || !['device', 'bond'].includes(nic.type || '') || vlan.y <= nic.y) continue
        const family = families.get(nic.id) || []
        family.push({ edge, nic, vlan, route }); families.set(nic.id, family)
    }
    families.forEach(entries => {
        const horizontal = (route: CompactRoute) => route.points.slice(1).map((b, i) => ({ a: route.points[i], b }))
            .filter(({ a, b }) => Math.abs(a.y - b.y) < 0.01 && Math.abs(a.x - b.x) >= 96)
        const segments = entries.map(entry => horizontal(entry.route))
        const affected = entries.filter((_, i) => entries.some((_, j) => i !== j && segments[i].some(p => segments[j].some(q =>
            Math.abs(p.a.y - q.a.y) < 0.01 && Math.min(Math.max(p.a.x, p.b.x), Math.max(q.a.x, q.b.x))
                - Math.max(Math.min(p.a.x, p.b.x), Math.min(q.a.x, q.b.x)) >= 96))))
            .sort((a, b) => a.vlan.x - b.vlan.x || a.edge.id.localeCompare(b.edge.id))
        affected.forEach(({ edge, nic, vlan, route }, index) => {
            const offset = Math.max(-nic.width * 0.25, Math.min(nic.width * 0.25, (index - (affected.length - 1) / 2) * 18))
            const curve = verticalCurve({ x: nic.x + offset, y: nic.y + nic.height / 2 },
                { x: vlan.x, y: vlan.y - vlan.height / 2 }, edge.sourceID !== nic.id)
            if (clear(edge, curve)) {
                routes.set(edge.id, { ...curve, trafficNodeID: route.trafficNodeID }); return
            }
            // When cards block a curve, stagger only the existing empty
            // corridor. Endpoint anchors and obstacle clearance stay intact.
            const points = route.points
            if (points.length < 4 || points[0].x !== points[1].x || points[points.length - 1].x !== points[points.length - 2].x) return
            const lower = Math.min(points[0].y, points[points.length - 1].y) + 8
            const upper = Math.max(points[0].y, points[points.length - 1].y) - 8
            if (lower >= upper) return
            for (const direction of [-1, 1]) {
                const shift = direction * (index + 1) * 18
                const candidate = compactRouteFromPoints(points.map((p, i) => i === 0 || i === points.length - 1 ? p
                    : { x: p.x, y: Math.max(lower, Math.min(upper, p.y + shift)) }))
                if (clear(edge, candidate)) { routes.set(edge.id, { ...candidate, trafficNodeID: route.trafficNodeID }); break }
            }
        })
    })
}
