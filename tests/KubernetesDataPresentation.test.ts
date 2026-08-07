import { strict as assert } from 'assert'
import {
    kubernetesCreationTimestamp,
    formatKubernetesTimestamp,
    kubernetesReplicaLabel,
    kubernetesCollectionPresentation,
    kubernetesConfiguredResourceTotalPresentation,
    kubernetesConfigurationCoveragePresentation,
    kubernetesMetadataKeyLabel,
    kubernetesMetadataValueDescription,
    kubernetesNamespacePhaseLabel,
    kubernetesResourceConfigurationCollectionState
} from '../src/DataPanels/common/KubernetesDataPresentation'

describe('Kubernetes data presentation', () => {
    it('uses one Replica vocabulary and formats collected timestamps', () => {
        assert.equal(kubernetesReplicaLabel('desired'), '목표 복제본')
        assert.equal(kubernetesReplicaLabel('ready'), '준비 복제본')
        assert.equal(kubernetesReplicaLabel('updated'), '업데이트 복제본')
        assert.equal(kubernetesReplicaLabel('desired', true), '목표')
        assert.notEqual(formatKubernetesTimestamp('2026-07-24T00:33:40Z'), '')
        assert.equal(formatKubernetesTimestamp({}), '')
    })

    it('reads creation time from collector and Kubernetes API metadata shapes', () => {
        assert.equal(kubernetesCreationTimestamp({ K8s: { Extra: { ObjectMeta: { CreationTimestamp: { Time: '2026-08-01T01:02:03Z' } } } } }), '2026-08-01T01:02:03Z')
        assert.equal(kubernetesCreationTimestamp({ K8s: { Extra: { metadata: { creationTimestamp: '2026-08-02T01:02:03Z' } } } }), '2026-08-02T01:02:03Z')
        assert.equal(kubernetesCreationTimestamp({ K8s: { CreationTimestamp: '2026-08-03T01:02:03Z' } }), '2026-08-03T01:02:03Z')
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
        assert.ok(partial.detail.includes('워크로드·파드: 부분 수집'))
        assert.ok(partial.detail.includes('서비스: 수집되지 않음'))
    })

    it('does not report full collection when one source is absent', () => {
        const partial = kubernetesCollectionPresentation([
            { key: 'objects', label: '객체 상태', collected: true },
            { key: 'resources', label: 'Requests/Limits', collected: false }
        ])
        assert.equal(partial.label, '부분 수집')
        assert.equal(partial.tone, 'warning')
        assert.ok(partial.detail.includes('객체 상태: 수집됨'))
        assert.ok(partial.detail.includes('Requests/Limits: 수집되지 않음'))
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
