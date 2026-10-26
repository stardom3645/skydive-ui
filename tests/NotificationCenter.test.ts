import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { APP_NOTIFICATION_EVENT, mergeNotificationHistory, readNotificationHistory } from '../src/NotificationHistory'
import type { AppNotification } from '../src/NotificationHistory'
import { notificationKey, notificationStorageKey, readNotificationCenterState, saveNotificationCenterState } from '../src/NotificationCenterState'

const React = require('react'), antd = require('antd'), icons = require('@ant-design/icons')
const flush = () => new Promise(resolve => setImmediate(resolve))
const source = ts.transpileModule(readFileSync(path.resolve(__dirname, '../src/NotificationCenter.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2018 }
}).outputText
function fixture(storage = new Map<string, string>()) {
    const hooks: any[] = [], effects: Array<() => void> = [], timers = new Map<number, () => void>(), requests: any[] = []
    const navigation: string[] = [], listeners = new Map<string, Set<(event: any) => void>>()
    let cursor = 0, timerID = 0
    const fakeReact = { ...React,
        useState(initial: any) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial
            return [hooks[i], (value: any) => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value }] },
        useEffect(effect: () => any, deps: any[]) {
            const i = cursor++, previous = hooks[i]
            if (!previous || deps.some((value, index) => value !== previous.deps[index])) {
                previous?.cleanup?.(); const entry: any = { deps }; hooks[i] = entry
                effects.push(() => { entry.cleanup = effect() })
            }
        }
    }
    const exports: any = {}
    vm.runInNewContext(source, { exports, AbortController,
        window: { addEventListener(type: string, listener: any) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(listener) }, removeEventListener(type: string, listener: any) { listeners.get(type)?.delete(listener) }, setTimeout(fn: () => void) { timers.set(++timerID, fn); return timerID }, clearTimeout(id: number) { timers.delete(id) } },
        require(name: string) {
            if (name === 'react') return fakeReact
            if (name === '@ant-design/icons') return icons
            if (name === './EventHistoryAPI') return { listChangeEvents: (session: any, filter: any, signal: AbortSignal) => new Promise((resolve, reject) => requests.push({ session, filter, signal, resolve, reject })) }
            if (name === './NotificationHistory') return { APP_NOTIFICATION_EVENT, mergeNotificationHistory, readNotificationHistory: (scope: string) => readNotificationHistory(scope, { getItem: key => storage.get(key) || null }) }
            if (name === './MoldIntegrationHealth') return require('../src/MoldIntegrationHealth')
            if (name === './NotificationCenterState') return { notificationKey, notificationStorageKey,
                readNotificationCenterState: (key: string) => readNotificationCenterState(key, { getItem: key => storage.get(key) || null }),
                saveNotificationCenterState: (key: string, value: any) => saveNotificationCenterState(key, value, { setItem: (key, value) => storage.set(key, value) }) }
            if (name.endsWith('.css')) return {}
            return require(name)
        }
    })
    return { requests, navigation, storage,
        emit(item: AppNotification, username = 'alice') { listeners.get(APP_NOTIFICATION_EVENT)?.forEach(listener => listener({ detail: { scope: notificationStorageKey('http://example.test', username), item } })) }, dispose() { hooks.forEach(entry => entry?.cleanup?.()) },
        tick() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()) },
        render(extra: any = {}) { cursor = 0; const root = exports.default({ userSession: { endpoint: 'http://example.test', username: 'alice', token: 'session-token' },
            health: { state: 'HEALTHY', checkedAt: 123 }, onOpenEvents: () => navigation.push('events'), ...extra })
            effects.splice(0).forEach(run => run()); return root }
    }
}
function elements(root: any, type: any): any[] {
    if (!root || typeof root !== 'object') return []
    if (Array.isArray(root)) return root.reduce((all, item) => all.concat(elements(item, type)), [])
    if (root.type === antd.List.Item) return elements({ type: 'li', props: root.props }, type)
    const children = [root.props?.children]
    if (root.type === antd.List) children.push(...(root.props.dataSource || []).map(root.props.renderItem))
    if (root.type === antd.List.Item.Meta) children.push(root.props.title, root.props.description, root.props.avatar)
    return [...(root.type === type ? [root] : []), ...elements(children, type)]
}
const button = (root: any, label: string) => elements(root.props.content, antd.Button).find(item => item.props.children === label || item.props['aria-label'] === label)

const observedAt = Math.floor(Date.now() / 1000)
const event = (id: number, newValue = 'HEALTHY') => ({ id, newValue, occurredAt: observedAt + id })
async function loaded(h: ReturnType<typeof fixture>, items = [event(1), event(2, 'AUTHENTICATION_FAILED')], extra: any = {}) {
    let root = h.render(extra); root.props.onOpenChange(true); h.render(extra); h.tick()
    h.requests[h.requests.length - 1].resolve({ events: items }); await flush(); return h.render(extra)
}

describe('Common Netdive notification center', () => {
    it('loads only when opened, preserves bounded event filters, and does not poll on timestamp or organization changes', async () => {
        const h = fixture(); let root = h.render(); h.tick()
        assert.equal(h.requests.length, 0)
        root = await loaded(h, [event(1)])
        const request = h.requests[0]
        assert.equal(request.session.token, 'session-token')
        assert.equal(request.filter.source, 'mold'); assert.equal(request.filter.resource_type, 'integration')
        assert.equal(request.filter.resource_id, 'mold-api'); assert.equal(request.filter.event_type, 'integration_state_changed')
        assert.equal(request.filter.to - request.filter.from, 7 * 86400)
        assert.equal(request.filter.pageSize, 20)
        assert.equal(elements(root.props.content, 'time')[0].props.dateTime, new Date((observedAt + 1) * 1000).toISOString())
        h.render({ health: { state: 'HEALTHY', checkedAt: 999 } }); h.tick()
        assert.equal(h.requests.length, 1)
        button(root, '정리하기').props.onClick(); h.render(); h.tick()
        assert.equal(h.requests.length, 1, 'organization must not request or mutate server logs')
        h.render({ health: { state: 'UNAVAILABLE' } }); h.tick()
        assert.equal(h.requests.length, 2)
    })
    it('cancels closed or obsolete account requests and ignores their responses', async () => {
        const h = fixture(); let root = h.render(); root.props.onOpenChange(true); root = h.render(); h.tick()
        button(root, '알림 닫기').props.onClick(); root = h.render()
        assert.equal(h.requests[0].signal.aborted, true)
        root.props.onOpenChange(true); h.render(); h.tick()
        const bob = { userSession: { endpoint: 'http://example.test', username: 'bob', token: 'bob-token' } }
        h.render(bob); h.tick()
        assert.equal(h.requests[1].signal.aborted, true)
        h.requests[0].resolve({ events: [event(1)] }); h.requests[1].resolve({ events: [event(2)] }); await flush()
        h.requests[2].resolve({ events: [] }); await flush(); root = h.render(bob)
        assert.equal(elements(root.props.content, 'li').length, 0)
        assert.equal(elements(root.props.content, antd.Empty).length, 1)
        h.dispose(); assert.equal(h.requests[2].signal.aborted, true)
    })
    it('keeps only a bulk organization action and moves scope/retention explanations into the info tooltip', async () => {
        const h = fixture(), root = await loaded(h)
        const content = root.props.content
        assert.equal(elements(root.props.children.props.icon, antd.Badge).length, 0, 'no unread bell count')
        const actions = elements(content, antd.Button)
        assert.ok(actions.some(item => item.props.children === '정리하기'))
        assert.equal(elements(content, antd.List).length, 1, 'use the existing Ant Design list presentation')
        assert.equal(button(root, '이벤트 목록'), undefined)
        assert.ok(!actions.some(item => /읽음|미확인|비우기|지우기|삭제/.test(String(item.props.children || item.props['aria-label'] || ''))))
        for (const row of elements(content, 'li')) {
            assert.equal(elements(row, antd.Button).length, 0, 'log rows must not offer delete/read controls')
            assert.equal(elements(row, antd.Typography.Paragraph).length, 1, 'retain the status explanation hierarchy')
            assert.equal(elements(row, antd.Typography.Paragraph)[0].props.ellipsis.rows, 2, 'long explanations must not grow the list indefinitely')
        }
        const info = elements(content, antd.Tooltip)[0]
        assert.ok(info.props.title.includes('최근 7일'))
        assert.ok(info.props.title.includes('최대 20건'))
        assert.ok(info.props.title.includes('원본은 삭제하지 않습니다'))
        assert.ok(info.props.title.includes('서버 설정'))
    })
    it('shows query failures separately from empty history and allows retry', async () => {
        const h = fixture(); let root = h.render(); root.props.onOpenChange(true); h.render(); h.tick()
        h.requests[0].reject(new Error('이벤트 조회 권한이 없습니다.')); await flush(); root = h.render()
        assert.equal(elements(root.props.content, antd.Alert)[0].props.description, '이벤트 조회 권한이 없습니다.')
        assert.equal(elements(root.props.content, antd.Empty).length, 0)
        assert.equal(button(root, '정리하기').props.disabled, true)
        button(root, '알림 새로고침').props.onClick(); h.render(); h.tick()
        assert.equal(h.requests.length, 2)
    })
    it('organizes the list with undo, preserves it after refresh, and always keeps new log entries visible', async () => {
        const h = fixture(); let root = await loaded(h)
        button(root, '정리하기').props.onClick(); root = h.render()
        assert.equal(elements(root.props.content, antd.Empty).length, 1)
        assert.equal(button(root, '정리하기').props.disabled, true)
        button(root, '실행 취소').props.onClick(); root = h.render()
        assert.equal(elements(root.props.content, 'li').length, 2)
        button(root, '정리하기').props.onClick(); root = h.render()
        button(root, '알림 새로고침').props.onClick(); h.render(); h.tick()
        h.requests[1].resolve({ events: [event(1), event(2)] }); await flush(); root = h.render()
        assert.equal(elements(root.props.content, 'li').length, 0)
        const reopened = fixture(h.storage)
        root = await loaded(reopened, [event(3), event(2), event(1)])
        assert.equal(elements(root.props.content, 'li').length, 1)
        assert.ok(h.requests.every(request => request.filter.event_type === 'integration_state_changed'))
    })
    it('keeps in-memory organization functional when browser storage is blocked', async () => {
        const storage = new class extends Map<string, string> {
            get(_key: string): string | undefined { throw new Error('blocked') }
            set(_key: string, _value: string): this { throw new Error('blocked') }
        }()
        const h = fixture(storage); let root = await loaded(h)
        button(root, '정리하기').props.onClick(); root = h.render()
        button(root, '알림 닫기').props.onClick(); root = h.render()
        root.props.onOpenChange(true); h.render(); h.tick()
        h.requests[h.requests.length - 1].resolve({ events: [event(1), event(2)] }); await flush(); root = h.render()
        assert.equal(elements(root.props.content, 'li').length, 0)
        button(root, '실행 취소').props.onClick(); root = h.render()
        assert.equal(elements(root.props.content, 'li').length, 2)
    })
    it('keeps local app banners usable even when persisted server event history is unavailable', async () => {
        const h = fixture(); let root = h.render()
        h.emit({ id: 'ui-console', title: '콘솔 연결 실패', tone: 'error', occurredAt: observedAt })
        root.props.onOpenChange(true); h.render(); h.tick()
        h.requests[0].reject(new Error('서버 이력 조회 실패')); await flush(); root = h.render()
        assert.equal(elements(root.props.content, antd.Alert).length, 1)
        assert.equal(elements(root.props.content, 'li').length, 1)
        assert.equal(button(root, '정리하기').props.disabled, false)
    })
    it('keeps an organized Mold banner hidden when its server event arrives later', async () => {
        const h = fixture(); let root = h.render()
        h.emit({ id: 'ui-mold', title: 'Mold API 연결 정상', tone: 'success', occurredAt: observedAt + 10, moldState: 'HEALTHY' })
        root.props.onOpenChange(true); h.render(); h.tick()
        h.requests[0].resolve({ events: [] }); await flush(); root = h.render()
        button(root, '정리하기').props.onClick(); root = h.render()
        button(root, '알림 새로고침').props.onClick(); h.render(); h.tick()
        h.requests[1].resolve({ events: [event(1)] }); await flush(); root = h.render()
        assert.equal(elements(root.props.content, 'li').length, 0)
    })
    it('receives non-integration banners while closed, preserves them alongside server records, and isolates accounts', async () => {
        const h = fixture(); h.render()
        h.emit({ id: 'ui-capture', title: '패킷 캡처를 시작했습니다.', tone: 'success', occurredAt: observedAt + 3 })
        h.emit({ id: 'ui-other-user', title: '다른 사용자 알림', tone: 'info', occurredAt: observedAt + 4 }, 'bob')
        let root = h.render()
        assert.equal(h.requests.length, 0)
        root.props.onOpenChange(true); h.render(); h.tick()
        h.requests[0].resolve({ events: [event(1)] }); await flush(); root = h.render()
        const labels = elements(root.props.content, antd.Typography.Text).map(item => item.props.children)
        assert.ok(labels.includes('패킷 캡처를 시작했습니다.'))
        assert.ok(labels.includes('Mold API 연결 정상'))
        assert.ok(!labels.includes('다른 사용자 알림'))
        assert.ok(!labels.includes('연동 알림'))
        assert.equal(elements(root.props.content, 'li').length, 2)
        assert.equal(root.props.children.props['aria-label'], '알림')
    })
    it('isolates organization by account and retains the separate event boundary', async () => {
        const h = fixture(), failure = { health: { state: 'AUTHENTICATION_FAILED' } }
        let root = await loaded(h, [event(1)], failure)
        button(root, '정리하기').props.onClick(); root = h.render(failure)
        assert.equal(elements(root.props.content, antd.Badge).length, 0, 'common notifications must not pin Mold connection status')
        const bob = fixture(h.storage)
        root = await loaded(bob, [event(1)], { userSession: { endpoint: 'http://example.test', username: 'bob', token: 'bob-token' } })
        assert.equal(elements(root.props.content, 'li').length, 1)
        assert.equal(button(root, '이벤트 목록'), undefined, 'browser banner history must not imply that every item is a server event')
    })
})

describe('Notification organization preferences', () => {
    it('drops retired read markers, expires old organization keys, and handles malformed or unavailable storage', () => {
        const now = observedAt, key = notificationStorageKey('http://example.test/', 'alice')
        assert.equal(key, notificationStorageKey('http://example.test', 'alice'))
        const value = readNotificationCenterState(key, { getItem: () => JSON.stringify({ read: [`1:${now}`], dismissed: [`1:${now}`, `2:${now - 8 * 86400}`, null] }) }, now)
        assert.deepEqual(value, { dismissed: [`1:${now}`] })
        assert.deepEqual(readNotificationCenterState(key, { getItem: () => '{broken' }), { dismissed: [] })
        assert.deepEqual(readNotificationCenterState(key, { getItem: () => { throw new Error('blocked') } }), { dismissed: [] })
        assert.doesNotThrow(() => saveNotificationCenterState(key, value, { setItem: () => { throw new Error('quota') } }))
    })
})
