import type { CompactRoute, RoutingCard, RoutingEdge, RoutePoint } from './InfrastructureCompactRouting'

export const verticalCurve = (start: RoutePoint, end: RoutePoint, reverse = false): CompactRoute => {
    const middle = (start.y + end.y) / 2
    const points = [start]
    for (let i = 1; i <= 16; i++) {
        const t = i / 16, u = 1 - t
        points.push({ x: u ** 3 * start.x + 3 * u * u * t * start.x + 3 * u * t * t * end.x + t ** 3 * end.x,
            y: u ** 3 * start.y + 3 * u * u * t * middle + 3 * u * t * t * middle + t ** 3 * end.y })
    }
    const from = reverse ? end : start, to = reverse ? start : end
    return { path: `M${from.x},${from.y} C${from.x},${middle} ${to.x},${middle} ${to.x},${to.y}`, points: reverse ? points.reverse() : points }
}

/** Spread only real, nearby VM-owned NIC connections. External bridge paths
 * and precomputed Compact paths retain their exact geometry and identity. */
export function separateVMInterfaceRoutes(cards: RoutingCard[], edges: RoutingEdge[], routes: Map<string, CompactRoute>,
    preferred: Map<string, CompactRoute>, clear: (edge: RoutingEdge, route: CompactRoute) => boolean): void {
    const byID = new Map(cards.map(card => [card.id, card]))
    const families = new Map<string, Array<{ edge: RoutingEdge; vm: RoutingCard; nic: RoutingCard }>>()
    const incident = new Map<string, RoutingEdge[]>()
    for (const edge of edges) {
        for (const id of [edge.sourceID, edge.targetID]) {
            const entries = incident.get(id) || []; entries.push(edge); incident.set(id, entries)
        }
        if (edge.hierarchy) continue
        const a = byID.get(edge.sourceID), b = byID.get(edge.targetID)
        if (!a || !b || a.group || b.group) continue
        const vm = a.type === 'libvirt' && b.vmOwnerID === a.id ? a : b.type === 'libvirt' && a.vmOwnerID === b.id ? b : undefined
        const nic = vm === a ? b : a
        if (!vm || !routes.has(edge.id)) continue
        const entries = families.get(vm.id) || []; entries.push({ edge, vm, nic }); families.set(vm.id, entries)
    }
    families.forEach(entries => {
        const vm = entries[0].vm, bottom = vm.y + vm.height / 2
        const tops = entries.map(({ nic }) => nic.y - nic.height / 2)
        if (entries.length > 8 || Math.max(...tops) - Math.min(...tops) > 1
            || tops.some(top => top - bottom < 48 || top - bottom > 600)
            || entries.some(({ edge }) => preferred.has(edge.id))) return
        entries.sort((a, b) => a.nic.x - b.nic.x || a.edge.id.localeCompare(b.edge.id))
        const proposed = new Map<string, CompactRoute>()
        for (let index = 0; index < entries.length; index++) {
            const { edge, nic } = entries[index]
            const own = entries.filter(entry => entry.nic.id === nic.id)
            const foreign = (incident.get(nic.id) || []).filter(e => e.sourceID !== vm.id && e.targetID !== vm.id)
            if (entries.length === 1 && !foreign.length) continue
            const remoteXs = foreign.map(e => byID.get(e.sourceID === nic.id ? e.targetID : e.sourceID)?.x).filter((x): x is number => x !== undefined)
            const side = remoteXs.length && remoteXs.reduce((sum, x) => sum + x, 0) / remoteXs.length > vm.x ? -1 : 1
            const vmOffset = Math.max(-vm.width * 0.24, Math.min(vm.width * 0.24, (index - (entries.length - 1) / 2) * 36))
            const nicOffset = Math.max(-nic.width * 0.24, Math.min(nic.width * 0.24,
                (foreign.length ? side * 36 : 0) + (own.indexOf(entries[index]) - (own.length - 1) / 2) * 24))
            const start = { x: vm.x + vmOffset, y: bottom }, end = { x: nic.x + nicOffset, y: nic.y - nic.height / 2 }
            const route = verticalCurve(start, end, edge.sourceID !== vm.id)
            // Reuse the existing per-NIC label slots so the owner connection
            // and external traffic keep separate values above the same card.
            route.trafficNodeID = nic.id
            if (clear(edge, route)) proposed.set(edge.id, route)
        }
        // Do not partially spread a family when an obstacle blocks a branch.
        if (proposed.size === entries.length) proposed.forEach((route, id) => routes.set(id, route))
    })
}
