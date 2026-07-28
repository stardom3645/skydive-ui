const isRecord = (value: any): value is Record<string, any> =>
    !!value && typeof value === 'object' && !Array.isArray(value)

const valueAtLabelPath = (labels: any, key: string): any => {
    if (!isRecord(labels)) return undefined
    if (Object.prototype.hasOwnProperty.call(labels, key)) return labels[key]
    return key.split('.').reduce((value, segment) =>
        isRecord(value) && Object.prototype.hasOwnProperty.call(value, segment)
            ? value[segment]
            : undefined, labels)
}

const containsLabelSubset = (actual: any, expected: any): boolean => {
    if (isRecord(expected)) {
        if (!isRecord(actual)) return false
        const keys = Object.keys(expected)
        return keys.length > 0 && keys.every(key =>
            Object.prototype.hasOwnProperty.call(actual, key)
            && containsLabelSubset(actual[key], expected[key]))
    }
    if (Array.isArray(expected)) {
        return Array.isArray(actual)
            && expected.length === actual.length
            && expected.every((value, index) => containsLabelSubset(actual[index], value))
    }
    return String(actual) === String(expected)
}

export const kubernetesLabelValue = (labels: any, key: string): any =>
    valueAtLabelPath(labels, key)

export const matchesKubernetesSelector = (selector: any, labels: any): boolean => {
    if (!isRecord(selector) || !isRecord(labels)) return false

    const matchLabels = selector.MatchLabels || selector.matchLabels
    const labelSelector = isRecord(matchLabels)
        ? matchLabels
        : Object.keys(selector).reduce((result: Record<string, any>, key) => {
            if (key !== 'MatchExpressions' && key !== 'matchExpressions') result[key] = selector[key]
            return result
        }, {})
    const labelKeys = Object.keys(labelSelector)
    const labelsMatch = labelKeys.length === 0
        || labelKeys.every(key => containsLabelSubset(valueAtLabelPath(labels, key), labelSelector[key]))
    if (!labelsMatch) return false

    const expressions = selector.MatchExpressions || selector.matchExpressions || []
    if (!Array.isArray(expressions)) return labelKeys.length > 0
    const expressionsMatch = expressions.every(expression => {
        const key = String(expression?.Key || expression?.key || '')
        const operator = String(expression?.Operator || expression?.operator || '').toLowerCase()
        if (!key || !operator) return false
        const actual = valueAtLabelPath(labels, key)
        const exists = actual !== undefined && actual !== null
        const values = expression?.Values || expression?.values || []
        const normalizedValues = Array.isArray(values) ? values.map(String) : []
        if (operator === 'exists') return exists
        if (operator === 'doesnotexist') return !exists
        if (operator === 'in') return exists && normalizedValues.indexOf(String(actual)) >= 0
        if (operator === 'notin') return !exists || normalizedValues.indexOf(String(actual)) < 0
        return false
    })
    return expressionsMatch && (labelKeys.length > 0 || expressions.length > 0)
}
