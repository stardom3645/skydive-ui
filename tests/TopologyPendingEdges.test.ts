import * as assert from 'assert'

import { TopologyPendingEdges, TopologyEdgeEvent } from '../src/TopologyPendingEdges'

const edge = (id: string, parent: string, child: string): TopologyEdgeEvent => ({
    ID: id,
    Parent: parent,
    Child: child,
    Metadata: { RelationType: 'ownership' }
})

describe('Topology pending live relations', () => {
    it('replays ownership after the missing switch port endpoint arrives', () => {
        const pending = new TopologyPendingEdges()
        const nodes = new Set(['switch'])
        const applied: string[] = []
        pending.defer(edge('ownership-xg2', 'switch', 'xg2'))

        assert.strictEqual(pending.replayReady(id => nodes.has(id), value => {
            applied.push(value.ID)
            return true
        }), 0)
        assert.strictEqual(pending.size(), 1)

        nodes.add('xg2')
        assert.strictEqual(pending.replayReady(id => nodes.has(id), value => {
            applied.push(value.ID)
            return true
        }, 'xg2'), 1)
        assert.deepStrictEqual(applied, ['ownership-xg2'])
        assert.strictEqual(pending.size(), 0)
    })

    it('does not replay an edge removed before its endpoint arrives', () => {
        const pending = new TopologyPendingEdges()
        pending.defer(edge('ownership-xg5', 'switch', 'xg5'))
        pending.remove('ownership-xg5')

        assert.strictEqual(pending.replayReady(() => true, () => true), 0)
        assert.strictEqual(pending.size(), 0)
    })

    it('removes stale deferred relations with a deleted endpoint', () => {
        const pending = new TopologyPendingEdges()
        pending.defer(edge('ownership-xg2', 'switch', 'xg2'))
        pending.defer(edge('layer2-xg2', 'xg2', 'host-nic'))
        pending.defer(edge('unrelated', 'host', 'host-nic'))

        pending.removeForNode('xg2')
        assert.strictEqual(pending.size(), 1)
    })

    it('keeps unresolved relations pending across unrelated node additions', () => {
        const pending = new TopologyPendingEdges()
        pending.defer(edge('ownership-xg2', 'switch', 'xg2'))
        const nodes = new Set(['switch', 'other'])

        assert.strictEqual(pending.replayReady(id => nodes.has(id), () => true, 'other'), 0)
        assert.strictEqual(pending.size(), 1)
    })

    it('keeps the latest edge payload for the same stable relation ID', () => {
        const pending = new TopologyPendingEdges()
        pending.defer(edge('ownership-port', 'old-switch', 'port'))
        pending.defer(edge('ownership-port', 'new-switch', 'port'))
        let appliedParent = ''

        pending.replayReady(() => true, value => {
            appliedParent = value.Parent
            return true
        })

        assert.strictEqual(appliedParent, 'new-switch')
        assert.strictEqual(pending.size(), 0)
    })

    it('drops deferred runtime state when an authoritative sync starts', () => {
        const pending = new TopologyPendingEdges()
        pending.defer(edge('ownership-xg2', 'switch', 'xg2'))
        pending.clear()

        assert.strictEqual(pending.replayReady(() => true, () => true), 0)
        assert.strictEqual(pending.size(), 0)
    })
})
