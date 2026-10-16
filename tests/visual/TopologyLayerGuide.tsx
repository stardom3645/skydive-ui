/** Interactive checks of the production guide and camera; no backend calls. */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Topology, Node, LinkTagState } from '../../src/Topology'
import Config from '../../src/Config'
import '@fortawesome/fontawesome-free/css/all.min.css'
import '../../src/index.css'
import '../../src/antd-netdive.css'
const config = new Config(), noop = () => undefined
const layers = {
    kubernetes: [[3010, 'cluster', '쿠버네티스 클러스터'], [3020, 'node', '쿠버네티스 노드'],
        [3030, 'namespace', '쿠버네티스 네임스페이스'], [3035, 'deployment', '쿠버네티스 워크로드'],
        [3040, 'pod', '쿠버네티스 파드'], [3070, 'persistentvolumeclaim', '쿠버네티스 스토리지']],
    infrastructure: [[5015, 'switch', '스위치'], [5018, 'switchport', '스위치 포트'], [5020, 'host', '호스트'],
        [5030, 'device', 'NIC'], [5035, 'bridge', '호스트 브릿지'], [5040, 'vlan', 'VLAN'],
        [7040, 'bridge', '가상 브릿지'], [7060, 'libvirt', '시스템 가상머신'], [7070, 'libvirt', '가상 라우터'], [7080, 'libvirt', '사용자 가상머신']]
} as const
function Preview() {
    const graph = React.useRef<Topology>(null)
    const [layer, setLayer] = React.useState<'kubernetes' | 'infrastructure'>('kubernetes')
    const [zoom, setZoom] = React.useState(.55)
    const [ready, setReady] = React.useState(false)
    React.useEffect(() => {
        const value = graph.current!
        value.resetTree(true, true)
        value.weightTitles = new Map<number, string>()
        layers[layer].forEach(([weight, , title]) => value.weightTitles.set(weight, title))
        let parent: Node | undefined
        layers[layer].forEach(([weight, type, title]) => {
            const item = value.addNode(`guide-${weight}`, [layer], { Name: title, Type: type, State: 'UP',
                ...(layer === 'kubernetes' ? { Manager: 'k8s', K8s: { Extra: { ObjectMeta: { UID: `guide-${weight}` }, Status: { Phase: 'Running' } } } } : {}) }, weight)
            value.setParent(item, parent || value.root)
            parent = item
        })
        value.activeNodeTag(layer); value.expandAllNodes(); value.completeTopologySync()
        // Wait for the normal layout transition, then expose explicit camera controls.
        setReady(false)
        const timer = setTimeout(() => { value.setZoomLevel(.28, false); setReady(true) }, 1200)
        return () => clearTimeout(timer)
    }, [layer])
    return <main className="netdive-ant-theme">
        <header style={{ padding: 12, height: 90 }}>
            <button onClick={() => setLayer('kubernetes')}>Kubernetes</button>
            <button onClick={() => setLayer('infrastructure')}>Infrastructure</button>
            {[10, 20, 28, 40, 55, 80, 100].map(percent => <button disabled={!ready} key={percent}
                onClick={() => graph.current!.setZoomLevel(percent / 100, false)}>{percent}%</button>)}
            <button disabled={!ready} onClick={() => graph.current!.selectNode(`guide-${layers[layer][3][0]}`)}>중간 계층 선택</button>
            <span role="status">{ready ? '준비 완료' : '배치 중'} · {Math.round(zoom * 100)}%</span>
        </header>
        <Topology ref={graph} className="guide-preview" resourceDataEnabled={false} infrastructureVMLayout="linear"
            onClick={noop} sortNodesFnc={(a, b) => a.id.localeCompare(b.id)} groupThreshold={1000}
            defaultNodeTag={() => layer} defaultLinkTagMode={() => LinkTagState.Visible}
            nodeAttrs={node => config.nodeAttrs(node)} linkAttrs={link => config.linkAttrs(link)} onZoomChange={setZoom}
            onNodeSelected={noop} onLinkSelected={noop} onLinkTagChange={noop} onNodeClicked={noop} onNodeDblClicked={noop} />
        <style>{`.guide-preview { height:620px; width:100%; }`}</style>
    </main>
}
createRoot(document.getElementById('index')!).render(<Preview />)
