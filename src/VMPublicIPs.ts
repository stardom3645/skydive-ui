/** Only the VM-scoped, relationship-verified API field is eligible. A network's
 * gateway, source NAT address or another VM's raw PublicIP is not a VM binding. */
export function vmPublicIPAddresses(data: any, detail: any): string[] {
    if (!detail || !Array.isArray(detail.publicIps)) return []
    const uuid = String(data?.UUID || data?.uuid || '').trim().toLowerCase()
    const detailUUID = String(detail.uuid || detail.UUID || '').trim().toLowerCase()
    const domain = String(data?.InstanceName || data?.instanceName || data?.Name || data?.name || '').trim().toLowerCase()
    const detailDomain = String(detail.instanceName || detail.InstanceName || '').trim().toLowerCase()
    if (!detailUUID || (uuid ? uuid !== detailUUID : !domain || domain !== detailDomain)) return []
    return Array.from(new Set<string>(detail.publicIps.filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean)))
}
