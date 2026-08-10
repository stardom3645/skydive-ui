import * as React from 'react'
import { RightOutlined } from '@ant-design/icons'

import {
    DetailEmpty,
    HistoryModal
} from './DetailComponents'
import {
    KubernetesModalResourceContext,
    KubernetesModalSection,
    KubernetesRawJsonCollapse,
    KubernetesStructuredDataRow,
    KubernetesStructuredDataTable
} from './KubernetesStructuredDataTable'
import {
    KubernetesMetadataKind,
    normalizeKubernetesMetadata,
    serializeKubernetesMetadata
} from './KubernetesMetadataPresentation'

export interface KubernetesMetadataModalProps {
    visible: boolean
    onCancel: () => void
    resourceName: string
    resourceKind: string
    metadataKind: KubernetesMetadataKind
    data: Record<string, any> | undefined | null
    title: React.ReactNode
    description?: React.ReactNode
    excludedKeys?: string[]
}

export const KubernetesMetadataModal = ({
    visible,
    onCancel,
    resourceName,
    resourceKind,
    metadataKind,
    data,
    title,
    description,
    excludedKeys = []
}: KubernetesMetadataModalProps) => {
    const entries = normalizeKubernetesMetadata(data, excludedKeys)
    const serialized = serializeKubernetesMetadata(entries)
    const kindLabel = metadataKind === 'label' ? '라벨' : '어노테이션'
    const rows: KubernetesStructuredDataRow[] = entries.map(entry => ({
        id: entry.key,
        keyLabel: entry.displayKey,
        keySecondary: entry.displayKey !== entry.key ? entry.key : undefined,
        value: entry.displayValue,
        copyValue: `${entry.key}=${entry.copyValue}`,
        expandedValue: entry.structured ? entry.copyValue : undefined
    }))
    return <HistoryModal
        visible={visible}
        title={title}
        onCancel={onCancel}
        className="netdive-detail-metadata-modal">
        <KubernetesModalResourceContext resourceKind={resourceKind} resourceName={resourceName} />
        <KubernetesModalSection
            title={kindLabel}
            description={`총 ${entries.length}개 · ${description || `이 자원에 설정된 ${kindLabel} 키와 값입니다.`}`}>
            {entries.length === 0 ? <DetailEmpty description={`설정된 ${kindLabel}이 없습니다.`} compact /> : <KubernetesStructuredDataTable
                rows={rows}
                valueTitle="값"
                emptyText={`설정된 ${kindLabel}이 없습니다.`}
            />}
        </KubernetesModalSection>
        {entries.length > 0 && <KubernetesRawJsonCollapse value={serialized} copyTooltip={`전체 ${kindLabel} 복사`} />}
    </HistoryModal>
}

export interface KubernetesMetadataRowItem {
    key: React.Key
    label: React.ReactNode
    resourceName: string
    resourceKind: string
    metadataKind: KubernetesMetadataKind
    data: Record<string, any> | undefined | null
    excludedKeys?: string[]
    modalTitle: React.ReactNode
    description?: React.ReactNode
}

export interface KubernetesMetadataRowsProps {
    items: KubernetesMetadataRowItem[]
    labelWidth?: number | string
    /** Kept for call-site compatibility; each empty metadata kind now renders
     * its own non-interactive "없음" row instead of one combined Empty block. */
    emptyText?: React.ReactNode
}

/** Shared metadata summary rows. Resource panels provide only identity and raw metadata. */
export const KubernetesMetadataRows = ({ items, labelWidth = 122 }: KubernetesMetadataRowsProps) => {
    const [selectedKey, setSelectedKey] = React.useState<React.Key | undefined>()
    const normalized = items.map(item => ({ ...item, entries: normalizeKubernetesMetadata(item.data, item.excludedKeys) }))
    const selected = normalized.find(item => item.key === selectedKey && item.entries.length > 0)
    const labelColumn = typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth
    return <div className="netdive-detail-metadata-rows">
        {normalized.map(item => {
            if (item.entries.length === 0) return <div
                key={item.key}
                className="netdive-detail-metadata-row is-empty"
                style={{ gridTemplateColumns: `${labelColumn} minmax(0, 1fr) 24px` }}>
                <strong>{item.label}</strong><span>없음</span><span aria-hidden="true" />
            </div>
            const summary = `${item.entries.slice(0, 2).map(entry => entry.displayKey).join(', ')}${item.entries.length > 2 ? ` 외 ${item.entries.length - 2}개` : ''}`
            return <button
                type="button"
                key={item.key}
                className="netdive-detail-metadata-row is-interactive"
                style={{ gridTemplateColumns: `${labelColumn} minmax(0, 1fr) 24px` }}
                onClick={() => setSelectedKey(item.key)}>
                <strong>{item.label}</strong><span>{summary}</span><RightOutlined />
            </button>
        })}
        {selected && <KubernetesMetadataModal
            visible
            onCancel={() => setSelectedKey(undefined)}
            resourceName={selected.resourceName}
            resourceKind={selected.resourceKind}
            metadataKind={selected.metadataKind}
            data={selected.data}
            title={selected.modalTitle}
            description={selected.description}
            excludedKeys={selected.excludedKeys}
        />}
    </div>
}
