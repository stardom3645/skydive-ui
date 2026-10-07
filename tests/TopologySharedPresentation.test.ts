import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyGroupRegions, TopologyGroupRegion } from '../src/TopologyGroupRegions'

// Exercise the production rendering entry point, including layer decisions;
// testing only the geometry helper would miss a Kubernetes-only render gate.
function rendererProbe() {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
    const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const component = ast.statements.find(n => ts.isClassDeclaration(n) && n.name!.text === 'Topology') as ts.ClassDeclaration
    const method = component.members.find(n => n.name?.getText(ast) === 'renderTopologyGroupRegions')!
    const context: any = { topologyGroupRegions, WrapperType: { Hidden: 2 }, animDuration: 0 }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${method.getText(ast)} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
    const probe = new context.Probe()
    let rendered: TopologyGroupRegion[] = []
    const join: any = {
        data: (regions: TopologyGroupRegion[]) => { rendered = regions; return join },
        select: () => join, exit: () => join, remove: () => join, enter: () => join,
        append: () => join, merge: () => join, attr: () => join, style: () => join,
        transition: () => join, duration: () => join
    }
    probe.g = { classed: () => probe.g }
    probe.gGroupRegions = { selectAll: () => join }
    probe.root = {}
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
    it('renders the same group surfaces for Kubernetes and both infrastructure tag names', () => {
        const { branch, render } = rendererProbe()
        const nodes = [...branch('a', 'host'), ...branch('b', 'switch', 1000)]
        const before = JSON.stringify(nodes)
        const expected = render('kubernetes', nodes)
        assert.strictEqual(expected.length, 2)
        for (const tag of ['infrastructure', '인프라스트럭처']) {
            assert.deepStrictEqual(render(tag, nodes), expected)
        }
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
