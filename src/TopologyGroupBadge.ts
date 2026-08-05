export interface TopologyGroupObject {
    id: string
    data?: {
        Type?: string
        IsTopologyGroup?: boolean
    }
}

/**
 * The cluster-group badge represents Kubernetes cluster objects contained in
 * the group. It must not be replaced by an aggregate of each cluster's Nodes.
 */
export const kubernetesClusterGroupObjectCount = (children: TopologyGroupObject[]): number =>
    new Set(children
        .filter(child => String(child.data?.Type || '').toLowerCase() === 'cluster' && !child.data?.IsTopologyGroup)
        .map(child => child.id))
        .size
