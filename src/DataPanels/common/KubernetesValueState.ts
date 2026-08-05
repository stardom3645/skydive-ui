export interface KubernetesValueStateOptions {
    value?: string | string[]
    collected: boolean
    applicable?: boolean
    separator?: string
}

/** Shared display contract for Kubernetes fields whose empty value is distinct
 * from collection failure and resource inapplicability. */
export const formatKubernetesValueState = ({
    value,
    collected,
    applicable = true,
    separator = ', '
}: KubernetesValueStateOptions): string => {
    if (!applicable) return '해당 없음'
    if (!collected) return '수집되지 않음'
    const values = Array.isArray(value) ? value.map(String).filter(item => item.trim() !== '') : [String(value || '')].filter(item => item.trim() !== '')
    return values.length ? values.join(separator) : '설정되지 않음'
}
