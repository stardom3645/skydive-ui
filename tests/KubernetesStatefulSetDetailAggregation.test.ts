import { strict as assert } from 'assert'
import {
    evaluateStatefulSetRollout,
    statefulSetRelatedPvcNames,
    statefulSetRelatedServiceNames,
    statefulSetPersistentVolumeClaimNames,
    statefulSetPvcTemplateSummaries
} from '../src/KubernetesStatefulSetDetailAggregation'

describe('Kubernetes StatefulSet detail aggregation', () => {
    it('requires revisions and every replica view to agree before completing a rollout', () => {
        assert.deepEqual(evaluateStatefulSetRollout({
            desired: 3,
            ready: 3,
            current: 3,
            updated: 3,
            unavailable: 0,
            currentRevision: 'rev-2',
            updateRevision: 'rev-2'
        }), {
            label: '리비전 동기화 완료',
            tone: 'success',
            verdict: '정상',
            impact: '목표 복제본 충족',
            synchronized: true
        })

        const sameRevisionButIncomplete = evaluateStatefulSetRollout({
            desired: 3,
            ready: 3,
            current: 2,
            updated: 2,
            unavailable: 0,
            currentRevision: 'rev-2',
            updateRevision: 'rev-2'
        })
        assert.equal(sameRevisionButIncomplete.label, '업데이트 진행 중')
        assert.equal(sameRevisionButIncomplete.synchronized, false)
    })

    it('separates an available rollout from current availability loss', () => {
        const progressing = evaluateStatefulSetRollout({
            desired: 3, ready: 3, current: 2, updated: 2,
            currentRevision: 'rev-1', updateRevision: 'rev-2'
        })
        assert.equal(progressing.tone, 'info')
        assert.equal(progressing.impact, '확인된 가용성 영향 없음')

        const degraded = evaluateStatefulSetRollout({
            desired: 3, ready: 2, current: 3, updated: 3,
            currentRevision: 'rev-2', updateRevision: 'rev-2'
        })
        assert.equal(degraded.tone, 'warning')
        assert.equal(degraded.impact, '1개 복제본 미가용')
    })

    it('does not infer a rollout result from missing replica or revision data', () => {
        const result = evaluateStatefulSetRollout({ desired: 1, ready: 1 })
        assert.equal(result.label, '알 수 없음')
        assert.equal(result.tone, 'default')
    })

    it('normalizes PVC template details and keeps absent fields distinct', () => {
        assert.deepEqual(statefulSetPvcTemplateSummaries([{
            ObjectMeta: { Name: 'data' },
            Spec: {
                StorageClassName: 'fast',
                Resources: { Requests: { storage: '20Gi' } },
                AccessModes: ['ReadWriteOnce'],
                VolumeMode: 'Filesystem'
            }
        }, { ObjectMeta: { Name: 'cache' }, Spec: {} }]), [{
            name: 'data',
            storageClass: 'fast',
            requestedStorage: '20Gi',
            accessModes: 'ReadWriteOnce',
            volumeMode: 'Filesystem'
        }, {
            name: 'cache',
            storageClass: '설정되지 않음',
            requestedStorage: '설정되지 않음',
            accessModes: '설정되지 않음',
            volumeMode: '설정되지 않음'
        }])
    })

    it('combines only declared, selector and EndpointSlice service relations', () => {
        assert.deepEqual(statefulSetRelatedServiceNames(
            'headless',
            ['client', 'client'],
            ['metrics']
        ).sort(), ['client', 'headless', 'metrics'])
    })

    it('combines generated template claims with claims actually mounted by Pods', () => {
        assert.deepEqual(statefulSetRelatedPvcNames(
            'database',
            ['data'],
            ['shared-cache'],
            ['data-database-0', 'data-other-0', 'shared-cache', 'unrelated']
        ).sort(), ['data-database-0', 'shared-cache'])
    })

    it('finds PVCs directly referenced by the StatefulSet Pod template', () => {
        assert.deepEqual(statefulSetPersistentVolumeClaimNames({ Volumes: [
            { Name: 'data', VolumeSource: { PersistentVolumeClaim: { ClaimName: 'shared-data' } } },
            { Name: 'config', ConfigMap: { Name: 'config' } }
        ] }), ['shared-data'])
        assert.deepEqual(statefulSetPersistentVolumeClaimNames({ volumes: [
            { persistentVolumeClaim: { claimName: 'lowercase-data' } }
        ] }), ['lowercase-data'])
    })
})
