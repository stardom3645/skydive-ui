/** Width of the existing Infrastructure user-VM card, in scene coordinates. */
export const INFRASTRUCTURE_VM_CARD_WIDTH = 480
export type InfrastructureVMSemanticMode = 'detail' | 'summary' | 'dense'
export const VM_SEMANTIC_HYSTERESIS = 8
// Match the integer readout used by TopologyZoomControls, including rounding.
export const VM_SEMANTIC_DETAIL_PERCENT = 29
export const VM_SEMANTIC_DETAIL_WIDTH = INFRASTRUCTURE_VM_CARD_WIDTH * VM_SEMANTIC_DETAIL_PERCENT / 100
export const infrastructureVMSemanticFitMaxScale = (mode: InfrastructureVMSemanticMode) =>
    mode === 'dense' ? (100 + VM_SEMANTIC_HYSTERESIS - 1) / INFRASTRUCTURE_VM_CARD_WIDTH
        : mode === 'summary' ? (VM_SEMANTIC_DETAIL_PERCENT - 0.5 - 0.01) / 100 : 1.5

/** Use the projected full card width as the stable measurement ruler. Measuring
 * the shrunken tile itself would trap it in dense mode when zooming back in. */
export function infrastructureVMSemanticMode(screenWidth: number, previous?: InfrastructureVMSemanticMode): InfrastructureVMSemanticMode {
    if (!Number.isFinite(screenWidth) || screenWidth <= 0) return previous || 'detail'
    const detail = Math.round(screenWidth / INFRASTRUCTURE_VM_CARD_WIDTH * 100) >= VM_SEMANTIC_DETAIL_PERCENT
    if (!previous) return detail ? 'detail' : screenWidth >= 100 ? 'summary' : 'dense'
    const h = VM_SEMANTIC_HYSTERESIS
    if (previous === 'detail') return screenWidth < 100 - h ? 'dense' : screenWidth < VM_SEMANTIC_DETAIL_WIDTH - h ? 'summary' : 'detail'
    if (previous === 'summary') return detail ? 'detail' : screenWidth < 100 - h ? 'dense' : 'summary'
    return detail ? 'detail' : screenWidth >= 100 + h ? 'summary' : 'dense'
}

export const VM_DENSE_TILE_SIZE = 80
export const VM_DENSE_TILE_GAP = 16
export const infrastructureVMSemanticDimensions = (mode: InfrastructureVMSemanticMode, group = false) =>
    mode === 'dense' ? group ? { width: 320, height: 240 } : { width: VM_DENSE_TILE_SIZE, height: VM_DENSE_TILE_SIZE }
        : mode === 'summary' && !group ? { width: INFRASTRUCTURE_VM_CARD_WIDTH, height: 200 } : undefined
