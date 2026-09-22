import * as React from 'react'
import { Alert, Button, Input, Select, Tag, Tooltip } from 'antd'
import {
    ApartmentOutlined,
    SearchOutlined,
    CloudServerOutlined,
    DeploymentUnitOutlined,
    ReloadOutlined
} from '@ant-design/icons'
import { session } from './Store'
import { MANUAL_PORT_MAPPINGS_CHANGED_EVENT } from './ManualPortMappingAPI'
import DetailTable from './DataPanels/common/DetailTable'
import {
    DetailChangeDiff,
    DetailDiffTone,
    DetailEmpty,
    DetailFilterBar,
    DetailFilterField,
    DetailInlineSectionHeader,
    DetailResourceIdentity,
    DetailResultCount
} from './DataPanels/common/DetailComponents'

export interface ChangeEvent {
    id: number
    resourceType: string
    resourceId: string
    resourceName: string
    eventType: string
    oldValue: string
    newValue: string
    source: string
    severity?: string
    metadata: string
    occurredAt: number
}
export interface EventFilter {
    from?: number; to?: number; resource_type?: string; resource_id?: string
    event_type?: string; source?: string; search?: string; page?: number; pageSize?: number
}
export interface EventPage { events: ChangeEvent[]; total: number; page: number; pageSize: number }

export async function listChangeEvents(userSession: session | undefined, filter: EventFilter, signal?: AbortSignal): Promise<EventPage> {
    const params = new URLSearchParams()
    Object.keys(filter).forEach(key => { const value = (filter as any)[key]; if (value !== undefined && value !== '') params.set(key, String(value)) })
    const endpoint = userSession?.endpoint || `${window.location.protocol}//${window.location.host}`
    const response = await fetch(`${endpoint}/api/events?${params}`, {
        credentials: 'same-origin', cache: 'no-store', signal,
        headers: userSession?.token ? { 'X-Auth-Token': userSession.token } : {}
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || '이벤트를 조회하지 못했습니다.')
    return body
}

export const eventResourceLabels: Record<string, string> = {
    host: '호스트', vm: 'VM', nic: '네트워크 장치', bond: '본딩 인터페이스', bridge: '호스트 브릿지',
    switchport: '스위치 포트', k8s_cluster: 'Kubernetes 클러스터', k8s_node: 'Kubernetes 노드', pod: '파드'
}
const eventLabels: Record<string, string> = {
    state_changed: '상태 변경', link_changed: '링크 상태 변경', relation_created: 'LLDP 연결 생성', relation_removed: 'LLDP 연결 소실',
    collection_state_changed: '수집 상태 변경', manual_mapping_created: '수동 매핑 추가',
    manual_mapping_updated: '수동 매핑 수정', manual_mapping_deleted: '수동 매핑 삭제',
    manual_mapping_superseded: 'LLDP로 수동 매핑 비활성화'
}
const valueLabels: Record<string, string> = {
    HEALTHY: '수집 정상', INACTIVE: '비활성', DISCONNECTED: '수집 연결 끊김', DELAYED: '수집 지연',
    AUTHENTICATION_FAILED: '인증 실패', PERMISSION_DENIED: '권한 부족', connected: '연결됨', disconnected: '연결 소실'
}

const eventResourceIcons: Record<string, React.ReactNode> = {
    host: <CloudServerOutlined />,
    vm: <CloudServerOutlined />,
    nic: <ApartmentOutlined />,
    bond: <ApartmentOutlined />,
    bridge: <ApartmentOutlined />,
    switchport: <DeploymentUnitOutlined />,
    k8s_cluster: <DeploymentUnitOutlined />,
    k8s_node: <CloudServerOutlined />,
    pod: <DeploymentUnitOutlined />
}

const eventSourceLabels: Record<string, string> = {
    infrastructure: '인프라스트럭처',
    kubernetes: 'Kubernetes',
    lldp: 'LLDP',
    mold: 'Mold',
    manual: '수동 등록'
}

const lldpSupersedeLabels: Record<string, string> = {
    lldp_auto_match: 'LLDP 자동 연결로 전환',
    lldp_auto_port_conflict: 'LLDP가 다른 NIC를 감지해 비활성화',
    lldp_auto_nic_conflict: 'NIC가 다른 LLDP 포트에서 감지됨',
    lldp_auto_conflict: 'LLDP 연결 충돌로 비활성화'
}

export function EventChange({ event }: { event: ChangeEvent }) {
    const eventLabel = eventLabels[event.eventType] || '변경'
    if (event.eventType === 'manual_mapping_superseded') {
        return <Tag color="orange">{lldpSupersedeLabels[event.newValue] || eventLabel}</Tag>
    }
    const before = valueLabels[event.oldValue] || event.oldValue
    const after = valueLabels[event.newValue] || event.newValue
    const singleLabelEvent = event.eventType.startsWith('manual_mapping_')
        || event.eventType === 'relation_created'
        || event.eventType === 'relation_removed'
        || !before || !after || before === after
    if (singleLabelEvent) return <Tag>{eventLabel}</Tag>

    const normalizedAfter = String(event.newValue || '').toUpperCase()
    const tone = event.severity === 'problem'
        || ['DOWN', 'NOTREADY', 'FAILED', 'ERROR', 'DISCONNECTED', 'AUTHENTICATION_FAILED', 'PERMISSION_DENIED'].includes(normalizedAfter)
        ? 'problem'
        : ['UP', 'READY', 'RUNNING', 'HEALTHY', 'CONNECTED'].includes(normalizedAfter)
            ? 'success'
            : ['INACTIVE', 'STOPPED', 'DISABLED'].includes(normalizedAfter)
                ? 'inactive'
                : 'default'
    return <DetailChangeDiff before={before} after={after} afterTone={tone as DetailDiffTone} />
}

/** Shared query/table can also be scoped by resourceId in a resource detail. */
export default function EventHistory({ userSession, resourceId, canNavigate, onNavigate, renderHeader, tableClassName }: {
    userSession?: session; resourceId?: string
    canNavigate: (event: ChangeEvent) => boolean; onNavigate: (event: ChangeEvent) => void
    renderHeader?: (action: React.ReactNode) => React.ReactNode
    tableClassName?: string
}) {
    const [hours, setHours] = React.useState(24)
    const [resourceType, setResourceType] = React.useState('')
    const [eventType, setEventType] = React.useState('')
    const [search, setSearch] = React.useState('')
    const [searchDraft, setSearchDraft] = React.useState('')
    const [page, setPage] = React.useState(1)
    const [revision, refresh] = React.useState(0)
    const [data, setData] = React.useState<EventPage>({ events: [], total: 0, page: 1, pageSize: 20 })
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')
    const [range, setRange] = React.useState(() => Math.floor(Date.now() / 1000))
    React.useEffect(() => {
        let refreshTimer: number | undefined
        const handleManualMappingsChanged = () => {
            if (refreshTimer) window.clearTimeout(refreshTimer)
            // Event persistence is asynchronous. Give the writer a brief chance
            // to commit before refreshing an already-open event panel.
            refreshTimer = window.setTimeout(() => {
                setRange(Math.floor(Date.now() / 1000))
                setPage(1)
                refresh(value => value + 1)
            }, 150)
        }
        window.addEventListener(MANUAL_PORT_MAPPINGS_CHANGED_EVENT, handleManualMappingsChanged)
        return () => {
            window.removeEventListener(MANUAL_PORT_MAPPINGS_CHANGED_EVENT, handleManualMappingsChanged)
            if (refreshTimer) window.clearTimeout(refreshTimer)
        }
    }, [])
    React.useEffect(() => {
        const controller = new AbortController()
        setLoading(true); setError('')
        listChangeEvents(userSession, { from: range - hours * 3600, to: range, resource_type: resourceType,
            resource_id: resourceId, event_type: eventType, search, page, pageSize: 20 }, controller.signal)
            .then(result => { if (!controller.signal.aborted) setData(result) })
            .catch(err => { if (!controller.signal.aborted) { setError(err.message); setData({ events: [], total: 0, page, pageSize: 20 }) } })
            .finally(() => { if (!controller.signal.aborted) setLoading(false) })
        return () => controller.abort()
    }, [userSession?.endpoint, userSession?.token, range, hours, resourceType, resourceId, eventType, search, page, revision])
    const refreshAction = <Tooltip title="새로고침"><Button type="text" aria-label="새로고침"
        icon={<ReloadOutlined />} loading={loading} onClick={() => {
            setRange(Math.floor(Date.now() / 1000)); setPage(1); refresh(revision + 1)
        }} /></Tooltip>
    const periodLabel = hours === 24 ? '최근 24시간' : hours === 168 ? '최근 7일' : '최근 30일'
    return <>
        {renderHeader && renderHeader(refreshAction)}
        <div className="netdive-event-history-surface">
            <div className="netdive-detail-operation-content">
                <DetailInlineSectionHeader title="이벤트 목록" action={renderHeader ? undefined : refreshAction} />
                <DetailFilterBar className="netdive-event-history-filter-surface" search={<Input.Search className="netdive-detail-search-integrated" prefix={<SearchOutlined />}
                    aria-label="자원 이름 검색" placeholder="자원 이름 검색" allowClear value={searchDraft}
                    onChange={event => {
                        setSearchDraft(event.target.value)
                        if (!event.target.value) { setSearch(''); setPage(1) }
                    }}
                    onSearch={value => { setSearch(value.trim()); setPage(1) }} />}>
                    <DetailFilterField label="기간" width={140}>
                        <Select aria-label="조회 기간" value={hours} onChange={value => { setHours(value); setPage(1) }}
                            options={[{ value: 24, label: '최근 24시간' }, { value: 168, label: '최근 7일' }, { value: 720, label: '최근 30일' }]} />
                    </DetailFilterField>
                    <DetailFilterField label="자원 유형" width={170}>
                        <Select aria-label="자원 유형" value={resourceType} onChange={value => { setResourceType(value); setPage(1) }}
                            options={[{ value: '', label: '모든 자원 유형' }, ...Object.keys(eventResourceLabels).map(value => ({ value, label: eventResourceLabels[value] }))]} />
                    </DetailFilterField>
                    <DetailFilterField label="이벤트 유형" width={170}>
                        <Select aria-label="이벤트 유형" value={eventType} onChange={value => { setEventType(value); setPage(1) }}
                            options={[{ value: '', label: '모든 이벤트 유형' }, ...Object.keys(eventLabels).map(value => ({ value, label: eventLabels[value] }))]} />
                    </DetailFilterField>
                </DetailFilterBar>
                {error && <Alert type="warning" showIcon message={error} />}
                <div className="netdive-event-history-context-toolbar">
                    <DetailResultCount count={data.total} />
                    <div className="netdive-event-history-filter-pills" aria-label="적용된 필터">
                        <Tag>기간: {periodLabel}</Tag>
                        {resourceType && <Tag closable onClose={event => {
                            event.preventDefault()
                            setResourceType(''); setPage(1)
                        }}>자원: {eventResourceLabels[resourceType]}</Tag>}
                        {eventType && <Tag closable onClose={event => {
                            event.preventDefault()
                            setEventType(''); setPage(1)
                        }}>이벤트: {eventLabels[eventType]}</Tag>}
                        {search && <Tag closable onClose={event => {
                            event.preventDefault()
                            setSearch(''); setSearchDraft(''); setPage(1)
                        }}>검색: {search}</Tag>}
                    </div>
                </div>
                <DetailTable<ChangeEvent> className={`${tableClassName || ''} netdive-event-history-table`} rowKey="id" loading={loading} dataSource={data.events}
                showSorterTooltip={false}
                scroll={{ y: 480 }}
                locale={{ emptyText: <DetailEmpty description={error
                    ? '이력을 불러오지 못했습니다. 잠시 후 다시 조회해 보세요.'
                    : '선택한 조건의 변경이 없습니다. 상태가 실제로 바뀐 자원만 표시됩니다.'} /> }}
                pagination={{ current: page, pageSize: 20, total: data.total, showSizeChanger: false, hideOnSinglePage: true,
                    position: ['bottomRight'], showLessItems: true,
                    onChange: nextPage => setPage(nextPage), showTotal: total => `전체 ${total}건` }}
                rowClassName={event => canNavigate(event) ? 'netdive-event-history-row--navigable' : ''}
                onRow={event => canNavigate(event) ? ({
                    onClick: () => onNavigate(event),
                    onKeyDown: keyboardEvent => {
                        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') onNavigate(event)
                    },
                    tabIndex: 0
                }) : ({})}
                columns={[
                    { title: '시간', width: 145, defaultSortOrder: 'descend' as 'descend',
                        sorter: (left: ChangeEvent, right: ChangeEvent) => left.occurredAt - right.occurredAt,
                        render: (_, event) => <span className="netdive-event-history-time">
                            {new Date(event.occurredAt * 1000).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                        </span> },
                    { title: '유형', width: 170,
                        sorter: (left: ChangeEvent, right: ChangeEvent) => (eventResourceLabels[left.resourceType] || left.resourceType).localeCompare(eventResourceLabels[right.resourceType] || right.resourceType, 'ko'),
                        render: (_, event) => <DetailResourceIdentity
                        icon={eventResourceIcons[event.resourceType] || <DeploymentUnitOutlined />}
                        title={eventResourceLabels[event.resourceType] || '자원'}
                        metadata={eventSourceLabels[event.source] || event.source} /> },
                    { title: '자원',
                        sorter: (left: ChangeEvent, right: ChangeEvent) => (left.resourceName || left.resourceId).localeCompare(right.resourceName || right.resourceId, 'ko'),
                        render: (_, event) => <span className={`netdive-event-history-resource-name${canNavigate(event) ? ' netdive-event-history-resource-link' : ''}`}>
                            {event.resourceName || event.resourceId}
                        </span> },
                    { title: '이벤트', width: 190,
                        sorter: (left: ChangeEvent, right: ChangeEvent) => (eventLabels[left.eventType] || left.eventType).localeCompare(eventLabels[right.eventType] || right.eventType, 'ko'),
                        render: (_, event) => <EventChange event={event} /> }
                ]} />
            </div>
            <div className="netdive-event-history-footer">
                <Alert type="info" showIcon
                    message="첫 수집은 기준값으로 처리하며, 이후 확인된 변경만 표시합니다. 기본 보존 기간은 30일입니다." />
            </div>
        </div>
    </>
}
