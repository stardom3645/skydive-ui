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
  options: RequestInit = {}
): Promise<MoldCredentialsStatus> => {
  let response: Response
  try {
    response = await fetch(`${endpoint(userSession)}${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(userSession?.token ? { 'X-Auth-Token': userSession.token } : {}),
        ...(options.headers || {})
      }
    })
  } catch (_) {
    throw new Error(translate('moldCredentialsNetworkError'))
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error: any = new Error(moldRequestErrorMessage(response.status, path, payload?.message))
    error.status = response.status
    throw error
  }
  return payload
}

export const getMoldCredentialsStatus = (userSession?: session): Promise<MoldCredentialsStatus> =>
  request(userSession, '/api/mold/credentials')

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
