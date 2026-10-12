import { RoutingCard, RoutingEdge, CompactRoute, RoutePoint, routeCompactEdges,
    routeCardHits, routeCrossings, sampleCardEdge } from './InfrastructureCompactRouting'

export type InfrastructureVMLayoutMode = 'linear' | 'compact'
export interface CompactLayoutNode extends RoutingCard {
    parentID?: string; hostID?: string; type: string; weight: number; manager?: string; group?: boolean
    bridgeIDs?: string[]
}
export interface CompactLayoutStats {
    width: number; height: number; fitScale: number; crossings: number; cardHits: number; overlaps: number
}
export interface InfrastructureCompactPlan {
    positions: Map<string, RoutePoint>
    routes: Map<string, CompactRoute>
    movedIDs: Set<string>
    twoRowVMs: number
    reason: 'compact' | 'space' | 'connections' | 'obstacles'
    before: CompactLayoutStats
    after: CompactLayoutStats
}

/** Discover the closest real bridges through NIC relations. Host ownership,
 * shared IPs, VLAN numbers and paths through other VMs never join two networks. */
export function infrastructureVMBridgeIDs(nodes: Array<{ id: string; type: string; parentID?: string; manager?: string }>,
    edges: RoutingEdge[]): Map<string, string[]> {
    const byID = new Map(nodes.map(node => [node.id, node])), neighbors = new Map<string, Set<string>>()
    const add = (a: string, b: string) => {
        if (!neighbors.has(a)) neighbors.set(a, new Set())
        neighbors.get(a)!.add(b)
    }
    const relate = (a: string, b: string) => { add(a, b); add(b, a) }
    edges.forEach(edge => relate(edge.sourceID, edge.targetID))
    nodes.forEach(node => { if (node.parentID) relate(node.id, node.parentID) })
    const bridges = new Set(['bridge', 'ovsbridge', 'openvswitch'])
    const interfaces = new Set(['tuntap', 'tun', 'device', 'vlan', 'bond', 'port', 'switchport', 'interface', 'veth'])
    const result = new Map<string, string[]>()
    nodes.filter(node => node.type === 'libvirt' && node.manager !== 'k8s').forEach(vm => {
        const found = new Set<string>(), visited = new Set<string>([vm.id]), queue = [vm.id]
        for (let i = 0; i < queue.length; i++) for (const id of neighbors.get(queue[i]) || []) {
            if (visited.has(id)) continue
            visited.add(id)
            const node = byID.get(id)
            if (!node || node.manager === 'k8s') continue
            if (bridges.has(node.type)) found.add(id)
            else if (interfaces.has(node.type)) queue.push(id)
        }
        result.set(vm.id, Array.from(found).sort())
    })
    return result
}

const visible = (nodes: CompactLayoutNode[]) => nodes.filter(node => node.width > 0 && node.height > 0)
const extent = (nodes: RoutingCard[]) => ({
    left: Math.min(...nodes.map(node => node.x - node.width / 2)), right: Math.max(...nodes.map(node => node.x + node.width / 2)),
    top: Math.min(...nodes.map(node => node.y - node.height / 2 - (node.above || 0))),
    bottom: Math.max(...nodes.map(node => node.y + node.height / 2 + (node.below || 0)))
})
export const compactCardOverlaps = (nodes: RoutingCard[]) => {
    let count = 0
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = extent([nodes[i]]), b = extent([nodes[j]])
        if (Math.min(a.right, b.right) > Math.max(a.left, b.left) + 0.01
            && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 0.01) count++
    }
    return count
}
const stats = (nodes: CompactLayoutNode[], edges: RoutingEdge[], paths: Map<string, RoutePoint[]>, viewport: { width: number; height: number }): CompactLayoutStats => {
    const cards = visible(nodes), bounds = cards.length ? extent(cards) : { left: 0, right: 0, top: 0, bottom: 0 }, width = bounds.right - bounds.left, height = bounds.bottom - bounds.top
    return { width, height, fitScale: Math.min(1, 0.65 / Math.max(width / Math.max(320, viewport.width), height / Math.max(240, viewport.height))),
        overlaps: compactCardOverlaps(cards), crossings: routeCrossings(edges, paths),
        cardHits: edges.reduce((total, edge) => total + routeCardHits(edge, paths.get(edge.id) || [], cards), 0) }
}

/** Reuse the existing scene, preserving every non-VM ancestor. Two candidates
 * compete against the actual linear geometry; poor candidates never commit. */
export function infrastructureCompactLayout(nodes: CompactLayoutNode[], edges: RoutingEdge[],
    viewport: { width: number; height: number }): InfrastructureCompactPlan {
    const byID = new Map(nodes.map(node => [node.id, node])), children = new Map<string, CompactLayoutNode[]>()
    nodes.forEach(node => { if (node.parentID) children.set(node.parentID, [...children.get(node.parentID) || [], node]) })
    const originalPaths = new Map(edges.map(edge => [edge.id, sampleCardEdge(byID.get(edge.sourceID)!, byID.get(edge.targetID)!, edge.hierarchy)]))
    const before = stats(nodes, edges, originalPaths, viewport)
    const result: InfrastructureCompactPlan = { positions: new Map(nodes.map(node => [node.id, { x: node.x, y: node.y }])),
        routes: new Map(), movedIDs: new Set(), twoRowVMs: 0, reason: 'space', before, after: before }
    const hosts = new Map<string, CompactLayoutNode[]>()
    nodes.filter(node => node.width > 0 && !node.group && node.type === 'libvirt' && node.weight === 7080 && node.manager !== 'k8s').forEach(node => {
        const key = node.hostID || node.parentID || '__root__'
        hosts.set(key, [...hosts.get(key) || [], node])
    })
    const subtree = (node: CompactLayoutNode): CompactLayoutNode[] => [node, ...(children.get(node.id) || [])
        .reduce((all, child) => all.concat(subtree(child)), [] as CompactLayoutNode[])]
    let current = nodes.map(node => ({ ...node })), currentPaths = originalPaths
    const hostEntries = Array.from(hosts).sort(([a], [b]) => a.localeCompare(b))
    for (const [, vms] of hostEntries) {
        if (vms.length < 6) continue
        // Dense multi-homing offers no defensible nearest-bridge grouping.
        if (vms.filter(vm => (vm.bridgeIDs || []).length > 1).length > vms.length / 2) { result.reason = 'connections'; continue }
        const originalOrder = new Map(vms.slice().sort((a, b) => a.x - b.x || a.id.localeCompare(b.id)).map((vm, index) => [vm.id, index]))
        const rank = (vm: CompactLayoutNode) => {
            const positions = (vm.bridgeIDs || []).map(id => byID.get(id)?.x).filter((x): x is number => x !== undefined).sort((a, b) => a - b)
            return positions.length ? positions[Math.floor(positions.length / 2)] : vm.x
        }
        const ordered = vms.slice().sort((a, b) => rank(a) - rank(b)
            || (a.bridgeIDs || []).join('|').localeCompare((b.bridgeIDs || []).join('|'))
            || originalOrder.get(a.id)! - originalOrder.get(b.id)!)
        const blocks = new Map(vms.map(vm => [vm.id, { nodes: subtree(vm), bounds: extent(visible(subtree(vm))) }]))
        const blockWidth = (vm: CompactLayoutNode) => blocks.get(vm.id)!.bounds.right - blocks.get(vm.id)!.bounds.left
        const groupRows: CompactLayoutNode[][] = [[], []]
        const groups = new Map<string, CompactLayoutNode[]>()
        ordered.forEach(vm => { const key = (vm.bridgeIDs || []).join('|') || '__unknown__'; groups.set(key, [...groups.get(key) || [], vm]) })
        groups.forEach(group => {
            const firstWidth = groupRows[0].reduce((sum, vm) => sum + blockWidth(vm), 0)
            const secondWidth = groupRows[1].reduce((sum, vm) => sum + blockWidth(vm), 0)
            const split = firstWidth <= secondWidth ? Math.ceil(group.length / 2) : Math.floor(group.length / 2)
            groupRows[0].push(...group.slice(0, split)); groupRows[1].push(...group.slice(split))
        })
        const half = Math.ceil(ordered.length / 2)
        const candidates = [groupRows, [ordered.slice(0, half), ordered.slice(half)]]
        const checked = new Set<string>()
        let best: { nodes: CompactLayoutNode[]; paths: Map<string, RoutePoint[]>; routes: Map<string, CompactRoute>; moved: Set<string>; metrics: CompactLayoutStats } | undefined
        for (const rows of candidates) {
            if (!rows[0].length || !rows[1].length) continue
            const partition = rows.map(row => row.map(vm => vm.id).join('|')).join('\n')
            if (checked.has(partition)) continue
            checked.add(partition)
            const positions = new Map(current.map(node => [node.id, { x: node.x, y: node.y }]))
            const bounds = extent(vms), center = (bounds.left + bounds.right) / 2, moved = new Set<string>()
            const row1Bottom = Math.max(...rows[0].map(vm => extent([vm]).bottom))
            const row2Top = Math.min(...rows[1].map(vm => extent([vm]).top))
            const rowShift = row1Bottom + 160 - row2Top
            rows.forEach((row, rowIndex) => {
                const width = row.reduce((sum, vm) => sum + blockWidth(vm), 0) + (row.length - 1) * 64
                let cursor = center - width / 2
                row.forEach(vm => {
                    const block = blocks.get(vm.id)!, dx = cursor - block.bounds.left, dy = rowIndex ? rowShift : 0
                    block.nodes.forEach(node => { positions.set(node.id, { x: node.x + dx, y: node.y + dy }); moved.add(node.id) })
                    cursor += blockWidth(vm) + 64
                })
            })
            // Expanded NICs belong below the whole logical VM lane, not between
            // its two visual rows. Preserve their original relative levels;
            // if two owners' NIC blocks collide the candidate will be rejected.
            const descendantCards = vms.reduce((all, vm) => all.concat(visible(blocks.get(vm.id)!.nodes.slice(1))), [] as CompactLayoutNode[])
            if (descendantCards.length) {
                const vmBottom = Math.max(...vms.map(vm => positions.get(vm.id)!.y + vm.height / 2 + (vm.below || 0)))
                const shift = Math.max(0, vmBottom + 48 - extent(descendantCards).top)
                vms.forEach(vm => blocks.get(vm.id)!.nodes.slice(1).forEach(node => {
                    positions.set(node.id, { ...positions.get(node.id)!, y: node.y + shift })
                }))
            }
            // Flextree's skipped-level spacers may sit inside a router card.
            // They are routing points, not objects: move only the user-lane
            // spacer chain into the free channel above the first VM row.
            const laneTop = Math.min(...rows[0].map(vm => positions.get(vm.id)!.y - vm.height / 2 - (vm.above || 0))) - 18
            vms.forEach(vm => {
                let parent = vm.parentID && byID.get(vm.parentID)
                while (parent && parent.width === 0 && parent.weight >= 7080) {
                    positions.set(parent.id, { x: center, y: laneTop }); moved.add(parent.id)
                    parent = parent.parentID && byID.get(parent.parentID)
                }
            })
            const candidate = current.map(node => ({ ...node, ...positions.get(node.id)! }))
            if (compactCardOverlaps(visible(candidate)) > before.overlaps) { result.reason = 'obstacles'; continue }
            const incident = edges.filter(edge => moved.has(edge.sourceID) || moved.has(edge.targetID))
            const trackYs = Array.from({ length: 12 }, (_, i) => row1Bottom + 28 + i * 9)
            const upperTop = Math.min(...vms.map(vm => vm.y - vm.height / 2 - (vm.above || 0)))
            trackYs.push(...Array.from({ length: 12 }, (_, i) => upperTop - 28 - i * 9))
            const routes = routeCompactEdges(candidate, incident, trackYs)
            if (!routes) { result.reason = 'obstacles'; continue }
            const paths = new Map(currentPaths)
            routes.forEach((route, id) => paths.set(id, route.points))
            const metrics = stats(candidate, edges, paths, viewport)
            // Require a real fit gain, less width and no newly occluded cards.
            // A small crossing tolerance is relative to the whole edge set.
            if (metrics.width >= before.width * 0.9 || metrics.fitScale < before.fitScale * 1.08) { result.reason = 'space'; continue }
            if (metrics.cardHits > before.cardHits) { result.reason = 'obstacles'; continue }
            if (metrics.crossings > before.crossings + Math.max(2, Math.floor(edges.length * 0.03))) { result.reason = 'connections'; continue }
            if (!best || metrics.crossings < best.metrics.crossings
                || (metrics.crossings === best.metrics.crossings && metrics.fitScale > best.metrics.fitScale)) {
                best = { nodes: candidate, paths, routes, moved, metrics }
            }
        }
        if (!best) continue
        current = best.nodes; currentPaths = best.paths
        best.routes.forEach((route, id) => result.routes.set(id, route))
        best.moved.forEach(id => result.movedIDs.add(id))
        result.twoRowVMs += vms.length; result.after = best.metrics; result.reason = 'compact'
    }
    current.forEach(node => result.positions.set(node.id, { x: node.x, y: node.y }))
    if (result.twoRowVMs) result.reason = 'compact'
    return result
}
