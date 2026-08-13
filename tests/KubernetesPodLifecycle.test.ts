import { strict as assert } from 'assert'
import {
    aggregatePods,
    getPodClassification,
    kubernetesPodReady,
    registerKubernetesPodCurrentStatusSnapshots
} from '../src/KubernetesPodLifecycle'

const podNode = (
    id: string,
    phase: string,
    options: {
        reason?: string
        nodeName?: string
        ready?: boolean
        deleting?: boolean
        waitingReason?: string
        restartCount?: number
        lastTerminatedReason?: string
        namespace?: string
    } = {}
): any => ({
    id,
    data: {
        Manager: 'k8s',
        Type: 'pod',
        Name: id,
        K8s: {
            Namespace: options.namespace || 'default',
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
                        ? [{
                            RestartCount: options.restartCount || 0,
                            State: { Waiting: { Reason: options.waitingReason } },
                            LastTerminationState: options.lastTerminatedReason
                                ? { Terminated: { Reason: options.lastTerminatedReason } }
                                : undefined
                        }]
                        : options.restartCount || options.lastTerminatedReason
                            ? [{
                                RestartCount: options.restartCount || 0,
                                LastTerminationState: options.lastTerminatedReason
                                    ? { Terminated: { Reason: options.lastTerminatedReason } }
                                    : undefined
                            }]
                            : []
                }
            }
        }
    }
})

describe('KubernetesPodLifecycle domain aggregation', () => {
    it('prefers the latest API readiness snapshot over stale topology state', () => {
        const pod = podNode('dashboard-ready-api', 'Running', { ready: false })
        registerKubernetesPodCurrentStatusSnapshots([{
            uid: 'dashboard-ready-api',
            phase: 'Running',
            ready: true,
            problem: false,
            observedAt: '2026-08-10T12:00:00Z'
        }])
        const classification = getPodClassification(pod)
        const aggregate = aggregatePods([pod])
        assert.equal(classification.runningPod, true)
        assert.equal(classification.problemPod, false)
        assert.equal(aggregate.running, 1)
        assert.equal(aggregate.currentProblems, 0)
    })

    it('uses only application container readiness when Ready Condition is absent', () => {
        const data = podNode('container-ready-fallback', 'Running').data
        data.K8s.Extra.Status.InitContainerStatuses = [{ Ready: false, State: { Terminated: { Reason: 'Completed' } } }]
        data.K8s.Extra.Status.ContainerStatuses = [{ Ready: true, State: { Running: {} } }]
        assert.equal(kubernetesPodReady(data), true)
    })

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
        assert.equal(cluster.current, 3)
        assert.equal(cluster.unscheduledPending, 1)
        assert.equal(worker1.current + worker2.current + cluster.unscheduledPending, cluster.current)
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

    it('deduplicates by Pod UID before applying node and namespace scopes', () => {
        const original = podNode('same-uid', 'Running', { nodeName: 'worker-1', ready: true })
        const duplicate = { ...original, id: 'different-topology-node' }
        const aggregate = aggregatePods([original, duplicate], {
            nodeName: 'worker-1',
            namespace: 'default'
        })
        assert.equal(aggregate.total, 1)
        assert.equal(aggregate.active, 1)
    })

    it('counts restart history and current OOMKilled only for active Pods', () => {
        const pods = [
            podNode('active-oom', 'Running', {
                nodeName: 'worker-1',
                ready: false,
                restartCount: 2,
                lastTerminatedReason: 'OOMKilled'
            }),
            podNode('terminated-oom', 'Failed', {
                nodeName: 'worker-1',
                reason: 'Error',
                restartCount: 3,
                lastTerminatedReason: 'OOMKilled'
            })
        ]
        const aggregate = aggregatePods(pods, { nodeName: 'worker-1' })
        assert.equal(aggregate.restartHistory, 1)
        assert.equal(aggregate.currentOOMKilled, 1)
        assert.equal(aggregate.problems, 1)
        assert.equal(aggregate.terminated, 1)
    })

    it('supports future workload scope through the final owner UID resolver', () => {
        const pods = [
            podNode('pod-a', 'Running', { nodeName: 'worker-1', ready: true }),
            podNode('pod-b', 'Running', { nodeName: 'worker-1', ready: true })
        ]
        const aggregate = aggregatePods(pods, {
            ownerUID: 'deployment-a',
            resolveOwnerUID: pod => pod.id === 'pod-a' ? 'deployment-a' : 'deployment-b'
        })
        assert.equal(aggregate.active, 1)
        assert.equal(aggregate.activeEntries[0].podName, 'pod-a')
    })
})
