import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyCardDimensions } from '../src/TopologyNodePresentation'

const source = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const component = ast.statements.filter(ts.isClassDeclaration).find(c => c.name?.text === 'Topology')!
const method = (name: string) => component.members.find(m => m.name?.getText(ast) === name)!.getText(ast)

describe('Topology stable detailed presentation after Semantic Zoom rollback', () => {
    it('keeps real card dimensions unchanged across zoom levels for objects and groups', () => {
        const context: any = { topologyCardDimensions, WrapperType: { Group: 3 } }
        vm.createContext(context)
        vm.runInContext(ts.transpile(`class Graph { ${method('topologyLayoutCardWidth')} ${method('topologyLayoutCardHeight')} }; this.Graph = Graph`,
            { target: ts.ScriptTarget.ES2018 }), context)
        const graph = new context.Graph()
        Object.assign(graph, { layerCardLayouts: new Map(), topologyNodeDisplayName: (n: any) => n.data.wrapped.id,
            topologyCardNetworkSummary: () => undefined })
        for (const [type, weight] of [['host', 5020], ['libvirt', 7060], ['libvirt', 7080], ['device', 5030], ['vlan', 5040], ['ovsbridge', 7040]] as const) {
            const resource: any = { id: `${type}-${weight}`, data: { Type: type, Name: type, State: 'UP' }, children: [], state: {}, getWeight: () => weight }
            for (const group of [false, true]) {
                const node = { data: { id: resource.id, type: group ? 3 : 1, wrapped: resource } }
                const expected = topologyCardDimensions(resource, group, { name: group ? undefined : resource.id })
                for (const scale of [.1, .15, .2, .25, .29, .36, .55, 1]) {
                    graph.currentZoom = () => scale
                    graph.cardWidthCache = new WeakMap(); graph.cardHeightCache = new WeakMap()
                    assert.equal(graph.topologyLayoutCardWidth(node), expected.width)
                    assert.equal(graph.topologyLayoutCardHeight(node), expected.height)
                }
            }
        }
    })

    it('only transforms the viewport when zooming or panning across the former mode boundaries', () => {
        let handler: ts.ArrowFunction | undefined
        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'on'
                && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === 'zoom' && ts.isArrowFunction(node.arguments[1])) handler = node.arguments[1]
            ts.forEachChild(node, visit)
        }
        visit(component.members.find(m => m.name?.getText(ast) === 'createSVG')!)
        const context: any = { event: {} }
        vm.createContext(context)
        vm.runInContext(ts.transpile(`class Graph { onZoom() ${handler!.body.getText(ast)} }; this.Graph = Graph`, { target: ts.ScriptTarget.ES2018 }), context)
        const graph = new context.Graph(), transforms: string[] = [], reports: number[] = []
        Object.assign(graph, { props: { onZoomChange: (scale: number) => reports.push(scale) }, g: { attr: (_name: string, value: string) => transforms.push(value) },
            showAllLevelLabels: () => undefined, updateTopologyHostCaptions: () => undefined, hideNodeContextMenu: () => undefined,
            cancelScheduledZoomFit: () => undefined,
            topologyNodeFocus: null, renderTree: () => assert.fail('zoom must not rebuild the tree') })
        const scales = [.55, .29, .25, .2, .15, .1, .29, .55]
        for (const k of scales) for (const x of [0, 80, -80]) {
            context.event = { sourceEvent: { type: 'wheel' }, transform: { x, y: 20, k, toString: () => `translate(${x},20) scale(${k})` } }
            graph.onZoom()
            assert.equal(graph.absTransformX, x / k)
        }
        assert.equal(transforms.length, scales.length * 3)
        assert.equal(reports.length, transforms.length)
        assert.ok(!source.includes('scheduleVMSemanticZoom'))
        assert.ok(!source.includes('data-infrastructure-semantic-mode'))
        assert.ok(!source.includes('infrastructureDenseVMLayout'))
    })

    it('uses the original detailed renderer and measurement-only traffic labels at every scale', () => {
        assert.ok(!method('renderNodeContents').includes('semanticMode'))
        assert.ok(!method('applyZoomFit').includes('renderTree'))
        const context: any = {}
        vm.createContext(context)
        vm.runInContext(ts.transpile(`class Graph { ${method('linkLabelOpacity')} }; this.Graph = Graph`, { target: ts.ScriptTarget.ES2018 }), context)
        const graph = new context.Graph()
        Object.assign(graph, { hasInlineLinkLabel: (link: any) => !!link.label, linkDisplayOpacity: () => 1,
            isLinkNodeSelected: () => false, hasSelectedLinkNode: () => false })
        for (const k of [.1, .2, .29, .55, 1]) {
            graph.currentZoom = () => k
            assert.equal(graph.linkLabelOpacity({ label: '12 Kbps' }), 1)
            assert.equal(graph.linkLabelOpacity({ label: '' }), 0)
        }
    })
})
