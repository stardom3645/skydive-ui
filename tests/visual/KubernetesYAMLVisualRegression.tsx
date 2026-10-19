/** Local-only synthetic Pods exercise the production detail tabs and viewer. */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Button, ConfigProvider, Select } from 'antd'
import koKR from 'antd/locale/ko_KR'
import KubernetesPodDetailPanel from '../../src/DataPanels/KubernetesPodDetailPanel'
import '../../src/index.css'
import '../../src/antd-netdive.css'

function Preview() {
    const [mode, setMode] = React.useState('sample')
    const [requests, setRequests] = React.useState<string>('아직 확인하지 않음')
    const node = React.useMemo(() => ({ id: mode, parent: null, children: [], tags: ['kubernetes'], state: { selected: true },
        data: { Name: `yaml-viewer-${mode}`, Type: 'pod', Manager: 'k8s', ClusterID: 'fixture-cluster',
            K8s: { UID: mode, Namespace: 'sample-system', Extra: { ObjectMeta: { Name: `yaml-viewer-${mode}`, Namespace: 'sample-system', UID: mode },
                Spec: { Containers: [{ Name: 'web', Image: 'example/web:1' }] }, Status: { Phase: 'Running' } } } } }), [mode])
    return <ConfigProvider locale={koKR} theme={{ token: { fontSize: 12 } }}>
        <main className="netdive-ant-theme" style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
            <p>개발 검증용 샘플 YAML · 운영 데이터가 아닙니다.</p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <Select aria-label="검증 상태" value={mode} onChange={setMode} style={{ width: 160 }}
                    options={['sample', 'empty', 'denied', 'unauthenticated', 'missing', 'timeout', 'retry', 'refresh-failure', 'slow'].map(value => ({ value, label: value }))} />
                <Button onClick={() => fetch('/fixture-stats').then(r => r.json()).then(result => setRequests(JSON.stringify(result)))}>요청 횟수 확인</Button>
                <span role="status">{requests}</span>
            </div>
            <div className="netdive-detail-panel" style={{ width: 450, background: '#fff', padding: 16, borderRadius: 8 }}>
                <KubernetesPodDetailPanel key={mode} node={node as any} nodeAttrs={() => ({ icon: '\uf1b3', name: node.data.Name })}
                    session={{ endpoint: window.location.origin } as any} kubernetesClusters={[{ id: 'fixture-cluster', name: 'fixture-cluster' }]} />
            </div>
        </main>
    </ConfigProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
