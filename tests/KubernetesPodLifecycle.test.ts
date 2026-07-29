import { strict as assert } from 'assert'
import { aggregatePods, getPodClassification } from '../src/KubernetesPodLifecycle'

const podNode = (
    id: string,
    phase: string,
    options: {
        reason?: string
        nodeName?: string
        ready?: boolean
        deleting?: boolean
        waitingReason?: string
    } = {}
): any => ({
    id,
    data: {
        Manager: 'k8s',
        Type: 'pod',
        Name: id,
        K8s: {
            Namespace: 'default',
            Extra: {
                ObjectMeta: {
                    UID: id,
                    ...(options.deleting ? { DeletionTimestamp: '2026-07-29T00:00:00Z' } : {})
                },
                Spec: { NodeName: options.nodeName || '' },
                Status: {
                    Phase: phase,
                    Reason: options.reason || '',
                    Conditions: options.ready === undefined ? [] : [{ Type: 'Ready', Status: options.ready ? 'True' : 'False' }],
                    ContainerStatuses: options.waitingReason
                        ? [{ State: { Waiting: { Reason: options.waitingReason } } }]
                        : []
                }
            }
        }
    }
})

describe('KubernetesPodLifecycle domain aggregation', () => {
    it('keeps Evicted history out of active Pod allocation and problems', () => {
        const pods: any[] = []
        for (let index = 0; index < 13; index++) {
            pods.push(podNode(`running-${index}`, 'Running', { nodeName: 'worker-1', ready: true }))
        }
        for (let index = 0; index < 248; index++) {
            pods.push(podNode(`evicted-${index}`, 'Failed', { nodeName: 'worker-1', reason: 'Evicted' }))
        }
        pods.push(
            podNode('succeeded', 'Succeeded', { nodeName: 'worker-1' }),
            podNode('failed', 'Failed', { nodeName: 'worker-1', reason: 'Error' }),
            podNode('deleting', 'Running', { nodeName: 'worker-1', deleting: true, ready: false })
        )

        const aggregate = aggregatePods(pods, { nodeName: 'worker-1' })
        assert.equal(aggregate.current, 13)
        assert.equal(aggregate.running, 13)
        assert.equal(aggregate.currentProblems, 0)
        assert.equal(aggregate.terminated, 251)
        assert.equal((aggregate.current / 110 * 100).toFixed(1), '11.8')
    })

    it('uses the same active rule for cluster and node scopes', () => {
        const pods = [
            podNode('running-1', 'Running', { nodeName: 'worker-1', ready: true }),
            podNode('pending-1', 'Pending', { nodeName: 'worker-2' }),
            podNode('pending-unscheduled', 'Pending'),
            podNode('evicted', 'Failed', { nodeName: 'worker-1', reason: 'Evicted' })
        ]
        const cluster = aggregatePods(pods)
        const worker1 = aggregatePods(pods, { nodeName: 'worker-1' })
        const worker2 = aggregatePods(pods, { nodeName: 'worker-2' })
        const unscheduled = cluster.activeEntries.filter(entry => !entry.node.data.K8s.Extra.Spec.NodeName).length

        assert.equal(cluster.current, 3)
        assert.equal(worker1.current + worker2.current + unscheduled, cluster.current)
    })

    it('classifies only actionable states on active Pods as current problems', () => {
        assert.equal(getPodClassification(podNode('pull', 'Running', {
            nodeName: 'worker-1',
            ready: true,
            waitingReason: 'ImagePullBackOff'
        })).problemPod, true)
        assert.equal(getPodClassification(podNode('evicted', 'Failed', {
            nodeName: 'worker-1',
            reason: 'Evicted'
        })).problemPod, false)
    })
})
