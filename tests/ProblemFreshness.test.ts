import { strict as assert } from 'assert'
import type { Node } from '../src/Topology'
import { getPodClassification, kubernetesPodCurrentStatusSnapshot, registerKubernetesPodCurrentStatusSnapshots, KUBERNETES_POD_SNAPSHOT_MAX_AGE_MS } from '../src/KubernetesPodLifecycle'
import { evaluateKubernetesWorkload } from '../src/KubernetesWorkloadStatus'

const pod = (uid: string, ready: boolean): Node => ({ id: uid, data: { Manager: 'k8s', Type: 'pod', K8s: { UID: uid, Extra: {
    Status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: ready ? 'True' : 'False' }] }
} } }, tags: [], children: [], parent: null } as any)

describe('Problem freshness and rollout regression', () => {
    it('expires detail overrides so a closed panel cannot retain a recovered or obsolete Pod verdict forever', () => {
        for (const ready of [true, false]) {
            const node = pod(`snapshot-expiry-${ready}`, ready), now = Date.now()
            registerKubernetesPodCurrentStatusSnapshots([{ uid: node.id, phase: 'Running', ready: !ready, problem: ready, observedAt: new Date(now).toISOString() }])
            assert.equal(getPodClassification(node).problemPod, ready)
            assert.equal(kubernetesPodCurrentStatusSnapshot(node, now + KUBERNETES_POD_SNAPSHOT_MAX_AGE_MS), undefined)
            assert.equal(getPodClassification(node).problemPod, !ready)
        }
    })
    it('rejects missing, invalid and expired snapshot times and preserves the newer observation', () => {
        const node = pod('invalid-snapshot-time', true)
        for (const observedAt of [undefined, 'invalid', new Date(Date.now() - 120000).toISOString()]) {
            registerKubernetesPodCurrentStatusSnapshots([{ uid: node.id, ready: false, problem: true, observedAt }])
            assert.equal(getPodClassification(node).problemPod, false)
        }
        registerKubernetesPodCurrentStatusSnapshots([{ uid: node.id, ready: true, problem: false, observedAt: new Date().toISOString() }])
        registerKubernetesPodCurrentStatusSnapshots([{ uid: node.id, ready: false, problem: true, observedAt: new Date(Date.now() - 1000).toISOString() }])
        assert.equal(getPodClassification(node).problemPod, false)
    })
    it('keeps existing generation, rollout failure, scaled-to-zero and recovery rules', () => {
        assert.equal(evaluateKubernetesWorkload('deployment', { Replicas: 2 }, { AvailableReplicas: 0, ObservedGeneration: 3 }, { Generation: 4 }).tone, 'info')
        assert.equal(evaluateKubernetesWorkload('deployment', { Replicas: 2 }, { Replicas: 2, AvailableReplicas: 0, ReadyReplicas: 0 }).tone, 'danger')
        assert.equal(evaluateKubernetesWorkload('deployment', { Replicas: 0 }, { Replicas: 0, AvailableReplicas: 0, UpdatedReplicas: 0 }).tone, 'success')
        const failure = [{ Type: 'Progressing', Status: 'False', Reason: 'ProgressDeadlineExceeded' }]
        assert.equal(evaluateKubernetesWorkload('deployment', { Replicas: 2 }, { AvailableReplicas: 1, Conditions: failure }).tone, 'danger')
        assert.equal(evaluateKubernetesWorkload('deployment', { Replicas: 2 }, { AvailableReplicas: 2, UpdatedReplicas: 2, UnavailableReplicas: 0, Conditions: failure }).tone, 'success')
    })
})
