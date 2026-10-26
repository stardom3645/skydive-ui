import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

const React = require('react')
const root = path.resolve(__dirname, '../src/DataPanels')
const classes = new Proxy({}, { get: (_, key) => String(key) })
// Run the production classes without browser/backend globals. Rendering and
// lifecycle methods remain intact; requests are observed at the fetch boundary.
function productionClass(file: string, globals: any) {
    const source = readFileSync(path.join(root, `${file}.tsx`), 'utf8')
    const ast = ts.createSourceFile(`${file}.tsx`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const body = ast.statements.filter(item => ts.isVariableStatement(item) || ts.isClassDeclaration(item))
        .map(item => item.getText(ast)).join('\n')
    const context: any = { React, URLSearchParams, Date, Number, Math, Map, Set, classes,
        translate: (key: string) => key, window: {}, ...globals }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`${body}\nthis.Panel = ${file}`, { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
    return context.Panel
}
function syncState(panel: any) {
    panel.setState = (update: any, callback?: () => void) => {
        Object.assign(panel.state, typeof update === 'function' ? update(panel.state) : update)
        callback?.()
    }
}
function elements(tree: any, type?: any, visibleOnly = false): any[] {
    if (Array.isArray(tree)) return tree.reduce((result, child) => result.concat(elements(child, type, visibleOnly)), [])
    if (!React.isValidElement(tree)) return []
    const element: any = tree
    if (visibleOnly && element.props.style?.display === 'none') return []
    return (type === undefined || element.type === type ? [element] : []).concat(elements(element.props.children, type, visibleOnly))
}
const series = (key: string, value = 0, unit = 'percent') => ({ key, unit, lastValue: value,
    values: [{ timestamp: 1000, value }, { timestamp: 1060, value }] })
const history = () => ({ host: 'compute-1', start: 1000, end: 1060, series: [series('cpu', 3.8), series('memory', 52),
    series('storageIops', 7, 'iops'), series('networkRx', 500, 'bps'), series('networkTx', 1000, 'bps'), series('networkDrops', 0, 'count')] })
const turn = () => new Promise(resolve => setImmediate(resolve))
function trendProbe(overrides: any = {}) {
    const requests: any[] = [], subscriptions = new Set<() => void>()
    let wall = history()
    const Panel = productionClass('HostResourceTrendPanel', {
        ResourceSectionCard: 'section', RootDiskPanel: 'current', ResourceMetricTile: 'chart', ResourceInfoTooltip: 'info',
        Divider: 'divider', Empty: 'empty', Space: 'space', Spin: 'spin',
        Select: Object.assign(() => null, { Option: 'option' }), DetailSectionIcon: 'icon',
        rootDiskResources: () => undefined, topologyVMGuestMACs: () => [],
        fetch: (url: string, options: any) => { requests.push({ url, options }); return Promise.resolve({ ok: true, json: () => Promise.resolve(history()) }) }
    })
    const panel = new Panel({ node: { id: 'host-1', data: { Name: 'compute-1', ManagementIP: '192.0.2.1' } },
        nodeResourceSource: { nodeResourceSnapshot: () => ({ wall }), subscribeNodeResources: (listener: () => void) => {
            subscriptions.add(listener); return () => subscriptions.delete(listener)
        } }, session: { endpoint: 'http://test', token: 'test-token' }, hostView: 'overview', ...overrides })
    syncState(panel)
    const view = (hostView: string, extra: any = {}) => {
        const previous = panel.props
        panel.props = { ...panel.props, hostView, ...extra }
        panel.componentDidUpdate(previous)
    }
    return { panel, requests, subscriptions, view, live: (value: any) => { wall = value; subscriptions.forEach(listener => listener()) } }
}
function hostProbe() {
    const Panel = productionClass('HostDetailPanel', {
        ShareAltOutlined: 'share', DetailNavigationTabs: 'tabs', DetailSection: 'section', DetailEmpty: 'empty',
        DetailKeyValueList: 'values', HostResourceTrendPanel: 'history', DetailSectionIcon: 'icon',
        InfrastructurePortMappingTable: 'mappings', ConfigProvider: 'config', InfoIcon: 'info',
        AntTooltip: 'tooltip', Button: 'button', ExpandOutlined: 'expand', AccountTreeIcon: 'tree',
        DeviceHubIcon: 'switches', RouterIcon: 'router', SecurityIcon: 'security', normalizeTopologyHost: (host: any) => host
    })
    const panel = new Panel({ node: { id: 'host', data: { Name: 'compute-1', MoldHostId: 'mold-1', UpdatedAt: 1000 } } })
    syncState(panel)
    for (const method of ['ips', 'macs', 'hostInfrastructureNodeIDs', 'hostKubernetesNodes', 'hostKubernetesClusters', 'switchPortConnections']) panel[method] = () => []
    panel.infrastructureTopologyIcon = () => null
    panel.renderKubernetesNodePicker = () => null
    panel.renderConnectedResourceSubsection = (_: any, title: string) => React.createElement('connected-group', { title })
    panel.renderSocketProcessSummary = () => React.createElement('sockets')
    return panel
}

describe('HOST detail tab composition', () => {
    it('uses the shared four-tab navigation and puts current usage before connected resources', () => {
        const panel = hostProbe(), tree = panel.render(), tabs = elements(tree, 'tabs')[0]
        assert.deepEqual(Array.from(tabs.props.tabs, (tab: any) => tab.key), ['overview', 'resources', 'switches', 'diagnostics'])
        assert.deepEqual(elements(tree, undefined, true).filter(el => ['section', 'history'].includes(el.type)).map(el => el.props.title || 'current'),
            ['hostBasicInfo', 'current', 'hostConnectedResources'])
        assert.equal(elements(tree, 'history').length, 1)
        assert.equal(elements(tree, 'history')[0].props.hostView, 'overview')
    })
    it('keeps switch controls mounted and preserves expanded lists and range owner while changing tabs', () => {
        const panel = hostProbe()
        panel.state.showAllSocketProcesses = true
        panel.state.listeningServicesVisibleCount = 20
        for (const key of ['switches', 'diagnostics', 'resources', 'overview']) {
            const tabs = elements(panel.render(), 'tabs')[0]
            tabs.props.onChange(key)
            const tree = panel.render()
            assert.equal(elements(tree, 'history').length, 1)
            assert.equal(elements(tree, 'history')[0].props.hostView, key)
            assert.equal(elements(tree, 'mappings').length, 1)
            assert.equal(elements(tree, 'sockets', true).length, key === 'diagnostics' ? 1 : 0)
            assert.equal(elements(tree, 'mappings', true).length, key === 'switches' ? 1 : 0)
            assert.equal(panel.state.showAllSocketProcesses, true)
            assert.equal(panel.state.listeningServicesVisibleCount, 20)
        }
    })
    it('resets HOST-specific selection state on an object change, without reloading detail data on tab changes', () => {
        const panel = hostProbe(), loads: string[] = []
        panel.loadMoldHostDetail = () => loads.push('mold')
        panel.loadManualPortMappings = () => loads.push('mappings')
        const previous = panel.props
        panel.state.activeDetailTab = 'switches'
        panel.componentDidUpdate(previous)
        assert.equal(loads.length, 0)
        panel.props = { ...panel.props, node: { id: 'host-2', data: {} } }
        panel.componentDidUpdate(previous)
        assert.equal(panel.state.activeDetailTab, 'overview')
        assert.equal(panel.state.portMappingExpanded, false)
        assert.deepEqual(loads, ['mold', 'mappings'])
    })
})

describe('HOST overview, performance and switch tab separation', () => {
    it('defers history until a graph tab opens, then shares one request, range and live subscription', async () => {
        const { panel, requests, subscriptions, view, live } = trendProbe()
        panel.componentDidMount()
        assert.equal(requests.length, 0)
        assert.equal(subscriptions.size, 1)
        assert.equal(elements(panel.render(), 'current').length, 1)
        assert.equal(elements(panel.render(), 'current')[0].props.compact, undefined, 'overview retains the full shared resource presentation')
        view('switches')
        assert.equal(requests.length, 0)
        assert.equal(panel.render(), null)
        view('resources'); await turn()
        assert.equal(requests.length, 1)
        const identity = panel.state.trend
        assert.deepEqual(elements(panel.render(), 'chart').map(el => el.props.title), ['resourceTrendCpuUsage', 'resourceTrendMemoryUsage', 'resourceTrendStorageIops', 'resourceTrendNetworkTraffic', 'resourceTrendNetworkDropsErrors'])
        assert.equal(elements(panel.render(), 'current').length, 1)
        assert.notEqual(elements(panel.render(), 'current')[0].props.wall, panel.state.trend, 'current usage uses the live snapshot rather than range history')
        view('switches')
        assert.equal(elements(panel.render(), 'current').length, 0)
        assert.equal(requests.length, 1)
        assert.equal(panel.state.trend, identity)
        assert.equal(panel.render(), null)
        assert.equal(panel.displayItems(identity.series).find((item: any) => item.key === 'networkDrops').value, '0 resourceTrendCountUnit')
        view('resources')
        panel.handleRangeChange('6h'); await turn()
        const params = new URL(requests[1].url).searchParams
        assert.equal(params.get('range'), '6h'); assert.equal(params.get('managementIp'), '192.0.2.1')
        assert.equal(new URL(requests[1].url).pathname, '/api/wall/hosts/trend')
        assert.equal(requests[1].options.headers['X-Auth-Token'], 'test-token')
        view('diagnostics'); assert.equal(panel.render(), null)
        view('overview')
        live({ series: [series('cpu', 0), series('memory', 61)] })
        assert.equal(elements(panel.render(), 'current')[0].props.wall.series[1].lastValue, 61)
        view('resources')
        assert.equal(elements(panel.render(), 'current')[0].props.wall.series[1].lastValue, 61)
        assert.equal(panel.state.trendRange, '6h')
        assert.equal(requests.length, 2)
        assert.equal(subscriptions.size, 1)
        panel.componentWillUnmount(); assert.equal(subscriptions.size, 0)
    })
    it('clears another host’s history while overview is active and loads the new identity only on demand', async () => {
        const { panel, requests, view } = trendProbe()
        panel.componentDidMount(); view('resources'); await turn(); view('overview')
        view('overview', { node: { id: 'host-2', data: { Name: 'compute-2' } } })
        assert.equal(panel.state.trend, undefined)
        assert.equal(requests.length, 1)
        view('switches'); await turn()
        assert.equal(requests.length, 1)
        view('resources'); await turn()
        assert.equal(requests.length, 2)
        assert.equal(new URL(requests[1].url).searchParams.get('host'), 'compute-2')
    })
    it('keeps the existing Empty for missing history and measured zero without inventing network data', () => {
        const { panel, view } = trendProbe()
        panel.state.trend = { ...history(), series: [] }
        panel.state.loadedFor = 'loaded'
        view('resources')
        assert.equal(elements(panel.render(), 'chart').length, 0)
        assert.equal(elements(panel.render(), 'empty').length, 1)
        assert.equal(elements(panel.render(), 'current').length, 1)
        panel.state.error = 'unavailable'
        assert.equal(elements(panel.render(), 'empty')[0].props.description, 'resourceTrendUnavailable')
        panel.state.trend.series = [series('cpu', 0)]
        panel.state.error = ''
        assert.equal(elements(panel.render(), 'chart').length, 1)
        assert.equal(panel.displayItems(panel.state.trend.series)[0].value, '0%')
        view('switches')
        assert.equal(panel.render(), null)
    })
    it('retains the original eager history/current-usage fallback for standalone hosts without a live source', async () => {
        const { panel, requests } = trendProbe({ nodeResourceSource: undefined })
        panel.componentDidMount(); await turn()
        assert.equal(requests.length, 1)
        assert.equal(elements(panel.render(), 'current')[0].props.wall, panel.state.trend)
    })
})
