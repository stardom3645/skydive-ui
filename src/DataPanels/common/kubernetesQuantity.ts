const QUANTITY_VALUE_KEYS = [
    'string', 'String', 'value', 'Value', 'raw', 'Raw', 'original', 'Original',
    'quantity', 'Quantity', 'amount', 'Amount'
]

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
