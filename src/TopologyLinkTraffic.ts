import type { Link, Node } from './Topology'

export interface TopologyLinkTraffic {
    node: Node
    metric: any
    seconds: number
    received?: number
    transmitted?: number
    total?: number
}

const count = (value: any): number | undefined => {
    if (value === undefined || value === null || value === '' || typeof value === 'boolean') return undefined
    const number = Number(value)
    return Number.isFinite(number) && number >= 0 ? number : undefined
}

// InterfaceMetric's Go int64 counters use json:",omitempty". In a valid
// interval an absent counter is a measured zero; an explicitly malformed
// value remains unavailable. Do not apply this to an absent metric/interval.
const intervalCount = (metric: any, key: string): number | undefined =>
    Object.prototype.hasOwnProperty.call(metric, key) ? count(metric[key]) : 0

/** LastUpdateMetric is an interface interval, not a per-connection flow count.
 * Both the line label and its detail panel use this same measured source. */
export const topologyLinkTraffic = (link: Link): TopologyLinkTraffic | undefined => {
    const endpoints = [link.source, link.target]
    const nodes = link.data?.ManualPortMapping ? endpoints.filter(node =>
        (!link.data.ManualPortMappingNICID || node?.id === link.data.ManualPortMappingNICID)
        && ['device', 'nic', 'interface', 'ethernet'].includes(String(node?.data?.Type || '').toLowerCase())) : endpoints
    for (const node of nodes) {
        const data = node?.data || {}, type = String(data.Type || '').toLowerCase()
        if (!['tuntap', 'tun', 'device', 'switchport', 'nic', 'interface', 'ethernet'].includes(type)
            && String(data.Driver || '').toLowerCase() !== 'tun' && String(data.BusInfo || '').toLowerCase() !== 'tap') continue
        const metric = data.LastUpdateMetric || data.Ovs?.LastUpdateMetric
        const start = count(metric?.Start), last = count(metric?.Last)
        if (start === undefined || last === undefined || last <= start) continue
        const seconds = (last - start) / 1000
        const rx = intervalCount(metric, 'RxBytes'), tx = intervalCount(metric, 'TxBytes')
        if (rx === undefined && tx === undefined) continue
        const received = rx === undefined ? undefined : rx * 8 / seconds
        const transmitted = tx === undefined ? undefined : tx * 8 / seconds
        return { node, metric, seconds, received, transmitted,
            total: received !== undefined && transmitted !== undefined ? received + transmitted : undefined }
    }
    return undefined
}
