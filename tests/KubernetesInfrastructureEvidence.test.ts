import { expect } from 'chai'
import {
    filterKubernetesInfrastructureEvidenceIDs,
    isKubernetesInfrastructureEvidenceData,
    isKubernetesTopologyData,
    isTopologyNodeVisibleInLayer
} from '../src/KubernetesInfrastructureEvidence'

describe('Kubernetes infrastructure evidence allowlist', () => {
    it('allows only cluster/node and infrastructure path resources', () => {
        expect(isKubernetesInfrastructureEvidenceData({ Manager: 'k8s', Type: 'cluster' })).to.equal(true)
        expect(isKubernetesInfrastructureEvidenceData({ Manager: 'k8s', Type: 'node' })).to.equal(true)
        expect(isKubernetesInfrastructureEvidenceData({ Manager: 'k8s', Type: 'pod' })).to.equal(false)
        expect(isKubernetesInfrastructureEvidenceData({ Manager: 'k8s', Type: 'namespace' })).to.equal(false)
        expect(isKubernetesInfrastructureEvidenceData({ Manager: 'k8s', Type: 'deployment' })).to.equal(false)
        expect(isKubernetesInfrastructureEvidenceData({ Manager: 'k8s', Type: 'statefulset' })).to.equal(false)
        expect(isKubernetesInfrastructureEvidenceData({ Manager: 'k8s', Type: 'daemonset' })).to.equal(false)
        expect(isKubernetesInfrastructureEvidenceData({ Manager: 'host', Type: 'host' })).to.equal(true)
        expect(isKubernetesInfrastructureEvidenceData({ Manager: 'netlink', Type: 'interface' })).to.equal(true)
        expect(isKubernetesInfrastructureEvidenceData({ Manager: 'netlink', Type: 'switchport' })).to.equal(true)
        expect(isKubernetesInfrastructureEvidenceData({ Manager: 'snmp', Type: 'switch' })).to.equal(true)
    })

    it('removes disallowed execution resources and duplicate IDs', () => {
        const dataByID: Record<string, any> = {
            cluster: { Manager: 'k8s', Type: 'cluster' },
            node: { Manager: 'k8s', Type: 'node' },
            pod: { Manager: 'k8s', Type: 'pod' },
            workload: { Manager: 'k8s', Type: 'deployment' },
            namespace: { Manager: 'k8s', Type: 'namespace' },
            host: { Manager: 'host', Type: 'host' },
            port: { Manager: 'netlink', Type: 'switchport' },
            switch: { Manager: 'snmp', Type: 'switch' }
        }
        expect(filterKubernetesInfrastructureEvidenceIDs(
            ['cluster', 'node', 'pod', 'workload', 'namespace', 'host', 'port', 'switch', 'host'],
            id => dataByID[id]
        )).to.deep.equal(['cluster', 'node', 'host', 'port', 'switch'])
    })

    it('keeps Kubernetes execution resources out of the infrastructure layer', () => {
        const pod = { Manager: 'k8s', Type: 'pod' }
        const legacyPod = { Type: 'pod', K8s: { Namespace: 'monitoring' } }
        const incompletePod = { Type: 'pod' }
        const host = { Manager: 'netlink', Type: 'host' }

        expect(isTopologyNodeVisibleInLayer(pod, ['kubernetes'], false)).to.equal(false)
        expect(isTopologyNodeVisibleInLayer(legacyPod, [], false)).to.equal(false)
        expect(isTopologyNodeVisibleInLayer(incompletePod, ['인프라스트럭처'], false)).to.equal(false)
        expect(isTopologyNodeVisibleInLayer(host, ['인프라스트럭처'], false)).to.equal(true)
        expect(isTopologyNodeVisibleInLayer(pod, ['kubernetes'], true)).to.equal(true)
    })

    it('normalizes Kubernetes manager names and missing manager metadata', () => {
        expect(isKubernetesTopologyData({ Manager: 'Kubernetes', Type: 'pod' })).to.equal(true)
        expect(isKubernetesTopologyData({ Type: 'deployment' })).to.equal(true)
        expect(isKubernetesTopologyData({ Type: 'interface' })).to.equal(false)
    })
})
