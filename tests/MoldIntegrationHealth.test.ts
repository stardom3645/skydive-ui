import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { getMoldIntegrationHealth, moldIntegrationDescription, moldIntegrationIssue, moldIntegrationNotification } from '../src/MoldIntegrationHealth'
import type { MoldIntegrationHealth, MoldIntegrationState } from '../src/MoldIntegrationHealth'
import type { session } from '../src/Store'

const health = (state: MoldIntegrationState): MoldIntegrationHealth => ({ state, checkedAt: 123 })
const userSession = { endpoint: 'http://netdive.example:8082/', token: 'example-token' } as session
const response = (status: number, body?: any) => ({ ok: status === 200, status, json: async () => body } as Response)

describe('Mold integration health and notifications', () => {
  it('uses the existing Netdive session and reads health without sending credentials', async () => {
    const controller = new AbortController()
    const result = await getMoldIntegrationHealth(userSession, controller.signal, async (url, options) => {
      assert.equal(url, 'http://netdive.example:8082/api/mold/integration-health')
      assert.equal(options!.cache, 'no-store')
      assert.equal(options!.credentials, 'same-origin')
      assert.equal(options!.signal, controller.signal)
      assert.equal((options!.headers as any)['X-Auth-Token'], userSession.token)
      assert.equal(options!.body, undefined)
      return response(200, health('AUTHENTICATION_FAILED'))
    })
    assert.deepEqual(result, health('AUTHENTICATION_FAILED'))
  })
  it('does not confuse Netdive HTTP errors or older servers with Mold authentication failures', async () => {
    for (const status of [401, 403, 404, 502, 503]) {
      assert.equal(await getMoldIntegrationHealth(userSession, undefined, async () => response(status)), undefined)
    }
    for (const body of [null, {}, { state: 'FAIL', checkedAt: 123 }, { state: 'HEALTHY' }]) {
      assert.equal(await getMoldIntegrationHealth(userSession, undefined, async () => response(200, body)), undefined)
    }
  })
  it('alerts on an initial failure and deduplicates polling while allowing recovery and relapse', () => {
    for (const state of ['UNCONFIGURED', 'AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'UNAVAILABLE'] as MoldIntegrationState[]) {
      assert.equal(moldIntegrationNotification(undefined, health(state)), 'error')
      assert.equal(moldIntegrationNotification(health('HEALTHY'), health(state)), 'error')
      assert.equal(moldIntegrationNotification(health(state), health(state)), undefined)
      assert.equal(moldIntegrationNotification(health(state), health('HEALTHY')), 'success')
    }
    for (const state of ['UNKNOWN', 'HEALTHY'] as MoldIntegrationState[]) {
      assert.equal(moldIntegrationNotification(undefined, health(state)), undefined)
      assert.equal(moldIntegrationIssue(health(state)), false)
    }
    assert.ok(moldIntegrationDescription(health('AUTHENTICATION_FAILED')).includes('재발급'))
    assert.ok(!moldIntegrationDescription(health('UNAVAILABLE')).includes('재발급'))
  })
})

const appPath = path.resolve(__dirname, '../src/App.tsx')
const appSource = ts.createSourceFile(appPath, readFileSync(appPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const app = appSource.statements.filter(ts.isClassDeclaration).find(item => item.name?.text === 'App')!
const method = app.members.find(item => item.name?.getText(appSource) === 'refreshMoldIntegrationHealth')!.getText(appSource)

function pollingProbe(fetchHealth: (...args: any[]) => Promise<MoldIntegrationHealth | undefined>) {
  const notices: any[] = []
  const context: any = { AbortController, Event, MOLD_INTEGRATION_CHANGED_EVENT: 'netdive-mold-integration-changed',
    window: { setTimeout, clearTimeout, dispatchEvent: () => {} }, getMoldIntegrationHealth: fetchHealth,
    moldIntegrationNotification, moldIntegrationLabel: (value: MoldIntegrationHealth) => value.state }
  vm.createContext(context)
  vm.runInContext(ts.transpile(`class Probe { ${method} }; this.app = new Probe()`, { target: ts.ScriptTarget.ES2018 }), context)
  Object.assign(context.app, { props: { session: userSession, enqueueSnackbar: (...args: any[]) => notices.push(args) }, state: {},
    setState(update: any) { Object.assign(this.state, update) } })
  return { app: context.app, notices }
}
const flush = () => new Promise(resolve => setImmediate(resolve))

describe('App Mold integration polling', () => {
  it('keeps one request in flight and avoids repeated notifications', async () => {
    let resolve!: (health: MoldIntegrationHealth) => void
    let calls = 0
    const { app, notices } = pollingProbe(() => { calls++; return new Promise(done => { resolve = done }) })
    app.refreshMoldIntegrationHealth()
    app.refreshMoldIntegrationHealth()
    assert.equal(calls, 1)
    resolve(health('AUTHENTICATION_FAILED')); await flush()
    assert.equal(notices.length, 1)
    app.refreshMoldIntegrationHealth()
    resolve(health('AUTHENTICATION_FAILED')); await flush()
    assert.equal(notices.length, 1)
    app.refreshMoldIntegrationHealth()
    resolve(health('HEALTHY')); await flush()
    assert.equal(notices.length, 2)
    assert.equal(notices[1][1].variant, 'success')
  })
  it('ignores cancelled, disposed, static-data and unsupported-server results', async () => {
    let resolve!: (health: MoldIntegrationHealth) => void
    const { app, notices } = pollingProbe(() => new Promise(done => { resolve = done }))
    app.refreshMoldIntegrationHealth()
    app.moldHealthRequest.abort()
    resolve(health('AUTHENTICATION_FAILED')); await flush()
    assert.equal(app.state.moldIntegrationHealth, undefined)
    app.refreshMoldIntegrationHealth()
    app.disposed = true
    resolve(health('AUTHENTICATION_FAILED')); await flush()
    assert.equal(notices.length, 0)
    app.refreshMoldIntegrationHealth()
    app.disposed = false; app.props.dataURL = 'fixture.json'
    app.refreshMoldIntegrationHealth()
    assert.equal(app.moldHealthRequest, undefined)
    const unsupported = pollingProbe(async () => undefined)
    unsupported.app.refreshMoldIntegrationHealth(); await flush()
    assert.equal(unsupported.app.state.moldIntegrationHealth, undefined)
    assert.equal(unsupported.notices.length, 0)
  })
})
