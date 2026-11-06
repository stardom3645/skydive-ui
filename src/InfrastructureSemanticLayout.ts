import { INFRASTRUCTURE_HOST_CAPTION_GAP, TopologyLaneItem } from './TopologyLaneSpacing'
import type { InfrastructureVMSemanticMode } from './InfrastructureVMSemanticZoom'
import type { TopologyNodePresentation } from './TopologyNodePresentation'

export const infrastructureGroupSemanticDimensions = (mode: InfrastructureVMSemanticMode) =>
    mode === 'detail' ? undefined : mode === 'summary' ? { width: 400, height: 220 } : { width: 320, height: 200 }

/** Common identity cards for every Infrastructure object except user VM tiles. */
export const infrastructureObjectSemanticDimensions = (mode: InfrastructureVMSemanticMode) =>
    mode === 'detail' ? undefined : mode === 'summary' ? { width: 400, height: 200 } : { width: 320, height: 128 }

/** Only already-collected identity information belongs in the summary.
 * System VMs and routers deliberately omit every metric at both reduced levels. */
export const infrastructureObjectSemanticInfo = (model: TopologyNodePresentation): { text: string; description?: string } | undefined => {
    if (model.resourceType === 'libvirt') return undefined
    if (model.linkState) return { text: `동작 ${model.linkState}`, description: 'Up/Down은 연결의 동작 상태이며 기존 이상 판정과는 별개입니다.' }
    const count = model.metrics.find(metric => ['vms', 'children'].includes(metric.key))
    if (count) return { text: `${count.label} ${count.value}`, description: count.description }
    return model.networkSummary ? { text: model.networkSummary } : undefined
}

export interface InfrastructureViewportRect { left: number; right: number; top: number; bottom: number }

/** Camera-only usable area; opening a panel must not repartition the graph. */
export function infrastructureViewportWidth(canvas: InfrastructureViewportRect, panel?: InfrastructureViewportRect): number {
    const width = Math.max(0, canvas.right - canvas.left)
    if (!panel || panel.right - panel.left < 2 || panel.bottom <= canvas.top || panel.top >= canvas.bottom
        || panel.left >= canvas.right || panel.right <= canvas.left) return width
    return Math.max(1, Math.min(width, panel.left - canvas.left - 12))
}

export interface InfrastructureOccupiedLaneItem extends TopologyLaneItem {
    id: string
    parentID?: string
    visible: boolean
    vm: boolean
}

/** Move entire occupied lanes together, including expanded VM/NIC blocks.
 * Unlike collision-only spacing this can reclaim unused flextree slots.
 * No graph, status, horizontal order or within-lane coordinate is changed. */
export function infrastructureOccupiedLaneOffsets(items: InfrastructureOccupiedLaneItem[], gap: number, hostCaptionGap = INFRASTRUCTURE_HOST_CAPTION_GAP): Map<string, number> {
    const byID = new Map(items.map(item => [item.id, item]))
    const laneOf = (item: InfrastructureOccupiedLaneItem) => {
        let lane = item.weight, parent = item.parentID && byID.get(item.parentID)
        const seen = new Set([item.id])
        while (parent && !seen.has(parent.id)) {
            seen.add(parent.id)
            if (parent.vm && parent.visible) lane = parent.weight
            parent = parent.parentID && byID.get(parent.parentID)
        }
        return lane
    }
    const lanes = new Map<number, InfrastructureOccupiedLaneItem[]>()
    items.filter(item => item.visible).forEach(item => {
        const lane = laneOf(item)
        const members = lanes.get(lane) || []
        members.push(item); lanes.set(lane, members)
    })
    const offsets = new Map<number, number>()
    let bottom: number | undefined
    Array.from(lanes.keys()).sort((a, b) => a - b).forEach(lane => {
        const members = lanes.get(lane)!
        const top = Math.min(...members.map(item => item.y - item.height / 2 - item.above))
        const end = Math.max(...members.map(item => item.y + item.height / 2 + item.below))
        const offset = bottom === undefined ? 0 : bottom + (lane === 5020 ? hostCaptionGap : gap) - top
        offsets.set(lane, offset); bottom = end + offset
    })
    return new Map(items.map(item => [item.id, offsets.get(laneOf(item)) || 0]))
}
