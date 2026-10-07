import { strict as assert } from 'assert'
import { topologyCardDimensions, topologyNodePresentation } from '../src/TopologyNodePresentation'
import { kubernetesResourceSelfStatus, kubernetesTopologyDirectChildSummary } from '../src/KubernetesTopologyBadgeAggregation'
import { topologyCardEdge, topologyHierarchyEdgeIDs } from '../src/TopologyEdgePresentation'

const resource = (id: string, type: string, extra: any = {}): any => ({
    id, children: [], parent: null, state: { expanded: true },
    data: { Name: id, Type: type, Manager: 'k8s', K8s: { Extra: { ObjectMeta: { UID: id }, ...extra } } }
})
const attach = (parent: any, child: any) => { parent.children.push(child); child.parent = parent; return child }
const present = (node: any, options: any = {}) => topologyNodePresentation(node, { name: node.data.Name, ...options })

describe('Topology object presentation', () => {
    it('uses three card tiers independently from a long name', () => {
        const cluster = resource('cluster', 'cluster'), worker = resource('worker', 'node')
        const pvc = resource('very-long-volume-name-'.repeat(20), 'persistentvolumeclaim')
        assert.equal(present(cluster).size, 'large')
        assert.equal(present(worker).size, 'medium')
        assert.equal(present(pvc).size, 'compact')
        assert.equal(present(pvc).name, pvc.data.Name)
        assert.ok(present(cluster).width > present(worker).width && present(worker).width > present(pvc).width)
    })
    it('does not invent usage percentages, and preserves a measured zero', () => {
        const node = resource('worker', 'node')
        assert.deepEqual(present(node).metrics.map(metric => [metric.value, metric.percent]), [['미수집', undefined], ['미수집', undefined]])
        Object.assign(node.data, { CPUUsagePercent: 0, MemoryUsagePercent: 48, PodCount: 0 })
        assert.deepEqual(present(node).metrics.map(metric => [metric.value, metric.percent]), [['0%', 0], ['48%', 48], ['0', undefined]])
        node.data.CPUUsagePercent = 800
        assert.equal(present(node).metrics[0].value, '미수집')
    })
    it('preserves full infrastructure names and configured operator labels', () => {
        const host = resource('host', 'host'); host.data.Manager = 'fabric'
        host.data.Name = 'able-infrastructure-host-with-a-long-name'
        assert.equal(present(host, { name: `${host.data.Name.slice(0, 24)}.` }).name, host.data.Name)
        assert.equal(present(host, { name: '운영 호스트' }).name, '운영 호스트')
    })
    it('keeps workload availability distinct from desired replicas and missing readiness', () => {
        const workload = resource('api', 'deployment', { Spec: { Replicas: 3 }, Status: { ReadyReplicas: 2 } })
        assert.equal(present(workload).metrics.find(metric => metric.key === 'replicas')!.value, '2/3')
        delete workload.data.K8s.Extra.Status.ReadyReplicas
        assert.equal(present(workload).metrics.find(metric => metric.key === 'replicas')!.value, '–/3')
    })
    it('uses the existing self status instead of turning absent collection healthy', () => {
        const node = resource('node', 'node'); node.data.CollectionState = 'unavailable'
        assert.equal(kubernetesResourceSelfStatus(node).collection, 'unavailable')
        assert.equal(present(node).status.tone, 'unknown')
        const cluster = resource('stopped', 'cluster'); cluster.data.MoldClusterState = 'Stopped'
        assert.equal(present(cluster).status.tone, 'inactive')
    })
    it('retains direct-child grouping, including an incident one level deeper', () => {
        const namespace = resource('namespace', 'namespace', { Status: { Phase: 'Active' } })
        const good = attach(namespace, resource('api', 'deployment', { Spec: { Replicas: 1 }, Status: { ReadyReplicas: 1, AvailableReplicas: 1 } }))
        attach(good, resource('bad-pod', 'pod', { Status: { Phase: 'Running', ContainerStatuses: [{ State: { Waiting: { Reason: 'CrashLoopBackOff' } } }] } }))
        attach(namespace, resource('web', 'deployment', { Spec: { Replicas: 1 }, Status: { ReadyReplicas: 1, AvailableReplicas: 1 } }))
        const canonical = kubernetesTopologyDirectChildSummary(namespace)
        const model = present(namespace)
        assert.equal(model.group, true)
        assert.equal(model.children!.total, canonical.total)
        assert.equal(model.children!.total, 2)
        assert.equal(model.children!.warning, canonical.attentionRequired.length + canonical.descendantProblematic.length)
        assert.equal(model.children!.normal, canonical.healthy.length)
        assert.deepEqual(topologyCardDimensions(namespace), { size: 'medium', width: model.width, height: model.height })
    })
    it('counts unique collected resources for a collapsed cluster without changing the graph', () => {
        const cluster = resource('cluster', 'cluster'); cluster.state.expanded = false
        attach(cluster, resource('worker', 'node'))
        const namespace = attach(cluster, resource('namespace', 'namespace'))
        attach(namespace, resource('api', 'deployment'))
        attach(namespace, resource('volume-a', 'persistentvolumeclaim'))
        const duplicate = attach(namespace, resource('volume-alias', 'persistentvolumeclaim'))
        duplicate.data.K8s.Extra.ObjectMeta.UID = 'volume-a'
        const metrics = present(cluster).metrics
        assert.deepEqual(metrics.map(metric => metric.value), ['1', '1', '1', '1'])
        assert.equal(cluster.state.expanded, false)
        assert.equal(namespace.children.length, 3)
    })
    it('preserves full storage context and does not fabricate endpoint traffic', () => {
        const pvc = resource('data', 'persistentvolumeclaim', { Status: { Capacity: { storage: '120Gi' } } })
        pvc.data.K8s.Namespace = 'long-namespace-name'
        assert.equal(present(pvc).subtitle, 'PVC · long-namespace-name')
        assert.equal(present(pvc).metrics[0].value, '120Gi')
        assert.deepEqual(present(resource('svc', 'service')).metrics, [])
    })
    it('formats collected Kubernetes quantity objects instead of object placeholders', () => {
        const pvc = resource('data', 'persistentvolumeclaim', { Status: { Capacity: { storage: { String: '120Gi' } } } })
        assert.equal(present(pvc).metrics[0].value, '120Gi')
        pvc.data.K8s.Extra.Status.Capacity.storage = { unrecognized: true }
        assert.equal(present(pvc).metrics[0].value, '확인 불가')
        delete pvc.data.K8s.Extra.Status.Capacity.storage
        assert.deepEqual(present(pvc).metrics, [])
    })
})

describe('Topology card edge endpoints', () => {
    it('emphasizes the complete visible relation across skipped-level spacers', () => {
        const parent: any = { id: 'cluster', children: [] }, hidden: any = { id: 'spacer', hidden: true, parent, children: [] }
        const child: any = { id: 'namespace', parent: hidden, children: [] }
        parent.children = [hidden]; hidden.children = [child]
        const access = { id: (node: any) => node.id, hidden: (node: any) => !!node.hidden, parent: (node: any) => node.parent, children: (node: any) => node.children }
        const expected = { source: 'cluster', targets: ['namespace'] }
        assert.deepEqual(topologyHierarchyEdgeIDs(parent, hidden, access), expected)
        assert.deepEqual(topologyHierarchyEdgeIDs(hidden, child, access), expected)
    })
    it('anchors hierarchy curves at the actual bottom/top card boundaries', () => {
        const source = { x: 0, y: 0, width: 420, height: 156 }, target = { x: 200, y: 216, width: 340, height: 140 }
        const before = JSON.stringify([source, target])
        const path = topologyCardEdge(source, target, true)
        assert.ok(path.startsWith('M0,78') && path.endsWith('V146'))
        assert.equal(JSON.stringify([source, target]), before)
    })
    it('connects same-level neighbors at their side borders', () => {
        assert.equal(topologyCardEdge({ x: 0, y: 0, width: 280, height: 112 }, { x: 600, y: 0, width: 340, height: 140 }), 'M140,0 C285,0 285,0 430,0')
    })
    it('routes upward relationships without clipping into the source card', () => {
        const path = topologyCardEdge({ x: 0, y: 216, width: 280, height: 112 }, { x: 0, y: 0, width: 420, height: 156 })
        assert.ok(path.startsWith('M0,160') && path.endsWith('0,78'))
    })
})
