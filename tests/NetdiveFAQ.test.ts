import { strict as assert } from 'assert'
import { faqCategories, filterNetdiveFAQs, netdiveFAQs } from '../src/NetdiveFAQContent'

describe('Netdive FAQ search and categories', () => {
    it('searches answers, ignores case and whitespace, and combines search words', () => {
        const matches = filterNetdiveFAQs('ko', 'all', '  RX\t tx  ')
        assert.ok(matches.some(item => item.id === 'traffic-units'))
        assert.ok(filterNetdiveFAQs('en', 'all', '  interval\n AVERAGE ').some(item => item.id === 'traffic-average'))
        assert.equal(filterNetdiveFAQs('ko', 'all', '존재하지않는질문xyz').length, 0)
    })
    it('intersects category and query, and restores all results when cleared', () => {
        const connections = filterNetdiveFAQs('ko', 'connections', 'LLDP')
        assert.ok(connections.length > 0)
        assert.ok(connections.every(item => item.category === 'connections'))
        assert.equal(filterNetdiveFAQs('ko', 'traffic', 'Deployment').length, 0)
        assert.equal(filterNetdiveFAQs('ko', 'all', '  ').length, netdiveFAQs.length)
        assert.ok(filterNetdiveFAQs('ko', 'all', '수집·갱신').every(item => item.category === 'collection'))
    })
    it('provides stable unique IDs and complete content for both interface languages', () => {
        assert.equal(new Set(netdiveFAQs.map(item => item.id)).size, netdiveFAQs.length)
        const categoryKeys = new Set(faqCategories.map(item => item.key))
        for (const item of netdiveFAQs) {
            assert.ok(categoryKeys.has(item.category))
            for (const language of ['ko', 'en'] as const) {
                assert.ok(item.question[language].trim())
                assert.ok(item.answer[language].length)
                assert.ok(item.answer[language].every(paragraph => paragraph.trim()))
            }
        }
    })
})
