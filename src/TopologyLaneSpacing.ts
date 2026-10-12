export const TOPOLOGY_LANE_PADDING = 24

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
export const topologyLaneOffsets = (items: TopologyLaneItem[]): Map<number, number> => {
    const lanes = new Map<number, TopologyLaneItem[]>()
    items.forEach(item => {
        if (!lanes.has(item.weight)) lanes.set(item.weight, [])
        lanes.get(item.weight)!.push(item)
    })
    const offsets = new Map<number, number>()
    let previousBottom = -Infinity
    for (const weight of Array.from(lanes.keys()).sort((a, b) => a - b)) {
        const bounds = topologyLaneBounds(lanes.get(weight)!)
        const offset = Math.max(0, previousBottom - bounds.top)
        offsets.set(weight, offset)
        previousBottom = bounds.bottom + offset
    }
    return offsets
}
