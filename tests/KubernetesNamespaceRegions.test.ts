import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as ts from 'typescript'
import * as vm from 'vm'
import { kubernetesNamespaceOffsets, kubernetesNamespaceRegions, KubernetesNamespaceRegionNode } from '../src/KubernetesNamespaceRegions'

const node = (id: string, type: string, parentID?: string, extra: Partial<KubernetesNamespaceRegionNode> = {}): KubernetesNamespaceRegionNode => ({
    id, resourceID: id, type, parentID, manager: 'k8s', name: id, visible: true, expanded: true,
    x: 0, y: 0, width: 300, height: 180, above: 40, ...extra
})
const packed = (nodes: KubernetesNamespaceRegionNode[]) => {
    const offsets = kubernetesNamespaceOffsets(nodes)
    return nodes.map(node => ({ ...node, x: node.x + (offsets.get(node.id) || 0) }))
}

describe('Kubernetes namespace ownership surfaces', () => {
    it('keeps workloads, Pods and their group proxies in one namespace through hidden spacers, excluding Nodes and unscoped resources', () => {
        const nodes = [node('cluster', 'cluster'), node('worker', 'node', 'cluster'),
            node('ns', 'namespace', 'cluster', { name: 'kube-system', y: 400 }),
            node('spacer', 'namespace', 'ns', { visible: false, resourceID: 'ns', y: 600, x: -10000 }),
            node('workload-group', 'deployment', 'spacer', { group: true, namespace: 'kube-system', y: 800 }),
            node('workload', 'deployment', 'workload-group', { namespace: 'kube-system', y: 800, x: 400 }),
            node('pod', 'pod', 'workload', { namespace: 'kube-system', y: 1200 }),
            node('other-pod', 'pod', 'worker', { namespace: 'another-namespace', y: 1200 }),
            node('pvc', 'persistentvolumeclaim', 'ns', { namespace: 'kube-system', y: 1600 })]
        const before = JSON.stringify(nodes), regions = kubernetesNamespaceRegions(nodes)
        assert.equal(regions.length, 1)
        assert.deepEqual(regions[0].nodeIDs, ['ns', 'workload-group', 'workload', 'pod'])
        assert.equal(regions[0].clusterID, 'cluster')
        assert.ok(regions[0].bounds.left > -1000)
        assert.equal(JSON.stringify(nodes), before)
    })
    it('packs full occupied namespace branches without overlapping, retaining workload/Pod alignment, levels and graph identities', () => {
        const nodes = [node('cluster', 'cluster'), node('worker', 'node', 'cluster', { y: 200 }),
            node('a', 'namespace', 'cluster', { y: 400 }), node('b', 'namespace', 'cluster', { x: 400, y: 400 }),
            node('a-workload-1', 'deployment', 'a', { x: -300, y: 800 }), node('a-workload-2', 'deployment', 'a', { x: 300, y: 800 }),
            node('a-pod', 'pod', 'a-workload-1', { x: -300, y: 1200 }), node('b-workload', 'deployment', 'b', { x: 200, y: 800 })]
        const before = JSON.stringify(nodes), offsets = kubernetesNamespaceOffsets(nodes), placed = packed(nodes)
        const regions = kubernetesNamespaceRegions(placed)
        assert.equal(regions.length, 2)
        assert.ok(regions[1].bounds.left - regions[0].bounds.right >= 36)
        assert.equal(offsets.get('a-workload-1'), offsets.get('a-workload-2'))
        assert.equal(offsets.get('a-pod'), offsets.get('a-workload-1'))
        assert.equal(offsets.has('worker'), false)
        for (const region of regions) for (const id of region.nodeIDs) {
            const n = placed.find(n => n.id === id)!
            assert.ok(n.x - n.width / 2 >= region.bounds.left && n.x + n.width / 2 <= region.bounds.right)
            assert.ok(n.y - n.height / 2 - (n.above || 0) >= region.bounds.top)
            assert.ok(n.y + n.height / 2 + (n.below || 0) <= region.bounds.bottom)
        }
        assert.deepEqual(placed.map(n => [n.id, n.parentID, n.y]), nodes.map(n => [n.id, n.parentID, n.y]))
        assert.equal(JSON.stringify(nodes), before)
    })
    it('does not mix identically named namespaces across clusters, and accepts only a unique scoped metadata fallback', () => {
        const nodes = [node('cluster-a', 'cluster'), node('cluster-b', 'cluster'),
            node('ns-a', 'namespace', 'cluster-a', { name: 'default', y: 400 }), node('ns-b', 'namespace', 'cluster-b', { name: 'default', y: 400 }),
            node('worker-a', 'node', 'cluster-a'), node('pod-a', 'pod', 'worker-a', { namespace: 'default', y: 1200 }),
            node('pod-b', 'pod', 'cluster-b', { namespace: 'default', y: 1200 }), node('unknown', 'pod', undefined, { namespace: 'default', y: 1200 })]
        const regions = kubernetesNamespaceRegions(nodes)
        assert.deepEqual(regions[0].nodeIDs, ['ns-a', 'pod-a'])
        assert.deepEqual(regions[1].nodeIDs, ['ns-b', 'pod-b'])
    })
    it('reserves the retained namespace group beside expanded members without including it in their surfaces', () => {
        const nodes = [node('cluster', 'cluster'),
            node('namespace-group', 'namespace', 'cluster', { group: true, x: -300, y: 400, width: 330 }),
            node('a', 'namespace', 'cluster', { x: -200, y: 400 }),
            node('b', 'namespace', 'cluster', { x: 200, y: 400 }),
            node('workload', 'deployment', 'a', { x: -400, y: 800 }),
            node('pod', 'pod', 'workload', { x: -400, y: 1200 })]
        const placed = packed(nodes), group = placed.find(n => n.id === 'namespace-group')!
        const regions = kubernetesNamespaceRegions(placed)
        assert.equal(regions.length, 2)
        assert.ok(regions[0].bounds.left - (group.x + group.width / 2 + 24) >= 36)
        assert.ok(regions[1].bounds.left - regions[0].bounds.right >= 36)
        assert.ok(regions.every(region => !region.nodeIDs.includes(group.id)))
        assert.deepEqual(kubernetesNamespaceOffsets(nodes.slice(0, 2)), new Map())
    })
    it('shrinks on collapse, encloses empty namespaces and never creates a namespace region for a synthetic namespace group', () => {
        const root = node('ns', 'namespace', 'cluster', { y: 400 })
        const cluster = node('cluster', 'cluster'), pod = node('pod', 'pod', 'ns', { y: 1200 })
        const expanded = kubernetesNamespaceRegions([cluster, root, pod])[0]
        const collapsed = kubernetesNamespaceRegions([cluster, { ...root, expanded: false }])[0]
        assert.ok(collapsed.bounds.bottom < expanded.bounds.bottom)
        assert.deepEqual(collapsed.nodeIDs, ['ns'])
        assert.deepEqual(kubernetesNamespaceRegions([cluster, { ...root, group: true }]), [])
        assert.deepEqual(kubernetesNamespaceRegions([{ ...root, manager: 'fabric' }]), [])
        assert.deepEqual(kubernetesNamespaceOffsets([{ ...root, manager: 'fabric' }]), new Map())
    })
    it('skips invalid bounds and empty data', () => {
        assert.deepEqual(kubernetesNamespaceRegions([]), [])
        assert.deepEqual(kubernetesNamespaceRegions([node('bad', 'namespace', undefined, { x: NaN })]), [])
    })
})

describe('Namespace packing layer guard', () => {
    it('leaves Infrastructure untouched and applies only x offsets on Kubernetes', () => {
        const source = fs.readFileSync(require('path').resolve(__dirname, '../src/Topology.tsx'), 'utf8')
        const ast = ts.createSourceFile('Topology.tsx', source, ts.ScriptTarget.Latest, true)
        const component = ast.statements.find(s => ts.isClassDeclaration(s) && s.name?.text === 'Topology') as ts.ClassDeclaration
        const method = component.members.find(s => s.name?.getText(ast) === 'layoutKubernetesNamespaces')!
        const context: any = { kubernetesNamespaceOffsets }
        vm.createContext(context)
        vm.runInContext(ts.transpile(`class Probe { ${method.getText(ast)} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
        const probe = new context.Probe(), d3 = { data: { id: 'ns' }, x: 123, y: 456 }
        probe.nodeTagActive = 'Infrastructure'
        probe.namespaceRegionNodes = () => { throw new Error('must not inspect Infrastructure nodes') }
        probe.layoutKubernetesNamespaces({ descendants: () => [d3] })
        assert.deepEqual(d3, { data: { id: 'ns' }, x: 123, y: 456 })
        probe.nodeTagActive = 'Kubernetes'
        probe.namespaceRegionNodes = () => [node('cluster', 'cluster'), node('ns', 'namespace', 'cluster', { x: 123, y: 456 })]
        probe.layoutKubernetesNamespaces({ descendants: () => [d3] })
        assert.equal(d3.y, 456)
    })
})
