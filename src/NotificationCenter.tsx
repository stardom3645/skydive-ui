import * as React from 'react'
import { Alert, Button, ConfigProvider, Empty, List, Popover, Space, Spin, Tooltip, Typography } from 'antd'
import { BellOutlined, InfoCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, InfoCircleFilled, CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import { listChangeEvents } from './EventHistoryAPI'
import type { ChangeEvent } from './EventHistoryAPI'
import type { session } from './Store'
import type { MoldIntegrationHealth } from './MoldIntegrationHealth'
import { notificationKey, notificationStorageKey, readNotificationCenterState, saveNotificationCenterState } from './NotificationCenterState'
import type { NotificationCenterState } from './NotificationCenterState'
import { APP_NOTIFICATION_EVENT, mergeNotificationHistory, readNotificationHistory } from './NotificationHistory'
import type { AppNotification } from './NotificationHistory'
import './NotificationCenter.css'

/** Shared banner history, supplemented by persisted server integration events. */
export default function NotificationCenter({ userSession, health }: {
    userSession?: session; health?: MoldIntegrationHealth
}) {
    const [open, setOpen] = React.useState(false)
    const [revision, refresh] = React.useState(0)
    const scope = notificationStorageKey(userSession?.endpoint || window.location.origin, userSession?.username || '')
    const [result, setResult] = React.useState<{ scope: string; events: ChangeEvent[] }>({ scope, events: [] })
    const [local, setLocal] = React.useState(() => ({ scope, items: readNotificationHistory(scope) }))
    const events = mergeNotificationHistory(local.scope === scope ? local.items : readNotificationHistory(scope), result.scope === scope ? result.events : [])
    React.useEffect(() => {
        setLocal({ scope, items: readNotificationHistory(scope) })
        const receive = (event: Event) => {
            const detail = (event as CustomEvent<{ scope: string; item: AppNotification }>).detail
            if (detail?.scope !== scope || !detail.item) return
            setLocal(previous => ({ scope, items: [detail.item, ...(previous.scope === scope ? previous.items : [])].slice(0, 100) }))
        }
        window.addEventListener(APP_NOTIFICATION_EVENT, receive)
        return () => window.removeEventListener(APP_NOTIFICATION_EVENT, receive)
    }, [scope])
    const [stored, setStored] = React.useState(() => ({ scope, value: readNotificationCenterState(scope) }))
    const preferences = stored.scope === scope ? stored.value : readNotificationCenterState(scope)
    const [undo, setUndo] = React.useState<{ scope: string; value: NotificationCenterState } | undefined>(undefined)
    const visibleEvents = events.filter(event => !preferences.dismissed.includes(notificationKey(event)) && !event.aliases?.some(key => preferences.dismissed.includes(key)))
    const save = (value: NotificationCenterState) => {
        saveNotificationCenterState(scope, value)
        setStored({ scope, value })
    }
    const organize = (items: AppNotification[]) => {
        setUndo({ scope, value: preferences })
        save({ ...preferences, dismissed: Array.from(new Set([...preferences.dismissed, ...items.reduce<string[]>((keys, item) => keys.concat(notificationKey(item), item.aliases || []), [])])) })
    }
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')
    React.useEffect(() => {
        if (!open) return
        const controller = new AbortController()
        setLoading(true); setError('')
        // The event writer is asynchronous; allow it to commit a just-observed transition.
        const timer = window.setTimeout(() => {
            const to = Math.floor(Date.now() / 1000)
            listChangeEvents(userSession, { from: to - 7 * 86400, to, resource_type: 'integration',
                resource_id: 'mold-api', event_type: 'integration_state_changed', source: 'mold', page: 1, pageSize: 20 }, controller.signal)
                .then(result => { if (!controller.signal.aborted) setResult({ scope, events: result.events }) })
                .catch(err => { if (!controller.signal.aborted) setError(err.message) })
                .finally(() => { if (!controller.signal.aborted) setLoading(false) })
        }, 150)
        return () => { window.clearTimeout(timer); controller.abort() }
    }, [open, revision, userSession?.endpoint, userSession?.token, health?.state, scope])
    const content = <section className="netdive-notifications" role="dialog" aria-label="알림 내역">
        <header className="netdive-notifications__header">
            <Space size={4}>
                <Typography.Text strong>알림</Typography.Text>
                <Tooltip title="최근 7일의 접속 상태·작업 결과 알림을 최대 20건 표시합니다. 배너 이력은 이 브라우저에 보관되며 자원·연동 상태 변경을 기록하는 이벤트와는 구분됩니다. 정리하기는 표시 목록만 정리하며 서버 이벤트 원본은 삭제하지 않습니다. 서버 로그의 실제 보관 기간은 서버 설정을 따릅니다.">
                    <Button type="text" size="small" icon={<InfoCircleOutlined />} aria-label="알림 안내" />
                </Tooltip>
            </Space>
            <Space size={0}>
                <Button type="text" size="small" icon={<ReloadOutlined />} aria-label="알림 새로고침"
                    disabled={loading} onClick={() => refresh(value => value + 1)} />
                <Button type="text" size="small" disabled={!visibleEvents.length || loading} onClick={() => organize(visibleEvents)}>정리하기</Button>
                <Button type="text" size="small" icon={<CloseOutlined />} aria-label="알림 닫기" onClick={() => setOpen(false)} />
            </Space>
        </header>
        {undo?.scope === scope && <div className="netdive-notifications__undo" role="status">
            <Typography.Text type="secondary">알림 목록을 정리했습니다.</Typography.Text>
            <Button type="link" size="small" onClick={() => { save(undo.value); setUndo(undefined) }}>실행 취소</Button>
        </div>}
        <div className="netdive-notifications__list" aria-busy={loading}>
            {error && <Alert type="warning" showIcon title="서버 이벤트 이력을 불러오지 못했습니다" description={error} />}
            {loading && !visibleEvents.length ? <div className="netdive-notifications__empty" role="status"><Spin size="small" /><span>알림을 불러오는 중입니다.</span></div>
                : !visibleEvents.length && !error ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="표시할 알림이 없습니다." />
                : <ConfigProvider theme={{ components: { List: { itemPaddingSM: '8px 0', avatarMarginRight: 8, titleMarginBottom: 2, descriptionFontSize: 11 } } }}>
                    <List<AppNotification> size="small" locale={{ emptyText: null }} dataSource={visibleEvents} rowKey={notificationKey} renderItem={event => <List.Item>
                        <List.Item.Meta
                            avatar={event.tone === 'success' ? <CheckCircleOutlined className="netdive-notifications__success" />
                                : event.tone === 'error' ? <CloseCircleOutlined className="netdive-notifications__error" />
                                    : event.tone === 'warning' ? <ExclamationCircleOutlined className="netdive-notifications__warning" />
                                        : <InfoCircleFilled className="netdive-notifications__info" />}
                            title={<Typography.Text strong className="netdive-notifications__title">{event.title}</Typography.Text>}
                            description={<>
                                {event.description && <Typography.Paragraph type="secondary" className="netdive-notifications__description" ellipsis={{ rows: 2, tooltip: event.description }}>{event.description}</Typography.Paragraph>}
                                <time dateTime={new Date(event.occurredAt * 1000).toISOString()}>{new Date(event.occurredAt * 1000).toLocaleString('ko-KR')}</time>
                            </>} />
                    </List.Item>} />
                </ConfigProvider>}
        </div>
    </section>
    return <Popover open={open} onOpenChange={setOpen} trigger="click" placement="bottomRight"
        content={content} arrow={false} getPopupContainer={() => document.body} styles={{ root: { zIndex: 1400 } }}>
        <Button type="text" shape="circle" className="netdive-notifications-trigger" aria-label="알림"
            aria-expanded={open} aria-haspopup="dialog" icon={<BellOutlined />} />
    </Popover>
}
