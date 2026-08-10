import * as React from 'react'

import { DetailModalAction, HistoryModal } from './DetailComponents'
import {
    KubernetesModalResourceContext,
    KubernetesModalSection,
    KubernetesRawJsonCollapse,
    KubernetesStructuredDataRow,
    KubernetesStructuredDataTable
} from './KubernetesStructuredDataTable'
import { KubernetesSchedulingConfiguration } from './KubernetesSchedulingPresentation'

export interface KubernetesSchedulingModalActionProps {
    resourceKind: string
    resourceName: string
    configuration: KubernetesSchedulingConfiguration
    children: React.ReactNode
    title?: React.ReactNode
}

const formattedJson = (value: any): string => JSON.stringify(value, null, 2)
const objectSummary = (value: Record<string, any>): string => `JSON 객체 · ${Object.keys(value).length}개 필드`

/** Shared scheduling-detail action. It preserves nodeSelector, nodeAffinity and
 * tolerations as separate Kubernetes structures inside one Mold Modal. */
export const KubernetesSchedulingModalAction = ({
    resourceKind,
    resourceName,
    configuration,
    children,
    title = `${resourceKind} 스케줄링 조건`
}: KubernetesSchedulingModalActionProps) => {
    const [visible, setVisible] = React.useState(false)
    const nodeSelectorRows: KubernetesStructuredDataRow[] = Object.keys(configuration.nodeSelector).sort().map(key => ({
        id: `node-selector:${key}`,
        keyLabel: key,
        value: String(configuration.nodeSelector[key]),
        copyValue: `${key}=${configuration.nodeSelector[key]}`
    }))
    const affinityRows: KubernetesStructuredDataRow[] = Object.keys(configuration.nodeAffinity).sort().map(key => ({
        id: `affinity:${key}`,
        keyLabel: key,
        value: objectSummary(configuration.nodeAffinity[key] || {}),
        copyValue: formattedJson(configuration.nodeAffinity[key]),
        expandedValue: formattedJson(configuration.nodeAffinity[key])
    }))
    const tolerationRows: KubernetesStructuredDataRow[] = configuration.tolerations.map((toleration, index) => ({
        id: `toleration:${index}`,
        keyLabel: `허용 조건 ${index + 1}`,
        value: objectSummary(toleration || {}),
        copyValue: formattedJson(toleration),
        expandedValue: formattedJson(toleration)
    }))
    const raw = formattedJson({
        nodeSelector: configuration.nodeSelector,
        nodeAffinity: configuration.nodeAffinity,
        tolerations: configuration.tolerations
    })
    return <>
        <DetailModalAction onClick={() => setVisible(true)}>{children}</DetailModalAction>
        <HistoryModal visible={visible} title={title} onCancel={() => setVisible(false)}>
            <KubernetesModalResourceContext resourceKind={resourceKind} resourceName={resourceName} />
            <KubernetesModalSection title={`노드 선택자 ${nodeSelectorRows.length}개`} description="spec.template.spec.nodeSelector의 라벨 일치 조건입니다.">
                <KubernetesStructuredDataTable rows={nodeSelectorRows} valueTitle="값" emptyText="설정된 노드 선택자가 없습니다." />
            </KubernetesModalSection>
            <KubernetesModalSection title={`노드 Affinity 조건 ${configuration.affinityConditionCount}개`} description="nodeAffinity의 필수 조건과 선호 조건입니다.">
                <KubernetesStructuredDataTable rows={affinityRows} valueTitle="구성" emptyText="설정된 노드 Affinity가 없습니다." />
            </KubernetesModalSection>
            <KubernetesModalSection title={`허용 조건 ${tolerationRows.length}개`} description="spec.template.spec.tolerations에 설정된 Taint 허용 조건입니다.">
                <KubernetesStructuredDataTable rows={tolerationRows} valueTitle="구성" emptyText="설정된 허용 조건이 없습니다." />
            </KubernetesModalSection>
            <KubernetesRawJsonCollapse value={raw} title="원본 스케줄링 JSON 보기" copyTooltip="스케줄링 JSON 복사" />
        </HistoryModal>
    </>
}
