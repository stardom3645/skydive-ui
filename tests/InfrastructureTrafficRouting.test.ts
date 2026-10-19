import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { routeInfrastructureTraffic } from '../src/InfrastructureTrafficRouting'
import { RoutingCard, RoutingEdge, routeCardHits, segmentHitsCard, routeCompactEdges, nearestCompactEdge, compactRouteFromPoints } from '../src/InfrastructureCompactRouting'
import { infrastructureVirtualNICOwners } from '../src/InfrastructureVMBundles'

const card = (id: string, x: number, y: number, width = 280, height = 112): RoutingCard => ({ id, x, y, width, height })
const edge: RoutingEdge = { id: 'relation:nic-port', sourceID: 'nic', targetID: 'port' }
function assertClear(cards: RoutingCard[], relation = edge) {
    const route = routeInfrastructureTraffic(cards, [relation]).get(relation.id)!
    assert.ok(route)
    assert.equal(routeCardHits(relation, route.points, cards), 0)
    for (const endpoint of cards.filter(card => card.id === relation.sourceID || card.id === relation.targetID)) {
        assert.equal(route.points.slice(1).some((p, i) => segmentHitsCard(route.points[i], p, endpoint)), false,
            `route returns through endpoint ${endpoint.id}`)
    }
    return route
}

describe('Infrastructure traffic card avoidance', () => {
    it('curves into a safe column gap when VM and summary cards block a single sweeping curve', () => {
        const bridge = { ...card('bridge', -1758.5, 3262, 340, 136), type: 'bridge' }
        const matrix = Array.from({ length: 10 }, (_, row) => Array.from({ length: 3 }, (_, column) => ({
            ...card(`vm-${row}-${column}`, -1431.5 + column * 544, 4489.5 + row * 758.5, 480, 558), type: 'libvirt'
        }))).reduce((all, row) => all.concat(row), [])
        const cards = [bridge, ...matrix, { ...card('router-group', -1159.5, 3820, 480, 380), group: true },
            { ...card('vm-group', -1975.5, 4449, 480, 558), group: true }]
        const relation = { id: 'bridge-vm', sourceID: bridge.id, targetID: 'vm-9-2' }
        const route = assertClear(cards, relation)
        assert.ok(route.path.includes(' C') && !route.path.includes(' L'), 'enter and leave the clear column corridor smoothly')
        assert.ok(route.points.every((p, i) => i === 0 || p.y >= route.points[i - 1].y), 'keep the route moving toward its destination')
        assert.equal(routeInfrastructureTraffic(cards.slice().reverse(), [relation]).get(relation.id)!.path, route.path)
        const reversed = { ...relation, sourceID: relation.targetID, targetID: relation.sourceID }
        const opposite = assertClear(cards.slice().reverse(), reversed)
        assert.ok(opposite.path.includes(' C') && !opposite.path.includes(' L'))
        assert.ok(opposite.points.every((p, i) => i === 0 || p.y <= opposite.points[i - 1].y))
    })
    it('uses the gap above a late VM row instead of a right-angle perimeter around the whole matrix', () => {
        const bridge = { ...card('bridge', -2000, 0, 340, 136), type: 'bridge' }
        const matrix = Array.from({ length: 4 }, (_, row) => Array.from({ length: 7 }, (_, column) => ({
            ...card(`vm-${row}-${column}`, 600 + column * 544, 1800 + row * 760, 480, 558), type: 'libvirt'
        }))).reduce((all, row) => all.concat(row), [])
        const target = { ...card('last-vm', 2232, 4840, 480, 558), type: 'libvirt' }
        const cards = [bridge, ...matrix, target]
        const relation = { id: 'bridge-last-vm', sourceID: bridge.id, targetID: target.id }
        const before = JSON.stringify(cards)
        const route = assertClear(cards, relation)
        assert.ok(route.path.includes(' C') && !route.path.includes(' L'), 'use a smooth corridor beside the dense rows')
        assert.ok(route.points.every(p => p.x >= bridge.x && p.x <= target.x), 'do not circle the entire VM matrix')
        assert.ok(route.points.every((p, i) => i === 0 || p.y >= route.points[i - 1].y), 'no backward bends')
        const reversed = { ...relation, sourceID: target.id, targetID: bridge.id }
        const opposite = routeInfrastructureTraffic(cards.slice().reverse(), [reversed]).get(relation.id)!
        assert.deepEqual(opposite.points.slice().reverse(), route.points)
        assert.equal(JSON.stringify(cards), before)
    })
    it('uses the open middle corridor for four destinations and adapts when an intervening card expands', () => {
        const bridges = [-1200, -800].map((x, i) => ({ ...card(`bridge-${i}`, x, 0, 340, 136), type: 'bridge' }))
        const routers = [-200, 344, 888, 1432].map((x, i) => ({ ...card(`router-${i}`, x, 1600, 480, 380), type: 'libvirt' }))
        const cards = [...bridges, ...routers, { ...card('left-group', -1400, 1000, 440, 416), group: true },
            { ...card('right-group', 1800, 500, 440, 416), group: true }]
        const edges = bridges.reduce<RoutingEdge[]>((all, bridge) => all.concat(routers.map(router => ({
            id: `${bridge.id}-${router.id}`, sourceID: bridge.id, targetID: router.id }))), [])
        const before = JSON.stringify(cards), open = routeInfrastructureTraffic(cards, edges)
        edges.forEach(edge => {
            const route = open.get(edge.id)!, source = bridges.find(b => b.id === edge.sourceID)!, target = routers.find(r => r.id === edge.targetID)!
            assert.ok(route.path.includes(' C') && !route.path.includes(' L'), 'four resources do not force a perimeter rectangle')
            assert.ok(route.points.every(p=>p.x >= Math.min(source.x, target.x) && p.x <= Math.max(source.x, target.x)))
            assert.equal(routeCardHits(edge, route.points, cards), 0)
            assert.equal(route.trafficNodeID, target.id)
        })
        const blockedCards = [...cards, card('expanded-middle-card', 700, 800, 400, 360)]
        const blocked = routeInfrastructureTraffic(blockedCards, edges)
        edges.forEach(edge => assert.equal(routeCardHits(edge, blocked.get(edge.id)!.points, blockedCards), 0))
        assert.ok(edges.some(edge => blocked.get(edge.id)!.path !== open.get(edge.id)!.path))
        assert.equal(blocked.get('bridge-0-router-0')!.path, open.get('bridge-0-router-0')!.path,
            'an unobstructed branch must not follow the detour needed by another member of the row')
        const restored = routeInfrastructureTraffic(cards.slice().reverse(), edges.slice().reverse())
        edges.forEach(edge=>assert.equal(restored.get(edge.id)!.path, open.get(edge.id)!.path))
        assert.equal(JSON.stringify(cards), before)
    })
    it('uses a smooth local corridor for a sparse router NIC below a dense VM row', () => {
        const bridge = { ...card('bridge', -3044, 2250, 340, 136), type: 'bridge' }
        const system = { ...card('system', -1546, 3864.5, 480, 388), type: 'libvirt' }
        const routers = [-3150, -2606, -2062, -1002, 58, 602].map((x, i) => ({
            ...card(`router-${i}`, x, 4449, 480, 380), type: 'libvirt' }))
        const nics = [-1518, -1002, -486].map((x, i) => ({ ...card(`nic-${i}`, x, 4924, 480, 270),
            type: 'tuntap', vmOwnerID: 'router-3' }))
        const cards = [bridge, system, ...routers, ...nics,
            { ...card('bridge-group', -3257, 3262, 440, 416), group: true },
            { ...card('vlan-group', -1929, 2686, 440, 416), group: true }]
        const edges = [system, ...routers, nics[2]].map(target => ({ id: `bridge-${target.id}`, sourceID: bridge.id, targetID: target.id }))
        const before = JSON.stringify(cards)
        const routes = routeInfrastructureTraffic(cards, edges)
        const external = routes.get('bridge-nic-2')!
        assert.ok(external.path.includes(' C'))
        assert.ok(!external.path.includes(' L'), 'do not follow the wide bus below the entire router row')
        assert.equal(routeCardHits(edges[edges.length - 1], external.points, cards), 0)
        assert.ok(external.points.every(point => point.x >= bridge.x && point.x <= nics[2].x), 'stay between the real endpoints')
        assert.equal(external.trafficNodeID, nics[2].id)
        const shuffled = routeInfrastructureTraffic(cards.slice().reverse(), edges.slice().reverse())
        assert.equal(shuffled.get('bridge-nic-2')!.path, external.path)
        assert.equal(JSON.stringify(cards), before)
    })
    it('keeps wide switch-port connections as vertical curves instead of cutting across the port row', () => {
        const ports = Array.from({ length: 9 }, (_, i) => ({ ...card(`port-${i}`, 800 + i * 404, 0, 340, 136), type: 'switchport' }))
        const host = { ...card('host', 800, 700, 580, 436), type: 'host' }
        const cards = [...ports, host]
        const edges = [3, 6, 8].map(i => ({ id: `port-host-${i}`, sourceID: ports[i].id, targetID: host.id }))
        const before = JSON.stringify(cards)
        const routes = routeInfrastructureTraffic(cards, edges)
        edges.forEach(edge => {
            const source = ports.find(p => p.id === edge.sourceID)!, route = routes.get(edge.id)!
            assert.ok(route.path.includes(' C'), 'every clear port uses the same natural curve')
            assert.equal(route.trafficNodeID, host.id, 'keep rates near the host instead of behind its detail panel')
            assert.equal(route.points[0].x, source.x)
            assert.equal(route.points[0].y, source.height / 2)
            assert.equal(route.points[route.points.length - 1].y, host.y - host.height / 2)
            assert.equal(routeCardHits(edge, route.points, cards), 0)
        })
        const reversed = routeInfrastructureTraffic(cards.slice().reverse(), edges.slice().reverse())
        edges.forEach(edge => assert.equal(reversed.get(edge.id)!.path, routes.get(edge.id)!.path))
        const opposite = edges.map(edge => ({ ...edge, sourceID: edge.targetID, targetID: edge.sourceID }))
        opposite.forEach(edge => assert.ok(routeInfrastructureTraffic(cards, opposite).get(edge.id)!.path.includes(' C')))
        const blocked = [...cards, card('real-blocker', 2416, 275, 300, 200)]
        const obstructed = routeInfrastructureTraffic(blocked, edges).get(edges[2].id)!
        assert.equal(routeCardHits(edges[2], obstructed.points, blocked), 0, 'real obstacles still require safe routing')
        assert.equal(JSON.stringify(cards), before)
    })
    it('rechecks disproportionate precomputed paths outside Compact VM/NIC units', () => {
        const cards = [card('nic', 0, 1000), card('port', 600, 0)]
        const perimeter = compactRouteFromPoints([{ x: 0, y: 944 }, { x: 0, y: 900 }, { x: 6000, y: 900 },
            { x: 6000, y: 80 }, { x: 600, y: 80 }, { x: 600, y: 56 }])
        const preferred = new Map([[edge.id, perimeter]])
        const route = routeInfrastructureTraffic(cards, [edge], preferred).get(edge.id)!
        assert.ok(route.path.includes(' C'))
        assert.ok(route.points.every(point => point.x >= 0 && point.x <= 600))
        const region = { ...card('own-unit', 300, 500, 1000, 1400), nodeIDs: ['nic', 'port'] }
        assert.equal(routeInfrastructureTraffic(cards, [edge], preferred, [region]).get(edge.id), perimeter,
            'keep intentionally precomputed Compact VM/NIC geometry')
    })
    it('keeps nearby fan-out endpoints local when a distant row forces the common bus to the far side', () => {
        const bridge = { ...card('bridge', 0, 0), type: 'bridge' }
        const targets = [600, 1600, 3400, 6000].map((x, i) => ({ ...card(`vm-${i}`, x, 1300, 480, 388), type: 'libvirt' }))
        const cards = [bridge, card('left-departure-blocker', -250, 80, 220, 100), ...targets]
        const edges = targets.map(target => ({ id: `bridge-${target.id}`, sourceID: bridge.id, targetID: target.id }))
        const before = JSON.stringify(cards), routes = routeInfrastructureTraffic(cards, edges)
        for (const edge of edges) {
            const route = routes.get(edge.id)!
            assert.equal(routeCardHits(edge, route.points, cards), 0)
            assert.equal(route.trafficNodeID, edge.targetID, 'retain per-interface measurement placement')
        }
        const nearby = routes.get(edges[0].id)!
        assert.ok(nearby.points.every(point => point.x >= 0 && point.x <= targets[0].x), 'do not follow the 6,000px-wide row perimeter')
        assert.ok(nearby.path.includes(' C'))
        assert.ok(routes.get(edges[3].id)!.path.includes(' C'), 'a clear distant connection also stays inside the open corridor')
        assert.equal(JSON.stringify(cards), before)
        const reversed = routeInfrastructureTraffic(cards.slice().reverse(), edges.slice().reverse())
        edges.forEach(edge => assert.equal(reversed.get(edge.id)?.path, routes.get(edge.id)?.path))

        // If the direct curve is obstructed, a local orthogonal detour must
        // remain clear without expanding to the same distant perimeter.
        const blocked = [...cards, card('local-blocker', 200, 500, 200, 500)]
        const local = routeInfrastructureTraffic(blocked, edges).get(edges[0].id)!
        assert.equal(routeCardHits(edges[0], local.points, blocked), 0)
        assert.ok(local.points.every(point => point.x < 1000))
        assert.ok(local.path.includes(' C') || local.path.includes(' Q'))
    })

    it('uses clear leading curves and adapts dense lower rows to actual obstacles', () => {
        const bridge = { ...card('bridge', 0, 0), type: 'bridge' }
        const leading = Array.from({ length: 3 }, (_, i) => ({ ...card(`system-${i}`, (i - 1) * 544, 1100, 480, 388), type: 'libvirt' }))
        const lower = Array.from({ length: 8 }, (_, i) => ({ ...card(`user-${i}`, i * 544, 2200, 480, 558), type: 'libvirt' }))
        const cards = [bridge, ...leading, ...lower], before = JSON.stringify(cards)
        const edges = [...leading, ...lower].map(target => ({ id: `bridge-${target.id}`, sourceID: bridge.id, targetID: target.id }))
        const routes = routeInfrastructureTraffic(cards, edges)
        leading.forEach(target => {
            const edge = edges.find(e => e.targetID === target.id)!, route = routes.get(edge.id)!
            assert.ok(route.path.includes(' C'), 'clear leading links do not take a side bus')
            assert.equal(routeCardHits(edge, route.points, cards), 0)
            assert.ok(route.points.every(p => p.x >= Math.min(bridge.x, target.x) && p.x <= Math.max(bridge.x, target.x)))
        })
        lower.forEach(target => {
            const edge = edges.find(edge=>edge.targetID === target.id)!, route = routes.get(edge.id)!
            assert.equal(routeCardHits(edge, route.points, cards), 0)
            assert.equal(route.trafficNodeID, target.id)
        })
        assert.equal(routes.size, edges.length)
        assert.equal(JSON.stringify(cards), before)
        // Multiple interfaces can collapse onto one VM; count visible objects,
        // retain every measurement, and keep labels at their own endpoint.
        const duplicateEdges = [...edges, ...edges.slice(0, 3).map(e => ({ ...e, id: `${e.id}-extra-nic` }))]
        const duplicateRoutes = routeInfrastructureTraffic(cards, duplicateEdges)
        assert.equal(duplicateRoutes.size, duplicateEdges.length)
        duplicateEdges.filter(e => e.targetID.startsWith('system')).forEach(e => {
            assert.ok(duplicateRoutes.get(e.id)!.path.includes(' C'))
            assert.equal(duplicateRoutes.get(e.id)!.trafficNodeID, e.targetID)
        })
        const reversed = routeInfrastructureTraffic(cards.slice().reverse(), edges.slice().reverse())
        edges.forEach(edge => assert.equal(reversed.get(edge.id)?.path, routes.get(edge.id)?.path))
        const opposite = edges.map(e => ({ ...e, sourceID: e.targetID, targetID: e.sourceID }))
        opposite.forEach(e => assert.equal(routeCardHits(e, routeInfrastructureTraffic(cards, opposite).get(e.id)!.points, cards), 0))
        // A real blocker still requires a clear detour, which may now use a
        // shorter local corridor instead of the far side of the dense row.
        const blocked = [...cards, card('blocker', 0, 550, 580, 440)]
        const fallback = routeInfrastructureTraffic(blocked, edges)
        leading.forEach(target => {
            const edge = edges.find(edge => edge.targetID === target.id)!
            assert.equal(routeCardHits(edge, fallback.get(edge.id)!.points, blocked), 0)
        })
        const region = { ...card('foreign-bundle', 0, 550, 580, 440), nodeIDs: ['foreign-vm', 'foreign-nic'] }
        const withRegion = routeInfrastructureTraffic(cards, edges, new Map(), [region])
        leading.forEach(target => {
            const route = withRegion.get(`bridge-${target.id}`)!
            assert.ok(route.points.length >= 4)
            assert.equal(route.points.slice(1).some((p, i) => segmentHitsCard(route.points[i], p, region)), false)
        })
        const preferred = new Map(edges.slice(0, 3).map(edge => [edge.id, routes.get(edge.id)!]))
        const compact = routeInfrastructureTraffic(cards, edges, preferred)
        leading.forEach(target => {
            const edge = edges.find(edge => edge.targetID === target.id)!
            assert.equal(routeCardHits(edge, compact.get(edge.id)!.points, cards), 0)
        })
        lower.forEach(target => assert.equal(routes.get(`bridge-${target.id}`)!.path, compact.get(`bridge-${target.id}`)!.path,
            'lower bus geometry remains identical to the previous routing rule'))
    })
    it('routes dense bridge fan-out through safe local corridors with stable endpoints and hit targets', () => {
        const cards = [{ ...card('bridge', -500, 0), type: 'bridge' },
            card('middle-host', 350, 450, 580, 404),
            ...Array.from({ length: 16 }, (_, i) => ({ ...card(`vm-${i}`, (i % 8) * 544, 1100 + Math.floor(i / 8) * 800, 480, 558), type: 'libvirt', above: 41 }))]
        const edges = cards.filter(c => c.type === 'libvirt').map(c => ({ id: `bridge-${c.id}`, sourceID: 'bridge', targetID: c.id }))
        const before = JSON.stringify(cards), routes = routeInfrastructureTraffic(cards, edges)
        assert.equal(routes.size, edges.length)
        edges.forEach(edge => {
            const route = routes.get(edge.id)!
            assert.equal(routeCardHits(edge, route.points, cards), 0)
            assert.equal(route.points[0].x, -500)
            assert.equal(route.points[0].y, 56)
            assert.ok(route.points[1].y > 56)
            assert.ok(route.path.includes(' C') || route.path.includes(' Q'))
            assert.equal(route.trafficNodeID, edge.targetID)
            const endpoint = route.points[route.points.length - 1]
            assert.equal(nearestCompactEdge(Array.from(routes, ([id, route]) => ({ id, route })), { x: endpoint.x, y: endpoint.y - 8 }), edge.id)
        })
        assert.equal(JSON.stringify(cards), before)
        const reversed = routeInfrastructureTraffic(cards.slice().reverse(), edges.slice().reverse())
        edges.forEach(edge => assert.equal(reversed.get(edge.id)?.path, routes.get(edge.id)?.path))
        const opposite = edges.map(e => ({ ...e, sourceID: e.targetID, targetID: e.sourceID }))
        const back = routeInfrastructureTraffic(cards, opposite)
        opposite.forEach(e => assert.deepEqual(back.get(e.id)?.points, routes.get(e.id)?.points.slice().reverse()))
    })

    it('keeps bridge lanes outside foreign VM/NIC units, including expanded lower interfaces', () => {
        const bridge = { ...card('bridge', -500, 0), type: 'ovsbridge' }
        const vms = Array.from({ length: 8 }, (_, i) => ({ ...card(`vm-${i}`, (i % 4) * 544, 1100 + Math.floor(i / 4) * 1100, 480, 558), type: 'libvirt', above: 41 }))
        const nics = vms.map(vm => ({ ...card(`nic-${vm.id}`, vm.x, vm.y + 470, 480, 120), type: 'tuntap' }))
        const cards = [bridge, ...vms, ...nics]
        const regions = vms.map(vm => ({ ...card(`bundle-${vm.id}`, vm.x, vm.y + 125, 504, 858), nodeIDs: [vm.id, `nic-${vm.id}`] }))
        const edges = vms.map(vm => ({ id: `bridge-${vm.id}`, sourceID: bridge.id, targetID: vm.id }))
        const routes = routeInfrastructureTraffic(cards, edges, new Map(), regions)
        edges.forEach(e => {
            const route = routes.get(e.id)!
            assert.equal(routeCardHits(e, route.points, cards), 0)
            assert.ok(route.path.includes(' C') || route.points.length === 6, 'clear rows use curves; blocked rows retain a shared lane')
            regions.filter(r => !r.nodeIDs.includes(e.targetID)).forEach(region =>
                assert.equal(route.points.slice(1).some((p, i) => segmentHitsCard(route.points[i], p, region)), false))
        })
        const withExpandedNIC = edges.map((e, i) => i ? e : { ...e, targetID: nics[0].id })
        const expanded = routeInfrastructureTraffic(cards, withExpandedNIC, new Map(), regions)
        withExpandedNIC.forEach(e => {
            const route = expanded.get(e.id)!
            assert.equal(routeCardHits(e, route.points, cards), 0)
            assert.ok(route.path.includes(' C') || route.points.length <= 6, 'sparse rows may leave the common bus when a clear local path exists')
        })
        const middleNIC = edges.map((e, i) => i === 2 ? { ...e, targetID: nics[2].id } : e)
        const middle = routeInfrastructureTraffic(cards, middleNIC, new Map(), regions)
        middleNIC.forEach(e => {
            const route = middle.get(e.id)!
            assert.equal(routeCardHits(e, route.points, cards), 0)
            assert.ok(route.path.includes(' C') || route.points.length <= 10, 'sparse rows use clear curves or a short local detour')
            regions.filter(r => !r.nodeIDs.includes(e.targetID)).forEach(region =>
                assert.equal(route.points.slice(1).some((p, i) => segmentHitsCard(route.points[i], p, region)), false))
        })
    })

    it('keeps different bridge identities distinct while using clear curves instead of unnecessary buses', () => {
        const bridges = [{ ...card('bridge-a', -600, 0), type: 'bridge' }, { ...card('bridge-b', -250, 0), type: 'bridge' }]
        const vms = Array.from({ length: 4 }, (_, i) => ({ ...card(`vm-${i}`, i * 544, 1100, 480, 558), type: 'libvirt' }))
        const cards = [...bridges, ...vms]
        const edges: RoutingEdge[] = []
        bridges.forEach(bridge => vms.forEach(target => edges.push({ id: `${bridge.id}-${target.id}`, sourceID: bridge.id, targetID: target.id })))
        const routes = routeInfrastructureTraffic(cards, edges)
        edges.forEach(edge => {
            const route = routes.get(edge.id)!
            assert.ok(route.path.includes(' C'))
            assert.equal(route.points[0].x, bridges.find(b => b.id === edge.sourceID)!.x)
        })
        vms.forEach(vm => assert.notEqual(routes.get(`bridge-a-${vm.id}`)!.path, routes.get(`bridge-b-${vm.id}`)!.path))
        edges.forEach(e => assert.equal(routeCardHits(e, routes.get(e.id)!.points, cards), 0))
        const grouped = cards.map(c => c.id.startsWith('bridge') ? { ...c, group: true } : c)
        const legacy = routeInfrastructureTraffic(grouped.map(({ type, ...c }) => c), edges)
        const groups = routeInfrastructureTraffic(grouped, edges)
        edges.forEach(e => assert.equal(groups.get(e.id)?.path, legacy.get(e.id)?.path))
    })

    it('leaves the NIC and switch-port borders before routing around a different host', () => {
        const cards = [card('nic', 0, 1000), card('port', 1600, 0), card('host', 800, 500, 580, 440)]
        const route = assertClear(cards)
        assert.equal(route.points[0].y, 944)
        assert.ok(route.points[1].y < 944)
        const end = route.points[route.points.length - 1], previous = route.points[route.points.length - 2]
        assert.equal(end.y, 56)
        assert.ok(previous.y - end.y >= 24, 'leave a visible gap below the switch-port rim before the horizontal turn')
        assert.ok(route.path.includes(' C') || route.path.includes(' Q'), 'detours stay curved or rounded')
    })
    it('avoids same-row siblings and both endpoint neighborhoods in either direction', () => {
        const cards = [card('nic', 0, 0), card('port', 1600, 0), card('other-a', 310, 0), card('other-b', 1290, 0)]
        assertClear(cards)
        assertClear(cards, { ...edge, sourceID: edge.targetID, targetID: edge.sourceID })
    })
    it('can leave the opposite border if the preferred departure is blocked', () => {
        const cards = [card('nic', 0, 1000), card('port', 1600, 0), card('close', 0, 880, 600, 100),
            card('host', 800, 500, 580, 440)]
        assertClear(cards)
    })
    it('preserves clear curves, existing Compact routes, edge IDs and card positions', () => {
        const cards = [card('nic', 0, 1000), card('port', 0, 0)]
        const before = JSON.stringify(cards)
        const curve = routeInfrastructureTraffic(cards, [edge]).get(edge.id)!
        assert.ok(curve.path.includes(' C'))
        const compact = routeCompactEdges(cards, [edge])!
        assert.equal(routeInfrastructureTraffic(cards, [edge], compact).get(edge.id), compact.get(edge.id))
        assert.equal(JSON.stringify(cards), before)
        assert.equal(routeInfrastructureTraffic(cards.slice().reverse(), [edge]).get(edge.id)?.path, curve.path)
    })
    it('keeps foreign VM/NIC regions clear without changing a VM-owned route', () => {
        const cards = [card('nic', 0, 1000), card('port', 1600, 0)]
        const region = { ...card('bundle', 800, 500, 600, 500), nodeIDs: ['vm', 'virtual-nic'] }
        const route = routeInfrastructureTraffic(cards, [edge], new Map(), [region]).get(edge.id)!
        assert.equal(route.points.slice(1).some((p, i) => segmentHitsCard(route.points[i], p, region)), false)
    })
})

describe('Infrastructure traffic routing integration', () => {
    it('reuses geometry through metric updates, recalculates on card movement and excludes Kubernetes', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
        const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        const topology = ast.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'Topology') as ts.ClassDeclaration
        const method = topology.members.find(n => n.name?.getText(ast) === 'updateInfrastructureTrafficRoutes')!
        let computations = 0
        const context: any = { WrapperType: { Hidden: 2 }, infrastructureVirtualNICOwners, routeInfrastructureTraffic: (...args: any[]) => {
            computations++; return (routeInfrastructureTraffic as any)(...args)
        } }
        vm.createContext(context)
        vm.runInContext(ts.transpile(`class Probe { ${method.getText(ast)} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
        const probe = new context.Probe(), cards = [card('nic', 0, 1000), card('port', 1600, 0), card('host', 800, 500, 580, 440)]
        Object.assign(probe, { nodeTagActive: 'infrastructure', infrastructureTrafficRouteKey: '',
            infrastructureTrafficRoutes: new Map(), topologyEdgeBounds: (node: any) => ({ x: node.x, y: node.y, width: node.width, height: node.height }),
            topologyLaneItem: () => ({ above: 0, below: 0 }), isLinkVisible: () => true, linkDisplayOpacity: () => 1,
            nodes: new Map(), d3nodes: new Map(cards.map(c => [c.id, { ...c, data: { id: c.id, type: 1, wrapped: {} } }])) })
        const links = [{ id: 'nic-port', source: { id: 'nic' }, target: { id: 'port' }, metric: 1 }]
        probe.updateInfrastructureTrafficRoutes(links)
        links[0].metric = 200
        probe.updateInfrastructureTrafficRoutes(links)
        assert.equal(computations, 1)
        probe.d3nodes.get('nic').data.wrapped.state = { selected: true }
        probe.updateInfrastructureTrafficRoutes(links)
        assert.equal(computations, 1)
        probe.d3nodes.get('host').x += 100
        probe.updateInfrastructureTrafficRoutes(links)
        assert.equal(computations, 2)
        probe.nodeTagActive = 'kubernetes'
        probe.updateInfrastructureTrafficRoutes(links)
        assert.equal(computations, 2)
        assert.equal(probe.infrastructureTrafficRoutes.size, 0)
    })
})
