import { strict as assert } from 'assert'
import {
    currentKubernetesReplicaSetForDeployment,
    kubernetesPodsForController,
    kubernetesPodsForReplicaSets,
    kubernetesReplicaSetRelationsForDeployment,
    kubernetesReplicaSetsForDeployment,
    resolveKubernetesPodController,
    resolveKubernetesPodTopController
} from '../src/KubernetesWorkloadOwnership'

const k8sNode = (id: string, type: string, name: string, namespace: string, extra: any = {}): any => ({
    id,
    data: {
        Manager: 'k8s',
        Type: type,
        Name: name,
        ClusterName: 'cluster-a',
        K8s: {
            Namespace: namespace,
            Extra: extra
        }
    }
})

describe('KubernetesWorkloadOwnership', () => {
    it('resolves a Deployment when the ReplicaSet object is omitted by the collector', () => {
        const deployment = k8sNode('deployment-id', 'deployment', 'grafana', 'monitoring', {
            Spec: { Selector: { MatchLabels: { app: 'grafana' } } }
        })
        const pod = k8sNode('pod-id', 'pod', 'grafana-7f99d8-p9j4k', 'monitoring', {
            ObjectMeta: {
                Labels: { app: 'grafana', 'pod-template-hash': '7f99d8' },
                OwnerReferences: [{ Kind: 'ReplicaSet', Name: 'grafana-7f99d8', UID: 'missing-rs' }]
            },
            Status: { Phase: 'Running' }
        })

        assert.equal(resolveKubernetesPodController(pod, [deployment, pod])?.id, deployment.id)
    })

    it('does not attach a Pod to a similarly named Deployment when selectors differ', () => {
        const deployment = k8sNode('deployment-id', 'deployment', 'grafana', 'monitoring', {
            Spec: { Selector: { MatchLabels: { app: 'other' } } }
        })
        const pod = k8sNode('pod-id', 'pod', 'grafana-7f99d8-p9j4k', 'monitoring', {
            ObjectMeta: {
                Labels: { app: 'grafana' },
                OwnerReferences: [{ Kind: 'ReplicaSet', Name: 'grafana-7f99d8', UID: 'missing-rs' }]
            }
        })

        assert.equal(resolveKubernetesPodController(pod, [deployment, pod]), undefined)
    })

    it('keeps direct DaemonSet ownership', () => {
        const daemonSet = k8sNode('daemonset-id', 'daemonset', 'node-exporter', 'monitoring')
        daemonSet.data.K8s.Extra.ObjectMeta = { UID: 'daemonset-uid' }
        const pod = k8sNode('pod-id', 'pod', 'node-exporter-abcde', 'monitoring', {
            ObjectMeta: {
                OwnerReferences: [{ Kind: 'DaemonSet', Name: 'node-exporter', UID: 'daemonset-uid' }]
            }
        })

        assert.equal(resolveKubernetesPodController(pod, [daemonSet, pod])?.id, daemonSet.id)
    })

    it('folds a Job into its final CronJob owner for node workload summaries', () => {
        const cronJob = k8sNode('cronjob-id', 'cronjob', 'backup', 'default')
        cronJob.data.K8s.Extra.ObjectMeta = { UID: 'cronjob-uid' }
        const job = k8sNode('job-id', 'job', 'backup-123', 'default', {
            ObjectMeta: {
                UID: 'job-uid',
                OwnerReferences: [{ Kind: 'CronJob', Name: 'backup', UID: 'cronjob-uid', Controller: true }]
            }
        })
        const pod = k8sNode('pod-id', 'pod', 'backup-123-abcd', 'default', {
            ObjectMeta: {
                OwnerReferences: [{ Kind: 'Job', Name: 'backup-123', UID: 'job-uid', Controller: true }]
            }
        })

        assert.equal(resolveKubernetesPodController(pod, [cronJob, job, pod])?.id, job.id)
        assert.equal(resolveKubernetesPodTopController(pod, [cronJob, job, pod])?.id, cronJob.id)
    })

    it('selects only Deployment-owned ReplicaSets and prefers the matching revision', () => {
        const deployment = k8sNode('deployment-id', 'deployment', 'api', 'default', {
            ObjectMeta: { UID: 'deployment-uid', Annotations: { 'deployment.kubernetes.io/revision': '3' } }
        })
        const oldReplicaSet = k8sNode('rs-old', 'replicaset', 'api-old', 'default', {
            ObjectMeta: { UID: 'rs-old-uid', Annotations: { 'deployment.kubernetes.io/revision': '2' }, OwnerReferences: [{ Kind: 'Deployment', Name: 'api', UID: 'deployment-uid' }] }
        })
        const currentReplicaSet = k8sNode('rs-current', 'replicaset', 'api-current', 'default', {
            ObjectMeta: { UID: 'rs-current-uid', Annotations: { 'deployment.kubernetes.io/revision': '3' }, OwnerReferences: [{ Kind: 'Deployment', Name: 'api', UID: 'deployment-uid' }] }
        })
        const unrelatedReplicaSet = k8sNode('rs-other', 'replicaset', 'api-lookalike', 'default', {
            ObjectMeta: { UID: 'rs-other-uid', OwnerReferences: [{ Kind: 'Deployment', Name: 'other', UID: 'other-uid' }] }
        })

        const owned = kubernetesReplicaSetsForDeployment(deployment, [deployment, oldReplicaSet, currentReplicaSet, unrelatedReplicaSet])
        assert.deepEqual(owned.map(item => item.id), ['rs-old', 'rs-current'])
        assert.equal(currentKubernetesReplicaSetForDeployment(deployment, owned)?.id, 'rs-current')
    })

    it('collects Deployment Pods through direct ReplicaSet owner references only', () => {
        const replicaSet = k8sNode('rs-id', 'replicaset', 'api-abc', 'default', { ObjectMeta: { UID: 'rs-uid' } })
        const ownedPod = k8sNode('pod-owned', 'pod', 'api-abc-1', 'default', {
            ObjectMeta: { OwnerReferences: [{ Kind: 'ReplicaSet', Name: 'api-abc', UID: 'rs-uid' }] }
        })
        const selectorOnlyPod = k8sNode('pod-selector', 'pod', 'api-other-1', 'default', {
            ObjectMeta: { Labels: { app: 'api' } }
        })

        assert.deepEqual(kubernetesPodsForReplicaSets([replicaSet], [ownedPod, selectorOnlyPod]).map(item => item.id), ['pod-owned'])
    })

    it('prefers the active grafana ReplicaSet over a scaled-down history ReplicaSet', () => {
        const deployment = k8sNode('deployment-uid', 'deployment', 'k8s-prom-grafana', 'monitoring', {
            ObjectMeta: { UID: 'deployment-uid' }
        })
        const history = k8sNode('history-rs-uid', 'replicaset', 'k8s-prom-grafana-599f49fcd6', 'monitoring', {
            ObjectMeta: { UID: 'history-rs-uid', OwnerReferences: [{ Kind: 'Deployment', Name: deployment.data.Name, UID: 'deployment-uid' }] },
            Spec: { Replicas: 0 }, Status: { Replicas: 0, ReadyReplicas: 0 }
        })
        const active = k8sNode('active-rs-uid', 'replicaset', 'k8s-prom-grafana-5dc7944964', 'monitoring', {
            ObjectMeta: { UID: 'active-rs-uid', OwnerReferences: [{ Kind: 'Deployment', Name: deployment.data.Name, UID: 'deployment-uid' }] },
            Spec: { Replicas: 1 }, Status: { Replicas: 1, ReadyReplicas: 1 }
        })
        const pod = k8sNode('grafana-pod-uid', 'pod', 'k8s-prom-grafana-5dc7944964-pod', 'monitoring', {
            ObjectMeta: { UID: 'grafana-pod-uid', OwnerReferences: [{ Kind: 'ReplicaSet', Name: active.data.Name, UID: 'active-rs-uid' }] },
            Status: { Phase: 'Running' }
        })
        const nodes = [deployment, history, active, pod]

        assert.equal(currentKubernetesReplicaSetForDeployment(deployment, nodes)?.data.Name, 'k8s-prom-grafana-5dc7944964')
        assert.deepEqual(kubernetesPodsForReplicaSets(kubernetesReplicaSetsForDeployment(deployment, nodes), nodes).map(item => item.id), ['grafana-pod-uid'])
    })

    it('reuses the topology controller relation when the ReplicaSet node is omitted', () => {
        const deployment = k8sNode('deployment-uid', 'deployment', 'k8s-prom-grafana', 'monitoring', {
            ObjectMeta: { UID: 'deployment-uid' }
        })
        const pod = k8sNode('grafana-pod-uid', 'pod', 'k8s-prom-grafana-5dc7944964-pod', 'monitoring', {
            ObjectMeta: {
                UID: 'grafana-pod-uid',
                OwnerReferences: [{ Kind: 'ReplicaSet', Name: 'k8s-prom-grafana-5dc7944964', UID: 'active-rs-uid' }]
            },
            Status: { Phase: 'Running' }
        })
        pod.data.TopologyWorkloadControllerID = deployment.id
        const nodes = [deployment, pod]
        const relations = kubernetesReplicaSetRelationsForDeployment(deployment, nodes)

        assert.deepEqual(kubernetesPodsForController(deployment, nodes).map(item => item.id), ['grafana-pod-uid'])
        assert.equal(relations.length, 1)
        assert.equal(relations[0].data.Name, 'k8s-prom-grafana-5dc7944964')
        assert.equal(relations[0].data.RelationshipReferenceOnly, true)
        assert.equal(currentKubernetesReplicaSetForDeployment(deployment, nodes)?.data.Name, 'k8s-prom-grafana-5dc7944964')
    })
})
