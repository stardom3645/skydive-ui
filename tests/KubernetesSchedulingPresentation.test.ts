import { strict as assert } from 'assert'

import {
    kubernetesSchedulingMetadata,
    normalizeKubernetesSchedulingConfiguration
} from '../src/DataPanels/common/KubernetesSchedulingPresentation'

describe('Kubernetes scheduling presentation', () => {
    it('counts node selectors, node affinity terms and tolerations without flattening their payloads', () => {
        const configuration = normalizeKubernetesSchedulingConfiguration({
            NodeSelector: { role: 'infra', zone: 'a' },
            Affinity: {
                NodeAffinity: {
                    RequiredDuringSchedulingIgnoredDuringExecution: { NodeSelectorTerms: [{ MatchExpressions: [] }] },
                    PreferredDuringSchedulingIgnoredDuringExecution: [{ Weight: 10, Preference: {} }]
                }
            },
            Tolerations: [{ Key: 'dedicated', Operator: 'Exists' }]
        })
        assert.equal(configuration.nodeSelectionCount, 4)
        assert.equal(configuration.affinityConditionCount, 2)
        assert.equal(configuration.tolerationCount, 1)
        const metadata = kubernetesSchedulingMetadata(configuration)
        assert.equal(metadata.nodeSelector.role, 'infra')
        assert.deepEqual(metadata.tolerations['toleration 1'], { Key: 'dedicated', Operator: 'Exists' })
    })

    it('keeps absent scheduling fields distinct as empty configuration', () => {
        const configuration = normalizeKubernetesSchedulingConfiguration({})
        assert.equal(configuration.nodeSelectionCount, 0)
        assert.equal(configuration.tolerationCount, 0)
        assert.deepEqual(kubernetesSchedulingMetadata(configuration).affinity, {})
    })
})
