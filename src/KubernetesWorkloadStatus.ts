import { evaluateStatefulSetRollout } from './KubernetesStatefulSetDetailAggregation'
import { kubernetesDaemonSetPlacementHasProblem, kubernetesDaemonSetPlacementSnapshot } from './KubernetesDaemonSetDetailAggregation'

export interface KubernetesWorkloadHealth {
    tone: 'success' | 'info' | 'warning' | 'danger' | 'default'
    label: string
    conclusion: string
    progress: string
    progressTone: KubernetesWorkloadHealth['tone']
    findings: string[]
}
const field = (source: any, name: string): any => source?.[name] ?? source?.[name[0].toLowerCase() + name.slice(1)]
const count = (source: any, name: string): number | undefined => {
    const value = field(source, name)
    return value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? undefined : Number(value)
}
const result = (tone: KubernetesWorkloadHealth['tone'], conclusion: string, progress: string = conclusion): KubernetesWorkloadHealth => ({
    tone, label: ({ success: '정상', info: '업데이트 중', warning: '주의', danger: '위험', default: '알 수 없음' })[tone],
    conclusion, progress, progressTone: tone, findings: tone === 'danger' || tone === 'warning' ? [conclusion] : []
})

/** Current object state only: Pod/PVC problems and historical failures remain separate evidence. */
export const evaluateKubernetesWorkload = (kind: string, spec: any = {}, status: any = {}, metadata: any = {}): KubernetesWorkloadHealth => {
    kind = kind.toLowerCase()
    const conditions: any[] = field(status, 'Conditions') || []
    const condition = (type: string, value: string) => conditions.some(item =>
        String(field(item, 'Type')).toLowerCase() === type.toLowerCase() && String(field(item, 'Status')).toLowerCase() === value)
    const generation = count(metadata, 'Generation')
    const observed = count(status, 'ObservedGeneration')
    if (generation !== undefined && observed !== undefined && observed < generation) {
        return result('info', '최신 설정의 상태 반영 대기 중', 'observedGeneration 반영 대기')
    }
    if (kind === 'cronjob') return field(spec, 'Suspend') === true
        ? result('warning', '스케줄 일시 중지') : result('success', '현재 스케줄 설정 확인')
    if (!status || !Object.keys(status).length) return result('default', '워크로드 상태 확인 불가')
    if (kind === 'job') {
        const completed = condition('Complete', 'true')
            || (count(spec, 'Completions') !== undefined && (count(status, 'Succeeded') || 0) >= count(spec, 'Completions')!)
        if (completed) return result('success', 'Job 완료', '완료')
        if (condition('Failed', 'true') || condition('FailureTarget', 'true')) return result('danger', 'Job 실패 조건 확인', '실행 실패')
        if (condition('Suspended', 'true') || field(spec, 'Suspend') === true) return result('info', 'Job 실행 일시 중지', '일시 중지')
        if ((count(status, 'Active') || 0) > 0) return { ...result('info', 'Job 실행 중', '실행 중'), label: '진행 중' }
        if ((count(status, 'Failed') || 0) > 0) return result('warning', '재시도 또는 완료 조건 확인 필요', '실패 이력 존재 · 최종 실패 미확정')
        return { ...result('info', 'Job 실행 또는 완료 조건 대기', '실행 대기'), label: '진행 중' }
    }
    if (kind === 'daemonset') {
        const placement = kubernetesDaemonSetPlacementSnapshot(status)
        if (!placement.collected) return result('default', '배치 상태 확인 불가')
        return kubernetesDaemonSetPlacementHasProblem(placement)
            ? result('warning', '노드 배치 확인 필요', '배치 또는 업데이트 진행 확인 필요')
            : result('success', '배치 대상 노드 충족', '롤아웃 완료')
    }
    const desired = count(spec, 'Replicas') ?? count(status, 'DesiredReplicas')
    if (kind === 'statefulset') {
        const rollout = evaluateStatefulSetRollout({
            desired, ready: count(status, 'ReadyReplicas'), current: count(status, 'CurrentReplicas'),
            updated: count(status, 'UpdatedReplicas'), unavailable: count(status, 'UnavailableReplicas'),
            currentRevision: field(status, 'CurrentRevision'), updateRevision: field(status, 'UpdateRevision'),
            failed: conditions.some(item => String(field(item, 'Status')).toLowerCase() === 'true'
                && /fail|error/i.test(String(field(item, 'Type'))))
        })
        return result(rollout.tone, rollout.impact, rollout.label)
    }
    const available = count(status, 'AvailableReplicas') ?? count(status, 'ReadyReplicas')
    const updated = count(status, 'UpdatedReplicas')
    const unavailable = count(status, 'UnavailableReplicas') ?? (desired !== undefined && available !== undefined ? Math.max(0, desired - available) : undefined)
    if (desired === undefined || available === undefined) return result('default', '복제본 상태 확인 불가')
    // Fulfilled current replicas take precedence over a retained rollout failure reason.
    if (available >= desired && (updated === undefined || updated >= desired) && unavailable === 0) {
        return field(spec, 'Paused') === true ? result('info', '배포 일시 중지', '일시 중지') : result('success', '목표 복제본 충족', '롤아웃 완료')
    }
    const deadline = conditions.some(item => String(field(item, 'Type')).toLowerCase() === 'progressing'
        && String(field(item, 'Status')).toLowerCase() === 'false' && String(field(item, 'Reason')).toLowerCase() === 'progressdeadlineexceeded')
    if (desired > 0 && available === 0) return result('danger', '가용 복제본 없음', '롤아웃 지연')
    if (deadline || condition('ReplicaFailure', 'true')) return result('danger', '롤아웃 실패 조건 확인', '롤아웃 실패')
    if (available < desired || (unavailable || 0) > 0) return result('warning', '일부 복제본 미가용', '가용성 저하')
    if (field(spec, 'Paused') === true || (updated !== undefined && updated < desired)) return result('info', '리비전 적용 중', '업데이트 진행 중')
    return result('default', '복제본 상태 확인 불가')
}
