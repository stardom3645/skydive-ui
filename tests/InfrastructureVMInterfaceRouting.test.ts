import { strict as assert } from 'assert'
import { routeInfrastructureTraffic } from '../src/InfrastructureTrafficRouting'
import { RoutingCard, RoutingEdge, nearestCompactEdge, routeCardHits, segmentHitsCard } from '../src/InfrastructureCompactRouting'

const vm: RoutingCard = { id: 'vm', type: 'libvirt', x: 0, y: 0, width: 480, height: 388 }
const nics: RoutingCard[] = [-516, 0, 516].map((x, i) => ({ id: `nic-${i}`, type: 'tuntap', vmOwnerID: vm.id,
    x, y: 475, width: 480, height: 136 }))
const bridge: RoutingCard = { id: 'bridge', type: 'bridge', x: -900, y: -1000, width: 340, height: 136 }
const edges: RoutingEdge[] = [
    ...nics.map(nic => ({ id: `owner-${nic.id}`, sourceID: nic.id, targetID: vm.id })),
    { id: 'external-nic-0', sourceID: bridge.id, targetID: nics[0].id }
]
const cards = [vm, ...nics, bridge]

describe('Nearby VM interface traffic ports', () => {
    it('spreads VM departures and separates NIC arrivals from external traffic without moving cards or bridges', () => {
        const before = JSON.stringify(cards)
        const routes = routeInfrastructureTraffic(cards, edges)
        const baseline = routeInfrastructureTraffic(cards.map(({ vmOwnerID, ...card }) => card), edges)
        const vmAnchors = new Set<number>()
        for (const edge of edges.slice(0, 3)) {
            const route = routes.get(edge.id)!
            const end = route.points[route.points.length - 1]
            assert.equal(route.trafficNodeID, edge.sourceID, 'labels stay with the owned NIC, including reverse-directed edges')
            vmAnchors.add(end.x)
            assert.equal(end.y, vm.height / 2)
            assert.equal(routeCardHits(edge, route.points, cards), 0)
            for (const endpoint of cards.filter(c => c.id === edge.sourceID || c.id === edge.targetID)) {
                assert.equal(route.points.slice(1).some((p, i) => segmentHitsCard(route.points[i], p, endpoint)), false)
            }
            assert.equal(nearestCompactEdge(Array.from(routes, ([id, route]) => ({ id, route })), route.points[0]), edge.id)
        }
        assert.equal(vmAnchors.size, 3)
        const ownAnchor = routes.get('owner-nic-0')!.points[0]
        const external = routes.get('external-nic-0')!
        assert.ok(Math.abs(ownAnchor.x - external.points[external.points.length - 1].x) >= 24)
        assert.equal(external.path, baseline.get('external-nic-0')!.path, 'the bridge route is exactly unchanged')
        assert.equal(routes.size, edges.length)
        assert.equal(JSON.stringify(cards), before)
        const shuffled = routeInfrastructureTraffic(cards.slice().reverse(), edges.slice().reverse())
        edges.forEach(e => assert.equal(shuffled.get(e.id)!.path, routes.get(e.id)!.path))
        const reverseEdges = edges.map(e => ({ ...e, sourceID: e.targetID, targetID: e.sourceID }))
        const reversed = routeInfrastructureTraffic(cards, reverseEdges)
        edges.slice(0, 3).forEach(e => assert.deepEqual(reversed.get(e.id)!.points, routes.get(e.id)!.points.slice().reverse()))
    })
    it('retains precomputed Compact routes and the old paths when a branch is blocked', () => {
        const baseline = routeInfrastructureTraffic(cards.map(({ vmOwnerID, ...card }) => card), edges)
        const preferred = new Map(edges.slice(0, 3).map(e => [e.id, baseline.get(e.id)!]))
        const compact = routeInfrastructureTraffic(cards, edges, preferred)
        edges.slice(0, 3).forEach(e => assert.equal(compact.get(e.id), preferred.get(e.id)))
        const blocked = [...cards, { id: 'blocker', x: -516, y: 310, width: 440, height: 160 }]
        const old = routeInfrastructureTraffic(blocked.map(({ vmOwnerID, ...card }) => card), edges)
        const kept = routeInfrastructureTraffic(blocked, edges)
        edges.forEach(e => assert.equal(kept.get(e.id)!.path, old.get(e.id)!.path))
    })
    it('does not infer ownership from same-row placement, or modify distant and multi-row connections', () => {
        const scenarios: RoutingCard[][] = [cards.map(({ vmOwnerID, ...card }) => card),
            cards.map(c => c.id === 'nic-0' ? { ...c, y: c.y + 200 } : c),
            cards.map(c => c.vmOwnerID ? { ...c, y: c.y + 1000 } : c)]
        for (const modified of scenarios) {
            const old = routeInfrastructureTraffic(modified.map(({ vmOwnerID, ...card }) => card), edges)
            const kept = routeInfrastructureTraffic(modified, edges)
            edges.forEach(e => assert.equal(kept.get(e.id)!.path, old.get(e.id)!.path))
        }
    })
})
