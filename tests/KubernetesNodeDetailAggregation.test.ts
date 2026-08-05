import { strict as assert } from 'assert'
import {
    kubernetesNodeConditionIsHealthy,
    kubernetesNodeLocalStorageDependencies,
    kubernetesNodePodDataset,
    kubernetesNodeSingleReplicaWorkloads,
    kubernetesNodeTopWorkloads
} from '../src/KubernetesNodeDetailAggregation'
import { formatKubernetesValueState } from '../src/DataPanels/common/KubernetesValueState'

const NOW = Date.parse('2026-08-05T12:00:00Z')

const resource = (id: string, type: string, options: any = {}): any => ({
    id,
    data: {
        Manager: 'k8s',
        Type: type,
        Name: options.name || id,
        ClusterName: 'cluster-a',
        K8s: {
            Namespace: options.namespace || 'default',
            Extra: {
                ObjectMeta: {
                    UID: options.uid || id,
                    Namespace: options.namespace || 'default',
                    OwnerReferences: options.owners || [],
                    ...(options.deletingAt ? { DeletionTimestamp: options.deletingAt } : {})
                },
                Spec: options.spec || {},
                Status: options.status || {}
            }
        }
    }
})

const pod = (id: string, phase: string, options: any = {}): any => resource(id, 'pod', {
    ...options,
    spec: { NodeName: 'worker-1', ...(options.spec || {}) },
    status: {
        Phase: phase,
        Reason: options.reason || '',
        Conditions: options.ready === undefined ? [] : [{ Type: 'Ready', Status: options.ready ? 'True' : 'False' }],
        ContainerStatuses: options.containerStatuses || []
    }
})

describe('Kubernetes node detail aggregation', () => {
    it('reuses one active Pod definition and keeps current problems separate', () => {
        const nodes = [
            pod('running', 'Running', { ready: true }),
            pod('pending', 'Pending'),
            pod('unknown', 'Unknown'),
            pod('not-ready', 'Running', { ready: false }),
            pod('failed', 'Failed'),
            pod('evicted', 'Failed', { reason: 'Evicted' }),
            pod('succeeded', 'Succeeded'),
            pod('deleting', 'Running', { deletingAt: '2026-08-05T11:50:00Z' })
        ]
        const dataset = kubernetesNodePodDataset(nodes, 'worker-1', 'cluster-a', NOW)
        assert.deepEqual(dataset.activePods.map(item => item.id).sort(), ['not-ready', 'pending', 'running', 'unknown'])
        assert.deepEqual(dataset.problemPods.map(item => item.id).sort(), ['deleting', 'evicted', 'failed', 'not-ready', 'pending', 'unknown'])
        assert.equal(dataset.pendingPods.length, 1)
    })

    it('does not promote cumulative restart history without recent evidence', () => {
        const status = (finishedAt: string) => [{
            RestartCount: 3,
            LastTerminationState: { Terminated: { Reason: 'Error', FinishedAt: finishedAt } }
        }]
        const dataset = kubernetesNodePodDataset([
            pod('recent', 'Running', { ready: true, containerStatuses: status('2026-08-05T11:30:00Z') }),
            pod('old', 'Running', { ready: true, containerStatuses: status('2026-08-05T09:00:00Z') })
        ], 'worker-1', 'cluster-a', NOW)
        assert.equal(dataset.restartHistoryPods.length, 2)
        assert.deepEqual(dataset.recentRestartPods.map(item => item.id), ['recent'])
    })

    it('separates current or recent OOMKilled from old termination history', () => {
        const lastOOM = (finishedAt: string) => [{
            RestartCount: 1,
            LastTerminationState: { Terminated: { Reason: 'OOMKilled', FinishedAt: finishedAt } }
        }]
        const dataset = kubernetesNodePodDataset([
            pod('current', 'Running', { ready: false, containerStatuses: [{ State: { Terminated: { Reason: 'OOMKilled' } } }] }),
            pod('recent', 'Running', { ready: true, containerStatuses: lastOOM('2026-08-05T11:30:00Z') }),
            pod('old', 'Running', { ready: true, containerStatuses: lastOOM('2026-08-05T09:00:00Z') })
        ], 'worker-1', 'cluster-a', NOW)
        assert.equal(dataset.oomKilledHistoryPods.length, 3)
        assert.deepEqual(dataset.currentOOMKilledPods.map(item => item.id).sort(), ['current', 'recent'])
    })

    it('counts only top-level workload owners and limits single Replica to Deployment and StatefulSet', () => {
        const deployment = resource('deployment', 'deployment', { spec: { Replicas: 1 } })
        const replicaSet = resource('replicaset', 'replicaset', {
            owners: [{ UID: 'deployment', Kind: 'Deployment', Name: 'deployment', Controller: true }]
        })
        const statefulSet = resource('statefulset', 'statefulset', { spec: { Replicas: 1 } })
        const daemonSet = resource('daemonset', 'daemonset', { spec: { Replicas: 1 } })
        const job = resource('job', 'job', { spec: { Replicas: 1 } })
        const cronJob = resource('cronjob', 'cronjob', { spec: { Replicas: 1 } })
        const activePods = [
            pod('deployment-pod', 'Running', { ready: true, owners: [{ UID: 'replicaset', Kind: 'ReplicaSet', Name: 'deployment-rs', Controller: true }] }),
            pod('stateful-pod', 'Running', { ready: true, owners: [{ UID: 'statefulset', Kind: 'StatefulSet', Name: 'statefulset', Controller: true }] }),
            pod('daemon-pod', 'Running', { ready: true, owners: [{ UID: 'daemonset', Kind: 'DaemonSet', Name: 'daemonset', Controller: true }] }),
            pod('job-pod', 'Running', { ready: true, owners: [{ UID: 'job', Kind: 'Job', Name: 'job', Controller: true }] }),
            pod('cron-pod', 'Running', { ready: true, owners: [{ UID: 'cronjob', Kind: 'CronJob', Name: 'cronjob', Controller: true }] })
        ]
        const nodes = [deployment, replicaSet, statefulSet, daemonSet, job, cronJob, ...activePods]
        assert.deepEqual(kubernetesNodeTopWorkloads(activePods, nodes).map(item => item.id).sort(), [
            'cronjob', 'daemonset', 'deployment', 'job', 'statefulset'
        ])
        assert.deepEqual(kubernetesNodeSingleReplicaWorkloads(activePods, nodes).map(item => item.id).sort(), [
            'deployment', 'statefulset'
        ])
    })

    it('includes node-local storage and excludes ephemeral, config and network storage', () => {
        const volumePod = (id: string, volume: any) => pod(id, 'Running', { ready: true, spec: { Volumes: [volume] } })
        const pods = [
            volumePod('host-path', { HostPath: { Path: '/data' } }),
            volumePod('empty-dir', { EmptyDir: {} }),
            volumePod('config-map', { ConfigMap: { Name: 'config' } }),
            volumePod('secret', { Secret: { SecretName: 'secret' } }),
            volumePod('projected', { Projected: {} }),
            volumePod('ceph', { RBD: { Pool: 'rbd' } }),
            volumePod('nfs', { NFS: { Server: '10.0.0.1' } }),
            volumePod('network-csi', { CSI: { Driver: 'rbd.csi.ceph.com' } })
        ]
        assert.deepEqual(kubernetesNodeLocalStorageDependencies(pods, pods).pods.map(item => item.id), ['host-path'])
    })

    it('recognizes local PV and local-path StorageClass without accepting Ceph or NFS claims', () => {
        const claimPod = (id: string, claimName: string) => pod(id, 'Running', {
            ready: true,
            spec: { Volumes: [{ PersistentVolumeClaim: { ClaimName: claimName } }] }
        })
        const localPvPod = claimPod('local-pv-pod', 'local-pv-claim')
        const localPathPod = claimPod('local-path-pod', 'local-path-claim')
        const cephPod = claimPod('ceph-pod', 'ceph-claim')
        const nfsPod = claimPod('nfs-pod', 'nfs-claim')
        const resources = [
            resource('local-pv-claim', 'persistentvolumeclaim', { spec: { VolumeName: 'local-pv' } }),
            resource('local-pv', 'persistentvolume', { spec: { Local: { Path: '/mnt/local' } } }),
            resource('local-path-claim', 'persistentvolumeclaim', { spec: { StorageClassName: 'local-path' } }),
            resource('local-path', 'storageclass', { spec: { Provisioner: 'rancher.io/local-path' } }),
            resource('ceph-claim', 'persistentvolumeclaim', { spec: { StorageClassName: 'ceph-rbd' } }),
            resource('ceph-rbd', 'storageclass', { spec: { Provisioner: 'rbd.csi.ceph.com' } }),
            resource('nfs-claim', 'persistentvolumeclaim', { spec: { StorageClassName: 'nfs' } }),
            resource('nfs', 'storageclass', { spec: { Provisioner: 'nfs.csi.k8s.io' } })
        ]
        // StorageClass provisioner is a top-level collector field in production.
        resources.filter(item => item.data.Type === 'storageclass').forEach(item => {
            item.data.K8s.Extra.Provisioner = item.data.K8s.Extra.Spec.Provisioner
        })
        const pods = [localPvPod, localPathPod, cephPod, nfsPod]
        assert.deepEqual(
            kubernetesNodeLocalStorageDependencies(pods, [...pods, ...resources]).pods.map(item => item.id).sort(),
            ['local-path-pod', 'local-pv-pod']
        )
    })

    it('interprets Node Condition polarity by condition type', () => {
        assert.equal(kubernetesNodeConditionIsHealthy({ type: 'Ready', status: 'True' }), true)
        assert.equal(kubernetesNodeConditionIsHealthy({ type: 'Ready', status: 'False' }), false)
        ;['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable'].forEach(type => {
            assert.equal(kubernetesNodeConditionIsHealthy({ type, status: 'False' }), true)
            assert.equal(kubernetesNodeConditionIsHealthy({ type, status: 'True' }), false)
        })
    })

    it('distinguishes uncollected, unset and inapplicable values', () => {
        assert.equal(formatKubernetesValueState({ collected: false }), '수집되지 않음')
        assert.equal(formatKubernetesValueState({ collected: true, value: [] }), '설정되지 않음')
        assert.equal(formatKubernetesValueState({ collected: true, applicable: false }), '해당 없음')
        assert.equal(formatKubernetesValueState({ collected: true, value: ['10.244.0.0/24'] }), '10.244.0.0/24')
    })
})
