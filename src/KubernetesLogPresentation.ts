/** Display-only helpers. Offsets always refer to the unmodified API response. */
export interface LogMatch { start: number; end: number }
export function findLogMatches(logs: string, query: string, limit = 5000): { matches: LogMatch[]; total: number } {
    if (!query) return { matches: [], total: 0 }
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const matches: LogMatch[] = []
    let match: RegExpExecArray | null, total = 0
    while ((match = pattern.exec(logs))) {
        total++
        if (matches.length < limit) matches.push({ start: match.index, end: match.index + match[0].length })
    }
    return { matches, total }
}
