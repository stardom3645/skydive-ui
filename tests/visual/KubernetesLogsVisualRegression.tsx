/** Local-only visual fixture; API responses are explicitly synthetic test data. */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, Tabs } from 'antd'
import koKR from 'antd/locale/ko_KR'
import '../../src/index.css'
import '../../src/antd-netdive.css'
import KubernetesPodLogPanel from '../../src/DataPanels/KubernetesPodLogPanel'
import { DetailSectionCard } from '../../src/DataPanels/common/DetailComponents'

function Preview() {
    const [pod, setPod] = React.useState('sample')
    return <ConfigProvider locale={koKR} theme={{ token: { fontSize: 12 } }}>
        <main className="netdive-ant-theme" style={{ padding: 24, fontFamily: 'Arial, sans-serif', background: '#f5f7fa', minHeight: '100vh', boxSizing: 'border-box' }}>
            <p style={{ margin: '0 0 16px', color: '#64748b' }}>개발 검증용 샘플 로그 · 운영 데이터가 아닙니다.</p>
            <div className="netdive-detail-panel" style={{ width: 450, background: '#fff', padding: 16, borderRadius: 8 }}>
                <Tabs defaultActiveKey="overview" items={[
                    { key: 'overview', label: '개요', children: <DetailSectionCard title="워크로드 기본 정보">로그 탭을 열어 샘플을 조회합니다.</DetailSectionCard> },
                    { key: 'logs', label: '로그', children: <KubernetesPodLogPanel session={{ endpoint: window.location.origin } as any}
                        clusterID="fixture-cluster" uid={pod} namespace="sample-system" name={`web-${pod}`} containers={[{ name: 'web' }, { name: 'init', type: 'INIT' }]}
                        podSelection={{ value: pod, onChange: setPod, options: ['sample', 'calico-kube-controllers-7db6c9b5d6-long-pod-name', 'empty', 'previous-unavailable', 'previous-empty', 'denied', 'unauthenticated', 'network', 'timeout', 'retry', 'refresh-failure'].map(value => ({ value, label: `web-${value}`, title: `sample-system / web-${value}` })) }} /> }
                ]} />
            </div>
        </main>
    </ConfigProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
