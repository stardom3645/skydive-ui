import { strict as assert } from 'assert'

import {
    kubernetesPvNodeAffinityPresentation,
    kubernetesPvOperationalPresentation,
    kubernetesPvSourcePresentation
} from '../src/KubernetesPersistentVolumeDetailAggregation'

describe('Kubernetes PV detail aggregation', () => {
    it('separates PV binding health from optional event collection', () => {
        const bound = kubernetesPvOperationalPresentation('Bound', 'claim-a')
        assert.equal(bound.verdict, '정상')
        assert.equal(bound.currentProblem, '없음')
        assert.equal(bound.impact, '확인된 영향 없음')

        const unresolved = kubernetesPvOperationalPresentation('Bound', '')
        assert.equal(unresolved.verdict, '보완 권장')
        assert.equal(unresolved.currentProblem, '클레임 참조 확인 필요')
    })

    it('distinguishes released and failed phases', () => {
        assert.equal(kubernetesPvOperationalPresentation('Released').tone, 'warning')
        assert.equal(kubernetesPvOperationalPresentation('Failed').tone, 'danger')
        assert.equal(kubernetesPvOperationalPresentation(undefined).verdict, '미확인')
    })

    it('renders HostPath fields from the actual source union', () => {
        const source = kubernetesPvSourcePresentation({
            hostPath: { path: '/var/lib/data', type: 'DirectoryOrCreate' }
        })
        assert.equal(source?.type, 'HostPath')
        assert.deepEqual(source?.fields, [
            { label: '호스트 경로', value: '/var/lib/data' },
            { label: '경로 유형', value: 'DirectoryOrCreate' }
        ])
    })

    it('keeps CSI and NFS source-specific fields separate', () => {
        const csi = kubernetesPvSourcePresentation({
            csi: { driver: 'example.csi.io', volumeHandle: 'volume-1', readOnly: true }
        })
        assert.equal(csi?.type, 'CSI')
        assert.ok(csi?.fields.some(field => field.label === '드라이버' && field.value === 'example.csi.io'))
        assert.ok(csi?.fields.some(field => field.label === '읽기 전용' && field.value === 'true'))

        const nfs = kubernetesPvSourcePresentation({ nfs: { server: '10.0.0.1', path: '/exports/data' } })
        assert.equal(nfs?.type, 'NFS')
        assert.ok(nfs?.fields.some(field => field.label === '서버'))
        assert.ok(!nfs?.fields.some(field => field.label === '드라이버'))
    })

    it('keeps a single metadata.name relation out of the affinity-policy modal', () => {
        const affinity = kubernetesPvNodeAffinityPresentation({
            required: {
                nodeSelectorTerms: [{
                    matchFields: [{ key: 'metadata.name', operator: 'In', values: ['worker-01'] }]
                }]
            }
        })
        assert.equal(affinity.simpleNodeName, 'worker-01')
        assert.equal(affinity.conditionCount, 1)
        assert.equal(affinity.showPolicyDetail, false)
    })

    it('preserves selector expressions and multiple affinity conditions for details', () => {
        const affinity = kubernetesPvNodeAffinityPresentation({
            Required: {
                NodeSelectorTerms: [{
                    MatchExpressions: [
                        { Key: 'kubernetes.io/hostname', Operator: 'In', Values: ['worker-01', 'worker-02'] },
                        { Key: 'storage-tier', Operator: 'In', Values: ['local'] }
                    ]
                }]
            }
        })
        assert.equal(affinity.simpleNodeName, undefined)
        assert.equal(affinity.conditionCount, 2)
        assert.equal(affinity.showPolicyDetail, true)
        assert.equal(affinity.conditions[0].scope, 'label')
        assert.deepEqual(affinity.conditions[0].values, ['worker-01', 'worker-02'])
    })
})
