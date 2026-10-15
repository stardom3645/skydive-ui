import type { Node } from './Topology'

export interface MoldNICNetwork {
    vmUuid?: string; vmInstanceName?: string; networkId?: string; nicId?: string
    networkName: string; macAddress: string; ipAddress: string
    networkType?: string; cidr?: string; vlan?: string; zoneId?: string; zoneName?: string
    networkCreatedAt?: string
    trafficType?: string; gateway?: string; broadcastUri?: string; isDefault?: string; networkOffering?: string
}
export type MoldVMNetworkMap = Record<string, MoldNICNetwork[]>
export interface MoldNetworkIndex {
    byVM: Map<string, MoldNICNetwork[]>
    domains: Map<string, string>
    networks: MoldNICNetwork[]
}
const id = (value: any) => typeof value === 'string' ? value.trim().toLowerCase() : ''
const mac = (value: any) => {
    const hex = id(value).replace(/[:.\-]/g, '')
    return /^[0-9a-f]{12}$/.test(hex) ? hex : ''
}
const path = (data: any, key: string) => key.split('.').reduce((value, part) => value?.[part], data)

export function moldNetworkIndex(networkMap: MoldVMNetworkMap = {}, details: Record<string, any> = {}): MoldNetworkIndex {
    const byVM = new Map<string, MoldNICNetwork[]>(), domains = new Map<string, string>()
    const ambiguousDomains = new Set<string>(), networks = new Map<string, MoldNICNetwork>()
    const domain = (name: string, uuid: string) => {
        if (!name || !uuid || ambiguousDomains.has(name)) return
        if (domains.has(name) && domains.get(name) !== uuid) { domains.delete(name); ambiguousDomains.add(name) }
        else domains.set(name, uuid)
    }
    Object.entries(details).forEach(([key, detail]) => {
        const uuid = id(detail.uuid || detail.UUID)
        domain(id(key), uuid); domain(id(detail.instanceName), uuid)
    })
    Object.entries(networkMap).forEach(([key, items]) => {
        if (!Array.isArray(items)) return
        items.forEach(item => {
            const uuid = id(item.vmUuid) || domains.get(id(key))
            if (!uuid) return
            domain(id(key), uuid)
            const row = { ...item, vmUuid: uuid, vmInstanceName: key }
            if (!byVM.has(uuid)) byVM.set(uuid, [])
            byVM.get(uuid)!.push(row)
            if (item.networkId) networks.set(id(item.networkId), row)
        })
    })
    return { byVM, domains, networks: Array.from(networks.values()).sort((a, b) => a.networkName.localeCompare(b.networkName)) }
}

export function moldVMUUID(node: Node, index: MoldNetworkIndex): string {
    if (String(node.data?.Manager).toLowerCase() === 'k8s') return ''
    const direct = ['VMUUID', 'VirtualMachineUUID', 'Libvirt.DomainUUID'].map(key => id(path(node.data, key))).find(Boolean)
    if (direct) return direct
    const visited = new Set<string>()
    let owner: Node | null | undefined = node
    while (owner && !visited.has(owner.id)) {
        visited.add(owner.id)
        if (String(owner.data?.Type).toLowerCase() === 'libvirt') {
            const uuid = id(owner.data.UUID || owner.data.uuid)
            // An explicit UUID is authoritative; never fall back after a mismatch.
            return uuid || index.domains.get(id(owner.data.Name || owner.data.instanceName)) || ''
        }
        owner = owner.parent
    }
    return index.domains.get(id(path(node.data, 'Libvirt.Domain'))) || ''
}

export const moldVMNetworks = (node: Node, index: MoldNetworkIndex): MoldNICNetwork[] =>
    index.byVM.get(moldVMUUID(node, index)) || []

export function matchMoldNIC(node: Node, index: MoldNetworkIndex): MoldNICNetwork | undefined {
    if (String(node.data?.Type).toLowerCase() === 'libvirt') return undefined
    const candidates = new Set(['Libvirt.MAC', 'Libvirt.Mac', 'PeerIntfMAC', 'MAC', 'MacAddress', 'macAddress']
        .map(key => mac(path(node.data, key))).filter(Boolean))
    if (!candidates.size) return undefined
    const matches = moldVMNetworks(node, index).filter(item => candidates.has(mac(item.macAddress)))
    // Duplicate cached rows may be aliases; conflicting NIC identities are not a match.
    const unique = new Map(matches.map(item => [`${id(item.nicId)}|${id(item.networkId)}|${mac(item.macAddress)}`, item]))
    return unique.size === 1 ? Array.from(unique.values())[0] : undefined
}

function moldVMNetworkNames(node: Node, index: MoldNetworkIndex): Map<string, string> {
    const networks = new Map<string, string>()
    moldVMNetworks(node, index).forEach(item => {
        if (item.networkName) networks.set(id(item.networkId) || item.networkName, item.networkName)
    })
    return networks
}

export const moldVMNetworkCount = (node: Node, index: MoldNetworkIndex) => moldVMNetworkNames(node, index).size
export function moldVMNetworkSummary(node: Node, index: MoldNetworkIndex): string | undefined {
    const networks = moldVMNetworkNames(node, index)
    return networks.size > 1 ? `네트워크 ${networks.size}개` : Array.from(networks.values())[0]
}

export const moldNetworkVLAN = (network: MoldNICNetwork) => network.vlan
    || (/^vlan:\/\/([^/?#]+)/i.exec(network.broadcastUri || '')?.[1]) || ''

let cachedMap: MoldVMNetworkMap | undefined, cachedDetails: Record<string, any> | undefined, cachedIndex: MoldNetworkIndex | undefined
export function getMoldNetworkIndex(map?: MoldVMNetworkMap, details?: Record<string, any>): MoldNetworkIndex {
    if (!cachedIndex || cachedMap !== map || cachedDetails !== details) {
        cachedMap = map; cachedDetails = details; cachedIndex = moldNetworkIndex(map, details)
    }
    return cachedIndex
}
