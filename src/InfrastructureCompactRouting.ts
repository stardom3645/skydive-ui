import { TopologyCardBounds, topologyCardEdge } from './TopologyEdgePresentation'

export interface RoutePoint { x: number; y: number }
export interface RoutingCard extends TopologyCardBounds { id: string; type?: string; group?: boolean; above?: number; below?: number; vmOwnerID?: string }
export interface RoutingEdge { id: string; sourceID: string; targetID: string; hierarchy?: boolean }
export interface CompactRoute { path: string; points: RoutePoint[]; trafficNodeID?: string }
export interface RoutingRegion extends RoutingCard { nodeIDs: string[] }
const EPS = 0.01
const same = (a: RoutePoint, b: RoutePoint) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
const distance = (a: RoutePoint, b: RoutePoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
/** Coincident corridor hit areas must not select whichever SVG was appended
 * last. Near a VM branch prefer the edge whose endpoint is closest. */
export function nearestCompactEdge(routes: Array<{ id: string; route: CompactRoute }>, point: RoutePoint): string | undefined {
    let best: { id: string; distance: number; endpoint: number } | undefined
    for (const { id, route } of routes) {
        let closest = Infinity
        route.points.slice(1).forEach((b, i) => {
            const a = route.points[i], dx = b.x - a.x, dy = b.y - a.y
            const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
            closest = Math.min(closest, Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t))
        })
        if (closest > 18 || !route.points.length) continue
        const endpoint = Math.min(distance(point, route.points[0]), distance(point, route.points[route.points.length - 1]))
        if (!best || closest < best.distance - 0.5 || (Math.abs(closest - best.distance) <= 0.5 && endpoint < best.endpoint)) {
            best = { id, distance: closest, endpoint }
        }
    }
    return best?.id
}
const rect = (card: RoutingCard, padding = 0) => ({ left: card.x - card.width / 2 - padding,
    right: card.x + card.width / 2 + padding, top: card.y - card.height / 2 - (card.above || 0) - padding,
    bottom: card.y + card.height / 2 + (card.below || 0) + padding })

export const segmentHitsCard = (a: RoutePoint, b: RoutePoint, card: RoutingCard, padding = 0) => {
    const box = rect(card, padding)
    // Clip the segment against the open rectangle, including diagonal samples.
    let lo = 0, hi = 1
    for (const [start, delta, min, max] of [[a.x, b.x - a.x, box.left + EPS, box.right - EPS],
        [a.y, b.y - a.y, box.top + EPS, box.bottom - EPS]]) {
        if (Math.abs(delta) < EPS) { if (start <= min || start >= max) return false }
        else { const t1 = (min - start) / delta, t2 = (max - start) / delta
            lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2)) }
    }
    return lo < hi && hi > 0 && lo < 1
}

export const routeCardHits = (edge: RoutingEdge, points: RoutePoint[], cards: RoutingCard[]) =>
    cards.filter(card => card.width > 0 && card.height > 0 && card.id !== edge.sourceID && card.id !== edge.targetID
        && points.slice(1).some((point, index) => segmentHitsCard(points[index], point, card))).length

/** Sample only the path commands emitted by the existing card-edge renderer. */
export function sampleCardEdge(source: RoutingCard, target: RoutingCard, hierarchy = false, axis?: 'vertical'): RoutePoint[] {
    const tokens = topologyCardEdge(source, target, hierarchy, axis).match(/[MCQHV]|-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) || []
    const points: RoutePoint[] = []
    let cursor = { x: 0, y: 0 }, i = 0
    const number = () => Number(tokens[i++])
    while (i < tokens.length) {
        const command = tokens[i++], from = cursor
        if (command === 'M') { cursor = { x: number(), y: number() }; points.push(cursor) }
        else if (command === 'H' || command === 'V') {
            cursor = command === 'H' ? { x: number(), y: cursor.y } : { x: cursor.x, y: number() }; points.push(cursor)
        } else if (command === 'C' || command === 'Q') {
            const a = { x: number(), y: number() }
            const b = { x: number(), y: number() }
            const end = command === 'C' ? { x: number(), y: number() } : b
            for (let j = 1; j <= 16; j++) {
                const t = j / 16, u = 1 - t
                points.push(command === 'C' ? { x: u ** 3 * from.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t ** 3 * end.x,
                    y: u ** 3 * from.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t ** 3 * end.y }
                    : { x: u * u * from.x + 2 * u * t * a.x + t * t * end.x,
                        y: u * u * from.y + 2 * u * t * a.y + t * t * end.y })
            }
            cursor = end
        }
    }
    return points
}

export function routeCrossings(edges: RoutingEdge[], paths: Map<string, RoutePoint[]>): number {
    let count = 0
    const orientation = (a: RoutePoint, b: RoutePoint, c: RoutePoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
        const a = edges[i], b = edges[j]
        if ([a.sourceID, a.targetID].some(id => id === b.sourceID || id === b.targetID)) continue
        const p = paths.get(a.id) || [], q = paths.get(b.id) || []
        let crosses = false
        for (let k = 1; k < p.length && !crosses; k++) for (let l = 1; l < q.length && !crosses; l++) {
            const a1 = p[k - 1], a2 = p[k], b1 = q[l - 1], b2 = q[l]
            // Grid vertices and collinear overlap are real visual crossings too;
            // ignoring zero orientations would misclassify shared corridors.
            const boundsOverlap = Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) >= Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x)) - EPS
                && Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) >= Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y)) - EPS
            crosses = boundsOverlap && orientation(a1, a2, b1) * orientation(a1, a2, b2) <= EPS
                && orientation(b1, b2, a1) * orientation(b1, b2, a2) <= EPS
        }
        if (crosses) count++
    }
    return count
}

class MinHeap {
    private items: Array<{ state: number; cost: number }> = []
    get size() { return this.items.length }
    push(item: { state: number; cost: number }) {
        let index = this.items.length; this.items.push(item)
        while (index > 0) { const parent = (index - 1) >> 1
            if (this.items[parent].cost <= item.cost) break
            this.items[index] = this.items[parent]; index = parent }
        this.items[index] = item
    }
    pop() {
        const first = this.items[0], last = this.items.pop()!
        if (this.items.length) { let index = 0
            while (index * 2 + 1 < this.items.length) { let child = index * 2 + 1
                if (child + 1 < this.items.length && this.items[child + 1].cost < this.items[child].cost) child++
                if (this.items[child].cost >= last.cost) break
                this.items[index] = this.items[child]; index = child }
            this.items[index] = last }
        return first
    }
}

const simplify = (points: RoutePoint[]) => {
    const result: RoutePoint[] = []
    points.forEach(point => {
        if (result.length && same(result[result.length - 1], point)) return
        while (result.length >= 2) {
            const a = result[result.length - 2], b = result[result.length - 1]
            if (!((Math.abs(a.x - b.x) < EPS && Math.abs(b.x - point.x) < EPS)
                || (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - point.y) < EPS))) break
            result.pop()
        }
        result.push(point)
    })
    return result
}
const roundedPath = (points: RoutePoint[]) => {
    if (!points.length) return ''
    let path = `M${points[0].x},${points[0].y}`
    for (let i = 1; i < points.length - 1; i++) {
        const a = points[i - 1], b = points[i], c = points[i + 1]
        const radius = Math.min(10, distance(a, b) / 2, distance(b, c) / 2)
        const p = { x: b.x + Math.sign(a.x - b.x) * radius, y: b.y + Math.sign(a.y - b.y) * radius }
        const q = { x: b.x + Math.sign(c.x - b.x) * radius, y: b.y + Math.sign(c.y - b.y) * radius }
        path += ` L${p.x},${p.y} Q${b.x},${b.y} ${q.x},${q.y}`
    }
    const end = points[points.length - 1]
    return `${path} L${end.x},${end.y}`
}

export function translateCompactRoute(route: CompactRoute, dx: number): CompactRoute {
    const points = route.points.map(point => ({ x: point.x + dx, y: point.y }))
    return { ...route, points, path: roundedPath(points) }
}

export const compactRouteFromPoints = (points: RoutePoint[]): CompactRoute => {
    const simplified = simplify(points)
    return { points: simplified, path: roundedPath(simplified) }
}

/** A shared obstacle graph, not a shared SVG trunk. Each edge retains its own
 * ports, path, hit target and identity. Congestion discourages coincident paths. */
export function routeCompactEdges(cards: RoutingCard[], edges: RoutingEdge[], trackYs: number[] = [], regions: RoutingRegion[] = [],
    options: { padding?: number; side?: (card: RoutingCard, other: RoutingCard) => string } = {}): Map<string, CompactRoute> | undefined {
    const clearance = options.padding ?? 18
    const byID = new Map(cards.map(card => [card.id, card]))
    const obstacles = cards.filter(card => card.width > 0 && card.height > 0)
    const ports = new Map<string, { anchor: RoutePoint; exit: RoutePoint }>()
    const sides = new Map<string, Array<{ edge: RoutingEdge; end: 'source' | 'target'; card: RoutingCard; other: RoutingCard; side: string }>>()
    edges.forEach(edge => {
        const source = byID.get(edge.sourceID), target = byID.get(edge.targetID)
        if (!source || !target) return
        for (const [end, card, other] of [['source', source, target], ['target', target, source]] as const) {
            const side = options.side?.(card, other) || (Math.abs(other.y - card.y) > 1 ? (other.y > card.y ? 'bottom' : 'top') : (other.x > card.x ? 'right' : 'left'))
            const key = `${card.id}:${side}`, entries = sides.get(key) || []
            entries.push({ edge, end, card, other, side }); sides.set(key, entries)
        }
    })
    sides.forEach(entries => {
        entries.sort((a, b) => a.other.x - b.other.x || a.other.y - b.other.y || a.edge.id.localeCompare(b.edge.id))
        entries.forEach((entry, index) => {
            const { card, side, edge, end } = entry, horizontal = side === 'top' || side === 'bottom'
            const spread = entries.length > 1 ? ((index + 1) / (entries.length + 1) - 0.5) * 0.76 : 0
            const anchor = horizontal ? { x: card.x + card.width * spread, y: card.y + card.height / 2 * (side === 'top' ? -1 : 1) }
                : { x: card.x + card.width / 2 * (side === 'left' ? -1 : 1), y: card.y + card.height * spread }
            const box = rect(card, card.width > 0 ? clearance : 0)
            const exit = horizontal ? { x: anchor.x, y: side === 'top' ? box.top : box.bottom }
                : { x: side === 'left' ? box.left : box.right, y: anchor.y }
            ports.set(`${edge.id}:${end}`, { anchor, exit })
        })
    })
    if (!edges.length) return new Map()
    const xs = new Set<number>(), ys = new Set<number>(trackYs)
    obstacles.forEach(card => { const box = rect(card, clearance)
        xs.add(box.left); xs.add(box.right); ys.add(box.top); ys.add(box.bottom) })
    regions.forEach(region => { const box = rect(region, 8)
        xs.add(box.left); xs.add(box.right); ys.add(box.top); ys.add(box.bottom) })
    ports.forEach(port => { xs.add(port.exit.x); ys.add(port.exit.y) })
    if (!xs.size || !ys.size) return undefined
    xs.add(Math.min(...xs) - 48); xs.add(Math.max(...xs) + 48)
    ys.add(Math.min(...ys) - 48); ys.add(Math.max(...ys) + 48)
    const x = Array.from(xs).sort((a, b) => a - b), y = Array.from(ys).sort((a, b) => a - b), cols = x.length
    // Keep a pathological expanded graph from monopolizing the UI thread.
    if (cols * y.length > 50000) return undefined
    const xIndex = new Map(x.map((v, i) => [v, i])), yIndex = new Map(y.map((v, i) => [v, i]))
    const padded = obstacles.map(card => rect(card, clearance))
    const regionBoxes = regions.map(region => ({ id: region.id, box: rect(region, 8) }))
    const crossesBox = (a: RoutePoint, b: RoutePoint, box: ReturnType<typeof rect>) => Math.abs(a.y - b.y) < EPS
        ? a.y > box.top + EPS && a.y < box.bottom - EPS && Math.max(a.x, b.x) > box.left + EPS && Math.min(a.x, b.x) < box.right - EPS
        : a.x > box.left + EPS && a.x < box.right - EPS && Math.max(a.y, b.y) > box.top + EPS && Math.min(a.y, b.y) < box.bottom - EPS
    const clear = (a: RoutePoint, b: RoutePoint) => !padded.some(box => crossesBox(a, b, box))
    const points: RoutePoint[] = []
    for (const yy of y) for (const xx of x) points.push({ x: xx, y: yy })
    const neighbors = points.map((point, index) => {
        const result: Array<{ id: number; direction: number; length: number; key: string; blockedRegions: string[] }> = []
        const col = index % cols, row = Math.floor(index / cols)
        for (const id of [col > 0 ? index - 1 : -1, col + 1 < cols ? index + 1 : -1,
            row > 0 ? index - cols : -1, row + 1 < y.length ? index + cols : -1]) {
            if (id >= 0 && clear(point, points[id])) result.push({ id, direction: Math.abs(id - index) === 1 ? 0 : 1,
                length: distance(point, points[id]), key: `${Math.min(index, id)}:${Math.max(index, id)}`,
                blockedRegions: regionBoxes.filter(region => crossesBox(point, points[id], region.box)).map(region => region.id) })
        }
        return result
    })
    const usage = new Map<string, number>(), routes = new Map<string, CompactRoute>()
    // Long edges first, with ID ties, makes routing independent of update order.
    const ordered = edges.slice().sort((a, b) => distance(byID.get(b.sourceID)!, byID.get(b.targetID)!)
        - distance(byID.get(a.sourceID)!, byID.get(a.targetID)!) || a.id.localeCompare(b.id))
    for (const edge of ordered) {
        // An edge may enter its own VM/NIC unit. Other units are obstacles,
        // including the empty space between their VM and interface cards.
        const allowedRegions = new Set(regions.filter(region => region.nodeIDs.includes(edge.sourceID)
            || region.nodeIDs.includes(edge.targetID)).map(region => region.id))
        const startPort = ports.get(`${edge.id}:source`), endPort = ports.get(`${edge.id}:target`)
        if (!startPort || !endPort) return undefined
        const start = yIndex.get(startPort.exit.y)! * cols + xIndex.get(startPort.exit.x)!
        const end = yIndex.get(endPort.exit.y)! * cols + xIndex.get(endPort.exit.x)!
        const costs = new Float64Array(points.length * 2).fill(Infinity), previous = new Int32Array(costs.length).fill(-1)
        const heap = new MinHeap()
        costs[start * 2] = costs[start * 2 + 1] = 0
        heap.push({ state: start * 2, cost: 0 }); heap.push({ state: start * 2 + 1, cost: 0 })
        let final = -1
        while (heap.size) {
            const item = heap.pop()
            if (item.cost !== costs[item.state]) continue
            const node = Math.floor(item.state / 2), direction = item.state % 2
            if (node === end) { final = item.state; break }
            for (const neighbor of neighbors[node]) {
                if (neighbor.blockedRegions.some(id => !allowedRegions.has(id))) continue
                const next = neighbor.id * 2 + neighbor.direction
                const cost = item.cost + neighbor.length * (1 + (usage.get(neighbor.key) || 0) * 0.35)
                    + (direction === neighbor.direction ? 0 : 60)
                if (cost >= costs[next]) continue
                costs[next] = cost; previous[next] = item.state; heap.push({ state: next, cost })
            }
        }
        if (final < 0) return undefined
        const ids: number[] = []
        while (final >= 0) { ids.push(Math.floor(final / 2)); final = previous[final] }
        ids.reverse()
        ids.slice(1).forEach((id, i) => { const key = `${Math.min(id, ids[i])}:${Math.max(id, ids[i])}`; usage.set(key, (usage.get(key) || 0) + 1) })
        const routePoints = simplify([startPort.anchor, ...ids.map(id => points[id]), endPort.anchor])
        if (routeCardHits(edge, routePoints, obstacles)) return undefined
        if (regions.some(region => !allowedRegions.has(region.id)
            && routePoints.slice(1).some((point, i) => segmentHitsCard(routePoints[i], point, region)))) return undefined
        routes.set(edge.id, { path: roundedPath(routePoints), points: routePoints })
    }
    return routes
}

export function compactTrafficLabel(route: CompactRoute, width: number, cards: RoutingCard[],
    slot?: { index: number; count: number; width: number }): RoutePoint | undefined {
    const terminal = route.trafficNodeID && cards.find(card => card.id === route.trafficNodeID)
    if (terminal) {
        // Shared bridge trunks have no aggregate measurement. Keep each real
        // interface value immediately above its own visible VM/NIC instead.
        const labelWidth = Math.max(width, slot?.width || 0), count = slot?.count || 1, index = slot?.index || 0
        const columns = Math.min(count, Math.max(1, Math.floor((terminal.width - (terminal.group ? 0 : 96) + 12) / (labelWidth + 12))))
        const row = Math.floor(index / columns), column = index % columns
        const rowSize = Math.min(columns, count - row * columns)
        const x = terminal.x + (column - (rowSize - 1) / 2) * (labelWidth + 12)
        const y = terminal.y - terminal.height / 2 - 34 - row * 52
        const free = (point: RoutePoint) => !cards.some(card => Math.abs(card.x - point.x) * 2 < card.width + labelWidth + 16
            && Math.abs(card.y - point.y) * 2 < card.height + 58)
        for (const offset of [0, -52, -104, -156]) {
            const point = { x, y: y + offset }
            if (free(point)) return point
        }
        // Stay beside this endpoint when the preceding row leaves little
        // headroom; never put a fan-out value back on the shared bus.
        for (const side of [-1, 1]) {
            const point = { x: terminal.x + side * (terminal.width / 2 + labelWidth / 2 + 18), y }
            if (free(point)) return point
        }
        return { x, y }
    }
    const segments = route.points.slice(1).map((point, i) => ({ a: route.points[i], b: point }))
        .sort((a, b) => {
            const nearLane = (segment: { a: RoutePoint; b: RoutePoint }) => Math.abs(segment.a.y - segment.b.y) < EPS
                && distance(segment.a, segment.b) >= width + 24
            const ah = nearLane(a), bh = nearLane(b)
            // Put labels on the short horizontal VM branches when possible,
            // rather than stacking them along the bridge's long vertical exit.
            return Number(bh) - Number(ah) || (ah && bh ? b.a.y - a.a.y : 0) || distance(b.a, b.b) - distance(a.a, a.b)
        })
    for (const segment of segments) for (const offset of [0, -30, 30]) {
        const horizontal = Math.abs(segment.a.y - segment.b.y) < EPS
        const point = { x: (segment.a.x + segment.b.x) / 2 + (horizontal ? 0 : offset),
            y: (segment.a.y + segment.b.y) / 2 + (horizontal ? offset : 0) }
        if (!cards.some(card => Math.abs(card.x - point.x) * 2 < card.width + width + 16
            && Math.abs(card.y - point.y) * 2 < card.height + 58)) return point
    }
    return undefined
}
