import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as vm from 'vm'
import * as ts from 'typescript'

const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const components: any = {}
const source = ts.transpileModule(readFileSync(path.resolve(__dirname, '../src/DataPanels/common/DetailComponents.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2018 }
}).outputText
// Exercise production Descriptions, Tooltip, copy and badge components without
// loading unrelated resource widgets or browser-only stylesheet imports.
vm.runInNewContext(source, { exports: components, require: (name: string) => {
    if (name.endsWith('.css') || ['./KubernetesVerdictCriteria', './ResourcePresentation', './ScrollableDetailTabBar'].includes(name)) return {}
    if (name === '../../OverflowTooltip') return require('../src/OverflowTooltip')
    if (name === './KubernetesDataPresentation') return require('../src/DataPanels/common/KubernetesDataPresentation')
    return require(name)
} })

describe('Shared detail basic information', () => {
    const raw = '3fb147f3-aea4-4f65-b8c6-e7192ea26138'
    const rows = () => [
        { label: 'UUID', value: raw, textValue: raw, copyText: raw, tooltip: '원본 식별자', tooltipRawValue: raw },
        { label: '상태', value: React.createElement(components.DetailBadge, { tone: 'success' }, 'UP') },
        { label: 'MTU', value: 0 },
        { label: '미수집', value: '정보 없음' },
        { label: '빈 값', value: '' },
        { label: '주소', value: '10.10.31.2\n2001:db8::2', wrap: true },
        { label: '연결', value: React.createElement('a', { href: '#resource' }, '원본 자원') }
    ]
    const render = (props: any) => renderToStaticMarkup(React.createElement(components.DetailKeyValueList, { rows: rows(), ...props }))

    it('opts only basic information into the borderless appearance and keeps the Kubernetes alias shared', () => {
        assert.equal(components.BasicInfoRows, components.DetailKeyValueList)
        const basic = render({ appearance: 'basic' })
        const advanced = render({})
        assert.ok(basic.includes('netdive-detail-basic-info'))
        assert.ok(!basic.includes('ant-descriptions-bordered'))
        assert.ok(advanced.includes('ant-descriptions-bordered'))
        assert.ok(!advanced.includes('netdive-detail-basic-info'))
    })

    it('retains rows, raw technical values, multi-values, empty values, status badges and links', () => {
        const basic = render({ appearance: 'basic', copyTooltip: '복사' })
        const advanced = render({ copyTooltip: '복사' })
        for (const html of [basic, advanced]) {
            for (const value of ['UUID', raw, '상태', 'UP', 'MTU', '>0<', '미수집', '정보 없음', '빈 값', '10.10.31.2\n2001:db8::2', 'href="#resource"', '원본 자원', 'aria-label="복사"', 'aria-label="UUID 상세 정보"']) {
                assert.ok(html.includes(value), `missing ${value}`)
            }
            assert.equal((html.match(/class="ant-descriptions-row"/g) || []).length, rows().length)
        }
    })

    it('passes the complete value to copy and retains the full-value tooltip after truncation', () => {
        let copied: string | undefined
        const tree = components.DetailKeyValueList({ rows: rows(), appearance: 'basic', onCopy: (value: string) => copied = value })
        const first = tree.props.children.props.items[0].children
        const children = React.Children.toArray(first.props.children)
        assert.equal(children[0].props.title, raw)
        const copy = children.find((child: any) => child.type === components.DetailCopyButton) as any
        const button = components.DetailCopyButton(copy.props).props.children
        button.props.onClick({ preventDefault: () => {}, stopPropagation: () => {} })
        assert.equal(copied, raw)
    })

    it('retains the existing empty-state behavior when no rows were collected', () => {
        const html = render({ appearance: 'basic', rows: [], emptyText: '수집된 정보가 없습니다.' })
        assert.ok(html.includes('수집된 정보가 없습니다.'))
        assert.ok(!html.includes('ant-descriptions-row'))
    })
})
