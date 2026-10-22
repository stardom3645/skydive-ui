import { nextLLDPExpiryDelay } from '../src/LLDPTopologyValidity'
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
    const source = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
    const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const constant = (name: string) => {
        const statement = ast.statements.filter(ts.isVariableStatement).find(node =>
            node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === name))!
        return Number(statement.declarationList.declarations.find(node => node.name.getText(ast) === name)!.initializer!.getText(ast))
    }
    const initialScale = constant('topologyInitialScale'), autoFitMinScale = constant('topologyAutoFitMinScale'), autoFitMaxScale = constant('topologyAutoFitMaxScale')
    const clock = new Clock(), fits: number[] = [], transforms: any[] = []
    const root = { data: { id: 'root', type: 2, wrapped: { state: {} } }, x: 0, y: 0 }
    const layout = { each: (fn: any) => fn(root) }
    const identity = { x: 0, y: 0, k: 1,
        translate(x: number, y: number) { return { ...this, x, y } },
        scale(k: number) { return { ...this, k } } }
    const context: any = { nextLLDPExpiryDelay, zoomIdentity: identity, hierarchy: () => layout,
        WrapperType: { Hidden: 2, Normal: 1 }, topologyGroupStackOffset: 0,
        topologySiblingCardGap: 44, topologyLevelLabelSafeInset: 130, animDuration: 500, topologyInitialScale: initialScale, topologyAutoFitMinScale: autoFitMinScale, topologyAutoFitMaxScale: autoFitMaxScale,
        document: { querySelector: () => null },
        select: () => ({ node: () => null }), event: { stopPropagation: () => undefined },
        window: { setTimeout: clock.set, clearTimeout: clock.clear,
            requestAnimationFrame: (fn: () => void) => clock.set(fn, 16), cancelAnimationFrame: clock.clear } }
    vm.createContext(context)
    const names = ['cancelScheduledZoomFit', 'fitAfterBranchChange', 'zoomFitAfterRender', 'relayoutInfrastructureVMs', 'onResize',
        'renderTree', 'deferProblemViewportRender', 'scheduleLLDPExpiry', 'currentZoom', 'setZoomLevel', 'moveTo', 'zoomFit', 'renderedNodeBounds', 'applyZoomFit',
        'toggleGroupListNode', 'setGroupListNodes', 'syncGroupDisplaySize', 'nodeClicked', 'centerNode', 'expand', 'collapse', 'setFullGroupDisplay', 'expandAllNodes', 'collapseAllNodes', 'zoomFitFocusedNodes', 'fitBounds']
    const zoomHandlers = new Map<string, string>()
    const collectZoomHandlers = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'on'
            && node.arguments.length === 2 && ts.isStringLiteral(node.arguments[0]) && ts.isArrowFunction(node.arguments[1])
            && ['start', 'zoom'].includes(node.arguments[0].text)) {
            zoomHandlers.set(node.arguments[0].text, node.arguments[1].body.getText(ast))
        }
        ts.forEachChild(node, collectZoomHandlers)
    }
    collectZoomHandlers(ast)
    vm.runInContext(ts.transpile(`class Probe { ${methods('Topology.tsx', 'Topology', names)}
        onZoomStart() ${zoomHandlers.get('start')} onZoomGesture() ${zoomHandlers.get('zoom')}
    }; this.Probe = Probe`,
        { target: ts.ScriptTarget.ES2018 }), context)
    const graph = new context.Probe()
    graph.links = new Map()
    let current = identity.scale(initialScale)
    let interrupts = 0
    const svg: any = { attr: () => svg, interrupt: () => { interrupts++; return svg }, transition: () => svg, duration: () => svg,
        node: () => ({ __zoom: current }), call: (fn: any, value: any) => { fn(svg, value); return svg } }
    Object.assign(graph, { props: { infrastructureVMLayout: 'compact' }, nodeTagActive: 'infrastructure',
        svg, g: { classed: () => undefined, attr: () => undefined }, zoom: { transform: (_svg: any, value: any) => { current = value; transforms.push(value) } },
        root: root.data.wrapped, nodes: new Map(), nodeGroup: new Map(), d3nodes: new Map([['root', root]]),
        topologyLayoutCardWidth: () => 320, topologyLayoutCardHeight: () => 180,
        viewSize: () => ({ width: 1000, height: 600 }), zoomFitPending: false, zoomFitTimeoutID: 0, zoomFitAnimationFrameID: 0 })
    for (const name of ['pruneGroupState', 'updateLayerCardLayouts', 'tree', 'separateTopologyLanes', 'compactVmLayerLayout',
        'compactHostSubtreeLayout', 'separateTopologyBranches', 'applyInfrastructureCompactLayout', 'layoutKubernetesNamespaces',
        'layoutSwitchPortsByConnection',
        'renderLevels', 'renderHieraLinks', 'renderNodes', 'renderGroups', 'renderLinks',
        'refreshTopologyNodeFocus', 'applyTopologyNodeFocus', 'syncTopologyRelationEmphasis', 'syncResourceData',
        'showAllLevelLabels', 'hideNodeContextMenu', 'updateLevelLabelBackdrop', 'updateTopologyHostCaptions']) graph[name] = () => undefined
    graph.normalizeTree = () => root
    graph.infrastructureSceneLayoutKey = () => ''
    const applyFit = graph.applyZoomFit.bind(graph)
    graph.applyZoomFit = () => fits.push(clock.now)
    return { graph, clock, fits, transforms, applyFit, context, interrupts: () => interrupts }
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
        assert.deepEqual(transforms.map(value => value.k), [0.7, 0.55, 0.8])
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

    it('caps automatic Fit for one card at 55%, while explicit Fit can still use 100%', () => {
        const { graph, clock, transforms, applyFit } = probe()
        const card = { data: { id: 'only-card' }, x: 200, y: 100 }
        graph.d3nodes = new Map([['only-card', card]])
        graph.gNodes = { node: () => ({}), selectAll: () => ({ each: (fn: any) =>
            fn.call({ getBBox: () => ({ x: -160, y: -90, width: 320, height: 180 }) }, card) }) }
        graph.applyZoomFit = applyFit
        graph.zoomFitAfterRender()
        clock.advance(532)
        assert.equal(transforms[0].k, 0.55)
        assert.equal(graph.currentZoom(), 0.55)
        graph.zoomFit()
        assert.equal(transforms[1].k, 1)
        graph.setZoomLevel(1.2)
        assert.equal(graph.currentZoom(), 1.2, 'manual zoom is not capped by automatic Fit')
    })

    it('immediately zooms out a new layer before the delayed Fit, preserving its pending lifecycle', () => {
        const { graph, clock, fits, transforms } = probe()
        graph.setZoomLevel(1)
        graph.zoomFitAfterRender()
        assert.equal(clock.now, 0)
        assert.equal(graph.currentZoom(), 0.55)
        assert.equal(transforms[transforms.length - 1].k, 0.55)
        assert.equal(graph.zoomFitPending, true)
        clock.advance(532)
        assert.deepEqual(fits, [532])
    })

    it('keeps initial/layer Fit within 55% and focused navigation within 80%', () => {
        const { graph, clock, transforms, applyFit } = probe()
        const card = { data: { id: 'changing-layout' }, x: 0, y: 0 }
        let width = 320, height = 180
        graph.d3nodes = new Map([[card.data.id, card]])
        graph.gNodes = { node: () => ({}), selectAll: () => ({ each: (fn: any) =>
            fn.call({ getBBox: () => ({ x: 0, y: 0, width, height }) }, card) }) }
        graph.applyZoomFit = applyFit
        const fit = () => { graph.zoomFitAfterRender(); clock.advance(532); return graph.currentZoom() }
        assert.equal(fit(), 0.55)
        width = 2400; height = 1200
        const expanded = fit()
        assert.ok(expanded < 0.55, 'larger layouts still fit in the viewport')
        width = 1200; height = 600
        const reduced = fit()
        assert.ok(reduced > expanded && reduced <= 0.55, 'a tighter layout can grow again within the cap')
        width = 320; height = 180
        assert.equal(fit(), 0.55)
        graph.zoomFitFocusedNodes(new Set([card.data.id]))
        assert.equal(graph.currentZoom(), 0.8)
        graph.fitBounds({ x: 0, y: 0, width: 320, height: 180 })
        assert.equal(graph.currentZoom(), 0.8)
        assert.ok(transforms.every(value => value.k <= 0.8))
    })

    it('limits a branch expansion to a 20% zoom-out step, including a resize before Fit settles', () => {
        const { graph, clock, applyFit } = probe()
        graph.nodeTagActive = 'kubernetes'
        const card = { data: { id: 'expanded-branch' }, x: 0, y: 0 }
        let width = 3200
        graph.d3nodes = new Map([[card.data.id, card]])
        graph.gNodes = { node: () => ({}), selectAll: () => ({ each: (fn: any) =>
            fn.call({ getBBox: () => ({ x: 0, y: 0, width, height: 300 }) }, card) }) }
        graph.applyZoomFit = applyFit
        graph.groupStates = new Map()
        graph.props.infrastructureVMLayout = 'rows'
        graph.resetCacheAndRenderTree = () => undefined
        const parent = { id: 'parent', state: { expanded: false }, children: [] }
        graph.expand(parent)
        clock.advance(100)
        graph.onResize({ width: 900, height: 600 })
        clock.advance(532)
        assert.ok(Math.abs(graph.currentZoom() - 0.44) < 1e-8)
        width = 320
        graph.expand(parent)
        clock.advance(532)
        assert.equal(graph.currentZoom(), 0.8, 'a compact branch can grow to the automatic cap')
    })

    it('starts at 55%, allows branch Fit up to 80%, and restores 55% for a new layer', () => {
        const { graph, clock, applyFit } = probe()
        graph.nodeTagActive = 'kubernetes'
        const card = { data: { id: 'sparse-branch' }, x: 0, y: 0 }
        graph.d3nodes = new Map([[card.data.id, card]])
        graph.gNodes = { node: () => ({}), selectAll: () => ({ each: (fn: any) =>
            fn.call({ getBBox: () => ({ x: 0, y: 0, width: 320, height: 180 }) }, card) }) }
        graph.applyZoomFit = applyFit
        graph.groupStates = new Map()
        graph.props.infrastructureVMLayout = 'rows'
        graph.resetCacheAndRenderTree = () => undefined
        assert.equal(graph.currentZoom(), 0.55)
        graph.expand({ id: 'parent', state: { expanded: false }, children: [] })
        clock.advance(100)
        graph.onResize({ width: 900, height: 600 })
        clock.advance(532)
        assert.equal(graph.currentZoom(), 0.8, 'resizing must retain the pending branch limit')
        graph.zoomFitAfterRender()
        assert.equal(graph.currentZoom(), 0.55, 'a new layer immediately restores the initial limit')
        clock.advance(532)
        assert.equal(graph.currentZoom(), 0.55)
    })

    it('keeps all automatic Fit paths at or above 28% while allowing manual zoom below it', () => {
        const { graph, clock, applyFit } = probe()
        graph.nodeTagActive = 'kubernetes'
        const card = { data: { id: 'wide-layout' }, x: 0, y: 0 }
        graph.d3nodes = new Map([[card.data.id, card]])
        graph.gNodes = { node: () => ({}), selectAll: () => ({ each: (fn: any) =>
            fn.call({ getBBox: () => ({ x: 0, y: 0, width: 10000, height: 300 }) }, card) }) }
        graph.applyZoomFit = applyFit
        graph.zoomFitAfterRender()
        clock.advance(532)
        assert.equal(graph.currentZoom(), 0.28, 'initial/layer Fit respects the automatic minimum')
        graph.groupStates = new Map()
        graph.props.infrastructureVMLayout = 'rows'
        graph.resetCacheAndRenderTree = () => undefined
        const parent = { id: 'parent', state: { expanded: false }, children: [] }
        for (let i = 0; i < 4; i++) {
            graph.expand(parent)
            graph.onResize({ width: 900, height: 600 })
            clock.advance(532)
            assert.equal(graph.currentZoom(), 0.28, 'repeated expansion cannot go below 28%')
        }
        graph.zoomFitFocusedNodes(new Set([card.data.id]))
        assert.equal(graph.currentZoom(), 0.28)
        graph.fitBounds({ x: 0, y: 0, width: 10000, height: 300 })
        assert.equal(graph.currentZoom(), 0.28)
        graph.zoomFit()
        assert.equal(graph.currentZoom(), 0.1, 'explicit Fit retains its existing minimum')
        graph.setZoomLevel(0.15)
        assert.equal(graph.currentZoom(), 0.15, 'manual zoom retains its existing minimum')
    })

    it('requests settled Fit after individual and whole-tree expand/collapse', () => {
        const { graph, clock, fits } = probe()
        graph.nodeTagActive = 'kubernetes'
        const child = { id: 'child', state: { expanded: false }, children: [] }
        const parent = { id: 'parent', state: { expanded: false }, children: [child] }
        graph.root = { id: 'root', state: { expanded: true }, children: [parent] }
        graph.groupStates = new Map()
        graph.selectedGroupListNodeIDs = new Set()
        graph.resetCacheAndRenderTree = () => undefined
        graph.expand(parent)
        assert.equal(parent.state.expanded, true)
        clock.advance(532)
        graph.expand(parent)
        assert.equal(parent.state.expanded, false)
        clock.advance(532)
        graph.expandAllNodes()
        assert.equal(child.state.expanded, true)
        clock.advance(532)
        graph.collapseAllNodes()
        assert.equal(child.state.expanded, false)
        clock.advance(532)
        assert.deepEqual(fits, [532, 1064, 1596, 2128])
    })

    for (const layer of ['infrastructure', 'kubernetes']) {
        for (const isGroup of [false, true]) {
            it(`${layer} ${isGroup ? 'group' : 'resource'} expansion fits the new layout instead of tracking the clicked card`, () => {
                const { graph, clock, applyFit } = probe()
                graph.nodeTagActive = layer
                const parent = { id: 'parent', state: { expanded: false }, children: [] }
                const card = { data: { id: 'child' }, x: 2400, y: 600 }
                graph.d3nodes = new Map([[card.data.id, card]])
                graph.groupStates = new Map(isGroup ? [[parent.id, parent.state]] : [])
                graph.selectedGroupListNodeIDs = new Set()
                graph.props.infrastructureVMLayout = 'rows'
                let width = 3200
                graph.gNodes = { node: () => ({}), selectAll: () => ({ each: (fn: any) =>
                    fn.call({ getBBox: () => ({ x: -width / 2, y: -150, width, height: 300 }) }, card) }) }
                graph.applyZoomFit = applyFit
                graph.resetCacheAndRenderTree = () => undefined
                graph.expand(parent)
                clock.advance(532)
                assert.ok(Math.abs(graph.currentZoom() - 0.44) < 1e-8, 'wide expansion uses the same 20% shrink step')
                const transform = graph.svg.node().__zoom
                assert.ok(Math.abs(transform.x + card.x * transform.k - 565) < 1e-8, 'center follows layout bounds, not the group anchor')
                width = 320
                graph.expand(parent)
                clock.advance(532)
                assert.equal(graph.currentZoom(), 0.8, 'collapsed layout can grow back to the shared automatic cap')
            })
        }
    }

    it('does not follow a selected Infrastructure group during compact relayout or a plain click', () => {
        const { graph, clock, fits, transforms } = probe()
        const group = { id: 'group', state: { selected: true }, children: [] }
        graph.d3nodes.set(group.id, { data: { id: group.id, wrapped: group, type: 3 }, x: 1000, y: 400 })
        graph.renderTree = () => { graph.d3nodes.get(group.id).x = 5000 }
        graph.clearRaisedLinkLabel = graph.hideNodeContextMenu = () => undefined
        graph.nodeClicked({ data: { wrapped: group } })
        graph.relayoutInfrastructureVMs()
        clock.advance(1000)
        assert.deepEqual(transforms, [], 'neither selection nor group movement should pan/zoom after the card')
        assert.deepEqual(fits, [])
    })

    it('cancels a pending scene Fit on Infrastructure selection and explicit center navigation', () => {
        const { graph, clock, fits } = probe()
        graph.clearRaisedLinkLabel = graph.hideNodeContextMenu = () => undefined
        graph.zoomFitAfterRender()
        graph.nodeClicked({ data: { wrapped: {} } })
        clock.advance(1000)
        assert.deepEqual(fits, [])
        const node = { id: 'host' }
        graph.visibleNodeIDForID = () => node.id
        graph.d3nodes.set(node.id, { x: 400, y: 500 })
        graph.zoomFitAfterRender()
        graph.centerNode(node)
        clock.advance(1000)
        assert.deepEqual(fits, [], 'a queued scene Fit must not override explicit centering')
        const transform = graph.svg.node().__zoom
        assert.equal(transform.x + 400 * transform.k, 500)
        assert.equal(transform.y + 500 * transform.k, 300)
    })

    for (const layer of ['infrastructure', 'kubernetes']) {
        for (const elapsed of [100, 500, 516, 532]) {
            it(`${layer} selection stops pending and running camera Fit at ${elapsed}ms`, () => {
                const { graph, clock, fits, transforms, interrupts } = probe()
                graph.nodeTagActive = layer
                graph.clearRaisedLinkLabel = graph.hideNodeContextMenu = () => undefined
                let selected: any
                graph.props.onNodeClicked = (node: any) => { selected = node }
                const cluster = { id: 'cluster' }
                graph.zoomFitAfterRender()
                clock.advance(elapsed)
                const previousFits = [...fits], previousInterrupts = interrupts()
                graph.nodeClicked({ data: { wrapped: cluster } })
                assert.equal(interrupts(), previousInterrupts + 1, 'also stop an already started camera transition')
                graph.onResize({ width: 900, height: 600 })
                clock.advance(1500)
                assert.deepEqual(fits, previousFits, 'no delayed Fit may run after selection')
                assert.deepEqual(transforms, [], 'selection must preserve the viewport')
                assert.equal(selected, cluster)
            })
        }
    }

    for (const isGroup of [false, true]) {
        it(`keeps an expanded Kubernetes cluster visible while ${isGroup ? 'groups retain whole-scene Fit' : 'preserving its viewport position'}`, () => {
            const { graph, clock, applyFit } = probe()
            graph.nodeTagActive = 'kubernetes'
            graph.props.infrastructureVMLayout = 'rows'
            const parent = { id: 'cluster', data: { Manager: 'k8s', Type: 'cluster' }, state: { expanded: false }, children: [] }
            const cards = [
                { data: { id: 'cluster' }, x: -3000, y: 0 },
                { data: { id: 'other-cluster' }, x: 3000, y: 1800 }
            ]
            const box = { x: -290, y: -220, width: 580, height: 440 }
            graph.d3nodes = new Map(cards.map(card => [card.data.id, card]))
            graph.gNodes = { node: () => ({}), selectAll: () => ({ each: (fn: any) =>
                cards.forEach(card => fn.call({ getBBox: () => box }, card)) }) }
            graph.groupStates = new Map(isGroup ? [[parent.id, parent.state]] : [])
            graph.selectedGroupListNodeIDs = new Set()
            graph.resetCacheAndRenderTree = () => undefined
            graph.applyZoomFit = applyFit
            graph.expand(parent)
            // Resizing while the delayed Fit is queued must retain its visibility guard.
            clock.advance(100)
            graph.onResize({ width: 1000, height: 600 })
            clock.advance(532)
            const t = graph.svg.node().__zoom
            assert.ok(Math.abs(t.k - 0.44) < 1e-8, 'retain the existing automatic zoom step')
            const left = t.x + (cards[0].x + box.x) * t.k
            const top = t.y + (cards[0].y + box.y) * t.k
            if (isGroup) {
                assert.ok(left < 0, 'groups retain whole-scene Fit without following their card')
            } else {
                assert.ok(left >= 146 - 1e-8 && top >= 16 - 1e-8, 'the clicked cluster cannot leave the viewport')
                assert.ok(left + box.width * t.k <= 984 + 1e-8)
                assert.ok(top + box.height * t.k <= 584 + 1e-8)
                assert.equal(graph.zoomFitAnchor, undefined, 'do not carry focus into a later layer Fit')
            }
        })
    }

    it('keeps a right-hand third cluster at its click position when two earlier clusters are expanded', () => {
        const { graph, clock, applyFit, context } = probe()
        graph.nodeTagActive = 'kubernetes'
        graph.props.infrastructureVMLayout = 'rows'
        graph.groupStates = new Map()
        graph.clearRaisedLinkLabel = graph.hideNodeContextMenu = () => undefined
        const clusters = [1, 2, 3].map(index => ({ id: `cluster-${index}`,
            data: { Manager: 'k8s', Type: 'cluster' }, state: { expanded: index < 3 }, children: [] }))
        const cards = clusters.map((node, index) => ({ data: { id: node.id, wrapped: node }, x: 1000 + index * 800, y: 450 }))
        cards.push({ data: { id: 'previous-descendant', wrapped: undefined as any }, x: -4000, y: 3000 })
        graph.d3nodes = new Map(cards.map(card => [card.data.id, card]))
        graph.gNodes = { node: () => ({}), selectAll: () => ({ each: (fn: any) =>
            cards.forEach(card => fn.call({ getBBox: () => ({ x: -160, y: -90, width: 320, height: 180 }) }, card)) }) }
        graph.applyZoomFit = applyFit
        graph.svg.call(graph.zoom.transform, context.zoomIdentity.translate(-700, 0).scale(0.55))
        const clicked = cards[2]
        const before = { x: -700 + clicked.x * 0.55, y: clicked.y * 0.55 }
        // Expanding/collapsing another branch changes the final layout slots.
        graph.resetCacheAndRenderTree = () => { clicked.x += 900; clicked.y += 200 }
        graph.nodeClicked({ data: { wrapped: clusters[2] } })
        graph.expand(clusters[2])
        clock.advance(100)
        graph.onResize({ width: 1000, height: 600 })
        clock.advance(532)
        let t = graph.svg.node().__zoom
        assert.ok(Math.abs(t.x + clicked.x * t.k - before.x) < 1e-8, 'do not recenter on the earlier clusters')
        assert.ok(Math.abs(t.y + clicked.y * t.k - before.y) < 1e-8)
        assert.ok(Math.abs(t.k - 0.44) < 1e-8)
        assert.equal(clusters[0].state.expanded, true)
        assert.equal(clusters[1].state.expanded, true)
        graph.expand(clusters[2])
        clock.advance(532)
        t = graph.svg.node().__zoom
        assert.ok(Math.abs(t.x + clicked.x * t.k - before.x) < 1e-8, 'collapse preserves the same viewport anchor')
        assert.ok(Math.abs(t.y + clicked.y * t.k - before.y) < 1e-8)
    })

    it('uses the latest cluster click when two expansion Fit requests overlap', () => {
        const { graph, clock, applyFit, context } = probe()
        graph.nodeTagActive = 'kubernetes'
        graph.props.infrastructureVMLayout = 'rows'
        graph.groupStates = new Map()
        graph.resetCacheAndRenderTree = () => undefined
        graph.clearRaisedLinkLabel = graph.hideNodeContextMenu = () => undefined
        const nodes = [1, 2].map(index => ({ id: `cluster-${index}`, data: { Manager: 'k8s', Type: 'cluster' }, state: { expanded: false }, children: [] }))
        const cards = nodes.map((node, index) => ({ data: { id: node.id }, x: index * 1000, y: 0 }))
        graph.d3nodes = new Map(cards.map(card => [card.data.id, card]))
        graph.gNodes = { node: () => ({}), selectAll: () => ({ each: (fn: any) =>
            cards.forEach(card => fn.call({ getBBox: () => ({ x: -160, y: -90, width: 320, height: 180 }) }, card)) }) }
        graph.svg.call(graph.zoom.transform, context.zoomIdentity.translate(200, 300).scale(0.55))
        graph.applyZoomFit = applyFit
        graph.expand(nodes[0])
        clock.advance(500)
        graph.nodeClicked({ data: { wrapped: nodes[1] } })
        graph.expand(nodes[1])
        clock.advance(532)
        const t = graph.svg.node().__zoom
        assert.ok(Math.abs(t.x + cards[1].x * t.k - 750) < 1e-8, 'the earlier queued cluster must not regain focus')
        assert.equal(graph.zoomFitAnchor, undefined)
    })

    for (const layer of ['infrastructure', 'kubernetes']) {
        for (const scale of [0.15, 0.28, 0.4, 0.9]) {
            it(`${layer} preserves manual ${Math.round(scale * 100)}% across branch and whole-tree expand/collapse`, () => {
                const { graph, clock, fits } = probe()
                graph.nodeTagActive = layer
                const parent = { id: 'parent', state: { expanded: false }, children: [] }
                graph.root = { id: 'root', state: { expanded: true }, children: [parent] }
                graph.groupStates = new Map()
                graph.selectedGroupListNodeIDs = new Set()
                graph.resetCacheAndRenderTree = () => undefined
                graph.setZoomLevel(scale, false)
                const original = graph.svg.node().__zoom
                for (const action of [() => graph.expand(parent), () => graph.expand(parent),
                    () => graph.expandAllNodes(), () => graph.collapseAllNodes()]) {
                    action()
                    clock.advance(1000)
                    assert.equal(graph.svg.node().__zoom, original, 'neither pan nor zoom may override the manual viewport')
                }
                assert.deepEqual(fits, [])
            })
        }
    }

    it('also preserves manual overview when toggling group children from the navigator', () => {
        const { graph, clock, fits } = probe()
        graph.setZoomLevel(0.2, false)
        const original = graph.svg.node().__zoom
        const child = { id: 'vm', state: {}, data: {}, children: [] }
        const group = { id: 'group', state: { expanded: true }, children: [child] }
        graph.nodeGroup = new Map([[child.id, { wrapped: group }]])
        graph.selectedGroupListNodeIDs = new Set()
        graph.renderTree = graph.hideLinks = () => undefined
        graph.syncGroupDisplaySize = () => undefined
        graph.toggleGroupListNode(child)
        graph.setGroupListNodes([child], false)
        clock.advance(1000)
        assert.deepEqual(fits, [])
        assert.equal(graph.svg.node().__zoom, original)
    })

    for (const type of ['wheel', 'mousemove', 'touchmove']) {
        it(`treats a ${type} zoom/pan gesture as manual, but not a plain card click`, () => {
            const { graph, clock, fits, context } = probe()
            graph.groupStates = new Map()
            graph.resetCacheAndRenderTree = () => undefined
            const parent = { id: 'parent', state: { expanded: false }, children: [] }
            context.event.sourceEvent = { type: 'mousedown' }
            graph.onZoomStart()
            assert.ok(!graph.viewportManuallyAdjusted, 'mousedown without movement is only selection')
            graph.expand(parent)
            clock.advance(532)
            assert.deepEqual(fits, [532], 'selection must not disable automatic branch Fit')
            graph.zoomFitAfterRender()
            context.event.sourceEvent = { type }
            context.event.transform = context.zoomIdentity.translate(-350, -100).scale(0.2)
            graph.svg.call(graph.zoom.transform, context.event.transform)
            graph.onZoomGesture()
            const original = graph.svg.node().__zoom
            graph.expand(parent)
            clock.advance(1000)
            assert.equal(graph.svg.node().__zoom, original)
            assert.deepEqual(fits, [532], 'the gesture cancels old Fit and prevents new branch Fit')
        })
    }

    it('restores automatic branch Fit after explicit Fit, layer selection or refresh', () => {
        const { graph, clock, fits } = probe()
        graph.groupStates = new Map()
        graph.resetCacheAndRenderTree = () => undefined
        const parent = { id: 'parent', state: { expanded: false }, children: [] }
        for (const restore of [() => graph.zoomFit(), () => graph.zoomFitAfterRender()]) {
            graph.setZoomLevel(0.15, false)
            graph.expand(parent)
            clock.advance(1000)
            const before = fits.length
            restore()
            clock.advance(532)
            assert.equal(graph.viewportManuallyAdjusted, false)
            graph.expand(parent)
            clock.advance(532)
            assert.equal(fits.length, before + 2, 'explicit Fit and the following expansion should both fit')
        }
    })

    it('does not mistake programmatic zoom for manual input, including the immediate 55% startup cap', () => {
        const { graph, context } = probe()
        context.event.sourceEvent = undefined
        context.event.transform = context.zoomIdentity.scale(0.55)
        graph.onZoomGesture()
        assert.ok(!graph.viewportManuallyAdjusted)
        context.event.sourceEvent = { type: 'click' }
        graph.onZoomGesture()
        assert.ok(!graph.viewportManuallyAdjusted, 'programmatic transforms inside a click handler are not gestures')
        graph.setZoomLevel(1, false)
        graph.zoomFitAfterRender()
        assert.equal(graph.currentZoom(), 0.55)
        assert.equal(graph.viewportManuallyAdjusted, false)
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
