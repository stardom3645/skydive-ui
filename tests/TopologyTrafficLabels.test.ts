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
const methods = ['renderedLinkAttrs', 'linkDisplayOpacity', 'linkLabelOpacity']
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
    const context: any = { topologyLinkTraffic, Tools: { prettyBandwidth: (rate: number) => `${rate} bps` }, nodeWidth: 320, nodeHeight: 440,
        WrapperType: { Hidden: 2 } }
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
