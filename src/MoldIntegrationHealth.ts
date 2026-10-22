import type { session } from './Store'

export const MOLD_INTEGRATION_CHANGED_EVENT = 'netdive-mold-integration-changed'

export type MoldIntegrationState = 'UNKNOWN' | 'UNCONFIGURED' | 'HEALTHY' | 'AUTHENTICATION_FAILED' | 'PERMISSION_DENIED' | 'UNAVAILABLE'
export interface MoldIntegrationHealth {
  state: MoldIntegrationState
  checkedAt: number
  lastSuccessAt?: number
}

export const moldIntegrationIssue = (health?: MoldIntegrationHealth): boolean =>
  !!health && ['UNCONFIGURED', 'AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'UNAVAILABLE'].includes(health.state)

export const moldIntegrationLabel = (health: MoldIntegrationHealth): string => ({
  UNKNOWN: 'Mold API 응답 확인 전', UNCONFIGURED: 'Mold API 미설정', HEALTHY: 'Mold API 연결 정상',
  AUTHENTICATION_FAILED: 'Mold API 인증 실패', PERMISSION_DENIED: 'Mold API 권한 부족', UNAVAILABLE: 'Mold API 연결 실패'
}[health.state])

export const moldIntegrationDescription = (health: MoldIntegrationHealth): string => ({
  UNKNOWN: '아직 정상 API 응답이 확인되지 않았습니다. 실제 API 호출 결과가 들어오면 상태를 표시합니다.',
  UNCONFIGURED: 'Mold API Key와 Secret Key를 설정해 주세요.',
  HEALTHY: '저장된 API Key와 Secret Key로 인증에 성공했습니다.',
  AUTHENTICATION_FAILED: '저장된 API Key와 Secret Key로 인증할 수 없습니다. Mold에서 키를 재발급했다면 새 키 한 쌍을 입력하고 저장해 주세요.',
  PERMISSION_DENIED: 'Mold가 API 접근을 거부했습니다. 연동 계정의 API 권한과 접근 제한을 확인해 주세요.',
  UNAVAILABLE: '기존 Mold API 호출이 연속해서 실패했습니다. Mold 서버와 네트워크 연결을 확인해 주세요.'
}[health.state])

// Initial failures must be visible too. Repeated polling must not repeat toasts.
export const moldIntegrationNotification = (previous: MoldIntegrationHealth | undefined, next: MoldIntegrationHealth): 'error' | 'success' | undefined => {
  if (previous?.state === next.state) return undefined
  if (moldIntegrationIssue(next)) return 'error'
  if (next.state === 'HEALTHY' && moldIntegrationIssue(previous)) return 'success'
  return undefined
}

export async function getMoldIntegrationHealth(userSession?: session, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<MoldIntegrationHealth | undefined> {
  const endpoint = userSession?.endpoint || `${window.location.protocol}//${window.location.host}`
  // Reads the server's last observed result; this endpoint never calls Mold.
  const response = await fetcher(`${endpoint.replace(/\/$/, '')}/api/mold/integration-health`, {
    credentials: 'same-origin', cache: 'no-store', signal,
    headers: userSession?.token ? { 'X-Auth-Token': userSession.token } : {}
  })
  // Older analyzers do not expose integration health. Do not infer a Mold
  // authentication failure from a Netdive session/proxy/permission error.
  if (!response.ok) return undefined
  const body = await response.json()
  if (!body || !['UNKNOWN', 'UNCONFIGURED', 'HEALTHY', 'AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'UNAVAILABLE'].includes(body.state)
    || !Number.isFinite(body.checkedAt)) return undefined
  return { state: body.state, checkedAt: body.checkedAt,
    ...(Number.isFinite(body.lastSuccessAt) ? { lastSuccessAt: body.lastSuccessAt } : {}) }
}
