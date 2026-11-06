/** Same deterministic data/actions for the frozen pre-rollback source and current source. */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Button, ConfigProvider, Space } from 'antd'
import { zoomIdentity } from 'd3-zoom'
import { Topology, LinkTagState, Node } from '../../src/Topology'
import Config from '../../src/Config'
import { createMuiTheme } from '@material-ui/core/styles'
import { styles } from '../../src/AppStyles'
import '@fortawesome/fontawesome-free/css/all.css'
import '../../src/index.css'
import '../../src/antd-netdive.css'

const variant = process.env.NETDIVE_ROLLBACK_VARIANT || 'current'
const config = new Config(), noop = () => undefined
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const tokens = Object.entries(styles(createMuiTheme()).app).reduce((all, [key, value]) => key.startsWith('--') ? { ...all, [key]: value } : all, {})
const percentile = (values: number[], p: number) => values.length ? values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] : 0
const hash = (value: any) => {
    const text = JSON.stringify(value); let valueHash = 2166136261
    for (let i = 0; i < text.length; i++) valueHash = Math.imul(valueHash ^ text.charCodeAt(i), 16777619)
    return (valueHash >>> 0).toString(16)
}
let active: any
const stages = ['renderTree', 'renderNodeContents', 'updateLayerCardLayouts', 'applyInfrastructureCompactLayout', 'updateInfrastructureTrafficRoutes']
stages.forEach(name => {
    const original = (Topology.prototype as any)[name]
    if (!original) return
    ;(Topology.prototype as any)[name] = function (...args: any[]) {
        const sample = active, start = performance.now()
        try { return original.apply(this, args) } finally {
            if (sample) {
                const stage = sample.stages[name] || (sample.stages[name] = { calls: 0, ms: 0 })
                stage.calls++; stage.ms += performance.now() - start
            }
        }
    }
})

function Preview() {
    const ref = React.useRef<Topology>(null)
    const [busy, setBusy] = React.useState(false), [status, setStatus] = React.useState('준비')
    const [rows, setRows] = React.useState<any[]>([]), [checks, setChecks] = React.useState<any[]>([])
    const sourceCounts = React.useRef({ count: 0, hash: '' })
    const populate = (count: number) => {
        const graph = ref.current! as any
        graph.clearTopologyNodeFocus(false); graph.resetTree(true, true)
        const add = (id: string, type: string, weight: number, parent?: Node) => {
            const node = graph.addNode(id, ['infrastructure'], { Name: id, Type: type, State: 'UP', CPUPercent: 23, MemoryPercent: 46 }, weight)
            graph.setParent(node, parent || graph.root); return node
        }
        for (let h = 0; h < 2; h++) {
            const host = add(`host-${h}`, 'host', 5020), bridge = add(`bridge-${h}`, 'ovsbridge', 7040, host)
            add(h ? 'scvm' : 'ccvm', 'libvirt', 7060, host); add(`router-${h}`, 'libvirt', 7070, host)
            for (const [type, weight] of [['device', 5030], ['vlan', 5040]] as const)
                for (let n = 0; n < 8; n++) add(`${type}-${h}-${n}`, type, weight, host)
            for (let v = h; v < count; v += 2) {
                const vm = add(`vm-${String(v).padStart(3, '0')}`, 'libvirt', 7080, host)
                if (v % 15 === 0) vm.data.State = 'ERROR'
                graph.recordConnectionRelation(`owner-${v}`, host, vm, { RelationType: 'ownership' })
                const nic = add(`nic-${v}`, 'tuntap', 7090, vm)
                nic.data.LastUpdateMetric = { Start: 1000, Last: 2000, RxBytes: 1024 * (v + 1), TxBytes: 512 }
                graph.recordConnectionRelation(`owner-nic-${v}`, vm, nic, { RelationType: 'ownership' })
                graph.addLink(`traffic-${v}`, bridge, nic, ['layer2'], { RelationType: 'layer2' })
            }
        }
        sourceCounts.current = { count, hash: hash({ nodes: Array.from(graph.nodes.values()).map((n: any) => [n.id, n.parent?.id, n.data]),
            links: Array.from(graph.links.values()).map((link: any) => [link.id, link.source.id, link.target.id, link.data]) }) }
        graph.activeNodeTag('infrastructure'); graph.completeTopologySync(); graph.expandAllNodes()
        graph.nodes.forEach((node: Node) => { if (node.data.Type === 'libvirt') node.state.expanded = false })
        graph.renderTree()
    }
    React.useEffect(() => { populate(30) }, [])
    const settle = async (ms = 750) => {
        const graph = ref.current as any; await pause(ms)
        const start = performance.now()
        while ((graph.semanticZoomFrame || graph.semanticFitFrame) && performance.now() - start < 12000) await pause(25)
        await frame(); await frame()
    }
    const audit = (operation: string) => {
        const graph = ref.current as any
        const nodes = Array.from(graph.d3nodes.values()).filter((n: any) => n.data.type !== 2 && n.data.wrapped !== graph.root) as any[]
        let overlaps = 0, detached = 0
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
            const a = graph.topologyEdgeBounds(nodes[i]), b = graph.topologyEdgeBounds(nodes[j])
            if (Math.abs(a.x - b.x) < (a.width + b.width) / 2 - .1 && Math.abs(a.y - b.y) < (a.height + b.height) / 2 - .1) overlaps++
        }
        document.querySelectorAll<SVGPathElement>('path.link').forEach(path => {
            const link = (path as any).__data__
            if (!path.getAttribute('d')) { detached++; return }
            const onEdge = (id: string, point: DOMPoint) => {
                const node = graph.d3nodes.get(id); if (!node) return false
                const b = graph.topologyEdgeBounds(node), dx = Math.abs(point.x - b.x), dy = Math.abs(point.y - b.y)
                return Math.abs(dx - b.width / 2) < 1 && dy <= b.height / 2 + 1 || Math.abs(dy - b.height / 2) < 1 && dx <= b.width / 2 + 1
            }
            if (!onEdge(link.source.id, path.getPointAtLength(0)) || !onEdge(link.target.id, path.getPointAtLength(path.getTotalLength()))) detached++
        })
        const dimensions = nodes.map(n => [n.data.id, graph.topologyLayoutCardWidth(n), graph.topologyLayoutCardHeight(n)]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        return { operation, ...sourceCounts.current, rendered: nodes.length, overlaps, detached, dimensionHash: hash(dimensions),
            mode: document.querySelector('.topology-scene')?.getAttribute('data-infrastructure-semantic-mode') || 'detail',
            tiles: document.querySelectorAll('.is-vm-dense').length, scale: graph.currentZoom() }
    }
    const check = (operation: string) => {
        // Capture now: React may defer a functional state updater until the next layout or dataset.
        const value = audit(operation)
        setChecks(old => [...old, value])
    }
    const measure = async (operation: string, action: () => Promise<void>) => {
        setStatus(`${sourceCounts.current.count} VM · ${operation}`); await frame()
        const sample: any = { operation, ...sourceCounts.current, stages: {}, frames: [], longTasks: [] }
        let previous = performance.now(), running = true
        const tick = (now: number) => { if (!running) return; sample.frames.push(now - previous); previous = now; requestAnimationFrame(tick) }
        requestAnimationFrame(tick)
        const observer = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')
            ? new PerformanceObserver(list => list.getEntries().forEach(entry => sample.longTasks.push(entry.duration))) : undefined
        observer?.observe({ entryTypes: ['longtask'] })
        active = sample; const start = performance.now()
        await action()
        await frame(); await frame()
        active = undefined; running = false; observer?.disconnect()
        const row = { variant, ...sourceCounts.current, operation, elapsedMs: Math.round(performance.now() - start), frames: sample.frames.length,
            p95FrameMs: +percentile(sample.frames, .95).toFixed(2), maxFrameMs: +Math.max(0, ...sample.frames).toFixed(2),
            longTaskCount: sample.longTasks.length, longTaskMs: +sample.longTasks.reduce((sum: number, ms: number) => sum + ms, 0).toFixed(2),
            treeCalls: sample.stages.renderTree?.calls || 0, treeCpuMs: +(sample.stages.renderTree?.ms || 0).toFixed(2),
            cardPasses: sample.stages.renderNodeContents?.calls || 0, stages: sample.stages,
            viewport: { width: graphWidth(), height: 720 }, audit: audit(operation) }
        setRows(old => [...old, row])
    }
    const graphWidth = () => (ref.current as any).viewSize().width
    const run = async () => {
        setBusy(true); setRows([]); setChecks([])
        const graph = ref.current as any
        for (const count of [30, 60, 100]) {
            populate(count); await settle(1200)
            for (let round = 0; round < 2; round++) {
                graph.setZoomLevel(.55, false); await settle()
                await measure(`${round}:zoom-sweep`, async () => {
                    for (const scale of [.34, .29, .25, .20, .15, .10, .22, .30, .55]) {
                        graph.setZoomLevel(scale); await settle(650)
                        check(`${round}:zoom:${scale}`)
                    }
                })
                graph.setZoomLevel(.15, false); await settle()
                await measure(`${round}:pan`, async () => {
                    const origin = graph.svg.node().__zoom
                    for (let step = 1; step <= 24; step++) {
                        const offset = Math.sin(step / 24 * Math.PI * 2) * 120
                        graph.svg.call(graph.zoom.transform, zoomIdentity.translate(origin.x + offset, origin.y + offset / 2).scale(origin.k))
                        await frame()
                    }
                    await settle(100)
                })
                graph.setZoomLevel(.55, false); await settle()
                await measure(`${round}:fit`, async () => { graph.zoomFit(); await settle(950) })
            }
            graph.selectNode('vm-000', true); await settle(100); check('selection')
            graph.toggleTopologyNodeFocus('connections', graph.d3nodes.get('vm-000'), new Set(['vm-000']))
            graph.setConnectionScope('all'); await settle(100); check('all-connections')
            graph.setConnectionScope('direct'); await settle(100); check('direct-connections')
            graph.clearTopologyNodeFocus(); graph.unselectAllNodes()
            const group = graph.groups.get('host-0_libvirt_7080')
            if (group) {
                graph.expand(group.wrapped); await settle(); check('group-collapse')
                graph.expand(graph.groups.get(group.id).wrapped); await settle(); check('group-expand')
            }
        }
        setStatus('완료'); setBusy(false)
    }
    return <ConfigProvider><main className="netdive-ant-theme" style={tokens}>
        <Space style={{ padding: 12 }}><strong>Semantic Zoom rollback · {variant} · production</strong>
            <Button disabled={busy} onClick={run}>동일 데이터 비교 실행</Button>
            <Button disabled={busy} onClick={() => (ref.current as any).zoomFit()}>화면 맞춤</Button><span role="status">{status}</span></Space>
        <Topology ref={ref} className="rollback-topology" resourceDataEnabled={false} infrastructureVMLayout="compact"
            onClick={noop} sortNodesFnc={(a, b) => a.id.localeCompare(b.id)} groupSize={6}
            defaultNodeTag={() => 'infrastructure'} defaultLinkTagMode={() => LinkTagState.EventBased}
            nodeAttrs={node => config.nodeAttrs(node)} linkAttrs={link => config.linkAttrs(link)}
            onNodeSelected={noop} onLinkSelected={noop} onLinkTagChange={noop}
            onNodeClicked={node => ref.current?.selectNode(node.id)} onNodeDblClicked={node => ref.current?.expand(node)} />
        <pre aria-label="비교 측정 결과">{JSON.stringify({ variant, rows, checks }, null, 2)}</pre>
        <style>{`.rollback-topology {width:100%;height:720px}`}</style>
    </main></ConfigProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
