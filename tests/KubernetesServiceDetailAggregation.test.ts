import { strict as assert } from 'assert'
import { aggregateKubernetesServiceOperationalStatus } from '../src/KubernetesServiceDetailAggregation'
import { kubernetesTrafficPolicyLabel } from '../src/DataPanels/common/KubernetesDataPresentation'

describe('Kubernetes Service detail aggregation', () => {
    it('treats selector-less direct endpoints as healthy without requiring Pods', () => {
        const result = aggregateKubernetesServiceOperationalStatus({
            type: 'ClusterIP',
            selector: {},
            endpointDataAvailable: true,
            endpointCount: 1,
            readyEndpointCount: 1,
            notReadyEndpointCount: 0,
            selectedPods: [],
            endpoints: [{ address: '10.96.0.1', ready: true }]
        })
        assert.equal(result.selectorlessDirectEndpoints, true)
        assert.equal(result.verdict, '정상')
        assert.equal(result.impact, 'Ready 대상 확인')
        assert.equal(result.currentProblemCount, 0)
        assert.equal(result.readySummary, '1/1')
    })

    it('keeps collection failure distinct from an empty endpoint set', () => {
        const failed = aggregateKubernetesServiceOperationalStatus({ endpointDataAvailable: false })
        const empty = aggregateKubernetesServiceOperationalStatus({ endpointDataAvailable: true, endpoints: [] })
        assert.equal(failed.readySummary, '수집되지 않음')
        assert.equal(failed.currentProblemCount, undefined)
        assert.equal(empty.readySummary, '0/0')
        assert.equal(empty.currentProblemCount, 1)
        assert.equal(empty.tone, 'warning')
    })

    it('reports partial readiness once through the ready ratio and problem count', () => {
        const result = aggregateKubernetesServiceOperationalStatus({
            endpointDataAvailable: true,
            endpointCount: 3,
            readyEndpointCount: 2,
            notReadyEndpointCount: 1,
            endpoints: [{ ready: true }, { ready: true }, { ready: false }]
        })
        assert.equal(result.readySummary, '2/3')
        assert.equal(result.currentProblemCount, 1)
        assert.equal(result.tone, 'warning')
    })

    it('uses API readiness defaults and deduplicates repeated/dual-stack Pod targets', () => {
        const result = aggregateKubernetesServiceOperationalStatus({ endpointDataAvailable: true, endpoints: [
            { targetUid: 'pod-a', address: '10.0.0.1', ready: null },
            { targetUid: 'pod-a', address: 'fd00::1' },
            { targetUid: 'pod-a', address: '10.0.0.1', ready: true },
            { targetUid: 'pod-b', address: '10.0.0.2', ready: false }
        ] })
        assert.equal(result.readySummary, '1/2')
        assert.equal(result.currentProblemCount, 1)
        assert.ok(!result.impactDescription.includes('제공 중'))
    })

    it('does not claim external application availability from an ExternalName', () => {
        const result = aggregateKubernetesServiceOperationalStatus({ type: 'ExternalName' })
        assert.equal(result.currentProblemCount, 0)
        assert.equal(result.impact, 'DNS 별칭 설정됨')
        assert.ok(result.impactDescription.includes('확인하지 않았습니다'))
    })

    it('shows failed ExternalName queries as uncollected rather than healthy', () => {
        const result = aggregateKubernetesServiceOperationalStatus({ type: 'ExternalName', endpointDataAvailable: false, collectionState: 'unavailable' })
        assert.equal(result.verdict, '확인 불가')
        assert.equal(result.tone, 'default')
    })

    it('uses shared user-facing traffic policy labels', () => {
        assert.equal(kubernetesTrafficPolicyLabel('Cluster'), '클러스터 전체')
        assert.equal(kubernetesTrafficPolicyLabel('Local'), '로컬')
    })
})
