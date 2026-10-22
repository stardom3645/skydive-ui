import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { rootDiskResources } from '../src/DataPanels/common/RootDiskResources'
import { resourceUsagePercent } from '../src/DataPanels/common/RootDiskResources'
import { topologyResourceMetrics } from '../src/TopologyResourceMetrics'

// Exercise the shared production chart's filtering, requests and renderer. No
// backend mocks are installed in the application or its browser session.
const source = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/HostResourceTrendPanel.tsx'), 'utf8')
const ast = ts.createSourceFile('Trend.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const body = ast.statements.filter(item => ts.isVariableStatement(item) || ts.isClassDeclaration(item)).map(item => item.getText(ast)).join('\n')
const series = (key: string, value: any = 0, extra = {}) => ({ key, unit: 'percent', lastValue: value,
    values: [{ timestamp: 1000, value }, { timestamp: 1060, value }], ...extra })
const history = (extra = {}) => ({ host: 'i-21-210-VM', start: 1000, end: 1060,
    series: [series('cpu'), series('memory', 8), series('storageIops', 2, { unit: 'iops' }),
        series('rootDiskTotal', 1000, { unit: 'bytes' }), series('rootDiskUsed', 100, { unit: 'bytes' })], ...extra })
function probe(overrides: any = {}) {
    const requests: any[] = []
    const context: any = { URLSearchParams, Date, Number, Math, rootDiskResources,
        translate: (key: string) => key, topologyVMGuestMACs: () => [],
        classes: new Proxy({}, { get: (_, key) => String(key) }),
        ResourceSectionCard: 'section', RootDiskPanel: 'root-disk', ResourceMetricTile: 'chart', ResourceInfoTooltip: 'info',
        Divider: 'divider', Empty: 'empty', Space: 'space', Spin: 'spin', Select: { Option: 'option' }, DetailSectionIcon: 'icon',
        React: { Fragment: 'fragment', Component: class { constructor(public props: any) {} },
            createElement: (type: any, props: any, ...children: any[]) => ({ type, props: props || {}, children }) },
        fetch: (url: string, options: any) => { requests.push({ url, options }); return Promise.resolve({ ok: true, json: () => Promise.resolve(history()) }) } }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`${body}\nthis.Panel = HostResourceTrendPanel`, { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
    const panel = new context.Panel({ node: { id: 'node', data: {} }, session: { endpoint: 'http://test', token: 'test-token' },
        target: 'vm', data: { Name: 'i-21-210-VM', InstanceName: 'i-21-210-VM', UUID: 'verified-vm-id' },
        usageTrendOnly: { keys: ['cpu', 'memory'], source: 'libvirt' }, ...overrides })
    panel.state = { loading: false, error: '', loadedFor: '', trendRange: '3h', trend: history() }
    panel.setState = (update: any, callback?: () => void) => { Object.assign(panel.state, typeof update === 'function' ? update(panel.state) : update); callback?.() }
    return { panel, requests }
}
function find(tree: any, type: string): any[] {
    if (Array.isArray(tree)) return ([] as any[]).concat(...tree.map(item => find(item, type)))
    if (!tree || typeof tree !== 'object') return []
    return (tree.type === type ? [tree] : []).concat(find(tree.children, type))
}

describe('Kubernetes Node reuse of VM resource history', () => {
    it('renders only CPU/memory, preserves measured zero and uses borderless shared charts without a root disk', () => {
        const { panel } = probe()
        const tree = panel.render()
        assert.equal(find(tree, 'section').length, 1)
        assert.equal(find(tree, 'root-disk').length, 0)
        const charts = find(tree, 'chart')
        assert.equal(charts.length, 2)
        assert.ok(charts.every(chart => chart.props.appearance === 'plain'))
        assert.equal(find(tree, 'divider').length, 1)
        assert.equal(panel.displayItems([series('cpu')])[0].value, '0%')
    })
    it('hides unavailable, wrong-VM, different-source and invalid-scale histories rather than inventing values', () => {
        for (const trend of [undefined, history({ series: [] }), history({ host: 'another-vm' }),
            history({ rawLabels: { source: 'node_exporter' } }),
            history({ series: [series('cpu', null), series('memory', undefined, { values: [] })] }),
            history({ series: [series('cpu', Infinity), series('memory', 120)] }),
            history({ series: [series('cpu', 5, { unit: 'cores' }), series('memory', 7, { values: undefined })] })]) {
            const { panel } = probe()
            panel.state.trend = trend
            assert.equal(panel.render(), null)
        }
    })
    it('accepts the matching guest measurement source and excludes native Kubernetes resources in mixed-source nodes', () => {
        const { panel } = probe({ usageTrendOnly: { keys: ['memory'], source: 'node_exporter' } })
        panel.state.trend = history({ rawLabels: { source: 'node_exporter' } })
        assert.equal(find(panel.render(), 'chart').length, 1)
        assert.equal(find(panel.render(), 'chart')[0].props.title, 'resourceTrendMemoryUsage')
    })
    it('keeps the existing VM root disk, chart coverage and empty-state presentation when not opted in', () => {
        const { panel } = probe({ usageTrendOnly: undefined })
        assert.equal(find(panel.render(), 'root-disk').length, 1)
        assert.equal(find(panel.render(), 'chart').length, 3)
        panel.state.trend = undefined
        assert.equal(find(panel.render(), 'section').length, 1)
        assert.equal(find(panel.render(), 'empty').length, 1)
    })
    it('uses the verified VM identity, existing endpoint, authentication and range control while retaining the previous chart during refresh', async () => {
        const { panel, requests } = probe()
        panel.loadTrend()
        await new Promise(resolve => setImmediate(resolve))
        let params = new URL(requests[0].url).searchParams
        assert.equal(new URL(requests[0].url).pathname, '/api/wall/vms/trend')
        for (const key of ['name', 'domain', 'instanceName']) assert.equal(params.get(key), 'i-21-210-VM')
        for (const key of ['uuid', 'vmId']) assert.equal(params.get(key), 'verified-vm-id')
        assert.equal(params.get('range'), '3h')
        assert.equal(params.get('step'), '60s')
        assert.equal(requests[0].options.headers['X-Auth-Token'], 'test-token')
        const previous = panel.state.trend
        panel.handleRangeChange('6h')
        assert.equal(panel.state.trend, previous)
        assert.equal(panel.state.loading, true)
        assert.equal(find(panel.render(), 'section').length, 1)
        await new Promise(resolve => setImmediate(resolve))
        params = new URL(requests[1].url).searchParams
        assert.equal(params.get('range'), '6h')
        assert.equal(panel.state.loading, false)
    })
})

describe('Infrastructure current usage shares the topology snapshot', () => {
    it('keeps CPU and memory synchronized through repeated refreshes independently of history range', async () => {
        for (const type of ['libvirt', 'host']) {
            let wall = history()
            const listeners = new Set<() => void>()
            const node: any = { id: type, data: { Type: type, Name: 'ccvm', CpuNumber: 8, Memory: 16384 }, children: [] }
            const nodeResourceSource = {
                nodeResourceSnapshot: () => ({ wall }),
                subscribeNodeResources: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) }
            }
            const { panel, requests } = probe({ node, target: type === 'host' ? 'host' : 'vm', usageTrendOnly: undefined, nodeResourceSource })
            panel.componentDidMount()
            await new Promise(resolve => setImmediate(resolve))
            const originalHistory = panel.state.trend
            for (const [cpu, memory] of [[2.2, 52], [3.8, 61], [0, 0]]) {
                wall = history({ series: [series('cpu', cpu), series('memory', memory), series('rootDiskTotal', 1000), series('rootDiskUsed', 100)] })
                listeners.forEach(listener => listener())
                assert.equal(panel.state.resourceSnapshot.wall, wall)
                const current = find(panel.render(), 'root-disk')[0].props.wall
                const card = topologyResourceMetrics(node, { wall })
                for (const key of ['cpu', 'memory']) {
                    assert.equal(resourceUsagePercent(current, key), card.find(metric => metric.key === key)?.percent)
                }
                assert.equal(panel.state.trend, originalHistory)
            }
            panel.handleRangeChange('6h')
            await new Promise(resolve => setImmediate(resolve))
            assert.equal(find(panel.render(), 'root-disk')[0].props.wall, wall)
            assert.equal(requests.length, 2, 'live snapshot updates must not issue duplicate history requests')
            panel.componentWillUnmount()
            assert.equal(listeners.size, 0)
        }
    })

    it('rebinds on selection/source changes and never replaces missing live data with an old historical sample', () => {
        const listeners = new Set<() => void>()
        let wall: any = history()
        const source = {
            nodeResourceSnapshot: (node: any) => ({ wall: node.id === 'node' ? wall : undefined }),
            subscribeNodeResources: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) }
        }
        const { panel } = probe({ usageTrendOnly: undefined, nodeResourceSource: source })
        panel.bindNodeResources()
        assert.equal(listeners.size, 1)
        wall = undefined
        listeners.forEach(listener => listener())
        assert.equal(find(panel.render(), 'root-disk')[0].props.wall, undefined)
        const previous = panel.props
        panel.props = { ...previous, node: { id: 'next', data: {} } }
        panel.componentDidUpdate(previous)
        assert.equal(listeners.size, 1)
        assert.equal(panel.state.resourceNodeID, 'next')
        assert.equal(find(panel.render(), 'root-disk')[0].props.wall, undefined)
        const oldSourceProps = panel.props
        panel.props = { ...panel.props, nodeResourceSource: undefined }
        panel.componentDidUpdate(oldSourceProps)
        assert.equal(listeners.size, 0)
        assert.equal(find(panel.render(), 'root-disk')[0].props.wall, panel.state.trend)
    })
})
