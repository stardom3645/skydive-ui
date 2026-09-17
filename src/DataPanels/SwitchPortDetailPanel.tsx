import * as React from 'react'
import { ApiOutlined, ApartmentOutlined, InfoCircleOutlined, LinkOutlined } from '@ant-design/icons'

import { Link, Node, NodeAttrs } from '../Topology'
import { translate } from '../Config'
import { infrastructurePortConnectionState } from '../InfrastructurePortMapping'
import { switchDisplayName, switchLLDPData, switchTextValue } from '../SwitchNodeUtils'
import { connectedResourcePopoverItems, DetailBadge, DetailKeyValueList, DetailResourceCard, DetailResourceGrid, DetailSection, InfrastructureTopologyIcon, navigateInfrastructureConnectedResources } from './common'
import './SwitchPortDetailPanel.css'

interface Props {
    node: Node
    nodeAttrs: (node: Node) => NodeAttrs
}

class SwitchPortDetailPanel extends React.Component<Props> {
    private data(): any {
        return this.props.node.data || {}
    }

    private topologyLinks(): Link[] {
        const links = (window as any).App?.tc?.links
        return links && typeof links.values === 'function' ? Array.from(links.values()) as Link[] : []
    }

    private nodeType(node?: Node): string {
        return String(node?.data?.Type || node?.data?.type || '').toLowerCase()
    }

    private parentSwitch(): Node | undefined {
        let parent = this.props.node.parent
        while (parent) {
            if (this.nodeType(parent) === 'switch') return parent
            parent = parent.parent
        }

        for (const link of this.topologyLinks()) {
            const peer = link.source.id === this.props.node.id
                ? link.target
                : link.target.id === this.props.node.id
                ? link.source
                : undefined
            if (peer && this.nodeType(peer) === 'switch') return peer
        }
        return undefined
    }

    private connectedPeers(parentSwitch?: Node): Node[] {
        const peers = new Map<string, Node>()
        this.topologyLinks().forEach(link => {
            const relationType = String(link.data?.RelationType || '').toLowerCase()
            if (relationType === 'ownership' || relationType === 'vownership') return
            const peer = link.source.id === this.props.node.id
                ? link.target
                : link.target.id === this.props.node.id
                ? link.source
                : undefined
            if (peer && peer.id !== parentSwitch?.id) peers.set(peer.id, peer)
        })
        return Array.from(peers.values())
    }

    private hostAncestor(node?: Node): Node | undefined {
        let current = node
        while (current) {
            if (this.nodeType(current) === 'host') return current
            current = current.parent || undefined
        }
        return undefined
    }

    private connectedHosts(peers: Node[]): Node[] {
        const hosts = new Map<string, Node>()
        peers.forEach(peer => {
            const host = this.hostAncestor(peer)
            if (host) hosts.set(host.id, host)
        })
        return Array.from(hosts.values())
    }

    private text(data: any, keys: string[]): string {
        return switchTextValue(data, keys)
    }

    private vlanNames(value: any): string {
        if (!Array.isArray(value)) return ''
        return value.map(vlan => {
            if (!vlan || typeof vlan !== 'object') return String(vlan || '').trim()
            const id = this.text(vlan, ['ID', 'Id', 'VID', 'VlanID'])
            const name = this.text(vlan, ['Name', 'name'])
            return id && name ? `${id} · ${name}` : id || name
        }).filter(Boolean).join(', ')
    }

    private linkAggregation(value: any): string {
        if (!value || typeof value !== 'object') return ''
        const enabled = value.Enabled === true || String(value.Enabled).toLowerCase() === 'true'
        const supported = value.Supported === true || String(value.Supported).toLowerCase() === 'true'
        if (!enabled && !supported) return ''
        const portID = this.text(value, ['PortID', 'PortId', 'ID', 'Id'])
        const state = translate(enabled ? 'switchPortLinkAggregationEnabled' : 'switchPortLinkAggregationDisabled')
        return portID ? `${state} · ID ${portID}` : state
    }

    private basicRows(parentSwitch: Node | undefined) {
        const data = this.data()
        const name = this.text(data, ['Name', 'name', 'IfName', 'InterfaceName']) || this.props.node.id
        const parentName = parentSwitch ? switchDisplayName(parentSwitch.data, parentSwitch.id) : ''
        const type = this.text(data, ['Type', 'type']) || 'switchport'
        const mac = this.text(data, ['MAC', 'Mac', 'MacAddress', 'HardwareAddr'])
        const state = this.text(data, ['State', 'state', 'Status', 'status'])
        const probe = this.text(data, ['Probe', 'probe'])
        const probeDisplay = probe.toLowerCase() === 'manual' ? translate('manualProbe') : probe

        return [
            { key: 'name', label: translate('Name'), value: name, textValue: name, copyText: name },
            { key: 'switch', label: translate('phy-switch'), value: parentName, textValue: parentName },
            { key: 'type', label: translate('Type'), value: type, textValue: type },
            { key: 'mac', label: translate('MAC'), value: mac, textValue: mac, copyText: mac || undefined },
            { key: 'state', label: translate('State'), value: state, textValue: state },
            { key: 'probe', label: translate('switchProbe'), value: probeDisplay, textValue: probeDisplay }
        ].filter(row => row.textValue !== '' && row.textValue !== '-')
    }

    private portRows() {
        const data = this.data()
        const lldp = switchLLDPData(data)
        const name = this.text(data, ['Name', 'name', 'IfName', 'InterfaceName']) || this.props.node.id
        const distinctFromName = (value: string) => value && value.trim().toLowerCase() !== name.trim().toLowerCase() ? value : ''
        const portID = distinctFromName(this.text(lldp, ['PortID', 'PortId', 'RemotePortID', 'RemotePortId']))
        const portIDType = portID ? this.text(lldp, ['PortIDType', 'PortIdType']) : ''
        const description = distinctFromName(this.text(lldp, ['Description', 'PortDescription', 'RemotePortDescription']))
        const mtu = this.text(data, ['MTU', 'Mtu', 'mtu']) || this.text(lldp, ['MTU', 'Mtu', 'mtu'])
        const pvid = this.text(lldp, ['PVID', 'Pvid'])
        const managementVID = this.text(lldp, ['ManagementVID', 'ManagementVid'])
        const vlans = this.vlanNames(lldp.VLANNames || lldp.VlanNames || lldp.VLANs)
        // The backend historically serialized this key with three g's.
        // Accept both spellings so older and corrected analyzers render alike.
        const aggregation = this.linkAggregation(lldp.LinkAgggregation || lldp.LinkAggregation)

        return [
            { key: 'port-id', label: translate('switchPortPortId'), value: portID, textValue: portID, copyText: portID || undefined },
            { key: 'port-id-type', label: translate('switchPortPortIdType'), value: portIDType, textValue: portIDType },
            { key: 'description', label: translate('switchPortDescription'), value: description, textValue: description },
            { key: 'mtu', label: translate('MTU'), value: mtu, textValue: mtu },
            { key: 'pvid', label: translate('switchPortPvid'), value: pvid, textValue: pvid },
            { key: 'management-vid', label: translate('switchPortManagementVlan'), value: managementVID, textValue: managementVID },
            { key: 'vlans', label: translate('switchPortVlans'), value: vlans, textValue: vlans, wrap: true },
            { key: 'link-aggregation', label: translate('switchPortLinkAggregation'), value: aggregation, textValue: aggregation }
        ].filter(row => row.textValue !== '' && row.textValue !== '-')
    }

    private connectedInterfaces(peers: Node[]): Node[] {
        return peers.filter(peer => this.nodeType(peer) !== 'host' && !!this.hostAncestor(peer))
    }

    private connectionStateBadge(state: string): React.ReactNode {
        const tone = state === 'connected' ? 'success' : state === 'disconnected' ? 'danger' : 'default'
        return <DetailBadge tone={tone}>{translate(`switchPortMapping${state === 'connected' ? 'Connected' : state === 'disconnected' ? 'Disconnected' : 'Unknown'}`)}</DetailBadge>
    }

    private formatSpeed(value: string): string {
        if (!value) return ''
        const numeric = Number(value)
        return Number.isNaN(numeric) || /[a-z]/i.test(value) ? value : `${numeric.toLocaleString()} Mbps`
    }

    private connectionRows(interfaces: Node[]) {
        const state = infrastructurePortConnectionState(this.props.node, ...interfaces)
        const manual = !!this.data().ManualPortMappingPort || this.text(this.data(), ['Probe', 'probe']).toLowerCase() === 'manual'
        const source = manual ? translate('switchPortConnectionManual') : translate('switchPortConnectionAutomatic')

        return [
            { key: 'connection-state', label: translate('switchPortMappingState'), value: this.connectionStateBadge(state), textValue: translate(`switchPortMapping${state === 'connected' ? 'Connected' : state === 'disconnected' ? 'Disconnected' : 'Unknown'}`) },
            { key: 'source', label: translate('switchPortMappingSource'), value: source, textValue: source }
        ].filter(row => row.textValue !== '' && row.textValue !== '-')
    }

    private interfaceRows(node: Node) {
        const data = node.data || {}
        const linkState = this.text(data, ['State', 'state', 'OperState', 'OperationalState', 'LinkState', 'Carrier'])
        const speed = this.formatSpeed(this.text(data, ['Speed', 'speed']))
        const duplex = this.text(data, ['Duplex', 'duplex', 'LinkDuplex'])
        const bond = this.text(data, ['Master', 'MasterName', 'Bond', 'BondName', 'master', 'bond'])
        const mac = this.text(data, ['MAC', 'Mac', 'MacAddress', 'HardwareAddr'])
        const ipv4 = this.text(data, ['IPV4', 'IPv4', 'ipv4'])
        const driver = this.text(data, ['Driver', 'driver'])
        const mtu = this.text(data, ['MTU', 'Mtu', 'mtu'])

        return [
            { key: 'link-state', label: translate('nicLinkStatus'), value: linkState, textValue: linkState },
            { key: 'speed', label: translate('Speed'), value: speed, textValue: speed },
            { key: 'duplex', label: translate('nicDuplex'), value: duplex, textValue: duplex },
            { key: 'bond', label: translate('hostSwitchPortBondInterface'), value: bond, textValue: bond },
            { key: 'mac', label: translate('MAC'), value: mac, textValue: mac, copyText: mac || undefined },
            { key: 'ipv4', label: translate('ipv4'), value: ipv4, textValue: ipv4, copyText: ipv4 || undefined },
            { key: 'driver', label: translate('Driver'), value: driver, textValue: driver },
            { key: 'mtu', label: translate('MTU'), value: mtu, textValue: mtu }
        ].filter(row => row.textValue !== '' && row.textValue !== '-')
    }

    private renderConnectionInfo(interfaces: Node[]) {
        return (
            <>
                <DetailKeyValueList rows={this.connectionRows(interfaces)} copyTooltip={translate('copy')} />
                {interfaces.map(node => {
                    const rows = this.interfaceRows(node)
                    if (!rows.length) return null
                    const name = this.text(node.data || {}, ['Name', 'name', 'IfName', 'InterfaceName']) || node.id
                    return <div className="netdive-switch-port-detail__interface" key={node.id}>
                        <div className="netdive-switch-port-detail__interface-name">{name}</div>
                        <DetailKeyValueList rows={rows} density="compact" copyTooltip={translate('copy')} />
                    </div>
                })}
            </>
        )
    }

    private focusNodeIDs(nodeIDs: string[]) {
        navigateInfrastructureConnectedResources(nodeIDs, this.props.node.id, 'summary')
    }

    private renderConnectedResources(parentSwitch: Node | undefined, connectedHosts: Node[], interfaces: Node[]) {
        const resources = [
            { label: translate('infrastructureHosts'), nodes: connectedHosts, fallbackType: 'host', iconTone: 'host' as const },
            { label: translate('phy-switch'), nodes: parentSwitch ? [parentSwitch] : [], fallbackType: 'switch', iconTone: 'switch' as const },
            { label: translate('switchPortConnectedNodes'), nodes: interfaces, fallbackType: 'device', iconTone: 'interface' as const }
        ]

        return (
            <DetailResourceGrid>
                {resources.map(resource => (
                    <DetailResourceCard
                        key={String(resource.label)}
                        label={resource.label}
                        value={String(resource.nodes.length)}
                        icon={<InfrastructureTopologyIcon
                            node={resource.nodes[0]}
                            nodeAttrs={this.props.nodeAttrs}
                            fallbackType={resource.fallbackType} />}
                        iconTone={resource.iconTone}
                        interactive={resource.nodes.length > 0}
                        resources={connectedResourcePopoverItems(resource.nodes, { anchorNodeID: this.props.node.id, nodeAttrs: this.props.nodeAttrs })}
                        resourcesTitle={resource.label}
                        onClick={() => this.focusNodeIDs(resource.nodes.map(node => node.id))}
                    />
                ))}
            </DetailResourceGrid>
        )
    }

    render() {
        const parentSwitch = this.parentSwitch()
        const peers = this.connectedPeers(parentSwitch)
        const connectedHosts = this.connectedHosts(peers)
        const interfaces = this.connectedInterfaces(peers)
        const portRows = this.portRows()
        const connectionRows = this.connectionRows(interfaces)
        return (
            <div className="netdive-switch-port-detail">
                <DetailSection icon={<InfoCircleOutlined />} title={translate('switchBasicInfo')}>
                    <DetailKeyValueList rows={this.basicRows(parentSwitch)} copyTooltip={translate('copy')} />
                </DetailSection>
                {portRows.length > 0 && <DetailSection icon={<ApartmentOutlined />} title={translate('switchPortDetails')}>
                    <DetailKeyValueList rows={portRows} copyTooltip={translate('copy')} />
                </DetailSection>}
                {connectionRows.length > 0 && <DetailSection icon={<LinkOutlined />} title={translate('switchPortConnectionInfo')}>
                    {this.renderConnectionInfo(interfaces)}
                </DetailSection>}
                <DetailSection icon={<ApiOutlined />} title={translate('hostConnectedResources')}>
                    {this.renderConnectedResources(parentSwitch, connectedHosts, interfaces)}
                </DetailSection>
            </div>
        )
    }
}

export default SwitchPortDetailPanel
