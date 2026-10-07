import { strict as assert } from 'assert'
import { topologyCardPresentationScale } from '../src/TopologyCardScale'

describe('Topology card presentation scale', () => {
    it('preserves the complete card at low zoom with a stable screen size', () => {
        for (const zoom of [0.1, 0.27, 0.34, 0.5, 0.72]) {
            assert.ok(Math.abs(zoom * topologyCardPresentationScale(zoom) - 0.72) < 1e-10)
        }
    })
    it('lets cards enlarge naturally above the readable floor', () => {
        for (const zoom of [0.8, 1, 1.5]) assert.equal(topologyCardPresentationScale(zoom), 1)
    })
    it('handles invalid scale inputs without invalid SVG dimensions', () => {
        for (const zoom of [0, -1, NaN, Infinity]) assert.equal(topologyCardPresentationScale(zoom), 1)
    })
})
