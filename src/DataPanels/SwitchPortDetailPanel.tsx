import * as React from 'react'
import { ApiOutlined, InfoCircleOutlined } from '@ant-design/icons'

import { Link, Node, NodeAttrs } from '../Topology'
import { translate } from '../Config'
import { switchDisplayName, switchTextValue } from '../SwitchNodeUtils'
import { connectedResourcePopoverItems, DetailKeyValueList, DetailResourceCard, DetailResourceGrid, DetailSection, InfrastructureTopologyIcon, navigateInfrastructureConnectedResources } from './common'
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

    private basicRows(parentSwitch: Node | undefined, connectedHosts: Node[]) {
        const data = this.data()
        const name = this.text(data, ['Name', 'name', 'IfName', 'InterfaceName']) || this.props.node.id
        const parentName = parentSwitch ? switchDisplayName(parentSwitch.data, parentSwitch.id) : ''
        const connectedHostNames = connectedHosts.map(host => (
            this.text(host.data || {}, ['Name', 'name', 'Hostname', 'HostName']) || host.id
        ))
        const connectedHostSummary = connectedHostNames.join(', ')
        const type = this.text(data, ['Type', 'type']) || 'switchport'
        const mac = this.text(data, ['MAC', 'Mac', 'MacAddress', 'HardwareAddr'])
        const state = this.text(data, ['State', 'state', 'Status', 'status'])
        const mtu = this.text(data, ['MTU', 'Mtu', 'mtu'])
        const probe = this.text(data, ['Probe', 'probe'])

        return [
            { key: 'name', label: translate('Name'), value: name, textValue: name, copyText: name },
            { key: 'switch', label: translate('phy-switch'), value: parentName, textValue: parentName },
            { key: 'connected-host', label: translate('switchPortMappingHost'), value: connectedHostSummary, textValue: connectedHostSummary, copyText: connectedHostSummary || undefined },
            { key: 'type', label: translate('Type'), value: type, textValue: type },
            { key: 'mac', label: translate('MAC'), value: mac, textValue: mac, copyText: mac || undefined },
            { key: 'state', label: translate('State'), value: state, textValue: state },
            { key: 'mtu', label: translate('MTU'), value: mtu, textValue: mtu },
            { key: 'probe', label: translate('switchProbe'), value: probe, textValue: probe }
        ].filter(row => row.textValue !== '' && row.textValue !== '-')
    }

    private focusNodeIDs(nodeIDs: string[]) {
        navigateInfrastructureConnectedResources(nodeIDs, this.props.node.id, 'summary')
    }

    private renderConnectedResources(parentSwitch: Node | undefined, peers: Node[]) {
        const resources = [
            { label: translate('phy-switch'), nodes: parentSwitch ? [parentSwitch] : [], fallbackType: 'switch', iconTone: 'switch' as const },
            { label: translate('switchPortConnectedNodes'), nodes: peers, fallbackType: 'device', iconTone: 'interface' as const }
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
        return (
            <div className="netdive-switch-port-detail">
                <DetailSection icon={<InfoCircleOutlined />} title={translate('switchBasicInfo')}>
                    <DetailKeyValueList rows={this.basicRows(parentSwitch, connectedHosts)} copyTooltip={translate('copy')} />
                </DetailSection>
                <DetailSection icon={<ApiOutlined />} title={translate('hostConnectedResources')}>
                    {this.renderConnectedResources(parentSwitch, peers)}
                </DetailSection>
            </div>
        )
    }
}

export default SwitchPortDetailPanel
