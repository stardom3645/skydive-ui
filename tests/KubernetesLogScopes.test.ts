import { strict as assert } from 'assert'
import { kubernetesLogCluster, kubernetesPodLogTarget, kubernetesResourceLogPods } from '../src/KubernetesLogScopes'

const node = (id: string, type: string, parent?: any, data: any = {}): any => ({ id, parent, data: {
    Type: type, Manager: 'k8s', Name: id, ...data
} })
const pod = (id: string, parent: any, namespace: string, nodeName = 'worker'): any => node(id, 'pod', parent, {
    K8s: { Namespace: namespace, Extra: { ObjectMeta: { UID: id }, Spec: { NodeName: nodeName, Containers: [{ Name: 'app' }] } } }
})
const ids = (nodes: any[]) => nodes.map(n => n.id)

describe('Kubernetes logs from resource scopes', () => {
    it('keeps equal namespace/Pod names in different clusters separate and never reads Infrastructure/group proxies', () => {
        const a = node('cluster-a-id', 'cluster', undefined, { Name: 'same-cluster-name' })
        const b = node('cluster-b-id', 'cluster', undefined, { Name: 'same-cluster-name' })
        const nsA = node('ns-a', 'namespace', a, { Name: 'default' }), nsB = node('ns-b', 'namespace', b, { Name: 'default' })
        const pa = pod('a', nsA, 'default'), pb = pod('b', nsB, 'default')
        pa.data.Name = pb.data.Name = 'web-0'
        const infra = node('infra', 'pod', a, { Manager: 'libvirt' }), group = node('group', 'pod', a, { IsTopologyGroup: true })
        const nodes = [a, b, nsA, nsB, pa, pb, infra, group]
        const before = JSON.stringify(nodes)
        assert.deepEqual(ids(kubernetesResourceLogPods(a, nodes)), ['a'])
        assert.deepEqual(ids(kubernetesResourceLogPods(nsB, nodes)), ['b'])
        assert.deepEqual(kubernetesResourceLogPods(infra, nodes), [])
        assert.equal(JSON.stringify(nodes), before)
    })
    it('uses namespace membership and scheduled node metadata, including completed/terminating Pods still in inventory', () => {
        const cluster = node('cluster', 'cluster'), ns = node('ns', 'namespace', cluster, { Name: 'app' })
        const worker = node('worker', 'node', cluster), other = pod('other-namespace', cluster, 'other')
        const active = pod('active', ns, 'app'), complete = pod('complete', ns, 'app'), pending = pod('pending', ns, 'app', '')
        complete.data.K8s.Extra.Status = { Phase: 'Succeeded' }
        complete.data.K8s.Extra.ObjectMeta.DeletionTimestamp = '2026-10-15T01:00:00Z'
        const nodes = [cluster, ns, worker, active, complete, pending, other, { ...active, id: 'duplicate' }]
        assert.deepEqual(ids(kubernetesResourceLogPods(ns, nodes)), ['active', 'complete', 'pending'])
        assert.deepEqual(ids(kubernetesResourceLogPods(worker, nodes)), ['active', 'complete', 'other-namespace'])
    })
    it('follows Deployment/ReplicaSet and CronJob/Job ownership instead of label coincidence', () => {
        const cluster = node('cluster', 'cluster'), ns = node('ns', 'namespace', cluster, { Name: 'app' })
        const meta = (kind: string, name: string, uid = name) => ({ Kind: kind, Name: name, UID: uid })
        const deployment = node('deploy', 'deployment', ns)
        const rs = node('rs', 'replicaset', ns, { K8s: { Namespace: 'app', Extra: { ObjectMeta: { OwnerReferences: [meta('Deployment', 'deploy')] } } } })
        const cron = node('cron', 'cronjob', ns), job = node('job', 'job', ns, {
            K8s: { Namespace: 'app', Extra: { ObjectMeta: { OwnerReferences: [meta('CronJob', 'cron')] } } }
        })
        const dp = pod('deployment-pod', ns, 'app'), jp = pod('job-pod', ns, 'app'), unrelated = pod('unrelated', ns, 'app')
        dp.data.K8s.Extra.ObjectMeta.OwnerReferences = [meta('ReplicaSet', 'rs')]
        jp.data.K8s.Extra.ObjectMeta.OwnerReferences = [meta('Job', 'job')]
        const crossNamespace = pod('cross-namespace', cluster, 'different')
        crossNamespace.data.K8s.Extra.ObjectMeta.OwnerReferences = [meta('ReplicaSet', 'rs')]
        const nodes = [cluster, ns, deployment, rs, cron, job, dp, jp, unrelated, crossNamespace]
        assert.deepEqual(ids(kubernetesResourceLogPods(deployment, nodes)), ['deployment-pod'])
        assert.deepEqual(ids(kubernetesResourceLogPods(job, nodes)), ['job-pod'])
        assert.deepEqual(ids(kubernetesResourceLogPods(cron, nodes)), ['job-pod'])
        for (const type of ['daemonset', 'statefulset']) {
            const owner = node(type, type, ns), child = pod(`${type}-pod`, owner, 'app')
            assert.deepEqual(ids(kubernetesResourceLogPods(owner, [...nodes, owner, child])), [child.id])
        }
    })
    it('requires cluster evidence for detached inventory and prefers cluster IDs over ambiguous names', () => {
        const scope = node('ns', 'namespace', undefined, { Name: 'default', ClusterID: 'a', ClusterName: 'cluster' })
        const a = pod('a-pod', undefined, 'default'), b = pod('b-pod', undefined, 'default'), unknown = pod('unknown', undefined, 'default')
        Object.assign(a.data, { ClusterID: 'a', ClusterName: 'cluster' })
        Object.assign(b.data, { ClusterID: 'b', ClusterName: 'cluster' })
        assert.deepEqual(ids(kubernetesResourceLogPods(scope, [a, b, unknown])), ['a-pod'])
        const catalogue = [{ id: 'a', name: 'cluster' }, { id: 'b', name: 'cluster' }]
        assert.strictEqual(kubernetesLogCluster(scope, catalogue), catalogue[0])
        assert.equal(kubernetesLogCluster(node('x', 'namespace', undefined, { ClusterName: 'cluster' }), catalogue), undefined)
        assert.equal(kubernetesLogCluster(scope, []), undefined)
    })
    it('extracts only actual container names across spec/status variants without inventing missing containers', () => {
        const p = pod('p', undefined, 'app')
        p.data.K8s.Extra.Spec.InitContainers = [{ Name: 'prepare' }]
        p.data.K8s.Extra.Spec.EphemeralContainers = [{ Name: 'debug' }]
        p.data.K8s.Extra.Status = { ContainerStatuses: [{ Name: 'app' }, { Name: 'sidecar' }] }
        assert.deepEqual(kubernetesPodLogTarget(p), { uid: 'p', name: 'p', namespace: 'app', containers: [
            { name: 'app', type: 'APPLICATION' }, { name: 'prepare', type: 'INIT' },
            { name: 'debug', type: 'EPHEMERAL' }, { name: 'sidecar', type: 'APPLICATION' }
        ] })
        assert.deepEqual(kubernetesPodLogTarget(node('missing', 'pod')).containers, [])
    })
})
