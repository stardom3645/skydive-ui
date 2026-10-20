import { strict as assert } from 'assert'
import { evaluateKubernetesWorkload as evaluate } from '../src/KubernetesWorkloadStatus'
import { kubernetesResourceSelfStatus } from '../src/KubernetesTopologyBadgeAggregation'
import { Node } from '../src/Topology'

describe('canonical Kubernetes workload state (F02)', () => {
    const assess = (kind: string, spec: any, status: any, metadata: any = {}) => {
        const health = evaluate(kind, spec, status, metadata)
        const self = kubernetesResourceSelfStatus({ id: kind, data: { Manager: 'k8s', Type: kind,
            K8s: { Extra: { Spec: spec, Status: status, ObjectMeta: metadata } } } } as Node)
        assert.equal(self.state, health.tone === 'default' ? 'unknown' : health.findings.length ? 'problem' : 'healthy')
        return health
    }
    it('does not turn fully available replicas red because of a retained failure reason', () => {
        assert.equal(assess('deployment', { Replicas: 3 }, { AvailableReplicas: 3, UpdatedReplicas: 3,
            Conditions: [{ Type: 'Progressing', Status: 'False', Reason: 'ProgressDeadlineExceeded' }] }).tone, 'success')
    })
    it('distinguishes zero availability, partial availability, rollout and missing status', () => {
        assert.equal(assess('deployment', { replicas: 3 }, { availableReplicas: 0, updatedReplicas: 0 }).tone, 'danger')
        assert.equal(assess('deployment', { replicas: 3 }, { availableReplicas: 2, updatedReplicas: 2 }).tone, 'warning')
        assert.equal(assess('deployment', { replicas: 3 }, { availableReplicas: 3, updatedReplicas: 2 }).tone, 'info')
        assert.equal(assess('deployment', { replicas: 3 }, {}).tone, 'default')
    })
    it('waits for observedGeneration before interpreting old replica/condition evidence', () => {
        assert.equal(assess('deployment', { Replicas: 3 }, { ObservedGeneration: 7, AvailableReplicas: 0 }, { Generation: 8 }).tone, 'info')
        assert.equal(assess('deployment', { Replicas: 3 }, { ObservedGeneration: 8, AvailableReplicas: 0 }, { Generation: 8 }).tone, 'danger')
    })
    it('separates successful Job retries from terminal failure and running Jobs', () => {
        assert.equal(assess('job', { Completions: 1 }, { Succeeded: 1, Failed: 2, Active: 0 }).tone, 'success')
        assert.equal(assess('job', {}, { Failed: 2, Active: 1 }).tone, 'info')
        assert.equal(assess('job', {}, { Failed: 2, Active: 0 }).tone, 'warning')
        assert.equal(assess('job', {}, { Failed: 2, Conditions: [{ Type: 'Failed', Status: 'True' }] }).tone, 'danger')
        assert.equal(assess('job', {}, { Failed: 2, Conditions: [{ Type: 'Complete', Status: 'True' }] }).tone, 'success')
    })
    it('shares StatefulSet revision and DaemonSet placement evidence with topology', () => {
        const status = { ReadyReplicas: 3, CurrentReplicas: 3, UpdatedReplicas: 3, CurrentRevision: 'v2', UpdateRevision: 'v2' }
        assert.equal(assess('statefulset', { Replicas: 3 }, status).tone, 'success')
        assert.equal(assess('statefulset', { Replicas: 3 }, { ...status, CurrentRevision: 'v1', UpdatedReplicas: 2 }).tone, 'info')
        assert.equal(assess('daemonset', {}, { DesiredNumberScheduled: 3, NumberReady: 3, UpdatedNumberScheduled: 3 }).tone, 'success')
        assert.equal(assess('daemonset', {}, { DesiredNumberScheduled: 3, NumberReady: 2 }).tone, 'warning')
    })
})
