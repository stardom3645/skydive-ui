import { strict as assert } from 'assert'
import { separateInterfaceVLANRoutes } from '../src/InfrastructureVLANRouting'
import { RoutingCard, RoutingEdge, CompactRoute, compactRouteFromPoints, routeCardHits, segmentHitsCard } from '../src/InfrastructureCompactRouting'

function fixture() {
    const nic: RoutingCard = { id: 'nic', type: 'device', x: 0, y: 0, width: 280, height: 112 }
    const vlans: RoutingCard[] = [1000, 1400, 1800, 2200].map((x, i) => ({ id: `vlan-${i}`, type: 'vlan', x, y: 800, width: 280, height: 112 }))
    const cards = [nic, ...vlans]
    const edges: RoutingEdge[] = vlans.map(vlan => ({ id: `nic-${vlan.id}`, sourceID: nic.id, targetID: vlan.id }))
    const routes = new Map<string, CompactRoute>(edges.map((edge, i) => [edge.id, {
        ...compactRouteFromPoints([{ x: 0, y: 56 }, { x: 0, y: 90 }, { x: -400, y: 90 },
            { x: -400, y: 200 }, { x: vlans[i].x, y: 200 }, { x: vlans[i].x, y: 744 }]), trafficNodeID: vlans[i].id }]))
    const clear = (edge: RoutingEdge, route: CompactRoute) => !routeCardHits(edge, route.points, cards)
        && !cards.filter(card => card.id === edge.sourceID || card.id === edge.targetID).some(card =>
            route.points.slice(1).some((point, i) => segmentHitsCard(route.points[i], point, card)))
    return { cards, edges, routes, clear }
}

describe('Infrastructure coincident NIC/VLAN traffic routes', () => {
    it('separates long shared straight paths into individual clear curves without changing cards, traffic IDs or edges', () => {
        const { cards, edges, routes, clear } = fixture()
        const before = JSON.stringify(cards), labels = edges.map(edge => routes.get(edge.id)!.trafficNodeID)
        separateInterfaceVLANRoutes(cards, edges, routes, new Map(), clear)
        assert.equal(routes.size, edges.length)
        assert.equal(JSON.stringify(cards), before)
        assert.equal(new Set(Array.from(routes.values()).map(route => route.path)).size, edges.length)
        edges.forEach((edge, i) => {
            const route = routes.get(edge.id)!
            assert.ok(route.path.includes(' C'))
            assert.ok(clear(edge, route))
            assert.equal(route.trafficNodeID, labels[i])
            assert.equal(route.points[0].y, 56)
            assert.equal(route.points[route.points.length - 1].y, 744)
        })
        const other = fixture()
        separateInterfaceVLANRoutes(other.cards.slice().reverse(), other.edges.slice().reverse(), other.routes, new Map(), other.clear)
        edges.forEach(edge => assert.equal(routes.get(edge.id)!.path, other.routes.get(edge.id)!.path))
    })
    it('stays deterministic when a relation direction is reversed', () => {
        const f = fixture()
        const reverse = fixture()
        reverse.edges.forEach(edge => { [edge.sourceID, edge.targetID] = [edge.targetID, edge.sourceID]
            reverse.routes.set(edge.id, { ...compactRouteFromPoints(reverse.routes.get(edge.id)!.points.slice().reverse()), trafficNodeID: edge.sourceID }) })
        separateInterfaceVLANRoutes(f.cards, f.edges, f.routes, new Map(), f.clear)
        separateInterfaceVLANRoutes(reverse.cards, reverse.edges, reverse.routes, new Map(), reverse.clear)
        f.edges.forEach(edge => assert.deepEqual(reverse.routes.get(edge.id)!.points, f.routes.get(edge.id)!.points.slice().reverse()))
    })
    it('uses separated local lanes when a curve is blocked and never crosses a card', () => {
        const f = fixture()
        f.cards.push({ id: 'blocker', x: 500, y: 400, width: 600, height: 300 })
        separateInterfaceVLANRoutes(f.cards, f.edges, f.routes, new Map(), f.clear)
        assert.ok(f.routes.get(f.edges[0].id)!.path.includes(' Q'))
        const lanes = f.edges.map(edge => f.routes.get(edge.id)!).filter(route => !route.path.includes(' C'))
        assert.equal(new Set(lanes.map(route => route.points[3].y)).size, lanes.length)
        f.edges.forEach(edge => assert.ok(f.clear(edge, f.routes.get(edge.id)!)))
    })
    it('preserves existing curves, non-overlapping straights, groups and precomputed Compact paths', () => {
        for (const mode of ['curve', 'single', 'group', 'preferred', 'vm']) {
            const f = fixture()
            if (mode === 'curve') f.routes.forEach(route => { route.path = 'M0,56 C0,400 1000,400 1000,744' })
            if (mode === 'single') f.edges.splice(1)
            if (mode === 'group') f.cards[0].group = true
            if (mode === 'vm') f.cards[0].type = 'libvirt'
            const before = Array.from(f.routes.values()).map(route => route.path)
            separateInterfaceVLANRoutes(f.cards, f.edges, f.routes, mode === 'preferred' ? new Map(f.routes) : new Map(), f.clear)
            assert.deepEqual(Array.from(f.routes.values()).map(route => route.path), before)
        }
    })
})
