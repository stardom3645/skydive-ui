import {
    kubernetesContainerKindLabel,
    kubernetesPodPhaseLabel
} from './DataPanels/common/KubernetesDataPresentation'

export type KubernetesPodContainerTone = 'success' | 'warning' | 'danger' | 'default'
export { kubernetesPodPhaseLabel }

const value = (source: any, ...keys: string[]): any => {
    for (const key of keys) {
        if (source && source[key] !== undefined && source[key] !== null) return source[key]
    }
    return undefined
}

const list = (source: any, ...keys: string[]): any[] => {
    const candidate = value(source, ...keys)
    return Array.isArray(candidate) ? candidate : []
}

const localObjectName = (source: any): string => String(
    value(source, 'Name', 'name')
    || value(value(source, 'LocalObjectReference', 'localObjectReference'), 'Name', 'name')
    || ''
)

export const kubernetesPodContainerKindLabel = kubernetesContainerKindLabel

export interface KubernetesPodContainerRuntimePresentation {
    label: string
    tone: KubernetesPodContainerTone
    healthy: boolean
    readyLabel: string
}

export const kubernetesPodContainerRuntime = (container: any): KubernetesPodContainerRuntimePresentation => {
    const state = String(container?.state || '').toUpperCase()
    const kind = String(container?.type || '').toUpperCase()
    const reason = String(container?.waitingReason || container?.terminatedReason || '')
    const exitCode = container?.exitCode
    if (state === 'TERMINATED') {
        const completed = reason.toLowerCase() === 'completed' || Number(exitCode) === 0
        return {
            label: completed ? '완료' : reason || '종료됨',
            tone: completed ? 'success' : 'danger',
            healthy: completed,
            readyLabel: completed && kind === 'INIT' ? '완료' : '준비되지 않음'
        }
    }
    if (state === 'RUNNING') {
        const ready = container?.ready === true
        return {
            label: ready ? '실행 중' : '실행 중 · 준비되지 않음',
            tone: ready ? 'success' : 'warning',
            healthy: ready,
            readyLabel: ready ? '준비됨' : '준비되지 않음'
        }
    }
    if (state === 'WAITING') {
        const dangerous = /crashloopbackoff|imagepullbackoff|errimagepull|oomkilled|error/i.test(reason)
        return {
            label: reason || '대기 중',
            tone: dangerous ? 'danger' : 'warning',
            healthy: false,
            readyLabel: '준비되지 않음'
        }
    }
    return { label: '상태 미확인', tone: 'default', healthy: false, readyLabel: '미확인' }
}

/** Keep topology/spec-only data while allowing the richer API runtime state to win. */
export const mergeKubernetesPodDetail = (fallback: any, apiDetail: any): any => {
    const fallbackContainers = Array.isArray(fallback?.containers) ? fallback.containers : []
    const apiContainers = Array.isArray(apiDetail?.containers) ? apiDetail.containers : []
    const byKey = new Map<string, any>()
    fallbackContainers.forEach((container: any) => byKey.set(`${container.type || 'APPLICATION'}:${container.name}`, container))
    apiContainers.forEach((container: any) => {
        const key = `${container.type || 'APPLICATION'}:${container.name}`
        byKey.set(key, { ...(byKey.get(key) || {}), ...container })
    })
    return {
        ...fallback,
        ...apiDetail,
        labels: apiDetail?.labels === undefined ? fallback?.labels : apiDetail.labels,
        annotations: apiDetail?.annotations === undefined ? fallback?.annotations : apiDetail.annotations,
        conditions: apiDetail?.conditions === undefined ? fallback?.conditions : apiDetail.conditions,
        containers: Array.from(byKey.values())
    }
}

export interface KubernetesPodVolumeMount {
    containerName: string
    containerKind: string
    path: string
    readOnly: boolean
    subPath?: string
}

export interface KubernetesPodVolumeReference {
    kind: string
    name: string
    detail?: string
}

export interface KubernetesPodVolumePresentation {
    key: string
    name: string
    sourceType: string
    references: KubernetesPodVolumeReference[]
    mounts: KubernetesPodVolumeMount[]
    mountsCollected: boolean
    mountState: 'mounted' | 'none' | 'uncollected' | 'notApplicable'
    raw: any
}

const projectedReferences = (projected: any): KubernetesPodVolumeReference[] => list(projected, 'Sources', 'sources').map(source => {
    const secret = value(source, 'Secret', 'secret')
    if (secret) return { kind: 'Secret', name: localObjectName(secret) || '이름 미설정' }
    const configMap = value(source, 'ConfigMap', 'configMap')
    if (configMap) return { kind: 'ConfigMap', name: localObjectName(configMap) || '이름 미설정' }
    const downwardAPI = value(source, 'DownwardAPI', 'downwardAPI')
    if (downwardAPI) return { kind: 'DownwardAPI', name: `${list(downwardAPI, 'Items', 'items').length}개 항목` }
    const token = value(source, 'ServiceAccountToken', 'serviceAccountToken')
    if (token) return {
        kind: 'ServiceAccountToken',
        name: String(value(token, 'Path', 'path') || '경로 미설정'),
        detail: value(token, 'Audience', 'audience') ? `대상 ${value(token, 'Audience', 'audience')}` : undefined
    }
    return { kind: '기타 소스', name: '구조화된 원본에서 확인' }
})

const volumeSource = (volume: any): { sourceType: string, references: KubernetesPodVolumeReference[] } => {
    const source = value(volume, 'VolumeSource', 'volumeSource') || volume || {}
    const pvc = value(source, 'PersistentVolumeClaim', 'persistentVolumeClaim')
    const configMap = value(source, 'ConfigMap', 'configMap')
    const secret = value(source, 'Secret', 'secret')
    const csi = value(source, 'CSI', 'csi')
    if (pvc) return { sourceType: 'PVC', references: [{ kind: 'PVC', name: String(value(pvc, 'ClaimName', 'claimName') || '이름 미설정') }] }
    if (configMap) return { sourceType: 'ConfigMap', references: [{ kind: 'ConfigMap', name: localObjectName(configMap) || '이름 미설정' }] }
    if (secret) return { sourceType: 'Secret', references: [{ kind: 'Secret', name: String(value(secret, 'SecretName', 'secretName') || '이름 미설정') }] }
    if (value(source, 'EmptyDir', 'emptyDir')) return { sourceType: 'EmptyDir', references: [] }
    const projected = value(source, 'Projected', 'projected')
    if (projected) return { sourceType: 'Projected', references: projectedReferences(projected) }
    const downwardAPI = value(source, 'DownwardAPI', 'downwardAPI')
    if (downwardAPI) return { sourceType: 'DownwardAPI', references: [{ kind: 'DownwardAPI', name: `${list(downwardAPI, 'Items', 'items').length}개 항목` }] }
    const hostPath = value(source, 'HostPath', 'hostPath')
    if (hostPath) return { sourceType: 'HostPath', references: [{ kind: '호스트 경로', name: String(value(hostPath, 'Path', 'path') || '경로 미설정'), detail: value(hostPath, 'Type', 'type') ? `유형 ${value(hostPath, 'Type', 'type')}` : undefined }] }
    if (csi) {
        const secretRef = value(csi, 'NodePublishSecretRef', 'nodePublishSecretRef')
        return {
            sourceType: 'CSI',
            references: [
                { kind: 'CSI 드라이버', name: String(value(csi, 'Driver', 'driver') || '드라이버 미설정'), detail: value(csi, 'VolumeAttributes', 'volumeAttributes') ? '볼륨 속성 설정됨' : undefined },
                ...(secretRef ? [{ kind: 'Secret', name: localObjectName(secretRef) || '이름 미설정', detail: value(secretRef, 'Namespace', 'namespace') ? `네임스페이스 ${value(secretRef, 'Namespace', 'namespace')}` : undefined }] : [])
            ]
        }
    }
    const ignoredKeys = new Set(['Name', 'name', 'VolumeSource', 'volumeSource'])
    const detectedType = Object.keys(source).find(key => !ignoredKeys.has(key) && source[key] !== undefined && source[key] !== null)
    if (detectedType) {
        const detected = source[detectedType]
        if (detectedType.toLowerCase() === 'nfs') {
            const server = String(value(detected, 'Server', 'server') || '')
            const path = String(value(detected, 'Path', 'path') || '')
            return { sourceType: 'NFS', references: [{ kind: 'NFS 경로', name: [server, path].filter(Boolean).join(':') || '경로 미설정' }] }
        }
        return { sourceType: detectedType, references: [] }
    }
    return { sourceType: '알 수 없음', references: [] }
}

export const kubernetesPodVolumePresentations = (spec: any): KubernetesPodVolumePresentation[] => {
    const volumes = list(spec, 'Volumes', 'volumes')
    const mountsCollected = ['InitContainers', 'initContainers', 'Containers', 'containers', 'EphemeralContainers', 'ephemeralContainers']
        .some(key => !!spec && Object.prototype.hasOwnProperty.call(spec, key))
    const containers = ([] as Array<{ container: any, kind: string }>).concat(
        list(spec, 'InitContainers', 'initContainers').map(container => ({ container, kind: '초기화 컨테이너' })),
        list(spec, 'Containers', 'containers').map(container => ({ container, kind: '일반 컨테이너' })),
        list(spec, 'EphemeralContainers', 'ephemeralContainers').map(container => ({ container, kind: '임시 컨테이너' }))
    )
    const byName = new Map<string, KubernetesPodVolumePresentation>()
    volumes.forEach(volume => {
        const name = String(value(volume, 'Name', 'name') || '')
        if (!name || byName.has(name)) return
        const source = volumeSource(volume)
        const mounts: KubernetesPodVolumeMount[] = []
        containers.forEach(item => list(item.container, 'VolumeMounts', 'volumeMounts').forEach(mount => {
            if (String(value(mount, 'Name', 'name') || '') !== name) return
            mounts.push({
                containerName: String(value(item.container, 'Name', 'name') || ''),
                containerKind: item.kind,
                path: String(value(mount, 'MountPath', 'mountPath') || ''),
                readOnly: value(mount, 'ReadOnly', 'readOnly') === true,
                subPath: String(value(mount, 'SubPath', 'subPath') || '') || undefined
            })
        }))
        byName.set(name, {
            key: name,
            name,
            sourceType: source.sourceType,
            references: source.references,
            mounts,
            mountsCollected,
            mountState: !mountsCollected ? 'uncollected' : mounts.length ? 'mounted' : 'none',
            raw: volume
        })
    })
    return Array.from(byName.values())
}
