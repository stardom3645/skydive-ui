import * as React from 'react'
import { Table } from 'antd'
import {
    ApartmentOutlined,
    BarChartOutlined,
    DesktopOutlined,
    GlobalOutlined,
    InfoCircleOutlined,
    LineChartOutlined,
    LinkOutlined,
    SettingOutlined
} from '@ant-design/icons'

import { translate } from '../Config'
import Tools from '../Tools'
import { Link, Node } from '../Topology'
import { connectedResourcePopoverItems, DetailBadge, DetailEmpty, DetailKeyValueList, DetailResourceCard, DetailResourceGrid, DetailSection, InfrastructureConnectedResourceNavigationMode, navigateInfrastructureConnectedResources } from './common'
import './HostBridgeDetailPanel.css'

interface Props {
    node: Node
    nodeDisplayName?: (node: Node) => string
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
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        return normalized === '' || normalized === '-' || normalized === 'n/a'
    }
    if (Array.isArray(value)) return value.length === 0
    return false
}

const hasContent = (value: any): boolean => {
    if (isBlank(value)) return false
    if (typeof value === 'object') return Object.keys(value).length > 0
    return true
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

const firstRawValue = (data: any, keys: string[]): any => {
    for (const key of keys) {
        const value = data?.[key]
        if (!isBlank(value)) return value
    }
    return undefined
}

const firstTextValue = (data: any, keys: string[]): string => textValue(firstRawValue(data, keys))

class HostBridgeDetailPanel extends React.Component<Props, State> {
    state: State = {
        collapsed: {
            configuration: false,
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

    private section(key: string, icon: React.ReactNode, title: React.ReactNode, children: React.ReactNode) {
        return (
            <DetailSection icon={icon} title={title} collapsible collapsed={!!this.state.collapsed[key]} onToggle={() => this.toggleSection(key)}>
                {children}
            </DetailSection>
        )
    }

    private stateBadge(value: string): React.ReactNode {
        const normalized = value.toLowerCase()
        const tone = ['up', 'running'].includes(normalized)
            ? 'success'
            : ['down', 'failed'].includes(normalized)
            ? 'danger'
            : 'default'
        return <DetailBadge tone={tone}>{value}</DetailBadge>
    }

    private stateValue(data: any): string {
        const state = firstTextValue(data, ['State', 'state', 'OperState'])
        if (state && !['unknown', 'n/a', '-'].includes(state.trim().toLowerCase())) return state

        const linkFlags = firstRawValue(data, ['LinkFlags'])
        const flags = Array.isArray(linkFlags)
            ? linkFlags.map(value => String(value).trim().toUpperCase())
            : String(linkFlags || '').split(/[\s,]+/).map(value => value.trim().toUpperCase()).filter(Boolean)
        return flags.includes('UP') ? 'UP' : ''
    }

    private isUplinkInterface(node: Node): boolean {
        const type = String(node.data?.Type || node.data?.type || '').toLowerCase()
        const driver = String(node.data?.Driver || node.data?.driver || '').toLowerCase()
        return ['device', 'bond', 'vlan'].includes(type) || driver === 'bonding'
    }

    private basicRows() {
        const data = this.data()
        const name = firstTextValue(data, ['Name', 'name']) || this.props.node.id
        const state = this.stateValue(data)
        const mac = firstTextValue(data, ['MAC', 'Mac', 'HardwareAddr'])
        const rows = [
            { key: 'name', label: translate('Name'), value: name, textValue: name, copyText: name },
            { key: 'state', label: translate('State'), value: state ? this.stateBadge(state) : '', textValue: state },
            { key: 'type', label: translate('Type'), value: firstTextValue(data, ['Type', 'type']), textValue: firstTextValue(data, ['Type', 'type']) },
            { key: 'driver', label: translate('Driver'), value: firstTextValue(data, ['Driver', 'driver']), textValue: firstTextValue(data, ['Driver', 'driver']) },
            { key: 'mac', label: translate('MAC'), value: mac, textValue: mac, copyText: mac || undefined },
            { key: 'mtu', label: translate('MTU'), value: firstTextValue(data, ['MTU', 'Mtu', 'mtu']), textValue: firstTextValue(data, ['MTU', 'Mtu', 'mtu']) },
            { key: 'ifIndex', label: translate('IfIndex'), value: firstTextValue(data, ['IfIndex', 'ifIndex']), textValue: firstTextValue(data, ['IfIndex', 'ifIndex']) },
            { key: 'encapType', label: translate('EncapType'), value: firstTextValue(data, ['EncapType', 'EncapsulationType']), textValue: firstTextValue(data, ['EncapType', 'EncapsulationType']) }
        ]
        return rows.filter(row => !isBlank(row.textValue))
    }

    private topologyLinks(): Link[] {
        const links = (window as any).App?.tc?.links
        return links && typeof links.values === 'function' ? Array.from(links.values()) as Link[] : []
    }

    private hostAncestor(): Node | undefined {
        let current = this.props.node.parent
        while (current) {
            if (String(current.data?.Type || current.data?.type || '').toLowerCase() === 'host') return current
            current = current.parent
        }
        return undefined
    }

    private memberInterfaces(): Node[] {
        const bridgeIndex = firstTextValue(this.data(), ['IfIndex', 'ifIndex'])
        if (!bridgeIndex) return []
        const members = new Map<string, Node>()
        this.topologyLinks().forEach(link => {
            const peer = link.source.id === this.props.node.id
                ? link.target
                : link.target.id === this.props.node.id
                ? link.source
                : undefined
            if (!peer) return
            const masterIndex = firstTextValue(peer.data || {}, ['MasterIndex', 'masterIndex'])
            if (masterIndex === bridgeIndex) members.set(peer.id, peer)
        })
        return Array.from(members.values())
    }

    private isVirtualMachine(node?: Node): boolean {
        const type = String(node?.data?.Type || node?.data?.type || '').toLowerCase()
        return type === 'libvirt' || type === 'vm' || type === 'virtualmachine'
    }

    private memberVirtualMachine(member: Node): Node | undefined {
        let current: Node | null | undefined = member.parent
        while (current) {
            if (this.isVirtualMachine(current)) return current
            current = current.parent
        }

        for (const link of this.topologyLinks()) {
            const relationType = String(link.data?.RelationType || '').toLowerCase()
            if (relationType !== 'ownership' && relationType !== 'vownership') continue
            const peer = link.source.id === member.id
                ? link.target
                : link.target.id === member.id
                ? link.source
                : undefined
            if (this.isVirtualMachine(peer)) return peer
        }
        return undefined
    }

    private memberDisplayName(member: Node): string {
        const interfaceName = firstTextValue(member.data || {}, ['Name', 'name']) || member.id
        const vm = this.memberVirtualMachine(member)
        if (!vm) return interfaceName
        const vmName = this.props.nodeDisplayName
            ? this.props.nodeDisplayName(vm)
            : firstTextValue(vm.data || {}, ['DisplayName', 'displayName', 'Name', 'name'])
        return vmName && vmName !== interfaceName ? `${interfaceName} (${vmName})` : interfaceName
    }

    private focusNodeIDs(nodeIDs: string[], mode: InfrastructureConnectedResourceNavigationMode = 'summary') {
        navigateInfrastructureConnectedResources(nodeIDs, this.props.node.id, mode)
    }

    private renderConnectedResources(members: Node[]) {
        const host = this.hostAncestor()
        const resources = [
            { label: translate('infrastructureHosts'), nodes: host ? [host] : [], icon: <DesktopOutlined />, iconTone: 'host' as const },
            { label: translate('bridgeMemberInterfaces'), nodes: members, icon: <ApartmentOutlined />, iconTone: 'interface' as const }
        ]
        return (
            <DetailResourceGrid>
                {resources.map(resource => (
                    <DetailResourceCard
                        key={String(resource.label)} label={resource.label} value={String(resource.nodes.length)} icon={resource.icon} iconTone={resource.iconTone}
                        interactive={resource.nodes.length > 0}
                        resources={connectedResourcePopoverItems(resource.nodes, { anchorNodeID: this.props.node.id, icon: resource.icon })}
                        resourcesTitle={resource.label}
                        onClick={() => this.focusNodeIDs(resource.nodes.map(node => node.id))} />
                ))}
            </DetailResourceGrid>
        )
    }

    private addressRows() {
        const data = this.data()
        const ipv4 = firstTextValue(data, ['IPV4', 'IPv4', 'ipv4'])
        const ipv6 = firstTextValue(data, ['IPV6', 'IPv6', 'ipv6'])
        return [
            { key: 'ipv4', label: translate('ipv4'), value: ipv4, textValue: ipv4, copyText: ipv4 || undefined },
            { key: 'ipv6', label: translate('ipv6'), value: ipv6, textValue: ipv6, copyText: ipv6 || undefined }
        ].filter(row => !isBlank(row.textValue))
    }

    private renderMembers(members: Node[]) {
        return (
            <div className="netdive-host-bridge-detail__members">
                {members.map(member => {
                    const name = this.memberDisplayName(member)
                    const state = this.stateValue(member.data || {})
                    return (
                        <button type="button" className="netdive-host-bridge-detail__member" key={member.id} onClick={() => this.focusNodeIDs([member.id], 'item')}>
                            <span className="netdive-host-bridge-detail__member-main">
                                <span className="netdive-host-bridge-detail__member-name" title={name}>{name}</span>
                                {this.isUplinkInterface(member) && <DetailBadge tone="info">{translate('bridgeUplink')}</DetailBadge>}
                            </span>
                            {state && this.stateBadge(state)}
                        </button>
                    )
                })}
            </div>
        )
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
        return specs.filter(spec => metric[spec.key] !== undefined && metric[spec.key] !== null).map(spec => {
            const value = spec.format(metric[spec.key])
            return { key: spec.key, label: spec.label, value, textValue: value }
        })
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
        if (!rows.length) return <DetailEmpty description={translate('bridgeNoData')} compact />
        return (
            <div className="netdive-detail-table-scroll">
                <Table className="netdive-detail-table" columns={this.tableColumns(rows, preferred)} dataSource={rows} pagination={false} size="small" tableLayout="fixed" />
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
                    ID: table?.ID, Src: table?.Src, Protocol: route?.Protocol, Prefix: route?.Prefix,
                    Priority: nextHop?.Priority, IP: nextHop?.IP, IfIndex: nextHop?.IfIndex
                }))
            })
        })
        return rows
    }

    private advancedInterfaceData(): Record<string, any> {
        const data = this.data()
        const values: Record<string, any> = {}
        ;['BusInfo', 'LinkFlags', 'Speed', 'TID', 'LinkNetNsID', 'LinkNetNsName', 'MasterIndex', 'ParentIndex', 'PeerIfIndex'].forEach(key => {
            if (!isBlank(data[key])) values[key] = data[key]
        })
        return values
    }

    private advancedBlock(title: React.ReactNode, content: React.ReactNode) {
        return (
            <div className="netdive-detail-subsection">
                <div className="netdive-detail-subsection__title">{title}</div>
                {content}
            </div>
        )
    }

    private renderAdvanced() {
        const data = this.data()
        const blocks: React.ReactNode[] = []
        const interfaceData = this.advancedInterfaceData()
        if (Object.keys(interfaceData).length) blocks.push(this.advancedBlock(translate('bridgeInterfaceInfo'), this.renderTable(interfaceData)))
        if (hasContent(data.Features)) blocks.push(this.advancedBlock(translate('features'), this.renderTable(data.Features)))
        if (hasContent(data.FDB)) blocks.push(this.advancedBlock(translate('fdb'), this.renderTable(data.FDB, ['MAC', 'IfIndex', 'State', 'Flags'])))
        if (hasContent(data.Neighbors)) blocks.push(this.advancedBlock(translate('neighbors'), this.renderTable(data.Neighbors, ['IP', 'MAC', 'State', 'IfIndex'])))
        if (hasContent(data.RoutingTables)) blocks.push(this.advancedBlock(translate('routingTables'), this.renderTable(this.routingRows(), ['ID', 'Src', 'Protocol', 'Prefix', 'Priority', 'IP', 'IfIndex'])))
        return <div className="netdive-detail-subsections">{blocks}</div>
    }

    render() {
        const data = this.data()
        const members = this.memberInterfaces()
        const addresses = this.addressRows()
        const recentRows = this.metricRows(data.LastUpdateMetric, true)
        const accumulatedRows = this.metricRows(data.Metric, false)
        const hasAdvanced = Object.keys(this.advancedInterfaceData()).length > 0 || ['Features', 'FDB', 'Neighbors', 'RoutingTables'].some(key => hasContent(data[key]))
        return (
            <div className="netdive-host-bridge-detail">
                <DetailSection icon={<InfoCircleOutlined />} title={translate('hostBasicInfo')}>
                    <DetailKeyValueList rows={this.basicRows()} copyTooltip={translate('copy')} />
                </DetailSection>
                <DetailSection icon={<LinkOutlined />} title={translate('hostConnectedResources')}>
                    {this.renderConnectedResources(members)}
                </DetailSection>
                {addresses.length > 0 && (
                    <DetailSection icon={<GlobalOutlined />} title={translate('bridgeNetworkAddresses')}>
                        <DetailKeyValueList rows={addresses} copyTooltip={translate('copy')} />
                    </DetailSection>
                )}
                {members.length > 0 && this.section('configuration', <ApartmentOutlined />, translate('bridgeConfiguration'), this.renderMembers(members))}
                {recentRows.length > 0 && this.section('recent', <LineChartOutlined />, translate('lastUpdateMetric'), <DetailKeyValueList rows={recentRows} />)}
                {accumulatedRows.length > 0 && this.section('accumulated', <BarChartOutlined />, translate('metric'), <DetailKeyValueList rows={accumulatedRows} />)}
                {hasAdvanced && this.section('advanced', <SettingOutlined />, translate('detailAdvancedInfo'), this.renderAdvanced())}
            </div>
        )
    }
}

export default HostBridgeDetailPanel
