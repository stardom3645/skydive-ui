import { strict as assert } from 'assert'
import { fetchKubernetesPodLogs, KubernetesPodLogError, KubernetesPodLogRequest, KubernetesPodLogs } from '../src/KubernetesPodLogs'
import { kubernetesLogFailure, kubernetesLogLoadReducer, KubernetesLogLoadState, kubernetesLogStatus } from '../src/KubernetesLogViewerState'

const result: KubernetesPodLogs = { clusterId: 'cluster', uid: 'pod', namespace: 'ns', name: 'web', container: 'app',
    previous: false, tailLines: 1000, logs: 'ERROR a real application failure\r\nWARN retry\n', truncated: false, fetchedAt: '2026-10-15T00:00:00Z' }
const initial: KubernetesLogLoadState = { key: '', loading: false }
const start = (state = initial, key = 'selected-options') => kubernetesLogLoadReducer(state, { type: 'start', key })
const success = (state = start(), payload = result) => kubernetesLogLoadReducer(state, { type: 'success', key: state.key, result: payload })
const fail = (state: KubernetesLogLoadState, error: Error, previous = false) => kubernetesLogLoadReducer(state,
    { type: 'failure', key: state.key, failure: kubernetesLogFailure(error, previous) })

describe('Kubernetes common log viewer request states', () => {
    it('distinguishes initial loading from success even when output includes ERROR and WARN', () => {
        assert.equal(kubernetesLogStatus(start(), false), '로그 불러오는 중')
        const loaded = success()
        assert.equal(kubernetesLogStatus(loaded, false), '조회 완료')
        assert.strictEqual(loaded.result, result)
        assert.equal(loaded.failure, undefined)
    })
    it('retains the exact raw result during refresh, refresh failure and retry with the same options', () => {
        const refreshing = start(success())
        assert.equal(kubernetesLogStatus(refreshing, false), '갱신 중')
        assert.strictEqual(refreshing.result, result)
        const failed = fail(refreshing, new TypeError('Failed to fetch'))
        assert.strictEqual(failed.result, result)
        assert.equal(kubernetesLogStatus(failed, false), '연결 오류')
        const retrying = start(failed)
        assert.strictEqual(retrying.result, result)
        assert.equal(retrying.failure, undefined)
        assert.equal(retrying.key, failed.key)
        assert.equal(success(retrying, { ...result, logs: 'new output\n' }).result!.logs, 'new output\n')
    })
    it('never shows old logs for another identity/options, nor accepts an obsolete response', () => {
        const pending = start(success(), 'other-pod-or-options')
        assert.equal(pending.result, undefined)
        assert.strictEqual(kubernetesLogLoadReducer(pending, { type: 'success', key: 'selected-options', result }), pending)
        assert.strictEqual(kubernetesLogLoadReducer(pending, { type: 'failure', key: 'selected-options', failure: kubernetesLogFailure(new Error('late'), false) }), pending)
    })
    it('separates current empty output, previous empty output and absent previous logs from API failures', () => {
        const empty = success(start(), { ...result, logs: '' })
        assert.equal(kubernetesLogStatus(empty, false), '로그 없음')
        assert.equal(kubernetesLogStatus(empty, true), '이전 로그 없음')
        const unavailable = fail(start(success()), new KubernetesPodLogError('no previous', 409, 'PREVIOUS_LOG_UNAVAILABLE'), true)
        assert.equal(kubernetesLogStatus(unavailable, true), '이전 로그 없음')
        assert.equal(unavailable.result, undefined)
        for (const error of [new KubernetesPodLogError('Pod deleted', 404, 'POD_NOT_FOUND'),
            new KubernetesPodLogError('Log not found', 404, 'LOG_NOT_FOUND'), new KubernetesPodLogError('not running', 409, 'CONTAINER_LOG_UNAVAILABLE')]) {
            assert.equal(kubernetesLogFailure(error, true).kind, 'failure')
        }
        assert.equal(kubernetesLogFailure(new KubernetesPodLogError('invalid current response', 409, 'PREVIOUS_LOG_UNAVAILABLE'), false).kind, 'failure')
    })
    it('uses HTTP status/codes to distinguish authentication, permissions, network, timeout and generic failure', () => {
        const cases: Array<[Error, string]> = [
            [new KubernetesPodLogError('session expired', 401), 'authentication'],
            [new KubernetesPodLogError('cluster credentials invalid', 401, 'KUBERNETES_AUTHENTICATION_FAILED'), 'authentication'],
            [new KubernetesPodLogError('denied', 403, 'LOG_PERMISSION_DENIED'), 'permission'],
            [new TypeError('Failed to fetch'), 'network'], [new KubernetesPodLogError('timeout', 504, 'LOG_TIMEOUT'), 'timeout'],
            [new KubernetesPodLogError('server failure', 502, 'LOG_UNAVAILABLE'), 'failure'], [new Error('invalid response'), 'failure']
        ]
        for (const [error, kind] of cases) assert.equal(kubernetesLogFailure(error, true).kind, kind)
        assert.equal(kubernetesLogFailure(new Error('aborted'), false, true).kind, 'timeout')
        assert.equal(kubernetesLogFailure(new KubernetesPodLogError('denied', 403, 'PREVIOUS_LOG_UNAVAILABLE'), true).kind, 'permission')
    })
    it('retains actual API status/code without changing structured error text, request options or auth', async () => {
        const request: KubernetesPodLogRequest = { endpoint: 'http://netdive.test', token: 'same-token', clusterID: 'cluster', uid: 'pod', container: 'app', previous: true, tailLines: 1000 }
        for (const [status, code] of [[401, 'KUBERNETES_AUTHENTICATION_FAILED'], [403, 'LOG_PERMISSION_DENIED'], [409, 'PREVIOUS_LOG_UNAVAILABLE'], [504, 'LOG_TIMEOUT']] as const) {
            const fetcher: typeof fetch = (async (url: string, options: RequestInit) => {
                const query = new URL(url).searchParams
                assert.equal(query.get('previous'), 'true')
                assert.equal(query.get('tailLines'), '1000')
                assert.deepEqual(options.headers, { 'X-Auth-Token': 'same-token' })
                return { ok: false, status, json: async () => ({ code, message: 'original API message' }) }
            }) as any
            await assert.rejects(fetchKubernetesPodLogs(request, new AbortController().signal, fetcher), error =>
                error instanceof KubernetesPodLogError && error.status === status && error.code === code && error.message === 'original API message')
        }
    })
})
