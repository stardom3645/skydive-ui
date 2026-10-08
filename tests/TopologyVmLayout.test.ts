import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyCardDimensions, topologyGroupFullyExpanded } from '../src/TopologyNodePresentation'
import { topologyBranchOffsets } from '../src/TopologyBranchSpacing'

// Run the production placement methods against real hierarchy/flextree output,
// including the invisible wrappers used to align topology layers.
const { hierarchy } = require('d3-hierarchy')
const { flextree } = require('d3-flextree')
const file = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
const ast = ts.createSourceFile('Topology.tsx', file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const component = ast.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'Topology') as ts.ClassDeclaration
const names = ['compactVmLayerKind', 'compactVmLayerLayout', 'shiftHierarchySubtreeX', 'topologyLayoutCardWidth',
    'topologyLayoutCardHeight', 'compactHostSubtreeLayout', 'isHostSubtreeRoot', 'visibleHostSubtreeNodes',
    'horizontalNodeBounds', 'separateTopologyBranches']
const methods = component.members.filter(n => n.name && names.includes(n.name.getText(ast))).map(n => n.getText(ast)).join('\n')
const stackOffset = ast.statements.filter(ts.isVariableStatement).find(statement =>
    statement.declarationList.declarations.some(declaration => declaration.name.getText(ast) === 'topologyGroupStackOffset'))!.getText(ast)
const context: any = { topologyCardDimensions, topologyGroupFullyExpanded, topologyBranchOffsets,
    compactVmNodeGap: 24, compactVmGroupGap: 64, compactHostSubtreeGap: 80,
    WrapperType: { Normal: 1, Hidden: 2, Group: 3 } }
vm.createContext(context)
vm.runInContext(ts.transpile(`${stackOffset}\nclass Probe { ${methods} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)

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
function scene(count: number, secondCount?: number, collapsed = false) {
    const wrapped = wrapper('root', 0, 2, [branch('host-a', count, collapsed), ...(secondCount === undefined ? [] : [branch('host-b', secondCount)])])
    const root = hierarchy(wrapped), probe = new context.Probe()
    probe.root = wrapped.wrapped
    probe.weightTitles = new Map() // Classification must not depend on translated labels.
    root.each((node: any) => {
        if (node.data.type !== 2) node.data.size[0] = probe.topologyLayoutCardWidth(node) + 44
    })
    flextree()(root)
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
        const row = nodes.filter((n: any) => n.data.id.startsWith(id) && n.data.wrapped.getWeight() === weight)
        const bounds = probe.horizontalNodeBounds(row)
        assert.ok(Math.abs((bounds.left + bounds.right) / 2 - parent.x) < 0.001, `layer ${weight} shifted away from its parent`)
        for (let i = 1; i < row.length; i++) {
            const previousRight = row[i - 1].x + probe.topologyLayoutCardWidth(row[i - 1]) / 2
            assert.ok(row[i].x - probe.topologyLayoutCardWidth(row[i]) / 2 - previousRight >= 23.999)
        }
    }
}

describe('VM row placement', () => {
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
