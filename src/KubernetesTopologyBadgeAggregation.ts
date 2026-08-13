import type { Node } from './Topology'
import { getPodClassification, isCurrentKubernetesPod } from './KubernetesPodLifecycle'
import type { TopologyStatusBadgeTooltip } from './TopologyStatusBadge'

export type KubernetesTopologyCountBadgeTone = 'problem' | 'warning' | 'running' | 'inactive'
export type KubernetesResourceSelfState = 'healthy' | 'problem' | 'unknown' | 'inactive'
export type KubernetesResourceCollectionState = 'collected' | 'unavailable' | 'stale'

export interface KubernetesResourceSelfStatus {
    state: KubernetesResourceSelfState
    collection: KubernetesResourceCollectionState
    findings: string[]
}

export interface KubernetesTopologyCountBadge {
    key: 'self-problem' | 'self-inactive' | 'direct-self-problem' | 'direct-descendant-problem' | 'direct-healthy' | 'direct-inactive'
    label: string
    count: number
    displayText?: string
    tone: KubernetesTopologyCountBadgeTone
    tooltip: TopologyStatusBadgeTooltip
}

export interface KubernetesTopologyBadgeGroupSummary {
    title: string
    totalLabel: string
    states: Array<{
        key: 'direct-self-problem' | 'direct-descendant-problem' | 'direct-healthy' | 'direct-inactive'
        tone: KubernetesTopologyCountBadgeTone
        label: '자체 이상' | '하위 자원 이상' | '정상' | '비활성'
        count: number
    }>
}

export interface KubernetesTopologyDirectChildSummary {
    children: Node[]
    total: number
    selfProblematic: Node[]
    attentionRequired: Node[]
    descendantProblematic: Node[]
    healthy: Node[]
    inactive: Node[]
    selfProblematicTypeCounts: Array<{ type: string, label: string, count: number }>
    descendantProblematicTypeCounts: Array<{ type: string, label: string, count: number }>
}

const valueAtPath = (source: any, path: string): any =>
    path.split('.').reduce((value, key) => value === undefined || value === null ? undefined : value[key], source)

const firstRaw = (source: any, paths: string[]): any => {
    for (const path of paths) {
        const value = valueAtPath(source, path)
        if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return undefined
}

const firstRawFrom = (sources: any[], paths: string[]): any => {
    for (const source of sources) {
        const value = firstRaw(source, paths)
        if (value !== undefined) return value
    }
    return undefined
}

const firstScalarFrom = (sources: any[], paths: string[]): any => {
    for (const source of sources) {
        for (const path of paths) {
            const value = valueAtPath(source, path)
            if (['string', 'number', 'boolean'].includes(typeof value) && String(value).trim() !== '') return value
        }
    }
    return undefined
}

const normalized = (value: any): string => String(value || '').trim().toLowerCase()
const inactiveClusterStates = new Set(['stopped', 'stop', 'disabled', 'inactive', 'suspended', '정지', '정지됨', '비활성'])
export const isInactiveMoldKubernetesClusterState = (value: any): boolean =>
    inactiveClusterStates.has(normalized(value))
const resourceType = (node: Node): string => normalized(node.data?.Type)
const isKubernetesResource = (node: Node): boolean => normalized(node.data?.Manager) === 'k8s'
const isTopologyGroup = (node: Node): boolean => !!node.data?.IsTopologyGroup
const resourceUID = (node: Node): string => String(firstRaw(node.data || {}, [
    'K8s.Extra.ObjectMeta.UID',
    'K8s.Extra.Metadata.UID',
    'K8s.Extra.metadata.uid',
    'K8s.UID',
    'UID'
]) || node.id)

const resourceTypeLabel = (type: string): string => ({
    cluster: 'Cluster',
    node: 'Node',
    namespace: 'Namespace',
    deployment: 'Deployment',
    statefulset: 'StatefulSet',
    daemonset: 'DaemonSet',
    job: 'Job',
    cronjob: 'CronJob',
    pod: 'Pod',
    service: 'Service',
    storageclass: 'StorageClass',
    persistentvolumeclaim: 'PVC',
    persistentvolume: 'PV'
}[type] || type || 'Kubernetes 객체')

const resourceTypeProblemLabel = (type: string): string => ({
    cluster: '클러스터',
    node: '노드',
    namespace: '네임스페이스',
    deployment: 'Deployment',
    statefulset: 'StatefulSet',
    daemonset: 'DaemonSet',
    job: 'Job',
    cronjob: 'CronJob',
    pod: '파드',
    service: '서비스',
    storageclass: 'StorageClass',
    persistentvolumeclaim: 'PVC',
    persistentvolume: 'PV'
}[type] || resourceTypeLabel(type))

const resourceTypeGroupLabel = (type: string): string => ({
    cluster: '클러스터',
    node: '노드',
    namespace: '네임스페이스',
    deployment: '워크로드',
    statefulset: '워크로드',
    daemonset: '워크로드',
    job: '워크로드',
    cronjob: '워크로드',
    pod: '파드',
    service: '서비스',
    storageclass: '스토리지 클래스',
    persistentvolumeclaim: 'PVC',
    persistentvolume: 'PV'
}[type] || '자원')

const conditions = (status: any): any[] => {
    const value = status?.Conditions ?? status?.conditions
    return Array.isArray(value) ? value : []
}

const numberValue = (...values: any[]): number => {
    const value = values.find(candidate => candidate !== undefined && candidate !== null && candidate !== '')
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

const workloadProblemFindings = (node: Node, type: string, observation?: any): string[] => {
    const data = node.data || {}
    const sources = observation ? [observation, data] : [data]
    const spec = firstRawFrom(sources, ['spec', 'Spec', 'K8s.Extra.Spec', 'K8s.Spec']) || {}
    const status = firstRawFrom(sources, ['status', 'Status', 'K8s.Extra.Status', 'K8s.Status']) || {}
    const desired = type === 'daemonset'
        ? numberValue(status.DesiredNumberScheduled, status.desiredNumberScheduled)
        : type === 'job'
            ? numberValue(spec.Completions, spec.completions, 1)
            : numberValue(spec.Replicas, spec.replicas, status.DesiredReplicas, status.desiredReplicas)
    const ready = type === 'deployment'
        ? numberValue(status.AvailableReplicas, status.availableReplicas, status.ReadyReplicas, status.readyReplicas)
        : type === 'daemonset'
            ? numberValue(status.NumberAvailable, status.numberAvailable, status.NumberReady, status.numberReady)
            : type === 'job'
                ? numberValue(status.Succeeded, status.succeeded)
                : numberValue(status.ReadyReplicas, status.readyReplicas, status.AvailableReplicas, status.availableReplicas, status.Active, status.active)
    const updated = numberValue(status.UpdatedReplicas, status.updatedReplicas, status.UpdatedNumberScheduled, status.updatedNumberScheduled, ready)
    const unavailable = numberValue(status.UnavailableReplicas, status.unavailableReplicas, status.NumberUnavailable, status.numberUnavailable)
    const misscheduled = numberValue(status.NumberMisscheduled, status.numberMisscheduled)
    const failed = numberValue(status.Failed, status.failed)
    const findings = new Set<string>()
    conditions(status).forEach(condition => {
        const state = normalized(condition?.Status ?? condition?.status)
        const conditionType = normalized(condition?.Type ?? condition?.type)
        const reason = normalized(condition?.Reason ?? condition?.reason)
        if (state === 'true' && (/fail|error|deadlineexceeded/.test(conditionType) || /fail|error|deadlineexceeded/.test(reason))) {
            findings.add('상태 조건 실패')
        }
    })
    if (desired > 0 && ready === 0) findings.add('가용 대상 없음')
    else if (desired > 0 && ready < desired) findings.add('준비·가용 수 부족')
    if (desired > 0 && updated < desired) findings.add('업데이트 수 부족')
    if (unavailable > 0) findings.add('미가용 대상 존재')
    if (misscheduled > 0) findings.add('비대상 배치 존재')
    if (failed > 0) findings.add('실패 대상 존재')
    return Array.from(findings)
}

const explicitCollectionState = (node: Node, observation?: any): KubernetesResourceCollectionState | undefined => {
    const sources = observation ? [observation, node.data || {}] : [node.data || {}]
    const stale = firstRawFrom(sources, ['stale', 'Stale', 'isStale', 'IsStale'])
    if (stale === true || normalized(stale) === 'true') return 'stale'
    const marker = normalized(firstRawFrom(sources, [
        'collectionState', 'CollectionState', 'dataCollectionState', 'DataCollectionState',
        'collectionStatus', 'CollectionStatus'
    ]))
    if (/stale|expired/.test(marker)) return 'stale'
    if (/uncollected|unavailable|failed|failure|error|missing|not.?collected/.test(marker)) return 'unavailable'
    if (/collected|available|success|fresh/.test(marker)) return 'collected'
    return undefined
}

/** Canonical self-state assessment shared by topology cards and detail panels.
 * A newer detail/API observation may be supplied, while explicit stale or
 * unavailable markers are never promoted to healthy. */
export const kubernetesResourceSelfStatus = (node: Node, observation?: any): KubernetesResourceSelfStatus => {
    if (!isKubernetesResource(node) || isTopologyGroup(node)) {
        return { state: 'healthy', collection: 'collected', findings: [] }
    }
    const sources = observation ? [observation, node.data || {}] : [node.data || {}]
    const type = resourceType(node)
    const moldClusterState = normalized(firstScalarFrom(sources, [
        'moldClusterState', 'MoldClusterState', 'moldState', 'MoldState'
    ]))
    const topologySelfState = normalized(firstScalarFrom(sources, [
        'selfState', 'SelfState', 'state', 'State', 'status', 'Status', 'K8s.State', 'K8s.Status'
    ]))
    const effectiveClusterLifecycle = moldClusterState || topologySelfState
    if (type === 'cluster' && isInactiveMoldKubernetesClusterState(effectiveClusterLifecycle)) {
        return { state: 'inactive', collection: 'collected', findings: [] }
    }
    const explicitCollection = explicitCollectionState(node, observation)
    if (explicitCollection === 'stale') {
        return { state: 'unknown', collection: 'stale', findings: ['상태 데이터가 오래되어 확인이 필요합니다.'] }
    }
    if (explicitCollection === 'unavailable') {
        return { state: 'unknown', collection: 'unavailable', findings: ['상태 데이터를 수집하지 못했습니다.'] }
    }
    const explicitSelfStates = [moldClusterState, topologySelfState].filter(Boolean)
    if (explicitSelfStates.some(state => /down|error|fail|unhealthy|critical/.test(state))) {
        return { state: 'problem', collection: 'collected', findings: [`${resourceTypeLabel(type)} 자체 상태 이상`] }
    }
    if (explicitSelfStates.some(state => /stale|expired/.test(state))) {
        return { state: 'unknown', collection: 'stale', findings: [`${resourceTypeLabel(type)} 상태 데이터가 오래되었습니다.`] }
    }
    if (explicitSelfStates.some(state => /unknown|unavailable|uncollected|not.?collected/.test(state))) {
        const unavailable = explicitSelfStates.some(state => /unavailable|uncollected|not.?collected/.test(state))
        return {
            state: 'unknown',
            collection: unavailable ? 'unavailable' : 'collected',
            findings: [`${resourceTypeLabel(type)} 상태를 확인할 수 없습니다.`]
        }
    }
    if (type === 'pod') {
        const classification = getPodClassification(node)
        if (!classification.phase && classification.problemReasons.length === 0) {
            return { state: 'unknown', collection: explicitCollection || 'unavailable', findings: ['파드 상태를 확인할 수 없습니다.'] }
        }
        const findings = classification.problemPod
            ? (classification.problemReasons.length ? classification.problemReasons : ['현재 파드 이상'])
            : []
        return { state: findings.length ? 'problem' : 'healthy', collection: 'collected', findings }
    }
    if (['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(type)) {
        const rawStatus = firstRawFrom(sources, ['status', 'Status', 'K8s.Extra.Status', 'K8s.Status'])
        const rawSpec = firstRawFrom(sources, ['spec', 'Spec', 'K8s.Extra.Spec', 'K8s.Spec'])
        const hasStatusEvidence = rawStatus !== undefined && rawStatus !== null
            && (typeof rawStatus !== 'object' || Object.keys(rawStatus).length > 0)
        const hasSpecEvidence = rawSpec !== undefined && rawSpec !== null
            && (typeof rawSpec !== 'object' || Object.keys(rawSpec).length > 0)
        if (!hasStatusEvidence && !(type === 'cronjob' && hasSpecEvidence)) {
            return { state: 'unknown', collection: explicitCollection || 'unavailable', findings: ['워크로드 상태를 확인할 수 없습니다.'] }
        }
        const findings = workloadProblemFindings(node, type, observation)
        return { state: findings.length ? 'problem' : 'healthy', collection: 'collected', findings }
    }
    if (type === 'node') {
        const status = firstRawFrom(sources, ['status', 'Status', 'K8s.Extra.Status', 'K8s.Status']) || {}
        const nodeConditions = Array.isArray(observation?.conditions) ? observation.conditions : conditions(status)
        const rawReady = normalized(firstRawFrom(sources, ['ready', 'Ready', 'State']))
        if (nodeConditions.length === 0 && !rawReady) {
            return { state: 'unknown', collection: explicitCollection || 'unavailable', findings: ['노드 상태를 확인할 수 없습니다.'] }
        }
        const findings = nodeConditions.reduce((items: string[], condition: any) => {
            const conditionType = normalized(condition?.Type ?? condition?.type)
            const state = normalized(condition?.Status ?? condition?.status)
            if (conditionType === 'ready' && state !== 'true') items.push('NotReady')
            if (['memorypressure', 'diskpressure', 'pidpressure', 'networkunavailable'].includes(conditionType) && state === 'true') {
                items.push(String(condition?.Type ?? condition?.type))
            }
            return items
        }, [])
        if (nodeConditions.length === 0 && /false|notready|down|failed|error/.test(rawReady)) findings.push('NotReady')
        return { state: findings.length ? 'problem' : 'healthy', collection: 'collected', findings }
    }
    if (type === 'namespace') {
        const phase = normalized(firstRawFrom(sources, ['phase', 'Phase', 'status.phase', 'Status.Phase', 'K8s.Extra.Status.Phase', 'K8s.Status']))
        if (!phase) return { state: 'unknown', collection: explicitCollection || 'unavailable', findings: ['네임스페이스 상태를 확인할 수 없습니다.'] }
        const findings = phase !== 'active' ? [`Namespace ${phase}`] : []
        return { state: findings.length ? 'problem' : 'healthy', collection: 'collected', findings }
    }
    if (type === 'persistentvolumeclaim' || type === 'persistentvolume') {
        const phase = normalized(firstRawFrom(sources, ['phase', 'Phase', 'status.phase', 'Status.Phase', 'K8s.Extra.Status.Phase', 'K8s.Status']))
        if (!phase) return { state: 'unknown', collection: explicitCollection || 'unavailable', findings: [`${resourceTypeLabel(type)} 상태를 확인할 수 없습니다.`] }
        const findings = ['lost', 'failed', 'pending', 'released'].includes(phase) ? [`${resourceTypeLabel(type)} ${phase}`] : []
        return { state: findings.length ? 'problem' : 'healthy', collection: 'collected', findings }
    }
    if (type === 'cluster') {
        // A Kubernetes Cluster is a topology scope, not an API object with a
        // native phase/condition. Missing `State` alone therefore cannot be
        // treated as an unavailable self status or a red self-error Badge.
        return { state: 'healthy', collection: 'collected', findings: [] }
    }
    return { state: 'healthy', collection: explicitCollection || 'collected', findings: [] }
}

/** Backward-compatible findings projection used by the Badge renderer. */
export const kubernetesTopologyProblemFindings = (node: Node): string[] => {
    const status = kubernetesResourceSelfStatus(node)
    return status.state === 'problem' ? status.findings : []
}

export const isProblematicKubernetesTopologyNode = (node: Node): boolean =>
    kubernetesResourceSelfStatus(node).state === 'problem'

export const kubernetesTopologyNodeNeedsAttention = (node: Node): boolean =>
    ['problem', 'unknown'].includes(kubernetesResourceSelfStatus(node).state)

export const isInactiveKubernetesTopologyNode = (node: Node): boolean =>
    kubernetesResourceSelfStatus(node).state === 'inactive'

export const kubernetesTopologyHasInactiveClusterAncestor = (node: Node): boolean => {
    let current = node.parent
    while (current) {
        if (resourceType(current) === 'cluster' && isInactiveKubernetesTopologyNode(current)) return true
        current = current.parent
    }
    return false
}

/** Returns the resource IDs that form paths to attention-needed Kubernetes
 * resources. This is a path set, not a recursively accumulated issue count. */
export const kubernetesTopologyAttentionPathIDs = (
    roots: Node[],
    visible: (node: Node) => boolean = () => true
): Set<string> => {
    const retained = new Set<string>()
    const visiting = new Set<string>()

    const visit = (node: Node): boolean => {
        if (visiting.has(node.id)) return false
        visiting.add(node.id)
        // Visit every sibling branch. Array#some would stop after the first
        // problem and omit other independent attention paths.
        let childNeedsAttention = false
        ;(node.children || []).forEach(child => {
            if (visit(child)) childNeedsAttention = true
        })
        const visualKubernetesResource = isKubernetesResource(node) && visible(node)
        const selfNeedsAttention = visualKubernetesResource && kubernetesTopologyNodeNeedsAttention(node)
        const needsAttention = selfNeedsAttention || childNeedsAttention
        if (needsAttention && visualKubernetesResource) retained.add(node.id)
        visiting.delete(node.id)
        return needsAttention
    }

    roots.forEach(root => visit(root))
    return retained
}

/** Uses exactly the next visible topology layer. Group nodes are real direct
 * children for badge classification and are never unwrapped into resources. */
export const kubernetesTopologyDirectChildren = (node: Node, children: Node[] = node.children || []): Node[] => {
    return Array.from(children.reduce((result, child) => {
        if (!isKubernetesResource(child)) return result
        if (resourceType(child) === 'pod' && !isCurrentKubernetesPod(child)) return result
        result.set(resourceUID(child), child)
        return result
    }, new Map<string, Node>()).values())
}

/** Descendant state changes a direct child's bucket only. It never contributes
 * a descendant object count to an ancestor badge. */
export const kubernetesTopologyHasProblematicDescendant = (node: Node, visited = new Set<string>()): boolean => {
    const identity = `${resourceType(node)}:${resourceUID(node)}:${isTopologyGroup(node) ? 'group' : 'resource'}`
    if (visited.has(identity)) return false
    visited.add(identity)
    return kubernetesTopologyDirectChildren(node).some(child =>
        kubernetesTopologyNodeNeedsAttention(child)
        || kubernetesTopologyHasProblematicDescendant(child, visited))
}

const typeCountsFor = (nodes: Node[]): Array<{ type: string, label: string, count: number }> => {
    const typeCounts = new Map<string, number>()
    nodes.forEach(child => {
        const type = resourceType(child)
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
    })
    return Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, label: resourceTypeLabel(type), count }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

export const kubernetesTopologyDirectChildSummary = (
    node: Node,
    directChildren?: Node[]
): KubernetesTopologyDirectChildSummary => {
    const children = kubernetesTopologyDirectChildren(node, directChildren)
    const inactive = children.filter(isInactiveKubernetesTopologyNode)
    const inactiveUIDs = new Set(inactive.map(resourceUID))
    const selfProblematic = children.filter(child =>
        !inactiveUIDs.has(resourceUID(child)) && isProblematicKubernetesTopologyNode(child))
    const selfProblematicUIDs = new Set(selfProblematic.map(resourceUID))
    const attentionRequired = children.filter(child =>
        !selfProblematicUIDs.has(resourceUID(child))
        && kubernetesTopologyNodeNeedsAttention(child))
    const attentionRequiredUIDs = new Set(attentionRequired.map(resourceUID))
    const selfHealthy = children.filter(child =>
        !selfProblematicUIDs.has(resourceUID(child))
        && !attentionRequiredUIDs.has(resourceUID(child)))
        .filter(child => !inactiveUIDs.has(resourceUID(child)))
    const descendantProblematic = selfHealthy.filter(child => kubernetesTopologyHasProblematicDescendant(child))
    const descendantProblematicUIDs = new Set(descendantProblematic.map(resourceUID))
    const healthy = selfHealthy.filter(child => !descendantProblematicUIDs.has(resourceUID(child)))
    return {
        children,
        total: children.length,
        selfProblematic,
        attentionRequired,
        descendantProblematic,
        healthy,
        inactive,
        selfProblematicTypeCounts: typeCountsFor(selfProblematic),
        descendantProblematicTypeCounts: typeCountsFor(descendantProblematic)
    }
}

/** Group cards use red for unhealthy grouped resources. Resource cards merge
 * every next-level problem into orange; their own problem is the red ! only. */
export const kubernetesTopologyCountBadges = (
    node: Node,
    directChildren?: Node[]
): KubernetesTopologyCountBadge[] => {
    if (!isKubernetesResource(node)) return []
    if (isInactiveKubernetesTopologyNode(node)) return [{
        key: 'self-inactive',
        label: '비활성',
        count: 0,
        displayText: '!',
        tone: 'inactive',
        tooltip: {
            title: '비활성',
            description: '현재 Mold에서 정지 상태인 클러스터입니다.'
        }
    }]
    const selfFindings = kubernetesTopologyProblemFindings(node)
    const direct = kubernetesTopologyDirectChildSummary(node, directChildren)
    const groupNode = isTopologyGroup(node)
    const warningProblemTargets = groupNode
        ? direct.descendantProblematic
        : [...direct.selfProblematic, ...direct.descendantProblematic]
    const warningTargets = [...direct.attentionRequired, ...warningProblemTargets]
    const selfProblemTypeDetails = direct.selfProblematicTypeCounts.map(item => ({
        label: `${resourceTypeProblemLabel(item.type)} 이상`,
        value: `${item.count}개`
    }))
    const warningProblemTypeDetails = typeCountsFor(warningProblemTargets).map(item => ({
        label: `${resourceTypeProblemLabel(item.type)} 이상`,
        value: `${item.count}개`
    })).concat(typeCountsFor(direct.attentionRequired).map(item => ({
        label: `${resourceTypeProblemLabel(item.type)} 확인 필요`,
        value: `${item.count}개`
    })))
    const healthyTypeDetails = typeCountsFor(direct.healthy).map(item => ({
        label: `${resourceTypeProblemLabel(item.type)} 정상`,
        value: `${item.count}개`
    }))
    return [
        selfFindings.length > 0 ? {
            key: 'self-problem' as const,
            label: '현재 객체 자체 이상',
            count: 0,
            displayText: '!',
            tone: 'problem' as const,
            tooltip: {
                title: '현재 리소스 이상',
                description: '현재 리소스에서 확인된 문제입니다.',
                detailsTitle: '확인된 원인',
                details: selfFindings.map(finding => ({ value: finding }))
            }
        } : undefined,
        groupNode && direct.selfProblematic.length > 0 ? {
            key: 'direct-self-problem' as const,
            label: '자체 이상',
            count: direct.selfProblematic.length,
            tone: 'problem' as const,
            tooltip: {
                title: '자체 이상',
                details: selfProblemTypeDetails
            }
        } : undefined,
        warningTargets.length > 0 ? {
            key: 'direct-descendant-problem' as const,
            label: '하위 자원 이상',
            count: warningTargets.length,
            tone: 'warning' as const,
            tooltip: {
                title: '하위 자원 이상',
                details: warningProblemTypeDetails
            }
        } : undefined,
        direct.healthy.length > 0 ? {
            key: 'direct-healthy' as const,
            label: '정상',
            count: direct.healthy.length,
            tone: 'running' as const,
            tooltip: {
                title: '정상',
                details: healthyTypeDetails
            }
        } : undefined,
        direct.inactive.length > 0 ? {
            key: 'direct-inactive' as const,
            label: '비활성',
            count: direct.inactive.length,
            tone: 'inactive' as const,
            tooltip: {
                title: '비활성',
                description: '정지 등으로 현재 운영되지 않는 자원입니다.',
                details: typeCountsFor(direct.inactive).map(item => ({
                    label: `${resourceTypeProblemLabel(item.type)} 비활성`,
                    value: `${item.count}개`
                }))
            }
        } : undefined
    ].filter(Boolean) as KubernetesTopologyCountBadge[]
}

export const kubernetesTopologyBadgeGroupSummary = (
    node: Node,
    badges: KubernetesTopologyCountBadge[] = kubernetesTopologyCountBadges(node),
    directChildren?: Node[]
): KubernetesTopologyBadgeGroupSummary => {
    const children = kubernetesTopologyDirectChildren(node, directChildren)
    const childLabels = Array.from(new Set(children.map(child => resourceTypeGroupLabel(resourceType(child)))))
    const childLabel = childLabels.length === 1
        ? childLabels[0]
        : children.length > 0 && children.every(isTopologyGroup)
            ? '그룹'
            : '자원'
    const stateLabels: Record<string, '자체 이상' | '하위 자원 이상' | '정상' | '비활성'> = {
        'direct-self-problem': '자체 이상',
        'direct-descendant-problem': '하위 자원 이상',
        'direct-healthy': '정상',
        'direct-inactive': '비활성'
    }
    const states = badges
        .filter(badge => badge.key !== 'self-problem' && badge.key !== 'self-inactive' && badge.count > 0)
        .map(badge => ({
            key: badge.key as 'direct-self-problem' | 'direct-descendant-problem' | 'direct-healthy' | 'direct-inactive',
            tone: badge.tone,
            label: stateLabels[badge.key],
            count: badge.count
        }))
    const total = states.reduce((sum, state) => sum + state.count, 0)
    const scopePrefix = isTopologyGroup(node) ? '' : '하위 '
    return {
        title: `${scopePrefix}${childLabel} 상태`,
        totalLabel: `${scopePrefix}${childLabel} 총 ${total}개`,
        states
    }
}
