import { strict as assert } from 'assert'
import { topologyServiceVMRole } from '../src/TopologyServiceVM'
import { topologyNodePresentation, topologyLayerCardLayouts } from '../src/TopologyNodePresentation'
import { TopologyResourceData, topologyResourcePlan } from '../src/TopologyResourceData'

const vm = (name: string, extra: any = {}): any => ({ id: name, data: { Type: 'libvirt', Name: name, State: 'UP', ...extra },
    state: { expanded: false }, children: [], parent: null, getWeight: () => name.startsWith('r-') ? 7070 : 7060 })
const present = (node: any, service?: any, inventory: any = {}) => topologyNodePresentation(node, { name: node.data.Name,
    resourceData: { service, inventory }, networkSummary: 'tenant-network' })

describe('System VM service cards', () => {
    it('shows operation and role only on Mold system VMs, leaving router and other cards intact', () => {
        for (const [domain, role] of [['s-173-VM', '보조 스토리지 VM'], ['v-174-VM', '콘솔 프록시 VM']]) {
            const model = present(vm(domain))
            assert.equal(model.systemVMInformation!.role, role)
            assert.equal(model.systemVMInformation!.state.value, '실행 중')
            assert.equal(model.systemVMInformation!.agent.value, '미수집')
            assert.equal(model.systemVMInformation!.sessions, undefined)
            assert.deepEqual(model.metrics, [])
            assert.equal(model.networkSummary, 'tenant-network')
        }
        const router = present(vm('r-192-VM'), undefined, { privateIp: '169.254.191.122', hostName: 'owner' })
        assert.equal(router.systemVMInformation, undefined)
        assert.deepEqual(router.metrics.map(m => m.key), ['service-role', 'service-state', 'service-ip', 'service-host'])
        assert.equal(router.metrics[2].label, '제어 IP')
        for (const name of ['ccvm', 'scvm', 'scvm2', 'i-42-VM', 's-custom', 'r-192-VM-backup']) {
            const model = present(vm(name))
            assert.equal(model.serviceVM, false)
            assert.ok(model.metrics.some(metric => metric.key === 'root-disk'))
        }
        assert.equal(topologyServiceVMRole(vm('s-173-VM', { Manager: 'k8s' })), undefined)
        assert.equal(topologyServiceVMRole(vm('s-173-VM', { IsTopologyGroup: true })), undefined)
    })
    it('separates agent connection from execution, health, resource usage and IP/host information', () => {
        const node = vm('s-173-VM')
        const missing = present(node)
        const model = topologyNodePresentation(node, { name: node.data.Name, resourceData: {
            inventory: { CpuNumber: 1, Memory: 512, privateIp: '10.10.31.8', hostName: 'owner' },
            service: { systemVmType: 'secondarystoragevm', agentState: 'Disconnected' },
            wall: { series: [{ key: 'cpu', lastValue: 0 }, { key: 'memory', lastValue: 99 }, { key: 'networkRx', lastValue: 10000 }] }
        } })
        assert.equal(model.systemVMInformation!.agent.value, '연결 끊김')
        assert.equal(model.systemVMInformation!.state.value, '실행 중')
        assert.equal(model.status.tone, missing.status.tone)
        assert.deepEqual(model.metrics, [])
        assert.ok(!JSON.stringify(model.systemVMInformation).includes('10.10.31.8'))
        assert.ok(!JSON.stringify(model.systemVMInformation).includes('owner'))
        assert.ok(!('resources' in model.systemVMInformation!))
        assert.ok(!('network' in model.systemVMInformation!))
        node.data.State = 'DOWN'
        assert.equal(present(node).systemVMInformation!.state.value, '중지')
    })
    it('shows real console sessions including zero, honors Mold role, and omits unavailable or invalid counts', () => {
        for (const count of [0, 12, '2']) {
            const model = present(vm('v-174-VM'), { systemVmType: 'consoleproxy', agentState: 'Up', activeViewerSessions: count })
            assert.equal(model.systemVMInformation!.agent.value, '연결됨')
            assert.equal(model.systemVMInformation!.sessions, Number(count))
        }
        for (const count of [undefined, null, '', ' ', true, -1, 1.5, NaN, Infinity, 'bad', Number.MAX_SAFE_INTEGER + 1]) {
            assert.equal(present(vm('v-174-VM'), { activeViewerSessions: count }).systemVMInformation!.sessions, undefined)
        }
        const storage = present(vm('v-174-VM'), { systemVmType: 'secondarystoragevm', activeViewerSessions: 12 })
        assert.equal(storage.systemVMInformation!.role, '보조 스토리지 VM')
        assert.equal(storage.systemVMInformation!.sessions, undefined)
        assert.equal(present(vm('v-174-VM'), { agentState: 'Unexpected' }).systemVMInformation!.agent.value, '알 수 없음')
    })
    it('requests exact Mold service identity while keeping Wall for local VMs, routers and user VMs', () => {
        const node = vm('s-173-VM')
        const plan = topologyResourcePlan([node], 'http://localhost:8082', [], undefined,
            { 's-173-VM': { uuid: 'mold-uuid', instanceName: 's-173-VM' } })
        const ref = plan.refs.get(node.id)!
        const url = new URL(ref.service!)
        assert.equal(url.pathname, '/api/mold/system-vms/detail')
        assert.equal(url.searchParams.get('id'), 'mold-uuid')
        assert.equal(url.searchParams.get('name'), 's-173-VM')
        assert.equal(ref.wall, undefined, 'unused card trend requests are removed; detail panel uses its independent Wall query')
        for (const name of ['ccvm', 'scvm', 'r-192-VM', 'i-42-VM']) {
            const ref = topologyResourcePlan([vm(name)], 'http://localhost:8082').refs.get(name)!
            assert.equal(ref.service, undefined)
            assert.ok(ref.wall?.includes('/api/wall/vms/trend'))
        }
    })
    it('does not change layer geometry as service details arrive or VMs expand', () => {
        const nodes = [vm('ccvm'), vm('s-173-VM'), vm('v-174-VM')]
        const layouts = topologyLayerCardLayouts(nodes.map(node => ({ node })))
        const before = nodes.map(node => topologyNodePresentation(node, { name: node.data.Name, cardLayout: layouts.get(node.id) }))
        const after = nodes.map(node => { node.state.expanded = true; return topologyNodePresentation(node,
            { name: node.data.Name, cardLayout: layouts.get(node.id), resourceData: { service: { agentState: 'Up', activeViewerSessions: 10 } } }) })
        assert.equal(new Set(before.map(model => model.height)).size, 1)
        assert.deepEqual(after.map(model => [model.width, model.height]), before.map(model => [model.width, model.height]))
    })
    it('caches service metadata including zero sessions and clears it after an unmatched refresh', async () => {
        let now = 0
        let body: any = { moldMatched: true, systemVM: { agentState: 'Up', activeViewerSessions: 0 } }
        const cache = new TopologyResourceData(() => {}, (async () => ({ ok: true, json: async () => body })) as any, () => now)
        const plan = topologyResourcePlan([vm('v-174-VM')], 'http://localhost:8082')
        const key = plan.refs.get('v-174-VM')!.service!
        cache.sync(plan.requests)
        await new Promise(resolve => setTimeout(resolve, 0))
        assert.equal(cache.get(key).activeViewerSessions, 0)
        now = 56000
        body = { moldMatched: false }
        cache.sync(plan.requests)
        await new Promise(resolve => setTimeout(resolve, 0))
        assert.equal(cache.get(key), undefined)
        cache.dispose()
    })
})
