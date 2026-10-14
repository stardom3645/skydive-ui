import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyGroupRegions, TopologyGroupRegion } from '../src/TopologyGroupRegions'
import { topologyNodePresentation } from '../src/TopologyNodePresentation'

describe('Namespace summary badge rendering', () => {
    it('renders the existing child badge rail for real namespaces while leaving virtual group cards alone', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '../src/TopologyNodeCard.tsx'), 'utf8')
        const ast = ts.createSourceFile('TopologyNodeCard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        const declarations: ts.VariableDeclaration[] = []
        ast.statements.filter(ts.isVariableStatement).forEach(statement => declarations.push(...Array.from(statement.declarationList.declarations)))
        const declaration = declarations.find(declaration => declaration.name.getText(ast) === 'TopologyNodeCard')!
        const context: any = {
            React: { memo: (component: any) => component, Fragment: 'fragment', createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }) },
            ConfigProvider: 'config', TopologyTypeIcon: 'icon', TopologyCardTooltip: 'tooltip', TopologyObjectStatusBadge: 'status',
            TopologyGroupHeaderSummary: 'summary', TopologyResourceGroupSummary: 'resource-summary', TopologyMetricChip: 'metric', TopologyStatusBadgeRail: 'badges', TOPOLOGY_STATUS_BADGE_RADIUS: 27
        }
        vm.createContext(context)
        vm.runInContext(ts.transpile(`this.Card = ${declaration.initializer!.getText(ast)}`, { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
        const namespace: any = { id: 'namespace', data: { Type: 'namespace', Name: 'kube-system', Manager: 'k8s', K8s: { Extra: { Status: { Phase: 'Active' } } } }, state: {}, children: [] }
        namespace.children.push({ id: 'workload', data: { Type: 'deployment', Manager: 'k8s', K8s: { Extra: { Spec: { Replicas: 1 }, Status: { ReadyReplicas: 1, AvailableReplicas: 1 } } } }, state: {}, children: [], parent: namespace })
        const model = topologyNodePresentation(namespace, { name: 'kube-system' })
        const rail = context.Card({ model, icon: '' }).children[1]
        assert.equal(model.group, true)
        assert.equal(rail.type, 'badges')
        assert.strictEqual(rail.props.badges, model.badges)
        assert.equal(rail.props.badges.reduce((sum: number, badge: any) => sum + badge.count, 0), 1)
        assert.equal(context.Card({ model: { ...model, namespaceSummary: false }, icon: '' }).children[1], false)
    })
})

describe('Kubernetes virtual group presentation', () => {
    it('limits the new presentation to virtual Kubernetes groups and keeps inactive counts separate from the three principal states', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '../src/TopologyNodeCard.tsx'), 'utf8')
        const ast = ts.createSourceFile('TopologyNodeCard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        const declarations: ts.VariableDeclaration[] = []
        ast.statements.filter(ts.isVariableStatement).forEach(statement => declarations.push(...Array.from(statement.declarationList.declarations)))
        const context: any = {
            React: { memo: (component: any) => component, Fragment: 'fragment', createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }) },
            ConfigProvider: 'config', TopologyTypeIcon: 'icon', TopologyCardTooltip: 'tooltip', TopologyObjectStatusBadge: 'status',
            TopologyMetricChip: 'metric', TopologyStatusBadgeRail: 'badges', TOPOLOGY_STATUS_BADGE_RADIUS: 27
        }
        vm.createContext(context)
        for (const name of ['TopologyGroupHeaderSummary', 'TopologyLinkStateSummary', 'TopologyResourceGroupSummary', 'TopologyNodeCard']) {
            const declaration = declarations.find(declaration => declaration.name.getText(ast) === name)!
            vm.runInContext(ts.transpile(`this.${name} = ${declaration.initializer!.getText(ast)}`, { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
        }
        const counts = Object.freeze({ total: 10, normal: 3, warning: 4, critical: 1, inactive: 2 })
        const base: any = { width: 580, height: 478, size: 'large', name: '클러스터 그룹', kind: '클러스터', group: true, namespaceSummary: false,
            infrastructure: false, children: counts, metrics: [], badges: [], status: { tone: 'normal' } }
        const article = (model: any) => context.TopologyNodeCard({ model, icon: '' }).children[0].children[0].children[0]
        assert.ok(article(base).props.className.includes('is-kubernetes-resource-group'))
        assert.ok(!article({ ...base, infrastructure: true }).props.className.includes('is-kubernetes-resource-group'))
        assert.ok(!article({ ...base, namespaceSummary: true }).props.className.includes('is-kubernetes-resource-group'))
        assert.ok(!article({ ...base, group: false }).props.className.includes('is-kubernetes-resource-group'))
        const summary = context.TopologyResourceGroupSummary({ model: base })
        const distribution = summary.children[1].children[1]
        assert.equal(distribution.props.separateInactive, true)
        assert.equal(summary.children[2], false)
        const states = context.TopologyGroupHeaderSummary(distribution.props)
        const principal = states.children[1].children[0]
        assert.deepEqual(Array.from(principal, (state: any) => state.children[0].children[2].children[0]), [3, 4, 1])
        assert.equal(states.children[2].children[0].children[1].children[0], 2)
        const infrastructure = { ...base, infrastructure: true, height: 416, linkStates: { up: 4, down: 6, unknown: 2 } }
        assert.ok(article(infrastructure).props.className.includes('is-infrastructure-resource-group'))
        assert.ok(!article(base).props.className.includes('is-infrastructure-resource-group'))
        assert.ok(!article({ ...infrastructure, group: false }).props.className.includes('is-infrastructure-resource-group'))
        const infrastructureSummary = context.TopologyResourceGroupSummary({ model: infrastructure })
        assert.equal(infrastructureSummary.children[1].children[1].props.separateInactive, true)
        assert.equal(infrastructureSummary.children[1].children[1].props.normalLabel, '이상 없음')
        assert.strictEqual(infrastructureSummary.children[2].props.states, infrastructure.linkStates)
        assert.equal(infrastructureSummary.children[1].children[2], false, 'operation counts occupy their own footer')
        const infraStates = context.TopologyGroupHeaderSummary(infrastructureSummary.children[1].children[1].props)
        assert.equal(infraStates.children[1].children[0].length, 3, 'inactive resources do not create a fourth principal column')
        assert.equal(infraStates.children[2].children[0].children[1].children[0], 2)
    })
})

// Exercise the production rendering entry point, including layer decisions;
// testing only the geometry helper would miss a Kubernetes-only render gate.
function rendererProbe() {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
    const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const component = ast.statements.find(n => ts.isClassDeclaration(n) && n.name!.text === 'Topology') as ts.ClassDeclaration
    const method = component.members.find(n => n.name?.getText(ast) === 'renderTopologyGroupRegions')!
    const context: any = { topologyGroupRegions, WrapperType: { Hidden: 2, Group: 3 }, animDuration: 0, topologyGroupStackOffset: 28, topologyGroupFullyExpanded: () => true }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${method.getText(ast)} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
    const probe = new context.Probe()
    let rendered: TopologyGroupRegion[] = []
    const join: any = {
        data: (regions: TopologyGroupRegion[]) => { rendered = regions; return join },
        select: () => join, exit: () => join, remove: () => join, enter: () => join,
        append: () => join, merge: () => join, attr: () => join, style: () => join, text: () => join,
        transition: () => join, duration: () => join
    }
    probe.g = { classed: () => probe.g }
    probe.gGroupRegions = { selectAll: () => join }
    probe.root = {}
    probe.topologyNodeDisplayName = (node: any) => node.data.id
    probe.updateTopologyHostCaptions = () => {}
    probe.topologyLaneItem = () => ({ above: 41, below: 0 })
    const branch = (id: string, type: string, x = 0) => {
        const root = { data: { id, type: 1, wrapped: { data: { Type: type }, state: { expanded: true } } }, x, y: 0 }
        const child = { data: { id: id + '-child', type: 1, wrapped: { state: { expanded: true } } }, parent: root, x, y: 200 }
        return [root, child]
    }
    const render = (tag: string, nodes: any[]) => {
        probe.nodeTagActive = tag
        probe.d3nodes = new Map(nodes.map(node => [node.data.id, node]))
        probe.renderTopologyGroupRegions(() => 360, () => 92)
        return rendered
    }
    return { branch, render }
}

describe('Shared topology presentation', () => {
    it('uses the same rounded frames for Infrastructure hosts and Kubernetes clusters, retaining switch surfaces', () => {
        const { branch, render } = rendererProbe()
        const nodes = [...branch('a', 'host'), ...branch('b', 'switch', 1000)]
        const before = JSON.stringify(nodes)
        const expected = render('infrastructure', nodes)
        assert.strictEqual(expected.length, 2)
        assert.equal((expected[0].path.match(/ C /g) || []).length, 4)
        assert.strictEqual(expected[0].clipPath, undefined)
        const clusters = [...branch('a', 'cluster'), ...branch('b', 'switch', 1000)]
        assert.deepStrictEqual(render('kubernetes', clusters), expected)
        assert.deepStrictEqual(render('인프라스트럭처', nodes), expected)
        assert.strictEqual(JSON.stringify(nodes), before)
    })

    it('replaces the previous layer surfaces and clears them when its visible roots collapse', () => {
        const { branch, render } = rendererProbe()
        assert.deepStrictEqual(render('kubernetes', branch('cluster', 'cluster')).map(region => region.id), ['cluster'])
        const host = branch('host', 'host')
        assert.deepStrictEqual(render('인프라스트럭처', host).map(region => region.id), ['host'])
        host[0].data.wrapped.state.expanded = false
        assert.deepStrictEqual(render('인프라스트럭처', [host[0]]), [])
        assert.deepStrictEqual(render('kubernetes', []), [])
    })
})

describe('Search layer-switch animation lifecycle', () => {
    it('ignores an old transition callback after its level label was removed', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
        const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        const component = ast.statements.find(n => ts.isClassDeclaration(n) && n.name!.text === 'Topology') as ts.ClassDeclaration
        const method = component.members.find(n => n.name?.getText(ast) === 'showLevelLabel')!
        const context: any = {}; vm.createContext(context)
        vm.runInContext(ts.transpile(`class Probe { ${method.getText(ast)} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
        const probe = new context.Probe()
        const selection: any = { filter: () => selection, empty: () => true }
        probe.gLevelLabels = { selectAll: () => selection }
        assert.doesNotThrow(() => probe.showLevelLabel({ weight: 7080, bb: { height: 400, y: 100 } }))
    })
})
