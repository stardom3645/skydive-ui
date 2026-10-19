import { strict as assert } from 'assert'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fetchKubernetesPodYAML, KubernetesPodYAMLRequest, KubernetesYAMLError, kubernetesYAMLFailure,
    kubernetesYAMLLoadReducer, kubernetesYAMLRequestKey } from '../src/KubernetesResourceYAML'
import { findLogMatches } from '../src/KubernetesLogPresentation'
import KubernetesYAMLText from '../src/DataPanels/common/KubernetesYAMLText'

const request: KubernetesPodYAMLRequest = { endpoint: 'http://netdive.test/', token: 'test', clusterID: 'c', uid: 'u', namespace: 'n', name: 'p' }
const yaml = 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: "한글 <script> & test"\n  annotations:\n    example: |\n      first line\n      second line\nspec:\n  containers:\n  - name: web\n    image: app:1\n    env:\n    - name: "[REDACTED]"\n      value: "[REDACTED]"\n'
const result = { clusterId: 'c', uid: 'u', namespace: 'n', name: 'p', yaml, redacted: true, fetchedAt: '2026-10-19T12:00:00Z' }
const reply = (body: any, status = 200): typeof fetch => (async () => ({ ok: status === 200, status, json: async () => body })) as any

describe('Read-only Kubernetes resource YAML', () => {
    it('uses authenticated, cancellable, uncached GET for the exact selected pod', async () => {
        const controller = new AbortController()
        const fetcher: typeof fetch = (async (url: string, options: RequestInit) => {
            const target = new URL(url)
            assert.equal(target.pathname, '/api/mold/kubernetes-clusters/pods/yaml')
            assert.equal(target.searchParams.get('uid'), 'u')
            assert.equal(target.searchParams.get('namespace'), 'n')
            assert.equal(target.searchParams.get('name'), 'p')
            assert.equal(options.method, 'GET')
            assert.equal(options.cache, 'no-store')
            assert.equal(options.signal, controller.signal)
            assert.deepEqual(options.headers, { 'X-Auth-Token': 'test' })
            return { ok: true, status: 200, json: async () => result }
        }) as any
        assert.deepEqual(await fetchKubernetesPodYAML(request, controller.signal, fetcher), result)
    })
    it('rejects reused names, other clusters/namespaces and malformed responses', async () => {
        for (const change of [{ uid: 'new' }, { clusterId: 'other' }, { namespace: 'other' }, { name: 'other' }, { yaml: null }]) {
            await assert.rejects(fetchKubernetesPodYAML(request, new AbortController().signal, reply({ ...result, ...change })), /일치하지 않습니다/)
        }
        for (const change of [{ token: 'new' }, { uid: 'new' }, { clusterID: 'new' }]) assert.notEqual(kubernetesYAMLRequestKey({ ...request, ...change }), kubernetesYAMLRequestKey(request))
    })
    it('distinguishes permission/authentication, deleted pods, network and timeout from empty YAML', async () => {
        assert.equal((await fetchKubernetesPodYAML(request, new AbortController().signal, reply({ ...result, yaml: '' }))).yaml, '')
        assert.match(kubernetesYAMLFailure(new KubernetesYAMLError('', 403)).title, /권한/)
        assert.match(kubernetesYAMLFailure(new KubernetesYAMLError('', 401)).title, /인증/)
        assert.match(kubernetesYAMLFailure(new KubernetesYAMLError('', 404, 'POD_NOT_FOUND')).title, /파드/)
        assert.match(kubernetesYAMLFailure(new TypeError()).title, /연결/)
        assert.match(kubernetesYAMLFailure(new Error(), true).title, /시간/)
        await assert.rejects(fetchKubernetesPodYAML(request, new AbortController().signal, reply({}, 404)), /API/)
    })
    it('ignores stale completions and retains the last same-resource result after refresh failure', () => {
        let state = kubernetesYAMLLoadReducer({ key: '', loading: false }, { type: 'start', key: 'a' })
        state = kubernetesYAMLLoadReducer(state, { type: 'success', key: 'a', result })
        state = kubernetesYAMLLoadReducer(state, { type: 'start', key: 'a' })
        state = kubernetesYAMLLoadReducer(state, { type: 'failure', key: 'a', failure: kubernetesYAMLFailure(new Error('failed')) })
        assert.equal(state.result, result)
        state = kubernetesYAMLLoadReducer(state, { type: 'start', key: 'b' })
        assert.equal(state.result, undefined)
        assert.equal(kubernetesYAMLLoadReducer(state, { type: 'success', key: 'a', result }), state)
    })
    it('preserves YAML indentation/text, escapes markup and searches across syntax tokens with line numbers', () => {
        for (const source of [yaml, yaml.trimEnd(), 'value: "0"', '']) for (const query of ['', 'name: "한글', '[REDACTED]', 'first line\n      second line']) {
            const matches = findLogMatches(source, query).matches
            const html = renderToStaticMarkup(React.createElement(KubernetesYAMLText, { text: source, matches, active: 0 }))
            const text = html.replace(/<span class="netdive-yaml-line-number"[^>]*>[^<]*<\/span>/g, '')
                .replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#x27);/g, (_m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'" })[e])
            assert.equal(text, source)
            if (source) assert.ok(html.includes('netdive-yaml-line-number') && html.includes('hljs-attr'))
            assert.ok(!html.includes('<script>'))
            if (matches.length) assert.ok(html.includes('data-yaml-match="0"'))
        }
    })
})
