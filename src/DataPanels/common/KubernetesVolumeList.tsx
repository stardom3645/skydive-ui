import * as React from 'react'

import { KubernetesPodVolumePresentation } from '../../KubernetesPodDetailAggregation'
import {
    BasicInfoRows,
    DetailCompactResourceItem,
    DetailCompactResourceList,
    DetailEmpty,
    HistoryModal
} from './DetailComponents'
import {
    KubernetesModalResourceContext,
    KubernetesModalSection,
    KubernetesRawJsonCollapse,
    KubernetesStructuredDataTable
} from './KubernetesStructuredDataTable'

export interface KubernetesVolumeListProps {
    resourceName: string
    resourceKind: string
    volumes: KubernetesPodVolumePresentation[]
}

export interface KubernetesVolumeDetailModalProps {
    visible: boolean
    resourceName: string
    resourceKind: string
    volume?: KubernetesPodVolumePresentation
    onCancel: () => void
}

const mountStateLabel = (state: KubernetesPodVolumePresentation['mountState'], count: number): string => {
    if (state === 'mounted') return `마운트 ${count}개`
    if (state === 'none') return '마운트 없음'
    if (state === 'notApplicable') return '해당 없음'
    return '수집되지 않음'
}

export const KubernetesVolumeDetailModal = ({
    visible,
    resourceName,
    resourceKind,
    volume,
    onCancel
}: KubernetesVolumeDetailModalProps) => <HistoryModal visible={visible} title="볼륨 상세" onCancel={onCancel}>
    {volume && <React.Fragment>
        <KubernetesModalResourceContext
            resourceKind={`${volume.sourceType} 볼륨`}
            resourceName={volume.name}
            copyTooltip="볼륨 이름 복사"
            contextLabel={resourceKind}
            contextValue={resourceName}
            contextCopyTooltip={`${resourceKind} 이름 복사`}
            variant="subject" />
        {volume.references.length > 0 && <KubernetesModalSection title="참조 대상" description="볼륨 소스가 참조하는 Kubernetes 객체 또는 외부 경로입니다.">
            {volume.references.length === 1 ? <BasicInfoRows
                density="compact"
                labelWidth={92}
                className="netdive-k8s-modal-structured-rows"
                copyTooltip={`${volume.references[0].kind} 참조 값 복사`}
                rows={[
                    {
                        label: volume.references[0].kind,
                        value: volume.references[0].name,
                        textValue: volume.references[0].name,
                        copyText: volume.references[0].name,
                        tooltip: volume.references[0].detail,
                        wrap: true
                    }
                ]}
            /> : <KubernetesStructuredDataTable
                keyTitle="종류"
                valueTitle="참조 값"
                emptyText="이 볼륨 유형에는 참조 대상이 없습니다."
                columnWidths={{ key: '32%', action: 44 }}
                rows={volume.references.map((reference, index) => ({
                    id: `${reference.kind}:${reference.name}:${index}`,
                    keyLabel: reference.kind,
                    keySecondary: reference.detail,
                    value: reference.name,
                    copyValue: reference.name,
                    copyTooltip: `${reference.kind} 참조 값 복사`
                }))} />}
        </KubernetesModalSection>}
        <KubernetesModalSection title="마운트 정보" description="컨테이너별 마운트 경로와 읽기 전용 여부입니다.">
            {volume.mountState === 'mounted' ? <div className="netdive-k8s-volume-detail__mounts">{volume.mounts.map((mount, index) => <BasicInfoRows
                key={`${mount.containerName}:${mount.path}:${index}`}
                density="compact"
                labelWidth={92}
                className="netdive-k8s-modal-structured-rows netdive-k8s-volume-detail__mount"
                copyTooltip="마운트 경로 복사"
                rows={[
                    {
                        label: '컨테이너',
                        value: <span className="netdive-k8s-volume-detail__container-value"><strong>{mount.containerName}</strong><small>{mount.containerKind}</small></span>,
                        wrap: true
                    },
                    {
                        label: '마운트 경로',
                        value: <span>{mount.path || '확인 불가'}{mount.subPath && <small className="netdive-k8s-structured-table__cell-secondary">subPath {mount.subPath}</small>}</span>,
                        textValue: mount.path || undefined,
                        copyText: mount.path || undefined,
                        wrap: true
                    },
                    { label: '읽기 전용', value: mount.readOnly ? '예' : '아니오' }
                ]} />)}</div> : <DetailEmpty
                compact
                className={`netdive-k8s-volume-detail__empty is-${volume.mountState}`}
                description={volume.mountState === 'none'
                    ? '마운트 없음'
                    : volume.mountState === 'notApplicable' ? '해당 없음' : '수집되지 않음'} />}
        </KubernetesModalSection>
        <KubernetesRawJsonCollapse value={JSON.stringify(volume.raw, null, 2)} title="원본 볼륨 JSON 보기" />
    </React.Fragment>}
</HistoryModal>

export const KubernetesVolumeList = ({ resourceName, resourceKind, volumes }: KubernetesVolumeListProps) => {
    const [selectedKey, setSelectedKey] = React.useState<string | undefined>()
    const selected = volumes.find(volume => volume.key === selectedKey)
    return <React.Fragment>
        <DetailCompactResourceList>{volumes.map(volume => <DetailCompactResourceItem
            key={volume.key}
            name={volume.name}
            metadata={`${volume.sourceType} · ${mountStateLabel(volume.mountState, volume.mounts.length)}`}
            onClick={() => setSelectedKey(volume.key)}
        />)}</DetailCompactResourceList>
        <KubernetesVolumeDetailModal
            visible={!!selected}
            resourceName={resourceName}
            resourceKind={resourceKind}
            volume={selected}
            onCancel={() => setSelectedKey(undefined)} />
    </React.Fragment>
}
