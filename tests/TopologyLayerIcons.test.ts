import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { topologyLayerGlyph } from '../src/TopologyLayerIcons'
import { topologyNodePresentation } from '../src/TopologyNodePresentation'

// Run the production attribute and layer-guide methods; synthetic group names
// deliberately omit the identifying r-/s-/v- prefixes and NIC metadata.
const ast = (file: string) => ts.createSourceFile(file, fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const config = ast('Config.ts'), topology = ast('Topology.tsx')
const configClass = config.statements.filter(ts.isClassDeclaration)
    .find(node => node.members.some(member => member.name?.getText(config) === 'nodeAttrsInfra'))!
const methods = ['newAttrs', 'nodeAttrsInfra']
const members = configClass.members.filter(member => member.name && methods.includes(member.name.getText(config)))
    .map(member => member.getText(config)).join('\n')
const constants = config.statements.filter(ts.isVariableStatement)
    .filter(statement => /(?:WEIGHT_|SHOW_DEBUG)/.test(statement.declarationList.declarations[0].name.getText(config)))
    .map(statement => statement.getText(config).replace(/^export /, '')).join('\n')
const levelMethod = topology.statements.filter(ts.isClassDeclaration).find(node => node.name?.text === 'Topology')!
    .members.find(member => member.name?.getText(topology) === 'levelLabelIcon')!
const context: any = { topologyLayerGlyph, switchDisplayName: (_data: any, name: string) => name }
vm.createContext(context)
vm.runInContext(ts.transpile(`${constants}\nclass Probe { ${members}\n${levelMethod.getText(topology)} }; this.probe = new Probe();`,
    { target: ts.ScriptTarget.ES2018 }), context)
const probe = context.probe

describe('Topology layer and object icons', () => {
    it('keeps router, system VM, user VM and bridge groups on their real layer after names are translated', () => {
        for (const [type, name, weight] of [
            ['libvirt', '가상 라우터 그룹', 7070], ['libvirt', '시스템 가상머신 그룹', 7060],
            ['libvirt', '사용자 가상머신 그룹', 7080], ['bridge', '호스트 브릿지 그룹', 5035],
            ['bridge', '가상 브릿지 그룹', 7040], ['device', '가상 네트워크 그룹', 7050]
        ] as Array<[string, string, number]>) {
            const node = { id: name, data: { Type: type, Name: name, IsTopologyGroup: true }, getWeight: () => weight }
            const before = JSON.stringify(node.data), attrs = probe.nodeAttrsInfra(node)
            assert.equal(attrs.weight, weight)
            assert.equal(attrs.icon, probe.levelLabelIcon(name, weight))
            assert.equal(JSON.stringify(node.data), before)
        }
    })

    it('matches individual infrastructure resources with the guide independent of language', () => {
        for (const data of [
            { Type: 'host', Name: 'host' }, { Type: 'device', Name: 'eth0' }, { Type: 'bond', Name: 'bond0' },
            { Type: 'vlan', Name: 'vlan10' }, { Type: 'netns', Name: 'namespace' },
            { Type: 'container', Name: 'container' }, { Type: 'libvirt', Name: 'r-10-VM' },
            { Type: 'libvirt', Name: 's-11-VM' }, { Type: 'libvirt', Name: 'user-vm' }
        ]) {
            const attrs = probe.nodeAttrsInfra({ id: data.Name, data })
            assert.equal(attrs.icon, probe.levelLabelIcon('translated title', attrs.weight), data.Name)
        }
        assert.equal(probe.levelLabelIcon('가상 네임스페이스', 7010), '\uf24d')
        assert.equal(probe.levelLabelIcon('Virtual Containers', 7030), '\uf49e')
        assert.equal(probe.levelLabelIcon('쿠버네티스 서비스', 3060), '\uf6ff')
    })

    it('retains title-based icons for custom layers outside the built-in weights', () => {
        assert.equal(probe.levelLabelIcon('Virtual Router', 90001), '\uf4d7')
        assert.equal(probe.levelLabelIcon('Kubernetes Namespace', 90002), '\uf07b')
        assert.equal(topologyLayerGlyph(90001), undefined)
    })

    it('retains router/system/user roles in card descriptions even though all use collector Type libvirt', () => {
        for (const [weight, kind] of [[7070, '가상 라우터'], [7060, '시스템 가상머신'], [7080, '사용자 가상머신']] as Array<[number, string]>) {
            const node: any = { id: kind, data: { Type: 'libvirt', Name: kind, IsTopologyGroup: true },
                children: [], state: {}, getWeight: () => weight }
            assert.equal(topologyNodePresentation(node, { name: kind, group: true }).kind, kind)
        }
    })
})
