import { kubernetesMetadataKeyLabel } from './KubernetesDataPresentation'

export type KubernetesMetadataKind = 'label' | 'annotation'

export interface KubernetesMetadataEntry {
    key: string
    displayKey: string
    value: any
    displayValue: string
    copyValue: string
    structured: boolean
}

const isRecord = (value: any): value is Record<string, any> =>
    !!value && typeof value === 'object' && !Array.isArray(value)

const parseStructuredString = (value: string): any => {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    try {
        const parsed = JSON.parse(trimmed)
        if (typeof parsed === 'string') {
            const nested = parsed.trim()
            if ((nested.startsWith('{') && nested.endsWith('}')) || (nested.startsWith('[') && nested.endsWith(']'))) {
                try { return JSON.parse(nested) } catch (_error) { return parsed }
            }
        }
        return parsed
    } catch (_error) {
        return undefined
    }
}

export const kubernetesMetadataDisplayValue = (value: any): Pick<KubernetesMetadataEntry, 'displayValue' | 'copyValue' | 'structured'> => {
    const parsed = typeof value === 'string' ? parseStructuredString(value) : value
    const structured = Array.isArray(parsed) || isRecord(parsed)
    if (structured) {
        const count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
        return {
            displayValue: Array.isArray(parsed) ? `JSON 배열 · ${count}개 항목` : `JSON 객체 · ${count}개 필드`,
            copyValue: JSON.stringify(parsed, null, 2),
            structured: true
        }
    }
    const copyValue = value === undefined || value === null
        ? ''
        : typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    return { displayValue: copyValue || '빈 값', copyValue, structured: false }
}

export const normalizeKubernetesMetadata = (
    value: Record<string, any> | undefined | null,
    excludedKeys: string[] = []
): KubernetesMetadataEntry[] => {
    if (!isRecord(value)) return []
    return Object.keys(value).filter(key => excludedKeys.indexOf(key) < 0).sort().map(key => ({
        key,
        displayKey: kubernetesMetadataKeyLabel(key),
        value: value[key],
        ...kubernetesMetadataDisplayValue(value[key])
    }))
}

export const serializeKubernetesMetadata = (entries: KubernetesMetadataEntry[]): string => JSON.stringify(
    entries.reduce((result, entry) => {
        result[entry.key] = entry.value
        return result
    }, {} as Record<string, any>),
    null,
    2
)
