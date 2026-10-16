import type { Node } from './Topology'

export interface KubernetesNodeVMMatch { uuid: string; domain: string; matchedBy: string }

const uuid = (value: any): string | undefined => {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (!/^(?:[0-9a-f]{32}|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/.test(text)) return undefined
    const compact = text.replace(/-/g, '')
    if (/^0+$/.test(compact)) return undefined
    return compact.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
}
const field = (data: any, keys: string[]) => keys.map(key => data?.[key]).find(value => value !== undefined && value !== null && value !== '')

/** Only Mold VM UUIDs are indexed. Kubernetes object UIDs, names and IPs are
 * deliberately excluded. Duplicate records with conflicting domains fail closed. */
export const createKubernetesNodeVMMatcher = (inventory?: any, vmDetails?: Record<string, any>) => {
    const records = [inventory?.virtualMachines, inventory?.virtualmachines, inventory?.vms, inventory?.VMs,
        inventory?.data?.virtualMachines, inventory?.data?.virtualmachines, inventory?.data?.vms,
        inventory?.inventory?.virtualMachines, inventory?.inventory?.virtualmachines,
        inventory?.listvirtualmachinesresponse?.virtualmachine, inventory?.listVirtualMachinesResponse?.virtualmachine,
        inventory?.ListVirtualMachinesResponse?.VirtualMachine, inventory?.items]
        .reduce<any[]>((all, values) => Array.isArray(values) ? all.concat(values) : all, [])
    const domains = new Map<string, Set<string>>()
    const owners = new Map<string, Set<string>>()
    const add = (record: any, mapKey?: string) => {
        const explicit = field(record, ['uuid', 'UUID', 'id', 'ID', 'Id', 'VirtualMachineID', 'virtualMachineId'])
        const id = uuid(explicit ?? mapKey)
        const domain = String(field(record, ['instanceName', 'InstanceName', 'instancename', 'instance_name']) || '').trim()
        if (!id || !domain) return
        const values = domains.get(id) || new Set<string>()
        values.add(domain); domains.set(id, values)
        const ids = owners.get(domain) || new Set<string>()
        ids.add(id); owners.set(domain, ids)
    }
    records.forEach(record => add(record))
    Object.entries(vmDetails || {}).forEach(([key, record]) => add(record, key))
    return (node: Node): KubernetesNodeVMMatch | undefined => {
        if (String(node.data?.Manager).toLowerCase() !== 'k8s' || String(node.data?.Type).toLowerCase() !== 'node') return undefined
        const k8s = node.data?.K8s || {}, extra = k8s.Extra || {}
        const spec = extra.Spec || extra.spec || k8s.Spec || {}
        const status = extra.Status || extra.status || k8s.Status || {}
        const provider = String(field(spec, ['ProviderID', 'providerID']) ?? field(k8s, ['ProviderID', 'providerID']) ?? '').trim()
        const providerUUID = uuid(provider.match(/^(?:external-)?cloudstack:\/\/\/?([0-9a-f-]+)$/i)?.[1])
        // An unknown/malformed provider or conflicting UUID is not proof of identity.
        if (provider && !providerUUID) return undefined
        const system = field(status.NodeInfo || status.nodeInfo, ['SystemUUID', 'systemUUID'])
        const systemUUID = uuid(system)
        if (providerUUID && system && (!systemUUID || systemUUID !== providerUUID)) return undefined
        const id = providerUUID || systemUUID
        const matches = id && domains.get(id)
        if (!id || !matches || matches.size !== 1) return undefined
        const domain = Array.from(matches)[0]
        if (owners.get(domain)?.size !== 1) return undefined
        return { uuid: id, domain,
            matchedBy: providerUUID ? systemUUID ? 'ProviderID · SystemUUID' : 'ProviderID' : 'SystemUUID' }
    }
}
