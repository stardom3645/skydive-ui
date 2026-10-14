import { compactTrafficLabel } from '../src/InfrastructureCompactRouting'
import { routeInfrastructureTraffic } from '../src/InfrastructureTrafficRouting'
import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyLinkTraffic } from '../src/TopologyLinkTraffic'

// Exercise the production traffic/visibility/position functions without mounting
// React or contacting the collector. Group proxies deliberately have no metrics.
const source = (file: string) => ts.createSourceFile(file,
    fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const topologySource = source('Topology.tsx'), configSource = source('Config.ts')
const topologyClass = topologySource.statements.filter(ts.isClassDeclaration).find(node => node.name?.text === 'Topology')!
const methods = ['renderedLinkAttrs', 'linkDisplayOpacity', 'linkLabelOpacity', 'infrastructureTrafficLabelSlots']
const members = topologyClass.members.filter(member => member.name && methods.includes(member.name.getText(topologySource)))
    .map(member => member.getText(topologySource)).join('\n')
const configMethod = configSource.statements.filter(ts.isClassDeclaration)
    .map(node => node.members.find(member => member.name?.getText(configSource) === 'linkAttrs'
        && member.getText(configSource).includes('topologyLinkTraffic'))).find(Boolean)!
let position: ts.VariableDeclaration | undefined
const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(topologySource) === 'linkLabelPosition') position = node
    ts.forEachChild(node, visit)
}
visit(topologyClass)

function probe(original: any, displayed: any = original) {
    const context: any = { topologyLinkTraffic, compactTrafficLabel, Tools: { prettyBandwidth: (rate: number) => `${rate} bps` }, nodeWidth: 320, nodeHeight: 440,
        WrapperType: { Hidden: 2, Group: 3 } }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`
        class ConfigProbe { ${configMethod.getText(configSource)} }
        class TopologyProbe {
            ${members}
            position(d) {
                const resolveEndpoint = (link, side) => {
                    const node = this.d3nodes.get(link[side].id);
                    return { x: node.x, y: node.y, node: link[side] };
                };
                const branchLabelSlots = this.infrastructureTrafficLabelSlots(this.displayedLinks || [d]);
                const position = ${position!.initializer!.getText(topologySource)};
                return position(d);
            }
        }
        this.config = new ConfigProbe(); this.topology = new TopologyProbe();
    `, { target: ts.ScriptTarget.ES2018 }), context)
    const topology = context.topology
    Object.assign(topology, {
        links: new Map([[original.id, original]]),
        props: { linkAttrs: (link: any) => context.config.linkAttrs(link) },
        isLinkVisible: () => true, isLinkNodeSelected: () => false,
        hasSelectedLinkNode: () => false, activeContainerMiniNodeIDs: () => new Set(),
        isActiveContainerMiniLink: () => false,
        isContainerProxyLink: (link: any) => link.source !== original.source || link.target !== original.target,
        d3nodes: new Map([displayed.source, displayed.target].map(node => [node.id,
            { x: node.x || 0, y: node.y || 0, width: 580, height: 380, data: { type: 1 } }])),
        topologyLayoutCardWidth: (node: any) => node.width,
        root: {}, topologyEdgeBounds: (node: any) => node,
        topologyLayoutCardHeight: (node: any) => node.height
    })
    return topology
}

const trafficLink = () => ({ id: 'traffic', source: { id: 'nic', data: { Type: 'device',
    LastUpdateMetric: { Start: 1000, Last: 2000, RxBytes: 1000, TxBytes: 800 } } },
    target: { id: 'switch-port', data: { Type: 'switchport' } }, data: { RelationType: 'layer2' } })
const groupedLink = (link: any) => ({ ...link, source: { id: 'host-group', data: { Type: 'host' } },
    target: { id: 'port-group', data: { Type: 'switch' }, x: 620 } })

describe('Infrastructure traffic labels', () => {
    it('associates bridge fan-out measurements with their VM endpoint in either edge direction', () => {
        const cards = [{ id: 'bridge', type: 'bridge', x: -500, y: 0, width: 340, height: 136 },
            ...Array.from({ length: 16 }, (_, i) => ({ id: `vm-${i}`, type: 'libvirt', x: (i % 8) * 544,
                y: 1100 + Math.floor(i / 8) * 800, width: 480, height: 558, above: 41 }))]
        const edges = cards.slice(1).map(c => ({ id: `link-${c.id}`, sourceID: 'bridge', targetID: c.id }))
        const routes = routeInfrastructureTraffic(cards, edges)
        const reversed = routeInfrastructureTraffic(cards, edges.map(e => ({ ...e, sourceID: e.targetID, targetID: e.sourceID })))
        edges.forEach(edge => {
            const target = cards.find(card => card.id === edge.targetID)!, route = routes.get(edge.id)!
            const point = compactTrafficLabel(route, 166, cards)!
            assert.equal(route.trafficNodeID, target.id)
            assert.equal(point.x, target.x)
            assert.equal(point.y, target.y - target.height / 2 - 34)
            assert.deepEqual(compactTrafficLabel(reversed.get(edge.id)!, 166, cards), point)
        })
    })

    it('keeps individual NIC values distinct at the same VM and stable across metric refresh order', () => {
        const originals = Array.from({ length: 6 }, (_, i) => ({ ...trafficLink(), id: `traffic-${i}` }))
        const displayed = originals.map((link, i) => ({ ...link, source: { id: 'bridge', data: { Type: 'bridge' } },
            target: { id: `vm-${i < 2 ? 0 : i - 1}`, data: { Type: 'libvirt' } } }))
        const topology = probe(originals[0], displayed[0])
        topology.links = new Map(originals.map(link => [link.id, link]))
        topology.displayedLinks = displayed
        const cards = [{ id: 'bridge', type: 'bridge', x: -500, y: 0, width: 340, height: 136 },
            ...Array.from({ length: 5 }, (_, i) => ({ id: `vm-${i}`, type: 'libvirt', x: i * 544, y: 1100, width: 480, height: 558 }))]
        topology.d3nodes = new Map(cards.map(card => [card.id, { ...card, data: { id: card.id, type: 1 } }]))
        topology.infrastructureTrafficRoutes = routeInfrastructureTraffic(cards, displayed.map(link => ({ id: `relation:${link.id}`, sourceID: link.source.id, targetID: link.target.id })))
        const a = topology.position(displayed[0]), b = topology.position(displayed[1])
        assert.equal(a.y, b.y)
        assert.ok(Math.abs(a.x - b.x) >= '14400 bps'.length * 18 + 22)
        assert.equal(topology.renderedLinkAttrs(displayed[0]).label, '14400 bps')
        assert.equal(topology.renderedLinkAttrs(displayed[1]).label, '14400 bps')
        topology.displayedLinks = displayed.slice().reverse()
        assert.equal(topology.position(displayed[0]).x, a.x)
        assert.equal(topology.position(displayed[1]).x, b.x)
        topology.isLinkVisible = (link: any) => link.id !== displayed[1].id
        assert.equal(topology.position(displayed[0]).x, 0)
        assert.equal(topology.infrastructureTrafficLabelSlots(displayed).has(displayed[1].id), false)
    })

    it('lays out multiple collapsed-group interface values beside their own endpoint without overlap', () => {
        const group = { id: 'group', x: 0, y: 1000, width: 580, height: 280, group: true }
        const route = { path: '', points: [{ x: -800, y: 0 }, { x: 0, y: 860 }], trafficNodeID: 'group' }
        const previous = { id: 'previous-vm', x: 0, y: 570, width: 480, height: 260 }
        const points = Array.from({ length: 6 }, (_, index) => compactTrafficLabel(route, 184, [group, previous], { index, count: 6, width: 184 })!)
        assert.equal(new Set(points.map(p => `${p.x},${p.y}`)).size, 6)
        points.forEach((a, i) => {
            assert.ok(a.y + 21 < group.y - group.height / 2)
            assert.ok(a.y - 21 > previous.y + previous.height / 2)
            points.slice(i + 1).forEach(b => assert.ok(Math.abs(a.x - b.x) >= 184 || Math.abs(a.y - b.y) >= 42))
        })
    })

    it('summarizes dense collapsed groups without inventing a bandwidth total or losing interface values', () => {
        const originals = Array.from({ length: 18 }, (_, i) => ({ ...trafficLink(), id: `traffic-${i}` }))
        const displayed = originals.map(link => ({ ...groupedLink(link), target: { id: 'group', data: { Type: 'libvirt' } } }))
        const topology = probe(originals[0], displayed[0])
        topology.links = new Map(originals.map(link => [link.id, link]))
        topology.displayedLinks = displayed
        topology.d3nodes.set('group', { x: 620, y: 1000, width: 580, height: 280, data: { id: 'group', type: 3 } })
        topology.infrastructureTrafficRoutes = new Map(displayed.map(link => [`relation:${link.id}`, { trafficNodeID: 'group', points: [], path: '' }]))
        const slots = topology.infrastructureTrafficLabelSlots(displayed)
        const visible = Array.from(slots.values()).filter((slot: any) => !slot.hidden) as any[]
        assert.equal(visible.length, 1)
        assert.equal(visible[0].text, '18개 연결')
        assert.equal(visible[0].detail.split('\n').length, 18)
        assert.equal(topology.links.size, 18)
        assert.equal(topology.renderedLinkAttrs(displayed[0]).label, '14400 bps')
        const ownerID = Array.from(slots.keys()).find(id => !slots.get(id).hidden)!
        const point = topology.position(displayed.find(link => link.id === ownerID))
        assert.equal(point.x, 620)
        assert.equal(point.y, 826)
    })

    it('reads original interface metrics after drawing endpoints become group cards', () => {
        const original = trafficLink(), grouped = groupedLink(original), topology = probe(original, grouped)
        assert.equal(topology.renderedLinkAttrs(grouped).label, '14400 bps')
        assert.equal(topology.linkDisplayOpacity(grouped), 1)
        assert.equal(topology.linkLabelOpacity(grouped), 1)
        original.source.data.LastUpdateMetric.RxBytes = 2000
        assert.equal(topology.renderedLinkAttrs(grouped).label, '22400 bps')
    })
    it('keeps tag visibility and active drilldown restrictions for measured traffic', () => {
        const original = trafficLink(), grouped = groupedLink(original), topology = probe(original, grouped)
        topology.isLinkVisible = () => false
        assert.equal(topology.linkLabelOpacity(grouped), 0)
        topology.isLinkVisible = () => true
        topology.activeContainerMiniNodeIDs = () => new Set(['unrelated'])
        assert.equal(topology.linkDisplayOpacity(grouped), 0)
        topology.isActiveContainerMiniLink = () => true
        assert.equal(topology.linkDisplayOpacity(grouped), 1)
    })
    it('does not promote unmeasured grouped relations or manual mappings into traffic', () => {
        const original = trafficLink(), grouped = groupedLink(original), topology = probe(original, grouped)
        delete (original.source.data as any).LastUpdateMetric
        assert.equal(topology.renderedLinkAttrs(grouped).label, '')
        assert.equal(topology.linkDisplayOpacity(grouped), 0)
        const manual = trafficLink()
        ;(manual.data as any).ManualPortMapping = true
        assert.equal(probe(manual).renderedLinkAttrs(manual).label, '')
    })
    it('retains traffic on ordinary direct links and transient links absent from the graph map', () => {
        const original = trafficLink(), topology = probe(original)
        assert.equal(topology.renderedLinkAttrs(original).label, '14400 bps')
        topology.links.clear()
        assert.equal(topology.renderedLinkAttrs(original).label, '14400 bps')
    })
    it('places measured traffic on the rerouted path while preserving original interface metrics', () => {
        const original = trafficLink(), grouped = groupedLink(original), topology = probe(original, grouped)
        const cards = [{ id: grouped.source.id, x: 0, y: 1000, width: 340, height: 136 },
            { id: grouped.target.id, x: 1600, y: 0, width: 340, height: 136 },
            { id: 'host', x: 800, y: 500, width: 580, height: 436 }]
        topology.d3nodes = new Map(cards.map(card => [card.id, { ...card, data: { id: card.id, type: 1 } }]))
        topology.infrastructureTrafficRoutes = routeInfrastructureTraffic(cards, [{ id: `relation:${grouped.id}`,
            sourceID: grouped.source.id, targetID: grouped.target.id }])
        const route = topology.infrastructureTrafficRoutes.get(`relation:${grouped.id}`)!
        const width = '14400 bps'.length * 18 + 22
        const expected = compactTrafficLabel(route, width, cards)!
        assert.ok(expected)
        assert.equal(topology.position(grouped).x, expected.x)
        assert.equal(topology.position(grouped).y, expected.y)
        assert.equal(topology.renderedLinkAttrs(grouped).label, '14400 bps')
    })
    it('positions labels outside tall cards when all legacy fixed offsets are covered', () => {
        const original = trafficLink(), grouped = groupedLink(original), topology = probe(original, grouped)
        const point = topology.position(grouped)
        const labelWidth = '14400 bps'.length * 18 + 22, labelHeight = 42
        topology.d3nodes.forEach((card: any) => {
            const overlaps = Math.abs(point.x - card.x) * 2 < labelWidth + card.width + 16
                && Math.abs(point.y - card.y) * 2 < labelHeight + card.height + 16
            assert.equal(overlaps, false, `traffic label covered by card at ${card.x},${card.y}`)
        })
    })
})
