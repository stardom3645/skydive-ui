export interface TopologyEdgeEvent {
    ID: string
    Parent: string
    Child: string
    Metadata?: any
}

/**
 * Keeps graph relations that arrive before one of their endpoint nodes.
 *
 * A full topology sync is node-first, but live graph updates can cross a
 * reconnect/filter boundary with the edge visible before the matching node is
 * installed in the UI tree. Dropping that edge leaves the node under the root
 * until the next full sync (or agent restart).
 */
export class TopologyPendingEdges<T extends TopologyEdgeEvent = TopologyEdgeEvent> {
    private edges = new Map<string, T>()

    defer(edge: T) {
        this.edges.set(edge.ID, edge)
    }

    remove(edgeID: string) {
        this.edges.delete(edgeID)
    }

    has(edgeID: string): boolean {
        return this.edges.has(edgeID)
    }

    removeForNode(nodeID: string) {
        Array.from(this.edges.values()).forEach(edge => {
            if (edge.Parent === nodeID || edge.Child === nodeID) {
                this.edges.delete(edge.ID)
            }
        })
    }

    clear() {
        this.edges.clear()
    }

    size(): number {
        return this.edges.size
    }

    replayReady(
        hasNode: (nodeID: string) => boolean,
        apply: (edge: T) => boolean,
        endpointNodeID?: string
    ): number {
        let applied = 0
        // Use a snapshot because apply() may cause graph callbacks that mutate
        // this store. A stable edge ID remains the sole identity throughout.
        Array.from(this.edges.values()).forEach(edge => {
            if (endpointNodeID && edge.Parent !== endpointNodeID && edge.Child !== endpointNodeID) {
                return
            }
            if (!hasNode(edge.Parent) || !hasNode(edge.Child)) {
                return
            }
            if (apply(edge)) {
                this.edges.delete(edge.ID)
                applied++
            }
        })
        return applied
    }
}
