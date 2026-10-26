import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { problemStatusLabels } from '../src/CurrentProblems'

const React = require('react')
const source = readFileSync(path.resolve(__dirname, '../src/TopologyProblemContext.tsx'), 'utf8')
const ast = ts.createSourceFile('Context.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const body = ast.statements.filter(item => ts.isFunctionDeclaration(item) || ts.isVariableStatement(item))
    .map(item => item.getText(ast)).join('\n').replace('export default function', 'function')
const context: any = { React, List: Object.assign(() => null, { Item: 'list-item' }),
    theme: { useToken: () => ({ token: { colorError: 'danger-token', colorWarning: 'warning-token', colorBorderSecondary: 'neutral-token' } }) }, problemStatusLabels, Button: 'button', Card: 'card', Tag: 'tag', Tooltip: 'tooltip', Space: 'space',
    Typography: { Text: 'text', Paragraph: 'paragraph', Title: 'title', Link: 'link' },
    RightOutlined: 'right', AimOutlined: 'aim', InfoCircleOutlined: 'info', NodeIndexOutlined: 'path', OverflowTooltip: 'overflow-tooltip' }
vm.createContext(context)
vm.runInContext(ts.transpile(`${body}\nthis.render = TopologyProblemContext`, { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
function children(element: any): any {
    if (element.props.renderItem) return element.props.dataSource.length
        ? element.props.dataSource.map(element.props.renderItem) : element.props.locale.emptyText
    return element.props.children
}
function elements(tree: any, type?: string): any[] {
    if (Array.isArray(tree)) return tree.reduce((result, child) => result.concat(elements(child, type)), [])
    if (!React.isValidElement(tree)) return []
    const element: any = tree
    return (type === undefined || element.type === type ? [element] : []).concat(elements(children(element), type))
}
function text(tree: any): string {
    if (Array.isArray(tree)) return tree.map(text).join('')
    return React.isValidElement(tree) ? text(children(tree)) : typeof tree === 'string' || typeof tree === 'number' ? String(tree) : ''
}
function render(overrides: any = {}) {
    return context.render({ name: 'api-pod', typeLabel: '파드', scope: 'cluster / namespace', clusterName: 'cluster', namespace: 'namespace', status: 'problem', reason: '관측값 · Ready=false',
        collectedAt: '확인 불가', related: [], onClear() {}, onCenter() {}, onReturn() {}, onInspect() {}, onRelated() {}, ...overrides })
}

describe('Problem exploration floating panel presentation', () => {
    it('orders the object, issue, related objects and collection state before the existing actions', () => {
        const tree = render()
        assert.deepEqual(elements(tree, 'section').map(item => item.props['aria-label']), ['선택 객체', '발견된 문제', '함께 확인할 객체', '수집 상태'])
        assert.deepEqual(elements(tree, 'button').filter(item => !item.props['aria-label']).map(text), ['문제 목록', '객체 상세'])
        assert.equal(elements(tree, 'card').length, 1)
        assert.ok(!text(tree).includes('탐색 상태'))
        assert.ok(!text(tree).includes('노드 상태 범례'))
    })
    it('explains observed readiness without losing the raw status or observation qualifier', () => {
        const tree = render(), issue = elements(tree, 'section').find(item => item.props['aria-label'] === '발견된 문제')
        assert.equal(text(elements(issue, 'title')[0]), '준비되지 않은 상태')
        assert.equal(elements(issue, 'title')[0].props.level, 5)
        assert.equal(elements(issue, 'text').find(item => text(item) === '발견된 문제').props.strong, undefined)
        assert.ok(text(issue).includes('원본: Ready=false'))
        assert.ok(elements(issue, 'tag').some(item => text(item) === '관측값'))
        for (const [reason, label] of [['Ready=Unknown', '준비 상태를 확인할 수 없음'], ['CrashLoopBackOff', '반복 재시작으로 대기 중'], ['ImagePullBackOff', '이미지 다운로드 재시도 대기']]) {
            const paragraphs = elements(render({ reason }), 'paragraph')
            assert.ok(elements(render({ reason }), 'title').some(item => text(item) === label))
            assert.ok(paragraphs.some(item => text(item) === `원본: ${reason}`))
        }
    })
    it('does not invent a new interpretation for unknown or absent reasons', () => {
        for (const reason of ['알 수 없는 원본 상태: CustomFailure', '가용 복제본 없음', 'Ready=falsePositive']) {
            const tree = render({ reason })
            assert.ok(elements(tree, 'title').some(item => text(item) === reason))
            assert.ok(!text(tree).includes('원본:'))
        }
        assert.ok(text(render({ reason: undefined })).includes('판정 사유를 확인할 수 없습니다.'))
    })
    it('keeps related status and exact IDs and limits its explanation to confirmed relationships', () => {
        let selected = '', prevented = false
        const tree = render({ related: [{ id: 'actual-pod-uid', name: 'another-pod', typeLabel: '파드', status: 'attention' }], onRelated: (id: string) => selected = id })
        const link = elements(tree, 'link')[0]
        link.props.onClick({ preventDefault: () => prevented = true })
        assert.equal(selected, 'actual-pod-uid'); assert.equal(prevented, true)
        assert.ok(text(link).includes('another-pod'))
        assert.ok(text(link).includes('파드'))
        assert.ok(elements(tree, 'tag').some(item => item.props.color === 'warning' && text(item) === '확인 필요'))
        assert.ok(elements(tree, 'tooltip').some(item => item.props.title.includes('장애 원인이나 영향 전파를 의미하지 않습니다.')))
        assert.ok(text(render()).includes('표시할 관련 문제 객체가 없습니다.'))
    })
    it('retains freshness uncertainty without presenting missing timestamps as a new failure', () => {
        assert.ok(text(render()).includes('마지막 수집 시각 미확인'))
        assert.ok(text(render({ collectedAt: '2026-10-23 10:00' })).includes('최근 수집 2026-10-23 10:00'))
        assert.ok(!elements(render(), 'tag').some(item => item.props.color === 'error'))
    })
    it('keeps all navigation/clear callbacks and prevents interactions from reaching the topology', () => {
        const calls: string[] = []
        const tree = render({ onClear: () => calls.push('clear'), onCenter: () => calls.push('center'),
            onReturn: () => calls.push('return'), onInspect: () => calls.push('inspect') })
        tree.props.extra.props.onClick()
        elements(tree, 'button').forEach(button => button.props.onClick())
        assert.deepEqual(calls, ['clear', 'center', 'return', 'inspect'])
        let stopped = 0
        for (const handler of ['onMouseDown', 'onClick', 'onWheel']) tree.props[handler]({ stopPropagation: () => stopped++ })
        assert.equal(stopped, 3)
    })
    it('structures exact cluster/namespace values and retains unstructured infrastructure scope without guessing', () => {
        const tree = render()
        assert.deepEqual(elements(tree, 'dt').map(text), ['클러스터', '네임스페이스'])
        assert.deepEqual(elements(tree, 'dd').map(text), ['cluster', 'namespace'])
        assert.ok(elements(tree, 'tag').some(item => text(item) === '파드'))
        const infra = render({ clusterName: undefined, namespace: undefined, scope: 'Zone > Pod > Cluster' })
        assert.deepEqual(elements(infra, 'dt').map(text), ['소속'])
        assert.deepEqual(elements(infra, 'dd').map(text), ['Zone > Pod > Cluster'])
    })
    it('uses the actual selected verdict for the thin emphasis and keeps missing/recovered verdicts neutral', () => {
        for (const [status, accent] of [['problem', 'danger-token'], ['attention', 'warning-token'], ['unavailable', 'neutral-token'], [undefined, 'neutral-token']]) {
            const issue = elements(render({ status }), 'section').find(item => item.props['aria-label'] === '발견된 문제')
            assert.equal(issue.props.style['--problem-context-accent'], accent)
        }
    })
    it('leaves Button geometry and hover to the existing Ant Design theme', () => {
        const css = readFileSync(path.resolve(__dirname, '../src/Topology.css'), 'utf8')
        const panelStyles = css.slice(css.indexOf('.topology-problem-context.ant-card'), css.indexOf('.level-label .level-label-router-icon'))
        assert.ok(!/[^{}]*(?:\.ant-btn|\bbutton\b)[^{}]*\{/.test(panelStyles))
        assert.ok(!panelStyles.includes('topology-problem-focus-legend'))
        for (const button of elements(render(), 'button')) assert.equal(button.props.style, undefined)
    })
})
