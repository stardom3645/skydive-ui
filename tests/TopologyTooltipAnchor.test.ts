import * as assert from 'assert'
import { topologyTooltipAnchorValid, watchTopologyTooltipAnchor } from '../src/TopologyTooltipAnchor'

const original = { left: 100, top: 100, width: 30, height: 30 }
const viewport = { width: 800, height: 600 }

describe('Topology status tooltip anchor lifecycle', () => {
    it('rejects D3 movement and zoom while tolerating subpixel rounding', () => {
        assert.strictEqual(topologyTooltipAnchorValid(true, original, original, viewport), true)
        assert.strictEqual(topologyTooltipAnchorValid(true, { ...original, left: 100.2 }, original, viewport), true)
        assert.strictEqual(topologyTooltipAnchorValid(true, { ...original, top: 150 }, original, viewport), false)
        assert.strictEqual(topologyTooltipAnchorValid(true, { ...original, width: 45 }, original, viewport), false)
    })
    it('rejects detached, hidden, offscreen and invalid SVG anchors', () => {
        assert.strictEqual(topologyTooltipAnchorValid(false, original, original, viewport), false)
        for (const rect of [
            { ...original, width: 0 }, { ...original, height: 0 },
            { ...original, left: 900 }, { ...original, top: -40 },
            { ...original, left: NaN }
        ]) assert.strictEqual(topologyTooltipAnchorValid(true, rect, rect, viewport), false)
    })
    it('dismisses once during an SVG transition and stops scheduling frames', () => {
        let rect = original
        let callback: FrameRequestCallback | undefined
        let scheduled = 0
        let dismissed = 0
        watchTopologyTooltipAnchor({ isConnected: true, getBoundingClientRect: () => rect as DOMRect }, () => dismissed++, {
            request: next => { callback = next; return ++scheduled }, cancel: () => undefined, viewport: () => viewport
        })
        rect = { ...original, left: 200 }
        callback!(0)
        callback!(1)
        assert.strictEqual(dismissed, 1)
        assert.strictEqual(scheduled, 1)
    })
    it('cancels monitoring on close/unmount and leaves stable interactive tooltip content usable', () => {
        let callback: FrameRequestCallback | undefined
        let scheduled = 0
        let cancelled = 0
        let dismissed = 0
        const dispose = watchTopologyTooltipAnchor({ isConnected: true, getBoundingClientRect: () => original as DOMRect }, () => dismissed++, {
            request: next => { callback = next; return ++scheduled }, cancel: id => { cancelled = id }, viewport: () => viewport
        })
        callback!(0)
        assert.strictEqual(dismissed, 0)
        dispose()
        callback!(1)
        assert.strictEqual(scheduled, 2)
        assert.strictEqual(cancelled, 2)
        assert.strictEqual(dismissed, 0)
    })
})
