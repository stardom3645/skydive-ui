import * as React from 'react'
import { Button, Tooltip } from 'antd'
import { ApartmentOutlined, ArrowsAltOutlined, InfoCircleOutlined, LinkOutlined, PartitionOutlined } from '@ant-design/icons'

import { Link, Node, NodeAttrs } from '../Topology'
import { session } from '../Store'
import { translate } from '../Config'
import {
    switchDisplayName,
    switchLLDPData,
    switchManagementAddress,
    switchTextValue
} from '../SwitchNodeUtils'
import { buildInfrastructurePortMappings, InfrastructurePortMapping, ManualPortMappingRecord } from '../InfrastructurePortMapping'
import { listManualPortMappings } from '../ManualPortMappingAPI'
import { connectedResourcePopoverItems, DetailEmpty, DetailKeyValueList, DetailResourceCard, DetailResourceGrid, DetailSection, InfrastructurePortMappingTable, InfrastructureTopologyIcon, ManualPortMappingManager, navigateInfrastructureConnectedResources } from './common'
import './SwitchDetailPanel.css'

interface Props {
    node: Node
    nodeAttrs: (node: Node) => NodeAttrs
    session?: session
}

interface State {
    manualMappings: ManualPortMappingRecord[]
	allManualMappings: ManualPortMappingRecord[]
    portMappingExpanded: boolean
}

class SwitchDetailPanel extends React.Component<Props> {
    state: State = { manualMappings: [], allManualMappings: [], portMappingExpanded: false }

    componentDidMount() {
        this.loadManualMappings()
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id) {
            this.setState({ manualMappings: [], allManualMappings: [], portMappingExpanded: false }, this.loadManualMappings)
        }
    }

    private loadManualMappings = async () => {
        const switchNodeID = this.props.node.id
        try {
            const allManualMappings = await listManualPortMappings(this.props.session)
            const manualMappings = allManualMappings.filter(mapping => mapping.switchNodeId === switchNodeID)
            if (this.props.node.id === switchNodeID) this.setState({ manualMappings, allManualMappings })
        } catch (error) {
            console.warn('[ManualPortMapping] failed to load switch mappings', error)
            if (this.props.node.id === switchNodeID) this.setState({ manualMappings: [], allManualMappings: [] })
        }
    }

    private manualMappingsChanged = async () => {
        await this.loadManualMappings()
        await (window as any).App?.refreshManualPortMappingLinks?.()
    }

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

    private portMappings(): InfrastructurePortMapping[] {
        const automaticallyConnectedNICs = new Set(this.allAutomaticPortMappings()
            .map(mapping => mapping.hostNicNodeID)
            .filter((nodeID): nodeID is string => !!nodeID))
        const supplementalMappings = this.state.manualMappings
            .filter(mapping => !automaticallyConnectedNICs.has(mapping.hostNicNodeId))
        return buildInfrastructurePortMappings(this.props.node, this.topologyNodes(), this.topologyLinks(), supplementalMappings)
    }

    private allAutomaticPortMappings(): InfrastructurePortMapping[] {
        const nodes = this.topologyNodes()
        const links = this.topologyLinks()
        return nodes
            .filter(node => String(node.data?.Type || node.data?.type || '').toLowerCase() === 'switch')
            .reduce<InfrastructurePortMapping[]>((mappings, switchNode) =>
                mappings.concat(buildInfrastructurePortMappings(switchNode, nodes, links)), [])
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
        navigateInfrastructureConnectedResources(nodeIDs, this.props.node.id, 'summary')
    }

    private focusPortMapping(mapping: InfrastructurePortMapping) {
        const targetNodeID = mapping.switchPortNodeID || mapping.hostNicNodeID || mapping.hostNodeID
        if (!targetNodeID) return
        navigateInfrastructureConnectedResources([targetNodeID], this.props.node.id, 'item')
    }

    private renderConnectedResources() {
        const ports = this.switchPorts()
        const hosts = this.connectedHosts(ports)
        const resources = [
            { label: translate('infrastructureHosts'), nodes: hosts, fallbackType: 'host', iconTone: 'host' as const },
            { label: translate('phy-switch-ports'), nodes: ports, fallbackType: 'switchport', iconTone: 'interface' as const }
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
        return (
            <div className="netdive-switch-detail">
                <DetailSection icon={<InfoCircleOutlined />} title={translate('switchBasicInfo')}>
                    <DetailKeyValueList rows={this.basicRows()} copyTooltip={translate('copy')} />
                </DetailSection>
                <DetailSection
                    className="netdive-switch-port-mapping-section"
                    icon={<PartitionOutlined />}
                    title={translate('switchPortMapping')}
                    description={translate('switchPortMappingDescription')}
                    fullWidthDescription
                    action={<div className="netdive-switch-port-mapping-section__actions netdive-port-mapping-header-actions">
                        <ManualPortMappingManager
                            switchNode={this.props.node}
                            nodes={this.topologyNodes()}
                            automaticMappings={this.allAutomaticPortMappings()}
                            mappings={this.state.manualMappings}
                            allMappings={this.state.allManualMappings}
                            session={this.props.session}
                            onChanged={this.manualMappingsChanged} />
                        <Tooltip title={translate('switchPortMappingExpandView')}>
                            <Button
                                className="netdive-port-mapping-expand-trigger"
                                icon={<ArrowsAltOutlined />}
                                disabled={this.portMappings().length === 0}
                                onClick={() => this.setState({ portMappingExpanded: true })}>
                                {translate('switchPortMappingExpandView')}
                            </Button>
                        </Tooltip>
                    </div>}>
                    <InfrastructurePortMappingTable
                        mappings={this.portMappings()}
                        expandable
                        expanded={this.state.portMappingExpanded}
                        onExpandedChange={portMappingExpanded => this.setState({ portMappingExpanded })}
                        onNavigate={mapping => this.focusPortMapping(mapping)} />
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
