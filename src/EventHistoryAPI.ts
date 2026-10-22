import type { session } from './Store'

export interface ChangeEvent {
    id: number
    resourceType: string
    resourceId: string
    resourceName: string
    eventType: string
    oldValue: string
    newValue: string
    source: string
    severity?: string
    metadata: string
    occurredAt: number
}
export interface EventFilter {
    from?: number; to?: number; resource_type?: string; resource_id?: string
    event_type?: string; source?: string; search?: string; page?: number; pageSize?: number
}
export interface EventPage { events: ChangeEvent[]; total: number; page: number; pageSize: number }

export class EventHistoryRequestError extends Error {
    constructor(message: string, public status?: number) {
        super(message)
        this.name = 'EventHistoryRequestError'
    }
}

const requestFailure = (status: number): string => {
    if (status === 400) return '이벤트 조회 조건이 올바르지 않습니다. 조회 기간과 검색 조건을 확인하세요.'
    if (status === 401) return '이벤트 조회 인증에 실패했습니다. Netdive API 인증 정보를 확인하세요.'
    if (status === 403) return '이벤트 조회 권한이 없습니다. 접근 권한을 확인하세요.'
    if (status === 404) return '이벤트 조회 API를 찾을 수 없습니다. Netdive 서버에 이벤트 기능이 적용되어 있는지 확인하세요.'
    if (status === 408 || status === 504) return '이벤트 조회 시간이 초과되었습니다. 잠시 후 다시 조회하세요.'
    if (status === 503) return '이벤트 조회 서비스를 사용할 수 없습니다. Netdive 서버와 이벤트 저장소 상태를 확인하세요.'
    if (status >= 500) return '서버에서 이벤트를 조회하지 못했습니다. 잠시 후 다시 조회하세요.'
    return '이벤트를 조회하지 못했습니다. 잠시 후 다시 조회하세요.'
}

const networkFailure = () => new EventHistoryRequestError('Netdive 서버에 연결할 수 없습니다. 네트워크와 서버 실행 상태를 확인한 뒤 다시 조회하세요.')
const invalidResponse = () => new EventHistoryRequestError('이벤트 조회 응답 형식이 올바르지 않습니다. Netdive 서버 연결과 API 응답을 확인하세요.')

export async function listChangeEvents(userSession: session | undefined, filter: EventFilter, signal?: AbortSignal,
    fetcher: typeof fetch = (...args) => fetch(...args)): Promise<EventPage> {
    const params = new URLSearchParams()
    Object.keys(filter).forEach(key => { const value = (filter as any)[key]; if (value !== undefined && value !== '') params.set(key, String(value)) })
    const endpoint = (userSession?.endpoint || `${window.location.protocol}//${window.location.host}`).replace(/\/$/, '')
    let response: Response
    try {
        response = await fetcher(`${endpoint}/api/events?${params}`, {
            credentials: 'same-origin', cache: 'no-store', signal,
            headers: userSession?.token ? { 'X-Auth-Token': userSession.token } : {}
        })
    } catch (error) {
        // Cancelling an obsolete panel request is not a connection failure.
        if (signal?.aborted) throw error
        throw networkFailure()
    }
    // Do not expose raw English proxy/authentication/database errors in the UI.
    if (!response.ok) throw new EventHistoryRequestError(requestFailure(response.status), response.status)
    let body: EventPage
    try { body = await response.json() } catch (error) {
        if (signal?.aborted) throw error
        if (error instanceof TypeError) throw networkFailure()
        throw invalidResponse()
    }
    if (!body || !Array.isArray(body.events) || !Number.isInteger(body.total) || body.total < 0
        || !Number.isInteger(body.page) || body.page < 1 || !Number.isInteger(body.pageSize) || body.pageSize < 1) {
        throw invalidResponse()
    }
    return body
}
