export type KubernetesConditionTone = 'success' | 'warning' | 'danger' | 'default'

export interface KubernetesConditionDefinition {
    label: string
    healthyStatus: 'True' | 'False'
    healthySummary: string
    unhealthySummary: string
}

export interface KubernetesConditionPresentation {
    key: string
    title: string
    rawType: string
    rawStatus: string
    reason: string
    message: string
    summary: string
    stateLabel: string
    tone: KubernetesConditionTone
    detail: string
}

const conditionValue = (condition: any, key: string): any =>
    condition?.[key] ?? condition?.[key.charAt(0).toLowerCase() + key.slice(1)]

export const DEPLOYMENT_CONDITION_DEFINITIONS: Record<string, KubernetesConditionDefinition> = {
    progressing: {
        label: '진행 상태', healthyStatus: 'True',
        healthySummary: '새 복제본 생성과 롤아웃이 정상적으로 진행되었거나 완료되었습니다.',
        unhealthySummary: 'Deployment 롤아웃 진행이 중단되었거나 완료되지 않았습니다.'
    },
    available: {
        label: '가용 상태', healthyStatus: 'True',
        healthySummary: '필요한 최소 복제본이 가용 상태입니다.',
        unhealthySummary: '필요한 최소 가용 복제본을 충족하지 못했습니다.'
    },
    replicafailure: {
        label: '복제본 실패', healthyStatus: 'False',
        healthySummary: '복제본 생성 또는 삭제 실패가 확인되지 않았습니다.',
        unhealthySummary: '복제본 생성 또는 삭제 과정에서 실패가 확인되었습니다.'
    }
}

export const DAEMONSET_CONDITION_DEFINITIONS: Record<string, KubernetesConditionDefinition> = {
    available: {
        label: '가용 상태', healthyStatus: 'True',
        healthySummary: '배치된 DaemonSet 파드가 필요한 가용 상태를 충족합니다.',
        unhealthySummary: '배치된 DaemonSet 파드가 필요한 가용 상태를 충족하지 못했습니다.'
    },
    progressing: {
        label: '진행 상태', healthyStatus: 'True',
        healthySummary: 'DaemonSet 배치와 업데이트가 정상적으로 진행되었거나 완료되었습니다.',
        unhealthySummary: 'DaemonSet 배치 또는 업데이트 진행을 확인해야 합니다.'
    },
    replicafailure: {
        label: '파드 배치 실패', healthyStatus: 'False',
        healthySummary: 'DaemonSet 파드 배치 실패가 확인되지 않았습니다.',
        unhealthySummary: 'DaemonSet 파드 배치 과정에서 실패가 확인되었습니다.'
    }
}

export const POD_CONDITION_DEFINITIONS: Record<string, KubernetesConditionDefinition> = {
    podreadytostartcontainers: {
        label: '컨테이너 시작 준비', healthyStatus: 'True',
        healthySummary: '파드 샌드박스와 네트워크 구성이 완료되어 컨테이너를 시작할 수 있습니다.',
        unhealthySummary: '컨테이너를 시작하기 위한 파드 샌드박스 또는 네트워크 구성이 완료되지 않았습니다.'
    },
    initialized: {
        label: '초기화 완료', healthyStatus: 'True',
        healthySummary: '필수 초기화 컨테이너가 정상적으로 완료되었습니다.',
        unhealthySummary: '초기화 컨테이너가 아직 완료되지 않았거나 실패했습니다.'
    },
    ready: {
        label: '준비 상태', healthyStatus: 'True',
        healthySummary: '파드가 트래픽을 처리할 수 있는 준비 상태입니다.',
        unhealthySummary: '파드가 아직 트래픽을 처리할 준비가 되지 않았습니다.'
    },
    containersready: {
        label: '컨테이너 준비', healthyStatus: 'True',
        healthySummary: '일반 컨테이너가 모두 준비 상태입니다.',
        unhealthySummary: '준비되지 않은 일반 컨테이너가 있습니다.'
    },
    podscheduled: {
        label: '스케줄링 상태', healthyStatus: 'True',
        healthySummary: '파드가 실행할 노드에 정상적으로 배치되었습니다.',
        unhealthySummary: '파드가 아직 실행할 노드에 배치되지 않았습니다.'
    }
}

export const kubernetesConditionPresentation = (
    condition: any,
    definitions: Record<string, KubernetesConditionDefinition> = {}
): KubernetesConditionPresentation => {
    const rawType = String(conditionValue(condition, 'Type') || '알 수 없음')
    const rawStatus = String(conditionValue(condition, 'Status') || '알 수 없음')
    const reason = String(conditionValue(condition, 'Reason') || '–')
    const message = String(conditionValue(condition, 'Message') || '')
    const configuredDefinition = definitions[rawType.toLowerCase()]
    const failureCondition = /failure|failed|error|degraded/.test(rawType.toLowerCase())
    const definition: KubernetesConditionDefinition = configuredDefinition || {
        label: rawType,
        healthyStatus: failureCondition ? 'False' : 'True',
        healthySummary: message || reason,
        unhealthySummary: message || reason
    }
    const normalizedStatus = rawStatus.toLowerCase()
    const unknown = normalizedStatus !== 'true' && normalizedStatus !== 'false'
    const healthy = !unknown && normalizedStatus === definition.healthyStatus.toLowerCase()
    const deadlineExceeded = reason.toLowerCase() === 'progressdeadlineexceeded'
    const tone: KubernetesConditionTone = unknown ? 'default' : healthy ? 'success' : deadlineExceeded || rawType.toLowerCase() === 'replicafailure' ? 'danger' : 'warning'
    return {
        key: rawType,
        title: definition.label,
        rawType,
        rawStatus,
        reason,
        message,
        summary: healthy ? definition.healthySummary : definition.unhealthySummary,
        stateLabel: unknown ? '미확인' : healthy ? '정상' : tone === 'danger' ? '위험' : '주의',
        tone,
        detail: [
            `Reason: ${reason}`,
            message ? `Message: ${message}` : '',
            conditionValue(condition, 'LastProbeTime') ? `Last probe: ${conditionValue(condition, 'LastProbeTime')}` : '',
            conditionValue(condition, 'LastHeartbeatTime') ? `Last heartbeat: ${conditionValue(condition, 'LastHeartbeatTime')}` : '',
            conditionValue(condition, 'LastUpdateTime') ? `Last update: ${conditionValue(condition, 'LastUpdateTime')}` : '',
            conditionValue(condition, 'LastTransitionTime') ? `Last transition: ${conditionValue(condition, 'LastTransitionTime')}` : ''
        ].filter(Boolean).join('\n')
    }
}
