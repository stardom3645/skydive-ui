import * as React from 'react'
import { ApartmentOutlined, ApiOutlined, InfoCircleOutlined, LinkOutlined } from '@ant-design/icons'

import { Link, Node } from '../Topology'
import { translate } from '../Config'
import { switchDisplayName, switchTextValue } from '../SwitchNodeUtils'
import { DetailKeyValueList, DetailResourceCard, DetailResourceGrid, DetailSection } from './common'
import './SwitchPortDetailPanel.css'

interface Props {
    node: Node
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

    private text(data: any, keys: string[]): string {
        return switchTextValue(data, keys)
    }

    private basicRows(parentSwitch?: Node) {
        const data = this.data()
        const name = this.text(data, ['Name', 'name', 'IfName', 'InterfaceName']) || this.props.node.id
        const parentName = parentSwitch ? switchDisplayName(parentSwitch.data, parentSwitch.id) : ''
        const type = this.text(data, ['Type', 'type']) || 'switchport'
        const mac = this.text(data, ['MAC', 'Mac', 'MacAddress', 'HardwareAddr'])
        const state = this.text(data, ['State', 'state', 'Status', 'status'])
        const mtu = this.text(data, ['MTU', 'Mtu', 'mtu'])
        const probe = this.text(data, ['Probe', 'probe'])

        return [
            { key: 'name', label: translate('Name'), value: name, textValue: name, copyText: name },
            { key: 'switch', label: translate('phy-switch'), value: parentName, textValue: parentName },
            { key: 'type', label: translate('Type'), value: type, textValue: type },
            { key: 'mac', label: translate('MAC'), value: mac, textValue: mac, copyText: mac || undefined },
            { key: 'state', label: translate('State'), value: state, textValue: state },
            { key: 'mtu', label: translate('MTU'), value: mtu, textValue: mtu },
            { key: 'probe', label: translate('switchProbe'), value: probe, textValue: probe }
        ].filter(row => row.textValue !== '' && row.textValue !== '-')
    }

    private focusNodeIDs(nodeIDs: string[]) {
        const app = (window as any).App
        if (app && typeof app.focusInfrastructureNodeIDs === 'function' && nodeIDs.length > 0) {
            app.focusInfrastructureNodeIDs(nodeIDs, this.props.node.id)
        }
    }

    private renderConnectedResources(parentSwitch?: Node) {
        const peers = this.connectedPeers(parentSwitch)
        const resources = [
            { label: translate('phy-switch'), nodes: parentSwitch ? [parentSwitch] : [], icon: <ApartmentOutlined />, iconTone: 'switch' as const },
            { label: translate('switchPortConnectedNodes'), nodes: peers, icon: <LinkOutlined />, iconTone: 'network' as const }
        ]

        return (
            <DetailResourceGrid>
                {resources.map(resource => (
                    <DetailResourceCard
                        key={String(resource.label)}
                        label={resource.label}
                        value={String(resource.nodes.length)}
                        icon={resource.icon}
                        iconTone={resource.iconTone}
                        interactive={resource.nodes.length > 0}
                        onClick={() => this.focusNodeIDs(resource.nodes.map(node => node.id))}
                    />
                ))}
            </DetailResourceGrid>
        )
    }

    render() {
        const parentSwitch = this.parentSwitch()
        return (
            <div className="netdive-switch-port-detail">
                <DetailSection icon={<InfoCircleOutlined />} title={translate('switchBasicInfo')}>
                    <DetailKeyValueList rows={this.basicRows(parentSwitch)} copyTooltip={translate('copy')} />
                </DetailSection>
                <DetailSection icon={<ApiOutlined />} title={translate('hostConnectedResources')}>
                    {this.renderConnectedResources(parentSwitch)}
                </DetailSection>
            </div>
        )
    }
}

export default SwitchPortDetailPanel
