import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { isExpiredLLDPLink, nextLLDPExpiryDelay } from '../src/LLDPTopologyValidity'

const link = (expires?: number): any => ({ data: expires === undefined ? {} : { LLDP: { ExpiresAt: expires } } })
describe('LLDP topology freshness without agent events (F05)', () => {
    it('keeps legacy/ordinary relations and expires only dated observations', () => {
        assert.equal(isExpiredLLDPLink(link(), 100), false)
        assert.equal(isExpiredLLDPLink(link(100), 100), true)
        assert.equal(isExpiredLLDPLink(link(101), 100), false)
        assert.equal(isExpiredLLDPLink(link(0), 100), true)
        assert.equal(nextLLDPExpiryDelay([link(), link(90), link(120), link(110)], 100), 11)
        assert.equal(nextLLDPExpiryDelay([link(), link(90)], 100), undefined)
    })
    it('redraws at the next expiry and replaces the timer on observation refresh', () => {
        const source = ts.createSourceFile('Topology.tsx', readFileSync(path.join(__dirname, '../src/Topology.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        const component = source.statements.filter(ts.isClassDeclaration).find(item => item.name?.text === 'Topology')!
        const method = component.members.find(item => ts.isMethodDeclaration(item) && item.name.getText(source) === 'scheduleLLDPExpiry')!
        let callback: () => void = () => {}, nextID = 0, cleared: number[] = [], delay = 0
        const Probe = vm.runInNewContext(ts.transpile(`class Probe { ${method.getText(source)} }; Probe`, { target: ts.ScriptTarget.ES2018 }), {
            nextLLDPExpiryDelay: (links: any) => nextLLDPExpiryDelay(links, 100),
            window: { clearTimeout: (id: number) => cleared.push(id), setTimeout: (cb: any, ms: number) => { callback = cb; delay = ms; return ++nextID } }
        })
        const probe = new Probe(); let paints = 0
        probe.links = new Map([['edge', link(110)]]); probe.renderTree = () => paints++
        probe.scheduleLLDPExpiry(); assert.equal(delay, 11)
        probe.links.set('edge', link(130)); probe.scheduleLLDPExpiry()
        assert.deepEqual(cleared, [1]); assert.equal(delay, 31)
        callback(); assert.equal(paints, 1); assert.equal(probe.invalidated, true)
        probe.links.clear(); probe.scheduleLLDPExpiry(); assert.equal(nextID, 2)
    })
})
