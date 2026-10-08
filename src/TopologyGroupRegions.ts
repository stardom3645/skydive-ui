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
    clipPath?: string
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
    return regionPathFromBands(topologyGroupRegionBands(nodes, padding), padding)
}

const regionPathFromBands = (bands: TopologyRegionBand[], padding = 32, softenRows = false): string => {
    if (!bands.length) return ''
    const first = bands[0], last = bands[bands.length - 1]
    const radius = Math.min(padding, 32, (first.bottom - first.top) / 3, (last.bottom - last.top) / 3)
    const firstRadius = softenRows && first.right - first.left > 1600 ? Math.min(64, (first.bottom - first.top) / 3) : radius
    const lastRadius = softenRows && last.right - last.left > 1600 ? Math.min(64, (last.bottom - last.top) / 3) : radius
    // Begin each curve inside the halo so adjacent rows form a soft shoulder,
    // even when their vertical gap is small. Large sideways jumps keep the
    // transition outside the cards; the layout profile itself is unchanged.
    const shoulders = bands.slice(1).map((next, index) => {
        const band = bands[index]
        const side = (edge: 'left' | 'right') => {
            const jump = Math.abs(next[edge] - band[edge])
            const expands = edge === 'left' ? next.left < band.left : next.right > band.right
            const depth = Math.max(36, Math.sqrt(jump) * 6)
            // Expanding into free space can start earlier in the narrow row.
            // Contracting can finish later in the narrow row. The opposite end
            // stays in its halo so wide-row cards remain fully enclosed.
            return {
                start: softenRows ? Math.min(expands ? depth : 32, (band.bottom - band.top) / 3) : 0,
                end: softenRows ? Math.min(expands ? 32 : depth, (next.bottom - next.top) / 3) : 0
            }
        }
        return { left: side('left'), right: side('right') }
    })
    // Keep wide-row end rounding local. Stretching one shallow cubic across
    // thousands of pixels creates square-looking ends and can shave card corners.
    const control = 1 - 0.55228475
    let path = firstRadius !== radius
        ? `M ${first.left},${first.top + firstRadius} C ${first.left},${first.top + firstRadius * control} ${first.left + firstRadius * control},${first.top} ${first.left + firstRadius},${first.top}`
            + ` L ${first.right - firstRadius},${first.top} C ${first.right - firstRadius * control},${first.top} ${first.right},${first.top + firstRadius * control} ${first.right},${first.top + firstRadius}`
        : `M ${first.left},${first.top + radius} C ${first.left},${first.top - radius / 3} ${first.right},${first.top - radius / 3} ${first.right},${first.top + radius}`
    bands.forEach((band, index) => {
        path += ` L ${band.right},${band.bottom - (index === bands.length - 1 ? lastRadius : shoulders[index].right.start)}`
        const next = bands[index + 1]
        if (next) {
            const middleY = (band.bottom - shoulders[index].right.start + next.top + shoulders[index].right.end) / 2
            path += ` C ${band.right},${middleY} ${next.right},${middleY} ${next.right},${next.top + shoulders[index].right.end}`
        }
    })
    path += lastRadius !== radius
        ? ` C ${last.right},${last.bottom - lastRadius * control} ${last.right - lastRadius * control},${last.bottom} ${last.right - lastRadius},${last.bottom}`
            + ` L ${last.left + lastRadius},${last.bottom} C ${last.left + lastRadius * control},${last.bottom} ${last.left},${last.bottom - lastRadius * control} ${last.left},${last.bottom - lastRadius}`
        : ` C ${last.right},${last.bottom + radius / 3} ${last.left},${last.bottom + radius / 3} ${last.left},${last.bottom - radius}`
    for (let index = bands.length - 1; index >= 0; index--) {
        const band = bands[index]
        path += ` L ${band.left},${band.top + (index === 0 ? firstRadius : shoulders[index - 1].left.end)}`
        const previous = bands[index - 1]
        if (previous) {
            const middleY = (previous.bottom - shoulders[index - 1].left.start + band.top + shoulders[index - 1].left.end) / 2
            path += ` C ${band.left},${middleY} ${previous.left},${middleY} ${previous.left},${previous.bottom - shoulders[index - 1].left.start}`
        }
    }
    return path + ' Z'
}

/** Broaden a branch into one connected area. A sparse intermediate row keeps
 * the envelope between its neighbors, rather than pinching around one card.
 * Layout spacing still uses the original occupied-row bounds. */
export const topologyGroupRegionEnvelope = (nodes: TopologyRegionNode[]): TopologyRegionBand[] => {
    const occupied = topologyGroupRegionBands(nodes, 24, 0)
    const broad = occupied.map((band, index) => ({
        left: band.left - 48, right: band.right + 48,
        top: band.top - Math.min(12, index ? (band.top - occupied[index - 1].bottom) / 3 : 12),
        bottom: band.bottom + Math.min(12, index < occupied.length - 1 ? (occupied[index + 1].top - band.bottom) / 3 : 12)
    }))
    return broad.map((band, index) => {
        if (!index || index === broad.length - 1) return band
        const previous = broad[index - 1], next = broad[index + 1]
        const center = (band.top + band.bottom) / 2
        const previousCenter = (previous.top + previous.bottom) / 2
        const nextCenter = (next.top + next.bottom) / 2
        const fraction = (center - previousCenter) / (nextCenter - previousCenter)
        // A very wide VM row must not turn a single router/bridge row into a
        // several-thousand-pixel empty slab. This limit affects the background
        // alone; every occupied card and the continuous branch stay covered.
        const spread = 384
        return { ...band,
            left: Math.max(band.left - spread, Math.min(band.left, previous.left + (next.left - previous.left) * fraction)),
            right: Math.min(band.right + spread, Math.max(band.right, previous.right + (next.right - previous.right) * fraction)) }
    })
}

/** Horizontal extent of the monotonic cubic sides, shared with branch spacing. */
export const topologyGroupRegionExtentAt = (bands: TopologyRegionBand[], y: number): { left: number; right: number } | undefined => {
    if (!bands.length || y < bands[0].top || y > bands[bands.length - 1].bottom) return undefined
    const index = bands.findIndex(band => y <= band.bottom)
    const band = bands[index]
    if (y >= band.top) return band
    const previous = bands[index - 1]
    const fraction = (y - previous.bottom) / (band.top - previous.bottom)
    let low = 0, high = 1
    for (let i = 0; i < 20; i++) {
        const t = (low + high) / 2
        const curveY = 1.5 * t - 1.5 * t * t + t * t * t
        if (curveY < fraction) low = t
        else high = t
    }
    const t = (low + high) / 2, blend = t * t * (3 - 2 * t)
    return { left: previous.left + (band.left - previous.left) * blend, right: previous.right + (band.right - previous.right) * blend }
}

/** Share free space between neighboring branches without moving their cards.
 * Both masks use the same samples and midpoint, leaving a 16px clear seam.
 * Collapsed neighboring branches also reserve their visible card's space. */
const regionClipPaths = (branches: Array<{ id: string; nodes: TopologyRegionNode[] }>): Map<string, string> => {
    const profiles = branches.map(branch => ({ id: branch.id,
        occupied: topologyGroupRegionBands(branch.nodes, 24, 0),
        envelope: topologyGroupRegionEnvelope(branch.nodes) })).filter(branch => branch.envelope.length)
    if (profiles.length < 2) return new Map()
    const boundaries: number[] = []
    profiles.forEach(branch => branch.envelope.forEach(band => boundaries.push(band.top, band.bottom)))
    const edges = Array.from(new Set(boundaries)).sort((a,b) => a-b)
    const levels = [edges[0]]
    edges.slice(1).forEach(edge => {
        const previous = levels[levels.length - 1], count = Math.max(1, Math.ceil((edge - previous) / 8))
        for (let i = 1; i <= count; i++) levels.push(previous + (edge - previous) * i / count)
    })
    const masks = new Map<string, Array<{ y: number; left: number; right: number }>>()
    levels.forEach(y => {
        const active = profiles.filter(branch => y >= branch.envelope[0].top && y <= branch.envelope[branch.envelope.length - 1].bottom)
            .map(branch => ({ ...branch, extent: topologyGroupRegionExtentAt(branch.occupied,
                Math.max(branch.occupied[0].top, Math.min(branch.occupied[branch.occupied.length - 1].bottom, y)))! }))
            .sort((a,b) => (a.extent.left + a.extent.right) - (b.extent.left + b.extent.right) || a.id.localeCompare(b.id))
        active.forEach((branch, index) => {
            const previous = active[index - 1], next = active[index + 1]
            const row = { y,
                left: previous ? (previous.extent.right + branch.extent.left) / 2 + 8 : Math.min(...branch.envelope.map(band => band.left)),
                right: next ? (branch.extent.right + next.extent.left) / 2 - 8 : Math.max(...branch.envelope.map(band => band.right)) }
            const mask = masks.get(branch.id) || []
            mask.push(row); masks.set(branch.id, mask)
        })
    })
    return new Map(Array.from(masks, ([id, rows]) => [id,
        `M ${rows[0].left},${rows[0].y} ` + rows.slice(1).map(row => `L ${row.left},${row.y}`).join(' ') + ' ' +
        [...rows].reverse().map(row => `L ${row.right},${row.y}`).join(' ') + ' Z']))
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

// Approximate lightness of the four near-white pastel surfaces. Preserve a visible
// intensity difference between neighboring branches.
export const TOPOLOGY_GROUP_TONE_LIGHTNESS = [246, 239, 248, 236]

export const topologyGroupRegions = (nodes: TopologyRegionNode[]): TopologyGroupRegion[] => {
    const branches = topologyVisibleBranches(nodes)
    const clips = regionClipPaths(branches)
    const regions = branches
        .filter(branch => branch.nodes.length > 1 && branch.nodes.find(node => node.id === branch.id)!.expanded)
        .sort((a, b) => a.nodes.find(node => node.id === a.id)!.x - b.nodes.find(node => node.id === b.id)!.x || a.id.localeCompare(b.id))
        .map(branch => ({ id: branch.id, nodeIDs: branch.nodes.map(node => node.id),
            path: regionPathFromBands(topologyGroupRegionEnvelope(branch.nodes), 32, true), clipPath: clips.get(branch.id), variant: regionVariant(branch.id) }))
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
