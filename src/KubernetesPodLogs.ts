export interface KubernetesLogContainer { name: string; type?: string }
export interface KubernetesPodLogRequest {
    endpoint: string; token?: string; clusterID: string; uid: string
    namespace?: string; name?: string; container: string; previous: boolean; tailLines: number
}
export interface KubernetesPodLogs {
    clusterId: string; uid: string; namespace: string; name: string; container: string
    previous: boolean; tailLines: number; logs: string; truncated: boolean; fetchedAt: string
}

/** Preserve response metadata for UI state handling; requests/authentication stay unchanged. */
export class KubernetesPodLogError extends Error {
    constructor(message: string, public status?: number, public code?: string) {
        super(message)
        this.name = 'KubernetesPodLogError'
    }
}

export const kubernetesLogContainerChoices = (containers: KubernetesLogContainer[]) => {
    const seen = new Set<string>()
    const order = (type?: string) => String(type || 'APPLICATION').toUpperCase() === 'APPLICATION' ? 0
        : String(type).toUpperCase() === 'INIT' ? 1 : 2
    return containers.filter(container => {
        if (!container.name || seen.has(container.name)) return false
        seen.add(container.name); return true
    }).sort((a, b) => order(a.type) - order(b.type)).map(container => ({
        value: container.name,
        label: `${container.name}${String(container.type).toUpperCase() === 'INIT' ? ' (초기화)'
            : String(container.type).toUpperCase() === 'EPHEMERAL' ? ' (임시)' : ''}`
    }))
}

export const kubernetesPodLogRequestKey = (request: KubernetesPodLogRequest) => JSON.stringify([
    request.endpoint, request.token || '', request.clusterID, request.uid, request.namespace || '', request.name || '',
    request.container, request.previous, request.tailLines
])

export async function fetchKubernetesPodLogs(request: KubernetesPodLogRequest, signal: AbortSignal,
    fetcher: typeof fetch = fetch): Promise<KubernetesPodLogs> {
    const query = new URLSearchParams({ id: request.clusterID, uid: request.uid, container: request.container,
        previous: String(request.previous), tailLines: String(request.tailLines) })
    if (request.namespace && request.name) { query.set('namespace', request.namespace); query.set('name', request.name) }
    const response = await fetcher(`${request.endpoint.replace(/\/$/, '')}/api/mold/kubernetes-clusters/pods/logs?${query}`, {
        cache: 'no-store', signal, headers: request.token ? { 'X-Auth-Token': request.token } : undefined
    })
    let payload: any
    try { payload = await response.json() } catch { payload = undefined }
    if (!response.ok) {
        if (payload?.code && typeof payload.message === 'string') throw new KubernetesPodLogError(payload.message, response.status, payload.code)
        throw new KubernetesPodLogError(response.status === 404 ? '로그 조회 API를 사용할 수 없습니다. Netdive 서버에 최신 로그 조회 기능이 적용되어 있는지 확인하세요.'
            : response.status === 403 ? '로그 조회 권한이 없습니다. 클러스터 연동과 pods/log 읽기 권한을 확인하세요.'
                : response.status === 401 ? '인증이 만료되었거나 Kubernetes 인증에 실패했습니다. 로그인 및 클러스터 연동을 확인하세요.'
                    : '로그를 조회하지 못했습니다. 잠시 후 다시 조회하세요.', response.status)
    }
    if (!payload || typeof payload.logs !== 'string' || payload.uid !== request.uid || payload.clusterId !== request.clusterID
        || payload.container !== request.container || payload.previous !== request.previous) {
        throw new KubernetesPodLogError('선택한 파드·컨테이너와 로그 응답이 일치하지 않습니다. 다시 조회하세요.', response.status, 'RESPONSE_MISMATCH')
    }
    return payload
}
