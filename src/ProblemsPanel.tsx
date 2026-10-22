import * as React from 'react'
import { Alert, Button, Card, ConfigProvider, Empty, Input, Segmented, Select, Statistic, Tag, Tooltip, Typography } from 'antd'
import { AimOutlined, ApartmentOutlined, CloudServerOutlined, DatabaseOutlined, DeploymentUnitOutlined, InfoCircleOutlined, ReloadOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons'
import type { Node, Link } from './Topology'
import { CurrentProblem, currentProblems, currentProblemCounts, defaultProblemFilters, filterCurrentProblems, ProblemFilters, problemStatusLabels } from './CurrentProblems'
import DetailTable from './DataPanels/common/DetailTable'
import { DetailResourceIdentity } from './DataPanels/common/DetailComponents'
import type { session } from './Store'
import { problemCategory, problemCategoryLabels, ProblemCategory, problemScopeGroups } from './ProblemAnalysis'
import ProblemDetail from './ProblemDetail'
import './ProblemsPanel.css'

interface Props {
    suspended?: boolean
    nodes: Node[]
    links: Link[]
    connected: boolean
    synced: boolean
    historical: boolean
    name: (node: Node) => string
    infrastructureStatus: (node: Node) => { kind: string; label: string }
    onNavigate: (node: Node) => void
    onRefresh: () => void
    renderHeader: (action: React.ReactNode) => React.ReactNode
    tableClassName?: string
    userSession?: session
    listRevision?: number
}
const colors = { problem: 'error', attention: 'warning', unavailable: 'default' } as const
const icons = { all: <DatabaseOutlined />, problem: <WarningOutlined />, attention: <InfoCircleOutlined />, unavailable: <CloudServerOutlined /> }
const summaryHelp = {
    all: '현재 검색·필터 범위의 문제·확인 필요·수집 상태 확인 자원을 중복 없이 합산합니다.',
    problem: '기존 판정 기준에서 비정상 상태가 확인된 자원입니다. 동일 자원의 여러 이상 조건은 한 번 집계합니다.',
    attention: '사용 중인 연결 경로의 Down, 경고 또는 수집된 상태만으로 정상 여부를 확정하기 어려운 자원입니다.',
    unavailable: '수집 실패·만료·상태 데이터 누락 등이 확인된 자원입니다. 수집 시각 미확인만으로는 이 항목에 포함하지 않습니다.'
}

function ProblemsPanel(props: Props) {
    const [filters, setFilters] = React.useState<ProblemFilters>({ ...defaultProblemFilters })
    const [selected, setSelected] = React.useState<CurrentProblem | undefined>()
    const [category, setCategory] = React.useState<ProblemCategory | ''>('')
    const [view, setView] = React.useState('resources')
    const [page, setPage] = React.useState(1)
    const bodyRef = React.useRef<HTMLDivElement>(null)
    const listScroll = React.useRef(0)
    const inspect = (entry: CurrentProblem) => {
        if (!selected) listScroll.current = bodyRef.current?.scrollTop || 0
        setSelected(entry)
    }
    React.useLayoutEffect(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = selected ? 0 : listScroll.current
    }, [selected?.id])
    React.useEffect(() => { setSelected(undefined) }, [props.listRevision])
    const entries = React.useMemo(() => currentProblems(props.nodes, props.links, props.name, props.infrastructureStatus),
        [props.nodes, props.links, props.name, props.infrastructureStatus])
    const categorized = category ? entries.filter(entry => problemCategory(entry) === category) : entries
    const scoped = filterCurrentProblems(categorized, { ...filters, status: 'all' })
    const counts = currentProblemCounts(scoped)
    const filtered = filterCurrentProblems(categorized, filters)
    React.useEffect(() => {
        const lastPage = Math.max(1, Math.ceil(filtered.length / 10))
        if (page > lastPage) setPage(lastPage)
    }, [filtered.length, page])
    const groups = problemScopeGroups(filtered)
    const domainEntries = entries.filter(entry => filters.domain === 'all' || entry.domain === filters.domain)
    const typeOptions = Array.from(new Map(domainEntries.map(entry => [entry.type, entry.typeLabel])).entries())
        .sort((a, b) => a[1].localeCompare(b[1], 'ko')).map(([value, label]) => ({ value, label }))
    const scopes = Array.from(new Set(domainEntries.map(entry => entry.scope).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'))
    const activeFilters = filters.status !== 'all' || filters.domain !== 'all' || !!filters.type || !!filters.scope || !!filters.query.trim() || !!category
    const update = (values: Partial<ProblemFilters>) => { setPage(1); setFilters(current => ({ ...current, ...values })) }
    const empty = !props.connected ? '서버 연결을 복구한 뒤 문제 상태를 다시 확인하세요.'
        : !props.synced ? '토폴로지 상태를 불러오고 있습니다.'
            : activeFilters ? '조건에 맞는 문제 자원이 없습니다.' : '현재 로드된 토폴로지에 표시할 문제 자원이 없습니다.'
    const countNote = <span className="netdive-problems__count-note"><InfoCircleOutlined /><span>소속별 집계는 문제 자원 수이며, 같은 원인으로 묶인 장애 건수가 아닙니다.</span></span>
    const currentPageSize = view === 'scopes' ? groups.length : filtered.length
    return <>
        <div className={`netdive-problems__page-header${selected ? ' is-detail' : ''}`}>{props.renderHeader(<Button icon={<ReloadOutlined />} onClick={props.onRefresh} disabled={!props.connected}
            loading={props.connected && !props.synced}>다시 동기화</Button>)}</div>
        <ConfigProvider componentSize="middle">
        <div ref={bodyRef} className={`netdive-problems${selected ? ' is-detail' : ' is-list'}`}>
            {selected ? <ProblemDetail key={selected.id} entry={selected} current={entries.find(entry => entry.id === selected.id)}
                node={props.nodes.find(node => node.id === selected.id)} nodes={props.nodes} links={props.links} entries={entries} connected={props.connected} synced={props.synced}
                historical={props.historical} userSession={props.userSession} name={props.name}
                onBack={() => setSelected(undefined)} onNavigate={props.onNavigate} onInspect={inspect} /> : <>
            {!props.connected && <Alert type="warning" showIcon title="서버 연결이 끊겼습니다."
                description="아래 목록은 마지막으로 수신한 상태입니다. 현재 정상·장애 여부를 확정할 수 없습니다." />}
            {props.historical && <Alert type="info" showIcon title="과거 시점의 토폴로지를 보고 있습니다. 현재 운영 상태와 다를 수 있습니다." />}
            <div className="netdive-problems__summary" aria-label="문제 자원 요약">
                {(['all', 'problem', 'attention', 'unavailable'] as const).map(status => <Card key={status}
                    classNames={{ root: `netdive-problems__counter is-${status}${filters.status === status ? ' is-selected' : ''}`, body: 'netdive-problems__counter-body' }} hoverable role="button" tabIndex={0}
                    aria-label={`${status === 'all' ? '전체 문제 자원' : problemStatusLabels[status]} ${props.synced || entries.length ? counts[status] : '—'}`}
                    aria-pressed={filters.status === status} onClick={() => update({ status })}
                    onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault(); update({ status })
                        }
                    }}>
                    <span className="netdive-problems__counter-icon" aria-hidden="true">{icons[status]}</span>
                    <div className="netdive-problems__counter-text">
                        <Tooltip title={summaryHelp[status]}><Typography.Text className="netdive-problems__counter-title">
                            {status === 'all' ? '전체 문제 자원' : problemStatusLabels[status]}
                        </Typography.Text></Tooltip>
                        <Statistic value={props.synced || entries.length ? counts[status] : '—'} />
                    </div>
                </Card>)}
            </div>
            <div className="netdive-problems__surface">
                <section className="netdive-problems__filter-area" aria-label="문제 검색 및 필터">
                <div className="netdive-problems__toolbar">
                    <Segmented<ProblemFilters['domain']> aria-label="문제 영역" value={filters.domain}
                        onChange={domain => update({ domain, type: '', scope: '' })}
                        options={[{ label: '전체', value: 'all' }, { label: '인프라스트럭처', value: 'infrastructure' }, { label: 'Kubernetes', value: 'kubernetes' }]} />
                    <Input allowClear prefix={<SearchOutlined />} aria-label="문제 검색" placeholder="자원 이름, 문제 사유, 소속 검색"
                        value={filters.query} onChange={event => update({ query: event.target.value })} />
                </div>
                <div className="netdive-problems__filters">
                    <Select aria-label="문제 자원 유형" value={filters.type} onChange={type => update({ type })}
                        options={[{ value: '', label: '모든 자원 유형' }, ...typeOptions]} />
                    <Select aria-label="문제 소속" showSearch value={filters.scope} onChange={scope => update({ scope })}
                        optionFilterProp="label" options={[{ value: '', label: '모든 클러스터·호스트' }, ...scopes.map(value => ({ value, label: value }))]} />
                    <Select aria-label="문제 분류" value={category} onChange={value => { setCategory(value); setPage(1) }}
                        options={[{ value: '', label: '모든 문제 분류' }, ...Object.entries(problemCategoryLabels).map(([value, label]) => ({ value, label }))]} />
                    {activeFilters && <Button type="text" size="small" onClick={() => { setFilters({ ...defaultProblemFilters }); setCategory(''); setPage(1) }}>필터 초기화</Button>}
                </div>
                </section>
                <div className="netdive-problems__view-toolbar">
                    <Segmented aria-label="문제 목록 보기 방식" value={view} onChange={setView}
                        options={[{ value: 'resources', label: '자원별' }, { value: 'scopes', label: `소속별 · ${groups.length}` }]} />
                    <div className="netdive-problems__query-info">
                        <Typography.Text type="secondary" role="status" aria-live="polite">조회 {filtered.length}개 <span aria-hidden="true">|</span> 현재 범위 {scoped.length}개</Typography.Text>
                        <Tooltip title="검색·영역·유형·소속·분류 조건을 적용한 자원 수입니다. 상태 필터는 표에만 적용됩니다. 여러 이상 조건이 있어도 자원은 한 번 집계하며, 같은 원인의 장애 건수를 의미하지 않습니다. 자원 이름을 누르면 판정 근거와 점검 순서를 확인할 수 있습니다.">
                            <InfoCircleOutlined aria-label="문제 집계 및 탐색 안내" tabIndex={0} />
                        </Tooltip>
                    </div>
                </div>
                <div className="netdive-problems__table">
                {view === 'scopes' ? <DetailTable rowKey="key" className={props.tableClassName} dataSource={groups}
                    scroll={{ x: 800, y: 'min(48vh, 420px)' }}
                    pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false, size: 'small', showTotal: () => countNote }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} /> }} columns={[
                        { title: '클러스터·호스트', key: 'scope', render: (_, group) => <Tooltip title={group.scope || '소속 정보 없음'}><Button type="link" className="netdive-problems__scope-link"
                            disabled={!group.scope} onClick={() => { update({ scope: group.scope, domain: group.domain as ProblemFilters['domain'] }); setView('resources') }}>{group.scope || '소속 정보 없음'}</Button></Tooltip> },
                        { title: '영역', key: 'domain', width: 120, render: (_, group) => group.domain === 'kubernetes' ? 'Kubernetes' : '인프라스트럭처' },
                        { title: '문제 자원', key: 'total', width: 80, render: (_, group) => group.entries.length },
                        { title: '상태 분포', key: 'counts', width: 230, render: (_, group) => {
                            const counts = currentProblemCounts(group.entries)
                            return <div className="netdive-problems__distribution">{(['problem', 'attention', 'unavailable'] as const).filter(status => counts[status] > 0)
                                .map(status => <Tag key={status} color={colors[status]}>{problemStatusLabels[status]} {counts[status]}</Tag>)}</div>
                        } }
                    ]} /> :
                <DetailTable<CurrentProblem> rowKey="id" className={props.tableClassName} dataSource={filtered}
                    loading={props.connected && !props.synced} showSorterTooltip={false} scroll={{ x: 960, y: 'min(48vh, 420px)' }}
                    pagination={{ current: page, onChange: setPage, pageSize: 10, hideOnSinglePage: true, showSizeChanger: false, size: 'small', showTotal: () => countNote, placement: ['bottomEnd'] }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} /> }}
                    rowClassName={entry => `netdive-problems__row is-${entry.status}`}
                    columns={[
                        { title: '상태', key: 'status', width: 112, render: (_, entry) => <Tag color={colors[entry.status]}>{problemStatusLabels[entry.status]}</Tag> },
                        { title: '문제 사유', dataIndex: 'reason', key: 'reason', width: 230,
                            render: (reason, entry) => <div className="netdive-problems__reason"><Tooltip title={reason}><strong>{reason}</strong></Tooltip>
                                <Tooltip title={`${problemCategoryLabels[problemCategory(entry)]}${entry.collectedAt === '확인 불가' ? ' · 수집 시각 미확인' : ''}`}>
                                    <span>{problemCategoryLabels[problemCategory(entry)]}{entry.collectedAt === '확인 불가' && ' · 수집 시각 미확인'}</span>
                                </Tooltip></div> },
                        { title: '자원', key: 'resource', width: 220, sorter: (a, b) => a.name.localeCompare(b.name, 'ko'),
                            render: (_, entry) => <Tooltip title={`${entry.name} · ${entry.typeLabel}`}><button type="button" className="netdive-problems__resource" onClick={() => inspect(entry)}>
                                <DetailResourceIdentity icon={entry.domain === 'kubernetes' ? <DeploymentUnitOutlined /> : <ApartmentOutlined />}
                                    title={entry.name} metadata={entry.typeLabel} />
                            </button></Tooltip> },
                        { title: '클러스터·호스트 / 네임스페이스', key: 'context', width: 238,
                            render: (_, entry) => <div className="netdive-problems__context" title={entry.context}>
                                <Tooltip title={entry.scope || '소속 정보 없음'}><span>{entry.scope || '소속 정보 없음'}</span></Tooltip>
                                {entry.namespace && <Tooltip title={`네임스페이스 · ${entry.namespace}`}><small>네임스페이스 · {entry.namespace}</small></Tooltip>}
                            </div> },
                        { title: '탐색', key: 'details', width: 160, render: (_, entry) => <Button size="small" type="text"
                            className="netdive-problems__navigate" icon={<AimOutlined />}
                            aria-label={`${entry.name} 토폴로지에서 보기`} onClick={() => props.onNavigate(entry.node)}>토폴로지에서 보기</Button> }
                    ]} />}
                </div>
                {currentPageSize <= 10 && <div className="netdive-problems__footer">{countNote}</div>}
            </div>
            </>}
        </div>
    </ConfigProvider>
    </>
}

// Keep navigation/filter state mounted behind the topology, but don't rebuild
// the hidden table on every pan/zoom or graph update. Opening always accepts
// the latest graph props, including recovery/deletion and connection status.
export default React.memo(ProblemsPanel, (_previous, next) => next.suspended === true)
