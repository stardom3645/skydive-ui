import { topologyCardEdge } from './TopologyEdgePresentation'
import { separateVMInterfaceRoutes } from './InfrastructureVMInterfaceRouting'
import { CompactRoute, RoutingCard, RoutingEdge, RoutingRegion, routeCompactEdges,
    compactRouteFromPoints, routeCardHits, sampleCardEdge, segmentHitsCard } from './InfrastructureCompactRouting'

/** Dense bridge fan-out follows one clear side corridor and one branch per row.
 * Paths may share geometry, but every measured edge keeps its identity, labels
 * and hit target. Only actual bridge relations participate, never ownership. */
function bridgeFanRoutes(cards: RoutingCard[], edges: RoutingEdge[], clear: (edge: RoutingEdge, route: CompactRoute) => boolean,
    regions: RoutingRegion[], preferred: Map<string, CompactRoute>): Map<string, CompactRoute> {
    const byID = new Map(cards.map(card => [card.id, card]))
    const fans = new Map<string, Array<{ edge: RoutingEdge; bridge: RoutingCard; target: RoutingCard }>>()
    for (const edge of edges) {
        if (edge.hierarchy) continue
        const ends = [byID.get(edge.sourceID), byID.get(edge.targetID)]
        const bridge = ends.find(card => card && ['bridge', 'ovsbridge', 'openvswitch'].includes(card.type || ''))
        const target = ends.find(card => card && card !== bridge)
        if (!bridge || bridge.group || !target || !['libvirt', 'tun', 'tuntap', 'veth'].includes(target.type || '')
            || target.y - target.height / 2 <= bridge.y + bridge.height / 2 + (bridge.below || 0) + 48) continue
        const entries = fans.get(bridge.id) || []
        entries.push({ edge, bridge, target }); fans.set(bridge.id, entries)
    }
    const routes = new Map<string, CompactRoute>()
    const buses: Array<{ x: number; top: number; bottom: number }> = []
    Array.from(fans).sort(([a], [b]) => a.localeCompare(b)).forEach(([, entries]) => {
        if (entries.length < 4) return
        entries.sort((a, b) => a.target.y - b.target.y || a.target.x - b.target.x || a.edge.id.localeCompare(b.edge.id))
        const bridge = entries[0].bridge
        const rows: Array<{ top: number; bottom: number; entries: typeof entries }> = []
        entries.forEach(entry => {
            const top = entry.target.y - entry.target.height / 2 - (entry.target.above || 0)
            const bottom = entry.target.y + entry.target.height / 2 + (entry.target.below || 0)
            const previous = rows[rows.length - 1]
            if (previous && top < previous.bottom) { previous.entries.push(entry); previous.top = Math.min(previous.top, top); previous.bottom = Math.max(previous.bottom, bottom) }
            else rows.push({ top, bottom, entries: [entry] })
        })
        // Keep the existing bus extent for all other rows/bridges even when
        // the leading row below receives direct connections.
        const left = Math.min(bridge.x - bridge.width / 2, ...entries.map(entry => entry.target.x - entry.target.width / 2))
        const right = Math.max(bridge.x + bridge.width / 2, ...entries.map(entry => entry.target.x + entry.target.width / 2))
        // A small leading row (typically system VMs) need not follow the side
        // bus required by dense/lower rows. Use ordinary curves only when the
        // entire row is clear; leave Compact routes and VM/NIC bundles alone.
        const first = rows[0]
        if (new Set(first.entries.map(({ target }) => target.id)).size <= 3 && first.entries.every(({ edge, target }) => !preferred.has(edge.id)
            && !regions.some(region => region.nodeIDs.includes(target.id)))) {
            const direct = first.entries.map(({ edge, target }) => {
                const source = byID.get(edge.sourceID)!, destination = byID.get(edge.targetID)!
                return { edge, route: { path: topologyCardEdge(source, destination), points: sampleCardEdge(source, destination), trafficNodeID: target.id } }
            })
            if (direct.every(({ edge, route }) => clear(edge, route))) {
                direct.forEach(({ edge, route }) => routes.set(edge.id, route))
                const ids = new Set(direct.map(({ edge }) => edge.id))
                entries = entries.filter(({ edge }) => !ids.has(edge.id))
                rows.shift()
                if (!rows.length) return
            }
        }
        const top = bridge.y + bridge.height / 2, bottom = Math.max(...rows.map(row => row.bottom))
        const obstacles = [...cards, ...regions].filter(card => card.x + card.width / 2 >= left - 64
            && card.x - card.width / 2 <= right + 64 && card.y + card.height / 2 + (card.below || 0) >= top
            && card.y - card.height / 2 - (card.above || 0) <= bottom)
        const corridors = [Math.min(left, ...obstacles.map(card => card.x - card.width / 2)) - 32,
            Math.max(right, ...obstacles.map(card => card.x + card.width / 2)) + 32]
            .map(x => { const direction = x < bridge.x ? -1 : 1
                while (buses.some(bus => Math.abs(bus.x - x) < 24 && bus.top < bottom && bus.bottom > top)) x += direction * 24
                return x })
            .sort((a, b) => Math.abs(a - bridge.x) - Math.abs(b - bridge.x))
        for (const corridor of corridors) {
            const proposed = new Map<string, CompactRoute>()
            for (const row of rows) {
                const branchLeft = Math.min(corridor, ...row.entries.map(entry => entry.target.x))
                const branchRight = Math.max(corridor, ...row.entries.map(entry => entry.target.x))
                const rowObstacles = obstacles.filter(card => card.id !== bridge.id
                    && card.x + card.width / 2 > branchLeft && card.x - card.width / 2 < branchRight
                    && !regions.some(region => region.id === card.id && row.entries.some(entry => region.nodeIDs.includes(entry.target.id)))
                    && card.y + card.height / 2 + (card.below || 0) > row.top
                    && card.y - card.height / 2 - (card.above || 0) < row.bottom)
                const lane = Math.min(row.top, ...rowObstacles.map(card => card.y - card.height / 2 - (card.above || 0))) - 24
                for (const { edge, target } of row.entries) {
                    const points = [{ x: bridge.x, y: top }, { x: bridge.x, y: top + (bridge.below || 0) + 24 },
                        { x: corridor, y: top + (bridge.below || 0) + 24 }, { x: corridor, y: lane },
                        { x: target.x, y: lane }, { x: target.x, y: target.y - target.height / 2 }]
                    let route = compactRouteFromPoints(edge.sourceID === bridge.id ? points : points.slice().reverse())
                    if (!clear(edge, route)) {
                        // An expanded NIC may sit behind its own VM. Keep the
                        // common trunk, then detour only the short final branch.
                        const junction: RoutingCard = { id: `fan-junction:${edge.id}`, x: corridor, y: lane, width: 0, height: 0 }
                        const branchEdge = { id: edge.id, sourceID: junction.id, targetID: target.id }
                        const branch = routeCompactEdges([...cards, junction], [branchEdge], [], regions, { padding: 8,
                            side: card => card.id === junction.id ? (target.x > corridor ? 'right' : 'left') : 'top' })?.get(edge.id)
                        if (branch) {
                            const joined = [...points.slice(0, 3), ...branch.points]
                            route = compactRouteFromPoints(edge.sourceID === bridge.id ? joined : joined.reverse())
                        }
                    }
                    if (clear(edge, route)) { route.trafficNodeID = target.id; proposed.set(edge.id, route) }
                }
            }
            // Do not split a bridge into a mixture of side buses and independent
            // maze routes. Fall back as a whole if no clear corridor exists.
            if (proposed.size === entries.length) {
                proposed.forEach((route, id) => routes.set(id, route))
                buses.push({ x: corridor, top, bottom }); break
            }
        }
    })
    return routes
}

/** Organize dense bridge fan-out; retain clear ordinary curves and VM/NIC paths.
 * Remaining obstructed edges depart and arrive outside both card borders. */
export function routeInfrastructureTraffic(cards: RoutingCard[], edges: RoutingEdge[],
    preferred: Map<string, CompactRoute> = new Map(), regions: RoutingRegion[] = []): Map<string, CompactRoute> {
    const byID = new Map(cards.map(card => [card.id, card]))
    const routes = new Map<string, CompactRoute>()
    const clear = (edge: RoutingEdge, route: CompactRoute) => !routeCardHits(edge, route.points, cards)
        && !route.points.slice(1).some((point, index) => [byID.get(edge.sourceID)!, byID.get(edge.targetID)!]
            .some(card => segmentHitsCard(route.points[index], point, { ...card, above: 0, below: 0 })))
        && !regions.some(region => !region.nodeIDs.includes(edge.sourceID) && !region.nodeIDs.includes(edge.targetID)
            && route.points.slice(1).some((point, index) => segmentHitsCard(route.points[index], point, region)))
    bridgeFanRoutes(cards, edges, clear, regions, preferred).forEach((route, id) => routes.set(id, route))
    for (const edge of edges.slice().sort((a, b) => a.id.localeCompare(b.id))) {
        if (routes.has(edge.id)) continue
        const source = byID.get(edge.sourceID), target = byID.get(edge.targetID)
        if (!source || !target || source.id === target.id) continue
        const original = preferred.get(edge.id) || { path: topologyCardEdge(source, target), points: sampleCardEdge(source, target) }
        if (clear(edge, original)) { routes.set(edge.id, original); continue }

        // A local corridor bounds graph size in large expanded topologies.
        // Validate against every card, adding any obstacles reached by a detour.
        const left = Math.min(source.x - source.width / 2, target.x - target.width / 2) - 64
        const right = Math.max(source.x + source.width / 2, target.x + target.width / 2) + 64
        const top = Math.min(source.y - source.height / 2, target.y - target.height / 2) - 64
        const bottom = Math.max(source.y + source.height / 2, target.y + target.height / 2) + 64
        const local = new Map(cards.filter(card => card.x + card.width / 2 >= left && card.x - card.width / 2 <= right
            && card.y + card.height / 2 + (card.below || 0) >= top
            && card.y - card.height / 2 - (card.above || 0) <= bottom).map(card => [card.id, card]))
        let result: CompactRoute | undefined
        // Keep horizontal detours visibly clear of card rims. In a crowded
        // corridor retry the previous spacing without moving any objects.
        for (const padding of [24, 8]) {
            for (let attempt = 0; attempt < 3 && !result; attempt++) {
                for (const flip of [0, 1, 2, 3]) {
                    const candidate = routeCompactEdges(Array.from(local.values()), [edge], [], regions, {
                        padding,
                        side: (card, other) => {
                            const reverse = flip & (card.id === source.id ? 1 : 2)
                            if (Math.abs(other.y - card.y) > 1) return (other.y > card.y) !== !!reverse ? 'bottom' : 'top'
                            return (other.x > card.x) !== !!reverse ? 'right' : 'left'
                        }
                    })?.get(edge.id)
                    if (!candidate) continue
                    if (clear(edge, candidate)) { result = candidate; break }
                    cards.filter(card => !local.has(card.id) && candidate.points.slice(1)
                        .some((point, index) => segmentHitsCard(candidate.points[index], point, card, padding)))
                        .forEach(card => local.set(card.id, card))
                }
            }
            if (result) break
        }
        // Preserve edge identity if overlapping cards leave no valid corridor.
        routes.set(edge.id, result || original)
    }
    separateVMInterfaceRoutes(cards, edges, routes, preferred, clear)
    return routes
}
