import { ManualPortMappingRecord } from './InfrastructurePortMapping'
import { session } from './Store'

export interface ManualPortMappingInput {
	switchNodeId: string
	switchPortName: string
	hostNodeId: string
	hostNicNodeId: string
	enabled?: boolean
}

const endpoint = (userSession?: session): string => userSession?.endpoint || `${window.location.protocol}//${window.location.host}`

const request = async (userSession: session | undefined, path: string, options: RequestInit = {}): Promise<any> => {
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
	const payload = response.status === 204 ? undefined : await response.json().catch(() => ({}))
	if (!response.ok) throw new Error(payload?.message || `Manual port mapping API failed: ${response.status}`)
	return payload
}

export const listManualPortMappings = async (
	userSession: session | undefined,
	filter: { switchNodeId?: string, hostNodeId?: string } = {}
): Promise<ManualPortMappingRecord[]> => {
	const params = new URLSearchParams()
	if (filter.switchNodeId) params.set('switchNodeId', filter.switchNodeId)
	if (filter.hostNodeId) params.set('hostNodeId', filter.hostNodeId)
	const suffix = params.toString() ? `?${params.toString()}` : ''
	const payload = await request(userSession, `/api/infrastructure/manual-port-mappings${suffix}`)
	return Array.isArray(payload?.mappings) ? payload.mappings : []
}

export const createManualPortMapping = async (userSession: session | undefined, input: ManualPortMappingInput): Promise<ManualPortMappingRecord> => {
	const payload = await request(userSession, '/api/infrastructure/manual-port-mappings', {
		method: 'POST', body: JSON.stringify(input)
	})
	return payload.mapping
}

export const updateManualPortMapping = async (userSession: session | undefined, id: number, input: ManualPortMappingInput): Promise<ManualPortMappingRecord> => {
	const payload = await request(userSession, `/api/infrastructure/manual-port-mappings/${id}`, {
		method: 'PUT', body: JSON.stringify(input)
	})
	return payload.mapping
}

export const disableManualPortMapping = async (userSession: session | undefined, id: number): Promise<void> => {
	await request(userSession, `/api/infrastructure/manual-port-mappings/${id}`, { method: 'DELETE' })
}
