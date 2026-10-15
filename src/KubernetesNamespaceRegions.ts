import { topologyHostRegionBounds, TopologyRegionNode, TopologyRegionBand } from './TopologyGroupRegions'

export interface KubernetesNamespaceRegionNode extends TopologyRegionNode {
    resourceID?: string
    manager?: string
    name?: string
    namespace?: string
    clusterName?: string
    group?: boolean
}
export interface KubernetesNamespaceRegion {
    id: string
    clusterID: string
    nodeIDs: string[]
    bounds: TopologyRegionBand
}
const scopedTypes = new Set(['deployment', 'statefulset', 'daemonset', 'job', 'cronjob', 'replicaset', 'pod'])
const isKubernetes = (node: KubernetesNamespaceRegionNode) => node.manager === 'k8s'

/** Read the rendered ancestry, including hidden layout spacers. Metadata is a
 * fallback only within one verified cluster, never a cross-cluster name match. */
const namespaceBranches = (nodes: KubernetesNamespaceRegionNode[]) => {
    const byID = new Map(nodes.map(node => [node.id, node]))
    const ancestry = (node: KubernetesNamespaceRegionNode): KubernetesNamespaceRegionNode[] => {
        const parents: KubernetesNamespaceRegionNode[] = [], seen = new Set<string>([node.id])
        let parent = node.parentID ? byID.get(node.parentID) : undefined
        while (parent && !seen.has(parent.id)) {
            seen.add(parent.id); parents.push(parent)
            parent = parent.parentID ? byID.get(parent.parentID) : undefined
        }
        return parents
    }
    const ancestors = new Map(nodes.map(node => [node.id, ancestry(node)]))
    const cluster = (node: KubernetesNamespaceRegionNode): string => {
        const parent = ancestors.get(node.id)!.find(parent => isKubernetes(parent) && parent.type === 'cluster' && !parent.group)
        return parent ? parent.resourceID || parent.id : node.clusterName ? `name:${node.clusterName}` : ''
    }
    const roots = nodes.filter(node => node.visible && isKubernetes(node) && node.type === 'namespace' && !node.group)
    const rootsByResource = new Map(roots.map(node => [node.resourceID || node.id, node]))
    const ownerOf = (node: KubernetesNamespaceRegionNode): KubernetesNamespaceRegionNode | undefined => {
        if (!isKubernetes(node) || node.visible && node.type !== 'namespace' && !scopedTypes.has(node.type || '')) return undefined
        if (roots.includes(node)) return node
        const parent = ancestors.get(node.id)!.map(parent => rootsByResource.get(parent.resourceID || parent.id)).find(Boolean)
        if (parent) return !node.namespace || node.namespace === parent.name ? parent : undefined
        if (!node.namespace || !cluster(node)) return undefined
        const matches = roots.filter(root => root.name === node.namespace && cluster(root) === cluster(node))
        return matches.length === 1 ? matches[0] : undefined
    }
    const owners = new Map(nodes.map(node => [node.id, ownerOf(node)]))
    return { branches: roots.map(root => ({ root, clusterID: cluster(root),
        // Hidden nodes can move with the branch but cannot enlarge its surface.
        nodes: nodes.filter(node => owners.get(node.id) === root) })),
        // An expanded group remains a separate card beside its members. It is
        // not a namespace surface, but its occupied space must be reserved.
        groups: nodes.filter(node => node.visible && isKubernetes(node) && node.type === 'namespace' && node.group)
            .map(root => ({ root, clusterID: cluster(root), nodes: [root] })) }
}

/** Pack complete namespace branches side by side, preserving the relative
 * positions of workloads and Pods. Only the namespace header is left-aligned
 * within its own area; hierarchy, y positions, identities and states are intact. */
export function kubernetesNamespaceOffsets(nodes: KubernetesNamespaceRegionNode[], gap = 36): Map<string, number> {
    const layout = namespaceBranches(nodes)
    const activeClusters = new Set(layout.branches.map(branch => branch.clusterID))
    const groups = new Map<string, Array<{ root: KubernetesNamespaceRegionNode; nodes: KubernetesNamespaceRegionNode[]; bounds: TopologyRegionBand }>>()
    // Keep the retained group before its namespace members, as in groupify's
    // normal order. Collapsed groups without visible members keep their layout.
    const reservations = layout.groups.filter(group => activeClusters.has(group.clusterID)).sort((a, b) => a.root.x - b.root.x)
    ;[...reservations, ...layout.branches].forEach(branch => {
        const bounds = topologyHostRegionBounds(branch.nodes, 24)
        if (!bounds || !branch.clusterID) return
        const siblings = groups.get(branch.clusterID) || []
        siblings.push({ ...branch, bounds }); groups.set(branch.clusterID, siblings)
    })
    const offsets = new Map<string, number>()
    groups.forEach(branches => {
        const left = Math.min(...branches.map(branch => branch.bounds.left)), right = Math.max(...branches.map(branch => branch.bounds.right))
        const width = branches.reduce((sum, branch) => sum + branch.bounds.right - branch.bounds.left, 0) + gap * (branches.length - 1)
        let cursor = (left + right - width) / 2
        branches.forEach(branch => {
            const delta = cursor - branch.bounds.left
            branch.nodes.forEach(node => offsets.set(node.id, delta))
            // A wide child row belongs to the header at its left, not to a
            // namespace centered over a large empty part of the region.
            offsets.set(branch.root.id, cursor + 24 + branch.root.width / 2 - branch.root.x)
            cursor += branch.bounds.right - branch.bounds.left + gap
        })
    })
    return offsets
}

export function kubernetesNamespaceRegions(nodes: KubernetesNamespaceRegionNode[]): KubernetesNamespaceRegion[] {
    return namespaceBranches(nodes).branches.map(branch => {
        const bounds = topologyHostRegionBounds(branch.nodes, 24)
        return bounds ? { id: branch.root.id, clusterID: branch.clusterID,
            nodeIDs: branch.nodes.filter(node => node.visible).map(node => node.id), bounds } : undefined
    }).filter((region): region is KubernetesNamespaceRegion => !!region)
}
