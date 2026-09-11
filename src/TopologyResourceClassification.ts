import type { Node } from './Topology'
import { isKubernetesTopologyData } from './KubernetesInfrastructureEvidence'

export type TopologyResourceDomain = 'infrastructure' | 'kubernetes'
export type InfrastructureResourceCategory = 'switch' | 'host' | 'vm'
export type KubernetesResourceCategory = 'cluster' | 'node' | 'pod'
export type TopologyResourceCategory = InfrastructureResourceCategory | KubernetesResourceCategory

const normalizedType = (node: Node): string => String(node.data?.Type || '').trim().toLowerCase()

/** Shared resource information architecture used by the navigation summaries and status summary. */
export const topologyResourceDomain = (node: Node): TopologyResourceDomain =>
    isKubernetesTopologyData(node.data, node.tags) ? 'kubernetes' : 'infrastructure'

export const infrastructureResourceCategory = (node: Node): InfrastructureResourceCategory | undefined => {
    if (topologyResourceDomain(node) !== 'infrastructure') return undefined
    const type = normalizedType(node)
    if (type === 'switch') return 'switch'
    if (type === 'host') return 'host'
    if (type === 'libvirt') return 'vm'
    return undefined
}

export const kubernetesResourceCategory = (node: Node): KubernetesResourceCategory | undefined => {
    if (topologyResourceDomain(node) !== 'kubernetes') return undefined
    const type = normalizedType(node)
    return type === 'cluster' || type === 'node' || type === 'pod' ? type : undefined
}

export const topologyResourceCategory = (node: Node): TopologyResourceCategory | undefined =>
    topologyResourceDomain(node) === 'kubernetes'
        ? kubernetesResourceCategory(node)
        : infrastructureResourceCategory(node)
