import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

// Exercise production preference and sync handlers without a backend or SVG.
function layerProbe(saved = new Map<string, string>()) {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
    const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const app = ast.statements.filter(ts.isClassDeclaration).find(node => node.name?.text === 'App')!
    const names = ['parseTopology', 'onWebSocketMessage', 'activeNodeTagName', 'onInitialTopologyLayerChange']
    const methods = app.members.filter(member => member.name && names.includes(member.name.getText(ast)))
        .map(member => member.getText(ast)).join('\n')
    const settings = ast.statements.filter(ts.isVariableStatement).filter(statement =>
        statement.declarationList.declarations.some(declaration =>
            ['INITIAL_TOPOLOGY_LAYER_STORAGE_KEY', 'getSavedInitialTopologyLayer'].includes(declaration.name.getText(ast))))
        .map(statement => statement.getText(ast)).join('\n')
    const topologySource = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
    const topologyAst = ts.createSourceFile('Topology.tsx', topologySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const topology = topologyAst.statements.filter(ts.isClassDeclaration).find(node => node.name?.text === 'Topology')!
    const activate = topology.members.find(member => member.name?.getText(topologyAst) === 'activeNodeTag')!.getText(topologyAst)
    const context: any = { localStorage: { getItem: (key: string) => saved.get(key), setItem: (key: string, value: string) => saved.set(key, value) } }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`${settings}\nclass Probe { ${methods} }; class Graph { ${activate} };
        this.Probe = Probe; this.Graph = Graph; this.loadLayer = getSavedInitialTopologyLayer`,
        { target: ts.ScriptTarget.ES2018 }), context)
    const panel = new context.Probe()
    const graph = new context.Graph()
    Object.assign(graph, {
        nodeTagStates: new Map(), nodeTagActive: 'infrastructure', invalidate: () => undefined,
        zoomFitAfterRender: () => undefined,
        resetTree: () => { graph.nodeTagStates = new Map(); graph.nodeTagActive = 'infrastructure' },
        completeTopologySync: () => undefined
    })
    Object.assign(panel, {
        state: { initialTopologyLayer: context.loadLayer(), nodeTagStates: graph.nodeTagStates },
        initialTopologyLayerPending: true, tc: graph,
        config: { defaultNodeTag: () => 'infrastructure' },
        setState: (update: any) => Object.assign(panel.state, update),
        addNode: (node: any) => {
            if (!graph.nodeTagStates.has(node.tag)) graph.nodeTagStates.set(node.tag, false)
        },
        addEdge: () => undefined, reconcileKubernetesWorkloadHierarchy: () => undefined,
        reconcileManualPortMappingLinks: () => undefined, debSetState: () => undefined,
        updateFilters: () => undefined, pruneRecentViewedNodes: () => undefined,
        pendingTopologyEdges: { clear: () => undefined }, refreshManualPortMappingLinks: () => undefined
    })
    return { panel, graph, saved }
}

describe('Initial topology layer preference', () => {
    it('persists the selection and restores it on the next application instance', () => {
        const { panel, graph, saved } = layerProbe()
        panel.onInitialTopologyLayerChange('kubernetes')
        assert.strictEqual(saved.get('netdive-initial-topology-layer'), 'kubernetes')
        assert.strictEqual(graph.nodeTagActive, 'infrastructure') // applies on next visit
        const reopened = layerProbe(saved)
        assert.strictEqual(reopened.panel.state.initialTopologyLayer, 'kubernetes')
        reopened.panel.parseTopology({ Nodes: [] })
        assert.strictEqual(reopened.graph.nodeTagActive, 'kubernetes')
        assert.strictEqual(reopened.graph.nodeTagStates.get('kubernetes'), true)
    })

    it('keeps Kubernetes selected when the initial snapshot contains only infrastructure', () => {
        const { panel, graph } = layerProbe(new Map([['netdive-initial-topology-layer', 'kubernetes']]))
        panel.parseTopology({ Nodes: [{ tag: 'infrastructure' }] })
        panel.parseTopology({ Nodes: [{ tag: 'kubernetes' }] })
        assert.strictEqual(graph.nodeTagActive, 'kubernetes')
        assert.strictEqual(graph.nodeTagStates.get('infrastructure'), false)
    })

    it('preserves the current layer across an unsolicited authoritative resync', () => {
        const { panel, graph } = layerProbe()
        panel.parseTopology({ Nodes: [{ tag: 'infrastructure' }, { tag: 'kubernetes' }] })
        graph.activeNodeTag('kubernetes')
        panel.onWebSocketMessage(JSON.stringify({ Type: 'SyncReply', Obj: { Nodes: [{ tag: 'infrastructure' }] } }))
        assert.strictEqual(graph.nodeTagActive, 'kubernetes')
    })

    it('keeps infrastructure as the default and respects an explicit filter layer after initialization', () => {
        const { panel, graph, saved } = layerProbe()
        panel.parseTopology({ Nodes: [{ tag: 'infrastructure' }, { tag: 'kubernetes' }] })
        assert.strictEqual(graph.nodeTagActive, 'infrastructure')
        panel.nextTag = 'kubernetes'
        panel.onWebSocketMessage(JSON.stringify({ Type: 'SyncReply', Obj: { Nodes: [] } }))
        assert.strictEqual(graph.nodeTagActive, 'kubernetes')
        panel.onInitialTopologyLayerChange('infrastructure')
        const reopened = layerProbe(saved)
        assert.strictEqual(reopened.panel.state.initialTopologyLayer, 'infrastructure')
    })
})
