import { expect } from 'chai'
import { statusSummaryEntries, statusSummaryCounts, statusSummaryResourceCounts, filterStatusSummary, infrastructureAttentionStatus, lastCollectionTime } from '../src/StatusSummary'
import { kubernetesResourceSelfStatus } from '../src/KubernetesTopologyBadgeAggregation'

const node = (id: string, data: any): any => ({ id, data: { Name: id, ...data }, tags: [], children: [], parent: null })
const link = (id: string, source: any, target: any): any => ({ id, source, target, data: {}, tags: [], state: {}, type: 'link' })
const infra = (item: any) => item.finalStatus || { kind: 'unknown', label: 'Unknown' }

describe('Status summary', () => {
    it('uses canonical Kubernetes results and keeps inactive separate from collection failure', () => {
        const resources = [
            node('healthy', { Manager: 'k8s', Type: 'cluster', State: 'Running' }),
            node('problem', { Manager: 'k8s', Type: 'node', State: 'Error' }),
            node('missing', { Manager: 'k8s', Type: 'node', CollectionState: 'unavailable' }),
            node('stale', { Manager: 'k8s', Type: 'node', CollectionState: 'stale' }),
            node('inactive', { Manager: 'k8s', Type: 'cluster', MoldClusterState: 'Stopped', CollectionState: 'unavailable' }),
            node('group', { Manager: 'k8s', Type: 'node', State: 'Error', IsTopologyGroup: true })
        ]
        const entries = statusSummaryEntries(resources, infra)
        expect(entries.map(entry => entry.node.id)).to.deep.equal(['problem', 'missing', 'stale', 'inactive'])
        expect(statusSummaryCounts(entries)).to.deep.equal({ all: 4, problem: 1, attention: 0, unavailable: 2, inactive: 1 })
        expect(entries[2].reason).to.equal(kubernetesResourceSelfStatus(resources[3]).findings.join(' · '))
    })

    it('does not invent infrastructure faults from missing state and preserves final stopped status', () => {
        const stopped = node('stopped', { Type: 'libvirt' })
        stopped.finalStatus = { kind: 'bad', label: 'Stopped' }
        const failed = node('failed', { Type: 'host' })
        failed.finalStatus = { kind: 'bad', label: 'Error' }
        const entries = statusSummaryEntries([node('missing', { Type: 'host' }), stopped, failed], infra)
        expect(statusSummaryCounts(entries)).to.deep.equal({ all: 2, problem: 1, attention: 0, unavailable: 0, inactive: 1 })
    })

    it('does not treat every DOWN NIC as a problem and uses path context when present', () => {
        const unused = node('unused-nic', { Type: 'device', State: 'DOWN' })
        const uplink = node('uplink-nic', { Type: 'device', State: 'DOWN' })
        const bond = node('bond0', { Type: 'bond', State: 'UP' })
        const entries = statusSummaryEntries([unused, uplink, bond], infra, [link('member', uplink, bond)])
        expect(entries.map(entry => [entry.node.id, entry.status])).to.deep.equal([['uplink-nic', 'attention']])
        expect(infrastructureAttentionStatus(unused, [], infra).status).to.equal(undefined)
    })

    it('separates admin-disabled, collection failure and explicit operational failure', () => {
        const disabled = node('disabled-nic', { Type: 'device', State: 'DOWN', AdminState: 'DOWN' })
        const uncollected = node('uncollected-host', { Type: 'host', CollectionState: 'failed' })
        const failed = node('failed-host', { Type: 'host', State: 'critical' })
        expect(statusSummaryEntries([disabled, uncollected, failed], infra).map(entry => entry.status))
            .to.deep.equal(['inactive', 'unavailable', 'problem'])
    })

    it('keeps a non-interface DOWN resource visible as confirmation-needed, not a problem', () => {
        const host = node('host-down', { Type: 'host', State: 'DOWN' })
        expect(statusSummaryEntries([host], infra).map(entry => entry.status)).to.deep.equal(['attention'])
    })

    it('uses attention for an unknown Kubernetes state when collection succeeded', () => {
        const uncertain = node('uncertain-node', { Manager: 'k8s', Type: 'node', CollectionState: 'collected' })
        expect(statusSummaryEntries([uncertain], infra).map(entry => entry.status)).to.deep.equal(['attention'])
    })

    it('uses the shared Kubernetes domain detection for normalized manager names', () => {
        const failed = node('normalized-manager', { Manager: 'Kubernetes', Type: 'node', State: 'Error' })
        expect(statusSummaryEntries([failed], infra).map(entry => entry.status)).to.deep.equal(['problem'])
    })

    it('omits historical pods and descendants suppressed by an inactive cluster', () => {
        const cluster = node('cluster', { Manager: 'k8s', Type: 'cluster', MoldClusterState: 'Stopped' })
        const child = node('child', { Manager: 'k8s', Type: 'node', State: 'Error' })
        child.parent = cluster
        const terminated = node('completed', { Manager: 'k8s', Type: 'pod', K8s: { Extra: { Status: { Phase: 'Succeeded' } } } })
        expect(statusSummaryEntries([cluster, child, terminated], infra).map(entry => entry.node.id)).to.deep.equal(['cluster'])
    })

    it('filters the same entries used by counts and searches display names without changing totals', () => {
        const entries = statusSummaryEntries([
            node('worker-a', { Manager: 'k8s', Type: 'node', State: 'Error' }),
            node('worker-b', { Manager: 'k8s', Type: 'node', CollectionState: 'unavailable' })
        ], infra)
        expect(filterStatusSummary(entries, 'problem', 'all', 'all', ' WORKER ', n => n.data.Name)).to.have.length(1)
        expect(filterStatusSummary(entries, 'all', 'all', 'all', 'missing', n => n.data.Name)).to.have.length(0)
        expect(statusSummaryCounts(entries).all).to.equal(2)
    })

    it('combines status, resource domain and the shared primary resource categories', () => {
        const entries: any[] = [
            { node: node('switch-a', { Type: 'switch' }), status: 'problem', reason: '' },
            { node: node('host-a', { Type: 'host' }), status: 'inactive', reason: '' },
            { node: node('vm-a', { Type: 'libvirt' }), status: 'problem', reason: '' },
            { node: node('cluster-a', { Manager: 'k8s', Type: 'cluster' }), status: 'inactive', reason: '' },
            { node: node('node-a', { Manager: 'k8s', Type: 'node' }), status: 'problem', reason: '' },
            { node: node('pod-a', { Manager: 'k8s', Type: 'pod' }), status: 'problem', reason: '' }
        ]
        expect(statusSummaryResourceCounts(entries)).to.deep.equal({
            all: 6, infrastructure: 3, kubernetes: 3,
            switch: 1, host: 1, vm: 1, cluster: 1, node: 1, pod: 1
        })
        expect(filterStatusSummary(entries, 'problem', 'infrastructure', 'vm', '', n => n.data.Name).map(entry => entry.node.id)).to.deep.equal(['vm-a'])
        expect(filterStatusSummary(entries, 'inactive', 'kubernetes', 'cluster', '', n => n.data.Name).map(entry => entry.node.id)).to.deep.equal(['cluster-a'])
        expect(filterStatusSummary(entries, 'problem', 'kubernetes', 'all', 'node', n => n.data.Name).map(entry => entry.node.id)).to.deep.equal(['node-a'])
    })

    it('does not present graph modification time as a collection timestamp', () => {
        expect(lastCollectionTime(node('a', { UpdatedAt: Date.now() }))).to.equal('확인 불가')
        expect(lastCollectionTime(node('a', { LastSeen: 'invalid' }))).to.equal('확인 불가')
        expect(lastCollectionTime(node('a', { LastCollectedAt: '2026-09-09T05:32:11Z' }))).not.to.equal('확인 불가')
    })
})
