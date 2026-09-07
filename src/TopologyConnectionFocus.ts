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
 * Connects a focused resource to the upstream terminals reachable through
 * rendered graph edges. Traversal is monotonic toward the top of the topology:
 * once a Host is reached it may continue to SwitchPort/Switch, but it can never
 * descend again into another NIC/Bridge/VM branch. Large visual-level jumps
 * cost more than adjacent-level hops so ownership shortcuts do not replace the
 * real vNIC/bridge/bond/NIC route. Every real edge touching the focused node
 * is then added as a one-hop side/downstream relation without recursively
 * traversing that neighbor's descendants.
 */
export function topologyNetworkRootPathClosure(
    focusedNodeID: string,
    edges: TopologyRankedRelationEdge[]
): TopologyRelationPathClosure {
    const nodeIDs = new Set<string>([focusedNodeID])
    const linkIDs = new Set<string>()
    const upstream = new Map<string, Array<{ nodeID: string, linkID: string, cost: number }>>()

    const appendUpstream = (sourceID: string, targetID: string, linkID: string, cost: number) => {
        const neighbors = upstream.get(sourceID) || []
        neighbors.push({ nodeID: targetID, linkID, cost })
        upstream.set(sourceID, neighbors)
    }
    edges.forEach(edge => {
        if (!edge.id || !edge.sourceID || !edge.targetID || edge.sourceID === edge.targetID) return
        const levelDelta = Math.abs(edge.sourceLevel - edge.targetLevel)
        if (levelDelta === 0) return
        const cost = 1 + levelDelta * levelDelta
        if (edge.sourceLevel > edge.targetLevel) {
            appendUpstream(edge.sourceID, edge.targetID, edge.id, cost)
        } else {
            appendUpstream(edge.targetID, edge.sourceID, edge.id, cost)
        }
    })

    const reachableNodeIDs = new Set<string>([focusedNodeID])
    const queue = [focusedNodeID]
    while (queue.length) {
        const currentNodeID = queue.shift() as string
        for (const neighbor of upstream.get(currentNodeID) || []) {
            if (reachableNodeIDs.has(neighbor.nodeID)) continue
            reachableNodeIDs.add(neighbor.nodeID)
            queue.push(neighbor.nodeID)
        }
    }

    const rootNodeIDs = Array.from(reachableNodeIDs)
        .filter(nodeID => (upstream.get(nodeID) || []).every(neighbor => !reachableNodeIDs.has(neighbor.nodeID)))

    const distances = new Map<string, number>([[focusedNodeID, 0]])
    const previous = new Map<string, { nodeID: string, linkID: string }>()
    const unsettled = new Set<string>(reachableNodeIDs)
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
        for (const neighbor of upstream.get(currentNodeID) || []) {
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

    // Keep every real one-hop relationship of the selected object, including
    // downstream and same-level peers. Do not enqueue those neighbors: only
    // the selected object's upstream route is recursive, while direct side and
    // child resources stop after one edge.
    edges.forEach(edge => {
        if (!edge.id || !edge.sourceID || !edge.targetID || edge.sourceID === edge.targetID) return
        if (edge.sourceID !== focusedNodeID && edge.targetID !== focusedNodeID) return
        nodeIDs.add(edge.sourceID)
        nodeIDs.add(edge.targetID)
        linkIDs.add(edge.id)
    })

    return { nodeIDs, linkIDs }
}
