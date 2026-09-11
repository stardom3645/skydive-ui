import * as React from 'react'
import { Alert, Button, Input, Select, Space, Tooltip, Typography } from 'antd'
import { ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { session } from './Store'
import DetailTable from './DataPanels/common/DetailTable'
import { DetailInlineSectionHeader } from './DataPanels/common/DetailComponents'

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
    if (!response.ok) throw new Error(body.message || '최근 변경 이력을 조회하지 못했습니다.')
    return body
}

export const eventResourceLabels: Record<string, string> = {
    host: '호스트', vm: 'VM', nic: '네트워크 장치', bond: '본딩 인터페이스', bridge: '호스트 브릿지',
    switchport: '스위치 포트', k8s_cluster: 'Kubernetes 클러스터', k8s_node: 'Kubernetes 노드', pod: '파드'
}
const eventLabels: Record<string, string> = {
    state_changed: '상태 변경', link_changed: '링크 상태 변경', relation_created: '연결 생성', relation_removed: '연결 소실',
    collection_state_changed: '수집 상태 변경', manual_mapping_created: '수동 매핑 추가',
    manual_mapping_updated: '수동 매핑 수정', manual_mapping_deleted: '수동 매핑 삭제'
}
const valueLabels: Record<string, string> = {
    HEALTHY: '수집 정상', INACTIVE: '비활성', DISCONNECTED: '수집 연결 끊김', DELAYED: '수집 지연',
    AUTHENTICATION_FAILED: '인증 실패', PERMISSION_DENIED: '권한 부족', connected: '연결됨', disconnected: '연결 소실'
}

export function EventChange({ event }: { event: ChangeEvent }) {
    if (event.eventType.startsWith('manual_mapping_')) return <span>{eventLabels[event.eventType]}</span>
    const success = ['UP', 'Ready', 'Running', 'HEALTHY'].includes(event.newValue)
    const tone = event.severity === 'problem' ? 'danger' : success ? 'success' : undefined
    return <Space size={6} wrap>
        <Typography.Text type="secondary">{valueLabels[event.oldValue] || event.oldValue || '—'}</Typography.Text>
        <Typography.Text type="secondary">→</Typography.Text>
        <Typography.Text type={tone}>{valueLabels[event.newValue] || event.newValue || '—'}</Typography.Text>
    </Space>
}

/** Shared query/table can also be scoped by resourceId in a resource detail. */
export default function EventHistory({ userSession, resourceId, canNavigate, onNavigate }: {
    userSession?: session; resourceId?: string
    canNavigate: (event: ChangeEvent) => boolean; onNavigate: (event: ChangeEvent) => void
}) {
    const [hours, setHours] = React.useState(24)
    const [resourceType, setResourceType] = React.useState('')
    const [eventType, setEventType] = React.useState('')
    const [search, setSearch] = React.useState('')
    const [page, setPage] = React.useState(1)
    const [revision, refresh] = React.useState(0)
    const [data, setData] = React.useState<EventPage>({ events: [], total: 0, page: 1, pageSize: 20 })
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')
    const [range, setRange] = React.useState(() => Math.floor(Date.now() / 1000))
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
    return <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <DetailInlineSectionHeader title="변경 이력" action={<Button icon={<ReloadOutlined />} loading={loading} onClick={() => {
            setRange(Math.floor(Date.now() / 1000)); setPage(1); refresh(revision + 1)
        }}>새로고침</Button>} />
        <Space wrap size="small">
            <Select aria-label="조회 기간" value={hours} onChange={value => { setHours(value); setPage(1) }} style={{ width: 120 }}
                options={[{ value: 24, label: '최근 24시간' }, { value: 168, label: '최근 7일' }, { value: 720, label: '최근 30일' }]} />
            <Select aria-label="자원 유형" value={resourceType} onChange={value => { setResourceType(value); setPage(1) }} style={{ width: 180 }}
                options={[{ value: '', label: '모든 자원 유형' }, ...Object.keys(eventResourceLabels).map(value => ({ value, label: eventResourceLabels[value] }))]} />
            <Select aria-label="변경 유형" value={eventType} onChange={value => { setEventType(value); setPage(1) }} style={{ width: 160 }}
                options={[{ value: '', label: '모든 변경 유형' }, ...Object.keys(eventLabels).map(value => ({ value, label: eventLabels[value] }))]} />
            <Input.Search aria-label="자원 이름 검색" placeholder="자원 이름 검색" allowClear onSearch={value => { setSearch(value.trim()); setPage(1) }} style={{ width: 220 }} />
        </Space>
        {error && <Alert type="warning" showIcon message={error} />}
        <DetailTable<ChangeEvent> rowKey="id" loading={loading} dataSource={data.events} scroll={{ x: 760 }}
            locale={{ emptyText: error ? '변경 이력을 불러올 수 없습니다.' : '선택한 조건의 변경 이력이 없습니다.' }}
            pagination={{ current: page, pageSize: 20, total: data.total, showSizeChanger: false, hideOnSinglePage: true,
                onChange: setPage, showTotal: total => `전체 ${total}건` }}
            onRow={event => ({ onClick: () => { if (canNavigate(event)) onNavigate(event) } })}
            columns={[
                { title: '시간', width: 155, render: (_, event) => <Tooltip title={new Date(event.occurredAt * 1000).toLocaleString('ko-KR')}>
                    {new Date(event.occurredAt * 1000).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</Tooltip> },
                { title: '유형', width: 150, render: (_, event) => eventResourceLabels[event.resourceType] || '자원' },
                { title: '자원', ellipsis: true, render: (_, event) => <Tooltip title={event.resourceName || event.resourceId}><Typography.Text strong>{event.resourceName || event.resourceId}</Typography.Text></Tooltip> },
                { title: '변경', width: 220, render: (_, event) => <Tooltip title={eventLabels[event.eventType] || '변경'}><span><EventChange event={event} /></span></Tooltip> },
                { title: '작업', width: 78, render: (_, event) => canNavigate(event)
                    ? <Button type="link" size="small" onClick={e => { e.stopPropagation(); onNavigate(event) }}>이동<RightOutlined /></Button>
                    : <Tooltip title="현재 토폴로지에 없는 자원입니다."><Typography.Text type="secondary">—</Typography.Text></Tooltip> }
            ]} />
        <Typography.Text type="secondary">첫 수집은 기준값으로 처리하며, 이후 확인된 변경만 표시합니다. 기본 보존 기간은 30일입니다.</Typography.Text>
    </Space>
}
