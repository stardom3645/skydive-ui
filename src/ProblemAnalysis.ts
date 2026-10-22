import type { Node } from './Topology'
import type { CurrentProblem } from './CurrentProblems'
import { kubernetesPodCurrentStatusSnapshot, kubernetesPodLifecycle, kubernetesPodReady } from './KubernetesPodLifecycle'
import { currentKubernetesPodsForController, kubernetesControllerPodObservation, kubernetesReplicaSetsForDeployment, KUBERNETES_CONTROLLER_TYPES, resolveKubernetesPodController } from './KubernetesWorkloadOwnership'
import { isKubernetesTopologyData } from './KubernetesInfrastructureEvidence'

export type ProblemCategory = 'availability' | 'workload' | 'network' | 'storage' | 'collection'
export const problemCategoryLabels: Record<ProblemCategory, string> = {
    availability: '가용성·상태', workload: '워크로드·파드', network: '네트워크 연결', storage: '스토리지', collection: '수집 상태'
}
export const problemCategory = (entry: CurrentProblem): ProblemCategory => {
    if (entry.status === 'unavailable') return 'collection'
    if (['pod', 'container', 'deployment', 'statefulset', 'daemonset', 'replicaset', 'job', 'cronjob'].includes(entry.type)) return 'workload'
    if (['persistentvolume', 'persistentvolumeclaim', 'storageclass'].includes(entry.type)) return 'storage'
    if (['switch', 'switchport', 'device', 'nic', 'interface', 'port', 'bond', 'bridge', 'ovsbridge', 'veth', 'tun', 'tuntap'].includes(entry.type)) return 'network'
    return 'availability'
}

// Follow the event recorder's stable IDs. Never match by display name: NIC and
// Pod names can be identical on different hosts/clusters or after recreation.
export const problemEventIdentity = (node: Node): { resourceId: string; resourceType: string; source: string } | undefined => {
    const type = String(node.data?.Type || '').toLowerCase()
    if (node.data?.Manager === 'k8s') {
        if (!['node', 'pod'].includes(type)) return undefined
        return { resourceId: String(node.data?.K8s?.UID || node.id), resourceType: type === 'node' ? 'k8s_node' : 'pod', source: 'kubernetes' }
    }
    const resourceType = ({ host: 'host', libvirt: 'vm', device: 'nic', bond: 'bond', bridge: 'bridge' } as Record<string, string>)[type]
    const resourceId = type === 'libvirt' ? node.data?.UUID : node.data?.TID
    return resourceType && resourceId ? { resourceId: String(resourceId), resourceType, source: 'infrastructure' } : undefined
}

const raw = (value: any, paths: string[]): any => {
    for (const path of paths) {
        const result = path.split('.').reduce((data, key) => data?.[key], value)
        if (result !== undefined && result !== null && result !== '') return result
    }
    return undefined
}
export interface ProblemFact { label: string; value: string }
/** Present collected evidence only. Zero/false are meaningful values. Object
 * creation, graph updates and container start times are not incident start. */
export const problemEvidence = (node: Node, nodes?: Node[]): ProblemFact[] => {
    const facts: ProblemFact[] = []
    const add = (label: string, value: any) => {
        if (['string', 'number', 'boolean'].includes(typeof value) && String(value).trim() !== '') facts.push({ label, value: String(value) })
    }
    const data = node.data || {}, type = String(data.Type || '').toLowerCase()
    const kubernetes = isKubernetesTopologyData(data, node.tags || [])
    add(kubernetes ? '토폴로지 상태' : '원본 상태', raw(data, ['State', 'Status', 'OperState', 'OperationalState']))
    add('수집 상태', raw(data, ['CollectionState', 'CollectionStatus', 'DataCollectionState', 'collectionState', 'collectionStatus', 'K8s.CollectionStatus']))
    if (kubernetes) {
        const status = raw(data, ['K8s.Extra.Status', 'K8s.Extra.status', 'K8s.Status', 'Status']) || {}
        const spec = raw(data, ['K8s.Extra.Spec', 'K8s.Extra.spec', 'K8s.Spec', 'Spec']) || {}
        if (type === 'pod') {
            const snapshot = kubernetesPodCurrentStatusSnapshot(node)
            add('파드 Phase', snapshot?.phase || raw(status, ['Phase', 'phase']) || kubernetesPodLifecycle(node).phase)
            add('배치 노드', snapshot?.nodeName || raw(spec, ['NodeName', 'nodeName']))
            add('Pod Ready', snapshot?.ready ?? kubernetesPodReady(data))
            const containers = raw(status, ['ContainerStatuses', 'containerStatuses'])
            if (Array.isArray(containers)) containers.forEach(container => {
                const name = `${snapshot ? '토폴로지 관측 · ' : ''}${raw(container, ['Name', 'name']) || '컨테이너'}`
                add(`${name} · Ready`, raw(container, ['Ready', 'ready']))
                add(`${name} · 재시작`, raw(container, ['RestartCount', 'restartCount']))
                add(`${name} · 사유`, raw(container, ['State.Waiting.Reason', 'state.waiting.reason', 'State.Terminated.Reason', 'state.terminated.reason']))
                add(`${name} · 메시지`, raw(container, ['State.Waiting.Message', 'state.waiting.message', 'State.Terminated.Message', 'state.terminated.message']))
            })
        } else {
            add('Phase', raw(status, ['Phase', 'phase']))
            ;[['희망 Replica', spec, ['Replicas', 'replicas']], ['현재 Replica', status, ['Replicas', 'replicas']],
                ['Ready Replica', status, ['ReadyReplicas', 'readyReplicas']], ['가용 Replica', status, ['AvailableReplicas', 'availableReplicas']],
                ['갱신 Replica', status, ['UpdatedReplicas', 'updatedReplicas']],
                ['배치 대상 노드', status, ['DesiredNumberScheduled', 'desiredNumberScheduled']],
                ['Ready 노드', status, ['NumberReady', 'numberReady']], ['가용 노드', status, ['NumberAvailable', 'numberAvailable']],
                ['성공 Job', status, ['Succeeded', 'succeeded']], ['실패 Job', status, ['Failed', 'failed']]
            ].forEach(([label, source, paths]) => add(label as string, raw(source, paths as string[])))
        }
        const conditions = raw(status, ['Conditions', 'conditions'])
        if (Array.isArray(conditions)) conditions.forEach(condition => {
            const type = raw(condition, ['Type', 'type'])
            if (!type) return
            if (String(data.Type).toLowerCase() === 'node') add(`${type} Condition`, raw(condition, ['Status', 'status']))
            const values = [raw(condition, ['Status', 'status']), raw(condition, ['Reason', 'reason']), raw(condition, ['Message', 'message'])]
                .filter(value => value !== undefined && value !== null && value !== '')
            if (values.length) add(`Condition · ${type}`, values.map(String).join('\n'))
        })
        if (nodes && KUBERNETES_CONTROLLER_TYPES.has(type)) {
            const observation = kubernetesControllerPodObservation(node, nodes)
            add('소유 관계로 확인된 현재 Pod', type === 'deployment' && !observation.complete
                ? `관계 미확인 · 확인된 ${observation.matched}개` : observation.matched)
        }
    } else {
        add('관리 상태', raw(data, ['AdminState', 'AdministrativeState', 'AdminStatus']))
        add('MAC', data.MAC)
        add('연결 Bridge·Bond', raw(data, ['MasterName', 'Master', 'BridgeName', 'BondName']))
        add('IPv4', raw(data, ['IPV4', 'IP', 'ManagementIP']))
    }
    // Core numeric evidence first. Conditions and original messages remain
    // available separately without dominating the initial diagnosis view.
    return facts.sort((a, b) => Number(!/Replica|노드|현재 Pod|Ready|Phase/.test(a.label)) - Number(!/Replica|노드|현재 Pod|Ready|Phase/.test(b.label)))
}

export const problemPodCoverageNote = (node: Node, nodes: Node[]): string | undefined => {
    if (String(node.data?.Type).toLowerCase() !== 'deployment') return undefined
    const observation = kubernetesControllerPodObservation(node, nodes)
    const matched = observation.matched
    const replicas = raw(node.data, ['K8s.Extra.Status.Replicas', 'K8s.Extra.status.replicas', 'K8s.Replicas'])
    if (matched === 0 && !kubernetesReplicaSetsForDeployment(node, nodes).length) {
        return 'Replica 값은 Deployment API 상태입니다. 수집 그래프에 ReplicaSet 객체가 없어 확인된 Pod는 0개이며, 실제 Pod가 없다는 뜻이 아닙니다.'
    }
    if (replicas !== undefined && Number(replicas) !== matched) {
        return `Deployment API의 Current Replica ${replicas}개와 소유 관계로 확인된 현재 Pod ${matched}개가 다릅니다. 수집 범위·갱신 시점·종료 중인 Pod를 확인하세요. 이 차이만으로 추가 장애를 판정하지 않습니다.`
    }
    return undefined
}

export const problemChecklist = (entry: CurrentProblem): string[] => {
    if (entry.type === 'daemonset' && entry.status !== 'unavailable') return ['배치 대상·Ready·가용 노드 수를 비교하세요.', '소유 파드의 현재 상태와 배치 노드의 Ready·Pressure Condition을 함께 확인하세요.']
    if (entry.type === 'node' && entry.domain === 'kubernetes' && entry.status !== 'unavailable') return ['Ready·Pressure Condition의 사유와 메시지를 먼저 확인하세요.', '연결된 파드와 수집 상태를 함께 확인하고, Kubelet 보고 중단과 실제 호스트 장애를 구분하세요.']
    switch (problemCategory(entry)) {
        case 'collection': return ['서버 연결과 마지막 수집 시각을 먼저 확인하세요.', '객체 상세에서 수집 실패·인증·권한 상태를 확인한 뒤 실제 자원 장애와 구분하세요.']
        case 'network': return ['연결된 NIC·Bridge·Bond와 반대편 자원의 상태를 함께 확인하세요.', '수동 포트의 상태와 트래픽은 호스트 NIC 기준이며 실제 스위치 포트 상태를 확정하지 않습니다.']
        case 'storage': return ['PVC·PV의 Phase, Condition과 바인딩 대상을 확인하세요.', '연결된 워크로드·파드에서 볼륨 연결 또는 마운트 실패가 있는지 확인하세요.']
        case 'workload': return ['Ready·희망 Replica 또는 컨테이너의 현재 대기 사유를 확인하세요.', '객체 상세에서 Kubernetes 이벤트·로그와 배치 노드 상태를 함께 확인하세요.']
        default: return ['자체 상태와 수집 상태를 구분해서 확인하세요.', '연결된 VM·파드와 상위 자원을 함께 확인해 원인과 영향 범위를 좁히세요.']
    }
}

export const problemScopeGroups = (entries: CurrentProblem[]) => {
    const groups = new Map<string, { key: string; scope: string; domain: string; entries: CurrentProblem[] }>()
    entries.forEach(entry => {
        const key = JSON.stringify([entry.domain, entry.scope])
        let group = groups.get(key)
        if (!group) { group = { key, scope: entry.scope, domain: entry.domain, entries: [] }; groups.set(key, group) }
        group.entries.push(entry)
    })
    return Array.from(groups.values()).sort((a, b) => b.entries.length - a.entries.length || a.scope.localeCompare(b.scope, 'ko'))
}

/** Supplement graph edges with the same UID/OwnerReference resolver used by
 * workload details. Ownership is a relationship, not proof of outage impact. */
export const problemRelatedResources = (entry: Pick<CurrentProblem, 'id' | 'node' | 'related' | 'domain' | 'type'>, nodes: Node[]) => {
    const resources = new Map<string, { node: Node; relation: string }>()
    const add = (node: Node, relation: string) => {
        if (node.id !== entry.id) resources.set(node.id, { node, relation })
    }
    const currentNodes = new Map(nodes.map(node => [node.id, node]))
    entry.related.forEach(node => {
        const current = currentNodes.get(node.id)
        if (current) add(current, node.id === entry.node.parent?.id ? '상위 자원'
            : entry.node.children?.some(child => child.id === node.id) ? '직계 하위 자원' : '연결 자원')
    })
    if (entry.domain === 'kubernetes') {
        if (entry.type === 'deployment') kubernetesReplicaSetsForDeployment(entry.node, nodes).forEach(node => add(node, '소유 ReplicaSet'))
        if (KUBERNETES_CONTROLLER_TYPES.has(entry.type)) {
            currentKubernetesPodsForController(entry.node, nodes).forEach(node => add(node, '소유 파드'))
        }
        if (entry.type === 'pod') {
            const controller = resolveKubernetesPodController(entry.node, nodes)
            if (controller) add(controller, '소유 컨트롤러')
            const ownerRefs = raw(entry.node.data, ['K8s.Extra.ObjectMeta.OwnerReferences', 'K8s.Extra.metadata.ownerReferences', 'K8s.OwnerReferences'])
            const cluster = raw(entry.node.data, ['ClusterName', 'K8s.ClusterName'])
            const namespace = raw(entry.node.data, ['K8s.Namespace', 'K8s.Extra.ObjectMeta.Namespace', 'K8s.Extra.metadata.namespace'])
            const nodeName = raw(entry.node.data, ['K8s.Extra.Spec.NodeName', 'K8s.Extra.spec.nodeName'])
            if (cluster) nodes.forEach(candidate => {
                if (String(candidate.data?.Manager).toLowerCase() !== 'k8s' || raw(candidate.data, ['ClusterName', 'K8s.ClusterName']) !== cluster) return
                const uid = raw(candidate.data, ['K8s.UID', 'K8s.Extra.ObjectMeta.UID', 'K8s.Extra.metadata.uid']) || candidate.id
                if (String(candidate.data.Type).toLowerCase() === 'replicaset'
                    && raw(candidate.data, ['K8s.Namespace', 'K8s.Extra.ObjectMeta.Namespace', 'K8s.Extra.metadata.namespace']) === namespace
                    && Array.isArray(ownerRefs) && ownerRefs.some(owner => String(owner.Kind || owner.kind).toLowerCase() === 'replicaset' && (owner.UID || owner.uid) === uid)) add(candidate, '직접 소유 ReplicaSet')
                if (String(candidate.data.Type).toLowerCase() === 'node' && nodeName
                    && raw(candidate.data, ['Name', 'K8s.Name']) === nodeName) add(candidate, '배치 노드')
            })
        }
    }
    return Array.from(resources.values())
}
