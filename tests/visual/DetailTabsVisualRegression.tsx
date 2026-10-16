/** Local visual fixture for the production shared detail tabs. */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Button, ConfigProvider } from 'antd'
import { DetailNavigationTabs } from '../../src/DataPanels/common/DetailComponents'

function Example({ title, narrow = false, short = false }: { title: string; narrow?: boolean; short?: boolean }) {
    const [activeKey, setActiveKey] = React.useState('overview')
    const [compact, setCompact] = React.useState(narrow)
    const [few, setFew] = React.useState(short)
    const tabs = [{ key: 'overview', label: '개요' }, { key: 'logs', label: '로그' }]
    const more = [{ key: 'workloads', label: '워크로드', count: 7 }, { key: 'pods', label: '파드', count: 16 },
        { key: 'services', label: '서비스', count: 12 }, { key: 'ingress', label: 'Ingress', count: 0 },
        { key: 'configuration', label: '정책 및 설정', count: 1234 }, { key: 'storage', label: '스토리지', count: 3 }]
    return <section aria-label={title} style={{ width: compact ? 300 : 460, maxWidth: '100%', padding: 16, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3 style={{ margin: '0 0 12px' }}>{title}</h3>
        <DetailNavigationTabs activeKey={activeKey} tabs={few ? tabs : [...tabs, ...more.slice(0, 2)]}
            overflowTabs={few ? [] : more.slice(2)} onChange={setActiveKey} />
        <p role="status">선택: {activeKey}</p>
        <Button size="small" onClick={() => setActiveKey('storage')}>스토리지 바로 선택</Button>{' '}
        <Button size="small" onClick={() => setCompact(value => !value)}>패널 너비 변경</Button>{' '}
        <Button size="small" onClick={() => { setFew(value => !value); setActiveKey('overview') }}>탭 수 변경</Button>
    </section>
}
createRoot(document.getElementById('root')!).render(<ConfigProvider theme={{ token: { fontSize: 12, fontSizeSM: 11 } }}>
    <main style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
        <p>공통 상세 탭 개발 검증 화면</p>
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <Example title="Kubernetes 네임스페이스" />
            <Example title="Infrastructure 호스트" short />
            <Example title="좁은 패널" narrow />
        </div>
    </main>
</ConfigProvider>)
