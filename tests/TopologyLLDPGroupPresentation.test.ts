import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyNodePresentation } from '../src/TopologyNodePresentation'

// Render the production shared summary without mounting the D3 canvas.
const source = fs.readFileSync(path.resolve(__dirname, '../src/TopologyNodeCard.tsx'), 'utf8')
const ast = ts.createSourceFile('TopologyNodeCard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const declarations = ast.statements.filter(ts.isVariableStatement)
    .reduce<ts.VariableDeclaration[]>((all, statement) => all.concat(Array.from(statement.declarationList.declarations)), [])
const summary = declarations.find(item => item.name.getText(ast) === 'TopologyResourceGroupSummary')!
const context: any = {
    React: { Fragment: 'fragment', createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }) },
    TopologyCardTooltip: 'tooltip', TopologyGroupHeaderSummary: 'health-summary', TopologyLinkStateSummary: 'link-summary',
    InfoCircleOutlined: 'info'
}
vm.createContext(context)
vm.runInContext(ts.transpile(`this.render = ${summary.initializer!.getText(ast)}`,
    { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
const group = (): any => ({ id: 'ports', state: {}, data: { Name: '스위치 포트 그룹', Type: 'switchport', IsTopologyGroup: true },
    children: Array.from({ length: 9 }, (_, i) => ({ id: `port-${i}`, state: {}, children: [],
        data: { Name: `ethernet1/1/${i + 1}`, Type: 'switchport', LLDP: { PortID: `ethernet1/1/${i + 1}` } } })) })
const render = (node: any) => context.render({ model: topologyNodePresentation(node, { name: node.data.Name, group: true }) })

describe('LLDP-only group summary rendering', () => {
    it('shows neutral discovery information instead of health counts and an all-unknown operational footer', () => {
        const discovery = render(group())
        assert.ok(!discovery.props.className.includes('has-link-state'))
        assert.equal(discovery.children[1].children[0].children[0].children[0], '발견 정보')
        const content = discovery.children[1].children[1]
        assert.equal(content.type, 'fragment')
        assert.equal(content.children[0].children[0].children[0].children[0], 'LLDP 발견')
        assert.equal(content.children[0].children[0].children[1].children[0], 9)
        assert.equal(content.children[1].children[0].children[1].children[0], '운영 상태 미수집')
        assert.equal(discovery.children[2], false)
    })
    it('retains the existing health and Up/Down summaries when real port state is available', () => {
        const node = group()
        node.children[0].data.OperState = 'UP'
        const observed = render(node)
        assert.ok(observed.props.className.includes('has-link-state'))
        assert.equal(observed.children[1].children[1].type, 'health-summary')
        assert.equal(observed.children[2].type, 'link-summary')
        assert.equal(observed.children[2].props.states.up, 1)
    })
})
