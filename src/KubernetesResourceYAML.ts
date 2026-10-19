export interface KubernetesResourceYAML {
    clusterId: string; uid: string; namespace: string; name: string
    yaml: string; redacted: boolean; fetchedAt: string
}
export interface KubernetesPodYAMLRequest {
    endpoint: string; token?: string; clusterID: string; uid: string; namespace: string; name: string
}
export class KubernetesYAMLError extends Error {
    constructor(message: string, public status?: number, public code?: string) { super(message); this.name = 'KubernetesYAMLError' }
}
export const kubernetesYAMLRequestKey = (r: KubernetesPodYAMLRequest) => JSON.stringify([
    r.endpoint, r.token || '', r.clusterID, r.uid, r.namespace, r.name
])

export async function fetchKubernetesPodYAML(request: KubernetesPodYAMLRequest, signal: AbortSignal,
    fetcher: typeof fetch = fetch): Promise<KubernetesResourceYAML> {
    const query = new URLSearchParams({ id: request.clusterID, uid: request.uid, namespace: request.namespace, name: request.name })
    const response = await fetcher(`${request.endpoint.replace(/\/$/, '')}/api/mold/kubernetes-clusters/pods/yaml?${query}`, {
        method: 'GET', cache: 'no-store', signal, headers: request.token ? { 'X-Auth-Token': request.token } : undefined
    })
    let payload: any
    try { payload = await response.json() } catch { payload = undefined }
    if (!response.ok) throw new KubernetesYAMLError(payload?.code && typeof payload.message === 'string' ? payload.message
        : response.status === 404 ? 'YAML 조회 API를 사용할 수 없습니다. Netdive 서버에 YAML 조회 기능이 적용되어 있는지 확인하세요.'
            : '리소스 YAML을 조회하지 못했습니다. 잠시 후 다시 시도하세요.', response.status, payload?.code)
    if (!payload || typeof payload.yaml !== 'string' || payload.uid !== request.uid || payload.clusterId !== request.clusterID
        || payload.namespace !== request.namespace || payload.name !== request.name) {
        throw new KubernetesYAMLError('선택한 리소스와 YAML 응답이 일치하지 않습니다. 다시 조회하세요.', undefined, 'RESPONSE_MISMATCH')
    }
    return payload
}

export function kubernetesYAMLFailure(error: unknown, timedOut = false) {
    const api = error instanceof KubernetesYAMLError ? error : undefined
    if (api?.status === 401) return { title: '인증을 확인해 주세요.', description: 'Netdive 로그인 상태와 Kubernetes 클러스터 인증 정보를 확인한 뒤 다시 시도하세요.' }
    if (api?.status === 403) return { title: 'YAML 조회 권한이 없습니다.', description: 'Netdive 조회 권한과 Kubernetes pods 읽기 권한을 확인한 뒤 다시 시도하세요.' }
    if (timedOut || api?.status === 504 || api?.status === 408) return { title: 'YAML 조회 시간이 초과되었습니다.', description: '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도하세요.' }
    if (api?.code === 'POD_NOT_FOUND') return { title: '현재 파드를 찾을 수 없습니다.', description: '파드가 삭제되었거나 교체되었습니다. 토폴로지를 갱신해 현재 파드를 선택하세요.' }
    if (error instanceof TypeError) return { title: '서버에 연결할 수 없습니다.', description: '네트워크와 Netdive 서버 연결 상태를 확인한 뒤 다시 시도하세요.' }
    return { title: 'YAML을 조회하지 못했습니다.', description: error instanceof Error ? error.message : '잠시 후 다시 시도하세요.' }
}

export interface KubernetesYAMLLoadState {
    key: string; loading: boolean; result?: KubernetesResourceYAML; failure?: ReturnType<typeof kubernetesYAMLFailure>
}
export type KubernetesYAMLLoadAction = { type: 'start'; key: string }
    | { type: 'success'; key: string; result: KubernetesResourceYAML }
    | { type: 'failure'; key: string; failure: ReturnType<typeof kubernetesYAMLFailure> }
export function kubernetesYAMLLoadReducer(state: KubernetesYAMLLoadState, action: KubernetesYAMLLoadAction): KubernetesYAMLLoadState {
    if (action.type === 'start') return { key: action.key, loading: true, result: state.key === action.key ? state.result : undefined }
    if (state.key !== action.key) return state
    return action.type === 'success' ? { key: action.key, loading: false, result: action.result }
        : { ...state, loading: false, failure: action.failure }
}
