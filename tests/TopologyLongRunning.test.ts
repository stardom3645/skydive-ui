import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { coalesceUpdates, UpdateTimer } from '../src/CoalescedUpdates'
import { TopologyPendingEdges } from '../src/TopologyPendingEdges'

// Run the production graph mutation methods without loading SVG/React or a
// backend. This exercises the same objects retained by a live browser tab.
function graphProbe() {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
    const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const classes = ast.statements.filter(ts.isClassDeclaration)
    const graph = classes.find(node => node.name!.text === 'Topology')!
    const names = ['defaultState', 'updateWeighs', 'addNode', 'updateNode', 'removeNodeTag',
        'delNode', 'setParent', 'addLink', 'removeLinkTag', 'delLink', 'pruneGroupState']
    const methods = graph.members.filter(member => member.name && names.includes(member.name.getText(ast)))
        .map(member => member.getText(ast)).join('\n')
    const models = classes.filter(node => ['Node', 'Link'].includes(node.name!.text))
        .map(node => node.getText(ast).replace('export ', '')).join('\n')
    const context: any = { LinkTagState: { EventBased: 1 } }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`${models}\nclass Topology { ${methods} }; this.Topology = Topology; this.Node = Node`,
        { target: ts.ScriptTarget.ES2018 }), context)
    const topology = new context.Topology()
    Object.assign(topology, {
        props: {}, root: new context.Node('root', ['root'], { Type: 'root' }),
        nodes: new Map(), links: new Map(), weights: [], nodeTagActive: '',
        nodeTagCount: new Map(), nodeTagStates: new Map(), linkTagCount: new Map(), linkTagStates: new Map(),
        groupStateOwners: new Map(), groupStateMembers: new Map(), groupStates: new Map(), groupNavigatorFilters: new Map(),
        groupNavigatorRenderKeys: new Map(), selectedGroupListNodeIDs: new Set(),
        expandedContainerMiniNodeIDs: new Set(), kubernetesProblemsExpandedSnapshot: new Map(),
        kubernetesProblemsGroupSnapshot: new Map()
    })
    const add = (id: string, tags = ['infrastructure']) => {
        const node = topology.addNode(id, tags, { Name: id }, 100)
        if (!node.parent) topology.setParent(node, topology.root)
        return node
    }
    return { topology, add }
}

function appFilterProbe() {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
    const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const app = ast.statements.filter(ts.isClassDeclaration).find(node => node.name?.text === 'App')!
    const methods = app.members.filter(member => member.name && ['updateFilters', 'rebuildSuggestions'].includes(member.name.getText(ast)))
        .map(member => member.getText(ast)).join('\n')
    const context: any = { console }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class AppProbe { ${methods} }; this.AppProbe = AppProbe`,
        { target: ts.ScriptTarget.ES2018 }), context)
    const panel = new context.AppProbe()
    const replies: ((filters: any[]) => void)[] = []
    Object.assign(panel, {
        disposed: false, filterRequestID: 0, filterRefreshInFlight: false,
        config: {
            filters: () => new Promise(resolve => replies.push(resolve)),
            suggestions: () => ['data.Name', 'data.IPV4']
        },
        filters: new Map([['deleted', { id: 'deleted' }]]),
        customFilters: [{ id: 'custom' }],
        state: { suggestions: ['deleted-host'], vmNameMap: { vm: 'current-vm' } },
        tc: { nodes: new Map([['host', { data: { Name: 'current-host', IPV4: ['10.0.0.1'] } }]]) },
        debSetState: () => undefined
    })
    return { panel, replies }
}

const flushPromises = () => new Promise(resolve => setImmediate(resolve))

class VirtualClock implements UpdateTimer {
    now = 0
    nextID = 0
    timers = new Map<number, { at: number, callback: () => void }>()
    set(callback: () => void, delay: number) {
        const id = ++this.nextID
        this.timers.set(id, { at: this.now + delay, callback })
        return id
    }
    clear(id: number) { this.timers.delete(id) }
    advance(ms: number) {
        const end = this.now + ms
        while (true) {
            const next = Array.from(this.timers).sort((a, b) => a[1].at - b[1].at)[0]
            if (!next || next[1].at > end) break
            this.now = next[1].at
            this.timers.delete(next[0])
            next[1].callback()
        }
        this.now = end
    }
}

describe('Long-running topology lifecycle', () => {
    it('rebuilds search and discovered filters from live resources while retaining custom filters', async () => {
        const { panel, replies } = appFilterProbe()
        panel.updateFilters()
        replies[0]([{ id: 'current-host', label: 'current-host', category: 'host' }])
        await flushPromises()
        assert.strictEqual(panel.filters.has('deleted'), false)
        assert.strictEqual(panel.state.filters.map((filter: any) => filter.id).join(','), 'custom,current-host')
        assert.strictEqual(panel.state.suggestions.join(','), 'current-host,10.0.0.1,current-vm')
        assert.strictEqual(panel.filterRefreshInFlight, false)
    })

    it('does not accumulate filter queries while the server is slow', async () => {
        const { panel, replies } = appFilterProbe()
        for (let tick = 0; tick < 4 * 60 * 60 / 5; tick++) panel.updateFilters()
        assert.strictEqual(replies.length, 1)
        replies[0]([])
        await flushPromises()
        panel.updateFilters()
        assert.strictEqual(replies.length, 2)
        replies[1]([])
        await flushPromises()
    })

    it('ignores a late filter response after application teardown', async () => {
        const { panel, replies } = appFilterProbe()
        panel.updateFilters()
        panel.disposed = true
        panel.filterRequestID++
        replies[0]([])
        await flushPromises()
        assert.strictEqual(panel.filters.has('deleted'), true)
        assert.strictEqual(panel.state.suggestions.join(','), 'deleted-host')
    })

    it('keeps one canonical node and ownership when NodeAdded is replayed 10000 times', () => {
        const { topology, add } = graphProbe()
        const host = add('host')
        const node = add('nic')
        topology.setParent(node, host)
        topology.addLink('physical', host, node, ['layer2'], {})
        for (let index = 0; index < 10000; index++) {
            assert.strictEqual(add('nic'), node)
        }
        assert.strictEqual(topology.nodes.size, 2)
        assert.strictEqual(topology.root.children.length, 1)
        assert.strictEqual(host.children.length, 1)
        assert.strictEqual(node.parent, host)
        assert.strictEqual(topology.links.get('physical').target, node)
        assert.strictEqual(topology.nodeTagCount.get('infrastructure'), 2)
        assert.strictEqual(node.revision, 10000)
    })

    it('rejects cyclic ownership and keeps recursive weight calculation usable', () => {
        const { topology, add } = graphProbe()
        const parent = add('host'), child = add('nic')
        topology.setParent(child, parent)
        topology.setParent(parent, child)
        topology.setParent(child, child)
        assert.strictEqual(parent.parent, topology.root)
        assert.strictEqual(child.parent, parent)
        assert.strictEqual(child.getWeight(), 100)
    })

    it('preserves selected link identity and display mode on replayed relations', () => {
        const { topology, add } = graphProbe()
        const host = add('host'), nic = add('nic')
        topology.addLink('physical', host, nic, ['layer2'], {})
        const link = topology.links.get('physical')
        link.state.selected = true
        topology.linkTagStates.set('layer2', 0)
        for (let index = 0; index < 10000; index++) {
            topology.addLink('physical', host, nic, ['layer2'], { version: index })
        }
        assert.strictEqual(topology.links.get('physical'), link)
        assert.strictEqual(link.state.selected, true)
        assert.strictEqual(topology.linkTagCount.get('layer2'), 1)
        assert.strictEqual(topology.linkTagStates.get('layer2'), 0)
        topology.addLink('physical', host, nic, ['other'], {})
        assert.strictEqual(topology.linkTagCount.has('layer2'), false)
        assert.strictEqual(topology.linkTagCount.get('other'), 1)
        topology.delLink('physical')
        assert.strictEqual(topology.linkTagStates.size, 0)
    })

    it('releases deleted ancestors, relations and group state during 4 hours of resource churn', () => {
        const { topology, add } = graphProbe()
        const nic = add('surviving-nic')
        for (let second = 0; second < 4 * 60 * 60; second++) {
            const host = add(`host-${second}`, ['transient'])
            topology.setParent(nic, host)
            topology.addLink('relation', host, nic, ['temporary'], {})
            topology.addLink('relation', host, nic, ['temporary'], {})
            assert.strictEqual(topology.linkTagCount.get('temporary'), 1)
            const groupID = `${host.id}_device_100`
            topology.groupStateOwners.set(groupID, host.id)
            topology.groupStateMembers.set(groupID, new Set([nic.id]))
            topology.groupStates.set(groupID, {})
            topology.groupNavigatorFilters.set(groupID, { search: host.id })
            topology.groupNavigatorRenderKeys.set(groupID, host.id)
            topology.kubernetesProblemsGroupSnapshot.set(groupID, {})
            topology.delNode(host.id)
            assert.strictEqual(nic.parent, topology.root)
            assert.strictEqual(host.children.length, 0)
            assert.strictEqual(host.parent, null)
            assert.strictEqual(topology.nodes.size, 1)
            assert.strictEqual(topology.root.children.length, 1)
            assert.strictEqual(topology.links.size, 0)
            assert.strictEqual(topology.nodeTagCount.has('transient'), false)
            assert.strictEqual(topology.linkTagStates.size, 0)
            assert.strictEqual(topology.groupStates.size, 0)
            assert.strictEqual(topology.groupStateOwners.size, 0)
            assert.strictEqual(topology.groupStateMembers.size, 0)
            assert.strictEqual(topology.groupNavigatorFilters.size, 0)
            assert.strictEqual(topology.groupNavigatorRenderKeys.size, 0)
            assert.strictEqual(topology.kubernetesProblemsGroupSnapshot.size, 0)
        }
    })

    it('releases an empty root group while preserving state for a live collapsed group', () => {
        const { topology, add } = graphProbe()
        add('nic')
        for (const groupID of ['gone', 'live']) {
            topology.groupStateOwners.set(groupID, 'root')
            topology.groupStateMembers.set(groupID, new Set([groupID === 'live' ? 'nic' : 'deleted']))
            topology.groupStates.set(groupID, { expanded: false })
        }
        topology.pruneGroupState()
        assert.strictEqual(topology.groupStates.has('gone'), false)
        assert.strictEqual(topology.groupStates.has('live'), true)
    })

    it('renders during 4 hours of uninterrupted events with one timer and the latest payload', () => {
        const clock = new VirtualClock()
        let renders = 0, latest = -1
        const update = coalesceUpdates(1000, (value: number) => { renders++; latest = value }, clock)
        const events = 4 * 60 * 60 * 20
        for (let index = 0; index < events; index++) {
            update(index)
            assert.strictEqual(clock.timers.size, 1)
            clock.advance(50)
        }
        assert.strictEqual(renders, 4 * 60 * 60)
        assert.strictEqual(latest, events - 1)
        assert.strictEqual(clock.timers.size, 0)
        update(events)
        update.cancel()
        clock.advance(5000)
        assert.strictEqual(renders, 4 * 60 * 60)
        assert.strictEqual(clock.timers.size, 0)
    })

    it('bounds relations whose endpoints never arrive and expires stale payloads', () => {
        let now = 0
        const pending = new TopologyPendingEdges(100, 300000, () => now)
        for (let second = 0; second < 4 * 60 * 60; second++) {
            now += 1000
            pending.defer({ ID: `missing-${second}`, Parent: 'missing', Child: 'nic', Metadata: { second } })
            assert.ok(pending.size() <= 100)
        }
        now += 300000
        assert.strictEqual(pending.size(), 0)
        assert.strictEqual(pending.replayReady(() => true, () => true), 0)
    })
})
