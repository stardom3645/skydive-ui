import { strict as assert } from 'assert'
import { readFileSync } from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as vm from 'vm'
import { resolveKubernetesPodController } from '../src/KubernetesWorkloadOwnership'
import { kubernetesStorageBindings } from '../src/KubernetesStorageBindings'
import { isCurrentKubernetesPod, isKubernetesPod } from '../src/KubernetesPodLifecycle'
import { isKubernetesTopologyData, isTopologyNodeVisibleInLayer } from '../src/KubernetesInfrastructureEvidence'

const source = (file: string) => ts.createSourceFile(file,
    readFileSync(path.join(__dirname, '../src', file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const panelSource = source('DataPanels/KubernetesClusterDetailPanel.tsx')
const appSource = source('App.tsx')
const topologySource = source('Topology.tsx')
const methods = (file: ts.SourceFile, name: string, names: string[]) => {
    const declaration = file.statements.filter(ts.isClassDeclaration).find(item => item.name?.text === name)!
    return declaration.members.filter(item => item.name && names.includes(item.name.getText(file)))
        .map(item => item.getText(file)).join('\n')
}
const helpers = panelSource.statements.filter(ts.isVariableStatement)
    .filter(item => ['isBlank', 'stringify', 'valueByPath', 'firstRaw', 'firstValue'].includes(item.declarationList.declarations[0].name.getText(panelSource)))
    .map(item => item.getText(panelSource)).join('\n')
const pod = (id: string, cluster = 'cluster-a'): any => ({ id, parent: null, data: {
    Type: 'pod', Manager: 'k8s', Name: 'api-same-name', ClusterName: cluster,
    K8s: { Namespace: 'app', Extra: { ObjectMeta: { UID: id }, Status: { Phase: 'Running' } } }
}, state: { selected: false }, tags: ['kubernetes'] })
const find = (tree: any, type: string): any[] => {
    if (Array.isArray(tree)) return ([] as any[]).concat(...tree.map(item => find(item, type)))
    if (!tree || typeof tree !== 'object') return []
    return (tree.type === type ? [tree] : []).concat(find(tree.children || [], type))
}
const probe = (nodes: any[]) => {
    const calls: string[] = [], selected: string[] = []
    const context: any = { kubernetesStorageBindings, resolveKubernetesPodController, isCurrentKubernetesPod, isKubernetesPod, isKubernetesTopologyData, isTopologyNodeVisibleInLayer,
        kubernetesTopologyHasInactiveClusterAncestor: () => false,
        KUBERNETES_INTERMEDIATE_RELATION_TYPES: new Set(['replicaset']),
        KUBERNETES_WORKLOAD_TYPES: new Set(['deployment', 'daemonset', 'statefulset', 'job', 'cronjob']),
        WrapperType: { Normal: 0 }, zoomIdentity: require('d3-zoom').zoomIdentity, animDuration: 300,
        select: () => ({ style: () => undefined }),
        window: {}, React: { Fragment: 'fragment',
        createElement: (type: any, props: any, ...children: any[]) => ({ type, props: props || {}, children }) },
        CompactEmptyState: 'empty', DetailBadge: 'badge', Tooltip: 'tooltip', Table: 'table',
        formatRelativeDate: () => '1분 전', getPodClassification: () => ({ phase: 'Failed' }) }
    vm.createContext(context)
    vm.runInContext(ts.transpile(`
        ${helpers}
        class PanelProbe { ${methods(panelSource, 'KubernetesClusterDetailPanel', ['focusResources', 'openResourceDetail', 'openPodStatusDetail', 'renderPodStatusList', 'renderTerminationHistoryTable'])} }
        class AppProbe { ${methods(appSource, 'App', ['openResourceDetailNodeID', 'navigateInfrastructureConnectedResources', 'kubernetesTopologyNodeVisible', 'reconcileKubernetesWorkloadHierarchy'])} }
        class NodeWrapper { children = []; constructor(public id, public type, public wrapped, public parent) {} }
        class TopologyProbe { ${methods(topologySource, 'Topology', ['navigateConnectedResources', 'focusInfrastructureNodes', 'cloneTree', 'showNode', 'visibleNodeIDForID', 'closestVisibleNodeID', 'centerNode', 'setParent'])} }
        this.TopologyProbe = TopologyProbe; this.PanelProbe = PanelProbe; this.AppProbe = AppProbe;
    `, { target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }), context)
    const panel = new context.PanelProbe(), app = new context.AppProbe()
    app.state = { kubernetesClusters: [] }
    panel.props = { node: { id: 'cluster-node' } }
    panel.state = { podStatusModalMode: 'current', podStatusModalKey: 'not-ready' }
    panel.setState = (state: any, callback?: () => void) => {
        Object.assign(panel.state, state); calls.push('close'); callback?.()
    }
    panel.podWorkloadName = () => ''
    panel.podTimestamp = () => ({ value: 1000, source: '상태 전환', estimated: false })
    panel.podPrimaryReason = () => 'Ready=false'
    app.tc = { nodes: new Map(nodes.map(node => [node.id, node])), selectNode: (id: string, active: boolean, keepExisting: boolean) => {
        assert.equal(panel.state.podStatusModalMode, '')
        assert.equal(active, true)
        nodes.forEach(node => node.state.selected = node.id === id)
        selected.push(id); calls.push('select')
    } }
    app.isKubernetesLayerActive = () => true
    app.syncTopologyNodeTagForNodes = () => undefined
    app.tc.navigateConnectedResources = context.TopologyProbe.prototype.navigateConnectedResources.bind(app.tc)
    app.tc.centerNode = (node: any) => {
        assert.ok(app.tc.rendered.has(node.id), 'camera target must have a rendered Pod card')
        calls.push(`center:${node.id}`)
    }
    app.tc.focusInfrastructureNodes = (ids: string[], anchor: string, reveal: boolean) => {
        assert.equal(panel.state.podStatusModalMode, '')
        assert.equal(anchor, 'cluster-node'); assert.equal(reveal, true)
        app.tc.rendered = new Set(nodes.filter(node => app.kubernetesTopologyNodeVisible(node)).map(node => node.id))
        calls.push(`focus:${Array.from(ids).join(',')}`)
    }
    context.window.App = app
    return { panel, app, calls, selected, topologyMethods: context.TopologyProbe.prototype }
}

describe('Kubernetes Cluster Pod list navigation', () => {
    it('closes the problem modal and opens the exact Pod detail after revealing its path', () => {
        const target = pod('pod-uid')
        const { panel, calls, selected } = probe([target])
        const row = find(panel.renderPodStatusList([target], [target], [], undefined, true), 'button')[0]
        row.props.onClick()
        assert.equal(panel.state.podStatusModalKey, '')
        assert.deepEqual(calls, ['close', 'select', 'focus:pod-uid', 'center:pod-uid'])
        assert.deepEqual(selected, ['pod-uid'])
        assert.equal(target.parent, null, 'unresolved ownership must not be fabricated for navigation')
    })

    it('keeps same-name Pods in another cluster separate and opens hidden inventory by ID', () => {
        const first = pod('first-uid'), second = pod('second-uid', 'cluster-b')
        const { panel, selected } = probe([first, second])
        const rows = find(panel.renderPodStatusList([first, second], [first, second], [], undefined, true), 'button')
        rows[1].props.onClick()
        assert.deepEqual(selected, ['second-uid'])
        assert.equal(second.parent, null)
    })

    it('uses the same exact-card navigation for recent Pod lists', () => {
        const target = pod('history-uid')
        const { panel, selected, calls } = probe([target])
        panel.state.podStatusModalMode = 'recent'
        panel.podTerminationRecovery = () => ({ label: '확인 필요', tone: 'default' })
        find(panel.renderPodStatusList([target], [target], []), 'button')[0].props.onClick()
        target.data.K8s.Extra.Status.Phase = 'Failed'
        panel.state.podStatusModalMode = 'history'
        const table = panel.renderTerminationHistoryTable([target])
        table.props.onRow(table.props.dataSource[0]).onClick()
        assert.deepEqual(selected, ['history-uid', 'history-uid'])
        assert.equal(panel.state.podStatusModalMode, '')
        assert.equal(calls.filter(call => call.startsWith('center:')).length, 1, 'terminated history opens detail without moving to an unrelated ancestor')
    })

    it('does not substitute a same-name replacement when the clicked UID disappeared', () => {
        const removed = pod('removed-uid'), replacement = pod('replacement-uid')
        const { panel, selected } = probe([replacement])
        find(panel.renderPodStatusList([removed], [removed], [], undefined, true), 'button')[0].props.onClick()
        assert.deepEqual(selected, [])
    })

    it('expands the verified Cluster -> Namespace -> unresolved Pod path before centering', () => {
        const target = pod('unresolved-pod')
        const scopeNode = (id: string, type: string, name: string, clusterName: string): any => ({
            id, data: { Manager: 'k8s', Type: type, Name: name, ClusterName: clusterName },
            tags: ['kubernetes'], state: { expanded: false, selected: false }, children: [], parent: null
        })
        const cluster = scopeNode('cluster-node', 'cluster', 'cluster-a', 'cluster-a')
        const namespace = scopeNode('namespace', 'namespace', 'app', 'cluster-a')
        const otherCluster = scopeNode('other-cluster', 'cluster', 'cluster-b', 'cluster-b')
        const otherNamespace = scopeNode('other-namespace', 'namespace', 'app', 'cluster-b')
        const { panel, app, topologyMethods } = probe([target, otherNamespace, otherCluster, cluster, namespace])
        const root: any = { id: 'root', data: {}, tags: ['kubernetes'], state: { expanded: true }, children: [target, otherNamespace, otherCluster, cluster, namespace], parent: null }
        root.children.forEach((node: any) => { node.parent = root })
        target.children = []
        let camera: any
        const tc = app.tc
        Object.assign(tc, {
            root, props: { nodeVisible: (node: any) => app.kubernetesTopologyNodeVisible(node) },
            nodeTagStates: new Map([['kubernetes', true]]), nodeGroup: new Map(), groups: new Map(),
            d3nodes: new Map(), expandedContainerMiniNodeIDs: new Set(), pinnedContainerMiniNodeID: '',
            clearInfrastructureFocus: () => undefined, unpinNodes: () => undefined,
            groupify: () => new Map(), cancelScheduledZoomFit: () => undefined,
            infrastructureLayerBounds: () => null,
            focusBounds: (ids: string[]) => {
                assert.deepEqual(Array.from(ids), [target.id], 'bounds must never fall back to the cluster/root')
                return null
            },
            viewSize: () => ({ width: 1200, height: 800 }),
            svg: { node: () => ({ __zoom: { k: 0.8 } }), transition: () => ({ duration: () => ({
                call: (_zoom: any, transform: any) => { camera = transform }
            }) }) }, zoom: { transform: () => undefined }
        })
        ;['cloneTree', 'showNode', 'visibleNodeIDForID', 'closestVisibleNodeID', 'centerNode', 'focusInfrastructureNodes']
            .forEach(name => tc[name] = topologyMethods[name].bind(tc))
        tc.setParent = topologyMethods.setParent.bind(tc)
        app.reconcileKubernetesWorkloadHierarchy()
        assert.equal(target.parent, namespace, 'use the matching cluster and namespace, never the internal root')
        assert.equal(namespace.parent, cluster)
        tc.expand = (node: any) => { node.state.expanded = true; tc.renderTree() }
        tc.renderTree = () => {
            const [tree] = tc.cloneTree(root, null)
            tc.d3nodes.clear()
            const visit = (node: any) => {
                tc.d3nodes.set(node.id, { data: node, x: node.id === target.id ? 900 : 0, y: node.id === target.id ? 600 : 0 })
                node.children.forEach(visit)
            }
            visit(tree)
        }
        tc.renderTree()
        assert.equal(tc.d3nodes.has(target.id), false)
        panel.openPodStatusDetail(target)
        assert.equal(tc.d3nodes.has(target.id), true)
        assert.equal(camera.applyX(900), 600)
        assert.equal(camera.applyY(600), 400)
        assert.equal(target.parent, namespace)
        assert.equal(cluster.state.expanded, true)
        assert.equal(namespace.state.expanded, true)
        assert.equal(otherCluster.state.expanded, false, 'do not expand unrelated clusters')
        assert.equal(otherNamespace.state.expanded, false)
        assert.equal(tc.d3nodes.has(cluster.id), true)
        assert.equal(tc.d3nodes.has(namespace.id), true)
        assert.equal(target.data.TopologyWorkloadControllerID, '')
        target.state.selected = false
        tc.renderTree()
        assert.equal(tc.d3nodes.has(target.id), false, 'explicit reveal ends with selection')
    })

    it('preserves a verified controller path and uses the cluster when namespace inventory is missing', () => {
        const scoped = (id: string, type: string, name: string): any => ({
            ...pod(id), data: { Manager: 'k8s', Type: type, Name: name, ClusterName: 'cluster-a', K8s: { Namespace: 'app' } }, children: []
        })
        const cluster = scoped('cluster', 'cluster', 'cluster-a')
        const namespace = scoped('namespace', 'namespace', 'app')
        const controller = scoped('daemonset', 'daemonset', 'agent')
        const managed = pod('managed')
        managed.data.K8s.Extra.ObjectMeta.OwnerReferences = [{ Kind: 'DaemonSet', UID: controller.id, Name: 'agent', Controller: true }]
        const unresolved = pod('without-namespace')
        unresolved.data.K8s.Namespace = 'missing'
        const nodes = [managed, unresolved, cluster, namespace, controller]
        const { app, topologyMethods } = probe(nodes)
        const root: any = { id: 'root', data: {}, children: nodes.slice(), parent: null }
        nodes.forEach(node => { node.parent = root; node.children = [] })
        app.tc.root = root
        app.tc.setParent = topologyMethods.setParent.bind(app.tc)
        app.reconcileKubernetesWorkloadHierarchy()
        assert.equal(managed.parent, controller)
        assert.equal(controller.parent, namespace)
        assert.equal(namespace.parent, cluster)
        assert.equal(unresolved.parent, cluster)
        assert.equal(unresolved.data.TopologyWorkloadControllerID, '')
    })

    it('keeps terminated and unselected unresolved Pods hidden, and respects the active layer', () => {
        const target = pod('hidden-pod')
        const { app } = probe([target])
        assert.equal(app.kubernetesTopologyNodeVisible(target), false)
        target.state.selected = true
        assert.equal(app.kubernetesTopologyNodeVisible(target), true)
        app.isKubernetesLayerActive = () => false
        assert.equal(app.kubernetesTopologyNodeVisible(target), false)
        app.isKubernetesLayerActive = () => true
        target.data.K8s.Extra.Status.Phase = 'Succeeded'
        assert.equal(app.kubernetesTopologyNodeVisible(target), false)
    })

})
