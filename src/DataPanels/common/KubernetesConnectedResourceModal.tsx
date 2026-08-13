import * as React from 'react'

import {
    ConnectedResourceListItem,
    ConnectedResourceListSection,
    HistoryModal
} from './DetailComponents'

export interface KubernetesConnectedResourceModalProps {
    visible: boolean
    title: React.ReactNode
    resourceLabel: React.ReactNode
    items: ConnectedResourceListItem[]
    onCancel: () => void
}

/** Shared Ant Modal for a connected-resource card's complete resource list. */
export const KubernetesConnectedResourceModal = ({
    visible,
    title,
    resourceLabel,
    items,
    onCancel
}: KubernetesConnectedResourceModalProps) => <HistoryModal visible={visible} title={title} onCancel={onCancel}>
    <ConnectedResourceListSection
        title={resourceLabel}
        groups={[{ key: 'resources', items }]}
        emptyText="연결된 자원이 없습니다." />
</HistoryModal>
