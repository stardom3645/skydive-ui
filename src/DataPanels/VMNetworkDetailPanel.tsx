import * as React from 'react'
import Tooltip from '@material-ui/core/Tooltip'
import DeviceHubIcon from '@material-ui/icons/DeviceHub'
import InfoIcon from '@material-ui/icons/Info'
import TimelineIcon from '@material-ui/icons/Timeline'
import SettingsInputComponentIcon from '@material-ui/icons/SettingsInputComponent'
import KeyboardArrowRightIcon from '@material-ui/icons/KeyboardArrowRight'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import { withStyles } from '@material-ui/core/styles'

import { Node } from '../Topology'
import { styles } from './HostDetailPanelStyles'

interface Props {
    classes: any
    node: Node
    moldInventory?: any
    vmNameMap?: Record<string, string>
    vmNetworkMap?: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>>
    vmDetailMap?: Record<string, any>
}

interface State {
    collapsed: Record<string, boolean>
}

interface KeyValueRow {
    label: string
    value: any
    variant?: 'networkType' | 'state'
}

interface MetricItem {
    label: string
    value: string
    sub?: string
}

interface FeatureItem {
    name: string
    enabled: boolean
}

interface MatchedVMNetwork {
    vmKey: string
    vmName: string
    networkName: string
    macAddress: string
    ipAddress: string
}

const isBlank = (value: any): boolean => {
    if (value === undefined || value === null) return true
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'string') return value.trim() === ''
    return false
}

const asArray = (value: any): any[] => {
    if (isBlank(value)) return []
    return Array.isArray(value) ? value : [value]
}

const stringify = (value: any): string => {
    if (isBlank(value)) return ''
    if (Array.isArray(value)) return value.map(item => stringify(item)).filter(Boolean).join(', ')
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch (e) {
            return String(value)
        }
    }
    return String(value)
}

const valueByPath = (data: any, path: string): any => {
    if (!path || path.indexOf('.') < 0) return data?.[path]
    return path.split('.').reduce((current, key) => current?.[key], data)
}

const firstValue = (data: any, keys: string[]): string => {
    for (const key of keys) {
        const value = stringify(valueByPath(data, key))
        if (value) return value
    }
    return ''
}

const firstRaw = (data: any, keys: string[]): any => {
    for (const key of keys) {
        const value = valueByPath(data, key)
        if (!isBlank(value)) return value
    }
    return undefined
}

const normalizeText = (value: string): string => String(value || '').trim()

const formatDate = (value: any): string => {
    if (isBlank(value)) return ''
    const numeric = Number(value)
    const date = !Number.isNaN(numeric) && String(value).length <= 10
        ? new Date(numeric * 1000)
        : new Date(value)
    if (Number.isNaN(date.getTime())) return stringify(value)
    return date.toLocaleString()
}

const formatBytes = (value: any): string => {
    if (isBlank(value)) return ''
    const bytes = Number(value)
    if (Number.isNaN(bytes)) return stringify(value)
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
        size = size / 1024
        unitIndex += 1
    }
    const display = unitIndex === 0 ? String(Math.round(size)) : size.toFixed(size >= 10 ? 1 : 2).replace(/\.0$/, '')
    return `${display} ${units[unitIndex]} (${bytes.toLocaleString()} bytes)`
}

class VMNetworkDetailPanel extends React.Component<Props, State> {
    state: State = {
        collapsed: {
            features: true,
            advanced: true,
            raw: true
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

    private name(): string {
        const data = this.data()
        return firstValue(data, ['Name', 'name', 'InterfaceName', 'IfName', 'IfAlias', 'Device', 'ID', 'id']) || this.props.node.id
    }

    private interfaceType(): string {
        const data = this.data()
        const explicit = firstValue(data, ['InterfaceType', 'IfaceType', 'IfType', 'Kind', 'LinkType', 'TunType', 'TUNType'])
        if (explicit) return explicit
        const driver = firstValue(data, ['Driver', 'driver'])
        const name = this.name().toLowerCase()
        if (/vnet|tap|tun/.test(name) || /tap|tun/.test(driver.toLowerCase())) return 'tuntap'
        return firstValue(data, ['Type', 'type'])
    }

    private networkType(): string {
        const data = this.data()
        const value = firstValue(data, [
            'MoldNetworkType',
            'NetworkType',
            'networkType',
            'TrafficType',
            'GuestType',
            'guestType',
            'TypeDetail',
            'Mold.NetworkType'
        ])
        const normalized = value.toLowerCase()
        if (normalized === 'l2' || normalized.indexOf('l2') >= 0) return 'L2'
        if (normalized.indexOf('isolated') >= 0) return 'Isolated'
        if (normalized.indexOf('shared') >= 0) return 'Shared'
        return value || 'Unknown'
    }

    private networkTypeDescription(type = this.networkType()): string {
        switch (type.toLowerCase()) {
            case 'l2':
                return '동일 L2 네트워크에 직접 연결된 네트워크입니다.'
            case 'isolated':
                return '격리 네트워크이며 Virtual Router를 통해 외부 통신할 수 있습니다.'
            case 'shared':
                return '여러 VM이 공유하는 네트워크입니다.'
            default:
                return ''
        }
    }

    private stateText(): string {
        return firstValue(this.data(), ['State', 'state', 'Status', 'status', 'OperState', 'operstate', 'LinkState']) || 'UNKNOWN'
    }

    private mac(): string {
        return firstValue(this.data(), ['MAC', 'Mac', 'MacAddress', 'macAddress', 'HardwareAddr', 'LLAddr'])
    }

    private ipAddress(): string {
        return firstValue(this.data(), ['IpAddress', 'ipAddress', 'ipaddress', 'IP', 'IPv4', 'IPV4']) || this.ipv4Addresses()[0] || this.ipv6Addresses()[0]
    }

    private matchedVMNetwork(): MatchedVMNetwork | undefined {
        const mac = this.mac().toLowerCase()
        const ip = this.ipAddress()
        const vmNetworkMap = this.props.vmNetworkMap || {}
        for (const vmKey of Object.keys(vmNetworkMap)) {
            for (const network of vmNetworkMap[vmKey] || []) {
                const networkMac = String(network.macAddress || '').toLowerCase()
                const networkIp = String(network.ipAddress || '')
                if ((mac && networkMac && mac === networkMac) || (ip && networkIp && ip === networkIp)) {
                    return {
                        vmKey,
                        vmName: this.props.vmNameMap?.[vmKey] || vmKey,
                        networkName: network.networkName || '',
                        macAddress: network.macAddress || '',
                        ipAddress: network.ipAddress || ''
                    }
                }
            }
        }
        return undefined
    }

    private ipv4Addresses(): string[] {
        const data = this.data()
        return [
            ...asArray(data.IPV4),
            ...asArray(data.IPv4),
            ...asArray(data.ipv4),
            ...asArray(data.IP),
            ...asArray(data.Addr),
            ...asArray(data.IpAddress),
            ...asArray(data.ipaddress)
        ].map(stringify).filter(value => value && value.indexOf(':') < 0)
    }

    private ipv6Addresses(): string[] {
        const data = this.data()
        return [
            ...asArray(data.IPV6),
            ...asArray(data.IPv6),
            ...asArray(data.ipv6),
            ...asArray(data.Addr),
            ...asArray(data.IpAddress)
        ].map(stringify).filter(value => value && value.indexOf(':') >= 0)
    }

    private badgeClass(kind: 'networkType' | 'state', value: string): string {
        const { classes } = this.props
        const normalized = String(value || '').toLowerCase()
        if (kind === 'networkType') {
            if (normalized === 'l2') return `${classes.detailBadge} ${classes.detailBadgeBlue}`
            if (normalized === 'isolated') return `${classes.detailBadge} ${classes.detailBadgeIndigo}`
            if (normalized === 'shared') return `${classes.detailBadge} ${classes.detailBadgeGreen}`
            return classes.detailBadge
        }
        if (normalized === 'up' || normalized === 'running') return `${classes.detailBadge} ${classes.detailBadgeGreen}`
        if (normalized === 'down' || normalized === 'failed') return `${classes.detailBadge} ${classes.detailBadgeRed}`
        if (normalized === 'unknown') return `${classes.detailBadge} ${classes.detailBadgeWarning}`
        return classes.detailBadge
    }

    private renderValue(row: KeyValueRow) {
        const { classes } = this.props
        const value = stringify(row.value) || '-'
        if (row.variant === 'networkType') {
            const description = this.networkTypeDescription(value)
            const badge = <span className={this.badgeClass(row.variant, value)}>{value}</span>
            return description ? <Tooltip title={description} placement="top" arrow>{badge}</Tooltip> : badge
        }
        if (row.variant === 'state') {
            return <span className={this.badgeClass(row.variant, value)}>{value}</span>
        }
        return <span className={classes.kvValue}>{value}</span>
    }

    private renderRows(rows: KeyValueRow[], emptyText = '-', showBlankRows = false) {
        const { classes } = this.props
        const visible = showBlankRows ? rows : rows.filter(row => !isBlank(row.value))
        if (!visible.length) return <div className={classes.emptyState}>{emptyText}</div>
        return (
            <div className={classes.rowsCompact}>
                {visible.map(row => (
                    <div className={classes.kvRow} key={row.label}>
                        <div className={classes.kvLabel}>{row.label}</div>
                        <div className={classes.kvValueWrap}>{this.renderValue(row)}</div>
                    </div>
                ))}
            </div>
        )
    }

    private renderSection(key: string, icon: React.ReactNode, title: string, description: string, children: React.ReactNode, defaultCollapsed = false) {
        const { classes } = this.props
        const collapsed = this.state.collapsed[key] !== undefined ? this.state.collapsed[key] : defaultCollapsed
        return (
            <section className={classes.panelCard}>
                <button type="button" className={classes.collapsibleHeaderButton} onClick={() => this.toggleSection(key)}>
                    <div className={classes.collapsibleHeaderInner}>
                        <span className={classes.panelIcon}>{icon}</span>
                        <div className={classes.panelTitleBlock}>
                            <div className={classes.panelTitle}>{title}</div>
                            {description && <div className={classes.panelDescription}>{description}</div>}
                        </div>
                        <span className={classes.collapsibleHeaderChevron}>{collapsed ? <KeyboardArrowRightIcon /> : <KeyboardArrowDownIcon />}</span>
                    </div>
                </button>
                {!collapsed && children}
            </section>
        )
    }

    private moldNetworkRows(): KeyValueRow[] {
        const data = this.data()
        const matched = this.matchedVMNetwork()
        const networkType = this.networkType()
        const virtualRouter = firstValue(data, ['VirtualRouterName', 'VirtualRouter', 'VirtualRouterId', 'RouterName', 'RouterID', 'RouterId'])
        return [
            { label: '연결된 VM 이름', value: matched?.vmName || firstValue(data, ['VMName', 'VmName', 'vmName', 'DisplayName', 'displayName']) },
            { label: 'VM 인스턴스명', value: firstValue(data, ['InstanceName', 'instanceName', 'LibvirtName', 'Domain', 'domain']) },
            { label: 'NIC 이름 / 디바이스 ID', value: firstValue(data, ['NicName', 'NICName', 'DeviceID', 'DeviceId', 'Device', 'IfName']) || this.name() },
            { label: 'Mold 네트워크 이름', value: matched?.networkName || firstValue(data, ['MoldNetworkName', 'NetworkName', 'networkName', 'Network', 'network']) },
            { label: '네트워크 유형', value: networkType, variant: 'networkType' },
            { label: '네트워크 Offering', value: firstValue(data, ['NetworkOffering', 'NetworkOfferingName', 'NetworkOfferingDisplayText', 'ServiceOffering']) },
            { label: 'Traffic Type', value: firstValue(data, ['TrafficType', 'trafficType']) },
            { label: 'Gateway', value: firstValue(data, ['Gateway', 'gateway']) },
            { label: 'CIDR', value: firstValue(data, ['CIDR', 'Cidr', 'cidr', 'Netmask', 'Prefix']) },
            { label: 'VLAN / Broadcast URI', value: firstValue(data, ['Vlan', 'VLAN', 'BroadcastURI', 'BroadcastUri', 'broadcastUri']) },
            { label: 'IP 주소', value: matched?.ipAddress || this.ipAddress() },
            { label: 'MAC 주소', value: matched?.macAddress || this.mac() },
            { label: 'Primary NIC 여부', value: firstValue(data, ['IsDefault', 'isDefault', 'Primary', 'primary', 'DefaultNic', 'defaultNic']) },
            ...(networkType.toLowerCase() === 'isolated' || virtualRouter ? [{ label: 'Virtual Router', value: virtualRouter }] : []),
            { label: 'Zone / Pod / Cluster', value: firstValue(data, ['ZoneName', 'Zone', 'PodName', 'Pod', 'ClusterName', 'Cluster']) }
        ]
    }

    private connectionPath(): string {
        const data = this.data()
        const matched = this.matchedVMNetwork()
        const networkType = this.networkType()
        const vm = matched?.vmName || firstValue(data, ['VMName', 'VmName', 'InstanceName', 'Domain'])
        const nic = firstValue(data, ['NicName', 'NICName', 'DeviceID', 'DeviceId']) || 'NIC'
        const networkName = matched?.networkName || firstValue(data, ['NetworkName', 'networkName']) || `${networkType} Network`
        const router = firstValue(data, ['VirtualRouterName', 'VirtualRouter', 'VirtualRouterId'])
        const parts = [vm, nic, this.name(), networkName]
        if (networkType.toLowerCase() === 'isolated' && router) parts.push(router)
        return parts.filter(Boolean).join(' → ')
    }

    private renderMoldNetworkInfo() {
        const { classes } = this.props
        const description = this.networkTypeDescription()
        const path = this.connectionPath()
        return (
            <React.Fragment>
                {path && <div className={classes.detailPathText}>{path}</div>}
                {this.renderRows(this.moldNetworkRows(), '-', true)}
                {description && <div className={classes.detailHelperText}>{description}</div>}
            </React.Fragment>
        )
    }

    private basicRows(): KeyValueRow[] {
        const data = this.data()
        return [
            { label: '이름', value: this.name() },
            { label: '타입', value: this.interfaceType() },
            { label: '상태', value: this.stateText(), variant: 'state' },
            { label: 'MAC 주소', value: this.mac() },
            { label: '드라이버', value: firstValue(data, ['Driver', 'driver']) },
            { label: '버스 정보', value: firstValue(data, ['BusInfo', 'busInfo', 'Bus', 'bus']) },
            { label: '캡슐화 타입', value: firstValue(data, ['EncapType', 'EncapsulationType', 'Encap', 'encap']) },
            { label: '인터페이스 인덱스', value: firstValue(data, ['IfIndex', 'Index', 'InterfaceIndex', 'ifindex']) },
            { label: 'Peer 인터페이스 MAC 주소', value: firstValue(data, ['PeerMac', 'PeerMAC', 'PeerMacAddress', 'Peer.MAC']) },
            { label: 'MTU', value: firstValue(data, ['MTU', 'Mtu', 'mtu']) },
            { label: '속도', value: firstValue(data, ['Speed', 'speed', 'LinkSpeed']) },
            { label: '인터페이스 이름', value: firstValue(data, ['IfName', 'InterfaceName', 'Name', 'name']) }
        ]
    }

    private libvirtRows(): KeyValueRow[] {
        const data = this.data()
        const libvirt = firstRaw(data, ['Libvirt', 'libvirt', 'Metadata', 'metadata']) || {}
        const source = typeof libvirt === 'object' ? { ...data, ...libvirt } : data
        return [
            { label: 'Alias', value: firstValue(source, ['Alias', 'alias']) },
            { label: 'BusInfo', value: firstValue(source, ['BusInfo', 'busInfo']) },
            { label: 'BusType', value: firstValue(source, ['BusType', 'busType']) },
            { label: 'Domain', value: firstValue(source, ['Domain', 'domain']) },
            { label: 'MAC', value: firstValue(source, ['MAC', 'Mac', 'MACAddress', 'macAddress']) }
        ]
    }

    private linkFlags(): string[] {
        const data = this.data()
        const flags = firstRaw(data, ['Flags', 'flags', 'LinkFlags', 'linkFlags'])
        if (Array.isArray(flags)) return flags.map(stringify).filter(Boolean)
        const flagText = stringify(flags)
        if (flagText) return flagText.split(/[,\s|]+/).map(normalizeText).filter(Boolean)
        const state = this.stateText()
        return state ? [state] : []
    }

    private renderConnectionInfo() {
        const libvirtRaw = firstRaw(this.data(), ['Libvirt', 'libvirt', 'Metadata', 'metadata'])
        const flags = this.linkFlags()
        return (
            <React.Fragment>
                {this.renderRows(this.libvirtRows(), '-', true)}
                {libvirtRaw && <pre className={this.props.classes.jsonBox}>{JSON.stringify(libvirtRaw, null, 2)}</pre>}
                {this.renderRows([{ label: '링크 플래그', value: flags.join(', ') }])}
            </React.Fragment>
        )
    }

    private renderAddressInfo() {
        const ipv4 = this.ipv4Addresses()
        const ipv6 = this.ipv6Addresses()
        if (!ipv4.length && !ipv6.length) return <div className={this.props.classes.emptyState}>주소 정보 없음</div>
        return this.renderRows([
            { label: 'IPv4', value: ipv4.join(', ') },
            { label: 'IPv6', value: ipv6.join(', ') }
        ])
    }

    private metricValue(keys: string[], formatter?: (value: any) => string): string {
        const value = firstRaw(this.data(), keys)
        if (isBlank(value)) return ''
        return formatter ? formatter(value) : stringify(value)
    }

    private renderMetricGrid(items: MetricItem[]) {
        const { classes } = this.props
        const visible = items.filter(item => !isBlank(item.value))
        if (!visible.length) return <div className={classes.emptyState}>수집 지표 없음</div>
        return (
            <div className={classes.metricGrid}>
                {visible.map(item => (
                    <div className={classes.metricTile} key={item.label}>
                        <div className={classes.metricBody}>
                            <div className={classes.metricLabel}>{item.label}</div>
                            <div className={classes.metricValue}>{item.value}</div>
                            {item.sub && <div className={classes.metricSub}>{item.sub}</div>}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    private recentMetrics(): MetricItem[] {
        return [
            { label: '송신 바이트 수', value: this.metricValue(['Last.TXBytes', 'LastUpdateMetric.ABBytes', 'Last.ABBytes', 'TXBytes', 'TxBytes'], formatBytes) },
            { label: '송신 패킷 수', value: this.metricValue(['Last.TXPackets', 'LastUpdateMetric.ABPackets', 'Last.ABPackets', 'TXPackets', 'TxPackets']) },
            { label: '수신 바이트 수', value: this.metricValue(['Last.RXBytes', 'LastUpdateMetric.BABytes', 'Last.BABytes', 'RXBytes', 'RxBytes'], formatBytes) },
            { label: '수신 패킷 수', value: this.metricValue(['Last.RXPackets', 'LastUpdateMetric.BAPackets', 'Last.BAPackets', 'RXPackets', 'RxPackets']) },
            { label: '최종 수집 시간', value: this.metricValue(['LastUpdate', 'LastSeen', 'UpdatedAt', '@UpdatedAt'], formatDate) },
            { label: '캡처 시작 시간', value: this.metricValue(['Capture.Start', 'CaptureStartedAt', 'StartedAt', 'CreatedAt'], formatDate) }
        ]
    }

    private accumulatedMetrics(): MetricItem[] {
        return [
            { label: '송신 바이트 수', value: this.metricValue(['Metric.ABBytes', 'ABBytes', 'TotalTXBytes', 'TotalTxBytes'], formatBytes) },
            { label: '송신 패킷 수', value: this.metricValue(['Metric.ABPackets', 'ABPackets', 'TotalTXPackets', 'TotalTxPackets']) },
            { label: '수신 바이트 수', value: this.metricValue(['Metric.BABytes', 'BABytes', 'TotalRXBytes', 'TotalRxBytes'], formatBytes) },
            { label: '수신 패킷 수', value: this.metricValue(['Metric.BAPackets', 'BAPackets', 'TotalRXPackets', 'TotalRxPackets']) },
            { label: '최종 수집 시간', value: this.metricValue(['Metric.Last', 'Last', 'LastUpdate', 'UpdatedAt', '@UpdatedAt'], formatDate) }
        ]
    }

    private featureItems(): FeatureItem[] {
        const features = firstRaw(this.data(), ['Features', 'features', 'Offload', 'offload', 'Offloads', 'offloads'])
        if (!features || typeof features !== 'object') return []
        return Object.keys(features)
            .map(key => ({ name: key, enabled: features[key] === true || String(features[key]).toLowerCase() === 'true' }))
            .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name))
    }

    private renderFeatures() {
        const { classes } = this.props
        const items = this.featureItems()
        if (!items.length) return <div className={classes.emptyState}>장비 기능 정보 없음</div>
        return (
            <div className={classes.featureTable}>
                {items.map(item => (
                    <div className={classes.featureRow} key={item.name}>
                        <span className={classes.featureName}>{item.name}</span>
                        <span className={`${classes.detailBadge} ${item.enabled ? classes.detailBadgeGreen : ''}`}>{item.enabled ? 'true' : 'false'}</span>
                    </div>
                ))}
            </div>
        )
    }

    private advancedInfo(): Record<string, any> {
        const data = this.data()
        const advanced: Record<string, any> = {}
        ;[
            ['포워딩 데이터베이스(FDB)', ['FDB', 'Fdb', 'fdb', 'ForwardingDatabase']],
            ['인접 장비 정보', ['Neighbors', 'neighbours', 'Neighbor', 'LLDP']],
            ['라우팅 테이블', ['RoutingTable', 'Routes', 'routes', 'Route']],
            ['기타 raw 데이터', ['Raw', 'raw']]
        ].forEach(([label, keys]) => {
            const value = firstRaw(data, keys as string[])
            if (!isBlank(value)) advanced[label as string] = value
        })
        return advanced
    }

    private renderAdvanced() {
        const advanced = this.advancedInfo()
        if (!Object.keys(advanced).length) return <div className={this.props.classes.emptyState}>고급 정보 없음</div>
        return <pre className={this.props.classes.jsonBox}>{JSON.stringify(advanced, null, 2)}</pre>
    }

    render() {
        const { classes } = this.props
        return (
            <div className={classes.root}>
                {this.renderSection('mold', <DeviceHubIcon />, 'Mold 네트워크 정보', 'VM NIC가 Mold의 어떤 네트워크에 연결되어 있는지 표시합니다.', this.renderMoldNetworkInfo())}
                {this.renderSection('basic', <InfoIcon />, '기본 정보', '인터페이스 식별 정보와 장치 속성입니다.', this.renderRows(this.basicRows(), '-', true))}
                {this.renderSection('connection', <DeviceHubIcon />, '연결 정보', 'Libvirt 메타데이터와 링크 플래그입니다.', this.renderConnectionInfo())}
                {this.renderSection('addresses', <SettingsInputComponentIcon />, '주소 정보', 'IPv4 / IPv6 주소를 분리해 표시합니다.', this.renderAddressInfo())}
                {this.renderSection('recent', <TimelineIcon />, '최근 수집 지표', '최근 수집된 트래픽 지표입니다.', this.renderMetricGrid(this.recentMetrics()))}
                {this.renderSection('accumulated', <TimelineIcon />, '누적 수집 지표', '누적 트래픽 카운터입니다.', this.renderMetricGrid(this.accumulatedMetrics()))}
                {this.renderSection('features', <SettingsInputComponentIcon />, '장비 기능', 'Offload 기능 목록입니다. true 항목을 먼저 표시합니다.', this.renderFeatures(), true)}
                {this.renderSection('advanced', <InfoIcon />, '고급 정보', 'FDB, 인접 장비, 라우팅 테이블과 raw 데이터입니다.', this.renderAdvanced(), true)}
            </div>
        )
    }
}

export default withStyles(styles)(VMNetworkDetailPanel)
