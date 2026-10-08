import { strict as assert } from 'assert'
import { rootDiskResources, formatRootDiskBytes } from '../src/DataPanels/common/RootDiskResources'
import { topologyResourceMetrics } from '../src/TopologyResourceMetrics'
import { topologyNodePresentation } from '../src/TopologyNodePresentation'

const gib = 1024 ** 3
const wall = (total: any, used: any, available?: any) => ({ series: [
    { key: 'rootDiskTotal', lastValue: total }, { key: 'rootDiskUsed', lastValue: used },
    { key: 'rootDiskAvailable', lastValue: available }
] })
const node = (type: string): any => ({ id: type, data: { Name: type, Type: type, Manager: 'libvirt',
    UserVMCount: 25, SystemVMCount: 3, VirtualRouterCount: 6 }, state: {}, children: [] })

describe('Wall root filesystem resources', () => {
    it('preserves measured zero and distinguishes missing capacity/usage', () => {
        assert.deepEqual(rootDiskResources(wall(20 * gib, 0)), { total: 20 * gib, used: 0, available: 20 * gib, percent: 0 })
        assert.equal(rootDiskResources(wall(null, null)), undefined)
        assert.equal(rootDiskResources(wall(0, 0)), undefined)
        assert.deepEqual(rootDiskResources(wall(20 * gib, null)), { total: 20 * gib, used: undefined, available: undefined, percent: undefined })
        assert.equal(rootDiskResources(wall(20 * gib, 21 * gib))!.percent, undefined)
        assert.equal(rootDiskResources(wall(NaN, 0)), undefined)
    })
    it('uses host available bytes and derives the VM remainder in byte units', () => {
        assert.equal(rootDiskResources(wall(100 * gib, undefined, 60 * gib))!.percent, 40)
        assert.equal(rootDiskResources(wall(20 * gib, 8 * gib))!.available, 12 * gib)
        assert.equal(formatRootDiskBytes(8 * gib), '8GiB')
        assert.equal(formatRootDiskBytes(undefined), '미수집')
    })
    it('exposes root capacity on host and VM cards without dropping existing counts or changing Kubernetes', () => {
        for (const type of ['host', 'libvirt']) {
            const model = topologyNodePresentation(node(type), { name: type, resourceData: { wall: wall(20 * gib, 8 * gib) } })
            const disk = model.metrics[model.metrics.length - 1]
            assert.equal(disk.key, 'root-disk')
            assert.equal(disk.value, '8GiB / 20GiB')
            assert.equal(disk.percent, 40)
            assert.ok(disk.description!.includes('가용 12GiB'))
            assert.ok(model.metrics.some(metric => metric.key === 'children'))
            assert.ok(model.metrics.some(metric => metric.key === 'vms'))
            if (type === 'host') assert.ok(model.metrics.some(metric => metric.key === 'routers'))
        }
        assert.equal(topologyResourceMetrics(node('node'), { wall: wall(20 * gib, 8 * gib) }).length, 2)
        assert.equal(topologyResourceMetrics(node('libvirt'), { wall: wall(undefined, undefined) }).length, 2)
    })
})
