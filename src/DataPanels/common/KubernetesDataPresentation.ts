export type KubernetesConfigurationState = 'configured' | 'partial' | 'unset' | 'uncollected'

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

export interface KubernetesCollectionSource {
    key: string
    label: string
    collected?: boolean
    state?: 'collected' | 'partial' | 'uncollected'
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
    const stateLabel = (state: 'collected' | 'partial' | 'uncollected') => state === 'collected'
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
