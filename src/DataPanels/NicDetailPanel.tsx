import * as React from 'react'
import { Table } from 'antd'
import {
    ApartmentOutlined,
    BarChartOutlined,
    DesktopOutlined,
    InfoCircleOutlined,
    LineChartOutlined,
    LinkOutlined,
    SettingOutlined,
    ThunderboltOutlined
} from '@ant-design/icons'

import { translate } from '../Config'
import Tools from '../Tools'
import { switchDisplayName, switchLLDPData, switchTextValue } from '../SwitchNodeUtils'
import { Link, Node } from '../Topology'
import { DetailBadge, DetailEmpty, DetailKeyValueList, DetailResourceCard, DetailResourceGrid, DetailSection } from './common'
import './NicDetailPanel.css'

interface Props {
    node: Node
}

interface State {
    collapsed: Record<string, boolean>
}

interface DataRow {
    key: string
    [name: string]: any
}

const isBlank = (value: any): boolean => {
    if (value === undefined || value === null) return true
    if (typeof value === 'string') return value.trim() === '' || value.trim() === '-'
    if (Array.isArray(value)) return value.length === 0
    return false
}

const textValue = (value: any): string => {
    if (isBlank(value)) return ''
    if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(', ')
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch (_) {
            return String(value)
        }
    }
    return String(value)
}

const valueAtPath = (data: any, path: string): any => path.split('.').reduce((value, key) => value?.[key], data)

const firstRawValue = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const value = valueAtPath(data, path)
        if (!isBlank(value)) return value
    }
    return undefined
}

const firstTextValue = (data: any, paths: string[]): string => textValue(firstRawValue(data, paths))

class NicDetailPanel extends React.Component<Props, State> {
    state: State = {
        collapsed: {
            recent: true,
            accumulated: true,
            advanced: true
        }
    }

    private data(): any {
        return this.props.node.data || {}
    }

    private toggleSection(key: string) {
        this.setState({ collapsed: { ...this.state.collapsed, [key]: !this.state.collapsed[key] } })
    }

    private collapsibleSection(key: string, icon: React.ReactNode, title: React.ReactNode, children: React.ReactNode) {
        return (
            <DetailSection
                icon={icon}
                title={title}
                collapsible
                collapsed={!!this.state.collapsed[key]}
                onToggle={() => this.toggleSection(key)}>
                {children}
            </DetailSection>
        )
    }

    private stateBadge(value: string): React.ReactNode {
        const normalized = value.toLowerCase()
        const tone = ['up', 'running', 'true', 'on', 'yes', 'enabled', '1'].includes(normalized)
            ? 'success'
            : ['down', 'failed', 'false', 'off', 'no', 'disabled', '0'].includes(normalized)
            ? 'danger'
            : 'default'
        return <DetailBadge tone={tone}>{value}</DetailBadge>
    }

    private basicRows() {
        const data = this.data()
        const name = firstTextValue(data, ['Name', 'name']) || this.props.node.id
        const state = firstTextValue(data, ['State', 'state'])
        const mac = firstTextValue(data, ['MAC', 'Mac', 'HardwareAddr'])
        const rows = [
            { key: 'name', label: translate('Name'), value: name, textValue: name, copyText: name },
            { key: 'state', label: translate('State'), value: state ? this.stateBadge(state) : '', textValue: state },
            { key: 'driver', label: translate('Driver'), value: firstTextValue(data, ['Driver', 'driver']), textValue: firstTextValue(data, ['Driver', 'driver']) },
            { key: 'mac', label: translate('MAC'), value: mac, textValue: mac, copyText: mac || undefined },
            { key: 'ipv4', label: translate('ipv4'), value: firstTextValue(data, ['IPV4', 'IPv4', 'ipv4']), textValue: firstTextValue(data, ['IPV4', 'IPv4', 'ipv4']) },
            { key: 'ipv6', label: translate('ipv6'), value: firstTextValue(data, ['IPV6', 'IPv6', 'ipv6']), textValue: firstTextValue(data, ['IPV6', 'IPv6', 'ipv6']) },
            { key: 'mtu', label: translate('MTU'), value: firstTextValue(data, ['MTU', 'Mtu', 'mtu']), textValue: firstTextValue(data, ['MTU', 'Mtu', 'mtu']) },
            { key: 'ifIndex', label: translate('IfIndex'), value: firstTextValue(data, ['IfIndex', 'ifIndex']), textValue: firstTextValue(data, ['IfIndex', 'ifIndex']) },
            { key: 'busInfo', label: translate('BusInfo'), value: firstTextValue(data, ['BusInfo', 'busInfo']), textValue: firstTextValue(data, ['BusInfo', 'busInfo']) },
            { key: 'encapType', label: translate('EncapType'), value: firstTextValue(data, ['EncapType', 'EncapsulationType']), textValue: firstTextValue(data, ['EncapType', 'EncapsulationType']) }
        ]
        return rows.filter(row => !isBlank(row.textValue))
    }

    private topologyLinks(): Link[] {
        const links = (window as any).App?.tc?.links
        return links && typeof links.values === 'function' ? Array.from(links.values()) as Link[] : []
    }

    private hostAncestor(node: Node = this.props.node): Node | undefined {
        let current: Node | null | undefined = node.parent
        while (current) {
            if (String(current.data?.Type || current.data?.type || '').toLowerCase() === 'host') return current
            current = current.parent
        }
        return undefined
    }

    private connectedPeers(): Node[] {
        const peers = new Map<string, Node>()
        this.topologyLinks().forEach(link => {
            const relationType = String(link.data?.RelationType || '').toLowerCase()
            if (relationType === 'ownership' || relationType === 'vownership') return
            const peer = link.source.id === this.props.node.id
                ? link.target
                : link.target.id === this.props.node.id
                ? link.source
                : undefined
            if (peer) peers.set(peer.id, peer)
        })
        return Array.from(peers.values())
    }

    private focusNodeIDs(nodeIDs: string[]) {
        const app = (window as any).App
        if (app && typeof app.focusInfrastructureNodeIDs === 'function' && nodeIDs.length > 0) {
            app.focusInfrastructureNodeIDs(nodeIDs, this.props.node.id)
        }
    }

    private renderConnectedResources(peers: Node[]) {
        const host = this.hostAncestor()
        const resources = [
            { label: translate('infrastructureHosts'), nodes: host ? [host] : [], icon: <DesktopOutlined />, iconTone: 'host' as const },
            { label: translate('nicConnectedNodes'), nodes: peers, icon: <LinkOutlined />, iconTone: 'network' as const }
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
                        onClick={() => this.focusNodeIDs(resource.nodes.map(node => node.id))} />
                ))}
            </DetailResourceGrid>
        )
    }

    private formatSpeed(value: any): string {
        if (isBlank(value)) return ''
        const numeric = Number(value)
        return Number.isNaN(numeric) ? textValue(value) : `${numeric.toLocaleString()} Mbps`
    }

    private linkRows() {
        const data = this.data()
        const state = firstTextValue(data, ['State', 'state', 'OperState'])
        const duplex = firstTextValue(data, ['Duplex', 'duplex', 'LinkDuplex'])
        const autoNegotiation = firstTextValue(data, ['AutoNegotiation', 'Autoneg', 'AutoNeg', 'autoneg'])
        const carrier = firstTextValue(data, ['Carrier', 'carrier', 'LinkDetected'])
        const rows = [
            { key: 'state', label: translate('State'), value: state ? this.stateBadge(state) : '', textValue: state },
            { key: 'speed', label: translate('Speed'), value: this.formatSpeed(firstRawValue(data, ['Speed', 'speed'])), textValue: this.formatSpeed(firstRawValue(data, ['Speed', 'speed'])) },
            { key: 'duplex', label: translate('nicDuplex'), value: duplex, textValue: duplex },
            { key: 'autoNegotiation', label: translate('nicAutoNegotiation'), value: autoNegotiation ? this.stateBadge(autoNegotiation) : '', textValue: autoNegotiation },
            { key: 'carrier', label: translate('nicCarrier'), value: carrier ? this.stateBadge(carrier) : '', textValue: carrier },
            { key: 'flags', label: translate('LinkFlags'), value: firstTextValue(data, ['LinkFlags']), textValue: firstTextValue(data, ['LinkFlags']) }
        ]
        return rows.filter(row => !isBlank(row.textValue))
    }

    private isSwitchPort(node: Node): boolean {
        const type = String(node.data?.Type || node.data?.type || '').toLowerCase()
        return type === 'switchport'
    }

    private switchAncestor(node?: Node): Node | undefined {
        let current = node
        while (current) {
            if (String(current.data?.Type || current.data?.type || '').toLowerCase() === 'switch') return current
            current = current.parent || undefined
        }
        return undefined
    }

    private lldpRows(peers: Node[]) {
        const data = this.data()
        const lldp = switchLLDPData(data)
        const switchPort = peers.find(peer => this.isSwitchPort(peer))
        const parentSwitch = this.switchAncestor(switchPort)
        const switchName = parentSwitch
            ? switchDisplayName(parentSwitch.data, parentSwitch.id)
            : switchTextValue(lldp, ['RemoteSysName', 'RemoteSystemName', 'SysName', 'SystemName'])
        const portName = switchPort
            ? switchTextValue(switchPort.data || {}, ['Name', 'PortID', 'PortId']) || switchPort.id
            : switchTextValue(lldp, ['RemotePortID', 'RemotePortId', 'PortID', 'PortId'])
        return [
            { key: 'switch', label: translate('phy-switch'), value: switchName, textValue: switchName },
            { key: 'port', label: translate('phy-switch-ports'), value: portName, textValue: portName }
        ].filter(row => !isBlank(row.textValue))
    }

    private formatDate(value: any): string {
        if (isBlank(value)) return ''
        const numeric = Number(value)
        const timestamp = !Number.isNaN(numeric) && String(Math.trunc(numeric)).length <= 10 ? numeric * 1000 : value
        const date = new Date(timestamp)
        return Number.isNaN(date.getTime()) ? textValue(value) : date.toLocaleString()
    }

    private metricRows(metric: any, recent: boolean) {
        if (!metric || typeof metric !== 'object') return []
        const specs: Array<{ key: string, label: string, format: (value: any) => string }> = [
            { key: 'RxPackets', label: translate('RxPackets'), format: value => Number(value).toLocaleString() },
            { key: 'RxBytes', label: translate('RxBytes'), format: value => Tools.prettyBytes(Number(value)) },
            { key: 'TxPackets', label: translate('TxPackets'), format: value => Number(value).toLocaleString() },
            { key: 'TxBytes', label: translate('TxBytes'), format: value => Tools.prettyBytes(Number(value)) }
        ]
        if (recent) specs.push({ key: 'Start', label: translate('Start'), format: value => this.formatDate(value) })
        specs.push({ key: 'Last', label: translate('Last'), format: value => this.formatDate(value) })
        return specs
            .filter(spec => metric[spec.key] !== undefined && metric[spec.key] !== null)
            .map(spec => {
                const value = spec.format(metric[spec.key])
                return { key: spec.key, label: spec.label, value, textValue: value }
            })
    }

    private renderMetric(metric: any, recent: boolean) {
        const rows = this.metricRows(metric, recent)
        return rows.length ? <DetailKeyValueList rows={rows} /> : <DetailEmpty description={translate('nicNoData')} compact />
    }

    private normalizeRows(value: any): DataRow[] {
        if (Array.isArray(value)) {
            return value.map((item, index) => typeof item === 'object' && item !== null
                ? { key: `row-${index}`, ...item }
                : { key: `row-${index}`, Value: item })
        }
        if (!value || typeof value !== 'object') return []
        return Object.keys(value).map((key, index) => ({ key: `row-${index}`, Key: key, Value: value[key] }))
    }

    private tableColumns(rows: DataRow[], preferred: string[] = []) {
        const keys: string[] = []
        const add = (key: string) => {
            if (key !== 'key' && !keys.includes(key) && rows.some(row => row[key] !== undefined)) keys.push(key)
        }
        preferred.forEach(add)
        rows.forEach(row => Object.keys(row).forEach(add))
        return keys.map(key => ({ title: translate(key), dataIndex: key, key, render: (value: any) => textValue(value) }))
    }

    private renderTable(value: any, preferred: string[] = []) {
        const rows = this.normalizeRows(value)
        if (!rows.length) return <DetailEmpty description={translate('nicNoData')} compact />
        return (
            <div className="netdive-nic-detail__table-scroll">
                <Table className="netdive-nic-detail__table" columns={this.tableColumns(rows, preferred)} dataSource={rows} pagination={false} size="small" tableLayout="fixed" />
            </div>
        )
    }

    private routingRows(): DataRow[] {
        const tables = this.data().RoutingTables
        if (!Array.isArray(tables)) return this.normalizeRows(tables)
        const rows: DataRow[] = []
        tables.forEach((table, tableIndex) => {
            const routes = Array.isArray(table?.Routes) ? table.Routes : []
            routes.forEach((route, routeIndex) => {
                const nextHops = Array.isArray(route?.NextHops) && route.NextHops.length ? route.NextHops : [{}]
                nextHops.forEach((nextHop, hopIndex) => rows.push({
                    key: `route-${tableIndex}-${routeIndex}-${hopIndex}`,
                    ID: table?.ID,
                    Src: table?.Src,
                    Protocol: route?.Protocol,
                    Prefix: route?.Prefix,
                    Priority: nextHop?.Priority,
                    IP: nextHop?.IP,
                    IfIndex: nextHop?.IfIndex
                }))
            })
        })
        return rows
    }

    private renderAdvancedBlock(title: React.ReactNode, content: React.ReactNode) {
        return (
            <div className="netdive-nic-detail__advanced-block">
                <div className="netdive-nic-detail__advanced-title">{title}</div>
                {content}
            </div>
        )
    }

    private netlinkData(): Record<string, any> {
        const data = this.data()
        const netlink: Record<string, any> = {}
        ;['MasterIndex', 'ParentIndex', 'PeerIfIndex', 'BondSlave', 'VFS'].forEach(key => {
            if (!isBlank(data[key])) netlink[key] = data[key]
        })
        if (data.Netlink && typeof data.Netlink === 'object') Object.assign(netlink, data.Netlink)
        return netlink
    }

    private renderAdvanced() {
        const data = this.data()
        const netlink = this.netlinkData()
        const blocks: React.ReactNode[] = []
        if (data.Features !== undefined) blocks.push(this.renderAdvancedBlock(translate('features'), this.renderTable(data.Features)))
        if (data.FDB !== undefined) blocks.push(this.renderAdvancedBlock(translate('fdb'), this.renderTable(data.FDB, ['MAC', 'IfIndex', 'State', 'Flags'])))
        if (data.Neighbors !== undefined) blocks.push(this.renderAdvancedBlock(translate('neighbors'), this.renderTable(data.Neighbors, ['IP', 'MAC', 'State', 'IfIndex'])))
        if (data.RoutingTables !== undefined) blocks.push(this.renderAdvancedBlock(translate('routingTables'), this.renderTable(this.routingRows(), ['ID', 'Src', 'Protocol', 'Prefix', 'Priority', 'IP', 'IfIndex'])))
        if (Object.keys(netlink).length > 0) blocks.push(this.renderAdvancedBlock(translate('nicNetlinkInfo'), this.renderTable(netlink)))
        return blocks.length ? <div className="netdive-nic-detail__advanced">{blocks}</div> : <DetailEmpty description={translate('nicNoData')} compact />
    }

    render() {
        const data = this.data()
        const peers = this.connectedPeers()
        const lldpRows = this.lldpRows(peers)
        const hasAdvanced = ['Features', 'FDB', 'Neighbors', 'RoutingTables'].some(key => data[key] !== undefined && data[key] !== null) || Object.keys(this.netlinkData()).length > 0
        return (
            <div className="netdive-nic-detail">
                <DetailSection icon={<InfoCircleOutlined />} title={translate('hostBasicInfo')}>
                    <DetailKeyValueList rows={this.basicRows()} copyTooltip={translate('copy')} />
                </DetailSection>
                <DetailSection icon={<LinkOutlined />} title={translate('hostConnectedResources')}>
                    {this.renderConnectedResources(peers)}
                </DetailSection>
                {this.linkRows().length > 0 && (
                    <DetailSection icon={<ThunderboltOutlined />} title={translate('nicLinkStatus')}>
                        <DetailKeyValueList rows={this.linkRows()} />
                    </DetailSection>
                )}
                {lldpRows.length > 0 && (
                    <DetailSection icon={<ApartmentOutlined />} title={translate('nicLldpNeighbor')}>
                        <DetailKeyValueList rows={lldpRows} />
                    </DetailSection>
                )}
                {data.LastUpdateMetric !== undefined && this.collapsibleSection('recent', <LineChartOutlined />, translate('lastUpdateMetric'), this.renderMetric(data.LastUpdateMetric, true))}
                {data.Metric !== undefined && this.collapsibleSection('accumulated', <BarChartOutlined />, translate('metric'), this.renderMetric(data.Metric, false))}
                {hasAdvanced && this.collapsibleSection('advanced', <SettingOutlined />, translate('detailAdvancedInfo'), this.renderAdvanced())}
            </div>
        )
    }
}

export default NicDetailPanel
