import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as vm from 'vm'
import * as ts from 'typescript'
import { currentProblems } from '../src/CurrentProblems'
import * as analysis from '../src/ProblemAnalysis'
import * as summary from '../src/StatusSummary'
import * as validity from '../src/LLDPTopologyValidity'

const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
// Render the production shared section, metric and tooltip components. Only
// unrelated dialogs, CSS and resource widgets are stubbed in this SSR harness.
const sharedExports: any = {}
const sharedSource = ts.transpileModule(readFileSync(path.resolve(__dirname, '../src/DataPanels/common/DetailComponents.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2018 }
}).outputText
vm.runInNewContext(sharedSource, { exports: sharedExports, require: (name: string) => {
    if (name.endsWith('.css') || ['./KubernetesVerdictCriteria', './ResourcePresentation', './ScrollableDetailTabBar'].includes(name)) return {}
    if (name === '../../OverflowTooltip') return require('../src/OverflowTooltip')
    if (name === './KubernetesDataPresentation') return require('../src/DataPanels/common/KubernetesDataPresentation')
    return require(name)
} })
const source = ts.transpileModule(readFileSync(path.resolve(__dirname, '../src/ProblemDetail.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2018 }
}).outputText
const fixture = () => {
    const node: any = { id: 'deployment', data: { Name: 'api', Type: 'deployment', Manager: 'k8s', ClusterName: 'cluster', K8s: { Extra: {
        Spec: { Replicas: 2 }, Status: { Replicas: 2, ReadyReplicas: 0, AvailableReplicas: 0 }
    } } }, tags: [], children: [], parent: null }
    const entry = currentProblems([node], [], n => n.data.Name, () => ({ kind: 'unknown', label: 'Unknown' }))[0]
    return { node, entry }
}
const render = (props: any, tab = 'overview') => {
    let state = 0, calls = 0
    const effects: (() => any)[] = []
    const exports: any = {}
    const context = { exports, AbortController, Date, require: (name: string) => {
        if (name === 'react') return { ...React, useState: (initial: any) => [state++ === 0 ? tab : initial, () => {}], useEffect: (effect: () => any) => effects.push(effect) }
        if (name === './DataPanels/common/DetailComponents') return sharedExports
        if (name === './DataPanels/common/DetailSectionIcon') return require('../src/DataPanels/common/DetailSectionIcon')
        if (name === './ProblemAnalysis') return analysis
        if (name === './StatusSummary') return summary
        if (name === './LLDPTopologyValidity') return validity
        if (name === './CurrentProblems') return require('../src/CurrentProblems')
        if (name === './EventHistory') return { EventChange: () => null }
        if (name === './EventHistoryAPI') return { listChangeEvents: () => { calls++; return Promise.resolve({ events: [], total: 0 }) } }
        return require(name)
    } }
    vm.runInNewContext(source, context)
    const element = exports.default({ nodes: [], links: [], entries: [], connected: true, synced: true, historical: false,
        name: (node: any) => node.data.Name, onBack: () => {}, onNavigate: () => {}, onInspect: () => {}, ...props })
    const html = renderToStaticMarkup(element)
    effects.forEach(effect => effect())
    return { html, calls }
}
describe('Problem detail observation lifecycle', () => {
    it('preserves zero Replica evidence and hides unsupported workload history without querying it', () => {
        const { entry, node } = fixture()
        const { html, calls } = render({ entry, current: entry, node, nodes: [node], entries: [entry] })
        assert.ok(html.includes('Ready Replica'))
        for (const fact of analysis.problemEvidence(node, [node]).filter(fact => !fact.label.startsWith('Condition · ') && !fact.label.endsWith(' · 메시지'))) {
            assert.ok(html.includes(fact.label), `missing evidence label: ${fact.label}`)
            assert.ok(html.includes(fact.value), `missing evidence value: ${fact.label}`)
        }
        assert.ok(html.includes('수집 시각 미확인'))
        assert.ok(html.includes('실제 Pod가 없다는 뜻이 아닙니다'))
        assert.equal(html.includes('rc-tabs'), false)
        assert.equal(calls, 0)
    })
    it('uses refreshed evidence after removal from the list instead of repeating an old current-fault verdict', () => {
        const { entry, node } = fixture()
        node.data.K8s.Extra.Status = { Replicas: 2, ReadyReplicas: 2, AvailableReplicas: 2 }
        const { html } = render({ entry, node, nodes: [node] })
        assert.ok(html.includes('갱신된 상태 근거'))
        assert.ok(html.includes('현재 문제 목록의 판정 대상이 아닙니다.'))
        assert.equal(html.includes('가용 복제본 없음'), false)
    })
    it('removes deleted resources and their old relationships without claiming recovery', () => {
        const { entry } = fixture()
        entry.related = [{ id: 'old-peer', data: { Name: 'old-peer' } } as any]
        const { html } = render({ entry })
        assert.ok(html.includes('현재 토폴로지에서 이 자원을 찾을 수 없습니다.'))
        assert.ok(html.includes('삭제된 자원의 이전 관계는 표시하지 않습니다.'))
        assert.equal(html.includes('old-peer'), false)
        assert.ok(html.includes('목록에서 사라진 것만으로 복구를 확정하지 않습니다.'))
    })
    it('loads supported history only when expanded and keeps the current evidence visible', () => {
        const { entry, node } = fixture()
        node.data = { ...node.data, Type: 'node', K8s: { UID: 'worker-uid' } }
        entry.type = 'node'
        assert.equal(render({ entry, node, nodes: [node] }).calls, 0)
        const expanded = render({ entry, current: entry, node, nodes: [node] }, 'events')
        assert.equal(expanded.calls, 1)
        assert.ok(expanded.html.includes('판정 근거'))
        assert.ok(expanded.html.includes(entry.reason))
        assert.ok(expanded.html.includes('연관 자원 탐색'))
        assert.ok(expanded.html.includes('aria-expanded="true"'))
    })
})
