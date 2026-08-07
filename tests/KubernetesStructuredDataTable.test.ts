import { strict as assert } from 'assert'
import { toggleKubernetesStructuredExpandedKey } from '../src/DataPanels/common/KubernetesStructuredDataState'

describe('Kubernetes structured data table expansion', () => {
    it('opens and closes exactly once per stable metadata key', () => {
        const opened = toggleKubernetesStructuredExpandedKey([], 'operator')
        assert.deepEqual(opened, ['operator'])
        const closed = toggleKubernetesStructuredExpandedKey(opened, 'operator')
        assert.deepEqual(closed, [])
        assert.deepEqual(toggleKubernetesStructuredExpandedKey(closed, 'operator'), ['operator'])
    })

    it('does not disturb another expanded metadata row', () => {
        assert.deepEqual(toggleKubernetesStructuredExpandedKey(['first'], 'second'), ['first', 'second'])
        assert.deepEqual(toggleKubernetesStructuredExpandedKey(['first', 'second'], 'first'), ['second'])
    })
})
