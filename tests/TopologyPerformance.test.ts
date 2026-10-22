import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyResourceMetrics, createTopologyResourceMetricsIndex } from '../src/TopologyResourceMetrics'

const node = (id: string, type: string, parent?: any): any => {
    const value: any = { id, parent: parent || null, children: [], state: {}, data: { Name: id, Type: type, Manager: 'k8s',
        K8s: { Namespace: 'app', Extra: { ObjectMeta: { UID: id }, Status: { Phase: 'Running' } } } } }
    if (parent) { parent.children.push(value)
        value.data.K8s.Extra.ObjectMeta.OwnerReferences = [{ UID: parent.id, Name: parent.id, Kind: parent.data.Type, Controller: true }] }
    return value
}
function probe(names: string[], context: any = {}) {
    const file = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
    const ast = ts.createSourceFile('Topology.tsx', file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const component = ast.statements.filter(ts.isClassDeclaration).find(value => value.name?.text === 'Topology')!
    const source = component.members.filter(member => member.name && names.includes(member.name.getText(ast)))
        .map(member => member.getText(ast)).join('\n')
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${source} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
    return new context.Probe()
}

describe('Topology performance invariants', () => {
    it('does not traverse graph resources for unavailable measurements or a single Pod', () => {
        const graph: any = { filter: () => { throw new Error('unnecessary graph scan') } }
        const pod = node('api', 'pod')
        assert.deepEqual(topologyResourceMetrics(pod, {}, graph).map(item => item.value), ['미수집', '미수집'])
        assert.deepEqual(topologyResourceMetrics(node('app', 'namespace'), {}, graph), [])
        const summary = { resources: { podUsage: [{ namespace: 'app', name: 'api', usageCpuCores: .5, usageMemoryBytes: 1048576 }] } }
        assert.deepEqual(topologyResourceMetrics(pod, { summary }, graph).map(item => item.value), ['500m', '1MiB'])
    })

    it('preserves collected metrics, cluster boundaries, incomplete totals and duplicate-record precedence', () => {
        const a = node('a', 'cluster'), b = node('b', 'cluster')
        const ns = node('app', 'namespace', a), other = node('app', 'namespace', b)
        const workloads = ['deployment', 'daemonset', 'statefulset', 'job', 'cronjob'].map(type => node(type, type, ns))
        const pods = workloads.map(workload => node(`pod-${workload.id}`, 'pod', workload))
        const duplicate = node(pods[0].id, 'pod', node('another', 'deployment', other))
        const all = [a, b, ns, other, ...workloads, ...pods, duplicate.parent, duplicate]
        const records = pods.map(pod => ({ namespace: 'app', name: pod.id, usageCpuCores: .25, usageMemoryBytes: 1048576 }))
        records.push({ ...records[0], usageCpuCores: 99 })
        for (const usage of [records, records.slice(1), []]) {
            const snapshot = { summary: { resources: { podUsage: usage } } }
            const index = createTopologyResourceMetricsIndex(all)
            for (const resource of [...workloads, ...pods, ns, other, duplicate])
                assert.deepEqual(topologyResourceMetrics(resource, snapshot, all, index), topologyResourceMetrics(resource, snapshot, all))
        }
        const record = records[0]
        record.usageCpuCores = .75
        pods[1].data.K8s.Extra.Status.Phase = 'Succeeded'
        const snapshot = { summary: { resources: { podUsage: records } } }
        const next = createTopologyResourceMetricsIndex(all)
        for (const resource of [...workloads, ...pods, ns])
            assert.deepEqual(topologyResourceMetrics(resource, snapshot, all, next), topologyResourceMetrics(resource, snapshot, all))
    })

    it('measures card dimensions once per rendered node, invalidating on a new layout', () => {
        let measures = 0
        const graph = probe(['topologyLayoutCardWidth', 'topologyLayoutCardHeight'], {
            WrapperType: { Group: 3 }, topologyCardDimensions: () => { measures++; return { width: 440, height: 340 } }
        })
        Object.assign(graph, { cardWidthCache: new WeakMap(), cardHeightCache: new WeakMap(), layerCardLayouts: new Map(),
            topologyNodeDisplayName: () => 'name', topologyCardNetworkSummary: () => '' })
        const rendered = { data: { id: 'a', type: 1, wrapped: node('a', 'pod') } }
        for (let i = 0; i < 1000; i++) {
            assert.equal(graph.topologyLayoutCardWidth(rendered), 440)
            assert.equal(graph.topologyLayoutCardHeight(rendered), 340)
        }
        assert.equal(measures, 2)
        graph.cardWidthCache = new WeakMap(); graph.cardHeightCache = new WeakMap()
        graph.topologyLayoutCardWidth(rendered); graph.topologyLayoutCardHeight(rendered)
        assert.equal(measures, 4)
    })

    it('coalesces card updates without a layout, region, line or redundant API-plan pass', () => {
        const queued: (() => void)[] = [], renders: any[] = []
        const graph = probe(['refreshResourceCards', 'deferProblemViewportRender'], { window: { setTimeout: (fn: () => void) => { queued.push(fn); return queued.length } } })
        let plans = 0
        Object.assign(graph, { d3nodes: new Map([['root', {}]]), gNodes: {},
            syncResourceData: () => plans++, renderNodes: (...args: any[]) => renders.push(args),
            refreshTopologyNodeFocus: () => undefined, applyTopologyNodeFocus: () => undefined, syncTopologyRelationEmphasis: () => undefined })
        for (let i = 0; i < 100; i++) graph.refreshResourceCards()
        assert.equal(queued.length, 1)
        queued[0]()
        assert.equal(plans, 0, 'request dependencies are replanned by the response owner before painting')
        assert.equal(renders.length, 1)
        assert.equal(renders[0][1], true)
    })
})

    describe('Kubernetes metric capability relayout', () => {
        it('relayouts once per capability change, while value refreshes keep the fast content-only path', () => {
            const queued: (() => void)[] = []
            const graph = probe(['refreshResourceCards', 'deferProblemViewportRender'], { window: { setTimeout: (fn: () => void) => { queued.push(fn); return queued.length } } })
            let signature = 'pod:0', layouts = 0, paints = 0
            Object.assign(graph, { nodeTagActive: 'kubernetes', kubernetesMetricLayoutKey: signature,
                d3nodes: new Map([['root', {}]]), gNodes: {}, createResourceMetricsIndex: () => ({}),
                kubernetesMetricsLayoutSignature: () => signature,
                renderTree: () => { layouts++; graph.kubernetesMetricLayoutKey = signature },
                renderNodes: () => paints++, refreshTopologyNodeFocus: () => undefined,
                applyTopologyNodeFocus: () => undefined, syncTopologyRelationEmphasis: () => undefined,
                zoomFitAfterRender: () => { throw new Error('metric relayout must not reset the viewport') } })
            const refresh = () => { for (let i = 0; i < 100; i++) graph.refreshResourceCards(); queued.shift()!() }
            refresh()
            assert.deepEqual([layouts, paints], [0, 1])
            signature = 'pod:1'
            refresh()
            assert.deepEqual([layouts, paints], [1, 1])
            refresh()
            assert.deepEqual([layouts, paints], [1, 2], 'new usage values must not recalculate layout')
            signature = 'pod:0'
            refresh()
            assert.deepEqual([layouts, paints], [2, 2], 'loss of capability also shrinks layout once')
        })
    })
