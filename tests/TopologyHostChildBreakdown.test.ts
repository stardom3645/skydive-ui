import { strict as assert } from 'assert'
import { topologyHostChildBreakdown } from '../src/TopologyHostChildBreakdown'

const resource = (type: string, name = type, weight?: number): any => ({ data: { Type: type, Name: name }, children: [], getWeight: () => weight })

describe('Host badge child resource breakdown', () => {
    it('partitions the badge children by real type and VM role without adding descendants or changing the graph', () => {
        const children = [resource('device'), resource('bridge'), resource('vlan'), resource('bond'), resource('tuntap'),
            resource('libvirt', 's-173-VM'), resource('libvirt', 'v-174-VM'), resource('libvirt', 'ccvm'),
            resource('libvirt', 'r-161-VM'), resource('libvirt', 'i-2-129-VM'), resource('unknown')]
        children[9].children.push(resource('tuntap', 'guest-nic'))
        const before = JSON.stringify(children)
        const breakdown = topologyHostChildBreakdown(children)
        assert.equal(breakdown.reduce((sum, row) => sum + row.count, 0), children.length)
        assert.equal(breakdown.find(row => row.key === 'systemVM')!.count, 3)
        assert.equal(breakdown.find(row => row.key === 'router')!.count, 1)
        assert.equal(breakdown.find(row => row.key === 'userVM')!.count, 1)
        assert.equal(breakdown.find(row => row.key === 'virtualNIC')!.count, 1)
        assert.equal(breakdown.find(row => row.key === 'other')!.count, 1)
        assert.equal(JSON.stringify(children), before)
    })
    it('uses existing layer roles and preserves empty/missing-type cases', () => {
        assert.deepEqual(topologyHostChildBreakdown([]), [])
        assert.deepEqual(topologyHostChildBreakdown([resource('libvirt', 'operator-name', 7060)]), [{ key: 'systemVM', label: '시스템 가상머신', count: 1 }])
        assert.deepEqual(topologyHostChildBreakdown([{ data: {}, children: [] } as any]), [{ key: 'other', label: '기타 자원', count: 1 }])
    })
})
