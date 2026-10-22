import { strict as assert } from 'assert'
import { currentProblems, currentProblemCounts, defaultProblemFilters, filterCurrentProblems } from '../src/CurrentProblems'
import type { Node, Link } from '../src/Topology'

const node = (id: string, data: any, parent?: Node): Node => {
    const value = { id, data: { Name: id, ...data }, tags: [], children: [], parent: parent || null } as any
    if (parent) parent.children.push(value)
    return value
}
const link = (source: Node, target: Node): Link => ({ id: `${source.id}-${target.id}`, source, target, data: {}, tags: [] } as any)
const name = (node: Node) => String(node.data.Name)
const state = () => ({ kind: 'unknown', label: 'Unknown' })

describe('Current problem resource overview', () => {
    it('excludes stopped resources, unused Down NICs, groups and completed Pods', () => {
        const nodes = [node('stopped', { Type: 'libvirt', State: 'stopped' }),
            node('unused', { Type: 'device', State: 'DOWN' }),
            node('group', { Type: 'host', State: 'failed', IsTopologyGroup: true }),
            node('finished', { Type: 'pod', Manager: 'k8s', K8s: { Extra: { Status: { Phase: 'Succeeded' } } } }),
            node('host-failed', { Type: 'host', State: 'failed' })]
        assert.deepEqual(currentProblems(nodes, [], name, state).map(entry => entry.id), ['host-failed'])
    })
    it('does not repeat a child problem on healthy cluster, namespace or host parents', () => {
        const cluster = node('cluster-a', { Type: 'cluster', Manager: 'k8s', State: 'Running' })
        const namespace = node('app', { Type: 'namespace', Manager: 'k8s', K8s: { Extra: { Status: { Phase: 'Active' } } } }, cluster)
        const pod = node('api', { Type: 'pod', Manager: 'k8s', K8s: { Extra: { Status: {
            Phase: 'Running', ContainerStatuses: [{ Ready: false, State: { Waiting: { Reason: 'CrashLoopBackOff' } } }]
        } } } }, namespace)
        const rows = currentProblems([cluster, namespace, pod], [], name, state)
        assert.deepEqual(rows.map(entry => entry.id), ['api'])
        assert.equal(rows[0].context, 'cluster-a / app')
        assert.ok(rows[0].reason.includes('CrashLoopBackOff'))
        assert.deepEqual(rows[0].related.map(node => node.id), ['app'])
    })
    it('separates collection failure from operational problems and retains path-based NIC attention', () => {
        const host = node('compute', { Type: 'host', State: 'UP' })
        const nic = node('eno1', { Type: 'device', State: 'DOWN' }, host)
        const bridge = node('bridge0', { Type: 'bridge', State: 'UP' }, host)
        const worker = node('worker', { Type: 'node', Manager: 'k8s', State: 'Error' })
        const lost = node('lost', { Type: 'host', State: 'UP', CollectionState: 'failed' })
        const rows = currentProblems([host, nic, bridge, worker, lost], [link(bridge, nic), link(nic, bridge)], name, state)
        assert.deepEqual(rows.map(row => [row.id, row.status]), [['worker', 'problem'], ['eno1', 'attention'], ['lost', 'unavailable']])
        assert.equal(rows.find(row => row.id === nic.id)!.scope, 'compute')
        assert.equal(rows.find(row => row.id === nic.id)!.related.filter(node => node.id === bridge.id).length, 1)
        assert.deepEqual(currentProblemCounts(rows), { all: 3, problem: 1, attention: 1, unavailable: 1 })
    })
    it('combines severity, domain, type, scope and multiword reason search without altering totals', () => {
        const host = node('compute-1', { Type: 'host', State: 'UP' })
        const bridge = node('bridge0', { Type: 'bridge', State: 'UP' }, host)
        const nic = node('eno1', { Type: 'device', State: 'DOWN' }, host)
        const rows = currentProblems([host, bridge, nic], [link(nic, bridge)], name, state)
        assert.equal(filterCurrentProblems(rows, { ...defaultProblemFilters, status: 'attention', domain: 'infrastructure', type: 'device', scope: host.id,
            query: ' COMPUTE-1  경로 ' }).length, 1)
        assert.equal(filterCurrentProblems(rows, { ...defaultProblemFilters, domain: 'kubernetes' }).length, 0)
        assert.equal(filterCurrentProblems(rows, { ...defaultProblemFilters, query: 'missing' }).length, 0)
        assert.equal(currentProblemCounts(rows).all, 1)
    })
    it('deduplicates actual Kubernetes object identity and suppresses stopped-cluster descendants', () => {
        const worker = node('worker', { Type: 'node', Manager: 'k8s', State: 'Error', K8s: { UID: 'same-object' } })
        const clone = node('worker-clone', { ...worker.data })
        const stopped = node('stopped', { Type: 'cluster', Manager: 'k8s', MoldClusterState: 'Stopped' })
        const hidden = node('hidden', { Type: 'node', Manager: 'k8s', State: 'Error' }, stopped)
        assert.deepEqual(currentProblems([worker, clone, stopped, hidden], [], name, state).map(row => row.id), ['worker'])
    })
    it('does not invent occurrence or collection timestamps and updates recovered resources away', () => {
        const failed = node('failed', { Type: 'host', State: 'failed', UpdatedAt: Date.now() })
        const rows = currentProblems([failed], [], name, state)
        assert.equal(rows[0].collectedAt, '확인 불가')
        failed.data.State = 'UP'
        assert.equal(currentProblems([failed], [], name, state).length, 0)
    })
    it('counts a resource once with multiple findings and keeps every filter subtotal consistent', () => {
        const pod = node('pod', { Manager: 'k8s', Type: 'pod', K8s: { Extra: { Status: { Phase: 'Running',
            Conditions: [{ Type: 'Ready', Status: 'False' }], ContainerStatuses: [{ Ready: false, State: { Waiting: { Reason: 'CrashLoopBackOff' } } }]
        } } } })
        const host = node('host', { Type: 'host', State: 'warning' })
        const unavailable = node('missing', { Type: 'host', CollectionState: 'expired' })
        const entries = currentProblems([pod, pod, host, unavailable], [], name, state)
        assert.equal(entries.length, 3)
        for (const domain of ['all', 'infrastructure', 'kubernetes'] as const) {
            const filtered = filterCurrentProblems(entries, { ...defaultProblemFilters, domain })
            const counts = currentProblemCounts(filtered)
            assert.equal(counts.all, counts.problem + counts.attention + counts.unavailable)
            for (const status of ['problem', 'attention', 'unavailable'] as const) assert.equal(filterCurrentProblems(entries, { ...defaultProblemFilters, domain, status }).length, counts[status])
        }
    })
    it('honors collector K8s.CollectionStatus on expired data without reclassifying the old verdict as a current fault', () => {
        const worker = node('worker', { Type: 'node', Manager: 'k8s', State: 'Error', K8s: { CollectionStatus: 'stale' } })
        assert.equal(currentProblems([worker], [], name, state)[0].status, 'unavailable')
        worker.data.K8s.CollectionStatus = 'failed'
        assert.equal(currentProblems([worker], [], name, state)[0].status, 'unavailable')
        worker.data.K8s.CollectionStatus = 'active'
        assert.equal(currentProblems([worker], [], name, state)[0].status, 'problem')
        assert.equal(currentProblems([], [], name, state).length, 0)
    })
    it('lets a newer recovered or completed version replace the older problematic UID, independent of order', () => {
        const old = node('old', { Type: 'pod', Manager: 'k8s', ClusterName: 'a', K8s: { UID: 'same', APIServerVersion: '1.35.9', Extra: {
            ObjectMeta: { ResourceVersion: '99' }, Status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }] }
        } } })
        const recovered = node('new', { ...old.data, K8s: { ...old.data.K8s, Extra: { ObjectMeta: { ResourceVersion: '100' }, Status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'True' }] } } } })
        for (const nodes of [[old, recovered], [recovered, old]]) assert.equal(currentProblems(nodes, [], name, state).length, 0)
        recovered.data.K8s.Extra.Status.Phase = 'Succeeded'
        assert.equal(currentProblems([old, recovered], [], name, state).length, 0)
        const otherCluster = node('foreign', { ...old.data, ClusterName: 'b' })
        assert.equal(currentProblems([old, otherCluster], [], name, state).length, 2)
    })

})
