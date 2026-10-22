import type { Node, Link } from './Topology'
import { statusSummaryEntries, lastCollectionTime } from './StatusSummary'
import { topologyResourceDomain, TopologyResourceDomain } from './TopologyResourceClassification'
import { isCurrentKubernetesPod, kubernetesPodLifecycle, kubernetesPodCurrentStatusSnapshot } from './KubernetesPodLifecycle'
import { isExpiredLLDPLink } from './LLDPTopologyValidity'
import { compareKubernetesResourceVersions } from './KubernetesResourceVersion'

export type ProblemStatus = 'problem' | 'attention' | 'unavailable'
export const problemStatusLabels: Record<ProblemStatus, string> = {
    problem: '문제', attention: '확인 필요', unavailable: '수집 상태 확인'
}
export interface CurrentProblem {
    id: string
    node: Node
    status: ProblemStatus
    name: string
    reason: string
    domain: TopologyResourceDomain
    type: string
    typeLabel: string
    scope: string
    namespace: string
    context: string
    related: Node[]
    collectedAt: string
    searchText: string
}
export interface ProblemFilters {
    status: ProblemStatus | 'all'
    domain: TopologyResourceDomain | 'all'
    type: string
    scope: string
    query: string
}
export const defaultProblemFilters: ProblemFilters = { status: 'all', domain: 'all', type: '', scope: '', query: '' }
const types: Record<string, string> = {
    host: '호스트', libvirt: 'VM', switch: '스위치', switchport: '스위치 포트',
    device: 'NIC', nic: 'NIC', interface: '인터페이스', port: '포트', bond: 'Bond', bridge: 'Bridge',
    ovsbridge: 'OVS Bridge', tun: '가상 인터페이스', tuntap: '가상 인터페이스', veth: '가상 인터페이스',
    cluster: '클러스터', node: '노드', namespace: '네임스페이스', pod: '파드', container: '컨테이너',
    deployment: 'Deployment', statefulset: 'StatefulSet', daemonset: 'DaemonSet', replicaset: 'ReplicaSet',
    job: 'Job', cronjob: 'CronJob', service: '서비스', persistentvolumeclaim: 'PVC', persistentvolume: 'PV',
    storageclass: 'StorageClass', ingress: 'Ingress'
}
const read = (data: any, paths: string[]): string => {
    for (const path of paths) {
        const value = path.split('.').reduce((current, key) => current?.[key], data)
        if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) return String(value).trim()
    }
    return ''
}
export const problemResourceTypeLabel = (node: Node): string => types[String(node.data?.Type || '').toLowerCase()] || String(node.data?.Type || '자원')
const isResource = (node: Node) => !node.data?.IsTopologyGroup && !!node.data?.Type
    && (topologyResourceDomain(node) !== 'kubernetes' || String(node.data?.Type).toLowerCase() !== 'pod' || isCurrentKubernetesPod(node))
const identity = (node: Node) => `${topologyResourceDomain(node)}:${String(node.data?.Type).toLowerCase()}:${
    topologyResourceDomain(node) === 'kubernetes' ? [read(node.data, ['ClusterID', 'K8s.ClusterID', 'ClusterName', 'K8s.ClusterName']),
        read(node.data, ['K8s.Namespace', 'K8s.Extra.ObjectMeta.Namespace', 'K8s.Extra.metadata.namespace']),
        read(node.data, ['K8s.Extra.TypeMeta.APIVersion', 'K8s.Extra.apiVersion']).split('/').slice(0, -1).join('/'),
        read(node.data, ['K8s.Extra.ObjectMeta.UID', 'K8s.Extra.Metadata.UID', 'K8s.Extra.metadata.uid', 'K8s.UID', 'UID']) || node.id].join(':') : node.id}`

// Deduplicate before classification. A known 1.35+ server permits decimal
// ordering within an object; otherwise conflicting copies are unavailable,
// rather than arbitrarily choosing an old healthy or problematic snapshot.
const uniqueResources = (nodes: Node[]): Array<{ node: Node; conflict: boolean }> => {
    const resources = new Map<string, { node: Node; conflict: boolean }>()
    const version = (node: Node) => read(node.data, ['K8s.Extra.ObjectMeta.ResourceVersion', 'K8s.Extra.metadata.resourceVersion', 'K8s.ResourceVersion'])
    nodes.filter(node => !node.data?.IsTopologyGroup && !!node.data?.Type).forEach(node => {
        const key = identity(node), previous = resources.get(key)
        if (!previous) { resources.set(key, { node, conflict: false }); return }
        const serverVersion = read(node.data, ['K8s.APIServerVersion', 'APIServerVersion'])
        const sameServerContract = serverVersion === read(previous.node.data, ['K8s.APIServerVersion', 'APIServerVersion'])
            && !!read(node.data, ['ClusterID', 'K8s.ClusterID', 'ClusterName', 'K8s.ClusterName'])
        const comparison = compareKubernetesResourceVersions(version(node), version(previous.node), sameServerContract ? serverVersion : undefined)
        if (comparison === 1) resources.set(key, { node, conflict: false })
        else if ((comparison === undefined || comparison === 0) && JSON.stringify(node.data) !== JSON.stringify(previous.node.data)) previous.conflict = true
    })
    return Array.from(resources.values())
}

const resourceContext = (node: Node, name: (node: Node) => string) => {
    const kubernetes = topologyResourceDomain(node) === 'kubernetes'
    let scope = read(node.data, kubernetes ? ['K8s.ClusterName', 'ClusterName', 'Cluster'] : ['Hostname', 'HostName'])
    let namespace = kubernetes ? read(node.data, ['K8s.Namespace', 'Namespace', 'K8s.Extra.ObjectMeta.Namespace', 'K8s.Extra.metadata.namespace']) : ''
    const seen = new Set<Node>()
    for (let ancestor: Node | null = node; ancestor && !seen.has(ancestor); ancestor = ancestor.parent) {
        seen.add(ancestor)
        const type = String(ancestor.data?.Type || '').toLowerCase()
        if (!namespace && kubernetes && type === 'namespace') namespace = name(ancestor)
        if ((kubernetes && type === 'cluster') || (!kubernetes && (type === 'host' || type === 'switch'))) {
            scope = name(ancestor)
            break
        }
    }
    return { scope, namespace, context: [scope, namespace].filter(Boolean).join(' / ') || '소속 정보 없음' }
}

/** A current resource list, not inferred incidents. Reuse the existing self
 * classifiers and index adjacent edges so large graphs are not rescanned once
 * per interface. Normal parents are not added for their children's problems. */
export const currentProblems = (nodes: Node[], links: Link[], name: (node: Node) => string,
    infrastructureStatus: (node: Node) => { kind: string; label: string }): CurrentProblem[] => {
    const byID = new Map(nodes.map(node => [node.id, node]))
    const incidentLinks = new Map<string, Link[]>()
    const add = (id: string, link: Link) => {
        const list = incidentLinks.get(id) || []
        list.push(link); incidentLinks.set(id, list)
    }
    links.forEach(link => {
        if (isExpiredLLDPLink(link)) return
        add(link.source.id, link); add(link.target.id, link)
    })
    const result: CurrentProblem[] = []
    uniqueResources(nodes).forEach(({ node, conflict }) => {
        if (!isResource(node) && !conflict) return
        const adjacent = incidentLinks.get(node.id) || []
        const observed = statusSummaryEntries([node], infrastructureStatus, adjacent)[0]
        const entry = conflict && observed?.status !== 'inactive'
            ? { status: 'unavailable' as const, reason: '동일 자원의 서로 다른 스냅샷이 있어 최신 상태를 확인할 수 없습니다.' } : observed
        if (!entry || entry.status === 'inactive') return
        const related = new Map<string, Node>()
        const addRelated = (candidate?: Node | null) => {
            if (candidate && candidate.id !== node.id && byID.has(candidate.id) && isResource(candidate)) related.set(candidate.id, candidate)
        }
        addRelated(node.parent)
        ;(node.children || []).forEach(addRelated)
        adjacent.forEach(link => addRelated(link.source.id === node.id ? link.target : link.source))
        const context = resourceContext(node, name)
        const resourceName = name(node), typeLabel = problemResourceTypeLabel(node), domain = topologyResourceDomain(node)
        const lifecycle = domain === 'kubernetes' && String(node.data?.Type).toLowerCase() === 'pod' ? kubernetesPodLifecycle(node) : undefined
        const observedReason = lifecycle?.kind === 'problem' ? entry.reason.split(' · ').map(value => value === lifecycle.reason ? lifecycle.label : value).join(' · ') : entry.reason
        // A running collector is not a heartbeat for each Kubernetes object.
        // Preserve its verdict, but don't label an undated watch value as a
        // newly confirmed outage. No arbitrary graph-age threshold is added.
        const unverified = domain === 'kubernetes' && entry.status !== 'unavailable'
            && !(String(node.data.Type).toLowerCase() === 'pod' && kubernetesPodCurrentStatusSnapshot(node))
        const reason = unverified ? `관측값 · ${observedReason}` : observedReason
        result.push({ id: node.id, node, status: entry.status, name: resourceName, reason,
            domain, type: String(node.data?.Type || '').toLowerCase(), typeLabel, ...context,
            related: Array.from(related.values()), collectedAt: lastCollectionTime(node),
            searchText: [resourceName, node.id, typeLabel, reason, context.context, problemStatusLabels[entry.status],
                read(node.data, ['Name']), read(node.data, ['IPV4', 'IP', 'ManagementIP']), read(node.data, ['MAC'])].join(' ').toLocaleLowerCase() })
    })
    const rank: Record<ProblemStatus, number> = { problem: 0, attention: 1, unavailable: 2 }
    return result.sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name, 'ko', { numeric: true }) || a.id.localeCompare(b.id))
}

export const filterCurrentProblems = (entries: CurrentProblem[], filters: ProblemFilters) => {
    const tokens = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return entries.filter(entry => (filters.status === 'all' || entry.status === filters.status)
        && (filters.domain === 'all' || entry.domain === filters.domain)
        && (!filters.type || entry.type === filters.type)
        && (!filters.scope || entry.scope === filters.scope)
        && tokens.every(token => entry.searchText.includes(token)))
}

export const currentProblemCounts = (entries: CurrentProblem[]) => entries.reduce((counts, entry) => {
    counts.all++; counts[entry.status]++; return counts
}, { all: 0, problem: 0, attention: 0, unavailable: 0 })
