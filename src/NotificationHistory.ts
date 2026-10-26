import type { session } from './Store'
import type { ChangeEvent } from './EventHistoryAPI'
import type { MoldIntegrationState } from './MoldIntegrationHealth'
import { moldIntegrationDescription, moldIntegrationLabel } from './MoldIntegrationHealth'
import { notificationKey, notificationStorageKey } from './NotificationCenterState'

export const APP_NOTIFICATION_EVENT = 'netdive-app-notification'
export type NotificationTone = 'info' | 'success' | 'warning' | 'error'
export interface AppNotification {
    id: string | number
    title: string
    description?: string
    tone: NotificationTone
    occurredAt: number
    moldState?: MoldIntegrationState
    connectionState?: 'connected' | 'disconnected'
    aliases?: string[]
}

/** Extract only text from an existing banner's React content; never persist HTML or component internals. */
export function notificationText(value: any): string {
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    if (Array.isArray(value)) return value.map((item, index) => `${index && ['div', 'p', 'li'].includes(item?.type) ? '\n' : ''}${notificationText(item)}`).join('')
    return value?.props ? notificationText(value.props.children) : ''
}

/** Older banners used both English and Korean labels for the same WebSocket connection. */
export function normalizeConnectionNotification(item: AppNotification): AppNotification {
    if (item.connectionState) return { ...item }
    const connected = /^(Connected|Netdive (Connected|연결됨))$/i.test(item.title.trim())
    const disconnected = /^(Disconnected|Not connected|Netdive (Disconnected|미연결))$/i.test(item.title.trim())
    if (!connected && !disconnected) return { ...item }
    return { ...item, connectionState: connected ? 'connected' : 'disconnected',
        title: connected ? 'Netdive 서버 연결 정상' : 'Netdive 서버 연결 끊김',
        description: connected ? '브라우저와 Netdive 서버의 실시간 연결이 정상입니다.' : '브라우저와 Netdive 서버의 실시간 연결이 끊겼습니다.' }
}

export function readNotificationHistory(scope: string, storage?: Pick<Storage, 'getItem'>,
    now = Math.floor(Date.now() / 1000)): AppNotification[] {
    try {
        const items = JSON.parse((storage || window.localStorage).getItem(`${scope}:history`) || '[]')
        return Array.isArray(items) ? items.filter(item => typeof item?.id === 'string' && /^ui-[a-z0-9-]+$/.test(item.id)
            && typeof item.title === 'string' && item.title.length <= 500
            && (item.description === undefined || typeof item.description === 'string')
            && ['info', 'success', 'warning', 'error'].includes(item.tone)
            && Number.isFinite(item.occurredAt) && item.occurredAt >= now - 7 * 86400).slice(0, 100).map(normalizeConnectionNotification) : []
    } catch (_) { return [] }
}

export function recordAppNotification(userSession: session | undefined,
    input: Omit<AppNotification, 'id' | 'occurredAt'> & { occurredAt?: number },
    browser: Pick<Window, 'localStorage' | 'dispatchEvent' | 'location'> = window): AppNotification {
    const scope = notificationStorageKey(userSession?.endpoint || browser.location.origin, userSession?.username || '')
    const item: AppNotification = { ...input, id: `ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        title: input.title.slice(0, 500), description: input.description?.slice(0, 3000), occurredAt: input.occurredAt || Math.floor(Date.now() / 1000) }
    try {
        browser.localStorage.setItem(`${scope}:history`, JSON.stringify([item, ...readNotificationHistory(scope, browser.localStorage)].slice(0, 100)))
    } catch (_) { /* The live event still reaches the center if storage is blocked. */ }
    browser.dispatchEvent(new CustomEvent(APP_NOTIFICATION_EVENT, { detail: { scope, item } }))
    return item
}

/** Server integration events remain authoritative; merge their matching banners once. */
export function mergeNotificationHistory(local: AppNotification[], events: ChangeEvent[], now = Math.floor(Date.now() / 1000)): AppNotification[] {
    const matches = (item: AppNotification, event: ChangeEvent) => item.moldState === event.newValue
        && item.occurredAt >= event.occurredAt && item.occurredAt - event.occurredAt <= 90
    const server: AppNotification[] = events.map(event => {
        const health = { state: event.newValue as MoldIntegrationState, checkedAt: event.occurredAt }
        return { id: event.id, title: moldIntegrationLabel(health) || event.resourceName || '상태 변경',
            description: moldIntegrationDescription(health), occurredAt: event.occurredAt,
            tone: event.newValue === 'HEALTHY' ? 'success' : 'error',
            aliases: local.filter(item => matches(item, event)).map(notificationKey) }
    })
    const sorted = [...server, ...local.filter(item => !events.some(event => matches(item, event)))].map(normalizeConnectionNotification)
        .filter(item => item.occurredAt >= now - 7 * 86400)
        .sort((a, b) => b.occurredAt - a.occurredAt || String(b.id).localeCompare(String(a.id)))
        .filter((item, index, all) => all.findIndex(other => notificationKey(other) === notificationKey(item)) === index)
    const grouped: AppNotification[] = []
    for (const item of sorted) {
        const previous = grouped[grouped.length - 1]
        if (item.connectionState && previous?.connectionState === item.connectionState) {
            previous.aliases = Array.from(new Set([...(previous.aliases || []), notificationKey(item), ...(item.aliases || [])]))
        } else grouped.push(item)
    }
    return grouped.slice(0, 20)
}
