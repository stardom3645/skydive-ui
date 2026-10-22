import type { TopologyRelationPathEdge } from './TopologyConnectionFocus'

/** Highlight only the supplied context and its rendered ancestor paths. Do
 * not traverse a peer's other connections or infer causal/impact direction. */
export const topologyProblemFocusClosure = (
    anchorID: string, relatedIDs: string[], renderedIDs: Set<string>,
    relations: TopologyRelationPathEdge[], hierarchy: TopologyRelationPathEdge[]
) => {
    const nodeIDs = new Set([anchorID, ...relatedIDs].filter(id => renderedIDs.has(id)))
    const parents = new Map(hierarchy.map(edge => [edge.targetID, edge.sourceID]))
    Array.from(nodeIDs).forEach(id => {
        const seen = new Set<string>()
        let parent = parents.get(id)
        while (parent && renderedIDs.has(parent) && !seen.has(parent)) {
            seen.add(parent); nodeIDs.add(parent); parent = parents.get(parent)
        }
    })
    const within = (edge: TopologyRelationPathEdge) => nodeIDs.has(edge.sourceID) && nodeIDs.has(edge.targetID)
    return { nodeIDs,
        relationLinkIDs: new Set(relations.filter(within).map(edge => edge.id)),
        hierarchyLinkKeys: new Set(hierarchy.filter(within).map(edge => edge.id)) }
}
