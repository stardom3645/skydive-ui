import { strict as assert } from 'assert'
import { kubernetesControllerPodObservation, resolveKubernetesPodController } from '../src/KubernetesWorkloadOwnership'
import { topologyNodePresentation } from '../src/TopologyNodePresentation'
import { compareKubernetesResourceVersions } from '../src/KubernetesResourceVersion'
import { currentProblems } from '../src/CurrentProblems'
import { kubernetesResourceSelfStatus } from '../src/KubernetesTopologyBadgeAggregation'

const node = (id: string, type: string, status: any = {}, owners: any[] = [], cluster = 'cluster-a'): any => ({ id,
    data: { Name: id, Manager: 'k8s', Type: type, ClusterName: cluster, K8s: { UID: id, Namespace: 'app', Extra: {
        ObjectMeta: { UID: id, OwnerReferences: owners }, Spec: { Replicas: 2 }, Status: status
    } } }, children: [], parent: null, state: { expanded: true }, tags: [] })
const owner = (uid: string, Kind: string) => ({ UID: uid, Kind, Controller: true })
const name = (node: any) => node.data.Name
const fallback = () => ({ kind: 'unknown', label: 'Unknown' })
const count = (deployment: any, nodes: any[]) => topologyNodePresentation(deployment, { name: deployment.id, allNodes: nodes }).metrics.find(metric => metric.key === 'pods')!.value

describe('Kubernetes relationship coverage and version guarantees', () => {
    it('shows unknown relationship, not Pod zero, when the ReplicaSet collector is omitted', () => {
        const deployment = node('deployment', 'deployment', { Replicas: 2, ReadyReplicas: 0, AvailableReplicas: 0 })
        const pod = node('deployment-hash-pod', 'pod', { Phase: 'Running' }, [owner('missing-rs', 'ReplicaSet')])
        assert.equal(count(deployment, [deployment, pod]), '관계 미확인')
        assert.equal(resolveKubernetesPodController(pod, [deployment, pod]), undefined)
        assert.equal(kubernetesResourceSelfStatus(deployment).state, 'problem')
    })
    it('resolves a collected UID owner chain, counts current Pods, and preserves legitimate zero', () => {
        const deployment = node('deployment', 'deployment', { Replicas: 2, AvailableReplicas: 0 })
        const rs = node('rs', 'replicaset', {}, [owner(deployment.id, 'Deployment')])
        const a = node('a', 'pod', { Phase: 'Running' }, [owner(rs.id, 'ReplicaSet')])
        const b = node('b', 'pod', { Phase: 'Pending' }, [owner(rs.id, 'ReplicaSet')])
        const done = node('done', 'pod', { Phase: 'Succeeded' }, [owner(rs.id, 'ReplicaSet')])
        const foreign = node('foreign', 'pod', { Phase: 'Running' }, [owner(rs.id, 'ReplicaSet')], 'cluster-b')
        const nodes = [deployment, rs, a, b, done, foreign]
        deployment.children = [a, b, done]
        assert.equal(resolveKubernetesPodController(a, nodes)?.id, deployment.id)
        assert.equal(count(deployment, nodes), '2')
        deployment.children = [done]
        deployment.data.K8s.Extra.Status.Replicas = 0
        assert.equal(count(deployment, [deployment, rs, done]), '0')
        assert.equal(kubernetesControllerPodObservation(deployment, [deployment, rs, done]).complete, true)
        deployment.children = [a]
        deployment.data.K8s.Extra.Status.Replicas = 2
        assert.equal(count(deployment, [deployment, rs, a]), '관계 미확인')
    })
    it('does not let a detail success flag override a stale or failed source marker', () => {
        const pod = node('collection-precedence', 'pod', { Phase: 'Running' })
        for (const status of ['stale', 'failed']) {
            pod.data.K8s.CollectionStatus = status
            const result = kubernetesResourceSelfStatus(pod, { collectionState: 'collected' })
            assert.equal(result.state, 'unknown')
            assert.equal(result.collection, status === 'stale' ? 'stale' : 'unavailable')
            assert.equal(currentProblems([pod], [], name, fallback)[0].status, 'unavailable')
        }
        pod.data.K8s.CollectionStatus = 'active'
        assert.equal(currentProblems([pod], [], name, fallback).length, 0)
    })
    it('orders arbitrary precision decimal versions only under a known 1.35+ server contract', () => {
        assert.equal(compareKubernetesResourceVersions('100', '99', 'v1.35.9'), 1)
        assert.equal(compareKubernetesResourceVersions('99', '100', '1.37.1-Mold'), -1)
        assert.equal(compareKubernetesResourceVersions('100000000000000000000000000001', '100000000000000000000000000000', '1.36.5'), 1)
        for (const version of [undefined, '1.34.12', 'unknown']) assert.equal(compareKubernetesResourceVersions('100', '99', version), undefined)
        for (const token of ['opaque-x', '0100', '0', '', '100.1', '-1']) assert.equal(compareKubernetesResourceVersions(token, '99', '1.35.9'), undefined)
        assert.equal(compareKubernetesResourceVersions('opaque-x', 'opaque-x'), 0)
    })
    it('quarantines incomparable conflicting copies and never compares different UIDs or clusters', () => {
        const a = node('version-a', 'deployment', { Replicas: 2, AvailableReplicas: 0 })
        a.data.K8s.Extra.ObjectMeta.ResourceVersion = '99'
        const b = node('version-b', 'deployment', { Replicas: 2, AvailableReplicas: 2 })
        b.data.K8s.UID = b.data.K8s.Extra.ObjectMeta.UID = a.id
        b.data.K8s.Extra.ObjectMeta.ResourceVersion = '100'
        for (const nodes of [[a, b], [b, a]]) {
            const entries = currentProblems(nodes, [], name, fallback)
            assert.equal(entries.length, 1); assert.equal(entries[0].status, 'unavailable')
        }
        b.data.ClusterName = 'other'
        assert.equal(currentProblems([a, b], [], name, fallback).length, 1)
        b.data.ClusterName = 'cluster-a'; b.data.K8s.UID = b.data.K8s.Extra.ObjectMeta.UID = b.id
        assert.equal(currentProblems([a, b], [], name, fallback)[0].id, a.id)
    })
})
