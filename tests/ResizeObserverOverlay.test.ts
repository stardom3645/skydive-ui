import * as assert from 'assert'

describe('Development runtime error overlay', () => {
  const config = require('../webpack.config.js')
  const includeRuntimeError = config.devServer.client.overlay.runtimeErrors

  it('ignores browser ResizeObserver delivery warnings and preserves real errors', () => {
    assert.strictEqual(includeRuntimeError(new Error('ResizeObserver loop completed with undelivered notifications.')), false)
    assert.strictEqual(includeRuntimeError(new Error('ResizeObserver loop limit exceeded')), false)
    assert.strictEqual(includeRuntimeError(new Error('application failure')), true)
  })
})
