export type KubernetesConfigurationState = 'configured' | 'partial' | 'unset' | 'uncollected'

const valueByPath = (data: any, path: string): any => path.split('.').reduce((value, key) =>
    value === undefined || value === null ? undefined : value[key], data)

/** Reads creationTimestamp from both collector-normalized Go field names and
 * Kubernetes JSON field names. Workload objects are stored under K8s.Extra,
 * while some resource probes also publish the timestamp directly in K8s. */
export const kubernetesCreationTimestamp = (data: any): any => {
    const paths = [
        'K8s.Extra.ObjectMeta.CreationTimestamp.Time',
        'K8s.Extra.ObjectMeta.CreationTimestamp',
        'K8s.Extra.ObjectMeta.creationTimestamp',
        'K8s.Extra.Metadata.CreationTimestamp.Time',
        'K8s.Extra.Metadata.CreationTimestamp',
        'K8s.Extra.Metadata.creationTimestamp',
        'K8s.Extra.metadata.creationTimestamp',
        'K8s.Metadata.CreationTimestamp',
        'K8s.Metadata.creationTimestamp',
        'K8s.CreationTimestamp',
        'metadata.creationTimestamp',
        'CreationTimestamp',
        'CreatedAt',
        '@CreatedAt'
    ]
    for (const path of paths) {
        const value = valueByPath(data, path)
        if (value === undefined || value === null || value === '') continue
        if (typeof value === 'object') {
            const nested = value.Time ?? value.time
            if (nested !== undefined && nested !== null && nested !== '') return nested
        }
        return value
    }
    return undefined
}

/** Formats a Kubernetes timestamp only after collection/mapping has supplied
 * a real value. Empty normalized metav1.Time objects stay uncollected. */
export const formatKubernetesTimestamp = (value: any): string => {
    if (!value || (typeof value === 'object' && !Object.keys(value).length)) return ''
    const nested = typeof value === 'object' ? value.Time ?? value.time : value
    if (!nested) return ''
    const date = new Date(nested)
    return Number.isNaN(date.getTime()) ? String(nested) : date.toLocaleString()
}

export type KubernetesReplicaTerm = 'desired' | 'ready' | 'current' | 'updated' | 'unavailable'

const KUBERNETES_REPLICA_LABELS: Record<KubernetesReplicaTerm, string> = {
    desired: '목표 복제본',
    ready: '준비 복제본',
    current: '현재 복제본',
    updated: '업데이트 복제본',
    unavailable: '미가용 복제본'
}

const KUBERNETES_REPLICA_COMPACT_LABELS: Record<KubernetesReplicaTerm, string> = {
    desired: '목표',
    ready: '준비',
    current: '현재',
    updated: '업데이트',
    unavailable: '미가용'
}

/** Shared user-facing Replica vocabulary for Replica-based workloads. */
export const kubernetesReplicaLabel = (term: KubernetesReplicaTerm, compact = false): string =>
    (compact ? KUBERNETES_REPLICA_COMPACT_LABELS : KUBERNETES_REPLICA_LABELS)[term]

const KUBERNETES_NAMESPACE_PHASE_LABELS: Record<string, string> = {
    active: '활성',
    terminating: '종료 중'
}

export const kubernetesNamespacePhaseLabel = (value: any): string => {
    const source = String(value || '').trim()
    return KUBERNETES_NAMESPACE_PHASE_LABELS[source.toLowerCase()] || source
}

export const kubernetesMetadataValueDescription = (key: string, value: any): string | undefined => {
    if (key === 'kubectl.kubernetes.io/last-applied-configuration') {
        return 'kubectl apply가 마지막으로 적용한 Kubernetes 객체 구성을 JSON 형식으로 저장한 어노테이션입니다.'
    }
    if (value && typeof value === 'object') return '구조화된 메타데이터 값이며 JSON 형식으로 표시합니다.'
    return undefined
}

const KUBERNETES_METADATA_KEY_LABELS: Record<string, string> = {
    'kubectl.kubernetes.io/last-applied-configuration': 'kubectl 적용 구성'
}

/** User-facing metadata key name. The raw key remains untouched in detail
 * payloads and JSON modals. */
export const kubernetesMetadataKeyLabel = (key: string): string =>
    KUBERNETES_METADATA_KEY_LABELS[key] || key

export interface KubernetesConfigurationCoveragePresentation {
    state: KubernetesConfigurationState
    label: '설정됨' | '일부 설정' | '설정되지 않음' | '수집되지 않음'
    tone: 'success' | 'warning' | 'default'
    value: string
}

export const kubernetesConfigurationCoveragePresentation = (
    configured: number,
    total: number,
    collected: boolean
): KubernetesConfigurationCoveragePresentation => {
    if (!collected) return { state: 'uncollected', label: '수집되지 않음', tone: 'default', value: '확인 불가' }
    if (total <= 0 || configured <= 0) return { state: 'unset', label: '설정되지 않음', tone: 'default', value: `${Math.max(0, configured)} / ${Math.max(0, total)}` }
    if (configured >= total) return { state: 'configured', label: '설정됨', tone: 'success', value: `${configured} / ${total}` }
    return { state: 'partial', label: '일부 설정', tone: 'warning', value: `${configured} / ${total}` }
}

export interface KubernetesConfiguredResourceTotalOptions {
    configuredContainers: number
    collected: boolean
    aggregate?: number
    format: (value: number) => string
}

/** Formats a Requests/Limits aggregate without collapsing an absent
 * ResourceList key into an explicitly configured numeric zero. */
export const kubernetesConfiguredResourceTotalPresentation = ({
    configuredContainers,
    collected,
    aggregate,
    format
}: KubernetesConfiguredResourceTotalOptions): string => {
    if (!collected) return '확인 불가'
    if (configuredContainers <= 0) return '미설정'
    if (aggregate === undefined || !Number.isFinite(aggregate)) return '확인 불가'
    return format(aggregate)
}

export interface KubernetesCollectionSource {
    key: string
    label: string
    collected?: boolean
    state?: KubernetesCollectionState
}

export type KubernetesCollectionState = 'collected' | 'partial' | 'uncollected'

export interface KubernetesResourceConfigurationCollectionMetric {
    configuredContainers: number
    collected: boolean
    aggregate?: number
}

/** A Requests/Limits source is complete only when every metric has its
 * container count and every configured metric also has a collected aggregate. */
export const kubernetesResourceConfigurationCollectionState = (
    metrics: KubernetesResourceConfigurationCollectionMetric[]
): KubernetesCollectionState => {
    if (metrics.length === 0) return 'uncollected'
    const complete = metrics.map(metric => metric.collected
        && (metric.configuredContainers <= 0 || metric.aggregate !== undefined))
    if (complete.every(Boolean)) return 'collected'
    return metrics.some(metric => metric.collected) ? 'partial' : 'uncollected'
}

export interface KubernetesCollectionPresentation {
    label: '수집됨' | '부분 수집' | '수집되지 않음'
    tone: 'success' | 'warning' | 'default'
    collected: number
    total: number
    detail: string
}

/** Produces one collection verdict while preserving every source result for a
 * detailed tooltip. An empty result is never promoted to fully collected. */
export const kubernetesCollectionPresentation = (
    sources: KubernetesCollectionSource[]
): KubernetesCollectionPresentation => {
    const states = sources.map(source => source.state || (source.collected ? 'collected' : 'uncollected'))
    const collected = states.filter(state => state === 'collected').length
    const partial = states.filter(state => state === 'partial').length
    const total = sources.length
    const label = total > 0 && collected === total
        ? '수집됨'
        : collected > 0 || partial > 0 ? '부분 수집' : '수집되지 않음'
    const stateLabel = (state: KubernetesCollectionState) => state === 'collected'
        ? '수집됨'
        : state === 'partial' ? '부분 수집' : '수집되지 않음'
    return {
        label,
        tone: label === '수집됨' ? 'success' : label === '부분 수집' ? 'warning' : 'default',
        collected,
        total,
        detail: sources.map((source, index) => `${source.label}: ${stateLabel(states[index])}`).join(' · ')
    }
}
