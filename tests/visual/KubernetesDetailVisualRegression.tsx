import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { Button, Table } from 'antd'

import 'antd/dist/antd.css'
import '../../src/DataPanels/common/DetailComponents.css'
import {
    BasicInfoRows,
    CompactEmptyState,
    DetailMetricRow,
    DetailPanelHeader,
    DetailSectionCard,
    DetailStatusIndicator,
    HistoryModal,
    RelatedResourceGrid,
    ResourceMetricBlock,
    StatusEvidenceList,
    StatusEvidenceRow,
    StatusSummaryGrid
} from '../../src/DataPanels/common'
import {
    KubernetesDetailPreviewState,
    kubernetesDetailPreviewFixtures
} from '../../src/DataPanels/common/KubernetesDetailPreviewFixtures'

type PreviewResource = 'cluster' | 'node' | 'namespace'

const search = new URLSearchParams(window.location.search)
const requestedResource = search.get('resource')
const resource = (requestedResource === 'node' || requestedResource === 'namespace' ? requestedResource : 'cluster') as PreviewResource
const requestedState = (search.get('state') || 'normal') as KubernetesDetailPreviewState
const fixture = kubernetesDetailPreviewFixtures.find(item => item.key === requestedState) || kubernetesDetailPreviewFixtures[0]

const tone = requestedState === 'danger'
    ? 'danger'
    : requestedState === 'warning' || requestedState === 'narrow-panel'
        ? 'warning'
        : requestedState === 'normal' || requestedState === 'long-name'
            ? 'success'
            : 'default'

const resourceLabel = resource === 'cluster' ? '클러스터' : resource === 'node' ? '노드' : '네임스페이스'
const rawStatusLabel = resource === 'cluster' ? 'API 원본 상태' : resource === 'node' ? 'Kubernetes 상태' : '네임스페이스 상태'
const panelName = requestedState === 'long-name' || requestedState === 'narrow-panel'
    ? fixture.resourceName
    : resource === 'cluster'
        ? 'hwryu-k8s-test-03'
        : resource === 'node'
            ? 'k8s-hwryu-k8s-test-03-control-19f8239d263'
            : 'monitoring'

const PreviewPanel = () => {
    const [modalOpen, setModalOpen] = React.useState(false)
    const empty = requestedState === 'empty' || requestedState === 'fetch-error'
    const errorText = requestedState === 'fetch-error' ? '조회 실패' : '표시할 정보가 없습니다.'
    const metricTone = requestedState === 'danger' ? 'danger' : requestedState === 'warning' ? 'warning' : 'default'

    return (
        <main className="visual-regression-page" data-resource={resource} data-state={requestedState}>
            <section className="visual-regression-panel" style={{ width: fixture.panelWidth }}>
                <header className="visual-regression-header">
                    <DetailPanelHeader
                        title={panelName}
                        fullTitle={panelName}
                        subtitle={resource === 'cluster' ? 'CLUSTER' : resource === 'node' ? 'NODE' : 'NAMESPACE'}
                        copyValue={panelName}
                    />
                </header>

                <div className="visual-regression-content">
                    <DetailSectionCard title={`${resourceLabel} 기본 정보`} icon={<span>ⓘ</span>}>
                        <BasicInfoRows
                            density="compact"
                            labelWidth={resource === 'node' ? 122 : 116}
                            rows={[
                                { label: `${resourceLabel} 이름`, value: panelName, textValue: panelName, copyText: panelName },
                                {
                                    label: resource === 'cluster' ? '쿠버네티스 버전' : resource === 'node' ? '역할' : '상태',
                                    value: resource === 'cluster' ? 'v1.34.2' : resource === 'node' ? 'control-plane' : 'Active'
                                },
                                { label: '생성 시각', value: empty ? errorText : '2026. 7. 21. 오전 10:14:01' }
                            ]}
                        />
                    </DetailSectionCard>

                    <DetailSectionCard title={`${resourceLabel} 운영 상태`} icon={<span>◆</span>}>
                        <StatusSummaryGrid
                            verdict={fixture.verdict}
                            verdictTone={tone}
                            rawStatus={resource === 'namespace' && !empty ? 'Active' : fixture.rawStatus}
                            rawStatusLabel={rawStatusLabel}
                            impact={fixture.impact}
                            metrics={[
                                { label: resource === 'cluster' ? 'Control Plane' : resource === 'node' ? '활성 파드' : '문제 파드', value: empty ? '0' : resource === 'cluster' ? '1/1' : resource === 'node' ? '13' : '0' },
                                { label: resource === 'cluster' ? '노드' : resource === 'node' ? '문제 파드' : '영향받은 서비스', value: requestedState === 'danger' ? '2' : '0', tone: metricTone },
                                { label: resource === 'cluster' ? '파드' : resource === 'node' ? '스케줄링' : '수집 상태', value: resource === 'cluster' ? '23' : resource === 'node' ? '허용' : '수집 완료' },
                                { label: resource === 'cluster' ? '영향받은 서비스' : resource === 'node' ? 'Taint' : '실행 중 Pod', value: requestedState === 'warning' ? '1' : resource === 'namespace' ? '12' : '0', tone: metricTone }
                            ]}
                        />
                    </DetailSectionCard>

                    <DetailSectionCard title="리소스 현황" icon={<span>▤</span>}>
                        {empty
                            ? <CompactEmptyState description={errorText} compact />
                            : <div className="visual-regression-metrics">
                                <ResourceMetricBlock title="CPU">
                                    <DetailMetricRow primary label="현재 사용량" value="0.57 / 4 Core" ratio="14.4%" progressPercent={14.4} />
                                    <DetailMetricRow muted label="설정된 Requests 합계" value="1.46 Core" ratio="36.5%" progressPercent={36.5} />
                                </ResourceMetricBlock>
                                <ResourceMetricBlock title="메모리">
                                    <DetailMetricRow primary label="현재 사용량" value="3.2 / 3.65 GiB" ratio="87.8%" progressPercent={87.8} progressColor="#f79009" />
                                    <DetailMetricRow muted label="설정된 Requests 합계" value="0.68 GiB" ratio="18.7%" progressPercent={18.7} />
                                </ResourceMetricBlock>
                            </div>}
                    </DetailSectionCard>

                    <DetailSectionCard title={resource === 'cluster' ? '위험 및 복원력' : resource === 'node' ? '위험 및 종속성' : '가용성'} icon={<span>!</span>}>
                        <StatusEvidenceList>
                            <StatusEvidenceRow
                                title={resource === 'namespace' ? '예약된 노드' : '현재 장애 영향도'}
                                evidence={resource === 'namespace' ? '실행 중인 Pod가 배치된 고유 노드 수입니다.' : '현재 상태 기준 · 실제 영향 지표'}
                                state={<DetailStatusIndicator tone={tone}>{fixture.verdict}</DetailStatusIndicator>}
                                value={resource === 'namespace' ? '2' : requestedState === 'danger' ? '80 / 100' : '0 / 100'}
                                valueVariant={resource === 'namespace' ? 'number' : 'score'}
                                tone={tone}
                            />
                            <StatusEvidenceRow
                                title={resource === 'cluster' ? '네트워크 복원력' : resource === 'node' ? '로컬 스토리지 의존 워크로드' : 'Pod 배치'}
                                evidence={resource === 'namespace' ? '실행 중인 Pod의 노드 분산 상태입니다.' : '단일 경로 비율 100% · 연결 스위치 1대'}
                                state={<DetailStatusIndicator tone="warning">보완 권장</DetailStatusIndicator>}
                                value={resource === 'namespace' ? '집중' : '매우 낮음'}
                                valueVariant="grade"
                                tone="warning"
                            />
                        </StatusEvidenceList>
                    </DetailSectionCard>

                    <RelatedResourceGrid
                        title="연결 자원"
                        icon={<span>⌘</span>}
                        groups={[{
                            title: 'Kubernetes',
                            items: [
                                { label: '워크로드 컨트롤러', count: 15, icon: <span>W</span>, onClick: () => undefined },
                                { label: 'StorageClass', count: 1, icon: <span>S</span>, onClick: () => undefined },
                                { label: panelName, count: 2, icon: <span>R</span>, onClick: () => undefined }
                            ]
                        }]}
                    />

                    <DetailSectionCard
                        title="최근 이벤트"
                        action={<Button type="link" size="small" onClick={() => setModalOpen(true)}>목록 보기</Button>}>
                        <CompactEmptyState description={empty ? errorText : '최근 발생한 중요 이벤트가 없습니다.'} compact />
                    </DetailSectionCard>
                </div>
            </section>

            <HistoryModal
                title={`${resourceLabel} 이벤트`}
                visible={modalOpen}
                width={Math.min(900, window.innerWidth * 0.8)}
                onCancel={() => setModalOpen(false)}>
                <Table
                    className="netdive-detail-table"
                    tableLayout="fixed"
                    pagination={false}
                    dataSource={[{
                        key: '1',
                        pod: 'monitoring/prometheus-k8s-prom-kube-prometheus-s-prometheus-0',
                        node: 'k8s-hwryu-k8s-test-03-control-19f8239d263'
                    }]}
                    columns={[
                        { title: 'Pod', dataIndex: 'pod', width: '55%' },
                        { title: 'Node', dataIndex: 'node', width: '45%' }
                    ]}
                />
            </HistoryModal>
        </main>
    )
}

ReactDOM.render(<PreviewPanel />, document.getElementById('root'))
