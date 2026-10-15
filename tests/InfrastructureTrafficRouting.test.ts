import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { routeInfrastructureTraffic } from '../src/InfrastructureTrafficRouting'
import { RoutingCard, RoutingEdge, routeCardHits, segmentHitsCard, routeCompactEdges, nearestCompactEdge } from '../src/InfrastructureCompactRouting'
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
    it('uses short curves for a clear sparse leading row while preserving the dense lower bus', () => {
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
        const trunks = new Set(lower.map(target => routes.get(`bridge-${target.id}`)!.points[2].x))
        assert.equal(trunks.size, 1, 'dense lower rows still use one shared corridor')
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
        // A real blocker restores the original bus for the entire leading row.
        const blocked = [...cards, card('blocker', 0, 550, 580, 440)]
        const fallback = routeInfrastructureTraffic(blocked, edges)
        leading.forEach(target => assert.equal(fallback.get(`bridge-${target.id}`)!.points.length, 6))
        const region = { ...card('foreign-bundle', 0, 550, 580, 440), nodeIDs: ['foreign-vm', 'foreign-nic'] }
        const withRegion = routeInfrastructureTraffic(cards, edges, new Map(), [region])
        leading.forEach(target => {
            const route = withRegion.get(`bridge-${target.id}`)!
            assert.equal(route.points.length, 6)
            assert.equal(route.points.slice(1).some((p, i) => segmentHitsCard(route.points[i], p, region)), false)
        })
        const preferred = new Map(edges.slice(0, 3).map(edge => [edge.id, routes.get(edge.id)!]))
        const compact = routeInfrastructureTraffic(cards, edges, preferred)
        leading.forEach(target => assert.equal(compact.get(`bridge-${target.id}`)!.points.length, 6, 'Compact geometry is not replaced by this optimization'))
        lower.forEach(target => assert.equal(routes.get(`bridge-${target.id}`)!.path, compact.get(`bridge-${target.id}`)!.path,
            'lower bus geometry remains identical to the previous routing rule'))
    })
    it('organizes dense bridge fan-out into one side corridor and one lane per VM row', () => {
        const cards = [{ ...card('bridge', -500, 0), type: 'bridge' },
            card('middle-host', 350, 450, 580, 404),
            ...Array.from({ length: 16 }, (_, i) => ({ ...card(`vm-${i}`, (i % 8) * 544, 1100 + Math.floor(i / 8) * 800, 480, 558), type: 'libvirt', above: 41 }))]
        const edges = cards.filter(c => c.type === 'libvirt').map(c => ({ id: `bridge-${c.id}`, sourceID: 'bridge', targetID: c.id }))
        const before = JSON.stringify(cards), routes = routeInfrastructureTraffic(cards, edges)
        assert.equal(routes.size, edges.length)
        const trunks = new Set<number>(), lanes = new Set<number>()
        edges.forEach(edge => {
            const route = routes.get(edge.id)!
            assert.equal(routeCardHits(edge, route.points, cards), 0)
            assert.equal(route.points[0].x, -500)
            assert.equal(route.points[0].y, 56)
            assert.ok(route.points[1].y > 56)
            trunks.add(route.points[2].x)
            lanes.add(route.points[3].y)
            assert.equal(route.points.length, 6, 'each edge takes a predictable departure, trunk, row branch and arrival')
            const endpoint = route.points[route.points.length - 1]
            assert.equal(nearestCompactEdge(Array.from(routes, ([id, route]) => ({ id, route })), { x: endpoint.x, y: endpoint.y - 8 }), edge.id)
        })
        assert.equal(trunks.size, 1)
        assert.equal(lanes.size, 2)
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
            assert.equal(route.points.length, 6)
            regions.filter(r => !r.nodeIDs.includes(e.targetID)).forEach(region =>
                assert.equal(route.points.slice(1).some((p, i) => segmentHitsCard(route.points[i], p, region)), false))
        })
        const withExpandedNIC = edges.map((e, i) => i ? e : { ...e, targetID: nics[0].id })
        const expanded = routeInfrastructureTraffic(cards, withExpandedNIC, new Map(), regions)
        withExpandedNIC.forEach(e => {
            const route = expanded.get(e.id)!
            assert.equal(routeCardHits(e, route.points, cards), 0)
            assert.equal(route.points.length, 6)
        })
        const middleNIC = edges.map((e, i) => i === 2 ? { ...e, targetID: nics[2].id } : e)
        const middle = routeInfrastructureTraffic(cards, middleNIC, new Map(), regions)
        middleNIC.forEach(e => {
            const route = middle.get(e.id)!
            assert.equal(routeCardHits(e, route.points, cards), 0)
            assert.ok(route.points.length <= 10, 'only the final NIC branch may need a local detour')
            assert.equal(route.points[2].x, middle.get(middleNIC[0].id)!.points[2].x)
            regions.filter(r => !r.nodeIDs.includes(e.targetID)).forEach(region =>
                assert.equal(route.points.slice(1).some((p, i) => segmentHitsCard(route.points[i], p, region)), false))
        })
    })

    it('keeps different bridge buses distinct without rerouting group-card fan-out', () => {
        const bridges = [{ ...card('bridge-a', -600, 0), type: 'bridge' }, { ...card('bridge-b', -250, 0), type: 'bridge' }]
        const vms = Array.from({ length: 4 }, (_, i) => ({ ...card(`vm-${i}`, i * 544, 1100, 480, 558), type: 'libvirt' }))
        const cards = [...bridges, ...vms]
        const edges: RoutingEdge[] = []
        bridges.forEach(bridge => vms.forEach(target => edges.push({ id: `${bridge.id}-${target.id}`, sourceID: bridge.id, targetID: target.id })))
        const routes = routeInfrastructureTraffic(cards, edges)
        const trunk = (bridgeID: string) => new Set(edges.filter(e => e.sourceID === bridgeID).map(e => routes.get(e.id)!.points[2].x))
        assert.equal(trunk('bridge-a').size, 1)
        assert.equal(trunk('bridge-b').size, 1)
        assert.notEqual(Array.from(trunk('bridge-a'))[0], Array.from(trunk('bridge-b'))[0])
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
        assert.ok(route.path.includes(' Q'), 'detour corners are rounded')
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
