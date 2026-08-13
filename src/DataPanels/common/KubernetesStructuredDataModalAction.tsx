import * as React from 'react'

import { DetailModalAction, HistoryModal } from './DetailComponents'
import {
    KubernetesModalResourceContext,
    KubernetesModalSection,
    KubernetesRawJsonCollapse,
    KubernetesStructuredDataRow,
    KubernetesStructuredDataTable
} from './KubernetesStructuredDataTable'

export interface KubernetesStructuredDataModalActionProps {
    resourceKind: string
    resourceName: string
    title: React.ReactNode
    sectionTitle: React.ReactNode
    description?: React.ReactNode
    rows: KubernetesStructuredDataRow[]
    valueTitle?: React.ReactNode
    operatorTitle?: React.ReactNode
    emptyText?: React.ReactNode
    rawValue?: any
    rawTitle?: React.ReactNode
    children: React.ReactNode
}

/** Shared key/value policy-detail action for Kubernetes resources. Panels
 * provide normalized rows and retain their resource-specific data meaning. */
export const KubernetesStructuredDataModalAction = ({
    resourceKind,
    resourceName,
    title,
    sectionTitle,
    description,
    rows,
    valueTitle = '값',
    operatorTitle,
    emptyText = '설정된 값이 없습니다.',
    rawValue,
    rawTitle = '원본 JSON 보기',
    children
}: KubernetesStructuredDataModalActionProps) => {
    const [visible, setVisible] = React.useState(false)
    const serialized = JSON.stringify(rawValue === undefined ? {} : rawValue, null, 2)
    return <>
        <DetailModalAction onClick={() => setVisible(true)}>{children}</DetailModalAction>
        <HistoryModal visible={visible} title={title} onCancel={() => setVisible(false)}>
            <KubernetesModalResourceContext resourceKind={resourceKind} resourceName={resourceName} />
            <KubernetesModalSection title={sectionTitle} description={description}>
                <KubernetesStructuredDataTable
                    rows={rows}
                    operatorTitle={operatorTitle}
                    valueTitle={valueTitle}
                    emptyText={emptyText} />
            </KubernetesModalSection>
            {rawValue !== undefined && <KubernetesRawJsonCollapse value={serialized} title={rawTitle} />}
        </HistoryModal>
    </>
}
