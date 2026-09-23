import { session } from './Store'

export interface MoldCredentialsStatus {
  configured: boolean
  message?: string
}

export interface MoldCredentialsInput {
  apiKey: string
  secretKey: string
}

const endpoint = (userSession?: session): string =>
  userSession?.endpoint || `${window.location.protocol}//${window.location.host}`

const request = async (
  userSession: session | undefined,
  path: string,
  options: RequestInit = {}
): Promise<MoldCredentialsStatus> => {
  const response = await fetch(`${endpoint(userSession)}${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(userSession?.token ? { 'X-Auth-Token': userSession.token } : {}),
      ...(options.headers || {})
    }
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error: any = new Error(payload?.message || `Mold credentials API failed: ${response.status}`)
    error.status = response.status
    throw error
  }
  return payload
}

export const getMoldCredentialsStatus = (userSession?: session): Promise<MoldCredentialsStatus> =>
  request(userSession, '/api/mold/credentials')

export const testMoldCredentials = (
  userSession: session | undefined,
  input: MoldCredentialsInput
): Promise<MoldCredentialsStatus> => request(userSession, '/api/mold/credentials/test', {
  method: 'POST',
  body: JSON.stringify(input)
})

export const saveMoldCredentials = (
  userSession: session | undefined,
  input: MoldCredentialsInput
): Promise<MoldCredentialsStatus> => request(userSession, '/api/mold/credentials', {
  method: 'PUT',
  body: JSON.stringify(input)
})
