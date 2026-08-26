export interface TopologyRelationPathEdge {
    id: string
    sourceID: string
    targetID: string
}

export interface TopologyRelationPathClosure {
    nodeIDs: Set<string>
    linkIDs: Set<string>
}

export interface TopologyRankedRelationEdge extends TopologyRelationPathEdge {
    sourceLevel: number
    targetLevel: number
}

/**
 * Returns the rendered relation nodes and links on the shortest paths from a
 * focused resource to the already selected focus targets. Each target is
 * connected independently so unrelated branches are not pulled into focus.
 */
export function topologyRelationPathClosure(
    focusedNodeID: string,
    targetNodeIDs: Iterable<string>,
    edges: TopologyRelationPathEdge[]
): TopologyRelationPathClosure {
    const nodeIDs = new Set<string>([focusedNodeID])
    const linkIDs = new Set<string>()
    const adjacency = new Map<string, Array<{ nodeID: string, linkID: string }>>()

    const appendNeighbor = (sourceID: string, targetID: string, linkID: string) => {
        const neighbors = adjacency.get(sourceID) || []
        neighbors.push({ nodeID: targetID, linkID })
        adjacency.set(sourceID, neighbors)
    }

    edges.forEach(edge => {
        if (!edge.id || !edge.sourceID || !edge.targetID || edge.sourceID === edge.targetID) return
        appendNeighbor(edge.sourceID, edge.targetID, edge.id)
        appendNeighbor(edge.targetID, edge.sourceID, edge.id)
    })

    Array.from(new Set(targetNodeIDs)).forEach(targetNodeID => {
        if (!targetNodeID) return
        if (targetNodeID === focusedNodeID) {
            nodeIDs.add(targetNodeID)
            return
        }

        const queue = [focusedNodeID]
        const visited = new Set<string>([focusedNodeID])
        const previous = new Map<string, { nodeID: string, linkID: string }>()

        while (queue.length && !visited.has(targetNodeID)) {
            const currentNodeID = queue.shift() as string
            for (const neighbor of adjacency.get(currentNodeID) || []) {
                if (visited.has(neighbor.nodeID)) continue
                visited.add(neighbor.nodeID)
                previous.set(neighbor.nodeID, { nodeID: currentNodeID, linkID: neighbor.linkID })
                queue.push(neighbor.nodeID)
                if (neighbor.nodeID === targetNodeID) break
            }
        }

        if (!visited.has(targetNodeID)) return
        let cursor = targetNodeID
        nodeIDs.add(cursor)
        while (cursor !== focusedNodeID) {
            const step = previous.get(cursor)
            if (!step) break
            linkIDs.add(step.linkID)
            nodeIDs.add(step.nodeID)
            cursor = step.nodeID
        }
    })

    return { nodeIDs, linkIDs }
}

/**
 * Connects a focused resource to the uppermost nodes in its rendered relation
 * component. Large visual-level jumps cost more than adjacent-level hops, so
 * ownership shortcuts do not hide the actual vNIC/bridge/bond/NIC path. Only
 * nodes on a selected root path are returned; unrelated side branches remain
 * outside the focus set.
 */
export function topologyNetworkRootPathClosure(
    focusedNodeID: string,
    edges: TopologyRankedRelationEdge[]
): TopologyRelationPathClosure {
    const nodeIDs = new Set<string>([focusedNodeID])
    const linkIDs = new Set<string>()
    const nodeLevels = new Map<string, number>()
    const adjacency = new Map<string, Array<{ nodeID: string, linkID: string, cost: number }>>()

    const appendNeighbor = (sourceID: string, targetID: string, linkID: string, cost: number) => {
        const neighbors = adjacency.get(sourceID) || []
        neighbors.push({ nodeID: targetID, linkID, cost })
        adjacency.set(sourceID, neighbors)
    }
    edges.forEach(edge => {
        if (!edge.id || !edge.sourceID || !edge.targetID || edge.sourceID === edge.targetID) return
        nodeLevels.set(edge.sourceID, edge.sourceLevel)
        nodeLevels.set(edge.targetID, edge.targetLevel)
        const levelDelta = Math.abs(edge.sourceLevel - edge.targetLevel)
        const cost = 1 + levelDelta * levelDelta
        appendNeighbor(edge.sourceID, edge.targetID, edge.id, cost)
        appendNeighbor(edge.targetID, edge.sourceID, edge.id, cost)
    })

    const componentNodeIDs = new Set<string>([focusedNodeID])
    const queue = [focusedNodeID]
    while (queue.length) {
        const currentNodeID = queue.shift() as string
        for (const neighbor of adjacency.get(currentNodeID) || []) {
            if (componentNodeIDs.has(neighbor.nodeID)) continue
            componentNodeIDs.add(neighbor.nodeID)
            queue.push(neighbor.nodeID)
        }
    }

    const componentLevels = Array.from(componentNodeIDs)
        .map(nodeID => nodeLevels.get(nodeID))
        .filter((level): level is number => Number.isFinite(level))
    if (componentLevels.length === 0) return { nodeIDs, linkIDs }
    const rootLevel = Math.min(...componentLevels)
    const rootNodeIDs = Array.from(componentNodeIDs)
        .filter(nodeID => nodeLevels.get(nodeID) === rootLevel)

    const distances = new Map<string, number>([[focusedNodeID, 0]])
    const previous = new Map<string, { nodeID: string, linkID: string }>()
    const unsettled = new Set<string>(componentNodeIDs)
    while (unsettled.size) {
        let currentNodeID = ''
        let currentDistance = Infinity
        unsettled.forEach(nodeID => {
            const distance = distances.get(nodeID) ?? Infinity
            if (distance < currentDistance) {
                currentNodeID = nodeID
                currentDistance = distance
            }
        })
        if (!currentNodeID || !Number.isFinite(currentDistance)) break
        unsettled.delete(currentNodeID)
        for (const neighbor of adjacency.get(currentNodeID) || []) {
            if (!unsettled.has(neighbor.nodeID)) continue
            const nextDistance = currentDistance + neighbor.cost
            if (nextDistance >= (distances.get(neighbor.nodeID) ?? Infinity)) continue
            distances.set(neighbor.nodeID, nextDistance)
            previous.set(neighbor.nodeID, { nodeID: currentNodeID, linkID: neighbor.linkID })
        }
    }

    rootNodeIDs.forEach(rootNodeID => {
        if (!distances.has(rootNodeID)) return
        let cursor = rootNodeID
        nodeIDs.add(cursor)
        while (cursor !== focusedNodeID) {
            const step = previous.get(cursor)
            if (!step) break
            linkIDs.add(step.linkID)
            nodeIDs.add(step.nodeID)
            cursor = step.nodeID
        }
    })

    return { nodeIDs, linkIDs }
}
