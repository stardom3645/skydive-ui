import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as ts from 'typescript'
import * as vm from 'vm'
import { getMoldNetworkIndex, matchMoldNIC, moldVMNetworks, moldVMUUID } from '../src/MoldTopologyNetworks'
import { topologyNetworkRootPathClosure } from '../src/TopologyConnectionFocus'

const source = fs.readFileSync(require('path').resolve(__dirname, '../src/Topology.tsx'), 'utf8')
const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true)
const component = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'Topology') as ts.ClassDeclaration
const methods = component.members.filter(node => ['applyMoldNetworkFocus', 'hierarchyLinkKey'].includes(node.name?.getText(ast) || '')).map(node => node.getText(ast)).join('\n')
const context: any = { getMoldNetworkIndex, matchMoldNIC, moldVMNetworks, moldVMUUID, topologyNetworkRootPathClosure }
vm.createContext(context)
vm.runInContext(ts.transpile(`class Probe { ${methods} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2020 }), context)
class Layer {
    classes = new Map<string, Set<string>>()
    constructor(public items: any[]) {}
    selectAll() { return this }
    each(callback: any) { this.items.forEach(callback); return this }
    classed(name: string, callback: any) {
        this.items.forEach(item => {
            const id = item.data?.id || item.id || `${item.source.data.id}->${item.target.data.id}`
            if (!this.classes.has(id)) this.classes.set(id, new Set())
            if (callback(item)) this.classes.get(id)!.add(name); else this.classes.get(id)!.delete(name)
        }); return this
    }
}
const resource = (id: string, type: string, extra = {}): any => ({ id, data: { Type: type, ...extra }, children: [], state: { selected: false, expanded: false } })
function scene() {
    const host = resource('host', 'host'), bridge = resource('bridge', 'bridge')
    const a = resource('a', 'libvirt', { UUID: 'uuid-a' }), b = resource('b', 'libvirt', { UUID: 'uuid-b' })
    const na = resource('na', 'tun', { MAC: '52:54:00:00:00:01' }), nb = resource('nb', 'tun', { MAC: '52:54:00:00:00:01' })
    na.parent = a; nb.parent = b
    a.state.selected = true
    const nodes = [host, bridge, a, b, na, nb]
    const d3 = nodes.map((node, i) => ({ data: { id: node.id, wrapped: node }, y: i < 2 ? i * 100 : i < 4 ? 300 : 400 }))
    const links = [[host, bridge], [bridge, na], [bridge, nb], [a, na], [b, nb]].map(([s, t]) => ({ id: s.id + '-' + t.id, source: s, target: t, data: {} }))
    const row = (uuid: string, networkId: string) => ({ vmUuid: uuid, networkId, networkName: '같은 이름', nicId: uuid, macAddress: '52:54:00:00:00:01', ipAddress: '10.0.0.2', vlan: '153' })
    const probe = new context.Probe()
    Object.assign(probe, { props: { moldNetworkFocusID: 'net-a', vmNetworkMap: { a: [row('uuid-a', 'net-a')], b: [row('uuid-b', 'net-b')] } }, nodeTagActive: 'Infrastructure',
        nodes: new Map(nodes.map(n => [n.id, n])), d3nodes: new Map(d3.map(n => [n.data.id, n])), links: new Map(links.map(l => [l.id, l])),
        closestVisibleNodeID: (node: any) => node.id, gNodes: new Layer(d3), gLinks: new Layer(links), gHieraLinks: new Layer([]) })
    return { probe, nodes, links }
}

describe('Mold network visual focus', () => {
    it('emphasizes the matched VM/NIC upstream route without selecting or hiding unrelated resources', () => {
        const { probe, nodes, links } = scene(), before = nodes.map(n => JSON.stringify(n.state)), linkIDs = links.map(l => l.id)
        probe.applyMoldNetworkFocus()
        for (const id of ['host', 'bridge', 'a', 'na']) assert.ok(probe.gNodes.classes.get(id).has('mold-network-hit'))
        for (const id of ['b', 'nb']) assert.ok(probe.gNodes.classes.get(id).has('mold-network-dim'))
        assert.ok(probe.gLinks.classes.get('bridge-na').has('mold-network-hit'))
        assert.ok(probe.gLinks.classes.get('bridge-nb').has('mold-network-dim'))
        assert.deepEqual(nodes.map(n => JSON.stringify(n.state)), before)
        assert.deepEqual(links.map(l => l.id), linkIDs)
        probe.props.moldNetworkFocusID = undefined; probe.applyMoldNetworkFocus()
        assert.ok(Array.from(probe.gNodes.classes.values() as Iterable<Set<string>>).every(value => value.size === 0))
    })
    it('leaves Kubernetes visuals untouched and excludes unmatched vNICs from an infrastructure route', () => {
        const { probe } = scene()
        probe.nodes.get('na').data.MAC = '52:54:00:00:00:99'
        probe.applyMoldNetworkFocus()
        assert.ok(probe.gNodes.classes.get('na').has('mold-network-dim'))
        probe.nodeTagActive = 'kubernetes'; probe.applyMoldNetworkFocus()
        assert.ok(Array.from(probe.gNodes.classes.values() as Iterable<Set<string>>).every(value => value.size === 0))
    })
})
