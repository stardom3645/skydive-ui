import { strict as assert } from 'assert'
import { infrastructureOccupiedLaneOffsets as offsets, infrastructureGroupSemanticDimensions as dimensions, InfrastructureOccupiedLaneItem, infrastructureObjectSemanticDimensions as objectDimensions, infrastructureObjectSemanticInfo, infrastructureViewportWidth } from '../src/InfrastructureSemanticLayout'
import { topologyNodePresentation } from '../src/TopologyNodePresentation'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

const item = (id: string, weight: number, y: number, height: number, rest: Partial<InfrastructureOccupiedLaneItem> = {}): InfrastructureOccupiedLaneItem =>
    ({ id, weight, y, height, above: 0, below: 0, visible: true, vm: false, ...rest })

describe('Infrastructure occupied lanes', () => {
    it('reclaims fixed slots and keeps the caption and painted bounds clear', () => {
        const nodes = [item('switch', 5015, 0, 140), item('host', 5020, 900, 420, { above: 41 }),
            item('nic', 5030, 1800, 200), item('vlan', 5040, 2600, 200), item('vm', 7080, 6000, 80, { vm: true })]
        const original = JSON.stringify(nodes), result = offsets(nodes, 64)
        const moved = nodes.map(node => ({ ...node, y: node.y + result.get(node.id)! }))
        for (let i = 1; i < moved.length; i++) {
            const gap = moved[i].y - moved[i].height / 2 - moved[i].above - (moved[i - 1].y + moved[i - 1].height / 2)
            assert.equal(gap, i === 1 ? 384 : 64)
        }
        assert.ok(moved[4].y < nodes[4].y / 3)
        assert.equal(JSON.stringify(nodes), original)
        assert.ok(Array.from(offsets(moved, 64).values()).every(value => Math.abs(value) < .001), 'compaction is idempotent')
    })
    it('moves expanded VM/NIC blocks together and retains all row and x-independent spacing', () => {
        const nodes = [item('bridge', 7040, 0, 200), item('vm-a', 7080, 1500, 80, { vm: true }),
            item('vm-b', 7080, 2000, 80, { vm: true }),
            item('proxy', 7090, 1800, 0, { parentID: 'vm-a', visible: false }),
            item('nic-a', 7090, 1700, 220, { parentID: 'proxy', above: 40 }),
            item('nic-b', 7090, 2200, 220, { parentID: 'vm-b' }), item('later', 7100, 5000, 200)]
        const result = offsets(nodes, 64)
        for (const id of ['vm-a', 'vm-b', 'proxy', 'nic-a', 'nic-b']) assert.equal(result.get(id), result.get('vm-a'))
        const bottom = 2200 + 110 + result.get('nic-b')!, top = 5000 - 100 + result.get('later')!
        assert.equal(top - bottom, 64)
        assert.equal((2000 + result.get('vm-b')!) - (1500 + result.get('vm-a')!), 500)
    })
    it('ignores invisible spacers and compacts deterministic empty/group-only scenes', () => {
        assert.equal(offsets([], 64).size, 0)
        const nodes = [item('nic-group', 5030, 1000, 200), item('hidden', 5035, 100000, 0, { visible: false }), item('bridge-group', 7040, 9000, 200)]
        const result = offsets(nodes, 64)
        assert.equal(result.get('bridge-group'), -7736)
        assert.deepEqual(result, offsets(nodes, 64))
    })
})

function cardRenderer() {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/TopologyNodeCard.tsx'), 'utf8')
    const ast = ts.createSourceFile('Card.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const declaration = ast.statements.filter(ts.isVariableStatement).reduce((all, s) => all.concat(Array.from(s.declarationList.declarations)), [] as ts.VariableDeclaration[])
        .find(d => d.name.getText(ast) === 'TopologyNodeCard')!
    const context: any = { React: { memo: (c: any) => c, createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }) },
        TopologyTypeIcon: 'icon', TopologyObjectStatusBadge: 'status', infrastructureObjectSemanticInfo, TopologyCardTooltip: 'tooltip', TopologyGroupHeaderSummary: 'summary', TopologyLinkStateSummary: 'link-state', InfoCircleOutlined: 'info' }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`this.Card = ${declaration.initializer!.getText(ast)}`, { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2018 }), context)
    return context.Card
}

describe('Infrastructure common group overview', () => {
    for (const type of ['device', 'vlan', 'bridge', 'libvirt']) it(`retains ${type} membership and the canonical status summary`, () => {
        const node = (id: string, state: string): any => ({ id, data: { Type: type, State: state, Name: id }, children: [], state: {}, getWeight: () => 7080 })
        const children = [node('normal', 'UP'), node('warning', 'WARNING'), node('problem', 'ERROR'), node('down', 'DOWN')]
        const group = { ...node('group', 'UP'), data: { Type: type, IsTopologyGroup: true }, children }
        const model = topologyNodePresentation(group, { name: `${type} 그룹`, group: true })
        const before = JSON.stringify(model), Card = cardRenderer()
        for (const mode of ['summary', 'dense'] as const) {
            const size = dimensions(mode)!, rendered = Card({ model: { ...model, ...size }, icon: '', semanticGroup: true })
            assert.equal(rendered.props.width, size.width)
            const article = rendered.children[0], summary = article.children[2].children[0]
            assert.strictEqual(summary.props.children, model.children)
            assert.equal(article.props['aria-label'], `${type} 그룹 · 직접 하위 4개`)
            assert.ok(!article.props.className.includes('is-vm-dense'))
        }
        assert.equal(JSON.stringify(model), before)
        assert.equal(dimensions('detail'), undefined)
    })
    it('keeps LLDP discovery separate from a health verdict', () => {
        const model: any = { width: 320, height: 200, name: '포트 그룹', children: { total: 12 }, group: true, lldpDiscoveryCount: 12 }
        const article = cardRenderer()({ model, icon: '', semanticGroup: true }).children[0]
        assert.equal(article.children[2].type, 'div')
        assert.ok(JSON.stringify(article).includes('운영 상태 미수집'))
        assert.ok(!JSON.stringify(article).includes('"type":"summary"'))
    })
})

function panelProbe() {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/GroupDetailPanel.tsx'), 'utf8')
    const ast = ts.createSourceFile('Panel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const panel = ast.statements.filter(ts.isClassDeclaration).find(c => c.name?.text === 'GroupDetailPanel')!
    const names = ['renderNodeItem', 'isNodeVisible']
    const methods = panel.members.filter(m => m.name && names.includes(m.name.getText(ast))).map(m => m.getText(ast)).join('\n')
    const context: any = {
        React: { createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }) },
        List: { Item: 'row' }, Avatar: 'avatar', OverflowTooltip: 'overflow', Typography: { Text: 'text' }, DetailBadge: 'badge',
        TopologyStatusBadgeGroup: 'badges', Tooltip: 'tooltip', Button: 'button', RightOutlined: 'right', ForkOutlined: 'fork',
        statusOf: () => ({ visible: false, className: 'is-unknown' }), ipOf: () => '', kubernetesTopologyBadgeGroupSummary: () => undefined
    }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Panel { ${methods} }; this.Panel = Panel`, { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
    const instance = new context.Panel(), toggles: string[] = [], details: string[] = []
    instance.props = { nodeAttrs: () => ({ icon: '' }), visibleNodeIDs: new Set(['a']), onNodeSelect: (n: any) => toggles.push(n.id), onNodeFocus: (n: any) => details.push(n.id) }
    instance.displayName = (n: any) => n.id
    instance.vmNetworkSummary = () => undefined
    return { instance, toggles, details, node: (id: string, selected = false) => ({ id, data: { Type: 'device' }, state: { selected } }) }
}

describe('Group panel retained interactions', () => {
    it('keeps blue row state for visible or explicitly selected resources and leaves other rows idle', () => {
        const { instance, node, toggles } = panelProbe()
        for (const [resource, expected] of [[node('a'), true], [node('b', true), true], [node('c'), false]] as const) {
            const row = instance.renderNodeItem(resource)
            assert.equal(row.props['aria-selected'], expected)
            assert.equal(row.props.className.includes('is-selected'), expected)
            row.props.onClick()
        }
        assert.deepEqual(toggles, ['a', 'b', 'c'], 'independent row callbacks retain multi-row display selection')
    })
    it('keeps detail navigation separate from the row toggle and supports keyboard row activation', () => {
        const { instance, node, toggles, details } = panelProbe()
        const row = instance.renderNodeItem(node('a')), button = row.children[3].children[0]
        let stopped = 0, prevented = 0
        button.props.onClick({ stopPropagation: () => stopped++ })
        assert.equal(stopped, 1); assert.deepEqual(details, ['a']); assert.deepEqual(toggles, [])
        const target = {}
        row.props.onKeyDown({ target, currentTarget: target, key: 'Enter', preventDefault: () => prevented++ })
        row.props.onKeyDown({ target: {}, currentTarget: target, key: 'Enter', preventDefault: () => prevented++ })
        assert.deepEqual(toggles, ['a']); assert.equal(prevented, 1)
    })
})


describe('Common Infrastructure identities', () => {
    for (const [type, weight, name] of [['host', 5020, 'host-01'], ['libvirt', 7060, 'ccvm'], ['libvirt', 7060, 'scvm'],
        ['libvirt', 7070, 'r-1-VM'], ['device', 5030, 'eno1'], ['vlan', 5040, 'vlan134'], ['bridge', 7040, 'br0'], ['switch', 5015, 'switch-01']] as const)
        it(`renders ${name} with the same identity/status variant and omits resource metrics`, () => {
            const node: any = { id: name, data: { Type: type, State: 'UP', Name: name, CPUPercent: 23, MemoryPercent: 46 }, state: {}, children: [], getWeight: () => weight }
            const model = topologyNodePresentation(node, { name }), before = JSON.stringify(model), Card = cardRenderer()
            for (const semanticMode of ['summary', 'dense'] as const) {
                const size = objectDimensions(semanticMode)!
                const view = Card({ model: { ...model, ...size }, icon: '', semanticObject: true, semanticMode })
                assert.equal(view.props.width, size.width); assert.equal(view.props.height, size.height)
                const article = view.children[0]
                assert.ok(article.props.className.includes(`is-infrastructure-${semanticMode}`))
                assert.strictEqual(article.children[1].props.status, model.status)
                assert.equal(article.children[0].children[0].children[0], name)
                assert.ok(!JSON.stringify(article).includes('topology-metric-chip'))
                if (type === 'libvirt') assert.equal(article.children[2], undefined, 'CCVM/SCVM/router have no reduced metrics or service information')
            }
            assert.equal(JSON.stringify(model), before)
            assert.equal(objectDimensions('detail'), undefined)
        })
    it('uses collected essential values only, keeping operation separate from health', () => {
        const base: any = { resourceType: 'host', metrics: [{ key: 'cpu', value: '23%' }, { key: 'vms', label: '가상머신', value: '30' }] }
        assert.equal(infrastructureObjectSemanticInfo(base)?.text, '가상머신 30')
        assert.equal(infrastructureObjectSemanticInfo({ ...base, resourceType: 'libvirt' }), undefined)
        assert.equal(infrastructureObjectSemanticInfo({ ...base, metrics: [] }), undefined)
        const network = { ...base, resourceType: 'device', linkState: 'Down', status: { label: '이상 없음' } }
        assert.equal(infrastructureObjectSemanticInfo(network)?.text, '동작 Down')
        assert.equal(network.status.label, '이상 없음')
    })
    it('reclaims the dense caption corridor and retains the summary caption clearance', () => {
        const nodes = [item('switch', 5015, 0, 128), item('host', 5020, 1000, 128)]
        assert.equal(1000 + offsets(nodes, 64, 64).get('host')! - 64 - 64, 64)
        assert.equal(1000 + offsets(nodes, 96, 192).get('host')! - 64 - 64, 192)
    })
    it('fits cameras into the unobscured area without changing layout viewport inputs', () => {
        const canvas = { left: 80, right: 1680, top: 64, bottom: 1200 }
        assert.equal(infrastructureViewportWidth(canvas), 1600)
        assert.equal(infrastructureViewportWidth(canvas, { left: 1154, right: 1668, top: 72, bottom: 1200 }), 1062)
        assert.equal(infrastructureViewportWidth(canvas, { left: 1668, right: 1668, top: 72, bottom: 1200 }), 1600)
        assert.equal(infrastructureViewportWidth(canvas, { left: 1000, right: 1200, top: 1300, bottom: 1600 }), 1600)
        assert.equal(infrastructureViewportWidth(canvas, { left: 0, right: 1680, top: 72, bottom: 1200 }), 1)
    })
})
