import { strict as assert } from 'assert'
import {
    kubernetesSelectorEntries,
    normalizeKubernetesLabelSelector,
    normalizeKubernetesSimpleSelector
} from '../src/DataPanels/common/KubernetesSelectorPresentation'

describe('Kubernetes selector summary', () => {
    it('keeps matchLabels and matchExpressions structurally separate', () => {
        assert.deepEqual(kubernetesSelectorEntries({
            MatchLabels: { app: 'database', 'app.kubernetes.io': { component: 'primary' } },
            MatchExpressions: [
                { Key: 'zone', Operator: 'In', Values: ['a', 'b'] },
                { Key: 'maintenance', Operator: 'DoesNotExist' }
            ]
        }), [
            { kind: 'label', key: 'app', operator: '=', values: ['database'] },
            { kind: 'label', key: 'app.kubernetes.io.component', operator: '=', values: ['primary'] },
            { kind: 'expression', key: 'zone', operator: 'In', values: ['a', 'b'] },
            { kind: 'expression', key: 'maintenance', operator: 'DoesNotExist', values: [] }
        ])
    })

    it('supports a flat collector selector without inventing expressions', () => {
        assert.deepEqual(kubernetesSelectorEntries({ app: 'api' }), [
            { kind: 'label', key: 'app', operator: '=', values: ['api'] }
        ])
    })

    it('keeps Service simple-map selectors distinct from LabelSelector', () => {
        assert.deepEqual(normalizeKubernetesSimpleSelector({ app: 'api', tier: 'backend' }), {
            labels: [{ key: 'app', value: 'api' }, { key: 'tier', value: 'backend' }],
            expressions: []
        })
        assert.deepEqual(normalizeKubernetesLabelSelector({
            matchLabels: { app: 'api' },
            matchExpressions: [{ key: 'zone', operator: 'In', values: ['a'] }]
        }), {
            labels: [{ key: 'app', value: 'api' }],
            expressions: [{ key: 'zone', operator: 'In', values: ['a'] }]
        })
    })
})
