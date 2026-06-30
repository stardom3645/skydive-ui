import * as React from 'react'
import IconButton from '@material-ui/core/IconButton'
import Tooltip from '@material-ui/core/Tooltip'
import FileCopyIcon from '@material-ui/icons/FileCopy'
import InfoIcon from '@material-ui/icons/Info'
import TimelineIcon from '@material-ui/icons/Timeline'
import DeviceHubIcon from '@material-ui/icons/DeviceHub'
import StorageIcon from '@material-ui/icons/Storage'
import MemoryIcon from '@material-ui/icons/Memory'
import DnsIcon from '@material-ui/icons/Dns'
import { withStyles } from '@material-ui/core/styles'

import { Node } from '../Topology'
import { translate } from '../Config'
import { session } from '../Store'
import { styles } from './HostDetailPanelStyles'
import HostResourceTrendPanel from './HostResourceTrendPanel'

interface Props {
    classes: any
    node: Node
    session?: session
    moldInventory?: any
    vmNameMap?: Record<string, string>
    vmNetworkMap?: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>>
    vmDetailMap?: Record<string, any>
}

interface KeyValueRow {
    label: string
    value: any
    copy?: boolean
    alwaysShow?: boolean
    variant?: 'status'
}

interface MetricItem {
    label: string
    value: string
    sub?: string
    percent?: number
    icon?: React.ReactNode
}

interface OverviewCardItem {
    label: string
    value: string
    icon?: React.ReactNode
    iconContainerClassName?: string
    nodeIDs?: string[]
    onClick?: () => void
    alwaysShow?: boolean
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
    if (Array.isArray(value)) return value.map(v => stringify(v)).filter(Boolean).join(', ')
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch (e) {
            return String(value)
        }
    }
    return String(value)
}

const firstValue = (data: any, keys: string[]): string => {
    for (const key of keys) {
        const value = stringify(data?.[key])
        if (value) return value
    }
    return ''
}

const numberValue = (data: any, keys: string[]): number | undefined => {
    for (const key of keys) {
        const raw = data?.[key]
        if (raw === undefined || raw === null || raw === '') continue
        const value = Number(raw)
        if (!Number.isNaN(value)) return value
    }
    return undefined
}

const formatDate = (value: any): string => {
    if (isBlank(value)) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return stringify(value)
    return date.toLocaleString()
}

const trimFixed = (value: number, digits = 1): string => {
    return value.toFixed(digits).replace(/\.0$/, '')
}

const uniqueStrings = (values: any[]): string[] => {
    const seen = new Set<string>()
    return values.map(value => String(value || '').trim()).filter(value => {
        if (!value || seen.has(value)) return false
        seen.add(value)
        return true
    })
}

class VMDetailPanel extends React.Component<Props> {
    private virtualNetworkTypes = ['tap', 'tun', 'tuntap']

    private copyValue(value: string) {
        if (!value) return
        const nav: any = navigator
        if (nav.clipboard && nav.clipboard.writeText) {
            nav.clipboard.writeText(value)
        }
    }

    private inventoryVirtualMachines(): any[] {
        const inventory = this.props.moldInventory
        const candidates = [
            inventory?.virtualMachines,
            inventory?.virtualmachines,
            inventory?.vms,
            inventory?.VMs,
            inventory?.data?.virtualMachines,
            inventory?.data?.virtualmachines,
            inventory?.data?.vms,
            inventory?.inventory?.virtualMachines,
            inventory?.inventory?.virtualmachines,
            inventory?.listvirtualmachinesresponse?.virtualmachine,
            inventory?.listVirtualMachinesResponse?.virtualmachine,
            inventory?.ListVirtualMachinesResponse?.VirtualMachine,
            inventory?.items
        ]
        for (const candidate of candidates) {
            if (Array.isArray(candidate)) return candidate
        }
        return []
    }

    private vmKeys(data: any = this.props.node.data || {}): string[] {
        const libvirtName = firstValue(data, ['Name', 'name', 'InstanceName', 'instanceName', 'instancename', 'instance_name'])
        return uniqueStrings([
            this.props.node.id,
            libvirtName,
            this.props.vmNameMap?.[libvirtName],
            firstValue(data, ['DisplayName', 'displayName', 'displayname']),
            firstValue(data, ['Name', 'name', 'VMName', 'vmName']),
            firstValue(data, ['InstanceName', 'instanceName', 'instancename', 'instance_name']),
            firstValue(data, ['UUID', 'uuid', 'ID', 'Id', 'id', 'ExtID', 'VirtualMachineID', 'virtualMachineId', 'vmid', 'vm_id'])
        ])
    }

    private inventoryVMDetail(): any | undefined {
        const localKeys = this.vmKeys().map(value => value.toLowerCase())
        const detailMap = this.props.vmDetailMap || {}
        for (const key of this.vmKeys()) {
            const found = detailMap[key] || detailMap[key.toLowerCase()]
            if (found) return found
        }
        return this.inventoryVirtualMachines().find(vm => {
            const inventoryKeys = uniqueStrings([
                firstValue(vm, ['ID', 'Id', 'id', 'UUID', 'uuid', 'VirtualMachineID', 'virtualMachineId', 'vmid', 'vm_id']),
                firstValue(vm, ['Name', 'name', 'VMName', 'vmName']),
                firstValue(vm, ['DisplayName', 'displayName', 'displayname']),
                firstValue(vm, ['InstanceName', 'instanceName', 'instancename', 'instance_name'])
            ]).map(value => value.toLowerCase())
            return inventoryKeys.some(key => localKeys.indexOf(key) >= 0)
        })
    }

    private normalizeMoldVM(vm: any): any {
        return {
            ...vm,
            UUID: firstValue(vm, ['UUID', 'uuid', 'ID', 'Id', 'id', 'VirtualMachineID', 'virtualMachineId', 'vmid', 'vm_id']),
            Name: firstValue(vm, ['Name', 'name', 'VMName', 'vmName']),
            DisplayName: firstValue(vm, ['DisplayName', 'displayName', 'displayname']),
            InstanceName: firstValue(vm, ['InstanceName', 'instanceName', 'instancename', 'instance_name']),
            State: firstValue(vm, ['State', 'state', 'Status', 'status']),
            HostName: firstValue(vm, ['HostName', 'hostName', 'hostname', 'Host', 'host']),
            PrivateIpAddress: firstValue(vm, ['PrivateIpAddress', 'privateIpAddress', 'privateipaddress', 'IpAddress', 'ipAddress', 'ipaddress']),
            GuestOS: firstValue(vm, ['GuestOS', 'guestOS', 'guestos', 'OsDisplayName', 'osDisplayName', 'osdisplayname', 'OS', 'os']),
            CpuNumber: firstValue(vm, ['CpuNumber', 'cpuNumber', 'cpunumber', 'Cpus', 'cpus', 'CpuCount', 'cpuCount', 'cpucount']),
            Memory: firstValue(vm, ['Memory', 'memory', 'MemoryTotal', 'memoryTotal', 'memorytotal', 'MaxMemory', 'maxMemory', 'maxmemory'])
        }
    }

    private mergedData(): any {
        const inventoryVM = this.inventoryVMDetail()
        return {
            ...(this.props.node.data || {}),
            ...(inventoryVM ? this.normalizeMoldVM(inventoryVM) : {})
        }
    }

    private vmNetworkEntries(): Array<{ networkName: string, macAddress: string, ipAddress: string }> {
        const data = this.mergedData()
        const map = this.props.vmNetworkMap || {}
        for (const key of this.vmKeys(data)) {
            const found = map[key]
            if (Array.isArray(found) && found.length > 0) return found
        }

        const nics = [
            ...asArray(data.Nic),
            ...asArray(data.NIC),
            ...asArray(data.Nics),
            ...asArray(data.NICs),
            ...asArray(data.nic),
            ...asArray(data.nics)
        ]
        return nics.map(nic => ({
            networkName: firstValue(nic, ['NetworkName', 'networkName', 'networkname', 'Name', 'name']),
            macAddress: firstValue(nic, ['MacAddress', 'macAddress', 'macaddress', 'MAC', 'Mac']),
            ipAddress: firstValue(nic, ['IpAddress', 'ipAddress', 'ipaddress', 'IP', 'IPv4', 'ipv4'])
        })).filter(nic => nic.networkName || nic.macAddress || nic.ipAddress)
    }

    private topologyHost(): Node | undefined {
        let parent = this.props.node.parent
        while (parent) {
            if (String(parent.data?.Type || '').toLowerCase() === 'host') {
                return parent
            }
            parent = parent.parent
        }
        return undefined
    }

    private topologyNetworkNodes(): Node[] {
        const networkTypes = [
            'device',
            'bond',
            'bridge',
            'vlan',
            'switch',
            'switchport',
            'patch',
            'port',
            'ovsbridge',
            'openvswitch',
            'ovsport',
            'tun',
            'tap',
            'tuntap',
            'internal',
            'interface',
            'veth',
            'vxlan',
            'geneve',
            'gre',
            'gretap'
        ]
        const seen = new Set<string>()
        const result: Node[] = []
        const maybeAdd = (node: Node) => {
            const type = String(node.data?.Type || '').toLowerCase()
            if (networkTypes.indexOf(type) >= 0 && !seen.has(node.id)) {
                seen.add(node.id)
                result.push(node)
            }
        }
        const visit = (node: Node) => {
            const children = node.children || []
            children.forEach(child => {
                maybeAdd(child)
                visit(child)
            })
        }
        visit(this.props.node)
        let parent = this.props.node.parent
        while (parent) {
            if (String(parent.data?.Type || '').toLowerCase() === 'host') {
                break
            }
            maybeAdd(parent)
            parent = parent.parent
        }
        return result
    }

    private nodeName(node: Node): string {
        return firstValue(node.data, ['Name', 'name', 'IfName', 'ifname']) || node.id
    }

    private topologyNicNodes(): Node[] {
        return this.topologyNetworkNodes().filter(node => {
            const type = String(node.data?.Type || '').toLowerCase()
            const driver = String(node.data?.Driver || '').toLowerCase()
            return type === 'device' || driver === 'device'
        })
    }

    private topologyHostBridgeNodes(): Node[] {
        return this.topologyNetworkNodes().filter(node => {
            const type = String(node.data?.Type || '').toLowerCase()
            const driver = String(node.data?.Driver || '').toLowerCase()
            const name = this.nodeName(node).toLowerCase()
            return type === 'bridge' || driver === 'bridge' || type === 'ovsbridge' || /^br/.test(name)
        })
    }

    private topologyVMNetworkNodes(): Node[] {
        const bridgeIDs = new Set(this.topologyHostBridgeNodes().map(node => node.id))
        const nicIDs = new Set(this.topologyNicNodes().map(node => node.id))
        return this.topologyNetworkNodes().filter(node => {
            if (bridgeIDs.has(node.id) || nicIDs.has(node.id)) return false
            const type = String(node.data?.Type || '').toLowerCase()
            const driver = String(node.data?.Driver || '').toLowerCase()
            const name = this.nodeName(node).toLowerCase()
            return this.virtualNetworkTypes.indexOf(type) >= 0 || this.virtualNetworkTypes.indexOf(driver) >= 0 || /^vnet/.test(name)
        })
    }

    private topologyNetworkLayerNodes(): Node[] {
        const vmNetworkIDs = new Set(this.topologyVMNetworkNodes().map(node => node.id))
        if (vmNetworkIDs.size > 0) {
            return this.topologyNetworkNodes().filter(node => vmNetworkIDs.has(node.id))
        }
        return this.topologyNetworkNodes().filter(node => {
            const type = String(node.data?.Type || '').toLowerCase()
            const driver = String(node.data?.Driver || '').toLowerCase()
            return type !== 'device' && driver !== 'device' && type !== 'bridge' && driver !== 'bridge' && type !== 'ovsbridge'
        })
    }

    private ips(): string[] {
        const data = this.mergedData()
        const nicIps = this.vmNetworkEntries().map(nic => nic.ipAddress)
        return uniqueStrings([
            ...asArray(data.IPV4),
            ...asArray(data.IPV6),
            ...asArray(data.IP),
            ...asArray(data.Addr),
            ...asArray(data.IpAddress),
            ...asArray(data.ipaddress),
            ...nicIps
        ].map(stringify).filter(Boolean))
    }

    private privateIp(): string {
        const data = this.mergedData()
        return firstValue(data, [
            'PrivateIP',
            'PrivateIp',
            'privateIp',
            'privateip',
            'PrivateIpAddress',
            'privateIpAddress',
            'privateipaddress',
            'IpAddress',
            'ipAddress',
            'ipaddress'
        ]) || this.vmNetworkEntries().map(nic => nic.ipAddress).find(Boolean) || this.ips()[0] || ''
    }

    private publicIp(): string {
        const data = this.mergedData()
        const nics = [
            ...asArray(data.Nic),
            ...asArray(data.NIC),
            ...asArray(data.Nics),
            ...asArray(data.NICs),
            ...asArray(data.nic),
            ...asArray(data.nics)
        ]
        const fromNic = nics.map(nic => firstValue(nic, [
            'PublicIP',
            'PublicIp',
            'publicIp',
            'publicip',
            'PublicIpAddress',
            'publicIpAddress',
            'publicipaddress'
        ])).find(Boolean)
        return firstValue(data, [
            'PublicIP',
            'PublicIp',
            'publicIp',
            'publicip',
            'PublicIpAddress',
            'publicIpAddress',
            'publicipaddress',
            'PublicAddress',
            'publicAddress',
            'NatIp',
            'NATIP'
        ]) || fromNic || ''
    }

    private statusText(): string {
        const data = this.mergedData()
        const state = firstValue(data, ['State', 'state', 'Status', 'status', 'PowerState', 'powerState'])
        if (!state) return translate('hostStatusCollected')
        const normalized = state.toLowerCase()
        if (normalized === 'running' || normalized === 'up' || normalized === 'ok' || normalized === 'active') {
            return translate('hostStatusNormal')
        }
        return state
    }

    private formatMemory(value: string): string {
        const text = stringify(value)
        if (!text) return ''
        const match = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/)
        if (!match) return text

        const mb = Number(match[0])
        if (Number.isNaN(mb) || mb <= 0) return text
        const gb = mb / 1024
        return `${trimFixed(mb, mb >= 10 ? 0 : 1)} MB (${trimFixed(gb, gb >= 10 ? 0 : 1)} GB)`
    }

    private vmKind(): string {
        const name = firstValue(this.mergedData(), ['Name', 'name']) || this.props.node.id
        if (/^r-/.test(name)) return translate('infrastructureRouters')
        if (/^(s-|v-)/.test(name) || name === 'ccvm' || name === 'scvm') return translate('infrastructureSystemVMs')
        return translate('infrastructureUserVMs')
    }

    private focusNodeIDs(nodeIDs: string[]) {
        const app = (window as any).App
        if (app && typeof app.focusInfrastructureNodeIDs === 'function' && nodeIDs.length > 0) {
            app.focusInfrastructureNodeIDs(nodeIDs)
        }
    }

    private layerIcon(glyph: string) {
        const { classes } = this.props
        return <span className={`${classes.connectedResourceFaIcon} fa fas fa-fw`}>{glyph}</span>
    }

    private renderValue(row: KeyValueRow) {
        const { classes } = this.props
        const value = stringify(row.value)
        const displayValue = value || 'N/A'
        return (
            <div className={classes.kvValueWrap}>
                <Tooltip title={displayValue} placement="top" arrow>
                    {row.variant === 'status'
                        ? (
                            <span className={classes.kvStatusBadge}>
                                <span className={classes.kvStatusDot} />
                                <span>{displayValue}</span>
                            </span>
                        )
                        : <span className={classes.kvValue}>{displayValue}</span>
                    }
                </Tooltip>
                {row.copy && value && (
                    <Tooltip title={translate('copy')} placement="top" arrow>
                        <IconButton className={classes.copyButton} onClick={() => this.copyValue(value)}>
                            <FileCopyIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </div>
        )
    }

    private renderRows(rows: KeyValueRow[], emptyText = translate('hostNoData')) {
        const { classes } = this.props
        const visible = rows.filter(row => row.alwaysShow || !isBlank(row.value))
        if (!visible.length) return <div className={classes.emptyState}>{emptyText}</div>
        return (
            <div className={classes.rowsCompact}>
                {visible.map(row => (
                    <div className={classes.kvRow} key={row.label}>
                        <div className={classes.kvLabel}>{row.label}</div>
                        {this.renderValue(row)}
                    </div>
                ))}
            </div>
        )
    }

    private renderSection(icon: React.ReactNode, title: string, description: string, children: React.ReactNode) {
        const { classes } = this.props
        return (
            <section className={classes.panelCard}>
                <div className={classes.panelHeader}>
                    <span className={classes.panelIcon}>{icon}</span>
                    <div className={classes.panelTitleBlock}>
                        <div className={classes.panelTitle}>{title}</div>
                        {description && <div className={classes.panelDescription}>{description}</div>}
                    </div>
                </div>
                {children}
            </section>
        )
    }

    private renderMetricGrid(items: MetricItem[], emptyText = translate('hostNoResourceMetrics')) {
        const { classes } = this.props
        const visible = items.filter(item => item.value)
        if (!visible.length) return <div className={classes.emptyState}>{emptyText}</div>
        return (
            <div className={classes.metricGrid}>
                {visible.map(item => (
                    <div className={classes.metricTile} key={item.label}>
                        <span className={classes.metricIcon}>{item.icon || <InfoIcon />}</span>
                        <div className={classes.metricBody}>
                            <div className={classes.metricLabel}>{item.label}</div>
                            <div className={classes.metricValue}>{item.value}</div>
                            {item.sub && <div className={classes.metricSub}>{item.sub}</div>}
                            {item.percent !== undefined && (
                                <div className={classes.progressTrack}>
                                    <div className={classes.progressFill} style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }} />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    private renderOverviewGrid(items: OverviewCardItem[], emptyText = translate('hostNoConnectedResources')) {
        const { classes } = this.props
        const visible = items.filter(item => item.alwaysShow || item.value)
        if (!visible.length) return <div className={classes.emptyState}>{emptyText}</div>
        return (
            <div className={classes.connectedResourceGrid}>
                {visible.map(item => {
                    const canFocus = !!item.onClick || (!!item.nodeIDs && item.nodeIDs.length > 0)
                    const iconContainerClassName = `${classes.connectedResourceCardIcon}${item.iconContainerClassName ? ` ${item.iconContainerClassName}` : ''}`
                    return (
                        <button
                            type="button"
                            className={`${classes.connectedResourceCard} ${canFocus ? classes.connectedResourceCardClickable : classes.connectedResourceCardStatic}`}
                            key={item.label}
                            onClick={() => {
                                if (!canFocus) return
                                if (item.onClick) {
                                    item.onClick()
                                    return
                                }
                                this.focusNodeIDs(item.nodeIDs || [])
                            }}
                            aria-disabled={!canFocus}
                            tabIndex={canFocus ? 0 : -1}>
                            <span className={classes.connectedResourceCardMain}>
                                <span className={iconContainerClassName}>{item.icon || <InfoIcon />}</span>
                                <span>
                                    <strong>{item.label}</strong>
                                </span>
                            </span>
                            <span className={classes.connectedResourceCardValue}>{item.value}</span>
                            <span className={`${classes.connectedResourceCardAction} ${!canFocus ? classes.connectedResourceCardActionHidden : ''}`} aria-hidden={!canFocus}>›</span>
                        </button>
                    )
                })}
            </div>
        )
    }

    render() {
        const { classes, node } = this.props
        const nodeData = node.data || {}
        const data = this.mergedData()
        const libvirtName = firstValue(nodeData, ['Name', 'name', 'InstanceName', 'instanceName', 'instancename']) || node.id
        const displayName = this.props.vmNameMap?.[libvirtName] || firstValue(data, ['DisplayName', 'displayName', 'displayname']) || firstValue(data, ['Name', 'name']) || libvirtName
        const host = this.topologyHost()
        const hostName = host ? firstValue(host.data, ['Name', 'Hostname', 'HostName']) || host.id : firstValue(data, ['HostName', 'hostname', 'hostName', 'Host', 'host'])
        const topologyNetworkLayerNodes = this.topologyNetworkLayerNodes()
        const cpuCount = numberValue(data, ['CpuNumber', 'cpuNumber', 'CPUNumber', 'Cpus', 'cpus', 'CpuCount', 'cpuCount'])
        const memory = firstValue(data, ['Memory', 'memory', 'MemoryTotal', 'memoryTotal', 'MaxMemory', 'maxMemory'])
        const cpuPercent = numberValue(data, ['CPUPercent', 'cpuPercent', 'CpuUsagePercent', 'cpuUsagePercent', 'CPUUsage', 'cpuUsage'])
        const memoryPercent = numberValue(data, ['MemoryPercent', 'memoryPercent', 'MemoryUsagePercent', 'memoryUsagePercent'])
        const os = firstValue(data, ['OS', 'Os', 'OperatingSystem', 'osdisplayname', 'osDisplayName', 'GuestOS', 'guestOS'])

        const basicRows: KeyValueRow[] = [
            { label: translate('vmName'), value: displayName, copy: true, alwaysShow: true },
            { label: 'Host', value: hostName, copy: true, alwaysShow: true },
            { label: translate('hostOperationalStatus'), value: this.statusText(), alwaysShow: true, variant: 'status' },
            { label: translate('vmPrivateIp'), value: this.privateIp(), copy: true, alwaysShow: true },
            { label: translate('vmLibvirtName'), value: libvirtName, copy: true, alwaysShow: true },
            { label: 'UUID', value: firstValue(data, ['UUID', 'uuid', 'ID', 'Id', 'id', 'ExtID', 'VirtualMachineID', 'virtualMachineId']), copy: true, alwaysShow: true },
            { label: 'Guest OS', value: os, alwaysShow: true },
            { label: translate('vmCpu'), value: cpuCount !== undefined ? `${cpuCount} vCPU` : '', copy: false, alwaysShow: true },
            { label: translate('vmMemory'), value: this.formatMemory(memory), copy: false, alwaysShow: true }
        ]

        const resourceMetrics: MetricItem[] = [
            { label: translate('hostCpuUsage'), value: cpuPercent !== undefined ? `${cpuPercent}%` : (cpuCount !== undefined ? String(cpuCount) : ''), sub: cpuCount !== undefined ? `${cpuCount} vCPU` : undefined, percent: cpuPercent, icon: <DnsIcon /> },
            { label: translate('hostMemoryUsage'), value: memoryPercent !== undefined ? `${memoryPercent}%` : memory, sub: memoryPercent !== undefined ? memory : undefined, percent: memoryPercent, icon: <MemoryIcon /> },
            { label: translate('hostStorageUsage'), value: firstValue(data, ['RootDiskSize', 'rootDiskSize', 'DiskSize', 'diskSize', 'Storage', 'storage']), icon: <StorageIcon /> }
        ]

        const topologyNicNodes = this.topologyNicNodes()
        const topologyHostBridgeNodes = this.topologyHostBridgeNodes()
        const eventRows: KeyValueRow[] = [
            { label: translate('hostLastUpdate'), value: formatDate(firstValue(data, ['UpdatedAt', 'LastUpdate', 'LastSeen', '@UpdatedAt', '@CreatedAt', 'CreatedAt'])) },
            { label: translate('hostRecentEvent'), value: firstValue(data, ['RecentEvent', 'LastEvent', 'Event']) },
            { label: translate('hostRecentCapture'), value: firstValue(data, ['RecentCapture', 'LastCapture', 'CaptureState']) },
            { label: translate('hostRecentStateChange'), value: formatDate(firstValue(data, ['StateChangedAt', 'LastStateChange', 'StatusChangedAt'])) }
        ]

        const connectedResources: OverviewCardItem[] = [
            { label: translate('infrastructureHosts'), value: hostName ? '1' : '0', icon: this.layerIcon('\uf233'), iconContainerClassName: classes.connectedResourceHostIcon, nodeIDs: host ? [host.id] : [], alwaysShow: true },
            { label: translate('vmNics'), value: String(topologyNicNodes.length), icon: this.layerIcon('\uf538'), iconContainerClassName: classes.connectedResourceNicIcon, nodeIDs: topologyNicNodes.map(item => item.id), alwaysShow: true },
            { label: translate('host-bridges'), value: String(topologyHostBridgeNodes.length), icon: this.layerIcon('\uf542'), iconContainerClassName: classes.connectedResourceBridgeIcon, nodeIDs: topologyHostBridgeNodes.map(item => item.id), alwaysShow: true },
            { label: translate('hostNetworkCount'), value: String(topologyNetworkLayerNodes.length), icon: this.layerIcon('\uf6ff'), iconContainerClassName: classes.connectedResourceNetworkIcon, nodeIDs: topologyNetworkLayerNodes.map(item => item.id), alwaysShow: true }
        ]

        const hasResourceMetrics = resourceMetrics.some(item => !isBlank(item.value))
        const hasRecentSignals = eventRows.some(row => !isBlank(row.value))

        return (
            <div className={classes.root}>
                {this.renderSection(<InfoIcon />, translate('hostBasicInfo'), translate('vmOverviewDescription'), this.renderRows(basicRows))}
                <HostResourceTrendPanel node={node} session={this.props.session} data={data} target="vm" />
                {hasResourceMetrics && this.renderSection(<TimelineIcon />, translate('hostResourceUsage'), translate('vmResourceUsageDescription'), this.renderMetricGrid(resourceMetrics))}
                {this.renderSection(<DeviceHubIcon />, translate('hostConnectedResources'), translate('vmConnectedResourcesDescription'), this.renderOverviewGrid(connectedResources))}
                {hasRecentSignals && this.renderSection(<InfoIcon />, translate('hostRecentSignals'), translate('hostRecentSignalsDescription'), this.renderRows(eventRows, translate('hostNoRecentSignals')))}
                {this.renderSection(<InfoIcon />, translate('hostRawInfo'), '', (
                    <pre className={classes.codeBlock}>{JSON.stringify(data, null, 2)}</pre>
                ))}
            </div>
        )
    }
}

export default withStyles(styles)(VMDetailPanel)
