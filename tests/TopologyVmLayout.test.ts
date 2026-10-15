import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyCardDimensions, topologyGroupFullyExpanded } from '../src/TopologyNodePresentation'
import { topologyBranchOffsets } from '../src/TopologyBranchSpacing'
import { topologyLaneBounds, topologyLaneOffsets, INFRASTRUCTURE_TRAFFIC_LANE_GAP, INFRASTRUCTURE_HOST_CAPTION_GAP } from '../src/TopologyLaneSpacing'
import { getMoldNetworkIndex, matchMoldNIC, moldVMNetworkSummary } from '../src/MoldTopologyNetworks'
import { infrastructureCompactLayout, infrastructureVMBridgeIDs } from '../src/InfrastructureCompactLayout'
import { infrastructureVirtualNICOwners, infrastructureNICGroupOwner } from '../src/InfrastructureVMBundles'

// Run the production placement methods against real hierarchy/flextree output,
// including the invisible wrappers used to align topology layers.
const { hierarchy } = require('d3-hierarchy')
const { flextree } = require('d3-flextree')
const TOPOLOGY_STATUS_BADGE_RADIUS = Number(fs.readFileSync(path.resolve(__dirname, '../src/TopologyStatusBadge.tsx'), 'utf8')
    .match(/export const TOPOLOGY_STATUS_BADGE_RADIUS = ([\d.]+)/)![1])
const file = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
const ast = ts.createSourceFile('Topology.tsx', file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const component = ast.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'Topology') as ts.ClassDeclaration
const names = ['compactVmLayerKind', 'compactVmLayerLayout', 'shiftHierarchySubtreeX', 'topologyLayoutCardWidth',
    'topologyLayoutCardHeight', 'topologyCardNetworkSummary', 'compactHostSubtreeLayout', 'isHostSubtreeRoot', 'visibleHostSubtreeNodes',
    'horizontalNodeBounds', 'separateTopologyBranches', 'topologyLaneItem', 'separateTopologyLanes', 'applyInfrastructureCompactLayout', 'topologyEdgeBounds']
const methods = component.members.filter(n => n.name && names.includes(n.name.getText(ast))).map(n => n.getText(ast)).join('\n')
const stackOffset = ast.statements.filter(ts.isVariableStatement).find(statement =>
    statement.declarationList.declarations.some(declaration => declaration.name.getText(ast) === 'topologyGroupStackOffset'))!.getText(ast)
const context: any = { topologyCardDimensions, topologyGroupFullyExpanded, topologyBranchOffsets,
    getMoldNetworkIndex, matchMoldNIC, moldVMNetworkSummary,
    infrastructureCompactLayout, infrastructureVMBridgeIDs, infrastructureVirtualNICOwners, infrastructureNICGroupOwner, topologyLevelLabelSafeInset: 130,
    topologyLaneBounds, topologyLaneOffsets, INFRASTRUCTURE_TRAFFIC_LANE_GAP, INFRASTRUCTURE_HOST_CAPTION_GAP, TOPOLOGY_STATUS_BADGE_RADIUS,
    compactVmNodeGap: 64, compactVmGroupGap: 64, compactHostSubtreeGap: 80,
    WrapperType: { Normal: 1, Hidden: 2, Group: 3 } }
vm.createContext(context)
vm.runInContext(ts.transpile(`${stackOffset}\nclass Probe { ${methods} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)

// Display labels are supplied by the surrounding app; exercise layout independently.
context.Probe.prototype.topologyNodeDisplayName = (node: any) => node.data.wrapped.data.Name || node.data.id

const wrapper = (id: string, weight: number, type = 1, children: any[] = []): any => ({
    id, type, children, size: [type === 2 ? 50 : 604, 440],
    wrapped: { id, getWeight: () => weight, data: { Type: weight === 5020 ? 'host' : weight === 7040 ? 'ovsbridge' : 'libvirt' },
        state: { expanded: true } }
})
const branch = (id: string, count: number, collapsed = false) => wrapper(id, 5020, 1, [
    wrapper(`${id}-bridge`, 7040, 1, [
        wrapper(`${id}-system-row`, 7060, 2, Array.from({ length: 3 }, (_, i) => wrapper(`${id}-system-${i}`, 7060))),
        wrapper(`${id}-router-gap`, 7070, 2, [wrapper(`${id}-router-row`, 7070, 2, [wrapper(`${id}-router`, 7070)])]),
        wrapper(`${id}-user-gap`, 7080, 2, [wrapper(`${id}-user-gap-2`, 7080, 2, [
            wrapper(`${id}-user-row`, 7080, 2, collapsed ? [wrapper(`${id}-user-group`, 7080, 3)]
                : Array.from({ length: count }, (_, i) => wrapper(`${id}-user-${i}`, 7080)))
        ])])
    ])
])
function scene(count: number, secondCount?: number, collapsed = false, expanded?: { kind: 'system' | 'router' | 'user'; index: number; nics: number; grouped?: boolean }) {
    const wrapped = wrapper('root', 0, 2, [branch('host-a', count, collapsed), ...(secondCount === undefined ? [] : [branch('host-b', secondCount)])])
    if (expanded) {
        const all: any[] = []
        const walk = (node: any) => { all.push(node); node.children.forEach(walk) }
        walk(wrapped)
        const owner = all.find(node => node.id === `host-a-${expanded.kind}-${expanded.index}` || (expanded.kind === 'router' && node.id === 'host-a-router'))
        const weight = owner.wrapped.getWeight()
        const nics = Array.from({ length: expanded.nics }, (_, index) => {
            const node = wrapper(`${owner.id}-nic-${index}`, weight)
            node.wrapped.data.Type = 'tun'
            return node
        })
        if (expanded.grouped) {
            const group = wrapper(`${owner.id}-nic-group`, weight, 3)
            group.wrapped.data.Type = 'tun'
            group.wrapped.data.GroupType = 'tun'
            group.wrapped.children = nics.map(node => node.wrapped)
            owner.children = [group]
        } else owner.children = nics
        owner.wrapped.children = nics.map(node => node.wrapped)
    }
    const root = hierarchy(wrapped), probe = new context.Probe()
    probe.props = {}
    probe.nodeTagActive = 'infrastructure'
    probe.root = wrapped.wrapped
    probe.weightTitles = new Map() // Classification must not depend on translated labels.
    probe.layerCardLayouts = new Map()
    root.each((node: any) => {
        if (node.data.type !== 2) node.data.size[0] = probe.topologyLayoutCardWidth(node) + 44
    })
    flextree()(root)
    probe.separateTopologyLanes(root)
    const apply = () => {
        probe.compactVmLayerLayout(root)
        probe.compactHostSubtreeLayout(root)
        probe.separateTopologyBranches(root)
    }
    return { root, probe, apply }
}
function assertCentered(root: any, probe: any, id: string) {
    const nodes = root.descendants().filter((n: any) => n.data.type !== 2)
    const parent = nodes.find((n: any) => n.data.id === `${id}-bridge`)
    for (const weight of [7060, 7070, 7080]) {
        const row = nodes.filter((n: any) => n.data.id.startsWith(id) && n.data.wrapped.getWeight() === weight
            && probe.compactVmLayerKind(n))
        const blocks = row.map((n: any) => n.descendants().filter((child: any) => child.data.type !== 2))
        const painted = (nodes: any[]) => ({
            left: Math.min(...nodes.map(n => n.x - probe.topologyLayoutCardWidth(n) / 2)),
            right: Math.max(...nodes.map(n => n.x + probe.topologyLayoutCardWidth(n) / 2))
        })
        const bounds = painted(blocks.flat())
        assert.ok(Math.abs((bounds.left + bounds.right) / 2 - parent.x) < 0.001, `layer ${weight} footprint shifted away from its parent`)
        for (let i = 1; i < blocks.length; i++) assert.ok(painted(blocks[i]).left - painted(blocks[i - 1]).right >= 63.999,
            'expanded VM/NIC footprints must retain a clear corridor between siblings')
        for (let i = 1; i < row.length; i++) {
            const previousRight = row[i - 1].x + probe.topologyLayoutCardWidth(row[i - 1]) / 2
            assert.ok(row[i].x - probe.topologyLayoutCardWidth(row[i]) / 2 - previousRight >= 23.999)
        }
    }
}

describe('VM row placement', () => {
    it('passes the retained Compact partition through real VM NIC expansion and collapse', () => {
        let previous: any
        let previousKey: string | undefined
        let rows: Map<string, number> | undefined
        for (const nics of [0, 1, 3, 0]) {
            const { root, probe, apply } = scene(30, undefined, false,
                nics ? { kind: 'user', index: 4, nics } : undefined)
            apply()
            probe.nodeTagActive = 'infrastructure'
            probe.props = { infrastructureVMLayout: 'compact' }
            probe.d3nodes = new Map(root.descendants().map((node: any) => [node.data.id, node]))
            const real = root.descendants().filter((node: any) => node.data.type !== 2)
            probe.nodes = new Map(real.map((node: any) => [node.data.id, node.data.wrapped]))
            real.forEach((node: any) => {
                let parent = node.parent
                while (parent && parent.data.type === 2) parent = parent.parent
                node.data.wrapped.parent = parent?.data.wrapped
            })
            const bridge = real.find((node: any) => node.data.id === 'host-a-bridge')
            const links = real.filter((node: any) => node.data.wrapped.data.Type === 'libvirt' && node.data.wrapped.getWeight() === 7080)
                .map((node: any) => ({ id: `${node.data.id}-traffic`, source: bridge.data.wrapped,
                    target: node.data.wrapped, data: { RelationType: 'layer2' } }))
            probe.links = new Map(links.map((link: any) => [link.id, link]))
            probe.visibleLinks = () => links
            probe.viewSize = () => ({ width: 1400, height: 900 })
            probe.infrastructureCompactPlan = previous
            probe.infrastructureCompactVMKey = previousKey
            probe.applyInfrastructureCompactLayout(root)
            const plan = probe.infrastructureCompactPlan
            assert.equal(plan.wrappedVMs, 30, `NIC count ${nics}: ${plan.reason}`)
            if (rows) assert.deepEqual(plan.vmRows, rows)
            else rows = new Map(plan.vmRows)
            assert.equal(plan.after.overlaps, 0)
            const owner = probe.d3nodes.get('host-a-user-4')
            const nic = probe.d3nodes.get('host-a-user-4-nic-0')
            if (nic) assert.ok(nic.y - probe.topologyLayoutCardHeight(nic) / 2 > owner.y + probe.topologyLayoutCardHeight(owner) / 2)
            const bundle = plan.bundles.find((unit: any) => unit.vmID === owner.data.id)
            assert.ok(bundle)
            if (nic) assert.ok(bundle.nodeIDs.includes(nic.data.id))
            previous = plan; previousKey = probe.infrastructureCompactVMKey
        }
    })
    it('integrates Compact with real flextree lanes, invisible hierarchy spacers and unchanged upper layers', () => {
        for (const count of [10, 30, 50]) {
            const { root, probe, apply } = scene(count)
            apply()
            probe.nodeTagActive = 'infrastructure'
            probe.props = { infrastructureVMLayout: 'compact' }
            probe.d3nodes = new Map(root.descendants().map((node: any) => [node.data.id, node]))
            const real = root.descendants().filter((node: any) => node.data.type !== 2)
            probe.nodes = new Map(real.map((node: any) => [node.data.id, node.data.wrapped]))
            const bridge = real.find((node: any) => node.data.id === 'host-a-bridge')
            const vms = real.filter((node: any) => node.data.id.startsWith('host-a-user-'))
            const links = vms.map((node: any) => ({ id: `${node.data.id}-traffic`, source: bridge.data.wrapped,
                target: node.data.wrapped, data: { RelationType: 'layer2' } }))
            probe.links = new Map(links.map((link: any) => [link.id, link]))
            probe.visibleLinks = () => links
            probe.viewSize = () => ({ width: 1400, height: 900 })
            const baseline = new Map(root.descendants().map((node: any) => [node.data.id, { x: node.x, y: node.y }]))
            const upper = real.filter((node: any) => node.data.wrapped.getWeight() < 7080).map((node: any) => [node.data.id, node.x, node.y])
            probe.applyInfrastructureCompactLayout(root)
            const plan = probe.infrastructureCompactPlan
            if (count >= 30) assert.equal(plan.wrappedVMs, count, `actual tree fallback: ${plan.reason}`)
            assert.deepEqual(real.filter((node: any) => node.data.wrapped.getWeight() < 7080).map((node: any) => [node.data.id, node.x, node.y]), upper)
            assert.equal(plan.after.overlaps, 0)
            if (plan.wrappedVMs) assert.ok(plan.routes.size >= links.length)
            // A collector refresh rebuilds the same flextree scene with new
            // counters. The actual component must reuse the routing plan.
            root.descendants().forEach((node: any) => Object.assign(node, baseline.get(node.data.id)))
            real.forEach((node: any) => { node.data.wrapped.data.CPUUsagePercent = 91; node.data.wrapped.state.selected = true })
            probe.applyInfrastructureCompactLayout(root)
            assert.strictEqual(probe.infrastructureCompactPlan, plan)
        }
    })
    it('preserves VM order and separates full NIC footprints when inherited-weight interfaces expand', () => {
        for (const count of [15, 30, 60]) {
            const closed = scene(count)
            closed.apply()
            const positions = new Map(closed.root.descendants()
                .filter((node: any) => node.data.type !== 2 && node.data.wrapped.data.Type === 'libvirt')
                .map((node: any) => [node.data.id, node.x]))
            for (const kind of ['system', 'router', 'user'] as const) {
                for (const [nics, grouped] of [[1, false], [3, false], [12, true]] as const) {
                    const opened = scene(count, undefined, false, { kind, index: kind === 'user' ? 4 : 0, nics, grouped })
                    opened.apply()
                    for (const weight of [7060, 7070, 7080]) {
                        const ids = (root: any) => root.descendants().filter((node: any) =>
                            positions.has(node.data.id) && node.data.wrapped.getWeight() === weight)
                            .sort((a: any, b: any) => a.x - b.x).map((node: any) => node.data.id)
                        assert.deepEqual(ids(opened.root), ids(closed.root))
                    }
                    opened.root.descendants().filter((node: any) => node.data.wrapped.data.Type === 'tun').forEach((node: any) => {
                        assert.equal(opened.probe.compactVmLayerKind(node), undefined)
                    })
                    assertCentered(opened.root, opened.probe, 'host-a')
                }
            }
        }
    })
    it('keeps cards, count badges and stacked groups inside separate lane guides with 15–60 VMs', () => {
        for (const count of [15, 30, 60]) {
            const { root, probe } = scene(count, 2)
            const visible = root.descendants().filter((node: any) => node.data.type !== 2)
            const weights = Array.from(new Set<number>(visible.map((node: any) => node.data.wrapped.getWeight()))).sort((a, b) => a - b)
            let previousBottom = -Infinity
            for (const weight of weights) {
                const lane = visible.filter((node: any) => node.data.wrapped.getWeight() === weight)
                const bounds = topologyLaneBounds(lane.map((node: any) => probe.topologyLaneItem(node)))
                assert.ok(bounds.top >= previousBottom)
                for (const node of lane) {
                    const item = probe.topologyLaneItem(node)
                    assert.ok(node.y - item.height / 2 - item.above > bounds.top)
                    assert.ok(node.y + item.height / 2 + item.below < bounds.bottom)
                }
                previousBottom = bounds.bottom
            }
            const positions = root.descendants().map((node: any) => [node.x, node.y])
            probe.separateTopologyLanes(root)
            assert.deepEqual(root.descendants().map((node: any) => [node.x, node.y]), positions)
        }
    })
    it('centers sparse system/router rows over 15, 30 and 60 expanded user VMs', () => {
        for (const count of [15, 30, 60]) {
            const { root, probe, apply } = scene(count)
            const before = root.descendants().map((n: any) => [n.data.id, n.y, n.parent?.data.id, n.data.wrapped.state.expanded])
            apply()
            assertCentered(root, probe, 'host-a')
            assert.deepEqual(root.descendants().map((n: any) => [n.data.id, n.y, n.parent?.data.id, n.data.wrapped.state.expanded]), before)
        }
    })
    it('keeps each host centered independently and separates unequal VM populations', () => {
        const { root, probe, apply } = scene(30, 2)
        apply()
        assertCentered(root, probe, 'host-a')
        assertCentered(root, probe, 'host-b')
        const hostA = root.descendants().find((n: any) => n.data.id === 'host-a')
        const hostB = root.descendants().find((n: any) => n.data.id === 'host-b')
        const a = probe.horizontalNodeBounds(probe.visibleHostSubtreeNodes(hostA))
        const b = probe.horizontalNodeBounds(probe.visibleHostSubtreeNodes(hostB))
        assert.ok(b.left - a.right >= 79.999)
    })
    it('uses the same center rule for collapsed groups and their expanded children', () => {
        for (const collapsed of [true, false]) {
            const { root, probe, apply } = scene(15, undefined, collapsed)
            apply()
            assertCentered(root, probe, 'host-a')
        }
    })
})
