import * as React from 'react'

import { Node } from '../Topology'
import { session } from '../Store'
import VMDetailPanel from './VMDetailPanel'

interface Props {
    node: Node
    session?: session
    moldInventory?: any
    vmNameMap?: Record<string, string>
    vmNetworkMap?: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>>
    vmDetailMap?: Record<string, any>
    managementServers?: any[]
}

const SystemVMDetailPanel = (props: Props) => <VMDetailPanel {...props} systemVM />

export default SystemVMDetailPanel
