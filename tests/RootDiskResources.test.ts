import { strict as assert } from 'assert'
import { rootDiskResources, formatRootDiskBytes } from '../src/DataPanels/common/RootDiskResources'
import { topologyResourceMetrics } from '../src/TopologyResourceMetrics'
import { topologyCardDimensions, topologyNodePresentation } from '../src/TopologyNodePresentation'

const gib = 1024 ** 3
const wall = (total: any, used: any, available?: any) => ({ series: [
    { key: 'rootDiskTotal', lastValue: total }, { key: 'rootDiskUsed', lastValue: used },
    { key: 'rootDiskAvailable', lastValue: available }
] })
const node = (type: string): any => ({ id: type, data: { Name: type, Type: type, Manager: 'libvirt',
    UserVMCount: 25, SystemVMCount: 3, VirtualRouterCount: 6 }, state: {}, children: [] })

describe('Wall root filesystem resources', () => {
    it('keeps every VM size and metric slot consistent as disk data arrives or disappears', () => {
        const resource = node('libvirt')
        delete resource.data.UserVMCount
        resource.data.CpuNumber = 4
        resource.data.Memory = 8192
        const name = 'operator-facing-virtual-machine-name'
        const missing = topologyNodePresentation(resource, { name })
        const snapshot = { wall: wall(20 * gib, 8 * gib) }
        const collected = topologyNodePresentation(resource, { name, resourceData: snapshot })
        for (const [model, data] of [[missing, undefined], [collected, snapshot]] as const) {
            const bounds = topologyCardDimensions(resource)
            assert.equal(bounds.height, model.height)
            assert.equal(bounds.width, model.width)
        }
        assert.equal(missing.height, collected.height)
        assert.deepEqual(missing.metrics.map(metric => metric.key), collected.metrics.map(metric => metric.key))
        assert.equal(missing.metrics.find(metric => metric.key === 'root-disk')!.value, '미수집')
        assert.ok(collected.metrics.some(metric => metric.key === 'root-disk'))
        assert.equal(topologyNodePresentation(resource, { name, resourceData: { wall: wall(null, null) } }).height, missing.height)
        assert.equal(topologyNodePresentation(resource, { name: 'ccvm' }).height, collected.height)
    })
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
    it('places root capacity below CPU/memory and keeps host connection counts on its badge', () => {
        for (const type of ['host', 'libvirt']) {
            const resource = node(type)
            resource.children = [node('libvirt')]
            const model = topologyNodePresentation(resource, { name: type, resourceData: { wall: wall(20 * gib, 8 * gib) } })
            const disk = model.metrics[2]
            assert.equal(disk.key, 'root-disk')
            assert.equal(disk.value, '8GiB / 20GiB')
            assert.equal(disk.percent, 40)
            assert.ok(disk.description!.includes('가용 12GiB'))
            if (type === 'host') {
                assert.ok(model.metrics.some(metric => metric.key === 'vms'))
                assert.deepEqual(model.metrics.map(metric => metric.key), ['cpu', 'memory', 'root-disk', 'vms'])
                assert.equal(model.badges[0].count, 1)
                assert.equal(resource.data.SystemVMCount, 3)
                assert.equal(resource.data.VirtualRouterCount, 6)
            } else {
                assert.ok(!model.metrics.some(metric => ['vms', 'children'].includes(metric.key)))
                assert.equal(model.badges[0].count, 1)
            }
        }
        assert.equal(topologyResourceMetrics(node('node'), { wall: wall(20 * gib, 8 * gib) }).length, 2)
        assert.equal(topologyResourceMetrics(node('libvirt'), { wall: wall(undefined, undefined) }).length, 2)
    })
})
