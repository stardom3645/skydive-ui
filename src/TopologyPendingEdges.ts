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
    private deferredAt = new Map<string, number>()

    constructor(
        private maxEdges = 10000,
        private maxAgeMs = 5 * 60 * 1000,
        private now: () => number = Date.now
    ) { }

    defer(edge: T) {
        this.pruneExpired()
        this.remove(edge.ID)
        this.edges.set(edge.ID, edge)
        this.deferredAt.set(edge.ID, this.now())
        while (this.edges.size > this.maxEdges) {
            this.remove(this.edges.keys().next().value!)
        }
    }

    remove(edgeID: string) {
        this.edges.delete(edgeID)
        this.deferredAt.delete(edgeID)
    }

    has(edgeID: string): boolean {
        this.pruneExpired()
        return this.edges.has(edgeID)
    }

    removeForNode(nodeID: string) {
        Array.from(this.edges.values()).forEach(edge => {
            if (edge.Parent === nodeID || edge.Child === nodeID) {
                this.remove(edge.ID)
            }
        })
    }

    clear() {
        this.edges.clear()
        this.deferredAt.clear()
    }

    size(): number {
        this.pruneExpired()
        return this.edges.size
    }

    private pruneExpired() {
        const cutoff = this.now() - this.maxAgeMs
        // Insertion order follows the latest payload's arrival time.
        for (const [id, time] of this.deferredAt) {
            if (time > cutoff) break
            this.remove(id)
        }
    }

    replayReady(
        hasNode: (nodeID: string) => boolean,
        apply: (edge: T) => boolean,
        endpointNodeID?: string
    ): number {
        this.pruneExpired()
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
                this.remove(edge.ID)
                applied++
            }
        })
        return applied
    }
}
