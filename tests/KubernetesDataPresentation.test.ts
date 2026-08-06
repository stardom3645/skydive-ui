import { strict as assert } from 'assert'
import {
    kubernetesCollectionPresentation,
    kubernetesConfigurationCoveragePresentation,
    kubernetesMetadataKeyLabel,
    kubernetesMetadataValueDescription,
    kubernetesNamespacePhaseLabel
} from '../src/DataPanels/common/KubernetesDataPresentation'

describe('Kubernetes data presentation', () => {
    it('keeps resource configuration states distinct', () => {
        assert.equal(kubernetesConfigurationCoveragePresentation(0, 0, false).label, '수집되지 않음')
        assert.equal(kubernetesConfigurationCoveragePresentation(0, 2, true).label, '설정되지 않음')
        assert.equal(kubernetesConfigurationCoveragePresentation(1, 2, true).label, '일부 설정')
        assert.equal(kubernetesConfigurationCoveragePresentation(2, 2, true).label, '설정됨')
        assert.equal(kubernetesConfigurationCoveragePresentation(0, 0, false).value, '확인 불가')
    })

    it('preserves partial state for each collection source', () => {
        const partial = kubernetesCollectionPresentation([
            { key: 'pods', label: '워크로드·Pod', state: 'partial' },
            { key: 'services', label: 'Service', state: 'uncollected' }
        ])
        assert.equal(partial.label, '부분 수집')
        assert.ok(partial.detail.includes('워크로드·Pod: 부분 수집'))
        assert.ok(partial.detail.includes('Service: 수집되지 않음'))
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
