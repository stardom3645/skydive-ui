import * as React from 'react'
import IconButton from '@material-ui/core/IconButton'
import Tooltip from '@material-ui/core/Tooltip'
import FileCopyIcon from '@material-ui/icons/FileCopy'
import InfoIcon from '@material-ui/icons/Info'
import TimelineIcon from '@material-ui/icons/Timeline'
import DeviceHubIcon from '@material-ui/icons/DeviceHub'
import RouterIcon from '@material-ui/icons/Router'
import SecurityIcon from '@material-ui/icons/Security'
import StorageIcon from '@material-ui/icons/Storage'
import MemoryIcon from '@material-ui/icons/Memory'
import DnsIcon from '@material-ui/icons/Dns'
import { withStyles } from '@material-ui/core/styles'

import { Node } from '../Topology'
import { translate } from '../Config'
import { styles } from './HostDetailPanelStyles'

interface Props {
    classes: any
    node: Node
    moldInventory?: any
    vmNameMap?: Record<string, string>
    vmNetworkMap?: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>>
}

interface KeyValueRow {
    label: string
    value: any
    copy?: boolean
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
    nodeIDs?: string[]
    onClick?: () => void
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

const uniqueStrings = (values: any[]): string[] => {
    const seen = new Set<string>()
    return values.map(value => String(value || '').trim()).filter(value => {
        if (!value || seen.has(value)) return false
        seen.add(value)
        return true
    })
}

const normalizeMac = (value: any): string => String(value || '').toLowerCase().replace(/[^0-9a-f]/g, '')

class VMDetailPanel extends React.Component<Props> {
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
        const libvirtName = firstValue(data, ['Name', 'name'])
        return uniqueStrings([
            this.props.node.id,
            libvirtName,
            this.props.vmNameMap?.[libvirtName],
            firstValue(data, ['DisplayName', 'displayName', 'displayname']),
            firstValue(data, ['InstanceName', 'instanceName', 'instancename']),
            firstValue(data, ['UUID', 'uuid', 'ID', 'Id', 'id', 'ExtID', 'VirtualMachineID', 'virtualMachineId', 'vmid'])
        ])
    }

    private inventoryVMDetail(): any | undefined {
        const localKeys = this.vmKeys().map(value => value.toLowerCase())
        return this.inventoryVirtualMachines().find(vm => {
            const inventoryKeys = uniqueStrings([
                firstValue(vm, ['ID', 'Id', 'id', 'UUID', 'uuid', 'VirtualMachineID', 'virtualMachineId']),
                firstValue(vm, ['Name', 'name']),
                firstValue(vm, ['DisplayName', 'displayName', 'displayname']),
                firstValue(vm, ['InstanceName', 'instanceName', 'instancename'])
            ]).map(value => value.toLowerCase())
            return inventoryKeys.some(key => localKeys.indexOf(key) >= 0)
        })
    }

    private mergedData(): any {
        const inventoryVM = this.inventoryVMDetail()
        return {
            ...(this.props.node.data || {}),
            ...(inventoryVM || {})
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
        const visit = (node: Node) => {
            const children = node.children || []
            children.forEach(child => {
                const type = String(child.data?.Type || '').toLowerCase()
                if (networkTypes.indexOf(type) >= 0 && !seen.has(child.id)) {
                    seen.add(child.id)
                    result.push(child)
                }
                visit(child)
            })
        }
        visit(this.props.node)
        return result
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

    private macs(): string[] {
        const data = this.mergedData()
        const nicMacs = this.vmNetworkEntries().map(nic => nic.macAddress)
        return uniqueStrings([
            ...asArray(data.MAC),
            ...asArray(data.Mac),
            ...asArray(data.MACs),
            ...asArray(data.MacAddress),
            ...asArray(data.macaddress),
            ...nicMacs
        ].map(stringify).filter(Boolean))
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

    private renderValue(row: KeyValueRow) {
        const { classes } = this.props
        const value = stringify(row.value)
        const displayValue = value || 'N/A'
        return (
            <div className={classes.kvValueWrap}>
                <Tooltip title={displayValue} placement="top" arrow>
                    <span className={classes.kvValue}>{displayValue}</span>
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
        const visible = rows.filter(row => !isBlank(row.value))
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
        const visible = items.filter(item => item.value)
        if (!visible.length) return <div className={classes.emptyState}>{emptyText}</div>
        return (
            <div className={classes.connectedResourceGrid}>
                {visible.map(item => {
                    const canFocus = !!item.onClick || (!!item.nodeIDs && item.nodeIDs.length > 0)
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
                                <span className={classes.connectedResourceCardIcon}>{item.icon || <InfoIcon />}</span>
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

    private renderPills(values: string[], emptyText: string) {
        const { classes } = this.props
        if (!values.length) return <div className={classes.emptyState}>{emptyText}</div>
        return (
            <div className={classes.pillList}>
                {values.map(value => (
                    <Tooltip title={value} key={value} placement="top" arrow>
                        <span className={classes.pill}>{value}</span>
                    </Tooltip>
                ))}
            </div>
        )
    }

    render() {
        const { classes, node } = this.props
        const data = this.mergedData()
        const libvirtName = firstValue(data, ['Name', 'name']) || node.id
        const displayName = this.props.vmNameMap?.[libvirtName] || firstValue(data, ['DisplayName', 'displayName', 'displayname']) || libvirtName
        const instanceName = firstValue(data, ['InstanceName', 'instanceName', 'instancename'])
        const host = this.topologyHost()
        const hostName = host ? firstValue(host.data, ['Name', 'Hostname', 'HostName']) || host.id : firstValue(data, ['HostName', 'hostname', 'hostName', 'Host', 'host'])
        const ipList = this.ips()
        const macList = this.macs()
        const networkEntries = this.vmNetworkEntries()
        const topologyNetworkNodes = this.topologyNetworkNodes()
        const cpuCount = numberValue(data, ['CpuNumber', 'cpuNumber', 'CPUNumber', 'Cpus', 'cpus', 'CpuCount', 'cpuCount'])
        const memory = firstValue(data, ['Memory', 'memory', 'MemoryTotal', 'memoryTotal', 'MaxMemory', 'maxMemory'])
        const cpuPercent = numberValue(data, ['CPUPercent', 'cpuPercent', 'CpuUsagePercent', 'cpuUsagePercent', 'CPUUsage', 'cpuUsage'])
        const memoryPercent = numberValue(data, ['MemoryPercent', 'memoryPercent', 'MemoryUsagePercent', 'memoryUsagePercent'])
        const zone = firstValue(data, ['Zone', 'zone', 'ZoneName', 'zonename'])
        const pod = firstValue(data, ['Pod', 'pod', 'PodName', 'podname'])
        const cluster = firstValue(data, ['Cluster', 'cluster', 'ClusterName', 'clustername'])
        const account = firstValue(data, ['Account', 'account', 'AccountName', 'accountName'])
        const domain = firstValue(data, ['Domain', 'domain', 'DomainName', 'domainName'])
        const locationText = [zone, pod, cluster].filter(Boolean).join(' > ')
        const os = firstValue(data, ['OS', 'Os', 'OperatingSystem', 'osdisplayname', 'osDisplayName', 'GuestOS', 'guestOS'])
        const hypervisor = firstValue(data, ['Hypervisor', 'hypervisor', 'HypervisorType', 'hypervisorType'])
        const serviceOffering = firstValue(data, ['ServiceOffering', 'serviceOffering', 'ServiceOfferingName', 'serviceofferingname'])

        const basicRows: KeyValueRow[] = [
            { label: translate('vmName'), value: displayName, copy: true },
            { label: translate('vmLibvirtName'), value: libvirtName !== displayName ? libvirtName : '', copy: true },
            { label: translate('vmInstanceName'), value: instanceName, copy: true },
            { label: translate('vmId'), value: firstValue(data, ['UUID', 'uuid', 'ID', 'Id', 'id', 'ExtID', 'VirtualMachineID', 'virtualMachineId']), copy: true },
            { label: translate('vmType'), value: this.vmKind() },
            { label: translate('hostOperationalStatus'), value: this.statusText() },
            { label: translate('hostOS'), value: os },
            { label: translate('hostHypervisor'), value: hypervisor }
        ]

        const moldRows: KeyValueRow[] = [
            { label: translate('Hostname'), value: hostName, copy: true },
            { label: translate('hostLocation'), value: locationText },
            { label: translate('hostAccount'), value: account },
            { label: translate('hostDomain'), value: domain },
            { label: translate('vmServiceOffering'), value: serviceOffering },
            { label: translate('hostResourceState'), value: firstValue(data, ['ResourceState', 'resourceState', 'AllocationState', 'allocationState']) }
        ]

        const resourceMetrics: MetricItem[] = [
            { label: translate('hostCpuUsage'), value: cpuPercent !== undefined ? `${cpuPercent}%` : (cpuCount !== undefined ? String(cpuCount) : ''), sub: cpuCount !== undefined ? `${cpuCount} vCPU` : undefined, percent: cpuPercent, icon: <DnsIcon /> },
            { label: translate('hostMemoryUsage'), value: memoryPercent !== undefined ? `${memoryPercent}%` : memory, sub: memoryPercent !== undefined ? memory : undefined, percent: memoryPercent, icon: <MemoryIcon /> },
            { label: translate('hostStorageUsage'), value: firstValue(data, ['RootDiskSize', 'rootDiskSize', 'DiskSize', 'diskSize', 'Storage', 'storage']), icon: <StorageIcon /> }
        ]

        const networkMetrics: MetricItem[] = [
            { label: translate('hostRepresentativeIp'), value: ipList[0] || '', icon: <RouterIcon /> },
            { label: translate('hostIpCount'), value: ipList.length ? String(ipList.length) : '', icon: <RouterIcon /> },
            { label: translate('hostMacCount'), value: macList.length ? String(macList.length) : '', icon: <SecurityIcon /> },
            { label: translate('hostNetworkCount'), value: networkEntries.length ? String(networkEntries.length) : (topologyNetworkNodes.length ? String(topologyNetworkNodes.length) : ''), icon: <DeviceHubIcon /> }
        ]

        const eventRows: KeyValueRow[] = [
            { label: translate('hostLastUpdate'), value: formatDate(firstValue(data, ['UpdatedAt', 'LastUpdate', 'LastSeen', '@UpdatedAt', '@CreatedAt', 'CreatedAt'])) },
            { label: translate('hostRecentEvent'), value: firstValue(data, ['RecentEvent', 'LastEvent', 'Event']) },
            { label: translate('hostRecentCapture'), value: firstValue(data, ['RecentCapture', 'LastCapture', 'CaptureState']) },
            { label: translate('hostRecentStateChange'), value: formatDate(firstValue(data, ['StateChangedAt', 'LastStateChange', 'StatusChangedAt'])) }
        ]

        const connectedResources: OverviewCardItem[] = [
            { label: translate('infrastructureHosts'), value: hostName ? '1' : '', icon: <DnsIcon />, nodeIDs: host ? [host.id] : [] },
            { label: translate('hostNetworkCount'), value: topologyNetworkNodes.length ? String(topologyNetworkNodes.length) : '', icon: <DeviceHubIcon />, nodeIDs: topologyNetworkNodes.map(item => item.id) },
            { label: translate('vmNics'), value: networkEntries.length ? String(networkEntries.length) : '', icon: <RouterIcon /> }
        ]

        const nicPills = networkEntries.map(nic => {
            const macMatch = macList.find(mac => normalizeMac(mac) === normalizeMac(nic.macAddress))
            return [nic.networkName, nic.ipAddress, macMatch || nic.macAddress].filter(Boolean).join(' / ')
        })
        const hasResourceMetrics = resourceMetrics.some(item => !isBlank(item.value))
        const hasRecentSignals = eventRows.some(row => !isBlank(row.value))
        const hasMoldRows = moldRows.some(row => !isBlank(row.value))

        return (
            <div className={classes.root}>
                {this.renderSection(<InfoIcon />, translate('vmBasicInfo'), translate('vmOverviewDescription'), this.renderRows(basicRows))}
                {hasResourceMetrics && this.renderSection(<TimelineIcon />, translate('hostResourceUsage'), translate('vmResourceUsageDescription'), this.renderMetricGrid(resourceMetrics))}
                {this.renderSection(<DeviceHubIcon />, translate('hostConnectedResources'), translate('vmConnectedResourcesDescription'), this.renderOverviewGrid(connectedResources))}
                {this.renderSection(<RouterIcon />, translate('hostNetworkSummary'), translate('vmNetworkSummaryDescription'), (
                    <React.Fragment>
                        {this.renderMetricGrid(networkMetrics, translate('hostNetworkDetailsMissing'))}
                        {this.renderPills(nicPills, translate('vmNoNicInfo'))}
                    </React.Fragment>
                ))}
                {hasMoldRows && this.renderSection(<StorageIcon />, translate('hostMoldContext'), translate('vmMoldContextDescription'), this.renderRows(moldRows))}
                {hasRecentSignals && this.renderSection(<InfoIcon />, translate('hostRecentSignals'), translate('hostRecentSignalsDescription'), this.renderRows(eventRows, translate('hostNoRecentSignals')))}
                {this.renderSection(<InfoIcon />, translate('hostRawInfo'), '', (
                    <pre className={classes.codeBlock}>{JSON.stringify(data, null, 2)}</pre>
                ))}
            </div>
        )
    }
}

export default withStyles(styles)(VMDetailPanel)
