/** Reproducible local benchmark. Synthetic resources; no production API writes. */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { Topology, LinkTagState, Node } from '../../src/Topology'
import Config from '../../src/Config'
import '../../src/index.css'
import '../../src/antd-netdive.css'

const config = new Config()
const noop = () => undefined
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
type Sample = { operation: string; cpuMs: number; firstFrameMs: number; trees: number; cards: number; commits: number; attrs: number; visible: number; signature: string; stages: Record<string, { calls: number; ms: number }> }
let current: Sample | undefined
const stages = ['renderTree', 'updateLayerCardLayouts', 'normalizeTree', 'separateTopologyLanes', 'compactVmLayerLayout',
    'compactHostSubtreeLayout', 'layoutKubernetesNamespaces', 'separateTopologyBranches', 'applyInfrastructureCompactLayout',
    'renderLevels', 'renderHieraLinks', 'renderNodes', 'renderGroups', 'renderLinks', 'renderTopologyGroupRegions',
    'renderInfrastructureVMBundles', 'syncResourceData', 'topologyLayoutCardWidth', 'topologyLayoutCardHeight']
stages.forEach(name => {
    const original = (Topology.prototype as any)[name]
    ;(Topology.prototype as any)[name] = function (...args: any[]) {
        const sample = current, start = performance.now()
        if (sample && name === 'renderTree') sample.trees++
        try { return original.apply(this, args) } finally {
            if (sample) {
                const entry = sample.stages[name] || (sample.stages[name] = { calls: 0, ms: 0 })
                entry.calls++; entry.ms += performance.now() - start
            }
        }
    }
})

function populate(graph: Topology, layer: string) {
    const add = (id: string, type: string, weight: number, parent?: Node) => {
        const node = graph.addNode(id, [layer], { Name: id, Type: type, State: 'UP',
            ...(layer === 'kubernetes' ? { Manager: 'k8s', ClusterName: 'bench-cluster', Namespace: 'bench',
                K8s: { Extra: { ObjectMeta: { UID: id, Name: id, Namespace: 'bench' },
                    Status: { Phase: 'Running', ReadyReplicas: 12, DesiredNumberScheduled: 12, NumberReady: 12 }, Spec: { Replicas: 12 } } } } : {}) }, weight)
        graph.setParent(node, parent || graph.root)
        return node
    }
    if (layer === 'kubernetes') {
        const cluster = add('bench-cluster', 'cluster', 1000)
        for (let n = 0; n < 8; n++) {
            const namespace = add(`namespace-${n}`, 'namespace', 2000, cluster)
            namespace.data.Namespace = namespace.data.Name
            for (let w = 0; w < 8; w++) {
                const workload = add(`workload-${n}-${w}`, ['deployment', 'daemonset', 'statefulset', 'job'][w % 4], 3000, namespace)
                workload.data.Namespace = namespace.data.Name
                for (let p = 0; p < 12; p++) {
                    const pod = add(`pod-${n}-${w}-${p}`, 'pod', 4000, workload)
                    pod.data.Namespace = namespace.data.Name
                    graph.addLink(`owner-${pod.id}`, workload, pod, ['ownership'], { KubernetesPodOwnershipGuide: true })
                }
            }
        }
    } else {
        for (let h = 0; h < 4; h++) {
            const host = add(`host-${h}`, 'host', 5020)
            const bridge = add(`bridge-${h}`, 'ovsbridge', 5035, host)
            for (let v = 0; v < 32; v++) {
                const vm = add(`vm-${h}-${v}`, 'libvirt', 8000, host)
                for (let i = 0; i < 3; i++) {
                    const nic = add(`nic-${h}-${v}-${i}`, 'tuntap', 9000, vm)
                    graph.addLink(`traffic-${nic.id}`, bridge, nic, ['layer2'], { Metric: { RxBytes: 2000, TxBytes: 1000 } })
                }
            }
        }
    }
}

function geometry() {
    const text = Array.from(document.querySelectorAll('g.node')).map(el => [el.id, el.getAttribute('transform')?.replace(/\s/g, ''),
        el.querySelector('.node-card-bg')?.getAttribute('width'), el.querySelector('.node-card-bg')?.getAttribute('height')].join(':')).sort().join('|')
        + Array.from(document.querySelectorAll('path.link,path.hiera-link')).map(el => `${el.id}:${el.getAttribute('d')}`).sort().join('|')
        + Array.from(document.querySelectorAll('.topology-group-regions path,.topology-namespace-region rect')).map(el =>
            ['class', 'd', 'x', 'y', 'width', 'height'].map(attr => el.getAttribute(attr)).join(':')).sort().join('|')
    let hash = 2166136261
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
    return (hash >>> 0).toString(16)
}

function Preview() {
    const graphRef = React.useRef<Topology>(null)
    const [layer, setLayer] = React.useState('kubernetes')
    const [busy, setBusy] = React.useState(false)
    const [rows, setRows] = React.useState<Sample[]>([])
    const [status, setStatus] = React.useState('준비')
    const prepare = async (target: string) => {
        setLayer(target); await frame()
        const graph = graphRef.current!
        graph.resetTree(true, true); populate(graph, target); graph.activeNodeTag(target); graph.completeTopologySync()
        setStatus('검증 장면 준비')
    }
    React.useEffect(() => {
        const graph = graphRef.current as any
        const render = graph.reactRoots.render.bind(graph.reactRoots)
        graph.reactRoots.render = (content: any, element: Element, callback?: () => void) => {
            const sample = current
            if (sample) sample.cards++
            render(content, element, () => { if (sample) sample.commits++; callback?.() })
        }
    }, [])
    const run = async (target: string) => {
        setBusy(true); setRows([]); setLayer(target)
        const graph = graphRef.current as any
        await frame()
        const measure = async (operation: string, action: () => void) => {
            const sample: Sample = { operation, cpuMs: 0, firstFrameMs: 0, trees: 0, cards: 0, commits: 0, attrs: 0, visible: 0, signature: '', stages: {} }
            setStatus(operation); await frame()
            current = sample
            const start = performance.now()
            action()
            sample.cpuMs = performance.now() - start
            await frame(); await frame()
            sample.firstFrameMs = performance.now() - start
            await pause(1100)
            sample.visible = document.querySelectorAll('g.node').length
            sample.signature = geometry()
            current = undefined
            setRows(old => [...old, sample])
        }
        for (let round = 0; round < 3; round++) {
            await measure(`${round}:refresh`, () => { graph.resetTree(true, true); populate(graph, target); graph.activeNodeTag(target); graph.completeTopologySync() })
            await measure(`${round}:expand-all`, () => graph.expandAllNodes())
            await measure(`${round}:unchanged`, () => graph.renderTree())
            const branch = Array.from(graph.nodes.values()).find((node: Node) => String(node.data.Type) === (target === 'kubernetes' ? 'deployment' : 'libvirt')) as Node
            await measure(`${round}:collapse-branch`, () => graph.expand(branch))
            await measure(`${round}:expand-branch`, () => graph.expand(branch))
            await measure(`${round}:collapse-all`, () => graph.collapseAllNodes())
        }
        setBusy(false); setStatus('완료')
    }
    return <ConfigProvider><main className="netdive-ant-theme">
        <header style={{ height: 112, padding: 12, background: '#fff' }}>
            <strong>토폴로지 성능 측정 · 합성 데이터 · {process.env.NODE_ENV}</strong>
            <button disabled={busy} onClick={() => run('kubernetes')}>Kubernetes 측정</button>
            <button disabled={busy} onClick={() => run('infrastructure')}>Infrastructure 측정</button>
            <button disabled={busy} onClick={() => graphRef.current?.expandAllNodes()}>전체 펼침 검증</button>
            <button disabled={busy} onClick={() => prepare('kubernetes')}>Kubernetes 장면 준비</button>
            <button disabled={busy} onClick={() => prepare('infrastructure')}>Infrastructure 장면 준비</button>
            <span role="status">{status}</span>
        </header>
        <Topology ref={graphRef} className="perf-topology" resourceDataEnabled={false} infrastructureVMLayout="linear"
            onClick={noop} sortNodesFnc={(a, b) => a.id.localeCompare(b.id)}
            defaultNodeTag={() => layer} defaultLinkTagMode={() => LinkTagState.Visible} groupSize={6}
            nodeAttrs={node => { if (current) current.attrs++; return config.nodeAttrs(node) }} linkAttrs={link => config.linkAttrs(link)}
            onNodeSelected={noop} onLinkSelected={noop} onLinkTagChange={noop} onNodeClicked={noop} onNodeDblClicked={noop} />
        <pre aria-label="성능 측정 결과" style={{ background: '#fff', padding: 12, fontSize: 11 }}>{JSON.stringify(rows, null, 2)}</pre>
        <style>{`.perf-topology { width:100%;height:620px; }`}</style>
    </main></ConfigProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
