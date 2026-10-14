import { strict as assert } from 'assert'
import { infrastructureVirtualNICOwners, infrastructureNICGroupOwner, infrastructureVMBundles } from '../src/InfrastructureVMBundles'
import { routeCompactEdges, routeCardHits, segmentHitsCard } from '../src/InfrastructureCompactRouting'

describe('Infrastructure Compact VM ownership surfaces', () => {
    it('uses canonical virtual NIC ownership, rejecting physical interfaces, other VMs and Kubernetes', () => {
        const nodes = [{ id: 'host', type: 'host' }, { id: 'vm-a', type: 'libvirt', parentID: 'host' },
            { id: 'vm-b', type: 'libvirt', parentID: 'host' }, { id: 'tap-a', type: 'tuntap', parentID: 'vm-a' },
            { id: 'tap-b', type: 'device', driver: 'tun', parentID: 'vm-b' },
            { id: 'physical', type: 'device', parentID: 'vm-a' }, { id: 'host-nic', type: 'tun', parentID: 'host' },
            { id: 'pod-nic', type: 'veth', parentID: 'vm-a', manager: 'k8s' },
            { id: 'cycle', type: 'tun', parentID: 'cycle' }]
        const snapshot = JSON.stringify(nodes), owners = infrastructureVirtualNICOwners(nodes)
        assert.deepEqual(owners, new Map([['tap-a', 'vm-a'], ['tap-b', 'vm-b']]))
        assert.equal(infrastructureNICGroupOwner(['tap-a'], owners), 'vm-a')
        assert.equal(infrastructureNICGroupOwner(['tap-a', 'tap-b'], owners), undefined)
        assert.equal(infrastructureNICGroupOwner(['tap-a', 'physical'], owners), undefined)
        assert.equal(infrastructureNICGroupOwner([], owners), undefined)
        assert.equal(JSON.stringify(nodes), snapshot)
    })

    it('encloses all verified NICs and badges while excluding hidden points from geometry', () => {
        const cards = [
            { id: 'vm', x: 0, y: 0, width: 480, height: 534, above: 41 },
            { id: 'nic-a', vmOwnerID: 'vm', x: -180, y: 450, width: 340, height: 148, above: 41 },
            { id: 'nic-b', vmOwnerID: 'vm', x: 180, y: 450, width: 340, height: 148 },
            { id: 'hidden', parentID: 'vm', x: 10000, y: 10000, width: 0, height: 0 }]
        const [unit] = infrastructureVMBundles(cards, new Map([['vm', 1]]))
        assert.equal(unit.row, 1)
        assert.deepEqual(unit.nodeIDs, cards.map(card => card.id))
        assert.equal(unit.width, 732)
        assert.equal(unit.y - unit.height / 2, -324)
        assert.equal(unit.y + unit.height / 2, 540)
        assert.deepEqual(infrastructureVMBundles(cards, new Map()), [])
        assert.deepEqual(infrastructureVMBundles([...cards, { id: 'foreign', x: 0, y: 350, width: 100, height: 50 }],
            new Map([['vm', 1]])), [])
    })

    it('routes foreign edges around the entire VM/NIC surface and keeps owned edges independent', () => {
        const cards = [{ id: 'source', x: -600, y: 300, width: 100, height: 100 },
            { id: 'target', x: 600, y: 300, width: 100, height: 100 },
            { id: 'vm', x: 0, y: 0, width: 200, height: 200 },
            { id: 'nic', vmOwnerID: 'vm', x: 0, y: 600, width: 160, height: 100 }]
        const bundles = infrastructureVMBundles(cards, new Map([['vm', 0]]))
        const edges = [{ id: 'foreign', sourceID: 'source', targetID: 'target' },
            { id: 'owner', sourceID: 'vm', targetID: 'nic', hierarchy: true },
            { id: 'network', sourceID: 'source', targetID: 'nic' }]
        const routes = routeCompactEdges(cards, edges, [], bundles)!
        assert.equal(routes.size, edges.length)
        for (const edge of edges) assert.equal(routeCardHits(edge, routes.get(edge.id)!.points, cards), 0)
        const points = routes.get('foreign')!.points
        assert.ok(!points.slice(1).some((point, i) => segmentHitsCard(points[i], point, bundles[0])))
        assert.ok(routes.get('owner')!.points.some(point => point.x === 0 && point.y > 100 && point.y < 600))
        assert.notEqual(routes.get('network')!.path, routes.get('owner')!.path)
    })
})
