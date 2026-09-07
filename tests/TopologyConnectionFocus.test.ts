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
        assert.strictEqual(path.linkIDs.size, 9)
        assert.ok(path.linkIDs.has('hierarchy:switch->switch-port'))
        assert.ok(path.linkIDs.has('host-vm-shortcut'))
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
            { id: 'unrelated-bridge-vm', sourceID: 'other-bridge', targetID: 'other-vm', sourceLevel: 5, targetLevel: 9 },
            { id: 'other-host-unrelated-nic', sourceID: 'other-host', targetID: 'eth9', sourceLevel: 2, targetLevel: 3 },
            { id: 'other-switch-port-host', sourceID: 'other-switch-port', targetID: 'other-host', sourceLevel: 1, targetLevel: 2 },
            { id: 'other-switch-port-switch', sourceID: 'other-switch', targetID: 'other-switch-port', sourceLevel: 0, targetLevel: 1 }
        ])

        assert.deepStrictEqual(Array.from(path.nodeIDs).sort(), ['bridge0', 'host', 'switch', 'switch-port', 'vm'])
        assert.ok(!path.nodeIDs.has('eth9'))
        assert.ok(!path.nodeIDs.has('other-bridge'))
        assert.ok(!path.nodeIDs.has('other-vm'))
        assert.ok(!path.nodeIDs.has('other-host'))
        assert.ok(!path.nodeIDs.has('other-switch-port'))
        assert.ok(!path.nodeIDs.has('other-switch'))
    })

    it('uses the same upstream plus direct-one-hop rule for every infrastructure resource type', () => {
        const edges = [
            { id: 'switch-port-switch', sourceID: 'switch', targetID: 'switch-port', sourceLevel: 0, targetLevel: 1 },
            { id: 'host-switch-port', sourceID: 'switch-port', targetID: 'host', sourceLevel: 1, targetLevel: 2 },
            { id: 'nic-host', sourceID: 'host', targetID: 'nic', sourceLevel: 2, targetLevel: 3 },
            { id: 'bond-nic', sourceID: 'nic', targetID: 'bond', sourceLevel: 3, targetLevel: 4 },
            { id: 'host-bridge-bond', sourceID: 'bond', targetID: 'host-bridge', sourceLevel: 4, targetLevel: 5 },
            { id: 'virtual-bridge-host-bridge', sourceID: 'host-bridge', targetID: 'virtual-bridge', sourceLevel: 5, targetLevel: 6 },
            { id: 'system-vm-virtual-bridge', sourceID: 'virtual-bridge', targetID: 'system-vm', sourceLevel: 6, targetLevel: 8 },
            { id: 'user-vm-virtual-bridge', sourceID: 'virtual-bridge', targetID: 'user-vm', sourceLevel: 6, targetLevel: 8 },
            { id: 'router-virtual-bridge', sourceID: 'virtual-bridge', targetID: 'virtual-router', sourceLevel: 6, targetLevel: 8 },
            { id: 'nic-side-peer', sourceID: 'nic', targetID: 'nic-side-peer', sourceLevel: 3, targetLevel: 3 },
            { id: 'bond-descendant', sourceID: 'bond', targetID: 'bond-descendant', sourceLevel: 4, targetLevel: 7 }
        ]
        const cases = [
            { focus: 'switch', direct: ['switch-port'], excluded: ['host'] },
            { focus: 'switch-port', direct: ['host'], excluded: ['nic'] },
            { focus: 'host', direct: ['nic'], excluded: ['bond'] },
            { focus: 'nic', direct: ['bond', 'nic-side-peer'], excluded: ['host-bridge'] },
            { focus: 'bond', direct: ['host-bridge', 'bond-descendant'], excluded: ['virtual-bridge'] },
            { focus: 'host-bridge', direct: ['virtual-bridge'], excluded: ['system-vm'] },
            { focus: 'virtual-bridge', direct: ['system-vm', 'user-vm', 'virtual-router'], excluded: [] },
            { focus: 'system-vm', direct: ['virtual-bridge'], excluded: ['user-vm', 'virtual-router'] },
            { focus: 'user-vm', direct: ['virtual-bridge'], excluded: ['system-vm', 'virtual-router'] },
            { focus: 'virtual-router', direct: ['virtual-bridge'], excluded: ['system-vm', 'user-vm'] }
        ]

        cases.forEach(testCase => {
            const path = topologyNetworkRootPathClosure(testCase.focus, edges)
            testCase.direct.forEach(nodeID => assert.ok(path.nodeIDs.has(nodeID), `${testCase.focus} misses direct ${nodeID}`))
            testCase.excluded.forEach(nodeID => assert.ok(!path.nodeIDs.has(nodeID), `${testCase.focus} recursively included ${nodeID}`))
            assert.ok(path.nodeIDs.has('switch'), `${testCase.focus} misses upstream switch`)
            edges.filter(edge => edge.sourceID === testCase.focus || edge.targetID === testCase.focus)
                .forEach(edge => assert.ok(path.linkIDs.has(edge.id), `${testCase.focus} misses direct edge ${edge.id}`))
            edges.filter(edge => path.linkIDs.has(edge.id)).forEach(edge => {
                assert.ok(path.nodeIDs.has(edge.sourceID), `${edge.id} source is not highlighted`)
                assert.ok(path.nodeIDs.has(edge.targetID), `${edge.id} target is not highlighted`)
            })
        })
    })

    it('keeps collapsed group representatives to one-hop edges without expanding their descendants', () => {
        const path = topologyNetworkRootPathClosure('vm-group', [
            { id: 'bridge-group', sourceID: 'virtual-bridge', targetID: 'vm-group', sourceLevel: 6, targetLevel: 8 },
            { id: 'group-member', sourceID: 'vm-group', targetID: 'group-member', sourceLevel: 8, targetLevel: 9 },
            { id: 'member-descendant', sourceID: 'group-member', targetID: 'member-descendant', sourceLevel: 9, targetLevel: 10 }
        ])

        assert.ok(path.nodeIDs.has('virtual-bridge'))
        assert.ok(path.nodeIDs.has('group-member'))
        assert.ok(path.linkIDs.has('bridge-group'))
        assert.ok(path.linkIDs.has('group-member'))
        assert.ok(!path.nodeIDs.has('member-descendant'))
        assert.ok(!path.linkIDs.has('member-descendant'))
    })

    it('continues upstream through a collapsed group to the switch without entering sibling branches', () => {
        const path = topologyNetworkRootPathClosure('eth0', [
            { id: 'member-group', sourceID: 'nic-group', targetID: 'eth0', sourceLevel: 3, targetLevel: 4 },
            { id: 'host-group', sourceID: 'host', targetID: 'nic-group', sourceLevel: 2, targetLevel: 3 },
            { id: 'switch-port-host', sourceID: 'switch-port', targetID: 'host', sourceLevel: 1, targetLevel: 2 },
            { id: 'switch-port-switch', sourceID: 'switch', targetID: 'switch-port', sourceLevel: 0, targetLevel: 1 },
            { id: 'sibling-group', sourceID: 'nic-group', targetID: 'eth1', sourceLevel: 3, targetLevel: 4 },
            { id: 'sibling-bridge', sourceID: 'eth1', targetID: 'other-bridge', sourceLevel: 4, targetLevel: 5 }
        ])

        ;['eth0', 'nic-group', 'host', 'switch-port', 'switch'].forEach(nodeID => {
            assert.ok(path.nodeIDs.has(nodeID), `missing upstream node ${nodeID}`)
        })
        assert.ok(!path.nodeIDs.has('eth1'))
        assert.ok(!path.nodeIDs.has('other-bridge'))
    })
})
