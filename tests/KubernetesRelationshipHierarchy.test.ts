import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { resolveKubernetesPodController } from '../src/KubernetesWorkloadOwnership'
import { kubernetesStorageBindings } from '../src/KubernetesStorageBindings'
import { isKubernetesTopologyData, isTopologyNodeVisibleInLayer } from '../src/KubernetesInfrastructureEvidence'
import { kubernetesTopologyHasInactiveClusterAncestor } from '../src/KubernetesTopologyBadgeAggregation'
import { isCurrentKubernetesPod } from '../src/KubernetesPodLifecycle'

const source = ts.createSourceFile('App.tsx', readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const cls = source.statements.find(item => ts.isClassDeclaration(item) && item.name?.text === 'App') as ts.ClassDeclaration
const methods = ['reconcileKubernetesWorkloadHierarchy', 'kubernetesTopologyNodeVisible'].map(name => cls.members.find(item => item.name?.getText(source) === name)!.getText(source)).join('\n')
const typeSet = new Set(['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'])
const resource = (id: string, Type: string, owners: any[] = []): any => ({ id, children: [], parent: null, tags: ['kubernetes'], state: {}, data: {
    Type, Manager: 'k8s', Name: Type === 'namespace' ? 'app' : id, ClusterName: 'cluster-a', K8s: { Namespace: 'app', Extra: {
        ObjectMeta: { UID: id, OwnerReferences: owners }, Status: Type === 'pod' ? { Phase: 'Running' } : {}
    } }
} })

describe('Collected ReplicaSet metadata preserves the execution hierarchy', () => {
    it('uses the real App hierarchy resolver, retains hidden ReplicaSets, and detaches a Pod when its owner metadata disappears', () => {
        const Probe = vm.runInNewContext(ts.transpile(`class Probe { ${methods} }; Probe`, { target: ts.ScriptTarget.ES2018 }), {
            resolveKubernetesPodController, kubernetesStorageBindings, isKubernetesTopologyData, isTopologyNodeVisibleInLayer,
            kubernetesTopologyHasInactiveClusterAncestor, isCurrentKubernetesPod,
            KUBERNETES_WORKLOAD_TYPES: typeSet, KUBERNETES_INTERMEDIATE_RELATION_TYPES: new Set(['replicaset'])
        })
        const cluster = resource('cluster', 'cluster'), namespace = resource('namespace', 'namespace')
        const deployment = resource('deployment', 'deployment')
        const rs = resource('rs', 'replicaset', [{ Kind: 'Deployment', UID: deployment.id, Controller: true }])
        const pod = resource('pod', 'pod', [{ Kind: 'ReplicaSet', UID: rs.id, Controller: true }])
        const nodes = [cluster, namespace, deployment, rs, pod], app = new Probe()
        const root = { id: 'root', data: {}, children: [] }
        app.state = { kubernetesClusters: [] }; app.isKubernetesLayerActive = () => true
        app.tc = { nodes: new Map(nodes.map(node => [node.id, node])), root,
            setParent: (child: any, parent: any) => {
                if (child.parent) child.parent.children = child.parent.children.filter((item: any) => item !== child)
                child.parent = parent; parent.children.push(child)
            }
        }
        app.reconcileKubernetesWorkloadHierarchy()
        assert.equal(deployment.parent, namespace)
        assert.equal(pod.parent, deployment)
        assert.equal(pod.data.TopologyWorkloadControllerID, deployment.id)
        assert.equal(app.kubernetesTopologyNodeVisible(rs), false)
        assert.equal(app.tc.nodes.has(rs.id), true)
        assert.equal(app.kubernetesTopologyNodeVisible(pod), true)
        assert.equal(nodes.length, app.tc.nodes.size, 'no extra topology cards or guessed owners')
        app.tc.nodes.delete(rs.id)
        app.reconcileKubernetesWorkloadHierarchy()
        assert.equal(pod.parent, namespace)
        assert.equal(pod.data.TopologyWorkloadControllerID, '')
        assert.equal(deployment.children.includes(pod), false)
    })
})
