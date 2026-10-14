import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologySearchEntry, createTopologySearchIndex, normalizeTopologySearch, prioritizeRecentSearch, topologySearchResultIdentity } from '../src/TopologySearch'
import { getMoldNetworkIndex, moldVMNetworks, matchMoldNIC } from '../src/MoldTopologyNetworks'

const node = (id: string, name: string, data: any = {}, parent?: any) => ({ id, tags: ['infrastructure'], data: { Type: 'libvirt', Name: name, ...data }, parent })
const entry = (id: string, name: string, data: any = {}, parent?: any) => topologySearchEntry(node(id, name, data, parent))
describe('Topology resource search', () => {
    it('finds mid-name and multiple words across names, host context and namespace, beyond the old five results', () => {
        const host = node('host', 'ablecube31-1', { Type: 'host' })
        const entries = Array.from({ length: 70 }, (_, i) => entry(`vm-${i}`, `k8s-lifecycle31-v1342-gfs2-r10-node-${i}`, {}, host))
        const rank = createTopologySearchIndex(entries)
        assert.equal(rank('gfs2').length, 70)
        assert.equal(rank('gfs2 ablecube31-1').length, 70)
        assert.equal(rank('gfs2 missing-host').length, 0)
        const nic = entry('nic', '10.1.1.1', { Type: 'tuntap' }, host)
        nic.aliases.push('gfs2-network')
        assert.notEqual(createTopologySearchIndex([nic, entries[0]])('gfs2 ablecube31-1')[0].entry.id, 'nic')
        const pod = node('pod', 'redis-server', { Type: 'pod', Manager: 'k8s', K8s: { Namespace: 'data-services', UID: 'pod-uuid' } })
        assert.equal(createTopologySearchIndex([topologySearchEntry(pod)])('redis data-services')[0].entry.id, 'pod')
    })
    it('ranks exact display names ahead of prefixes and substrings without merging equal names', () => {
        const entries = [entry('substring', 'prod-ccvm'), entry('prefix', 'ccvm-extra'), entry('b', 'ccvm'), entry('a', 'ccvm')]
        const ids = createTopologySearchIndex(entries)('CCVM').map(match => match.entry.id)
        assert.deepEqual(ids, ['a', 'b', 'prefix', 'substring'])
        assert.deepEqual(createTopologySearchIndex(entries.slice().reverse())('CCVM').map(match => match.entry.id), ids)
    })
    it('searches display aliases, raw Libvirt names, exact identifiers and IP/MAC variants', () => {
        const doc = topologySearchEntry(node('node-uuid', 'i-2-106-VM', { UUID: 'vm-uuid', IPV4: ['10.10.254.154/24'], MAC: '02:ab:cd:12:34:56' }), { label: 'Windows25-Process' })
        const rank = createTopologySearchIndex([doc])
        for (const query of ['Windows25', 'i-2-106', 'vm-uuid', 'node-uuid', '10.10.254.154', '02abcd123456']) assert.equal(rank(query)[0].entry.id, 'node-uuid')
        assert.equal(rank('10.10.254.155').length, 0)
        assert.equal(rank('02:ab:cd:12:34:57').length, 0)
        assert.equal(rank('vm-uuix').length, 0)
        assert.equal(rank('10.10.254.154')[0].matchedAlias, '10.10.254.154/24')
        const numericMAC = createTopologySearchIndex([entry('nic', 'vnet1', { Type: 'tuntap', MAC: '02:00:00:12:34:56' })])
        assert.equal(numericMAC('020000123456')[0].entry.id, 'nic')
        assert.equal(numericMAC('020000123457').length, 0)
    })
    it('normalizes accents and Unicode, supports Korean initials, and labels bounded typos', () => {
        const rank = createTopologySearchIndex([entry('a', 'Windows-Process'), entry('b', '가상머신 서비스'), entry('c', 'Café Server')])
        assert.equal(rank('windwos')[0].entry.id, 'a')
        assert.equal(rank('windwos')[0].fuzzy, true)
        assert.equal(rank('ㄱㅅㅁㅅ')[0].entry.id, 'b')
        assert.equal(rank('ＣＡＦＥ')[0].entry.id, 'c')
        assert.equal(rank('unrelatedword').length, 0)
        assert.equal(normalizeTopologySearch('é'), 'e')
    })
    it('keeps complete long names and real IDs, even if filters currently hide an object', () => {
        const name = 'autoScaleVm-AS-PROD-31-AS04-CONCURRENCY-1-' + 'long-name-'.repeat(30)
        const doc = topologySearchEntry(node('vm', name), { hidden: true })
        assert.equal(createTopologySearchIndex([doc])('CONCURRENCY')[0].entry.label, name)
        assert.equal(doc.hidden, true)
        assert.equal(doc.id, 'vm')
    })
    it('uses all indexed resources with bounded interactive latency at 5000 objects', () => {
        const documents = Array.from({ length: 5000 }, (_, i) => entry(`vm-${i}`, `Windows-${i}-lifecycle-gfs2`, { IPV4: [`10.1.${i % 255}.10`] }))
        const rank = createTopologySearchIndex(documents), start = Date.now()
        assert.equal(rank('gfs2').length, 5000)
        assert.equal(rank('windwos').length, 5000)
        assert.ok(Date.now() - start < 1500)
    })
})

function probe() {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
    const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const app = ast.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'App') as ts.ClassDeclaration
    const methods = app.members.filter(member => member.name && ['nodeDisplayName', 'searchSuggestion', 'rebuildSuggestions', 'updateSuggestions', 'searchTopologyNodes', 'onSearchChange', 'onSearchSelect'].includes(member.name.getText(ast))).map(member => member.getText(ast)).join('\n')
    const context: any = { topologySearchEntry, createTopologySearchIndex, normalizeTopologySearch, getMoldNetworkIndex, moldVMNetworks, matchMoldNIC }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${methods} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
    const panel = new context.Probe(), pins: string[] = []
    Object.assign(panel, { state: { suggestions: [], vmNameMap: {} }, config: { suggestions: () => ['data.Name', 'data.IPV4'] },
        tc: { nodes: new Map(), unpinNodes: () => pins.length = 0, pinNode: (node: any) => pins.push(node.id) },
        nodeAttrs: (node: any) => ({ name: node.data.Name.length > 24 ? node.data.Name.slice(0, 24) + '.' : node.data.Name }),
        topologyDisplayNodeVisible: () => true, debSetState: () => {}, syncTopologyNodeTagForNodes: () => {} })
    return { panel, pins }
}
describe('Search topology integration', () => {
    it('uses full raw names for search while preserving shortened card names and mapped VM labels', () => {
        const { panel } = probe(), name = 'k8s-lifecycle31-v13412-gfs2-r12-cluster'
        const cluster = node('cluster', name, { Type: 'cluster', Manager: 'k8s' })
        assert.equal(panel.nodeDisplayName(cluster), name.slice(0, 24) + '.')
        assert.equal(panel.searchSuggestion(cluster).label, name)
        assert.equal(panel.searchSuggestion(node('vm', name)).label, name)
    })
    it('pins the chosen ID exclusively and retains duplicate-name nodes and unrelated multi-selections', () => {
        const { panel, pins } = probe()
        const a = node('a', 'same-name'), b = node('b', 'same-name'), c = node('c', 'other-node')
        panel.tc.nodes = new Map([['a', a], ['b', b], ['c', c]])
        panel.rebuildSuggestions()
        panel.onSearchChange(['b'])
        assert.deepEqual(pins, ['b'])
        assert.equal(panel.searchTopologyNodes(['same-name']).length, 2)
        assert.equal(panel.searchTopologyNodes(['same-name', 'other']).length, 3)
        panel.onSearchChange([])
        assert.equal(pins.length, 0)
    })
    it('updates renamed aliases, removes deleted resources and does not list orphaned VM-name mappings', () => {
        const { panel } = probe(), vmNode = node('vm', 'i-2-106-VM')
        panel.state.vmNameMap = { 'i-2-106-VM': 'Windows25-Process', absent: 'ghost-name' }
        panel.tc.nodes.set(vmNode.id, vmNode)
        panel.rebuildSuggestions()
        assert.equal(panel.state.suggestions.length, 1)
        assert.equal(panel.state.suggestions[0].label, 'Windows25-Process')
        vmNode.data.Name = 'renamed'
        panel.updateSuggestions(vmNode)
        assert.equal(panel.searchTopologyNodes(['Windows25-Process']).length, 0)
        assert.equal(panel.searchTopologyNodes(['renamed'])[0].id, 'vm')
        panel.tc.nodes.delete(vmNode.id)
        panel.rebuildSuggestions()
        assert.equal(panel.state.suggestions.length, 0)
    })
})

describe('Command search presentation and history', () => {
    it('hides UUIDs for name and empty searches, revealing only the matching UUID', () => {
        const uuid = '3e718540-6c00-47c5-5caa-bf47a298dd5e'
        const doc = entry(uuid, 'Windows25-Process', { UUID: '7e718540-6c00-47c5-5caa-bf47a298dd5e', IPV4: ['10.10.1.5'], MAC: '02:ab:cd:12:34:56' })
        const rank = createTopologySearchIndex([doc])
        for (const query of ['', 'Windows25']) assert.deepEqual(topologySearchResultIdentity(rank(query)[0], query), { kind: 'IP', value: '10.10.1.5' })
        for (const query of [uuid, '3e718540']) assert.deepEqual(topologySearchResultIdentity(rank(query)[0], query), { kind: 'UUID', value: uuid })
        assert.equal(topologySearchResultIdentity(rank('7e718540')[0], '7e718540')?.value, doc.uuids![1])
        assert.equal(topologySearchResultIdentity(rank('02abcd123456')[0], '02abcd123456')?.kind, 'MAC')
        const noAddress = entry(uuid, 'Windows25')
        assert.equal(topologySearchResultIdentity(createTopologySearchIndex([noAddress])('Windows25')[0], 'Windows25'), undefined)
    })
    it('prioritizes only live recent resources on an empty query and preserves query ranking', () => {
        const rank = createTopologySearchIndex([entry('host', 'ablecube', { Type: 'host' }), entry('vm1', 'Windows25'), entry('vm2', 'Windows26')])
        const matches = rank('')
        assert.deepEqual(prioritizeRecentSearch(matches, ['gone', 'vm2', 'vm1'], '').map(match => match.entry.id), ['vm2', 'vm1', 'host'])
        assert.equal(matches[0].entry.id, 'host')
        assert.equal(prioritizeRecentSearch(rank('Windows'), ['vm2'], 'Windows')[0].entry.id, 'vm1')
    })
    it('uses card icon metadata and invokes canonical selection for details and history', () => {
        const { panel, pins } = probe(), selected: string[] = [], layers: string[][] = []
        panel.tc.selectNode = (id: string) => selected.push(id)
        panel.syncTopologyNodeTagForNodes = (ids: string[]) => layers.push(Array.from(ids))
        panel.tc.nodeObjectStatus = () => ({ tone: 'normal', label: '정상', description: 'Up' })
        panel.nodeAttrs = () => ({ name: 'VM', icon: '\uf108', iconClass: 'vm-icon', href: '' })
        const vmNode = node('vm', 'VM'); panel.tc.nodes.set('vm', vmNode)
        const doc = panel.searchSuggestion(vmNode)
        assert.equal(doc.icon, '\uf108'); assert.equal(doc.iconClass, 'vm-icon'); assert.equal(doc.status.label, '정상')
        panel.onSearchSelect('vm'); panel.onSearchSelect('deleted')
        assert.deepEqual(selected, ['vm'])
        assert.deepEqual(pins, ['vm']); assert.deepEqual(layers, [['vm']])
    })
})
