import { expect } from 'chai'
import {
    filterKubernetesInfrastructureEvidenceIDs,
    isKubernetesInfrastructureEvidenceData
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
})
