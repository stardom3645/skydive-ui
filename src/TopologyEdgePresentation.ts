export interface TopologyCardBounds { x: number; y: number; width: number; height: number }

/** Clip endpoints to the card edges without touching relationship identity or
 * the layout. Hierarchy links share the same horizontal branching level. */
export const topologyCardEdge = (source: TopologyCardBounds, target: TopologyCardBounds, hierarchy = false): string => {
    const dx = target.x - source.x, dy = target.y - source.y
    if (hierarchy || Math.abs(dy) >= Math.abs(dx) * 0.35) {
        const direction = dy >= 0 ? 1 : -1
        const start = { x: source.x, y: source.y + source.height / 2 * direction }
        const end = { x: target.x, y: target.y - target.height / 2 * direction }
        if (!hierarchy) {
            const middle = (start.y + end.y) / 2
            return `M${start.x},${start.y} C${start.x},${middle} ${end.x},${middle} ${end.x},${end.y}`
        }
        // Center levels provide one branch line even when sibling cards use
        // different sizes. Clamp only when unusually close cards need it.
        const lower = Math.min(start.y, end.y), upper = Math.max(start.y, end.y)
        const middle = Math.max(lower, Math.min(upper, (source.y + target.y) / 2))
        const sign = dx >= 0 ? 1 : -1
        const radius = Math.min(12, Math.abs(dx) / 2, Math.abs(end.y - start.y) / 4)
        return `M${start.x},${start.y} V${middle-radius*direction} Q${start.x},${middle} ${start.x+radius*sign},${middle} H${end.x-radius*sign} Q${end.x},${middle} ${end.x},${middle+radius*direction} V${end.y}`
    }
    const direction = dx >= 0 ? 1 : -1
    const startX = source.x + source.width / 2 * direction
    const endX = target.x - target.width / 2 * direction
    const middle = (startX + endX) / 2
    return `M${startX},${source.y} C${middle},${source.y} ${middle},${target.y} ${endX},${target.y}`
}

/** Invisible spacers preserve skipped hierarchy levels. Treat their complete
 * path as one visible parent/child relation when emphasizing connections. */
export const topologyHierarchyEdgeIDs = <T>(source: T, target: T, access: {
    id: (node: T) => string; hidden: (node: T) => boolean
    parent: (node: T) => T | null | undefined; children: (node: T) => T[]
}): { source: string; targets: string[] } => {
    let ancestor = source
    while (access.hidden(ancestor) && access.parent(ancestor)) ancestor = access.parent(ancestor)!
    const targets: string[] = []
    const visit = (node: T) => {
        if (access.hidden(node)) access.children(node).forEach(visit)
        else targets.push(access.id(node))
    }
    visit(target)
    return { source: access.id(ancestor), targets }
}

/** Draw execution ownership only where a real workload and its Pod are both
 * rendered. Hidden alignment wrappers are not relationship endpoints. */
export const kubernetesPodOwnershipEdges = <T>(nodes: T[], access: {
    id: (node: T) => string; type: (node: T) => string; manager: (node: T) => string
    hidden: (node: T) => boolean; group: (node: T) => boolean
    parent: (node: T) => T | null | undefined
}): Array<{ source: T; target: T }> => {
    const workloads = new Set(['deployment', 'daemonset', 'statefulset', 'job', 'cronjob', 'replicaset'])
    const visible = new Set(nodes.filter(node => !access.hidden(node) && !access.group(node)))
    const edges: Array<{ source: T; target: T }> = []
    nodes.forEach(target => {
        if (!visible.has(target) || access.manager(target) !== 'k8s' || access.type(target) !== 'pod') return
        let source = access.parent(target)
        const seen = new Set<string>([access.id(target)])
        while (source && access.hidden(source)) {
            if (seen.has(access.id(source))) return
            seen.add(access.id(source)); source = access.parent(source)
        }
        if (source && visible.has(source) && access.manager(source) === 'k8s' && workloads.has(access.type(source))) {
            edges.push({ source, target })
        }
    })
    return edges
}

/** Reuse a collected link for each ownership pair, regardless of its direction.
 * Only pairs without an existing link need a display-only ownership link. */
export const mergeKubernetesPodOwnershipLinks = <TNode, TLink>(edges: Array<{ source: TNode; target: TNode }>, links: TLink[], access: {
    nodeID: (node: TNode) => string; sourceID: (link: TLink) => string; targetID: (link: TLink) => string
    reuse: (link: TLink) => TLink; create: (edge: { source: TNode; target: TNode }) => TLink
}): TLink[] => {
    const key = (a: string, b: string) => JSON.stringify([a, b].sort())
    const owners = new Map(edges.map(edge => [key(access.nodeID(edge.source), access.nodeID(edge.target)), edge]))
    const seen = new Set<string>(), result: TLink[] = []
    links.forEach(link => {
        const pair = key(access.sourceID(link), access.targetID(link))
        if (!owners.has(pair)) { result.push(link); return }
        if (!seen.has(pair)) { seen.add(pair); result.push(access.reuse(link)) }
    })
    owners.forEach((edge, pair) => { if (!seen.has(pair)) result.push(access.create(edge)) })
    return result
}
