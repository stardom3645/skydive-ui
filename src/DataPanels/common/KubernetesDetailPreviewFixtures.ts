export type KubernetesDetailPreviewState =
    | 'normal'
    | 'warning'
    | 'danger'
    | 'empty'
    | 'fetch-error'
    | 'long-name'
    | 'narrow-panel'

export interface KubernetesDetailPreviewFixture {
    key: KubernetesDetailPreviewState
    panelWidth: number
    resourceName: string
    verdict: string
    rawStatus: string
    impact: string
    emptyText?: string
}

const longResourceName = 'k8s-hwryu-production-observability-control-plane-19f823a2c7e'

/**
 * Data-only preview fixtures for Storybook-compatible consumers.
 * Keeping these independent from React lets visual regression harnesses and
 * unit tests use the same normal/edge-state contract.
 */
export const kubernetesDetailPreviewFixtures: KubernetesDetailPreviewFixture[] = [
    { key: 'normal', panelWidth: 460, resourceName: 'hwryu-k8s-test-03', verdict: '정상', rawStatus: 'Ready', impact: '현재 영향 없음' },
    { key: 'warning', panelWidth: 460, resourceName: 'hwryu-k8s-test-03', verdict: '주의', rawStatus: 'Ready', impact: '현재 영향 확인 필요' },
    { key: 'danger', panelWidth: 460, resourceName: 'hwryu-k8s-test-03', verdict: '심각', rawStatus: 'NotReady', impact: '현재 영향 있음' },
    { key: 'empty', panelWidth: 460, resourceName: 'hwryu-k8s-test-03', verdict: '판단 불가', rawStatus: '없음', impact: '없음', emptyText: '표시할 정보가 없습니다.' },
    { key: 'fetch-error', panelWidth: 460, resourceName: 'hwryu-k8s-test-03', verdict: '판단 불가', rawStatus: '조회 실패', impact: '조회 실패' },
    { key: 'long-name', panelWidth: 460, resourceName: longResourceName, verdict: '정상', rawStatus: 'Ready', impact: '현재 영향 없음' },
    { key: 'narrow-panel', panelWidth: 340, resourceName: longResourceName, verdict: '주의', rawStatus: 'Ready', impact: '현재 영향 확인 필요' }
]

