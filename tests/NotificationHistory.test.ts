import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { APP_NOTIFICATION_EVENT, mergeNotificationHistory, notificationText, normalizeConnectionNotification, readNotificationHistory, recordAppNotification } from '../src/NotificationHistory'
import type { AppNotification } from '../src/NotificationHistory'
import { notificationKey, notificationStorageKey } from '../src/NotificationCenterState'
import type { session } from '../src/Store'
import type { ChangeEvent } from '../src/EventHistoryAPI'

const React = require('react')
const userSession = { endpoint: 'http://example.test', username: 'alice', token: 'not-for-storage' } as session
const now = Math.floor(Date.now() / 1000)
const notice = (id: string, tone: AppNotification['tone'] = 'info', at = now): AppNotification => ({ id, title: '앱 알림', tone, occurredAt: at })
const event = (id: number, state = 'HEALTHY', at = now): ChangeEvent => ({ id, newValue: state, occurredAt: at, resourceName: 'Mold API' } as ChangeEvent)

describe('Shared application banner history', () => {
    it('stores and publishes all four banner tones without storing sessions or React internals', () => {
        const storage = new Map<string, string>(), published: any[] = []
        const browser: any = { location: { origin: 'http://example.test' }, localStorage: {
            getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value)
        }, dispatchEvent: (event: any) => { published.push(event); return true } }
        for (const tone of ['info', 'success', 'warning', 'error'] as AppNotification['tone'][]) {
            recordAppNotification(userSession, { title: tone, tone, description: '배너 설명' }, browser)
        }
        const scope = notificationStorageKey(userSession.endpoint, userSession.username)
        const history = readNotificationHistory(scope, browser.localStorage)
        assert.equal(history.length, 4)
        assert.deepEqual(history.map(item => item.tone).sort(), ['error', 'info', 'success', 'warning'])
        assert.ok(published.every(event => event.type === APP_NOTIFICATION_EVENT && event.detail.scope === scope))
        assert.ok(!Array.from(storage.values()).join('').includes(userSession.token))
        assert.ok(!Array.from(storage.keys()).join('').includes(userSession.token))
        assert.notEqual(scope, notificationStorageKey(userSession.endpoint, 'bob'))
    })
    it('retains a live notification when storage is blocked and rejects expired or malformed saved entries', () => {
        const published: any[] = []
        const browser: any = { location: { origin: 'http://example.test' }, get localStorage() { throw new Error('blocked') },
            dispatchEvent: (event: any) => { published.push(event); return true } }
        recordAppNotification(userSession, { title: '연결 실패', tone: 'error' }, browser)
        assert.equal(published.length, 1)
        const data = [notice('ui-good'), notice('ui-expired', 'info', now - 8 * 86400), { ...notice('ui-unknown'), tone: 'invalid' }, { title: 'incomplete' }]
        assert.equal(readNotificationHistory('scope', { getItem: () => JSON.stringify(data) }, now).length, 1)
        assert.deepEqual(readNotificationHistory('scope', { getItem: () => '{broken' }), [])
    })
    it('merges banner history with server events chronologically and deduplicates the matching Mold banner', () => {
        const mold = { ...notice('ui-mold', 'success', now + 10), moldState: 'HEALTHY' as const }
        const local = [notice('ui-capture', 'success', now + 30), mold, notice('ui-console', 'error', now + 20)]
        const merged = mergeNotificationHistory(local, [event(9)], now)
        assert.deepEqual(merged.map(item => item.id), ['ui-capture', 'ui-console', 9])
        assert.ok(merged[2].aliases!.includes(notificationKey(mold)), 'organization of a banner must also hide its matching server record')
        assert.equal(mergeNotificationHistory(local, [event(9), event(10, 'AUTHENTICATION_FAILED', now - 10)], now).length, 4)
        assert.equal(mergeNotificationHistory(Array.from({ length: 30 }, (_, i) => notice(`ui-${i}`, 'info', now - i)), [], now).length, 20)
        assert.equal(mergeNotificationHistory([notice('ui-old', 'info', now - 8 * 86400)], [], now).length, 0)
    })
    it('normalizes legacy connection labels and groups repeats without erasing disconnect/recovery transitions', () => {
        const connected = (id: string, at: number, title = 'Connected'): AppNotification => ({ ...notice(id, 'info', at), title })
        const local = [connected('ui-1', now), connected('ui-2', now - 1, 'Netdive 연결됨'),
            { ...notice('ui-3', 'error', now - 2), title: 'Disconnected' }, { ...notice('ui-4', 'error', now - 3), title: 'Netdive 미연결' },
            connected('ui-5', now - 4)]
        const merged = mergeNotificationHistory(local, [], now)
        assert.deepEqual(merged.map(item => item.connectionState), ['connected', 'disconnected', 'connected'])
        assert.equal(merged[0].title, 'Netdive 서버 연결 정상')
        assert.ok(merged[0].description!.includes('브라우저와 Netdive 서버'))
        assert.ok(merged[0].aliases!.includes(notificationKey(local[1])))
        assert.ok(merged[1].aliases!.includes(notificationKey(local[3])))
        assert.equal(local[0].title, 'Connected', 'presentation normalization must not mutate source records')
        assert.equal(normalizeConnectionNotification({ ...notice('ui-mold'), title: 'Mold API 연결 정상' }).connectionState, undefined)
    })
    it('extracts only visible text from existing banner descriptions', () => {
        const node = React.createElement('div', null, React.createElement('div', null, 'host-1: 실패'), React.createElement('div', null, 'host-2: 실패'))
        assert.equal(notificationText(node), 'host-1: 실패\nhost-2: 실패')
        assert.equal(notificationText(React.createElement('div', { dangerouslySetInnerHTML: { __html: '<script>ignored</script>' } })), '')
        assert.equal(notificationText(undefined), '')
    })
})

const appSource = ts.createSourceFile('App.tsx', readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const appClass = appSource.statements.filter(ts.isClassDeclaration).find(item => item.name?.text === 'App')!
const methods = ['showAppNotification', 'notify', 'setCaptureSession', 'executeInfrastructureAgentRestart', 'onWebSocketOpen', 'onWebSocketClose'].map(name => appClass.members.find(item => item.name?.getText(appSource) === name)!.getText(appSource)).join('\n')
const flush = () => new Promise(resolve => setImmediate(resolve))
function appProbe(status?: any, failure?: any) {
    const banners: any[] = [], history: any[] = []
    const context: any = { React, Configuration: class { constructor(_options: any) {} }, notificationText, translate: (value: string) => value,
        recordAppNotification: (_session: any, item: any) => history.push(item),
        antNotification: ['info', 'success', 'warning', 'error'].reduce((all, tone) => ({ ...all, [tone]: (options: any) => banners.push({ tone, ...options }) }), {}) }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${methods} }; this.app = new Probe()`, { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
    const app = context.app
    Object.assign(app, { props: { session: userSession }, connectionInterrupted: false, connected: false, tc: {}, disposed: false, state: { captureSessions: {}, infrastructureAgentRestartSelectedHostIDs: [], infrastructureAgentRestartScope: 'all' },
        setState(value: any) { Object.assign(this.state, value) }, captureSessionKey: (node: any) => node.id,
        fetchInfrastructureAgentRestartAPI: () => failure ? Promise.reject(failure) : Promise.resolve({ status }),
        refreshInfrastructureAfterAgentRestart() {}, refreshInfrastructureAgentRestartStatus() {}, applyDefaultFilter: () => false, sync() {}, getAppVersion() {}, checkAuth() {} })
    return { app, history, banners }
}
describe('Application banner producers use the common notification path', () => {
    it('publishes ordinary server/console notifications and packet capture success to the same history', () => {
        const h = appProbe()
        h.app.notify('서버 연결 끊김', 'error')
        h.app.setCaptureSession({ id: 'node-1' }, { id: 'capture-1' })
        assert.equal(h.history.length, 2)
        assert.equal(h.history[0].title, '서버 연결 끊김')
        assert.equal(h.history[1].tone, 'success')
        assert.ok(h.history[1].title.includes('패킷 캡처'))
        assert.equal(h.banners[0].closable['aria-label'], '알림 닫기')
        assert.equal(h.app.state.captureSessions['node-1'].id, 'capture-1')
    })
    it('skips initial connection banners, deduplicates close retries, and reports real recovery once', () => {
        const h = appProbe()
        h.app.onWebSocketOpen()
        assert.equal(h.history.length, 0, 'initial page load must not fill notification history')
        h.app.onWebSocketClose(); h.app.onWebSocketClose()
        assert.equal(h.history.length, 1)
        assert.equal(h.history[0].connectionState, 'disconnected')
        h.app.onWebSocketOpen(); h.app.onWebSocketOpen()
        assert.equal(h.history.length, 2)
        assert.equal(h.history[1].connectionState, 'connected')
        assert.equal(h.history[1].title, 'Netdive 서버 연결 복구')
        h.app.disposed = true
        h.app.onWebSocketClose(); h.app.onWebSocketOpen()
        assert.equal(h.history.length, 2, 'unmounting must not create a false interruption alert')
    })
    it('records success, partial failure and failure of existing Agent operations without changing their behavior', async () => {
        for (const [lastResult, tone] of [['success', 'success'], ['partial', 'warning'], ['failed', 'error']]) {
            const h = appProbe({ lastResult, succeeded: 1, total: 2, targets: [{ name: 'host-2', success: false, error: '응답 없음' }] })
            h.app.executeInfrastructureAgentRestart(); await flush()
            assert.equal(h.history.length, 1); assert.equal(h.history[0].tone, tone)
            assert.equal(h.banners.length, 1)
            if (tone !== 'success') assert.ok(h.history[0].description.includes('host-2: 응답 없음'))
        }
        const h = appProbe(undefined, new Error('요청 실패'))
        h.app.executeInfrastructureAgentRestart(); await flush()
        assert.equal(h.history[0].tone, 'error'); assert.equal(h.history[0].description, '요청 실패')
    })
})
