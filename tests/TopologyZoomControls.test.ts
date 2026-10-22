import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as React from 'react'
import * as ts from 'typescript'
import * as vm from 'vm'

const source = readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const cls = ast.statements.find(item => ts.isClassDeclaration(item) && item.name?.text === 'App') as ts.ClassDeclaration
const methods = ['onTopologyZoomChange', 'zoomTopology'].map(name => cls.members.find(member => member.name?.getText(ast) === name)!.getText(ast)).join('\n')
const context: any = {}
vm.runInNewContext(ts.transpile(`class Probe { ${methods} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2018 }), context)
const controlExports: any = {}
vm.runInNewContext(ts.transpileModule(readFileSync(path.resolve(__dirname, '../src/TopologyZoomControls.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2018 }
}).outputText, { exports: controlExports, require: (name: string) => {
    if (name === 'react') return React
    if (name === './Config') return { translate: (key: string) => key }
    return { default: () => null, Tooltip: () => null }
} })

describe('Topology zoom readout isolation', () => {
    it('updates only the control during D3 frames and keeps the latest value for button navigation', () => {
        const app = new context.Probe()
        const values: number[] = []
        app.setState = () => { throw new Error('zoom must not re-render the App or its resource summaries') }
        app.topologyZoomControls = { current: { setZoom: (value: number) => values.push(value) } }
        for (let i = 0; i < 100; i++) app.onTopologyZoomChange(.2 + i / 100)
        assert.equal(values.length, 100)
        assert.equal(app.currentTopologyZoom, 1.19)
        let requested = 0
        app.tc = { setZoomLevel: (value: number) => { requested = value } }
        app.zoomTopology(-.1)
        assert.ok(Math.abs(requested - 1.09) < 1e-9)
        app.topologyZoomControls.current = null
        assert.doesNotThrow(() => app.onTopologyZoomChange(.5))
    })
    it('retains the zoom limits, percent readout, disabled buttons and callbacks', () => {
        const deltas: number[] = []; let resets = 0
        const control = new controlExports.default({ initialZoom: .55, classes: {}, onZoom: (delta: number) => deltas.push(delta), onReset: () => resets++ })
        let updates = 0
        control.setState = (patch: any) => { updates++; Object.assign(control.state, patch) }
        control.setZoom(.552)
        assert.equal(updates, 0)
        control.setZoom(5)
        assert.equal(control.state.zoom, 1.5)
        const children = control.render().props.children
        assert.equal(children[1].props.children.props.children, '150%')
        assert.equal(children[2].props.children.props.children.props.disabled, true)
        children[0].props.children.props.children.props.onClick()
        children[1].props.children.props.onClick()
        assert.deepEqual(deltas, [-.1]); assert.equal(resets, 1)
        control.setZoom(.01)
        assert.equal(control.state.zoom, .1)
        assert.equal(control.render().props.children[0].props.children.props.children.props.disabled, true)
    })
})
