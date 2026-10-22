import { strict as assert } from 'assert'
import type { Node } from '../src/Topology'
import { currentProblems } from '../src/CurrentProblems'
import { problemCategory, problemEventIdentity, problemEvidence, problemScopeGroups, problemRelatedResources, problemPodCoverageNote } from '../src/ProblemAnalysis'

const node = (id: string, data: any): Node => ({ id, data: { Name: id, ...data }, tags: [], children: [], parent: null } as any)
const name = (node: Node) => String(node.data.Name)
const fallback = () => ({ kind: 'unknown', label: 'Unknown' })

describe('Problem analysis evidence and event identity', () => {
    it('uses recorder IDs, never names, and separates infrastructure and Kubernetes namespaces', () => {
        assert.deepEqual(problemEventIdentity(node('graph-a', { Type: 'device', Name: 'eno1', TID: 'host-a-nic' })),
            { resourceId: 'host-a-nic', resourceType: 'nic', source: 'infrastructure' })
        assert.notDeepEqual(problemEventIdentity(node('graph-a', { Type: 'device', Name: 'eno1', TID: 'host-a-nic' })),
            problemEventIdentity(node('graph-b', { Type: 'device', Name: 'eno1', TID: 'host-b-nic' })))
        assert.deepEqual(problemEventIdentity(node('graph-vm', { Type: 'libvirt', TID: 'tid', UUID: 'vm-uuid' })),
            { resourceId: 'vm-uuid', resourceType: 'vm', source: 'infrastructure' })
        assert.deepEqual(problemEventIdentity(node('graph-pod', { Type: 'pod', Manager: 'k8s', K8s: { UID: 'pod-uid' } })),
            { resourceId: 'pod-uid', resourceType: 'pod', source: 'kubernetes' })
        assert.deepEqual(problemEventIdentity(node('graph-node', { Type: 'node', Manager: 'k8s' })),
            { resourceId: 'graph-node', resourceType: 'k8s_node', source: 'kubernetes' })
        assert.equal(problemEventIdentity(node('same-name', { Type: 'host' })), undefined)
        assert.equal(problemEventIdentity(node('deployment', { Type: 'deployment', Manager: 'k8s', K8s: { UID: 'deployment-uid' } })), undefined)
    })
    it('retains zero Replica and false conditions without inventing missing counts or incident timestamps', () => {
        const evidence = problemEvidence(node('deployment', { Type: 'deployment', Manager: 'k8s', UpdatedAt: 1792551000000,
            K8s: { Extra: { ObjectMeta: { CreationTimestamp: '2026-10-01T00:00:00Z' },
                Spec: { Replicas: 3 }, Status: { Replicas: 0, ReadyReplicas: 0, Conditions: [{ Type: 'Available', Status: false, Reason: 'MinimumReplicasUnavailable' }] } } } }))
        assert.ok(evidence.some(fact => fact.label === 'Ready Replica' && fact.value === '0'))
        assert.ok(evidence.some(fact => fact.label === '희망 Replica' && fact.value === '3'))
        assert.ok(evidence.some(fact => fact.label === 'Condition · Available' && fact.value === 'false\nMinimumReplicasUnavailable'))
        assert.ok(evidence.some(fact => fact.value.includes('MinimumReplicasUnavailable')))
        assert.equal(evidence.some(fact => fact.label === '가용 Replica'), false)
        assert.equal(evidence.some(fact => /시각|발생|지속|복구/.test(fact.label)), false)
    })
    it('shows Pod waiting evidence, zero restarts and actual false readiness', () => {
        const evidence = problemEvidence(node('pod', { Type: 'pod', Manager: 'k8s', K8s: { Extra: {
            Spec: { NodeName: 'worker-1' }, Status: { Phase: 'Running', ContainerStatuses: [
                { Name: 'web', Ready: false, RestartCount: 0, State: { Waiting: { Reason: 'ImagePullBackOff', Message: 'image not found' } } }
            ] }
        } } }))
        for (const value of ['worker-1', 'false', '0', 'ImagePullBackOff', 'image not found']) assert.ok(evidence.some(fact => fact.value === value), value)
    })
    it('puts Pod readiness and Node Condition results ahead of detailed messages, separate from container readiness', () => {
        const pod = problemEvidence(node('pod-ready-condition', { Type: 'pod', Manager: 'k8s', K8s: { Extra: { Status: {
            Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }], ContainerStatuses: [{ Name: 'app', Ready: true }]
        } } } }))
        assert.ok(pod.some(fact => fact.label === 'Pod Ready' && fact.value === 'false'))
        assert.ok(pod.some(fact => fact.label === 'app · Ready' && fact.value === 'true'))
        const worker = problemEvidence(node('node-ready', { Type: 'node', Manager: 'k8s', K8s: { Extra: { Status: {
            Conditions: [{ Type: 'Ready', Status: 'Unknown', Reason: 'NodeStatusUnknown', Message: 'Kubelet stopped posting node status.' }]
        } } } }))
        assert.ok(worker.some(fact => fact.label === 'Ready Condition' && fact.value === 'Unknown'))
        assert.ok(worker.some(fact => fact.label === 'Condition · Ready' && fact.value.includes('Kubelet stopped')))
    })
    it('keeps collection failure distinct from workload and groups identical scope names by domain', () => {
        const nodes = [node('host-bad', { Type: 'host', Name: 'same-scope', State: 'failed' }),
            node('missing', { Type: 'host', Name: 'same-scope', State: 'UP', CollectionState: 'failed' }),
            node('worker-bad', { Type: 'node', Manager: 'k8s', State: 'Error', ClusterName: 'same-scope' })]
        const entries = currentProblems(nodes, [], name, fallback)
        assert.equal(problemCategory(entries.find(entry => entry.id === 'missing')!), 'collection')
        const groups = problemScopeGroups(entries)
        assert.equal(groups.length, 2)
        assert.equal(groups[0].entries.length, 2)
        assert.notEqual(groups[0].key, groups[1].key)
        assert.equal(groups.reduce((count, group) => count + group.entries.length, 0), entries.length)
    })
    it('connects workload problems to current owned Pods through ReplicaSet UID without cross-cluster name matches', () => {
        const resource = (id: string, type: string, owners: any[] = [], cluster = 'cluster-a') => node(id, {
            Type: type, Manager: 'k8s', ClusterName: cluster, K8s: { UID: id, Namespace: 'app', Extra: {
                ObjectMeta: { UID: id, Namespace: 'app', OwnerReferences: owners },
                Spec: { Replicas: 1 }, Status: type === 'pod' ? { Phase: 'Running' } : { Replicas: 1, AvailableReplicas: 0 }
            } }
        })
        const deployment = resource('deployment-uid', 'deployment')
        const rs = resource('rs-uid', 'replicaset', [{ Kind: 'Deployment', UID: deployment.id, Controller: true }])
        const pod = resource('pod-a', 'pod', [{ Kind: 'ReplicaSet', UID: rs.id, Controller: true }])
        const foreign = resource('pod-b', 'pod', [{ Kind: 'ReplicaSet', UID: rs.id, Controller: true }], 'cluster-b')
        const finished = resource('pod-finished', 'pod', [{ Kind: 'ReplicaSet', UID: rs.id, Controller: true }])
        finished.data.K8s.Extra.Status.Phase = 'Succeeded'
        const nodes = [deployment, rs, pod, foreign, finished]
        const entries = currentProblems(nodes, [], name, fallback)
        const related = problemRelatedResources(entries.find(entry => entry.id === deployment.id)!, nodes)
        assert.deepEqual(related.map(relation => [relation.node.id, relation.relation]), [['rs-uid', '소유 ReplicaSet'], ['pod-a', '소유 파드']])
        assert.equal(entries.some(entry => entry.id === finished.id), false)
    })

    it('keeps API Replica counts independent from unverified Pod ownership and never guesses by Pod name', () => {
        const deployment = node('deployment', { Type: 'deployment', Manager: 'k8s', ClusterName: 'a', K8s: { Namespace: 'app', Extra: {
            Spec: { Replicas: 2 }, Status: { Replicas: 2, ReadyReplicas: 0, AvailableReplicas: 0, UpdatedReplicas: 2 }
        } } })
        const pod = node('api-hash-pod', { Type: 'pod', Manager: 'k8s', ClusterName: 'a', K8s: { Namespace: 'app', Extra: {
            ObjectMeta: { OwnerReferences: [{ Kind: 'ReplicaSet', UID: 'missing-rs', Name: 'api-hash' }] }, Status: { Phase: 'Running' }
        } } })
        const nodes = [deployment, pod]
        const values = new Map(problemEvidence(deployment, nodes).map(fact => [fact.label, fact.value]))
        assert.equal(values.get('희망 Replica'), '2')
        assert.equal(values.get('현재 Replica'), '2')
        assert.equal(values.get('Ready Replica'), '0')
        assert.equal(values.get('가용 Replica'), '0')
        assert.equal(values.get('소유 관계로 확인된 현재 Pod'), '관계 미확인 · 확인된 0개')
        assert.ok(problemPodCoverageNote(deployment, nodes)!.includes('실제 Pod가 없다는 뜻이 아닙니다'))
        const entry = currentProblems(nodes, [], name, fallback).find(item => item.id === deployment.id)!
        assert.deepEqual(problemRelatedResources(entry, nodes), [])
    })
    it('follows exact Pod placement in the same cluster and removes deleted relationship targets', () => {
        const pod = node('pod', { Type: 'pod', Manager: 'k8s', ClusterName: 'a', K8s: { Extra: { Spec: { NodeName: 'worker' }, Status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }] } } } })
        const worker = node('worker-id', { Type: 'node', Name: 'worker', Manager: 'k8s', ClusterName: 'a' })
        const foreign = node('foreign', { ...worker.data, ClusterName: 'b' })
        const deleted = node('deleted', { Type: 'host' })
        const entry = currentProblems([pod], [], name, fallback)[0]
        entry.related = [deleted]
        assert.deepEqual(problemRelatedResources(entry, [pod, worker, foreign]).map(item => [item.node.id, item.relation]), [['worker-id', '배치 노드']])
        assert.deepEqual(problemRelatedResources(entry, [pod]), [])
    })

})
