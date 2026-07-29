import { strict as assert } from 'assert'
import { aggregateKubernetesDetail } from '../src/KubernetesDetailAggregation'

const node = (id: string, type: string, extra: any = {}): any => ({
    id,
    data: {
        Manager: 'k8s',
        Type: type,
        Name: id,
        K8s: {
            Namespace: 'default',
            Extra: {
                ObjectMeta: { UID: id, Namespace: 'default', ...(extra.ObjectMeta || {}) },
                Spec: extra.Spec || {},
                Status: extra.Status || {}
            }
        }
    }
})

describe('KubernetesDetailAggregation', () => {
    it('uses final Deployment UID once for multiple active Pods', () => {
        const deployment = node('deployment-uid', 'deployment', {
            Spec: { Replicas: 1, Selector: { MatchLabels: { app: 'web' } } }
        })
        const replicaSet = node('replicaset-uid', 'replicaset', {
            ObjectMeta: {
                OwnerReferences: [{ UID: 'deployment-uid', Kind: 'Deployment', Name: 'deployment-uid', Controller: true }]
            }
        })
        const pod = (id: string, phase: string) => node(id, 'pod', {
            ObjectMeta: {
                Labels: { app: 'web' },
                OwnerReferences: [{ UID: 'replicaset-uid', Kind: 'ReplicaSet', Name: 'deployment-uid-abc', Controller: true }]
            },
            Spec: { NodeName: 'worker-1' },
            Status: {
                Phase: phase,
                Conditions: [{ Type: 'Ready', Status: phase === 'Running' ? 'True' : 'False' }]
            }
        })
        const aggregate = aggregateKubernetesDetail([
            deployment,
            replicaSet,
            pod('current-a', 'Running'),
            pod('current-b', 'Pending'),
            pod('evicted-old', 'Failed')
        ], { nodeName: 'worker-1' })

        assert.equal(aggregate.pods.active, 2)
        assert.equal(aggregate.workloadControllers.length, 1)
        assert.equal(aggregate.workloadControllers[0].id, 'deployment-uid')
        assert.equal(aggregate.workloadPodCounts.get('deployment-uid'), 2)
    })
})

