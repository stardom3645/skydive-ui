import { INFRASTRUCTURE_TRAFFIC_LANE_GAP } from './TopologyLaneSpacing'
import { RoutingCard, RoutingEdge, CompactRoute, RoutePoint, routeCompactEdges,
    routeCardHits, routeCrossings, sampleCardEdge, translateCompactRoute, segmentHitsCard } from './InfrastructureCompactRouting'
import { infrastructureVMBundles, InfrastructureVMBundle } from './InfrastructureVMBundles'
import { topologyBranchOffsets } from './TopologyBranchSpacing'

export type InfrastructureVMLayoutMode = 'linear' | 'compact'
export interface CompactLayoutNode extends RoutingCard {
    parentID?: string; hostID?: string; type: string; weight: number; manager?: string; group?: boolean
    bridgeIDs?: string[]; vmOwnerID?: string
}
export interface CompactLayoutStats {
    width: number; height: number; fitScale: number; crossings: number; cardHits: number; overlaps: number
}
export interface InfrastructureCompactPlan {
    positions: Map<string, RoutePoint>
    routes: Map<string, CompactRoute>
    movedIDs: Set<string>
    vmRows: Map<string, number>
    hostAnchors: Map<string, RoutePoint>
    bundles: InfrastructureVMBundle[]
    wrappedVMs: number
    rowCount: number
    viewportWidth: number
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
const sceneSize = (cards: RoutingCard[], viewport: { width: number; height: number }) => {
    const bounds = cards.length ? extent(cards) : { left: 0, right: 0, top: 0, bottom: 0 }, width = bounds.right - bounds.left, height = bounds.bottom - bounds.top
    return { width, height, fitScale: Math.min(1, 0.65 / Math.max(width / Math.max(320, viewport.width), height / Math.max(240, viewport.height))) }
}
const stats = (nodes: CompactLayoutNode[], edges: RoutingEdge[], paths: Map<string, RoutePoint[]>, viewport: { width: number; height: number }): CompactLayoutStats => {
    const cards = visible(nodes)
    return { ...sceneSize(cards, viewport),
        overlaps: compactCardOverlaps(cards), // Infrastructure hierarchy guides are hidden; assess displayed traffic crossings.
        crossings: routeCrossings(edges.filter(edge => !edge.hierarchy), paths),
        cardHits: edges.reduce((total, edge) => total + routeCardHits(edge, paths.get(edge.id) || [], cards), 0) }
}

/** Keep drilldown cards under their owner. Invisible alignment wrappers do not
 * add a visual row; sibling NICs and their groups reserve their own block. */
const vmBlock = (vm: CompactLayoutNode, children: Map<string, CompactLayoutNode[]>) => {
    const points = new Map<string, RoutePoint>(), members: CompactLayoutNode[] = []
    const collect = (node: CompactLayoutNode) => { members.push(node); (children.get(node.id) || []).forEach(collect) }
    collect(vm)
    const visibleChildren = (node: CompactLayoutNode): CompactLayoutNode[] => (children.get(node.id) || [])
        .reduce((all, child) => all.concat(child.width > 0 ? [child] : visibleChildren(child)), [] as CompactLayoutNode[])
    const measure = (node: CompactLayoutNode): { width: number; bottom: number; points: Map<string, RoutePoint> } => {
        const nested = visibleChildren(node).sort((a, b) => a.x - b.x || a.id.localeCompare(b.id)).map(child => ({ child, block: measure(child) }))
        const width = Math.max(node.width, nested.reduce((sum, item) => sum + item.block.width, 0) + Math.max(0, nested.length - 1) * 32)
        const ownBottom = node.height / 2 + (node.below || 0), layout = new Map<string, RoutePoint>([[node.id, { x: 0, y: 0 }]])
        let cursor = -nested.reduce((sum, item) => sum + item.block.width, 0) / 2 - Math.max(0, nested.length - 1) * 16
        let bottom = ownBottom
        nested.forEach(({ child, block }) => {
            const x = cursor + block.width / 2, y = ownBottom + 48 + child.height / 2 + (child.above || 0)
            block.points.forEach((point, id) => layout.set(id, { x: point.x + x, y: point.y + y }))
            bottom = Math.max(bottom, y + block.bottom); cursor += block.width + 32
        })
        return { width, bottom, points: layout }
    }
    measure(vm).points.forEach((point, id) => points.set(id, point))
    const parents = new Map(members.map(node => [node.id, node]))
    members.filter(node => node.width === 0).forEach(node => {
        let parent = node.parentID && parents.get(node.parentID)
        while (parent && parent.width === 0) parent = parent.parentID && parents.get(parent.parentID)
        const anchor = parent && points.get(parent.id)
        if (parent && anchor) points.set(node.id, { x: anchor.x, y: anchor.y + parent.height / 2 + (parent.below || 0) + 24 })
    })
    return { nodes: members, points, bounds: extent(visible(members).map(node => ({ ...node, ...points.get(node.id)! }))) }
}

/** Reuse the existing scene, preserving every non-VM ancestor. Width-limited
 * rows continue downward, keeping each VM and its drilldown in one unit. */
export function infrastructureCompactLayout(nodes: CompactLayoutNode[], edges: RoutingEdge[],
    viewport: { width: number; height: number }, previous?: InfrastructureCompactPlan): InfrastructureCompactPlan {
    const byID = new Map(nodes.map(node => [node.id, node])), children = new Map<string, CompactLayoutNode[]>()
    nodes.forEach(node => { if (node.parentID) children.set(node.parentID, [...children.get(node.parentID) || [], node]) })
    const originalPaths = new Map(edges.map(edge => [edge.id, sampleCardEdge(byID.get(edge.sourceID)!, byID.get(edge.targetID)!, edge.hierarchy)]))
    const before = stats(nodes, edges, originalPaths, viewport)
    const result: InfrastructureCompactPlan = { positions: new Map(nodes.map(node => [node.id, { x: node.x, y: node.y }])),
        routes: new Map(), movedIDs: new Set(), vmRows: new Map(), hostAnchors: new Map(), bundles: [], wrappedVMs: 0, rowCount: 1, viewportWidth: viewport.width, reason: 'space', before, after: before }
    const hosts = new Map<string, CompactLayoutNode[]>()
    nodes.filter(node => node.width > 0 && !node.group && node.type === 'libvirt' && node.weight === 7080 && node.manager !== 'k8s').forEach(node => {
        const key = node.hostID || node.parentID || '__root__'
        hosts.set(key, [...hosts.get(key) || [], node])
    })
    const subtree = (node: CompactLayoutNode): CompactLayoutNode[] => [node, ...(children.get(node.id) || [])
        .reduce((all, child) => all.concat(subtree(child)), [] as CompactLayoutNode[])]
    let current = nodes.map(node => ({ ...node })), currentPaths = originalPaths
    const hostEntries = Array.from(hosts).sort(([a], [b]) => a.localeCompare(b))
    for (const [hostID, vms] of hostEntries) {
        if (vms.length < 2) continue
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
        const blocks = new Map(vms.map(vm => [vm.id, vmBlock(vm, children)]))
        const hasVisibleNICs = nodes.some(node => node.width > 0 && vms.some(vm => vm.id === node.vmOwnerID))
        // Other hosts retain their existing coordinates. Their collapsed cards
        // can still define the full-scene width after this VM branch shrinks.
        // Measure the benefit in the affected host, while requiring the whole
        // scene's cards and ownership regions remain clear.
        const owner = byID.get(hostID)
        const ownedIDs = new Set((owner ? subtree(owner) : nodes.filter(node => node.hostID === hostID || vms.includes(node))).map(node => node.id))
        const branchBefore = sceneSize(visible(current.filter(node => ownedIDs.has(node.id))), viewport)
        const blockWidth = (vm: CompactLayoutNode) => blocks.get(vm.id)!.bounds.right - blocks.get(vm.id)!.bounds.left
        // Target readable cards at roughly 40% zoom, reserving the group
        // summary at the left. At most eight VM units share a row, while wide
        // NIC drilldowns can consume several normal card slots.
        const rowBudget = Math.max(Math.max(...vms.map(blockWidth)), viewport.width / 0.4 - 620)
        const packRows = (items: CompactLayoutNode[]) => {
            const rows: CompactLayoutNode[][] = [[]]
            let width = 0
            for (const vm of items) {
                const size = blockWidth(vm), row = rows[rows.length - 1]
                if (row.length && (row.length >= 8 || width + 64 + size > rowBudget)) {
                    rows.push([]); width = 0
                }
                const next = rows[rows.length - 1]
                width += (next.length ? 64 : 0) + size
                next.push(vm)
            }
            return rows
        }
        const continuing = !!previous?.vmRows && previous.viewportWidth === viewport.width && vms.every(vm => previous!.vmRows.has(vm.id))
        const retainedRows = continuing ? Array.from(new Set(vms.map(vm => previous!.vmRows.get(vm.id)!))).sort((a, b) => a - b)
            .map(row => vms.filter(vm => previous!.vmRows.get(vm.id) === row)
                .sort((a, b) => previous!.positions.get(a.id)!.x - previous!.positions.get(b.id)!.x || a.id.localeCompare(b.id))) : []
        const candidates = continuing ? [retainedRows] : [packRows(ordered),
            packRows(vms.slice().sort((a, b) => originalOrder.get(a.id)! - originalOrder.get(b.id)!))]
        const checked = new Set<string>()
        let best: { nodes: CompactLayoutNode[]; paths: Map<string, RoutePoint[]>; routes: Map<string, CompactRoute>; moved: Set<string>; metrics: CompactLayoutStats; rows: CompactLayoutNode[][]; anchor: RoutePoint } | undefined
        for (const rows of candidates) {
            if (rows.length < 2 || rows.some(row => !row.length)) continue
            const partition = rows.map(row => row.map(vm => vm.id).join('|')).join('\n')
            if (checked.has(partition)) continue
            checked.add(partition)
            const positions = new Map(current.map(node => [node.id, { x: node.x, y: node.y }]))
            const bounds = extent(vms.map(vm => ({ ...vm, ...(continuing ? previous!.positions.get(vm.id)! : {}) })))
            const retainedAnchor = continuing ? previous!.hostAnchors?.get(hostID) : undefined
            const previousHost = continuing ? previous!.positions.get(hostID) : undefined
            const center = retainedAnchor ? retainedAnchor.x + (owner && previousHost ? owner.x - previousHost.x : 0)
                : (bounds.left + bounds.right) / 2, moved = new Set<string>()
            let firstY = retainedAnchor?.y ?? (continuing ? Math.min(...rows[0].map(vm => previous!.positions.get(vm.id)!.y)) : Math.min(...vms.map(vm => vm.y)))
            // A retained anchor must respect the deepest router/NIC in any
            // host. Otherwise another host keeps its old user row inside the
            // expanded router lane, leaving no common horizontal boundary.
            const upper = visible(current.filter(node => node.weight < 7080))
            if (upper.length) firstY = Math.max(firstY, extent(upper).bottom + INFRASTRUCTURE_TRAFFIC_LANE_GAP
                - Math.min(...rows[0].map(vm => blocks.get(vm.id)!.bounds.top)))
            const rowBottoms: number[] = []
            let rowY = firstY
            rows.forEach((row, rowIndex) => {
                if (rowIndex) rowY = rowBottoms[rowIndex - 1] + INFRASTRUCTURE_TRAFFIC_LANE_GAP
                    - Math.min(...row.map(vm => blocks.get(vm.id)!.bounds.top))
                const width = row.reduce((sum, vm) => sum + blockWidth(vm), 0) + (row.length - 1) * 64
                let cursor = center - width / 2
                row.forEach(vm => {
                    const block = blocks.get(vm.id)!, dx = cursor - block.bounds.left
                    block.nodes.forEach(node => { const point = block.points.get(node.id)!
                        positions.set(node.id, { x: point.x + dx, y: point.y + rowY }); moved.add(node.id) })
                    cursor += blockWidth(vm) + 64
                })
                rowBottoms.push(rowY + Math.max(...row.map(vm => blocks.get(vm.id)!.bounds.bottom)))
            })
            // The existing VM group card is a summary of this block, not an
            // unrelated object at the old one-row left edge.
            const siblingParents = new Set(vms.map(vm => vm.parentID))
            const summaries = current.filter(node => node.group && node.type === 'libvirt' && node.weight === 7080
                && (node.hostID === hostID || siblingParents.has(node.parentID)))
            const rowLeft = Math.min(...rows[0].map(vm => positions.get(vm.id)!.x + blocks.get(vm.id)!.bounds.left))
            const rowTop = Math.min(...rows[0].map(vm => positions.get(vm.id)!.y + blocks.get(vm.id)!.bounds.top))
            let summaryRight = rowLeft - 64
            summaries.forEach(summary => {
                positions.set(summary.id, { x: summaryRight - summary.width / 2, y: rowTop + summary.height / 2 + (summary.above || 0) })
                moved.add(summary.id); summaryRight -= summary.width + 64
            })
            // Flextree's skipped-level spacers may sit inside a router card.
            // They are routing points, not objects: move only the user-lane
            // spacer chain into the free channel above the first VM row.
            const laneTop = Math.min(...rows[0].map(vm => positions.get(vm.id)!.y - vm.height / 2 - (vm.above || 0))) - (hasVisibleNICs ? 40 : 18)
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
            const trackYs: number[] = []
            rowBottoms.slice(0, -1).forEach(bottom => trackYs.push(...Array.from({ length: 4 }, (_, i) => bottom + 28 + i * 32)))
            const upperTop = Math.min(...vms.map(vm => vm.y - vm.height / 2 - (vm.above || 0)))
            trackYs.push(...Array.from({ length: 12 }, (_, i) => upperTop - 28 - i * 9))
            const candidateRows = new Map(result.vmRows)
            rows.forEach((row, index) => row.forEach(vm => candidateRows.set(vm.id, index)))
            const bundles = infrastructureVMBundles(candidate, candidateRows)
            // A VM-only surface already fits inside the card's routing halo.
            // Only expanded ownership units add a new region obstacle.
            const routingBundles = bundles.filter(bundle => candidate.some(node => node.width > 0
                && node.id !== bundle.vmID && bundle.nodeIDs.includes(node.id)))
            const routes = routeCompactEdges(candidate, incident, trackYs, routingBundles)
            if (!routes) { result.reason = 'obstacles'; continue }
            const paths = new Map(currentPaths)
            routes.forEach((route, id) => paths.set(id, route.points))
            const metrics = stats(candidate, edges, paths, viewport)
            const branchAfter = sceneSize(visible(candidate.filter(node => ownedIDs.has(node.id))), viewport)
            // A local improvement need not shrink unrelated, unmoved hosts.
            // Multi-row layouts favor readable width and vertical navigation.
            // Keep the compact Fit guard for short, two-row candidates.
            // Expansion is a drilldown of an already chosen layout, not a new
            // competition against one row. Retain its partition; new cards
            // still pass the overlap and obstacle-routing checks above.
            if (!continuing && (branchAfter.width >= branchBefore.width * 0.9 || (rows.length === 2
                && (branchAfter.fitScale < branchBefore.fitScale * 1.08 || metrics.fitScale < before.fitScale - 1e-9)))) { result.reason = 'space'; continue }
            if (metrics.cardHits > before.cardHits) { result.reason = 'obstacles'; continue }
            // Longer vertical navigation introduces intersections between distinct
            // bridge branches. They must not force a many-row layout back into
            // one enormous row; card and ownership obstacles remain enforced.
            if (!continuing && rows.length === 2 && metrics.crossings > before.crossings + Math.max(2, Math.floor(edges.length * 0.03))) { result.reason = 'connections'; continue }
            if (!best || metrics.crossings < best.metrics.crossings
                || (metrics.crossings === best.metrics.crossings && metrics.fitScale > best.metrics.fitScale)) {
                best = { nodes: candidate, paths, routes, moved, metrics, rows, anchor: { x: center, y: firstY } }
            }
        }
        if (!best) continue
        current = best.nodes; currentPaths = best.paths
        best.routes.forEach((route, id) => result.routes.set(id, route))
        best.moved.forEach(id => result.movedIDs.add(id))
        best.rows.forEach((row, index) => row.forEach(vm => result.vmRows.set(vm.id, index)))
        result.hostAnchors.set(hostID, best.anchor)
        result.rowCount = Math.max(result.rowCount, best.rows.length)
        result.wrappedVMs += vms.length; result.after = best.metrics; result.reason = 'compact'
    }
    if (result.wrappedVMs) {
        // The original tree packed hosts using their one-row widths. Pack the
        // final Compact silhouettes instead, translating each complete host
        // branch so its internal rows, upper lanes and ownership stay intact.
        const hostIDs = new Set(current.filter(node => node.type === 'host' && !node.group && node.manager !== 'k8s').map(node => node.id))
        if (hostIDs.size > 1) {
            const owners = new Map<string, string>()
            const currentNodes = new Map(current.map(node => [node.id, node]))
            current.forEach(node => {
                let parent: CompactLayoutNode | undefined = node
                const seen = new Set<string>()
                while (parent && !seen.has(parent.id)) {
                    seen.add(parent.id)
                    const owner = hostIDs.has(parent.id) ? parent.id : parent.hostID
                    if (owner && hostIDs.has(owner)) { owners.set(node.id, owner); break }
                    parent = currentNodes.get(parent.parentID || '')
                }
            })
            const forest = current.filter(node => owners.has(node.id)).map(node => ({
                ...node, parentID: hostIDs.has(node.id) ? undefined : owners.get(node.parentID || '') === owners.get(node.id)
                    ? node.parentID : owners.get(node.id), visible: node.width > 0, expanded: true,
                height: node.height + (node.above || 0) + (node.below || 0), y: node.y + ((node.below || 0) - (node.above || 0)) / 2
            }))
            const offsets = topologyBranchOffsets(forest, 144, true, true)
            const shift = (id: string) => offsets.get(owners.get(id) || '') || 0
            const packed = current.map(node => ({ ...node, x: node.x + shift(node.id) }))
            const bundles = infrastructureVMBundles(packed, result.vmRows)
            const proposed = new Map(Array.from(result.routes, ([id, route]) => {
                const edge = edges.find(edge => edge.id === id)!
                return [id, translateCompactRoute(route, shift(edge.sourceID))]
            }))
            const packedByID = new Map(packed.map(node => [node.id, node])), currentByID = new Map(current.map(node => [node.id, node]))
            const conflicting = edges.filter(edge => {
                const old = result.routes.get(edge.id)?.points || sampleCardEdge(currentByID.get(edge.sourceID)!, currentByID.get(edge.targetID)!, edge.hierarchy)
                const next = proposed.get(edge.id)?.points || sampleCardEdge(packedByID.get(edge.sourceID)!, packedByID.get(edge.targetID)!, edge.hierarchy)
                return (proposed.has(edge.id) && shift(edge.sourceID) !== shift(edge.targetID))
                    || routeCardHits(edge, next, packed) > routeCardHits(edge, old, current)
                    || bundles.some(bundle => !bundle.nodeIDs.includes(edge.sourceID) && !bundle.nodeIDs.includes(edge.targetID)
                        && next.slice(1).some((point, i) => segmentHitsCard(next[i], point, bundle)))
            })
            const rerouted = conflicting.length ? routeCompactEdges(packed, conflicting, [], bundles.filter(bundle =>
                packed.some(node => node.width > 0 && node.id !== bundle.vmID && bundle.nodeIDs.includes(node.id)))) : new Map<string, CompactRoute>()
            if (rerouted && compactCardOverlaps(visible(packed)) <= result.after.overlaps) {
                current = packed
                proposed.forEach((route, id) => result.routes.set(id, route))
                rerouted.forEach((route, id) => result.routes.set(id, route))
                result.hostAnchors.forEach((point, id) => result.hostAnchors.set(id, { ...point, x: point.x + (offsets.get(id) || 0) }))
                owners.forEach((_, id) => { if (shift(id)) result.movedIDs.add(id) })
                const paths = new Map(edges.map(edge => [edge.id, result.routes.get(edge.id)?.points
                    || sampleCardEdge(current.find(node => node.id === edge.sourceID)!, current.find(node => node.id === edge.targetID)!, edge.hierarchy)]))
                result.after = stats(current, edges, paths, viewport)
            }
        }
    }
    current.forEach(node => result.positions.set(node.id, { x: node.x, y: node.y }))
    result.bundles = infrastructureVMBundles(current, result.vmRows)
    if (result.wrappedVMs) result.reason = 'compact'
    return result
}
