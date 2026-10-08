import { strict as assert } from 'assert'
import { topologyLinkTraffic } from '../src/TopologyLinkTraffic'
import { linkDetailMetadataRows } from '../src/DataPanels/LinkDetailData'

const link = (metric?: any, targetMetric?: any): any => ({
    id: 'connection', data: { RelationType: 'layer2' },
    source: { id: 'nic-a', data: { Type: 'device', LastUpdateMetric: metric } },
    target: { id: 'nic-b', data: { Type: 'switchport', LastUpdateMetric: targetMetric } }
})
const metric = { Start: 1000, Last: 2000, RxBytes: 100000, TxBytes: 25000 }

describe('Connection detail data', () => {
    it('uses the same interface interval for total and received/transmitted rates', () => {
        const connection = link(metric), traffic = topologyLinkTraffic(connection)!
        assert.equal(traffic.node, connection.source)
        assert.equal(traffic.seconds, 1)
        assert.equal(traffic.received, 800000)
        assert.equal(traffic.transmitted, 200000)
        assert.equal(traffic.total, 1000000)
    })
    it('keeps measured zero and accepts numeric collector values', () => {
        const traffic = topologyLinkTraffic(link({ Start: '1000', Last: '3000', RxBytes: '0', TxBytes: '500' }))!
        assert.equal(traffic.received, 0)
        assert.equal(traffic.transmitted, 2000)
        assert.equal(traffic.total, 2000)
    })
    it('does not invent total or zero when one counter is missing or invalid', () => {
        for (const invalid of [undefined, null, '', false, -1, NaN, Infinity]) {
            const traffic = topologyLinkTraffic(link({ ...metric, RxBytes: invalid }))!
            assert.equal(traffic.received, undefined)
            assert.equal(traffic.transmitted, 200000)
            assert.equal(traffic.total, undefined)
        }
        assert.equal(topologyLinkTraffic(link()), undefined)
    })
    it('falls back to the other endpoint for absent or invalid intervals', () => {
        for (const invalid of [undefined, { ...metric, Last: 1000 }, { ...metric, Last: 0 }, { ...metric, Start: null }]) {
            const connection = link(invalid, metric)
            assert.equal(topologyLinkTraffic(connection)!.node, connection.target)
        }
    })
    it('recognizes OVS and tap interfaces without treating host metrics as link traffic', () => {
        const connection = link()
        connection.source.data = { Type: 'internal', BusInfo: 'tap', Ovs: { LastUpdateMetric: metric } }
        assert.equal(topologyLinkTraffic(connection)!.total, 1000000)
        connection.source.data = { Type: 'host', LastUpdateMetric: metric }
        assert.equal(topologyLinkTraffic(connection), undefined)
    })
    it('retains nested NSM metadata and zero/false while omitting drawing hints', () => {
        const connection = link()
        connection.data = { RelationType: 'layer2', Directed: false, ManualPortMapping: true,
            __sourceNodeID: 'proxy', NSM: { Source: { Name: 'endpoint', Port: 0, Enabled: false,
                __targetNodeID: 'proxy' }, Via: ['a', 'b'] } }
        const before = JSON.stringify(connection.data), rows = linkDetailMetadataRows(connection)
        assert.deepEqual(rows.map(row => row.key), ['NSM.Source.Name', 'NSM.Source.Port', 'NSM.Source.Enabled', 'NSM.Via'])
        assert.equal(rows[1].value, '0')
        assert.equal(rows[2].value, 'false')
        assert.deepEqual(JSON.parse(rows[3].copyText), ['a', 'b'])
        assert.equal(JSON.stringify(connection.data), before)
    })
})
