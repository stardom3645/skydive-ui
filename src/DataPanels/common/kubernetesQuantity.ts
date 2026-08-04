const QUANTITY_VALUE_KEYS = [
    'string', 'String', 'value', 'Value', 'raw', 'Raw', 'original', 'Original',
    'quantity', 'Quantity', 'amount', 'Amount'
]

export const kubernetesQuantityText = (value: any): string => {
    if (value === undefined || value === null || value === '') return ''
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
    if (typeof value !== 'object') return String(value).trim()
    for (const key of QUANTITY_VALUE_KEYS) {
        const nested = value[key]
        if (nested !== undefined && nested !== null && nested !== '') {
            return kubernetesQuantityText(nested)
        }
    }
    return ''
}

export const kubernetesCpuCores = (value: any): number | undefined => {
    const match = kubernetesQuantityText(value).match(/^([0-9.]+)(n|u|m)?$/i)
    if (!match) return undefined
    const amount = Number(match[1])
    if (!Number.isFinite(amount)) return undefined
    switch ((match[2] || '').toLowerCase()) {
    case 'n': return amount / 1000000000
    case 'u': return amount / 1000000
    case 'm': return amount / 1000
    default: return amount
    }
}

export const kubernetesMemoryBytes = (value: any): number | undefined => {
    const match = kubernetesQuantityText(value).match(/^([0-9.]+)(Ki|Mi|Gi|Ti|K|M|G|T)?$/i)
    if (!match) return undefined
    const amount = Number(match[1])
    if (!Number.isFinite(amount)) return undefined
    const unit = (match[2] || '').toLowerCase()
    const multiplier = unit === 'ti' ? Math.pow(1024, 4)
        : unit === 'gi' ? Math.pow(1024, 3)
        : unit === 'mi' ? Math.pow(1024, 2)
        : unit === 'ki' ? 1024
        : unit === 't' ? 1e12
        : unit === 'g' ? 1e9
        : unit === 'm' ? 1e6
        : unit === 'k' ? 1e3 : 1
    return amount * multiplier
}

export const formatKubernetesQuantity = (
    value: any,
    emptyText: string,
    unavailableText: string
): string => {
    const visited = new Set<any>()
    const normalize = (candidate: any): string => {
        if (candidate === undefined || candidate === null || candidate === '') return emptyText
        if (typeof candidate === 'string') return candidate.trim() || emptyText
        if (typeof candidate === 'number') return Number.isFinite(candidate) ? String(candidate) : unavailableText
        if (typeof candidate !== 'object') return String(candidate)
        if (visited.has(candidate)) return unavailableText
        visited.add(candidate)
        for (const key of QUANTITY_VALUE_KEYS) {
            const nested = candidate[key]
            if (nested !== undefined && nested !== null && nested !== '') return normalize(nested)
        }
        if (candidate.toString && candidate.toString !== Object.prototype.toString) {
            try {
                const text = String(candidate.toString()).trim()
                if (text && text !== '[object Object]' && text.charAt(0) !== '{') return text
            } catch (_) {
                return unavailableText
            }
        }
        return unavailableText
    }
    return normalize(value)
}
