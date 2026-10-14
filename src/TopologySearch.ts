import type { TopologyNodePresentation } from './TopologyNodePresentation'

/** Search real resources by identity; display names and network aliases never merge nodes. */
export interface TopologySearchEntry {
    id: string
    label: string
    type: string
    layer: 'infrastructure' | 'kubernetes'
    context: string
    aliases: string[]
    icon?: string
    iconClass?: string
    href?: string
    status?: TopologyNodePresentation['status']
    uuids?: string[]
    hidden?: boolean
}
interface SearchNode {
    id: string; data: any; tags?: string[]; parent?: SearchNode | null
    getWeight?: () => number
}
const read = (value: any, path: string): any => path.split('.').reduce((item, key) => item?.[key], value)
const strings = (value: any): string[] => Array.isArray(value) ? value.reduce((all, item) => all.concat(strings(item)), [] as string[])
    : typeof value === 'string' && value.trim() ? [value.trim()] : []
const labels: Record<string, string> = { host: '호스트', switch: '스위치', libvirt: '가상머신', ovsbridge: '가상 브리지',
    bridge: '브리지', device: 'NIC', tun: '가상 NIC', tuntap: '가상 NIC', veth: '가상 NIC', interface: 'NIC',
    vlan: 'VLAN', bond: 'Bond', switchport: '스위치 포트', cluster: '클러스터', node: '노드', namespace: '네임스페이스',
    pod: 'Pod', deployment: 'Deployment', statefulset: 'StatefulSet', daemonset: 'DaemonSet', job: 'Job', cronjob: 'CronJob',
    service: 'Service', persistentvolume: 'PV', persistentvolumeclaim: 'PVC', storageclass: 'StorageClass' }

export function topologySearchEntry(node: SearchNode, options: {
    label?: string; configuredFields?: string[]; additionalAliases?: string[]; hidden?: boolean; icon?: string; iconClass?: string; href?: string; status?: TopologySearchEntry['status']
} = {}): TopologySearchEntry {
    const data = node.data || {}, rawType = String(data.Type || '').toLowerCase()
    const layer = (node.tags || []).includes('kubernetes') || String(data.Manager || '').toLowerCase() === 'k8s' ? 'kubernetes' : 'infrastructure'
    const ancestors: string[] = [], visited = new Set<string>([node.id])
    let parent = node.parent
    while (parent && !visited.has(parent.id)) {
        visited.add(parent.id)
        if (['host', 'cluster', 'namespace', 'libvirt'].includes(String(parent.data?.Type || '').toLowerCase()))
            ancestors.unshift(...strings(parent.data?.Name))
        parent = parent.parent
    }
    const namespace = strings(read(data, 'K8s.Namespace'))[0]
    if (namespace && !ancestors.includes(namespace)) ancestors.push(namespace)
    const fields = ['Name', 'IfName', 'LibvirtName', 'UUID', 'uuid', 'ID', 'ExtID', 'VirtualMachineID', 'VMUUID', 'instanceName',
        'IPV4', 'IPV6', 'IP', 'IPAddress', 'ManagementIP', 'MAC', 'MacAddress', 'macAddress', 'Libvirt.Domain', 'Libvirt.DomainUUID',
        'K8s.Name', 'K8s.UID', 'K8s.Namespace', 'K8s.PodIP', 'K8s.HostIP', 'K8s.ClusterName']
    const aliases = new Set<string>([node.id, ...fields.reduce((all, field) => all.concat(strings(read(data, field))), [] as string[]),
        ...(options.configuredFields || []).reduce((all, field) => all.concat(strings(read(node, field))), [] as string[]),
        ...(options.additionalAliases || []).filter(Boolean), ...ancestors, rawType])
    const label = options.label?.trim() || strings(data.Name)[0] || node.id
    aliases.add(label)
    const weight = rawType === 'libvirt' ? node.getWeight?.() : undefined
    const type = weight === 7060 ? '시스템 가상머신' : weight === 7070 ? '가상 라우터' : weight === 7080 ? '사용자 가상머신' : labels[rawType] || rawType || '객체'
    aliases.add(type)
    return { id: node.id, label, type, layer, context: ancestors.join(' › '), aliases: Array.from(aliases), hidden: options.hidden, icon: options.icon, iconClass: options.iconClass, href: options.href, status: options.status,
        uuids: Array.from(new Set([node.id, ...['UUID', 'uuid', 'VMUUID', 'Libvirt.DomainUUID', 'K8s.UID'].reduce((all, field) => all.concat(strings(read(data, field))), [] as string[]),
            ...Array.from(aliases).filter(alias => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(alias))])) }
}

export const normalizeTopologySearch = (value: string): string => value.normalize('NFKC').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
const compact = (value: string) => value.replace(/[\s._:/\-]+/g, '')
const initials = (value: string) => Array.from(value).map(char => {
    const code = char.charCodeAt(0) - 0xac00
    return code >= 0 && code <= 11171 ? 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(code / 588)] : char
}).join('')
// Bounded Damerau distance handles a swapped/missing letter, without fuzzy IP/UUID matching.
const typoDistance = (a: string, b: string, limit: number): number => {
    if (Math.abs(a.length - b.length) > limit) return limit + 1
    const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)])
    for (let j = 0; j <= b.length; j++) rows[0][j] = j
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]))
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1)
        }
        if (Math.min(...rows[i]) > limit) return limit + 1
    }
    return rows[a.length][b.length]
}
export interface TopologySearchMatch { entry: TopologySearchEntry; score: number; fuzzy: boolean; matchedAlias?: string }
export function createTopologySearchIndex(entries: TopologySearchEntry[]) {
    const documents = entries.map(entry => ({ entry, name: normalizeTopologySearch(entry.label), nameInitials: normalizeTopologySearch(initials(entry.label)),
        fields: entry.aliases.map(value => { const text = normalizeTopologySearch(value)
            return { raw: value, text, compact: compact(text), initials: normalizeTopologySearch(initials(value)), words: text.split(/[\s._:/\-]+/).filter(Boolean) } }) }))
    return (query: string, activeLayer = 'infrastructure'): TopologySearchMatch[] => {
        const rawTokens = query.trim().split(/\s+/).filter(Boolean), tokens = rawTokens.map(normalizeTopologySearch)
        const text = normalizeTopologySearch(query.trim()), matches: TopologySearchMatch[] = []
        for (const document of documents) {
            let score = document.entry.layer === activeLayer ? 4 : 0, fuzzy = false, matched = true, matchedAlias: string | undefined
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i], isInitial = /^[ㄱ-ㅎ]+$/.test(rawTokens[i])
                let best = 0
                for (const field of document.fields) {
                    const current = field.text === token ? 100 : field.text.startsWith(token) ? 75 : field.text.includes(token) ? 55
                        : isInitial && field.initials.includes(token) ? 45
                            : /[a-z가-힣]/.test(token) && field.compact.includes(compact(token)) ? 40
                                : /^[0-9a-f]{12}$/.test(token) && /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/.test(field.text) && field.compact === token ? 40 : 0
                    if (current > best) { best = current; matchedAlias = field.raw }
                }
                if (!best && token.length >= 4 && token.length <= 24 && /^[a-z가-힣]+$/.test(token)) {
                    const limit = token.length >= 8 ? 2 : 1
                    for (const field of document.fields) for (const word of field.words) {
                        if (word[0] !== token[0]) continue
                        const target = word.length > token.length + limit ? word.slice(0, token.length) : word
                        if (typoDistance(token, target, limit) <= limit) { best = 18; matchedAlias = field.raw; break }
                    }
                    if (best) fuzzy = true
                }
                if (!best) { matched = false; break }
                score += best
                if (document.name === token) score += 60
                else if (document.name.startsWith(token)) score += 45
                else if (document.name.includes(token)) score += 30
            }
            if (!matched) continue
            if (text && document.name === text) score += 150
            else if (text && document.name.startsWith(text)) score += 60
            else if (text && document.name.includes(text)) score += 30
            else if (/^[ㄱ-ㅎ]+$/.test(query.trim()) && document.nameInitials.includes(text)) score += 60
            if (!text && ['호스트', '클러스터', '스위치'].includes(document.entry.type)) score += 10
            matches.push({ entry: document.entry, score, fuzzy, matchedAlias })
        }
        return matches.sort((a, b) => Number(a.fuzzy) - Number(b.fuzzy) || b.score - a.score
            || a.entry.label.localeCompare(b.entry.label) || a.entry.id.localeCompare(b.entry.id))
    }
}

/** Empty search follows the actual view history; queries retain the existing ranking. */
export function prioritizeRecentSearch(matches: TopologySearchMatch[], recentIDs: string[], query: string): TopologySearchMatch[] {
    if (query.trim() || !recentIDs.length) return matches
    const positions = new Map(recentIDs.map((id, i) => [id, i]))
    return matches.slice().sort((a, b) => (positions.get(a.entry.id) ?? Infinity) - (positions.get(b.entry.id) ?? Infinity))
}

export function topologySearchResultIdentity(match: TopologySearchMatch, query: string): { kind: string; value: string } | undefined {
    const { entry, matchedAlias } = match
    const tokens = query.trim().split(/\s+/).filter(Boolean).map(normalizeTopologySearch)
    const uuids = entry.uuids || [entry.id]
    const uuid = uuids.find(value => tokens.some(token => token.length >= 4 && (normalizeTopologySearch(value) === token || /^[0-9a-f-]+$/i.test(token)) &&
        (normalizeTopologySearch(value).includes(token) || /^[0-9a-f-]{8,}$/i.test(token) && compact(value.toLowerCase()).includes(compact(token)))))
    if (uuid) return { kind: 'UUID', value: uuid }
    const isUUID = (value: string) => uuids.includes(value) || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    const candidates = [matchedAlias || '', ...entry.aliases].filter(value => value && !isUUID(value))
    const ip = candidates.find(value => /^\d{1,3}(?:\.\d{1,3}){3}(?:\/\d+)?$/.test(value) || /^[0-9a-f]*:[0-9a-f:]+(?:\/\d+)?$/i.test(value) && !/^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value))
    const mac = candidates.find(value => /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value))
    if (matchedAlias === mac && mac) return { kind: 'MAC', value: mac }
    if (ip) return { kind: 'IP', value: ip }
    if (mac) return { kind: 'MAC', value: mac }
    return undefined
}
