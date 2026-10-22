import { strict as assert } from 'assert'
import { hasClippedText } from '../src/OverflowTooltip'

const box = (width: number, height: number, scrollWidth = width, scrollHeight = height, children: any[] = []): any => ({
    clientWidth: width, clientHeight: height, scrollWidth, scrollHeight, querySelectorAll: () => children
})

describe('Repeated-text tooltip visibility', () => {
    it('does not show a tooltip for fully visible single-line or wrapped names', () => {
        assert.equal(hasClippedText(box(220, 18)), false)
        assert.equal(hasClippedText(box(220, 54)), false)
        assert.equal(hasClippedText(box(0, 0, 0, 0, [box(220, 54)])), false)
        assert.equal(hasClippedText(null), false)
    })
    it('retains full-name access for horizontal ellipsis and multi-line clamps', () => {
        assert.equal(hasClippedText(box(220, 18, 400)), true)
        assert.equal(hasClippedText(box(220, 36, 220, 72)), true)
        assert.equal(hasClippedText(box(0, 0, 0, 0, [box(220, 36, 220, 72)])), true)
    })
    it('checks the actual title instead of copy icons or unrelated secondary text', () => {
        const title = box(200, 18), secondary = box(150, 18, 300)
        const root = box(240, 60, 240, 60, [title, secondary])
        root.querySelectorAll = (selector: string) => selector === '.title' ? [title] : [title, secondary]
        assert.equal(hasClippedText(root), true)
        assert.equal(hasClippedText(root, '.title'), false)
    })
    it('rechecks current layout after resizing or receiving a longer name and tolerates pixel rounding', () => {
        const element = box(220, 18, 221)
        assert.equal(hasClippedText(element), false)
        element.scrollWidth = 400
        assert.equal(hasClippedText(element), true)
        element.clientWidth = 440
        assert.equal(hasClippedText(element), false)
    })
})
