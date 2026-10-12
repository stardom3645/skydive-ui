import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

describe('Mold network catalog request', () => {
    it('reuses the configured endpoint/token and rejects missing network identities', async () => {
        let request: any
        const context: any = { exports: {}, require: () => ({ translate: (key: string) => key }), fetch: async (url: string, options: any) => {
            request = { url, options }
            return { ok: true, json: async () => ({ networks: [{ networkId: 'uuid-a', networkName: 'A' }, { networkName: 'B' }] }) }
        } }
        vm.createContext(context)
        const source = fs.readFileSync(path.resolve(__dirname, '../src/RelatedServicesAPI.ts'), 'utf8')
        vm.runInContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }), context)
        const networks = await context.exports.getMoldNetworks({ endpoint: 'http://netdive.example:8082/', token: 'test-token' })
        assert.equal(request.url, 'http://netdive.example:8082/api/mold/networks')
        assert.equal(request.options.headers['X-Auth-Token'], 'test-token')
        assert.equal(request.options.credentials, 'same-origin')
        assert.equal(networks.length, 1)
        assert.equal(networks[0].networkId, 'uuid-a')
    })
})
