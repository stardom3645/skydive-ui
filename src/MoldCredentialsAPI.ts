import { session } from './Store'
import { translate } from './Config'

export interface MoldCredentialsStatus {
  configured: boolean
  apiConfigured: boolean
  dbPasswordConfigured: boolean
  uiURL?: string
  message?: string
}

export interface MoldCredentialsInput {
  apiKey: string
  secretKey: string
  dbPassword: string
}

const endpoint = (userSession?: session): string =>
  userSession?.endpoint || `${window.location.protocol}//${window.location.host}`

const moldRequestErrorMessage = (status: number, path: string, payloadMessage?: string): string => {
  if (status === 404) return translate('moldCredentialsEndpointUnavailable')
  if (status === 401) return translate('moldCredentialsAuthenticationFailed')
  if (status === 403) return translate('moldCredentialsPermissionDenied')
  if (status === 400 && /API Key|Secret Key/i.test(payloadMessage || '')) return translate('moldAPICredentialsRequired')
  if (status === 400 && /DB|비밀번호|password/i.test(payloadMessage || '')) return translate('moldDBPasswordRequired')
  if (status >= 500 && /DB|database|데이터베이스/i.test(payloadMessage || '')) return translate('moldDBConnectionFailed')
  if (status >= 500 && /API/i.test(payloadMessage || '')) return translate('moldAPIConnectionFailed')
  if (path.endsWith('/test/api') && status >= 500) return translate('moldAPIConnectionFailed')
  if (path.endsWith('/test/db') && status >= 500) return translate('moldDBConnectionFailed')
  if (status >= 500) return translate('moldCredentialsServiceUnavailable')
  return translate('moldCredentialsRequestFailed')
}

const request = async (
  userSession: session | undefined,
  path: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<MoldCredentialsStatus> => {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  const signal = options.signal
  let timedOut = false
  if (signal?.aborted) cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  try {
    let response: Response
    let payload: any
    try {
      response = await fetch(`${endpoint(userSession).replace(/\/$/, '')}${path}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(userSession?.token ? { 'X-Auth-Token': userSession.token } : {}),
          ...(options.headers || {})
        }
      })
      payload = await response.json().catch(error => {
        if (controller.signal.aborted) throw error
        return {}
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new Error(translate(timedOut ? 'moldCredentialsTimeout' : 'moldCredentialsNetworkError'))
    }
    if (!response.ok) {
      const error: any = new Error(moldRequestErrorMessage(response.status, path, payload?.message))
      error.status = response.status
      throw error
    }
    return payload
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}

export const getMoldCredentialsStatus = async (userSession?: session, signal?: AbortSignal): Promise<MoldCredentialsStatus> => {
  const status = await request(userSession, '/api/mold/credentials', { signal }, 10000)
  if (typeof status?.apiConfigured !== 'boolean' || typeof status?.dbPasswordConfigured !== 'boolean') {
    throw new Error(translate('moldCredentialsRequestFailed'))
  }
  return status
}

export const testMoldAPIConnection = (
  userSession: session | undefined,
  input: MoldCredentialsInput
): Promise<MoldCredentialsStatus> => request(userSession, '/api/mold/credentials/test/api', {
  method: 'POST',
  body: JSON.stringify({ apiKey: input.apiKey, secretKey: input.secretKey })
})

export const testMoldDBConnection = (
  userSession: session | undefined,
  dbPassword: string
): Promise<MoldCredentialsStatus> => request(userSession, '/api/mold/credentials/test/db', {
  method: 'POST',
  body: JSON.stringify({ dbPassword })
})

export const saveMoldCredentials = (
  userSession: session | undefined,
  input: MoldCredentialsInput
): Promise<MoldCredentialsStatus> => request(userSession, '/api/mold/credentials', {
  method: 'PUT',
  body: JSON.stringify(input)
})

export const resetMoldCredentials = (userSession?: session): Promise<MoldCredentialsStatus> =>
  request(userSession, '/api/mold/credentials', { method: 'DELETE' })
