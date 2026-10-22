import { topologyCardEdge } from './TopologyEdgePresentation'
import { separateVMInterfaceRoutes, verticalCurve } from './InfrastructureVMInterfaceRouting'
import { separateInterfaceVLANRoutes } from './InfrastructureVLANRouting'
import { coordinateBridgeArrivals } from './InfrastructureBridgeConvergenceRouting'
import { CompactRoute, RoutingCard, RoutingEdge, RoutingRegion, routeCompactEdges,
    compactRouteFromPoints, routeCardHits, sampleCardEdge, segmentHitsCard } from './InfrastructureCompactRouting'

const routeLength = (route: CompactRoute) => route.points.slice(1).reduce((length, point, i) =>
    length + Math.hypot(point.x - route.points[i].x, point.y - route.points[i].y), 0)

/** Try a small set of smooth, monotone corridors around the actual blockers
 * before using the orthogonal obstacle graph. No card positions are changed. */
function smoothVerticalDetour(edge: RoutingEdge, source: RoutingCard, target: RoutingCard, cards: RoutingCard[], regions: RoutingRegion[],
    clear: (edge: RoutingEdge, route: CompactRoute) => boolean): CompactRoute | undefined {
    const reverse = source.y > target.y
    const upper = reverse ? target : source, lower = reverse ? source : target
    const start = { x: upper.x, y: upper.y + upper.height / 2 }
    const end = { x: lower.x, y: lower.y - lower.height / 2 }
    if (end.y - start.y < 96) return
    const direct = verticalCurve(start, end)
    const obstacles = [...cards.filter(card => card.id !== source.id && card.id !== target.id),
        ...regions.filter(region => !region.nodeIDs.includes(source.id) && !region.nodeIDs.includes(target.id))]
    const blockers = obstacles.filter(card => direct.points.slice(1).some((p, i) => segmentHitsCard(direct.points[i], p, card)))
    const xs = Array.from(new Set([end.x, start.x, (start.x + end.x) / 2,
        ...blockers.reduce<number[]>((xs, card) => xs.concat(card.x - card.width / 2 - 32, card.x + card.width / 2 + 32), [])])).sort((a,b)=>a-b)
    let best: CompactRoute | undefined
    let bestJunction: { x: number; y: number } | undefined
    const tryJunctions = (ys: number[]) => {
        for (const y of ys) for (const x of xs) {
            const junction = { x, y }
            const a = verticalCurve(start, junction), b = verticalCurve(junction, end)
            const route = { path: a.path + b.path.slice(b.path.indexOf(' C')), points: [...a.points, ...b.points.slice(1)] }
            if (clear(edge, route) && (!best || routeLength(route) < routeLength(best))) { best = route; bestJunction = junction }
        }
    }
    tryJunctions([0.5, 0.35, 0.65].map(fraction => start.y + (end.y - start.y) * fraction))
    if (!best) {
        // A late VM row may only be reachable after passing the preceding rows.
        // Fixed fractions miss that open gap and unnecessarily choose a large
        // right-angle bus. Try the actual row boundaries before falling back.
        const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x)
        const ys = Array.from(new Set(obstacles.filter(card => card.x + card.width / 2 >= left && card.x - card.width / 2 <= right)
            .reduce<number[]>((ys, card) => ys.concat(card.y - card.height / 2 - (card.above || 0) - 32,
                card.y + card.height / 2 + (card.below || 0) + 32), [])))
            .filter(y => y > start.y + 48 && y < end.y - 48).sort((a, b) => a - b)
        tryJunctions(ys)
    }
    if (best && reverse) {
        const a = verticalCurve(end, bestJunction!), b = verticalCurve(bestJunction!, start)
        return { path: a.path + b.path.slice(b.path.indexOf(' C')), points: best.points.slice().reverse() }
    }
    return best
}

/** Retain a proven obstacle-free vertical corridor, but enter and leave it with
 * curves when the surrounding space permits. Tight corridors remain unchanged. */
function smoothTrafficCorridor(edge: RoutingEdge, baseline: CompactRoute,
    clear: (edge: RoutingEdge, route: CompactRoute) => boolean): CompactRoute | undefined {
    if (!baseline.path.includes(' L') || baseline.points.length < 3) return
    const reverse = baseline.points[0].y > baseline.points[baseline.points.length - 1].y
    const points = reverse ? baseline.points.slice().reverse() : baseline.points
    const start = points[0], end = points[points.length - 1], gap = end.y - start.y
    if (gap < 192) return
    const trunks = points.slice(1).map((point, i) => ({ a: points[i], b: point }))
        .filter(({ a, b }) => Math.abs(a.x - b.x) < 0.01 && b.y - a.y > 96)
        .sort((a, b) => (b.b.y - b.a.y) - (a.b.y - a.a.y) || a.a.x - b.a.x).slice(0, 3)
    let best: CompactRoute | undefined
    let bestJunctions: Array<{ x: number; y: number }> | undefined
    for (const { a, b } of trunks) for (const entry of [64, 128, 256, 512]) for (const exit of [64, 128, 256, 512]) {
        const upper = { x: a.x, y: Math.max(a.y, start.y + entry) }
        const lower = { x: a.x, y: Math.min(b.y, end.y - exit) }
        if (upper.y >= lower.y || lower.y >= end.y || upper.y <= start.y) continue
        const legs = [verticalCurve(start, upper), verticalCurve(upper, lower), verticalCurve(lower, end)]
        const route = { path: legs[0].path + legs.slice(1).map(leg => leg.path.slice(leg.path.indexOf(' C'))).join(''),
            points: legs[0].points.concat(...legs.slice(1).map(leg => leg.points.slice(1))), trafficNodeID: baseline.trafficNodeID }
        if (clear(edge, route) && routeLength(route) < routeLength(best || baseline)) { best = route; bestJunctions = [upper, lower] }
    }
    if (best && reverse) {
        const [upper, lower] = bestJunctions!
        const legs = [verticalCurve(end, lower), verticalCurve(lower, upper), verticalCurve(upper, start)]
        return { ...best, path: legs[0].path + legs.slice(1).map(leg => leg.path.slice(leg.path.indexOf(' C'))).join(''),
            points: best.points.slice().reverse() }
    }
    return best
}

/** Build fallback side corridors for obstructed bridge fan-out rows.
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
        // Density alone is not an obstacle. Recheck every visible destination
        // row against actual cards/VM units before assigning it a perimeter bus.
        // Expanding or collapsing a middle layer naturally changes this test.
        const directIDs = new Set<string>()
        for (const row of rows) {
            const direct = row.entries.map(({ edge, target }) => {
                const source = byID.get(edge.sourceID)!, destination = byID.get(edge.targetID)!
                return { edge, route: { path: topologyCardEdge(source, destination, false, 'vertical'),
                    points: sampleCardEdge(source, destination, false, 'vertical'), trafficNodeID: target.id } }
            })
            const internalUnit = row.entries.some(({ edge }) => preferred.has(edge.id) && regions.some(region =>
                region.nodeIDs.includes(edge.sourceID) && region.nodeIDs.includes(edge.targetID)))
            if (!internalUnit && direct.every(({ edge, route }) => clear(edge, route))) {
                direct.forEach(({ edge, route }) => { routes.set(edge.id, route); directIDs.add(edge.id) })
            }
        }
        entries = entries.filter(({ edge }) => !directIDs.has(edge.id))
        for (let i = rows.length - 1; i >= 0; i--) if (rows[i].entries.every(({ edge }) => directIDs.has(edge.id))) rows.splice(i, 1)
        if (!entries.length) return
        const left = Math.min(bridge.x - bridge.width / 2, ...entries.map(entry => entry.target.x - entry.target.width / 2))
        const right = Math.max(bridge.x + bridge.width / 2, ...entries.map(entry => entry.target.x + entry.target.width / 2))
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
        const source = byID.get(edge.sourceID), target = byID.get(edge.targetID)
        if (!source || !target || source.id === target.id) continue
        // Remote ports form a row above hosts/NICs. Even a wide connection
        // should leave that row vertically instead of entering sibling ports.
        const verticalPort = [source, target].some(card => card.type === 'switchport') && Math.abs(source.y - target.y) > 1
        const verticalRelation = !edge.hierarchy && Math.abs(source.y - target.y) > 1
        const fanRoute = routes.get(edge.id)
        const baseline = fanRoute || preferred.get(edge.id)
        const compactUnit = preferred.has(edge.id) && (source.vmOwnerID === target.id || target.vmOwnerID === source.id
            || regions.some(region => region.nodeIDs.includes(edge.sourceID) && region.nodeIDs.includes(edge.targetID)))
        let shorten = false
        if (baseline) {
            const start = baseline.points[0], end = baseline.points[baseline.points.length - 1]
            const minimum = Math.abs(start.x - end.x) + Math.abs(start.y - end.y)
            // Recheck fan-out against current visible cards. A shared bus is
            // only a fallback; preserve intentional routes inside a VM unit.
            shorten = !compactUnit && (!!fanRoute || routeLength(baseline) > minimum * 2 + 128)
            if (fanRoute && !shorten) continue
        }
        const baselineClear = !baseline || !shorten || clear(edge, baseline)
        const preferCurve = verticalRelation && !compactUnit
            && (!preferred.has(edge.id) || shorten || verticalPort || !!(source.type && target.type))
        const axis = preferCurve ? 'vertical' : undefined
        const original = (!preferCurve && !shorten && preferred.get(edge.id)) || {
            path: topologyCardEdge(source, target, false, axis), points: sampleCardEdge(source, target, false, axis) }
        if (clear(edge, original)) {
            const route = !preferCurve && baseline && baselineClear && routeLength(original) >= routeLength(baseline) ? baseline : original
            if (baseline?.trafficNodeID) route.trafficNodeID = baseline.trafficNodeID
            if (verticalPort) route.trafficNodeID = source.y > target.y ? source.id : target.id
            routes.set(edge.id, route); continue
        }
        if (preferCurve) {
            const smooth = smoothVerticalDetour(edge, source, target, cards, regions, clear)
            if (smooth && (!fanRoute || routeLength(smooth) < routeLength(fanRoute))) {
                smooth.trafficNodeID = baseline?.trafficNodeID || (verticalPort ? (source.y > target.y ? source.id : target.id) : undefined)
                routes.set(edge.id, smooth); continue
            }
        }
        // The bus is a safe fallback only for branches whose direct/local
        // curves are actually obstructed, rather than a rule based on counts.
        if (fanRoute && baselineClear) { routes.set(edge.id, smoothTrafficCorridor(edge, fanRoute, clear) || fanRoute); continue }

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
                    if (clear(edge, candidate)) {
                        if (!result || routeLength(candidate) < routeLength(result)) result = candidate
                        // Only expensive fan detours need all departure choices.
                        if (!shorten) break
                        continue
                    }
                    cards.filter(card => !local.has(card.id) && candidate.points.slice(1)
                        .some((point, index) => segmentHitsCard(candidate.points[index], point, card, padding)))
                        .forEach(card => local.set(card.id, card))
                }
            }
            if (result) break
        }
        // Preserve edge identity if overlapping cards leave no valid corridor.
        const route = baseline && shorten && baselineClear && (!result || routeLength(result) >= routeLength(baseline)) ? baseline : result || fanRoute || original
        if (baseline?.trafficNodeID) route.trafficNodeID = baseline.trafficNodeID
        if (verticalPort) route.trafficNodeID = source.y > target.y ? source.id : target.id
        routes.set(edge.id, !compactUnit && preferCurve ? smoothTrafficCorridor(edge, route, clear) || route : route)
    }
    separateVMInterfaceRoutes(cards, edges, routes, preferred, clear)
    separateInterfaceVLANRoutes(cards, edges, routes, preferred, clear)
    coordinateBridgeArrivals(cards, edges, routes, preferred, clear)
    return routes
}
