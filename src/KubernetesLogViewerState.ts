import { KubernetesPodLogError, KubernetesPodLogs } from './KubernetesPodLogs'

export interface KubernetesLogFailure {
    kind: 'authentication' | 'permission' | 'network' | 'timeout' | 'previous-unavailable' | 'failure'
    title: string
    description: string
}
/** No log text inspection: ERROR/WARN output never changes the request status. */
export function kubernetesLogFailure(error: unknown, previous: boolean, timedOut = false): KubernetesLogFailure {
    const api = error instanceof KubernetesPodLogError ? error : undefined
    if (api?.status === 401 || api?.code === 'KUBERNETES_AUTHENTICATION_FAILED') return {
        kind: 'authentication', title: '인증을 확인해 주세요.',
        description: api.code === 'KUBERNETES_AUTHENTICATION_FAILED'
            ? 'Kubernetes 인증에 실패했습니다. 클러스터 연동의 인증 정보를 확인한 뒤 다시 시도하세요.'
            : 'Netdive 로그인 상태 또는 클러스터 인증 정보를 확인한 뒤 다시 시도하세요.'
    }
    if (api?.status === 403 || api?.code === 'LOG_PERMISSION_DENIED') return {
        kind: 'permission', title: '로그 조회 권한이 없습니다.',
        description: '클러스터 접근 권한과 pods/log 읽기 권한을 확인한 뒤 다시 시도하세요.'
    }
    if (previous && api?.code === 'PREVIOUS_LOG_UNAVAILABLE') return {
        kind: 'previous-unavailable', title: '이전 로그가 없습니다.',
        description: '재시작 직전 컨테이너의 로그가 남아 있지 않습니다.'
    }
    if (timedOut || api?.status === 504 || api?.status === 408 || api?.code === 'LOG_TIMEOUT') return {
        kind: 'timeout', title: '로그 조회 시간이 초과되었습니다.', description: '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도하세요.'
    }
    if (error instanceof TypeError) return {
        kind: 'network', title: '서버에 연결할 수 없습니다.', description: '네트워크와 Netdive 서버 연결 상태를 확인한 뒤 다시 시도하세요.'
    }
    return { kind: 'failure', title: '로그를 조회하지 못했습니다.',
        description: error instanceof Error && error.message ? error.message : '잠시 후 다시 시도하세요.' }
}

export interface KubernetesLogLoadState {
    key: string; loading: boolean; result?: KubernetesPodLogs; failure?: KubernetesLogFailure
}
export type KubernetesLogLoadAction = { type: 'start'; key: string }
    | { type: 'success'; key: string; result: KubernetesPodLogs }
    | { type: 'failure'; key: string; failure: KubernetesLogFailure }

export function kubernetesLogLoadReducer(state: KubernetesLogLoadState, action: KubernetesLogLoadAction): KubernetesLogLoadState {
    if (action.type === 'start') return { key: action.key, loading: true, result: state.key === action.key ? state.result : undefined }
    // A late response from an obsolete selection must never replace the viewer.
    if (action.key !== state.key) return state
    if (action.type === 'success') return { key: action.key, loading: false, result: action.result }
    return { key: action.key, loading: false, failure: action.failure,
        result: action.failure.kind === 'previous-unavailable' ? undefined : state.result }
}

export function kubernetesLogStatus(state: KubernetesLogLoadState, previous: boolean): string {
    if (state.loading) return state.result ? '갱신 중' : '로그 불러오는 중'
    if (state.failure) return ({ authentication: '인증 오류', permission: '권한 부족', network: '연결 오류',
        timeout: '시간 초과', 'previous-unavailable': '이전 로그 없음', failure: '조회 실패' })[state.failure.kind]
    if (state.result) return state.result.logs ? '조회 완료' : previous ? '이전 로그 없음' : '로그 없음'
    return '조회 대기'
}
