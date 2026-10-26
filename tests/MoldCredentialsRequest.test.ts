import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

const source = ts.transpileModule(readFileSync(path.resolve(__dirname, '../src/MoldCredentialsAPI.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018 }
}).outputText
const flush = () => new Promise(resolve => setImmediate(resolve))
function fixture(fetcher: typeof fetch) {
  const timers = new Map<number, () => void>(), durations: number[] = [], exports: any = {}
  let id = 0
  vm.runInNewContext(source, { exports, AbortController, fetch: fetcher,
    require: () => ({ translate: (key: string) => key }),
    setTimeout: (run: () => void, duration: number) => { durations.push(duration); timers.set(++id, run); return id },
    clearTimeout: (timer: number) => timers.delete(timer)
  })
  return { ...exports, timers, durations, expire: () => [...timers.values()].forEach(run => run()) }
}
const session = { endpoint: 'http://example.test/', token: 'example-token' }
const json = (status: number, body: any) => ({ ok: status < 300, status, json: async () => body } as Response)

describe('Bounded Mold credential requests', () => {
  it('ends a stalled status query after its timeout and releases its timer', async () => {
    let signal!: AbortSignal
    const h = fixture(async (_url, options) => new Promise((_resolve, reject) => {
      signal = options!.signal!; signal.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const result = assert.rejects(h.getMoldCredentialsStatus(session), /moldCredentialsTimeout/)
    assert.equal(h.durations[0], 10000)
    h.expire(); await result
    assert.equal(signal.aborted, true); assert.equal(h.timers.size, 0)
  })
  it('keeps cancellation distinct from status/network errors', async () => {
    const controller = new AbortController()
    const cancellation = new Error('cancelled')
    const h = fixture(async (_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(cancellation))
    }))
    const result = assert.rejects(h.getMoldCredentialsStatus(session, controller.signal), error => error === cancellation)
    controller.abort(); await result; assert.equal(h.timers.size, 0)
  })
  it('also bounds a response whose JSON body never finishes', async () => {
    let signal!: AbortSignal
    const h = fixture(async (_url, options) => {
      signal = options!.signal!
      return { ok: true, status: 200, json: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('body interrupted')))) } as Response
    })
    const result = assert.rejects(h.getMoldCredentialsStatus(session), /moldCredentialsTimeout/)
    await flush(); h.expire(); await result; assert.equal(h.timers.size, 0)
  })
  it('normalizes the URL and keeps authentication, reset and save requests unchanged', async () => {
    const methods: string[] = []
    const h = fixture(async (url, options) => {
      assert.equal(url, 'http://example.test/api/mold/credentials')
      assert.equal((options!.headers as any)['X-Auth-Token'], session.token)
      assert.equal(options!.cache, 'no-store')
      methods.push(options!.method || 'GET')
      return json(200, { apiConfigured: true, dbPasswordConfigured: true })
    })
    await h.getMoldCredentialsStatus(session)
    await h.resetMoldCredentials(session)
    await h.saveMoldCredentials(session, { apiKey: 'example-api', secretKey: 'example-secret', dbPassword: '' })
    assert.deepEqual(methods, ['GET', 'DELETE', 'PUT']); assert.equal(h.timers.size, 0)
  })
  it('rejects invalid status payloads and preserves server error classification', async () => {
    const malformed = fixture(async () => json(200, {}))
    await assert.rejects(malformed.getMoldCredentialsStatus(session), /moldCredentialsRequestFailed/)
    const unauthorized = fixture(async () => json(401, { message: 'sensitive details are not echoed' }))
    await assert.rejects(unauthorized.getMoldCredentialsStatus(session), (error: any) => error.status === 401 && error.message === 'moldCredentialsAuthenticationFailed')
  })
})
