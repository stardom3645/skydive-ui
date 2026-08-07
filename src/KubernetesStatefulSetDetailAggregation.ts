import { kubernetesQuantityText } from './DataPanels/common/kubernetesQuantity'

export type StatefulSetRolloutTone = 'success' | 'info' | 'warning' | 'danger' | 'default'

export interface StatefulSetRolloutInput {
    desired?: number
    ready?: number
    current?: number
    updated?: number
    unavailable?: number
    currentRevision?: string
    updateRevision?: string
    failed?: boolean
}

export interface StatefulSetRolloutEvaluation {
    label: '리비전 동기화 완료' | '업데이트 진행 중' | '가용성 저하' | '심각한 가용성 저하' | '알 수 없음'
    tone: StatefulSetRolloutTone
    verdict: '정상' | '업데이트 중' | '주의' | '위험' | '알 수 없음'
    impact: string
    synchronized: boolean
}

const knownNumber = (value: number | undefined): value is number =>
    value !== undefined && value !== null && Number.isFinite(value)

/** StatefulSet rollout is complete only when revision and every replica view
 * agree. A matching revision string alone must never promote the workload to
 * healthy. */
export const evaluateStatefulSetRollout = (input: StatefulSetRolloutInput): StatefulSetRolloutEvaluation => {
    const { desired, ready, current, updated, currentRevision, updateRevision } = input
    const unavailable = knownNumber(input.unavailable)
        ? input.unavailable
        : knownNumber(desired) && knownNumber(ready) ? Math.max(0, desired - ready) : undefined
    const replicaKnown = knownNumber(desired) && knownNumber(ready) && knownNumber(current) && knownNumber(updated)
    const revisionKnown = !!currentRevision && !!updateRevision
    if (!replicaKnown || !revisionKnown) {
        return { label: '알 수 없음', tone: 'default', verdict: '알 수 없음', impact: '가용성 영향 확인 불가', synchronized: false }
    }
    const desiredValue = desired as number
    const readyValue = ready as number
    const currentValue = current as number
    const updatedValue = updated as number
    if (input.failed || (desiredValue > 0 && readyValue === 0)) {
        return { label: '심각한 가용성 저하', tone: 'danger', verdict: '위험', impact: `${desiredValue - readyValue}개 복제본 미가용`, synchronized: false }
    }
    if ((unavailable || 0) > 0 || readyValue < desiredValue) {
        return { label: '가용성 저하', tone: 'warning', verdict: '주의', impact: `${Math.max(0, desiredValue - readyValue)}개 복제본 미가용`, synchronized: false }
    }
    const synchronized = currentRevision === updateRevision
        && currentValue === desiredValue
        && updatedValue === desiredValue
        && readyValue === desiredValue
        && (unavailable || 0) === 0
    if (synchronized) {
        return { label: '리비전 동기화 완료', tone: 'success', verdict: '정상', impact: '목표 복제본 충족', synchronized: true }
    }
    return { label: '업데이트 진행 중', tone: 'info', verdict: '업데이트 중', impact: '확인된 가용성 영향 없음', synchronized: false }
}

export interface StatefulSetPvcTemplateSummary {
    name: string
    storageClass: string
    requestedStorage: string
    accessModes: string
    volumeMode: string
}

const pick = (value: any, paths: string[]): any => {
    for (const path of paths) {
        const result = path.split('.').reduce((current, key) => current === undefined || current === null ? undefined : current[key], value)
        if (result !== undefined && result !== null && String(result).trim() !== '') return result
    }
    return undefined
}

export const statefulSetPvcTemplateSummaries = (templates: any[]): StatefulSetPvcTemplateSummary[] =>
    (Array.isArray(templates) ? templates : []).map((template, index) => {
        const accessModes = pick(template, ['Spec.AccessModes', 'spec.accessModes'])
        const requestedStorage = kubernetesQuantityText(pick(template, ['Spec.Resources.Requests.storage', 'spec.resources.requests.storage']))
        return {
            name: String(pick(template, ['ObjectMeta.Name', 'Metadata.Name', 'metadata.name']) || `PVC 템플릿 ${index + 1}`),
            storageClass: String(pick(template, ['Spec.StorageClassName', 'spec.storageClassName']) || '설정되지 않음'),
            requestedStorage: requestedStorage || '설정되지 않음',
            accessModes: Array.isArray(accessModes) && accessModes.length ? accessModes.join(', ') : '설정되지 않음',
            volumeMode: String(pick(template, ['Spec.VolumeMode', 'spec.volumeMode']) || '설정되지 않음')
        }
    })

export const statefulSetRelatedServiceNames = (
    declaredServiceName: string,
    selectorMatchedServiceNames: string[],
    endpointSliceServiceNames: string[]
): string[] => Array.from(new Set(
    (declaredServiceName ? [declaredServiceName] : [])
        .concat(selectorMatchedServiceNames || [], endpointSliceServiceNames || [])
        .filter(Boolean)
))

export const statefulSetRelatedPvcNames = (
    workloadName: string,
    templateNames: string[],
    podClaimNames: string[],
    candidateNames: string[]
): string[] => {
    const directClaims = new Set((podClaimNames || []).filter(Boolean))
    return (candidateNames || []).filter(name => directClaims.has(name)
        || (templateNames || []).some(templateName => name === templateName || name.indexOf(`${templateName}-${workloadName}-`) === 0))
}

export const statefulSetPersistentVolumeClaimNames = (podSpec: any): string[] => {
    const volumes = podSpec?.Volumes || podSpec?.volumes
    if (!Array.isArray(volumes)) return []
    return Array.from(new Set(volumes.map(volume => {
        const source = volume?.VolumeSource || volume
        return source?.PersistentVolumeClaim?.ClaimName || source?.persistentVolumeClaim?.claimName || ''
    }).filter(Boolean).map(String)))
}
