export interface KubernetesPvOperationalPresentation {
    verdict: '정상' | '보완 권장' | '위험' | '미확인'
    tone: 'success' | 'warning' | 'danger' | 'default'
    impact: string
    currentProblem: string
}

export const kubernetesPvOperationalPresentation = (phase: any, claimName?: any): KubernetesPvOperationalPresentation => {
    const normalized = String(phase ?? '').trim().toLowerCase()
    if (!normalized) return { verdict: '미확인', tone: 'default', impact: '확인 불가', currentProblem: '확인 불가' }
    if (normalized === 'failed') return { verdict: '위험', tone: 'danger', impact: '영향 확인 필요', currentProblem: '바인딩 실패' }
    if (normalized === 'released') return { verdict: '보완 권장', tone: 'warning', impact: '영향 확인 필요', currentProblem: '클레임 해제 후 회수 대기' }
    if (normalized === 'bound') return String(claimName ?? '').trim()
        ? { verdict: '정상', tone: 'success', impact: '확인된 영향 없음', currentProblem: '없음' }
        : { verdict: '보완 권장', tone: 'warning', impact: '확인 불가', currentProblem: '클레임 참조 확인 필요' }
    if (normalized === 'available') return { verdict: '정상', tone: 'success', impact: '확인된 영향 없음', currentProblem: '없음' }
    return { verdict: '미확인', tone: 'default', impact: '확인 불가', currentProblem: '확인 필요' }
}

export interface KubernetesPvSourceField { label: string, value: string }
export interface KubernetesPvSourcePresentation { type: string, fields: KubernetesPvSourceField[] }

export interface KubernetesPvNodeAffinityCondition {
    id: string
    termIndex: number
    scope: 'label' | 'field'
    key: string
    operator: string
    values: string[]
    raw: any
}

export interface KubernetesPvNodeAffinityPresentation {
    conditions: KubernetesPvNodeAffinityCondition[]
    conditionCount: number
    simpleNodeName?: string
    showPolicyDetail: boolean
}

const objectField = (value: any, ...keys: string[]): any => {
    if (!value || typeof value !== 'object') return undefined
    for (const key of keys) if (value[key] !== undefined && value[key] !== null && value[key] !== '') return value[key]
    return undefined
}
const textValue = (value: any): string => Array.isArray(value)
    ? value.map(String).join(', ')
    : value && typeof value === 'object'
        ? Object.keys(value).sort().map(key => `${key}=${String(value[key])}`).join(', ')
        : String(value)

const arrayValue = (value: any): any[] => Array.isArray(value) ? value : []

/** Separates a single explicit metadata.name relation from reusable
 * node-affinity policy. Label expressions and multi-term requirements remain
 * available for the shared structured-data Modal instead of being flattened
 * into a misleading "fixed node" value. */
export const kubernetesPvNodeAffinityPresentation = (nodeAffinity: any): KubernetesPvNodeAffinityPresentation => {
    const required = objectField(nodeAffinity, 'Required', 'required') || {}
    const terms = arrayValue(objectField(required, 'NodeSelectorTerms', 'nodeSelectorTerms'))
    const conditions: KubernetesPvNodeAffinityCondition[] = []
    terms.forEach((term, termIndex) => {
        const append = (scope: 'label' | 'field', requirements: any[]) => requirements.forEach((requirement, requirementIndex) => {
            const key = String(objectField(requirement, 'Key', 'key') || '')
            const operator = String(objectField(requirement, 'Operator', 'operator') || '')
            const values = arrayValue(objectField(requirement, 'Values', 'values')).map(String)
            conditions.push({
                id: `node-affinity:${termIndex}:${scope}:${requirementIndex}:${key}`,
                termIndex,
                scope,
                key,
                operator,
                values,
                raw: requirement
            })
        })
        append('label', arrayValue(objectField(term, 'MatchExpressions', 'matchExpressions')))
        append('field', arrayValue(objectField(term, 'MatchFields', 'matchFields')))
    })
    const only = conditions.length === 1 ? conditions[0] : undefined
    const simpleNodeName = terms.length === 1
        && only?.scope === 'field'
        && only.key === 'metadata.name'
        && only.operator.toLowerCase() === 'in'
        && only.values.length === 1
        ? only.values[0]
        : undefined
    return {
        conditions,
        conditionCount: conditions.length || terms.length,
        simpleNodeName,
        showPolicyDetail: !!nodeAffinity && (conditions.length > 0 || terms.length > 0) && !simpleNodeName
    }
}

/** Normalizes the source union without flattening every backend into one
 * guessed shape. Only fields meaningful to the detected Kubernetes source are
 * returned. */
export const kubernetesPvSourcePresentation = (spec: any): KubernetesPvSourcePresentation | undefined => {
    const source = objectField(spec, 'PersistentVolumeSource', 'persistentVolumeSource') || spec || {}
    const definitions: Array<{ type: string, keys: string[], fields: Array<[string, string[]]> }> = [
        { type: 'CSI', keys: ['CSI', 'csi'], fields: [['드라이버', ['Driver', 'driver']], ['볼륨 핸들', ['VolumeHandle', 'volumeHandle']], ['파일시스템 유형', ['FSType', 'fsType']], ['읽기 전용', ['ReadOnly', 'readOnly']], ['볼륨 속성', ['VolumeAttributes', 'volumeAttributes']]] },
        { type: 'Local', keys: ['Local', 'local'], fields: [['경로', ['Path', 'path']], ['파일시스템 유형', ['FSType', 'fsType']]] },
        { type: 'HostPath', keys: ['HostPath', 'hostPath'], fields: [['호스트 경로', ['Path', 'path']], ['경로 유형', ['Type', 'type']]] },
        { type: 'NFS', keys: ['NFS', 'nfs'], fields: [['서버', ['Server', 'server']], ['경로', ['Path', 'path']], ['읽기 전용', ['ReadOnly', 'readOnly']]] },
        { type: 'iSCSI', keys: ['ISCSI', 'iSCSI', 'iscsi'], fields: [['대상 포털', ['TargetPortal', 'targetPortal']], ['IQN', ['IQN', 'iqn']], ['LUN', ['Lun', 'lun']], ['파일시스템 유형', ['FSType', 'fsType']], ['읽기 전용', ['ReadOnly', 'readOnly']]] },
        { type: 'CephFS', keys: ['CephFS', 'cephfs'], fields: [['모니터', ['Monitors', 'monitors']], ['경로', ['Path', 'path']], ['사용자', ['User', 'user']], ['읽기 전용', ['ReadOnly', 'readOnly']]] },
        { type: 'RBD', keys: ['RBD', 'rbd'], fields: [['모니터', ['CephMonitors', 'monitors']], ['이미지', ['RBDImage', 'rbdImage']], ['풀', ['RBDPool', 'rbdPool']], ['사용자', ['RadosUser', 'user']], ['읽기 전용', ['ReadOnly', 'readOnly']]] },
        { type: 'FC', keys: ['FC', 'fc'], fields: [['대상 WWN', ['TargetWWNs', 'targetWWNs']], ['LUN', ['Lun', 'lun']], ['파일시스템 유형', ['FSType', 'fsType']], ['읽기 전용', ['ReadOnly', 'readOnly']]] },
        { type: 'AzureDisk', keys: ['AzureDisk', 'azureDisk'], fields: [['디스크 이름', ['DiskName', 'diskName']], ['데이터 디스크 URI', ['DataDiskURI', 'dataDiskURI']], ['파일시스템 유형', ['FSType', 'fsType']], ['읽기 전용', ['ReadOnly', 'readOnly']]] },
        { type: 'GCEPersistentDisk', keys: ['GCEPersistentDisk', 'gcePersistentDisk'], fields: [['디스크 이름', ['PDName', 'pdName']], ['파일시스템 유형', ['FSType', 'fsType']], ['파티션', ['Partition', 'partition']], ['읽기 전용', ['ReadOnly', 'readOnly']]] },
        { type: 'AWSElasticBlockStore', keys: ['AWSElasticBlockStore', 'awsElasticBlockStore'], fields: [['볼륨 ID', ['VolumeID', 'volumeID']], ['파일시스템 유형', ['FSType', 'fsType']], ['파티션', ['Partition', 'partition']], ['읽기 전용', ['ReadOnly', 'readOnly']]] }
    ]
    for (const definition of definitions) {
        const detail = objectField(source, ...definition.keys)
        if (!detail || typeof detail !== 'object') continue
        return {
            type: definition.type,
            fields: definition.fields.map(([label, keys]) => ({ label, value: objectField(detail, ...keys) }))
                .filter(item => item.value !== undefined).map(item => ({ label: item.label, value: textValue(item.value) }))
        }
    }
    return undefined
}
