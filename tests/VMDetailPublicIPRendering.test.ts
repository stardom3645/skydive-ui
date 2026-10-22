import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { normalizeTopologyVM } from '../src/TopologyResourceData'
import { vmMemoryBytes } from '../src/TopologyResourceMetrics'
import { vmPublicIPAddresses } from '../src/VMPublicIPs'
import { vmShowsOperatingSystem } from '../src/VMOperatingSystem'

const ast = ts.createSourceFile('VM.tsx', fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/VMDetailPanel.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const component = ast.statements.filter(ts.isClassDeclaration).find(item => item.name?.text === 'VMDetailPanel')!
const names = ['render', 'publicIps', 'mergedData', 'inventoryVMDetail', 'normalizeMoldVM', 'inventoryVirtualMachines', 'vmKeys', 'formatMemory']
const methods = component.members.filter(item => item.name && names.includes(item.name.getText(ast))).map(item => item.getText(ast)).join('\n')
const helpers = ast.statements.filter(ts.isVariableStatement).map(item => item.getText(ast)).join('\n')
const context: any = { normalizeTopologyVM, vmMemoryBytes, vmPublicIPAddresses, vmShowsOperatingSystem, translate: (key: string) => key,
    DnsIcon: 'cpu', MemoryIcon: 'memory', StorageIcon: 'disk', DetailSectionIcon: 'icon', HostResourceTrendPanel: 'trend',
    React: { Fragment: 'fragment', Component: class { constructor(public props: any) {} },
        createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }) } }
vm.createContext(context)
vm.runInContext(ts.transpile(`${helpers}\nclass Probe extends React.Component { ${methods} }; this.Probe = Probe`,
    { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
function basicRows(detail: any, data: any = {}) {
    const panel = new context.Probe({ node: { id: 'node', data: { Name: 'i-2-28-VM', UUID: 'vm-1', Type: 'libvirt', ...data } },
        classes: {}, vmDetailMap: { 'vm-1': detail } })
    panel.topologyHost = () => undefined
    for (const method of ['topologyNetworkLayerNodes', 'topologyNicNodes', 'topologyHostBridgeNodes']) panel[method] = () => []
    panel.privateIp = () => '10.0.0.2'; panel.statusText = () => 'normal'; panel.layerIcon = () => 'icon'
    panel.renderRows = (rows: any) => rows; panel.renderOverviewGrid = () => null; panel.renderNetworkInformation = () => null
    panel.renderMetricGrid = () => null
    panel.renderSection = (_: any, title: string, rows: any) => ({ title, rows })
    return panel.render().children.find((section: any) => section?.title === 'hostBasicInfo').rows as any[]
}

describe('VM basic information public IP rendering', () => {
    it('omits CCVM Guest OS while retaining its resources and the OS row for regular VMs', () => {
        const rows = basicRows({}, { Name: 'ccvm', OS: 'hvm', CpuNumber: 8, Memory: 16384 })
        assert.equal(rows.some(row => row.label === 'Guest OS'), false)
        assert.equal(rows.find(row => row.label === 'vmCpu').value, '8 vCPU')
        assert.equal(rows.find(row => row.label === 'vmMemory').value, '16384 MB (16 GB)')
        assert.equal(basicRows({ guestOS: 'Rocky Linux 9' }).find(row => row.label === 'Guest OS').value, 'Rocky Linux 9')
    })
    it('retains the private IP and renders all confirmed public IPs in the existing copyable row', () => {
        const rows = basicRows({ uuid: 'vm-1', instanceName: 'i-2-28-VM', publicIps: ['192.0.2.1', '192.0.2.2'] })
        assert.equal(rows.find(row => row.label === 'vmPrivateIp').value, '10.0.0.2')
        const publicRow = rows.find(row => row.label === 'vmPublicIp')
        assert.equal(publicRow.value, '192.0.2.1, 192.0.2.2')
        assert.equal(publicRow.copy, true)
    })
    it('omits the public IP row for absent or mismatched bindings without an empty placeholder', () => {
        for (const detail of [{ uuid: 'vm-1' }, { uuid: 'vm-1', publicIps: [] }, { uuid: 'vm-2', publicIps: ['192.0.2.5'] }]) {
            assert.equal(basicRows(detail).some(row => row.label === 'vmPublicIp'), false)
        }
    })
})
