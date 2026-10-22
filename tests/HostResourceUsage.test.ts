import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as vm from 'vm'
import * as ts from 'typescript'

const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const common = path.resolve(__dirname, '../src/DataPanels/common')
const modules = new Map<string, any>()
function load(name: string): any {
    if (modules.has(name)) return modules.get(name)
    const exports = {}
    modules.set(name, exports)
    const source = ts.transpileModule(readFileSync(path.join(common, `${name}.tsx`), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2018 }
    }).outputText
    vm.runInNewContext(source, { exports, require: (request: string) => {
        if (request.endsWith('.css')) return {}
        if (['./ResourcePresentation', './ResourceUsageMetrics', './DetailSectionIcon'].includes(request)) return load(request.slice(2))
        return require(request.startsWith('.') ? path.resolve(common, request) : request)
    } })
    return exports
}
const { RootDiskPanel } = load('RootDiskPanel')
const render = (props: any = {}) => renderToStaticMarkup(React.createElement(RootDiskPanel, { loading: false, vm: false, ...props }))
const gib = 1024 ** 3
const series = (key: string, lastValue: number) => ({ key, lastValue })
const cpuMemory = [series('cpu', 0), series('memory', 28)]

describe('Host unified resource usage section', () => {
    it('retains current CPU/memory when the root filesystem has not been collected', () => {
        const html = render({ wall: { series: cpuMemory } })
        assert.equal((html.match(/class="ant-card-head-title"/g) || []).length, 1)
        for (const text of ['리소스 사용 현황', 'netdive-resource-usage__metrics', 'CPU', '메모리', '>0%<', '>28%<', '루트 디스크 (/)', '전체 용량', '사용 용량', '가용 용량']) assert.ok(html.includes(text), text)
        assert.ok(!html.includes('ant-card-head-title">루트 디스크'))
        assert.ok(html.includes('파일시스템 정보가 미수집'))
    })
    it('uses the same summary and measured disk capacities when collection is available', () => {
        const html = render({ wall: { series: [...cpuMemory, series('rootDiskTotal', 100 * gib),
            series('rootDiskUsed', 80 * gib), series('rootDiskAvailable', 20 * gib)] } })
        assert.equal((html.match(/class="ant-card-head-title"/g) || []).length, 1)
        for (const value of ['>0%<', '>28%<', '>80%<', '100GiB', '80GiB', '20GiB']) assert.ok(html.includes(value), value)
        assert.ok(!html.includes('파일시스템 정보가 미수집'))
    })
    it('keeps one resource section for missing, loading and failed data without inventing zero usage', () => {
        for (const props of [{}, { loading: true }, { error: 'unavailable' }]) {
            const html = render(props)
            assert.ok(html.includes('리소스 사용 현황'))
            assert.ok(html.includes('CPU')); assert.ok(html.includes('메모리'))
            assert.ok(html.includes('루트 디스크 (/)'))
            assert.ok(!html.includes('role="progressbar"'))
            assert.ok(!html.includes('>0%<'))
        }
        assert.ok(render({ loading: true }).includes('ant-spin'))
        assert.ok(render({ error: 'unavailable' }).includes('Wall 자원 데이터를 조회하지 못했습니다.'))
    })
    it('preserves the VM-specific missing-filesystem section', () => {
        const html = render({ vm: true })
        assert.equal(RootDiskPanel({ vm: true, loading: false }).props.title, '루트 디스크')
        assert.ok(html.includes('Guest Agent'))
        assert.ok(!html.includes('netdive-resource-usage__metrics'))
    })
})
