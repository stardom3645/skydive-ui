import { strict as assert } from 'assert'
import { authenticatedRequestOptions } from '../src/api/authentication'

describe('Existing session authentication for supplemental APIs', () => {
    it('sends a restored session token without depending on a browser cookie', () => {
        const options = authenticatedRequestOptions('restored-session-token')
        assert.equal(new Headers(options.headers).get('X-Auth-Token'), 'restored-session-token')
        assert.equal(options.credentials, undefined, 'retain the fetch same-origin cookie default')
    })

    it('preserves POST payload, cancellation, caller headers and cookie options without mutating them', () => {
        const controller = new AbortController()
        const headers = new Headers({ 'Content-Type': 'application/json' })
        const input: RequestInit = { method: 'POST', body: '{"id":"cluster"}', signal: controller.signal,
            credentials: 'same-origin', cache: 'no-store', headers }
        const result = authenticatedRequestOptions('session-token', input)
        assert.equal(result.body, input.body)
        assert.equal(result.method, 'POST')
        assert.equal(result.signal, controller.signal)
        assert.equal(result.credentials, 'same-origin')
        assert.equal(result.cache, 'no-store')
        assert.equal(new Headers(result.headers).get('Content-Type'), 'application/json')
        assert.equal(new Headers(result.headers).get('X-Auth-Token'), 'session-token')
        assert.equal(headers.has('X-Auth-Token'), false)
    })

    it('preserves explicit authentication and does not invent credentials for an anonymous session', () => {
        const credentials: Record<string, string>[] = [{ Authorization: 'Basic explicit' }, { 'X-Auth-Token': 'explicit' }]
        for (const headers of credentials) {
            const result = new Headers(authenticatedRequestOptions('saved', { headers }).headers)
            for (const [name, value] of Object.entries(headers)) assert.equal(result.get(name), value)
        }
        assert.equal(new Headers(authenticatedRequestOptions('').headers).has('X-Auth-Token'), false)
    })
})
