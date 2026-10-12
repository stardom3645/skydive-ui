import { strict as assert } from 'assert'
import { moldNetworkIndex, matchMoldNIC, moldVMNetworks, moldVMNetworkSummary, moldNetworkVLAN } from '../src/MoldTopologyNetworks'
import { topologyNodePresentation } from '../src/TopologyNodePresentation'

const vm = (uuid: string, name = 'i-1-VM'): any => ({ id: uuid, data: { Type: 'libvirt', Name: name, UUID: uuid }, children: [], state: {} })
const nic = (owner: any, address = '52:54:00:00:00:01'): any => ({ id: owner.id + '-nic', parent: owner,
    data: { Type: 'tun', Libvirt: { MAC: address }, IPV4: ['10.0.0.2'], VLAN: '153' }, children: [], state: {} })
const row = (uuid: string, networkId = 'net-a', address = '52:54:00:00:00:01') => ({ vmUuid: uuid, networkId,
    nicId: `${uuid}-${networkId}`, networkName: '서비스망', macAddress: address, ipAddress: '10.0.0.2', vlan: '153', zoneName: 'Zone A', networkType: 'Isolated' })

describe('Mold topology network identity', () => {
    it('matches UUID and normalized guest MAC, not a host-side MAC', () => {
        const owner = vm('vm-a'), node = nic(owner, '5254.0000.0001')
        node.data.MAC = 'fe:ff:ff:ff:ff:ff'
        const index = moldNetworkIndex({ 'i-1-VM': [row('vm-a')] })
        assert.equal(matchMoldNIC(node, index)?.networkId, 'net-a')
        assert.equal(moldVMNetworkSummary(owner, index), '서비스망')
    })
    it('does not merge equal IPs, VLANs, network names or MACs from another VM', () => {
        const index = moldNetworkIndex({ a: [row('vm-a')], b: [row('vm-b', 'net-b')] })
        assert.equal(index.networks.length, 2)
        assert.equal(matchMoldNIC(nic(vm('vm-b')), index)?.networkId, 'net-b')
        assert.equal(matchMoldNIC(nic(vm('unknown-vm')), index), undefined)
        assert.equal(matchMoldNIC(nic(vm('vm-a'), '52:54:00:00:00:99'), index), undefined)
    })
    it('rejects conflicting NIC identities within a VM rather than picking the first row', () => {
        assert.equal(matchMoldNIC(nic(vm('vm-a')), moldNetworkIndex({ a: [row('vm-a'), row('vm-a', 'net-b')] })), undefined)
    })
    it('uses collector domain names only to resolve an exact cached VM UUID', () => {
        const index = moldNetworkIndex({ 'i-1-VM': [row('vm-a')] }, { 'vm-a': { uuid: 'vm-a', instanceName: 'i-1-VM' } })
        const node = nic(vm('vm-a'))
        delete node.parent
        node.data.Libvirt.Domain = 'i-1-VM'
        assert.equal(matchMoldNIC(node, index)?.vmUuid, 'vm-a')
        assert.equal(matchMoldNIC(nic(vm('wrong-uuid')), index), undefined)
        const legacy = { ...row('vm-a'), vmUuid: undefined }
        assert.equal(matchMoldNIC(node, moldNetworkIndex({ 'i-1-VM': [legacy] }, { a: { uuid: 'vm-a', instanceName: 'i-1-VM' } }))?.vmUuid, 'vm-a')
        assert.equal(matchMoldNIC(node, moldNetworkIndex({ 'i-1-VM': [legacy] })), undefined)
    })
    it('summarizes distinct network IDs and keeps the graph and missing-data UI unchanged', () => {
        const owner = vm('vm-a'), before = JSON.stringify(owner)
        const index = moldNetworkIndex({ a: [row('vm-a'), row('vm-a', 'net-b')] })
        assert.equal(moldVMNetworkSummary(owner, index), '네트워크 2개')
        const model = topologyNodePresentation(owner, { name: owner.data.Name, networkSummary: moldVMNetworkSummary(owner, index) })
        assert.equal(model.networkSummary, '네트워크 2개')
        assert.equal(moldVMNetworkSummary(vm('missing'), index), undefined)
        assert.equal(JSON.stringify(owner), before)
        assert.equal(moldVMNetworks(owner, index).length, 2)
        assert.equal(moldNetworkVLAN({ ...row('vm-a'), vlan: '', broadcastUri: 'vlan://153' }), '153')
    })
})
