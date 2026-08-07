import { strict as assert } from 'assert'
import {
    normalizeKubernetesMetadata,
    serializeKubernetesMetadata
} from '../src/DataPanels/common/KubernetesMetadataPresentation'

describe('Kubernetes metadata presentation', () => {
    it('summarizes JSON annotations instead of printing the full value', () => {
        const entries = normalizeKubernetesMetadata({
            'kubectl.kubernetes.io/last-applied-configuration': '{"kind":"Service","metadata":{"name":"api"}}'
        })
        assert.equal(entries.length, 1)
        assert.equal(entries[0].displayKey, 'kubectl 적용 구성')
        assert.equal(entries[0].displayValue, 'JSON 객체 · 2개 필드')
        assert.equal(entries[0].structured, true)
        assert.equal(entries[0].copyValue.indexOf('\n') >= 0, true)
    })

    it('normalizes a once double-escaped JSON string', () => {
        const entries = normalizeKubernetesMetadata({ value: JSON.stringify('{"enabled":true}') })
        assert.equal(entries[0].displayValue, 'JSON 객체 · 1개 필드')
        assert.equal(entries[0].copyValue, '{\n  "enabled": true\n}')
    })

    it('keeps plain strings and excludes requested keys', () => {
        const entries = normalizeKubernetesMetadata({ hidden: 'x', team: 'platform' }, ['hidden'])
        assert.deepEqual(entries.map(entry => [entry.key, entry.displayValue]), [['team', 'platform']])
        assert.equal(serializeKubernetesMetadata(entries), '{\n  "team": "platform"\n}')
    })
})
