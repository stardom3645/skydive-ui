import * as assert from 'assert'
import { topologyGroupRegions, topologyGroupRegionPath, TopologyRegionNode } from '../src/TopologyGroupRegions'

const node = (id: string, parentID?: string, overrides: Partial<TopologyRegionNode> = {}): TopologyRegionNode => ({
    id, parentID, visible: true, expanded: true, x: 0, y: 0, width: 280, height: 92, ...overrides
})

describe('Topology subtree background regions', () => {
    it('keeps visible top-level branches separate through invisible layout spacers', () => {
        const result = topologyGroupRegions([
            node('root', undefined, { visible: false }),
            node('a', 'root'), node('b', 'root', { x: 1000 }),
            node('spacer', 'a', { visible: false, x: -9000 }),
            node('a-child', 'spacer', { y: 400 }), node('b-child', 'b', { x: 1000, y: 200 })
        ])
        assert.deepStrictEqual(result.map(region => [region.id, region.nodeIDs]), [
            ['a', ['a', 'a-child']], ['b', ['b', 'b-child']]
        ])
        assert.ok(!result[0].path.includes('-9000'))
    })

    it('omits collapsed or descendant-free roots and disconnected collapsed group proxies', () => {
        assert.deepStrictEqual(topologyGroupRegions([node('a', undefined, { expanded: false }), node('child', 'a')]), [])
        assert.deepStrictEqual(topologyGroupRegions([node('proxy'), node('collapsed', undefined, { expanded: false })]), [])
    })

    it('uses occupied row widths so a narrow middle row is not a rectangular bounding box', () => {
        const path = topologyGroupRegionPath([
            node('top', undefined, { width: 600 }), node('middle', 'top', { y: 200, width: 100 }),
            node('leaf', 'middle', { y: 400, width: 800, height: 108 })
        ])
        assert.ok(path.includes('L 66,270')) // narrow middle row, including only its margin
        assert.ok(/L 416,/.test(path)) // wider bottom row with a rounded end
        assert.strictEqual((path.match(/ C /g) || []).length, 6)
        assert.ok(path.endsWith(' Z'))
    })

    it('merges cards sharing a row and handles missing/invalid input without invalid SVG', () => {
        const result = topologyGroupRegionPath([node('left', undefined, { x: -160 }), node('right', undefined, { x: 160 })])
        assert.ok(result.includes('M -316,'))
        assert.ok(result.includes('316,'))
        assert.strictEqual(topologyGroupRegionPath([]), '')
        assert.strictEqual(topologyGroupRegionPath([node('bad', undefined, { x: NaN })]), '')
    })

    it('keeps tone and outline stable when sibling ordering changes, without altering layout/state', () => {
        const nodes = [node('a'), node('a-child', 'a', { y: 200 }), node('b', undefined, { x: 1000 }), node('b-child', 'b', { x: 1000, y: 200 })]
        const before = JSON.stringify(nodes)
        const first = topologyGroupRegions(nodes)
        const second = topologyGroupRegions([...nodes].reverse())
        first.forEach(region => {
            const other = second.find(item => item.id === region.id)!
            assert.strictEqual(region.variant, other.variant)
            assert.strictEqual(region.path, other.path)
        })
        assert.strictEqual(JSON.stringify(nodes), before)
    })
})
