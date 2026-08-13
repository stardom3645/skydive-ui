export type KubernetesPvcOperationalTone = 'success' | 'warning' | 'danger' | 'default'

export interface KubernetesPvcOperationalInput {
    phase?: any
    volumeName?: any
    boundPvFound: boolean
}

export interface KubernetesPvcOperationalPresentation {
    verdict: '정상' | '보완 권장' | '위험' | '미확인'
    tone: KubernetesPvcOperationalTone
    impact: string
    currentProblem: string
}

/** PVC health comes from current Kubernetes API state. Event collection is
 * intentionally absent here so observability failures cannot become PVC
 * failures. */
export const kubernetesPvcOperationalPresentation = ({
    phase,
    volumeName,
    boundPvFound
}: KubernetesPvcOperationalInput): KubernetesPvcOperationalPresentation => {
    const normalizedPhase = String(phase ?? '').trim().toLowerCase()
    const hasVolumeName = String(volumeName ?? '').trim().length > 0
    if (!normalizedPhase) {
        return { verdict: '미확인', tone: 'default', impact: '확인 불가', currentProblem: '확인 불가' }
    }
    if (normalizedPhase === 'lost') {
        return { verdict: '위험', tone: 'danger', impact: '영향 확인 필요', currentProblem: '바인딩 손실' }
    }
    if (normalizedPhase === 'pending') {
        return { verdict: '보완 권장', tone: 'warning', impact: '영향 확인 필요', currentProblem: '바인딩 대기' }
    }
    if (normalizedPhase === 'bound') {
        if (hasVolumeName && boundPvFound) {
            return { verdict: '정상', tone: 'success', impact: '확인된 영향 없음', currentProblem: '없음' }
        }
        return { verdict: '보완 권장', tone: 'warning', impact: '확인 불가', currentProblem: 'PV 관계 확인 필요' }
    }
    return { verdict: '미확인', tone: 'default', impact: '확인 불가', currentProblem: '확인 필요' }
}
