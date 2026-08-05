import { strict as assert } from 'assert'
import {
    kubernetesNamespaceContainerResourceCoverage,
    kubernetesNamespaceDistribution,
    kubernetesNamespaceWorkloadHealth,
    uniqueKubernetesNamespaceResources
} from '../src/KubernetesNamespaceDetailAggregation'

const resource = (id: string, type: string, options: any = {}): any => ({
    id,
    data: {
        Manager: 'k8s',
        Type: type,
        Name: options.name || id,
        ClusterName: 'cluster-a',
        K8s: {
            Namespace: options.namespace || 'team-a',
            Extra: {
                ObjectMeta: {
                    UID: options.uid || id,
                    Namespace: options.namespace || 'team-a',
                    OwnerReferences: options.owners || []
                },
                Spec: options.spec || {},
                ...(options.status === undefined ? {} : { Status: options.status })
            }
        }
    }
})

const pod = (id: string, options: any = {}): any => resource(id, 'pod', {
    ...options,
    spec: {
        NodeName: options.nodeName || 'worker-1',
        Containers: options.containers || [],
        ...(options.spec || {})
    },
    status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'True' }] }
})

describe('Kubernetes namespace detail aggregation', () => {
    it('deduplicates connected resources by cluster, namespace, kind and name', () => {
        const resources = [
            resource('pod-a-1', 'pod', { name: 'pod-a', uid: 'uid-a' }),
            resource('pod-a-2', 'pod', { name: 'pod-a', uid: 'uid-a-copy' }),
            resource('pod-b', 'pod', { name: 'pod-b' })
        ]
        assert.deepEqual(uniqueKubernetesNamespaceResources(resources).map(item => item.data.Name).sort(), ['pod-a', 'pod-b'])
    })

    it('evaluates each workload kind without treating completed Jobs as unavailable', () => {
        const workloads = [
            resource('deployment-bad', 'deployment', { spec: { Replicas: 2 }, status: { AvailableReplicas: 1, UpdatedReplicas: 2, UnavailableReplicas: 1 } }),
            resource('stateful-good', 'statefulset', { spec: { Replicas: 2 }, status: { ReadyReplicas: 2, UpdatedReplicas: 2, CurrentRevision: 'r2', UpdateRevision: 'r2' } }),
            resource('daemon-bad', 'daemonset', { status: { DesiredNumberScheduled: 3, NumberReady: 2, NumberUnavailable: 1, NumberMisscheduled: 0 } }),
            resource('job-complete', 'job', { status: { Succeeded: 1, Failed: 0, Conditions: [{ Type: 'Complete', Status: 'True' }] } }),
            resource('job-failed', 'job', { status: { Failed: 1, Conditions: [{ Type: 'Failed', Status: 'True' }] } }),
            resource('cron-suspended', 'cronjob', { spec: { Suspend: true } }),
            resource('cron-failed', 'cronjob', { status: { Active: [] } }),
            resource('cron-failed-job', 'job', {
                owners: [{ UID: 'cron-failed', Kind: 'CronJob', Name: 'cron-failed', Controller: true }],
                status: { Failed: 1, Conditions: [{ Type: 'Failed', Status: 'True' }] }
            }),
            resource('cron-running', 'cronjob', { status: { Active: [{ Name: 'active-job' }] } })
        ]
        const result = kubernetesNamespaceWorkloadHealth(workloads)
        assert.deepEqual(result.unavailableWorkloads.map(item => item.id).sort(), [
            'cron-failed', 'cron-failed-job', 'daemon-bad', 'deployment-bad', 'job-failed'
        ])
    })

    it('warns for multi-replica concentration only when more than one node is available', () => {
        const stateful = resource('stateful', 'statefulset', { spec: { Replicas: 2 }, status: { ReadyReplicas: 2, UpdatedReplicas: 2 } })
        const pods = [
            pod('pod-0', { owners: [{ UID: 'stateful', Kind: 'StatefulSet', Name: 'stateful', Controller: true }] }),
            pod('pod-1', { owners: [{ UID: 'stateful', Kind: 'StatefulSet', Name: 'stateful', Controller: true }] })
        ]
        assert.equal(kubernetesNamespaceDistribution([stateful], pods, [stateful, ...pods], 1).concentratedWorkloads.length, 0)
        assert.deepEqual(kubernetesNamespaceDistribution([stateful], pods, [stateful, ...pods], 3).concentratedWorkloads.map(item => item.id), ['stateful'])
        const spread = resource('spread', 'statefulset', {
            spec: { Replicas: 2, Template: { Spec: { TopologySpreadConstraints: [{ TopologyKey: 'kubernetes.io/hostname' }] } } },
            status: { ReadyReplicas: 2, UpdatedReplicas: 2 }
        })
        const spreadPods = [
            pod('spread-0', { owners: [{ UID: 'spread', Kind: 'StatefulSet', Name: 'spread', Controller: true }] }),
            pod('spread-1', { owners: [{ UID: 'spread', Kind: 'StatefulSet', Name: 'spread', Controller: true }] })
        ]
        assert.equal(kubernetesNamespaceDistribution([spread], spreadPods, [spread, ...spreadPods], 3).concentratedWorkloads.length, 0)
    })

    it('counts configured Requests and Limits by container, not by Pod', () => {
        const podA = pod('pod-a', { uid: 'pod-a-uid', containers: [
                { Resources: { Requests: { cpu: '100m', memory: '64Mi' }, Limits: { cpu: '500m' } } },
                { Resources: { Requests: {}, Limits: { memory: '128Mi' } } }
            ], spec: { InitContainers: [
                { Resources: { Requests: { cpu: '500m', memory: '512Mi' }, Limits: { cpu: '1', memory: '1Gi' } } }
            ] } })
        const duplicatePodA = { ...podA, id: 'pod-a-duplicate' }
        const coverage = kubernetesNamespaceContainerResourceCoverage([podA, duplicatePodA])
        assert.deepEqual(coverage, {
            collected: true,
            total: 3,
            cpuRequests: 2,
            cpuLimits: 2,
            memoryRequests: 2,
            memoryLimits: 2,
            cpuRequestsCores: 0.5,
            cpuLimitsCores: 1,
            memoryRequestsBytes: 512 * Math.pow(1024, 2),
            memoryLimitsBytes: Math.pow(1024, 3)
        })
    })

    it('does not combine external totals with Pods whose container specs were not collected', () => {
        const missingSpec = pod('missing-spec', { spec: { Containers: undefined } })
        assert.deepEqual(kubernetesNamespaceContainerResourceCoverage([missingSpec]), {
            collected: false,
            total: 0,
            cpuRequests: 0,
            cpuLimits: 0,
            memoryRequests: 0,
            memoryLimits: 0,
            cpuRequestsCores: undefined,
            cpuLimitsCores: undefined,
            memoryRequestsBytes: undefined,
            memoryLimitsBytes: undefined
        })
    })
})
