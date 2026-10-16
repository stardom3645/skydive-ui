import { strict as assert } from 'assert'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { findLogMatches } from '../src/KubernetesLogPresentation'
import KubernetesLogText from '../src/DataPanels/KubernetesLogText'

const render = (text: string, query = '') => renderToStaticMarkup(React.createElement(KubernetesLogText,
    { text, matches: findLogMatches(text, query).matches, active: 0 }))
const renderedText = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#x27);/g,
    (_match, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'" })[entity])

describe('Kubernetes raw log display', () => {
    it('preserves CRLF, lone CR, empty lines, tabs, trailing spaces and an unterminated final line exactly', () => {
        for (const raw of ['', '\r\n\r\n', '\n\tERROR failure\r\n\tat main.go:12  \n\nlast\r', 'first\rsecond\nlast without newline', '한글 👋\t\n<script>unsafe & raw</script>']) {
            assert.equal(renderedText(render(raw)), raw)
            assert.equal(renderedText(render(raw, '\n')), raw)
        }
    })
    it('never interprets log levels, JSON, terminal escape sequences or timestamp order', () => {
        const raw = '2026-10-15T09:00:02Z WARN newest\r\n2026-10-14T09:00:00Z ERROR older\n' +
            '\x1b[31mERROR\x1b[0m\n{"level":"error","severity":"warn"}\nTraceback (most recent call last):\n\tat main\n'
        const html = render(raw)
        assert.equal(renderedText(html), raw)
        assert.ok(!html.includes('<mark'))
        assert.ok(!html.includes('class='))
    })
    it('treats search as a literal string using original Unicode offsets', () => {
        const raw = 'İ 한글 👋 ERROR [x].*\r\nerror [x].*'
        assert.deepEqual(findLogMatches(raw, '[x].*').matches.map(hit => raw.slice(hit.start, hit.end)), ['[x].*', '[x].*'])
        assert.deepEqual(findLogMatches(raw, 'error').matches.map(hit => raw.slice(hit.start, hit.end)), ['ERROR', 'error'])
        assert.equal(findLogMatches(raw, '').total, 0)
        assert.equal(renderedText(render(raw, '[x].*')), raw)
    })
    it('escapes markup and adds highlights only for user search, including across original line endings', () => {
        const raw = '<script>\r\n\ttrace</script> & "quotes" \'literal\''
        const html = render(raw, '>\r\n\t')
        assert.ok(!html.includes('<script>'))
        assert.ok(html.includes('data-log-match="0"'))
        assert.equal(renderedText(html), raw)
        assert.equal(renderedText(render('ERROR WARN', 'ERROR')), 'ERROR WARN')
    })
    it('keeps unmatched content intact and shows no marks when there are no search results', () => {
        const raw = 'WARN no failure\r\n\nlast'
        assert.equal(findLogMatches(raw, 'unmatched').total, 0)
        assert.equal(renderedText(render(raw, 'unmatched')), raw)
        assert.ok(!render(raw, 'unmatched').includes('<mark'))
    })
    it('bounds highlight markup for long logs without dropping any original text', () => {
        const raw = 'error\n'.repeat(10000), found = findLogMatches(raw, 'error')
        assert.equal(found.total, 10000)
        assert.equal(found.matches.length, 5000)
        assert.equal(renderedText(render(raw, 'error')), raw)
    })
})
