import { strict as assert } from 'assert'
import { topologyProblemFocusClosure } from '../src/TopologyProblemFocus'

const edge = (sourceID: string, targetID: string) => ({ id: `${sourceID}->${targetID}`, sourceID, targetID })
describe('Problem navigation visual context', () => {
    it('keeps the target, explicit relationships and ancestor paths without pulling in siblings', () => {
        const result = topologyProblemFocusClosure('pod', ['controller', 'worker'], new Set(['cluster', 'namespace', 'controller', 'pod', 'worker', 'other-pod', 'other-worker']),
            [edge('pod', 'worker'), edge('other-pod', 'worker'), edge('pod', 'other-worker')],
            [edge('cluster', 'namespace'), edge('namespace', 'controller'), edge('controller', 'pod'), edge('controller', 'other-pod'), edge('cluster', 'worker'), edge('cluster', 'other-worker')])
        assert.deepEqual(Array.from(result.nodeIDs).sort(), ['cluster', 'controller', 'namespace', 'pod', 'worker'])
        assert.deepEqual(Array.from(result.relationLinkIDs), ['pod->worker'])
        assert.deepEqual(Array.from(result.hierarchyLinkKeys).sort(), ['cluster->namespace', 'cluster->worker', 'controller->pod', 'namespace->controller'])
    })
    it('does not invent edges for ownership references or resources absent from the rendered graph', () => {
        const result = topologyProblemFocusClosure('deployment', ['pod', 'missing'], new Set(['deployment', 'pod']), [], [])
        assert.deepEqual(Array.from(result.nodeIDs).sort(), ['deployment', 'pod'])
        assert.equal(result.relationLinkIDs.size, 0)
        assert.equal(result.hierarchyLinkKeys.size, 0)
    })
    it('survives reparenting, collapsed representatives and malformed hierarchy cycles', () => {
        const result = topologyProblemFocusClosure('group', ['node'], new Set(['group', 'node']), [edge('group', 'node')], [edge('group', 'node'), edge('node', 'group')])
        assert.deepEqual(Array.from(result.nodeIDs).sort(), ['group', 'node'])
        assert.equal(result.relationLinkIDs.size, 1)
        const collapsed = topologyProblemFocusClosure('pod', [], new Set(['pod']), [], [])
        assert.deepEqual(Array.from(collapsed.nodeIDs), ['pod'])
        assert.equal(collapsed.hierarchyLinkKeys.size, 0)
    })
})
