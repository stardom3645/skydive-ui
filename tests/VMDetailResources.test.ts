import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { normalizeTopologyVM, topologyInventoryData } from '../src/TopologyResourceData'
import { vmPublicIPAddresses } from '../src/VMPublicIPs'
import { topologyResourceMetrics, vmMemoryBytes } from '../src/TopologyResourceMetrics'

// Run the panel's actual metadata merge and formatter without mounting React.
const source = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/VMDetailPanel.tsx'), 'utf8')
const ast = ts.createSourceFile('VMDetailPanel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const helpers = ['asArray', 'isBlank', 'stringify', 'firstValue', 'trimFixed', 'uniqueStrings']
const declarations = ast.statements.filter(ts.isVariableStatement)
    .filter(statement => statement.declarationList.declarations.some(declaration => helpers.includes(declaration.name.getText(ast))))
    .map(statement => statement.getText(ast)).join('\n')
const panelClass = ast.statements.filter(ts.isClassDeclaration).find(node => node.name?.text === 'VMDetailPanel')!
const names = ['inventoryVirtualMachines', 'vmKeys', 'inventoryVMDetail', 'normalizeMoldVM', 'mergedData', 'formatMemory', 'vmNetworkEntries', 'publicIps']
const methods = panelClass.members.filter(member => member.name && names.includes(member.name.getText(ast)))
    .map(member => member.getText(ast)).join('\n')
const context: any = { normalizeTopologyVM, vmMemoryBytes, vmPublicIPAddresses,
    React: { Component: class { constructor(public props: any) {} } } }
vm.createContext(context)
vm.runInContext(ts.transpile(`${declarations}\nclass VMDetailPanel extends React.Component { ${methods} }; this.Panel = VMDetailPanel`,
    { target: ts.ScriptTarget.ES2018 }), context)

const node = (name: string, extra: any = {}): any => ({ id: 'topology-vm',
    data: { Type: 'libvirt', Manager: 'libvirt', Name: name, UUID: 'vm-uuid', ...extra } })

describe('VM detail resources', () => {
    it('preserves collected resources when Mold returns empty allocations', () => {
        const resource = node('i-2-28-VM', { CpuNumber: 4, Memory: 8192 })
        const details = { 'vm-uuid': { name: 'U26-Sparse', cpuNumber: '', memory: '', guestOS: 'Ubuntu 24.04 LTS' } }
        const original = JSON.stringify(resource.data)
        const panel = new context.Panel({ node: resource, vmDetailMap: details })
        const data = panel.mergedData()
        assert.equal(data.CpuNumber, 4)
        assert.equal(data.Memory, 8192)
        assert.equal(data.GuestOS, 'Ubuntu 24.04 LTS')
        assert.equal(panel.formatMemory(String(data.Memory)), '8192 MB (8 GB)')
        const cardData = topologyInventoryData(resource, undefined, details)
        assert.deepEqual(topologyResourceMetrics(resource, { inventory: cardData }).map(metric => metric.value), ['4Core', '8GiB'])
        assert.equal(JSON.stringify(resource.data), original)
    })

    it('uses valid Mold allocations and supports lower-case resource aliases', () => {
        const resource = node('i-2-28-VM', { cpucount: 2, memorytotal: 2048 })
        const fallback = new context.Panel({ node: resource }).mergedData()
        assert.equal(fallback.CpuNumber, 2)
        assert.equal(fallback.Memory, 2048)
        const panel = new context.Panel({ node: resource,
            moldInventory: { vms: [{ id: 'vm-uuid', cpunumber: '6', memory: '12288' }] } })
        const data = panel.mergedData()
        assert.equal(data.CpuNumber, '6')
        assert.equal(panel.formatMemory(data.Memory), '12288 MB (12 GB)')
    })

    it('does not let blank canonical fields hide available aliases or collected resources', () => {
        const resource = node('i-2-28-VM', { CpuNumber: 4, Memory: 4096 })
        const panel = new context.Panel({ node: resource,
            vmDetailMap: { 'vm-uuid': { CpuNumber: ' ', cpuNumber: '2', Memory: 'N/A', memory: '2048' } } })
        assert.equal(panel.mergedData().CpuNumber, '2')
        assert.equal(panel.mergedData().Memory, '2048')
        const missing = new context.Panel({ node: resource,
            vmDetailMap: { 'vm-uuid': { CpuNumber: '', Memory: 'N/A' } } })
        assert.equal(missing.mergedData().CpuNumber, 4)
        assert.equal(missing.mergedData().Memory, 4096)
    })

    it('uses collected system VM allocations and formats unit-bearing memory correctly', () => {
        const resource = node('ccvm', { CpuNumber: 4, Memory: '8GiB' })
        const panel = new context.Panel({ node: resource,
            moldInventory: { vms: [{ name: 'ccvm', cpuNumber: 99, memory: 1024 }] } })
        assert.equal(panel.mergedData().CpuNumber, 4)
        assert.equal(panel.formatMemory(panel.mergedData().Memory), '8192 MB (8 GB)')
        assert.equal(panel.formatMemory('512MiB'), '512 MB (0.5 GB)')
    })

    it('does not invent allocations from usage percentages', () => {
        const resource = node('i-2-28-VM', { CPUPercent: 12, MemoryPercent: 25 })
        const data = new context.Panel({ node: resource }).mergedData()
        assert.equal(data.CpuNumber, undefined)
        assert.equal(data.Memory, undefined)
        assert.equal(data.CPUPercent, 12)
        assert.equal(data.MemoryPercent, 25)
    })
})


describe('VM detail NIC and public address identity', () => {
    it('keeps separate NIC network names, addresses and MACs, including multiple NICs on the same network', () => {
        const entries = [
            { networkName: 'Admin L2', macAddress: '02:00:00:00:00:01', ipAddress: '10.0.0.10', vmUuid: 'vm-uuid' },
            { networkName: 'Guest Isolated', macAddress: '02:00:00:00:00:02', ipAddress: '10.1.0.10', vmUuid: 'vm-uuid' },
            { networkName: 'Admin L2', macAddress: '02:00:00:00:00:03', ipAddress: '10.0.0.11', vmUuid: 'vm-uuid' },
            { networkName: 'Other VM', macAddress: '02:00:00:00:00:04', ipAddress: '10.0.0.12', vmUuid: 'other-vm' }
        ]
        const panel = new context.Panel({ node: node('i-2-28-VM'), vmNetworkMap: { 'i-2-28-VM': entries } })
        assert.deepEqual(panel.vmNetworkEntries().map((nic: any) => nic.networkName), ['Admin L2', 'Guest Isolated', 'Admin L2'])
        assert.deepEqual(panel.vmNetworkEntries().map((nic: any) => nic.macAddress), entries.slice(0, 3).map(nic => nic.macAddress))
    })
    it('uses embedded NIC network fields without treating the NIC name as a network name', () => {
        const panel = new context.Panel({ node: node('i-2-28-VM', { nics: [
            { name: 'eth0', networkname: 'Guest', ipaddress: '10.0.0.2', macaddress: 'aa:bb:cc:dd:ee:ff' },
            { name: 'eth1', ipaddress: '10.1.0.2' }
        ] }) })
        assert.equal(panel.vmNetworkEntries()[0].networkName, 'Guest')
        assert.equal(panel.vmNetworkEntries()[1].networkName, '')
    })
    it('consumes only the verified publicIps field for the same VM and retains all distinct bindings', () => {
        const panel = new context.Panel({ node: node('i-2-28-VM', { PublicIP: '192.0.2.200' }), vmDetailMap: {
            'vm-uuid': { uuid: 'vm-uuid', instanceName: 'i-2-28-VM', publicIps: ['192.0.2.1', '192.0.2.2', '192.0.2.1'] }
        } })
        assert.deepEqual(Array.from(panel.publicIps()), ['192.0.2.1', '192.0.2.2'])
        panel.props.vmDetailMap['vm-uuid'].uuid = 'other-vm'
        assert.deepEqual(Array.from(panel.publicIps()), [])
    })
})
