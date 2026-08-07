export interface KubernetesSelectorEntry {
    kind: 'label' | 'expression'
    key: string
    operator: string
    values: string[]
}

export type KubernetesSelectorMode = 'labelSelector' | 'simpleMap'

export interface KubernetesSelectorExpression {
    key: string
    operator: string
    values: string[]
}

export interface NormalizedKubernetesSelector {
    labels: Array<{ key: string, value: string }>
    expressions: KubernetesSelectorExpression[]
}

const isRecord = (value: any): value is Record<string, any> =>
    !!value && typeof value === 'object' && !Array.isArray(value)

const flattenLabels = (value: any, prefix = ''): Array<{ key: string, value: string }> => {
    if (!isRecord(value)) return []
    return Object.keys(value).reduce((items: Array<{ key: string, value: string }>, key) => {
        const path = prefix ? `${prefix}.${key}` : key
        const child = value[key]
        if (isRecord(child)) return items.concat(flattenLabels(child, path))
        items.push({ key: path, value: String(child) })
        return items
    }, [])
}

export const normalizeKubernetesLabelSelector = (selector: any): NormalizedKubernetesSelector => {
    if (!isRecord(selector)) return { labels: [], expressions: [] }
    const structured = isRecord(selector.MatchLabels || selector.matchLabels)
        || Array.isArray(selector.MatchExpressions || selector.matchExpressions)
    const labelSource = structured ? selector.MatchLabels || selector.matchLabels || {} : selector
    const labels = flattenLabels(labelSource)
    const expressions = (selector.MatchExpressions || selector.matchExpressions || []).map((expression: any) => ({
        key: String(expression?.Key || expression?.key || ''),
        operator: String(expression?.Operator || expression?.operator || '알 수 없음'),
        values: Array.isArray(expression?.Values || expression?.values)
            ? (expression.Values || expression.values).map(String)
            : []
    })).filter((entry: KubernetesSelectorExpression) => !!entry.key)
    return { labels, expressions }
}

export const normalizeKubernetesSimpleSelector = (selector: any): NormalizedKubernetesSelector => ({
    labels: flattenLabels(selector),
    expressions: []
})

export const kubernetesSelectorEntries = (selector: any): KubernetesSelectorEntry[] => {
    if (!isRecord(selector)) return []
    const hasStructuredSelector = isRecord(selector.MatchLabels || selector.matchLabels)
        || Array.isArray(selector.MatchExpressions || selector.matchExpressions)
    const labels = hasStructuredSelector
        ? selector.MatchLabels || selector.matchLabels || {}
        : Object.keys(selector).reduce((result: Record<string, any>, key) => {
            if (key !== 'MatchExpressions' && key !== 'matchExpressions') result[key] = selector[key]
            return result
        }, {})
    const labelEntries: KubernetesSelectorEntry[] = flattenLabels(labels).map(item => ({
        kind: 'label', key: item.key, operator: '=', values: [item.value]
    }))
    const expressionEntries: KubernetesSelectorEntry[] = (selector.MatchExpressions || selector.matchExpressions || []).map((expression: any) => ({
        kind: 'expression',
        key: String(expression?.Key || expression?.key || ''),
        operator: String(expression?.Operator || expression?.operator || '알 수 없음'),
        values: Array.isArray(expression?.Values || expression?.values)
            ? (expression.Values || expression.values).map(String)
            : []
    })).filter((entry: KubernetesSelectorEntry) => !!entry.key)
    return labelEntries.concat(expressionEntries)
}
