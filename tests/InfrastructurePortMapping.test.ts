import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

import {
    buildInfrastructureHostPortMappings,
    buildInfrastructurePortMappings,
    infrastructurePortConnectionState,
    manualMappingPortCandidates
} from '../src/InfrastructurePortMapping'
import type { Link, Node } from '../src/Topology'

const node = (id: string, data: any, parent?: Node): Node => {
    const value = {
        id,
        tags: [],
        data,
        weight: 0,
        children: [],
        state: { expanded: false, selected: false, mouseover: false, groupOffset: 0, groupFullSize: false },
        parent: parent || null,
        revision: 0,
        type: 'node',
        getWeight: () => 0
    } as Node
    if (parent) parent.children.push(value)
    return value
}

const link = (id: string, source: Node, target: Node, data: any = {}): Link => ({
    id,
    tags: [],
    source,
    target,
    data,
    state: { selected: false },
    revision: 0,
    type: 'link'
}) as Link

describe('Infrastructure LLDP port mapping', () => {
    it('uses the shared Ant table with Mold-style sortable column headers', () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '../src/DataPanels/common/InfrastructurePortMappingTable.tsx'),
            'utf8'
        )
        assert.ok(source.includes('<DetailTable<InfrastructurePortMapping>'))
        ;[
            "compareMappingField('switchPortName')",
            "compareMappingField('hostName')",
            "compareMappingField('hostNicName')",
            "compareMappingField('connectionState')",
            "compareMappingField('source')"
        ].forEach(sorter => assert.ok(source.includes(sorter), `missing Ant sorter: ${sorter}`))
        assert.ok(source.includes('netdive-detail-search-table__stacked-cell'))
        assert.ok(source.includes('netdive-detail-search-table__surface'))
        assert.ok(source.includes('scroll={{ y: PORT_MAPPING_TABLE_BODY_HEIGHT }}'))
        assert.ok(source.match(/title: translate\('switchPortMappingSource'\)/g)!.length >= 2)
        assert.ok(source.includes('<DetailBadge tone={source.tone}>{source.label}</DetailBadge>'))
        ;[
            "width: '21%'",
            "width: '22%'",
            "width: '20%'",
            "width: '19%'",
            "width: '16%'",
            "width: '28%'",
            "width: '34%'",
            "width: '18%'"
        ].forEach(width => assert.ok(source.includes(width), `missing optimized column width: ${width}`))

        const styles = fs.readFileSync(
            path.resolve(__dirname, '../src/DataPanels/common/DetailComponents.css'),
            'utf8'
        )
        assert.ok(styles.includes('.netdive-detail-search-table__surface'))
        assert.ok(styles.includes('margin: 0 var(--netdive-detail-card-body-padding-x) 12px'))
        assert.ok(styles.includes('.netdive-detail-search-table__table .ant-table-column-sorter-inner'))
        assert.ok(styles.includes('width: 10px'))
    })

    it('navigates the host-side switch mapping to the remote switch before the local NIC', () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '../src/DataPanels/HostDetailPanel.tsx'),
            'utf8'
        )
        assert.ok(source.includes(
            'mapping.switchNodeID || mapping.switchPortNodeID || mapping.hostNicNodeID || mapping.bondInterfaceNodeID'
        ))
    })

    it('joins a switch port to its connected host NIC through the existing topology edge', () => {
        const sw = node('switch-1', { Type: 'switch', Name: 'leaf-1' })
        const port = node('port-1', { Type: 'switchport', Name: 'Ethernet1', State: 'UP' }, sw)
        const host = node('host-1', { Type: 'host', Name: 'compute-1' })
        const nic = node('nic-1', { Type: 'device', Name: 'eno1', State: 'UP' }, host)
        const relation = link('lldp-1', port, nic, { RelationType: 'layer2' })

        const result = buildInfrastructurePortMappings(sw, [sw, port, host, nic], [relation])

        assert.strictEqual(result.length, 1)
        assert.deepStrictEqual(result[0], {
            key: 'switch-1::port-1::nic-1',
            switchName: 'leaf-1',
            switchNodeID: 'switch-1',
            switchPortName: 'Ethernet1',
            switchPortNodeID: 'port-1',
            hostName: 'compute-1',
            hostNodeID: 'host-1',
            hostNicName: 'eno1',
            hostNicNodeID: 'nic-1',
            connectionState: 'connected',
            source: 'automatic',
            relationLinkID: 'lldp-1'
        })
    })

    it('uses an LLDP RemotePortID only when an existing switch-to-NIC edge exists', () => {
        const sw = node('switch-1', { Type: 'switch', Name: 'leaf-1' })
        const host = node('host-1', { Type: 'host', Name: 'compute-1' })
        const nic = node('nic-1', {
            Type: 'device',
            Name: 'eno1',
            State: 'UP',
            LLDP: { RemotePortID: 'Ethernet48' }
        }, host)

        assert.strictEqual(buildInfrastructurePortMappings(sw, [sw, host, nic], []).length, 0)

        const result = buildInfrastructurePortMappings(sw, [sw, host, nic], [link('lldp-1', sw, nic)])
        assert.strictEqual(result.length, 1)
        assert.strictEqual(result[0].switchPortName, 'Ethernet48')
        assert.strictEqual(result[0].switchPortNodeID, undefined)
    })

    it('keeps an explicit disconnected state ahead of a healthy peer state', () => {
        const port = node('port-1', { Type: 'switchport', State: 'DOWN' })
        const nic = node('nic-1', { Type: 'device', State: 'UP' })
        assert.strictEqual(infrastructurePortConnectionState(port, nic), 'disconnected')
        assert.strictEqual(infrastructurePortConnectionState(node('unknown', { Type: 'device' })), 'unknown')
    })

    it('does not treat ownership edges as LLDP port mappings', () => {
        const sw = node('switch-1', { Type: 'switch' })
        const port = node('port-1', { Type: 'switchport', Name: 'Ethernet1' }, sw)
        const host = node('host-1', { Type: 'host', Name: 'compute-1' })
        const nic = node('nic-1', { Type: 'device', Name: 'eno1' }, host)
        const ownership = link('ownership-1', port, nic, { RelationType: 'ownership' })
        assert.strictEqual(buildInfrastructurePortMappings(sw, [sw, port, host, nic], [ownership]).length, 0)
    })

    it('keeps logical bonds out of the host NIC column when a physical NIC relation is present', () => {
        const sw = node('switch-1', { Type: 'switch' })
        const port = node('port-1', { Type: 'switchport', Name: 'xg1' }, sw)
        const host = node('host-1', { Type: 'host', Name: 'compute-1' })
        const bond = node('bond-1', { Type: 'bond', Name: 'bond0' }, host)
        const nic = node('nic-1', { Type: 'device', Name: 'eno1' }, host)
        const result = buildInfrastructurePortMappings(sw, [sw, port, host, bond, nic], [
            link('lldp-bond', port, bond),
            link('lldp-nic', port, nic)
        ])

        assert.strictEqual(result.length, 1)
        assert.strictEqual(result[0].hostNicName, 'eno1')
    })

    it('projects the same LLDP relation from the host and preserves bond membership', () => {
        const sw = node('switch-1', { Type: 'switch', Name: 'leaf-1' })
        const port = node('port-1', { Type: 'switchport', Name: 'xg1', State: 'UP' }, sw)
        const host = node('host-1', { Type: 'host', Name: 'compute-1' })
        const bond = node('bond-1', { Type: 'bond', Name: 'bond0', IfIndex: 20 }, host)
        const nic = node('nic-1', {
            Type: 'device',
            Name: 'eno1',
            MasterIndex: 20,
            BondSlave: { Type: 'bond' },
            State: 'UP'
        }, host)
        const relation = link('lldp-1', port, nic, { RelationType: 'layer2' })

        const result = buildInfrastructureHostPortMappings(host, [sw, port, host, bond, nic], [relation])

        assert.strictEqual(result.length, 1)
        assert.strictEqual(result[0].hostNicName, 'eno1')
        assert.strictEqual(result[0].bondInterfaceName, 'bond0')
        assert.strictEqual(result[0].bondInterfaceNodeID, 'bond-1')
        assert.strictEqual(result[0].switchName, 'leaf-1')
        assert.strictEqual(result[0].switchPortName, 'xg1')
        assert.strictEqual(result[0].source, 'automatic')
    })

    it('keeps a non-bonded host NIC and an empty bond value distinct', () => {
        const sw = node('switch-1', { Type: 'switch', Name: 'leaf-1' })
        const port = node('port-1', { Type: 'switchport', Name: 'xg1' }, sw)
        const host = node('host-1', { Type: 'host', Name: 'compute-1' })
        const nic = node('nic-1', { Type: 'device', Name: 'eno1' }, host)
        const result = buildInfrastructureHostPortMappings(host, [sw, port, host, nic], [link('lldp-1', port, nic)])

        assert.strictEqual(result.length, 1)
        assert.strictEqual(result[0].bondInterfaceName, '')
        assert.strictEqual(result[0].bondInterfaceNodeID, undefined)
    })

	it('keeps an automatic mapping authoritative and only appends a manual mapping for an unconnected port', () => {
		const sw = node('switch-1', { Type: 'switch', Name: 'leaf-1' })
		const automaticPort = node('port-1', { Type: 'switchport', Name: 'xg1' }, sw)
		const unconnectedPort = node('port-2', { Type: 'switchport', Name: 'xg2' }, sw)
		const host = node('host-1', { Type: 'host', Name: 'compute-1' })
		const automaticNIC = node('nic-1', { Type: 'device', Name: 'eno1' }, host)
		const manualNIC = node('nic-2', { Type: 'device', Name: 'eno2' }, host)
		const conflictingManual = {
			id: 7,
			switchNodeId: sw.id,
			switchName: 'leaf-1',
			switchPortNodeId: automaticPort.id,
			switchPortName: 'xg1',
			hostNodeId: host.id,
			hostName: 'compute-1',
			hostNicNodeId: manualNIC.id,
			hostNicName: 'eno2',
			enabled: true,
			createdAt: '2026-09-07T00:00:00Z',
			updatedAt: '2026-09-07T00:00:00Z'
		}
		const supplementalManual = {
			...conflictingManual,
			id: 8,
			switchPortNodeId: unconnectedPort.id,
			switchPortName: 'xg2'
		}

		const switchResult = buildInfrastructurePortMappings(
			sw,
			[sw, automaticPort, unconnectedPort, host, automaticNIC, manualNIC],
			[link('lldp-1', automaticPort, automaticNIC)],
			[conflictingManual, supplementalManual]
		)
		assert.strictEqual(switchResult.length, 2)
		assert.strictEqual(switchResult[0].source, 'automatic')
		assert.strictEqual(switchResult[0].hostNicNodeID, 'nic-1')
		assert.strictEqual(switchResult[1].source, 'manual')
		assert.strictEqual(switchResult[1].manualMappingID, 8)

		const hostResult = buildInfrastructureHostPortMappings(
			host,
			[sw, automaticPort, unconnectedPort, host, automaticNIC, manualNIC],
			[link('lldp-1', automaticPort, automaticNIC)],
			[conflictingManual, supplementalManual]
		)
		assert.strictEqual(hostResult.length, 2)
		assert.deepStrictEqual(hostResult.map(mapping => mapping.source), ['automatic', 'manual'])
	})

	it('offers only ports without automatic or other active manual mappings', () => {
		const sw = node('switch-1', { Type: 'switch', Name: 'leaf-1' })
		const automaticPort = node('port-1', { Type: 'switchport', Name: 'xg1' }, sw)
		const availablePort = node('port-2', { Type: 'switchport', Name: 'xg2' }, sw)
		const manualPort = node('port-3', { Type: 'switchport', Name: 'xg3' }, sw)
		const host = node('host-1', { Type: 'host', Name: 'compute-1' })
		const automaticNIC = node('nic-1', { Type: 'device', Name: 'eno1' }, host)
		const manual = {
			id: 9,
			switchNodeId: sw.id,
			switchPortNodeId: manualPort.id,
			switchPortName: 'xg3',
			hostNodeId: host.id,
			hostNicNodeId: 'nic-2',
			enabled: true,
			createdAt: '2026-09-07T00:00:00Z',
			updatedAt: '2026-09-07T00:00:00Z'
		}
		const nodes = [sw, automaticPort, availablePort, manualPort, host, automaticNIC]
		const automatic = buildInfrastructurePortMappings(sw, nodes, [link('lldp-1', automaticPort, automaticNIC)])

		assert.deepStrictEqual(
			manualMappingPortCandidates(sw, nodes, automatic, [manual]).map(port => port.id),
			['port-2']
		)
		assert.deepStrictEqual(
			manualMappingPortCandidates(sw, nodes, automatic, [manual], manual.id).map(port => port.id),
			['port-2', 'port-3']
		)
	})

	it('wires manual CRUD management to the switch detail without changing topology links', () => {
		const panel = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/SwitchDetailPanel.tsx'), 'utf8')
		const manager = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/common/ManualPortMappingManager.tsx'), 'utf8')
		assert.ok(panel.includes('<ManualPortMappingManager'))
		assert.ok(panel.includes('listManualPortMappings'))
		assert.ok(manager.includes('createManualPortMapping'))
		assert.ok(manager.includes('updateManualPortMapping'))
		assert.ok(manager.includes('disableManualPortMapping'))
		assert.ok(manager.includes("translate('manualPortMappingGuidance')"))
		assert.ok(manager.includes('manualMappingPortCandidates'))
		assert.ok(!manager.includes('window.App.tc.links.set'))
	})
})
