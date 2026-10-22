import * as React from 'react'
import { Alert, Button, Collapse, Descriptions, Empty, Select, Space, Spin, Tag, Tooltip, Typography } from 'antd'
import { ArrowLeftOutlined, AimOutlined, ReloadOutlined, InfoCircleOutlined, HistoryOutlined } from '@ant-design/icons'
import type { session } from './Store'
import type { Node, Link } from './Topology'
import { isExpiredLLDPLink } from './LLDPTopologyValidity'
import type { CurrentProblem } from './CurrentProblems'
import { problemResourceTypeLabel, problemStatusLabels } from './CurrentProblems'
import { problemCategory, problemCategoryLabels, problemChecklist, problemEventIdentity, problemEvidence, problemRelatedResources, problemPodCoverageNote } from './ProblemAnalysis'
import { lastCollectionTime } from './StatusSummary'
import { listChangeEvents } from './EventHistoryAPI'
import type { EventPage } from './EventHistoryAPI'
import { EventChange } from './EventHistory'
import { DetailInfoTooltip, DetailMetricSummaryRow, DetailSectionCard } from './DataPanels/common/DetailComponents'
import { DetailSectionIcon } from './DataPanels/common/DetailSectionIcon'

const colors = { problem: 'error', attention: 'warning', unavailable: 'default' } as const
export default function ProblemDetail({ entry, current, node, nodes, links, entries, connected, synced, historical, userSession, name, onBack, onNavigate, onInspect }: {
    entry: CurrentProblem; current?: CurrentProblem; node?: Node; nodes: Node[]; links: Link[]; entries: CurrentProblem[]
    connected: boolean; synced: boolean; historical: boolean; userSession?: session
    name: (node: Node) => string; onBack: () => void; onNavigate: (node: Node) => void; onInspect: (entry: CurrentProblem) => void
}) {
    const [tab, setTab] = React.useState('overview')
    const [hours, setHours] = React.useState(24)
    const [page, setPage] = React.useState(1)
    const [revision, refresh] = React.useState(0)
    const [events, setEvents] = React.useState<EventPage>({ events: [], total: 0, page: 1, pageSize: 20 })
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')
    const identity = problemEventIdentity(node || entry.node)
    const active = current || entry
    const live = connected && synced && !historical
    const problems = new Map(entries.map(problem => [problem.id, problem]))
    const refreshedRelated = node ? [node.parent, ...(node.children || []), ...links.filter(link => !isExpiredLLDPLink(link) && (link.source.id === node.id || link.target.id === node.id))
        .map(link => link.source.id === node.id ? link.target : link.source)].filter((candidate): candidate is Node => !!candidate) : []
    const related = (node ? problemRelatedResources(current || { ...entry, node, related: refreshedRelated }, nodes) : [])
        .sort((a, b) => Number(problems.has(b.node.id)) - Number(problems.has(a.node.id)))
    React.useEffect(() => {
        setEvents({ events: [], total: 0, page, pageSize: 20 }); setError('')
        if (!identity || tab !== 'events') { setLoading(false); return }
        const controller = new AbortController()
        const to = Math.floor(Date.now() / 1000)
        setLoading(true)
        listChangeEvents(userSession, { source: identity.source, resource_id: identity.resourceId, resource_type: identity.resourceType,
            from: to - hours * 3600, to, page, pageSize: 20 }, controller.signal)
            .then(result => { if (!controller.signal.aborted) setEvents(result) })
            .catch(error => { if (!controller.signal.aborted) setError(error.message) })
            .finally(() => { if (!controller.signal.aborted) setLoading(false) })
        return () => controller.abort()
    }, [identity?.resourceId, identity?.resourceType, identity?.source, userSession?.endpoint, userSession?.token, hours, page, revision, tab])
    const facts = problemEvidence(node || entry.node, nodes)
    const primaryFacts = facts.filter(fact => !fact.label.startsWith('Condition · ') && !fact.label.endsWith(' · 메시지'))
    const secondaryFacts = facts.filter(fact => fact.label.startsWith('Condition · ') || fact.label.endsWith(' · 메시지'))
    const coverageNote = node && problemPodCoverageNote(node, nodes)
    const collectionTime = lastCollectionTime(node || entry.node)
    // Presentation groups only: preserve every evidence value and its original label.
    const numericFacts = primaryFacts.filter(fact => /^\d+(?:\.\d+)?$/.test(fact.value))
    const metricFacts = numericFacts.length > 1 || numericFacts.some(fact => fact.label.includes('Replica')) ? numericFacts : []
    const stateFacts = primaryFacts.filter(fact => !metricFacts.includes(fact))
    const conclusion = current ? current.reason : node && synced ? '현재 문제 목록의 판정 대상이 아닙니다.' : entry.reason
    const overview = <>
        <DetailSectionCard className="netdive-problems__evidence" icon={<DetailSectionIcon role="operational" />}
            title={current ? '현재 판정 근거' : node && synced ? '갱신된 상태 근거' : '마지막으로 확인한 판정 근거'}
            action={<DetailInfoTooltip description="수집된 상태에 대한 판정입니다. 실제 장애 원인은 별도 확인이 필요합니다." ariaLabel="판정과 원인의 차이" />}>
            {!!metricFacts.length && <DetailMetricSummaryRow className="netdive-problems__metrics" columns={Math.min(5, metricFacts.length)}
                items={metricFacts.map(fact => ({ key: fact.label, label: fact.label, value: fact.value }))} />}
            {!!stateFacts.length && <dl className="netdive-problems__facts">{stateFacts.map((fact, i) => <div key={i}>
                <dt>{fact.label}</dt><dd>{fact.value}</dd>
            </div>)}</dl>}
            {!primaryFacts.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="추가 원본 상태값이 없습니다." />}
            {coverageNote && <div className="netdive-problems__coverage-note" role="note"><InfoCircleOutlined aria-hidden="true" />
                <div><Typography.Text strong>Pod 소유 관계 확인 범위</Typography.Text><Typography.Paragraph>{coverageNote}</Typography.Paragraph></div></div>}
            {!!secondaryFacts.length && <Collapse className="netdive-problems__raw" ghost size="small" items={[{ key: 'raw', label: 'Kubernetes Condition · 원본 메시지', children:
                <Descriptions size="small" column={1} items={secondaryFacts.map((fact, i) => ({ key: i, label: fact.label.replace('Condition · ', ''), children: fact.value }))} /> }]} />}
        </DetailSectionCard>
        <div className="netdive-problems__investigation">
            <DetailSectionCard className="netdive-problems__related-section" icon={<DetailSectionIcon role="related" />}
                title={<span>연관 자원 <span className="netdive-problems__count">{related.length}</span></span>}
                action={<DetailInfoTooltip description="확인된 계층·연결·소유·배치 관계입니다. 장애 원인이나 영향 범위를 확정한 목록은 아닙니다." ariaLabel="연관 자원 기준" />}>
                <div className="netdive-problems__relations" role="region" aria-label="연관 자원 탐색">{related.length ? related.map(({ node: resource, relation }) => {
                    const problem = problems.get(resource.id)
                    return <div key={resource.id}>
                        <div><Button type="text" size="small" onClick={() => problem ? onInspect(problem) : onNavigate(resource)}>{name(resource)}</Button>
                            <small>{problemResourceTypeLabel(resource)} · {relation}</small></div>
                        {problem && <Tag color={colors[problem.status]}>{problemStatusLabels[problem.status]}</Tag>}
                        <Tooltip title="토폴로지·객체 상세"><Button size="small" type="text" icon={<AimOutlined />} aria-label={`${name(resource)} 토폴로지·객체 상세`} onClick={() => onNavigate(resource)} /></Tooltip>
                    </div>
                }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={node ? '확인된 직접 연관 자원이 없습니다.' : '삭제된 자원의 이전 관계는 표시하지 않습니다.'} />}</div>
            </DetailSectionCard>
            <DetailSectionCard icon={<DetailSectionIcon role="policy" />} title="점검 순서"
                action={<Button size="small" disabled={!node || !synced} onClick={() => node && onNavigate(node)}>객체 상세 열기</Button>}>
                <ol className="netdive-problems__checklist">{problemChecklist(active).map(item => <li key={item}>{item}</li>)}</ol>
                <Typography.Paragraph type="secondary" className="netdive-problems__note netdive-problems__check-hint">객체 상세의 상태·이벤트{entry.type === 'pod' ? '·컨테이너 로그' : ''}를 확인하고 연관 자원으로 점검을 이어가세요.</Typography.Paragraph>
            </DetailSectionCard>
        </div>
    </>
    const historyBody = <>
        <div className="netdive-problems__history-toolbar">
            <Select aria-label="문제 변경 이력 기간" value={hours} onChange={value => { setHours(value); setPage(1) }}
                options={[{ value: 24, label: '최근 24시간' }, { value: 168, label: '최근 7일' }, { value: 720, label: '최근 30일' }]} />
            <Typography.Text type="secondary">저장된 변경 {events.total}건</Typography.Text>
            <Button size="small" icon={<ReloadOutlined />} loading={loading} disabled={!identity}
                onClick={() => refresh(value => value + 1)}>이력 새로고침</Button>
        </div>
        <Typography.Paragraph type="secondary" className="netdive-problems__note">
            상태 변경 기록입니다. 문제 발생·복구를 확정하는 이력이 아니며, 첫 수집 이전의 변경과 일부 파드·워크로드 판정 변경은 기록되지 않습니다.
            {historical && ' 변경 이력은 위 조회 기간 기준이며 과거 토폴로지 선택 시각과 별개입니다.'}
        </Typography.Paragraph>
        {error ? <Alert type="warning" showIcon title={error} /> : loading ? <div className="netdive-problems__loading"><Spin /></div>
            : !identity ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="이 자원 유형 또는 식별자로 조회할 수 있는 변경 이력이 없습니다. 객체 상세의 이벤트·로그를 확인하세요." />
                : !events.events.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="선택한 기간에 저장된 상태 변경이 없습니다. 변경 이력이 없다고 정상 상태를 의미하지는 않습니다." />
                    : <>
                        <ol className="netdive-problems__timeline">{events.events.map(event => <li key={event.id}>
                            <time>{new Date(event.occurredAt * 1000).toLocaleString('ko-KR', { hour12: false })}</time>
                            <div className="netdive-problems__event-change"><EventChange event={event} /></div>
                        </li>)}</ol>
                        {events.total > 20 && <div className="netdive-problems__history-pagination">
                            <Button size="small" disabled={page === 1} onClick={() => setPage(value => value - 1)}>이전</Button>
                            <span>{page} / {Math.ceil(events.total / 20)}</span>
                            <Button size="small" disabled={page * 20 >= events.total} onClick={() => setPage(value => value + 1)}>다음</Button>
                        </div>}
                    </>}
    </>
    return <div className="netdive-problems__analysis">
        <header className="netdive-problems__analysis-heading">
            <div className="netdive-problems__identity-row">
                <Tooltip title="문제 목록으로 돌아가기"><Button className="netdive-problems__back" type="text" icon={<ArrowLeftOutlined />} aria-label="문제 목록" onClick={onBack} /></Tooltip>
                <div className="netdive-problems__identity">
                    <div className="netdive-problems__title-line"><Typography.Title level={4}>{node ? name(node) : entry.name}</Typography.Title>
                        <Tag color={current ? colors[current.status] : 'default'}>{current ? problemStatusLabels[current.status] : !synced ? '동기화 확인 중' : !node ? '현재 자원 없음' : '목록에서 제외됨'}</Tag></div>
                    <div className="netdive-problems__metadata"><Typography.Text>{entry.typeLabel}</Typography.Text><Typography.Text type="secondary">{entry.context}</Typography.Text>
                        <Tag title="문제 분류">{problemCategoryLabels[problemCategory(active)]}</Tag></div>
                </div>
                <Button type="primary" icon={<AimOutlined />} disabled={!node || !synced} onClick={() => node && onNavigate(node)}>토폴로지에서 보기</Button>
            </div>
            <div className={`netdive-problems__problem-summary is-${current ? current.status : 'unavailable'}`}>
                <Typography.Text type="secondary">판정 사유</Typography.Text><Typography.Paragraph className="netdive-problems__conclusion">{conclusion}</Typography.Paragraph>
            </div>
            <div className="netdive-problems__observation" role="note">
                {(collectionTime !== '확인 불가' || !live || !current) && <Typography.Text type="secondary">마지막 수집 · {collectionTime}</Typography.Text>}
                {live && current && (collectionTime === '확인 불가' || current.reason.startsWith('관측값 ·')) && <span className="netdive-problems__freshness">
                    <InfoCircleOutlined aria-hidden="true" /><Typography.Text>{collectionTime === '확인 불가' ? '수집 시각 미확인 · 현재 지속 여부는 객체 상세에서 다시 확인하세요.' : '관측값 기준 · 최신 수집 여부와 현재 지속 여부를 확인하세요.'}</Typography.Text>
                </span>}
            </div>
        </header>
        {!live && <Alert showIcon type="warning" title={historical ? '과거 시점의 상태입니다.' : '현재 수집 상태를 확정할 수 없습니다.'}
            description="표시된 정보는 마지막으로 받은 데이터 기준입니다. 연결·동기화 상태를 확인하세요." />}
        {!current && synced && <Alert showIcon type="info" title={!node ? '현재 토폴로지에서 이 자원을 찾을 수 없습니다.' : '현재 문제 목록에서 제외된 자원입니다.'}
            description="상태·비활성화·수집 범위가 변경되었을 수 있습니다. 목록에서 사라진 것만으로 복구를 확정하지 않습니다." />}
        {overview}
        {identity && <Collapse className="netdive-problems__history" activeKey={tab === 'events' ? ['events'] : []}
            onChange={keys => { const expanded = keys.includes('events'); setTab(expanded ? 'events' : 'overview'); if (!expanded) setPage(1) }}
            items={[{ key: 'events', label: <Space size={8}><HistoryOutlined /><Typography.Text strong>변경 이력</Typography.Text><Typography.Text type="secondary">자원 상태 변경</Typography.Text></Space>, children: historyBody }]} />}
    </div>
}
