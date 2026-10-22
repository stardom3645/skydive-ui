import type { InfrastructurePortLayoutTarget } from './InfrastructurePortMapping'

export interface SwitchPortSlot {
    id: string
    switchID: string
    name: string
    x: number
    y: number
    width: number
}

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) || a.localeCompare(b)

/** Reorder only physical switch-port cards inside their existing row bounds.
 * Host/subtree coordinates, switch membership and every link remain intact.
 * The input comes from fresh layout geometry, never a previous sorted frame. */
export function switchPortConnectionPositions(ports: SwitchPortSlot[], targets: InfrastructurePortLayoutTarget[],
    positions: Map<string, { x: number }>): Map<string, number> {
    const coordinateOrder = (a: string | undefined, b: string | undefined) => {
        const x = a ? positions.get(a)?.x : undefined, y = b ? positions.get(b)?.x : undefined
        return x !== undefined && y !== undefined ? x - y : x !== undefined ? -1 : y !== undefined ? 1 : 0
    }
    const compareTarget = (a: InfrastructurePortLayoutTarget, b: InfrastructurePortLayoutTarget) =>
        coordinateOrder(a.hostNodeID, b.hostNodeID) || natural(a.hostName, b.hostName) || natural(a.hostNodeID, b.hostNodeID)
        || coordinateOrder(a.bondNodeID, b.bondNodeID) || natural(a.bondName, b.bondName)
        || coordinateOrder(a.hostNicNodeID, b.hostNicNodeID) || natural(a.hostNicName, b.hostNicName)
    const byPort = new Map<string, InfrastructurePortLayoutTarget[]>()
    targets.forEach(target => {
        const list = byPort.get(target.portNodeID) || []
        list.push(target); byPort.set(target.portNodeID, list)
    })
    const representative = new Map<string, InfrastructurePortLayoutTarget>()
    byPort.forEach((list, id) => {
        list.sort(compareTarget)
        representative.set(id, list[Math.floor((list.length - 1) / 2)])
    })
    const rows = new Map<string, SwitchPortSlot[]>()
    ports.forEach(port => {
        const key = JSON.stringify([port.switchID, port.y]), row = rows.get(key) || []
        row.push(port); rows.set(key, row)
    })
    const result = new Map<string, number>()
    rows.forEach(row => {
        if (row.length < 2) return
        const current = row.slice().sort((a, b) => a.x - b.x || natural(a.id, b.id))
        const ordered = row.slice().sort((a, b) => {
            const left = representative.get(a.id), right = representative.get(b.id)
            return (left && right ? compareTarget(left, right) : left ? -1 : right ? 1 : 0)
                || natural(a.name, b.name) || natural(a.id, b.id)
        })
        if (ordered.every((port, i) => port.id === current[i].id)) return
        // Retain each gap as well as the row's total occupied width. Repacking
        // by real card width prevents overlaps with unusually long port names.
        const gaps = current.slice(1).map((port, i) => port.x - port.width / 2 - current[i].x - current[i].width / 2)
        if (gaps.some(gap => gap < -0.01)) return
        let left = current[0].x - current[0].width / 2
        ordered.forEach((port, i) => {
            result.set(port.id, left + port.width / 2)
            left += port.width + (gaps[i] || 0)
        })
    })
    return result
}
