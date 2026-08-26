import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

import {
    buildInfrastructureHostPortMappings,
    buildInfrastructurePortMappings,
    infrastructurePortConnectionState
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
        assert.ok(source.match(/title: translate\('switchPortMappingSource'\)/g)!.length >= 2)
        assert.ok(source.includes('<DetailBadge tone={source.tone}>{source.label}</DetailBadge>'))

        const styles = fs.readFileSync(
            path.resolve(__dirname, '../src/DataPanels/common/DetailComponents.css'),
            'utf8'
        )
        assert.ok(styles.includes('.netdive-detail-search-table__surface'))
        assert.ok(styles.includes('margin: 0 var(--netdive-detail-card-body-padding-x) 12px'))
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
})
