import type { MoldNICNetwork } from './MoldTopologyNetworks'

export type MoldNetworkTypeFilter = 'all' | 'Isolated' | 'L2' | 'Shared'
export type MoldNetworkSort = 'oldest' | 'newest'

export const moldNetworkChoiceName = (network: MoldNICNetwork): string => network.networkName?.trim() || network.networkId || ''
export const moldNetworkChoiceType = (network: MoldNICNetwork): string => {
    const type = network.networkType?.trim() || ''
    return ['Isolated', 'L2', 'Shared'].find(value => value.toLowerCase() === type.toLowerCase()) || type
}

// Fill missing display metadata only from an exact network identity already
// collected by the NIC API. Never match on names, CIDRs, VLANs or Zone names.
export function moldNetworkChoiceCatalog(catalog: MoldNICNetwork[], linked: MoldNICNetwork[] = []): MoldNICNetwork[] {
    const byID = new Map(linked.filter(network => network.networkId).map(network => [network.networkId!.toLowerCase(), network]))
    return catalog.map(network => {
        const fallback = byID.get(network.networkId?.toLowerCase() || '')
        if (!fallback) return network
        const result = { ...network }
        for (const key of ['networkName', 'networkType', 'trafficType', 'cidr', 'zoneName', 'vlan', 'networkCreatedAt'] as const) {
            if (!result[key]?.trim() && fallback[key]?.trim()) result[key] = fallback[key]
        }
        return result
    })
}

export const moldNetworkChoiceMetadata = (network: MoldNICNetwork): string[] => {
    const type = moldNetworkChoiceType(network), traffic = network.trafficType?.trim()
    const parts = [type || traffic || '', network.cidr?.trim() || '']
    const vlan = network.vlan?.trim() || /^vlan:\/\/([^/?#]+)/i.exec(network.broadcastUri || '')?.[1]
    if (!network.cidr?.trim() && vlan && !['untagged', 'native'].includes(vlan.toLowerCase())) parts.push(`VLAN ${vlan}`)
    return parts.filter(Boolean)
}

export const moldNetworkCommonZone = (networks: MoldNICNetwork[]): string | undefined => {
    const zoneID = networks[0]?.zoneId?.trim().toLowerCase(), name = networks[0]?.zoneName?.trim()
    // Identical labels alone must not merge different Zone identities.
    return zoneID && name && networks.every(network => network.zoneId?.trim().toLowerCase() === zoneID && network.zoneName?.trim() === name)
        ? name : undefined
}

// Mold DATETIME values share the DB's calendar/time basis. A fixed basis keeps
// their ordering independent of the browser timezone; no inferred date is used.
export const moldNetworkCreationTime = (network: MoldNICNetwork): number | undefined => {
    const value = network.networkCreatedAt?.trim()
    if (!value || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(value)) return undefined
    const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10))
    const calendar = new Date(Date.UTC(year, month - 1, day))
    if (year < 1000 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day
        || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return undefined
    const iso = value.replace(' ', 'T')
    const date = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : iso + 'Z')
    return Number.isFinite(date) ? date : undefined
}

export function moldNetworkChoices(networks: MoldNICNetwork[], search = '', type: MoldNetworkTypeFilter = 'all', sort: MoldNetworkSort = 'oldest'): MoldNICNetwork[] {
    const choices = networks.filter(network => !!network.networkId)
    const dated = choices.map((network, index) => ({ network, index, created: moldNetworkCreationTime(network) }))
        .filter((entry): entry is { network: MoldNICNetwork; index: number; created: number } => entry.created !== undefined)
        .sort((a, b) => (sort === 'newest' ? b.created - a.created : a.created - b.created) || a.index - b.index)
    // Keep unknown dates in their original slots, instead of using names/IDs or
    // a non-transitive comparator to guess their age.
    let cursor = 0
    const ordered = choices.map(network => moldNetworkCreationTime(network) === undefined ? network : dated[cursor++].network)
    const query = search.trim().toLowerCase()
    return ordered.filter(network => (type === 'all' || moldNetworkChoiceType(network) === type)
        && [network.networkName, network.networkId, network.networkType, network.cidr, network.zoneName, network.vlan]
            .filter(Boolean).join(' ').toLowerCase().includes(query))
}
