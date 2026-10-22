import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

const ast = ts.createSourceFile('App.tsx', readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const appClass = ast.statements.find(statement => ts.isClassDeclaration(statement) && statement.name?.text === 'App') as ts.ClassDeclaration
const methods = ['navigateProblemResource', 'openProblemsPanel'].map(name => appClass.members.find(member => member.name?.getText(ast) === name)!.getText(ast)).join('\n')
const harness = () => {
    const timers = new Map<number, () => void>()
    const delays: number[] = []
    let next = 0
    const context: any = { window: {
        setTimeout: (callback: () => void, delay: number) => { delays.push(delay); timers.set(++next, callback); return next },
        clearTimeout: (id: number) => timers.delete(id)
    }, isKubernetesTopologyData: (data: any) => data.Manager === 'k8s', KUBERNETES_WORKLOAD_TYPES: new Set(['deployment']) }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${methods} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
    const app = new context.Probe()
    const calls: string[] = []
    const node = { id: 'pod', data: { Manager: 'k8s', Type: 'pod' }, tags: ['kubernetes'], state: { selected: false } }
    app.state = { isProblemsOpen: true, isSelectionOpen: false, isTimetravelOpen: false, problemListRevision: 3 }
    app.tc = { nodes: new Map([[node.id, node]]), centerNode: (target: any) => calls.push(`center:${target.id}`),
        focusProblemResource: (id: string) => { node.state.selected = true; calls.push(`highlight:${id}`); return true } }
    app.setState = (update: any, complete?: () => void) => { Object.assign(app.state, typeof update === 'function' ? update(app.state) : update); complete?.() }
    app.closeSidePanels = (state: any) => { app.state.isProblemsOpen = false; Object.assign(app.state, state) }
    app.syncTopologyNodeTagForNodes = (ids: string[]) => {
        assert.deepEqual(Array.from(ids), [node.id])
        assert.equal(app.state.isSelectionOpen, true, 'detail panel is open before centering bounds are measured')
        calls.push('layer')
    }
    app.navigateInfrastructureConnectedResources = () => { throw new Error('must not reveal/Fit the same problem a second time') }
    app.focusInfrastructureNodeIDs = () => calls.push('relationship-detail')
    app.openSelection = () => calls.push('details')
    app.notify = () => calls.push('missing')
    return { app, calls, node, timers, delays }
}

describe('Current problem navigation', () => {
    it('opens the problem workspace without a competing object or history drawer and keeps graph context', () => {
        for (const returning of [false, true]) {
            const { app } = harness()
            app.state.isSelectionOpen = true
            app.state.isTimetravelOpen = true
            app.state.problemContextID = 'pod'
            app.openProblemsPanel(returning)
            assert.equal(app.state.isProblemsOpen, true)
            assert.equal(app.state.isSelectionOpen, false)
            assert.equal(app.state.isTimetravelOpen, false)
            assert.equal(app.state.problemContextID, 'pod')
            assert.equal(app.state.problemListRevision, returning ? 4 : 3)
        }
    })
    it('uses one reveal route and one camera move without the previous 600ms pause', () => {
        const { app, calls, node, timers, delays } = harness()
        app.navigateProblemResource(node)
        assert.equal(app.state.isProblemsOpen, false)
        assert.deepEqual(calls, ['layer', 'details', 'highlight:pod'])
        assert.deepEqual(delays, [0])
        timers.values().next().value!()
        assert.deepEqual(calls, ['layer', 'details', 'highlight:pod', 'center:pod'])
    })
    it('does not pull the viewport back after a newer selection, closed details or reopened problem list', () => {
        for (const change of ['selection', 'details', 'problems', 'escape']) {
            const { app, calls, node, timers } = harness()
            app.navigateProblemResource(node)
            if (change === 'selection') node.state.selected = false
            if (change === 'details') app.state.isSelectionOpen = false
            if (change === 'problems') app.state.isProblemsOpen = true
            if (change === 'escape') app.state.problemContextID = undefined
            timers.values().next().value!()
            assert.equal(calls.some(call => call.startsWith('center:') || call.startsWith('fit:')), false)
        }
    })
    it('cancels a previous pending camera move when another problem is selected', () => {
        const { app, node, timers, calls } = harness()
        app.navigateProblemResource(node)
        app.navigateProblemResource(node)
        assert.equal(timers.size, 1)
        timers.values().next().value!()
        assert.equal(calls.filter(call => call === 'center:pod').length, 1)
    })
    it('keeps relationship-only resources on the detail route and ignores removed targets', () => {
        const { app, calls, node, timers } = harness()
        node.data.Type = 'service'
        app.navigateProblemResource(node)
        assert.deepEqual(calls, ['relationship-detail', 'details', 'highlight:pod'])
        assert.equal(timers.size, 0)
        app.tc.nodes.clear(); calls.length = 0
        app.navigateProblemResource(node)
        assert.deepEqual(calls, ['missing'])
    })
})
