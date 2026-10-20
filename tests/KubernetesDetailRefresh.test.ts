import { strict as assert } from 'assert'
import { KubernetesDetailRefresh, KubernetesDetailRefreshEnvironment } from '../src/KubernetesDetailRefresh'

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
const environment = () => {
    let next = 0
    const pending = new Map<number, { callback: () => void, delay: number }>()
    const visibility: any = { hidden: false, listener: undefined,
        addEventListener: (_: string, listener: any) => visibility.listener = listener,
        removeEventListener: () => visibility.listener = undefined }
    const env: KubernetesDetailRefreshEnvironment = { visibility,
        setTimeout: (callback, delay) => { pending.set(++next, { callback, delay }); return next },
        clearTimeout: id => pending.delete(id) }
    return { env, pending, visibility, tick: (delay = 60000) => {
        const entry = Array.from(pending).find(([, timer]) => timer.delay === delay)
        assert.ok(entry, `missing timer ${delay}`)
        pending.delete(entry![0]); entry![1].callback()
    } }
}

describe('Kubernetes detail refresh lifecycle (F04)', () => {
    it('refreshes the same selection through endpoint 1→0→1 and failure→recovery', async () => {
        const clock = environment()
        const responses: any[] = [{ ready: 1 }, { ready: 0 }, new Error('offline'), { ready: 1 }]
        let detail: any; let error = false; let calls = 0
        const refresh = new KubernetesDetailRefresh(async () => {
            const response = responses[calls++]
            error = response instanceof Error
            detail = error ? undefined : response
        }, 60000, clock.env)
        refresh.start(); await flush(); assert.equal((detail as any).ready, 1)
        clock.tick(); await flush(); assert.equal(detail.ready, 0)
        clock.tick(); await flush(); assert.equal(error, true); assert.equal(detail, undefined)
        clock.tick(); await flush(); assert.equal(error, false); assert.equal((detail as any).ready, 1)
        refresh.stop(); assert.equal(clock.pending.size, 0)
    })
    it('prevents overlap and ignores late results after Pod recreation or unmount', async () => {
        const clock = environment()
        const completions: Array<() => void> = []; const signals: AbortSignal[] = []
        let applied = 0
        const refresh = new KubernetesDetailRefresh((signal, current) => new Promise<void>(resolve => {
            signals.push(signal); completions.push(() => { if (current()) applied++; resolve() })
        }), 60000, clock.env)
        refresh.start(); await flush(); refresh.refresh(); await flush(); assert.equal(signals.length, 1)
        refresh.refresh(true); await flush(); assert.equal(signals[0].aborted, true)
        completions[0](); await flush(); assert.equal(applied, 0)
        refresh.stop(); assert.equal(signals[1].aborted, true)
        completions[1](); await flush(); assert.equal(applied, 0); assert.equal(clock.pending.size, 0)
    })
    it('suspends hidden panels, resumes immediately and bounds a hung fetch', async () => {
        const clock = environment(); let calls = 0; let signal: AbortSignal
        const refresh = new KubernetesDetailRefresh(async s => { signal = s; calls++ }, 60000, clock.env)
        refresh.start(); await flush()
        clock.visibility.hidden = true; clock.visibility.listener(); assert.equal(clock.pending.size, 0)
        refresh.refresh(); await flush(); assert.equal(calls, 1)
        clock.visibility.hidden = false; clock.visibility.listener(); await flush(); assert.equal(calls, 2)
        refresh.stop(); assert.equal(clock.visibility.listener, undefined)
        const hung = new KubernetesDetailRefresh(s => new Promise<void>(resolve => {
            signal = s; s.addEventListener('abort', () => resolve())
        }), 60000, clock.env)
        hung.start(); await flush(); clock.tick(15000); await flush(); assert.equal(signal!.aborted, true)
        clock.tick(); await flush(); hung.stop(); assert.equal(clock.pending.size, 0)
    })
})

import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

describe('Kubernetes detail refresh browser timer receiver', () => {
    it('uses the browser receiver for native timers through mount, refresh and unmount', async () => {
        const source = readFileSync(path.join(__dirname, '../src/KubernetesDetailRefresh.ts'), 'utf8')
        const context = vm.createContext({ exports: {}, AbortController })
        vm.runInContext(`
            var pending = new Map(), next = 0, loads = 0, nativeCalls = 0;
            function setTimeout(callback, delay) {
                if (this !== globalThis) throw new TypeError('Illegal invocation');
                nativeCalls++;
                pending.set(++next, { callback, delay });
                return next;
            }
            function clearTimeout(timer) {
                if (this !== globalThis) throw new TypeError('Illegal invocation');
                nativeCalls++;
                pending.delete(timer);
            }
        `, context)
        vm.runInContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018 }), context)
        vm.runInContext('var refresh = new exports.KubernetesDetailRefresh(async () => { loads++; });', context)
        try {
            vm.runInContext('refresh.start()', context)
            await flush()
            assert.equal(vm.runInContext('loads', context), 1)
            assert.equal(vm.runInContext('Array.from(pending.values())[0].delay', context), 60000)
            vm.runInContext('Array.from(pending.values())[0].callback()', context)
            await flush()
            assert.equal(vm.runInContext('loads', context), 2)
        } finally {
            vm.runInContext('refresh.stop()', context)
        }
        assert.equal(vm.runInContext('pending.size', context), 0)
        assert.ok(vm.runInContext('nativeCalls', context) > 0)
    })
})

describe('Service detail query refresh integration (F04)', () => {
    it('requeries an identical requestKey and applies empty, recovered and recreated targets', async () => {
        const file = ts.createSourceFile('panel.tsx', readFileSync(path.join(__dirname, '../src/DataPanels/KubernetesServiceDetailPanel.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        const component = file.statements.find(ts.isClassDeclaration)!
        const method = component.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(file) === 'loadDetail')!
        const responses = [
            { endpointDataAvailable: true, endpoints: [{ targetUid: 'old-pod', ready: true }] },
            { endpointDataAvailable: true, endpoints: [] }, new Error('offline'),
            { endpointDataAvailable: true, endpoints: [{ targetUid: 'new-pod', ready: true }] }
        ]
        let calls = 0
        const Probe = vm.runInNewContext(ts.transpile(`class Probe { ${method.getText(file)} }; Probe`, { target: ts.ScriptTarget.ES2018 }), {
            fetch: async (_: string, init: any) => {
                assert.ok(init.signal); assert.equal(init.cache, 'no-store')
                assert.equal(init.headers['X-Auth-Token'], 'existing-token')
                const response = responses[calls++]
                if (response instanceof Error) throw response
                return { ok: true, json: async () => response }
            }
        })
        const probe = new Probe()
        probe.props = { session: { endpoint: 'http://existing', token: 'existing-token' } }
        probe.state = { requestKey: 'cluster:service' }
        probe.cluster = () => ({ id: 'cluster' }); probe.uid = () => 'service'
        probe.detailFromTopology = () => ({ endpointDataAvailable: false })
        probe.setState = (value: any) => Object.assign(probe.state, value)
        const run = () => probe.loadDetail(new AbortController().signal, () => true)
        await run(); assert.equal(probe.state.detail.endpoints[0].targetUid, 'old-pod')
        await run(); assert.equal(probe.state.detail.endpoints.length, 0)
        await run(); assert.equal(probe.state.error, true); assert.equal(probe.state.detail.endpointDataAvailable, false)
        await run(); assert.equal(probe.state.error, false); assert.equal(probe.state.detail.endpoints[0].targetUid, 'new-pod')
        assert.equal(calls, 4)
    })
})
