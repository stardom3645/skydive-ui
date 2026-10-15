import { strict as assert } from 'assert'
import {
    fetchKubernetesPodLogs, kubernetesLogContainerChoices, kubernetesPodLogRequestKey,
    KubernetesPodLogRequest
} from '../src/KubernetesPodLogs'

const request: KubernetesPodLogRequest = { endpoint: 'http://netdive.test/', token: 'test-token', clusterID: 'cluster-a', uid: 'pod-a',
    namespace: 'space-a', name: 'web-a', container: 'web', previous: false, tailLines: 500 }
const success = { clusterId: 'cluster-a', uid: 'pod-a', namespace: 'space-a', name: 'web-a', container: 'web', previous: false,
    tailLines: 500, logs: '0\n<script>alert(1)</script>\n한글 로그\n', truncated: false, fetchedAt: '2026-10-14T08:00:00Z' }
const reply = (payload: any, status = 200): typeof fetch => (async () => ({ ok: status === 200, status,
    json: async () => payload })) as any

describe('Kubernetes container log requests', () => {
    it('uses real container names with application containers first, including init/ephemeral containers', () => {
        const containers = [{ name: 'prepare', type: 'INIT' }, { name: 'web', type: 'APPLICATION' },
            { name: 'debug', type: 'EPHEMERAL' }, { name: '' }, { name: 'web', type: 'APPLICATION' }]
        const before = JSON.stringify(containers)
        assert.deepEqual(kubernetesLogContainerChoices(containers), [{ value: 'web', label: 'web' },
            { value: 'prepare', label: 'prepare (초기화)' }, { value: 'debug', label: 'debug (임시)' }])
        assert.equal(JSON.stringify(containers), before)
    })
    it('passes authentication, cancellation, no-cache and selected identity/options to the existing API', async () => {
        const controller = new AbortController()
        let calls = 0
        const fetcher: typeof fetch = (async (url: string, options: RequestInit) => {
            calls++
            const target = new URL(url)
            assert.equal(target.pathname, '/api/mold/kubernetes-clusters/pods/logs')
            assert.equal(target.searchParams.get('uid'), 'pod-a')
            assert.equal(target.searchParams.get('namespace'), 'space-a')
            assert.equal(target.searchParams.get('name'), 'web-a')
            assert.equal(target.searchParams.get('container'), 'web')
            assert.equal(target.searchParams.get('tailLines'), '500')
            assert.equal(target.searchParams.get('previous'), 'false')
            assert.deepEqual(options.headers, { 'X-Auth-Token': 'test-token' })
            assert.equal(options.cache, 'no-store')
            assert.strictEqual(options.signal, controller.signal)
            return { ok: true, status: 200, json: async () => success }
        }) as any
        assert.deepEqual(await fetchKubernetesPodLogs(request, controller.signal, fetcher), success)
        assert.equal(calls, 1)
    })
    it('rejects mismatched Pod/cluster/container/current versus previous responses', async () => {
        for (const change of [{ uid: 'recreated-pod' }, { clusterId: 'other-cluster' }, { container: 'other-container' }, { previous: true }, { logs: undefined }]) {
            await assert.rejects(fetchKubernetesPodLogs(request, new AbortController().signal, reply({ ...success, ...change })), /일치하지 않습니다/)
        }
    })
    it('cancels an in-flight request when its owner aborts it', async () => {
        const controller = new AbortController()
        const fetcher: typeof fetch = ((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
            options.signal!.addEventListener('abort', () => {
                const error = new Error('aborted'); error.name = 'AbortError'; reject(error)
            })
        })) as any
        const pending = fetchKubernetesPodLogs(request, controller.signal, fetcher)
        controller.abort()
        await assert.rejects(pending, error => error.name === 'AbortError')
    })
    it('separates no output from API failures, permission errors and absent previous logs', async () => {
        assert.equal((await fetchKubernetesPodLogs(request, new AbortController().signal, reply({ ...success, logs: '' }))).logs, '')
        for (const [status, message] of [[403, 'pods/log 읽기 권한이 없습니다.'], [409, '이전 로그가 없습니다.'], [404, '파드가 삭제되었습니다.']] as const) {
            await assert.rejects(fetchKubernetesPodLogs(request, new AbortController().signal, reply({ code: 'LOG_ERROR', message }, status)), error => error.message === message)
        }
        await assert.rejects(fetchKubernetesPodLogs(request, new AbortController().signal, reply(undefined, 404)), /API를 사용할 수 없습니다/)
    })
    it('changes the request identity whenever selection/options change so a prior result cannot stay on screen', () => {
        const key = kubernetesPodLogRequestKey(request)
        for (const change of [{ uid: 'pod-b' }, { clusterID: 'cluster-b' }, { container: 'prepare' }, { previous: true },
            { tailLines: 100 }, { token: 'refreshed-token' }]) assert.notEqual(kubernetesPodLogRequestKey({ ...request, ...change }), key)
    })
})
