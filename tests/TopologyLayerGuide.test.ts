import { strict as assert } from 'assert'
import { topologyLayerGuide, LayerGuideLayout, layerGuideCompactHeight } from '../src/TopologyLayerGuide'

const verify = (layout: Map<number, LayerGuideLayout>, selected: number | null = null) => {
    const visible = [...layout.values()].filter(row => row.visible).sort((a, b) => a.y - b.y)
    visible.forEach((row, i) => {
        const previous = visible[i - 1]
        const height = (value: LayerGuideLayout) => value.compact ? layerGuideCompactHeight : value.expandedHeight
        if (previous) assert.ok(row.y - previous.y >= (height(row) + height(previous)) / 2,
            `overlapping layers ${previous.weight}/${row.weight}`)
    })
    const inView = [...layout.values()].filter(row => row.y >= 18 && row.y <= 982)
    assert.deepEqual(visible.reduce<number[]>((all, row) => all.concat(row.members), []).sort((a, b) => a - b), inView.map(row => row.weight).sort((a, b) => a - b))
    if (selected !== null && inView.some(row => row.weight === selected)) assert.equal(layout.get(selected)?.visible, true)
}

describe('Screen-space topology layer guide', () => {
    for (const layer of ['Kubernetes', 'Infrastructure']) {
        const count = layer === 'Kubernetes' ? 7 : 12
        for (const direction of [1, -1]) it(`${layer}: no overlap and unchanged lane centers from 10–100% (${direction > 0 ? 'in' : 'out'})`, () => {
            let previous = new Map<number, LayerGuideLayout>()
            const percentages = Array.from({ length: 91 }, (_, i) => direction > 0 ? i + 10 : 100 - i)
            for (const percent of percentages) {
                const items = Array.from({ length: count }, (_, i) => ({ weight: i, y: 50 + i * 260 * percent / 100, expandedHeight: i % 2 ? 82 : 99 }))
                const snapshot = JSON.stringify(items)
                for (const selected of [null, 0, 2, count - 1]) {
                    const layout = topologyLayerGuide(items, 1000, selected, previous)
                    verify(layout, selected)
                    for (const row of layout.values()) assert.equal(row.y, items.find(item => item.weight === row.weight)!.y)
                    assert.equal(JSON.stringify(items), snapshot)
                    previous = layout
                }
            }
        })
    }

    it('uses actual separation, rather than zoom or graph ordering', () => {
        const crowded = topologyLayerGuide([{ weight: 1, y: 100, expandedHeight: 82 }, { weight: 2, y: 140, expandedHeight: 82 }], 1000, null)
        assert.ok([...crowded.values()].every(row => row.compact))
        const sparse = topologyLayerGuide([{ weight: 2, y: 500, expandedHeight: 82 }, { weight: 1, y: 100, expandedHeight: 82 }], 1000, null)
        assert.ok([...sparse.values()].every(row => !row.compact))
    })
    it('uses one mode for mixed sparse and crowded lanes, and keeps it stable while panning', () => {
        const items = [{ weight: 1, y: 100, expandedHeight: 82 }, { weight: 2, y: 150, expandedHeight: 82 },
            { weight: 3, y: 400, expandedHeight: 82 }, { weight: 4, y: 650, expandedHeight: 82 }]
        const layout = topologyLayerGuide(items, 1000, null)
        assert.ok([...layout.values()].every(item => item.compact))
        const panned = topologyLayerGuide(items.map(item => ({ ...item, y: item.y - 200 })), 1000, null, layout)
        assert.ok([...panned.values()].every(item => item.compact))
        const spread = topologyLayerGuide(items.map((item, i) => ({ ...item, y: 100 + i * 200 })), 1000, null, panned)
        assert.ok([...spread.values()].every(item => !item.compact))
    })

    it('keeps the selected layer at its own center when icons cannot all fit, without losing tooltip members', () => {
        const rows = Array.from({ length: 12 }, (_, i) => ({ weight: i, y: 100 + i * 12, expandedHeight: 82 }))
        for (const selected of rows.map(row => row.weight)) {
            const layout = topologyLayerGuide(rows, 1000, selected)
            verify(layout, selected)
            assert.equal(layout.get(selected)?.y, rows[selected].y)
            assert.ok([...layout.values()].some(row => row.members.length > 1))
        }
    })

    it('prevents compact/full flicker around the boundary and restores full labels once space is sufficient', () => {
        const rows = (gap: number) => [{ weight: 1, y: 100, expandedHeight: 82 }, { weight: 2, y: 100 + gap, expandedHeight: 82 }]
        let layout = topologyLayerGuide(rows(81), 1000, null)
        for (const gap of [82, 85, 81, 90, 91]) {
            layout = topologyLayerGuide(rows(gap), 1000, null, layout)
            assert.equal(layout.get(1)?.compact, true)
        }
        layout = topologyLayerGuide(rows(92), 1000, null, layout)
        assert.equal(layout.get(1)?.compact, false)
    })

    it('does not let an offscreen selection hide visible layers during vertical panning', () => {
        const layout = topologyLayerGuide([{ weight: 1, y: -10, expandedHeight: 82 }, { weight: 2, y: 30, expandedHeight: 82 },
            { weight: 3, y: 70, expandedHeight: 82 }], 1000, 1)
        assert.equal(layout.get(1)?.visible, false)
        assert.equal(layout.get(2)?.visible, true)
        assert.equal(layout.get(3)?.visible, true)
        verify(layout)
    })

    it('keeps a single layer full-size and handles an empty layer without geometry', () => {
        assert.equal(topologyLayerGuide([{ weight: 1, y: 100, expandedHeight: 82 }], 1000, null).get(1)?.compact, false)
        assert.equal(topologyLayerGuide([], 1000, null).size, 0)
    })
})
