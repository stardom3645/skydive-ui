import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

class Clock {
    now = 0
    id = 0
    tasks = new Map<number, { at: number; fn: () => void }>()
    set = (fn: () => void, delay: number) => {
        const id = ++this.id
        this.tasks.set(id, { at: this.now + delay, fn })
        return id
    }
    clear = (id: number) => { this.tasks.delete(id) }
    advance(ms: number) {
        const until = this.now + ms
        while (true) {
            const task = [...this.tasks].sort((a, b) => a[1].at - b[1].at)[0]
            if (!task || task[1].at > until) break
            this.now = task[1].at
            this.tasks.delete(task[0])
            task[1].fn()
        }
        this.now = until
    }
}

function methods(file: string, name: string, names: string[]) {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/' + file), 'utf8')
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const component = ast.statements.filter(ts.isClassDeclaration).find(node => node.name?.text === name)!
    return component.members.filter(member => member.name && names.includes(member.name.getText(ast)))
        .map(member => member.getText(ast)).join('\n')
}

function probe() {
    const clock = new Clock(), fits: number[] = [], transforms: any[] = []
    const root = { data: { id: 'root', type: 2, wrapped: { state: {} } }, x: 0, y: 0 }
    const layout = { each: (fn: any) => fn(root) }
    const identity = { x: 0, y: 0, k: 1,
        translate(x: number, y: number) { return { ...this, x, y } },
        scale(k: number) { return { ...this, k } } }
    const context: any = { zoomIdentity: identity, hierarchy: () => layout,
        WrapperType: { Hidden: 2, Normal: 1 }, topologyGroupStackOffset: 0,
        topologySiblingCardGap: 44, topologyLevelLabelSafeInset: 130, animDuration: 500,
        window: { setTimeout: clock.set, clearTimeout: clock.clear,
            requestAnimationFrame: (fn: () => void) => clock.set(fn, 16), cancelAnimationFrame: clock.clear } }
    vm.createContext(context)
    const names = ['cancelScheduledZoomFit', 'zoomFitAfterRender', 'relayoutInfrastructureVMs', 'onResize',
        'renderTree', 'setZoomLevel', 'moveTo', 'zoomFit', 'renderedNodeBounds', 'applyZoomFit']
    vm.runInContext(ts.transpile(`class Probe { ${methods('Topology.tsx', 'Topology', names)} }; this.Probe = Probe`,
        { target: ts.ScriptTarget.ES2018 }), context)
    const graph = new context.Probe()
    const svg: any = { attr: () => svg, interrupt: () => svg, transition: () => svg, duration: () => svg,
        node: () => ({ __zoom: identity }), call: (fn: any, value: any) => { fn(svg, value); return svg } }
    Object.assign(graph, { props: { infrastructureVMLayout: 'compact' }, nodeTagActive: 'infrastructure',
        svg, g: { classed: () => undefined }, zoom: { transform: (_svg: any, value: any) => transforms.push(value) },
        root: root.data.wrapped, nodes: new Map(), d3nodes: new Map([['root', root]]),
        viewSize: () => ({ width: 1000, height: 600 }), zoomFitPending: false, zoomFitTimeoutID: 0, zoomFitAnimationFrameID: 0 })
    for (const name of ['pruneGroupState', 'updateLayerCardLayouts', 'tree', 'separateTopologyLanes', 'compactVmLayerLayout',
        'compactHostSubtreeLayout', 'separateTopologyBranches', 'applyInfrastructureCompactLayout',
        'renderLevels', 'renderHieraLinks', 'renderNodes', 'renderGroups', 'renderLinks',
        'refreshTopologyNodeFocus', 'applyTopologyNodeFocus', 'syncTopologyRelationEmphasis', 'syncResourceData']) graph[name] = () => undefined
    graph.normalizeTree = () => root
    const applyFit = graph.applyZoomFit.bind(graph)
    graph.applyZoomFit = () => fits.push(clock.now)
    return { graph, clock, fits, transforms, applyFit }
}

describe('Topology automatic Fit lifecycle', () => {
    it('retains layer/sync Fit across a resize followed by Compact relayout', () => {
        const { graph, clock, fits } = probe()
        graph.zoomFitAfterRender()
        clock.advance(100)
        graph.onResize({ width: 1000, height: 600 })
        clock.advance(150)
        assert.equal(graph.zoomFitPending, true)
        clock.advance(499)
        assert.deepEqual(fits, [])
        clock.advance(33)
        assert.deepEqual(fits, [782])
        assert.equal(graph.zoomFitPending, false)
    })

    it('waits for the latest full render, then leaves background updates at the user viewport', () => {
        const { graph, clock, fits } = probe()
        graph.zoomFitAfterRender()
        clock.advance(300)
        graph.renderTree()
        clock.advance(499)
        assert.deepEqual(fits, [])
        clock.advance(33)
        assert.deepEqual(fits, [832])
        graph.renderTree()
        graph.onResize({ width: 900, height: 600 })
        clock.advance(2000)
        assert.deepEqual(fits, [832])
    })

    it('cancels pending Fit for explicit zoom or object navigation, including queued animation frames', () => {
        const { graph, clock, fits, transforms } = probe()
        graph.zoomFitAfterRender()
        clock.advance(500)
        graph.setZoomLevel(0.7)
        clock.advance(1000)
        assert.deepEqual(fits, [])
        graph.zoomFitAfterRender()
        graph.moveTo(500, 300)
        clock.advance(1000)
        assert.deepEqual(fits, [])
        assert.deepEqual(transforms.map(value => value.k), [0.7, 0.56])
    })

    it('fits final active-node coordinates, excludes exiting nodes, and retains focused Fit bounds', () => {
        const { graph, applyFit, transforms } = probe()
        const a = { data: { id: 'a' }, x: 0, y: 0 }, b = { data: { id: 'b' }, x: 600, y: 300 }
        graph.d3nodes = new Map([['a', a], ['b', b]])
        const dom = [
            { data: { id: 'a' }, x: -1000, y: -1000, box: { x: -100, y: -50, width: 200, height: 100 } },
            { ...b, box: { x: -150, y: -100, width: 300, height: 200 } },
            { data: { id: 'exiting' }, x: -9000, y: -9000, box: { x: 0, y: 0, width: 10000, height: 10000 } }
        ]
        graph.gNodes = { node: () => ({ getBBox: () => { throw new Error('stale group bounds') } }),
            selectAll: () => ({ each: (fn: any) => dom.forEach(node => fn.call({ getBBox: () => node.box }, node)) }) }
        applyFit()
        const scale = 0.65 / Math.max(850 / 870, 450 / 600)
        assert.equal(transforms[0].k, scale)
        assert.equal(transforms[0].x, 565 - 325 * scale)
        assert.equal(transforms[0].y, 300 - 175 * scale)
        applyFit(new Set(['b']))
        assert.deepEqual([transforms[1].x, transforms[1].y, transforms[1].k], [-35, 0, 1])
        graph.d3nodes.clear()
        applyFit()
        assert.equal(transforms.length, 2, 'an empty layer must not fit the exiting layer')
    })

    it('requests Fit for an explicit layer selection even when the current layer is reselected', () => {
        const context: any = {}
        vm.createContext(context)
        vm.runInContext(ts.transpile(`class AppProbe { ${methods('App.tsx', 'App', ['activeNodeTag', 'activeNodeTagName'])} }; this.AppProbe = AppProbe`,
            { target: ts.ScriptTarget.ES2018 }), context)
        const app = new context.AppProbe()
        let requests = 0, clears = 0
        app.tc = { nodeTagStates: new Map([['infrastructure', true], ['kubernetes', false]]),
            activeNodeTag: (tag: string) => app.tc.nodeTagStates.forEach((_active: boolean, key: string) => app.tc.nodeTagStates.set(key, key === tag)),
            zoomFitAfterRender: () => requests++ }
        app.state = { nodeTagStates: app.tc.nodeTagStates }
        app.clearSelectionForLayerChange = () => clears++
        app.setState = () => undefined
        app.pruneRecentViewedNodes = () => undefined
        app.activeNodeTag('kubernetes')
        app.activeNodeTag('kubernetes')
        assert.equal(requests, 2)
        assert.equal(clears, 1)
    })
})
