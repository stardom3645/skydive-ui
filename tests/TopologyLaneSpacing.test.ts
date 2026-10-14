import { strict as assert } from 'assert'
import { topologyLaneBounds, topologyLaneOffsets, topologyLaneSeparators, INFRASTRUCTURE_TRAFFIC_LANE_GAP, TopologyLaneItem } from '../src/TopologyLaneSpacing'

describe('Topology traffic corridor spacing', () => {
    const items: TopologyLaneItem[] = [
        { weight: 7060, y: 0, height: 436, above: 27, below: 0 },
        { weight: 7060, y: 440, height: 136, above: 27, below: 0 },
        { weight: 7070, y: 700, height: 520, above: 27, below: 0 },
        { weight: 7080, y: 1140, height: 436, above: 27, below: 24 }
    ]
    it('leaves room below the lowest expanded NIC and includes the next row badge', () => {
        const offsets = topologyLaneOffsets(items, INFRASTRUCTURE_TRAFFIC_LANE_GAP)
        const bottom = (n: TopologyLaneItem) => n.y + offsets.get(n.weight)! + n.height / 2 + n.below
        const top = (n: TopologyLaneItem) => n.y + offsets.get(n.weight)! - n.height / 2 - n.above
        assert.equal(top(items[2]) - Math.max(bottom(items[0]), bottom(items[1])), 160)
        assert.equal(top(items[3]) - bottom(items[2]), 160)
        assert.equal(offsets.get(7060), 0)
        const shifted = items.map(n => ({ ...n, y: n.y + offsets.get(n.weight)! }))
        assert.ok(Array.from(topologyLaneOffsets(shifted, INFRASTRUCTURE_TRAFFIC_LANE_GAP).values()).every(offset => offset === 0))
    })
    it('preserves the existing 48-unit spacing when no Infrastructure gap is supplied', () => {
        const offsets = topologyLaneOffsets(items)
        const upperBottom = items[1].y + offsets.get(7060)! + items[1].height / 2
        const lowerTop = items[2].y + offsets.get(7070)! - items[2].height / 2 - items[2].above
        assert.equal(lowerTop - upperBottom, 48)
    })
    it('keeps a boundary between touching padded Kubernetes lanes clear of cards and badges', () => {
        const upper = { weight: 1, y: 0, height: 340, above: 27, below: 0 }
        const lower = { weight: 2, y: 400, height: 384, above: 27, below: 0 }
        const offsets = topologyLaneOffsets([upper, lower])
        lower.y += offsets.get(2)!
        const levels = [upper, lower].map(item => {
            const bounds = topologyLaneBounds([item])
            return { weight: item.weight, bb: { y: bounds.top, height: bounds.bottom - bounds.top } }
        })
        const boundary = topologyLaneSeparators(levels).get(1)!
        assert.ok(boundary > upper.y + upper.height / 2)
        assert.ok(boundary < lower.y - lower.height / 2 - lower.above)
    })
    it('reserves a caption before the host level without increasing other lane gaps', () => {
        const nodes = [{ weight: 5015, y: 0, height: 148, above: 0, below: 0 },
            { weight: 5020, y: 200, height: 404, above: 41, below: 0 },
            { weight: 5030, y: 500, height: 148, above: 41, below: 0 }]
        const offsets = topologyLaneOffsets(nodes, 160, { 5020: 384 })
        const switchBottom = nodes[0].y + nodes[0].height / 2
        const hostTop = nodes[1].y + offsets.get(5020)! - nodes[1].height / 2 - nodes[1].above
        const captionTop = (hostTop - 32) * .1 - 26
        assert.ok(captionTop > switchBottom * .1)
        const hostBottom = nodes[1].y + offsets.get(5020)! + nodes[1].height / 2
        const nicTop = nodes[2].y + offsets.get(5030)! - nodes[2].height / 2 - nodes[2].above
        assert.equal(nicTop - hostBottom, 160)
        assert.equal(offsets.get(5015), 0)
    })
    it('places boundaries in the free corridor after the full NIC extent, independent of level ordering', () => {
        const levels = [{ weight: 7060, bb: { y: 0, height: 900 } },
            { weight: 7070, bb: { y: 1012, height: 600 } },
            { weight: 7080, bb: { y: 1724, height: 2500 } }]
        const before = JSON.stringify(levels)
        assert.deepEqual(topologyLaneSeparators(levels), new Map([[7060, 956], [7070, 1668]]))
        assert.deepEqual(topologyLaneSeparators(levels.slice().reverse()), topologyLaneSeparators(levels))
        assert.equal(JSON.stringify(levels), before)
        assert.equal(topologyLaneSeparators([{ weight: 7080, bb: { y: 0, height: 3000 } },
            { weight: 7090, bb: { y: 400, height: 300 } },
            { weight: 7100, bb: { y: 900, height: 300 } }]).size, 0)
        assert.equal(topologyLaneSeparators([{ weight: 1, bb: { y: 0, height: 500 } },
            { weight: 2, bb: { y: 400, height: 300 } }]).size, 0)
    })
})
