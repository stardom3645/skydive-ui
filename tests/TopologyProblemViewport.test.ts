import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

const source = ts.createSourceFile('Topology.tsx', readFileSync(path.resolve(__dirname, '../src/Topology.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const cls = source.statements.find(item => ts.isClassDeclaration(item) && item.name?.text === 'Topology') as ts.ClassDeclaration
const names = ['deferProblemViewportRender', 'finishProblemViewportMove', 'renderTree']
const body = names.map(name => cls.members.find(member => member.name?.getText(source) === name)!.getText(source)).join('\n')
const harness = () => {
    const frames = new Map<number, () => void>(); let id = 0
    const context: any = { window: { requestAnimationFrame: (callback: () => void) => { frames.set(++id, callback); return id } } }
    vm.runInNewContext(ts.transpile(`class Probe { ${body} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
    const app = new context.Probe()
    const flush = () => { const callbacks = Array.from(frames.values()); frames.clear(); callbacks.forEach(fn => fn()) }
    return { app, frames, flush }
}
describe('Problem viewport render coalescing', () => {
    it('skips actual tree layout during a gesture and paints the latest data once on release', () => {
        const { app, frames, flush } = harness()
        app.problemViewportMoving = true
        app.nodes = new Map([['pod', { state: 'failed' }]])
        for (let i = 0; i < 100; i++) assert.doesNotThrow(() => app.renderTree())
        // Data mutation is never delayed or dropped by the rendering guard.
        app.nodes.set('pod', { state: 'ready' })
        let paints = 0
        app.renderTree = () => { paints++; assert.equal(app.nodes.get('pod').state, 'ready') }
        app.finishProblemViewportMove(); app.finishProblemViewportMove()
        assert.equal(frames.size, 1)
        flush()
        assert.equal(paints, 1)
        assert.equal(app.problemViewportRenderPending, false)
    })
    it('retains a pending paint if another gesture begins before the scheduled frame', () => {
        const { app, frames, flush } = harness(); let paints = 0
        app.renderTree = () => paints++
        app.problemViewportMoving = true
        app.deferProblemViewportRender(); app.finishProblemViewportMove()
        app.problemViewportMoving = true
        flush()
        assert.equal(paints, 0)
        app.finishProblemViewportMove()
        assert.equal(frames.size, 1)
        flush()
        assert.equal(paints, 1)
        assert.equal(app.deferProblemViewportRender(), false)
        app.finishProblemViewportMove()
        assert.equal(frames.size, 0)
    })
})
