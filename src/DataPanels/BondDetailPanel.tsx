import * as React from 'react'
import { Table } from 'antd'
import {
    ApiOutlined,
    BarChartOutlined,
    DesktopOutlined,
    InfoCircleOutlined,
    LineChartOutlined,
    LinkOutlined,
    SettingOutlined
} from '@ant-design/icons'

import { translate } from '../Config'
import Tools from '../Tools'
import { Link, Node } from '../Topology'
import { connectedResourcePopoverItems, DetailBadge, DetailEmpty, DetailKeyValueList, DetailResourceCard, DetailResourceGrid, DetailSection, InfrastructureConnectedResourceNavigationMode, navigateInfrastructureConnectedResources } from './common'
import './BondDetailPanel.css'

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

class BondDetailPanel extends React.Component<Props, State> {
    state: State = {
        collapsed: {
            recent: true,
            accumulated: true,
            configuration: false,
            advanced: true
        }
    }

    private data(): any {
        return this.props.node.data || {}
    }

    private toggleSection(key: string) {
        this.setState({
            collapsed: {
                ...this.state.collapsed,
                [key]: !this.state.collapsed[key]
            }
        })
    }

    private section(key: string, icon: React.ReactNode, title: React.ReactNode, children: React.ReactNode) {
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
        const state = value.toLowerCase()
        const tone = state === 'up' || state === 'running'
            ? 'success'
            : state === 'down' || state === 'failed'
            ? 'danger'
            : 'default'
        return <DetailBadge tone={tone}>{value}</DetailBadge>
    }

    private basicRows() {
        const data = this.data()
        const name = firstTextValue(data, ['Name', 'name']) || this.props.node.id
        const state = firstTextValue(data, ['State', 'state', 'OperState'])
        const values = [
            { key: 'name', label: translate('Name'), value: name, textValue: name, copyText: name },
            { key: 'type', label: translate('Type'), value: firstTextValue(data, ['Type', 'type']), textValue: firstTextValue(data, ['Type', 'type']) },
            { key: 'driver', label: translate('Driver'), value: firstTextValue(data, ['Driver', 'driver']), textValue: firstTextValue(data, ['Driver', 'driver']) },
            { key: 'state', label: translate('State'), value: state ? this.stateBadge(state) : '', textValue: state },
            { key: 'mac', label: translate('MAC'), value: firstTextValue(data, ['MAC', 'Mac', 'HardwareAddr']), textValue: firstTextValue(data, ['MAC', 'Mac', 'HardwareAddr']), copyText: firstTextValue(data, ['MAC', 'Mac', 'HardwareAddr']) || undefined },
            { key: 'ipv4', label: translate('ipv4'), value: firstTextValue(data, ['IPV4', 'IPv4', 'ipv4']), textValue: firstTextValue(data, ['IPV4', 'IPv4', 'ipv4']) },
            { key: 'ipv6', label: translate('ipv6'), value: firstTextValue(data, ['IPV6', 'IPv6', 'ipv6']), textValue: firstTextValue(data, ['IPV6', 'IPv6', 'ipv6']) },
            { key: 'mtu', label: translate('MTU'), value: firstTextValue(data, ['MTU', 'Mtu', 'mtu']), textValue: firstTextValue(data, ['MTU', 'Mtu', 'mtu']) },
            { key: 'ifIndex', label: translate('IfIndex'), value: firstTextValue(data, ['IfIndex', 'ifIndex']), textValue: firstTextValue(data, ['IfIndex', 'ifIndex']) },
            { key: 'encapType', label: translate('EncapType'), value: firstTextValue(data, ['EncapType', 'EncapsulationType']), textValue: firstTextValue(data, ['EncapType', 'EncapsulationType']) },
            { key: 'linkFlags', label: translate('LinkFlags'), value: firstTextValue(data, ['LinkFlags', 'Flags']), textValue: firstTextValue(data, ['LinkFlags', 'Flags']) }
        ]
        return values.filter(row => !isBlank(row.textValue))
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

    private isBondSlave(node: Node): boolean {
        const bondIndex = firstTextValue(this.data(), ['IfIndex', 'ifIndex'])
        const masterIndex = firstTextValue(node.data || {}, ['MasterIndex', 'masterIndex'])
        const slaveType = firstTextValue(node.data || {}, ['BondSlave.Type', 'BondSlave.type']).toLowerCase()
        return !!bondIndex && masterIndex === bondIndex && slaveType === 'bond'
    }

    private slaveInterfaces(): Node[] {
        const slaves = new Map<string, Node>()
        this.topologyLinks().forEach(link => {
            const peer = link.source.id === this.props.node.id
                ? link.target
                : link.target.id === this.props.node.id
                ? link.source
                : undefined
            if (peer && this.isBondSlave(peer)) slaves.set(peer.id, peer)
        })
        return Array.from(slaves.values())
    }

    private focusNodeIDs(nodeIDs: string[], mode: InfrastructureConnectedResourceNavigationMode = 'summary') {
        navigateInfrastructureConnectedResources(nodeIDs, this.props.node.id, mode)
    }

    private renderConnectedResources(slaves: Node[]) {
        const host = this.hostAncestor()
        const resources = [
            { label: translate('infrastructureHosts'), nodes: host ? [host] : [], icon: <DesktopOutlined />, iconTone: 'host' as const },
            { label: translate('bondSlaveInterfaces'), nodes: slaves, icon: <ApiOutlined />, iconTone: 'interface' as const }
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
                        resources={connectedResourcePopoverItems(resource.nodes, { anchorNodeID: this.props.node.id, icon: resource.icon })}
                        resourcesTitle={resource.label}
                        onClick={() => this.focusNodeIDs(resource.nodes.map(node => node.id))} />
                ))}
            </DetailResourceGrid>
        )
    }

    private renderBondConfiguration(slaves: Node[]) {
        const data = this.data()
        const mode = firstTextValue(data, ['BondMode'])
        const rows = [
            { key: 'mode', label: translate('bondMode'), value: mode, textValue: mode }
        ].filter(row => !isBlank(row.textValue))

        return (
            <React.Fragment>
                {rows.length > 0 && <DetailKeyValueList rows={rows} />}
                {slaves.length > 0 && (
                    <div className="netdive-bond-detail__slaves">
                        <div className="netdive-bond-detail__slaves-title">{translate('bondSlaveInterface')}</div>
                        {slaves.map(slave => {
                            const name = firstTextValue(slave.data || {}, ['Name', 'name']) || slave.id
                            const state = firstTextValue(slave.data || {}, ['State', 'state'])
                            const bondState = firstTextValue(slave.data || {}, ['BondSlave.State'])
                            const miiStatus = firstTextValue(slave.data || {}, ['BondSlave.MiiStatus'])
                            const status = state || miiStatus
                            return (
                                <button
                                    type="button"
                                    className="netdive-bond-detail__slave"
                                    key={slave.id}
                                    onClick={() => this.focusNodeIDs([slave.id], 'item')}>
                                    <span className="netdive-bond-detail__slave-main">
                                        <span className="netdive-bond-detail__slave-name">{name}</span>
                                        {bondState && <span className="netdive-bond-detail__slave-role">{bondState}</span>}
                                    </span>
                                    {status && this.stateBadge(status)}
                                </button>
                            )
                        })}
                    </div>
                )}
                {!rows.length && !slaves.length && <DetailEmpty description={translate('bondNoData')} compact />}
            </React.Fragment>
        )
    }

    private formatDate(value: any): string {
        if (isBlank(value)) return ''
        const numeric = Number(value)
        const timestamp = !Number.isNaN(numeric) && String(Math.trunc(numeric)).length <= 10 ? numeric * 1000 : value
        const date = new Date(timestamp)
        return Number.isNaN(date.getTime()) ? textValue(value) : date.toLocaleString()
    }

    private formatNumber(value: any): string {
        const numeric = Number(value)
        return Number.isNaN(numeric) ? textValue(value) : numeric.toLocaleString()
    }

    private formatBytes(value: any): string {
        const numeric = Number(value)
        return Number.isNaN(numeric) ? textValue(value) : Tools.prettyBytes(numeric)
    }

    private metricRows(metric: any, recent: boolean) {
        if (!metric || typeof metric !== 'object') return []
        const specs: Array<{ key: string, label: string, formatter: (value: any) => string }> = [
            { key: 'RxPackets', label: translate('RxPackets'), formatter: value => this.formatNumber(value) },
            { key: 'RxBytes', label: translate('RxBytes'), formatter: value => this.formatBytes(value) },
            { key: 'TxPackets', label: translate('TxPackets'), formatter: value => this.formatNumber(value) },
            { key: 'TxBytes', label: translate('TxBytes'), formatter: value => this.formatBytes(value) }
        ]
        if (recent) specs.push({ key: 'Start', label: translate('Start'), formatter: value => this.formatDate(value) })
        specs.push({ key: 'Last', label: translate('Last'), formatter: value => this.formatDate(value) })

        return specs
            .filter(spec => metric[spec.key] !== undefined && metric[spec.key] !== null)
            .map(spec => ({
                key: spec.key,
                label: spec.label,
                value: spec.formatter(metric[spec.key]),
                textValue: spec.formatter(metric[spec.key])
            }))
    }

    private renderMetric(metric: any, recent: boolean) {
        const rows = this.metricRows(metric, recent)
        return rows.length
            ? <DetailKeyValueList rows={rows} />
            : <DetailEmpty description={translate('bondNoData')} compact />
    }

    private featureRows(): DataRow[] {
        const features = this.data().Features
        if (!features || typeof features !== 'object') return []
        return Object.keys(features)
            .sort((left, right) => {
                const leftEnabled = features[left] === true
                const rightEnabled = features[right] === true
                return Number(rightEnabled) - Number(leftEnabled) || left.localeCompare(right)
            })
            .map((name, index) => ({ key: `feature-${index}`, Feature: name, Value: features[name] }))
    }

    private renderFeatures() {
        const rows = this.featureRows()
        if (!rows.length) return <DetailEmpty description={translate('bondNoData')} compact />
        const columns = [
            { title: translate('Key'), dataIndex: 'Feature', key: 'Feature' },
            {
                title: translate('Value'),
                dataIndex: 'Value',
                key: 'Value',
                width: 84,
                render: (value: any) => {
                    const enabled = value === true || String(value).toLowerCase() === 'true'
                    return <DetailBadge tone={enabled ? 'success' : 'default'}>{textValue(value)}</DetailBadge>
                }
            }
        ]
        return <Table className="netdive-bond-detail__table" columns={columns} dataSource={rows} pagination={false} size="small" tableLayout="fixed" />
    }

    private normalizeRows(value: any): DataRow[] {
        if (Array.isArray(value)) {
            return value.map((item, index) => typeof item === 'object' && item !== null
                ? { key: `row-${index}`, ...item }
                : { key: `row-${index}`, Value: item })
        }
        if (!value || typeof value !== 'object') return []
        const entries = Object.keys(value)
        if (entries.every(key => value[key] && typeof value[key] === 'object')) {
            return entries.map((key, index) => ({ key: `row-${index}`, Name: key, ...value[key] }))
        }
        return entries.map((key, index) => ({ key: `row-${index}`, Key: key, Value: value[key] }))
    }

    private tableColumns(rows: DataRow[], preferred: string[] = []) {
        const keys: string[] = []
        const add = (key: string) => {
            if (key !== 'key' && !keys.includes(key) && rows.some(row => row[key] !== undefined)) keys.push(key)
        }
        preferred.forEach(add)
        rows.forEach(row => Object.keys(row).forEach(add))
        return keys.map(key => ({
            title: translate(key),
            dataIndex: key,
            key,
            render: (value: any) => textValue(value)
        }))
    }

    private renderTable(value: any, preferred: string[] = []) {
        const rows = this.normalizeRows(value)
        if (!rows.length) return <DetailEmpty description={translate('bondNoData')} compact />
        return (
            <div className="netdive-bond-detail__table-scroll">
                <Table
                    className="netdive-bond-detail__table"
                    columns={this.tableColumns(rows, preferred)}
                    dataSource={rows}
                    pagination={false}
                    size="small"
                    tableLayout="fixed" />
            </div>
        )
    }

    private routingRows(): DataRow[] {
        const tables = firstRawValue(this.data(), ['RoutingTables', 'RoutingTable'])
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

    private renderRoutingTable() {
        const rows = this.routingRows()
        if (!rows.length) return <DetailEmpty description={translate('bondNoData')} compact />
        return (
            <div className="netdive-bond-detail__table-scroll">
                <Table
                    className="netdive-bond-detail__table"
                    columns={this.tableColumns(rows, ['ID', 'Src', 'Protocol', 'Prefix', 'Priority', 'IP', 'IfIndex'])}
                    dataSource={rows}
                    pagination={false}
                    size="small"
                    tableLayout="fixed" />
            </div>
        )
    }

    private renderAdvancedBlock(title: React.ReactNode, content: React.ReactNode) {
        return (
            <div className="netdive-bond-detail__advanced-block">
                <div className="netdive-bond-detail__advanced-title">{title}</div>
                {content}
            </div>
        )
    }

    private renderAdvanced() {
        const data = this.data()
        const blocks: React.ReactNode[] = []
        if (this.hasField('Features')) blocks.push(this.renderAdvancedBlock(translate('features'), this.renderFeatures()))
        if (this.hasField('FDB')) blocks.push(this.renderAdvancedBlock(translate('fdb'), this.renderTable(data.FDB, ['MAC', 'IfIndex', 'State', 'Flags'])))
        if (this.hasField('Neighbors')) blocks.push(this.renderAdvancedBlock(translate('neighbors'), this.renderTable(data.Neighbors)))
        if (this.hasField('RoutingTables', 'RoutingTable')) blocks.push(this.renderAdvancedBlock(translate('routingTables'), this.renderRoutingTable()))
        return blocks.length
            ? <div className="netdive-bond-detail__advanced">{blocks}</div>
            : <DetailEmpty description={translate('bondNoData')} compact />
    }

    private hasField(...keys: string[]): boolean {
        return keys.some(key => this.data()[key] !== undefined && this.data()[key] !== null)
    }

    render() {
        const data = this.data()
        const slaves = this.slaveInterfaces()
        const hasBondConfiguration = slaves.length > 0 || !!firstRawValue(data, [
            'BondMode'
        ])
        const hasAdvanced = this.hasField('Features', 'FDB', 'Neighbors', 'RoutingTables', 'RoutingTable')
        return (
            <div className="netdive-bond-detail">
                <DetailSection icon={<InfoCircleOutlined />} title={translate('hostBasicInfo')}>
                    <DetailKeyValueList rows={this.basicRows()} copyTooltip={translate('copy')} />
                </DetailSection>
                <DetailSection icon={<LinkOutlined />} title={translate('hostConnectedResources')}>
                    {this.renderConnectedResources(slaves)}
                </DetailSection>
                {hasBondConfiguration && this.section('configuration', <ApiOutlined />, translate('bondConfiguration'), this.renderBondConfiguration(slaves))}
                {this.hasField('LastUpdateMetric') && this.section('recent', <LineChartOutlined />, translate('lastUpdateMetric'), this.renderMetric(data.LastUpdateMetric, true))}
                {this.hasField('Metric') && this.section('accumulated', <BarChartOutlined />, translate('metric'), this.renderMetric(data.Metric, false))}
                {hasAdvanced && this.section('advanced', <SettingOutlined />, translate('detailAdvancedInfo'), this.renderAdvanced())}
            </div>
        )
    }
}

export default BondDetailPanel
