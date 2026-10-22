import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { switchPortConnectionPositions, SwitchPortSlot } from '../src/InfrastructureSwitchPortLayout'
import { infrastructurePortLayoutTargets, buildManualPortMappingTopologyLinks } from '../src/InfrastructurePortMapping'

const node = (id: string, type: string, name = id, parent?: any, extra = {}): any => {
    const n = { id, data: { Type: type, Name: name, ...extra }, parent: parent || null, children: [], state: {},
        getWeight: () => type === 'switchport' ? 5018 : type === 'host' ? 5020 : 5015 }
    if (parent) parent.children.push(n)
    return n
}
const link = (id: string, source: any, target: any, extra = {}): any => ({ id, source, target, data: { RelationType: 'layer2', ...extra } })
const fixture = () => {
    const sw = node('sw', 'switch'), a = node('host-a', 'host'), b = node('host-b', 'host')
    const bondA = node('bond-a', 'bond', 'bond0', a), bondB = node('bond-b', 'bond', 'bond1', b)
    const nics = [node('nic-a2', 'device', 'eno2', bondA), node('nic-a1', 'device', 'eno1', bondA),
        node('nic-b1', 'device', 'eno1', b, { MasterIndex: 20 }), node('nic-b2', 'device', 'eno2', b, { MasterName: 'bond1', State: 'DOWN' })]
    bondB.data.IfIndex = 20
    const ports = ['ethernet1/1/1', 'ethernet1/1/10', 'ethernet1/1/2', 'manual-ethernet1/1/99', 'ethernet1/1/9']
        .map((name, i) => node(`port-${i}`, 'switchport', name, sw, i === 3 ? { ManualPortMappingPort: true } : {}))
    const links = [link('p0', ports[0], nics[2]), link('p1', ports[1], nics[0]), link('p2', ports[2], nics[1]),
        link('manual', ports[3], nics[3], { ManualPortMapping: true, RelationType: 'manual' })]
    const nodes = [sw, a, b, bondA, bondB, ...nics, ...ports]
    const slots = ports.map((port, i) => ({ id: port.id, name: port.data.Name, switchID: sw.id, x: i * 400, y: 600, width: 340 }))
    const positions = new Map([[a.id, { x: -1000 }], [b.id, { x: 1000 }]])
    return { sw, a, b, nodes, ports, links, slots, positions }
}
const order = (slots: SwitchPortSlot[], arranged: Map<string, number>) => slots.slice()
    .sort((a, b) => (arranged.get(a.id) ?? a.x) - (arranged.get(b.id) ?? b.x)).map(p => p.id)

describe('Switch ports ordered by real connections', () => {
    it('groups by host and Bond/NIC, including a manual port and a physically connected down NIC', () => {
        const f = fixture(), before = JSON.stringify(f.slots)
        const targets = infrastructurePortLayoutTargets(f.nodes, f.links)
        assert.equal(targets.length, 4)
        assert.equal(targets.find(t => t.portNodeID === 'port-3')!.bondNodeID, 'bond-b')
        assert.equal(targets.find(t => t.portNodeID === 'port-2')!.bondNodeID, 'bond-a')
        assert.equal(targets.find(t => t.portNodeID === 'port-0')!.bondNodeID, 'bond-b')
        assert.deepEqual(order(f.slots, switchPortConnectionPositions(f.slots, targets, f.positions)),
            ['port-2', 'port-1', 'port-0', 'port-3', 'port-4'])
        f.positions.set(f.a.id, { x: 2000 })
        assert.deepEqual(order(f.slots, switchPortConnectionPositions(f.slots, targets, f.positions)),
            ['port-0', 'port-3', 'port-2', 'port-1', 'port-4'])
        assert.equal(JSON.stringify(f.slots), before)
    })
    it('stays deterministic through shuffled events, reversed links, selection and traffic updates', () => {
        const f = fixture(), targets = infrastructurePortLayoutTargets(f.nodes, f.links)
        const expected = switchPortConnectionPositions(f.slots, targets, f.positions)
        f.nodes.forEach(n => { n.state.selected = true; n.data.CPUPercent = 99 })
        const reversed = f.links.map(l => ({ ...l, source: l.target, target: l.source, data: { ...l.data, RxBytes: 999999 } }))
        const actual = switchPortConnectionPositions(f.slots.slice().reverse(), infrastructurePortLayoutTargets(f.nodes.slice().reverse(), reversed), f.positions)
        f.slots.forEach(p => assert.equal(actual.get(p.id), expected.get(p.id)))
    })
    it('preserves every row extent and switch membership with variable card widths and natural port numbers', () => {
        const f = fixture(), targets = infrastructurePortLayoutTargets(f.nodes, f.links)
        const row = f.slots.map((p, i) => ({ ...p, width: i % 2 ? 360 : 300 }))
        const others = [{ ...row[0], id: 'other-switch', switchID: 'other', x: 2500 }, { ...row[0], id: 'other-row', y: 900 }]
        const result = switchPortConnectionPositions([...row, ...others], targets, f.positions)
        const left = (p: SwitchPortSlot) => (result.get(p.id) ?? p.x) - p.width / 2
        const right = (p: SwitchPortSlot) => (result.get(p.id) ?? p.x) + p.width / 2
        assert.equal(Math.min(...row.map(left)), Math.min(...row.map(p => p.x - p.width / 2)))
        assert.equal(Math.max(...row.map(right)), Math.max(...row.map(p => p.x + p.width / 2)))
        const sorted = row.slice().sort((a, b) => left(a) - left(b))
        sorted.slice(1).forEach((p, i) => assert.ok(left(p) >= right(sorted[i])))
        others.forEach(p => assert.equal(result.has(p.id), false))
        assert.deepEqual(order(f.slots, switchPortConnectionPositions(f.slots, [], f.positions)), ['port-0', 'port-2', 'port-4', 'port-1', 'port-3'])
    })
    it('ignores expired LLDP, ownership-only edges and manual records that were not materialized', () => {
        const f = fixture(), expired = f.links.map(l => ({ ...l, data: { ...l.data, LLDP: { ExpiresAt: 1 } } }))
        assert.equal(infrastructurePortLayoutTargets(f.nodes, expired).length, 0)
        assert.equal(infrastructurePortLayoutTargets(f.nodes, f.links.map(l => ({ ...l, data: { RelationType: 'ownership' } }))).length, 0)
        const disabled: any = { id: 99, switchNodeId: f.sw.id, switchPortName: '99', hostNodeId: f.b.id,
            hostNicNodeId: f.nodes.find(n => n.id === 'nic-b2')!.id, enabled: false }
        assert.equal(buildManualPortMappingTopologyLinks([disabled], f.nodes, f.links).length, 0)
        assert.equal(infrastructurePortLayoutTargets(f.nodes, []).length, 0)
    })
})

// Execute the actual layout hook, including its scope and fixed-card checks.
const source = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const method = ast.statements.filter(ts.isClassDeclaration).find(n => n.name?.text === 'Topology')!.members
    .find(n => n.name?.getText(ast) === 'layoutSwitchPortsByConnection')!.getText(ast)
const context: any = { infrastructurePortLayoutTargets, switchPortConnectionPositions, WrapperType: { Normal: 1, Hidden: 2, Group: 3 } }
vm.createContext(context)
vm.runInContext(ts.transpile(`class Probe { ${method} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)

describe('Switch port placement integration', () => {
    it('moves only normal switch-port cards and leaves host, summary, switch and Kubernetes positions alone', () => {
        const f = fixture(), probe = new context.Probe()
        const rendered = f.slots.map(slot => ({ x: slot.x, y: slot.y, width: slot.width, data: { id: slot.id, type: 1, wrapped: f.ports.find(n => n.id === slot.id) } }))
        const host = { x: -1000, y: 1000, width: 580, data: { id: f.a.id, type: 1, wrapped: f.a } }
        const otherHost = { x: 1000, y: 1000, width: 580, data: { id: f.b.id, type: 1, wrapped: f.b } }
        const summary = { x: -450, y: 600, width: 440, data: { id: 'summary', type: 3, wrapped: f.sw } }
        Object.assign(probe, { nodes: new Map(f.nodes.map(n => [n.id, n])), links: new Map(f.links.map(l => [l.id, l])),
            relocatedSwitchPorts: new Set(), nodeTagActive: 'infrastructure', topologyLayoutCardWidth: (n: any) => n.width })
        const root = { descendants: () => [...rendered, host, otherHost, summary] }
        probe.layoutSwitchPortsByConnection(root)
        assert.deepEqual(rendered.slice().sort((a, b) => a.x - b.x).map(n => n.data.id), ['port-2', 'port-1', 'port-0', 'port-3', 'port-4'])
        assert.equal(host.x, -1000); assert.equal(otherHost.x, 1000); assert.equal(summary.x, -450)
        assert.ok(probe.relocatedSwitchPorts.size > 0)
        probe.nodeTagActive = 'kubernetes'
        rendered.forEach((n, i) => n.x = f.slots[i].x)
        probe.layoutSwitchPortsByConnection(root)
        assert.equal(probe.relocatedSwitchPorts.size, 0)
        rendered.forEach((n, i) => assert.equal(n.x, f.slots[i].x))
        const renderTree = source.slice(source.indexOf('    renderTree() {'))
        assert.ok(renderTree.indexOf('this.layoutSwitchPortsByConnection(root)') > renderTree.indexOf('this.applyInfrastructureCompactLayout(root)'))
    })
})
