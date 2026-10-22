import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { KubernetesDetailRefresh } from '../src/KubernetesDetailRefresh'
import { currentProblems } from '../src/CurrentProblems'
import { kubernetesResourceSelfStatus } from '../src/KubernetesTopologyBadgeAggregation'
import { clearKubernetesPodObservations, getPodClassification, invalidateKubernetesPodCurrentStatusSnapshots,
    kubernetesPodCurrentStatusSnapshot, registerKubernetesPodCurrentStatusDetail, registerKubernetesPodCurrentStatusSnapshots,
    subscribeKubernetesPodObservations, invalidateKubernetesPodNamespaceSnapshots } from '../src/KubernetesPodLifecycle'

const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve() }
const scope = { clusterName: 'integration-cluster', clusterID: 'integration-cluster-id' }
const pod = (): any => ({ id: 'observation-integration-pod', tags: [], children: [], parent: null,
    data: { Name: 'pod', Manager: 'k8s', Type: 'pod', State: 'DOWN', ClusterName: scope.clusterName, K8s: { Extra: {
        ObjectMeta: { UID: 'observation-integration-pod' }, Status: { Phase: 'Pending', ContainerStatuses: [
            { Ready: false, State: { Waiting: { Reason: 'CrashLoopBackOff' } } }
        ] }
    } } } })
const rows = (node: any) => currentProblems([node], [], n => n.data.Name, () => ({ kind: 'unknown', label: 'Unknown' }))
const detail = (node: any, ready: boolean) => ({ uid: node.id, clusterId: scope.clusterID, namespace: 'app', name: 'pod', phase: 'Running',
    conditions: [{ type: 'Ready', status: ready ? 'True' : 'False' }], containers: [{ type: 'application', ready, state: 'running' }] })
const panel = (node: any, responses: any[]) => {
    const file = ts.createSourceFile('panel.tsx', readFileSync(path.resolve(__dirname, '../src/DataPanels/KubernetesPodDetailPanel.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const cls = file.statements.find(ts.isClassDeclaration)!
    const method = cls.members.find(item => ts.isMethodDeclaration(item) && item.name.getText(file) === 'loadDetail')!
    let calls = 0
    const Probe = vm.runInNewContext(ts.transpile(`class Probe { ${method.getText(file)} }; Probe`, { target: ts.ScriptTarget.ES2018 }), {
        fetch: async (_: string, init: any) => {
            assert.equal(init.cache, 'no-store'); assert.ok(init.signal); assert.equal(init.headers['X-Auth-Token'], 'existing')
            const response = responses[calls++]
            if (response instanceof Error) throw response
            return { ok: true, json: async () => response }
        }, registerKubernetesPodCurrentStatusDetail, invalidateKubernetesPodCurrentStatusSnapshots,
        mergeKubernetesPodDetail: (fallback: any, result: any) => ({ ...fallback, ...result })
    })
    const probe = new Probe()
    probe.props = { session: { endpoint: 'http://existing', token: 'existing' } }; probe.state = { requestKey: '' }
    probe.cluster = () => ({ id: scope.clusterID, name: scope.clusterName }); probe.uid = () => node.id
    probe.detailFromTopology = () => ({ uid: node.id, phase: 'Pending' })
    probe.setState = (update: any) => Object.assign(probe.state, update)
    return { probe, calls: () => calls }
}

describe('Pod observation polling and problem consistency', () => {
    afterEach(() => clearKubernetesPodObservations())
    it('requeries after expiry, invalidates failed reads, then applies failure and recovery without changing graph data', async () => {
        clearKubernetesPodObservations()
        const node = pod(), original = JSON.stringify(node.data)
        const { probe, calls } = panel(node, [detail(node, true), new Error('offline'), detail(node, false), detail(node, true)])
        let now = Date.now(), next = 0
        const savedNow = Date.now; Date.now = () => now
        const timers = new Map<number, { callback: () => void; delay: number }>()
        const refresh = new KubernetesDetailRefresh((signal, current) => probe.loadDetail(signal, current), 60000, {
            setTimeout: (callback, delay) => { timers.set(++next, { callback, delay }); return next }, clearTimeout: id => timers.delete(id)
        })
        const tick = async () => {
            now += 60001
            assert.equal(kubernetesPodCurrentStatusSnapshot(node), undefined)
            assert.equal(rows(node)[0].status, 'unavailable')
            const timer = Array.from(timers).find(([, timer]) => timer.delay === 60000)!
            timers.delete(timer[0]); timer[1].callback(); await flush()
        }
        try {
            refresh.start(); await flush()
            assert.equal(rows(node).length, 0, 'fresh API recovery overrides the older DOWN and CrashLoopBackOff graph fields')
            await tick(); assert.equal(probe.state.error, true); assert.equal(rows(node)[0].status, 'unavailable')
            await tick(); assert.equal(probe.state.error, false); assert.equal(rows(node)[0].status, 'problem')
            assert.ok(!rows(node)[0].reason.includes('CrashLoopBackOff'), 'do not mix old waiting reason into newer Ready=false')
            await tick(); assert.equal(rows(node).length, 0)
            assert.equal(calls(), 4)
            assert.equal(JSON.stringify(node.data), original, 'API observations must not write synthetic graph changes or backend history')
            assert.equal(currentProblems([], [], n => n.id, () => ({ kind: 'unknown', label: '' })).length, 0)
        } finally { refresh.stop(); Date.now = savedNow }
    })
    it('rejects a successful HTTP response belonging to a different UID or cluster', async () => {
        for (const mismatch of [{ uid: 'replacement-pod' }, { clusterId: 'another-cluster' }]) {
            const node = pod(), { probe } = panel(node, [{ ...detail(node, true), ...mismatch }])
            await probe.loadDetail(new AbortController().signal, () => true)
            assert.equal(probe.state.error, true); assert.equal(rows(node)[0].status, 'unavailable')
            assert.equal(kubernetesPodCurrentStatusSnapshot(node), undefined)
        }
    })
    it('ignores aborted or superseded requests even if a transport returns a successful payload', async () => {
        const node = pod()
        const { probe } = panel(node, [detail(node, true), detail(node, true)])
        const controller = new AbortController(); controller.abort()
        await probe.loadDetail(controller.signal, () => true)
        assert.equal(probe.state.error, true)
        await probe.loadDetail(new AbortController().signal, () => false)
        assert.equal(kubernetesPodCurrentStatusSnapshot(node), undefined)
    })
    it('isolates the same UID across clusters, renews a cache after expiry, and notifies existing views', () => {
        const node = pod(), foreign = pod(); foreign.data.ClusterName = 'other-cluster'
        let notifications = 0
        const unsubscribe = subscribeKubernetesPodObservations(() => notifications++)
        try {
            registerKubernetesPodCurrentStatusDetail(detail(node, true), scope)
            assert.equal(getPodClassification(node).problemPod, false)
            assert.equal(kubernetesPodCurrentStatusSnapshot(foreign), undefined)
            assert.equal(kubernetesPodCurrentStatusSnapshot(node, Date.now() + 60001), undefined)
            assert.equal(kubernetesResourceSelfStatus(node).collection, 'stale')
            registerKubernetesPodCurrentStatusDetail(detail(node, true), scope)
            assert.equal(kubernetesResourceSelfStatus(node).state, 'healthy')
            invalidateKubernetesPodCurrentStatusSnapshots([node.id], scope)
            assert.equal(kubernetesResourceSelfStatus(node).collection, 'unavailable')
            assert.ok(notifications >= 3)
        } finally { unsubscribe() }
    })
    it('does not order namespace snapshots by arrival alone when observedAt goes backwards', () => {
        const node = pod(), now = Date.now()
        registerKubernetesPodCurrentStatusSnapshots([{ uid: node.id, phase: 'Running', ready: true, problem: false, observedAt: new Date(now).toISOString() }], scope)
        registerKubernetesPodCurrentStatusSnapshots([{ uid: node.id, phase: 'Running', ready: false, problem: true, observedAt: new Date(now - 1000).toISOString() }], scope)
        assert.equal(getPodClassification(node).problemPod, false)
    })
    it('expires subscribed views without graph activity and without adding a polling request', () => {
        clearKubernetesPodObservations()
        const node = pod(), savedNow = Date.now, savedSetTimeout = global.setTimeout, savedClearTimeout = global.clearTimeout
        let now = Date.now(), callback: (() => void) | undefined, notifications = 0
        Date.now = () => now
        global.setTimeout = ((fn: () => void, delay: number) => { assert.ok(delay > 0 && delay <= 60000); callback = () => { callback = undefined; fn() }; return 1 }) as any
        global.clearTimeout = (() => { callback = undefined }) as any
        const unsubscribe = subscribeKubernetesPodObservations(() => notifications++)
        try {
            registerKubernetesPodCurrentStatusDetail(detail(node, true), scope)
            assert.equal(notifications, 1)
            now += 60001
            callback!()
            assert.equal(notifications, 2)
            assert.equal(rows(node)[0].status, 'unavailable')
            assert.equal(callback, undefined)
        } finally { unsubscribe(); Date.now = savedNow; global.setTimeout = savedSetTimeout; global.clearTimeout = savedClearTimeout }
    })
    it('invalidates failed or newly empty namespace observations without affecting another namespace', () => {
        const a = pod(), b = pod(); b.id = b.data.K8s.Extra.ObjectMeta.UID = 'other-namespace-pod'
        registerKubernetesPodCurrentStatusDetail(detail(a, true), scope)
        registerKubernetesPodCurrentStatusDetail({ ...detail(b, true), namespace: 'other' }, scope)
        invalidateKubernetesPodNamespaceSnapshots('app', scope)
        assert.equal(kubernetesResourceSelfStatus(a).collection, 'unavailable')
        assert.equal(kubernetesResourceSelfStatus(b).state, 'healthy')
        registerKubernetesPodCurrentStatusDetail(detail(a, true), scope)
        invalidateKubernetesPodNamespaceSnapshots('app', scope, [a.id])
        assert.equal(kubernetesResourceSelfStatus(a).state, 'healthy')
    })

})
