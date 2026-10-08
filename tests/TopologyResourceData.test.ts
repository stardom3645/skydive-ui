import { strict as assert } from 'assert'
import { TopologyResourceData, topologyResourcePlan, topologyInventoryData, normalizeTopologyHost } from '../src/TopologyResourceData'
import { topologyResourceMetrics } from '../src/TopologyResourceMetrics'
import { topologyNodePresentation } from '../src/TopologyNodePresentation'

const node = (id: string, type: string, extra: any = {}): any => ({ id, parent: null, children: [], state: { expanded: true },
    data: { Name: id, Type: type, Manager: 'k8s', K8s: { Namespace: 'app', Extra: { ObjectMeta: { UID: id }, Status: { Phase: 'Running' } } }, ...extra } })
const attach = (parent: any, child: any) => { child.parent = parent; parent.children.push(child); return child }
const flush = () => new Promise(resolve => setImmediate(resolve))

describe('Topology resource data sources', () => {
    it('shares one cluster summary and uses the detailed node UID, including encoded identifiers', () => {
        const cluster = node('prod/a', 'cluster')
        const worker = attach(cluster, node('worker', 'node'))
        const pod = attach(cluster, node('pod', 'pod'))
        const plan = topologyResourcePlan([cluster, worker, pod], 'http://localhost:8082/', [{ id: 'mold/a', name: 'prod/a' }])
        assert.equal(plan.requests.length, 2)
        assert.equal(plan.refs.get(pod.id)!.summary, plan.refs.get(cluster.id)!.summary)
        const detail = new URL(plan.refs.get(worker.id)!.detail!)
        assert.equal(detail.searchParams.get('id'), 'mold/a')
        assert.equal(detail.searchParams.get('uid'), 'worker')
    })

    it('uses the existing Wall host query and Mold management address without changing service ports', () => {
        const host = node('topology-host', 'host', { Manager: 'fabric', Name: 'cube-1' })
        const plan = topologyResourcePlan([host], 'http://localhost:8082', [], { hosts: [{ name: 'cube-1', managementip: '10.0.0.1' }] })
        const request = new URL(plan.refs.get(host.id)!.wall!)
        assert.equal(request.pathname, '/api/wall/hosts/trend')
        assert.equal(request.searchParams.get('managementIp'), '10.0.0.1')
        assert.equal(request.searchParams.get('port'), '3003')
        assert.equal(new URL(plan.refs.get(host.id)!.host!).pathname, '/api/mold/hosts/detail')
    })

    it('matches every collected host address and updates the Wall query with the resolved Mold host', () => {
        const host = node('host', 'host', { Manager: 'fabric', Name: 'cube', IPV4: ['192.0.2.1', '10.0.0.1'] })
        const inventory = { data: { host: [{ id: 'mold-host', name: 'cube-real', managementip: '10.0.0.1', state: 'Up' }] } }
        const data = topologyInventoryData(host, inventory)
        assert.equal(data.State, 'Up')
        assert.equal(data.ManagementIP, '10.0.0.1')
        const plan = topologyResourcePlan([host], 'http://localhost:8082', [], inventory, undefined,
            () => normalizeTopologyHost({ name: 'cube-real', managementIp: '10.0.0.2' }))
        assert.equal(new URL(plan.refs.get(host.id)!.host!).searchParams.get('hostId'), 'mold-host')
        assert.equal(new URL(plan.refs.get(host.id)!.wall!).searchParams.get('managementIp'), '10.0.0.2')
        assert.equal(new URL(plan.refs.get(host.id)!.wall!).searchParams.get('host'), 'cube-real')
    })

    it('shows Mold host state, allocation and VM counts without mutating topology metadata', () => {
        const host = node('host', 'host', { Manager: 'fabric' })
        const original = JSON.stringify(host.data)
        const detail = normalizeTopologyHost({ state: 'Up', resourceState: 'Enabled', cpuAllocatedPercent: '31.5%',
            memoryAllocatedPercent: '0%', userVmCount: 6, systemVmCount: 0, virtualRouterCount: 2, type: 'Routing' })
        const model = topologyNodePresentation(host, { name: 'host', resourceData: { host: detail } })
        assert.equal(model.status.tone, 'normal')
        assert.ok(model.status.description.includes('호스트 상태 Up'))
        assert.deepEqual(model.metrics.map(metric => [metric.label, metric.value]),
            [['CPU 할당', '31.5%'], ['메모리 할당', '0%'], ['가상머신', '6'], ['시스템 VM', '0'], ['가상 라우터', '2'], ['연결 자원', '0']])
        assert.equal(JSON.stringify(host.data), original)
        const wall = { series: [{ key: 'cpu', lastValue: 12 }, { key: 'memory', lastValue: 40 }] }
        assert.deepEqual(topologyResourceMetrics(host, { host: detail, wall }).map(metric => [metric.label, metric.value]), [['CPU', '12%'], ['메모리', '40%']])
        detail.State = 'Unknown'
        assert.equal(topologyNodePresentation(host, { name: 'host', resourceData: { host: detail } }).status.tone, 'unknown')
        detail.State = 'Up'; detail.ResourceState = 'Maintenance'
        assert.equal(topologyNodePresentation(host, { name: 'host', resourceData: { host: detail } }).status.tone, 'inactive')
    })

    it('uses collected Wall percentages and retains a measured zero', () => {
        const host = node('host', 'host', { Manager: 'fabric' })
        assert.deepEqual(topologyResourceMetrics(host, { wall: { series: [{ key: 'cpu', lastValue: 0 }, { key: 'memory', lastValue: 48.5 }] } })
            .map(metric => [metric.value, metric.percent]), [['0%', 0], ['48.5%', 48.5]])
    })

    it('calculates node utilization from the same usage/allocatable quantities as the detail panel', () => {
        const worker = node('worker', 'node')
        const resourceData = { detail: { usage: { cpu: '250m', memory: '2Gi' }, allocatable: { cpu: '4', memory: '8Gi' }, podCount: 0 } }
        const model = topologyNodePresentation(worker, { name: 'worker', resourceData })
        assert.deepEqual(model.metrics.map(metric => metric.value), ['6.3%', '25%', '0'])
        assert.ok(model.metrics[0].description!.includes('250mCore'))
    })

    it('shows collected capacity without inventing usage when metrics are unavailable', () => {
        const worker = node('worker', 'node', { K8s: { Extra: { Status: { Allocatable: { cpu: { String: '4' }, memory: '8Gi' } } } } })
        const metrics = topologyResourceMetrics(worker)
        assert.deepEqual(metrics.map(metric => [metric.value, metric.percent]), [['4Core', undefined], ['8GiB', undefined]])
        assert.deepEqual(metrics.map(metric => metric.label), ['CPU 용량', '메모리 용량'])
        assert.ok(metrics[0].description!.includes('실시간 사용량 미수집'))
        const cluster = topologyResourceMetrics(node('cluster', 'cluster'), { summary: { resources: { metricsAvailable: false, usageCpuCores: 3 } } })
        assert.equal(cluster[0].value, '미수집')
        const collectedZero = topologyResourceMetrics(node('cluster', 'cluster'), { summary: { resources: { metricsAvailable: true, allocatableCpuCores: 4 } } })
        assert.equal(collectedZero[0].value, '0%')
    })

    it('keeps workload totals complete and separates same-name pods in different clusters', () => {
        const cluster = node('cluster-a', 'cluster'), other = node('cluster-b', 'cluster')
        const workload = attach(cluster, node('api', 'deployment'))
        const pod = attach(workload, node('api-1', 'pod'))
        pod.data.K8s.Extra.ObjectMeta.OwnerReferences = [{ UID: workload.id, Name: workload.id, Kind: 'Deployment', Controller: true }]
        const duplicate = attach(other, node('api-1-other', 'pod', { Name: 'api-1' }))
        const data = { summary: { resources: { podUsage: [{ namespace: 'app', name: 'api-1', usageCpuCores: .25, usageMemoryBytes: 128 * 1024 * 1024 }] } } }
        const nodes = [cluster, workload, pod, other, duplicate]
        assert.deepEqual(topologyResourceMetrics(workload, data, nodes).map(metric => metric.value), ['250m', '128MiB'])
        assert.deepEqual(topologyResourceMetrics(workload, { summary: { resources: { podUsage: [] } } }, nodes), [])
    })
})

describe('Topology resource request lifecycle', () => {
    it('retains host detail fields and treats an unmatched Mold host as unavailable', async () => {
        let matched = true, now = 0
        const cache = new TopologyResourceData(() => undefined, (async () => ({ ok: true,
            json: async () => ({ moldMatched: matched, mold: { state: 'Up', userVmCount: 0 } }) })) as any, () => now)
        const request = { key: 'host-detail', url: '/api/mold/hosts/detail?name=cube' }
        try {
            cache.sync([request]); await flush()
            assert.equal(cache.get(request.key).State, 'Up')
            assert.equal(cache.get(request.key).UserVMCount, 0)
            matched = false; now = 60000
            cache.sync([request]); await flush()
            assert.equal(cache.get(request.key), undefined)
        } finally { cache.dispose() }
    })
    it('bounds concurrency, coalesces repaints, and aborts resources removed from the view', async () => {
        const calls: { signal: AbortSignal; resolve: (response: any) => void }[] = []
        let changes = 0
        const cache = new TopologyResourceData(() => changes++, ((url, options) => new Promise((resolve, reject) => {
            const signal = options!.signal as AbortSignal
            signal.addEventListener('abort', () => reject(new Error('aborted')))
            calls.push({ signal, resolve })
        })) as typeof fetch)
        const requests = Array.from({ length: 5 }, (_, index) => ({ key: String(index), url: '/api/mold/kubernetes-clusters/summary?id=' + index }))
        try {
            cache.sync(requests); cache.sync(requests)
            assert.equal(calls.length, 3)
            calls[0].resolve({ ok: true, json: async () => ({ resources: { metricsAvailable: true } }) })
            await flush()
            assert.equal(calls.length, 4)
            assert.equal(changes, 1)
            cache.sync([])
            await flush()
            assert.ok(calls.slice(1).every(call => call.signal.aborted))
            assert.equal(cache.get('0'), undefined)
            assert.equal(changes, 1)
        } finally { cache.dispose() }
    })

    it('refreshes cached values and clears stale usage after a failed request', async () => {
        let now = 0, calls = 0, fail = false
        const cache = new TopologyResourceData(() => undefined, (async () => {
            calls++
            return { ok: !fail, json: async () => ({ series: [{ key: 'cpu', lastValue: 15, values: [1, 2, 3] }] }) } as any
        }) as typeof fetch, () => now)
        const requests = [{ key: 'host', url: '/api/wall/hosts/trend?host=host' }]
        try {
            cache.sync(requests); await flush()
            assert.deepEqual(cache.get('host'), { series: [{ key: 'cpu', lastValue: 15 }] })
            cache.sync(requests); await flush()
            assert.equal(calls, 1)
            now = 60000; fail = true
            cache.sync(requests); await flush()
            assert.equal(calls, 2)
            assert.equal(cache.get('host'), undefined)
        } finally { cache.dispose() }
    })
})
