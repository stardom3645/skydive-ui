export const TOPOLOGY_LANE_PADDING = 24
export const INFRASTRUCTURE_TRAFFIC_LANE_GAP = 160
// A 24px counter-scaled host caption stays clear at the minimum 10% zoom.
export const INFRASTRUCTURE_HOST_CAPTION_GAP = 384

export interface TopologyLaneItem {
    weight: number
    y: number
    height: number
    above: number
    below: number
}

/** Include badges and stacked plates in the painted extent of a lane. */
export const topologyLaneBounds = (items: TopologyLaneItem[]) => ({
    top: Math.min(...items.map(item => item.y - item.height / 2 - item.above)) - TOPOLOGY_LANE_PADDING,
    bottom: Math.max(...items.map(item => item.y + item.height / 2 + item.below)) + TOPOLOGY_LANE_PADDING
})

/** Preserve each lane's internal positions; move later lanes only if needed. */
export const topologyLaneOffsets = (items: TopologyLaneItem[], gap = TOPOLOGY_LANE_PADDING * 2, laneGaps: { [weight: number]: number } = {}): Map<number, number> => {
    const lanes = new Map<number, TopologyLaneItem[]>()
    items.forEach(item => {
        if (!lanes.has(item.weight)) lanes.set(item.weight, [])
        lanes.get(item.weight)!.push(item)
    })
    const offsets = new Map<number, number>()
    let previousBottom = -Infinity
    for (const weight of Array.from(lanes.keys()).sort((a, b) => a - b)) {
        const bounds = topologyLaneBounds(lanes.get(weight)!)
        const offset = Math.max(0, previousBottom + (laneGaps[weight] ?? gap) - (bounds.top + TOPOLOGY_LANE_PADDING))
        offsets.set(weight, offset)
        previousBottom = bounds.bottom - TOPOLOGY_LANE_PADDING + offset
    }
    return offsets
}

/** Place a single horizontal boundary in the empty corridor between levels.
 * Overlapping levels do not get a line through their cards or child NICs. */
export const topologyLaneSeparators = (levels: Array<{ weight: number; bb: { y: number; height: number } }>): Map<number, number> => {
    const ordered = levels.filter(level => Number.isFinite(level.bb.y) && Number.isFinite(level.bb.height) && level.bb.height > 0)
        .slice().sort((a, b) => a.bb.y - b.bb.y || a.weight - b.weight)
    const separators = new Map<number, number>()
    ordered.slice(0, -1).forEach((level, index) => {
        const bottom = level.bb.y + level.bb.height, next = ordered[index + 1].bb.y
        const boundary = (bottom + next) / 2
        // Adjacent padded lanes can share a boundary while the painted cards
        // still have the normal 48-unit corridor between them.
        if (next >= bottom && !ordered.some(other => other.bb.y < boundary && other.bb.y + other.bb.height > boundary))
            separators.set(level.weight, boundary)
    })
    return separators
}
