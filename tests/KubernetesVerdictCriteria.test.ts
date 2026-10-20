import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { kubernetesVerdictRules } from '../src/KubernetesVerdictRules'

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')
const component = (file: string, name: string, globals: any = {}) => {
    const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let initializer: ts.Expression | undefined
    source.statements.filter(ts.isVariableStatement).forEach(statement => statement.declarationList.declarations.forEach(declaration => {
        if (declaration.name.getText(source) === name) initializer = declaration.initializer
    }))
    assert.ok(initializer, `missing component ${name}`)
    let state = false
    const context: any = { React: { Fragment: 'fragment',
        createElement: (type: any, props: any, ...children: any[]) => ({ type, props: props || {}, children }),
        useState: () => [state, (value: boolean) => { state = value }],
        isValidElement: (value: any) => !!value?.type,
        cloneElement: (element: any, props: any) => ({ ...element, props: { ...element.props, ...props } })
    }, ...globals }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`this.render = ${initializer!.getText(source)}`, { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
    return context.render
}
const find = (tree: any, type: string): any[] => {
    if (Array.isArray(tree)) return ([] as any[]).concat(...tree.map(child => find(child, type)))
    if (!tree || typeof tree !== 'object') return []
    return (tree.type === type ? [tree] : []).concat(find(tree.children || [], type))
}

describe('Every Netdive verdict exposes its criteria', () => {
    it('audits every production operational summary, including the independent Cluster implementation', () => {
        let audited = 0
        const directory = path.resolve(__dirname, '../src/DataPanels')
        for (const file of fs.readdirSync(directory).filter(file => /DetailPanel\.tsx$/.test(file))) {
            const source = ts.createSourceFile(file, fs.readFileSync(path.join(directory, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
            const visit = (node: ts.Node) => {
                if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
                    if (['StatusSummaryGrid', 'DetailOperationalSummary'].includes(node.tagName.getText(source))) {
                        const attributes = node.attributes.properties.filter(ts.isJsxAttribute).map(attribute => attribute.name.getText(source))
                        assert.ok(attributes.includes(file === 'KubernetesClusterDetailPanel.tsx' ? 'verdictDetails' : 'criteriaKind'), `${file} has a verdict without criteria`)
                        audited++
                    }
                }
                ts.forEachChild(node, visit)
            }
            visit(source)
        }
        assert.equal(audited, 9, 'all shared summaries and the Cluster summary must be audited')
    })

    for (const kind of ['node', 'namespace', 'pod', 'service', 'deployment', 'daemonset', 'statefulset', 'job', 'cronjob', 'persistentvolume', 'persistentvolumeclaim']) {
        it(`provides explicit ${kind} rules rather than the generic fallback`, () => {
            const rules = kubernetesVerdictRules(kind)
            assert.ok(rules.length >= 3)
            assert.ok(rules.every(rule => rule.label !== '판정 근거' && rule.description.length > 20))
        })
    }

    it('opens the shared criteria modal from the verdict label even without any verdict tooltip', () => {
        const render = component('src/DataPanels/common/DetailComponents.tsx', 'DetailOperationalSummary', {
            joinClassNames: (...values: any[]) => values.filter(Boolean).join(' '),
            KUBERNETES_DETAIL_LABELS: { verdict: 'Netdive 판정', rawStatus: '원본 상태', impact: '현재 영향' },
            isKubernetesUnavailableValue: () => false, kubernetesImpactLabel: (value: any) => value,
            DetailInfoTooltip: 'tooltip', KubernetesVerdictCriteria: 'criteria', VerdictCriteriaLabel: 'criteria-label'
        })
        const props = { criteriaKind: 'namespace', verdict: '주의', rawStatus: '활성', impact: '1개 미가용' }
        let view = render(props)
        assert.equal(find(view, 'criteria').length, 1)
        assert.equal(find(view, 'criteria')[0].props.open, false)
        find(view, 'criteria-label')[0].props.onOpen()
        view = render(props)
        assert.equal(find(view, 'criteria')[0].props.open, true)
        assert.equal(find(view, 'criteria')[0].props.kind, 'namespace')
        find(view, 'criteria')[0].props.onOpenChange(false)
        assert.equal(find(render(props), 'criteria')[0].props.open, false)
    })

    it('opens the existing Cluster criteria from the same label action and retains one modal', () => {
        const render = component('src/DataPanels/KubernetesClusterPresentation.tsx', 'ClusterOperationalSummary', {
            ClusterOperationalSection: 'section', VerdictCriteriaLabel: 'criteria-label', DetailInfoTooltip: 'tooltip',
            Typography: { Text: 'text' }, Badge: 'badge', status: () => 'warning'
        })
        const props = { verdict: '주의', rawStatus: '활성', impact: '확인 필요', verdictDetails: { type: 'cluster-criteria', props: { reasons: ['실제 현재 문제'] } } }
        let view = render(props)
        const criteria = () => find(view, 'cluster-criteria')[0]
        assert.equal(find(view, 'section')[0].props.action, undefined)
        assert.equal(find(view, 'cluster-criteria').length, 1)
        assert.equal(criteria().props.open, false)
        find(view, 'criteria-label')[0].props.onOpen()
        view = render(props)
        assert.equal(criteria().props.open, true)
        assert.deepEqual(criteria().props.reasons, ['실제 현재 문제'])
        criteria().props.onOpenChange(false)
        view = render(props)
        assert.equal(criteria().props.open, false)
    })

    it('renders an accessible info action regardless of tooltip data', () => {
        const render = component('src/DataPanels/common/KubernetesVerdictCriteria.tsx', 'VerdictCriteriaLabel', { Button: 'button', InfoCircleOutlined: 'info' })
        let opened = false
        const button = render({ onOpen: () => { opened = true } })
        assert.equal(button.props['aria-label'], 'Netdive 판정 기준 보기')
        assert.equal(find(button, 'info').length, 1)
        button.props.onClick()
        assert.equal(opened, true)
    })
})
