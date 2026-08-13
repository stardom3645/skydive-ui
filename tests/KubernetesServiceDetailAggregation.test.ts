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
        assert.equal(result.impact, '정상 제공 중')
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

    it('uses shared user-facing traffic policy labels', () => {
        assert.equal(kubernetesTrafficPolicyLabel('Cluster'), '클러스터 전체')
        assert.equal(kubernetesTrafficPolicyLabel('Local'), '로컬')
    })
})
