import { strict as assert } from 'assert'
import { EventHistoryRequestError, listChangeEvents } from '../src/EventHistoryAPI'
import type { session } from '../src/Store'

const userSession = { endpoint: 'http://netdive.example:8082/', token: 'existing-token' } as session
const page = { events: [], total: 0, page: 1, pageSize: 20 }
const response = (status: number, json: () => Promise<any> = async () => page) => ({
    ok: status >= 200 && status < 300, status, json
} as Response)

describe('Event history API errors and compatibility', () => {
    it('preserves query filters, existing authentication, cookies and cancellation signal', async () => {
        const controller = new AbortController()
        const fetcher: typeof fetch = async (url, options) => {
            const target = new URL(String(url))
            assert.equal(target.pathname, '/api/events')
            assert.equal(target.searchParams.get('search'), '호스트 & NIC')
            assert.equal(target.searchParams.get('from'), '0')
            assert.equal(target.searchParams.get('pageSize'), '20')
            assert.equal(target.searchParams.has('source'), false)
            assert.equal((options!.headers as Record<string, string>)['X-Auth-Token'], 'existing-token')
            assert.equal(options!.credentials, 'same-origin')
            assert.equal(options!.cache, 'no-store')
            assert.equal(options!.signal, controller.signal)
            return response(200)
        }
        assert.deepEqual(await listChangeEvents(userSession, { search: '호스트 & NIC', from: 0, pageSize: 20, source: '' }, controller.signal, fetcher), page)
    })
    it('keeps an unauthenticated existing session request free of invented credentials', async () => {
        await listChangeEvents({ ...userSession, token: '' }, {}, undefined, async (_url, options) => {
            assert.deepEqual(options!.headers, {})
            return response(200)
        })
    })
    it('replaces native English fetch errors with actionable Korean network guidance', async () => {
        for (const message of ['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed']) {
            await assert.rejects(listChangeEvents(userSession, {}, undefined, async () => { throw new TypeError(message) }), error =>
                error instanceof EventHistoryRequestError && error.status === undefined
                && error.message.includes('서버에 연결할 수 없습니다') && !error.message.includes(message))
        }
    })
    it('distinguishes HTTP failures without rendering raw proxy or backend error messages', async () => {
        for (const [status, fragment] of [[400, '조회 조건'], [401, '인증'], [403, '권한'], [404, 'API'],
            [408, '시간이 초과'], [500, '서버에서'], [502, '서버에서'], [503, '이벤트 저장소'], [504, '시간이 초과']] as Array<[number, string]>) {
            await assert.rejects(listChangeEvents(userSession, {}, undefined, async () => response(status, async () => {
                throw new Error('HTML / English error bodies need not be parsed')
            })), error => error instanceof EventHistoryRequestError && error.status === status && error.message.includes(fragment))
        }
    })
    it('reports invalid successful responses instead of presenting them as an empty event list', async () => {
        for (const body of [{}, null, { ...page, events: null }, { ...page, total: -1 }, { ...page, pageSize: 0 }]) {
            await assert.rejects(listChangeEvents(userSession, {}, undefined, async () => response(200, async () => body)), /응답 형식/)
        }
        await assert.rejects(listChangeEvents(userSession, {}, undefined, async () => response(200, async () => {
            throw new SyntaxError('Unexpected token <')
        })), /응답 형식/)
    })
    it('preserves deliberate cancellation and distinguishes interrupted response bodies', async () => {
        const controller = new AbortController()
        const cancellation = new Error('request cancelled')
        await assert.rejects(listChangeEvents(userSession, {}, controller.signal, async () => {
            controller.abort(); throw cancellation
        }), error => error === cancellation)
        await assert.rejects(listChangeEvents(userSession, {}, undefined, async () => response(200, async () => {
            throw new TypeError('Failed to fetch')
        })), /서버에 연결할 수 없습니다/)
    })
})
