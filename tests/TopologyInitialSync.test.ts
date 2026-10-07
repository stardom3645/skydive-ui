import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

// Execute the production constructor and reset/selection path without loading
// React or a backend. An SVG can exist before the first graph has rendered.
function initialSyncProbe() {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
    const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const classes = ast.statements.filter(ts.isClassDeclaration)
    const graph = classes.find(node => node.name?.text === 'Topology')!
    const methods = ['defaultState', 'initTree', 'resetTree', 'unselectAllNodes',
        'unselectAllLinks', 'hideLinks', 'syncTopologyRelationEmphasis']
    const members = graph.members.filter(member => ts.isConstructorDeclaration(member)
        || (ts.isPropertyDeclaration(member) && member.initializer)
        || (member.name && methods.includes(member.name.getText(ast))))
        .map(member => member.getText(ast)).join('\n')
    const nodeClass = classes.find(node => node.name?.text === 'Node')!.getText(ast).replace('export ', '')
    const surfaceClasses = new Map<string, boolean>()
    const emptySelection: any = {
        selectAll: () => emptySelection,
        each: () => emptySelection,
        classed: () => emptySelection
    }
    const context: any = {
        React: { Component: class { constructor(public props: any) {} } },
        TopologyReactRoots: class {}, flextree: () => undefined,
        selectAll: () => emptySelection,
        WrapperType: { Normal: 1, Hidden: 2, Group: 3 }
    }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`${nodeClass}\nclass Topology extends React.Component { ${members} }; this.Topology = Topology`,
        { target: ts.ScriptTarget.ES2018 }), context)
    const topology = new context.Topology({ defaultNodeTag: () => 'kubernetes' })
    let renders = 0
    Object.assign(topology, {
        gNodes: emptySelection, gHieraLinks: emptySelection, gLinks: emptySelection,
        gLinkOverlays: emptySelection,
        g: { classed: (name: string, active: boolean) => surfaceClasses.set(name, active) },
        unpinNodes: () => undefined,
        updateLevelLabelActiveClass: () => undefined,
        renderTree: () => { renders++; topology.d3nodes = new Map() }
    })
    return { topology, surfaceClasses, renders: () => renders }
}

describe('Topology first-sync selection lifecycle', () => {
    it('resets a mounted SVG before the first graph render', () => {
        const { topology, surfaceClasses, renders } = initialSyncProbe()
        assert.doesNotThrow(() => topology.resetTree(true))
        assert.strictEqual(renders(), 1)
        assert.strictEqual(topology.topologySyncInProgress, true)
        assert.strictEqual(surfaceClasses.get('has-relation-focus'), false)
    })

    it('continues clearing emphasis on repeated empty synchronizations', () => {
        const { topology, surfaceClasses, renders } = initialSyncProbe()
        for (let sync = 0; sync < 3; sync++) {
            surfaceClasses.set('has-relation-focus', true)
            topology.resetTree()
            assert.strictEqual(surfaceClasses.get('has-relation-focus'), false)
        }
        assert.strictEqual(renders(), 3)
    })

    it('still emphasizes selected rendered resources and clears their focus', () => {
        const { topology, surfaceClasses } = initialSyncProbe()
        const resource = { data: { id: 'worker', type: 1, wrapped: { state: { selected: true } } } }
        topology.d3nodes.set('worker', resource)
        topology.syncTopologyRelationEmphasis()
        assert.strictEqual(surfaceClasses.get('has-relation-focus'), true)
        resource.data.wrapped.state.selected = false
        topology.syncTopologyRelationEmphasis()
        assert.strictEqual(surfaceClasses.get('has-relation-focus'), false)
        assert.doesNotThrow(() => topology.resetTree())
    })
})
