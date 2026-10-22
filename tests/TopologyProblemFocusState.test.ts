import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { currentProblems } from '../src/CurrentProblems'
import { problemRelatedResources } from '../src/ProblemAnalysis'
import { topologyResourceDomain } from '../src/TopologyResourceClassification'
import { topologyProblemFocusClosure } from '../src/TopologyProblemFocus'
import { isExpiredLLDPLink } from '../src/LLDPTopologyValidity'

const source = ts.createSourceFile('Topology.tsx', readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const cls = source.statements.find(item => ts.isClassDeclaration(item) && item.name?.text === 'Topology') as ts.ClassDeclaration
const methods = ['problemNavigationContext', 'problemNavigationFocus', 'focusProblemResource', 'revealProblemResourcePaths', 'topologyFocusTargetExists', 'refreshTopologyNodeFocus', 'clearTopologyNodeFocus', 'applyTopologyNodeFocus', 'hierarchyLinkKey']
const body = methods.map(name => cls.members.find(member => member.name?.getText(source) === name)!.getText(source)).join('\n')
const harness = () => {
    const classes = new Map<string, boolean>()
    const selection = (items: any[]): any => ({
        selectAll() { return this },
        each(fn: (item: any) => void) { items.forEach(fn); return this },
        classed(name: string, value: boolean | ((item: any) => boolean)) {
            items.forEach(item => classes.set(`${item.data?.id || item.id}:${name}`, typeof value === 'function' ? value(item) : value))
            return this
        }
    })
    const context: any = { currentProblems, problemRelatedResources, topologyResourceDomain, topologyProblemFocusClosure, isExpiredLLDPLink,
        topologyNodeStatus: () => ({ kind: 'unknown', label: 'Unknown' }), zoomIdentity: { k: .5 } }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${body} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
    const app = new context.Probe()
    const node = (id: string, state: string) => ({ id, data: { Name: id, Type: 'host', State: state }, tags: [], children: [], parent: null, state: {} })
    const target = node('target', 'failed'), peer = node('peer', 'UP'), other = node('other', 'failed')
    const nodes = [target, peer, other]
    const link = (source: any, target: any) => ({ id: `${source.id}-${target.id}`, source, target, data: {}, tags: [] })
    const links = [link(target, peer), link(peer, other)]
    const wrappers = nodes.map(node => ({ data: { id: node.id, wrapped: node } }))
    app.nodes = new Map(nodes.map(node => [node.id, node])); app.links = new Map(links.map(link => [link.id, link]))
    app.groups = new Map(); app.nodeGroup = new Map(); app.d3nodes = new Map(wrappers.map(node => [node.data.id, node]))
    app.root = { id: 'root' }; app.cloneTree = () => {}; app.renderTree = () => {}
    app.expandedContainerMiniNodeIDs = new Set()
    app.gNodes = selection(wrappers); app.gHieraLinks = selection([])
    app.gLinks = app.gLinkWraps = app.gLinkLabels = app.gLinkOverlays = selection(links)
    app.g = selection([{ id: 'scene' }]); app.topologyNodeFocus = null
    let cleared = 0, renders = 0
    app.props = { onProblemFocusCleared: () => cleared++ }
    app.forceUpdate = () => renders++
    app.clearInfrastructureFocus = app.unpinNodes = app.cancelScheduledZoomFit = app.applyMoldNetworkFocus = () => {}
    app.selectNode = () => {}
    app.svg = { node: () => ({ __zoom: { k: .5 } }), interrupt() { return this }, call() { return this } }
    app.zoom = { transform: () => {} }
    app.renderedFocusNode = (id: string) => app.d3nodes.get(id)
    app.visibleNodeIDForID = (id: string) => id
    app.displayedNodeName = (node: any) => node.data.Name
    app.linkDisplayOpacity = () => 1
    return { app, classes, target, cleared: () => cleared, renders: () => renders }
}
describe('Problem focus lifetime and verdict updates', () => {
    it('selects once before revealing even a collapsed target, and does not Fit or restore the viewport', () => {
        const { app, target } = harness()
        const calls: string[] = []
        app.d3nodes.delete(target.id)
        app.selectNode = (id: string, active: boolean, keep: boolean, defer: boolean) => {
            assert.equal(id, target.id); assert.equal(defer, true); calls.push('select')
        }
        app.renderTree = () => {
            calls.push('paint')
            app.d3nodes.set(target.id, { data: { id: target.id, wrapped: target } })
        }
        app.svg.call = () => { throw new Error('must not snap the viewport back') }
        assert.equal(app.focusProblemResource(target.id), true)
        assert.deepEqual(calls, ['select', 'paint'])
        assert.equal(app.topologyNodeFocus.focusedNodeID, target.id)
    })
    it('discovers nested groups before one paint, preserving exact ancestor paths and full-size state', () => {
        const { app, target } = harness()
        const parent: any = { id: 'parent', state: {}, parent: null }
        target.parent = parent
        const outer = { wrapped: { state: { expanded: false, groupFullSize: false } } }
        const inner = { wrapped: { state: { expanded: false, groupFullSize: false } } }
        let discovers = 0, paints = 0
        app.cloneTree = () => {
            discovers++
            app.nodeGroup.set(parent.id, outer)
            if (outer.wrapped.state.expanded) app.nodeGroup.set(target.id, inner)
        }
        app.renderTree = () => { paints++ }
        app.focusProblemResource(target.id)
        assert.equal(discovers, 3)
        assert.equal(paints, 1)
        for (const group of [outer, inner]) {
            assert.equal(group.wrapped.state.expanded, true)
            assert.equal(group.wrapped.state.groupFullSize, true)
        }
        assert.equal((target.state as any).expanded, true)
        assert.equal(parent.state.expanded, true)
        assert.equal(app.nodes.get('other').state.expanded, undefined)
    })
    it('highlights the target and real peer, dims unrelated problems, and removes old red on recovery', () => {
        const { app, classes, target, renders } = harness()
        assert.equal(app.focusProblemResource('target'), true)
        assert.equal(classes.get('target:problem-navigation-anchor'), true)
        assert.equal(classes.get('target:problem-navigation-problem'), true)
        assert.equal(classes.get('peer:topology-focus-hit'), true)
        assert.equal(classes.get('other:topology-focus-dim'), true)
        assert.equal(classes.get('other:problem-navigation-problem'), false)
        const before = renders()
        app.refreshTopologyNodeFocus()
        assert.equal(renders(), before, 'unchanged graph refresh must not request another React render')
        target.data.State = 'UP'
        app.refreshTopologyNodeFocus(); app.applyTopologyNodeFocus()
        assert.equal(classes.get('target:problem-navigation-problem'), false)
        assert.equal(classes.get('target:problem-navigation-anchor'), true)
        assert.ok(app.topologyNodeFocus.problemContext.reason.includes('제외'))
        assert.equal(renders(), before + 1, 'refresh the visible summary after a verdict changes')
    })
    it('keeps focus through an empty sync, releases after actual deletion, and clears all visual flags on release', () => {
        const { app, classes, cleared } = harness()
        app.focusProblemResource('target')
        app.topologySyncInProgress = true; app.nodes.clear(); app.d3nodes.clear()
        app.refreshTopologyNodeFocus()
        assert.equal(app.topologyNodeFocus.mode, 'problem-navigation')
        assert.equal(cleared(), 0)
        app.topologySyncInProgress = false
        app.refreshTopologyNodeFocus(); app.applyTopologyNodeFocus()
        assert.equal(app.topologyNodeFocus, null)
        assert.equal(cleared(), 1)
        assert.equal(classes.get('target:problem-navigation-anchor'), false)
        assert.equal(classes.get('other:topology-focus-dim'), false)
    })
    it('replacing the focused resource does not prematurely discard the preserved problem list', () => {
        const { app, cleared } = harness()
        app.focusProblemResource('target'); app.focusProblemResource('other')
        assert.equal(cleared(), 0)
        app.clearTopologyNodeFocus()
        assert.equal(cleared(), 1)
    })
})
