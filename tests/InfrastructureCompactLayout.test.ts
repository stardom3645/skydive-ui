import { strict as assert } from 'assert'
import { infrastructureCompactLayout, infrastructureVMBridgeIDs, CompactLayoutNode } from '../src/InfrastructureCompactLayout'
import { RoutingEdge, routeCardHits, nearestCompactEdge } from '../src/InfrastructureCompactRouting'

export function compactFixture(count: number, mixed = false) {
    const nodes: CompactLayoutNode[] = [
        { id: 'host', type: 'host', weight: 5020, x: 0, y: 0, width: 580, height: 404 },
        ...Array.from({ length: mixed ? 3 : 1 }, (_, i) => ({ id: `bridge-${i}`, parentID: 'host', type: 'ovsbridge', weight: 7040,
            x: mixed ? (i - 1) * 560 : 0, y: 700, width: 340, height: 148 }))
    ]
    const edges: RoutingEdge[] = []
    for (let i = 0; i < count; i++) {
        const bridge = `bridge-${mixed ? i % 3 : 0}`, id = `vm-${String(i).padStart(2, '0')}`
        nodes.push({ id, type: 'libvirt', weight: 7080, hostID: 'host', parentID: 'host', bridgeIDs: [bridge],
            x: (i - (count - 1) / 2) * 504, y: 1600, width: 480, height: 534, above: 41 })
        edges.push({ id: `edge-${i}`, sourceID: bridge, targetID: id })
    }
    return { nodes, edges, viewport: { width: 1280, height: 900 } }
}

describe('Infrastructure VM compact placement and routing', () => {
    it('selects the closest VM branch on coincident hit paths independently of SVG order', () => {
        const near = { id: 'near-vm', route: { path: '', points: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }] } }
        const far = { id: 'far-vm', route: { path: '', points: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 1000, y: 100 }] } }
        assert.equal(nearestCompactEdge([near, far], { x: 95, y: 100 }), near.id)
        assert.equal(nearestCompactEdge([far, near], { x: 95, y: 100 }), near.id)
        assert.equal(nearestCompactEdge([near, far], { x: 800, y: 100 }), far.id)
    })
    for (const count of [10, 30, 50, 60]) for (const mixed of [false, true]) {
        it(`reduces the width and improves Fit without card occlusion for ${count} VMs / ${mixed ? 'mixed bridges' : 'one bridge'}`, () => {
            const { nodes, edges, viewport } = compactFixture(count, mixed), snapshot = JSON.stringify({ nodes, edges })
            const start = Date.now(), plan = infrastructureCompactLayout(nodes, edges, viewport)
            assert.equal(plan.twoRowVMs, count, `fallback: ${plan.reason}`)
            assert.equal(plan.positions.size, nodes.length)
            assert.ok(plan.after.width < plan.before.width * 0.65)
            assert.ok(plan.after.fitScale > plan.before.fitScale)
            assert.equal(plan.after.overlaps, 0)
            assert.equal(plan.after.cardHits, 0)
            assert.ok(plan.after.crossings <= plan.before.crossings + Math.max(2, Math.floor(edges.length * .03)))
            assert.equal(new Set(nodes.filter(node => node.type === 'libvirt').map(node => plan.positions.get(node.id)!.y)).size, 2)
            const cards = nodes.map(node => ({ ...node, ...plan.positions.get(node.id)! }))
            edges.forEach(edge => {
                assert.ok(plan.routes.get(edge.id)?.path)
                assert.equal(routeCardHits(edge, plan.routes.get(edge.id)!.points, cards), 0)
            })
            for (const node of nodes.filter(node => node.type !== 'libvirt')) assert.deepEqual(plan.positions.get(node.id), { x: node.x, y: node.y })
            assert.equal(JSON.stringify({ nodes, edges }), snapshot)
            assert.ok(Date.now() - start < 4000, 'layout blocks the UI for too long')
        })
    }
    it('keeps a short row or a height-limited screen in the original positions', () => {
        for (const [count, height] of [[3, 900], [10, 240]]) {
            const { nodes, edges, viewport } = compactFixture(count)
            const plan = infrastructureCompactLayout(nodes, edges, { ...viewport, height })
            assert.equal(plan.twoRowVMs, 0)
            nodes.forEach(node => assert.deepEqual(plan.positions.get(node.id), { x: node.x, y: node.y }))
        }
    })
    it('falls back for dense multi-homing and preserves every edge', () => {
        const { nodes, edges, viewport } = compactFixture(30, true)
        nodes.filter(node => node.type === 'libvirt').forEach(node => { node.bridgeIDs = ['bridge-0', 'bridge-1', 'bridge-2'] })
        const plan = infrastructureCompactLayout(nodes, edges, viewport)
        assert.equal(plan.twoRowVMs, 0)
        assert.equal(plan.reason, 'connections')
        assert.equal(plan.positions.size, nodes.length)
        assert.equal(plan.routes.size, 0)
    })
    it('considers sparse multi-homing and NIC expansion without moving other layers', () => {
        const { nodes, edges, viewport } = compactFixture(30, true)
        for (const node of nodes.filter(node => node.type === 'libvirt').slice(0, 3)) {
            node.bridgeIDs!.push('bridge-2')
            edges.push({ id: `${node.id}-second`, sourceID: 'bridge-2', targetID: node.id })
        }
        const vm = nodes.find(node => node.id === 'vm-12')!
        nodes.push({ id: 'nic', parentID: vm.id, type: 'tun', weight: 7090, x: vm.x, y: vm.y + 650, width: 340, height: 148 })
        edges.push({ id: 'vm-nic', sourceID: vm.id, targetID: 'nic' })
        const plan = infrastructureCompactLayout(nodes, edges, viewport)
        assert.equal(plan.after.overlaps, 0)
        assert.equal(plan.after.cardHits, 0)
        assert.deepEqual(plan.positions.get('host'), { x: 0, y: 0 })
        if (plan.twoRowVMs) {
            assert.equal(plan.positions.get('nic')!.x - plan.positions.get(vm.id)!.x, 0)
            const vmBottom = Math.max(...nodes.filter(node => node.type === 'libvirt').map(node => plan.positions.get(node.id)!.y + node.height / 2))
            assert.ok(plan.positions.get('nic')!.y - 74 >= vmBottom + 48)
        }
    })
    it('is deterministic and ignores metric and selection changes', () => {
        const { nodes, edges, viewport } = compactFixture(30, true)
        const first = infrastructureCompactLayout(nodes, edges, viewport)
        const second = infrastructureCompactLayout(nodes.map(node => ({ ...node, cpu: Math.random(), selected: true })), edges.slice().reverse(), viewport)
        assert.deepEqual(second.positions, first.positions)
        assert.deepEqual(second.routes, first.routes)
    })
    it('does not wrap Kubernetes VMs, router/system VMs or collapsed group cards', () => {
        for (const extra of [{ manager: 'k8s' }, { weight: 7060 }, { weight: 7070 }, { group: true }]) {
            const { nodes, edges, viewport } = compactFixture(30)
            nodes.filter(node => node.type === 'libvirt').forEach(node => Object.assign(node, extra))
            const plan = infrastructureCompactLayout(nodes, edges, viewport)
            assert.equal(plan.twoRowVMs, 0)
            assert.equal(plan.routes.size, 0)
        }
    })
})

describe('VM bridge connectivity', () => {
    it('follows exact NIC edges, stops at bridges and never joins VMs through host ownership', () => {
        const nodes = [{ id: 'host', type: 'host' }, { id: 'vm-a', type: 'libvirt', parentID: 'host' },
            { id: 'vm-b', type: 'libvirt', parentID: 'host' }, { id: 'nic-a', type: 'tun', parentID: 'vm-a' },
            { id: 'nic-b', type: 'tun', parentID: 'vm-b' }, { id: 'bridge-a', type: 'ovsbridge' }, { id: 'bridge-b', type: 'ovsbridge' }]
        const edges = [{ id: 'a', sourceID: 'nic-a', targetID: 'bridge-a' }, { id: 'b', sourceID: 'nic-b', targetID: 'bridge-b' },
            { id: 'uplink', sourceID: 'bridge-a', targetID: 'bridge-b' }]
        assert.deepEqual(infrastructureVMBridgeIDs(nodes, edges), new Map([['vm-a', ['bridge-a']], ['vm-b', ['bridge-b']]]))
    })
})
