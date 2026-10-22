/** Visual QA for shared typography at narrow detail-panel widths. Synthetic data only. */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Button, Segmented, Space } from 'antd'
import NetdiveAntdProvider from '../../src/NetdiveAntdProvider'
import KubernetesStorageDetailPanel from '../../src/DataPanels/KubernetesStorageDetailPanel'
import { BasicInfoRows, DetailSectionCard, DetailLongValue, RelatedResourceGrid, StatusSummaryGrid } from '../../src/DataPanels/common'
import '../../src/index.css'
import '../../src/antd-netdive.css'

const longName = 'production-storage-persistent-volume-claim-with-a-long-name-0123456789'
const node: any = { id: 'audit-pv', tags: ['kubernetes'], children: [], state: {}, data: {
    Name: 'pv-production-storage', Type: 'persistentvolume', Manager: 'k8s', ClusterName: 'audit-cluster',
    K8s: { Extra: { ObjectMeta: { Name: 'pv-production-storage', UID: 'audit-pv', CreationTimestamp: '2026-10-01T00:00:00Z' },
        Spec: { StorageClassName: 'ceph-rbd', Capacity: { storage: '100Gi' }, AccessModes: ['ReadWriteOnce'],
            PersistentVolumeReclaimPolicy: 'Retain', VolumeMode: 'Filesystem',
            ClaimRef: { Name: longName, Namespace: 'production-monitoring' }, CSI: { Driver: 'rbd.csi.ceph.com', VolumeHandle: longName } },
        Status: { Phase: 'Bound' } } } } }

function Preview() {
    const [width, setWidth] = React.useState(450)
    const [page, setPage] = React.useState('storage')
    const [modal, setModal] = React.useState(false)
    return <NetdiveAntdProvider><main style={{ padding: 20, background: '#f5f6f8', minHeight: '100vh' }}>
        <Space wrap style={{ marginBottom: 16 }}>
            <Segmented aria-label="검증 패널 너비" value={width} onChange={value => setWidth(Number(value))} options={[320, 360, 450, 500, 600]} />
            <Segmented aria-label="검증 화면" value={page} onChange={value => setPage(String(value))}
                options={[{ label: '스토리지', value: 'storage' }, { label: '공통 상세·요약', value: 'shared' }]} />
        </Space>
        <section data-audit-panel style={{ width, maxWidth: '100%', padding: 12, boxSizing: 'border-box', background: '#fff', display: 'grid', gap: 12 }}>
            {page === 'storage' ? <KubernetesStorageDetailPanel node={node} nodeAttrs={item => ({ name: item.data.Name, icon: '', classes: [] })} /> : <>
                <DetailSectionCard title="상세 정보 · 긴 항목명과 값" action={<Button size="small">전체 보기</Button>}>
                    <BasicInfoRows appearance="basic" labelWidth={122} rows={[
                        { label: '클레임 네임스페이스', value: 'production-monitoring' },
                        { label: '스토리지 클래스', value: 'ceph-rbd' },
                        { label: 'ImagePullSecrets', value: <DetailLongValue value={longName} copy /> },
                        { label: '하이퍼바이저', value: 'KVM' },
                        { label: '운영체제 & 플랫폼', value: 'Rocky Linux 9.8' },
                        { label: 'LoadBalancer Address', value: '10.10.31.10' },
                        { label: '생성 시각', value: '2026. 10. 15. 오후 2:00:00' },
                        { label: '리소스 이름', value: longName, textValue: longName, copyText: longName, wrap: true },
                    ]} />
                </DetailSectionCard>
                <DetailSectionCard title="긴 운영 상태 요약 제목과 실제 수집 기준" action={<Button size="small">상세 보기</Button>}>
                    <StatusSummaryGrid verdict="이상 없음" rawStatus="Running" impact="확인되지 않음" metrics={[
                        { label: '워크로드 컨트롤러', value: '128' }, { label: 'Control Plane', value: '3/3' },
                        { label: '할당 가능한 메모리', value: '512 GiB' }, { label: '최종 수집 시각', value: '오후 2:00:00' }]} />
                </DetailSectionCard>
                <RelatedResourceGrid title="연결 자원" groups={[{title:'Infrastructure · Kubernetes',items:[
                    {label:'워크로드 컨트롤러',count:120,icon:<span>W</span>,onClick:()=>setModal(!modal)},
                    {label:'스토리지 클래스',count:4,icon:<span>S</span>,onClick:()=>setModal(!modal)},
                    {label:longName,count:12,icon:<span>N</span>,onClick:()=>setModal(!modal)}]}]} />
            </>}
        </section>
    </main></NetdiveAntdProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
