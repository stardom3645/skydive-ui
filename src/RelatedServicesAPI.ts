import type { session } from './Store'
import { translate } from './Config'

export interface RelatedServiceLink { url?: string; message?: string }
export interface RelatedServices { mold: RelatedServiceLink; wall: RelatedServiceLink; cube: { port?: number; message?: string } }
export interface CubeHost { id: string; name: string; managementIp: string }

export { validCubePort, serviceBrowserURL, cubeHostURL, filterCubeHosts } from './RelatedServicesLinks'

const request = async <T>(userSession: session | undefined, path: string, signal?: AbortSignal, failureKey = 'relatedServicesLoadFailed'): Promise<T> => {
  const endpoint = (userSession?.endpoint || `${window.location.protocol}//${window.location.host}`).replace(/\/$/, '')
  const response = await fetch(`${endpoint}${path}`, {
    signal, credentials: 'same-origin', cache: 'no-store',
    headers: userSession?.token ? { 'X-Auth-Token': userSession.token } : {}
  })
  if (!response.ok) throw new Error(translate(response.status === 404 ? 'relatedServicesServerUpdateRequired'
    : response.status === 403 ? 'relatedServicesPermissionDenied'
    : response.status === 401 ? 'relatedServicesSignInRequired' : failureKey))
  return response.json()
}

export const getRelatedServices = async (userSession?: session, signal?: AbortSignal): Promise<RelatedServices> => {
  const result = await request<RelatedServices>(userSession, '/api/mold/related-services', signal)
  if (!result?.mold || !result.wall || !result.cube) throw new Error(translate('relatedServicesLoadFailed'))
  return result
}

export const getCubeHosts = async (userSession?: session, signal?: AbortSignal): Promise<CubeHost[]> => {
  const result = await request<{ hosts: CubeHost[] }>(userSession, '/api/mold/hosts', signal, 'cubeHostsLoadFailed')
  if (!Array.isArray(result?.hosts)) throw new Error(translate('cubeHostsLoadFailed'))
  return result.hosts.map(host => ({ id: String(host.id || ''), name: String(host.name || host.id || ''), managementIp: String(host.managementIp || '') }))
}
