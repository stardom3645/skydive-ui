export type KubernetesConfigurationState = 'configured' | 'partial' | 'unset' | 'uncollected'

export type KubernetesOperationalValueTone = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'history'

const KUBERNETES_UNAVAILABLE_STATUS_VALUES = new Set([
    '확인 불가', '미확인', '미수집', '수집되지 않음', '수집 실패',
    'unknown', 'stale', 'unavailable'
])

/** Shared visual policy for the repeated "최근 불안정성" operational value.
 * Resource panels keep their own counts and severity decisions; this helper
 * only removes presentation drift for zero/none and unavailable evidence. */
export const kubernetesRecentInstabilityTone = (
    value: any,
    severityTone: KubernetesOperationalValueTone = 'warning'
): KubernetesOperationalValueTone => {
    const text = value === undefined || value === null ? '' : String(value).trim()
    const normalized = text.toLowerCase()
    if (!text || KUBERNETES_UNAVAILABLE_STATUS_VALUES.has(normalized)) return 'default'
    if (normalized === '없음' || /^0(?:\s*(?:건|개|회))?$/.test(normalized)) return 'success'
    const numeric = typeof value === 'number' ? value : Number(text)
    if (Number.isFinite(numeric)) {
        if (numeric <= 0) return 'success'
        return severityTone === 'danger' ? 'danger' : 'warning'
    }
    return severityTone === 'danger' ? 'danger' : severityTone === 'default' ? 'warning' : severityTone
}

export const isKubernetesRecentInstabilityLabel = (label: any): boolean =>
    typeof label === 'string' && label.trim() === '최근 불안정성'

export const kubernetesOperationalValueTone = (
    label: any,
    value: any,
    tone: KubernetesOperationalValueTone = 'default'
): KubernetesOperationalValueTone => isKubernetesRecentInstabilityLabel(label)
    ? kubernetesRecentInstabilityTone(value, tone)
    : tone

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
            // The graph normalizer turns metav1.Time/time.Time into empty
            // objects because time.Time has no exported data fields. Do not
            // let that lossy K8s.Extra value mask the explicit, valid
            // K8s.CreationTimestamp published by the collector.
            if (nested === undefined || nested === null || nested === '') continue
            if (typeof nested === 'object') {
                if (!Object.keys(nested).length) continue
                const nestedTime = nested.Time ?? nested.time
                if (nestedTime === undefined || nestedTime === null || nestedTime === '' || typeof nestedTime === 'object') continue
                return nestedTime
            }
            return nested
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

export type KubernetesReplicaTerm = 'desired' | 'ready' | 'available' | 'current' | 'updated' | 'unavailable'

const KUBERNETES_REPLICA_LABELS: Record<KubernetesReplicaTerm, string> = {
    desired: '목표 복제본',
    ready: '준비 복제본',
    available: '가용 복제본',
    current: '현재 복제본',
    updated: '업데이트 복제본',
    unavailable: '미가용 복제본'
}

const KUBERNETES_REPLICA_COMPACT_LABELS: Record<KubernetesReplicaTerm, string> = {
    desired: '목표',
    ready: '준비',
    available: '가용',
    current: '현재',
    updated: '업데이트',
    unavailable: '미가용'
}

/** Shared user-facing Replica vocabulary for Replica-based workloads. */
export const kubernetesReplicaLabel = (term: KubernetesReplicaTerm, compact = false): string =>
    (compact ? KUBERNETES_REPLICA_COMPACT_LABELS : KUBERNETES_REPLICA_LABELS)[term]

export type KubernetesDaemonSetNodeTerm = 'desired' | 'current' | 'ready' | 'available' | 'updated' | 'unavailable' | 'misscheduled'

const KUBERNETES_DAEMONSET_NODE_LABELS: Record<KubernetesDaemonSetNodeTerm, string> = {
    desired: '배치 대상 노드',
    current: '현재 배치 노드',
    ready: '준비 노드',
    available: '가용 노드',
    updated: '업데이트 노드',
    unavailable: '미가용 노드',
    misscheduled: '비대상 배치'
}

const KUBERNETES_DAEMONSET_NODE_COMPACT_LABELS: Record<KubernetesDaemonSetNodeTerm, string> = {
    desired: '배치 대상',
    current: '현재 배치',
    ready: '준비',
    available: '가용',
    updated: '업데이트',
    unavailable: '미가용',
    misscheduled: '비대상 배치'
}

/** Shared user-facing node-placement vocabulary for DaemonSet workloads. */
export const kubernetesDaemonSetNodeLabel = (term: KubernetesDaemonSetNodeTerm, compact = false): string =>
    (compact ? KUBERNETES_DAEMONSET_NODE_COMPACT_LABELS : KUBERNETES_DAEMONSET_NODE_LABELS)[term]

export const KUBERNETES_DAEMONSET_PLACEMENT_ROLLOUT_TITLE = '노드 배치 및 롤아웃'

const KUBERNETES_NAMESPACE_PHASE_LABELS: Record<string, string> = {
    active: '활성',
    terminating: '종료 중'
}

export const kubernetesNamespacePhaseLabel = (value: any): string => {
    const source = String(value || '').trim()
    return KUBERNETES_NAMESPACE_PHASE_LABELS[source.toLowerCase()] || source
}

export const kubernetesPodPhaseLabel = (value: any): string => {
    switch (String(value || '').toLowerCase()) {
    case 'running': return '실행 중'
    case 'pending': return '대기 중'
    case 'succeeded': return '완료'
    case 'failed': return '실패'
    case 'unknown': return '알 수 없음'
    default: return '수집되지 않음'
    }
}

const KUBERNETES_PVC_PHASE_LABELS: Record<string, string> = {
    bound: '바인딩 완료',
    pending: '바인딩 대기',
    lost: '바인딩 손실'
}

/** User-facing PVC binding state. The Kubernetes phase remains available to
 * callers for diagnostic Tooltips instead of leaking into the primary UI. */
export const kubernetesPvcPhaseLabel = (value: any): string => {
    const source = String(value ?? '').trim()
    return source ? KUBERNETES_PVC_PHASE_LABELS[source.toLowerCase()] || source : '수집되지 않음'
}

const KUBERNETES_PV_PHASE_LABELS: Record<string, string> = {
    available: '사용 가능',
    bound: '바인딩 완료',
    released: '클레임 해제',
    failed: '바인딩 실패'
}

export const kubernetesPvPhaseLabel = (value: any): string => {
    const source = String(value ?? '').trim()
    return source ? KUBERNETES_PV_PHASE_LABELS[source.toLowerCase()] || source : '수집되지 않음'
}

const KUBERNETES_VOLUME_MODE_LABELS: Record<string, string> = {
    filesystem: '파일시스템',
    block: '블록'
}

export const kubernetesVolumeModeLabel = (value: any): string => {
    const source = String(value ?? '').trim()
    return source ? KUBERNETES_VOLUME_MODE_LABELS[source.toLowerCase()] || source : '수집되지 않음'
}

const KUBERNETES_ACCESS_MODE_LABELS: Record<string, string> = {
    readwriteonce: '단일 노드 읽기/쓰기',
    readonlymany: '다중 노드 읽기 전용',
    readwritemany: '다중 노드 읽기/쓰기',
    readwriteoncepod: '단일 파드 읽기/쓰기'
}

export const kubernetesAccessModeLabel = (value: any): string => {
    const source = String(value ?? '').trim()
    return source ? KUBERNETES_ACCESS_MODE_LABELS[source.toLowerCase()] || source : '수집되지 않음'
}

export const kubernetesAccessModesLabel = (values: any): string =>
    Array.isArray(values) && values.length
        ? values.map(kubernetesAccessModeLabel).join(', ')
        : '설정되지 않음'

const KUBERNETES_TRAFFIC_POLICY_LABELS: Record<string, string> = {
    cluster: '클러스터 전체',
    local: '로컬'
}

/** Shared user-facing Service traffic-policy vocabulary. Kubernetes's raw
 * enum remains available to callers for diagnostic Tooltips. */
export const kubernetesTrafficPolicyLabel = (value: any): string => {
    const source = String(value ?? '').trim()
    return source ? KUBERNETES_TRAFFIC_POLICY_LABELS[source.toLowerCase()] || source : '설정되지 않음'
}

const KUBERNETES_VOLUME_SOURCE_LABELS: Record<string, string> = {
    hostpath: '호스트 경로',
    local: '로컬 볼륨',
    nfs: 'NFS',
    csi: 'CSI',
    iscsi: 'iSCSI',
    cephfs: 'CephFS',
    rbd: 'RBD',
    fc: 'Fibre Channel',
    azuredisk: 'Azure Disk',
    gcepersistentdisk: 'GCE 영구 디스크',
    awselasticblockstore: 'AWS EBS'
}

export const kubernetesVolumeSourceTypeLabel = (value: any): string => {
    const source = String(value ?? '').trim()
    return source ? KUBERNETES_VOLUME_SOURCE_LABELS[source.toLowerCase()] || source : '수집되지 않음'
}

export const kubernetesContainerKindLabel = (value: any): string => {
    switch (String(value || '').toUpperCase()) {
    case 'INIT': return '초기화 컨테이너'
    case 'EPHEMERAL': return '임시 컨테이너'
    default: return '일반 컨테이너'
    }
}

/** Returns only the reason attached to the container's current Kubernetes
 * state. A previous termination reason is diagnostic history and must not be
 * presented as the reason for a currently Running container. */
export const kubernetesContainerStateReason = (container: any): string | undefined => {
    const state = String(container?.state ?? container?.State ?? '').trim().toUpperCase()
    const reason = state === 'WAITING'
        ? container?.waitingReason ?? container?.WaitingReason
        : state === 'TERMINATED'
            ? container?.terminatedReason ?? container?.TerminatedReason
            : undefined
    const normalized = String(reason ?? '').trim()
    return normalized || undefined
}

const KUBERNETES_NO_IMPACT_LABELS = new Set([
    '영향 없음',
    '현재 영향 없음',
    '확인된 영향 없음',
    '현재 워크로드 영향 없음',
    '확인된 가용성 영향 없음'
])

/** Keeps operational KPI values compact while leaving each panel's detailed
 * impact evidence in its Tooltip. The underlying verdict text is not changed. */
export const kubernetesImpactLabel = (value: string): string => {
    const normalized = value.trim()
    if (KUBERNETES_NO_IMPACT_LABELS.has(normalized)) return '영향 없음'
    if (normalized === '가용성 영향 확인 필요') return '가용성 확인 필요'
    const unavailableWorkloads = normalized.match(/^워크로드\s+(\d+)개\s+미가용$/)
    // `현재 영향` is already the KPI label, so repeating the resource
    // kind needlessly consumes the narrow three-column value area.
    if (unavailableWorkloads) return `${unavailableWorkloads[1]}개 미가용`
    return value
}

const KUBERNETES_RECLAIM_POLICY_LABELS: Record<string, string> = {
    delete: '삭제',
    retain: '유지',
    recycle: '재사용'
}

const KUBERNETES_VOLUME_BINDING_MODE_LABELS: Record<string, string> = {
    waitforfirstconsumer: '사용 시 바인딩',
    immediate: '즉시 바인딩'
}

export interface KubernetesVolumeBindingModePresentation {
    label: string
    description?: string
    rawValue?: string
}

export const kubernetesReclaimPolicyLabel = (value: any): string => {
    const source = String(value ?? '').trim()
    return KUBERNETES_RECLAIM_POLICY_LABELS[source.toLowerCase()] || source
}

export const kubernetesVolumeBindingModeLabel = (value: any): string => {
    const source = String(value ?? '').trim()
    return KUBERNETES_VOLUME_BINDING_MODE_LABELS[source.toLowerCase()] || source
}

/** Keeps the user-facing StorageClass binding mode and its operational meaning
 * together while preserving the Kubernetes source value for diagnostics. */
export const kubernetesVolumeBindingModePresentation = (value: any): KubernetesVolumeBindingModePresentation => {
    const source = String(value ?? '').trim()
    const normalized = source.toLowerCase()
    return {
        label: KUBERNETES_VOLUME_BINDING_MODE_LABELS[normalized] || source,
        description: normalized === 'waitforfirstconsumer'
            ? '이 스토리지 클래스를 사용하는 파드의 배치 위치가 결정된 후 볼륨을 바인딩합니다.'
            : undefined,
        rawValue: source || undefined
    }
}

export interface KubernetesBooleanSettingOptions {
    collected: boolean
    enabledLabel?: string
    disabledLabel?: string
}

/** Formats an optional Kubernetes boolean without collapsing an absent field
 * into an explicitly configured false value. */
export const kubernetesBooleanSettingLabel = (
    value: any,
    {
        collected,
        enabledLabel = '사용',
        disabledLabel = '사용하지 않음'
    }: KubernetesBooleanSettingOptions
): string => {
    if (!collected) return '수집되지 않음'
    if (value === undefined || value === null || value === '') return '설정되지 않음'
    if (value === true || String(value).toLowerCase() === 'true') return enabledLabel
    if (value === false || String(value).toLowerCase() === 'false') return disabledLabel
    return '확인 불가'
}

/** Kubernetes supports both stable and legacy default StorageClass
 * annotations. The collector-derived value is accepted only as a fallback
 * because the probe computes it from those same annotations. */
export const kubernetesDefaultStorageClass = (
    annotations: Record<string, any> | undefined | null,
    collectorValue?: any
): boolean | undefined => {
    const stable = annotations?.['storageclass.kubernetes.io/is-default-class']
    const legacy = annotations?.['storageclass.beta.kubernetes.io/is-default-class']
    if (stable !== undefined || legacy !== undefined) {
        return String(stable ?? legacy).toLowerCase() === 'true'
    }
    return typeof collectorValue === 'boolean' ? collectorValue : undefined
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

/** Single-container ResourceList presentation. Unlike aggregate coverage, the
 * field state and its value occupy one cell and must not repeat equivalent
 * "unset" or "uncollected" labels in separate columns. */
export const kubernetesSingleResourceValuePresentation = ({
    configuredContainers,
    collected,
    aggregate,
    format
}: KubernetesConfiguredResourceTotalOptions): string => {
    if (!collected) return '수집되지 않음'
    if (configuredContainers <= 0) return '미설정'
    if (aggregate === undefined || !Number.isFinite(aggregate)) return '확인 불가'
    return format(aggregate)
}

export interface KubernetesCollectionSource {
    key: string
    label: string
    collected?: boolean
    state?: KubernetesCollectionState
    /** Missing essential evidence means the resource itself could not be
     * evaluated, rather than an optional observation source being absent. */
    essential?: boolean
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
    label: '수집됨' | '부분 수집' | '수집되지 않음' | '수집 실패'
    tone: 'success' | 'warning' | 'danger' | 'default'
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
    const essentialMissing = sources.some((source, index) => source.essential && states[index] === 'uncollected')
    const label = essentialMissing
        ? '수집 실패'
        : total > 0 && collected === total
            ? '수집됨'
            : collected > 0 || partial > 0 ? '부분 수집' : '수집되지 않음'
    const detailGroups: Array<{ state: KubernetesCollectionState, label: string }> = [
        { state: 'collected', label: '수집됨' },
        { state: 'partial', label: '부분 수집' },
        { state: 'uncollected', label: '수집되지 않음' }
    ]
    const detail = detailGroups.map(group => {
        const labels = sources.filter((_source, index) => states[index] === group.state).map(source => source.label)
        return labels.length ? `${group.label}: ${labels.join(', ')}` : ''
    }).filter(Boolean).join(' · ')
    return {
        label,
        tone: label === '수집됨' ? 'success' : label === '부분 수집' ? 'warning' : label === '수집 실패' ? 'danger' : 'default',
        collected,
        total,
        detail
    }
}
