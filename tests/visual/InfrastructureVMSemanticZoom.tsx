/** Local regression scene: synthetic VM/NIC measurements; no backend requests. */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Button, ConfigProvider, Select, Space } from 'antd'
import { Topology, LinkTagState, Node } from '../../src/Topology'
import Config from '../../src/Config'
import TopologyZoomControls from '../../src/TopologyZoomControls'
import GroupDetailPanel from '../../src/DataPanels/GroupDetailPanel'
import { topologyNodeStatusPresentation } from '../../src/TopologyNodePresentation'
import { createMuiTheme } from '@material-ui/core/styles'
import { styles } from '../../src/AppStyles'
import '@fortawesome/fontawesome-free/css/all.css'
import '../../src/index.css'
import '../../src/antd-netdive.css'

const config = new Config(), noop = () => undefined
const appTokens: React.CSSProperties = Object.entries(styles(createMuiTheme()).app)
    .reduce((tokens, [key, value]) => key.startsWith('--') ? { ...tokens, [key]: value } : tokens, {})
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
function Preview() {
    const ref = React.useRef<Topology>(null), zoomControls = React.useRef<TopologyZoomControls>(null)
    const [count, setCount] = React.useState(30), [mode, setMode] = React.useState(''), [selected, setSelected] = React.useState('')
    const [panelGroup, setPanelGroup] = React.useState<Node | undefined>(), [visibleNodeIDs, setVisibleNodeIDs] = React.useState(new Set<string>())
    const [results, setResults] = React.useState<any[]>([]), [busy, setBusy] = React.useState(false)
    const measurements = React.useRef({ trees: 0, cpuMs: 0 })
    React.useEffect(() => {
        const graph = ref.current! as any, original = graph.renderTree.bind(graph)
        graph.renderTree = () => { const start = performance.now(); original(); measurements.current.trees++; measurements.current.cpuMs += performance.now() - start }
    }, [])
    const settle = async (expected?: string, scale?: number) => {
        const graph = ref.current! as any
        for (let i = 0; i < 200; i++) {
            await delay(20)
            const mode = document.querySelector('.topology-scene')?.getAttribute('data-infrastructure-semantic-mode')
            const actual = document.querySelectorAll(expected === 'dense' ? '.is-vm-dense' : expected === 'summary' ? '.is-vm-summary' : 'g.node[id^="node-user-vm-"] .is-object-identity.is-vm').length
            const count = Array.from(graph.d3nodes.values()).filter((node: any) => graph.isSemanticUserVM(node)).length
            const groupCount = Array.from(graph.d3nodes.values()).filter((node: any) => graph.isSemanticInfrastructureGroup(node)).length
            const compactGroups = document.querySelectorAll('.is-infrastructure-group-summary').length
            const identityCount = Array.from(graph.d3nodes.values()).filter((node: any) => graph.isSemanticInfrastructureObject(node) && !graph.isSemanticUserVM(node)).length
            const identities = document.querySelectorAll('.is-infrastructure-identity').length
            const groupsReady = !expected || compactGroups === (expected === 'detail' ? 0 : groupCount) && identities === (expected === 'detail' ? 0 : identityCount)
            if (groupsReady && (!expected || mode === expected && actual === count) && (scale === undefined || Math.abs(graph.currentZoom() - scale) < .00001) && !graph.semanticZoomFrame && !graph.semanticFitFrame) return
        }
    }
    const populate = (size: number) => {
        const graph = ref.current! as any
        graph.clearTopologyNodeFocus(false)
        graph.resetTree(true, true)
        const add = (id: string, type: string, weight: number, parent?: Node) => {
            const node = graph.addNode(id, ['infrastructure'], { Name: id, Type: type, State: 'UP',
                CPUPercent: 23, MemoryPercent: 46 }, weight)
            graph.setParent(node, parent || graph.root)
            return node
        }
        const networkSwitch = add('network-switch', 'switch', 5015)
        for (let h = 0; h < 2; h++) {
            const host = add(`host-${h}`, 'host', 5020), bridge = add(`bridge-${h}`, 'ovsbridge', 7040, host)
            const service = add(h === 0 ? 'ccvm' : 'scvm', 'libvirt', 7060, host)
            graph.recordConnectionRelation(`service-owner-${h}`, host, service, { RelationType: 'ownership' })
            add(`virtual-router-${h}`, 'libvirt', 7070, host)
            for (const [type, weight] of [['device', 5030], ['vlan', 5040], ['ovsbridge', 7040]] as const)
                for (let n = 0; n < 8; n++) {
                    const resource = add(`${type}-${h}-${n}`, type, weight, host)
                    if (type === 'device' && n === 0) {
                        resource.data.LastUpdateMetric = { Start: 1000, Last: 2000, RxBytes: 2048, TxBytes: 1024 }
                        graph.addLink(`physical-${h}`, networkSwitch, resource, ['layer2'], { RelationType: 'layer2' })
                    }
                }
            for (let v = h; v < size; v += 2) {
                const vm = add(`user-vm-${String(v).padStart(3, '0')}`, 'libvirt', 7080, host)
                vm.data.State = ['ERROR', 'WARNING', 'DOWN', undefined][v % 20] || (v % 20 === 3 ? undefined : 'UP')
                if (v % 20 === 4) { delete vm.data.CPUPercent; delete vm.data.MemoryPercent }
                graph.recordConnectionRelation(`owner-vm-${v}`, host, vm, { RelationType: 'ownership' })
                for (let n = 0; n < (v % 5 === 0 ? 2 : 1); n++) {
                    const nic = add(`nic-${v}-${n}`, 'tuntap', 7090, vm)
                    // One connection deliberately has no traffic measurement.
                    if (v !== 3) nic.data.LastUpdateMetric = { Start: 1000, Last: 2000, RxBytes: 1024 * (v + 1), TxBytes: 512 }
                    graph.recordConnectionRelation(`owner-nic-${v}-${n}`, vm, nic, { RelationType: 'ownership' })
                    graph.addLink(`traffic-${v}-${n}`, bridge, nic, ['layer2'], { RelationType: 'layer2' })
                }
            }
        }
        graph.activeNodeTag('infrastructure'); graph.completeTopologySync(); graph.expandAllNodes()
        graph.nodes.forEach((node: Node) => { if (node.data.Type === 'libvirt') node.state.expanded = false })
        graph.renderTree()
    }
    React.useEffect(() => { populate(count) }, [])
    const audit = (operation: string, elapsed = 0) => {
        const graph = ref.current! as any
        const nodes = Array.from(graph.d3nodes.values()).filter((node: any) => node.data.type !== 2 && node.data.wrapped !== graph.root) as any[]
        let overlaps = 0, detached = 0
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
            const a = graph.topologyEdgeBounds(nodes[i]), b = graph.topologyEdgeBounds(nodes[j])
            if (Math.abs(a.x - b.x) < (a.width + b.width) / 2 - .1 && Math.abs(a.y - b.y) < (a.height + b.height) / 2 - .1) overlaps++
        }
        document.querySelectorAll<SVGPathElement>('path.link').forEach(path => {
            const link = (path as any).__data__
            if (!path.getAttribute('d')) { detached++; return }
            const onCard = (id: string, point: DOMPoint) => {
                const node = graph.d3nodes.get(id)
                if (!node) return false
                const b = graph.topologyEdgeBounds(node), dx = Math.abs(point.x - b.x), dy = Math.abs(point.y - b.y)
                return (Math.abs(dx - b.width / 2) < 1 && dy <= b.height / 2 + 1)
                    || (Math.abs(dy - b.height / 2) < 1 && dx <= b.width / 2 + 1)
            }
            if (!onCard(link.source.id, path.getPointAtLength(0)) || !onCard(link.target.id, path.getPointAtLength(path.getTotalLength()))) detached++
        })
        const tiles = Array.from(document.querySelectorAll<HTMLElement>('.node-vm-semantic-dense'))
        const statusMismatch = tiles.filter(el => {
            const resource = graph.d3nodes.get(el.id.replace('node-', '')).data.wrapped
            return !el.querySelector(`.topology-vm-state-tile.is-${topologyNodeStatusPresentation(resource).tone}`)
        }).length
        const tileBoundsMismatch = tiles.filter(el => {
            const tag = el.querySelector('.topology-vm-state-tile')!.getBoundingClientRect()
            const bg = el.querySelector('.node-card-bg')!.getBoundingClientRect()
            return Math.abs(tag.x-bg.x) > .5 || Math.abs(tag.y-bg.y) > .5 || Math.abs(tag.width-bg.width) > .5 || Math.abs(tag.height-bg.height) > .5
        }).length
        const tileDecoration = tiles.filter(el => el.querySelector('.fa, img, svg, .topology-object-status') || el.querySelector('article')?.textContent?.trim()).length
        const visiblePaths = Array.from(document.querySelectorAll<SVGPathElement>('path.link')).filter(el => Number(el.style.opacity) > 0)
        const focus = graph.topologyNodeFocus
        const scopeMismatch = focus?.mode === 'connections' && graph.vmSemanticMode() === 'dense'
            ? Array.from(document.querySelectorAll<SVGPathElement>('path.link')).filter(el => (Number(el.style.opacity) > 0) !== focus.relationLinkIDs.has((el as any).__data__.id)).length : 0
        const statusDistribution = tiles.reduce((all, el) => {
            const tone = Array.from(el.querySelector('.topology-vm-state-tile')?.classList || []).find(value => value.startsWith('is-')) || 'unknown'
            all[tone] = (all[tone] || 0) + 1; return all
        }, {} as Record<string, number>)
        const groupCards = Array.from(document.querySelectorAll<HTMLElement>('.is-infrastructure-group-summary'))
        const groupOverflow = groupCards.filter(el => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1).length
        const extent = nodes.map(node => graph.topologyEdgeBounds(node))
        const sceneHeight = Math.max(...extent.map(b => b.y + b.height / 2)) - Math.min(...extent.map(b => b.y - b.height / 2))
        const identityCards = Array.from(document.querySelectorAll<HTMLElement>('.is-infrastructure-identity'))
        const identityOverflow = identityCards.filter(el => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1).length
        const ccvm = document.querySelector('#node-ccvm')
        const ccvmMetricsVisible = graph.infrastructureVMSemanticMode !== 'detail' && !!ccvm?.querySelector('.topology-metric-chip, .topology-system-vm-information')
        const row = { identityOverflow, compactIdentities: identityCards.length, ccvmMetricsVisible, availableWidth: Math.round(graph.availableViewSize().width), groupOverflow, compactGroups: groupCards.length, sceneHeight: Math.round(sceneHeight), statusMismatch, tileDecoration, tileBoundsMismatch, scopeMismatch, statusDistribution,
            connectionScope: focus?.mode === 'connections' ? focus.connectionScope : undefined,
            expectedScopePaths: focus?.relationLinkIDs.size,
            visibleStructuralGuides: Array.from(document.querySelectorAll<SVGPathElement>('.hiera-link')).filter(el => getComputedStyle(el).display !== 'none' && getComputedStyle(el.parentElement!).display !== 'none').length,
            count: graph.nodes.size, operation, mode: document.querySelector('.topology-scene')?.getAttribute('data-infrastructure-semantic-mode'),
            scale: Number(graph.currentZoom().toFixed(4)), readout: document.querySelector('.semantic-zoom-percent')?.textContent, elapsedMs: Math.round(elapsed), trees: measurements.current.trees, cpuMs: Math.round(measurements.current.cpuMs), tiles: document.querySelectorAll('.is-vm-dense').length,
            userVMs: nodes.filter(node => graph.isSemanticUserVM(node)).length, overlaps, detached,
            paintedPaths: Array.from(document.querySelectorAll<SVGPathElement>('path.link')).filter(el => !!el.getAttribute('d') && getComputedStyle(el).stroke !== 'none' && Number(el.style.opacity) > 0).length,
            paths: document.querySelectorAll('path.link').length,
            visiblePaths: Array.from(document.querySelectorAll<SVGPathElement>('path.link')).filter(el => Number(el.style.opacity) > 0).length,
            labelScreenHeights: Array.from(document.querySelectorAll<SVGGElement>('.link-label')).filter(el => Number(el.style.opacity) > 0)
                .map(el => Math.round(el.querySelector('text')!.getBoundingClientRect().height)),
            visibleLabels: Array.from(document.querySelectorAll<SVGGElement>('.link-label')).filter(el => Number(el.style.opacity) > 0).length }
        setResults(old => [...old, row]); return row
    }
    const run = async () => {
        setBusy(true); setResults([])
        const graph = ref.current! as any
        for (const size of [30, 60, 100]) {
            setCount(size); populate(size); await delay(1200); graph.cancelScheduledZoomFit(); graph.svg.interrupt(); graph.unselectAllNodes()
            for (const [name, scale] of [['detail', .29], ['summary', .25], ['dense', .15], ['summary-again', .25], ['below-29', .2849], ['rounded-29', .2851], ['summary-reset', .25], ['animated-34', .34], ['animated-36', .36], ['detail-again', .29]] as const) {
                measurements.current = { trees: 0, cpuMs: 0 }
                const start = performance.now(); graph.setZoomLevel(scale, name.startsWith('animated')); await settle(name.startsWith('summary') || name.startsWith('below') ? 'summary' : name.startsWith('dense') ? 'dense' : 'detail', scale)
                audit(`${size}:${name}`, performance.now() - start)
                if (name === 'dense') {
                    const geometry = () => JSON.stringify(Array.from(graph.d3nodes.values()).map((node: any) => [node.data.id, node.x, node.y]))
                    const before = geometry()
                    measurements.current = { trees: 0, cpuMs: 0 }
                    graph.setZoomLevel(.17, false); await settle('dense')
                    audit(`${size}:dense-within-band:${before === geometry() ? 'stable' : 'MOVED'}`)
                    graph.setZoomLevel(.1, false); await settle('dense', .1); audit(`${size}:dense-minimum`)
                }
            }
            graph.zoomFit(); await delay(900); audit(`${size}:fit`)
            graph.selectNode('user-vm-000', true); await delay(100); audit(`${size}:selection`)
            graph.unselectAllNodes(); await delay(50); audit(`${size}:deselect`)
            graph.setLinkTagState('layer2', LinkTagState.EventBased); graph.selectNode('user-vm-000', true)
            graph.expand(graph.nodes.get('user-vm-000')); await delay(650)
            graph.toggleTopologyNodeFocus('connections', graph.d3nodes.get('user-vm-000'), new Set(['user-vm-000']))
            await delay(100); audit(`${size}:direct`)
            graph.setConnectionScope('all'); await delay(100); audit(`${size}:all`)
            graph.setConnectionScope('direct'); await delay(100); audit(`${size}:direct-again`)
            graph.setConnectionScope('all'); graph.renderTree(); await delay(650); audit(`${size}:all-refresh`)
            graph.clearTopologyNodeFocus(); graph.unselectAllNodes(); await delay(50); audit(`${size}:clear-focus`)
            graph.expand(graph.nodes.get('user-vm-000')); await delay(650)
            graph.setLinkTagState('layer2', LinkTagState.Visible); graph.selectNode('user-vm-000', true)
            graph.expand(graph.nodes.get('user-vm-000')); await delay(700); audit(`${size}:NIC-expand`)
            graph.expand(graph.nodes.get('user-vm-000')); await delay(700); audit(`${size}:NIC-collapse`)
            graph.selectNode('user-vm-003', true); await delay(100); audit(`${size}:unmeasured-selection`)
            const group = graph.groups.get('host-0_libvirt_7080')
            if (group) {
                graph.expand(group.wrapped); await delay(1000); audit(`${size}:group-collapse`)
                graph.expand(graph.groups.get(group.id).wrapped); await delay(1000); audit(`${size}:group-expand`)
            }
            graph.unselectAllNodes()
            Array.from(graph.groups.values()).filter((group: any) => group.wrapped.getWeight() === 7080)
                .forEach((group: any) => { group.wrapped.state.expanded = false })
            graph.renderTree()
            graph.setZoomLevel(.25, false); await settle('summary', .25); await delay(650); audit(`${size}:groups-only-summary`)
            graph.setZoomLevel(.29, false); await settle('detail', .29); audit(`${size}:groups-only-detail`)
            setPanelGroup(graph.groups.get('host-0_libvirt_7080')?.wrapped); setVisibleNodeIDs(graph.groupVisibleNodeIDs())
            await delay(100); graph.zoomFit(); await delay(1000); audit(`${size}:panel-fit`)
            setPanelGroup(undefined)

        }
        graph.clearTopologyNodeFocus(false); graph.resetTree(true, true)
        const ccvm = graph.addNode('ccvm', ['infrastructure'], { Name: 'ccvm', Type: 'libvirt', State: 'UP', CPUPercent: 23, MemoryPercent: 46 }, 7060)
        graph.setParent(ccvm, graph.root); graph.activeNodeTag('infrastructure'); graph.completeTopologySync(); graph.renderTree()
        await delay(700)
        for (const [name, scale] of [['summary', .25], ['dense', .15], ['detail', .29]] as const) {
            graph.setZoomLevel(scale, false); await settle(name, scale); audit(`single-ccvm:${name}`)
        }
        graph.zoomFit(); await delay(1000); audit('single-ccvm:fit')
        setBusy(false)
    }
    return <ConfigProvider><main className="netdive-ant-theme" style={appTokens}>
        <Space style={{ padding: 12 }}>
            <Select value={count} onChange={size => { setCount(size); populate(size) }} options={[30, 60, 100].map(value => ({ value, label: `${value} VMs` }))} />
            <Button onClick={() => ref.current?.setZoomLevel(.29)}>상세</Button>
            <Button onClick={() => ref.current?.setZoomLevel(.25)}>간략</Button>
            <Button onClick={() => ref.current?.setZoomLevel(.15)}>밀집</Button>
            <Button onClick={() => ref.current?.zoomFit()}>화면 맞춤</Button>
            <Button onClick={() => ref.current?.expandAllNodes()}>전체 펼침</Button>
            <Button onClick={() => { const graph = ref.current as any; graph.clearTopologyNodeFocus(); graph.unselectAllNodes(); setSelected('') }}>선택 해제</Button>
            <Button onClick={run} loading={busy}>30–100 VM 회귀 검증</Button>
            <TopologyZoomControls ref={zoomControls} classes={{ topologyZoomPercent: 'semantic-zoom-percent' }} initialZoom={1}
                onZoom={delta => ref.current?.setZoomLevel((ref.current as any).currentZoom() + delta)} onReset={() => ref.current?.setZoomLevel(1)} />
            <Button onClick={() => { const graph = ref.current as any; setPanelGroup(graph.groups.get('host-0_libvirt_7080')?.wrapped); setVisibleNodeIDs(graph.groupVisibleNodeIDs()) }}>VM 그룹 패널</Button>
            <span role="status">{mode} · 선택: {selected || '없음'} · {busy ? '검증 중' : '준비'}</span>
        </Space>
        <Topology ref={ref} className="semantic-topology" resourceDataEnabled={false} infrastructureVMLayout="compact"
            onClick={noop} sortNodesFnc={(a, b) => a.id.localeCompare(b.id)} groupSize={6}
            defaultNodeTag={() => 'infrastructure'} defaultLinkTagMode={() => LinkTagState.Visible}
            nodeAttrs={node => config.nodeAttrs(node)} linkAttrs={link => config.linkAttrs(link)}
            onNodeSelected={(node, active) => { if (active) setSelected(node.data.Name) }}
            onLinkSelected={noop} onLinkTagChange={noop} onNodeClicked={node => ref.current?.selectNode(node.id)} onNodeDblClicked={node => ref.current?.expand(node)}
            onZoomChange={zoom => { zoomControls.current?.setZoom(zoom); setMode(`${Math.round(zoom * 100)}%`) }} />
        {panelGroup && <aside data-netdive-object-panel="true" aria-label="검증용 그룹 상세 패널" style={{ position: 'absolute', top: 110, right: 12, width: 420, maxHeight: 600, overflow: 'auto', background: 'var(--netdive-detail-bg)', zIndex: 5 }}><div>
            <Button onClick={() => setPanelGroup(undefined)}>패널 닫기</Button>
            <GroupDetailPanel node={panelGroup} visibleNodeIDs={visibleNodeIDs} nodeAttrs={node => config.nodeAttrs(node)}
                onNodeSelect={node => { const graph = ref.current as any; graph.toggleGroupChildDisplay(node); setVisibleNodeIDs(graph.groupVisibleNodeIDs()) }}
                onNodeFocus={node => { const graph = ref.current as any; graph.setGroupChildrenDisplay([node], true); graph.selectNode(node.id, true); setSelected(node.data.Name); setVisibleNodeIDs(graph.groupVisibleNodeIDs()) }}
                onNodesSelect={nodes => { const graph = ref.current as any; graph.setGroupChildrenDisplay(nodes, true); setVisibleNodeIDs(graph.groupVisibleNodeIDs()) }}
                onNodeDeselect={node => { const graph = ref.current as any; graph.setGroupChildrenDisplay([node], false); setVisibleNodeIDs(graph.groupVisibleNodeIDs()) }} />
        </div></aside>}
        <pre aria-label="회귀 검증 결과">{JSON.stringify(results, null, 2)}</pre>
        <style>{`.semantic-topology { width:100%;height:720px; }`}</style>
    </main></ConfigProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
