import { strict as assert } from 'assert'
import {
    kubernetesCreationTimestamp,
    kubernetesContainerStateReason,
    kubernetesImpactLabel,
    kubernetesDefaultStorageClass,
    kubernetesBooleanSettingLabel,
    kubernetesReclaimPolicyLabel,
    kubernetesVolumeBindingModeLabel,
    kubernetesVolumeBindingModePresentation,
    formatKubernetesTimestamp,
    kubernetesDaemonSetNodeLabel,
    kubernetesReplicaLabel,
    kubernetesSingleResourceValuePresentation,
    kubernetesCollectionPresentation,
    kubernetesConfiguredResourceTotalPresentation,
    kubernetesConfigurationCoveragePresentation,
    kubernetesMetadataKeyLabel,
    kubernetesMetadataValueDescription,
    kubernetesNamespacePhaseLabel,
    kubernetesPvcPhaseLabel,
    kubernetesPvPhaseLabel,
    kubernetesVolumeModeLabel,
    kubernetesVolumeSourceTypeLabel,
    kubernetesAccessModesLabel,
    kubernetesResourceConfigurationCollectionState,
    kubernetesRecentInstabilityTone
} from '../src/DataPanels/common/KubernetesDataPresentation'

describe('Kubernetes data presentation', () => {
    it('uses one recent-instability tone across every operational status card', () => {
        assert.equal(kubernetesRecentInstabilityTone(0, 'default'), 'success')
        assert.equal(kubernetesRecentInstabilityTone('없음', 'default'), 'success')
        assert.equal(kubernetesRecentInstabilityTone('0건', 'warning'), 'success')
        assert.equal(kubernetesRecentInstabilityTone(1, 'warning'), 'warning')
        assert.equal(kubernetesRecentInstabilityTone(3, 'danger'), 'danger')
        assert.equal(kubernetesRecentInstabilityTone('확인 불가', 'warning'), 'default')
        assert.equal(kubernetesRecentInstabilityTone('미수집', 'danger'), 'default')
        assert.equal(kubernetesRecentInstabilityTone('stale', 'danger'), 'default')
        assert.equal(kubernetesRecentInstabilityTone('unavailable', 'warning'), 'default')
    })

    it('shows only an actual reason from the current container state', () => {
        assert.equal(kubernetesContainerStateReason({ state: 'RUNNING', lastTerminatedReason: 'OOMKilled' }), undefined)
        assert.equal(kubernetesContainerStateReason({ state: 'RUNNING' }), undefined)
        assert.equal(kubernetesContainerStateReason({ state: 'WAITING', waitingReason: 'CrashLoopBackOff' }), 'CrashLoopBackOff')
        assert.equal(kubernetesContainerStateReason({ state: 'TERMINATED', terminatedReason: 'OOMKilled' }), 'OOMKilled')
        assert.equal(kubernetesContainerStateReason({ state: 'WAITING', waitingReason: '' }), undefined)
    })

    it('uses one compact label for no-impact operational states', () => {
        assert.equal(kubernetesImpactLabel('확인된 가용성 영향 없음'), '영향 없음')
        assert.equal(kubernetesImpactLabel('확인된 영향 없음'), '영향 없음')
        assert.equal(kubernetesImpactLabel('현재 영향 없음'), '영향 없음')
        assert.equal(kubernetesImpactLabel('목표 복제본 충족'), '목표 복제본 충족')
        assert.equal(kubernetesImpactLabel('가용성 영향 확인 필요'), '가용성 확인 필요')
        assert.equal(kubernetesImpactLabel('워크로드 2개 미가용'), '2개 미가용')
    })

    it('formats StorageClass policy values without losing their raw meaning', () => {
        assert.equal(kubernetesReclaimPolicyLabel('Delete'), '삭제')
        assert.equal(kubernetesReclaimPolicyLabel('Retain'), '유지')
        assert.equal(kubernetesVolumeBindingModeLabel('WaitForFirstConsumer'), '사용 시 바인딩')
        assert.equal(kubernetesVolumeBindingModeLabel('Immediate'), '즉시 바인딩')
        assert.deepEqual(kubernetesVolumeBindingModePresentation('WaitForFirstConsumer'), {
            label: '사용 시 바인딩',
            description: '이 스토리지 클래스를 사용하는 파드의 배치 위치가 결정된 후 볼륨을 바인딩합니다.',
            rawValue: 'WaitForFirstConsumer'
        })
        assert.equal(kubernetesDefaultStorageClass({ 'storageclass.kubernetes.io/is-default-class': 'true' }, false), true)
        assert.equal(kubernetesDefaultStorageClass({ 'storageclass.beta.kubernetes.io/is-default-class': 'false' }, true), false)
        assert.equal(kubernetesDefaultStorageClass(undefined, true), true)
        assert.equal(kubernetesDefaultStorageClass(undefined), undefined)
        assert.equal(kubernetesBooleanSettingLabel(true, { collected: true, enabledLabel: '지원', disabledLabel: '지원하지 않음' }), '지원')
        assert.equal(kubernetesBooleanSettingLabel(false, { collected: true, enabledLabel: '지원', disabledLabel: '지원하지 않음' }), '지원하지 않음')
        assert.equal(kubernetesBooleanSettingLabel(undefined, { collected: true, enabledLabel: '지원', disabledLabel: '지원하지 않음' }), '설정되지 않음')
        assert.equal(kubernetesBooleanSettingLabel(undefined, { collected: false, enabledLabel: '지원', disabledLabel: '지원하지 않음' }), '수집되지 않음')
    })

    it('keeps single-container resource values distinct without duplicate state text', () => {
        const format = (value: number) => `${value} unit`
        assert.equal(kubernetesSingleResourceValuePresentation({ configuredContainers: 1, collected: true, aggregate: 100, format }), '100 unit')
        assert.equal(kubernetesSingleResourceValuePresentation({ configuredContainers: 0, collected: true, format }), '미설정')
        assert.equal(kubernetesSingleResourceValuePresentation({ configuredContainers: 0, collected: false, format }), '수집되지 않음')
        assert.equal(kubernetesSingleResourceValuePresentation({ configuredContainers: 1, collected: true, format }), '확인 불가')
        assert.equal(kubernetesSingleResourceValuePresentation({ configuredContainers: 1, collected: true, aggregate: 0, format }), '0 unit')
    })

    it('uses one Replica vocabulary and formats collected timestamps', () => {
        assert.equal(kubernetesReplicaLabel('desired'), '목표 복제본')
        assert.equal(kubernetesReplicaLabel('ready'), '준비 복제본')
        assert.equal(kubernetesReplicaLabel('updated'), '업데이트 복제본')
        assert.equal(kubernetesReplicaLabel('desired', true), '목표')
        assert.notEqual(formatKubernetesTimestamp('2026-07-24T00:33:40Z'), '')
        assert.equal(formatKubernetesTimestamp({}), '')
    })

    it('uses one DaemonSet node-placement vocabulary', () => {
        assert.equal(kubernetesDaemonSetNodeLabel('desired'), '배치 대상 노드')
        assert.equal(kubernetesDaemonSetNodeLabel('current'), '현재 배치 노드')
        assert.equal(kubernetesDaemonSetNodeLabel('misscheduled'), '비대상 배치')
        assert.equal(kubernetesDaemonSetNodeLabel('updated', true), '업데이트')
    })

    it('reads creation time from collector and Kubernetes API metadata shapes', () => {
        assert.equal(kubernetesCreationTimestamp({ K8s: { Extra: { ObjectMeta: { CreationTimestamp: { Time: '2026-08-01T01:02:03Z' } } } } }), '2026-08-01T01:02:03Z')
        assert.equal(kubernetesCreationTimestamp({ K8s: { Extra: { metadata: { creationTimestamp: '2026-08-02T01:02:03Z' } } } }), '2026-08-02T01:02:03Z')
        assert.equal(kubernetesCreationTimestamp({ K8s: { CreationTimestamp: '2026-08-03T01:02:03Z' } }), '2026-08-03T01:02:03Z')
        assert.equal(kubernetesCreationTimestamp({
            K8s: {
                Extra: { ObjectMeta: { CreationTimestamp: { Time: {} } } },
                CreationTimestamp: '2026-07-24T00:33:40Z'
            }
        }), '2026-07-24T00:33:40Z')
        assert.equal(kubernetesCreationTimestamp({}), undefined)
    })
    it('keeps resource configuration states distinct', () => {
        assert.equal(kubernetesConfigurationCoveragePresentation(0, 0, false).label, '수집되지 않음')
        assert.equal(kubernetesConfigurationCoveragePresentation(0, 2, true).label, '설정되지 않음')
        assert.equal(kubernetesConfigurationCoveragePresentation(1, 2, true).label, '일부 설정')
        assert.equal(kubernetesConfigurationCoveragePresentation(2, 2, true).label, '설정됨')
        assert.equal(kubernetesConfigurationCoveragePresentation(0, 0, false).value, '확인 불가')
    })

    it('distinguishes an absent resource key from an explicit zero aggregate', () => {
        const formatCPU = (value: number) => `${value * 1000} mCore`
        assert.equal(kubernetesConfiguredResourceTotalPresentation({
            configuredContainers: 0,
            collected: true,
            aggregate: 0,
            format: formatCPU
        }), '미설정')
        assert.equal(kubernetesConfiguredResourceTotalPresentation({
            configuredContainers: 1,
            collected: true,
            aggregate: 0,
            format: formatCPU
        }), '0 mCore')
        assert.equal(kubernetesConfiguredResourceTotalPresentation({
            configuredContainers: 1,
            collected: true,
            aggregate: 0,
            format: value => `${value} MiB`
        }), '0 MiB')
        assert.equal(kubernetesConfiguredResourceTotalPresentation({
            configuredContainers: 1,
            collected: false,
            aggregate: 0,
            format: formatCPU
        }), '확인 불가')
    })

    it('preserves partial state for each collection source', () => {
        const partial = kubernetesCollectionPresentation([
            { key: 'pods', label: '워크로드·파드', state: 'partial' },
            { key: 'services', label: '서비스', state: 'uncollected' }
        ])
        assert.equal(partial.label, '부분 수집')
        assert.ok(partial.detail.includes('부분 수집: 워크로드·파드'))
        assert.ok(partial.detail.includes('수집되지 않음: 서비스'))
    })

    it('does not report full collection when one source is absent', () => {
        const partial = kubernetesCollectionPresentation([
            { key: 'objects', label: '객체 상태', collected: true },
            { key: 'resources', label: 'Requests/Limits', collected: false }
        ])
        assert.equal(partial.label, '부분 수집')
        assert.equal(partial.tone, 'warning')
        assert.ok(partial.detail.includes('수집됨: 객체 상태'))
        assert.ok(partial.detail.includes('수집되지 않음: Requests/Limits'))
    })

    it('reports collection failure only when essential resource evidence is absent', () => {
        const failed = kubernetesCollectionPresentation([
            { key: 'object', label: 'PVC 기본 정보', collected: false, essential: true },
            { key: 'events', label: '최근 불안정성', collected: true }
        ])
        assert.equal(failed.label, '수집 실패')
        assert.equal(failed.tone, 'danger')
        assert.ok(failed.detail.includes('수집됨: 최근 불안정성'))
        assert.ok(failed.detail.includes('수집되지 않음: PVC 기본 정보'))
    })

    it('keeps Requests/Limits collection state shared across resource panels', () => {
        assert.equal(kubernetesResourceConfigurationCollectionState([
            { configuredContainers: 0, collected: true },
            { configuredContainers: 1, collected: true, aggregate: 0 }
        ]), 'collected')
        assert.equal(kubernetesResourceConfigurationCollectionState([
            { configuredContainers: 1, collected: true },
            { configuredContainers: 0, collected: true }
        ]), 'partial')
        assert.equal(kubernetesResourceConfigurationCollectionState([
            { configuredContainers: 0, collected: false }
        ]), 'uncollected')
    })

    it('uses the shared Korean Namespace phase vocabulary', () => {
        assert.equal(kubernetesNamespacePhaseLabel('Active'), '활성')
        assert.equal(kubernetesNamespacePhaseLabel('Terminating'), '종료 중')
    })

    it('uses shared Korean PVC storage vocabulary without losing Kubernetes values', () => {
        assert.equal(kubernetesPvcPhaseLabel('Bound'), '바인딩 완료')
        assert.equal(kubernetesPvcPhaseLabel('Pending'), '바인딩 대기')
        assert.equal(kubernetesPvcPhaseLabel('Lost'), '바인딩 손실')
        assert.equal(kubernetesVolumeModeLabel('Filesystem'), '파일시스템')
        assert.equal(kubernetesVolumeModeLabel('Block'), '블록')
        assert.equal(kubernetesAccessModesLabel(['ReadWriteOnce']), '단일 노드 읽기/쓰기')
        assert.equal(kubernetesAccessModesLabel(['ReadOnlyMany', 'ReadWriteMany']), '다중 노드 읽기 전용, 다중 노드 읽기/쓰기')
        assert.equal(kubernetesAccessModesLabel(['ReadWriteOncePod']), '단일 파드 읽기/쓰기')
    })

    it('uses shared Korean PV phase and volume-source vocabulary', () => {
        assert.equal(kubernetesPvPhaseLabel('Available'), '사용 가능')
        assert.equal(kubernetesPvPhaseLabel('Bound'), '바인딩 완료')
        assert.equal(kubernetesPvPhaseLabel('Released'), '클레임 해제')
        assert.equal(kubernetesPvPhaseLabel('Failed'), '바인딩 실패')
        assert.equal(kubernetesVolumeSourceTypeLabel('HostPath'), '호스트 경로')
        assert.equal(kubernetesVolumeSourceTypeLabel('Local'), '로컬 볼륨')
        assert.equal(kubernetesVolumeSourceTypeLabel('CSI'), 'CSI')
    })

    it('describes long kubectl metadata without repeating its JSON value', () => {
        const description = kubernetesMetadataValueDescription(
            'kubectl.kubernetes.io/last-applied-configuration',
            '{"kind":"Namespace"}'
        )
        assert.ok(description?.includes('kubectl apply'))
        assert.ok(description?.includes('JSON'))
        assert.ok(!description?.includes('Namespace'))
        assert.equal(kubernetesMetadataKeyLabel('kubectl.kubernetes.io/last-applied-configuration'), 'kubectl 적용 구성')
        assert.equal(kubernetesMetadataKeyLabel('example.com/key'), 'example.com/key')
    })
})
