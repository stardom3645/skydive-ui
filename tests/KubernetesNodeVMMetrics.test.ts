import { strict as assert } from 'assert'
import { createKubernetesNodeVMMatcher } from '../src/KubernetesNodeVMIdentity'
import { TopologyResourceData, topologyResourcePlan } from '../src/TopologyResourceData'
import { createTopologyResourceMetricsIndex, kubernetesNodeResourceRowHeight, topologyResourceMetrics } from '../src/TopologyResourceMetrics'
import { topologyLayerCardLayouts, topologyNodePresentation } from '../src/TopologyNodePresentation'

const id = 'dcced222-bc4e-4d62-bf58-163f84c8db9e'
const other = '581dbb97-0a98-4e62-b8fb-b63d38658404'
const vm = { uuid: id, instanceName: 'i-21-199-VM', name: 'worker' }
const worker = (provider: any = `external-cloudstack://${id}`, system: any = id): any => ({ id: 'k8s-object-uid',
    parent: null, children: [], state: { expanded: true }, data: { Name: 'worker', Type: 'node', Manager: 'k8s', ClusterName: 'cluster',
        K8s: { Extra: { ObjectMeta: { UID: 'k8s-object-uid' }, Spec: { ProviderID: provider }, Status: {
            NodeInfo: { SystemUUID: system }, Allocatable: { cpu: '4', memory: '7Gi' }, Capacity: { cpu: '4', memory: '8Gi' }
        } } } } })
const match = { uuid: id, domain: vm.instanceName, matchedBy: 'ProviderID · SystemUUID' }
const wall = (cpu: any = 0, memory: any = 48.5, timestamp = Date.now() / 1000) => ({ series: [
    { key: 'cpu', lastValue: cpu, timestamp }, { key: 'memory', lastValue: memory, timestamp }
] })
const values = (node: any, snapshot: any = {}) => topologyResourceMetrics(node, snapshot).map(item => item.value)
const present = (node: any, snapshot: any) => topologyNodePresentation(node, { name: node.data.Name, resourceData: snapshot })

describe('Kubernetes Node verified VM metric fallback', () => {
    it('matches Mold UUIDs with both provider and system UUID, independently of names', () => {
        const node = worker(); node.data.Name = 'completely-different'
        assert.deepEqual(createKubernetesNodeVMMatcher(undefined, { [id]: vm })(node), match)
        assert.deepEqual(createKubernetesNodeVMMatcher({ virtualMachines: [vm] })(worker()), match)
    })
    it('supports SystemUUID alone and compact UUIDs without treating the Node UID as a VM UUID', () => {
        assert.equal(createKubernetesNodeVMMatcher(undefined, { [id]: vm })(worker('', id.replace(/-/g, '').toUpperCase()))?.uuid, id)
        const node = worker('', ''); node.id = id; node.data.K8s.Extra.ObjectMeta.UID = id
        assert.equal(createKubernetesNodeVMMatcher(undefined, { [id]: { ...vm, name: 'worker', privateIp: '10.0.0.1' } })(node), undefined)
    })
    it('rejects conflicting, invalid, unknown-provider and unregistered identities', () => {
        const matcher = createKubernetesNodeVMMatcher(undefined, { [id]: vm })
        for (const node of [worker(undefined, other), worker('aws:///same-name', id), worker('external-cloudstack://broken', id),
            worker(`external-cloudstack://${other}`, other), worker('', '00000000-0000-0000-0000-000000000000')]) {
            assert.equal(matcher(node), undefined)
        }
    })
    it('refuses ambiguous inventory domains and never uses display names as metric domains', () => {
        assert.equal(createKubernetesNodeVMMatcher({ vms: [{ ...vm, instanceName: 'i-2-999-VM' }] }, { [id]: vm })(worker()), undefined)
        assert.equal(createKubernetesNodeVMMatcher(undefined, { [id]: { uuid: id, name: 'worker' } })(worker()), undefined)
        assert.equal(createKubernetesNodeVMMatcher({ vms: [vm, { ...vm, uuid: other }] })(worker()), undefined)
    })
    it('reuses the existing Wall endpoint only for verified Nodes and keeps the Node detail UID', () => {
        const node = worker(), unknown = worker('', ''); unknown.id = 'unknown'
        const pod = { ...worker(), id: 'pod', data: { ...node.data, Type: 'pod' } }
        const plan = topologyResourcePlan([node, unknown, pod], 'http://localhost:8082', [{ id: 'cluster-id', name: 'cluster' }], undefined, { [id]: vm })
        const ref = plan.refs.get(node.id)!
        assert.deepEqual(ref.nodeVM, match)
        assert.equal(new URL(ref.detail!).searchParams.get('uid'), 'k8s-object-uid')
        const request = new URL(ref.wall!)
        assert.equal(request.pathname, '/api/wall/vms/trend')
        assert.equal(request.searchParams.get('domain'), 'i-21-199-VM')
        assert.equal(request.searchParams.get('uuid'), id)
        assert.equal(plan.refs.get(unknown.id)!.wall, undefined)
        assert.equal(plan.refs.get(pod.id)!.wall, undefined)
        const withoutCluster = topologyResourcePlan([node], 'http://localhost:8082', [], undefined, { [id]: vm })
        assert.ok(withoutCluster.refs.get(node.id)!.wall)
        assert.equal(withoutCluster.refs.get(node.id)!.detail, undefined)
    })
    it('preserves valid zero VM measurements and exposes their source and measurement basis', () => {
        const node = worker(), snapshot = { nodeVM: match, wall: wall() }
        assert.deepEqual(values(node, snapshot), ['0%', '48.5%'])
        const model = present(node, snapshot)
        assert.deepEqual(model.metrics.map(item => item.value), ['0%', '48.5%', '미수집'])
        assert.equal(model.metrics[0].label, 'CPU 사용률')
        assert.equal(model.metrics[0].sourceLabel, 'Wall · VM')
        assert.ok(model.metrics[0].description!.includes('libvirt'))
        assert.ok(model.metrics[0].description!.includes('최근 1분'))
        assert.ok(model.metrics[1].description!.includes('VM 메모리 통계'))
        assert.ok(model.metrics[0].description!.includes(id))
        assert.deepEqual(model.status, present(node, {}).status)
    })
    it('prioritizes native Kubernetes measurements, including zero, for each individual resource', () => {
        const node = worker(), snapshot = { nodeVM: match, wall: wall(77, 80), detail: { usage: { cpu: '0' } } }
        const metrics = topologyResourceMetrics(node, snapshot)
        assert.deepEqual(metrics.map(item => item.value), ['0%', '80%'])
        assert.deepEqual(metrics.map(item => item.sourceLabel), ['Kubernetes', 'Wall · VM'])
        node.data.K8s.Metrics = { MemoryUsagePercent: 0 }
        assert.deepEqual(values(node, snapshot), ['0%', '0%'])
        node.data.K8s.Metrics = { Usage: { memory: '1Gi' } }
        assert.deepEqual(values(node, { ...snapshot, detail: { usage: { cpu: '0' }, allocatable: { cpu: '4' } } }), ['0%', '14.3%'])
    })
    it('does not replace native usage quantities with a VM percentage when Node capacity is missing', () => {
        const node = worker(); node.data.K8s.Extra.Status = {}
        const metrics = topologyResourceMetrics(node, { detail: { usage: { cpu: '20m', memory: '1Gi' } }, nodeVM: match, wall: wall(50, 60) })
        assert.deepEqual(metrics.map(item => item.sourceLabel), ['Kubernetes', 'Kubernetes'])
        assert.equal(metrics[0].value, '20m')
        assert.equal(metrics[0].percent, undefined)
    })
    it('falls back per resource to API inventory for missing, invalid or stale VM samples', () => {
        const node = worker()
        for (const snapshot of [{ wall: wall() }, { nodeVM: match }, { nodeVM: match, wall: wall(null, '') },
            { nodeVM: match, wall: wall(false, -1) }, { nodeVM: match, wall: wall(101, 'NaN') },
            { nodeVM: match, wall: wall(10, 20, Date.now() / 1000 - 600) }]) {
            assert.deepEqual(values(node, snapshot), ['4Core', '7GiB'])
        }
        assert.deepEqual(values(node, { nodeVM: match, wall: wall(0, null) }), ['0%', '7GiB'])
        assert.ok(topologyResourceMetrics(node)[1].description!.includes('전체 용량 8GiB'))
    })
    it('does not enable Pod/workload metrics or alter cluster cards when VM fallback is available', () => {
        const node = worker(), pod = { ...worker(), id: 'pod', data: { ...worker().data, Type: 'pod' } }
        const snapshot = { nodeVM: match, wall: wall() }
        const index = createTopologyResourceMetricsIndex([node, pod], () => snapshot)
        assert.equal(index.metricsAvailable(node), false)
        assert.equal(index.metricsAvailable(pod), false)
        assert.equal(present(pod, snapshot).metrics.length, 0)
    })
    it('sizes Node cards from their actual content and keeps rendering and SVG dimensions consistent', () => {
        const node = worker(), snapshot = { nodeVM: match, wall: wall() }
        const missing = worker(); missing.id = 'missing'; missing.data.K8s.Extra.Status = {}
        assert.equal(kubernetesNodeResourceRowHeight(node), 112)
        assert.equal(kubernetesNodeResourceRowHeight(node, snapshot), 136)
        assert.equal(kubernetesNodeResourceRowHeight(missing), 0)
        const layouts = topologyLayerCardLayouts([node, missing].map(item => ({ node: item,
            nodeResourceRowHeight: kubernetesNodeResourceRowHeight(item, item === node ? snapshot : {}) })))
        const model = topologyNodePresentation(node, { name: 'worker', resourceData: snapshot, cardLayout: layouts.get(node.id) })
        assert.deepEqual(model.metricRowHeights, [136, 56])
        assert.equal(model.height, layouts.get(node.id)!.height)
        assert.equal(layouts.get(node.id)!.height - layouts.get(missing.id)!.height, 146)
        assert.deepEqual(present(missing, {}).metrics.map(item => item.key), ['pods'])
        assert.deepEqual(present(missing, {}).metricRowHeights, [56])
    })
    it('retains only the latest non-null sample timestamp and existing source metadata in the cache', async () => {
        const cache = new TopologyResourceData(() => undefined, (async () => ({ ok: true, json: async () => ({
            rawLabels: { source: 'node_exporter' }, series: [{ key: 'cpu', lastValue: 0,
                values: [{ timestamp: 10, value: 1 }, { timestamp: 20, value: 0 }, { timestamp: 30, value: null }] }]
        }) })) as any)
        try {
            cache.sync([{ key: 'vm', url: '/api/wall/vms/trend?domain=vm' }])
            await new Promise(resolve => setImmediate(resolve))
            assert.deepEqual(cache.get('vm'), { source: 'node_exporter', series: [{ key: 'cpu', lastValue: 0, timestamp: 20 }] })
        } finally { cache.dispose() }
    })
})
