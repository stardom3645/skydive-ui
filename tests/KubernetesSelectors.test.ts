import { strict as assert } from 'assert'
import { kubernetesLabelValue, matchesKubernetesSelector } from '../src/KubernetesSelectors'

describe('KubernetesSelectors', () => {
    const nodeExporterLabels = {
        app: {
            kubernetes: {
                'io/component': 'metrics',
                'io/instance': 'k8s-prom',
                'io/name': 'prometheus-node-exporter'
            }
        },
        release: 'k8s-prom'
    }

    it('matches nested labels produced from dotted Kubernetes label keys', () => {
        assert.equal(matchesKubernetesSelector({
            app: { kubernetes: { 'io/instance': 'k8s-prom', 'io/name': 'prometheus-node-exporter' } }
        }, nodeExporterLabels), true)
    })

    it('does not treat unrelated nested objects as equal', () => {
        assert.equal(matchesKubernetesSelector({
            app: { kubernetes: { 'io/name': 'prometheus' } }
        }, nodeExporterLabels), false)
    })

    it('supports MatchLabels and MatchExpressions', () => {
        assert.equal(matchesKubernetesSelector({
            MatchLabels: { release: 'k8s-prom' },
            MatchExpressions: [{ Key: 'app.kubernetes.io/name', Operator: 'In', Values: ['prometheus-node-exporter'] }]
        }, nodeExporterLabels), true)
    })

    it('reads flattened Kubernetes label paths from nested collector data', () => {
        const labels = { kubernetes: { 'io/service-name': 'prometheus-operated' } }
        assert.equal(kubernetesLabelValue(labels, 'kubernetes.io/service-name'), 'prometheus-operated')
    })
})
