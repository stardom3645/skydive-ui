import type { Node } from './Topology'

export interface TopologyResourceSnapshot { detail?: any; summary?: any; wall?: any; inventory?: any; host?: any }
export interface TopologyResourceRequest { key: string; url: string }
interface Entry { request: TopologyResourceRequest; checked?: number; data?: any; controller?: AbortController }

// One cache per topology/session. Repaints never issue duplicate requests, and
// collapsed/deleted resources release their queued work and cached responses.
export class TopologyResourceData {
    private entries = new Map<string, Entry>()
    private active = 0
    private disposed = false
    private token?: string
    constructor(private notify: () => void,
        private fetcher: typeof fetch = (...args) => fetch(...args), private now = Date.now) {}

    sync(requests: TopologyResourceRequest[], token?: string) {
        if (this.disposed) return
        this.token = token
        const wanted = new Set(requests.map(request => request.key))
        this.entries.forEach((entry, key) => {
            if (wanted.has(key)) return
            this.entries.delete(key)
            entry.controller?.abort()
        })
        requests.forEach(request => {
            if (!this.entries.has(request.key)) this.entries.set(request.key, { request })
        })
        this.pump()
    }

    get(key?: string) { return key ? this.entries.get(key)?.data : undefined }
    dispose() {
        this.disposed = true
        this.entries.forEach(entry => entry.controller?.abort())
        this.entries.clear()
    }

    private pump() {
        if (this.disposed) return
        for (const [key, entry] of this.entries) {
            if (this.active >= 3) break
            if (entry.controller || (entry.checked !== undefined && this.now() - entry.checked < 55000)) continue
            const controller = new AbortController()
            entry.controller = controller
            this.active++
            const timeout = setTimeout(() => controller.abort(), 15000)
            this.fetcher(entry.request.url, { cache: 'no-store', signal: controller.signal,
                headers: this.token ? { 'X-Auth-Token': this.token } : undefined })
                .then(response => { if (!response.ok) throw new Error('resource data unavailable'); return response.json() })
                .then(data => {
                    entry.data = entry.request.url.includes('/api/wall/')
                        ? { series: (data.series || []).map(item => ({ key: item.key, lastValue: item.lastValue })) }
                        : entry.request.url.includes('/api/mold/hosts/detail')
                            ? data?.moldMatched === false ? undefined : normalizeTopologyHost(data?.mold || data?.host || data?.data || data)
                        : entry.request.url.includes('/nodes/detail')
                            ? { usage: data.usage || data.currentUsage || data.metrics?.usage, allocatable: data.allocatable,
                                capacity: data.capacity, podCount: data.podCount, maxPodCount: data.maxPodCount }
                            : { resources: data.resources }
                })
                .catch(() => { entry.data = undefined })
                .finally(() => {
                    clearTimeout(timeout)
                    entry.checked = this.now()
                    entry.controller = undefined
                    this.active--
                    if (!this.disposed && this.entries.get(key) === entry) this.notify()
                    this.pump()
                })
        }
    }
}

const first = (data: any, paths: string[]) => {
    for (const path of paths) {
        const value = path.split('.').reduce((source, key) => source?.[key], data)
        if (value !== undefined && value !== null && value !== '') return Array.isArray(value) ? value[0] : value
    }
}

// Shared with HostDetailPanel: Mold uses lower-case fields while topology
// collectors use canonical names. Missing fields must not erase collected data.
export const normalizeTopologyHost = (host: any) => {
    const fields: Record<string, string[]> = {
        MoldHostId: ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID', 'id', 'uuid'],
        Name: ['Name', 'name', 'Hostname', 'hostname', 'HostName'],
        Hostname: ['Hostname', 'hostname', 'Name', 'name', 'HostName'],
        ManagementIP: ['ManagementIP', 'ManagementIp', 'managementIp', 'managementip', 'managementipaddress', 'privateIpAddress', 'privateipaddress', 'IpAddress', 'ipaddress'],
        Zone: ['Zone', 'zone', 'ZoneName', 'zonename'], Pod: ['Pod', 'pod', 'PodName', 'podname'],
        Cluster: ['Cluster', 'cluster', 'ClusterName', 'clustername'],
        Hypervisor: ['Hypervisor', 'hypervisor', 'HypervisorType', 'hypervisorType', 'hypervisortype'],
        ResourceState: ['ResourceState', 'resourceState', 'resourcestate', 'AllocationState', 'allocationState'],
        State: ['State', 'state', 'Status', 'status', 'AgentStatus', 'agentStatus'],
        Platform: ['Platform', 'platform', 'OsCategoryName', 'oscategoryname'],
        PlatformVersion: ['PlatformVersion', 'platformVersion', 'platformversion', 'Version', 'version'],
        CPUAllocatedPercent: ['CPUAllocatedPercent', 'cpuAllocatedPercent'],
        MemoryAllocatedPercent: ['MemoryAllocatedPercent', 'memoryAllocatedPercent'],
        CPUAllocated: ['CPUAllocated', 'cpuAllocated', 'cpuallocated'], CPUTotal: ['CPUTotal', 'cpuTotal', 'cputotal'],
        MemoryAllocated: ['MemoryAllocated', 'memoryAllocated', 'memoryallocated'], MemoryTotal: ['MemoryTotal', 'memoryTotal', 'memorytotal'],
        CpuNumber: ['CpuNumber', 'cpuNumber', 'cpunumber', 'CPUNumber', 'CpuCount', 'cpuCount', 'cpucount', 'CPUCount'],
        StorageUsedPercent: ['StorageUsedPercent', 'storageUsedPercent'],
        RunningVMCount: ['RunningVMCount', 'runningVmCount', 'runningVMCount', 'UserVMCount', 'userVmCount', 'VmCount', 'vmCount'],
        UserVMCount: ['UserVMCount', 'userVmCount', 'RunningVMCount', 'runningVmCount', 'VmCount', 'vmCount'],
        SystemVMCount: ['SystemVMCount', 'systemVmCount', 'systemVMCount'],
        VirtualRouterCount: ['VirtualRouterCount', 'virtualRouterCount', 'RouterCount', 'routerCount', 'VRCount'],
        NetworkCount: ['NetworkCount', 'networkCount', 'ConnectedNetworkCount', 'connectedNetworkCount']
    }
    const result: any = {}
    Object.entries(fields).forEach(([key, paths]) => { const value = first(host, paths); if (value !== undefined) result[key] = value })
    return result
}

export const topologyInfrastructureData = (node: Node, snapshot: TopologyResourceSnapshot = {}) => ({
    ...node.data, ...(String(node.data?.Type).toLowerCase() === 'host' ? normalizeTopologyHost(node.data) : {}),
    ...snapshot.inventory, ...snapshot.host,
    Type: node.data?.Type, Manager: node.data?.Manager
})
export const topologyKubernetesCluster = (node: Node, clusters: any[] = []) => {
    const keys = new Set<string>()
    const visited = new Set<Node>()
    for (let parent: Node | null = node; parent && !visited.has(parent); parent = parent.parent) {
        visited.add(parent)
        const data = parent.data || {}
        for (const path of ['MoldClusterId', 'MoldClusterID', 'ClusterID', 'ClusterId', 'clusterId', 'K8s.ClusterID', 'Cluster', 'ClusterName', 'clusterName', 'K8s.ClusterName']) {
            const value = first(data, [path]); if (value) keys.add(String(value).toLowerCase())
        }
        if (String(data.Type).toLowerCase() === 'cluster') {
            keys.add(parent.id.toLowerCase())
            keys.add(String(data.Name || '').toLowerCase())
        }
    }
    return clusters.find(cluster => [cluster.id, cluster.name].some(value => value && keys.has(String(value).toLowerCase())))
}

export const topologyInventoryData = (node: Node, inventory?: any, vmDetails?: Record<string, any>) => {
    const data = node.data || {}
    const keys = ['Name', 'Hostname', 'HostName', 'UUID', 'uuid', 'ID', 'Id', 'ExtID', 'VirtualMachineID', 'InstanceName', 'DisplayName',
        'MoldHostId', 'CloudStackHostId', 'HostId', 'HostID', 'IPV4', 'IPV6', 'IP', 'Addr', 'ManagementIP', 'ManagementIp', 'IpAddress', 'ipaddress']
        .reduce<any[]>((values, path) => values.concat(Array.isArray(data[path]) ? data[path] : [data[path]]), [])
        .filter(Boolean).map(value => String(value).toLowerCase())
    keys.push(node.id.toLowerCase())
    if (String(data.Type).toLowerCase() === 'libvirt') {
        const detail = Object.entries(vmDetails || {}).find(([key]) => keys.includes(key.toLowerCase()))?.[1]
        return { ...data, ...detail }
    }
    const hosts = [inventory?.hosts, inventory?.host, inventory?.Hosts, inventory?.data?.hosts, inventory?.data?.host,
        inventory?.inventory?.hosts, inventory?.listhostsresponse?.host, inventory?.listHostsResponse?.host, inventory?.ListHostsResponse?.Host, inventory?.items]
        .find(Array.isArray) || []
    const detail = hosts.find(host => ['id', 'ID', 'Id', 'uuid', 'UUID', 'HostId', 'hostid', 'Name', 'name', 'hostname', 'Hostname', 'HostName', 'ManagementIP', 'ManagementIp', 'managementip', 'managementipaddress', 'ipaddress']
        .some(path => { const value = first(host, [path]); return value && keys.includes(String(value).toLowerCase()) }))
    return { ...data, ...detail, ...normalizeTopologyHost(detail), Type: data.Type, Manager: data.Manager }
}

export const topologyResourcePlan = (nodes: Node[], endpoint: string, clusters: any[] = [], inventory?: any, vmDetails?: Record<string, any>, hostDetail: (id: string) => any = () => undefined) => {
    const requests = new Map<string, TopologyResourceRequest>()
    const refs = new Map<string, { detail?: string; summary?: string; wall?: string; host?: string }>()
    const add = (path: string, params: URLSearchParams) => {
        const url = `${endpoint.replace(/\/$/, '')}${path}?${params}`
        requests.set(url, { key: url, url }); return url
    }
    nodes.forEach(node => {
        const type = String(node.data?.Type || '').toLowerCase()
        const ref: { detail?: string; summary?: string; wall?: string; host?: string } = {}
        if (String(node.data?.Manager || '').toLowerCase() === 'k8s') {
            const cluster = topologyKubernetesCluster(node, clusters)
            if (!cluster?.id) return
            ref.summary = add('/api/mold/kubernetes-clusters/summary', new URLSearchParams({ id: cluster.id }))
            if (type === 'node') {
                const uid = first(node.data, ['K8s.Extra.ObjectMeta.UID', 'K8s.UID', 'UID', 'uid']) || node.id
                ref.detail = add('/api/mold/kubernetes-clusters/nodes/detail', new URLSearchParams({ id: cluster.id, uid: String(uid) }))
            }
        } else if (['host', 'libvirt'].includes(type)) {
            const inventoryData = topologyInventoryData(node, inventory, vmDetails)
            if (type === 'host') {
                const lookup = new URLSearchParams({ nodeId: node.id, name: String(first(node.data, ['Name', 'Hostname', 'HostName']) || node.id) })
                const id = first(inventoryData, ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID'])
                if (id) lookup.set('hostId', String(id))
                ref.host = add('/api/mold/hosts/detail', lookup)
            }
            const data = { ...inventoryData, ...(type === 'host' ? hostDetail(node.id) : undefined) }
            const name = String(first(data, ['Name', 'name', 'Hostname', 'HostName']) || node.id)
            const params = new URLSearchParams({ range: '1h', step: '60s', name })
            if (type === 'host') {
                params.set('host', String(first(data, ['Hostname', 'HostName', 'Name']) || name))
                params.set('job', 'cube'); params.set('port', '3003')
                const ip = first(data, ['ManagementIP', 'ManagementIp', 'managementIp', 'managementip', 'IpAddress', 'ipaddress', 'IPV4', 'IPv4', 'ipv4', 'IfAddr'])
                if (ip) { params.set('managementIp', String(ip)); params.set('ip', String(ip)) }
            } else {
                params.set('domain', name)
                const instance = first(data, ['InstanceName', 'instanceName', 'instancename'])
                const uuid = first(data, ['UUID', 'uuid', 'ID', 'Id', 'id', 'ExtID', 'VirtualMachineID', 'virtualMachineId', 'vmid'])
                const display = first(data, ['DisplayName', 'displayName', 'displayname'])
                if (instance) params.set('instanceName', String(instance))
                if (uuid) { params.set('uuid', String(uuid)); params.set('vmId', String(uuid)) }
                if (display) params.set('displayName', String(display))
            }
            ref.wall = add(`/api/wall/${type === 'host' ? 'hosts' : 'vms'}/trend`, params)
        }
        refs.set(node.id, ref)
    })
    return { requests: Array.from(requests.values()), refs }
}
