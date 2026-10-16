/** Screen-space guide geometry. Graph coordinates and camera behavior stay independent. */
export type LayerGuideItem = { weight: number; y: number; expandedHeight: number }
export type LayerGuideLayout = LayerGuideItem & { compact: boolean; visible: boolean; members: number[] }
export const layerGuideIconPixels = 28
export const layerGuideCompactHeight = 36
const restoreGap = 10

export function topologyLayerGuide(items: LayerGuideItem[], viewportHeight: number,
    selectedWeight: number | null, previous: ReadonlyMap<number, LayerGuideLayout> = new Map()): Map<number, LayerGuideLayout> {
    const sorted = [...items].sort((a, b) => a.y - b.y || a.weight - b.weight)
    // One mode for the entire active menu, even when lane heights differ or
    // panning brings another part of the topology into view.
    const padding = [...previous.values()].some(item => item.compact) ? restoreGap : 0
    const compact = sorted.some((item, i) => i > 0 && item.y - sorted[i - 1].y <
        (item.expandedHeight + sorted[i - 1].expandedHeight) / 2 + padding)
    const rows = sorted.map((item): LayerGuideLayout => ({ ...item, compact, visible: false, members: [] }))
    const candidates = rows.filter(item => item.y >= layerGuideCompactHeight / 2 &&
        item.y <= viewportHeight - layerGuideCompactHeight / 2)
    // Keep the selected layer at its real position, then retain as many other
    // layers as fit. Never push labels away from their corresponding lane.
    const priority = [...candidates].sort((a, b) => Number(b.weight === selectedWeight) -
        Number(a.weight === selectedWeight) || a.y - b.y)
    const visible: LayerGuideLayout[] = []
    const height = (item: LayerGuideLayout) => item.compact ? layerGuideCompactHeight : item.expandedHeight
    for (const item of priority) {
        if (visible.every(other => Math.abs(item.y - other.y) >= (height(item) + height(other)) / 2)) {
            item.visible = true
            visible.push(item)
        }
    }
    for (const item of candidates) {
        const representative = item.visible ? item : [...visible].sort((a, b) => Math.abs(a.y - item.y) - Math.abs(b.y - item.y)
            || Number(b.weight === selectedWeight) - Number(a.weight === selectedWeight) || a.y - b.y)[0]
        representative?.members.push(item.weight)
    }
    return new Map(rows.map(item => [item.weight, item]))
}
