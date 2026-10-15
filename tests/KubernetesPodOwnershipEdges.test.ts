import { strict as assert } from 'assert'
import { kubernetesPodOwnershipEdges, mergeKubernetesPodOwnershipLinks, topologyCardEdge } from '../src/TopologyEdgePresentation'

interface Item {
    id: string; type: string; manager?: string; hidden?: boolean; group?: boolean; parent?: Item
}
const item = (id: string, type: string, parent?: Item, extra: Partial<Item> = {}): Item =>
    ({ id, type, parent, manager: 'k8s', ...extra })
const access = {
    id: (n: Item) => n.id, type: (n: Item) => n.type, manager: (n: Item) => n.manager || '',
    hidden: (n: Item) => !!n.hidden, group: (n: Item) => !!n.group, parent: (n: Item) => n.parent
}

describe('Kubernetes Pod ownership lines', () => {
    it('reuses existing solid edges once, including reversed/duplicate pairs, and adds only missing ownership', () => {
        const collected = [
            { id: 'existing', source: 'pod-a', target: 'owner', data: { traffic: 17 }, guide: false },
            { id: 'duplicate', source: 'owner', target: 'pod-a', data: { traffic: 0 }, guide: false },
            { id: 'unrelated', source: 'switch', target: 'host', data: { traffic: 22 }, guide: false }
        ]
        const before = JSON.stringify(collected)
        const result = mergeKubernetesPodOwnershipLinks([{ source: 'owner', target: 'pod-a' }, { source: 'owner', target: 'pod-b' }], collected, {
            nodeID: n => n, sourceID: link => link.source, targetID: link => link.target,
            reuse: link => ({ ...link, guide: true }),
            create: edge => ({ id: 'fallback', ...edge, data: { traffic: 0 }, guide: true })
        })
        assert.deepEqual(result.map(link => link.id), ['existing', 'unrelated', 'fallback'])
        assert.strictEqual(result[0].data, collected[0].data)
        assert.strictEqual(result[1], collected[2])
        assert.equal(JSON.stringify(collected), before)
        assert.equal(result.filter(link => link.guide).length, 2)
    })
    it('connects every supported workload directly to its rendered Pods through alignment spacers', () => {
        for (const type of ['deployment', 'daemonset', 'statefulset', 'job', 'cronjob', 'replicaset']) {
            const namespace = item('ns', 'namespace'), workload = item('owner', type, namespace)
            const spacer = item('spacer', type, workload, { hidden: true })
            const a = item('pod-a', 'pod', spacer), b = item('pod-b', 'pod', workload)
            const nodes = [namespace, workload, spacer, a, b], parents = nodes.map(n => n.parent)
            const edges = kubernetesPodOwnershipEdges(nodes, access)
            assert.deepEqual(edges.map(e => [e.source.id, e.target.id]), [['owner', 'pod-a'], ['owner', 'pod-b']])
            assert.deepEqual(nodes.map(n => n.parent), parents)
        }
    })
    it('does not connect namespaces, controllers, scheduling Nodes, group proxies or absent owners', () => {
        const ns = item('ns', 'namespace'), cronjob = item('cron', 'cronjob', ns), job = item('job', 'job', cronjob)
        const worker = item('worker', 'node'), group = item('group', 'deployment', ns, { group: true })
        const absent = item('absent', 'deployment', ns), infra = item('infra', 'deployment', undefined, { manager: 'libvirt' })
        const pod = item('owned', 'pod', job)
        const nodes = [ns, cronjob, job, worker, group, infra, pod, item('ownerless', 'pod', ns),
            item('scheduled', 'pod', worker), item('grouped-owner', 'pod', group), item('missing-owner', 'pod', absent),
            item('infra-pod', 'pod', infra), item('hidden-pod', 'pod', job, { hidden: true })]
        assert.deepEqual(kubernetesPodOwnershipEdges(nodes, access).map(e => [e.source.id, e.target.id]), [['job', 'owned']])
        assert.deepEqual(kubernetesPodOwnershipEdges(nodes.filter(n => n.type !== 'pod'), access), [])
    })
    it('avoids cycles and clips the existing solid curve to card bottoms and tops', () => {
        const spacer = item('cycle', 'deployment', undefined, { hidden: true })
        spacer.parent = spacer
        assert.deepEqual(kubernetesPodOwnershipEdges([spacer, item('pod', 'pod', spacer)], access), [])
        const path = topologyCardEdge({ x: 0, y: 400, width: 580, height: 440 },
            { x: 400, y: 1000, width: 420, height: 340 })
        assert.ok(path.startsWith('M0,620 '))
        assert.ok(path.endsWith('400,830'))
        assert.ok(path.includes(' C'))
        assert.ok(!path.includes('NaN'))
    })
})
