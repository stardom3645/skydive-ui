/** Presentation-only bounds, copied from the already laid-out visible tree. */
export interface TopologyRegionNode {
    id: string
    parentID?: string
    visible: boolean
    expanded: boolean
    x: number
    y: number
    width: number
    height: number
}

export interface TopologyGroupRegion {
    id: string
    nodeIDs: string[]
    path: string
    variant: number
}

export interface TopologyRegionBand { left: number; right: number; top: number; bottom: number }

// Prefer a stable identity tone; visible neighbors can require more contrast.
const regionVariant = (id: string) => {
    let hash = 2166136261
    for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
    return (hash >>> 0) % 4
}

/** Follow each occupied row instead of filling the subtree's bounding rectangle.
 * Cubic connectors stay within the adjacent row widths; they cannot overshoot
 * into a neighbouring branch. Invisible layout spacers never enlarge a region.
 */
export const topologyGroupRegionBands = (nodes: TopologyRegionNode[], padding = 24, paddingX = Math.min(padding, 16)): TopologyRegionBand[] => {
    const bands: TopologyRegionBand[] = []
    const bounds = nodes.filter(node => node.visible && [node.x, node.y, node.width, node.height].every(Number.isFinite)
        && node.width > 0 && node.height > 0).map(node => ({
            left: node.x - node.width / 2 - paddingX,
            right: node.x + node.width / 2 + paddingX,
            top: node.y - node.height / 2 - padding,
            bottom: node.y + node.height / 2 + padding
        })).sort((a, b) => a.top - b.top)
    bounds.forEach(bound => {
        const previous = bands[bands.length - 1]
        if (previous && bound.top <= previous.bottom) {
            previous.left = Math.min(previous.left, bound.left)
            previous.right = Math.max(previous.right, bound.right)
            previous.bottom = Math.max(previous.bottom, bound.bottom)
        } else bands.push({ ...bound })
    })
    return bands
}

export const topologyGroupRegionPath = (nodes: TopologyRegionNode[], padding = 24): string => {
    const bands = topologyGroupRegionBands(nodes, padding)
    if (!bands.length) return ''
    const first = bands[0], last = bands[bands.length - 1]
    const radius = Math.min(padding, 32, (first.bottom - first.top) / 3, (last.bottom - last.top) / 3)
    let path = `M ${first.left},${first.top + radius} C ${first.left},${first.top - radius / 3} ${first.right},${first.top - radius / 3} ${first.right},${first.top + radius}`
    bands.forEach((band, index) => {
        path += ` L ${band.right},${band.bottom - (index === bands.length - 1 ? radius : 0)}`
        const next = bands[index + 1]
        if (next) {
            const middleY = (band.bottom + next.top) / 2
            path += ` C ${band.right},${middleY} ${next.right},${middleY} ${next.right},${next.top}`
        }
    })
    path += ` C ${last.right},${last.bottom + radius / 3} ${last.left},${last.bottom + radius / 3} ${last.left},${last.bottom - radius}`
    for (let index = bands.length - 1; index >= 0; index--) {
        const band = bands[index]
        path += ` L ${band.left},${band.top + (index === 0 ? radius : 0)}`
        const previous = bands[index - 1]
        if (previous) {
            const middleY = (previous.bottom + band.top) / 2
            path += ` C ${band.left},${middleY} ${previous.left},${middleY} ${previous.left},${previous.bottom}`
        }
    }
    return path + ' Z'
}

/** Partition by the first visible ancestor. A collapsed top-level card and an
 * expanded group proxy without visible descendants do not create an empty halo.
 */
export const topologyVisibleBranches = (nodes: TopologyRegionNode[]): Array<{ id: string; nodes: TopologyRegionNode[] }> => {
    const byID = new Map(nodes.map(node => [node.id, node]))
    const owners = new Map<string, TopologyRegionNode>()
    const ownerOf = (node: TopologyRegionNode): TopologyRegionNode => {
        const cached = owners.get(node.id)
        if (cached) return cached
        const parent = node.parentID ? byID.get(node.parentID) : undefined
        const owner = parent ? ownerOf(parent) : node
        const visibleOwner = owner.visible ? owner : node.visible ? node : owner
        owners.set(node.id, visibleOwner)
        return visibleOwner
    }
    const branches = new Map<string, TopologyRegionNode[]>()
    nodes.filter(node => node.visible).forEach(node => {
        const owner = ownerOf(node)
        const branch = branches.get(owner.id) || []
        branch.push(node)
        branches.set(owner.id, branch)
    })
    return Array.from(branches.entries()).map(([id, branch]) => ({ id, nodes: branch }))
}

// Approximate lightness of the four blue-gray surfaces. Preserve a visible
// intensity difference between neighboring branches.
export const TOPOLOGY_GROUP_TONE_LIGHTNESS = [245, 236, 246, 237]

export const topologyGroupRegions = (nodes: TopologyRegionNode[]): TopologyGroupRegion[] => {
    const regions = topologyVisibleBranches(nodes)
        .filter(branch => branch.nodes.length > 1 && branch.nodes.find(node => node.id === branch.id)!.expanded)
        .sort((a, b) => a.nodes.find(node => node.id === a.id)!.x - b.nodes.find(node => node.id === b.id)!.x || a.id.localeCompare(b.id))
        .map(branch => ({ id: branch.id, nodeIDs: branch.nodes.map(node => node.id), path: topologyGroupRegionPath(branch.nodes), variant: regionVariant(branch.id) }))
        .filter(region => !!region.path)
    regions.forEach((region, index) => {
        if (!index) return
        const previous = TOPOLOGY_GROUP_TONE_LIGHTNESS[regions[index - 1].variant]
        if (Math.abs(TOPOLOGY_GROUP_TONE_LIGHTNESS[region.variant] - previous) >= 8) return
        region.variant = TOPOLOGY_GROUP_TONE_LIGHTNESS.reduce((best, tone, variant) =>
            Math.abs(tone - previous) > Math.abs(TOPOLOGY_GROUP_TONE_LIGHTNESS[best] - previous) ? variant : best, 0)
    })
    return regions
}
