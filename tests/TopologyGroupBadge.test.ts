import { strict as assert } from 'assert'
import { kubernetesClusterGroupObjectCount } from '../src/TopologyGroupBadge'

describe('TopologyGroupBadge', () => {
    it('counts cluster objects instead of their aggregated Kubernetes Nodes', () => {
        const groupObjects = [
            { id: 'foms', data: { Type: 'cluster' } },
            { id: 'hwryu-k8s-test-01', data: { Type: 'cluster' } },
            { id: 'hwryu-k8s-test-02', data: { Type: 'cluster' } },
            { id: 'hwryu-k8s-test-03', data: { Type: 'cluster' } }
        ]
        assert.equal(kubernetesClusterGroupObjectCount(groupObjects), 4)
    })

    it('ignores nested topology groups and non-cluster resources', () => {
        assert.equal(kubernetesClusterGroupObjectCount([
            { id: 'cluster-a', data: { Type: 'cluster' } },
            { id: 'nested-group', data: { Type: 'cluster', IsTopologyGroup: true } },
            { id: 'node-a', data: { Type: 'node' } }
        ]), 1)
    })

    it('deduplicates repeated representations of the same group object', () => {
        assert.equal(kubernetesClusterGroupObjectCount([
            { id: 'cluster-a', data: { Type: 'cluster' } },
            { id: 'cluster-a', data: { Type: 'cluster' } }
        ]), 1)
    })
})
