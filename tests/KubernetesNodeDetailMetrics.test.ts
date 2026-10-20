import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyResourceMetrics } from '../src/TopologyResourceMetrics'
import { kubernetesQuantityText } from '../src/DataPanels/common/kubernetesQuantity'

const ast = ts.createSourceFile('NodePanel.tsx', fs.readFileSync(path.resolve(__dirname,
    '../src/DataPanels/KubernetesNodeDetailPanel.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const component = ast.statements.filter(ts.isClassDeclaration).find(item => item.name?.text === 'KubernetesNodeDetailPanel')!
const names = ['bindNodeResources', 'syncNodeResources', 'nodeMetricSnapshot', 'renderCapacity', 'resourceUsageDescription', 'renderResourceTrend', 'componentWillUnmount']
const methods = component.members.filter(item => item.name && names.includes(item.name.getText(ast))).map(item => item.getText(ast)).join('\n')
const helpers = ast.statements.filter(ts.isVariableStatement).filter(item =>
    ['quantity', 'formatCapacityCpu', 'formatCapacityMemory', 'utilization'].includes(item.declarationList.declarations[0].name.getText(ast)))
    .map(item => item.getText(ast)).join('\n')
const node = (id = 'node'): any => ({ id, children: [], state: {}, data: { Type: 'node', Manager: 'k8s', Name: id,
    K8s: { Extra: { Status: { Capacity: { cpu: '4', memory: '8Gi', pods: '110' },
        Allocatable: { cpu: '4', memory: '7Gi', pods: '110' } } } } } })
const nodeVM = { uuid: 'dcced222-bc4e-4d62-bf58-163f84c8db9e', domain: 'i-21-199-VM', matchedBy: 'ProviderID · SystemUUID' }
const wall = (cpu: any = 0, memory: any = 48.5, timestamp = Date.now() / 1000) => ({ series: [
    { key: 'cpu', lastValue: cpu, timestamp }, { key: 'memory', lastValue: memory, timestamp }
] })
function probe(initial: any = {}) {
    let snapshot = initial, updates = 0
    const listeners = new Set<() => void>()
    const context: any = { React: { createElement: (type: any, props: any, ...children: any[]) => ({ type, props: props || {}, children }) },
        translate: (key: string) => key === 'kubernetesMemory' ? '메모리' : key,
        topologyResourceMetrics, kubernetesQuantityText, CompactEmptyState: 'empty', ResourceUsageMetrics: 'metrics', HostResourceTrendPanel: 'trend', Divider: 'divider', Progress: 'progress', Space: 'space', AppstoreOutlined: 'pods',
        KUBERNETES_UTILIZATION_THRESHOLDS: { warning: 75, danger: 90 }, RESOURCE_PRESENTATION_COLORS: { primary: '#1677ff' } }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`${helpers}\nclass Probe { ${methods} }; this.Probe = Probe`,
        { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
    const panel = new context.Probe()
    panel.detailRefresh = { stop: () => { panel.refreshStopped = true } }
    panel.props = { node: node(), nodeResourceSource: { nodeResourceSnapshot: () => snapshot,
        subscribeNodeResources: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) } } }
    panel.state = { requestKey: 'cluster:node' }
    panel.cluster = () => ({ id: 'cluster' })
    panel.uid = () => panel.props.node.id
    panel.detailFromTopology = () => ({ capacity: panel.props.node.data.K8s.Extra.Status.Capacity,
        allocatable: panel.props.node.data.K8s.Extra.Status.Allocatable })
    panel.setState = (state: any) => { updates++; Object.assign(panel.state, state) }
    panel.bindNodeResources()
    return { panel, listeners, updates: () => updates,
        publish: (value: any) => { snapshot = value; listeners.forEach(listener => listener()) } }
}
function find(tree: any, type: string): any[] {
    if (Array.isArray(tree)) return ([] as any[]).concat(...tree.map(item => find(item, type)))
    if (!tree || typeof tree !== 'object') return []
    return (tree.type === type ? [tree] : []).concat(find(tree.children, type))
}
function text(tree: any): string {
    if (Array.isArray(tree)) return tree.map(text).join(' ')
    return tree && typeof tree === 'object' ? text(tree.children) : String(tree ?? '')
}
const rows = (panel: any) => {
    const tree = panel.renderCapacity(3)
    const metrics = find(tree, 'metrics')[0].props
    return ['cpu', 'memory'].map(key => ({ key, rows: [
        { value: metrics[key].value, progressPercent: metrics[key].percent, unavailable: metrics[key].value === '미수집' },
        { value: text(metrics[key].capacity) }
    ] })).concat([{ key: 'pods', rows: [{ value: text(find(tree, 'strong')[0]), progressPercent: undefined, unavailable: false }, { value: '' }] }])
}

describe('Kubernetes Node detail shares card measurements', () => {
    it('renders the exact card percentages, including zero, without converting VM percentages into Kubernetes usage amounts', () => {
        const { panel } = probe({ nodeVM, wall: wall() })
        const result = rows(panel)
        assert.deepEqual(result.slice(0, 2).map(item => item.rows[0].value), topologyResourceMetrics(panel.props.node, panel.nodeMetricSnapshot()).map(item => item.value))
        assert.equal(result[0].rows[0].value, '0%')
        assert.equal(result[0].rows[0].unavailable, false)
        assert.equal(result[0].rows[0].progressPercent, 0)
        assert.equal(result[1].rows[0].value, '48.5%')
        assert.ok(result[0].rows[1].value.includes('할당 가능  4 Core'))
        assert.ok(result[1].rows[1].value.includes('할당 가능  7 GiB'))
        assert.equal(result[2].rows[0].value.replace(/\s+/g, ' '), '3 / 110')
        const description = text(panel.resourceUsageDescription())
        assert.ok(description.includes('Wall') && description.includes('Kubernetes'))
        assert.ok(!/libvirt|ProviderID|UUID/.test(description) && !description.includes(nodeVM.uuid))
        assert.ok(result[1].rows[1].value.includes('전체 용량  8 GiB'))
        assert.ok(!text(panel.renderCapacity(3)).includes('Wall'))
    })
    it('keeps per-resource Kubernetes priority and uses the card snapshot ahead of a separate panel response', () => {
        const { panel } = probe({ nodeVM, wall: wall(75, 60), detail: { usage: { cpu: '0' } } })
        panel.state.detail = { usage: { cpu: '1', memory: '5Gi' } }
        const result = rows(panel)
        assert.equal(result[0].rows[0].value, '0%')
        assert.equal(result[1].rows[0].value, '60%')
        const description = text(panel.resourceUsageDescription())
        assert.ok(/CPU\s*:\s*Kubernetes/.test(description) && /메모리\s*:\s*Wall/.test(description))
    })
    it('does not fabricate a usage rate without a denominator or discard valid native quantities', () => {
        const { panel } = probe({ nodeVM, wall: wall(80, 60), detail: { usage: { cpu: '20m', memory: '1Gi' } } })
        panel.props.node.data.K8s.Extra.Status = {}
        const result = rows(panel)
        assert.equal(result[0].rows[0].value, '20m')
        assert.equal(result[0].rows[0].progressPercent, undefined)
        assert.ok(text(panel.resourceUsageDescription()).includes('Kubernetes에서 수집한 노드 사용량'))
    })
    it('retains API capacities and Pod limits while the topology provides wrapped Kubernetes quantities', () => {
        const { panel } = probe({ nodeVM, wall: wall() })
        panel.props.node.data.K8s.Extra.Status.Allocatable = { cpu: { String: '4' }, memory: { Value: '7Gi' }, pods: { string: '110' } }
        const result = rows(panel)
        assert.ok(result[0].rows[1].value.includes('할당 가능  4 Core'))
        assert.ok(result[1].rows[1].value.includes('할당 가능  7 GiB'))
        assert.equal(result[2].rows[0].value.replace(/\s+/g, ' '), '3 / 110')
        assert.ok(!text(panel.renderCapacity(3)).includes('[object Object]'))
    })
    it('shows missing measurements while retaining Node API allocatable resources for stale or unverified VM samples', () => {
        for (const snapshot of [{ wall: wall() }, { nodeVM, wall: wall(10, 20, Date.now() / 1000 - 600) },
            { nodeVM, wall: wall(null, false) }]) {
            const { panel } = probe(snapshot)
            const result = rows(panel)
            assert.equal(result[0].rows[0].value, '미수집')
            assert.equal(result[0].rows[0].progressPercent, undefined)
            assert.equal(result[1].rows[0].value, '미수집')
            assert.ok(result[0].rows[1].value.includes('할당 가능  4 Core'))
        }
    })
    it('only requests matched VM history for resources currently using VM measurements', () => {
        const { panel, publish } = probe({ nodeVM, wall: wall() })
        let trend = panel.renderResourceTrend()
        assert.deepEqual(Array.from(trend.props.usageTrendOnly.keys), ['cpu', 'memory'])
        assert.equal(trend.props.data.UUID, nodeVM.uuid)
        assert.equal(trend.props.data.Name, nodeVM.domain)
        publish({ nodeVM, wall: wall(), detail: { usage: { cpu: '0' } } })
        trend = panel.renderResourceTrend()
        assert.deepEqual(Array.from(trend.props.usageTrendOnly.keys), ['memory'])
        publish({ nodeVM, wall: wall(), detail: { usage: { cpu: '0', memory: '0' } } })
        assert.equal(panel.renderResourceTrend(), null)
        publish({ wall: wall() })
        assert.equal(panel.renderResourceTrend(), null)
        publish({ nodeVM, wall: wall(10, 20, Date.now() / 1000 - 600) })
        assert.equal(panel.renderResourceTrend(), null)
    })
    it('updates the panel when the existing cache settles and refreshes, without rerendering for unrelated responses', () => {
        const { panel, publish, updates, listeners } = probe()
        assert.equal(rows(panel)[0].rows[0].value, '미수집')
        const snapshot = { nodeVM, wall: wall() }
        publish(snapshot)
        assert.equal(rows(panel)[0].rows[0].value, '0%')
        const before = updates()
        publish({ ...snapshot, nodeVM: { ...nodeVM } })
        assert.equal(updates(), before)
        publish({ nodeVM, wall: wall(20, 55) })
        assert.equal(rows(panel)[0].rows[0].value, '20%')
        panel.componentWillUnmount()
        assert.equal(panel.refreshStopped, true)
        assert.equal(listeners.size, 0)
    })
    it('does not leak the previous Node cache or detail response across selection changes', () => {
        const { panel } = probe({ nodeVM, wall: wall() })
        panel.state.detail = { usage: { cpu: '2' } }
        panel.props.node = node('different-node')
        assert.equal(rows(panel)[0].rows[0].value, '미수집')
        assert.equal(panel.nodeMetricSnapshot().nodeVM, undefined)
    })
})
