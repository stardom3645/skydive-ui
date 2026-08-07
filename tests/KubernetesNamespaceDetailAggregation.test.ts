import { strict as assert } from 'assert'
import {
    kubernetesNamespaceContainerResourceCoverage,
    kubernetesNamespaceDistribution,
    kubernetesNamespacePolicyCoverage,
    kubernetesNamespaceResourceCoverageFromDetail,
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
            ], EphemeralContainers: [
                { Resources: { Requests: { cpu: '8', memory: '8Gi' }, Limits: { cpu: '16', memory: '16Gi' } } }
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
            cpuRequestsCollected: true,
            cpuLimitsCollected: true,
            memoryRequestsCollected: true,
            memoryLimitsCollected: true,
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
            cpuRequestsCollected: false,
            cpuLimitsCollected: false,
            memoryRequestsCollected: false,
            memoryLimitsCollected: false,
            cpuRequestsCores: undefined,
            cpuLimitsCores: undefined,
            memoryRequestsBytes: undefined,
            memoryLimitsBytes: undefined
        })
    })

    it('does not present missing container Resources data as an unset 0 / 0 value', () => {
        const missingResources = pod('missing-resources', { containers: [{ Name: 'app' }] })
        const coverage = kubernetesNamespaceContainerResourceCoverage([missingResources])
        assert.equal(coverage.collected, false)
        assert.equal(coverage.total, 1)
        assert.equal(coverage.cpuRequests, 0)
        assert.equal(coverage.cpuRequestsCores, undefined)
    })

    it('treats an empty container list on an active Pod as uncollected', () => {
        const coverage = kubernetesNamespaceContainerResourceCoverage([pod('empty-container-spec')])
        assert.equal(coverage.collected, false)
        assert.equal(coverage.total, 0)
        assert.equal(coverage.cpuRequestsCollected, false)
    })

    it('deduplicates regular and init containers within the active Pod denominator', () => {
        const duplicated = pod('duplicate-containers', { containers: [
            { Name: 'app', Resources: { Requests: { cpu: '100m' } } },
            { Name: 'app', Resources: { Requests: { cpu: '100m' } } }
        ], spec: { InitContainers: [
            { Name: 'prepare', Resources: {} },
            { Name: 'prepare', Resources: {} }
        ] } })
        const coverage = kubernetesNamespaceContainerResourceCoverage([duplicated])
        assert.equal(coverage.collected, true)
        assert.equal(coverage.total, 2)
        assert.equal(coverage.cpuRequests, 1)
    })

    it('keeps an invalid quantity from contradicting an apparently configured total', () => {
        const invalid = pod('invalid-quantity', { containers: [{
            Name: 'app',
            Resources: { Requests: { cpu: 'not-a-quantity' }, Limits: {}, }
        }] })
        const coverage = kubernetesNamespaceContainerResourceCoverage([invalid])
        assert.equal(coverage.cpuRequests, 1)
        assert.equal(coverage.cpuRequestsCollected, false)
        assert.equal(coverage.cpuRequestsCores, undefined)
        assert.equal(coverage.memoryRequestsCollected, true)
    })

    it('distinguishes absent policy object collection from a collected zero count', () => {
        assert.deepEqual(kubernetesNamespacePolicyCoverage([], false, undefined, undefined), { collected: false, count: 0 })
        assert.deepEqual(kubernetesNamespacePolicyCoverage([], true, [], 0), { collected: true, count: 0 })
        const quotas = [
            resource('quota-a', 'resourcequota', { name: 'quota', uid: 'quota-uid' }),
            resource('quota-a-copy', 'resourcequota', { name: 'quota', uid: 'quota-uid' })
        ]
        assert.deepEqual(kubernetesNamespacePolicyCoverage(quotas, false, undefined, undefined), { collected: true, count: 1 })
    })

    it('uses one namespace API dataset for resource counts and aggregates', () => {
        const coverage = kubernetesNamespaceResourceCoverageFromDetail({
            collected: true,
            totalContainers: 3,
            cpuRequests: { configuredContainers: 2, cores: 0.75 },
            cpuLimits: { configuredContainers: 1, cores: 1 },
            memoryRequests: { configuredContainers: 2, bytes: 768 * 1024 * 1024 },
            memoryLimits: { configuredContainers: 1, bytes: 1024 * 1024 * 1024 }
        })
        assert.equal(coverage?.total, 3)
        assert.equal(coverage?.cpuRequests, 2)
        assert.equal(coverage?.cpuRequestsCores, 0.75)
        assert.equal(coverage?.memoryLimitsBytes, 1024 * 1024 * 1024)
        assert.equal(kubernetesNamespaceResourceCoverageFromDetail({ collected: false }), undefined)

        const missingAggregate = kubernetesNamespaceResourceCoverageFromDetail({
            collected: true,
            totalContainers: 1,
            cpuRequests: { configuredContainers: 1 },
            cpuLimits: { configuredContainers: 0 },
            memoryRequests: { configuredContainers: 0 },
            memoryLimits: { configuredContainers: 0 }
        })
        assert.equal(missingAggregate?.cpuRequestsCores, undefined)
        assert.equal(missingAggregate?.cpuLimitsCores, undefined)
    })
})
