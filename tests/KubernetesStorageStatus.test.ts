import { strict as assert } from 'assert'
import { kubernetesStorageObservation, kubernetesStorageOperationalPresentation } from '../src/KubernetesStorageStatus'
import { kubernetesResourceSelfStatus, kubernetesTopologyCountBadges, kubernetesTopologyDirectChildSummary, kubernetesTopologyNodeNeedsAttention } from '../src/KubernetesTopologyBadgeAggregation'
import { topologyNodeStatusPresentation } from '../src/TopologyNodePresentation'
import { statusSummaryEntries } from '../src/StatusSummary'

const resource = (type: string, phase?: string, spec: any = {}): any => ({ id: `${type}-${phase || 'missing'}`, children: [], parent: null,
    tags: ['kubernetes'], data: { Manager: 'k8s', Type: type, State: phase, K8s: { Extra: { Spec: spec, Status: { Phase: phase } } } } })

describe('Shared Kubernetes storage status', () => {
    for (const [type, phase, spec, state, verdict] of [
        ['persistentvolume', 'Released', { ClaimRef: { Name: 'old-claim' }, PersistentVolumeReclaimPolicy: 'Retain' }, 'healthy', '정상'],
        ['persistentvolume', 'Failed', {}, 'problem', '위험'],
        ['persistentvolume', 'Available', {}, 'healthy', '정상'],
        ['persistentvolume', 'Bound', { ClaimRef: { Name: 'claim' } }, 'healthy', '정상'],
        ['persistentvolume', 'Bound', {}, 'attention', '보완 권장'],
        ['persistentvolumeclaim', 'Pending', {}, 'attention', '보완 권장'],
        ['persistentvolumeclaim', 'Lost', {}, 'problem', '위험'],
        ['persistentvolumeclaim', 'Bound', { VolumeName: 'pv' }, 'healthy', '정상'],
        ['persistentvolumeclaim', 'Bound', {}, 'attention', '보완 권장'],
        ['persistentvolume', 'OtherPhase', {}, 'unknown', '미확인']
    ] as any[]) {
        it(`${type} ${phase} agrees across detail policy, card, badge and attention list`, () => {
            const node = resource(type, phase, spec)
            const policy = kubernetesStorageOperationalPresentation(kubernetesStorageObservation(node.data))
            const self = kubernetesResourceSelfStatus(node), card = topologyNodeStatusPresentation(node)
            const badges = kubernetesTopologyCountBadges(node)
            const entries = statusSummaryEntries([node], () => ({ kind: 'normal', label: 'normal' }))
            assert.equal(policy.verdict, verdict)
            assert.equal(self.state, state)
            assert.equal(card.label, verdict)
            if (state === 'attention') {
                assert.equal(card.tone, 'warning')
                assert.equal(badges.find(b => b.key === 'self-problem')?.tone, 'warning')
                assert.equal(entries[0].status, 'attention')
            } else if (state === 'problem') {
                assert.equal(card.tone, 'critical')
                assert.equal(badges.find(b => b.key === 'self-problem')?.tone, 'problem')
                assert.equal(entries[0].status, 'problem')
            } else if (state === 'healthy') {
                assert.equal(badges.length, 0)
                assert.equal(entries.length, 0)
            }
        })
    }

    it('keeps Released healthy and Pending in attention, with Failed and Lost red', () => {
        const group = resource('persistentvolume'); group.data.IsTopologyGroup = true
        group.children = [resource('persistentvolume', 'Released'), resource('persistentvolume', 'Failed'),
            resource('persistentvolumeclaim', 'Pending'), resource('persistentvolumeclaim', 'Lost'), resource('persistentvolume', 'Available')]
        const summary = kubernetesTopologyDirectChildSummary(group)
        assert.equal(summary.selfProblematic.length, 2)
        assert.equal(summary.attentionRequired.length, 1)
        assert.equal(summary.healthy.length, 2)
        assert.equal(kubernetesTopologyNodeNeedsAttention(group.children[0]), false)
    })

    it('keeps API Bound truth independent of missing related inventory and optional events', () => {
        const node = resource('persistentvolumeclaim', 'Bound', { VolumeName: 'pv-not-in-inventory' })
        node.data.K8s.Events = undefined
        assert.equal(kubernetesResourceSelfStatus(node).state, 'healthy')
        assert.equal(kubernetesStorageOperationalPresentation(kubernetesStorageObservation(node.data)).verdict, '정상')
    })

    it('honors explicit unavailable/stale collection instead of promoting cached phase to healthy', () => {
        for (const marker of ['unavailable', 'stale']) {
            const node = resource('persistentvolume', 'Bound', { ClaimRef: { Name: 'claim' } })
            node.data.CollectionState = marker
            const self = kubernetesResourceSelfStatus(node)
            assert.equal(self.state, 'unknown')
            assert.equal(topologyNodeStatusPresentation(node).label, '미확인')
            assert.equal(kubernetesStorageOperationalPresentation({ ...kubernetesStorageObservation(node.data), collection: self.collection }).verdict, '미확인')
        }
    })

    it('handles lowercase Kubernetes observations and refuses an unknown phase', () => {
        const data = { Type: 'persistentvolume', K8s: { Extra: { status: { phase: 'Released' }, spec: { claimRef: { name: 'old' } } } } }
        const observation = kubernetesStorageObservation(data)
        assert.equal(observation.phase, 'Released')
        assert.equal(observation.claimName, 'old')
        assert.equal(kubernetesStorageOperationalPresentation(observation).tone, 'success')
        assert.equal(kubernetesResourceSelfStatus(resource('persistentvolume')).collection, 'unavailable')
    })

    it('shares flattened and object status aliases used by storage detail mappings', () => {
        const node = resource('persistentvolumeclaim')
        node.data.K8s = { StatusObject: { Phase: 'Bound' }, Spec: { VolumeName: 'actual-pv' } }
        assert.equal(kubernetesResourceSelfStatus(node).state, 'healthy')
        assert.equal(topologyNodeStatusPresentation(node).label, '정상')
        assert.equal(kubernetesStorageOperationalPresentation(kubernetesStorageObservation(node.data)).verdict, '정상')
        const pv = { Type: 'persistentvolume', Status: 'Bound', K8s: { Spec: { ClaimRef: { Name: 'actual-claim' } } } }
        assert.equal(kubernetesStorageOperationalPresentation(kubernetesStorageObservation(pv)).verdict, '정상')
    })
})
