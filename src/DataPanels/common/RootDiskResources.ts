import { formatPodMemoryUsage } from './KubernetesPodUsageMetrics'

export interface RootDiskResources { total: number; used?: number; available?: number; percent?: number; mountpoint?: string }
export interface RootDiskWallData { series?: Array<{ key: string; lastValue?: number | null; labels?: { partition_mountpoint?: string; mountpoint?: string } }> }

// Preserve measured zero; allocation/capacity and absent samples are not usage.
export const resourceUsagePercent = (wall: Parameters<typeof rootDiskResources>[0], key: string, fallback?: number): number | undefined => {
    const measured = wall?.series?.find(series => series.key === key)?.lastValue
    const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
    return valid(measured) ? measured : valid(fallback) ? fallback : undefined
}

// Wall filesystem measurements are bytes, unlike Mold VM memory (MiB) or
// provisioned volume sizes. Missing measurements must never become zero usage.
export const rootDiskResources = (wall?: RootDiskWallData): RootDiskResources | undefined => {
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
    const labels = wall?.series?.find(series => series.key === 'rootDiskTotal')?.labels
    const rawMount = labels?.partition_mountpoint || labels?.mountpoint
    const mountpoint = rawMount && /^[a-z]:[\\/]*$/i.test(rawMount) ? `${rawMount[0].toUpperCase()}:\\` : rawMount
    return { total, used, available, percent: used !== undefined ? used / total * 100 : undefined,
        ...(mountpoint ? { mountpoint } : {}) }
}

export const formatRootDiskBytes = (bytes?: number) => bytes === undefined ? '미수집' : formatPodMemoryUsage(bytes).replace(/ /g, '')
export const rootDiskDescription = (disk: RootDiskResources) => [
    `루트 파일시스템 ${disk.mountpoint || '/'}`, `전체 ${formatRootDiskBytes(disk.total)}`, `사용 ${formatRootDiskBytes(disk.used)}`,
    `가용 ${formatRootDiskBytes(disk.available)}`, disk.percent !== undefined ? `사용률 ${Number(disk.percent.toFixed(1))}%` : '사용률 미수집'
].join(' · ')
