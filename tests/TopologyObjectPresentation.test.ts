import { strict as assert } from 'assert'
import { topologyCardDimensions, topologyNodePresentation, topologyNetworkInfoHeight, topologyNodeStatusPresentation, topologyLayerCardLayouts } from '../src/TopologyNodePresentation'
import { kubernetesResourceSelfStatus, kubernetesTopologyDirectChildSummary } from '../src/KubernetesTopologyBadgeAggregation'
import { topologyCardEdge, topologyHierarchyEdgeIDs } from '../src/TopologyEdgePresentation'

const resource = (id: string, type: string, extra: any = {}): any => ({
    id, children: [], parent: null, state: { expanded: true },
    data: { Name: id, Type: type, Manager: 'k8s', K8s: { Extra: { ObjectMeta: { UID: id }, ...extra } } }
})
const attach = (parent: any, child: any) => { parent.children.push(child); child.parent = parent; return child }
const present = (node: any, options: any = {}) => topologyNodePresentation(node, { name: node.data.Name, ...options })

describe('Uniform topology layer card slots', () => {
    const member = (id: string, type: string, weight: number, manager = 'fabric') => {
        const node = resource(id, type)
        node.data.Manager = manager
        node.getWeight = () => weight
        return node
    }
    it('aligns router names, one/two-line networks and absent network data without the unused three-line name slot', () => {
        const nodes = ['r-161-VM', 'r-242-VM', 'r-255-VM', 'r-284-VM'].map(id => member(id, 'libvirt', 7070))
        const networks = ['rt1230-gfs2-v13412-r3-net', 'rt1230-v1342-gfs2-r16-net', 'rt1230-v13412-external-etcd-gfs2-r18-net', undefined]
        const entries = nodes.map((node, i) => ({ node, networkSummary: networks[i] }))
        const layouts = topologyLayerCardLayouts(entries)
        const models = entries.map(entry => present(entry.node, { ...entry, cardLayout: layouts.get(entry.node.id) }))
        assert.equal(new Set(models.map(model => model.height)).size, 1)
        assert.equal(new Set(models.map(model => model.headerHeight)).size, 1)
        assert.equal(new Set(models.map(model => model.networkHeight)).size, 1)
        assert.equal(models[0].headerHeight, 96)
        assert.equal(models[0].networkHeight, 116)
        assert.equal(models[0].height, 522)
        models.forEach((model, i) => assert.equal(model.name, nodes[i].data.Name))
        assert.equal(models[3].networkSummary, undefined, 'missing data is never fabricated')
    })
    it('shares the longest real name slot across hosts, NICs, workloads and storage while retaining complete names', () => {
        for (const [type, weight, manager] of [['host', 5020, 'fabric'], ['tun', 7090, 'fabric'],
            ['deployment', 3035, 'k8s'], ['persistentvolumeclaim', 3070, 'k8s']] as Array<[string, number, string]>) {
            const short = member('brief', type, weight, manager), long = member('very-long-operational-resource-name-'.repeat(4), type, weight, manager)
            const layouts = topologyLayerCardLayouts([{ node: short }, { node: long }])
            const models = [short, long].map(node => present(node, { cardLayout: layouts.get(node.id) }))
            assert.equal(models[0].height, models[1].height)
            assert.equal(models[0].headerHeight, models[1].headerHeight)
            assert.equal(models[1].name, long.data.Name)
            assert.ok(models[1].headerHeight! >= 168)
            assert.equal(topologyCardDimensions(short, false, { cardLayout: layouts.get(short.id) }).height, models[0].height)
        }
    })
    it('keeps layer slots independent and stable across expansion, network counts and metric updates', () => {
        const router = member('router', 'libvirt', 7070), vm = member('user-vm-name-'.repeat(5), 'libvirt', 7080)
        const entries = [{ node: router }, { node: vm, networkSummary: 'a-long-network-'.repeat(8), networkCount: 3 }]
        const before = topologyLayerCardLayouts(entries)
        assert.equal(before.get(router.id)!.height, 388)
        assert.equal(before.get(vm.id)!.networkHeight, 80)
        vm.state.expanded = false; vm.data.CPU = 70; router.state.expanded = false
        const after = topologyLayerCardLayouts(entries)
        assert.deepEqual(after, before)
        const group = member('VM group', 'libvirt', 7080)
        group.data.IsTopologyGroup = true; group.children = [vm]
        const dimensions = topologyCardDimensions(group, true, { memberCardLayout: node => after.get(node.id) })
        assert.equal(dimensions.height, after.get(vm.id)!.height)
    })
    it('keeps NICs compact when their graph weight matches the owning VM', () => {
        const vm = member('user-vm-name-'.repeat(5), 'libvirt', 7080)
        const nic = member('10.10.254.173', 'tun', 7080), other = member('10.10.254.174', 'tun', 7080)
        nic.parent = other.parent = vm
        const layouts = topologyLayerCardLayouts([{ node: vm, networkSummary: 'ADMIN-L2-Network' },
            { node: nic, networkSummary: 'ADMIN-L2-Network' }, { node: other }])
        assert.equal(layouts.get(nic.id)!.height, 234)
        assert.deepEqual(layouts.get(nic.id), layouts.get(other.id))
        assert.ok(layouts.get(nic.id)!.height < layouts.get(vm.id)!.height / 2)
        assert.equal(topologyCardDimensions(nic, false, { cardLayout: layouts.get(nic.id) }).width, 480)
    })
})

describe('Topology object presentation', () => {
    it('separates raw Up/Down from incident judgment on NICs and canonical group children', () => {
        const group = resource('NIC 그룹', 'device'); group.data.Manager = 'fabric'; group.data.IsTopologyGroup = true
        const up = attach(group, resource('eno1', 'device')), down = attach(group, resource('eno2', 'device')),
            unknown = attach(group, resource('eno3', 'device'))
        for (const node of [up, down, unknown]) node.data.Manager = 'fabric'
        up.data.OperState = 'UP'; down.data.State = 'DOWN'
        const downCard = present(down), model = present(group, { group: true })
        assert.equal(downCard.status.tone, 'normal')
        assert.equal(downCard.status.label, '이상 없음')
        assert.equal(downCard.linkState, 'Down')
        assert.equal(present(up).linkState, 'Up')
        assert.equal(present(unknown).linkState, undefined)
        assert.deepEqual(model.linkStates, { up: 1, down: 1, unknown: 1 })
        assert.equal(model.children!.normal, 3)
        assert.equal(model.children!.critical, 0)
        group.state.expanded = false
        assert.deepEqual(present(group, { group: true }).linkStates, model.linkStates)
        down.data.Master = 'bridge0'
        assert.equal(present(down).status.tone, 'warning', 'a used Down path retains the existing attention classification')
        assert.equal(present(group, { group: true }).children!.warning, 1)
        assert.deepEqual(present(group, { group: true }).linkStates, model.linkStates)
        const k8s = resource('worker', 'node'); k8s.data.State = 'DOWN'
        assert.equal(present(k8s).linkState, undefined)
        assert.equal(present(k8s).linkStates, undefined)
        down.data.OperState = 'UP'
        assert.equal(present(down).linkState, 'Up', 'operational interface state takes precedence over a generic State')
    })
    it('keeps Infrastructure NIC and bridge group summaries readable beside compact members', () => {
        for (const type of ['tun', 'bridge', 'vlan']) {
            const group = resource(`${type} group`, type), child = attach(group, resource('brief', type))
            group.data.Manager = child.data.Manager = 'fabric'
            group.data.IsTopologyGroup = true
            const normal = present(child), closed = present(group, { group: true })
            assert.equal(normal.width, 340)
            assert.ok(normal.height < 280)
            assert.deepEqual([closed.size, closed.width, closed.height], ['medium', 440, 416])
            group.state.expanded = true; group.state.groupFullSize = true
            const open = present(group, { group: true })
            assert.deepEqual([open.width, open.height], [closed.width, closed.height])
            assert.deepEqual(open.children, closed.children)
            child.data.Manager = group.data.Manager = 'k8s'
            assert.deepEqual([present(group, { group: true }).width, present(group, { group: true }).height],
                [present(child).width, present(child).height])
        }
    })
    it('widens only canonical VM virtual interfaces, preserving host NIC, group and Kubernetes widths', () => {
        const host = resource('host', 'host'), vm = resource('vm', 'libvirt')
        host.data.Manager = vm.data.Manager = 'fabric'
        const nic = resource('10.10.254.154', 'tuntap')
        nic.data.Manager = 'fabric'; nic.parent = vm
        assert.equal(topologyCardDimensions(nic, false, { networkSummary: 'ADMIN-L2-Network' }).width, 480)
        nic.parent = host
        assert.equal(topologyCardDimensions(nic).width, 340)
        nic.parent = vm; nic.data.Manager = 'k8s'
        assert.equal(topologyCardDimensions(nic).width, 340)
        nic.data.Manager = 'fabric'
        assert.equal(topologyCardDimensions(nic, true).width, topologyCardDimensions(nic).width)
    })
    it('removes the unused second network line and allocates it only for long values', () => {
        assert.equal(topologyNetworkInfoHeight(480, 'ADMIN-L2-Network'), 80)
        assert.equal(topologyNetworkInfoHeight(480, 'long-network-name-'.repeat(8)), 116)
        assert.equal(topologyNetworkInfoHeight(480, 'long-network-name-'.repeat(8), 3), 80)
        assert.equal(topologyNetworkInfoHeight(480, '  '), 0)
        const vm = resource('vm', 'libvirt'); vm.data.Manager = 'fabric'
        const short = present(vm, { networkSummary: 'ADMIN-L2-Network' })
        const long = present(vm, { networkSummary: 'long-network-name-'.repeat(8) })
        assert.equal(long.height - short.height, 36)
        vm.data.Name = 'very-long-vm-name-'.repeat(5)
        assert.equal(present(vm, { networkSummary: 'ADMIN-L2-Network' }).height, short.height)
    })
    it('sizes interface identities using the displayed IP and restores legacy full names', () => {
        const nic = resource('very-long-interface-name-'.repeat(5), 'tun'); nic.data.Manager = 'fabric'
        nic.parent = { data: { Type: 'libvirt' } }
        const ip = present(nic, { name: '10.10.254.154', networkSummary: 'ADMIN-L2-Network' })
        assert.equal(ip.height, 234)
        assert.equal(ip.height, topologyCardDimensions(nic, false, { name: '10.10.254.154', networkSummary: 'ADMIN-L2-Network' }).height)
        const restored = present(nic, { name: `${nic.data.Name.slice(0, 24)}.` })
        assert.equal(restored.name, nic.data.Name)
        assert.equal(restored.height, present(nic).height)
        nic.data.State = 'UP'
        assert.equal(present(nic, { name: '10.10.254.154', networkSummary: 'ADMIN-L2-Network' }).height, ip.height)
    })
    it('uses three card tiers independently from a long name', () => {
        const cluster = resource('cluster', 'cluster'), worker = resource('worker', 'node')
        const pvc = resource('very-long-volume-name-'.repeat(20), 'persistentvolumeclaim')
        assert.equal(present(cluster).size, 'large')
        assert.equal(present(worker).size, 'medium')
        assert.equal(present(pvc).size, 'compact')
        assert.equal(present(pvc).name, pvc.data.Name)
        assert.ok(present(cluster).width > present(worker).width && present(worker).width > present(pvc).width)
    })
    it('does not invent usage percentages, and preserves a measured zero', () => {
        const node = resource('worker', 'node')
        assert.deepEqual(present(node).metrics.map(metric => [metric.value, metric.percent]), [['미수집', undefined], ['미수집', undefined], ['미수집', undefined]])
        Object.assign(node.data, { CPUUsagePercent: 0, MemoryUsagePercent: 48, PodCount: 0 })
        assert.deepEqual(present(node).metrics.map(metric => [metric.value, metric.percent]), [['0%', 0], ['48%', 48], ['0', undefined]])
        node.data.CPUUsagePercent = 800
        assert.equal(present(node).metrics[0].value, '미수집')
    })
    it('preserves full infrastructure names and configured operator labels', () => {
        const host = resource('host', 'host'); host.data.Manager = 'fabric'
        host.data.Name = 'able-infrastructure-host-with-a-long-name'
        assert.equal(present(host, { name: `${host.data.Name.slice(0, 24)}.` }).name, host.data.Name)
        assert.equal(present(host, { name: '운영 호스트' }).name, '운영 호스트')
    })
    it('keeps workload availability distinct from desired replicas and missing readiness', () => {
        const workload = resource('api', 'deployment', { Spec: { Replicas: 3 }, Status: { ReadyReplicas: 2 } })
        assert.equal(present(workload).metrics.find(metric => metric.key === 'replicas')!.value, '2/3')
        delete workload.data.K8s.Extra.Status.ReadyReplicas
        assert.equal(present(workload).metrics.find(metric => metric.key === 'replicas')!.value, '–/3')
    })
    it('uses the existing self status instead of turning absent collection healthy', () => {
        const node = resource('node', 'node'); node.data.CollectionState = 'unavailable'
        assert.equal(kubernetesResourceSelfStatus(node).collection, 'unavailable')
        assert.equal(present(node).status.tone, 'unknown')
        const cluster = resource('stopped', 'cluster'); cluster.data.MoldClusterState = 'Stopped'
        assert.equal(present(cluster).status.tone, 'inactive')
    })
    it('retains direct-child grouping, including an incident one level deeper', () => {
        const namespace = resource('namespace', 'namespace', { Status: { Phase: 'Active' } })
        const good = attach(namespace, resource('api', 'deployment', { Spec: { Replicas: 1 }, Status: { ReadyReplicas: 1, AvailableReplicas: 1 } }))
        attach(good, resource('bad-pod', 'pod', { Status: { Phase: 'Running', ContainerStatuses: [{ State: { Waiting: { Reason: 'CrashLoopBackOff' } } }] } }))
        attach(namespace, resource('web', 'deployment', { Spec: { Replicas: 1 }, Status: { ReadyReplicas: 1, AvailableReplicas: 1 } }))
        const canonical = kubernetesTopologyDirectChildSummary(namespace)
        const model = present(namespace)
        assert.equal(model.group, true)
        assert.equal(model.children!.total, canonical.total)
        assert.equal(model.children!.total, 2)
        assert.equal(model.children!.warning, canonical.attentionRequired.length + canonical.descendantProblematic.length)
        assert.equal(model.children!.normal, canonical.healthy.length)
        assert.deepEqual(topologyCardDimensions(namespace), { size: 'medium', width: model.width, height: model.height })
    })
    it('keeps namespace summaries the same size as resources appear or unfold, without changing virtual groups', () => {
        const namespace = resource('default', 'namespace', { Status: { Phase: 'Active' } })
        const empty = present(namespace)
        assert.equal(empty.namespaceSummary, true)
        assert.equal(empty.group, true)
        assert.equal(empty.expandable, false)
        assert.equal(empty.children!.total, 0)
        assert.equal(empty.status.tone, 'normal')
        const workload = attach(namespace, resource('api', 'deployment', { Spec: { Replicas: 2 }, Status: { AvailableReplicas: 1 } }))
        for (const expanded of [false, true]) {
            namespace.state.expanded = expanded
            namespace.state.groupFullSize = expanded
            const model = present(namespace)
            assert.deepEqual([model.width, model.height], [empty.width, empty.height])
            assert.equal(model.fullyExpanded, false)
            assert.equal(model.expandable, true)
            assert.equal(model.children!.total, 1)
            assert.equal(model.children!.critical, 1)
            assert.strictEqual(namespace.children[0], workload)
        }
        namespace.data.IsTopologyGroup = true
        const virtualGroup = present(namespace, { group: true })
        assert.equal(virtualGroup.namespaceSummary, false)
        assert.equal(virtualGroup.fullyExpanded, true)
        assert.equal(virtualGroup.height, topologyCardDimensions(workload).height)
    })
    it('matches VM group silhouettes to their members through partial and full expansion, preserving counts', () => {
        const group = resource('VM 그룹', 'libvirt'); group.data.Manager = 'libvirt'
        for (let index = 0; index < 50; index++) {
            const child = attach(group, resource(`vm-${index}`, 'libvirt'))
            Object.assign(child.data, { Manager: 'libvirt', State: 'UP' })
        }
        group.state.expanded = false; group.state.groupFullSize = false
        const closed = present(group, { group: true })
        assert.deepEqual([closed.width, closed.height], [present(group.children[0]).width, present(group.children[0]).height])
        group.state.expanded = true
        const partial = present(group, { group: true })
        assert.equal(partial.fullyExpanded, false)
        assert.equal(partial.height, closed.height)
        group.state.groupFullSize = true
        const expanded = present(group, { group: true })
        assert.equal(expanded.fullyExpanded, true)
        assert.equal(expanded.height, closed.height)
        assert.equal(expanded.width, closed.width)
        assert.deepEqual(expanded.children, closed.children)
        assert.equal(expanded.children!.total, 50)
        assert.ok(group.children.every((child: any) => !child.state.selected))
        group.state.expanded = false
        const collapsed = present(group, { group: true })
        assert.equal(collapsed.fullyExpanded, false)
        assert.equal(collapsed.height, closed.height)
        const network = present(group, { group: true, memberNetworkSummary: () => 'ADMIN-L2-Network' })
        assert.equal(network.height, present(group.children[0], { networkSummary: 'ADMIN-L2-Network' }).height)
        assert.equal(network.groupResourceCount, 50)
    })
    it('preserves descendant attention in cluster groups and exposes it on each card', () => {
        const group = resource('clusters', 'cluster'); group.data.IsTopologyGroup = true
        for (let index = 0; index < 6; index++) {
            const cluster = attach(group, resource(`cluster-${index}`, 'cluster'))
            attach(cluster, resource(`unknown-node-${index}`, 'node'))
            attach(cluster, resource(`bad-pvc-${index}`, 'persistentvolumeclaim', { Status: { Phase: 'Lost' } }))
            assert.equal(present(cluster).status.tone, 'normal')
            assert.equal(present(cluster).children!.critical, 1)
            assert.equal(present(cluster).children!.warning, 1)
            assert.equal(present(cluster).status.label, '자체 정상')
            assert.deepEqual(present(cluster).badges.map(badge => [badge.key, badge.count]), [['direct-descendant-problem', 2]])
        }
        assert.deepEqual(present(group, { group: true }).children,
            { total: 6, normal: 0, warning: 6, critical: 0, inactive: 0 })
        assert.deepEqual(present(group, { group: true }).badges.map(badge => [badge.key, badge.count]), [['direct-descendant-problem', 6]])
        group.children[0].data.State = 'Failed'
        group.children[1].data.CollectionState = 'unavailable'
        group.children[2].data.MoldClusterState = 'Stopped'
        assert.deepEqual(present(group, { group: true }).children,
            { total: 6, normal: 0, warning: 4, critical: 1, inactive: 1 })
    })
    it('shows connection counts on infrastructure parents without inventing leaf counts', () => {
        const host = resource('host', 'host'); host.data.Manager = 'fabric'
        const child = attach(host, resource('vm', 'libvirt')); child.data.Manager = 'libvirt'
        assert.equal(present(host).badges[0].count, 1)
        assert.equal(present(host).badgeSummary.states[0].label, '연결 자원')
        assert.deepEqual(present(host).badgeSummary.breakdown, [{ key: 'userVM', label: '사용자 가상머신', count: 1 }])
        assert.deepEqual(present(child).badges, [])
        assert.equal(present(child).badgeSummary.breakdown, undefined)
        const bridge = resource('bridge', 'bridge'); attach(bridge, resource('nic', 'device'))
        assert.equal(present(bridge).badgeSummary.breakdown, undefined)
    })
    it('counts unique collected resources for a collapsed cluster without changing the graph', () => {
        const cluster = resource('cluster', 'cluster'); cluster.state.expanded = false
        attach(cluster, resource('worker', 'node'))
        const namespace = attach(cluster, resource('namespace', 'namespace'))
        attach(namespace, resource('api', 'deployment'))
        attach(namespace, resource('volume-a', 'persistentvolumeclaim'))
        const duplicate = attach(namespace, resource('volume-alias', 'persistentvolumeclaim'))
        duplicate.data.K8s.Extra.ObjectMeta.UID = 'volume-a'
        const metrics = present(cluster).metrics
        assert.deepEqual(metrics.filter(metric => ['namespaces', 'nodes', 'workloads', 'storage'].includes(metric.key)).map(metric => metric.value), ['1', '1', '1', '1'])
        assert.equal(cluster.state.expanded, false)
        assert.equal(namespace.children.length, 3)
    })
    it('separates direct group membership from unique collected descendants, excluding synthetic groups and completed Pods', () => {
        const group = resource('namespace-group', 'namespace')
        group.data.IsTopologyGroup = true
        group.state.expanded = false
        const namespace = attach(group, resource('kube-system', 'namespace', { Status: { Phase: 'Active' } }))
        const deployment = attach(namespace, resource('api', 'deployment'))
        attach(deployment, resource('running-pod', 'pod', { Status: { Phase: 'Running' } }))
        attach(deployment, resource('completed-pod', 'pod', { Status: { Phase: 'Succeeded' } }))
        const synthetic = attach(namespace, resource('storage-group', 'persistentvolumeclaim'))
        synthetic.data.IsTopologyGroup = true
        attach(synthetic, resource('data-pvc', 'persistentvolumeclaim'))
        const duplicate = attach(synthetic, resource('alias-pvc', 'persistentvolumeclaim'))
        duplicate.data.K8s.Extra.ObjectMeta.UID = 'data-pvc'
        const before = namespace.children.slice()
        const model = present(group, { group: true })
        assert.equal(model.children!.total, 1)
        assert.equal(model.groupResourceCount, 4)
        assert.equal(model.height, present(namespace).height)
        assert.deepEqual(namespace.children, before)
        assert.equal(group.state.expanded, false)
        assert.equal(present(namespace).groupResourceCount, undefined)
    })
    it('preserves full storage context and does not fabricate endpoint traffic', () => {
        const pvc = resource('data', 'persistentvolumeclaim', { Status: { Capacity: { storage: '120Gi' } } })
        pvc.data.K8s.Namespace = 'long-namespace-name'
        assert.equal(present(pvc).subtitle, 'PVC · long-namespace-name')
        assert.equal(present(pvc).metrics[0].value, '120Gi')
        assert.deepEqual(present(resource('svc', 'service')).metrics, [])
    })
    it('formats collected Kubernetes quantity objects instead of object placeholders', () => {
        const pvc = resource('data', 'persistentvolumeclaim', { Status: { Capacity: { storage: { String: '120Gi' } } } })
        assert.equal(present(pvc).metrics[0].value, '120Gi')
        pvc.data.K8s.Extra.Status.Capacity.storage = { unrecognized: true }
        assert.equal(present(pvc).metrics[0].value, '확인 불가')
        delete pvc.data.K8s.Extra.Status.Capacity.storage
        assert.deepEqual(present(pvc).metrics, [])
    })
})

describe('Topology card edge endpoints', () => {
    it('emphasizes the complete visible relation across skipped-level spacers', () => {
        const parent: any = { id: 'cluster', children: [] }, hidden: any = { id: 'spacer', hidden: true, parent, children: [] }
        const child: any = { id: 'namespace', parent: hidden, children: [] }
        parent.children = [hidden]; hidden.children = [child]
        const access = { id: (node: any) => node.id, hidden: (node: any) => !!node.hidden, parent: (node: any) => node.parent, children: (node: any) => node.children }
        const expected = { source: 'cluster', targets: ['namespace'] }
        assert.deepEqual(topologyHierarchyEdgeIDs(parent, hidden, access), expected)
        assert.deepEqual(topologyHierarchyEdgeIDs(hidden, child, access), expected)
    })
    it('anchors hierarchy curves at the actual bottom/top card boundaries', () => {
        const source = { x: 0, y: 0, width: 420, height: 156 }, target = { x: 200, y: 216, width: 340, height: 140 }
        const before = JSON.stringify([source, target])
        const path = topologyCardEdge(source, target, true)
        assert.ok(path.startsWith('M0,78') && path.endsWith('V146'))
        assert.equal(JSON.stringify([source, target]), before)
    })
    it('connects same-level neighbors at their side borders', () => {
        assert.equal(topologyCardEdge({ x: 0, y: 0, width: 280, height: 112 }, { x: 600, y: 0, width: 340, height: 140 }), 'M140,0 C285,0 285,0 430,0')
    })
    it('routes upward relationships without clipping into the source card', () => {
        const path = topologyCardEdge({ x: 0, y: 216, width: 280, height: 112 }, { x: 0, y: 0, width: 420, height: 156 })
        assert.ok(path.startsWith('M0,160') && path.endsWith('0,78'))
    })
})

describe('Search and card shared status', () => {
    it('keeps status parity across infrastructure snapshots and Kubernetes states', () => {
        for (const type of ['host', 'libvirt', 'device', 'bridge', 'pod', 'node']) {
            for (const state of ['UP', 'DOWN', 'Running', 'Error', undefined]) {
                const node = resource(type, type)
                if (!['pod', 'node'].includes(type)) node.data.Manager = 'fabric'
                node.data.State = state
                for (const options of [{}, { resourceData: { inventory: { State: 'Maintenance', ResourceState: 'Maintenance' } } }])
                    assert.deepEqual(topologyNodeStatusPresentation(node, options), present(node, options).status)
            }
        }
    })
})

describe('Kubernetes cluster metric layout bounds', () => {
    it('reserves two count rows and equal CPU/memory slots within the same SVG/layout height', () => {
        const cluster = resource('cluster', 'cluster')
        cluster.data.Name = 'k8s-lifecycle31-v13412-gfs2-r12-long-cluster'
        const model = present(cluster, { resourceData: { summary: { resources: { allocatableCpuCores: 12, allocatableMemoryBytes: 24653168640 } } } })
        assert.ok(model.height > 440, 'the full-width name and scope need their own header rows')
        assert.equal(model.height, topologyCardDimensions(cluster).height)
        assert.equal(model.metrics.length, 6)
        assert.deepEqual(model.metrics.slice(-2).map(m => m.key), ['cpu', 'memory'])
        assert.ok(model.height >= 40 + 116 + 18 + 56 * 2 + 112 + 10 * 2)
        assert.equal(topologyCardDimensions(cluster, true).height, model.height)
        const vm = resource('vm', 'libvirt'); vm.data.Manager = 'fabric'
        assert.equal(topologyCardDimensions(vm).height, present(vm).height)
    })
})

describe('Kubernetes content and stable metric slots', () => {
    it('makes a leaf card fit its identity and caps long names without reserving unused metrics', () => {
        const node = resource('brief', 'container')
        const short = present(node)
        assert.deepEqual(short.metricRowHeights, [])
        assert.equal(short.metrics.length, 0)
        node.data.Name = '긴 컨테이너 이름 '.repeat(15)
        const long = present(node)
        assert.ok(long.height > short.height)
        node.data.Name += '더 긴 이름 '.repeat(50)
        assert.equal(present(node).height, long.height)
        assert.equal(present(node).name, node.data.Name)
        assert.deepEqual(topologyCardDimensions(node), { size: long.size, width: long.width, height: long.height, metricRowHeights: [] })
    })
    it('keeps workload, node and pod geometry stable when real usage and counts arrive', () => {
        for (const type of ['deployment', 'node', 'pod']) {
            const node = resource(`long-${type}-name-`.repeat(3), type, { Spec: { Replicas: 2 }, Status: { Phase: 'Running', ReadyReplicas: 1 } })
            node.data.Namespace = 'a-long-namespace-for-operational-context'
            const before = present(node)
            assert.deepEqual(before.metrics.slice(0, 2).map(metric => metric.key), ['cpu', 'memory'])
            assert.ok(before.metrics.slice(0, 2).every(metric => metric.value === '미수집' && metric.percent === undefined))
            const snapshot = { detail: { podCount: 8, usage: { cpu: '1', memory: '2Gi' }, allocatable: { cpu: '4', memory: '8Gi' } } }
            const after = present(node, { resourceData: snapshot })
            assert.equal(after.height, before.height)
            assert.deepEqual(after.metricRowHeights, before.metricRowHeights)
            assert.deepEqual(topologyCardDimensions(node).height, before.height)
            if (type === 'node') assert.equal(after.metrics.find(metric => metric.key === 'pods')!.value, '8')
            if (type === 'deployment') assert.equal(after.metrics.find(metric => metric.key === 'replicas')!.value, '1/2')
            assert.equal(after.name, node.data.Name)
        }
    })
})
