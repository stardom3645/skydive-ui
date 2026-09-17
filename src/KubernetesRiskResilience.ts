export interface RiskPlacement {
    label: string
    count: number
    // A node connected to several switches contributes once to collection coverage.
    coverageCount?: number
}

export function collectedRiskCount(value: any): number | undefined {
    if (typeof value !== 'number' && typeof value !== 'string') return undefined
    if (typeof value === 'string' && !value.trim()) return undefined
    const count = Number(value)
    return Number.isSafeInteger(count) && count >= 0 ? count : undefined
}

export function switchRiskPlacements(hosts: RiskPlacement[], paths: Map<string, Set<string>>, unknown: string): RiskPlacement[] {
    const result = new Map<string, RiskPlacement>()
    hosts.forEach(host => {
        const switches = Array.from(paths.get(host.label) || [])
        const labels = switches.length ? switches : [unknown]
        labels.forEach(label => {
            const item = result.get(label) || { label, count: 0, coverageCount: 0 }
            item.count += host.count
            item.coverageCount = (item.coverageCount || 0) + host.count / labels.length
            result.set(label, item)
        })
    })
    return Array.from(result.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function riskPlacementCoverage(items: RiskPlacement[], total: number, unknown: string) {
    const known = items.filter(item => item.label !== unknown)
    const knownCount = Math.round(known.reduce((sum, item) => sum + (item.coverageCount === undefined ? item.count : item.coverageCount), 0))
    const connections = known.reduce((sum, item) => sum + item.count, 0)
    const topPercent = connections ? Math.round(Math.max(...known.map(item => item.count)) / connections * 100) : 0
    return { known, knownCount, topPercent, complete: total > 0 && knownCount === total }
}

export function currentImpactAssessment(score: number, collected: boolean) {
    return { evaluated: collected || score > 0, partial: !collected && score > 0 }
}
