import { compactTrafficLabel } from '../src/InfrastructureCompactRouting'
import { routeInfrastructureTraffic } from '../src/InfrastructureTrafficRouting'
import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyLinkTraffic } from '../src/TopologyLinkTraffic'
import { buildManualPortMappingTopologyLinks } from '../src/InfrastructurePortMapping'

// Exercise the production traffic/visibility/position functions without mounting
// React or contacting the collector. Group proxies deliberately have no metrics.
const source = (file: string) => ts.createSourceFile(file,
    fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const topologySource = source('Topology.tsx'), configSource = source('Config.ts')
const topologyClass = topologySource.statements.filter(ts.isClassDeclaration).find(node => node.name?.text === 'Topology')!
const methods = ['renderedLinkAttrs', 'linkTrafficTooltip', 'hasInlineLinkLabel', 'isInfrastructureGroupLink', 'linkDisplayOpacity', 'linkLabelOpacity', 'linkHitPointerEvents', 'infrastructureTrafficLabelSlots', 'selectLink']
const members = topologyClass.members.filter(member => member.name && methods.includes(member.name.getText(topologySource)))
    .map(member => member.getText(topologySource)).join('\n')
const configMethod = configSource.statements.filter(ts.isClassDeclaration)
    .map(node => node.members.find(member => member.name?.getText(configSource) === 'linkAttrs'
        && member.getText(configSource).includes('topologyLinkTraffic'))).find(Boolean)!
let position: ts.VariableDeclaration | undefined
let drawPolicy: ts.VariableDeclaration | undefined
let pathBuilder: ts.VariableDeclaration | undefined
const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(topologySource) === 'linkLabelPosition') position = node
    if (ts.isVariableDeclaration(node) && node.name.getText(topologySource) === 'shouldDrawLink') drawPolicy = node
    if (ts.isVariableDeclaration(node) && node.name.getText(topologySource) === 'linkPath') pathBuilder = node
    ts.forEachChild(node, visit)
}
visit(topologyClass)

function probe(original: any, displayed: any = original) {
    const context: any = { topologyLinkTraffic, compactTrafficLabel, translate: (key: string) => key, Tools: { prettyBandwidth: (rate: number) => `${rate} bps` }, nodeWidth: 320, nodeHeight: 440,
        WrapperType: { Hidden: 2, Group: 3 }, select: () => ({ classed: () => {} }) }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`
        class ConfigProbe { ${configMethod.getText(configSource)} }
        class TopologyProbe {
            ${members}
            preparePaths() {
                const paths = new Map();
                const shouldDrawLink = ${drawPolicy!.initializer!.getText(topologySource)};
                const linker = d => { this.pathReads++; return this.infrastructureTrafficRoutes.get('relation:' + d.id).path; };
                const linkPath = ${pathBuilder!.initializer!.getText(topologySource)};
                return { path: linkPath, measured: d => shouldDrawLink(d) && this.renderedLinkAttrs(d).label };
            }
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
        nodeTagActive: 'infrastructure',
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
    it('retains each host\'s three measured labels across host switches and omitted zero TX counters', () => {
        const hosts = Array.from({ length: 3 }, (_, i) => ({ id: `host-${i}`, data: { Type: 'host' }, state: { selected: false } }))
        const originals = hosts.reduce<any[]>((all, host, h) => all.concat(Array.from({ length: 3 }, (_, n) => {
            const link: any = trafficLink()
            link.id = `${host.id}-link-${n}`
            link.source.id = `nic-${h}-${n}`; link.source.parent = host
            link.target.id = `port-${h}-${n}`; link.target.data.Probe = 'lldp'
            return link
        })), [])
        const displayed = originals.map((link, i) => ({ ...link, source: hosts[Math.floor(i / 3)] }))
        const topology = probe(originals[0], displayed[0])
        topology.links = new Map(originals.map(link => [link.id, link]))
        topology.d3nodes = new Map([...hosts, ...originals.map(link => link.target)].map(node => [node.id, { data: { type: 1 } }]))
        topology.isLinkNodeSelected = (link: any) => link.source.state.selected
        topology.isLinkVisible = topology.isLinkNodeSelected
        for (const [frame, selected] of [0, 1, 2, 1, 0, 1].entries()) {
            hosts.forEach((host, index) => host.state.selected = index === selected)
            originals.forEach(link => {
                // Captured collector shape: TxBytes disappears when its delta is zero.
                link.source.data.LastUpdateMetric = frame % 2
                    ? { Start: 1000, Last: 11000, RxBytes: 3243 }
                    : { Start: 1000, Last: 11000, RxBytes: 3243, TxBytes: 248 }
            })
            const visible = displayed.filter(link => topology.hasInlineLinkLabel(link) && topology.linkLabelOpacity(link) > 0)
            assert.deepEqual(visible.map(link => link.source.id), [hosts[selected].id, hosts[selected].id, hosts[selected].id])
            visible.forEach(link => assert.equal(topology.renderedLinkAttrs(link).label,
                `${(3243 + (frame % 2 ? 0 : 248)) * 8 / 10} bps`))
        }
    })

    it('renders the actual registered manual NIC through group proxies, including zero and missing counters', () => {
        const sw: any = { id: 'sw', data: { Type: 'switch', Name: 'leaf' } }
        const host: any = { id: 'host', data: { Type: 'host', Name: 'host' } }
        const nic: any = { id: 'registered', parent: host, data: { Type: 'device', Name: 'eno1',
            LastUpdateMetric: { Start: 1000, Last: 11000, RxBytes: 1000, TxBytes: 800 } } }
        const other: any = { id: 'other-nic', parent: host, data: { Type: 'device', Name: 'eno2',
            LastUpdateMetric: { Start: 1000, Last: 11000, RxBytes: 99999999, TxBytes: 99999999 } } }
        const mapping: any = { id: 7, enabled: true, switchNodeId: sw.id, hostNodeId: host.id,
            hostNicNodeId: nic.id, switchPortName: 'manual-port-1' }
        const built = buildManualPortMappingTopologyLinks([mapping], [sw, host, nic, other], [])[0]
        const original: any = { id: built.id, data: built.data, source: { id: built.sourceNodeID,
            data: { ...built.portData, LastUpdateMetric: other.data.LastUpdateMetric } }, target: nic }
        const grouped = groupedLink(original), topology = probe(original, grouped)
        assert.equal(built.targetNodeID, nic.id)
        assert.equal(topologyLinkTraffic(original)!.node.id, built.targetNodeID)
        assert.equal(topology.renderedLinkAttrs(grouped).label, '1440 bps')
        nic.data.LastUpdateMetric.RxBytes = 0
        nic.data.LastUpdateMetric.TxBytes = 0
        assert.equal(topology.renderedLinkAttrs(grouped).label, '0 bps')
        assert.equal(topologyLinkTraffic(original)!.total, 0)
        delete nic.data.LastUpdateMetric.RxBytes
        assert.equal(topology.renderedLinkAttrs(grouped).label, '0 bps')
        assert.equal(topologyLinkTraffic(original)!.total, 0)
        delete nic.data.LastUpdateMetric
        assert.equal(topology.renderedLinkAttrs(grouped).label, '')
        assert.equal(topologyLinkTraffic(original), undefined)
    })
    it('refreshes the line label when the collector changes from 30-second to 10-second intervals', () => {
        const original: any = trafficLink(), topology = probe(original)
        const samples = [
            { Start: 1000, Last: 31000, RxBytes: 3000000, TxBytes: 750000, total: 1000000 },
            { Start: 31000, Last: 41000, RxBytes: 2000000, TxBytes: 500000, total: 2000000 },
            { Start: 41000, Last: 51250, RxBytes: 1025000, TxBytes: 256250, total: 1000000 }
        ]
        for (const { total, ...metric } of samples) {
            original.source.data.LastUpdateMetric = metric
            assert.equal(topology.renderedLinkAttrs(original).label, `${total} bps`)
            assert.equal(topologyLinkTraffic(original)!.total, total)
        }
    })
    it('prepares hidden VM proxy geometry and measured labels so selection reveals them without another layout', () => {
        const original: any = trafficLink()
        original.target.data = { Type: 'bridge' }
        const displayed = { ...original, source: { id: 'vm', data: { Type: 'libvirt' } } }
        const topology = probe(original, displayed)
        topology.isLinkVisible = () => false
        topology.pathReads = 0
        topology.infrastructureTrafficRoutes = new Map([[`relation:${original.id}`, { path: 'M0,0 C0,500 600,500 600,1000' }]])
        const paint = topology.preparePaths()
        const line = { path: paint.path(displayed), opacity: topology.linkDisplayOpacity(displayed) }
        assert.equal(line.opacity, 0, 'prepare geometry without making hidden connections visible')
        assert.equal(topology.linkHitPointerEvents(displayed), 'none', 'hidden prepared paths do not intercept canvas clicks')
        assert.equal(topology.linkHitPointerEvents(displayed, true), 'none')
        assert.ok(line.path.includes(' C'), 'the transparent path is not empty')
        assert.equal(paint.measured(displayed), '14400 bps', 'retain the measured label before selection too')
        assert.equal(paint.path(displayed), line.path, 'overlay and hit area share the cached geometry')
        topology.isLinkVisible = () => true
        topology.isLinkNodeSelected = () => true
        assert.equal(topology.linkDisplayOpacity(displayed), 1)
        assert.equal(topology.linkHitPointerEvents(displayed), 'auto', 'the revealed connection remains clickable')
        assert.equal(topology.linkHitPointerEvents(displayed, true), 'auto')
        assert.equal(paint.path(displayed), line.path)
        assert.equal(topology.pathReads, 1, 'selection requires no new path construction')
        topology.isLinkVisible = () => false
        assert.equal(topology.linkDisplayOpacity(displayed), 0, 'deselection still hides the path')
        assert.equal(topology.linkHitPointerEvents(displayed), 'none')
    })
    it('keeps the Kubernetes proxy path preparation policy unchanged', () => {
        const original: any = trafficLink(), displayed = groupedLink(original), topology = probe(original, displayed)
        topology.nodeTagActive = 'kubernetes'
        topology.pathReads = 0
        topology.infrastructureTrafficRoutes = new Map([[`relation:${original.id}`, { path: 'M0,0 C0,500 600,500 600,1000' }]])
        topology.isLinkVisible = () => false
        assert.equal(topology.preparePaths().path(displayed), '')
        assert.equal(topology.linkHitPointerEvents(displayed), 'auto')
        assert.equal(topology.pathReads, 0)
        topology.isLinkVisible = () => true
        assert.ok(topology.preparePaths().path(displayed).includes(' C'))
    })
    it('keeps LLDP overview lines without repeating hidden NIC rates, including while selected', () => {
        const original: any = trafficLink()
        ;(original.target.data as any).LLDP = { PortID: 'ethernet1/1/32' }
        const overview = groupedLink(original), topology = probe(original, overview)
        const measured = topologyLinkTraffic(original)!
        assert.equal(topology.hasInlineLinkLabel(overview), false)
        assert.equal(topology.linkLabelOpacity(overview), 0)
        assert.equal(topology.linkDisplayOpacity(overview), 1)
        assert.equal(topology.linkHitPointerEvents(overview), 'auto')
        assert.equal(topology.linkHitPointerEvents(overview, true), 'none', 'suppressed LLDP labels do not become invisible click targets')
        topology.isLinkNodeSelected = () => true
        assert.equal(topology.linkLabelOpacity(overview), 0)
        assert.equal(topology.linkDisplayOpacity(overview), 1)
        assert.equal(topology.renderedLinkAttrs(overview).label, '14400 bps', 'the original rate remains available to details')
        assert.equal(topologyLinkTraffic(original)!.node.id, measured.node.id)
        assert.equal(topologyLinkTraffic(original)!.total, measured.total)
        topology.infrastructureTrafficRoutes = new Map([[`relation:${overview.id}`, { trafficNodeID: overview.target.id }]])
        assert.equal(topology.infrastructureTrafficLabelSlots([overview]).size, 0)
        topology.d3nodes.set(original.source.id, { data: { type: 1 } })
        assert.equal(topology.hasInlineLinkLabel(overview), false, 'both concrete ports must be visible')
        topology.d3nodes.set(original.target.id, { data: { type: 1 } })
        assert.equal(topology.hasInlineLinkLabel(overview), true)
        assert.equal(topology.linkLabelOpacity(overview), 1)
        topology.d3nodes.delete(original.target.id)
        assert.equal(topology.hasInlineLinkLabel(overview), false, 'collapsing removes the rate again')
    })
    it('reveals rates for selected expanded ports/hosts and direct line clicks without a tree rebuild', () => {
        const original: any = trafficLink()
        original.state = { selected: false }
        original.target.data.LLDP = { PortID: 'ethernet1/1/6' }
        const displayed = { ...groupedLink(original), target: original.target }, topology = probe(original, displayed)
        assert.equal(topology.linkLabelOpacity(displayed), 0)
        topology.isLinkNodeSelected = () => true
        assert.equal(topology.linkLabelOpacity(displayed), 1, 'host or visible port selection reveals its rate')
        topology.isLinkNodeSelected = () => false
        assert.equal(topology.linkLabelOpacity(displayed), 0)
        topology.d3nodes.delete(original.target.id)
        let observedOpacity = 0
        topology.unselectAllNodes = () => {}
        topology.unselectAllLinks = () => { original.state.selected = false }
        topology.hideLinks = () => { observedOpacity = topology.linkLabelOpacity(displayed) }
        topology.selectLink(original.id, true)
        assert.equal(observedOpacity, 1, 'direct line clicks reveal the mounted label immediately')
        topology.selectLink(original.id, true)
        assert.equal(original.state.selected, true, 're-clicking must not clear the selected edge')
        topology.selectLink(original.id, false)
        assert.equal(observedOpacity, 0)
    })
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

    it('hides dense collapsed-group lines and labels without deleting original interface measurements', () => {
        const originals = Array.from({ length: 18 }, (_, i) => ({ ...trafficLink(), id: `traffic-${i}` }))
        const displayed = originals.map(link => ({ ...groupedLink(link), target: { id: 'group', data: { Type: 'libvirt' } } }))
        const topology = probe(originals[0], displayed[0])
        topology.links = new Map(originals.map(link => [link.id, link]))
        topology.displayedLinks = displayed
        topology.d3nodes.set('group', { x: 620, y: 1000, width: 580, height: 280, data: { id: 'group', type: 3 } })
        topology.infrastructureTrafficRoutes = new Map(displayed.map(link => [`relation:${link.id}`, { trafficNodeID: 'group', points: [], path: '' }]))
        const slots = topology.infrastructureTrafficLabelSlots(displayed)
        assert.equal(slots.size, 0)
        displayed.forEach(link => {
            assert.equal(topology.linkDisplayOpacity(link), 0)
            assert.equal(topology.linkLabelOpacity(link), 0)
        })
        assert.equal(topology.links.size, 18)
        assert.equal(topology.renderedLinkAttrs(displayed[0]).label, '14400 bps')
    })

    it('hides either grouped endpoint even when selected, and restores traffic after both endpoints become individual cards', () => {
        const original = trafficLink(), displayed = groupedLink(original), topology = probe(original, displayed)
        for (const endpoint of [displayed.source, displayed.target]) {
            topology.d3nodes.get(endpoint.id).data.type = 3
            topology.isLinkNodeSelected = () => true
            assert.equal(topology.isInfrastructureGroupLink(displayed), true)
            assert.equal(topology.linkDisplayOpacity(displayed), 0)
            assert.equal(topology.linkLabelOpacity(displayed), 0)
            topology.d3nodes.get(endpoint.id).data.type = 1
        }
        assert.equal(topology.linkDisplayOpacity(displayed), 1)
        assert.equal(topology.linkLabelOpacity(displayed), 1)
        assert.equal(topology.renderedLinkAttrs(displayed).label, '14400 bps')
        topology.d3nodes.get(displayed.target.id).data.type = 3
        topology.nodeTagActive = 'kubernetes'
        assert.equal(topology.isInfrastructureGroupLink(displayed), false)
        assert.equal(topology.linkDisplayOpacity(displayed), 1)
    })

    it('retains original interface metrics while a group hides the drawing and its label', () => {
        const original = trafficLink(), grouped = groupedLink(original), topology = probe(original, grouped)
        topology.d3nodes.get(grouped.target.id).data.type = 3
        assert.equal(topology.renderedLinkAttrs(grouped).label, '14400 bps')
        assert.equal(topology.linkDisplayOpacity(grouped), 0)
        assert.equal(topology.linkLabelOpacity(grouped), 0)
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
    it('does not promote unmeasured grouped relations into traffic', () => {
        const original = trafficLink(), grouped = groupedLink(original), topology = probe(original, grouped)
        delete (original.source.data as any).LastUpdateMetric
        assert.equal(topology.renderedLinkAttrs(grouped).label, '')
        assert.equal(topology.linkDisplayOpacity(grouped), 0)
    })
    it('shows mapped NIC traffic on manual links and grouped proxies without changing manual styling', () => {
        const manual = trafficLink()
        ;(manual.data as any) = { RelationType: 'manual', ManualPortMapping: true }
        // Production manual links have the synthetic switch port as source.
        const nic = manual.source
        ;(manual as any).source = manual.target
        ;(manual as any).target = nic
        const grouped = groupedLink(manual), topology = probe(manual, grouped)
        assert.equal(topology.renderedLinkAttrs(grouped).label, '14400 bps')
        assert.deepEqual(Array.from(topology.renderedLinkAttrs(grouped).classes), ['manual-port-mapping', 'traffic'])
        assert.ok(topology.linkTrafficTooltip(grouped).includes('linkManualTrafficNote'))
        nic.data.LastUpdateMetric.RxBytes = 2000
        assert.equal(topology.renderedLinkAttrs(grouped).label, '22400 bps')
        delete (nic.data as any).LastUpdateMetric
        assert.equal(topology.renderedLinkAttrs(grouped).label, '')
        assert.deepEqual(Array.from(topology.renderedLinkAttrs(grouped).classes), ['manual-port-mapping'])
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
