import { strict as assert } from 'assert'
import { separateTrafficLabels, TrafficLabelBounds } from '../src/InfrastructureTrafficLabels'
import { RoutingCard } from '../src/InfrastructureCompactRouting'

const overlaps = (a: RoutingCard, b: RoutingCard) => Math.abs(a.x - b.x) * 2 < a.width + b.width
    && Math.abs(a.y - b.y) * 2 < a.height + b.height
function verify(labels: TrafficLabelBounds[], cards: RoutingCard[] = []) {
    const positions = separateTrafficLabels(labels, cards)
    const placed = labels.map(label => ({ ...label, ...positions.get(label.id)! }))
    placed.forEach((a, i) => {
        placed.slice(i + 1).forEach(b => assert.ok(!overlaps(a, b), `${a.id} overlaps ${b.id}`))
        cards.forEach(card => assert.ok(!overlaps(a, card), `${a.id} covers ${card.id}`))
    })
    return positions
}

describe('Infrastructure measured traffic label placement', () => {
    it('separates shared horizontal midpoints using the available route, without changing values or geometry', () => {
        const route = { path: 'M0,100H1800', points: [{ x: 0, y: 100 }, { x: 1800, y: 100 }] }
        const labels = Array.from({ length: 5 }, (_, i) => ({ id: `link-${i}`, x: 900, y: 100,
            width: i === 2 ? 214 : 120, height: 38, route }))
        const original = JSON.stringify(labels)
        const positions = verify(labels)
        positions.forEach(point => { assert.equal(point.y, 100); assert.ok(point.x > 0 && point.x < 1800) })
        assert.equal(JSON.stringify(labels), original)
    })

    it('checks other routes and endpoint summaries, not just labels in the same fan-out group', () => {
        const labels = Array.from({ length: 6 }, (_, i) => ({ id: `edge-${i}`, x: 650 + i % 2 * 20,
            y: 300, width: 160 + i * 10, height: 40,
            route: { path: '', points: [{ x: i * 20, y: 300 }, { x: 1400, y: 300 }] } }))
        labels.push({ id: 'summary', x: 980, y: 300, width: 140, height: 40,
            route: { path: '', points: [] } })
        verify(labels, [{ id: 'vm-group', x: 1100, y: 520, width: 580, height: 360 }])
    })

    it('keeps endpoint-associated values near their card instead of moving them onto a distant shared trunk', () => {
        const route = { path: '', trafficNodeID: 'vm', points: [{ x: -2000, y: 0 }, { x: 0, y: 800 }] }
        const labels = Array.from({ length: 4 }, (_, i) => ({ id: `nic-${i}`, x: 0, y: 800, width: 170, height: 40, route }))
        const positions = verify(labels, [{ id: 'vm', x: 0, y: 1000, width: 480, height: 300 }])
        positions.forEach(point => assert.ok(Math.abs(point.x) <= 600 && point.y < 850))
    })

    it('is deterministic across refresh order and handles changing measured text widths', () => {
        const labels = Array.from({ length: 18 }, (_, i) => ({ id: `edge-${i}`, x: 600, y: 300,
            width: i % 2 ? 110 : 210, height: 38 }))
        const first = verify(labels)
        assert.deepEqual(Array.from(verify(labels.slice().reverse())), Array.from(first))
        verify(labels.map(label => ({ ...label, width: label.width + 35 })))
    })

    it('preserves collision-free positions and avoids cards when the shared route is obstructed', () => {
        const unchanged = { id: 'alone', x: -1000, y: 300, width: 130, height: 40 }
        const labels = [unchanged, ...Array.from({ length: 8 }, (_, i) => ({ id: `blocked-${i}`,
            x: 0, y: 300, width: 180, height: 40,
            route: { path: '', points: [{ x: -100, y: 300 }, { x: 100, y: 300 }] } }))]
        const positions = verify(labels, [{ id: 'card', x: 0, y: 300, width: 700, height: 500 }])
        assert.deepEqual(positions.get('alone'), { x: unchanged.x, y: unchanged.y })
    })

    it('supports vertical segments and empty input', () => {
        assert.equal(separateTrafficLabels([], []).size, 0)
        const route = { path: '', points: [{ x: 100, y: 0 }, { x: 100, y: 1000 }] }
        const positions = verify(Array.from({ length: 8 }, (_, i) => ({ id: `vertical-${i}`,
            x: 100, y: 500, width: 180, height: 40, route })))
        positions.forEach(point => assert.equal(point.x, 100))
    })
})
