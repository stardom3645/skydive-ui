import * as assert from 'assert'
import { topologyBranchOffsets } from '../src/TopologyBranchSpacing'
import { topologyGroupRegions, topologyGroupRegionPath, topologyGroupRegionEnvelope, topologyHostRegionBounds, topologyHostRegionBands, TopologyRegionNode } from '../src/TopologyGroupRegions'

const node = (id: string, parentID?: string, overrides: Partial<TopologyRegionNode> = {}): TopologyRegionNode => ({
    id, parentID, visible: true, expanded: true, x: 0, y: 0, width: 280, height: 92, ...overrides
})

// Sample the actual SVG cubics, then use ray crossing to check containment.
const pathContains = (path: string, x: number, y: number) => {
    const tokens = path.match(/[MLCZ]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!
    const points: Array<[number, number]> = []
    let at: [number, number] = [0, 0], index = 0
    const point = (): [number, number] => [Number(tokens[index++]), Number(tokens[index++])]
    while (index < tokens.length) {
        const command = tokens[index++]
        if (command === 'M' || command === 'L') { at = point(); points.push(at) }
        else if (command === 'C') {
            const start = at, a = point(), b = point(), end = point()
            for (let step = 1; step <= 80; step++) {
                const t = step / 80, u = 1 - t
                points.push([0, 1].map(axis => u ** 3 * start[axis] + 3 * u ** 2 * t * a[axis]
                    + 3 * u * t ** 2 * b[axis] + t ** 3 * end[axis]) as [number, number])
            }
            at = end
        }
    }
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j]
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
    }
    return inside
}

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

    it('keeps large VM rows connected without spreading their full width into a sparse router row', () => {
        for (const count of [3, 15, 30, 60]) {
            const nodes = [node('host', undefined, { width: 580, height: 300 }),
                node('system', 'host', { y: 440, width: 440, height: 352 }),
                node('router', 'system', { x: -240, y: 880, width: 580, height: 380 }),
                ...Array.from({ length: count }, (_, index) => node(`vm-${index}`, 'router', {
                    x: (index - (count - 1) / 2) * 476, y: 1320, width: 440, height: 352 }))]
            const before = JSON.stringify(nodes)
            const bands = topologyGroupRegionEnvelope(nodes), regions = topologyGroupRegions(nodes)
            assert.equal(regions.length, 1)
            assert.equal(regions[0].nodeIDs.length, nodes.length)
            assert.ok(bands[2].right - bands[2].left <= 580 + 96 + 2 * 384)
            assert.ok(bands[3].right - bands[3].left >= (count - 1) * 476 + 440)
            assert.equal((regions[0].path.match(/M /g) || []).length, 1)
            assert.equal((regions[0].path.match(/ Z/g) || []).length, 1)
            assert.ok(!/NaN|Infinity/.test(regions[0].path))
            nodes.forEach(node => {
                for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
                    assert.ok(pathContains(regions[0].path, node.x + dx * node.width / 2, node.y + dy * node.height / 2),
                        `VM count ${count}: region must enclose ${node.id} corner ${dx},${dy}`)
                }
            })
            assert.equal(JSON.stringify(nodes), before)
        }
    })
})


describe('Infrastructure host rectangles', () => {
    it('encloses every row, NIC, badge and group backplate in a gently varying rounded host outline', () => {
        const nodes = [node('root', undefined, { visible: false }),
            node('host', 'root', { type: 'host', width: 580, height: 404, above: 41 }),
            node('router', 'host', { y: 700, width: 480, height: 558, above: 41 }),
            node('hidden', 'host', { visible: false, x: -9000, y: 20000 }),
            ...Array.from({ length: 25 }, (_, index) => node(`vm-${index}`, 'hidden', {
                x: (index % 7 - 3) * 544, y: 1600 + Math.floor(index / 7) * 800, width: 480, height: 558, above: 41 })),
            node('nic', 'vm-24', { x: 2400, y: 5200, width: 480, height: 230, above: 41 }),
            node('nic-group', 'vm-24', { x: 1800, y: 4800, width: 608, below: 24 })]
        const before = JSON.stringify(nodes), result = topologyGroupRegions(nodes, true)
        assert.equal(result.length, 1)
        const region = result[0], bounds = topologyHostRegionBounds(nodes)!
        assert.equal(region.id, 'host')
        assert.equal(region.nodeIDs.length, nodes.length - 2)
        assert.ok((region.path.match(/ C /g) || []).length >= 4)
        assert.equal(region.clipPath, undefined)
        const maxInset = (bounds.right - bounds.left) * 0.15
        assert.ok(pathContains(region.path, bounds.left + maxInset + 1, 300))
        assert.ok(pathContains(region.path, bounds.right - maxInset - 1, 300))
        nodes.filter(node => node.visible).forEach(node => {
            for (const dx of [-1, 1]) for (const dy of [-1, 1])
                assert.ok(pathContains(region.path, node.x + dx * node.width / 2,
                    node.y + dy * node.height / 2 + (dy < 0 ? -(node.above || 0) : node.below || 0)), node.id)
        })
        assert.equal(topologyHostRegionBounds([]), undefined)
        assert.equal(topologyHostRegionBounds([node('invalid', undefined, { x: NaN })]), undefined)
        assert.equal(JSON.stringify(nodes), before)
    })

    it('responds to sparse and wide levels with only small, smooth side changes inside the host envelope', () => {
        const nodes = [node('host', undefined, { type: 'host', width: 580, height: 404, above: 41 }),
            node('router', 'host', { y: 800, width: 100, above: 41 }),
            node('vm-row', 'host', { y: 1600, width: 2400, height: 558, above: 41 }),
            node('nic', 'vm-row', { x: 1060, y: 2300, width: 480, height: 230, above: 41 })]
        const before = JSON.stringify(nodes), bounds = topologyHostRegionBounds(nodes)!
        const bands = topologyHostRegionBands(nodes), region = topologyGroupRegions(nodes, true)[0]
        const narrow = bands.find(band => band.top <= 800 && band.bottom >= 800)!
        const wide = bands.find(band => band.top <= 1600 && band.bottom >= 1600)!
        const nic = bands.find(band => band.top <= 2300 && band.bottom >= 2300)!
        const maxInset = (bounds.right - bounds.left) * 0.15
        assert.ok(narrow.left > bounds.left && narrow.right < bounds.right)
        assert.ok(Math.abs(narrow.left - bounds.left - maxInset) < 0.000001)
        assert.ok(Math.abs(bounds.right - narrow.right - maxInset) < 0.000001)
        assert.ok(wide.left < narrow.left) // the wide VM row gently broadens the left side
        assert.ok(nic.right > wide.right) // a verified NIC broadens only the required side
        bands.forEach(band => {
            assert.ok(band.left >= bounds.left && band.left - bounds.left <= maxInset + 0.000001)
            assert.ok(band.right <= bounds.right && bounds.right - band.right <= maxInset + 0.000001)
        })
        nodes.forEach(node => {
            for (const dx of [-1, 1]) for (const dy of [-1, 1])
                assert.ok(pathContains(region.path, node.x + dx * node.width / 2,
                    node.y + dy * node.height / 2 + (dy < 0 ? -(node.above || 0) : 0)), node.id)
        })
        assert.ok(!pathContains(region.path, bounds.left - 1, 1100))
        assert.ok(!pathContains(region.path, bounds.right + 1, 1100))
        assert.equal(topologyHostRegionBands([]).length, 0)
        assert.equal(JSON.stringify(nodes), before)
    })

    it('assigns descendants to their own host even underneath a visible switch and through hidden wrappers', () => {
        const nodes = [node('switch', undefined, { type: 'switch' }),
            node('port', 'switch', { y: 300 }),
            node('host-a', 'port', { type: 'host', x: -700, y: 700 }),
            node('host-b', 'port', { type: 'host', x: 700, y: 700 }),
            node('spacer', 'host-a', { visible: false, x: -9000 }),
            node('vm-a', 'spacer', { x: -700, y: 1400 }),
            node('vm-b', 'host-b', { x: 700, y: 1400 })]
        const regions = topologyGroupRegions(nodes, true)
        assert.deepEqual(regions.find(region => region.id === 'host-a')!.nodeIDs, ['host-a', 'vm-a'])
        assert.deepEqual(regions.find(region => region.id === 'host-b')!.nodeIDs, ['host-b', 'vm-b'])
        assert.deepEqual(regions.find(region => region.id === 'switch')!.nodeIDs, ['switch', 'port'])
        assert.equal(topologyGroupRegions(nodes).length, 1)
    })

    it('keeps unequal rectangular silhouettes separate and reserves collapsed neighbors', () => {
        const nodes = [node('a', undefined, { type: 'host' }), node('a-vm', 'a', { x: 700, y: 1600 }),
            node('b', undefined, { type: 'host', x: 800 }), node('b-nic', 'b', { x: 500, y: 400 }),
            node('c', undefined, { type: 'host', x: 1500, expanded: false })]
        const before = JSON.stringify(nodes), offsets = topologyBranchOffsets(nodes, 80, false, true)
        const placed = nodes.map(node => ({ ...node, x: node.x + offsets.get(node.parentID || node.id)! }))
        const a = topologyHostRegionBounds(placed.filter(node => node.id === 'a' || node.parentID === 'a'))!
        const b = topologyHostRegionBounds(placed.filter(node => node.id === 'b' || node.parentID === 'b'))!
        const c = topologyHostRegionBounds(placed.filter(node => node.id === 'c'))!
        assert.ok(b.left - a.right >= 16)
        assert.ok(c.left - b.right >= 16)
        const regions = topologyGroupRegions(placed, true)
        assert.equal(regions.length, 2)
        assert.equal(regions.every(region => !region.clipPath), true)
        assert.equal(JSON.stringify(nodes), before)
    })
})

describe('Kubernetes cluster frames', () => {
    it('reuses the host silhouette and includes node/namespace/storage cards, badges and collapsed group backplates', () => {
        const nodes = [node('cluster', undefined, { type: 'cluster', width: 580, height: 380, above: 41 }),
            node('worker', 'cluster', { x: 800, y: 600, width: 440, height: 384, above: 41 }),
            node('namespace', 'cluster', { x: -300, y: 1200, width: 608, height: 384, below: 24 }),
            node('pv', 'namespace', { x: 1100, y: 1800, width: 340, height: 416, above: 41 })]
        const before = JSON.stringify(nodes), region = topologyGroupRegions(nodes, true)[0]
        assert.equal(region.id, 'cluster')
        const hostNodes = nodes.map(n => ({ ...n, type: n.id === 'cluster' ? 'host' : n.type }))
        assert.deepEqual(region, topologyGroupRegions(hostNodes, true)[0])
        const bounds = region.bounds!, maxInset = (bounds.right - bounds.left) * 0.15
        topologyHostRegionBands(nodes).forEach(band => {
            assert.ok(band.left - bounds.left <= maxInset + 0.000001)
            assert.ok(bounds.right - band.right <= maxInset + 0.000001)
        })
        nodes.forEach(n => {
            for (const dx of [-1, 1]) for (const dy of [-1, 1])
                assert.ok(pathContains(region.path, n.x + dx * n.width / 2,
                    n.y + dy * n.height / 2 + (dy < 0 ? -(n.above || 0) : n.below || 0)), n.id)
        })
        assert.equal(JSON.stringify(nodes), before)
    })

    it('separates broad cluster frames when sparse rows previously shared horizontal space', () => {
        const nodes = [node('a', undefined, { type: 'cluster', x: 0, height: 380 }),
            node('a-worker', 'a', { x: -500, y: 600, width: 1000, height: 384 }),
            node('a-storage', 'a', { x: 500, y: 1200, width: 1000, height: 416 }),
            node('b', undefined, { type: 'cluster', x: 1800, height: 380 }),
            node('b-worker', 'b', { x: 1300, y: 600, width: 1000, height: 384 }),
            node('b-storage', 'b', { x: 2300, y: 1200, width: 1000, height: 416 })]
        const before = JSON.stringify(nodes), offsets = topologyBranchOffsets(nodes, 80, false, true)
        const placed = nodes.map(n => ({ ...n, x: n.x + offsets.get(n.parentID || n.id)! }))
        const regions = topologyGroupRegions(placed, true)
        assert.ok(regions[1].bounds!.left - regions[0].bounds!.right >= 16)
        assert.deepEqual(regions.map(r => r.nodeIDs), [['a', 'a-worker', 'a-storage'], ['b', 'b-worker', 'b-storage']])
        assert.ok(Array.from(topologyBranchOffsets(placed, 80, false, true).values()).every(offset => Math.abs(offset) < 0.000001))
        assert.equal(JSON.stringify(nodes), before)
    })

    it('keeps clusters independent through hidden wrappers and does not create frames for collapsed roots', () => {
        const nodes = [node('root', undefined, { visible: false }),
            node('a', 'root', { type: 'cluster' }), node('hidden', 'a', { visible: false }),
            node('a-child', 'hidden', { y: 600 }),
            node('b', 'root', { type: 'cluster', x: 1400 }), node('b-child', 'b', { x: 1400, y: 600 }),
            node('collapsed', 'root', { type: 'cluster', expanded: false, x: 2800 })]
        const regions = topologyGroupRegions(nodes, true)
        assert.deepEqual(regions.map(r => r.id), ['a', 'b'])
        assert.deepEqual(regions[0].nodeIDs, ['a', 'a-child'])
        assert.deepEqual(regions[1].nodeIDs, ['b', 'b-child'])
    })
})
