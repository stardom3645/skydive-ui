import { strict as assert } from 'assert'
import { moldNetworkChoices, moldNetworkChoiceName, moldNetworkCreationTime, moldNetworkChoiceCatalog, moldNetworkChoiceMetadata, moldNetworkCommonZone } from '../src/MoldNetworkChoices'
import type { MoldNICNetwork } from '../src/MoldTopologyNetworks'

const network = (networkId: string, networkCreatedAt?: string, extra: Partial<MoldNICNetwork> = {}): MoldNICNetwork => ({
    networkId, networkCreatedAt, networkName: networkId, macAddress: '', ipAddress: '', ...extra
})

describe('Mold network dropdown choices', () => {
    it('summarizes a shared Zone once only when every actual Zone ID and name agrees', () => {
        const a = network('a', undefined, { zoneId: 'zone-a', zoneName: 'Zone' }), b = network('b', undefined, { zoneId: 'ZONE-A', zoneName: 'Zone' })
        assert.equal(moldNetworkCommonZone([a, b]), 'Zone')
        assert.equal(moldNetworkCommonZone([a, { ...b, zoneId: 'zone-b' }]), undefined)
        assert.equal(moldNetworkCommonZone([a, { ...b, zoneId: undefined }]), undefined)
        assert.equal(moldNetworkCommonZone([]), undefined)
    })
    it('fills absent display metadata by exact network ID, preserving authoritative names, membership and source data', () => {
        const catalog = [network('A', undefined, { networkName: ' ', zoneName: 'Zone' }), network('B', undefined, { networkName: 'DB 이름', cidr: '10.1.0.0/24' })]
        const linked = [network('a', undefined, { networkName: '수집된 이름', trafficType: 'Management', zoneName: '다른 Zone' }),
            network('b', undefined, { networkName: '이전 이름', cidr: '10.2.0.0/24' }), network('outside')]
        const before = JSON.stringify([catalog, linked])
        const result = moldNetworkChoiceCatalog(catalog, linked)
        assert.deepEqual(result.map(n => n.networkId), ['A', 'B'])
        assert.equal(result[0].networkName, '수집된 이름')
        assert.equal(result[0].trafficType, 'Management')
        assert.equal(result[0].zoneName, 'Zone')
        assert.equal(result[1].networkName, 'DB 이름')
        assert.equal(result[1].cidr, '10.1.0.0/24')
        assert.equal(JSON.stringify([catalog, linked]), before)
        assert.equal(moldNetworkChoiceCatalog([network('other', undefined, { networkName: '' })], linked)[0].networkName, '')
    })
    it('shows only collected metadata, separating Zone from the network type and omitting placeholder VLANs', () => {
        assert.deepEqual(moldNetworkChoiceMetadata(network('a', undefined, { networkType: 'L2', broadcastUri: 'vlan://201', zoneName: 'Zone' })), ['L2', 'VLAN 201'])
        assert.deepEqual(moldNetworkChoiceMetadata(network('a', undefined, { trafficType: 'Public', broadcastUri: 'vlan://untagged' })), ['Public'])
        assert.deepEqual(moldNetworkChoiceMetadata(network('a', undefined, { networkType: 'Isolated', cidr: '10.60.6.0/24' })), ['Isolated', '10.60.6.0/24'])
        assert.deepEqual(moldNetworkChoiceMetadata(network('a')), [])
    })
    it('sorts actual dates both ways, retaining undated slots and equal-date order without mutation', () => {
        const input = [network('new', '2026-10-12 12:00:00'), network('unknown'), network('old', '2026-01-01T00:00:00Z'),
            network('same-day', '2026-01-01 00:00:00'), network('invalid', '0000-00-00 00:00:00')]
        const before = JSON.stringify(input)
        assert.deepEqual(moldNetworkChoices(input).map(n => n.networkId), ['old', 'unknown', 'same-day', 'new', 'invalid'])
        assert.deepEqual(moldNetworkChoices(input, '', 'all', 'newest').map(n => n.networkId), ['new', 'unknown', 'old', 'same-day', 'invalid'])
        assert.equal(JSON.stringify(input), before)
        assert.deepEqual(moldNetworkChoices([network('z'), network('a')], '', 'all', 'newest').map(n => n.networkId), ['z', 'a'])
    })
    it('combines type with existing name, CIDR, Zone, UUID and VLAN search, preserving identities', () => {
        const input = [network('net-a', undefined, { networkName: '동일 이름', networkType: ' Isolated ', cidr: '10.1.1.0/24', zoneName: 'Zone A' }),
            network('net-b', undefined, { networkName: '동일 이름', networkType: 'L2', zoneName: 'Zone B', vlan: '153' }),
            network('net-c', undefined, { networkType: 'shared', zoneName: 'Zone A' }), network('unnamed')]
        assert.deepEqual(moldNetworkChoices(input, '동일 이름').map(n => n.networkId), ['net-a', 'net-b'])
        assert.deepEqual(moldNetworkChoices(input, 'Zone A', 'Isolated').map(n => n.networkId), ['net-a'])
        assert.deepEqual(moldNetworkChoices(input, '10.1.1', 'Isolated').map(n => n.networkId), ['net-a'])
        assert.deepEqual(moldNetworkChoices(input, '153', 'L2').map(n => n.networkId), ['net-b'])
        assert.deepEqual(moldNetworkChoices(input, 'net-c', 'Shared').map(n => n.networkId), ['net-c'])
        assert.equal(moldNetworkChoices(input, 'Zone B', 'Shared').length, 0)
    })
    it('prefers actual names and never substitutes a Zone name for a missing network name', () => {
        assert.equal(moldNetworkChoiceName(network('uuid', undefined, { networkName: ' 서비스망 ', zoneName: 'Zone A' })), '서비스망')
        assert.equal(moldNetworkChoiceName(network('uuid', undefined, { networkName: ' ', zoneName: 'Zone A' })), 'uuid')
        const actualUUIDName = '8689dcfa-5d81-40d3-8db3-103be4a01d71'
        assert.equal(moldNetworkChoiceName(network('different-id', undefined, { networkName: actualUUIDName })), actualUUIDName)
    })
    it('rejects invalid dates and respects explicit timezones and valid leap dates', () => {
        for (const date of ['', 'N/A', '2026-02-30 00:00:00', '2026-13-01 00:00:00', '2026-10-01 24:00:00']) {
            assert.equal(moldNetworkCreationTime(network('bad', date)), undefined)
        }
        assert.equal(moldNetworkCreationTime(network('utc', '2026-10-01T00:00:00Z')),
            moldNetworkCreationTime(network('kst', '2026-10-01T09:00:00+09:00')))
        assert.ok(moldNetworkCreationTime(network('leap', '2024-02-29 00:00:00')))
    })
})
