import { strict as assert } from 'assert'

import { kubernetesPvcOperationalPresentation } from '../src/KubernetesPersistentVolumeClaimDetailAggregation'

describe('Kubernetes PVC detail aggregation', () => {
    it('treats a Bound PVC with its named PV relation as healthy', () => {
        const result = kubernetesPvcOperationalPresentation({
            phase: 'Bound',
            volumeName: 'pvc-volume-1',
            boundPvFound: true
        })
        assert.equal(result.verdict, '정상')
        assert.equal(result.tone, 'success')
        assert.equal(result.impact, '확인된 영향 없음')
        assert.equal(result.currentProblem, '없음')
    })

    it('does not let event collection state alter PVC binding health', () => {
        const result = kubernetesPvcOperationalPresentation({
            phase: 'Bound',
            volumeName: 'pvc-volume-1',
            boundPvFound: true
        })
        assert.equal(result.verdict, '정상')
    })

    it('distinguishes Pending, Lost, and an unresolved Bound relation', () => {
        assert.equal(kubernetesPvcOperationalPresentation({ phase: 'Pending', boundPvFound: false }).currentProblem, '바인딩 대기')
        assert.equal(kubernetesPvcOperationalPresentation({ phase: 'Lost', boundPvFound: false }).tone, 'danger')
        const unresolved = kubernetesPvcOperationalPresentation({ phase: 'Bound', volumeName: 'pv-1', boundPvFound: false })
        assert.equal(unresolved.verdict, '보완 권장')
        assert.equal(unresolved.currentProblem, 'PV 관계 확인 필요')
    })
})
