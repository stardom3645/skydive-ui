import { strict as assert } from 'assert'
import { infrastructureVMSemanticMode as mode, infrastructureVMSemanticDimensions as dimensions, infrastructureVMSemanticFitMaxScale as fitMaxScale } from '../src/InfrastructureVMSemanticZoom'
import { infrastructureDenseVMLayout, compactCardOverlaps, CompactLayoutNode } from '../src/InfrastructureCompactLayout'
import { routeInfrastructureTraffic } from '../src/InfrastructureTrafficRouting'
import { routeCardHits } from '../src/InfrastructureCompactRouting'
import { topologyCardEdge } from '../src/TopologyEdgePresentation'

describe('Archived opt-in Infrastructure VM semantic zoom', () => {
    it('starts at the requested projected screen widths and allows large jumps', () => {
        assert.equal(mode(136.9), 'detail'); assert.equal(mode(136.7), 'summary')
        assert.equal(mode(100), 'summary'); assert.equal(mode(99), 'dense')
        assert.equal(mode(70, 'detail'), 'dense'); assert.equal(mode(240, 'dense'), 'detail')
        assert.equal(mode(NaN, 'summary'), 'summary')
    })
    it('never keeps summary while the rounded zoom readout says 29% or higher', () => {
        for (const zoom of [.2851, .29, .3, .335, .34, .345, .3479, .35, .36])
            assert.equal(mode(480 * zoom, 'summary'), 'detail', `readout ${Math.round(zoom * 100)}% at actual ${zoom * 100}%`)
        assert.ok(Math.round(fitMaxScale('summary') * 100) < 29, 'summary Fit cap must also display a value below 29%')
    })
    it('shows the full card at displayed 29% in either zoom direction and keeps Fit inside the summary band', () => {
        assert.equal(mode(480 * .2849, 'summary'), 'summary')
        assert.equal(mode(480 * .29, 'summary'), 'detail')
        assert.equal(mode(480 * .29, 'dense'), 'detail')
        assert.equal(mode(480 * .28, 'detail'), 'detail')
        assert.equal(mode(480 * .273, 'detail'), 'summary')
        for (const current of ['summary', 'dense'] as const)
            assert.equal(mode(480 * fitMaxScale(current), current), current, 'Fit must not trigger a richer mode immediately')
    })
    it('does not flicker near either threshold and can leave the smaller tile', () => {
        let current = mode(200)
        for (const width of [140, 138, 137, 139, 132]) { current = mode(width, current); assert.equal(current, 'detail') }
        current = mode(131, current); assert.equal(current, 'summary')
        for (const width of [132, 136, 95, 101, 93]) { current = mode(width, current); assert.equal(current, 'summary') }
        current = mode(91, current); assert.equal(current, 'dense')
        for (const width of [99, 102, 107]) { current = mode(width, current); assert.equal(current, 'dense') }
        assert.equal(mode(108, current), 'summary'); assert.equal(mode(168, 'summary'), 'detail')
        assert.equal(dimensions('detail'), undefined)
        assert.ok(dimensions('summary')!.height > dimensions('dense')!.height)
        assert.equal(dimensions('dense')!.width, dimensions('dense')!.height, 'one square per VM')
        assert.ok(dimensions('dense', true)!.width < 480, 'existing group summary is quieter at tile scale')
        assert.equal(dimensions('summary', true), undefined)
    })
    for (const count of [30, 60, 100]) it(`packs ${count} real VMs and expanded NICs without overlap, identity loss or invented edges`, () => {
        const nodes: CompactLayoutNode[] = [{ id: 'host', type: 'host', weight: 5020, x: 0, y: 0, width: 580, height: 420 }]
        for (let i = 0; i < count; i++) {
            const id = `vm-${i}`
            nodes.push({ id, parentID: 'host', hostID: 'host', type: 'libvirt', weight: 7080,
                x: i * 600, y: 1000, ...dimensions('dense')!, above: 0 })
            if (i === 4) for (let n = 0; n < 3; n++) nodes.push({ id: `${id}-nic-${n}`, parentID: id, hostID: 'host', vmOwnerID: id,
                type: 'tuntap', weight: 7080, x: i * 600 + n * 500, y: 1600, width: 480, height: 200, above: 40 })
        }
        const original = JSON.stringify(nodes), result = infrastructureDenseVMLayout(nodes)
        assert.equal(JSON.stringify(nodes), original, 'does not mutate graph or status')
        assert.equal(result.size, nodes.length)
        const placed = nodes.map(node => ({ ...node, ...result.get(node.id)! }))
        assert.equal(placed.filter(node => node.type === 'libvirt').length, count)
        assert.equal(compactCardOverlaps(placed), 0)
        const vms = placed.filter(node => node.type === 'libvirt')
        assert.ok(new Set(vms.map(node => node.y)).size > 1)
        assert.ok(Math.max(...vms.map(node => node.x)) - Math.min(...vms.map(node => node.x)) < count * 600 / 2)
        assert.deepEqual(result.get('host'), { x: 0, y: 0 })
        const owner = placed.find(node => node.id === 'vm-4')!
        placed.filter(node => node.vmOwnerID).forEach(nic => assert.ok(nic.y - nic.height / 2 > owner.y + owner.height / 2))
        vms.forEach(node => {
            const edge = topologyCardEdge(placed[0], node)
            assert.ok(edge && !edge.includes('NaN'))
        })
        assert.deepEqual(infrastructureDenseVMLayout(nodes), result, 'deterministic unchanged refresh')
    })
    it('retains every measured bridge edge with obstacle-free tile routes and exact card endpoints', () => {
        const cards = [{ id: 'bridge', type: 'ovsbridge', weight: 7040, x: 0, y: 0, width: 340, height: 136 },
            ...Array.from({ length: 100 }, (_, i) => ({ id: `vm-${i}`, type: 'libvirt', weight: 7080,
                x: (i % 10) * 184 - 828, y: 600 + Math.floor(i / 10) * 204, ...dimensions('dense')! }))]
        const edges = cards.slice(1).map(card => ({ id: `bridge-${card.id}`, sourceID: 'bridge', targetID: card.id }))
        const routes = routeInfrastructureTraffic(cards, edges, new Map(), [], { smooth: false })
        assert.equal(routes.size, edges.length)
        edges.forEach(edge => {
            const route = routes.get(edge.id)!, source = cards[0], target = cards.find(card => card.id === edge.targetID)!
            assert.equal(routeCardHits(edge, route.points, cards), 0)
            const onBorder = (point: { x: number; y: number }, card: typeof source) => {
                const dx = Math.abs(point.x - card.x), dy = Math.abs(point.y - card.y)
                return Math.abs(dx - card.width / 2) < .01 && dy <= card.height / 2
                    || Math.abs(dy - card.height / 2) < .01 && dx <= card.width / 2
            }
            assert.ok(onBorder(route.points[0], source))
            assert.ok(onBorder(route.points[route.points.length - 1], target))
        })
    })
    it('leaves Kubernetes VMs and service VMs outside dense packing', () => {
        const nodes: CompactLayoutNode[] = [7060, 7070, 7080].map((weight, i) => ({ id: String(weight), type: 'libvirt',
            weight, manager: i === 2 ? 'k8s' : '', x: i * 600, y: 0, width: 480, height: 400 }))
        const result = infrastructureDenseVMLayout(nodes)
        nodes.forEach(node => assert.deepEqual(result.get(node.id), { x: node.x, y: node.y }))
    })
})
