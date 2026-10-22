import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as React from 'react'
import * as ts from 'typescript'
import * as vm from 'vm'

const source = ts.transpileModule(readFileSync(path.resolve(__dirname, '../src/ProblemsPanel.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2018 }
}).outputText
const exportsForTest: any = {}
vm.runInNewContext(source, { exports: exportsForTest, require: (name: string) => {
    if (name === 'react') return React
    if (name === '@ant-design/icons') return new Proxy({}, { get: () => () => null })
    return {}
} })
const compare = exportsForTest.default.compare
describe('Preserved problem workspace rendering', () => {
    it('skips hidden table updates even on the first close without unmounting its component', () => {
        assert.equal(typeof exportsForTest.default.type, 'function')
        assert.equal(compare({ suspended: false }, { suspended: true, nodes: [{}], links: [{}] }), true)
        assert.equal(compare({ suspended: true }, { suspended: true, nodes: [], connected: false }), true)
    })
    it('always accepts the latest graph and connection state on reopening or while visible', () => {
        assert.equal(compare({ suspended: false, nodes: [{}] }, { suspended: false, nodes: [], connected: false }), false)
        assert.equal(compare({ suspended: true, nodes: [{}] }, { suspended: false, nodes: [], listRevision: 4 }), false)
        assert.equal(compare({}, {}), false)
    })
})
