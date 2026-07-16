import * as React from 'react'
import { Card, Progress, Statistic } from 'antd'
import InfoIcon from '@material-ui/icons/Info'
import DeviceHubIcon from '@material-ui/icons/DeviceHub'
import StorageIcon from '@material-ui/icons/Storage'
import MemoryIcon from '@material-ui/icons/Memory'
import DnsIcon from '@material-ui/icons/Dns'
import { withStyles } from '@material-ui/core/styles'

import { Node } from '../Topology'
import { translate } from '../Config'
import { session } from '../Store'
import { styles } from './VMDetailPanelStyles'
import HostResourceTrendPanel from './HostResourceTrendPanel'
import {
    DetailBadge,
    DetailEmpty,
    DetailKeyValueList,
    DetailResourceCard,
    DetailResourceGrid,
    DetailResourceIconTone,
    DetailSection
} from './common'

interface Props {
    classes: any
    node: Node
    session?: session
    moldInventory?: any
    vmNameMap?: Record<string, string>
    vmNetworkMap?: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>>
    vmDetailMap?: Record<string, any>
    systemVM?: boolean
    managementServers?: any[]
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
    iconTone?: DetailResourceIconTone
    nodeIDs?: string[]
    onClick?: () => void
    alwaysShow?: boolean
}

const isBlank = (value: any): boolean => {
    if (value === undefined || value === null) return true
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        return normalized === '' || normalized === '-' || normalized === 'n/a'
    }
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

const firstRawValue = (data: any, keys: string[]): any => {
    for (const key of keys) {
        const value = data?.[key]
        if (!isBlank(value)) return value
    }
    return undefined
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
        const topologyName = firstValue(this.props.node.data || {}, ['Name', 'name']).toLowerCase()
        if (topologyName === 'ccvm' || topologyName === 'scvm') return undefined

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

    private managementServerDetail(): any | undefined {
        const nodeData = this.props.node.data || {}
        if (firstValue(nodeData, ['Name', 'name']).toLowerCase() !== 'ccvm') return undefined

        const inventory = this.props.moldInventory
        const candidates = [
            this.props.managementServers,
            inventory?.managementServers,
            inventory?.managementservers,
            inventory?.data?.managementServers,
            inventory?.data?.managementservers,
            inventory?.inventory?.managementServers,
            inventory?.inventory?.managementservers,
            inventory?.listmanagementserversmetricsresponse?.managementserver,
            inventory?.listmanagementserversresponse?.managementserver
        ]
        const servers = candidates.find(candidate => Array.isArray(candidate)) || []
        const nodeName = firstValue(nodeData, ['Name', 'name']).toLowerCase()
        const nodeIPs = [
            ...asArray(nodeData.IPV4),
            ...asArray(nodeData.IPV6),
            ...asArray(nodeData.IP)
        ].map(value => stringify(value).split('/')[0].toLowerCase()).filter(Boolean)

        return servers.find(server => {
            const serverName = firstValue(server, ['name']).toLowerCase()
            const serviceIP = firstValue(server, ['serviceip']).split('/')[0].toLowerCase()
            return serverName === nodeName || (!!serviceIP && nodeIPs.includes(serviceIP))
        })
    }

    private managementValue(data: any, key: string, date = false): string {
        const value = firstRawValue(data, [key])
        if (isBlank(value)) return ''
        if (date) return formatDate(value)
        if (Array.isArray(value)) return `[ ${value.map(item => stringify(item)).join(', ')} ]`
        return stringify(value)
    }

    private managementRows(data: any): KeyValueRow[] {
        return [
            { label: translate('managementCollectionTime'), value: this.managementValue(data, 'collectiontime', true) },
            { label: translate('managementUsageLocal'), value: this.managementValue(data, 'usageislocal') },
            { label: translate('managementDbLocal'), value: this.managementValue(data, 'dbislocal') },
            { label: translate('managementLastStart'), value: this.managementValue(data, 'lastserverstart', true) },
            { label: translate('managementLastStop'), value: this.managementValue(data, 'lastserverstop', true) },
            { label: translate('managementLastBoot'), value: this.managementValue(data, 'lastboottime', true) },
            { label: translate('version'), value: this.managementValue(data, 'version') }
        ]
    }

    private managementResourceRows(data: any): KeyValueRow[] {
        return [
            { label: translate('managementSystemCpu'), value: this.managementValue(data, 'systemtotalcpucycles') },
            { label: translate('managementLoadAverages'), value: this.managementValue(data, 'systemloadaverages') },
            { label: translate('managementCycleUsage'), value: this.managementValue(data, 'systemcycleusage') },
            { label: translate('managementSystemMemoryTotal'), value: this.managementValue(data, 'systemmemorytotal') },
            { label: translate('managementSystemMemoryFree'), value: this.managementValue(data, 'systemmemoryfree') },
            { label: translate('managementVirtualMemory'), value: this.managementValue(data, 'systemmemoryvirtualsize') },
            { label: translate('managementAvailableProcessors'), value: this.managementValue(data, 'availableprocessors') },
            { label: translate('managementOsDistribution'), value: this.managementValue(data, 'osdistribution') },
            { label: translate('managementKernelVersion'), value: this.managementValue(data, 'kernelversion') }
        ]
    }

    private managementJvmRows(data: any): KeyValueRow[] {
        return [
            { label: translate('managementJavaDistribution'), value: this.managementValue(data, 'javadistribution') },
            { label: translate('managementJavaVersion'), value: this.managementValue(data, 'javaversion') },
            { label: translate('managementAgentCount'), value: this.managementValue(data, 'agentcount') },
            { label: translate('managementSessions'), value: this.managementValue(data, 'sessions') },
            { label: translate('managementHeapUsed'), value: this.managementValue(data, 'heapmemoryused') },
            { label: translate('managementHeapTotal'), value: this.managementValue(data, 'heapmemorytotal') },
            { label: translate('managementThreadsBlocked'), value: this.managementValue(data, 'threadsblockedcount') },
            { label: translate('managementThreadsRunnable'), value: this.managementValue(data, 'threadsrunnablecount') },
            { label: translate('managementThreadsTotal'), value: this.managementValue(data, 'threadstotalcount') },
            { label: translate('managementThreadsWaiting'), value: this.managementValue(data, 'threadswaitingcount') },
            { label: translate('managementLogInfo'), value: this.managementValue(data, 'loginfo') }
        ]
    }

    private focusNodeIDs(nodeIDs: string[]) {
        const app = (window as any).App
        if (app && typeof app.focusInfrastructureNodeIDs === 'function' && nodeIDs.length > 0) {
            app.focusInfrastructureNodeIDs(nodeIDs, this.props.node.id)
        }
    }

    private layerIcon(glyph: string) {
        const { classes } = this.props
        return <span className={`${classes.connectedResourceFaIcon} fa fas fa-fw`}>{glyph}</span>
    }

    private renderRows(rows: KeyValueRow[], emptyText = translate('hostNoData')) {
        const visible = rows.filter(row => row.alwaysShow || !isBlank(row.value))
        if (!visible.length) return this.renderEmpty(emptyText)
        return (
            <DetailKeyValueList
                rows={visible.map(row => {
                    const value = stringify(row.value)
                    const displayValue = value || 'N/A'
                    return {
                        key: row.label,
                        label: row.label,
                        value: row.variant === 'status'
                            ? <DetailBadge tone={displayValue === translate('hostStatusNormal') ? 'success' : 'default'}>{displayValue}</DetailBadge>
                            : displayValue,
                        textValue: displayValue,
                        copyText: row.copy && value ? value : undefined
                    }
                })}
                copyTooltip={translate('copy')}
                onCopy={value => this.copyValue(value)}
            />
        )
    }

    private renderSection(icon: React.ReactNode, title: string, children: React.ReactNode, action?: React.ReactNode) {
        return (
            <DetailSection icon={icon} title={title} action={action}>
                {children}
            </DetailSection>
        )
    }

    private renderEmpty(description: string) {
        return <DetailEmpty description={description} />
    }

    private renderMetricGrid(items: MetricItem[], emptyText = translate('hostNoResourceMetrics')) {
        const { classes } = this.props
        const visible = items.filter(item => item.value)
        if (!visible.length) return this.renderEmpty(emptyText)
        return (
            <div className={classes.metricGrid}>
                {visible.map(item => (
                    <Card className={classes.metricTile} key={item.label} bordered bodyStyle={{ padding: 0 }}>
                        <span className={classes.metricIcon}>{item.icon || <InfoIcon />}</span>
                        <div className={classes.metricBody}>
                            <Statistic
                                className={classes.antStatistic}
                                title={item.label}
                                value={item.value}
                                valueStyle={{ color: 'var(--netdive-detail-text, #111827)' }}
                            />
                            {item.sub && <div className={classes.metricSub}>{item.sub}</div>}
                            {item.percent !== undefined && (
                                <Progress
                                    className={classes.antMetricProgress}
                                    percent={Math.max(0, Math.min(100, item.percent))}
                                    showInfo={false}
                                    strokeColor="var(--netdive-detail-accent, #1A73E8)"
                                    trailColor="rgba(148, 163, 184, 0.18)"
                                />
                            )}
                        </div>
                    </Card>
                ))}
            </div>
        )
    }

    private renderOverviewGrid(items: OverviewCardItem[], emptyText = translate('hostNoConnectedResources')) {
        const { classes } = this.props
        const visible = items.filter(item => item.alwaysShow || item.value)
        if (!visible.length) return this.renderEmpty(emptyText)
        return (
            <DetailResourceGrid>
                {visible.map(item => {
                    const canFocus = !!item.onClick || (!!item.nodeIDs && item.nodeIDs.length > 0)
                    return (
                        <DetailResourceCard
                            key={item.label}
                            label={item.label}
                            value={item.value}
                            icon={item.icon || <InfoIcon />}
                            iconTone={item.iconTone}
                            interactive={canFocus}
                            onClick={() => {
                                if (item.onClick) {
                                    item.onClick()
                                    return
                                }
                                this.focusNodeIDs(item.nodeIDs || [])
                            }}
                        />
                    )
                })}
            </DetailResourceGrid>
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

        const systemVM = !!this.props.systemVM
        const rawState = firstValue(data, ['State', 'state', 'Status', 'status', 'PowerState', 'powerState'])
        const basicRows: KeyValueRow[] = [
            { label: translate('vmName'), value: displayName, copy: true, alwaysShow: !systemVM },
            { label: translate('vmLibvirtName'), value: libvirtName, copy: true, alwaysShow: !systemVM },
            { label: 'Host', value: hostName, copy: true, alwaysShow: !systemVM },
            { label: translate('hostOperationalStatus'), value: systemVM ? (rawState ? this.statusText() : '') : this.statusText(), alwaysShow: !systemVM, variant: 'status' },
            { label: translate('vmPrivateIp'), value: this.privateIp(), copy: true, alwaysShow: !systemVM },
            { label: 'UUID', value: firstValue(data, ['UUID', 'uuid', 'ID', 'Id', 'id', 'ExtID', 'VirtualMachineID', 'virtualMachineId']), copy: true, alwaysShow: !systemVM },
            { label: 'Guest OS', value: os, alwaysShow: !systemVM },
            { label: translate('vmCpu'), value: cpuCount !== undefined ? `${cpuCount} vCPU` : '', copy: false, alwaysShow: !systemVM },
            { label: translate('vmMemory'), value: this.formatMemory(memory), copy: false, alwaysShow: !systemVM }
        ]

        const managementServer = systemVM ? this.managementServerDetail() : undefined
        const managementRows = managementServer ? this.managementRows(managementServer) : []
        const managementResourceRows = managementServer ? this.managementResourceRows(managementServer) : []
        const managementJvmRows = managementServer ? this.managementJvmRows(managementServer) : []

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
            { label: translate('infrastructureHosts'), value: hostName ? '1' : '0', icon: this.layerIcon('\uf233'), iconTone: 'host', nodeIDs: host ? [host.id] : [], alwaysShow: true },
            { label: translate('vmNics'), value: String(topologyNicNodes.length), icon: this.layerIcon('\uf538'), iconTone: 'interface', nodeIDs: topologyNicNodes.map(item => item.id), alwaysShow: true },
            { label: translate('host-bridges'), value: String(topologyHostBridgeNodes.length), icon: this.layerIcon('\uf542'), iconTone: 'bridge', nodeIDs: topologyHostBridgeNodes.map(item => item.id), alwaysShow: true },
            { label: translate('hostNetworkCount'), value: String(topologyNetworkLayerNodes.length), icon: this.layerIcon('\uf6ff'), iconTone: 'network', nodeIDs: topologyNetworkLayerNodes.map(item => item.id), alwaysShow: true }
        ]

        const hasResourceMetrics = resourceMetrics.some(item => !isBlank(item.value))
        const hasRecentSignals = eventRows.some(row => !isBlank(row.value))

        return (
            <div className={classes.root}>
                {this.renderSection(<InfoIcon />, translate('hostBasicInfo'), this.renderRows(basicRows))}
                {managementRows.some(row => !isBlank(row.value)) && this.renderSection(<InfoIcon />, translate('managementServerInfo'), this.renderRows(managementRows))}
                {managementResourceRows.some(row => !isBlank(row.value)) && this.renderSection(<DnsIcon />, translate('managementServerResources'), this.renderRows(managementResourceRows))}
                {managementJvmRows.some(row => !isBlank(row.value)) && this.renderSection(<MemoryIcon />, translate('managementServerJvm'), this.renderRows(managementJvmRows))}
                {this.renderSection(<DeviceHubIcon />, translate('hostConnectedResources'), this.renderOverviewGrid(connectedResources))}
                <HostResourceTrendPanel node={node} session={this.props.session} data={data} target="vm" />
                {hasResourceMetrics && this.renderSection(<DnsIcon />, translate('hostResourceUsage'), this.renderMetricGrid(resourceMetrics))}
                {hasRecentSignals && this.renderSection(<InfoIcon />, translate('hostRecentSignals'), this.renderRows(eventRows, translate('hostNoRecentSignals')))}
            </div>
        )
    }
}

export default withStyles(styles)(VMDetailPanel)
