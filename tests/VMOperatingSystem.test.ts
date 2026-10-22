import { strict as assert } from 'assert'
import { vmOperatingSystem, vmShowsOperatingSystem } from '../src/VMOperatingSystem'
import { vmPublicIPAddresses } from '../src/VMPublicIPs'
import { topologyNodePresentation } from '../src/TopologyNodePresentation'

describe('VM operating system presentation', () => {
    it('omits CCVM OS presentation without changing collected OS data or other VM icons', () => {
        for (const Name of ['ccvm', 'CCVM', 'ccvm2']) {
            const data = { Name, Type: 'libvirt', Manager: 'libvirt', OS: 'Rocky Linux 9' }
            const original = JSON.stringify(data)
            const node: any = { id: Name, data, children: [], state: {} }
            assert.equal(vmShowsOperatingSystem(data), false)
            assert.equal(topologyNodePresentation(node, { name: Name }).operatingSystem, undefined)
            assert.equal(JSON.stringify(data), original)
        }
        for (const Name of ['scvm', 'i-2-28-VM', 'ccvm-test']) assert.equal(vmShowsOperatingSystem({ Name }), true)
    })
    it('maps real Windows/Linux/macOS names to bundled icons while keeping the full OS name for the tooltip', () => {
        for (const name of ['Rocky Linux 10', 'Ubuntu 24.04 LTS', 'Debian GNU/Linux 12', 'CentOS 7', 'Red Hat Enterprise Linux', 'AlmaLinux 9']) {
            assert.deepEqual(vmOperatingSystem({ guestOS: name }), { name, family: 'linux' })
        }
        assert.deepEqual(vmOperatingSystem({ GuestOS: 'Windows Server 2022' }), { name: 'Windows Server 2022', family: 'windows' })
        assert.deepEqual(vmOperatingSystem({ OS: 'macOS 14' }), { name: 'macOS 14', family: 'apple' })
        for (const data of [{}, { GuestOS: 'N/A' }, { OS: 'unknown' }, { GuestOS: {} }]) {
            assert.deepEqual(vmOperatingSystem(data), { name: '운영체제 정보 없음', family: 'unknown' })
        }
        for (const name of ['Other (64-bit)', 'Other', 'FreeBSD 14', 'Oracle Solaris 11']) {
            assert.deepEqual(vmOperatingSystem({ guestOS: name }), { name, family: 'other' })
        }
        assert.deepEqual(vmOperatingSystem({ ostypename: 'Debian GNU/Linux 13 (64-bit)' }),
            { name: 'Debian GNU/Linux 13 (64-bit)', family: 'linux' })
        assert.deepEqual(vmOperatingSystem({ GuestOS: 'N/A', osTypeName: 'Ubuntu 24.04 LTS' }),
            { name: 'Ubuntu 24.04 LTS', family: 'linux' })
    })
    it('uses Mold OS data without changing VM dimensions, resources, or other object types', () => {
        const node: any = { id: 'vm', data: { Name: 'i-2-28-VM', Type: 'libvirt', Manager: 'libvirt' }, children: [], state: {} }
        const before = topologyNodePresentation(node, { name: 'VM' })
        const after = topologyNodePresentation(node, { name: 'VM', resourceData: { inventory: { guestOS: 'Rocky Linux 10' } } })
        assert.equal(after.operatingSystem!.family, 'linux')
        assert.deepEqual([after.width, after.height, after.headerHeight, after.metrics], [before.width, before.height, before.headerHeight, before.metrics])
        node.data.Type = 'host'; node.data.OS = 'Linux'
        assert.equal(topologyNodePresentation(node, { name: 'host' }).operatingSystem, undefined)
        node.data.Type = 'libvirt'; node.data.Manager = 'k8s'
        assert.equal(topologyNodePresentation(node, { name: 'node' }).operatingSystem, undefined)
    })
})

describe('VM public IP binding isolation', () => {
    it('requires a matching VM UUID or exact internal instance name and never infers a public IP from NICs or NAT gateways', () => {
        const detail = { uuid: 'vm-1', instanceName: 'i-2-28-VM', publicIps: ['192.0.2.1', '192.0.2.2'] }
        assert.equal(vmPublicIPAddresses({ Name: 'i-2-28-VM' }, detail).length, 2)
        assert.equal(vmPublicIPAddresses({ Name: 'same-display-name' }, detail).length, 0)
        assert.equal(vmPublicIPAddresses({ UUID: 'vm-2', Name: 'i-2-28-VM' }, detail).length, 0)
        assert.equal(vmPublicIPAddresses({ UUID: 'vm-1' }, { ...detail, publicIps: undefined, PublicIP: '192.0.2.3' }).length, 0)
        assert.equal(vmPublicIPAddresses({ UUID: 'vm-1' }, undefined).length, 0)
    })
})
