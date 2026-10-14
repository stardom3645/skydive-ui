import { RoutingCard } from './InfrastructureCompactRouting'

export interface InfrastructureOwnershipNode {
    id: string; parentID?: string; type: string; driver?: string; manager?: string
}

/** Only canonical ownership is evidence of a VM's virtual interface. Layer-2
 * links, equal IPs/MACs/VLANs and inherited lane weights are not ownership. */
export function infrastructureVirtualNICOwners(nodes: InfrastructureOwnershipNode[]): Map<string, string> {
    const byID = new Map(nodes.map(node => [node.id, node])), owners = new Map<string, string>()
    const isVirtualNIC = (node: InfrastructureOwnershipNode) => node.manager !== 'k8s'
        && (['tuntap', 'tun', 'veth'].includes(node.type)
            || (['device', 'interface', 'port'].includes(node.type) && ['tun', 'tuntap', 'tap', 'veth'].includes(node.driver || '')))
    for (const nic of nodes.filter(isVirtualNIC)) {
        const seen = new Set([nic.id])
        let parent = nic.parentID && byID.get(nic.parentID)
        while (parent && !seen.has(parent.id)) {
            seen.add(parent.id)
            if (parent.manager === 'k8s') break
            if (parent.type === 'libvirt') { owners.set(nic.id, parent.id); break }
            if (!isVirtualNIC(parent)) break
            parent = parent.parentID && byID.get(parent.parentID)
        }
    }
    return owners
}

/** A collapsed NIC group belongs to a bundle only when every canonical member
 * is a verified virtual interface of the same VM. */
export function infrastructureNICGroupOwner(memberIDs: string[], owners: Map<string, string>): string | undefined {
    if (!memberIDs.length) return undefined
    const owner = owners.get(memberIDs[0])
    return owner && memberIDs.every(id => owners.get(id) === owner) ? owner : undefined
}

export interface VMBundleCard extends RoutingCard { vmOwnerID?: string; hostID?: string; parentID?: string }
export interface InfrastructureVMBundle extends RoutingCard {
    vmID: string; hostID?: string; row: number; nodeIDs: string[]
}
export const infrastructureVMBundlePadding = 16

/** Presentation only: IDs continue to refer to existing independent objects.
 * Hidden alignment points belong to the routing region, never its extent. */
export function infrastructureVMBundles(cards: VMBundleCard[], vmRows: Map<string, number>): InfrastructureVMBundle[] {
    const bundles: InfrastructureVMBundle[] = []
    const byID = new Map(cards.map(card => [card.id, card]))
    const routingOwners = new Map<string, string>()
    cards.filter(card => card.width === 0).forEach(card => {
        const seen = new Set([card.id])
        let parent = card.parentID && byID.get(card.parentID)
        while (parent && !seen.has(parent.id)) {
            seen.add(parent.id)
            if (vmRows.has(parent.id)) { routingOwners.set(card.id, parent.id); break }
            parent = parent.parentID && byID.get(parent.parentID)
        }
    })
    for (const vm of cards.filter(card => vmRows.has(card.id) && card.width > 0)) {
        const members = cards.filter(card => card.id === vm.id || card.vmOwnerID === vm.id || routingOwners.get(card.id) === vm.id)
        const painted = members.filter(card => card.width > 0 && card.height > 0)
        const left = Math.min(...painted.map(card => card.x - card.width / 2)) - infrastructureVMBundlePadding
        const right = Math.max(...painted.map(card => card.x + card.width / 2)) + infrastructureVMBundlePadding
        const top = Math.min(...painted.map(card => card.y - card.height / 2 - (card.above || 0))) - infrastructureVMBundlePadding
        const bottom = Math.max(...painted.map(card => card.y + card.height / 2 + (card.below || 0))) + infrastructureVMBundlePadding
        const nodeIDs = members.map(card => card.id)
        // Never suggest ownership of an unrelated object enclosed by an
        // unusual drilldown. Such a subtree keeps the existing presentation.
        if (cards.some(card => card.width > 0 && !nodeIDs.includes(card.id)
            && card.x + card.width / 2 > left && card.x - card.width / 2 < right
            && card.y + card.height / 2 + (card.below || 0) > top
            && card.y - card.height / 2 - (card.above || 0) < bottom)) continue
        bundles.push({ id: `vm-bundle:${vm.id}`, vmID: vm.id, hostID: vm.hostID, row: vmRows.get(vm.id)!, nodeIDs,
            x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top })
    }
    return bundles
}
