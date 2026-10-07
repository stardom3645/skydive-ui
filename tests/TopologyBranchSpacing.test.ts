import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyBranchOffsets } from '../src/TopologyBranchSpacing'
import { topologyGroupRegions, TOPOLOGY_GROUP_TONE_LIGHTNESS, TopologyRegionNode } from '../src/TopologyGroupRegions'
import { kubernetesTopologyNodeText, isKubernetesStorageType } from '../src/KubernetesTopologyNodePresentation'
import { topologyCardDimensions } from '../src/TopologyNodePresentation'

const card = (id: string, parentID: string | undefined, x: number, width = 360): TopologyRegionNode => ({
    id, parentID, x, width, y: parentID ? 400 : 0, height: 108, visible: true, expanded: true
})

describe('Topology branch separation', () => {
    it('keeps already-separated cluster branches at their existing positions', () => {
        const offsets = topologyBranchOffsets([card('a', undefined, 0), card('a-pvc', 'a', 100), card('b', undefined, 800), card('b-pvc', 'b', 900)])
        assert.strictEqual(offsets.get('a'), 0)
        assert.strictEqual(offsets.get('b'), 0)
    })

    it('separates overlapping cluster extents, including descendants in different rows', () => {
        const nodes = [card('a', undefined, 0), card('a-pvc', 'a', 500), card('b', undefined, 400), card('b-pvc', 'b', 200)]
        const before = JSON.stringify(nodes)
        const offsets = topologyBranchOffsets(nodes)
        const rightA = Math.max(...nodes.filter(n => n.id === 'a' || n.parentID === 'a').map(n => n.x + n.width / 2 + offsets.get('a')!))
        const leftB = Math.min(...nodes.filter(n => n.id === 'b' || n.parentID === 'b').map(n => n.x - n.width / 2 + offsets.get('b')!))
        assert.strictEqual(leftB - rightA, 80)
        assert.strictEqual(JSON.stringify(nodes), before)
    })

    it('protects a collapsed neighboring root and invisible layout spacers', () => {
        const nodes = [card('a', undefined, 0), { ...card('spacer', 'a', -9000), visible: false }, card('leaf', 'spacer', 200), { ...card('b', undefined, 300), expanded: false }]
        const offsets = topologyBranchOffsets(nodes)
        assert.strictEqual((300 - 180 + offsets.get('b')!) - (0 + 180 + offsets.get('a')!), 80)
        assert.ok(Math.abs(offsets.get('a')!) < 1000)
    })

    it('separates the curved contours without reserving empty rectangular lanes', () => {
        const nodes = [card('a', undefined, 0), card('a-pvc', 'a', 600), card('b', undefined, 600), card('b-pvc', 'b', 700)]
        const offsets = topologyBranchOffsets(nodes)
        const distance = offsets.get('b')! - offsets.get('a')!
        // The conservative interval bounds add less than two pixels here;
        // a full rectangular lane would require 440 instead.
        assert.ok(distance >= 340 && distance < 342)
        // Matching row heights give both cubic sides the same interpolation.
        // Their unpadded gap remains >= 80, leaving 48 between padded shades.
        for (let i = 0; i <= 100; i++) {
            const t = i / 100, blend = t * t * (3 - 2 * t)
            const rightA = 180 + 600 * blend + offsets.get('a')!
            const leftB = 420 + 100 * blend + offsets.get('b')!
            assert.ok(leftB - rightA >= 80)
        }
    })

    it('cascades separation across three hosts and is stable after applying the offsets', () => {
        const nodes = [card('h1', undefined, 0, 700), card('h2', undefined, 300, 800), card('h3', undefined, 600, 360)]
        const offsets = topologyBranchOffsets(nodes)
        const separated = nodes.map(n => ({ ...n, x: n.x + offsets.get(n.id)! }))
        for (let i = 1; i < separated.length; i++) assert.ok(separated[i].x - separated[i].width / 2 - separated[i - 1].x - separated[i - 1].width / 2 >= 80)
        topologyBranchOffsets(separated).forEach(delta => assert.strictEqual(delta, 0))
    })

    it('gives adjacent groups different shade intensity even when IDs hash to the same tone', () => {
        const nodes: TopologyRegionNode[] = []
        for (let i = 0; i < 20; i++) nodes.push(card('cluster-'+i, undefined, i * 1000), card('pvc-'+i, 'cluster-'+i, i * 1000))
        const regions = topologyGroupRegions(nodes)
        for (let i = 1; i < regions.length; i++) assert.ok(Math.abs(TOPOLOGY_GROUP_TONE_LIGHTNESS[regions[i].variant] - TOPOLOGY_GROUP_TONE_LIGHTNESS[regions[i - 1].variant]) >= 8)
        assert.deepStrictEqual(topologyGroupRegions([...nodes].reverse()).map(n => [n.id, n.variant]), regions.map(n => [n.id, n.variant]))
    })
})

function measurementProbe() {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
    const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const component = ast.statements.find(n => ts.isClassDeclaration(n) && n.name!.text === 'Topology') as ts.ClassDeclaration
    const names = ['topologyNodeDisplayName', 'topologyGroupCardScope', 'topologyKubernetesNamespace', 'topologyLayoutCardWidth']
    const methods = component.members.filter(n => n.name && names.includes(n.name.getText(ast))).map(n => n.getText(ast)).join('\n')
    const context: any = { kubernetesTopologyNodeText, isKubernetesStorageType, topologyCardDimensions, WrapperType: { Group: 3 } }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${methods} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
    const probe = new context.Probe()
    probe.props = { nodeAttrs: (n: any) => ({ name: n.data.Name }) }
    return probe
}

describe('Topology card layout measurement', () => {
    it('keeps a long PVC context in the compact card tier', () => {
        const probe = measurementProbe()
        const pvc = { data: { type: 1, wrapped: { data: { Name: 'redis-data', Manager: 'k8s', Type: 'persistentvolumeclaim', K8s: { Namespace: 'namespace-with-long-context' } } } } }
        assert.strictEqual(probe.topologyLayoutCardWidth(pvc), topologyCardDimensions(pvc.data.wrapped as any).width)
    })

    it('reserves a group card scope without changing the displayed name', () => {
        const probe = measurementProbe()
        const group = { data: { type: 3, wrapped: { data: { Name: '노드 그룹', Manager: 'k8s', GroupScopeLabel: 'k8s-lifecycle31-v13412-long-cluster' } } } }
        assert.strictEqual(probe.topologyNodeDisplayName(group), '노드 그룹\nk8s-lifecycle31-v13412-long-cluster')
        assert.strictEqual(probe.topologyLayoutCardWidth(group), topologyCardDimensions(group.data.wrapped as any, true).width)
    })
})
