import { formatPodMemoryUsage } from './KubernetesPodUsageMetrics'

export interface RootDiskResources { total: number; used?: number; available?: number; percent?: number }

// Wall filesystem measurements are bytes, unlike Mold VM memory (MiB) or
// provisioned volume sizes. Missing measurements must never become zero usage.
export const rootDiskResources = (wall?: { series?: Array<{ key: string; lastValue?: number | null }> }): RootDiskResources | undefined => {
    const read = (key: string) => {
        const value = wall?.series?.find(series => series.key === key)?.lastValue
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
    }
    const total = read('rootDiskTotal')
    if (total === undefined || total <= 0) return undefined
    const rawUsed = read('rootDiskUsed'), rawAvailable = read('rootDiskAvailable')
    const validAvailable = rawAvailable !== undefined && rawAvailable <= total ? rawAvailable : undefined
    const used = rawUsed !== undefined && rawUsed <= total ? rawUsed
        : rawUsed === undefined && validAvailable !== undefined ? total - validAvailable : undefined
    const available = validAvailable ?? (used !== undefined ? total - used : undefined)
    return { total, used, available, percent: used !== undefined ? used / total * 100 : undefined }
}

export const formatRootDiskBytes = (bytes?: number) => bytes === undefined ? '미수집' : formatPodMemoryUsage(bytes).replace(/ /g, '')
export const rootDiskDescription = (disk: RootDiskResources) => [
    '루트 파일시스템 /', `전체 ${formatRootDiskBytes(disk.total)}`, `사용 ${formatRootDiskBytes(disk.used)}`,
    `가용 ${formatRootDiskBytes(disk.available)}`, disk.percent !== undefined ? `사용률 ${Number(disk.percent.toFixed(1))}%` : '사용률 미수집'
].join(' · ')
