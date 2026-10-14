import { strict as assert } from 'assert'
import { infrastructureCompactLayout, infrastructureVMBridgeIDs, CompactLayoutNode } from '../src/InfrastructureCompactLayout'
import { RoutingEdge, routeCardHits, nearestCompactEdge, segmentHitsCard } from '../src/InfrastructureCompactRouting'

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
    it('closes the obsolete gap between two expanded hosts and keeps their rows stable on NIC drilldown', () => {
        for (const count of [10, 30, 50]) {
            const first = compactFixture(count), second = compactFixture(count)
            first.nodes.forEach(node => { if (node.id !== 'host') node.hostID = 'host' })
            const nodes = first.nodes.concat(second.nodes.map(node => ({ ...node, id: `b-${node.id}`, x: node.x + 20000,
                parentID: node.parentID ? `b-${node.parentID}` : undefined, hostID: node.id === 'host' ? undefined : 'b-host',
                bridgeIDs: node.bridgeIDs?.map(id => `b-${id}`) })))
            const edges = first.edges.concat(second.edges.map(edge => ({ ...edge, id: `b-${edge.id}`,
                sourceID: `b-${edge.sourceID}`, targetID: `b-${edge.targetID}` })))
            const snapshot = JSON.stringify(nodes), plan = infrastructureCompactLayout(nodes, edges, first.viewport)
            assert.equal(plan.wrappedVMs, count * 2, plan.reason)
            assert.ok(plan.after.width < plan.before.width * 0.7)
            assert.equal(plan.after.overlaps, 0); assert.equal(plan.after.cardHits, 0)
            const rightA = Math.max(...nodes.filter(node => node.type === 'libvirt' && node.hostID === 'host')
                .map(node => plan.positions.get(node.id)!.x + node.width / 2))
            const leftB = Math.min(...nodes.filter(node => node.type === 'libvirt' && node.hostID === 'b-host')
                .map(node => plan.positions.get(node.id)!.x - node.width / 2))
            assert.ok(leftB - rightA >= 112 && leftB - rightA <= 200, `remaining gap ${leftB - rightA}`)
            for (const node of nodes.filter(node => node.weight < 7080)) {
                const hostID = node.type === 'host' ? node.id : node.hostID!
                const host = nodes.find(node => node.id === hostID)!
                assert.deepEqual(plan.positions.get(node.id), { x: node.x + plan.positions.get(hostID)!.x - host.x, y: node.y })
            }
            const owner = nodes.find(node => node.id === 'vm-00')!
            const opened = nodes.concat({ id: 'nic', parentID: owner.id, hostID: 'host', vmOwnerID: owner.id, type: 'tun', weight: 7080,
                x: owner.x, y: 2300, width: 520, height: 282, above: 41 })
            const next = infrastructureCompactLayout(opened, edges.concat({ id: 'nic-edge', sourceID: owner.id, targetID: 'nic' }), first.viewport, plan)
            assert.equal(next.wrappedVMs, count * 2, next.reason)
            assert.deepEqual(next.vmRows, plan.vmRows)
            assert.equal(next.after.overlaps, 0); assert.equal(next.after.cardHits, 0)
            assert.equal(JSON.stringify(nodes), snapshot)
        }
    }).timeout(15000)
    it('keeps every host user row below an expanded router NIC when reusing row anchors', () => {
        const a = compactFixture(10), b = compactFixture(10)
        a.nodes.forEach(node => { if (node.id !== 'host') node.hostID = 'host' })
        a.nodes.push({ id: 'router', type: 'libvirt', weight: 7070, parentID: 'host', hostID: 'host',
            x: 0, y: 1050, width: 480, height: 200 })
        const nodes = a.nodes.concat(b.nodes.map(node => ({ ...node, id: `b-${node.id}`, x: node.x + 10000,
            parentID: node.parentID ? `b-${node.parentID}` : undefined, hostID: node.id === 'host' ? undefined : 'b-host',
            bridgeIDs: node.bridgeIDs?.map(id => `b-${id}`) })))
        const edges = a.edges.concat(b.edges.map(edge => ({ ...edge, id: `b-${edge.id}`,
            sourceID: `b-${edge.sourceID}`, targetID: `b-${edge.targetID}` })))
        const previous = infrastructureCompactLayout(nodes, edges, a.viewport)
        assert.equal(previous.wrappedVMs, 20)
        const opened = nodes.concat({ id: 'router-nic', type: 'tun', weight: 7070, parentID: 'router', hostID: 'host',
            x: 0, y: 1500, width: 480, height: 300, above: 41 })
        const next = infrastructureCompactLayout(opened, edges, a.viewport, previous)
        assert.equal(next.wrappedVMs, 20, next.reason)
        assert.deepEqual(next.vmRows, previous.vmRows)
        for (const node of nodes.filter(node => previous.vmRows.get(node.id) === 0)) {
            const top = next.positions.get(node.id)!.y - node.height / 2 - (node.above || 0)
            assert.ok(top >= 1650 + 160, `${node.id} starts inside the router/NIC level`)
        }
        assert.equal(next.after.overlaps, 0)
        assert.equal(next.after.cardHits, 0)
    })
    it('retains Compact with all 50 VMs expanded to 100 network cards', () => {
        const { nodes, edges, viewport } = compactFixture(50)
        const previous = infrastructureCompactLayout(nodes, edges, viewport)
        assert.equal(previous.wrappedVMs, 50)
        for (const owner of nodes.filter(node => node.type === 'libvirt')) for (let i = 0; i < 2; i++) {
            const id = `${owner.id}-nic-${i}`
            nodes.push({ id, parentID: owner.id, vmOwnerID: owner.id, type: 'tun', weight: 7080, x: owner.x + i * 364,
                y: 2300, width: 340, height: 282, above: 40.5 })
            edges.push({ id: `owner-${id}`, sourceID: owner.id, targetID: id, hierarchy: true })
            edges.push({ id: `bridge-${id}`, sourceID: 'bridge-0', targetID: id })
        }
        const plan = infrastructureCompactLayout(nodes, edges, viewport, previous)
        assert.equal(plan.wrappedVMs, 50, plan.reason)
        const reopened = infrastructureCompactLayout(nodes, edges, viewport)
        assert.equal(reopened.wrappedVMs, 50, `expanded initial scene: ${reopened.reason}`)
        assert.equal(reopened.after.overlaps, 0)
        assert.equal(reopened.after.cardHits, 0)
        assert.deepEqual(plan.vmRows, previous.vmRows)
        assert.equal(plan.positions.size, nodes.length)
        assert.equal(plan.routes.size, edges.length)
        assert.equal(plan.bundles.length, 50)
        for (const bundle of plan.bundles) {
            assert.equal(bundle.nodeIDs.length, 3)
            for (const edge of edges.filter(edge => !bundle.nodeIDs.includes(edge.sourceID) && !bundle.nodeIDs.includes(edge.targetID))) {
                const points = plan.routes.get(edge.id)!.points
                assert.ok(!points.slice(1).some((point, i) => segmentHitsCard(points[i], point, bundle)),
                    `foreign edge ${edge.id} enters ${bundle.vmID}`)
            }
        }
        assert.equal(plan.after.overlaps, 0)
        assert.equal(plan.after.cardHits, 0)
    }).timeout(10000)
    it('keeps NIC drilldowns under their VM and retains every row through repeated expand/collapse', () => {
        const { nodes, edges, viewport } = compactFixture(30)
        nodes.push({ id: 'vm-summary', type: 'libvirt', weight: 7080, group: true, parentID: 'host', hostID: 'host',
            x: -8500, y: 1600, width: 580, height: 180 })
        edges.push({ id: 'summary-owner', sourceID: 'host', targetID: 'vm-summary', hierarchy: true })
        let previous = infrastructureCompactLayout(nodes, edges, viewport)
        assert.equal(previous.wrappedVMs, 30)
        const first = nodes.find(node => previous.vmRows.get(node.id) === 0)!
        const second = nodes.find(node => previous.vmRows.get(node.id) === 1)!
        const rows = new Map(previous.vmRows)
        const anchor = previous.hostAnchors.get('host')
        for (const count of [1, 3, 0, 2, 0]) {
            const openedNodes = nodes.map(node => ({ ...node })), openedEdges = edges.map(edge => ({ ...edge }))
            const children: CompactLayoutNode[] = []
            for (const owner of [first, second]) for (let i = 0; i < (owner === first ? count : Math.max(0, count - 1)); i++) {
                const nic: CompactLayoutNode = { id: `${owner.id}-nic-${i}`, parentID: owner.id, vmOwnerID: owner.id, type: 'tun', weight: 7080,
                    x: owner.x + i * 364, y: owner.y + 650, width: 340, height: 282, above: 40.5 }
                children.push(nic); openedNodes.push(nic)
                openedEdges.push({ id: `nic-${nic.id}`, sourceID: owner.id, targetID: nic.id, hierarchy: true })
                openedEdges.push({ id: `bridge-${nic.id}`, sourceID: 'bridge-0', targetID: nic.id })
            }
            const plan = infrastructureCompactLayout(openedNodes, openedEdges, viewport, previous)
            assert.equal(plan.wrappedVMs, 30, `drilldown ${count}: ${plan.reason}`)
            assert.deepEqual(plan.vmRows, rows)
            assert.deepEqual(plan.hostAnchors.get('host'), anchor)
            assert.equal(plan.after.overlaps, 0)
            assert.equal(plan.after.cardHits, 0)
            for (const nic of children) {
                const owner = openedNodes.find(node => node.id === nic.parentID)!
                assert.equal(plan.positions.get(nic.id)!.y - nic.height / 2,
                    plan.positions.get(owner.id)!.y + owner.height / 2 + 48 + (nic.above || 0))
            }
            if (count) {
                const firstNIC = children.find(node => node.parentID === first.id)!
                assert.ok(plan.positions.get(firstNIC.id)!.y + firstNIC.height / 2
                    < plan.positions.get(second.id)!.y - second.height / 2 - (second.above || 0))
            }
            const firstRowLeft = Math.min(...openedNodes.filter(node => plan.vmRows.get(node.id) === 0)
                .map(node => plan.positions.get(node.id)!.x - node.width / 2),
                ...children.filter(node => node.parentID === first.id).map(node => plan.positions.get(node.id)!.x - node.width / 2))
            assert.equal(plan.positions.get('vm-summary')!.x + 290, firstRowLeft - 64)
            for (const node of nodes.filter(node => node.weight < 7080))
                assert.deepEqual(plan.positions.get(node.id), { x: node.x, y: node.y })
            previous = plan
        }
    })
    it('packs Compact and collapsed hosts using their final widths instead of the old one-row slots', () => {
        const { nodes, edges, viewport } = compactFixture(30, true)
        nodes.push(
            { id: 'other-left', type: 'host', weight: 5020, x: -12000, y: 0, width: 580, height: 404 },
            { id: 'other-right', type: 'host', weight: 5020, x: 12000, y: 0, width: 580, height: 404 })
        const plan = infrastructureCompactLayout(nodes, edges, viewport)
        assert.equal(plan.wrappedVMs, 30, plan.reason)
        assert.ok(plan.after.width < plan.before.width * 0.5)
        assert.ok(plan.after.width < 7000)
        assert.equal(plan.after.overlaps, 0)
        assert.equal(plan.after.cardHits, 0)
        const dx = plan.positions.get('host')!.x
        for (const node of nodes.filter(node => node.type !== 'libvirt' && !node.id.startsWith('other-')))
            assert.deepEqual(plan.positions.get(node.id), { x: node.x + dx, y: node.y })
    })
    it('selects the closest VM branch on coincident hit paths independently of SVG order', () => {
        const near = { id: 'near-vm', route: { path: '', points: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }] } }
        const far = { id: 'far-vm', route: { path: '', points: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 1000, y: 100 }] } }
        assert.equal(nearestCompactEdge([near, far], { x: 95, y: 100 }), near.id)
        assert.equal(nearestCompactEdge([far, near], { x: 95, y: 100 }), near.id)
        assert.equal(nearestCompactEdge([near, far], { x: 800, y: 100 }), far.id)
    })
    for (const count of [10, 30, 50, 60]) for (const mixed of [false, true]) {
        it(`continues into readable rows without card occlusion for ${count} VMs / ${mixed ? 'mixed bridges' : 'one bridge'}`, () => {
            const { nodes, edges, viewport } = compactFixture(count, mixed), snapshot = JSON.stringify({ nodes, edges })
            const start = Date.now(), plan = infrastructureCompactLayout(nodes, edges, viewport)
            assert.equal(plan.wrappedVMs, count, `fallback: ${plan.reason}`)
            assert.equal(plan.positions.size, nodes.length)
            assert.ok(plan.after.width < plan.before.width * 0.65)
            assert.ok(plan.after.width <= 2580)
            assert.equal(plan.after.overlaps, 0)
            assert.equal(plan.after.cardHits, 0)
            for (const row of new Set(plan.vmRows.values()))
                assert.ok(Array.from(plan.vmRows.values()).filter(value => value === row).length <= 4)
            assert.equal(new Set(plan.vmRows.values()).size, plan.rowCount)
            assert.ok(plan.rowCount >= 3)
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
    it('uses the viewport and complete NIC width, with at most eight VM units per row', () => {
        const { nodes, edges, viewport } = compactFixture(30)
        const narrow = infrastructureCompactLayout(nodes, edges, { ...viewport, width: 1000 })
        const wide = infrastructureCompactLayout(nodes, edges, { ...viewport, width: 5000 }, narrow)
        assert.equal(narrow.wrappedVMs, 30)
        assert.equal(wide.wrappedVMs, 30)
        assert.equal(narrow.rowCount, 10)
        assert.equal(wide.rowCount, 4)
        for (const row of new Set(wide.vmRows.values()))
            assert.ok(Array.from(wide.vmRows.values()).filter(value => value === row).length <= 8)
        for (const owner of nodes.filter(node => node.type === 'libvirt')) for (let i = 0; i < 3; i++) {
            nodes.push({ id: `${owner.id}-nic-${i}`, type: 'tun', parentID: owner.id, vmOwnerID: owner.id, weight: 7080,
                x: owner.x + i * 500, y: owner.y + 800, width: 480, height: 282 })
        }
        const expanded = infrastructureCompactLayout(nodes, edges, viewport)
        assert.equal(expanded.wrappedVMs, 30)
        assert.equal(expanded.rowCount, 30)
        assert.equal(expanded.after.overlaps, 0)
        assert.equal(expanded.after.cardHits, 0)
    }).timeout(10000)
    it('keeps short rows in their original positions', () => {
        for (const [count, height] of [[3, 900], [3, 240]]) {
            const { nodes, edges, viewport } = compactFixture(count)
            const plan = infrastructureCompactLayout(nodes, edges, { ...viewport, height })
            assert.equal(plan.wrappedVMs, 0)
            nodes.forEach(node => assert.deepEqual(plan.positions.get(node.id), { x: node.x, y: node.y }))
        }
    })
    it('falls back for dense multi-homing and preserves every edge', () => {
        const { nodes, edges, viewport } = compactFixture(30, true)
        nodes.filter(node => node.type === 'libvirt').forEach(node => { node.bridgeIDs = ['bridge-0', 'bridge-1', 'bridge-2'] })
        const plan = infrastructureCompactLayout(nodes, edges, viewport)
        assert.equal(plan.wrappedVMs, 0)
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
        nodes.push({ id: 'nic', parentID: vm.id, vmOwnerID: vm.id, type: 'tun', weight: 7090, x: vm.x, y: vm.y + 650, width: 340, height: 148 })
        edges.push({ id: 'vm-nic', sourceID: vm.id, targetID: 'nic' })
        const plan = infrastructureCompactLayout(nodes, edges, viewport)
        assert.equal(plan.after.overlaps, 0)
        assert.equal(plan.after.cardHits, 0)
        assert.deepEqual(plan.positions.get('host'), { x: 0, y: 0 })
        if (plan.wrappedVMs) {
            assert.equal(plan.positions.get('nic')!.x - plan.positions.get(vm.id)!.x, 0)
            assert.equal(plan.positions.get('nic')!.y - 74, plan.positions.get(vm.id)!.y + vm.height / 2 + 48)
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
            assert.equal(plan.wrappedVMs, 0)
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
