/*
 * Kubernetes 위험/복원력 근거를 인프라스트럭처 레이어에서 강조할 때
 * 허용하는 리소스 범위입니다. 이 모듈은 화면 컴포넌트와 분리되어
 * Pod/Workload/Namespace가 인프라 계층에 섞이는 회귀를 방지합니다.
 */

const KUBERNETES_INFRASTRUCTURE_TYPES = new Set([
    'cluster',
    'node'
])

const INFRASTRUCTURE_EVIDENCE_TYPES = new Set([
    'host',
    'device',
    'interface',
    'nic',
    'bridge',
    'ovsbridge',
    'openvswitch',
    'switch',
    'switchport',
    'port',
    'ovsport',
    'network',
    'networkpath',
    'fabric'
])

export const isKubernetesInfrastructureEvidenceData = (data?: any): boolean => {
    if (!data) return false

    const manager = String(data.Manager || data.manager || '').toLowerCase()
    const type = String(data.Type || data.type || '').toLowerCase()

    if (manager === 'k8s' || manager === 'kubernetes') {
        return KUBERNETES_INFRASTRUCTURE_TYPES.has(type)
    }

    return INFRASTRUCTURE_EVIDENCE_TYPES.has(type)
}

export const filterKubernetesInfrastructureEvidenceIDs = (
    nodeIDs: string[],
    nodeDataForID: (id: string) => any
): string[] => {
    return Array.from(new Set(nodeIDs)).filter(id =>
        isKubernetesInfrastructureEvidenceData(nodeDataForID(id)))
}
