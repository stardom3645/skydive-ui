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
  let cursor = 0, statusSignal: AbortSignal | undefined, statusCalls = 0
  const api = {
    getMoldCredentialsStatus: (_session: any, signal: AbortSignal) => { statusCalls++; statusSignal = signal; return pending.promise },
    resetMoldCredentials: async () => ({ apiConfigured: false, dbPasswordConfigured: true }),
    saveMoldCredentials: async () => ({ apiConfigured: true, dbPasswordConfigured: true }),
    testMoldAPIConnection: async () => ({}), testMoldDBConnection: async () => ({})
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
  return { pending, api, get statusSignal() { return statusSignal }, get statusCalls() { return statusCalls },
    render(extra: any = {}) { cursor = 0; const element = exports.default({ health, userSession: { endpoint: 'http://example.test', token: 'example' }, ...extra }); effects.splice(0).forEach(run => run()); return element }
  }
}
function elements(root: any, type: any): any[] {
  if (!root || typeof root !== 'object') return []
  if (Array.isArray(root)) return root.reduce((all, item) => all.concat(elements(item, type)), [])
  return [...(root.type === type ? [root] : []), ...elements(root.props?.children, type)]
}
const password = (root: any, label: string) => elements(root, antd.Input.Password).find(element => element.props['aria-label'] === label)
const reset = (root: any) => elements(root, antd.Popconfirm)[0]
const save = (root: any) => elements(root, antd.Button).find(element => element.props.htmlType === 'submit')

describe('Mold credential editing without waiting for status', () => {
  it('hides input for verified saved credentials even while status is pending or fails', async () => {
    const h = fixture({ state: 'HEALTHY' }); let root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 0)
    assert.ok(elements(root, antd.Button).some(button => button.props.children === 'moldCredentialsEdit' && !button.props.disabled))
    h.pending.reject(new Error('status unavailable')); await flush(); root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 0)
    assert.equal(elements(root, antd.Collapse)[0].props.items[0].extra.props.children, 'moldStatusUnknown')
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
    await elements(root, antd.Form)[0].props.onFinish(); root = h.render()
    assert.equal(elements(root, antd.Input.Password).length, 0)
    assert.equal(save(root), undefined)
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
    assert.equal(sections.length, 2)
    assert.equal(sections[0].props['aria-labelledby'], 'mold-connection-heading')
    assert.equal(sections[1].props['aria-labelledby'], 'mold-api-credentials-heading')
    assert.equal(elements(sections[0], antd.Popconfirm).length, 0)
    assert.equal(elements(sections[1], antd.Popconfirm).length, 1)
    assert.equal(elements(sections[1], antd.Popconfirm)[0].props.okButtonProps.danger, true)
    assert.equal(elements(root, antd.Alert).length, 0, 'successful status must not render repeated success alerts')
    assert.equal(elements(root, 'a')[0].props.href, 'http://mold.example/users')
    const collapse = elements(root, antd.Collapse)[0]
    assert.equal(collapse.props.activeKey.length, 0)
    assert.equal(collapse.props.items[0].key, 'db')
    collapse.props.onChange(['db'])
    assert.equal(elements(h.render(), antd.Collapse)[0].props.activeKey[0], 'db')
    elements(h.render(), antd.Collapse)[0].props.onChange([])
    assert.equal(elements(h.render(), antd.Collapse)[0].props.activeKey.length, 0)
  })
  it('shows saved credentials separately from a failed connection', async () => {
    const h = fixture({ state: 'AUTHENTICATION_FAILED' }); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    const root = h.render(), sections = elements(root, 'section')
    assert.equal(elements(sections[0], antd.Tag)[0].props.color, 'error')
    assert.equal(elements(sections[1], antd.Tag)[0].props.children, 'moldCredentialsRegistered')
    assert.equal(elements(sections[1], antd.Tag)[0].props.color, undefined)
  })
  it('renders registration guidance when absent without fabricating a healthy connection', async () => {
    const h = fixture({ state: 'UNCONFIGURED' }); h.render()
    h.pending.resolve({ apiConfigured: false, dbPasswordConfigured: true }); await flush()
    const root = h.render()
    assert.ok(elements(root, 'p').some(p => p.props.children === 'moldCredentialsEmptyDescription'))
    assert.ok(elements(root, antd.Tag).some(tag => tag.props.children === 'moldCredentialsUnregistered'))
    assert.ok(!elements(root, antd.Tag).some(tag => tag.props.children === 'moldConnected'))
  })
  it('does not treat configured credentials as proof of a verified connection', async () => {
    const h = fixture(); h.render()
    h.pending.resolve({ apiConfigured: true, dbPasswordConfigured: true }); await flush()
    const root = h.render()
    assert.equal(elements(root, antd.Tag)[0].props.children, 'moldChecking')
    assert.equal(elements(root, antd.Tag)[1].props.children, 'moldCredentialsRegistered')
  })
})
