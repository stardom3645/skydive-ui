import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

import {
    buildInfrastructureHostPortMappings,
    buildManualPortMappingTopologyLinks,
    buildInfrastructurePortMappings,
    infrastructurePortConnectionState,
    isManualPortMappingNICEligible,
    manualMappingToInfrastructure,
    manualPortNameConflict
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
        assert.ok(source.includes(': PORT_MAPPING_TABLE_BODY_HEIGHT }}'))
        assert.ok(source.match(/title: translate\('switchPortMappingSource'\)/g)!.length >= 2)
        assert.ok(source.includes('<DetailBadge tone={source.tone}>{source.label}</DetailBadge>'))
        assert.ok(source.includes("source === 'manual') return { label: translate('switchPortMappingManual'), tone: 'default'"))
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
        assert.ok(source.includes('netdive-detail-search-table__summary'))
        assert.ok(source.includes('netdive-detail-search-table__topbar'))
        assert.ok(source.includes('netdive-port-mapping-expanded-modal'))
        assert.ok(source.includes('EXPANDED_PORT_MAPPING_TABLE_BODY_HEIGHT'))
        assert.ok(!source.includes("title: translate('manualPortMappingActions')"))

        const styles = fs.readFileSync(
            path.resolve(__dirname, '../src/DataPanels/common/DetailComponents.css'),
            'utf8'
        )
        assert.ok(styles.includes('.netdive-detail-search-table__surface'))
        assert.ok(styles.includes('margin: 0 var(--netdive-detail-card-body-padding-x) 12px'))
        assert.ok(styles.includes('.netdive-detail-search-table__topbar'))
        assert.ok(styles.includes('flex-direction: column'))
        assert.ok(styles.includes('gap: 6px'))
        assert.ok(styles.includes('.netdive-detail-search-table.is-expanded'))
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
        assert.ok(source.includes('className="netdive-port-mapping-header-actions"'))
        assert.ok(source.includes('className="netdive-port-mapping-expand-trigger"'))
        assert.ok(source.includes('expanded={this.state.portMappingExpanded}'))
        assert.ok(source.includes('onExpandedChange='))
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

    it('keeps down physical NICs selectable while excluding logical interfaces', () => {
        const downNIC = node('nic-down', { Type: 'device', Name: 'eno2', State: 'DOWN', Driver: 'ixgbe' })
        assert.strictEqual(isManualPortMappingNICEligible(downNIC), true)
        assert.strictEqual(isManualPortMappingNICEligible(node('nic-unknown', { Type: 'device', Name: 'eno3' })), true)
        assert.strictEqual(isManualPortMappingNICEligible(node('loopback', { Type: 'device', Name: 'lo', EncapType: 'loopback' })), false)
        assert.strictEqual(isManualPortMappingNICEligible(node('bond', { Type: 'device', Name: 'bond0', Driver: 'bonding' })), false)
        assert.strictEqual(isManualPortMappingNICEligible(node('veth', { Type: 'device', Name: 'veth1234', Driver: 'veth' })), false)
        assert.strictEqual(isManualPortMappingNICEligible(node('vlan', { Type: 'device', Name: 'eno1.100' })), false)

        const manual = manualMappingToInfrastructure({
            id: 1,
            switchNodeId: 'switch-1',
            switchPortName: 'xg7',
            hostNodeId: 'host-1',
            hostNicNodeId: downNIC.id,
            enabled: true,
            createdAt: '',
            updatedAt: ''
        }, downNIC)
        assert.strictEqual(manual.connectionState, 'disconnected')
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
		const automaticNICConflict = {
			...conflictingManual,
			id: 9,
			switchPortNodeId: undefined,
			switchPortName: 'xg3',
			hostNicNodeId: automaticNIC.id,
			hostNicName: 'eno1'
		}

		const switchResult = buildInfrastructurePortMappings(
			sw,
			[sw, automaticPort, unconnectedPort, host, automaticNIC, manualNIC],
			[link('lldp-1', automaticPort, automaticNIC)],
			[conflictingManual, supplementalManual, automaticNICConflict]
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
			[conflictingManual, supplementalManual, automaticNICConflict]
		)
		assert.strictEqual(hostResult.length, 2)
		assert.deepStrictEqual(hostResult.map(mapping => mapping.source), ['automatic', 'manual'])
	})

	it('renders a supplemental manual topology link and lets AUTO suppress it', () => {
		const sw = node('switch-1', { Type: 'switch', Name: 'leaf-1' })
		const otherSwitch = node('switch-2', { Type: 'switch', Name: 'leaf-2' })
		const otherPort = node('port-2', { Type: 'switchport', Name: 'xg7' }, otherSwitch)
		const host = node('host-1', { Type: 'host', Name: 'compute-1' })
		const manualNIC = node('nic-1', { Type: 'device', Name: 'eno1' }, host)
		const otherNIC = node('nic-2', { Type: 'device', Name: 'eno2' }, host)
		const manual = {
			id: 11,
			switchNodeId: sw.id,
			switchPortName: ' xg7 ',
			hostNodeId: host.id,
			hostNicNodeId: manualNIC.id,
			enabled: true,
			createdAt: '2026-09-07T00:00:00Z',
			updatedAt: '2026-09-07T00:00:00Z'
		}
		const nodes = [sw, otherSwitch, otherPort, host, manualNIC, otherNIC]
		const unrelatedAutomatic = link('lldp-other', otherPort, otherNIC, { RelationType: 'layer2' })

		const supplemental = buildManualPortMappingTopologyLinks([manual], nodes, [unrelatedAutomatic])
		assert.deepStrictEqual(supplemental, [{
			id: 'manual-port-mapping-11',
			switchNodeID: sw.id,
			portNodeID: 'manual-switch-port-11',
			portData: {
				Type: 'switchport',
				Name: 'xg7',
				Probe: 'manual',
				ManualPortMapping: true,
				ManualPortMappingPort: true,
				ManualPortMappingID: 11,
				SwitchNodeID: sw.id
			},
			sourceNodeID: 'manual-switch-port-11',
			targetNodeID: manualNIC.id,
			tags: ['layer2'],
			data: {
				RelationType: 'manual',
				ManualPortMapping: true,
				ManualPortMappingID: 11,
				SwitchPortName: 'xg7'
			}
		}])

		const manualPort = node(supplemental[0].portNodeID, supplemental[0].portData, sw)
		const manualLink = link(supplemental[0].id, manualPort, manualNIC, supplemental[0].data)
		assert.strictEqual(buildInfrastructurePortMappings(sw, [...nodes, manualPort], [manualLink]).length, 0)

		const collectedPort = node('port-1', { Type: 'switchport', Name: 'xg7' }, sw)
		const samePortAutomatic = link('lldp-1', collectedPort, otherNIC, { RelationType: 'layer2' })
		assert.strictEqual(
			buildManualPortMappingTopologyLinks([manual], [...nodes, collectedPort], [samePortAutomatic, manualLink]).length,
			0
		)
	})

	it('rejects free-form port names already used by automatic or active manual mappings', () => {
		const sw = node('switch-1', { Type: 'switch', Name: 'leaf-1' })
		const automaticPort = node('port-1', { Type: 'switchport', Name: 'xg1' }, sw)
		const host = node('host-1', { Type: 'host', Name: 'compute-1' })
		const automaticNIC = node('nic-1', { Type: 'device', Name: 'eno1' }, host)
		const manual = {
			id: 9,
			switchNodeId: sw.id,
			switchPortName: 'xg3',
			hostNodeId: host.id,
			hostNicNodeId: 'nic-2',
			enabled: true,
			createdAt: '2026-09-07T00:00:00Z',
			updatedAt: '2026-09-07T00:00:00Z'
		}
		const nodes = [sw, automaticPort, host, automaticNIC]
		const automatic = buildInfrastructurePortMappings(sw, nodes, [link('lldp-1', automaticPort, automaticNIC)])
		const otherSwitchAutomatic = {
			...automatic[0],
			key: 'switch-2::port-9::nic-9',
			switchNodeID: 'switch-2',
			switchPortName: 'xg9'
		}

		const allAutomatic = automatic.concat(otherSwitchAutomatic)
		assert.strictEqual(manualPortNameConflict(sw.id, ' XG1 ', allAutomatic, [manual]), 'automatic')
		assert.strictEqual(manualPortNameConflict(sw.id, ' xg3 ', allAutomatic, [manual]), 'manual')
		assert.strictEqual(manualPortNameConflict(sw.id, 'xg3', allAutomatic, [manual], manual.id), undefined)
		assert.strictEqual(manualPortNameConflict(sw.id, 'xg9', allAutomatic, [manual]), undefined)
		assert.strictEqual(manualPortNameConflict(sw.id, 'Gi1/0/24', allAutomatic, [manual]), undefined)
	})

	it('wires manual CRUD management to the switch detail and refreshes UI-only topology links', () => {
		const panel = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/SwitchDetailPanel.tsx'), 'utf8')
		const manager = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/common/ManualPortMappingManager.tsx'), 'utf8')
		const styles = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/SwitchDetailPanel.css'), 'utf8')
		const app = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
		const topology = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
		const topologyStyles = fs.readFileSync(path.resolve(__dirname, '../src/Topology.css'), 'utf8')
		const groupPanel = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/GroupDetailPanel.tsx'), 'utf8')
		const groupPanelStyles = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/GroupDetailPanel.css'), 'utf8')
		const switchPortPanel = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/SwitchPortDetailPanel.tsx'), 'utf8')
		const mappingTable = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/common/InfrastructurePortMappingTable.tsx'), 'utf8')
		const detailStyles = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/common/DetailComponents.css'), 'utf8')
		assert.ok(panel.includes('<ManualPortMappingManager'))
		assert.ok(panel.includes('className="netdive-switch-port-mapping-section"'))
		assert.ok(panel.includes('className="netdive-switch-port-mapping-section__actions netdive-port-mapping-header-actions"'))
		assert.ok(panel.includes('className="netdive-port-mapping-expand-trigger"'))
		assert.ok(panel.includes('onExpandedChange='))
		assert.ok(panel.includes('listManualPortMappings'))
		assert.ok(panel.includes('allMappings={this.state.allManualMappings}'))
		assert.ok(panel.includes('fullWidthDescription'))
		assert.ok(panel.includes('refreshManualPortMappingLinks'))
		assert.ok(app.includes('buildManualPortMappingTopologyLinks'))
		assert.ok(app.includes('reconcileManualPortMappingLinks'))
		assert.ok(app.includes('scheduleManualPortMappingRefresh'))
		assert.ok(topology.includes('this.props.linkAttrs(d).classes'))
		assert.ok(topologyStyles.includes('.links .manual-port-mapping'))
		assert.ok(topologyStyles.includes('stroke-dasharray: 8 6'))
		assert.ok(groupPanel.includes('node.data?.ManualPortMappingPort'))
		assert.ok(groupPanel.includes("translate(manualPort ? 'switchPortMappingManual' : 'switchPortMappingAutomatic')"))
		assert.ok(groupPanel.includes('className="netdive-group-detail-portMethodTag"'))
		assert.ok(!groupPanel.includes("manualPort ? 'is-manual-port' : ''"))
		assert.ok(groupPanelStyles.includes('.netdive-group-detail-portMethodTag.netdive-detail-badge.ant-tag'))
		assert.ok(!groupPanelStyles.includes('.netdive-group-detail-nodeAvatar.is-manual-port'))
		assert.ok(switchPortPanel.includes("probe.toLowerCase() === 'manual' ? translate('manualProbe') : probe"))
		assert.strictEqual((mappingTable.match(/netdive-detail-search-table__connection-state-column/g) || []).length, 2)
		assert.ok(detailStyles.includes('td.netdive-detail-search-table__connection-state-column'))
		assert.ok(detailStyles.includes('text-align: left'))
		assert.ok(manager.includes('createManualPortMapping'))
		assert.ok(manager.includes('updateManualPortMapping'))
		assert.ok(manager.includes('disableManualPortMapping'))
		assert.ok(manager.includes("translate('manualPortMappingGuidance')"))
		assert.ok(manager.includes('<Input'))
		assert.ok(manager.includes('switchPortName.trim()'))
		assert.ok(manager.includes('manualPortNameConflict'))
		assert.ok(manager.includes('automaticallyConnectedNICs.has(item.node.id)'))
		assert.ok(manager.includes("<Select.OptGroup label={translate('manualPortMappingAvailableNics')}>"))
		assert.ok(manager.includes("<Select.OptGroup label={translate('manualPortMappingUnavailableNics')}>"))
		assert.ok(manager.includes("'manualPortMappingNicAutoInUse'"))
		assert.ok(manager.includes("'manualPortMappingNicManualInUse'"))
		assert.ok(manager.includes('className="netdive-manual-port-mapping-manager__submit"'))
		assert.ok(manager.includes('<Button className="netdive-manual-port-mapping-trigger"'))
		assert.ok(!manager.includes('<Button type="primary" className="netdive-manual-port-mapping-trigger"'))
		assert.ok(manager.includes('<Dropdown'))
		assert.ok(manager.includes('getPopupContainer={() => document.body}'))
		assert.ok(manager.includes('overlayClassName="netdive-manual-port-mapping-delete-confirm"'))
		assert.ok(manager.includes("okText={translate('manualPortMappingDeleteOk')}"))
		assert.ok(manager.includes("translate('manualPortMappingMenuAdd')"))
		assert.ok(manager.includes("translate('manualPortMappingMenuList')"))
		assert.ok(manager.includes("view: 'form' | 'list'"))
		assert.ok(manager.includes("this.state.view === 'form'"))
		assert.ok(manager.includes("this.setState({ saving: false, view: 'list' }, this.resetForm)"))
		assert.ok(manager.includes('infrastructurePortConnectionState(item.node)'))
		assert.ok(manager.includes("'manualPortMappingNicDown'"))
		assert.ok(manager.includes("translate('manualPortMappingNicDownHelp')"))
		assert.ok(manager.includes("'manualPortMappingNicUnknown'"))
		assert.ok(manager.includes('dropdownClassName="netdive-manual-port-mapping-nic-dropdown"'))
		assert.ok(manager.includes('optionLabelProp="label"'))
		assert.ok(manager.includes('className="netdive-manual-port-mapping-manager__cancel"'))
		assert.ok(manager.includes('wrapClassName="netdive-manual-port-mapping-modal"'))
		assert.ok(!manager.includes('window.App.tc.links.set'))
		assert.ok(styles.includes('.netdive-switch-port-mapping-section .netdive-detail-section__heading'))
		assert.ok(styles.includes('color: var(--netdive-detail-text)'))
		assert.ok(styles.includes('row-gap: 4px'))
		assert.ok(styles.includes('overflow-wrap: anywhere'))
		assert.ok(styles.includes('transform: translateY(-2px)'))
		assert.ok(!styles.includes('padding-right: 148px'))
		assert.ok(styles.includes('.netdive-manual-port-mapping-manager__submit.ant-btn'))
		assert.ok(styles.includes('.netdive-manual-port-mapping-delete-confirm'))
		assert.ok(styles.includes('.netdive-manual-port-mapping-manager__cancel.ant-btn'))
		assert.ok(detailStyles.includes('.netdive-port-mapping-header-actions .ant-btn'))
		assert.ok(detailStyles.includes('gap: 8px'))
		assert.ok(styles.includes('min-width: 88px'))
		assert.ok(styles.includes('.netdive-manual-port-mapping-nic-dropdown .ant-select-item-option'))
		assert.ok(styles.includes('font-family: var(--netdive-font-family) !important'))
		assert.ok(styles.includes('font-size: 14px'))
		assert.ok(styles.includes('font-weight: 400'))
		const chevronStyles = styles.match(/\.netdive-manual-port-mapping-trigger__chevron\.anticon\s*\{([^}]+)\}/)![1]
		assert.ok(chevronStyles.includes('font-size: 10px'))
		assert.ok(chevronStyles.includes('vertical-align: baseline'))
	})
})
