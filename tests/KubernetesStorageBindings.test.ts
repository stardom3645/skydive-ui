import { strict as assert } from 'assert'
import { kubernetesStorageBindings, isKubernetesStorageBindingPair } from '../src/KubernetesStorageBindings'
import { mergeKubernetesRelationLinks } from '../src/TopologyEdgePresentation'
import { topologyNodePresentation } from '../src/TopologyNodePresentation'
import { kubernetesResourceSelfStatus } from '../src/KubernetesTopologyBadgeAggregation'
import { kubernetesVerdictRules } from '../src/KubernetesVerdictRules'

const resource = (id: string, type: string, name: string, phase: string, spec: any, cluster = 'cluster-a', ns = 'app'): any => ({
    id, parent: null, children: [], state: { expanded: true }, data: { Type: type, Manager: 'k8s', Name: name, ClusterName: cluster,
        K8s: { Namespace: type === 'persistentvolumeclaim' ? ns : '', Extra: {
            ObjectMeta: { UID: id, Name: name, Namespace: type === 'persistentvolumeclaim' ? ns : '' }, Spec: spec, Status: { Phase: phase }
        } } }
})
const pvc = (id = 'pvc', cluster = 'cluster-a', ns = 'app') => resource(id, 'persistentvolumeclaim', 'data', 'Bound', { VolumeName: 'volume' }, cluster, ns)
const pv = (id = 'pv', cluster = 'cluster-a', ns = 'app', claimUID = 'pvc') => resource(id, 'persistentvolume', 'volume', 'Bound', {
    ClaimRef: { Name: 'data', Namespace: ns, UID: claimUID }, PersistentVolumeReclaimPolicy: 'Retain'
}, cluster)
const pairs = (nodes: any[]) => kubernetesStorageBindings(nodes).map(pair => [pair.source.id, pair.target.id])

describe('Kubernetes storage binding truth', () => {
    it('resolves Bound PVC volumeName and PV claimRef in the same cluster and namespace', () => {
        assert.deepEqual(pairs([pvc(), pv()]), [['pvc', 'pv']])
        assert.equal(isKubernetesStorageBindingPair(pvc(), pv()), true)
        assert.equal(isKubernetesStorageBindingPair(pv(), pvc()), true)
        assert.equal(isKubernetesStorageBindingPair(pv(), pv()), false)
    })
    it('keeps identical PV and PVC names in separate clusters and namespaces', () => {
        const a = pvc(), b = pvc('pvc-b', 'cluster-b'), c = pvc('pvc-c', 'cluster-a', 'other')
        assert.deepEqual(pairs([a, b, c, pv(), pv('pv-b', 'cluster-b', 'app', 'pvc-b')]), [['pvc', 'pv'], ['pvc-b', 'pv-b']])
        assert.deepEqual(pairs([b, pv()]), [])
    })
    it('rejects a recreated PVC with the same name but a different UID', () => {
        assert.deepEqual(pairs([pvc('new-uid'), pv()]), [])
        const old = pv(); old.data.K8s.Extra.Status.Phase = 'Released'
        assert.deepEqual(pairs([pvc('new-uid'), old]), [])
    })
    it('rejects contradictory forward and reverse references rather than OR-matching either', () => {
        const claim = pvc(); claim.data.K8s.Extra.Spec.VolumeName = 'another-volume'
        assert.deepEqual(pairs([claim, pv()]), [])
        const volume = pv(); volume.data.K8s.Extra.Spec.ClaimRef.Namespace = 'another-namespace'
        assert.deepEqual(pairs([pvc(), volume]), [])
        volume.data.K8s.Extra.Spec.ClaimRef = { Name: 'other-claim', Namespace: 'app', UID: 'pvc' }
        assert.deepEqual(pairs([pvc(), volume]), [])
    })
    it('does not turn Pending reservations, Available volumes or Released history into active bindings', () => {
        for (const phase of ['Pending', 'Released', 'Available', 'Failed']) {
            const volume = pv(); volume.data.K8s.Extra.Status.Phase = phase
            assert.deepEqual(pairs([pvc(), volume]), [], phase)
        }
        for (const phase of ['Pending', 'Lost']) {
            const claim = pvc(); claim.data.K8s.Extra.Status.Phase = phase
            assert.deepEqual(pairs([claim, pv()]), [], phase)
        }
    })
    it('uses one-sided confirmed bindings without inventing missing phase or namespace evidence', () => {
        const volume = pv(); volume.data.K8s.Extra.Spec.ClaimRef = undefined
        assert.deepEqual(pairs([pvc(), volume]), [['pvc', 'pv']])
        const claim = pvc(); claim.data.K8s.Extra.Spec.VolumeName = undefined
        assert.deepEqual(pairs([claim, pv()]), [['pvc', 'pv']])
        const missing = pv(); missing.data.K8s.Extra.Status = {}; claim.data.K8s.Extra.Status = {}
        assert.deepEqual(pairs([claim, missing]), [])
        const byNameOnly = pv(); byNameOnly.data.K8s.Extra.Spec.ClaimRef = { Name: 'data' }
        assert.deepEqual(pairs([claim, byNameOnly]), [])
    })
    it('handles lowercase API spec/metadata and flattened collector fields', () => {
        const claim = pvc(), volume = pv()
        claim.data.K8s.Extra = { metadata: { uid: 'pvc', namespace: 'app' }, spec: { volumeName: 'volume' }, status: { phase: 'Bound' } }
        volume.data.K8s.Extra = { spec: { claimRef: { uid: 'pvc', name: 'data', namespace: 'app' } }, status: { phase: 'Bound' } }
        assert.deepEqual(pairs([claim, volume]), [['pvc', 'pv']])
        claim.data.K8s.Extra = undefined; claim.data.K8s.VolumeName = 'volume'; claim.data.K8s.Status = 'Bound'
        assert.deepEqual(pairs([claim, volume]), [['pvc', 'pv']])
    })
    it('enforces a one-to-one binding and refuses ambiguous or unscoped records', () => {
        const a = pvc(), b = pvc(); b.id = 'duplicate'
        assert.deepEqual(pairs([a, b, pv()]), [])
        a.data.K8s.Extra.Spec.VolumeName = undefined
        const another = pv('pv-2'); another.data.Name = 'volume-2'
        assert.deepEqual(pairs([a, pv(), another]), [])
        assert.deepEqual(pairs([pvc('pvc', ''), pv('pv', '')]), [])
    })
    it('can resolve collection aliases through a shared real cluster ancestor', () => {
        const cluster: any = { id: 'cluster-id', data: { Type: 'cluster', Manager: 'k8s', Name: 'cluster-a' }, parent: null }
        const claim = pvc('pvc', ''), volume = pv('pv', '')
        claim.parent = cluster; volume.parent = cluster
        assert.deepEqual(pairs([claim, volume]), [['pvc', 'pv']])
        const explicit = pv('pv', 'cluster-b')
        explicit.parent = cluster
        assert.deepEqual(pairs([pvc(), explicit]), [])
    })
    it('ignores Infrastructure objects and topology groups without mutating source nodes', () => {
        const claim = pvc(), volume = pv(), original = JSON.stringify([claim, volume])
        pairs([claim, volume]); assert.equal(JSON.stringify([claim, volume]), original)
        volume.data.Manager = 'libvirt'; assert.deepEqual(pairs([claim, volume]), [])
        volume.data.Manager = 'k8s'; volume.data.IsTopologyGroup = true; assert.deepEqual(pairs([claim, volume]), [])
    })
    it('reuses an existing reversed edge once and fills only a genuinely missing binding edge', () => {
        const edges = [{ source: 'pvc', target: 'pv' }, { source: 'pvc2', target: 'pv2' }]
        const links = [{ id: 'collected', source: 'pv', target: 'pvc' }, { id: 'duplicate', source: 'pvc', target: 'pv' }, { id: 'pod', source: 'owner', target: 'pod' }]
        const merged = mergeKubernetesRelationLinks(edges, links, { nodeID: id => id, sourceID: link => link.source, targetID: link => link.target,
            reuse: link => link, create: edge => ({ ...edge, id: 'missing' }) })
        assert.deepEqual(merged.map(link => link.id), ['collected', 'pod', 'missing'])
        assert.equal(merged[1], links[2])
    })
})

describe('Storage lifecycle and unchanged card information', () => {
    it('does not treat Retain or Released alone as failure and retains the exact card geometry and fields', () => {
        const node = pv()
        const before = topologyNodePresentation(node, { name: 'volume' })
        for (const policy of ['Retain', 'Delete', 'Recycle']) for (const phase of ['Bound', 'Available', 'Released']) {
            node.data.K8s.Extra.Spec.PersistentVolumeReclaimPolicy = policy; node.data.K8s.Extra.Status.Phase = phase
            const after = topologyNodePresentation(node, { name: 'volume' })
            assert.equal(after.status.label, '정상', `${policy}/${phase}`)
            assert.equal(kubernetesResourceSelfStatus(node).state, 'healthy')
            assert.deepEqual([after.width, after.height, after.headerHeight, after.metricRowHeights],
                [before.width, before.height, before.headerHeight, before.metricRowHeights])
            assert.deepEqual(after.metrics.map(metric => metric.key), before.metrics.map(metric => metric.key))
        }
        node.data.K8s.Extra.Status.Phase = 'Failed'
        assert.equal(kubernetesResourceSelfStatus(node).state, 'problem')
        assert.equal(topologyNodePresentation(node, { name: 'volume' }).status.label, '위험')
    })
    it('documents the changed criterion without concealing Released binding state', () => {
        const rules = kubernetesVerdictRules('persistentvolume')
        assert.ok(rules.find(rule => rule.label === '정상')!.description.includes('Released'))
        assert.ok(rules.find(rule => rule.label === '정상')!.description.includes('Retain'))
        assert.ok(rules.find(rule => rule.label === '위험')!.description.includes('Failed'))
    })
})
