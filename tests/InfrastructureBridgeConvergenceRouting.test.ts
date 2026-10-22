import { strict as assert } from 'assert'
import { coordinateBridgeArrivals, convergenceRoutesCross } from '../src/InfrastructureBridgeConvergenceRouting'
import { routeInfrastructureTraffic } from '../src/InfrastructureTrafficRouting'
import { CompactRoute, RoutingCard, RoutingEdge, routeCardHits } from '../src/InfrastructureCompactRouting'
import { verticalCurve } from '../src/InfrastructureVMInterfaceRouting'

// Geometry captured from the reported bridge0/cloud0 -> r-161-VM scene.
const card = (id: string, type: string, x: number, y: number, width: number, height: number): RoutingCard => ({ id, type, x, y, width, height })
const cards = [card('bridge0', 'bridge', -2180.5, 2250, 340, 136), card('cloud0', 'bridge', -1804.5, 2250, 340, 136),
    card('router', 'libvirt', -782, 4449, 480, 380), card('system', 'libvirt', -510, 3864.5, 480, 388),
    { ...card('vlans', 'vlan', -1466.5, 2686, 440, 416), group: true },
    { ...card('bridges', 'bridge', -2393.5, 3262, 440, 416), group: true }]
const edges: RoutingEdge[] = ['bridge0', 'cloud0'].map(sourceID => ({ id: sourceID, sourceID, targetID: 'router' }))
const initial = () => {
    const a = verticalCurve({ x: -2180.5, y: 2318 }, { x: -782, y: 4259 })
    const b = verticalCurve({ x: -1804.5, y: 2318 }, { x: -1718.5, y: 2997.35 })
    const c = verticalCurve({ x: -1718.5, y: 2997.35 }, { x: -782, y: 4259 })
    return new Map<string, CompactRoute>([['bridge0', { ...a, trafficNodeID: 'router' }], ['cloud0', {
        path: b.path + c.path.slice(c.path.indexOf(' C')), points: b.points.concat(c.points.slice(1)), trafficNodeID: 'router' }]])
}
const clear = (edge: RoutingEdge, route: CompactRoute) => routeCardHits(edge, route.points, cards) === 0
const crosses = (routes: Map<string, CompactRoute>) => convergenceRoutesCross(routes.get('bridge0')!.points, routes.get('cloud0')!.points)

describe('Bridge arrivals at a shared VM', () => {
    it('removes the reported crossing while retaining every endpoint, measurement identity and card position', () => {
        const routes = initial(), before = JSON.stringify(cards)
        assert.equal(crosses(routes), true)
        coordinateBridgeArrivals(cards, edges, routes, new Map(), clear)
        assert.equal(crosses(routes), false)
        for (const edge of edges) {
            const old = initial().get(edge.id)!, route = routes.get(edge.id)!
            assert.deepEqual(route.points[0], old.points[0])
            assert.deepEqual(route.points[route.points.length - 1], old.points[old.points.length - 1])
            assert.equal(route.trafficNodeID, 'router')
            assert.equal(routeCardHits(edge, route.points, cards), 0)
        }
        assert.equal(JSON.stringify(cards), before)
        assert.equal(crosses(routeInfrastructureTraffic(cards, edges)), false)
    })
    it('is deterministic under shuffled input and preserves reversed link direction', () => {
        const normal = routeInfrastructureTraffic(cards, edges)
        const shuffled = routeInfrastructureTraffic(cards.slice().reverse(), edges.slice().reverse())
        for (const edge of edges) assert.equal(shuffled.get(edge.id)!.path, normal.get(edge.id)!.path)
        const reversedEdges = edges.map(edge => ({ ...edge, sourceID: edge.targetID, targetID: edge.sourceID }))
        const reversed = routeInfrastructureTraffic(cards, reversedEdges)
        for (const edge of edges) {
            const a = normal.get(edge.id)!.points, b = reversed.get(edge.id)!.points.slice().reverse()
            assert.equal(a.length, b.length)
            a.forEach((p, i) => assert.ok(Math.hypot(p.x - b[i].x, p.y - b[i].y) < 0.001))
        }
    })
    it('leaves blocked families, preferred Compact routes and unconnected destinations unchanged', () => {
        for (const preferred of [new Map(), new Map([['cloud0', initial().get('cloud0')!]])]) {
            const routes = initial(), paths = Array.from(routes.values()).map(r => r.path)
            coordinateBridgeArrivals(cards, edges, routes, preferred, () => false)
            assert.deepEqual(Array.from(routes.values()).map(r => r.path), paths)
        }
        const routes = initial(), original = routes.get('bridge0')
        coordinateBridgeArrivals(cards, [edges[0]], routes, new Map(), clear)
        assert.equal(routes.get('bridge0'), original)
    })
    it('keeps already ordered curves exactly unchanged', () => {
        const routes = new Map(edges.map(edge => [edge.id, verticalCurve({ x: cards.find(c => c.id === edge.sourceID)!.x, y: 2318 }, { x: -782, y: 4259 })]))
        const before = Array.from(routes.values())
        assert.equal(crosses(routes), false)
        coordinateBridgeArrivals(cards, edges, routes, new Map(), clear)
        assert.deepEqual(Array.from(routes.values()), before)
    })
})
