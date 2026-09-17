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
    const names = ['onDocumentMouseDown', 'closeSidePanels', 'setTopologyDisplayOption', 'renderTopologyDisplayOptions']
    const methods = app.members.filter(member => member.name && names.includes(member.name.getText(ast))).map(member => member.getText(ast)).join('\n')
    const saved: any[] = []
    const context: any = {
        React: { createElement: (type: any, props: any, ...children: any[]) => ({ type, props: props || {}, children }) },
        AntMenu: Object.assign('menu', { Item: 'item' }),
        AntCheckbox: 'checkbox', AntDropdown: 'dropdown', Button: 'button', EyeOutlined: 'eye', KeyboardArrowDown: 'arrow',
        clsx: (...values: any[]) => values.filter(Boolean).join(' '),
        localStorage: { setItem: () => undefined },
        saveTopologyDisplayOptions: (value: any) => saved.push(value)
    }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${methods} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.React }), context)
    const panel = new context.Probe()
    panel.state = { topologyDisplayOptionsOpen: true, topologyDisplayOptions: { hideDownNodes: false }, isLinkTagsCollapsed: true, linkTagStates: new Map() }
    panel.setState = (update: any, callback?: () => void) => {
        Object.assign(panel.state, typeof update === 'function' ? update(panel.state) : update)
        if (callback) callback()
    }
    panel.isKubernetesLayerActive = () => false
    let refreshes = 0
    panel.tc = { refreshDisplayFilters: () => refreshes++ }
    return { panel, saved, refreshes: () => refreshes }
}

function mouseDown(inside: boolean) {
    return { target: { closest: (selector: string) => inside && selector.includes('netdive-topology-display-options') ? {} : null } }
}

function findCheckbox(element: any): any {
    if (element.type === 'checkbox') return element
    for (const child of element.children || []) {
        if (!child || typeof child !== 'object') continue
        const found = findCheckbox(child)
        if (found) return found
    }
}

describe('Topology display options interactions', () => {
    it('keeps the popup open during an inside mousedown and closes on outside mousedown', () => {
        const { panel } = displayOptionsProbe()
        panel.onDocumentMouseDown(mouseDown(true))
        assert.strictEqual(panel.state.topologyDisplayOptionsOpen, true)
        panel.onDocumentMouseDown(mouseDown(false))
        assert.strictEqual(panel.state.topologyDisplayOptionsOpen, false)
    })

    it('allows label clicks to activate the checkbox without also toggling the menu row', () => {
        const { panel, saved, refreshes } = displayOptionsProbe()
        for (const checked of [true, false]) {
            panel.onDocumentMouseDown(mouseDown(true))
            assert.strictEqual(panel.state.topologyDisplayOptionsOpen, true)
            const menu = panel.renderTopologyDisplayOptions({}).props.overlay
            const labelBoundary = menu.children[0].children[0]
            const checkbox = findCheckbox(menu)
            let stopped = false
            // Text clicks bubble through this boundary before the label activates its input.
            labelBoundary.props.onClick({ stopPropagation: () => { stopped = true } })
            assert.strictEqual(stopped, true)
            checkbox.props.onChange({ target: { checked } })
            assert.strictEqual(panel.state.topologyDisplayOptions.hideDownNodes, checked)
            assert.strictEqual(findCheckbox(panel.renderTopologyDisplayOptions({}).props.overlay).props.checked, checked)
        }
        assert.strictEqual(saved.length, 2)
        assert.strictEqual(refreshes(), 2)
    })

    it('retains menu-row toggling and excludes the Kubernetes layer', () => {
        const { panel, refreshes } = displayOptionsProbe()
        const menu = panel.renderTopologyDisplayOptions({}).props.overlay
        menu.props.onClick({ key: 'hide-down-nodes', domEvent: { stopPropagation: () => undefined } })
        assert.strictEqual(panel.state.topologyDisplayOptions.hideDownNodes, true)
        assert.strictEqual(refreshes(), 1)
        panel.isKubernetesLayerActive = () => true
        assert.strictEqual(panel.renderTopologyDisplayOptions({}), null)
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
