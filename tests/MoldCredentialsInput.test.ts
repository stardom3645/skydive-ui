import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

const React = require('react'), antd = require('antd')
const flush = () => new Promise(resolve => setImmediate(resolve))
const source = ts.transpileModule(readFileSync(path.resolve(__dirname, '../src/MoldCredentialsPanel.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2018 }
}).outputText
const deferred = () => {
  let resolve!: (value: any) => void, reject!: (error: Error) => void
  const promise = new Promise<any>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function fixture(health?: any) {
  const pending = deferred(), hooks: any[] = [], effects: Array<() => void> = []
  let cursor = 0, statusSignal: AbortSignal | undefined, statusCalls = 0, dbCalls = 0
  const dbSignals: AbortSignal[] = []
  const api = {
    getMoldCredentialsStatus: (_session: any, signal: AbortSignal) => { statusCalls++; statusSignal = signal; return pending.promise },
    resetMoldCredentials: async () => ({ apiConfigured: false, dbPasswordConfigured: true }),
    saveMoldCredentials: async () => ({ apiConfigured: true, dbPasswordConfigured: true }),
    testMoldAPIConnection: async () => ({}), testMoldDBConnection: async (_session: any, password: string, signal: AbortSignal) => {
      dbCalls++; dbSignals.push(signal); assert.equal(password, ''); return {}
    }
  }
  const fakeReact = { ...React,
    useState(initial: any) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial
      return [hooks[i], (value: any) => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value }] },
    useRef(initial: any) { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i] },
    useEffect(effect: () => any, deps: any[]) {
      const i = cursor++, previous = hooks[i]
      if (!previous || deps.some((value, index) => value !== previous.deps[index])) {
        previous?.cleanup?.(); const entry: any = { deps }; hooks[i] = entry
        effects.push(() => { entry.cleanup = effect() })
      }
    }
  }
  const exports: any = {}
  vm.runInNewContext(source, { exports, AbortController, require: (name: string) => {
    if (name === 'react') return fakeReact
    if (name === './Config') return { translate: (key: string) => key }
    if (name === './MoldCredentialsAPI') return api
    if (name === './MoldIntegrationHealth') return require('../src/MoldIntegrationHealth')
    if (name.endsWith('.css')) return {}
    return require(name)
  } })
  return { pending, api, get statusSignal() { return statusSignal }, get statusCalls() { return statusCalls }, get dbCalls() { return dbCalls }, dbSignals,
    unmount() { hooks.forEach(hook => hook?.cleanup?.()) },
    render(extra: any = {}) { cursor = 0; const element = exports.default({ health, userSession: { endpoint: 'http://example.test', token: 'example' }, ...extra }); effects.splice(0).forEach(run => run()); return element }
  }
}
function elements(root: any, type: any): any[] {
  if (!root || typeof root !== 'object') return []
  if (Array.isArray(root)) return root.reduce((all, item) => all.concat(elements(item, type)), [])
  return [...(root.type === type ? [root] : []), ...elements(root.props?.children, type)]
}
const password = (root: any, label: string) => elements(root, antd.Input.Password).find(element => element.props['aria-label'] === label)
const dbCheck = (root: any) => elements(root, antd.Button).find(button => button.props['aria-label'] === 'moldDBRecheck')
const reset = (root: any) => elements(root, antd.Popconfirm)[0]
const save = (root: any) => elements(root, antd.Button).find(element => element.props.htmlType === 'submit')

describe('Mold credential editing without waiting for status', () => {
  it('hides input for verified saved credentials even while status is pending or fails', async () => {
    const h = fixture({ state: 'HEALTHY' }); let root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 0)
    assert.ok(elements(root, antd.Button).some(button => button.props.children === 'moldCredentialsEdit' && !button.props.disabled))
    h.pending.reject(new Error('status unavailable')); await flush(); root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 0)
    assert.equal(elements(elements(root, 'section')[2], antd.Tag)[0].props.children, 'moldChecking')
    assert.ok(!elements(root, antd.Tag).some(tag => tag.props.children === 'moldNotConfigured'))
  })
  it('closes the automatic failure form on recovery when no draft was entered', () => {
    const h = fixture({ state: 'AUTHENTICATION_FAILED' })
    assert.equal(elements(h.render(), antd.Input.Password).length, 2)
    assert.equal(elements(h.render({ health: { state: 'HEALTHY' } }), antd.Input.Password).length, 0)
  })
  it('opens verified credentials only on explicit change and closes after saving', async () => {
    const h = fixture({ state: 'HEALTHY' }); let root = h.render()
    const change = elements(root, antd.Button).find(button => button.props.children === 'moldCredentialsEdit')
    change.props.onClick(); root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 2)
    password(root, 'moldAPIKey').props.onChange({ target: { value: 'example-api' } })
    password(root, 'moldSecretKey').props.onChange({ target: { value: 'example-secret' } })
    root = h.render()
    const toggle = () => elements(root, antd.Button).find(button => button.props['aria-controls'] === 'mold-api-credentials-fields')
    assert.equal(toggle().props.children, undefined)
    assert.ok(toggle().props.icon)
    assert.equal(toggle().props['aria-label'], 'moldCollapse')
    assert.equal(toggle().props.disabled, false)
    toggle().props.onClick(); root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 0)
    assert.equal(toggle().props['aria-expanded'], false)
    toggle().props.onClick(); root = h.render()
    assert.equal(password(root, 'moldAPIKey').props.value, 'example-api')
    assert.equal(password(root, 'moldSecretKey').props.value, 'example-secret')
    await elements(root, antd.Form)[0].props.onFinish(); root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 0)
    assert.equal(save(root), undefined)
  })
  it('can collapse an automatic failure form and reopens it after credential reset', async () => {
    const h = fixture({ state: 'AUTHENTICATION_FAILED' }); let root = h.render()
    elements(root, antd.Button).find(button => button.props['aria-controls'] === 'mold-api-credentials-fields').props.onClick()
    root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 0)
    await reset(root).props.onConfirm(); root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 2)
  })
  it('shows editable fields, reset and save while status remains pending', () => {
    const h = fixture(); let root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 2)
    assert.equal(password(root, 'moldAPIKey').props.disabled, false)
    assert.equal(elements(reset(root), antd.Button)[0].props.disabled, false)
    password(root, 'moldAPIKey').props.onChange({ target: { value: 'example-api' } })
    password(root, 'moldSecretKey').props.onChange({ target: { value: 'example-secret' } })
    root = h.render()
    assert.equal(save(root).props.disabled, false)
    assert.equal(h.statusCalls, 1, 'a new session object with the same values must not restart the query')
  })
  it('keeps the input open for authentication failure even after configured status arrives', async () => {
    const h = fixture({ state: 'AUTHENTICATION_FAILED' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    assert.equal(elements(h.render(), antd.Input.Password).length, 2)
  })
  it('does not hide or clear typed values when a late configured response arrives', async () => {
    const h = fixture(); let root = h.render()
    password(root, 'moldAPIKey').props.onChange({ target: { value: 'example-api' } })
    password(root, 'moldSecretKey').props.onChange({ target: { value: 'example-secret' } })
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush(); root = h.render()
    assert.equal(password(root, 'moldAPIKey').props.value, 'example-api')
    assert.equal(password(root, 'moldSecretKey').props.value, 'example-secret')
  })
  it('cancels the stale status request before resetting and immediately returns to input', async () => {
    const h = fixture(); let root = h.render()
    await reset(root).props.onConfirm()
    assert.equal(h.statusSignal!.aborted, true)
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: false }); await flush()
    root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 2)
    assert.equal(password(root, 'moldAPIKey').props.value, '')
    assert.equal(password(root, 'moldAPIKey').props.disabled, false)
  })
  it('keeps input and reset available after status lookup fails', async () => {
    const h = fixture(); h.render(); h.pending.reject(new Error('status unavailable')); await flush()
    const root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 2)
    assert.ok(reset(root))
    assert.ok(elements(root, 'div').some(element => element.props.role === 'alert' && elements(element, 'span').some(span => span.props.children === 'status unavailable')))
  })
})


describe('Mold settings information hierarchy', () => {
  it('retains API test, DB test and verified save in the first-run wizard', async () => {
    const h = fixture(); let root = h.render({ initialSetup: true })
    h.pending.resolve({ apiConfigured: false, dbPasswordConfigured: true }); await flush()
    password(root, 'moldAPIKey').props.onChange({ target: { value: 'example-api' } })
    password(root, 'moldSecretKey').props.onChange({ target: { value: 'example-secret' } })
    root = h.render({ initialSetup: true })
    await elements(root, antd.Button).find(button => button.props.children === 'moldNext').props.onClick()
    root = h.render({ initialSetup: true })
    assert.equal(elements(root, antd.Input.Password).length, 0)
    await elements(root, antd.Button).find(button => button.props.children === 'moldNext').props.onClick()
    root = h.render({ initialSetup: true })
    assert.equal(save(root).props.disabled, false)
    assert.equal(save(root).props.children, 'moldSaveAndConnect')
  })
  it('keeps the three areas in order and puts reset in the credential section', async () => {
    const h = fixture({ state: 'HEALTHY' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true, uiURL: 'http://mold.example/users' }); await flush()
    const root = h.render(), sections = elements(root, 'section')
    assert.equal(sections.length, 3)
    assert.equal(sections[0].props['aria-labelledby'], 'mold-connection-heading')
    assert.equal(sections[1].props['aria-labelledby'], 'mold-api-credentials-heading')
    assert.equal(sections[2].props['aria-labelledby'], 'mold-db-connection-heading')
    assert.equal(elements(sections[0], antd.Popconfirm).length, 0)
    assert.equal(elements(sections[1], antd.Popconfirm).length, 1)
    assert.equal(elements(sections[1], antd.Popconfirm)[0].props.okButtonProps.danger, true)
    assert.equal(elements(root, antd.Alert).length, 0, 'successful status must not render repeated success alerts')
    const menu = elements(root, antd.Dropdown)[0].props.menu
    assert.equal(menu.items.find(item => item.key === 'issue').label.props.href, 'http://mold.example/users')
    assert.equal(menu.items.find(item => item.key === 'reset').danger, true)
    menu.onClick({ key: 'reset' })
    assert.equal(reset(h.render()).props.open, true)
    reset(h.render()).props.onOpenChange(false)
    assert.equal(reset(h.render()).props.open, false)
    assert.equal(elements(root, antd.Collapse).length, 0, 'DB is an equal section rather than a separate advanced-settings collapse')
    const apiEdit = elements(sections[1], antd.Button).find(button => button.props.children === 'moldCredentialsEdit')
    const dbEdit = elements(sections[2], antd.Button).find(button => button.props.children === 'moldDBConnectionEdit')
    assert.equal(apiEdit.props.size, dbEdit.props.size)
    assert.equal(apiEdit.props.type, dbEdit.props.type)
    assert.equal(dbEdit.props['aria-expanded'], false)
    dbEdit.props.onClick()
    assert.ok(elements(h.render(), 'div').some(div => div.props.id === 'mold-db-connection-details'))
    elements(h.render(), antd.Button).find(button => button.props['aria-controls'] === 'mold-db-connection-details').props.onClick()
    assert.ok(!elements(h.render(), 'div').some(div => div.props.id === 'mold-db-connection-details'))
  })
  it('shows saved credentials separately from a failed connection', async () => {
    const h = fixture({ state: 'AUTHENTICATION_FAILED' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    const root = h.render(), sections = elements(root, 'section')
    assert.equal(elements(sections[0], antd.Tag)[0].props.color, 'error')
    assert.equal(elements(sections[1], antd.Tag)[0].props.children, 'moldSettingsFailure')
    assert.equal(elements(sections[1], antd.Tag)[0].props.color, 'error')
    assert.ok(elements(sections[1], 'p').some(p => p.props.children === 'moldCredentialsStorageDescription'))
  })
  it('renders registration guidance when absent without fabricating a healthy connection', async () => {
    const h = fixture({ state: 'UNCONFIGURED' }); h.render()
    h.pending.resolve({ apiConfigured: false, dbPasswordConfigured: true }); await flush()
    const root = h.render()
    assert.ok(elements(root, 'p').some(p => p.props.children === 'moldCredentialsEmptyDescription'))
    assert.ok(elements(root, antd.Tag).some(tag => tag.props.children === 'moldNotConfigured'))
    assert.ok(!elements(root, antd.Tag).some(tag => tag.props.children === 'moldConnected'))
  })
  it('does not treat configured credentials as proof of a verified connection', async () => {
    const h = fixture(); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    const root = h.render()
    assert.equal(elements(root, antd.Tag)[0].props.children, 'moldChecking')
    assert.equal(elements(root, antd.Tag)[1].props.children, 'moldChecking')
    assert.equal(elements(root, antd.Tag)[2].props.children, 'moldChecking')
    assert.ok(elements(root, 'p').some(p => p.props.children === 'moldAPIPendingVerification'))
  })
  it('does not report overall success until both saved API and actual DB access are verified', async () => {
    const h = fixture({ state: 'HEALTHY' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    let root = h.render()
    assert.deepEqual(elements(root, antd.Tag).map(tag => tag.props.children), ['moldChecking', 'moldSettingsSuccess', 'moldChecking'])
    await flush(); root = h.render()
    assert.equal(h.dbCalls, 1, 'opening the configured panel must verify DB automatically')
    assert.deepEqual(elements(root, antd.Tag).map(tag => tag.props.children), ['moldSettingsSuccess', 'moldSettingsSuccess', 'moldSettingsSuccess'])
    assert.equal(elements(root, antd.Input.Password).length, 0)
  })
  it('updates actual DB test failures and in-flight results without fabricating a missing configuration', async () => {
    const h = fixture({ state: 'HEALTHY' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    const pendingDB = deferred()
    h.api.testMoldDBConnection = () => pendingDB.promise
    let root = h.render()
    const testing = dbCheck(root).props.onClick()
    root = h.render()
    assert.equal(elements(root, antd.Tag)[2].props.children, 'moldChecking')
    assert.ok(dbCheck(root).props.loading)
    pendingDB.reject(new Error('DB refused access')); await testing
    root = h.render()
    assert.deepEqual(elements(root, antd.Tag).map(tag => tag.props.children), ['moldSettingsFailure', 'moldSettingsSuccess', 'moldSettingsFailure'])
    assert.ok(elements(root, 'span').some(span => span.props.children === 'DB refused access'))
  })
  it('keeps input-pair test success separate from the saved integration summary', async () => {
    const h = fixture({ state: 'AUTHENTICATION_FAILED' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    let root = h.render()
    password(root, 'moldAPIKey').props.onChange({ target: { value: 'example-api' } })
    password(root, 'moldSecretKey').props.onChange({ target: { value: 'example-secret' } })
    root = h.render()
    await elements(root, antd.Button).find(button => button.props.children === 'moldAPITest').props.onClick()
    root = h.render()
    assert.equal(elements(root, antd.Tag)[0].props.children, 'moldSettingsFailure', 'a successful draft test must not replace the saved API health')
    assert.equal(elements(root, antd.Tag)[1].props.children, 'moldSettingsSuccess')
    assert.ok(elements(root, 'p').some(p => p.props.children === 'moldAPIDraftVerification'))
  })
  it('does not label an untested draft or a storage-only save as a successful connection', async () => {
    const h = fixture({ state: 'HEALTHY' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    let root = h.render()
    elements(root, antd.Button).find(button => button.props.children === 'moldCredentialsEdit').props.onClick()
    root = h.render()
    password(root, 'moldAPIKey').props.onChange({ target: { value: 'example-new-api' } })
    root = h.render()
    assert.equal(elements(root, antd.Tag)[1].props.children, 'moldChecking')

    const unknown = fixture(); root = unknown.render()
    password(root, 'moldAPIKey').props.onChange({ target: { value: 'example-api' } })
    password(root, 'moldSecretKey').props.onChange({ target: { value: 'example-secret' } })
    root = unknown.render()
    await elements(root, antd.Form)[0].props.onFinish()
    root = unknown.render()
    assert.deepEqual(elements(root, antd.Tag).map(tag => tag.props.children), ['moldChecking', 'moldChecking', 'moldChecking'])
  })
  it('uses unconfigured only for explicit absence and keeps DB management inside its section', async () => {
    const h = fixture({ state: 'HEALTHY' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: false }); await flush()
    const root = h.render(), db = elements(root, 'section')[2]
    assert.equal(elements(db, antd.Tag)[0].props.children, 'moldNotConfigured')
    assert.equal(elements(root, antd.Tag)[0].props.children, 'moldNotConfigured')
    assert.equal(dbCheck(db).props.disabled, true)
    assert.equal(elements(db, antd.Input.Password).length, 0)
    elements(db, antd.Button).find(button => button.props.children === 'moldDBConnectionEdit').props.onClick()
    assert.ok(elements(h.render(), 'p').some(p => p.props.children === 'moldDBConnectionManagementDescription'))
  })
})


describe('Mold settings one-shot DB verification', () => {
  it('checks once on opening, without polling or blocking API editing', async () => {
    const h = fixture({ state: 'HEALTHY' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    h.render(); await flush()
    const root = h.render()
    assert.equal(h.dbCalls, 1)
    assert.equal(elements(root, antd.Tag)[2].props.children, 'moldSettingsSuccess')
    assert.equal(elements(root, antd.Button).find(b => b.props.children === 'moldCredentialsEdit').props.disabled, false)
    for (let i = 0; i < 5; i++) { h.render(); await flush() }
    assert.equal(h.dbCalls, 1)
  })
  it('skips unconfigured DBs and the first-run wizard', async () => {
    for (const props of [{ configured: false, initialSetup: false }, { configured: true, initialSetup: true }]) {
      const h = fixture(); h.render({ initialSetup: props.initialSetup })
      h.pending.resolve({ apiConfigured: false, dbPasswordConfigured: props.configured }); await flush()
      h.render({ initialSetup: props.initialSetup }); await flush(); h.render({ initialSetup: props.initialSetup })
      assert.equal(h.dbCalls, 0)
    }
  })
  it('cancels a pending check on close and ignores a late success', async () => {
    const h = fixture({ state: 'HEALTHY' }), pendingDB = deferred()
    let signal!: AbortSignal
    h.api.testMoldDBConnection = (_session: any, _password: string, inputSignal: AbortSignal) => { signal = inputSignal; return pendingDB.promise }
    h.render(); h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    let root = h.render()
    root = h.render()
    assert.equal(elements(root, antd.Button).find(b => b.props.children === 'moldCredentialsEdit').props.disabled, false)
    assert.equal(dbCheck(root).props.loading, true)
    assert.equal(dbCheck(root).props.disabled, true)
    h.unmount()
    assert.equal(signal.aborted, true)
    pendingDB.resolve({}); await flush()
    root = h.render()
    assert.ok(!elements(root, antd.Tag).slice(2).some(tag => tag.props.children === 'moldSettingsSuccess'))
  })
  it('shows a real automatic-check failure and allows an explicit retry', async () => {
    const h = fixture({ state: 'HEALTHY' })
    h.api.testMoldDBConnection = async () => { throw new Error('DB access denied') }
    h.render(); h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    h.render(); await flush()
    let root = h.render()
    assert.equal(elements(root, antd.Tag)[2].props.children, 'moldSettingsFailure')
    assert.ok(elements(root, 'span').some(span => span.props.children === 'DB access denied'))
    assert.equal(dbCheck(root).props.disabled, false)
    h.api.testMoldDBConnection = async () => ({})
    await dbCheck(root).props.onClick(); root = h.render()
    assert.equal(elements(root, antd.Tag)[2].props.children, 'moldSettingsSuccess')
  })
  it('retains a real DB result after an API-only save or reset', async () => {
    const h = fixture({ state: 'HEALTHY' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush(); h.render(); await flush()
    let root = h.render()
    await reset(root).props.onConfirm(); root = h.render()
    assert.equal(elements(root, antd.Tag)[2].props.children, 'moldSettingsSuccess')
    password(root, 'moldAPIKey').props.onChange({ target: { value: 'example-api' } })
    password(root, 'moldSecretKey').props.onChange({ target: { value: 'example-secret' } })
    root = h.render(); await elements(root, antd.Form)[0].props.onFinish(); root = h.render()
    assert.equal(elements(root, antd.Tag)[2].props.children, 'moldSettingsSuccess')
    assert.equal(h.dbCalls, 1)
  })
  it('keeps issuance, help and reset in the standard additional-actions menu', async () => {
    const h = fixture({ state: 'HEALTHY' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true, uiURL: 'http://mold.example/users' }); await flush()
    let root = h.render()
    const apiSection = elements(root, 'section')[1]
    assert.ok(!elements(apiSection, antd.Button).some(button => button.props.danger))
    const dropdown = elements(apiSection, antd.Dropdown)[0]
    assert.deepEqual(Array.from(dropdown.props.menu.items.filter(item => item.key).map(item => item.key)), ['issue', 'help', 'reset'])
    dropdown.props.menu.onClick({ key: 'help' }); root = h.render()
    assert.equal(elements(root, antd.Modal)[0].props.open, true)
    elements(root, antd.Modal)[0].props.onCancel()
    assert.equal(elements(h.render(), antd.Modal)[0].props.open, false)
    assert.equal(dbCheck(root).props.children, undefined, 'recheck is an icon action, not a dominant standalone button')
  })
})
