import type { Link } from './Topology'

export const lldpLinkExpiresAt = (link: Link): number | undefined => {
    const raw = link.data?.LLDP?.ExpiresAt
    if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) return undefined
    return Number(raw)
}
export const isExpiredLLDPLink = (link: Link, now = Date.now()): boolean => {
    const expires = lldpLinkExpiresAt(link)
    return expires !== undefined && expires <= now
}
export const nextLLDPExpiryDelay = (links: Iterable<Link>, now = Date.now()): number | undefined => {
    let next: number | undefined
    for (const link of links) {
        const expires = lldpLinkExpiresAt(link)
        if (expires !== undefined && expires > now && (next === undefined || expires < next)) next = expires
    }
    return next === undefined ? undefined : Math.min(2147483647, Math.max(1, next - now + 1))
}
