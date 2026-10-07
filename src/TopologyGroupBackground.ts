import { TopologyRegionNode, topologyGroupRegionPath } from './TopologyGroupRegions'

export interface TopologyVisualGroupNode extends TopologyRegionNode { group: boolean }
export interface TopologyVisualGroup {
    id: string; nodeIDs: string[]; path: string; shape: 'rounded' | 'organic'
    bounds: { x: number; y: number; width: number; height: number }
}
const roundedPath = (x: number, y: number, width: number, height: number, r = 24) =>
    `M${x+r},${y} H${x+width-r} Q${x+width},${y} ${x+width},${y+r} V${y+height-r} Q${x+width},${y+height} ${x+width-r},${y+height} H${x+r} Q${x},${y+height} ${x},${y+height-r} V${y+r} Q${x},${y} ${x+r},${y} Z`

/** Geometry-only layer. It reads the final visible positions and never moves
 * cards. Use an organic surface when an unrelated card occupies the rectangle. */
export const topologyVisualGroups = (nodes: TopologyVisualGroupNode[]): TopologyVisualGroup[] => {
    const valid = nodes.filter(node => [node.x, node.y, node.width, node.height].every(Number.isFinite) && node.width > 0 && node.height > 0)
    const children = new Map<string, TopologyVisualGroupNode[]>()
    valid.forEach(node => {
        if (!node.parentID) return
        const siblings = children.get(node.parentID) || []
        siblings.push(node); children.set(node.parentID, siblings)
    })
    return valid.filter(node => node.group && node.visible && node.expanded).reduce<TopologyVisualGroup[]>((groups, header) => {
        const members: TopologyVisualGroupNode[] = [], visited = new Set<string>()
        const walk = (node: TopologyVisualGroupNode) => {
            if (visited.has(node.id)) return
            visited.add(node.id)
            if (node.visible) members.push(node)
            ;(children.get(node.id) || []).forEach(walk)
        }
        walk(header)
        if (members.length < 2) return groups
        const padding = 20
        const left = Math.min(...members.map(node => node.x - node.width / 2)) - padding
        const right = Math.max(...members.map(node => node.x + node.width / 2)) + padding
        const top = Math.min(...members.map(node => node.y - node.height / 2)) - padding
        const bottom = Math.max(...members.map(node => node.y + node.height / 2)) + padding
        const bounds = { x: left, y: top, width: right-left, height: bottom-top }
        const occupied = valid.some(node => node.visible && !visited.has(node.id)
            && node.x + node.width / 2 > left && node.x - node.width / 2 < right
            && node.y + node.height / 2 > top && node.y - node.height / 2 < bottom)
        groups.push({ id: header.id, nodeIDs: members.map(node => node.id), bounds,
            shape: occupied ? 'organic' as const : 'rounded' as const,
            path: occupied ? topologyGroupRegionPath(members, padding) : roundedPath(left, top, bounds.width, bounds.height) })
        return groups
    }, []).sort((a,b) => b.bounds.width * b.bounds.height - a.bounds.width * a.bounds.height)
}
