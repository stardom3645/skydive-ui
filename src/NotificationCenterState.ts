export interface NotificationCenterState { dismissed: string[] }
export const notificationKey = (event: { id: string | number; occurredAt: number }) => `${event.id}:${event.occurredAt}`
// Preserve the previous storage namespace so organized server records stay hidden.
export const notificationStorageKey = (endpoint: string, username: string) =>
    `netdive-integration-notifications:v1:${encodeURIComponent(endpoint.replace(/\/$/, ''))}:${encodeURIComponent(username)}`

const normalize = (value: any, now: number): NotificationCenterState => {
    const keys = (items: unknown): string[] => Array.isArray(items) ? Array.from(new Set(items.filter(item =>
        typeof item === 'string' && /^(?:\d+|ui-[a-z0-9-]+):\d+$/.test(item) && Number(item.split(':')[1]) >= now - 7 * 86400))) : []
    return { dismissed: keys(value?.dismissed) }
}
export function readNotificationCenterState(key: string, storage?: Pick<Storage, 'getItem'>,
    now = Math.floor(Date.now() / 1000)): NotificationCenterState {
    try { return normalize(JSON.parse((storage || window.localStorage).getItem(key) || '{}'), now) }
    catch (_) { return { dismissed: [] } }
}
export function saveNotificationCenterState(key: string, state: NotificationCenterState,
    storage?: Pick<Storage, 'setItem'>): void {
    try { (storage || window.localStorage).setItem(key, JSON.stringify(state)) } catch (_) { /* Keep in-memory controls available if storage is blocked. */ }
}
