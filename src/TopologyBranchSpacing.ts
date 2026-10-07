import { topologyVisibleBranches, topologyGroupRegionBands, topologyGroupRegionExtentAt as extentAt, TopologyRegionNode } from './TopologyGroupRegions'

/** Separate occupied rows and the connecting background contours, preserving
 * space where branches are narrow. A common vertical profile bounds each curve
 * segment conservatively, so entire branches need not become rectangular lanes.
 * Only x offsets are returned: hierarchy, order, heights and state are untouched.
 */
export const topologyBranchOffsets = (nodes: TopologyRegionNode[], gap = 80): Map<string, number> => {
    const branches = topologyVisibleBranches(nodes).map(branch => ({
        id: branch.id, center: branch.nodes.find(node => node.id === branch.id)!.x,
        bands: topologyGroupRegionBands(branch.nodes, 24, 0)
    })).filter(branch => branch.bands.length).sort((a, b) => a.center - b.center || a.id.localeCompare(b.id))
    const offsets = new Map<string, number>()
    if (branches.length < 2) return offsets
    const boundaries: number[] = []
    branches.forEach(branch => branch.bands.forEach(band => boundaries.push(band.top, band.bottom)))
    const edges = Array.from(new Set(boundaries)).sort((a, b) => a - b)
    const levels: number[] = [edges[0]]
    edges.slice(1).forEach(edge => {
        const previous = levels[levels.length - 1]
        const count = Math.max(1, Math.ceil((edge - previous) / 16))
        for (let i = 1; i <= count; i++) levels.push(previous + (edge - previous) * i / count)
    })
    const packedRight = levels.slice(1).map(() => -Infinity)
    let finalRight = -Infinity, originalRight = -Infinity
    branches.forEach(branch => {
        const extents = levels.map(y => extentAt(branch.bands, y))
        const profile = levels.slice(1).map((_, index) => {
            const a = extents[index], b = extents[index + 1]
            const middle = extentAt(branch.bands, (levels[index] + levels[index + 1]) / 2)
            if (!middle) return undefined
            return { left: Math.min(a?.left ?? middle.left, b?.left ?? middle.left), right: Math.max(a?.right ?? middle.right, b?.right ?? middle.right) }
        })
        let offset = 0
        profile.forEach((extent, index) => { if (extent) offset = Math.max(offset, packedRight[index] + gap - extent.left) })
        profile.forEach((extent, index) => { if (extent) packedRight[index] = Math.max(packedRight[index], extent.right + offset) })
        offsets.set(branch.id, offset)
        const right = Math.max(...branch.bands.map(band => band.right))
        originalRight = Math.max(originalRight, right)
        finalRight = Math.max(finalRight, right + offset)
    })
    const recenter = (finalRight - originalRight) / 2
    offsets.forEach((offset, id) => offsets.set(id, offset - recenter))
    return offsets
}
