import { kubernetesPvOperationalPresentation } from './KubernetesPersistentVolumeDetailAggregation'
import { kubernetesPvcOperationalPresentation } from './KubernetesPersistentVolumeClaimDetailAggregation'

/** One binding policy for topology badges, attention lists and detail panels.
 * Missing related inventory is a collection limitation, not proof that a Bound
 * claim has lost its volume. Kubernetes phase remains the binding authority. */
export const kubernetesStorageOperationalPresentation = (input: {
    type: string; phase?: any; claimName?: any; volumeName?: any
    collection?: 'collected' | 'unavailable' | 'stale'
}) => {
    if (input.collection && input.collection !== 'collected') return {
        verdict: '미확인' as const, tone: 'default' as const, impact: '확인 불가',
        currentProblem: input.collection === 'stale' ? '상태 데이터가 오래됨' : '상태 미수집'
    }
    return input.type.toLowerCase() === 'persistentvolume'
        ? kubernetesPvOperationalPresentation(input.phase, input.claimName)
        : kubernetesPvcOperationalPresentation({ phase: input.phase, volumeName: input.volumeName })
}

const scalar = (sources: any[], paths: string[]): any => {
    for (const source of sources) for (const path of paths) {
        const value = path.split('.').reduce((current, key) => current?.[key], source)
        if (['string', 'number', 'boolean'].includes(typeof value) && String(value).trim()) return value
    }
    return undefined
}

export const kubernetesStorageObservation = (data: any, observation?: any) => {
    const sources = observation ? [observation, data] : [data]
    return {
        type: String(data?.Type || '').toLowerCase(),
        phase: scalar(sources, ['phase', 'Phase', 'status.phase', 'Status.Phase', 'Status.phase',
            'K8s.Extra.Status.Phase', 'K8s.Extra.Status.phase', 'K8s.Extra.status.phase',
            'K8s.StatusObject.Phase', 'K8s.StatusObject.phase', 'StatusObject.Phase', 'StatusObject.phase', 'K8s.Status', 'Status', 'State']),
        claimName: scalar(sources, ['spec.claimRef.name', 'Spec.ClaimRef.Name', 'Spec.claimRef.name',
            'K8s.Extra.Spec.ClaimRef.Name', 'K8s.Extra.Spec.claimRef.name', 'K8s.Extra.spec.claimRef.name',
            'K8s.Spec.ClaimRef.Name', 'K8s.Spec.claimRef.name', 'K8s.ClaimRef', 'ClaimRef']),
        volumeName: scalar(sources, ['spec.volumeName', 'Spec.VolumeName', 'Spec.volumeName',
            'K8s.Extra.Spec.VolumeName', 'K8s.Extra.Spec.volumeName', 'K8s.Extra.spec.volumeName',
            'K8s.Spec.VolumeName', 'K8s.Spec.volumeName', 'K8s.volumeName', 'K8s.VolumeName', 'VolumeName', 'volumeName'])
    }
}
