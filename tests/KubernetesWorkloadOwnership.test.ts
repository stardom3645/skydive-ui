import { strict as assert } from 'assert'
import { resolveKubernetesPodController } from '../src/KubernetesWorkloadOwnership'

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
})
