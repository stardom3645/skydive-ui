import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { isCurrentKubernetesPod, isKubernetesPod } from '../src/KubernetesPodLifecycle'

// Exercise the actual visibility, selection and edge policy without mounting
// the whole React/SVG application or requiring a backend.
const source = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const topologyClass = ast.statements.filter(ts.isClassDeclaration).find(node => node.name?.text === 'Topology')!
const names = ['expand', 'collapse', 'expandAllNodes', 'setFullGroupDisplay', 'syncGroupDisplaySize', 'toggleGroupListNode', 'setGroupListNodes',
    'groupVisibleNodeIDs', 'selectNode', 'nodeByID', 'visibleNodeIDForID', 'isLinkVisible', 'isLinkNodeSelected',
    'linkOriginalSourceID', 'linkOriginalTargetID', 'linkDisplayOpacity']
const methods = topologyClass.members.filter(member => member.name && names.includes(member.name.getText(ast)))
    .map(member => member.getText(ast)).join('\n')

function probe(count = 50, manager = 'libvirt') {
    const context: any = { isCurrentKubernetesPod, isKubernetesPod,
        LinkTagState: { Hidden: 0, EventBased: 1, Visible: 2 },
        select: () => ({ classed: () => undefined, raise: () => undefined }) }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Topology { ${methods} }; this.Topology = Topology`,
        { target: ts.ScriptTarget.ES2018 }), context)
    const topology = new context.Topology()
    const children = Array.from({ length: count }, (_, index) => ({ id: `vm-${index}`, parent: null,
        data: { Type: manager === 'k8s' ? 'pod' : 'libvirt', Manager: manager,
            K8s: { Extra: { Status: { Phase: 'Running' } } } },
        state: { selected: false, expanded: false }, children: [] }))
    const group = { id: 'vm-group', children, state: { selected: true, expanded: false, groupFullSize: false, groupOffset: 0 } }
    let renders = 0
    Object.assign(topology, {
        props: {}, root: group, groups: new Map([[group.id, { wrapped: group }]]),
        nodes: new Map(children.map(child => [child.id, child])),
        groupStates: new Map([[group.id, group.state]]),
        nodeGroup: new Map(children.map(child => [child.id, { wrapped: group }])),
        selectedGroupListNodeIDs: new Set(), d3nodes: new Map(),
        linkTagStates: new Map([['layer2', context.LinkTagState.EventBased]]),
        hideNodeContextMenu: () => undefined, hideLinks: () => undefined,
        renderTree: () => { renders++ }, resetCacheAndRenderTree: () => { renders++ },
        unselectAllLinks: () => undefined, highlightNeighborLinks: () => undefined,
        syncContainerMiniCardActiveClass: () => undefined, syncContainerMiniLinkVisibility: () => undefined,
        updateLevelLabelActiveClass: () => undefined, activeContainerMiniNodeIDs: () => new Set(),
        isContainerProxyLink: () => false,
        unselectAllNodes: (except: string) => {
            const unselected = [...children, group].filter(node => node.id !== except && node.state.selected)
            unselected.forEach(node => { node.state.selected = false })
            return unselected
        }
    })
    const sourceNode = { id: 'bridge', state: { selected: false } }
    const links = children.map(child => ({ id: `edge-${child.id}`, source: sourceNode, target: child,
        tags: ['layer2'], data: {}, state: { selected: false } }))
    return { topology, children, group, links, renders: () => renders, modes: context.LinkTagState }
}

describe('Group visibility does not select its resources', () => {
    it('expands all 50 VMs while leaving related-only edges hidden', () => {
        const { topology, children, group, links, renders } = probe()
        topology.expand(group)
        assert.equal(group.state.expanded, true)
        assert.equal(group.state.groupFullSize, true)
        assert.equal(topology.groupVisibleNodeIDs().size, 50)
        assert.ok(children.every(child => !child.state.selected))
        assert.equal(group.state.selected, true)
        assert.ok(links.every(link => topology.linkDisplayOpacity(link) === 0))
        assert.equal(renders(), 1)
    })

    it('shows only the directly selected VM edges and retains explicit selection across expansion', () => {
        const { topology, children, group, links } = probe()
        topology.expand(group)
        children.forEach(child => topology.d3nodes.set(child.id, { data: { wrapped: child } }))
        topology.selectNode(children[17].id)
        assert.deepEqual(links.filter(link => topology.linkDisplayOpacity(link) > 0).map(link => link.id), ['edge-vm-17'])
        topology.expand(group) // collapse
        topology.expand(group) // expand again
        assert.equal(topology.groupVisibleNodeIDs().size, 50)
        assert.equal(children.filter(child => child.state.selected).length, 1)
        assert.equal(children[17].state.selected, true)
    })

    it('changes group-list visibility without selecting or unselecting any VM', () => {
        const { topology, children, group, links } = probe()
        topology.expand(group)
        topology.toggleGroupListNode(children[1])
        assert.equal(topology.groupVisibleNodeIDs().size, 49)
        assert.equal(group.state.groupFullSize, false)
        assert.ok(children.every(child => !child.state.selected))
        topology.setGroupListNodes(children, true)
        assert.equal(topology.groupVisibleNodeIDs().size, 50)
        assert.equal(group.state.groupFullSize, true)
        assert.ok(links.every(link => topology.linkDisplayOpacity(link) === 0))
        children[0].state.selected = true
        topology.setGroupListNodes(children, false)
        assert.equal(topology.groupVisibleNodeIDs().size, 0)
        assert.equal(children[0].state.selected, true)
    })

    it('keeps all-links mode and hidden-layer mode independent of group expansion', () => {
        const { topology, group, links, modes } = probe()
        topology.expand(group)
        topology.linkTagStates.set('layer2', modes.Visible)
        assert.ok(links.every(link => topology.linkDisplayOpacity(link) === 1))
        topology.linkTagStates.set('layer2', modes.Hidden)
        assert.ok(links.every(link => topology.linkDisplayOpacity(link) === 0))
    })

    it('also keeps expand-all from selecting resources or enabling all their edges', () => {
        const { topology, children, links } = probe()
        topology.expandAllNodes()
        assert.equal(topology.groupVisibleNodeIDs().size, 50)
        assert.ok(children.every(child => child.state.expanded && !child.state.selected))
        assert.ok(links.every(link => topology.linkDisplayOpacity(link) === 0))
    })

    it('retains the existing Kubernetes exclusion of completed Pods', () => {
        const { topology, children, group } = probe(3, 'k8s')
        children[1].data.K8s.Extra.Status.Phase = 'Succeeded'
        topology.expand(group)
        assert.deepEqual(Array.from(topology.groupVisibleNodeIDs()).sort(), ['vm-0', 'vm-2'])
        assert.ok(children.every(child => !child.state.selected))
    })
})
