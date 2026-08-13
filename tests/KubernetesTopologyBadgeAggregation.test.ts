import { expect } from 'chai'
import {
    kubernetesTopologyBadgeGroupSummary,
    kubernetesTopologyCountBadges,
    kubernetesTopologyDirectChildSummary,
    kubernetesTopologyProblemFindings,
    kubernetesTopologyAttentionPathIDs,
    kubernetesTopologyHasInactiveClusterAncestor,
    kubernetesResourceSelfStatus
} from '../src/KubernetesTopologyBadgeAggregation'

const resource = (id: string, type: string, options: any = {}): any => ({
    id,
    children: [],
    parent: null,
    data: {
        Manager: 'k8s',
        Type: type,
        Name: options.name || id,
        ...(options.state ? { State: options.state } : {}),
        ...(options.group ? { IsTopologyGroup: true } : {}),
        K8s: { Extra: {
            ObjectMeta: { UID: options.uid || id },
            Spec: options.spec || {},
            Status: options.status || {}
        } }
    }
})

const attach = (parent: any, child: any) => {
    parent.children.push(child)
    child.parent = parent
    return child
}

const healthyWorkload = (id: string, type = 'deployment') => resource(id, type, {
    spec: { Replicas: 1 },
    status: { AvailableReplicas: 1, ReadyReplicas: 1, UpdatedReplicas: 1 }
})

const problemWorkload = (id: string, type = 'deployment') => resource(id, type, {
    spec: { Replicas: 2 },
    status: { AvailableReplicas: 1, ReadyReplicas: 1, UpdatedReplicas: 1, UnavailableReplicas: 1 }
})

describe('Kubernetes topology count badge aggregation', () => {
    it('shows green only for healthy direct children', () => {
        const namespace = resource('namespace', 'namespace', { status: { Phase: 'Active' } })
        attach(namespace, healthyWorkload('one'))
        attach(namespace, healthyWorkload('two', 'statefulset'))
        expect(kubernetesTopologyCountBadges(namespace).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-healthy', 2]
        ])
    })

    it('keeps a broken next-level resource orange without adding its bad Pod count', () => {
        const namespace = resource('namespace', 'namespace', { status: { Phase: 'Active' } })
        attach(namespace, healthyWorkload('healthy'))
        const broken = attach(namespace, problemWorkload('broken'))
        for (let index = 0; index < 10; index += 1) {
            attach(broken, resource(`bad-pod-${index}`, 'pod', {
                status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }] }
            }))
        }
        const badges = kubernetesTopologyCountBadges(namespace)
        expect(badges.map(item => [item.key, item.count])).to.deep.equal([
            ['direct-descendant-problem', 1],
            ['direct-healthy', 1]
        ])
        expect(badges[0].tooltip.title).to.equal('하위 자원 이상')
        expect(badges[0].tooltip.summary).to.equal(undefined)
        expect(badges[0].tooltip.details).to.deep.equal([{ label: 'Deployment 이상', value: '1개' }])
    })

    it('classifies a self-healthy direct child with bad descendants as one orange child', () => {
        const namespace = resource('namespace', 'namespace', { status: { Phase: 'Active' } })
        const workload = attach(namespace, healthyWorkload('healthy-parent'))
        attach(workload, resource('bad-pod', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }] }
        }))
        expect(kubernetesTopologyCountBadges(namespace).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-descendant-problem', 1]
        ])
        expect(kubernetesTopologyCountBadges(workload).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-descendant-problem', 1]
        ])
    })

    it('supports red, orange and green simultaneously in severity order', () => {
        const daemonSet = resource('daemonset', 'daemonset', {
            status: {
                DesiredNumberScheduled: 5,
                NumberAvailable: 3,
                NumberReady: 3,
                UpdatedNumberScheduled: 4,
                NumberUnavailable: 2,
                NumberMisscheduled: 1
            }
        })
        attach(daemonSet, resource('healthy-pod', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'True' }] }
        }))
        attach(daemonSet, resource('bad-pod', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }] }
        }))
        const badges = kubernetesTopologyCountBadges(daemonSet)
        expect(badges.map(item => item.key)).to.deep.equal(['self-problem', 'direct-descendant-problem', 'direct-healthy'])
        expect(badges.map(item => item.tone)).to.deep.equal(['problem', 'warning', 'running'])
        expect(badges.map(item => item.count)).to.deep.equal([
            0,
            1,
            1
        ])
        expect(badges.map(item => item.displayText)).to.deep.equal(['!', undefined, undefined])
    })

    it('supports a self-problem badge with a healthy direct-child total', () => {
        const deployment = problemWorkload('self-broken')
        attach(deployment, resource('healthy-pod', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'True' }] }
        }))
        expect(kubernetesTopologyCountBadges(deployment).map(item => [item.key, item.count])).to.deep.equal([
            ['self-problem', 0],
            ['direct-healthy', 1]
        ])
        expect(kubernetesTopologyCountBadges(deployment)[0].displayText).to.equal('!')
    })

    it('keeps a visual group as the one direct child and only uses descendants for its bucket', () => {
        const namespace = resource('namespace', 'namespace', { status: { Phase: 'Active' } })
        const visualGroup = attach(namespace, resource('workload-group', 'deployment', { group: true }))
        const deployment = attach(visualGroup, healthyWorkload('deployment'))
        attach(deployment, resource('grandchild-pod', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }] }
        }))
        const summary = kubernetesTopologyDirectChildSummary(namespace)
        expect(summary.total).to.equal(1)
        expect(summary.children.map(child => child.id)).to.deep.equal(['workload-group'])
        expect(summary.selfProblematic).to.have.length(0)
        expect(summary.descendantProblematic).to.have.length(1)
    })

    it('counts only Cluster objects directly under a Cluster Group', () => {
        const clusterGroup = resource('cluster-group', 'cluster', { group: true })
        const brokenCluster = attach(clusterGroup, resource('broken-cluster', 'cluster'))
        brokenCluster.data.State = 'error'
        attach(clusterGroup, resource('healthy-cluster-1', 'cluster', { state: 'running' }))
        attach(clusterGroup, resource('healthy-cluster-2', 'cluster', { state: 'running' }))
        attach(clusterGroup, resource('healthy-cluster-3', 'cluster', { state: 'running' }))

        expect(kubernetesTopologyCountBadges(clusterGroup).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-self-problem', 1],
            ['direct-healthy', 3]
        ])
        expect(kubernetesTopologyBadgeGroupSummary(clusterGroup)).to.deep.equal({
            title: '클러스터 상태',
            totalLabel: '클러스터 총 4개',
            states: [
                { key: 'direct-self-problem', tone: 'problem', label: '자체 이상', count: 1 },
                { key: 'direct-healthy', tone: 'running', label: '정상', count: 3 }
            ]
        })
    })

    it('counts the Node and Namespace groups directly under Cluster', () => {
        const cluster = resource('cluster', 'cluster', { state: 'running' })
        const nodeGroup = attach(cluster, resource('node-group', 'node', { group: true }))
        const namespaceGroup = attach(cluster, resource('namespace-group', 'namespace', { group: true }))
        for (let index = 0; index < 3; index += 1) {
            attach(nodeGroup, resource(`healthy-node-${index}`, 'node', {
                status: { Conditions: [{ Type: 'Ready', Status: 'True' }] }
            }))
        }
        for (let index = 0; index < 2; index += 1) {
            attach(nodeGroup, resource(`broken-node-${index}`, 'node', {
                status: { Conditions: [{ Type: 'Ready', Status: 'False' }] }
            }))
        }
        for (let index = 0; index < 6; index += 1) {
            attach(namespaceGroup, resource(`namespace-${index}`, 'namespace', { status: { Phase: 'Active' } }))
        }

        const summary = kubernetesTopologyDirectChildSummary(cluster)
        expect(summary.children.map(child => child.id)).to.deep.equal(['node-group', 'namespace-group'])
        expect(summary.total).to.equal(2)
        expect(summary.selfProblematic.length + summary.descendantProblematic.length + summary.healthy.length).to.equal(summary.total)
        expect(kubernetesTopologyCountBadges(cluster).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-descendant-problem', 1],
            ['direct-healthy', 1]
        ])
        const clusterWarning = kubernetesTopologyCountBadges(cluster)[0]
        expect(clusterWarning.tooltip.title).to.equal('하위 자원 이상')
        expect(clusterWarning.tooltip.description).to.equal(undefined)
        expect(clusterWarning.tooltip.summary).to.equal(undefined)
        expect(clusterWarning.tooltip.details).to.deep.equal([{ label: '노드 이상', value: '1개' }])
        const clusterHealthy = kubernetesTopologyCountBadges(cluster)[1]
        expect(clusterHealthy.tooltip.title).to.equal('정상')
        expect(clusterHealthy.tooltip.description).to.equal(undefined)
        expect(clusterHealthy.tooltip.summary).to.equal(undefined)
        expect(clusterHealthy.tooltip.details).to.deep.equal([{ label: '네임스페이스 정상', value: '1개' }])
        expect(kubernetesTopologyCountBadges(nodeGroup).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-self-problem', 2],
            ['direct-healthy', 3]
        ])
        expect(kubernetesTopologyBadgeGroupSummary(nodeGroup).title).to.equal('노드 상태')
        expect(kubernetesTopologyBadgeGroupSummary(nodeGroup).totalLabel).to.equal('노드 총 5개')
    })

    it('keeps the visible Workload Group as the Namespace direct child without recursive counts', () => {
        const namespace = resource('namespace', 'namespace', { status: { Phase: 'Active' } })
        const workloadGroup = attach(namespace, resource('deployment-group', 'deployment', { group: true }))
        const healthy = attach(workloadGroup, healthyWorkload('healthy'))
        const broken = attach(workloadGroup, problemWorkload('broken'))
        attach(workloadGroup, healthyWorkload('fully-healthy'))
        attach(healthy, resource('bad-grandchild', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }] }
        }))
        attach(broken, resource('healthy-pod', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'True' }] }
        }))

        expect(kubernetesTopologyCountBadges(namespace).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-descendant-problem', 1]
        ])
        const namespaceSummary = kubernetesTopologyDirectChildSummary(namespace)
        expect(namespaceSummary.children.map(child => child.id)).to.deep.equal(['deployment-group'])
        expect(kubernetesTopologyBadgeGroupSummary(namespace).title).to.equal('하위 워크로드 상태')
        expect(namespaceSummary.selfProblematic.length
            + namespaceSummary.descendantProblematic.length
            + namespaceSummary.healthy.length).to.equal(namespaceSummary.total)
        expect(kubernetesTopologyCountBadges(healthy).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-descendant-problem', 1]
        ])
        expect(kubernetesTopologyBadgeGroupSummary(healthy).title).to.equal('하위 파드 상태')
        expect(kubernetesTopologyCountBadges(broken).map(item => [item.key, item.count])).to.deep.equal([
            ['self-problem', 0],
            ['direct-healthy', 1]
        ])
    })

    it('keeps the self marker separate and merges resource child problems into orange', () => {
        const namespace = resource('namespace', 'namespace', { status: { Phase: 'Terminating' } })
        attach(namespace, problemWorkload('self-broken-child'))
        const descendantBroken = attach(namespace, healthyWorkload('descendant-broken-child'))
        attach(descendantBroken, resource('bad-pod', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }] }
        }))
        attach(namespace, healthyWorkload('fully-healthy-child'))

        const badges = kubernetesTopologyCountBadges(namespace)
        expect(badges.map(item => item.key)).to.deep.equal([
            'self-problem',
            'direct-descendant-problem',
            'direct-healthy'
        ])
        expect(badges.map(item => item.tone)).to.deep.equal(['problem', 'warning', 'running'])
        expect(badges.map(item => item.displayText)).to.deep.equal(['!', undefined, undefined])
        expect(badges.map(item => item.count)).to.deep.equal([0, 2, 1])
    })

    it('deduplicates direct children by UID and omits every badge when there are no counts', () => {
        const namespace = resource('namespace', 'namespace', { status: { Phase: 'Active' } })
        attach(namespace, healthyWorkload('copy-a')).data.K8s.Extra.ObjectMeta.UID = 'same'
        attach(namespace, healthyWorkload('copy-b')).data.K8s.Extra.ObjectMeta.UID = 'same'
        expect(kubernetesTopologyDirectChildSummary(namespace).total).to.equal(1)
        expect(kubernetesTopologyCountBadges(resource('pod', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'True' }] }
        }))).to.deep.equal([])
    })

    it('keeps missing and stale self state distinct from healthy', () => {
        const missingNode = resource('missing-node', 'node')
        const missing = kubernetesResourceSelfStatus(missingNode)
        expect(missing.state).to.equal('unknown')
        expect(missing.collection).to.equal('unavailable')
        expect(missing.findings).to.deep.equal(['노드 상태를 확인할 수 없습니다.'])

        const staleNamespace = resource('stale-namespace', 'namespace', { status: { Phase: 'Active' } })
        staleNamespace.data.Stale = true
        const stale = kubernetesResourceSelfStatus(staleNamespace)
        expect(stale.state).to.equal('unknown')
        expect(stale.collection).to.equal('stale')
        expect(stale.findings).to.deep.equal(['상태 데이터가 오래되어 확인이 필요합니다.'])
        expect(kubernetesTopologyCountBadges(staleNamespace)).to.deep.equal([])
    })

    it('does not invent a Cluster self error when the topology scope has no native State field', () => {
        const cluster = resource('cluster-without-native-state', 'cluster')
        expect(kubernetesResourceSelfStatus(cluster)).to.deep.equal({
            state: 'healthy', collection: 'collected', findings: []
        })
        expect(kubernetesTopologyCountBadges(cluster)).to.deep.equal([])

        cluster.data.State = 'error'
        expect(kubernetesResourceSelfStatus(cluster).state).to.equal('problem')
        expect(kubernetesTopologyCountBadges(cluster).map(item => [item.key, item.displayText])).to.deep.equal([
            ['self-problem', '!']
        ])
    })

    it('classifies an explicitly stopped Mold Cluster as inactive without propagating a problem', () => {
        const clusterGroup = resource('cluster-group', 'cluster', { group: true })
        const stopped = attach(clusterGroup, resource('stopped-cluster', 'cluster'))
        stopped.data.MoldClusterState = 'Stopped'
        const running = attach(clusterGroup, resource('running-cluster', 'cluster', { state: 'running' }))

        expect(kubernetesResourceSelfStatus(stopped)).to.deep.equal({
            state: 'inactive', collection: 'collected', findings: []
        })
        expect(kubernetesTopologyCountBadges(stopped)).to.deep.equal([{
            key: 'self-inactive',
            label: '비활성',
            count: 0,
            displayText: '!',
            tone: 'inactive',
            tooltip: {
                title: '비활성',
                description: '현재 Mold에서 정지 상태인 클러스터입니다.'
            }
        }])
        expect(kubernetesTopologyCountBadges(stopped)[0].tooltip).to.deep.equal({
            title: '비활성',
            description: '현재 Mold에서 정지 상태인 클러스터입니다.'
        })
        expect(kubernetesTopologyCountBadges(clusterGroup).map(item => [item.key, item.count, item.tone])).to.deep.equal([
            ['direct-healthy', 1, 'running'],
            ['direct-inactive', 1, 'inactive']
        ])
        expect(kubernetesTopologyBadgeGroupSummary(clusterGroup)).to.deep.equal({
            title: '클러스터 상태',
            totalLabel: '클러스터 총 2개',
            states: [
                { key: 'direct-healthy', tone: 'running', label: '정상', count: 1 },
                { key: 'direct-inactive', tone: 'inactive', label: '비활성', count: 1 }
            ]
        })
        expect(kubernetesTopologyAttentionPathIDs([stopped, running]).has(stopped.id)).to.equal(false)
    })

    it('keeps running collection failures out of inactive while preserving failure states', () => {
        const unavailable = resource('running-unavailable', 'cluster', { state: 'running' })
        unavailable.data.CollectionState = 'unavailable'
        expect(kubernetesResourceSelfStatus(unavailable)).to.deep.include({ state: 'unknown', collection: 'unavailable' })

        const stale = resource('running-stale', 'cluster', { state: 'running' })
        stale.data.CollectionState = 'stale'
        expect(kubernetesResourceSelfStatus(stale)).to.deep.include({ state: 'unknown', collection: 'stale' })

        const failed = resource('failed-cluster', 'cluster')
        failed.data.MoldClusterState = 'Failed'
        expect(kubernetesResourceSelfStatus(failed).state).to.equal('problem')
    })

    it('marks descendants of an inactive Cluster for topology suppression', () => {
        const stopped = resource('stopped-cluster', 'cluster')
        stopped.data.MoldClusterState = 'Stopped'
        const namespace = attach(stopped, resource('namespace', 'namespace', { status: { Phase: 'Active' } }))
        const workload = attach(namespace, healthyWorkload('workload'))
        expect(kubernetesTopologyHasInactiveClusterAncestor(namespace)).to.equal(true)
        expect(kubernetesTopologyHasInactiveClusterAncestor(workload)).to.equal(true)
        expect(kubernetesTopologyHasInactiveClusterAncestor(stopped)).to.equal(false)
    })

    it('uses explicit scalar self states consistently across resource kinds', () => {
        ;['service', 'storageclass', 'namespace', 'deployment'].forEach(type => {
            const failed = resource(`${type}-failed`, type, {
                ...(type === 'namespace' ? { status: { Phase: 'Active' } } : {}),
                ...(type === 'deployment' ? {
                    spec: { Replicas: 1 },
                    status: { AvailableReplicas: 1, ReadyReplicas: 1, UpdatedReplicas: 1 }
                } : {})
            })
            failed.data.State = 'critical'
            expect(kubernetesResourceSelfStatus(failed).state, type).to.equal('problem')

            const unknown = resource(`${type}-unknown`, type)
            unknown.data.State = 'unknown'
            expect(kubernetesResourceSelfStatus(unknown), type).to.deep.include({ state: 'unknown', collection: 'collected' })

            const stale = resource(`${type}-stale`, type)
            stale.data.State = 'stale'
            expect(kubernetesResourceSelfStatus(stale), type).to.deep.include({ state: 'unknown', collection: 'stale' })

            const unavailable = resource(`${type}-unavailable`, type)
            unavailable.data.State = 'unavailable'
            expect(kubernetesResourceSelfStatus(unavailable), type).to.deep.include({ state: 'unknown', collection: 'unavailable' })
        })
    })

    it('does not require a synthetic State from resources that have no native health field', () => {
        ;['cluster', 'service', 'storageclass'].forEach(type => {
            expect(kubernetesResourceSelfStatus(resource(`${type}-scope`, type)), type).to.deep.equal({
                state: 'healthy', collection: 'collected', findings: []
            })
        })
    })

    it('keeps missing required native status evidence as confirmation-needed instead of healthy', () => {
        ;['node', 'namespace', 'deployment', 'statefulset', 'daemonset', 'job', 'pod', 'persistentvolumeclaim', 'persistentvolume']
            .forEach(type => {
                const status = kubernetesResourceSelfStatus(resource(`${type}-missing-native-status`, type))
                expect(status.state, type).to.equal('unknown')
                expect(status.collection, type).to.equal('unavailable')
            })
    })

    it('does not accept an empty workload status object as collected rollout evidence', () => {
        const deployment = resource('empty-status-deployment', 'deployment', {
            spec: { Replicas: 1 },
            status: {}
        })
        expect(kubernetesResourceSelfStatus(deployment)).to.deep.equal({
            state: 'unknown',
            collection: 'unavailable',
            findings: ['워크로드 상태를 확인할 수 없습니다.']
        })
    })

    it('lets a current detail observation override an older topology self state', () => {
        const node = resource('node', 'node', {
            status: { Conditions: [{ Type: 'Ready', Status: 'False' }] }
        })
        expect(kubernetesResourceSelfStatus(node).state).to.equal('problem')
        expect(kubernetesResourceSelfStatus(node, {
            conditions: [{ type: 'Ready', status: 'True' }]
        })).to.deep.equal({ state: 'healthy', collection: 'collected', findings: [] })

        const namespace = resource('namespace', 'namespace', { status: { Phase: 'Terminating' } })
        expect(kubernetesResourceSelfStatus(namespace).state).to.equal('problem')
        expect(kubernetesResourceSelfStatus(namespace, { phase: 'Active' })).to.deep.equal({
            state: 'healthy', collection: 'collected', findings: []
        })
    })

    it('classifies each direct child into exactly one bucket, including unavailable state', () => {
        const nodeGroup = resource('node-group', 'node', { group: true })
        attach(nodeGroup, resource('healthy-node', 'node', {
            status: { Conditions: [{ Type: 'Ready', Status: 'True' }] }
        }))
        attach(nodeGroup, resource('problem-node', 'node', {
            status: { Conditions: [{ Type: 'Ready', Status: 'False' }] }
        }))
        const unavailable = attach(nodeGroup, resource('unavailable-node', 'node'))
        unavailable.data.CollectionState = 'uncollected'
        const summary = kubernetesTopologyDirectChildSummary(nodeGroup)
        const allBuckets = summary.selfProblematic.concat(summary.attentionRequired, summary.descendantProblematic, summary.healthy)
        expect(summary.total).to.equal(3)
        expect(allBuckets).to.have.length(summary.total)
        expect(new Set(allBuckets.map(item => item.id)).size).to.equal(summary.total)
        expect(kubernetesTopologyCountBadges(nodeGroup).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-self-problem', 1],
            ['direct-descendant-problem', 1],
            ['direct-healthy', 1]
        ])
        expect(kubernetesTopologyCountBadges(nodeGroup)[1].tooltip.details).to.deep.equal([
            { label: '노드 확인 필요', value: '1개' }
        ])
    })

    it('does not increase an ancestor Badge when only deeper problem counts grow', () => {
        const namespace = resource('namespace', 'namespace', { status: { Phase: 'Active' } })
        const workload = attach(namespace, healthyWorkload('workload'))
        attach(workload, resource('bad-pod-0', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }] }
        }))
        const before = kubernetesTopologyCountBadges(namespace).map(item => [item.key, item.count])
        for (let index = 1; index <= 20; index += 1) {
            attach(workload, resource(`bad-pod-${index}`, 'pod', {
                status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }] }
            }))
        }
        expect(kubernetesTopologyCountBadges(namespace).map(item => [item.key, item.count])).to.deep.equal(before)
        expect(before).to.deep.equal([['direct-descendant-problem', 1]])
    })

    it('uses rendered next-level groups instead of raw Cluster resource totals', () => {
        const cluster = resource('hwryu-k8s-test-03', 'cluster', { state: 'running' })
        for (let index = 0; index < 3; index += 1) {
            attach(cluster, resource(`raw-node-${index}`, 'node', {
                status: { Conditions: [{ Type: 'Ready', Status: 'True' }] }
            }))
        }
        for (let index = 0; index < 7; index += 1) {
            attach(cluster, resource(`raw-namespace-${index}`, 'namespace', { status: { Phase: 'Active' } }))
        }
        expect(kubernetesTopologyCountBadges(cluster).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-healthy', 10]
        ])

        const nodeGroup = resource('rendered-node-group', 'node', { group: true })
        const namespaceGroup = resource('rendered-namespace-group', 'namespace', { group: true })
        attach(nodeGroup, resource('rendered-node', 'node', {
            status: { Conditions: [{ Type: 'Ready', Status: 'True' }] }
        }))
        attach(namespaceGroup, resource('rendered-namespace', 'namespace', { status: { Phase: 'Active' } }))
        const renderedChildren = [nodeGroup, namespaceGroup]
        expect(kubernetesTopologyCountBadges(cluster, renderedChildren).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-healthy', 2]
        ])

        for (let index = 0; index < 20; index += 1) {
            attach(namespaceGroup, resource(`deep-namespace-${index}`, 'namespace', { status: { Phase: 'Active' } }))
        }
        expect(kubernetesTopologyCountBadges(cluster, renderedChildren).map(item => [item.key, item.count])).to.deep.equal([
            ['direct-healthy', 2]
        ])
    })

    it('keeps only an attention resource and every ancestor on its topology path', () => {
        const cluster = resource('cluster', 'cluster', { state: 'running' })
        const problemNamespace = attach(cluster, resource('problem-namespace', 'namespace', { status: { Phase: 'Active' } }))
        const workload = attach(problemNamespace, healthyWorkload('workload'))
        const problemPod = attach(workload, resource('problem-pod', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'False' }] }
        }))
        const normalNamespace = attach(cluster, resource('normal-namespace', 'namespace', { status: { Phase: 'Active' } }))
        const normalWorkload = attach(normalNamespace, healthyWorkload('normal-workload'))
        attach(normalWorkload, resource('normal-pod', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'True' }] }
        }))

        expect(Array.from(kubernetesTopologyAttentionPathIDs([cluster])).sort()).to.deep.equal([
            cluster.id, problemNamespace.id, workload.id, problemPod.id
        ].sort())
    })

    it('retains unknown, stale and unavailable resources as attention paths', () => {
        const cluster = resource('cluster', 'cluster', { state: 'running' })
        const unknown = attach(cluster, resource('unknown-node', 'node'))
        const stale = attach(cluster, resource('stale-namespace', 'namespace', { status: { Phase: 'Active' } }))
        stale.data.Stale = true
        const unavailable = attach(cluster, healthyWorkload('unavailable-workload'))
        unavailable.data.CollectionState = 'unavailable'

        const retained = kubernetesTopologyAttentionPathIDs([cluster])
        ;[cluster, unknown, stale, unavailable].forEach(node => expect(retained.has(node.id)).to.equal(true))
    })

    it('returns no attention paths for an entirely healthy branch or an empty healthy resource', () => {
        const cluster = resource('cluster', 'cluster', { state: 'running' })
        const namespace = attach(cluster, resource('namespace', 'namespace', { status: { Phase: 'Active' } }))
        const workload = attach(namespace, healthyWorkload('workload'))
        attach(workload, resource('pod', 'pod', {
            status: { Phase: 'Running', Conditions: [{ Type: 'Ready', Status: 'True' }] }
        }))
        expect(Array.from(kubernetesTopologyAttentionPathIDs([cluster]))).to.deep.equal([])
    })

    it('does not retain a hidden relationship-only problem as a visual result', () => {
        const cluster = resource('cluster', 'cluster', { state: 'running' })
        const hidden = attach(cluster, resource('hidden', 'service'))
        hidden.data.CollectionState = 'unavailable'
        expect(Array.from(kubernetesTopologyAttentionPathIDs([cluster], node => node.id !== hidden.id))).to.deep.equal([])
    })
})
