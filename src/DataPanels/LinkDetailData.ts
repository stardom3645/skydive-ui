import type { Link } from '../Topology'

/** Preserve arbitrary collector/NSM metadata without the legacy table toolbar.
 * Internal endpoint hints are drawing state and are not resource metadata. */
export const linkDetailMetadataRows = (link: Link): Array<{ key: string; label: string; value: string; copyText: string }> => {
    const rows: Array<{ key: string; label: string; value: string; copyText: string }> = []
    const visit = (value: any, key: string, depth: number) => {
        if (value === undefined || value === null) return
        if (typeof value === 'object' && !Array.isArray(value) && depth < 4) {
            Object.keys(value).forEach(field => {
                if (!field.startsWith('__')) visit(value[field], key ? `${key}.${field}` : field, depth + 1)
            })
            return
        }
        const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
        rows.push({ key, label: key, value: text, copyText: text })
    }
    Object.keys(link.data || {}).filter(key => !['RelationType', 'Directed', 'ManualPortMapping'].includes(key) && !key.startsWith('__'))
        .forEach(key => visit(link.data[key], key, 0))
    return rows
}
