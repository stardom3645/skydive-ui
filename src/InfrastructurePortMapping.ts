import type { Link, Node } from './Topology'
import { switchDisplayName, switchLLDPData, switchTextValue } from './SwitchNodeUtils'

export type InfrastructurePortMappingSource = 'automatic' | 'manual' | 'mismatch'
export type InfrastructurePortConnectionState = 'connected' | 'disconnected' | 'unknown'

/**
 * A normalized switch-port mapping row.  The source union intentionally keeps
 * room for a future manual inventory without coupling this LLDP view to a new
 * collector or persistence layer.
 */
export interface InfrastructurePortMapping {
    key: string
    switchName: string
    switchNodeID: string
    switchPortName: string
    switchPortNodeID?: string
    hostName: string
    hostNodeID: string
    hostNicName: string
    hostNicNodeID?: string
    connectionState: InfrastructurePortConnectionState
    source: InfrastructurePortMappingSource
    relationLinkID: string
}

export interface InfrastructureHostPortMapping extends InfrastructurePortMapping {
    bondInterfaceName: string
    bondInterfaceNodeID?: string
}

const nodeType = (node?: Node): string => String(node?.data?.Type || node?.data?.type || '').trim().toLowerCase()

const isSwitchPort = (node?: Node): boolean => ['switchport', 'port'].includes(nodeType(node))

const isOwnershipLink = (link: Link): boolean => {
    const relation = String(link.data?.RelationType || link.data?.relationType || '').trim().toLowerCase()
    return relation === 'ownership' || relation === 'vownership'
}

const isDescendantOf = (node: Node, ancestorID: string): boolean => {
    let current: Node | null | undefined = node.parent
    while (current) {
        if (current.id === ancestorID) return true
        current = current.parent
    }
    return false
}

const hostAncestor = (node?: Node): Node | undefined => {
    let current = node
    while (current) {
        if (nodeType(current) === 'host') return current
        current = current.parent || undefined
    }
    return undefined
}

const isHostNic = (node: Node): boolean => {
    const type = nodeType(node)
    if (['bond', 'bridge', 'ovsbridge', 'openvswitch', 'vlan'].includes(type)) return false
    return ['device', 'nic', 'interface', 'ethernet'].includes(type)
        || (!type && !!node.parent && nodeType(node.parent) === 'host')
}

const portName = (node?: Node): string => node
    ? switchTextValue(node.data || {}, ['Name', 'name', 'PortID', 'PortId', 'IfName', 'InterfaceName']) || node.id
    : ''

const hostName = (node: Node): string => switchTextValue(node.data || {}, ['Name', 'name', 'Hostname', 'HostName']) || node.id

const nicName = (node?: Node): string => node
    ? switchTextValue(node.data || {}, ['Name', 'name', 'IfName', 'InterfaceName']) || node.id
    : ''

const interfaceIndex = (node?: Node): string => node
    ? switchTextValue(node.data || {}, ['IfIndex', 'ifIndex', 'Index', 'index'])
    : ''

const isBond = (node?: Node): boolean => {
    if (!node) return false
    const driver = switchTextValue(node.data || {}, ['Driver', 'driver']).toLowerCase()
    return nodeType(node) === 'bond' || driver === 'bonding'
}

const belongsToHost = (node: Node, hostID: string): boolean => hostAncestor(node)?.id === hostID

const bondForNic = (nic: Node | undefined, host: Node, nodes: Node[], links: Link[]): Node | undefined => {
    if (!nic) return undefined
    if (isBond(nic.parent || undefined)) return nic.parent || undefined

    const bonds = nodes.filter(node => isBond(node) && belongsToHost(node, host.id))
    const masterIndex = switchTextValue(nic.data || {}, ['MasterIndex', 'masterIndex'])
    if (masterIndex) {
        const indexedBond = bonds.find(bond => interfaceIndex(bond) === masterIndex)
        if (indexedBond) return indexedBond
    }

    const namedMaster = switchTextValue(nic.data || {}, [
        'Master', 'MasterName', 'master', 'masterName', 'Bond', 'BondName', 'bond', 'bondName'
    ])
    if (namedMaster) {
        const normalizedMaster = namedMaster.toLowerCase()
        const namedBond = bonds.find(bond => bond.id.toLowerCase() === normalizedMaster
            || nicName(bond).toLowerCase() === normalizedMaster)
        if (namedBond) return namedBond
    }

    // Netdive also materializes the bond membership as a topology edge.  It is
    // only used inside the selected host and never inferred from interface names.
    for (const link of links) {
        const peer = peerFor(link, nic.id)
        if (peer && isBond(peer) && belongsToHost(peer, host.id)) return peer
    }
    return undefined
}

const rawConnectionStates = (...nodes: Array<Node | undefined>): string[] => nodes
    .map(node => node
        ? switchTextValue(node.data || {}, [
            'State', 'state', 'Status', 'status', 'OperState', 'OperationalState', 'LinkState', 'Carrier'
        ]).toLowerCase()
        : '')
    .filter(Boolean)

export const infrastructurePortConnectionState = (...nodes: Array<Node | undefined>): InfrastructurePortConnectionState => {
    const states = rawConnectionStates(...nodes)
    if (states.some(raw => /^(down|stopped|inactive|disconnected|false|0|error|failed)$/.test(raw))) return 'disconnected'
    if (states.some(raw => /^(up|running|active|connected|true|1)$/.test(raw))) return 'connected'
    return 'unknown'
}

const lldpRemotePortName = (node?: Node): string => {
    const lldp = switchLLDPData(node?.data || {})
    return switchTextValue(lldp, ['RemotePortID', 'RemotePortId', 'PortID', 'PortId', 'RemotePortDescription'])
}

const peerFor = (link: Link, nodeID: string): Node | undefined => {
    if (link.source.id === nodeID) return link.target
    if (link.target.id === nodeID) return link.source
    return undefined
}

export const buildInfrastructurePortMappings = (
    switchNode: Node,
    nodes: Node[],
    links: Link[]
): InfrastructurePortMapping[] => {
    const mappings = new Map<string, InfrastructurePortMapping>()
    const switchPorts = new Map<string, Node>()

    nodes.forEach(node => {
        if (isSwitchPort(node) && isDescendantOf(node, switchNode.id)) switchPorts.set(node.id, node)
    })
    // Some collectors express the Switch -> port ownership only as an edge.
    links.forEach(link => {
        const peer = peerFor(link, switchNode.id)
        if (peer && isSwitchPort(peer)) switchPorts.set(peer.id, peer)
    })

    const addMapping = (link: Link, port: Node | undefined, endpoint: Node) => {
        if (!isHostNic(endpoint)) return
        const host = hostAncestor(endpoint)
        if (!host) return
        const resolvedPortName = portName(port) || lldpRemotePortName(endpoint)
        if (!resolvedPortName) return
        const key = `${switchNode.id}::${port?.id || resolvedPortName}::${endpoint.id}`
        if (mappings.has(key)) return
        mappings.set(key, {
            key,
            switchName: switchDisplayName(switchNode.data || {}, switchNode.id),
            switchNodeID: switchNode.id,
            switchPortName: resolvedPortName,
            switchPortNodeID: port?.id,
            hostName: hostName(host),
            hostNodeID: host.id,
            hostNicName: nicName(endpoint),
            hostNicNodeID: endpoint.id,
            connectionState: infrastructurePortConnectionState(port, endpoint),
            source: 'automatic',
            relationLinkID: link.id
        })
    }

    links.forEach(link => {
        if (isOwnershipLink(link)) return

        switchPorts.forEach(port => {
            const peer = peerFor(link, port.id)
            if (!peer || peer.id === switchNode.id || isDescendantOf(peer, switchNode.id)) return
            addMapping(link, port, peer)
        })

        // Preserve LLDP mappings even when the collector did not materialize a
        // SwitchPort node.  This still requires the existing topology edge and
        // the NIC's collected RemotePortID; it does not infer a relation by name.
        const directPeer = peerFor(link, switchNode.id)
        if (directPeer && !isSwitchPort(directPeer)) addMapping(link, undefined, directPeer)
    })

    return Array.from(mappings.values()).sort((left, right) => {
        const portOrder = left.switchPortName.localeCompare(right.switchPortName, undefined, { numeric: true })
        if (portOrder !== 0) return portOrder
        const hostOrder = left.hostName.localeCompare(right.hostName)
        return hostOrder !== 0 ? hostOrder : left.hostNicName.localeCompare(right.hostNicName)
    })
}

/** Host-oriented projection of the same normalized LLDP rows used by the
 * switch panel. No relation is inferred beyond the already collected topology
 * edges; this function only adds the NIC's optional bond membership. */
export const buildInfrastructureHostPortMappings = (
    hostNode: Node,
    nodes: Node[],
    links: Link[]
): InfrastructureHostPortMapping[] => {
    const nodesByID = new Map(nodes.map(node => [node.id, node]))
    const mappings = nodes
        .filter(node => nodeType(node) === 'switch')
        .reduce<InfrastructurePortMapping[]>((all, switchNode) => {
            return all.concat(buildInfrastructurePortMappings(switchNode, nodes, links))
        }, [])
        .filter(mapping => mapping.hostNodeID === hostNode.id)
        .map(mapping => {
            const nic = mapping.hostNicNodeID ? nodesByID.get(mapping.hostNicNodeID) : undefined
            const bond = bondForNic(nic, hostNode, nodes, links)
            return {
                ...mapping,
                bondInterfaceName: bond ? nicName(bond) : '',
                bondInterfaceNodeID: bond?.id
            }
        })

    return mappings.sort((left, right) => {
        const switchOrder = left.switchName.localeCompare(right.switchName, undefined, { numeric: true })
        if (switchOrder !== 0) return switchOrder
        return left.switchPortName.localeCompare(right.switchPortName, undefined, { numeric: true })
    })
}
