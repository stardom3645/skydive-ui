/** Production cluster inspector with local synthetic data; no live credentials. */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Button, ConfigProvider, Select } from 'antd'
import koKR from 'antd/locale/ko_KR'
import KubernetesClusterDetailPanel from '../../src/DataPanels/KubernetesClusterDetailPanel'
import '../../src/index.css'
import '../../src/antd-netdive.css'

function Preview() {
    const [mode, setMode] = React.useState('issues')
    const [narrow, setNarrow] = React.useState(false)
    const [requests, setRequests] = React.useState('아직 확인하지 않음')
    const [navigation, setNavigation] = React.useState('')
    React.useEffect(() => {
        const previousApp = (window as any).App
        ;(window as any).App = {
            focusInfrastructureNodeIDs: (ids: string[]) => setNavigation(`관련 자원 이동: ${ids.join(', ')}`),
            focusKubernetesInfrastructureEvidenceNodeIDs: (ids: string[]) => setNavigation(`위험 근거 이동: ${ids.join(', ')}`)
        }
        return () => { (window as any).App = previousApp }
    }, [])
    const node = React.useMemo(() => {
        const cluster: any = { id: mode, children: [], data: { Manager: 'k8s', Type: 'cluster', Name: mode, ClusterID: mode } }
        const add = (id: string, type: string, extra: any) => {
            const item: any = { id, parent: cluster, children: [], data: { Manager: 'k8s', Type: type, Name: id,
                ClusterID: mode, K8s: { Namespace: 'sample-system', Extra: { ObjectMeta: { UID: id, Name: id, Namespace: 'sample-system', CreationTimestamp: { Time: new Date().toISOString() } }, ...extra } } } }
            cluster.children.push(item)
            return item
        }
        add('control-plane', 'node', { Status: { Conditions: [{ Type: 'Ready', Status: 'True' }], Allocatable: { cpu: '4', memory: '4Gi', pods: '110' } } })
        add('worker-1', 'node', { Status: { Conditions: [{ Type: 'Ready', Status: mode === 'issues' ? 'False' : 'True' }], Allocatable: { cpu: '4', memory: '4Gi', pods: '110' } } })
        add('sample-system', 'namespace', {})
        add('sample-web', 'deployment', { Spec: { Replicas: 2 }, Status: { AvailableReplicas: mode === 'issues' ? 1 : 2 } })
        add('sample-web-0', 'pod', { Spec: { NodeName: 'worker-1', Containers: [{ Name: 'web', Image: 'example/web:1' }] }, Status: { Phase: 'Running', ContainerStatuses: [{ Name: 'web', Ready: mode !== 'issues', RestartCount: 3,
            State: mode === 'issues' ? { Waiting: { Reason: 'CrashLoopBackOff' } } : { Running: {} } }] } })
        if (mode !== 'history-five') add('sample-job-completed', 'pod', { Status: { Phase: 'Succeeded', ContainerStatuses: [{ Name: 'job', State: { Terminated: { Reason: 'Completed', ExitCode: 0, FinishedAt: new Date().toISOString() } } }] } })
        if (mode === 'history-five' || mode === 'history-mixed') {
            const reasons = mode === 'history-five'
                ? ['Error', 'Error', 'Error', 'Error', 'Error']
                : ['Error', 'OOMKilled', 'DeadlineExceeded', 'NodeLost', 'Evicted', '']
            reasons.forEach((reason, index) => add(`sample-terminated-${index + 1}`, 'pod', {
                Spec: { NodeName: 'worker-1' },
                Status: { Phase: 'Failed', Reason: reason, ContainerStatuses: [{ Name: 'web', State: {
                    Terminated: { Reason: reason, ExitCode: 1, FinishedAt: new Date().toISOString() }
                } }] }
            }))
        }
        add('sample-service', 'service', { Spec: { Type: 'ClusterIP', ClusterIP: '10.0.0.10', Ports: [{ Port: 80, TargetPort: 8080 }] } })
        return cluster
    }, [mode])
    return <ConfigProvider locale={koKR} theme={{ token: { fontSize: 12 } }}>
        <main className="netdive-ant-theme" style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
            <p>클러스터 탭 검증용 샘플 · 운영 데이터가 아닙니다.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Select aria-label="검증 상태" value={mode} onChange={setMode} style={{ width: 160 }}
                    options={['issues', 'healthy', 'no-metrics', 'failed', 'history-five', 'history-mixed'].map(value => ({ value, label: value }))} />
                <Button onClick={() => fetch('/fixture-stats').then(r => r.json()).then(stats => setRequests(JSON.stringify(stats)))}>요청 횟수 확인</Button>
                <Button onClick={() => setNarrow(!narrow)}>{narrow ? '기본 너비' : '좁은 패널'}</Button>
                <span role="status">{requests}</span>
                {navigation && <span role="status">{navigation}</span>}
            </div>
            <div className="netdive-detail-panel" style={{ width: narrow ? 320 : 480, background: '#fff', padding: 16, borderRadius: 8 }}>
                <KubernetesClusterDetailPanel key={mode} node={node} session={{ endpoint: window.location.origin } as any}
                    nodeAttrs={() => ({ icon: '\uf1b3', name: '검증용 자원' })}
                    kubernetesClusters={[{ id: mode, name: mode, accountName: 'sample-account', domainName: 'ROOT/sample', version: 'v1.34.0', state: 'Running', collectionEnabled: true, cores: 8, memoryMb: 8192 }]} />
            </div>
        </main>
    </ConfigProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
