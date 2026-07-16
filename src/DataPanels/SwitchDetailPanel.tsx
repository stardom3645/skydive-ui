import * as React from 'react'
import { ApiOutlined, ApartmentOutlined, DesktopOutlined, InfoCircleOutlined, LinkOutlined } from '@ant-design/icons'

import { Link, Node } from '../Topology'
import { translate } from '../Config'
import {
    switchDisplayName,
    switchLLDPData,
    switchManagementAddress,
    switchTextValue
} from '../SwitchNodeUtils'
import { DetailEmpty, DetailKeyValueList, DetailResourceCard, DetailResourceGrid, DetailSection } from './common'
import './SwitchDetailPanel.css'

interface Props {
    node: Node
}

class SwitchDetailPanel extends React.Component<Props> {
    private data(): any {
        return this.props.node.data || {}
    }

    private lldp(): Record<string, any> {
        return switchLLDPData(this.data())
    }

    private basicRows() {
        const data = this.data()
        const lldp = this.lldp()
        const name = switchDisplayName(data, this.props.node.id)
        const managementAddress = switchManagementAddress(data)
        const type = switchTextValue(data, ['Type', 'type']) || 'switch'
        const probe = switchTextValue(data, ['Probe', 'probe'])

        return [
            { key: 'name', label: translate('switchName'), value: name, textValue: name, copyText: name },
            { key: 'managementAddress', label: translate('switchManagementIp'), value: managementAddress || '-', textValue: managementAddress || '-', copyText: managementAddress || undefined },
            { key: 'type', label: translate('switchType'), value: type, textValue: type },
            { key: 'probe', label: translate('switchProbe'), value: probe || '-', textValue: probe || '-' }
        ]
    }

    private lldpRows() {
        const lldp = this.lldp()
        const chassisID = switchTextValue(lldp, ['ChassisID', 'ChassisId', 'Chassis'])
        const chassisIDType = switchTextValue(lldp, ['ChassisIDType', 'ChassisIdType'])
        const description = switchTextValue(lldp, ['Description', 'SystemDescription', 'SysDescription'])
        const managementAddress = switchTextValue(lldp, ['MgmtAddress', 'ManagementAddress', 'MgmtAddr', 'Address'])
        return [
            { key: 'chassisID', label: translate('switchChassisId'), value: chassisID || '-', textValue: chassisID || '-', copyText: chassisID || undefined },
            { key: 'chassisIDType', label: translate('switchChassisIdType'), value: chassisIDType || '-', textValue: chassisIDType || '-' },
            { key: 'description', label: translate('switchSystemDescription'), value: description || '-', textValue: description || '-' },
            { key: 'managementAddress', label: translate('switchManagementAddress'), value: managementAddress || '-', textValue: managementAddress || '-', copyText: managementAddress || undefined }
        ]
    }

    private topologyNodes(): Node[] {
        const nodes = (window as any).App?.tc?.nodes
        return nodes && typeof nodes.values === 'function' ? Array.from(nodes.values()) as Node[] : []
    }

    private topologyLinks(): Link[] {
        const links = (window as any).App?.tc?.links
        return links && typeof links.values === 'function' ? Array.from(links.values()) as Link[] : []
    }

    private isSwitchPort(node: Node): boolean {
        const type = String(node.data?.Type || node.data?.type || '').toLowerCase()
        return type === 'switchport' || type === 'port'
    }

    private belongsToSwitch(node: Node): boolean {
        let parent = node.parent
        while (parent) {
            if (parent.id === this.props.node.id) return true
            parent = parent.parent
        }
        return false
    }

    private switchPorts(): Node[] {
        return this.topologyNodes().filter(node => this.isSwitchPort(node) && this.belongsToSwitch(node))
    }

    private hostAncestor(node?: Node): Node | undefined {
        let current = node
        while (current) {
            if (String(current.data?.Type || current.data?.type || '').toLowerCase() === 'host') {
                return current
            }
            current = current.parent || undefined
        }
        return undefined
    }

    private connectedHosts(ports: Node[]): Node[] {
        const switchSideIDs = new Set<string>([this.props.node.id, ...ports.map(port => port.id)])
        const hosts = new Map<string, Node>()
        this.topologyLinks().forEach(link => {
            let peer: Node | undefined
            if (switchSideIDs.has(link.source.id)) peer = link.target
            if (switchSideIDs.has(link.target.id)) peer = link.source
            const host = this.hostAncestor(peer)
            if (host) hosts.set(host.id, host)
        })
        return Array.from(hosts.values())
    }

    private focusNodeIDs(nodeIDs: string[]) {
        const app = (window as any).App
        if (app && typeof app.focusInfrastructureNodeIDs === 'function' && nodeIDs.length > 0) {
            app.focusInfrastructureNodeIDs(nodeIDs, this.props.node.id)
        }
    }

    private renderConnectedResources() {
        const ports = this.switchPorts()
        const hosts = this.connectedHosts(ports)
        const resources = [
            { label: translate('infrastructureHosts'), nodes: hosts, icon: <DesktopOutlined />, iconTone: 'host' as const },
            { label: translate('phy-switch-ports'), nodes: ports, icon: <ApiOutlined />, iconTone: 'interface' as const }
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
        return (
            <div className="netdive-switch-detail">
                <DetailSection icon={<InfoCircleOutlined />} title={translate('switchBasicInfo')}>
                    <DetailKeyValueList rows={this.basicRows()} copyTooltip={translate('copy')} />
                </DetailSection>
                <DetailSection icon={<LinkOutlined />} title={translate('hostConnectedResources')}>
                    {this.renderConnectedResources()}
                </DetailSection>
                <DetailSection icon={<ApartmentOutlined />} title={translate('switchLldpInfo')}>
                    {Object.keys(this.lldp()).length > 0
                        ? <DetailKeyValueList rows={this.lldpRows()} copyTooltip={translate('copy')} />
                        : <DetailEmpty description={translate('switchNoLldp')} compact />}
                </DetailSection>
            </div>
        )
    }
}

export default SwitchDetailPanel
