import * as assert from 'assert'
import { collectedRiskCount, currentImpactAssessment, riskPlacementCoverage, switchRiskPlacements } from '../src/KubernetesRiskResilience'

const unknown = 'unknown'
describe('Kubernetes risk and resilience', () => {
    it('does not declare missing current state healthy, but preserves observed incidents', () => {
        assert.deepStrictEqual(currentImpactAssessment(0, false), { evaluated: false, partial: false })
        assert.deepStrictEqual(currentImpactAssessment(30, false), { evaluated: true, partial: true })
        assert.deepStrictEqual(currentImpactAssessment(0, true), { evaluated: true, partial: false })
    })

    it('distinguishes a collected zero external paths from missing or invalid counts', () => {
        ;[undefined, null, '', ' ', NaN, Infinity, -1, 1.5, {}, false, 'invalid'].forEach(value => {
            assert.strictEqual(collectedRiskCount(value), undefined)
        })
        assert.strictEqual(collectedRiskCount(0), 0)
        assert.strictEqual(collectedRiskCount('0'), 0)
        assert.strictEqual(collectedRiskCount(2), 2)
    })

    it('preserves both switch uplinks independently of discovery order without doubling coverage', () => {
        const hosts = [{ label: 'host-a', count: 3 }]
        const first = switchRiskPlacements(hosts, new Map([['host-a', new Set(['b', 'a', 'b'])]]), unknown)
        const reversed = switchRiskPlacements(hosts, new Map([['host-a', new Set(['a', 'b'])]]), unknown)
        assert.deepStrictEqual(first, reversed)
        assert.deepStrictEqual(first.map(item => item.label), ['a', 'b'])
        const coverage = riskPlacementCoverage(first, 3, unknown)
        assert.strictEqual(coverage.knownCount, 3)
        assert.strictEqual(coverage.complete, true)
        assert.strictEqual(coverage.topPercent, 50)
    })

    it('keeps a real single-switch concentration and unmapped hosts visible', () => {
        const placements = switchRiskPlacements([{ label: 'a', count: 3 }, { label: 'b', count: 7 }], new Map([['a', new Set(['switch'])]]), unknown)
        const coverage = riskPlacementCoverage(placements, 10, unknown)
        assert.strictEqual(coverage.knownCount, 3)
        assert.strictEqual(coverage.complete, false)
        assert.strictEqual(coverage.topPercent, 100)
        assert.strictEqual(placements.find(item => item.label === unknown)!.count, 7)
    })

    it('does not treat two mapped nodes out of ten as complete distributed placement', () => {
        const partial = riskPlacementCoverage([{ label: 'a', count: 1 }, { label: 'b', count: 1 }, { label: unknown, count: 8 }], 10, unknown)
        assert.strictEqual(partial.complete, false)
        assert.strictEqual(partial.knownCount, 2)
        assert.strictEqual(riskPlacementCoverage([], 0, unknown).complete, false)
        assert.strictEqual(riskPlacementCoverage([{ label: 'a', count: 5 }, { label: 'b', count: 5 }], 10, unknown).complete, true)
    })
})

// Execute the panel's actual methods without loading the browser-only topology UI.
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'

function panelProbe() {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/KubernetesClusterDetailPanel.tsx'), 'utf8')
    const ast = ts.createSourceFile('panel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const panel = ast.statements.find(ts.isClassDeclaration)!
    const body = panel.members.filter(member => member.name && ['switchPlacements', 'placementAnalysis'].includes(member.name.getText(ast)))
        .map(member => member.getText(ast)).join('\n')
    const context: any = {
        translate: (key: string) => key,
        firstValue: (data: any, keys: string[]) => keys.map(key => data[key]).find(Boolean) || '',
        endpointID: (endpoint: any) => typeof endpoint === 'string' ? endpoint : endpoint.id,
        switchRiskPlacements, riskPlacementCoverage
    }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`class Probe { ${body} }; this.Probe = Probe`, { target: ts.ScriptTarget.ES2017 }), context)
    return new context.Probe()
}

describe('Kubernetes cluster panel risk integration', () => {
    it('retains both topology edges when discovering a dual-connected host', () => {
        const panel = panelProbe()
        const host = { id: 'host', data: { Type: 'host', Name: 'host' } }
        const port = { id: 'port', data: {}, parent: host }
        const a = { id: 'a', data: { Type: 'switch', Name: 'a' } }
        const b = { id: 'b', data: { Type: 'switch', Name: 'b' } }
        panel.topologyLinks = () => [{ source: 'port', target: 'a' }, { source: 'port', target: 'b' }]
        panel.topologyNodes = () => [host, port, a, b]
        const placements = panel.switchPlacements([{ label: 'host', count: 3 }])
        panel.topologyNodes = () => [host, port, b, a]
        assert.strictEqual(JSON.stringify(placements), JSON.stringify(panel.switchPlacements([{ label: 'host', count: 3 }])))
        assert.strictEqual(placements.length, 2)
        assert.strictEqual(panel.placementAnalysis(placements, 3, true).tone, 'success')
    })

    it('renders partial coverage as neutral instead of good for hosts and network', () => {
        const panel = panelProbe()
        ;[false, true].forEach(network => {
            const analysis = panel.placementAnalysis([{ label: 'a', count: 1 }, { label: 'b', count: 1 }, { label: 'kubernetesPlacementUnknown', count: 8 }], 10, network)
            assert.strictEqual(analysis.tone, 'default')
            assert.strictEqual(analysis.label, '부분 수집')
            assert.ok(analysis.description.includes('10개 노드 중 2개'))
        })
    })
})
