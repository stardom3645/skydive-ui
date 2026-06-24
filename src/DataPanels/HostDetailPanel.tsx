import * as React from 'react'
import IconButton from '@material-ui/core/IconButton'
import Tooltip from '@material-ui/core/Tooltip'
import FileCopyIcon from '@material-ui/icons/FileCopy'
import InfoIcon from '@material-ui/icons/Info'
import TimelineIcon from '@material-ui/icons/Timeline'
import DeviceHubIcon from '@material-ui/icons/DeviceHub'
import PowerIcon from '@material-ui/icons/Power'
import SecurityIcon from '@material-ui/icons/Security'
import RouterIcon from '@material-ui/icons/Router'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import { withStyles } from '@material-ui/core/styles'

import { Node } from '../Topology'
import { session } from '../Store'
import { translate } from '../Config'
import { styles } from './HostDetailPanelStyles'

import HostResourceTrendPanel from './HostResourceTrendPanel'

interface Props {
    classes: any
    node: Node
    session?: session
    moldInventory?: any
    infrastructureHostSummaries?: Record<string, any>
}

interface State {
    moldDetail?: any
    moldDetailLoadedFor?: string
    listeningServicesVisibleCount?: number
    showAllSocketProcesses?: boolean
}

type InfrastructureFocusKey = 'networkObjects' | 'routers' | 'userVMs' | 'systemVMs'

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
    muted?: boolean
    icon?: React.ReactNode
}

interface OverviewCardItem {
    label: string
    description: string
    value: string
    icon?: React.ReactNode
    actionKey?: InfrastructureFocusKey
    nodeIDs?: string[]
}

interface SocketServiceItem {
    port: string
    protocol: string
    process: string
    count: number
}

interface SocketProcessItem {
    process: string
    count: number
    percent: number
}

interface KubernetesClusterMatch {
    id: string
    name: string
}

interface PillItem {
    label: string
    title?: string
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

const compactProcessName = (process: string): string => {
    if (!process) return ''
    const command = process.split(/\s+/)[0]
    const base = command.split('/').filter(Boolean).pop() || command
    if (base.indexOf('qemu-system') === 0) return 'qemu-system'
    return base
}

const uniqueStrings = (values: string[]): string[] => {
    const seen = new Set<string>()
    return values.map(value => value.trim()).filter(value => {
        if (!value || seen.has(value)) return false
        seen.add(value)
        return true
    })
}

const lookupTokens = (value: any): string[] => {
    if (isBlank(value)) return []
    const text = String(value).trim().toLowerCase()
    if (!text) return []
    const normalized = text.split('/')[0]
    const tokens = [normalized]
    if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
        return tokens
    }
    const hostToken = normalized.split('.')[0]
    if (hostToken && hostToken !== normalized) {
        tokens.push(hostToken)
    }
    return uniqueStrings(tokens)
}

const collectLookupSet = (...values: any[]): Set<string> => {
    const set = new Set<string>()
    values.forEach(value => {
        asArray(value).forEach(item => {
            lookupTokens(item).forEach(token => set.add(token))
        })
    })
    return set
}

class HostDetailPanel extends React.Component<Props, State> {
    state: State = {}

    componentDidMount() {
        this.loadMoldHostDetail()
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id) {
            this.setState({
                listeningServicesVisibleCount: undefined,
                showAllSocketProcesses: false
            })
            this.loadMoldHostDetail()
        }
    }

    private copyValue(value: string) {
        if (!value) return
        const nav: any = navigator
        if (nav.clipboard && nav.clipboard.writeText) {
            nav.clipboard.writeText(value)
        }
    }

    private mergedData(): any {
        return {
            ...(this.props.node.data || {}),
            ...(this.inventoryHostDetail() || {}),
            ...(this.state.moldDetail || {})
        }
    }

    private inventoryHosts(): any[] {
        const inventory = this.props.moldInventory
        if (!inventory) return []
        const candidates = [
            inventory.hosts,
            inventory.host,
            inventory.Hosts,
            inventory.data?.hosts,
            inventory.data?.host,
            inventory.inventory?.hosts,
            inventory.listhostsresponse?.host,
            inventory.listHostsResponse?.host,
            inventory.ListHostsResponse?.Host,
            inventory.items
        ]
        for (const candidate of candidates) {
            if (Array.isArray(candidate)) return candidate
        }
        return []
    }

    private inventoryHostDetail(): any | undefined {
        const hosts = this.inventoryHosts()
        if (!hosts.length) return undefined
        const nodeData = this.props.node.data || {}
        const nodeIps = [
            ...asArray(nodeData.IPV4),
            ...asArray(nodeData.IPV6),
            ...asArray(nodeData.IP),
            ...asArray(nodeData.Addr),
            ...asArray(nodeData.IpAddress),
            ...asArray(nodeData.ipaddress),
            ...asArray(nodeData.ManagementIP),
            ...asArray(nodeData.ManagementIp)
        ].map(stringify)
        const nodeKeys = uniqueStrings([
            this.props.node.id,
            firstValue(nodeData, ['ID', 'Id', 'UUID', 'uuid', 'MoldHostId', 'CloudStackHostId', 'HostId', 'HostID']),
            firstValue(nodeData, ['Name', 'Hostname', 'HostName']),
            firstValue(nodeData, ['ManagementIP', 'ManagementIp', 'IpAddress', 'ipaddress']),
            ...nodeIps
        ].map(value => String(value || '').toLowerCase()))

        const host = hosts.find(item => {
            const hostKeys = uniqueStrings([
                firstValue(item, ['ID', 'Id', 'id', 'UUID', 'uuid', 'HostId', 'hostid']),
                firstValue(item, ['Name', 'name', 'Hostname', 'hostname', 'HostName']),
                firstValue(item, ['ManagementIP', 'ManagementIp', 'managementip', 'managementipaddress', 'IpAddress', 'ipaddress'])
            ].map(value => String(value || '').toLowerCase()))
            return hostKeys.some(key => nodeKeys.includes(key))
        })

        if (!host) return undefined
        return this.normalizeMoldHost(host)
    }

    private normalizeMoldHost(host: any): any {
        return {
            ...host,
            MoldHostId: firstValue(host, ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID', 'id', 'uuid']),
            Name: firstValue(host, ['Name', 'name', 'Hostname', 'hostname', 'HostName']),
            Hostname: firstValue(host, ['Hostname', 'hostname', 'Name', 'name', 'HostName']),
            ManagementIP: firstValue(host, ['ManagementIP', 'ManagementIp', 'managementIp', 'managementip', 'managementipaddress', 'privateIpAddress', 'privateipaddress', 'IpAddress', 'ipaddress']),
            Zone: firstValue(host, ['Zone', 'zone', 'ZoneName', 'zonename']),
            Pod: firstValue(host, ['Pod', 'pod', 'PodName', 'podname']),
            Cluster: firstValue(host, ['Cluster', 'cluster', 'ClusterName', 'clustername']),
            Hypervisor: firstValue(host, ['Hypervisor', 'hypervisor', 'HypervisorType', 'hypervisorType', 'hypervisortype']),
            ResourceState: firstValue(host, ['ResourceState', 'resourceState', 'resourcestate', 'AllocationState', 'allocationState']),
            State: firstValue(host, ['State', 'state', 'Status', 'status']),
            Platform: firstValue(host, ['Platform', 'platform', 'OsCategoryName', 'oscategoryname']),
            PlatformVersion: firstValue(host, ['PlatformVersion', 'platformVersion', 'platformversion', 'Version', 'version']),
            CPUAllocatedPercent: firstValue(host, ['CPUAllocatedPercent', 'cpuAllocatedPercent']),
            MemoryAllocatedPercent: firstValue(host, ['MemoryAllocatedPercent', 'memoryAllocatedPercent']),
            StorageUsedPercent: firstValue(host, ['StorageUsedPercent', 'storageUsedPercent']),
            RunningVMCount: firstValue(host, ['RunningVMCount', 'runningVmCount', 'runningVMCount', 'UserVMCount', 'userVmCount', 'VmCount', 'vmCount']),
            UserVMCount: firstValue(host, ['UserVMCount', 'userVmCount', 'RunningVMCount', 'runningVmCount', 'VmCount', 'vmCount']),
            SystemVMCount: firstValue(host, ['SystemVMCount', 'systemVmCount', 'systemVMCount']),
            VirtualRouterCount: firstValue(host, ['VirtualRouterCount', 'virtualRouterCount', 'RouterCount', 'routerCount', 'VRCount']),
            NetworkCount: firstValue(host, ['NetworkCount', 'networkCount', 'ConnectedNetworkCount', 'connectedNetworkCount'])
        }
    }

    private endpoint(): string {
        return this.props.session?.endpoint || `${window.location.protocol}//${window.location.host}`
    }

    private loadMoldHostDetail() {
        const node = this.props.node
        const data = node.data || {}
        const name = firstValue(data, ['Name', 'Hostname', 'HostName']) || node.id
        const hostID = firstValue(data, ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID'])
        const params = new URLSearchParams()
        params.set('nodeId', node.id)
        if (name) params.set('name', name)
        if (hostID) params.set('hostId', hostID)

        const loadedFor = `${node.id}:${name}:${hostID}`
        this.setState({ moldDetailLoadedFor: loadedFor })

        fetch(`${this.endpoint()}/api/mold/hosts/detail?${params.toString()}`, {
            cache: 'no-store',
            headers: this.props.session?.token ? { 'X-Auth-Token': this.props.session.token } : undefined
        }).then(resp => {
            if (!resp.ok) {
                throw new Error(`mold host detail unavailable: ${resp.status}`)
            }
            return resp.json()
        }).then(detail => {
            if (this.state.moldDetailLoadedFor === loadedFor) {
                const rawHost = detail?.moldMatched === false ? undefined : (detail?.mold || detail?.host || detail?.data || detail)
                this.setState({ moldDetail: rawHost ? this.normalizeMoldHost(rawHost) : undefined })
            }
        }).catch(() => {
            if (this.state.moldDetailLoadedFor === loadedFor) {
                this.setState({ moldDetail: undefined })
            }
        })
    }

    private ips(): string[] {
        const data = this.mergedData()
        return [
            ...asArray(data.IPV4),
            ...asArray(data.IPV6),
            ...asArray(data.IP),
            ...asArray(data.Addr),
            ...asArray(data.IpAddress),
            ...asArray(data.ipaddress),
            ...asArray(data.ManagementIP),
            ...asArray(data.ManagementIp)
        ].map(stringify).filter(Boolean)
    }

    private macs(): string[] {
        const data = this.mergedData()
        return [
            ...asArray(data.MAC),
            ...asArray(data.Mac),
            ...asArray(data.MACs),
            ...asArray(data.MacAddress),
            ...asArray(data.macaddress)
        ].map(stringify).filter(Boolean)
    }

    private sockets(): any[] {
        const sockets = this.props.node.data?.Sockets
        return Array.isArray(sockets) ? sockets : []
    }

    private interfaces(): any[] {
        const data = this.mergedData()
        const candidates = [data.Interfaces, data.interfaces, data.Nics, data.nics, data.NetworkInterfaces]
        for (const value of candidates) {
            if (Array.isArray(value)) return value
        }
        return []
    }

    private statusText(): string {
        const data = this.mergedData()
        const state = firstValue(data, ['State', 'Status', 'AgentStatus', 'ResourceState'])
        if (!state) return translate('hostStatusCollected')
        const normalized = state.toLowerCase()
        if (normalized === 'up' || normalized === 'running' || normalized === 'ok' || normalized === 'connected' || normalized === 'enabled') {
            return translate('hostStatusNormal')
        }
        return state
    }

    private mainInterface(): string {
        const data = this.mergedData()
        const hostName = firstValue(data, ['Name', 'Hostname', 'HostName']) || this.props.node.id
        const explicit = firstValue(data, ['Interface', 'IfName', 'IfAlias', 'IfDescr', 'ManagementInterface'])
        if (explicit && explicit !== hostName && explicit !== this.props.node.id) return explicit
        const firstInterface = this.interfaces()[0]
        const fallback = firstValue(firstInterface, ['Name', 'name', 'Interface', 'IfName', 'Device'])
        if (fallback && fallback !== hostName && fallback !== this.props.node.id) return fallback
        return ''
    }

    private interfaceCountByPattern(patterns: RegExp[]): number | undefined {
        const interfaces = this.interfaces()
        if (!interfaces.length) return undefined
        return interfaces.filter(iface => {
            const haystack = [
                firstValue(iface, ['Name', 'name', 'Interface', 'IfName', 'Device']),
                firstValue(iface, ['Type', 'type', 'Kind', 'Driver', 'driver', 'DeviceType'])
            ].join(' ').toLowerCase()
            return patterns.some(pattern => pattern.test(haystack))
        }).length
    }

    private socketString(socket: any, keys: string[]): string {
        for (const key of keys) {
            const value = stringify(socket?.[key])
            if (value) return value
        }
        return ''
    }

    private socketStats() {
        const sockets = this.sockets()
        const ports = new Set<string>()
        let listen = 0
        let external = 0
        sockets.forEach(socket => {
            const port = this.socketString(socket, ['LocalPort', 'Port', 'localPort'])
            if (port) ports.add(port)
            const state = this.normalizeSocketState(socket)
            const remote = this.socketString(socket, ['RemoteAddress', 'RemoteAddr', 'remoteAddress'])
            if (state === 'LISTEN') listen += 1
            if (remote && remote !== '127.0.0.1' && remote !== '::1' && remote !== '0.0.0.0') external += 1
        })
        return { total: sockets.length, ports: ports.size, listen, external }
    }

    private normalizeSocketState(socket: any): string {
        const rawState = this.socketString(socket, ['State', 'Status', 'state', 'status']).toUpperCase()
        const remote = this.socketString(socket, ['RemoteAddress', 'RemoteAddr', 'remoteAddress'])
        const port = this.socketString(socket, ['LocalPort', 'Port', 'localPort'])
        if (rawState === 'LISTENING') return 'LISTEN'
        if (rawState) return rawState
        if (!remote && port) return 'LISTEN'
        return 'UNKNOWN'
    }

    private socketProtocol(socket: any): string {
        return (this.socketString(socket, ['Protocol', 'Proto', 'protocol', 'proto']) || 'TCP').toUpperCase()
    }

    private socketProcess(socket: any): string {
        const process = this.socketString(socket, ['Process', 'ProcessName', 'Name', 'Service', 'process', 'processName', 'service'])
        const compact = compactProcessName(process)
        return compact || process || translate('hostSocketNoProcess')
    }

    private listeningServices(): SocketServiceItem[] {
        const groups = new Map<string, SocketServiceItem>()
        this.sockets().forEach(socket => {
            if (this.normalizeSocketState(socket) !== 'LISTEN') return
            const port = this.socketString(socket, ['LocalPort', 'Port', 'localPort'])
            if (!port) return
            const protocol = this.socketProtocol(socket)
            const process = this.socketProcess(socket)
            const key = `${port}/${protocol}/${process}`
            const current = groups.get(key)
            if (current) {
                current.count += 1
            } else {
                groups.set(key, { port, protocol, process, count: 1 })
            }
        })
        return Array.from(groups.values()).sort((a, b) => Number(a.port) - Number(b.port))
    }

    private topSocketProcesses(): SocketProcessItem[] {
        const total = this.sockets().length
        const counts = new Map<string, number>()
        this.sockets().forEach(socket => {
            const process = this.socketProcess(socket)
            counts.set(process, (counts.get(process) || 0) + 1)
        })
        return Array.from(counts.entries())
            .map(([process, count]) => ({ process, count, percent: total ? (count / total) * 100 : 0 }))
            .sort((a, b) => b.count - a.count)
    }

    private socketStateLabel(state: string): string {
        const normalized = String(state || '').toUpperCase()
        switch (normalized) {
            case 'LISTEN':
                return translate('hostSocketStateListen')
            case 'ESTABLISHED':
                return translate('hostSocketStateEstablished')
            case 'TIME_WAIT':
                return translate('hostSocketStateTimeWait')
            case 'CLOSE_WAIT':
                return translate('hostSocketStateCloseWait')
            default:
                return state || '-'
        }
    }

    private hostInfrastructureNodeIDs(key?: InfrastructureFocusKey): string[] {
        const summary = this.props.infrastructureHostSummaries?.[this.props.node.id]
        if (!summary || !key) return []
        switch (key) {
            case 'userVMs':
                return summary.userVMNodeIDs || []
            case 'systemVMs':
                return summary.systemVMNodeIDs || []
            case 'routers':
                return summary.routerNodeIDs || []
            case 'networkObjects':
                return summary.networkObjectNodeIDs || []
            default:
                return []
        }
    }

    private focusConnectedResource(actionKey?: InfrastructureFocusKey, nodeIDs: string[] = []) {
        const app = (window as any).App
        const ids = nodeIDs.length ? nodeIDs : this.hostInfrastructureNodeIDs(actionKey)
        if (app && typeof app.focusInfrastructureNodeIDs === 'function' && ids.length > 0) {
            app.focusInfrastructureNodeIDs(ids)
        }
    }

    private hostKubernetesNodes(): Node[] {
        const app = (window as any).App
        const topologyNodes: Node[] = Array.isArray(app?.tc?.nodes) ? app.tc.nodes : []
        if (!topologyNodes.length) return []
        const topologyLinks: any[] = app?.tc?.links ? Array.from(app.tc.links.values()) : []

        const data = this.mergedData()
        const hostLookup = collectLookupSet(
            this.props.node.id,
            firstValue(data, ['Name', 'Hostname', 'HostName']),
            firstValue(data, ['ManagementIP', 'ManagementIp', 'managementIp', 'IpAddress', 'ipaddress']),
            data.IPV4,
            data.IPV6,
            data.IP,
            data.Addr,
            data.IfAddr,
            data.Addresses
        )
        const hostSubtreeNodeIDs = this.hostSubtreeNodeIDs()

        const matchesHostAncestor = (node: Node): boolean => {
            let parent = node.parent
            while (parent) {
                if (String(parent.data?.Type || '').toLowerCase() === 'host' && parent.id === this.props.node.id) {
                    return true
                }
                parent = parent.parent
            }
            return false
        }

        const matchesHostLink = (node: Node): boolean => {
            return topologyLinks.some((link: any) => {
                const sourceID = link?.source?.id
                const targetID = link?.target?.id
                if (!sourceID || !targetID) return false
                if (sourceID === node.id) return hostSubtreeNodeIDs.has(targetID)
                if (targetID === node.id) return hostSubtreeNodeIDs.has(sourceID)
                return false
            })
        }

        return topologyNodes.filter(node => {
            if (!node || node.data?.Manager !== 'k8s' || String(node.data?.Type || '').toLowerCase() !== 'node') {
                return false
            }
            if (matchesHostAncestor(node)) {
                return true
            }
            if (matchesHostLink(node)) {
                return true
            }

            const addressValues: any[] = []
            asArray(node.data?.Addresses).forEach((entry: any) => {
                if (typeof entry === 'string') {
                    addressValues.push(entry)
                    return
                }
                if (entry && typeof entry === 'object') {
                    addressValues.push(
                        entry.address,
                        entry.Address,
                        entry.ip,
                        entry.IP,
                        entry.InternalIP,
                        entry.ExternalIP,
                        entry.Hostname,
                        entry.hostname
                    )
                }
            })

            const nodeLookup = collectLookupSet(
                node.id,
                firstValue(node.data, ['Name', 'Hostname', 'HostName', 'NodeName', 'nodeName', 'KubeletHostname', 'kubeletHostname']),
                firstValue(node.data, ['InternalIP', 'ExternalIP', 'HostIP', 'hostIP', 'IpAddress', 'ipaddress']),
                node.data?.IPV4,
                node.data?.IPV6,
                node.data?.IP,
                node.data?.Addr,
                node.data?.IfAddr,
                addressValues
            )

            return Array.from(nodeLookup).some(token => hostLookup.has(token))
        })
    }

    private hostSubtreeNodeIDs(): Set<string> {
        const ids = new Set<string>()
        const visit = (node?: Node | null) => {
            if (!node || ids.has(node.id)) return
            ids.add(node.id)
            ;(node.children || []).forEach(child => visit(child))
        }
        visit(this.props.node)
        return ids
    }

    private kubernetesClusterForNode(node: Node): KubernetesClusterMatch | undefined {
        let parent = node.parent
        while (parent) {
            if (String(parent.data?.Type || '').toLowerCase() === 'cluster') {
                return {
                    id: parent.id,
                    name: firstValue(parent.data, ['Name', 'ClusterName', 'clusterName']) || parent.id
                }
            }
            parent = parent.parent
        }

        const fallbackID = firstValue(node.data, ['ClusterID', 'clusterID', 'ClusterId', 'clusterId'])
            || firstValue(node.data, ['Cluster', 'ClusterName', 'clusterName'])
        const fallbackName = firstValue(node.data, ['Cluster', 'ClusterName', 'clusterName'])
        if (!fallbackID && !fallbackName) return undefined
        return {
            id: fallbackID || fallbackName,
            name: fallbackName || fallbackID
        }
    }

    private hostKubernetesClusters(nodes: Node[]): KubernetesClusterMatch[] {
        const clusters = new Map<string, KubernetesClusterMatch>()
        nodes.forEach(node => {
            const cluster = this.kubernetesClusterForNode(node)
            if (!cluster) return
            if (!clusters.has(cluster.id)) {
                clusters.set(cluster.id, cluster)
            }
        })
        return Array.from(clusters.values())
    }

    private renderSocketProcessSummary() {
        const { classes } = this.props
        const services = this.listeningServices()
        const processes = this.topSocketProcesses()
        const socketStats = this.socketStats()
        const visibleServiceCount = this.state.listeningServicesVisibleCount || 5
        const visibleServices = services.slice(0, visibleServiceCount)
        const visibleProcesses = this.state.showAllSocketProcesses ? processes : processes.slice(0, 5)
        const hiddenServiceCount = Math.max(0, services.length - visibleServices.length)
        const hiddenProcessCount = Math.max(0, processes.length - visibleProcesses.length)
        if (!services.length && !processes.length) {
            return <div className={classes.emptyState}>{translate('hostNoSocketInfo')}</div>
        }
        return (
            <div className={classes.socketSection}>
                <div className={classes.socketSummaryGrid}>
                    <div className={classes.socketSummaryTile}>
                        <div className={classes.socketSummaryLabel}>{translate('hostListenPorts')}</div>
                        <div className={classes.socketSummaryValue}>{socketStats.listen || 0}</div>
                    </div>
                    <div className={classes.socketSummaryTile}>
                        <div className={classes.socketSummaryLabel}>{translate('hostExternalConnections')}</div>
                        <div className={classes.socketSummaryValue}>{socketStats.external || 0}</div>
                    </div>
                    <div className={classes.socketSummaryTile}>
                        <div className={classes.socketSummaryLabel}>{translate('hostTopSocketProcesses')}</div>
                        <div className={classes.socketSummaryValue}>{processes.length}</div>
                    </div>
                </div>
                <div className={classes.socketBlock}>
                    <div className={classes.socketBlockHeader}>
                        <strong className={classes.socketBlockTitle}>{translate('hostTopSocketProcesses')}</strong>
                        {(hiddenProcessCount > 0 || this.state.showAllSocketProcesses) && (
                            <button
                                type="button"
                                className={classes.socketMoreButton}
                                onClick={() => this.setState({ showAllSocketProcesses: !this.state.showAllSocketProcesses })}>
                                {this.state.showAllSocketProcesses ? translate('hostSocketCollapse') : `+${hiddenProcessCount}${translate('hostSocketMoreItems')}`}
                            </button>
                        )}
                    </div>
                    <div className={classes.socketProcessList}>
                        {visibleProcesses.map(item => (
                            <div className={classes.socketProcessRow} key={item.process}>
                                <span className={classes.socketProcessName}>{item.process}</span>
                                <span>{item.count}</span>
                                <div className={classes.socketProcessBarTrack}>
                                    <div className={classes.socketProcessBarFill} style={{ width: `${Math.min(100, item.percent)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className={classes.socketBlock}>
                    <div className={classes.socketBlockHeader}>
                        <strong className={classes.socketBlockTitle}>{translate('hostListeningServices')} <span>({socketStats.listen || 0})</span></strong>
                        {(hiddenServiceCount > 0 || services.length > 5) && (
                            <button
                                type="button"
                                className={classes.socketMoreButton}
                                onClick={() => this.setState({
                                    listeningServicesVisibleCount: hiddenServiceCount > 0
                                        ? Math.min(services.length, visibleServiceCount + 10)
                                        : undefined
                                })}>
                                {hiddenServiceCount > 0 ? `+${hiddenServiceCount}${translate('hostSocketMoreItems')}` : translate('hostSocketCollapse')}
                            </button>
                        )}
                    </div>
                    <div className={classes.socketServiceList}>
                        {visibleServices.map(item => (
                            <div className={classes.socketServiceRow} key={`${item.port}-${item.protocol}-${item.process}`}>
                                <span className={classes.socketServicePortBadge}>{item.port} / {item.protocol}</span>
                                <span className={classes.socketServiceProcess}>{item.process}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    private renderValue(row: KeyValueRow) {
        const { classes } = this.props
        const value = stringify(row.value) || 'N/A'
        const displayValue = row.label === translate('KernelVersion') && value.length > 22 ? `${value.slice(0, 13)}...${value.slice(-8)}` : value
        return (
            <div className={classes.kvValueWrap}>
                <Tooltip title={value} placement="top" arrow>
                    <span className={classes.kvValue}>{displayValue}</span>
                </Tooltip>
                {row.copy && value !== 'N/A' && (
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

    private renderSection(icon: React.ReactNode, title: string, description: string, children: React.ReactNode, className = '') {
        const { classes } = this.props
        return (
            <section className={`${classes.panelCard} ${className}`}>
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
                    <div className={`${classes.metricTile} ${item.muted ? classes.metricTileMuted : ''}`} key={item.label}>
                        <span className={classes.metricIcon}>{item.icon || <InfoIcon />}</span>
                        <div className={classes.metricBody}>
                            <div className={classes.metricLabel}>{item.label}</div>
                            <div className={classes.metricValue}>{item.value}</div>
                            {item.sub && <div className={classes.metricSub}>{item.sub}</div>}
                            {item.percent !== undefined && (
                                <div className={classes.progressTrack}>
                                    <div className={classes.progressFill} style={{ width: `${item.percent}%` }} />
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
                    const numericValue = Number(item.value)
                    const hasZeroValue = item.value !== '' && !Number.isNaN(numericValue) && numericValue === 0
                    const canFocus = !hasZeroValue && !!item.actionKey && !!item.nodeIDs && item.nodeIDs.length > 0
                    const actionClassName = `${classes.connectedResourceCardAction} ${!canFocus ? classes.connectedResourceCardActionHidden : ''}`
                    return (
                        <button
                            type="button"
                            className={`${classes.connectedResourceCard} ${canFocus ? classes.connectedResourceCardClickable : classes.connectedResourceCardStatic}`}
                            key={item.label}
                            onClick={() => canFocus && this.focusConnectedResource(item.actionKey, item.nodeIDs)}
                            aria-disabled={!canFocus}
                            tabIndex={canFocus ? 0 : -1}>
                            <span className={classes.connectedResourceCardMain}>
                                <span className={classes.connectedResourceCardIcon}>{item.icon || <InfoIcon />}</span>
                                <span>
                                    <strong>{item.label}</strong>
                                </span>
                            </span>
                            <span className={classes.connectedResourceCardValue}>{item.value}</span>
                            <span className={actionClassName} aria-hidden={!canFocus}>›</span>
                        </button>
                    )
                })}
            </div>
        )
    }

    private renderConnectedResourceSubsection(icon: React.ReactNode, title: string, items: OverviewCardItem[], emptyText = translate('hostNoConnectedResources')) {
        const { classes } = this.props
        return (
            <div className={classes.connectedResourceSection}>
                <div className={classes.connectedResourceSectionHeader}>
                    <span className={classes.connectedResourceSectionIcon}>{icon}</span>
                    <span className={classes.connectedResourceSectionTitle}>{title}</span>
                </div>
                {this.renderOverviewGrid(items, emptyText)}
            </div>
        )
    }

    private infrastructureIcon(glyph: string, tone: string) {
        const { classes } = this.props
        const colors: Record<string, string> = {
            network: '#3f7ee8',
            'user-vm': '#41a878',
            'system-vm': '#6d4bd8',
            router: '#7c4bd3'
        }
        return (
            <span className={`${classes.connectedResourceFaIcon} fa fas fa-fw`} style={{ color: colors[tone] || colors.network }}>
                {glyph}
            </span>
        )
    }

    private renderPills(values: Array<string | PillItem>, emptyText: string) {
        const { classes } = this.props
        if (!values.length) return <div className={classes.emptyState}>{emptyText}</div>
        return (
            <div className={classes.pillList}>
                {values.map(value => {
                    const item = typeof value === 'string' ? { label: value, title: value } : value
                    return (
                        <Tooltip title={item.title || item.label} key={item.label} placement="top" arrow>
                            <span className={classes.pill}>{item.label}</span>
                        </Tooltip>
                    )
                })}
            </div>
        )
    }

    render() {
        const { classes, node } = this.props
        const data = this.mergedData()
        const name = firstValue(data, ['Name', 'Hostname', 'HostName']) || node.id
        const ipList = this.ips()
        const macList = this.macs()
        const representativeIp = ipList[0] || ''
        const socketStats = this.socketStats()
        const virtualization = firstValue(data, ['VirtualizationSystem', 'Hypervisor', 'HypervisorType'])
        const virtualizationText = virtualization ? virtualization.toUpperCase() : ''
        const zone = firstValue(data, ['Zone', 'ZoneName'])
        const cluster = firstValue(data, ['Cluster', 'ClusterName'])
        const pod = firstValue(data, ['Pod', 'PodName'])
        const locationText = [zone, pod, cluster].filter(Boolean).join(' > ')
        const resourceState = firstValue(data, ['ResourceState', 'resourceState', 'AllocationState', 'allocationState'])
        const platform = firstValue(data, ['Platform', 'platform'])
        const platformVersion = firstValue(data, ['PlatformVersion', 'platformVersion', 'platformversion'])
        const os = firstValue(data, ['OS', 'Os', 'OperatingSystem'])
        const kernelVersion = firstValue(data, ['KernelVersion'])
        const platformText = [platform, platformVersion, os].filter(Boolean).join(' · ')
        const managementServer = firstValue(data, ['ManagementServer', 'ManagementIP', 'ManagementIp', 'managementIp', 'privateIpAddress'])
        const graphHostSummary = this.props.infrastructureHostSummaries?.[node.id]
        const connectedVmArrayCount = asArray(data.UserVMs).length || asArray(data.VMs).length || asArray(data.VirtualMachines).length
        const systemVmArrayCount = asArray(data.SystemVMs).length || asArray(data.SystemVms).length || asArray(data.SystemVirtualMachines).length
        const virtualRouterArrayCount = asArray(data.VirtualRouters).length || asArray(data.Routers).length || asArray(data.VirtualRouter).length
        const vmCount = graphHostSummary?.userVMs ?? numberValue(data, ['ConnectedVMCount', 'ConnectedVmCount', 'UserVMCount', 'userVmCount', 'VmCount', 'VMCount', 'UserVmCount', 'RunningVms', 'RunningVMCount', 'runningVmCount', 'VirtualMachineCount']) ?? (connectedVmArrayCount > 0 ? connectedVmArrayCount : undefined)
        const systemVmCount = graphHostSummary?.systemVMs ?? numberValue(data, ['SystemVmCount', 'SystemVMCount', 'systemVmCount']) ?? (systemVmArrayCount > 0 ? systemVmArrayCount : undefined)
        const virtualRouterCount = graphHostSummary?.routers ?? numberValue(data, ['VirtualRouterCount', 'virtualRouterCount', 'RouterCount', 'routerCount', 'VRCount']) ?? (virtualRouterArrayCount > 0 ? virtualRouterArrayCount : undefined)
        const explicitNetworkCount = numberValue(data, ['NetworkCount', 'networkCount', 'NetworksCount', 'ConnectedNetworkCount', 'connectedNetworkCount'])
        const derivedNetworkCount = asArray(data.Networks).length || asArray(data.Network).length || asArray(data.NetworkObjects).length || asArray(data.Interfaces).length || asArray(data.interfaces).length
        const networkCount = graphHostSummary?.networkObjects ?? (explicitNetworkCount !== undefined ? explicitNetworkCount : (derivedNetworkCount > 0 ? derivedNetworkCount : undefined))
        const physicalNicCount = numberValue(data, ['PhysicalNicCount', 'PhysicalNICCount', 'NicCount', 'NICCount'])
        const bridgeCount = numberValue(data, ['BridgeCount', 'HostBridgeCount'])
        const bondCount = numberValue(data, ['BondCount', 'BondingCount'])
        const tags = [
            data.Type ? `type: ${data.Type}` : '',
            data.Manager ? `manager: ${data.Manager}` : '',
            data.Probe ? `probe: ${data.Probe}` : '',
            data.Role ? `role: ${data.Role}` : '',
            zone ? `zone: ${zone}` : ''
        ].filter(Boolean)

        const basicRows: KeyValueRow[] = [
            { label: translate('Hostname'), value: name },
            { label: translate('hostMoldHostId'), value: firstValue(data, ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID', 'UUID', 'uuid']), copy: true },
            { label: translate('hostManagementIp'), value: managementServer || representativeIp, copy: true },
            { label: translate('hostLocation'), value: locationText },
            { label: '하이퍼바이저', value: virtualizationText },
            { label: translate('Platform'), value: platformText },
            { label: translate('KernelVersion'), value: kernelVersion, copy: true }
        ]

        const eventRows: KeyValueRow[] = [
            { label: translate('hostLastUpdate'), value: formatDate(firstValue(data, ['UpdatedAt', 'LastUpdate', 'LastSeen', '@UpdatedAt', '@CreatedAt', 'CreatedAt'])) },
            { label: translate('hostRecentEvent'), value: firstValue(data, ['RecentEvent', 'LastEvent', 'Event']) },
            { label: translate('hostRecentCapture'), value: firstValue(data, ['RecentCapture', 'LastCapture', 'CaptureState']) },
            { label: translate('hostRecentStateChange'), value: formatDate(firstValue(data, ['StateChangedAt', 'LastStateChange', 'StatusChangedAt'])) }
        ]

        const connectedResources: OverviewCardItem[] = [
            { label: translate('infrastructureUserVMs'), description: translate('infrastructureUserVMsDescription'), value: vmCount !== undefined ? String(vmCount) : '', icon: this.infrastructureIcon('\uf108', 'user-vm'), actionKey: 'userVMs', nodeIDs: this.hostInfrastructureNodeIDs('userVMs') },
            { label: translate('infrastructureSystemVMs'), description: translate('infrastructureSystemVMsDescription'), value: systemVmCount !== undefined ? String(systemVmCount) : '', icon: this.infrastructureIcon('\uf085', 'system-vm'), actionKey: 'systemVMs', nodeIDs: this.hostInfrastructureNodeIDs('systemVMs') },
            { label: translate('infrastructureRouters'), description: translate('infrastructureRoutersDescription'), value: virtualRouterCount !== undefined ? String(virtualRouterCount) : '', icon: this.infrastructureIcon('\uf4d7', 'router'), actionKey: 'routers', nodeIDs: this.hostInfrastructureNodeIDs('routers') },
            { label: translate('infrastructureNetworkObjects'), description: translate('infrastructureNetworkObjectsDescription'), value: networkCount !== undefined ? String(networkCount) : '', icon: this.infrastructureIcon('\uf6ff', 'network'), actionKey: 'networkObjects', nodeIDs: this.hostInfrastructureNodeIDs('networkObjects') }
        ]
        const kubernetesNodes = this.hostKubernetesNodes()
        const kubernetesClusters = this.hostKubernetesClusters(kubernetesNodes)
        const kubernetesClusterNames = kubernetesClusters.map(clusterItem => clusterItem.name)
        const kubernetesResources: OverviewCardItem[] = [
            {
                label: translate('kubernetesTopologyClusters'),
                description: kubernetesClusterNames.join(', '),
                value: String(kubernetesClusters.length),
                icon: this.infrastructureIcon('\uf542', 'network'),
                nodeIDs: kubernetesClusters.map(item => item.id).filter(Boolean)
            },
            {
                label: translate('kubernetesTopologyNodes'),
                description: kubernetesClusterNames.length > 0 ? kubernetesClusterNames.join(', ') : '',
                value: String(kubernetesNodes.length),
                icon: this.infrastructureIcon('\uf233', 'host'),
                nodeIDs: kubernetesNodes.map(item => item.id)
            }
        ]
        const resolvedPhysicalNicCount = physicalNicCount !== undefined ? physicalNicCount : this.interfaceCountByPattern([/\bnic\b/, /\beth\d+\b/, /\benp/, /\bens/, /\beno/])
        const resolvedBridgeCount = bridgeCount !== undefined ? bridgeCount : this.interfaceCountByPattern([/\bbridge\b/, /^br/, /\bovs\b/])
        const resolvedBondCount = bondCount !== undefined ? bondCount : this.interfaceCountByPattern([/\bbond\b/, /\bbonding\b/])
        const networkMetrics: MetricItem[] = [
            { label: translate('hostManagementIp'), value: managementServer || representativeIp, icon: <RouterIcon /> },
            { label: translate('MAC'), value: macList.length ? String(macList.length) : '', icon: <SecurityIcon /> },
            { label: translate('phy-nics'), value: resolvedPhysicalNicCount !== undefined ? String(resolvedPhysicalNicCount) : '', sub: this.mainInterface() || undefined, icon: <DeviceHubIcon /> },
            { label: translate('host-bridges'), value: resolvedBridgeCount !== undefined ? String(resolvedBridgeCount) : '', icon: <RouterIcon /> },
            { label: translate('phy-bond'), value: resolvedBondCount !== undefined ? String(resolvedBondCount) : '', icon: <SecurityIcon /> }
        ]

        const hasMoldRows = [zone, cluster, pod, resourceState, managementServer, firstValue(data, ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID'])].some(value => !isBlank(value))
        const hasConnectedMetrics = connectedResources.some(item => !isBlank(item.value)) || kubernetesResources.some(item => !isBlank(item.value))
        const visibleNetworkMetrics = networkMetrics.filter(item => item.value)
        const hasNetworkSummary = visibleNetworkMetrics.length > 1
        const hasRecentSignals = eventRows.some(row => !isBlank(row.value))

        return (
            <div className={classes.root}>
                {this.renderSection(<InfoIcon />, translate('hostBasicInfo'), translate('hostOverviewDescription'), this.renderRows(basicRows))}
                <HostResourceTrendPanel
                    node={node}
                    session={this.props.session}
                    data={data}
                />
                {hasConnectedMetrics && this.renderSection(<DeviceHubIcon />, translate('hostConnectedResources'), translate('hostConnectedResourcesDescription'), (
                    <div className={classes.connectedResourceSectionStack}>
                        {this.renderConnectedResourceSubsection(<AccountTreeIcon />, translate('infrastructureMenu'), connectedResources, translate('hostNoConnectedResources'))}
                        {this.renderConnectedResourceSubsection(<DeviceHubIcon />, 'Kubernetes', kubernetesResources, translate('hostNoConnectedResources'))}
                    </div>
                ))}
                {this.renderSection(<PowerIcon />, translate('hostSocketsProcesses'), '수신 대기 서비스와 주요 소켓 프로세스를 요약합니다.', this.renderSocketProcessSummary())}
                {hasNetworkSummary && this.renderSection(<RouterIcon />, translate('hostNetworkSummary'), translate('hostNetworkSummaryDescription'), this.renderMetricGrid(networkMetrics, translate('hostNetworkDetailsMissing')))}
                {hasRecentSignals && this.renderSection(<InfoIcon />, translate('hostRecentSignals'), translate('hostRecentSignalsDescription'), this.renderRows(eventRows, translate('hostNoRecentSignals')))}

                {!hasMoldRows && (
                    <div className={classes.noticeCard}>
                        <InfoIcon />
                        <span>{translate('hostMoldMissing')}</span>
                    </div>
                )}
            </div>
        )
    }
}

export default withStyles(styles)(HostDetailPanel)
