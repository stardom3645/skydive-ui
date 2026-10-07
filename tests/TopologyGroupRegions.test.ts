import * as assert from 'assert'
import { topologyGroupRegions, topologyGroupRegionPath, topologyGroupRegionEnvelope, TopologyRegionNode } from '../src/TopologyGroupRegions'

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

    it('connects a sparse intermediate row with the wider resource area on either side', () => {
        const nodes = [node('cluster', undefined, { width: 420 }),
            node('workers', 'cluster', { y: 216, width: 900 }),
            node('namespace', 'cluster', { x: 350, y: 432, width: 380 }),
            node('storage', 'namespace', { x: 200, y: 648, width: 1100 })]
        const before = JSON.stringify(nodes)
        const bands = topologyGroupRegionEnvelope(nodes)
        assert.equal(bands.length, 4)
        const namespace = bands[2]
        assert.ok(namespace.left < 0) // keeps the group area through the empty middle space
        assert.ok(namespace.right - namespace.left >= 900)
        assert.ok(bands[0].left <= -258 && bands[0].right >= 258)
        for (let index = 1; index < bands.length; index++) assert.ok(bands[index].top > bands[index - 1].bottom)
        const region = topologyGroupRegions(nodes)[0]
        assert.equal((region.path.match(/M /g) || []).length, 1)
        assert.equal((region.path.match(/ Z/g) || []).length, 1)
        assert.strictEqual(JSON.stringify(nodes), before)
    })

    it('keeps expanded envelopes apart and reserves collapsed neighboring cards without moving nodes', () => {
        const nodes = [node('a'), node('a-child', 'a', { y: 400 }),
            node('b', undefined, { x: 380 }), node('b-child', 'b', { x: 380, y: 400 })]
        const before = JSON.stringify(nodes)
        const contains = (path: string, x: number, y: number) => {
            const coordinates = path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number)
            const points: Array<[number, number]> = []
            for (let index = 0; index < coordinates.length; index += 2) points.push([coordinates[index], coordinates[index + 1]])
            let inside = false
            for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
                const [xi, yi] = points[i], [xj, yj] = points[j]
                if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
            }
            return inside
        }
        const regions = topologyGroupRegions(nodes)
        for (let y = -60; y <= 460; y += 4) {
            assert.ok(contains(regions[0].clipPath!, 174, y))
            assert.ok(contains(regions[1].clipPath!, 206, y))
            assert.ok(!contains(regions[0].clipPath!, 190, y) && !contains(regions[1].clipPath!, 190, y))
        }
        assert.strictEqual(JSON.stringify(nodes), before)
        nodes[2].expanded = false
        const collapsed = topologyGroupRegions(nodes.slice(0, 3))
        assert.equal(collapsed.length, 1)
        assert.ok(!contains(collapsed[0].clipPath!, 190, 0))
        assert.ok(contains(collapsed[0].clipPath!, 140, 0))
    })
})
