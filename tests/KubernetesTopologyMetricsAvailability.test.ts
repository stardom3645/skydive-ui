import { strict as assert } from 'assert'
import { kubernetesMetricsAvailable, createTopologyResourceMetricsIndex, topologyResourceMetrics } from '../src/TopologyResourceMetrics'
import { topologyCardDimensions, topologyLayerCardLayouts, topologyNodePresentation } from '../src/TopologyNodePresentation'
import { topologyCardEdge } from '../src/TopologyEdgePresentation'
import { kubernetesNamespaceRegions } from '../src/KubernetesNamespaceRegions'
import { topologyKubernetesCluster } from '../src/TopologyResourceData'

const node = (id: string, type: string, parent?: any): any => {
    const resource = { id, parent, children: [] as any[], state: { expanded: true }, data: {
        Name: id, Type: type, Manager: 'k8s', K8s: { Namespace: 'app', Extra: {
            ObjectMeta: { UID: id, OwnerReferences: parent ? [{ UID: parent.id, Name: parent.id, Kind: 'Deployment', Controller: true }] : [] },
            Status: { Phase: 'Running' }
        } }
    } }
    parent?.children.push(resource)
    return resource
}
const resources = (values: any) => ({ summary: { resources: values } })
const present = (resource: any, snapshot: any = {}, index?: any) => topologyNodePresentation(resource,
    { name: resource.data.Name, resourceData: snapshot, resourceMetricsIndex: index })
const cpuMemory = (model: any) => model.metrics.filter(metric => ['cpu', 'memory'].includes(metric.key))

describe('Kubernetes topology metrics capability', () => {
    it('does not confuse topology collection, capacity, requests or API errors with real metrics', () => {
        const worker = node('worker', 'node')
        Object.assign(worker.data, { collectionEnabled: true, CPU: 5, K8s: { Extra: { Status: { Allocatable: { cpu: '4', memory: '8Gi' } } } } })
        for (const snapshot of [{}, { summary: { error: 'network unavailable' } },
            resources({ metricsAvailable: false, allocatableCpuCores: 4, requestsCpuCores: 1, usageCpuCores: 0 }),
            resources({ podUsage: [{ usageCpuCores: null, usageMemoryBytes: '' }] }),
            resources({ podUsage: [{ usageCpuCores: '  ', usageMemoryBytes: false }] })]) {
            assert.equal(kubernetesMetricsAvailable(worker, snapshot), false)
        }
    })

    it('uses the existing API capability flag even when one object has no usage', () => {
        const pod = node('pod', 'pod')
        const snapshot = resources({ metricsAvailable: true })
        assert.equal(kubernetesMetricsAvailable(pod, snapshot), true)
        assert.deepEqual(cpuMemory(present(pod, snapshot)).map(metric => metric.value), ['미수집', '미수집'])
    })

    it('recognizes measured zero from both Pod summary and collected Node usage', () => {
        assert.equal(kubernetesMetricsAvailable(node('pod', 'pod'), resources({ podUsage: [{ usageCpuCores: 0, usageMemoryBytes: 0 }] })), true)
        const worker = node('worker', 'node')
        worker.data.K8s.Metrics = { Usage: { cpu: '0', memory: '0' } }
        assert.equal(kubernetesMetricsAvailable(worker), true)
        assert.deepEqual(cpuMemory(present(worker)).map(metric => metric.value), ['0m', '0MiB'])
    })

    it('hides unavailable usage while preserving identity, state and inventory counts', () => {
        for (const type of ['cluster', 'node', 'pod', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob']) {
            const resource = node(type, type)
            const hidden = present(resource)
            const configured = present(resource, resources({ metricsAvailable: true }))
            assert.deepEqual(cpuMemory(hidden), [], type)
            assert.equal(cpuMemory(configured).length, type === 'node' ? 0 : 2, type)
            assert.deepEqual([hidden.width, hidden.name, hidden.status],
                [configured.width, configured.name, configured.status])
            if (['pod', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(type))
                assert.ok(hidden.height < configured.height, type)
            else assert.equal(hidden.height, configured.height)
            assert.deepEqual(hidden.metrics, configured.metrics.filter(metric => !['cpu', 'memory'].includes(metric.key)))
            if (!['cluster', 'node'].includes(type))
                assert.ok(!hidden.metricRowHeights?.includes(112), 'hidden usage must not leave a reserved grid row')
        }
    })

    it('shares availability within a cluster without leaking it into another cluster', () => {
        const a = node('cluster-a', 'cluster'), b = node('cluster-b', 'cluster')
        const workerA = node('worker-a', 'node', a), podA = node('pod-a', 'pod', a), podB = node('pod-b', 'pod', b)
        const snapshots = new Map([[workerA.id, { detail: { usage: { cpu: '0', memory: '0' } } }]])
        const index = createTopologyResourceMetricsIndex([a, b, workerA, podA, podB], resource => snapshots.get(resource.id))
        assert.equal(index.metricsAvailable(podA), true)
        assert.equal(index.metricsAvailable(podB), false)
        assert.deepEqual(cpuMemory(present(podA, {}, index)).map(metric => metric.value), ['미수집', '미수집'])
        assert.deepEqual(cpuMemory(present(podB, {}, index)), [])
    })

    it('uses the canonical Mold cluster mapping for different collected ID/name aliases', () => {
        const cluster = node('graph-cluster', 'cluster'), worker = node('worker', 'node'), pod = node('pod', 'pod')
        cluster.data.Name = 'prod'
        worker.data.ClusterID = 'mold-id'; pod.data.ClusterName = 'prod'
        const clusters = [{ id: 'mold-id', name: 'prod', collectionEnabled: false }]
        const index = createTopologyResourceMetricsIndex([cluster, worker, pod], resource => resource === cluster
            ? resources({ metricsAvailable: true }) : undefined,
        resource => topologyKubernetesCluster(resource, clusters)?.id)
        assert.equal(index.metricsAvailable(worker), true)
        assert.equal(index.metricsAvailable(pod), true)
    })

    it('does not infer a cluster for a resource with ambiguous/missing scope', () => {
        const cluster = node('a', 'cluster'), worker = node('worker', 'node', cluster), orphan = node('orphan', 'pod')
        const index = createTopologyResourceMetricsIndex([cluster, worker, orphan], resource => resource === worker
            ? { detail: { usage: { cpu: '0' } } } : undefined)
        assert.equal(index.metricsAvailable(orphan), false)
    })

    it('rechecks capability on the next repaint without duplicate scans per card', () => {
        const cluster = node('a', 'cluster'), pods = Array.from({ length: 20 }, (_, i) => node(`pod-${i}`, 'pod', cluster))
        const all = [cluster, ...pods]
        let available = false, reads = 0
        const snapshots = () => { reads++; return resources({ metricsAvailable: available }) }
        let index = createTopologyResourceMetricsIndex(all, snapshots)
        pods.forEach(pod => assert.equal(index.metricsAvailable(pod), false))
        assert.equal(reads, all.length)
        available = true
        index = createTopologyResourceMetricsIndex(all, snapshots)
        pods.forEach(pod => assert.equal(index.metricsAvailable(pod), true))
        assert.equal(reads, all.length * 2)
    })

    it('preserves an actual Pod zero without turning absent fields into zero', () => {
        const cluster = node('cluster', 'cluster'), pod = node('pod', 'pod', cluster)
        const model = present(pod, resources({ podUsage: [{ namespace: 'app', name: 'pod', usageCpuCores: 0 }] }))
        assert.deepEqual(cpuMemory(model).map(metric => metric.value), ['0m', '미수집'])
        const missingCluster = topologyResourceMetrics(cluster, resources({ metricsAvailable: true }))
        assert.deepEqual(missingCluster.map(metric => metric.value), ['미수집', '미수집'])
    })

    it('keeps incomplete workload measurements unavailable per metric', () => {
        const cluster = node('cluster', 'cluster'), workload = node('api', 'deployment', cluster)
        const p1 = node('p1', 'pod', workload), p2 = node('p2', 'pod', workload)
        const snapshot = resources({ podUsage: [{ namespace: 'app', name: 'p1', usageCpuCores: 0 },
            { namespace: 'app', name: 'p2', usageCpuCores: 0, usageMemoryBytes: 0 }] })
        const metrics = topologyResourceMetrics(workload, snapshot, [cluster, workload, p1, p2])
        assert.deepEqual(metrics.map(metric => metric.value), ['0m', '미수집'])
    })

    it('leaves Infrastructure cards unchanged', () => {
        const host = node('host', 'host'); host.data.Manager = 'fabric'
        assert.deepEqual(cpuMemory(present(host)).map(metric => metric.value), ['미수집', '미수집'])
    })
})

describe('Kubernetes API inventory and content heights', () => {
    it('keeps Node allocatable/capacity independently of metrics collection and shows no fake usage', () => {
        const worker = node('worker', 'node')
        const model = present(worker, { detail: { allocatable: { cpu: '3900m', memory: '7Gi' }, capacity: { cpu: '4', memory: '8Gi' } } })
        const metrics = cpuMemory(model)
        assert.deepEqual(metrics.map(metric => [metric.value, metric.percent, metric.source]),
            [['3.9Core', undefined, 'inventory'], ['7GiB', undefined, 'inventory']])
        assert.ok(metrics[0].description.includes('할당 가능 자원 3.9Core'))
        assert.ok(metrics[0].description.includes('전체 용량 4Core'))
        assert.ok(!metrics[0].description.includes('미수집'))
        assert.equal(kubernetesMetricsAvailable(worker, { detail: { allocatable: { cpu: '4' } } }), false)
    })

    it('falls back to Node capacity when allocatable is absent, including metadata quantities and zero', () => {
        const worker = node('worker', 'node')
        worker.data.K8s.Extra.Status.Capacity = { cpu: { String: '0' }, memory: { String: '8Gi' } }
        const model = present(worker)
        assert.deepEqual(cpuMemory(model).map(metric => [metric.value, metric.source]), [['0mCore', 'inventory'], ['8GiB', 'inventory']])
        assert.ok(cpuMemory(model).every(metric => metric.percent === undefined))
    })

    it('restores cluster aggregate API resources without inventing usage or adding fields to a virtual group', () => {
        const cluster = node('cluster', 'cluster')
        const snapshot = resources({ metricsAvailable: false, allocatableCpuCores: 12, allocatableMemoryBytes: 24 * 1024 ** 3 })
        assert.deepEqual(cpuMemory(present(cluster, snapshot)).map(metric => [metric.value, metric.source]),
            [['12Core', 'inventory'], ['24GiB', 'inventory']])
        const model = topologyNodePresentation(cluster, { name: cluster.data.Name, group: true, resourceData: snapshot })
        assert.deepEqual(cpuMemory(model), [], 'virtual groups keep their existing resource/status summaries')
    })

    it('keeps measured Node zero as actual utilization rather than an inventory fallback', () => {
        const worker = node('worker', 'node')
        const model = present(worker, { detail: { usage: { cpu: '0', memory: '0' }, allocatable: { cpu: '4', memory: '8Gi' } } })
        assert.deepEqual(cpuMemory(model).map(metric => [metric.value, metric.percent, metric.source]),
            [['0%', 0, 'usage'], ['0%', 0, 'usage']])
    })
})

    describe('Kubernetes dynamic card bounds', () => {
        it('shrinks only the hidden usage row while keeping long names aligned across mixed clusters', () => {
            for (const type of ['pod', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob']) {
                const short = node('short', type), long = node('very-long-workload-resource-name-'.repeat(4), type)
                const layouts = topologyLayerCardLayouts([{ node: short, kubernetesMetricsAvailable: false },
                    { node: long, kubernetesMetricsAvailable: true }])
                const compact = topologyNodePresentation(short, { name: short.data.Name, cardLayout: layouts.get(short.id) })
                const full = topologyNodePresentation(long, { name: long.data.Name, cardLayout: layouts.get(long.id), resourceData: resources({ metricsAvailable: true }) })
                assert.equal(compact.headerHeight, full.headerHeight, 'names retain a shared sufficient slot')
                assert.equal(full.height - compact.height, type === 'pod' ? 130 : 122)
                assert.equal(topologyCardDimensions(short, false, { cardLayout: layouts.get(short.id) }).height, compact.height)
                assert.equal(topologyCardDimensions(long, false, { cardLayout: layouts.get(long.id) }).height, full.height)
            }
        })

        it('uses the resized card height for ownership edges and namespace bounds', () => {
            const cluster = node('cluster', 'cluster'), ns = node('app', 'namespace', cluster)
            const workload = node('api', 'deployment', ns), pod = node('pod', 'pod', workload)
            const compact = present(pod), full = present(pod, resources({ metricsAvailable: true }))
            const source = { x: 0, y: 500, ...present(workload) }, target = { x: 0, y: 1000, ...compact }
            const edge = topologyCardEdge(source, target)
            assert.ok(edge.startsWith(`M0,${500 + source.height / 2}`))
            assert.ok(edge.endsWith(`0,${1000 - compact.height / 2}`))
            const regionNodes = [cluster, ns, workload, pod].map((resource, index) => ({
                id: resource.id, resourceID: resource.id, parentID: resource.parent?.id, manager: 'k8s',
                type: resource.data.Type, name: resource.data.Name, namespace: resource === cluster ? '' : 'app',
                visible: true, expanded: true, x: 0, y: index * 500,
                width: present(resource).width, height: present(resource).height, above: 40
            }))
            const smaller = kubernetesNamespaceRegions(regionNodes)[0]
            const larger = kubernetesNamespaceRegions(regionNodes.map(resource => resource.id === pod.id ? { ...resource, height: full.height } : resource))[0]
            assert.ok(smaller.bounds.bottom < larger.bounds.bottom)
            assert.ok(smaller.bounds.bottom >= regionNodes[3].y + compact.height / 2)
            assert.deepEqual(smaller.nodeIDs, larger.nodeIDs, 'membership/ownership is unchanged')
        })
    })
