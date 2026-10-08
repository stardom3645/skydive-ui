import type { CubeHost } from './RelatedServicesAPI'

export const validCubePort = (port: unknown): port is number =>
  typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535

export const serviceBrowserURL = (raw?: string): string | undefined => {
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : undefined
  } catch (_) { return undefined }
}

export const cubeHostURL = (ip: string, port?: number): string | undefined => {
  if (!validCubePort(port)) return undefined
  const host = String(ip || '').trim().replace(/^\[|\]$/g, '')
  if (!host || /[^a-fA-F\d.:]/.test(host)) return undefined
  if (!host.includes(':')) {
    const parts = host.split('.')
    if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return undefined
  }
  return serviceBrowserURL(`https://${host.includes(':') ? `[${host}]` : host}:${port}`)
}

export const filterCubeHosts = (hosts: CubeHost[], query: string): CubeHost[] => {
  const search = query.trim().toLocaleLowerCase()
  return hosts.filter(host => `${host.name} ${host.managementIp}`.toLocaleLowerCase().includes(search))
}

