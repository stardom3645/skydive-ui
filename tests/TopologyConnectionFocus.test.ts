import * as assert from 'assert'
import { topologyNetworkRootPathClosure, topologyRelationPathClosure } from '../src/TopologyConnectionFocus'

describe('Topology connection focus graph paths', () => {
    it('keeps VM NIC bridge hops while excluding unrelated network branches', () => {
        const path = topologyRelationPathClosure('vm-nic', ['host', 'direct-peer'], [
            { id: 'vm-vnet', sourceID: 'vm-nic', targetID: 'vnet0' },
            { id: 'vnet-virtual-bridge', sourceID: 'vnet0', targetID: 'brbond0-231' },
            { id: 'virtual-host-bridge', sourceID: 'brbond0-231', targetID: 'bridge0' },
            { id: 'host-bridge-host', sourceID: 'bridge0', targetID: 'host' },
            { id: 'vm-direct-peer', sourceID: 'vm-nic', targetID: 'direct-peer' },
            { id: 'unrelated-bridge', sourceID: 'bridge0', targetID: 'brbond0-999' },
            { id: 'unrelated-vm', sourceID: 'brbond0-999', targetID: 'other-vm' }
        ])

        assert.deepStrictEqual(Array.from(path.nodeIDs).sort(), [
            'brbond0-231',
            'bridge0',
            'direct-peer',
            'host',
            'vm-nic',
            'vnet0'
        ])
        assert.deepStrictEqual(Array.from(path.linkIDs).sort(), [
            'host-bridge-host',
            'virtual-host-bridge',
            'vm-direct-peer',
            'vm-vnet',
            'vnet-virtual-bridge'
        ])
        assert.ok(!path.nodeIDs.has('brbond0-999'))
        assert.ok(!path.nodeIDs.has('other-vm'))
    })

    it('does not add nodes when a focus target has no rendered relation path', () => {
        const path = topologyRelationPathClosure('vm-nic', ['missing-host'], [
            { id: 'vm-vnet', sourceID: 'vm-nic', targetID: 'vnet0' }
        ])

        assert.deepStrictEqual(Array.from(path.nodeIDs), ['vm-nic'])
        assert.deepStrictEqual(Array.from(path.linkIDs), [])
    })

    it('keeps the complete VM to switch upstream network path', () => {
        const path = topologyNetworkRootPathClosure('vm', [
            { id: 'vnic-vm', sourceID: 'vnic', targetID: 'vm', sourceLevel: 8, targetLevel: 9 },
            { id: 'virtual-bridge-vnic', sourceID: 'virtual-bridge', targetID: 'vnic', sourceLevel: 6, targetLevel: 8 },
            { id: 'host-bridge-virtual-bridge', sourceID: 'host-bridge', targetID: 'virtual-bridge', sourceLevel: 5, targetLevel: 6 },
            { id: 'bond-host-bridge', sourceID: 'bond0', targetID: 'host-bridge', sourceLevel: 4, targetLevel: 5 },
            { id: 'physical-nic-bond', sourceID: 'eth0', targetID: 'bond0', sourceLevel: 3, targetLevel: 4 },
            { id: 'host-physical-nic', sourceID: 'host', targetID: 'eth0', sourceLevel: 2, targetLevel: 3 },
            { id: 'switch-port-host', sourceID: 'switch-port', targetID: 'host', sourceLevel: 1, targetLevel: 2 },
            { id: 'hierarchy:switch->switch-port', sourceID: 'switch', targetID: 'switch-port', sourceLevel: 0, targetLevel: 1 },
            { id: 'host-vm-shortcut', sourceID: 'host', targetID: 'vm', sourceLevel: 2, targetLevel: 9 }
        ])

        assert.deepStrictEqual(Array.from(path.nodeIDs).sort(), [
            'bond0', 'eth0', 'host', 'host-bridge', 'switch', 'switch-port', 'virtual-bridge', 'vm', 'vnic'
        ])
        assert.strictEqual(path.linkIDs.size, 8)
        assert.ok(path.linkIDs.has('hierarchy:switch->switch-port'))
    })

    it('naturally supports paths without bond or host bridge stages', () => {
        const path = topologyNetworkRootPathClosure('vm', [
            { id: 'vnic-vm', sourceID: 'vnic', targetID: 'vm', sourceLevel: 8, targetLevel: 9 },
            { id: 'physical-nic-vnic', sourceID: 'eth0', targetID: 'vnic', sourceLevel: 3, targetLevel: 8 },
            { id: 'host-physical-nic', sourceID: 'host', targetID: 'eth0', sourceLevel: 2, targetLevel: 3 },
            { id: 'switch-port-host', sourceID: 'switch-port', targetID: 'host', sourceLevel: 1, targetLevel: 2 },
            { id: 'switch-switch-port', sourceID: 'switch', targetID: 'switch-port', sourceLevel: 0, targetLevel: 1 }
        ])

        assert.deepStrictEqual(Array.from(path.nodeIDs).sort(), ['eth0', 'host', 'switch', 'switch-port', 'vm', 'vnic'])
        assert.strictEqual(path.linkIDs.size, 5)
    })

    it('does not descend from a reached host into unrelated NIC and bridge branches', () => {
        const path = topologyNetworkRootPathClosure('vm', [
            { id: 'bridge-vm', sourceID: 'bridge0', targetID: 'vm', sourceLevel: 5, targetLevel: 9 },
            { id: 'host-bridge', sourceID: 'host', targetID: 'bridge0', sourceLevel: 2, targetLevel: 5 },
            { id: 'switch-port-host', sourceID: 'switch-port', targetID: 'host', sourceLevel: 1, targetLevel: 2 },
            { id: 'switch-switch-port', sourceID: 'switch', targetID: 'switch-port', sourceLevel: 0, targetLevel: 1 },
            { id: 'host-unrelated-nic', sourceID: 'host', targetID: 'eth9', sourceLevel: 2, targetLevel: 3 },
            { id: 'unrelated-nic-bridge', sourceID: 'eth9', targetID: 'other-bridge', sourceLevel: 3, targetLevel: 5 },
            { id: 'unrelated-bridge-vm', sourceID: 'other-bridge', targetID: 'other-vm', sourceLevel: 5, targetLevel: 9 }
        ])

        assert.deepStrictEqual(Array.from(path.nodeIDs).sort(), ['bridge0', 'host', 'switch', 'switch-port', 'vm'])
        assert.ok(!path.nodeIDs.has('eth9'))
        assert.ok(!path.nodeIDs.has('other-bridge'))
        assert.ok(!path.nodeIDs.has('other-vm'))
    })
})
