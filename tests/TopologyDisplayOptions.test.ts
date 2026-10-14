import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

// Exercise the production event handlers without starting the topology backend.
function displayOptionsProbe() {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
    const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const app = ast.statements.filter(ts.isClassDeclaration).find(node => node.members.some(member => member.name && member.name.getText(ast) === 'renderTopologyDisplayOptions'))!
    const names = ['onDocumentMouseDown', 'closeSidePanels', 'setTopologyDisplayOption', 'renderTopologyDisplayOptions', 'connectionDisplayTags', 'connectionDisplayState', 'cycleConnectionDisplay', 'linkTagStateInfo']
    const methods = app.members.filter(member => member.name && names.includes(member.name.getText(ast))).map(member => member.getText(ast)).join('\n')
    const saved: any[] = []
    const context: any = {
        React: { createElement: (type: any, props: any, ...children: any[]) => ({ type, props: props || {}, children }) },
        AntMenu: Object.assign('menu', { Item: 'item' }),
        TopologyToolbarButton: 'toolbar-button', SettingOutlined: 'settings', InfrastructureVMLayoutControl: 'vm-layout',
        Tooltip: 'tooltip', LinkTagState: { Hidden: 1, EventBased: 2, Visible: 3 }, translate: (key: string) => key,
        AntCheckbox: 'checkbox', AntDropdown: 'dropdown', Button: 'button', EyeOutlined: 'eye', KeyboardArrowDown: 'arrow',
        clsx: (...values: any[]) => values.filter(Boolean).join(' '),
        localStorage: { setItem: () => undefined },
        saveTopologyDisplayOptions: (value: any) => saved.push(value)
    }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${methods} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.React }), context)
    const panel = new context.Probe()
    panel.state = { topologyDisplayOptionsOpen: false, topologyDisplayOptions: { hideDownNodes: false }, isLinkTagsCollapsed: true, linkTagStates: new Map() }
    panel.setState = (update: any, callback?: () => void) => {
        Object.assign(panel.state, typeof update === 'function' ? update(panel.state) : update)
        if (callback) callback()
    }
    panel.isKubernetesLayerActive = () => false
    panel.rebuildSuggestions = () => undefined
    let refreshes = 0
    panel.orderedLinkTagsForActiveLayer = () => Array.from(panel.state.linkTagStates.keys())
    panel.tc = { refreshDisplayFilters: () => refreshes++, setLinkTagState: (tag: string, state: number) => panel.state.linkTagStates.set(tag, state) }
    return { panel, saved, refreshes: () => refreshes }
}

function findElement(element: any, type: string, label?: string): any {
    if (String(element.type) === type && (!label || element.children.includes(label))) return element
    for (const child of element.children || []) {
        if (!child || typeof child !== 'object') continue
        const found = findElement(child, type, label)
        if (found) return found
    }
}

describe('Topology display options interactions', () => {
    it('preserves topology side panels when interacting with the network trigger or search popup', () => {
        for (const selector of ['data-netdive-network-view', 'mold-network-view-popover', 'data-netdive-search', 'ant-select-dropdown']) {
            const { panel } = displayOptionsProbe()
            panel.state.isInfrastructurePanelOpen = true
            let closes = 0
            panel.closeSidePanels = () => closes++
            panel.onDocumentMouseDown({ target: { closest: (value: string) => value.includes(selector) ? {} : null } })
            assert.strictEqual(closes, 0)
            assert.strictEqual(panel.state.isInfrastructurePanelOpen, true)
            assert.strictEqual(panel.state.topologyDisplayOptionsOpen, false)
        }
    })
    it('toggles Down visibility directly, persisting and refreshing exactly once per change', () => {
        const { panel, saved, refreshes } = displayOptionsProbe()
        for (const checked of [true, false]) {
            const controls = panel.renderTopologyDisplayOptions({})
            assert.equal(controls.props['data-netdive-display-options'], 'true')
            assert.equal(findElement(controls, 'dropdown'), undefined)
            const checkbox = findElement(controls, 'checkbox', '다운된 객체 숨김')
            checkbox.props.onChange({ target: { checked } })
            assert.strictEqual(panel.state.topologyDisplayOptions.hideDownNodes, checked)
            assert.strictEqual(findElement(panel.renderTopologyDisplayOptions({}), 'checkbox', '다운된 객체 숨김').props.checked, checked)
        }
        assert.strictEqual(saved.length, 2)
        assert.strictEqual(refreshes(), 2)
    })

    it('changes VM layout independently and excludes the Kubernetes layer', () => {
        const { panel, refreshes } = displayOptionsProbe()
        const layout = findElement(panel.renderTopologyDisplayOptions({}), 'vm-layout')
        assert.equal(layout.props.inline, true)
        layout.props.onChange('compact')
        assert.equal(panel.state.infrastructureVMLayout, 'compact')
        assert.equal(panel.state.topologyDisplayOptions.hideDownNodes, false)
        assert.equal(refreshes(), 0)
        layout.props.onChange('linear')
        assert.equal(panel.state.infrastructureVMLayout, 'linear')
        panel.isKubernetesLayerActive = () => true
        const kubernetes = panel.renderTopologyDisplayOptions({})
        assert.equal(findElement(kubernetes, 'vm-layout'), undefined)
        assert.equal(findElement(kubernetes, 'checkbox', '다운된 객체 숨김'), undefined)
        assert.ok(findElement(kubernetes, 'checkbox', '연결 표시'))
    })
    it('cycles connection visibility through hidden, related and visible using existing tag states', () => {
        const { panel } = displayOptionsProbe()
        panel.state.linkTagStates = new Map([['layer2', 2], ['vlayer2', 2], ['ownership', 1], ['vownership', 1]])
        for (const [current, next] of [[2, 3], [3, 1], [1, 2]]) {
            const checkbox = findElement(panel.renderTopologyDisplayOptions({}), 'checkbox', '연결 표시')
            assert.equal(checkbox.props.checked, current === 3)
            assert.equal(checkbox.props.indeterminate, current === 2)
            checkbox.props.onChange()
            assert.equal(panel.state.linkTagStates.get('layer2'), next)
            assert.equal(panel.state.linkTagStates.get('vlayer2'), next)
            assert.equal(panel.state.linkTagStates.get('ownership'), 1)
            assert.equal(panel.state.linkTagStates.get('vownership'), 1)
        }
        panel.state.linkTagStates.set('layer2', 3)
        assert.equal(panel.connectionDisplayState(), 2)
    })
    it('defaults to optimized VM layout and Down hidden while retaining saved filter choices', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
        assert.ok(source.includes("infrastructureVMLayout: 'compact',"))
        const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        const getter = ast.statements.filter(ts.isVariableStatement).find(statement =>
            statement.declarationList.declarations.some(declaration => declaration.name.getText(ast) === 'getSavedTopologyDisplayOptions'))!
        for (const [raw, expected] of [[null, true], ['{}', true], ['{"hideDownNodes":false}', false], ['{"hideDownNodes":true}', true], ['invalid', true]]) {
            const context: any = { TOPOLOGY_DISPLAY_OPTIONS_STORAGE_KEY: 'probe', localStorage: { getItem: () => raw } }
            vm.createContext(context)
            vm.runInContext(ts.transpile(`${getter.getText(ast)}; this.result = getSavedTopologyDisplayOptions()`, { target: ts.ScriptTarget.ES2017 }), context)
            assert.equal(context.result.hideDownNodes, expected)
        }
    })
    it('keeps the detail panel open when using inline view checkboxes', () => {
        const { panel } = displayOptionsProbe()
        panel.state.topologyDisplayOptionsOpen = false
        panel.state.isInfrastructurePanelOpen = true
        let closes = 0
        panel.closeSidePanels = () => closes++
        panel.onDocumentMouseDown({ target: { closest: (selector: string) => selector.includes('data-netdive-display-options') ? {} : null } })
        assert.equal(closes, 0)
    })

})

function groupDisplayProbe(enabled: boolean, available = true) {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/GroupDetailPanel.tsx'), 'utf8')
    const ast = ts.createSourceFile('Group.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const group = ast.statements.find(ts.isClassDeclaration)!
    const methods = group.members.filter(member => member.name && ['children', 'displayName', 'filteredChildren'].includes(member.name.getText(ast))).map(member => member.getText(ast)).join('\n')
    const topologySource = fs.readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8')
    const topologyAST = ts.createSourceFile('Topology.tsx', topologySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const downPredicate = topologyAST.statements.filter(ts.isVariableStatement).find(statement => statement.declarationList.declarations.some(declaration => declaration.name.getText(topologyAST) === 'isTopologyDownNode'))!
    const context: any = {}
    vm.createContext(context)
    vm.runInContext(ts.transpile(`${downPredicate.getText(topologyAST).replace('export ', '')}\nclass Probe { ${methods} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2017 }), context)
    const panel = new context.Probe()
    panel.props = {
        hideDownNodes: enabled,
        onHideDownNodesChange: available ? () => undefined : undefined,
        nodeAttrs: (node: any) => ({ name: node.id }),
        node: { children: [{ id: 'host-up', data: { State: 'UP' } }, { id: 'host-down', data: { Status: 'Down' } }, { id: 'unknown', data: {} }] }
    }
    panel.state = { search: '' }
    return panel
}

describe('Group panel shared down-node filter', () => {
    it('hides only Down nodes and restores them when the shared setting is off', () => {
        const panel = groupDisplayProbe(true)
        assert.strictEqual(panel.filteredChildren().map((node: any) => node.id).join(','), 'host-up,unknown')
        panel.props.hideDownNodes = false
        assert.strictEqual(panel.filteredChildren().length, 3)
    })
    it('combines the display option with search and ignores the setting on excluded layers', () => {
        const panel = groupDisplayProbe(true)
        panel.state.search = 'host'
        assert.strictEqual(panel.filteredChildren().map((node: any) => node.id).join(','), 'host-up')
        assert.strictEqual(groupDisplayProbe(true, false).filteredChildren().length, 3)
    })
})
