import * as React from 'react'
import IconButton from '@material-ui/core/IconButton'
import Tooltip from '@material-ui/core/Tooltip'
import Drawer from '@material-ui/core/Drawer'
import FileCopyIcon from '@material-ui/icons/FileCopy'
import InfoIcon from '@material-ui/icons/Info'
import TimelineIcon from '@material-ui/icons/Timeline'
import DeviceHubIcon from '@material-ui/icons/DeviceHub'
import PowerIcon from '@material-ui/icons/Power'
import SecurityIcon from '@material-ui/icons/Security'
import RouterIcon from '@material-ui/icons/Router'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import SearchIcon from '@material-ui/icons/Search'
import CloseIcon from '@material-ui/icons/Close'
import KeyboardArrowRightIcon from '@material-ui/icons/KeyboardArrowRight'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import DeviceHubOutlinedIcon from '@material-ui/icons/DeviceHubOutlined'
import { withStyles } from '@material-ui/core/styles'

import { Node } from '../Topology'
import { session } from '../Store'
import { translate } from '../Config'
import { styles } from './HostDetailPanelStyles'

import HostResourceTrendPanel from './HostResourceTrendPanel'

interface Props {
    classes: any
    node: Node
    session?: session
    moldInventory?: any
    infrastructureHostSummaries?: Record<string, any>
    kubernetesClusters?: any[]
}

interface State {
    moldDetail?: any
    moldDetailLoadedFor?: string
    listeningServicesVisibleCount?: number
    showAllSocketProcesses?: boolean
    kubernetesNodePickerOpen?: boolean
    kubernetesNodePickerQuery?: string
    kubernetesNodePickerExpanded?: Record<string, boolean>
}

type InfrastructureFocusKey = 'networkObjects' | 'routers' | 'userVMs' | 'systemVMs'

interface KeyValueRow {
    label: string
    value: any
    copy?: boolean
}

interface MetricItem {
    label: string
    value: string
    sub?: string
    percent?: number
    muted?: boolean
    icon?: React.ReactNode
}

interface OverviewCardItem {
    label: string
    description: string
    value: string
    icon?: React.ReactNode
    actionKey?: InfrastructureFocusKey
    nodeIDs?: string[]
    onClick?: () => void
}

interface SocketServiceItem {
    port: string
    protocol: string
    process: string
    count: number
}

interface SocketProcessItem {
    process: string
    count: number
    percent: number
}

interface KubernetesClusterMatch {
    id: string
    name: string
}

interface KubernetesNodePickerItem {
    id: string
    name: string
    clusterId: string
    clusterName: string
    status: string
    role: string
    version: string
}

interface PillItem {
    label: string
    title?: string
}

const kubernetesNodeExplorerStyles = `
.netdive-k8s-explorer-paper {
    width: min(448px, calc(100vw - 56px)) !important;
    max-width: 448px !important;
    right: 28px !important;
    top: 22px !important;
    height: auto !important;
    max-height: calc(100vh - 56px) !important;
    border-radius: 14px !important;
    overflow: hidden !important;
    background: #ffffff !important;
    box-shadow: 0 18px 42px rgba(15, 23, 42, 0.18) !important;
    border: 1px solid rgba(203, 213, 225, 0.78) !important;
}
.netdive-k8s-explorer {
    box-sizing: border-box;
    max-height: calc(100vh - 56px);
    padding: 12px 12px 14px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.netdive-k8s-explorer-header {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) 24px;
    gap: 8px;
    align-items: start;
}
.netdive-k8s-explorer-logo {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
    color: #ffffff;
    box-shadow: 0 6px 14px rgba(37, 99, 235, 0.18);
}
.netdive-k8s-explorer-logo svg {
    font-size: 17px !important;
}
.netdive-k8s-explorer-title {
    color: #0f172a;
    font-size: 15px;
    line-height: 1.18;
    font-weight: 850;
    letter-spacing: -0.02em;
}
.netdive-k8s-explorer-description {
    margin-top: 4px;
    color: #64748b;
    font-size: 10.5px;
    line-height: 1.32;
    font-weight: 550;
}
.netdive-k8s-explorer-close {
    width: 26px !important;
    height: 26px !important;
    padding: 4px !important;
    color: #475569 !important;
}
.netdive-k8s-explorer-close svg {
    font-size: 18px !important;
}
.netdive-k8s-explorer-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max-content max-content;
    gap: 6px;
    align-items: center;
}
.netdive-k8s-explorer-search {
    height: 32px;
    border: 1px solid #dbeafe;
    border-radius: 9px;
    background: #ffffff;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 10px;
    box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
}
.netdive-k8s-explorer-search svg {
    color: #64748b;
    font-size: 15px !important;
}
.netdive-k8s-explorer-search input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: #0f172a;
    font-size: 11px;
    font-weight: 550;
}
.netdive-k8s-explorer-search input::placeholder {
    color: #94a3b8;
}
.netdive-k8s-explorer-action {
    height: 32px;
    min-width: 68px;
    border-radius: 8px;
    padding: 0 8px;
    font-size: 9px;
    line-height: 1;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}
.netdive-k8s-explorer-action:hover {
    transform: translateY(-1px);
}
.netdive-k8s-explorer-action-secondary {
    color: #0f172a;
    background: #ffffff;
    border: 1px solid #dbeafe;
}
.netdive-k8s-explorer-action-primary {
    color: #2563eb;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
}
.netdive-k8s-explorer-action-primary:disabled {
    color: #94a3b8;
    background: #f8fafc;
    border-color: #e2e8f0;
    cursor: not-allowed;
    transform: none;
}
.netdive-k8s-explorer-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
}
.netdive-k8s-explorer-summary-card {
    min-height: 40px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #ffffff;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 7px;
    align-items: center;
    padding: 6px 9px;
    box-shadow: 0 5px 14px rgba(15, 23, 42, 0.028);
}
.netdive-k8s-explorer-summary-card:nth-child(1) .netdive-k8s-explorer-summary-icon {
    color: #2563eb;
    background: #eff6ff;
}
.netdive-k8s-explorer-summary-card:nth-child(2) .netdive-k8s-explorer-summary-icon {
    color: #16a34a;
    background: #ecfdf5;
}
.netdive-k8s-explorer-summary-icon {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.netdive-k8s-explorer-summary-icon svg {
    font-size: 14px !important;
}
.netdive-k8s-explorer-fa-icon {
    font-family: "Font Awesome 5 Free";
    font-size: 15px;
    font-weight: 900;
    line-height: 1;
}
.netdive-k8s-explorer-summary-label {
    display: block;
    color: #64748b;
    font-size: 10px;
    line-height: 1.12;
    font-weight: 800;
}
.netdive-k8s-explorer-summary-count {
    display: block;
    margin-top: 2px;
    color: #0f172a;
    font-size: 15px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.02em;
}
.netdive-k8s-explorer-body {
    min-height: 0;
    overflow: auto;
    padding-right: 1px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.netdive-k8s-explorer-cluster {
    border: 1px solid #e2e8f0;
    border-radius: 11px;
    background: #ffffff;
    overflow: hidden;
    box-shadow: 0 5px 14px rgba(15, 23, 42, 0.028);
}
.netdive-k8s-explorer-cluster-header {
    display: grid;
    grid-template-columns: 20px 24px minmax(0, 1fr) 20px;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 7px 9px;
    background: #ffffff;
    cursor: pointer;
    user-select: none;
}
.netdive-k8s-explorer-cluster-header:hover {
    background: #f8fbff;
}
.netdive-k8s-explorer-cluster-toggle,
.netdive-k8s-explorer-cluster-chevron {
    width: 20px;
    height: 20px;
    border-radius: 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #334155;
}
.netdive-k8s-explorer-cluster-toggle svg,
.netdive-k8s-explorer-cluster-chevron svg {
    font-size: 14px !important;
}
.netdive-k8s-explorer-cluster-toggle svg,
.netdive-k8s-explorer-cluster-chevron svg {
    transition: transform 0.16s ease, color 0.16s ease;
}
.netdive-k8s-explorer-cluster-header:hover .netdive-k8s-explorer-cluster-chevron,
.netdive-k8s-explorer-cluster-header:hover .netdive-k8s-explorer-cluster-toggle {
    color: #2563eb;
}
.netdive-k8s-explorer-cluster-logo {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
    box-shadow: 0 5px 12px rgba(37, 99, 235, 0.14);
}
.netdive-k8s-explorer-cluster-logo svg {
    font-size: 14px !important;
}
.netdive-k8s-explorer-cluster-logo .netdive-k8s-explorer-fa-icon {
    color: #ffffff;
    font-size: 15px;
}
.netdive-k8s-explorer-cluster-name {
    display: block;
    overflow: hidden;
    color: #111827;
    font-size: 11.75px;
    line-height: 1.18;
    font-weight: 850;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.netdive-k8s-explorer-cluster-meta {
    display: block;
    margin-top: 3px;
    color: #64748b;
    font-size: 9px;
    line-height: 1.15;
    font-weight: 700;
}
.netdive-k8s-explorer-node-list {
    border-top: 1px solid #e2e8f0;
    background: #ffffff;
}
.netdive-k8s-explorer-node-row {
    display: grid;
    grid-template-columns: 9px minmax(0, 1fr) 17px;
    gap: 7px;
    align-items: center;
    min-height: 40px;
    padding: 6px 9px 6px 34px;
    border: 0;
    border-top: 1px solid #f1f5f9;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    cursor: pointer;
    transition: background 0.16s ease, box-shadow 0.16s ease;
}
.netdive-k8s-explorer-node-row:first-child {
    border-top: 0;
}
.netdive-k8s-explorer-node-row:hover,
.netdive-k8s-explorer-node-row:focus {
    outline: none;
    background: #f7faff;
    box-shadow: inset 2px 0 0 #3b82f6;
}
.netdive-k8s-explorer-node-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #22c55e;
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
}
.netdive-k8s-explorer-node-dot-ready {
    background: #22c55e;
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
}
.netdive-k8s-explorer-node-dot-not-ready {
    background: #ef4444;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.11);
}
.netdive-k8s-explorer-node-dot-unknown {
    background: #22c55e;
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
}
.netdive-k8s-explorer-node-name {
    display: block;
    overflow: hidden;
    color: #111827;
    font-size: 10.9px;
    line-height: 1.2;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.netdive-k8s-explorer-node-meta {
    display: block;
    margin-top: 2px;
    color: #64748b;
    font-size: 9.3px;
    line-height: 1.15;
    font-weight: 650;
}
.netdive-k8s-explorer-node-chevron {
    justify-self: end;
    color: #334155;
    opacity: 0.76;
}
.netdive-k8s-explorer-node-chevron svg {
    font-size: 14px !important;
}
.netdive-k8s-explorer-topology-hint {
    position: absolute;
    right: 24px;
    top: 50%;
    transform: translateY(-50%);
    padding: 4px 7px;
    border-radius: 999px;
    background: #eff6ff;
    color: #2563eb;
    font-size: 9px;
    font-weight: 800;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.16s ease;
}
.netdive-k8s-explorer-node-row {
    position: relative;
}
.netdive-k8s-explorer-node-row:hover .netdive-k8s-explorer-topology-hint,
.netdive-k8s-explorer-node-row:focus .netdive-k8s-explorer-topology-hint {
    opacity: 1;
}

.netdive-k8s-explorer-node-meta-pill {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    min-height: 14px;
    padding: 0 5px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: 9px;
    line-height: 1;
    font-weight: 750;
    vertical-align: middle;
}
.netdive-k8s-explorer-node-meta-text {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    max-width: 100%;
    gap: 4px;
}
.netdive-k8s-explorer-node-version {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
@media (max-width: 640px) {
    .netdive-k8s-explorer-paper {
        width: calc(100vw - 20px) !important;
        max-width: none !important;
        right: 10px !important;
        top: 10px !important;
        max-height: calc(100vh - 20px) !important;
    }
    .netdive-k8s-explorer {
        padding: 14px;
        gap: 10px;
    }
    .netdive-k8s-explorer-toolbar {
        grid-template-columns: 1fr;
    }
    .netdive-k8s-explorer-summary {
        grid-template-columns: 1fr;
    }
}
`


const isBlank = (value: any): boolean => {
    if (value === undefined || value === null) return true
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'string') return value.trim() === ''
    return false
}

const asArray = (value: any): any[] => {
    if (isBlank(value)) return []
    return Array.isArray(value) ? value : [value]
}

const stringify = (value: any): string => {
    if (isBlank(value)) return ''
    if (Array.isArray(value)) return value.map(v => stringify(v)).filter(Boolean).join(', ')
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch (e) {
            return String(value)
        }
    }
    return String(value)
}

const firstValue = (data: any, keys: string[]): string => {
    for (const key of keys) {
        const value = stringify(data?.[key])
        if (value) return value
    }
    return ''
}

const numberValue = (data: any, keys: string[]): number | undefined => {
    for (const key of keys) {
        const raw = data?.[key]
        if (raw === undefined || raw === null || raw === '') continue
        const value = Number(raw)
        if (!Number.isNaN(value)) return value
    }
    return undefined
}

const formatDate = (value: any): string => {
    if (isBlank(value)) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return stringify(value)
    return date.toLocaleString()
}

const compactProcessName = (process: string): string => {
    if (!process) return ''
    const command = process.split(/\s+/)[0]
    const base = command.split('/').filter(Boolean).pop() || command
    if (base.indexOf('qemu-system') === 0) return 'qemu-system'
    return base
}

const uniqueStrings = (values: string[]): string[] => {
    const seen = new Set<string>()
    return values.map(value => value.trim()).filter(value => {
        if (!value || seen.has(value)) return false
        seen.add(value)
        return true
    })
}

const lookupTokens = (value: any): string[] => {
    if (isBlank(value)) return []
    const text = String(value).trim().toLowerCase()
    if (!text) return []
    const normalized = text.split('/')[0]
    const tokens = [normalized]
    if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
        return tokens
    }
    const hostToken = normalized.split('.')[0]
    if (hostToken && hostToken !== normalized) {
        tokens.push(hostToken)
    }
    return uniqueStrings(tokens)
}

const collectLookupSet = (...values: any[]): Set<string> => {
    const set = new Set<string>()
    values.forEach(value => {
        asArray(value).forEach(item => {
            lookupTokens(item).forEach(token => set.add(token))
        })
    })
    return set
}

const getByPath = (value: any, path: string): any => {
    if (!value || !path) return undefined
    return path.split('.').reduce((current, key) => {
        if (current === undefined || current === null) return undefined
        return current[key]
    }, value)
}

class HostDetailPanel extends React.Component<Props, State> {
    state: State = {}
    private kubernetesNodePickerRef = React.createRef<HTMLDivElement>()

    componentDidMount() {
        this.loadMoldHostDetail()
        document.addEventListener('mousedown', this.handleDocumentMouseDown, true)
    }

    componentWillUnmount() {
        document.removeEventListener('mousedown', this.handleDocumentMouseDown, true)
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id) {
            this.setState({
                listeningServicesVisibleCount: undefined,
                showAllSocketProcesses: false,
                kubernetesNodePickerOpen: false,
                kubernetesNodePickerQuery: '',
                kubernetesNodePickerExpanded: {}
            })
            this.loadMoldHostDetail()
        }
    }

    private handleDocumentMouseDown = (event: MouseEvent) => {
        if (!this.state.kubernetesNodePickerOpen) return
        const target = event.target as Element | null
        if (!target || !target.closest) return
        if (target.closest('.MuiDialog-root, [data-netdive-side-panel="true"], [data-netdive-link-tags="true"], [class*="kubernetesManagerPanel"], [class*="sideSettingsPanel"]')) {
            return
        }
        const drawer = this.kubernetesNodePickerRef.current
        if (drawer && drawer.contains(target)) return
        this.closeKubernetesNodePicker()
    }

    private copyValue(value: string) {
        if (!value) return
        const nav: any = navigator
        if (nav.clipboard && nav.clipboard.writeText) {
            nav.clipboard.writeText(value)
        }
    }

    private mergedData(): any {
        return {
            ...(this.props.node.data || {}),
            ...(this.inventoryHostDetail() || {}),
            ...(this.state.moldDetail || {})
        }
    }

    private inventoryHosts(): any[] {
        const inventory = this.props.moldInventory
        if (!inventory) return []
        const candidates = [
            inventory.hosts,
            inventory.host,
            inventory.Hosts,
            inventory.data?.hosts,
            inventory.data?.host,
            inventory.inventory?.hosts,
            inventory.listhostsresponse?.host,
            inventory.listHostsResponse?.host,
            inventory.ListHostsResponse?.Host,
            inventory.items
        ]
        for (const candidate of candidates) {
            if (Array.isArray(candidate)) return candidate
        }
        return []
    }

    private inventoryVirtualMachines(): any[] {
        const inventory = this.props.moldInventory
        const data = this.mergedData()
        const candidates = [
            data.ConnectedVMs,
            data.connectedVMs,
            data.ConnectedVms,
            inventory?.virtualMachines,
            inventory?.virtualmachines,
            inventory?.vms,
            inventory?.VMs,
            inventory?.data?.virtualMachines,
            inventory?.data?.virtualmachines,
            inventory?.data?.vms,
            inventory?.inventory?.virtualMachines,
            inventory?.inventory?.virtualmachines,
            inventory?.listvirtualmachinesresponse?.virtualmachine,
            inventory?.listVirtualMachinesResponse?.virtualmachine,
            inventory?.ListVirtualMachinesResponse?.VirtualMachine,
            data.VirtualMachines,
            data.virtualMachines,
            data.VMs,
            data.vms,
            data.UserVMs,
            data.userVMs,
            data.SystemVMs,
            data.systemVMs
        ]
        for (const candidate of candidates) {
            if (Array.isArray(candidate)) return candidate
        }
        return []
    }

    private objectMatchesHost(value: any, hostKeys: Set<string>): boolean {
        if (!value || typeof value !== 'object') return false
        const keys = [
            'hostid', 'hostId', 'HostId', 'hostID', 'HostID',
            'hostuuid', 'hostUuid', 'HostUUID',
            'hostname', 'hostName', 'HostName', 'host', 'Host',
            'hostip', 'hostIp', 'HostIP',
            'privateip', 'privateIp', 'privateIpAddress', 'privateipaddress'
        ]
        const lookup = collectLookupSet(...keys.map(key => value[key]))
        return Array.from(lookup).some(token => hostKeys.has(token))
    }

    private hostInventoryVMs(hostLookup: Set<string>): any[] {
        const data = this.mergedData()
        const selectedHostVMs = [
            ...asArray(data.ConnectedVMs),
            ...asArray(data.connectedVMs),
            ...asArray(data.ConnectedVms)
        ]
        const matchedInventoryVMs = this.inventoryVirtualMachines().filter(vm => this.objectMatchesHost(vm, hostLookup))
        const seen = new Set<string>()
        return [...selectedHostVMs, ...matchedInventoryVMs].filter(vm => {
            const key = firstValue(vm, ['id', 'uuid', 'name', 'displayName', 'displayname', 'instanceName', 'instancename'])
            if (!key) return true
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }

    private inventoryHostDetail(): any | undefined {
        const hosts = this.inventoryHosts()
        if (!hosts.length) return undefined
        const nodeData = this.props.node.data || {}
        const nodeIps = [
            ...asArray(nodeData.IPV4),
            ...asArray(nodeData.IPV6),
            ...asArray(nodeData.IP),
            ...asArray(nodeData.Addr),
            ...asArray(nodeData.IpAddress),
            ...asArray(nodeData.ipaddress),
            ...asArray(nodeData.ManagementIP),
            ...asArray(nodeData.ManagementIp)
        ].map(stringify)
        const nodeKeys = uniqueStrings([
            this.props.node.id,
            firstValue(nodeData, ['ID', 'Id', 'UUID', 'uuid', 'MoldHostId', 'CloudStackHostId', 'HostId', 'HostID']),
            firstValue(nodeData, ['Name', 'Hostname', 'HostName']),
            firstValue(nodeData, ['ManagementIP', 'ManagementIp', 'IpAddress', 'ipaddress']),
            ...nodeIps
        ].map(value => String(value || '').toLowerCase()))

        const host = hosts.find(item => {
            const hostKeys = uniqueStrings([
                firstValue(item, ['ID', 'Id', 'id', 'UUID', 'uuid', 'HostId', 'hostid']),
                firstValue(item, ['Name', 'name', 'Hostname', 'hostname', 'HostName']),
                firstValue(item, ['ManagementIP', 'ManagementIp', 'managementip', 'managementipaddress', 'IpAddress', 'ipaddress'])
            ].map(value => String(value || '').toLowerCase()))
            return hostKeys.some(key => nodeKeys.includes(key))
        })

        if (!host) return undefined
        return this.normalizeMoldHost(host)
    }

    private normalizeMoldHost(host: any): any {
        return {
            ...host,
            MoldHostId: firstValue(host, ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID', 'id', 'uuid']),
            Name: firstValue(host, ['Name', 'name', 'Hostname', 'hostname', 'HostName']),
            Hostname: firstValue(host, ['Hostname', 'hostname', 'Name', 'name', 'HostName']),
            ManagementIP: firstValue(host, ['ManagementIP', 'ManagementIp', 'managementIp', 'managementip', 'managementipaddress', 'privateIpAddress', 'privateipaddress', 'IpAddress', 'ipaddress']),
            Zone: firstValue(host, ['Zone', 'zone', 'ZoneName', 'zonename']),
            Pod: firstValue(host, ['Pod', 'pod', 'PodName', 'podname']),
            Cluster: firstValue(host, ['Cluster', 'cluster', 'ClusterName', 'clustername']),
            Hypervisor: firstValue(host, ['Hypervisor', 'hypervisor', 'HypervisorType', 'hypervisorType', 'hypervisortype']),
            ResourceState: firstValue(host, ['ResourceState', 'resourceState', 'resourcestate', 'AllocationState', 'allocationState']),
            State: firstValue(host, ['State', 'state', 'Status', 'status']),
            Platform: firstValue(host, ['Platform', 'platform', 'OsCategoryName', 'oscategoryname']),
            PlatformVersion: firstValue(host, ['PlatformVersion', 'platformVersion', 'platformversion', 'Version', 'version']),
            CPUAllocatedPercent: firstValue(host, ['CPUAllocatedPercent', 'cpuAllocatedPercent']),
            MemoryAllocatedPercent: firstValue(host, ['MemoryAllocatedPercent', 'memoryAllocatedPercent']),
            StorageUsedPercent: firstValue(host, ['StorageUsedPercent', 'storageUsedPercent']),
            RunningVMCount: firstValue(host, ['RunningVMCount', 'runningVmCount', 'runningVMCount', 'UserVMCount', 'userVmCount', 'VmCount', 'vmCount']),
            UserVMCount: firstValue(host, ['UserVMCount', 'userVmCount', 'RunningVMCount', 'runningVmCount', 'VmCount', 'vmCount']),
            SystemVMCount: firstValue(host, ['SystemVMCount', 'systemVmCount', 'systemVMCount']),
            VirtualRouterCount: firstValue(host, ['VirtualRouterCount', 'virtualRouterCount', 'RouterCount', 'routerCount', 'VRCount']),
            NetworkCount: firstValue(host, ['NetworkCount', 'networkCount', 'ConnectedNetworkCount', 'connectedNetworkCount'])
        }
    }

    private endpoint(): string {
        return this.props.session?.endpoint || `${window.location.protocol}//${window.location.host}`
    }

    private loadMoldHostDetail() {
        const node = this.props.node
        const data = node.data || {}
        const name = firstValue(data, ['Name', 'Hostname', 'HostName']) || node.id
        const hostID = firstValue(data, ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID'])
        const params = new URLSearchParams()
        params.set('nodeId', node.id)
        if (name) params.set('name', name)
        if (hostID) params.set('hostId', hostID)

        const loadedFor = `${node.id}:${name}:${hostID}`
        this.setState({ moldDetailLoadedFor: loadedFor })

        fetch(`${this.endpoint()}/api/mold/hosts/detail?${params.toString()}`, {
            cache: 'no-store',
            headers: this.props.session?.token ? { 'X-Auth-Token': this.props.session.token } : undefined
        }).then(resp => {
            if (!resp.ok) {
                throw new Error(`mold host detail unavailable: ${resp.status}`)
            }
            return resp.json()
        }).then(detail => {
            if (this.state.moldDetailLoadedFor === loadedFor) {
                const rawHost = detail?.moldMatched === false ? undefined : (detail?.mold || detail?.host || detail?.data || detail)
                this.setState({ moldDetail: rawHost ? this.normalizeMoldHost(rawHost) : undefined })
            }
        }).catch(() => {
            if (this.state.moldDetailLoadedFor === loadedFor) {
                this.setState({ moldDetail: undefined })
            }
        })
    }

    private ips(): string[] {
        const data = this.mergedData()
        return [
            ...asArray(data.IPV4),
            ...asArray(data.IPV6),
            ...asArray(data.IP),
            ...asArray(data.Addr),
            ...asArray(data.IpAddress),
            ...asArray(data.ipaddress),
            ...asArray(data.ManagementIP),
            ...asArray(data.ManagementIp)
        ].map(stringify).filter(Boolean)
    }

    private macs(): string[] {
        const data = this.mergedData()
        return [
            ...asArray(data.MAC),
            ...asArray(data.Mac),
            ...asArray(data.MACs),
            ...asArray(data.MacAddress),
            ...asArray(data.macaddress)
        ].map(stringify).filter(Boolean)
    }

    private sockets(): any[] {
        const sockets = this.props.node.data?.Sockets
        return Array.isArray(sockets) ? sockets : []
    }

    private interfaces(): any[] {
        const data = this.mergedData()
        const candidates = [data.Interfaces, data.interfaces, data.Nics, data.nics, data.NetworkInterfaces]
        for (const value of candidates) {
            if (Array.isArray(value)) return value
        }
        return []
    }

    private statusText(): string {
        const data = this.mergedData()
        const state = firstValue(data, ['State', 'Status', 'AgentStatus', 'ResourceState'])
        if (!state) return translate('hostStatusCollected')
        const normalized = state.toLowerCase()
        if (normalized === 'up' || normalized === 'running' || normalized === 'ok' || normalized === 'connected' || normalized === 'enabled') {
            return translate('hostStatusNormal')
        }
        return state
    }

    private mainInterface(): string {
        const data = this.mergedData()
        const hostName = firstValue(data, ['Name', 'Hostname', 'HostName']) || this.props.node.id
        const explicit = firstValue(data, ['Interface', 'IfName', 'IfAlias', 'IfDescr', 'ManagementInterface'])
        if (explicit && explicit !== hostName && explicit !== this.props.node.id) return explicit
        const firstInterface = this.interfaces()[0]
        const fallback = firstValue(firstInterface, ['Name', 'name', 'Interface', 'IfName', 'Device'])
        if (fallback && fallback !== hostName && fallback !== this.props.node.id) return fallback
        return ''
    }

    private interfaceCountByPattern(patterns: RegExp[]): number | undefined {
        const interfaces = this.interfaces()
        if (!interfaces.length) return undefined
        return interfaces.filter(iface => {
            const haystack = [
                firstValue(iface, ['Name', 'name', 'Interface', 'IfName', 'Device']),
                firstValue(iface, ['Type', 'type', 'Kind', 'Driver', 'driver', 'DeviceType'])
            ].join(' ').toLowerCase()
            return patterns.some(pattern => pattern.test(haystack))
        }).length
    }

    private socketString(socket: any, keys: string[]): string {
        for (const key of keys) {
            const value = stringify(socket?.[key])
            if (value) return value
        }
        return ''
    }

    private socketStats() {
        const sockets = this.sockets()
        const ports = new Set<string>()
        let listen = 0
        let external = 0
        sockets.forEach(socket => {
            const port = this.socketString(socket, ['LocalPort', 'Port', 'localPort'])
            if (port) ports.add(port)
            const state = this.normalizeSocketState(socket)
            const remote = this.socketString(socket, ['RemoteAddress', 'RemoteAddr', 'remoteAddress'])
            if (state === 'LISTEN') listen += 1
            if (remote && remote !== '127.0.0.1' && remote !== '::1' && remote !== '0.0.0.0') external += 1
        })
        return { total: sockets.length, ports: ports.size, listen, external }
    }

    private normalizeSocketState(socket: any): string {
        const rawState = this.socketString(socket, ['State', 'Status', 'state', 'status']).toUpperCase()
        const remote = this.socketString(socket, ['RemoteAddress', 'RemoteAddr', 'remoteAddress'])
        const port = this.socketString(socket, ['LocalPort', 'Port', 'localPort'])
        if (rawState === 'LISTENING') return 'LISTEN'
        if (rawState) return rawState
        if (!remote && port) return 'LISTEN'
        return 'UNKNOWN'
    }

    private socketProtocol(socket: any): string {
        return (this.socketString(socket, ['Protocol', 'Proto', 'protocol', 'proto']) || 'TCP').toUpperCase()
    }

    private socketProcess(socket: any): string {
        const process = this.socketString(socket, ['Process', 'ProcessName', 'Name', 'Service', 'process', 'processName', 'service'])
        const compact = compactProcessName(process)
        return compact || process || translate('hostSocketNoProcess')
    }

    private listeningServices(): SocketServiceItem[] {
        const groups = new Map<string, SocketServiceItem>()
        this.sockets().forEach(socket => {
            if (this.normalizeSocketState(socket) !== 'LISTEN') return
            const port = this.socketString(socket, ['LocalPort', 'Port', 'localPort'])
            if (!port) return
            const protocol = this.socketProtocol(socket)
            const process = this.socketProcess(socket)
            const key = `${port}/${protocol}/${process}`
            const current = groups.get(key)
            if (current) {
                current.count += 1
            } else {
                groups.set(key, { port, protocol, process, count: 1 })
            }
        })
        return Array.from(groups.values()).sort((a, b) => Number(a.port) - Number(b.port))
    }

    private topSocketProcesses(): SocketProcessItem[] {
        const total = this.sockets().length
        const counts = new Map<string, number>()
        this.sockets().forEach(socket => {
            const process = this.socketProcess(socket)
            counts.set(process, (counts.get(process) || 0) + 1)
        })
        return Array.from(counts.entries())
            .map(([process, count]) => ({ process, count, percent: total ? (count / total) * 100 : 0 }))
            .sort((a, b) => b.count - a.count)
    }

    private socketStateLabel(state: string): string {
        const normalized = String(state || '').toUpperCase()
        switch (normalized) {
            case 'LISTEN':
                return translate('hostSocketStateListen')
            case 'ESTABLISHED':
                return translate('hostSocketStateEstablished')
            case 'TIME_WAIT':
                return translate('hostSocketStateTimeWait')
            case 'CLOSE_WAIT':
                return translate('hostSocketStateCloseWait')
            default:
                return state || '-'
        }
    }

    private hostInfrastructureNodeIDs(key?: InfrastructureFocusKey): string[] {
        const summary = this.props.infrastructureHostSummaries?.[this.props.node.id]
        if (!summary || !key) return []
        switch (key) {
            case 'userVMs':
                return summary.userVMNodeIDs || []
            case 'systemVMs':
                return summary.systemVMNodeIDs || []
            case 'routers':
                return summary.routerNodeIDs || []
            case 'networkObjects':
                return summary.networkObjectNodeIDs || []
            default:
                return []
        }
    }

    private focusConnectedResource(actionKey?: InfrastructureFocusKey, nodeIDs: string[] = []) {
        const app = (window as any).App
        const ids = nodeIDs.length ? nodeIDs : this.hostInfrastructureNodeIDs(actionKey)
        if (app && typeof app.focusInfrastructureNodeIDs === 'function' && ids.length > 0) {
            app.focusInfrastructureNodeIDs(ids)
        }
    }

    private openKubernetesNodePicker() {
        this.setState({
            kubernetesNodePickerOpen: true,
            kubernetesNodePickerQuery: '',
            kubernetesNodePickerExpanded: {}
        })
    }

    private closeKubernetesNodePicker() {
        this.setState({
            kubernetesNodePickerOpen: false,
            kubernetesNodePickerQuery: '',
            kubernetesNodePickerExpanded: {}
        })
    }

    private focusKubernetesNodeIDs(nodeIDs: string[]) {
        const app = (window as any).App
        if (app && typeof app.focusInfrastructureNodeIDs === 'function' && nodeIDs.length > 0) {
            app.focusInfrastructureNodeIDs(nodeIDs)
        }
    }

    private selectKubernetesNodeID(nodeID: string) {
        const app = (window as any).App
        if (app && typeof app.selectInfrastructureNodeID === 'function' && nodeID) {
            app.selectInfrastructureNodeID(nodeID)
            return
        }
        this.focusKubernetesNodeIDs([nodeID])
    }

    private topologyNodes(): Node[] {
        const app = (window as any).App
        const nodes = app?.tc?.nodes
        if (nodes instanceof Map) {
            return Array.from(nodes.values())
        }
        if (Array.isArray(nodes)) {
            return nodes
        }
        return []
    }

    private topologyNodeMap(nodes?: Node[]): Map<string, Node> {
        const app = (window as any).App
        const topologyNodes = app?.tc?.nodes
        if (topologyNodes instanceof Map) {
            return topologyNodes
        }
        const map = new Map<string, Node>()
        ;(nodes || []).forEach(node => {
            if (node?.id) {
                map.set(node.id, node)
            }
        })
        return map
    }

    private topologyLinks(): any[] {
        const app = (window as any).App
        const links = app?.tc?.links
        if (links instanceof Map) {
            return Array.from(links.values())
        }
        if (Array.isArray(links)) {
            return links
        }
        return []
    }

    private endpointID(endpoint: any): string {
        if (!endpoint) return ''
        if (typeof endpoint === 'string') return endpoint
        return endpoint.id || ''
    }

    private selectedTopologyHostNode(): Node {
        return this.topologyNodeMap().get(this.props.node.id) || this.props.node
    }

    private hostLookupSet(hostRoot: Node): Set<string> {
        const data = this.mergedData()
        const values: any[] = [
            this.props.node.id,
            hostRoot.id,
            firstValue(data, ['Name', 'Hostname', 'HostName']),
            firstValue(data, ['ManagementIP', 'ManagementIp', 'managementIp', 'IpAddress', 'ipaddress']),
            data.IPV4,
            data.IPV6,
            data.IP,
            data.Addr,
            data.IfAddr,
            data.Addresses
        ]
        const visit = (node?: Node | null) => {
            if (!node) return
            const nodeData = node.data || {}
            values.push(
                node.id,
                firstValue(nodeData, ['Name', 'Hostname', 'HostName', 'NodeName', 'nodeName']),
                firstValue(nodeData, ['ManagementIP', 'ManagementIp', 'managementIp', 'IpAddress', 'ipaddress', 'InternalIP', 'ExternalIP', 'HostIP', 'hostIP']),
                nodeData.IPV4,
                nodeData.IPV6,
                nodeData.IP,
                nodeData.Addr,
                nodeData.IfAddr,
                nodeData.IfName,
                nodeData.InterfaceName,
                nodeData.Addresses
            )
            ;(node.children || []).forEach(child => visit(child))
        }
        visit(hostRoot)
        const hostLookup = collectLookupSet(...values)
        this.hostInventoryVMs(hostLookup).forEach(vm => {
            [
                'id', 'uuid', 'name', 'displayname', 'displayName', 'instancename', 'instanceName',
                'hostname', 'hostName', 'hostIp', 'ips', 'IPs', 'nic', 'nics'
            ].forEach(key => values.push(vm[key]))
            asArray(vm.nic || vm.nics || vm.NICs).forEach((nic: any) => {
                values.push(
                    nic?.ipaddress,
                    nic?.ipAddress,
                    nic?.secondaryip,
                    nic?.secondaryIp,
                    nic?.networkname,
                    nic?.networkName,
                    nic?.macaddress,
                    nic?.macAddress
                )
            })
        })
        return collectLookupSet(...values)
    }

    private hostKubernetesNodes(): Node[] {
        const topologyNodes = this.topologyNodes()
        if (!topologyNodes.length) return []
        const topologyLinks = this.topologyLinks()
        const topologyNodeMap = this.topologyNodeMap(topologyNodes)
        const hostRoot = this.selectedTopologyHostNode()
        const hostLookup = this.hostLookupSet(hostRoot)
        const hostSubtreeNodeIDs = this.hostSubtreeNodeIDs()
        const graphMatchedNodeIDs = this.hostMatchedKubernetesNodeIDsFromGraph(hostSubtreeNodeIDs, topologyLinks, topologyNodeMap)

        const matchesHostAncestor = (node: Node): boolean => {
            let parent = node.parent
            while (parent) {
                if (String(parent.data?.Type || '').toLowerCase() === 'host' && parent.id === this.props.node.id) {
                    return true
                }
                parent = parent.parent
            }
            return false
        }

        const matchesHostLink = (node: Node): boolean => {
            return topologyLinks.some((link: any) => {
                const sourceID = this.endpointID(link?.source)
                const targetID = this.endpointID(link?.target)
                if (!sourceID || !targetID) return false
                if (sourceID === node.id) return hostSubtreeNodeIDs.has(targetID)
                if (targetID === node.id) return hostSubtreeNodeIDs.has(sourceID)
                return false
            })
        }

        return topologyNodes.filter(node => {
            if (!node || node.data?.Manager !== 'k8s' || String(node.data?.Type || '').toLowerCase() !== 'node') {
                return false
            }
            if (graphMatchedNodeIDs.has(node.id)) {
                return true
            }
            if (matchesHostAncestor(node)) {
                return true
            }
            if (matchesHostLink(node)) {
                return true
            }

            const addressValues: any[] = []
            asArray(node.data?.Addresses).forEach((entry: any) => {
                if (typeof entry === 'string') {
                    addressValues.push(entry)
                    return
                }
                if (entry && typeof entry === 'object') {
                    addressValues.push(
                        entry.address,
                        entry.Address,
                        entry.ip,
                        entry.IP,
                        entry.InternalIP,
                        entry.ExternalIP,
                        entry.Hostname,
                        entry.hostname
                    )
                }
            })

            const nodeLookup = collectLookupSet(
                node.id,
                firstValue(node.data, ['Name', 'Hostname', 'HostName', 'NodeName', 'nodeName', 'KubeletHostname', 'kubeletHostname']),
                firstValue(node.data, ['InternalIP', 'ExternalIP', 'HostIP', 'hostIP', 'IpAddress', 'ipaddress']),
                node.data?.IPV4,
                node.data?.IPV6,
                node.data?.IP,
                node.data?.Addr,
                node.data?.IfAddr,
                addressValues
            )

            return Array.from(nodeLookup).some(token => hostLookup.has(token))
        })
    }

    private hostSubtreeNodeIDs(): Set<string> {
        const ids = new Set<string>()
        const visit = (node?: Node | null) => {
            if (!node || ids.has(node.id)) return
            ids.add(node.id)
            ;(node.children || []).forEach(child => visit(child))
        }
        visit(this.selectedTopologyHostNode())
        return ids
    }

    private hostMatchedKubernetesNodeIDsFromGraph(hostSubtreeNodeIDs: Set<string>, topologyLinks: any[], topologyNodeMap: Map<string, Node>): Set<string> {
        const matchedNodeIDs = new Set<string>()

        const nearestKubernetesNode = (node?: Node): Node | undefined => {
            let current = node
            while (current) {
                if (current.data?.Manager === 'k8s' && String(current.data?.Type || '').toLowerCase() === 'node') {
                    return current
                }
                current = current.parent || undefined
            }
            return undefined
        }

        topologyLinks.forEach((link: any) => {
            const sourceID = this.endpointID(link?.source)
            const targetID = this.endpointID(link?.target)
            if (!sourceID || !targetID) return

            const sourceIsHostSide = hostSubtreeNodeIDs.has(sourceID)
            const targetIsHostSide = hostSubtreeNodeIDs.has(targetID)
            if (!sourceIsHostSide && !targetIsHostSide) return

            const remoteID = sourceIsHostSide ? targetID : sourceID
            const remoteNode = topologyNodeMap.get(remoteID)
            if (!remoteNode || remoteNode.data?.Manager !== 'k8s') return

            const kubernetesNode = nearestKubernetesNode(remoteNode)
            if (kubernetesNode) {
                matchedNodeIDs.add(kubernetesNode.id)
            }
        })

        return matchedNodeIDs
    }

    private kubernetesClusterFromGraph(node: Node, topologyLinks: any[], topologyNodeMap: Map<string, Node>): KubernetesClusterMatch | undefined {
        for (const link of topologyLinks) {
            const sourceID = this.endpointID(link?.source)
            const targetID = this.endpointID(link?.target)
            if (!sourceID || !targetID || (sourceID !== node.id && targetID !== node.id)) {
                continue
            }
            const remoteID = sourceID === node.id ? targetID : sourceID
            const remoteNode = topologyNodeMap.get(remoteID)
            if (!remoteNode || remoteNode.data?.Manager !== 'k8s' || String(remoteNode.data?.Type || '').toLowerCase() !== 'cluster') {
                continue
            }
            return {
                id: remoteNode.id,
                name: firstValue(remoteNode.data, ['Name', 'ClusterName', 'clusterName']) || remoteNode.id
            }
        }
        return undefined
    }

    private kubernetesClusterForNode(node: Node, topologyLinks: any[], topologyNodeMap: Map<string, Node>): KubernetesClusterMatch | undefined {
        let parent = node.parent
        while (parent) {
            if (String(parent.data?.Type || '').toLowerCase() === 'cluster') {
                return {
                    id: parent.id,
                    name: firstValue(parent.data, ['Name', 'ClusterName', 'clusterName']) || parent.id
                }
            }
            parent = parent.parent
        }

        const graphCluster = this.kubernetesClusterFromGraph(node, topologyLinks, topologyNodeMap)
        if (graphCluster) {
            return graphCluster
        }

        const fallbackID = firstValue(node.data, ['ClusterID', 'clusterID', 'ClusterId', 'clusterId'])
            || firstValue(node.data, ['Cluster', 'ClusterName', 'clusterName'])
        const fallbackName = firstValue(node.data, ['Cluster', 'ClusterName', 'clusterName'])
        if (!fallbackID && !fallbackName) return undefined
        return {
            id: fallbackID || fallbackName,
            name: fallbackName || fallbackID
        }
    }

    private hostKubernetesClusters(nodes: Node[]): KubernetesClusterMatch[] {
        const topologyLinks = this.topologyLinks()
        const topologyNodeMap = this.topologyNodeMap()
        const clusters = new Map<string, KubernetesClusterMatch>()
        nodes.forEach(node => {
            const cluster = this.kubernetesClusterForNode(node, topologyLinks, topologyNodeMap)
            if (!cluster) return
            if (!clusters.has(cluster.id)) {
                clusters.set(cluster.id, cluster)
            }
        })
        return Array.from(clusters.values())
    }

    private kubernetesNodeStatus(node: Node): string {
        const directStatus = firstValue(node.data, ['Status', 'status', 'Phase', 'phase', 'Ready', 'ready'])
        if (directStatus) {
            const normalized = directStatus.toLowerCase()
            if (normalized === 'true' || normalized === 'ready') return 'Ready'
            if (normalized === 'false' || normalized === 'notready' || normalized === 'not-ready') return 'NotReady'
            return directStatus
        }

        const conditions = asArray(
            node.data?.Conditions
            || node.data?.conditions
            || node.data?.Status?.Conditions
            || node.data?.status?.conditions
        )
        for (const condition of conditions) {
            if (!condition || typeof condition !== 'object') continue
            const type = String(condition.Type || condition.type || '').toLowerCase()
            if (type !== 'ready') continue
            const status = String(condition.Status || condition.status || '').toLowerCase()
            if (status === 'true') return 'Ready'
            if (status === 'false') return 'NotReady'
            return condition.Status || condition.status || 'Unknown'
        }

        return 'Unknown'
    }

    private kubernetesNodeRole(node: Node): string {
        const name = firstValue(node.data, ['Name', 'Hostname', 'HostName', 'NodeName', 'nodeName', 'KubeletHostname', 'kubeletHostname']).toLowerCase()
        const nameLooksControlPlane = name.indexOf('control-plane') >= 0 || name.indexOf('control') >= 0 || name.indexOf('master') >= 0

        const labels = node.data?.Labels || node.data?.labels || node.data?.Metadata?.Labels || node.data?.metadata?.labels
        if (labels && typeof labels === 'object') {
            const keys = Object.keys(labels)
            const hasControlPlaneLabel = keys.some(key => key.indexOf('node-role.kubernetes.io/control-plane') === 0)
            const hasMasterLabel = keys.some(key => key.indexOf('node-role.kubernetes.io/master') === 0)
            const hasWorkerLabel = keys.some(key => key.indexOf('node-role.kubernetes.io/worker') === 0)
            if (hasControlPlaneLabel) return 'control-plane'
            if (hasMasterLabel) return 'master'

            const kubernetesRole = firstValue(labels, ['kubernetes.io/role', 'node-role.kubernetes.io/role'])
            if (kubernetesRole) {
                const normalizedRole = kubernetesRole.toLowerCase()
                if (normalizedRole.indexOf('control') >= 0) return 'control-plane'
                if (normalizedRole.indexOf('master') >= 0) return 'master'
                if (normalizedRole.indexOf('worker') >= 0 && nameLooksControlPlane) return 'control-plane'
                if (normalizedRole.indexOf('worker') >= 0) return 'worker'
                return kubernetesRole
            }

            if (hasWorkerLabel && !nameLooksControlPlane) return 'worker'
        }

        const directRole = firstValue(node.data, ['Role', 'role', 'NodeRole', 'nodeRole'])
        if (directRole) {
            const normalizedRole = directRole.toLowerCase()
            if (normalizedRole.indexOf('control') >= 0) return 'control-plane'
            if (normalizedRole.indexOf('master') >= 0) return 'master'
            if (normalizedRole.indexOf('worker') >= 0 && nameLooksControlPlane) return 'control-plane'
            if (normalizedRole.indexOf('worker') >= 0) return 'worker'
            return directRole
        }

        if (nameLooksControlPlane) return 'control-plane'
        return 'worker'
    }

    private hostKubernetesNodeOptions(): KubernetesNodePickerItem[] {
        const topologyLinks = this.topologyLinks()
        const topologyNodeMap = this.topologyNodeMap()
        return this.hostKubernetesNodes()
            .map((node) => {
                const cluster = this.kubernetesClusterForNode(node, topologyLinks, topologyNodeMap)
                const version = firstValue(node.data, ['KubeletVersion', 'kubeletVersion', 'Version', 'version'])
                    || stringify(getByPath(node.data, 'K8s.Extra.Status.NodeInfo.KubeletVersion'))
                    || stringify(getByPath(node.data, 'K8s.Extra.Status.NodeInfo.KubeProxyVersion'))
                    || stringify(getByPath(node.data, 'K8s.Extra.Status.NodeInfo.ContainerRuntimeVersion'))
                return {
                    id: node.id,
                    name: firstValue(node.data, ['Name', 'Hostname', 'HostName', 'NodeName', 'nodeName', 'KubeletHostname', 'kubeletHostname']) || node.id,
                    clusterId: cluster?.id || 'unassigned',
                    clusterName: cluster?.name || 'Unknown Cluster',
                    status: this.kubernetesNodeStatus(node),
                    role: this.kubernetesNodeRole(node),
                    version: version || '-'
                }
            })
            .sort((a, b) => {
                const clusterCompare = a.clusterName.localeCompare(b.clusterName)
                if (clusterCompare !== 0) return clusterCompare
                return a.name.localeCompare(b.name)
            })
    }

    private filteredHostKubernetesNodeOptions(): KubernetesNodePickerItem[] {
        const query = (this.state.kubernetesNodePickerQuery || '').trim().toLowerCase()
        const options = this.hostKubernetesNodeOptions()
        if (!query) return options
        return options.filter(item =>
            item.name.toLowerCase().indexOf(query) >= 0
            || item.clusterName.toLowerCase().indexOf(query) >= 0
        )
    }

    private renderKubernetesNodePicker() {
        const { classes } = this.props
        const hostName = firstValue(this.mergedData(), ['Name', 'Hostname', 'HostName']) || this.props.node.id
        const allOptions = this.hostKubernetesNodeOptions()
        const options = this.filteredHostKubernetesNodeOptions()
        const grouped = new Map<string, { clusterName: string; items: KubernetesNodePickerItem[] }>()
        options.forEach((item) => {
            if (!grouped.has(item.clusterId)) {
                grouped.set(item.clusterId, { clusterName: item.clusterName, items: [] })
            }
            grouped.get(item.clusterId)!.items.push(item)
        })

        const allExpanded = grouped.size > 0 && Array.from(grouped.keys()).every(clusterId => this.state.kubernetesNodePickerExpanded?.[clusterId] !== false)

        const roleLabel = (role: string) => {
            const normalizedRole = String(role || '').toLowerCase()
            if (normalizedRole.indexOf('control') >= 0) return 'control-plane'
            if (normalizedRole.indexOf('master') >= 0) return 'master'
            return 'worker'
        }

        const clusterMetaLabel = (items: KubernetesNodePickerItem[]) => {
            const controlPlaneCount = items.filter(item => roleLabel(item.role) === 'control-plane' || roleLabel(item.role) === 'master').length
            const workerCount = items.length - controlPlaneCount
            if (items.length === 1) {
                const role = roleLabel(items[0].role)
                if (role === 'worker') return 'Worker Node 1'
                if (role === 'control-plane') return 'Control Plane Node 1'
                return `${role} Node 1`
            }
            if (controlPlaneCount > 0 && workerCount > 0) return `Control Plane ${controlPlaneCount} · Worker ${workerCount}`
            if (controlPlaneCount > 0) return `Control Plane Node ${controlPlaneCount}`
            return `Worker Node ${workerCount}`
        }

        const statusDotClass = (status: string) => {
            if (status === 'NotReady') return 'netdive-k8s-explorer-node-dot-not-ready'
            return 'netdive-k8s-explorer-node-dot-ready'
        }

        const moveToNode = (id: string) => {
            this.closeKubernetesNodePicker()
            this.selectKubernetesNodeID(id)
        }

        return (
            <Drawer
                anchor="right"
                open={!!this.state.kubernetesNodePickerOpen}
                onClose={() => this.closeKubernetesNodePicker()}
                ModalProps={{
                    BackdropProps: { style: { backgroundColor: 'rgba(15, 23, 42, 0.28)' } }
                }}
                PaperProps={{
                    className: 'netdive-k8s-explorer-paper',
                    'data-netdive-drawer': 'true',
                    'data-netdive-kubernetes-node-picker': 'true'
                } as any}
                classes={{ paper: classes.kubernetesNodePickerDrawer }}>
                <div className={`${classes.kubernetesNodePickerContent} netdive-k8s-explorer`} ref={this.kubernetesNodePickerRef}>
                    <style>{kubernetesNodeExplorerStyles}</style>
                    <div className={`${classes.kubernetesNodePickerHeader} netdive-k8s-explorer-header`}>
                        <span className={`${classes.kubernetesNodePickerHeaderIcon} netdive-k8s-explorer-logo`}><AccountTreeIcon /></span>
                        <div className={classes.kubernetesNodePickerHeaderBlock}>
                            <div className={`${classes.kubernetesNodePickerTitle} netdive-k8s-explorer-title`}>Kubernetes 노드 탐색</div>
                            <div className={`${classes.kubernetesNodePickerDescription} netdive-k8s-explorer-description`}>
                                이 호스트({hostName})에 배치된 Kubernetes 노드 목록입니다.
                            </div>
                        </div>
                        <IconButton
                            className={`${classes.kubernetesNodePickerClose} netdive-k8s-explorer-close`}
                            onClick={() => this.closeKubernetesNodePicker()}
                            aria-label={translate('close')}>
                            <CloseIcon />
                        </IconButton>
                    </div>

                    <div className={`${classes.kubernetesNodePickerToolbar} netdive-k8s-explorer-toolbar`}>
                        <div className={`${classes.kubernetesNodePickerSearch} netdive-k8s-explorer-search`}>
                            <SearchIcon />
                            <input
                                className={classes.kubernetesNodePickerSearchInput}
                                type="text"
                                value={this.state.kubernetesNodePickerQuery || ''}
                                onChange={(event) => this.setState({ kubernetesNodePickerQuery: event.target.value })}
                                placeholder={translate('kubernetesNodeSelectorSearchPlaceholder')} />
                        </div>
                        <button
                            type="button"
                            className={`${classes.kubernetesNodePickerExpandAllButton} netdive-k8s-explorer-action netdive-k8s-explorer-action-secondary`}
                            title={allExpanded ? '전체 클러스터 접기' : '전체 클러스터 펼치기'}
                            aria-label={allExpanded ? '전체 클러스터 접기' : '전체 클러스터 펼치기'}
                            onClick={() => {
                                const nextState: Record<string, boolean> = {}
                                Array.from(grouped.keys()).forEach((clusterId) => {
                                    nextState[clusterId] = !allExpanded
                                })
                                this.setState({ kubernetesNodePickerExpanded: nextState })
                            }}>
                            {allExpanded ? '전체 접기' : translate('kubernetesNodeSelectorExpandAll')}
                        </button>
                        <button
                            type="button"
                            className={`${classes.kubernetesNodePickerHighlightAllButton} netdive-k8s-explorer-action netdive-k8s-explorer-action-primary`}
                            disabled={allOptions.length === 0}
                            onClick={() => {
                                this.closeKubernetesNodePicker()
                                this.focusKubernetesNodeIDs(allOptions.map(item => item.id))
                            }}>
                            {translate('kubernetesNodeSelectorHighlightAll')}
                        </button>
                    </div>

                    <div className={`${classes.kubernetesNodePickerSummary} netdive-k8s-explorer-summary`}>
                        <div className={`${classes.kubernetesNodePickerSummaryItem} netdive-k8s-explorer-summary-card`}>
                            <span className={`${classes.kubernetesNodePickerSummaryIcon} netdive-k8s-explorer-summary-icon`}><AccountTreeIcon /></span>
                            <span>
                                <span className={`${classes.kubernetesNodePickerSummaryLabel} netdive-k8s-explorer-summary-label`}>Cluster</span>
                                <strong className="netdive-k8s-explorer-summary-count">{grouped.size}</strong>
                            </span>
                        </div>
                        <div className={`${classes.kubernetesNodePickerSummaryItem} netdive-k8s-explorer-summary-card`}>
                            <span className={`${classes.kubernetesNodePickerSummaryIcon} netdive-k8s-explorer-summary-icon`}><span className="netdive-k8s-explorer-fa-icon">&#xf233;</span></span>
                            <span>
                                <span className={`${classes.kubernetesNodePickerSummaryLabel} netdive-k8s-explorer-summary-label`}>Node</span>
                                <strong className="netdive-k8s-explorer-summary-count">{options.length}</strong>
                            </span>
                        </div>
                    </div>

                    <div className={`${classes.kubernetesNodePickerBody} netdive-k8s-explorer-body`}>
                        {!grouped.size && (
                            <div className={classes.emptyState}>
                                {(this.state.kubernetesNodePickerQuery || '').trim()
                                    ? translate('kubernetesNodeSelectorNoResults')
                                    : translate('kubernetesNodeSelectorEmpty')}
                            </div>
                        )}
                        {Array.from(grouped.entries()).map(([clusterId, group]) => {
                            const expanded = this.state.kubernetesNodePickerExpanded?.[clusterId] !== false
                            const visibleItems = expanded ? group.items : group.items.slice(0, 3)
                            const hiddenCount = expanded ? 0 : Math.max(0, group.items.length - visibleItems.length)
                            return (
                                <div className={`${classes.kubernetesNodeClusterGroup} netdive-k8s-explorer-cluster`} key={clusterId}>
                                    <div
                                        className={`${classes.kubernetesNodeClusterHeader} netdive-k8s-explorer-cluster-header`}
                                        onClick={() => {
                                            this.setState({
                                                kubernetesNodePickerExpanded: {
                                                    ...(this.state.kubernetesNodePickerExpanded || {}),
                                                    [clusterId]: !expanded
                                                }
                                            })
                                        }}>
                                        <span className={`${classes.kubernetesNodeClusterInlineChevron} netdive-k8s-explorer-cluster-toggle`}>
                                            {expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                                        </span>
                                        <span className={`${classes.kubernetesNodeClusterIcon} netdive-k8s-explorer-cluster-logo`}><AccountTreeIcon /></span>
                                        <div className={classes.kubernetesNodeClusterTitleBlock}>
                                            <span className={`${classes.kubernetesNodeClusterName} netdive-k8s-explorer-cluster-name`}>{group.clusterName}</span>
                                            <span className={`${classes.kubernetesNodeClusterMeta} netdive-k8s-explorer-cluster-meta`}>{clusterMetaLabel(group.items)}</span>
                                        </div>
                                        <span className={`${classes.kubernetesNodeClusterRightChevron} netdive-k8s-explorer-cluster-chevron`}>
                                            {expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                                        </span>
                                    </div>
                                    {expanded && (
                                        <div className={`${classes.kubernetesNodeClusterBody} netdive-k8s-explorer-node-list`}>
                                            {visibleItems.map(item => (
                                                <div
                                                    className={`${classes.kubernetesNodeRow} netdive-k8s-explorer-node-row`}
                                                    key={item.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => moveToNode(item.id)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                            event.preventDefault()
                                                            moveToNode(item.id)
                                                        }
                                                    }}>
                                                    <span className={`netdive-k8s-explorer-node-dot ${statusDotClass(item.status)}`} />
                                                    <div>
                                                        <span className={`${classes.kubernetesNodeName} netdive-k8s-explorer-node-name`} title={item.name}>{item.name}</span>
                                                        <span className={`${classes.kubernetesNodeMetaLine} netdive-k8s-explorer-node-meta netdive-k8s-explorer-node-meta-text`}>
                                                            <span className="netdive-k8s-explorer-node-meta-pill">{roleLabel(item.role)}</span>
                                                            <span className="netdive-k8s-explorer-node-version">Kubernetes {item.version}</span>
                                                        </span>
                                                    </div>
                                                    <span className="netdive-k8s-explorer-topology-hint">토폴로지에서 강조</span>
                                                    <span className="netdive-k8s-explorer-node-chevron"><KeyboardArrowRightIcon /></span>
                                                </div>
                                            ))}
                                            {hiddenCount > 0 && (
                                                <button
                                                    type="button"
                                                    className={classes.kubernetesNodeExpandButton}
                                                    onClick={() => this.setState({
                                                        kubernetesNodePickerExpanded: {
                                                            ...(this.state.kubernetesNodePickerExpanded || {}),
                                                            [clusterId]: true
                                                        }
                                                    })}>
                                                    {translate('kubernetesNodeSelectorRemainingPrefix')} {hiddenCount}{translate('kubernetesNodeSelectorRemainingSuffix')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </Drawer>
        )
    }

    private renderSocketProcessSummary() {
        const { classes } = this.props
        const services = this.listeningServices()
        const processes = this.topSocketProcesses()
        const socketStats = this.socketStats()
        const visibleServiceCount = this.state.listeningServicesVisibleCount || 5
        const visibleServices = services.slice(0, visibleServiceCount)
        const visibleProcesses = this.state.showAllSocketProcesses ? processes : processes.slice(0, 5)
        const hiddenServiceCount = Math.max(0, services.length - visibleServices.length)
        const hiddenProcessCount = Math.max(0, processes.length - visibleProcesses.length)
        if (!services.length && !processes.length) {
            return <div className={classes.emptyState}>{translate('hostNoSocketInfo')}</div>
        }
        return (
            <div className={classes.socketSection}>
                <div className={classes.socketSummaryGrid}>
                    <div className={classes.socketSummaryTile}>
                        <div className={classes.socketSummaryLabel}>{translate('hostListenPorts')}</div>
                        <div className={classes.socketSummaryValue}>{socketStats.listen || 0}</div>
                    </div>
                    <div className={classes.socketSummaryTile}>
                        <div className={classes.socketSummaryLabel}>{translate('hostExternalConnections')}</div>
                        <div className={classes.socketSummaryValue}>{socketStats.external || 0}</div>
                    </div>
                    <div className={classes.socketSummaryTile}>
                        <div className={classes.socketSummaryLabel}>{translate('hostTopSocketProcesses')}</div>
                        <div className={classes.socketSummaryValue}>{processes.length}</div>
                    </div>
                </div>
                <div className={classes.socketBlock}>
                    <div className={classes.socketBlockHeader}>
                        <strong className={classes.socketBlockTitle}>{translate('hostTopSocketProcesses')}</strong>
                        {(hiddenProcessCount > 0 || this.state.showAllSocketProcesses) && (
                            <button
                                type="button"
                                className={classes.socketMoreButton}
                                onClick={() => this.setState({ showAllSocketProcesses: !this.state.showAllSocketProcesses })}>
                                {this.state.showAllSocketProcesses ? translate('hostSocketCollapse') : `+${hiddenProcessCount}${translate('hostSocketMoreItems')}`}
                            </button>
                        )}
                    </div>
                    <div className={classes.socketProcessList}>
                        {visibleProcesses.map(item => (
                            <div className={classes.socketProcessRow} key={item.process}>
                                <span className={classes.socketProcessName}>{item.process}</span>
                                <span>{item.count}</span>
                                <div className={classes.socketProcessBarTrack}>
                                    <div className={classes.socketProcessBarFill} style={{ width: `${Math.min(100, item.percent)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className={classes.socketBlock}>
                    <div className={classes.socketBlockHeader}>
                        <strong className={classes.socketBlockTitle}>{translate('hostListeningServices')} <span>({socketStats.listen || 0})</span></strong>
                        {(hiddenServiceCount > 0 || services.length > 5) && (
                            <button
                                type="button"
                                className={classes.socketMoreButton}
                                onClick={() => this.setState({
                                    listeningServicesVisibleCount: hiddenServiceCount > 0
                                        ? Math.min(services.length, visibleServiceCount + 10)
                                        : undefined
                                })}>
                                {hiddenServiceCount > 0 ? `+${hiddenServiceCount}${translate('hostSocketMoreItems')}` : translate('hostSocketCollapse')}
                            </button>
                        )}
                    </div>
                    <div className={classes.socketServiceList}>
                        {visibleServices.map(item => (
                            <div className={classes.socketServiceRow} key={`${item.port}-${item.protocol}-${item.process}`}>
                                <span className={classes.socketServicePortBadge}>{item.port} / {item.protocol}</span>
                                <span className={classes.socketServiceProcess}>{item.process}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    private renderValue(row: KeyValueRow) {
        const { classes } = this.props
        const value = stringify(row.value) || 'N/A'
        const displayValue = row.label === translate('KernelVersion') && value.length > 22 ? `${value.slice(0, 13)}...${value.slice(-8)}` : value
        return (
            <div className={classes.kvValueWrap}>
                <Tooltip title={value} placement="top" arrow>
                    <span className={classes.kvValue}>{displayValue}</span>
                </Tooltip>
                {row.copy && value !== 'N/A' && (
                    <Tooltip title={translate('copy')} placement="top" arrow>
                        <IconButton className={classes.copyButton} onClick={() => this.copyValue(value)}>
                            <FileCopyIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </div>
        )
    }

    private renderRows(rows: KeyValueRow[], emptyText = translate('hostNoData')) {
        const { classes } = this.props
        const visible = rows.filter(row => !isBlank(row.value))
        if (!visible.length) return <div className={classes.emptyState}>{emptyText}</div>
        return (
            <div className={classes.rowsCompact}>
                {visible.map(row => (
                    <div className={classes.kvRow} key={row.label}>
                        <div className={classes.kvLabel}>{row.label}</div>
                        {this.renderValue(row)}
                    </div>
                ))}
            </div>
        )
    }

    private renderSection(icon: React.ReactNode, title: string, description: string, children: React.ReactNode, className = '') {
        const { classes } = this.props
        return (
            <section className={`${classes.panelCard} ${className}`}>
                <div className={classes.panelHeader}>
                    <span className={classes.panelIcon}>{icon}</span>
                    <div className={classes.panelTitleBlock}>
                        <div className={classes.panelTitle}>{title}</div>
                        {description && <div className={classes.panelDescription}>{description}</div>}
                    </div>
                </div>
                {children}
            </section>
        )
    }

    private renderMetricGrid(items: MetricItem[], emptyText = translate('hostNoResourceMetrics')) {
        const { classes } = this.props
        const visible = items.filter(item => item.value)
        if (!visible.length) return <div className={classes.emptyState}>{emptyText}</div>
        return (
            <div className={classes.metricGrid}>
                {visible.map(item => (
                    <div className={`${classes.metricTile} ${item.muted ? classes.metricTileMuted : ''}`} key={item.label}>
                        <span className={classes.metricIcon}>{item.icon || <InfoIcon />}</span>
                        <div className={classes.metricBody}>
                            <div className={classes.metricLabel}>{item.label}</div>
                            <div className={classes.metricValue}>{item.value}</div>
                            {item.sub && <div className={classes.metricSub}>{item.sub}</div>}
                            {item.percent !== undefined && (
                                <div className={classes.progressTrack}>
                                    <div className={classes.progressFill} style={{ width: `${item.percent}%` }} />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    private renderOverviewGrid(items: OverviewCardItem[], emptyText = translate('hostNoConnectedResources')) {
        const { classes } = this.props
        const visible = items.filter(item => item.value)
        if (!visible.length) return <div className={classes.emptyState}>{emptyText}</div>
        return (
            <div className={classes.connectedResourceGrid}>
                {visible.map(item => {
                    const numericValue = Number(item.value)
                    const hasZeroValue = item.value !== '' && !Number.isNaN(numericValue) && numericValue === 0
                    const canFocus = !hasZeroValue && (
                        (!!item.onClick)
                        || (!!item.actionKey && !!item.nodeIDs && item.nodeIDs.length > 0)
                    )
                    const actionClassName = `${classes.connectedResourceCardAction} ${!canFocus ? classes.connectedResourceCardActionHidden : ''}`
                    return (
                        <button
                            type="button"
                            className={`${classes.connectedResourceCard} ${canFocus ? classes.connectedResourceCardClickable : classes.connectedResourceCardStatic}`}
                            key={item.label}
                            onClick={() => {
                                if (!canFocus) return
                                if (item.onClick) {
                                    item.onClick()
                                    return
                                }
                                this.focusConnectedResource(item.actionKey, item.nodeIDs)
                            }}
                            aria-disabled={!canFocus}
                            tabIndex={canFocus ? 0 : -1}>
                            <span className={classes.connectedResourceCardMain}>
                                <span className={classes.connectedResourceCardIcon}>{item.icon || <InfoIcon />}</span>
                                <span>
                                    <strong>{item.label}</strong>
                                </span>
                            </span>
                            <span className={classes.connectedResourceCardValue}>{item.value}</span>
                            <span className={actionClassName} aria-hidden={!canFocus}>›</span>
                        </button>
                    )
                })}
            </div>
        )
    }

    private renderConnectedResourceSubsection(icon: React.ReactNode, title: string, items: OverviewCardItem[], emptyText = translate('hostNoConnectedResources')) {
        const { classes } = this.props
        return (
            <div className={classes.connectedResourceSection}>
                <div className={classes.connectedResourceSectionHeader}>
                    <span className={classes.connectedResourceSectionIcon}>{icon}</span>
                    <span className={classes.connectedResourceSectionTitle}>{title}</span>
                </div>
                {this.renderOverviewGrid(items, emptyText)}
            </div>
        )
    }

    private infrastructureIcon(glyph: string, tone: string) {
        const { classes } = this.props
        const colors: Record<string, string> = {
            network: '#3f7ee8',
            'user-vm': '#41a878',
            'system-vm': '#6d4bd8',
            router: '#7c4bd3'
        }
        return (
            <span className={`${classes.connectedResourceFaIcon} fa fas fa-fw`} style={{ color: colors[tone] || colors.network }}>
                {glyph}
            </span>
        )
    }

    private renderPills(values: Array<string | PillItem>, emptyText: string) {
        const { classes } = this.props
        if (!values.length) return <div className={classes.emptyState}>{emptyText}</div>
        return (
            <div className={classes.pillList}>
                {values.map(value => {
                    const item = typeof value === 'string' ? { label: value, title: value } : value
                    return (
                        <Tooltip title={item.title || item.label} key={item.label} placement="top" arrow>
                            <span className={classes.pill}>{item.label}</span>
                        </Tooltip>
                    )
                })}
            </div>
        )
    }

    render() {
        const { classes, node } = this.props
        const data = this.mergedData()
        const name = firstValue(data, ['Name', 'Hostname', 'HostName']) || node.id
        const ipList = this.ips()
        const macList = this.macs()
        const representativeIp = ipList[0] || ''
        const socketStats = this.socketStats()
        const virtualization = firstValue(data, ['VirtualizationSystem', 'Hypervisor', 'HypervisorType'])
        const virtualizationText = virtualization ? virtualization.toUpperCase() : ''
        const zone = firstValue(data, ['Zone', 'ZoneName'])
        const cluster = firstValue(data, ['Cluster', 'ClusterName'])
        const pod = firstValue(data, ['Pod', 'PodName'])
        const locationText = [zone, pod, cluster].filter(Boolean).join(' > ')
        const resourceState = firstValue(data, ['ResourceState', 'resourceState', 'AllocationState', 'allocationState'])
        const platform = firstValue(data, ['Platform', 'platform'])
        const platformVersion = firstValue(data, ['PlatformVersion', 'platformVersion', 'platformversion'])
        const os = firstValue(data, ['OS', 'Os', 'OperatingSystem'])
        const kernelVersion = firstValue(data, ['KernelVersion'])
        const platformText = [platform, platformVersion, os].filter(Boolean).join(' · ')
        const managementServer = firstValue(data, ['ManagementServer', 'ManagementIP', 'ManagementIp', 'managementIp', 'privateIpAddress'])
        const graphHostSummary = this.props.infrastructureHostSummaries?.[node.id]
        const connectedVmArrayCount = asArray(data.UserVMs).length || asArray(data.VMs).length || asArray(data.VirtualMachines).length
        const systemVmArrayCount = asArray(data.SystemVMs).length || asArray(data.SystemVms).length || asArray(data.SystemVirtualMachines).length
        const virtualRouterArrayCount = asArray(data.VirtualRouters).length || asArray(data.Routers).length || asArray(data.VirtualRouter).length
        const vmCount = graphHostSummary?.userVMs ?? numberValue(data, ['ConnectedVMCount', 'ConnectedVmCount', 'UserVMCount', 'userVmCount', 'VmCount', 'VMCount', 'UserVmCount', 'RunningVms', 'RunningVMCount', 'runningVmCount', 'VirtualMachineCount']) ?? (connectedVmArrayCount > 0 ? connectedVmArrayCount : undefined)
        const systemVmCount = graphHostSummary?.systemVMs ?? numberValue(data, ['SystemVmCount', 'SystemVMCount', 'systemVmCount']) ?? (systemVmArrayCount > 0 ? systemVmArrayCount : undefined)
        const virtualRouterCount = graphHostSummary?.routers ?? numberValue(data, ['VirtualRouterCount', 'virtualRouterCount', 'RouterCount', 'routerCount', 'VRCount']) ?? (virtualRouterArrayCount > 0 ? virtualRouterArrayCount : undefined)
        const explicitNetworkCount = numberValue(data, ['NetworkCount', 'networkCount', 'NetworksCount', 'ConnectedNetworkCount', 'connectedNetworkCount'])
        const derivedNetworkCount = asArray(data.Networks).length || asArray(data.Network).length || asArray(data.NetworkObjects).length || asArray(data.Interfaces).length || asArray(data.interfaces).length
        const networkCount = graphHostSummary?.networkObjects ?? (explicitNetworkCount !== undefined ? explicitNetworkCount : (derivedNetworkCount > 0 ? derivedNetworkCount : undefined))
        const physicalNicCount = numberValue(data, ['PhysicalNicCount', 'PhysicalNICCount', 'NicCount', 'NICCount'])
        const bridgeCount = numberValue(data, ['BridgeCount', 'HostBridgeCount'])
        const bondCount = numberValue(data, ['BondCount', 'BondingCount'])
        const tags = [
            data.Type ? `type: ${data.Type}` : '',
            data.Manager ? `manager: ${data.Manager}` : '',
            data.Probe ? `probe: ${data.Probe}` : '',
            data.Role ? `role: ${data.Role}` : '',
            zone ? `zone: ${zone}` : ''
        ].filter(Boolean)

        const basicRows: KeyValueRow[] = [
            { label: translate('Hostname'), value: name },
            { label: translate('hostMoldHostId'), value: firstValue(data, ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID', 'UUID', 'uuid']), copy: true },
            { label: translate('hostManagementIp'), value: managementServer || representativeIp, copy: true },
            { label: translate('hostLocation'), value: locationText },
            { label: '하이퍼바이저', value: virtualizationText },
            { label: translate('Platform'), value: platformText },
            { label: translate('KernelVersion'), value: kernelVersion, copy: true }
        ]

        const eventRows: KeyValueRow[] = [
            { label: translate('hostLastUpdate'), value: formatDate(firstValue(data, ['UpdatedAt', 'LastUpdate', 'LastSeen', '@UpdatedAt', '@CreatedAt', 'CreatedAt'])) },
            { label: translate('hostRecentEvent'), value: firstValue(data, ['RecentEvent', 'LastEvent', 'Event']) },
            { label: translate('hostRecentCapture'), value: firstValue(data, ['RecentCapture', 'LastCapture', 'CaptureState']) },
            { label: translate('hostRecentStateChange'), value: formatDate(firstValue(data, ['StateChangedAt', 'LastStateChange', 'StatusChangedAt'])) }
        ]

        const connectedResources: OverviewCardItem[] = [
            { label: translate('infrastructureUserVMs'), description: translate('infrastructureUserVMsDescription'), value: vmCount !== undefined ? String(vmCount) : '', icon: this.infrastructureIcon('\uf108', 'user-vm'), actionKey: 'userVMs', nodeIDs: this.hostInfrastructureNodeIDs('userVMs') },
            { label: translate('infrastructureSystemVMs'), description: translate('infrastructureSystemVMsDescription'), value: systemVmCount !== undefined ? String(systemVmCount) : '', icon: this.infrastructureIcon('\uf085', 'system-vm'), actionKey: 'systemVMs', nodeIDs: this.hostInfrastructureNodeIDs('systemVMs') },
            { label: translate('infrastructureRouters'), description: translate('infrastructureRoutersDescription'), value: virtualRouterCount !== undefined ? String(virtualRouterCount) : '', icon: this.infrastructureIcon('\uf4d7', 'router'), actionKey: 'routers', nodeIDs: this.hostInfrastructureNodeIDs('routers') },
            { label: translate('infrastructureNetworkObjects'), description: translate('infrastructureNetworkObjectsDescription'), value: networkCount !== undefined ? String(networkCount) : '', icon: this.infrastructureIcon('\uf6ff', 'network'), actionKey: 'networkObjects', nodeIDs: this.hostInfrastructureNodeIDs('networkObjects') }
        ]
        const kubernetesNodes = this.hostKubernetesNodes()
        const kubernetesClusters = this.hostKubernetesClusters(kubernetesNodes)
        const kubernetesClusterNames = kubernetesClusters.map(clusterItem => clusterItem.name)
        const kubernetesResources: OverviewCardItem[] = [
            {
                label: translate('kubernetesTopologyNodes'),
                description: kubernetesClusterNames.length > 0 ? kubernetesClusterNames.join(', ') : '',
                value: String(kubernetesNodes.length),
                icon: this.infrastructureIcon('\uf233', 'host'),
                nodeIDs: kubernetesNodes.map(item => item.id),
                onClick: () => this.openKubernetesNodePicker()
            }
        ]
        const resolvedPhysicalNicCount = physicalNicCount !== undefined ? physicalNicCount : this.interfaceCountByPattern([/\bnic\b/, /\beth\d+\b/, /\benp/, /\bens/, /\beno/])
        const resolvedBridgeCount = bridgeCount !== undefined ? bridgeCount : this.interfaceCountByPattern([/\bbridge\b/, /^br/, /\bovs\b/])
        const resolvedBondCount = bondCount !== undefined ? bondCount : this.interfaceCountByPattern([/\bbond\b/, /\bbonding\b/])
        const networkMetrics: MetricItem[] = [
            { label: translate('hostManagementIp'), value: managementServer || representativeIp, icon: <RouterIcon /> },
            { label: translate('MAC'), value: macList.length ? String(macList.length) : '', icon: <SecurityIcon /> },
            { label: translate('phy-nics'), value: resolvedPhysicalNicCount !== undefined ? String(resolvedPhysicalNicCount) : '', sub: this.mainInterface() || undefined, icon: <DeviceHubIcon /> },
            { label: translate('host-bridges'), value: resolvedBridgeCount !== undefined ? String(resolvedBridgeCount) : '', icon: <RouterIcon /> },
            { label: translate('phy-bond'), value: resolvedBondCount !== undefined ? String(resolvedBondCount) : '', icon: <SecurityIcon /> }
        ]

        const hasMoldRows = [zone, cluster, pod, resourceState, managementServer, firstValue(data, ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID'])].some(value => !isBlank(value))
        const hasConnectedMetrics = connectedResources.some(item => !isBlank(item.value)) || kubernetesResources.some(item => !isBlank(item.value))
        const visibleNetworkMetrics = networkMetrics.filter(item => item.value)
        const hasNetworkSummary = visibleNetworkMetrics.length > 1
        const hasRecentSignals = eventRows.some(row => !isBlank(row.value))

        return (
            <div className={classes.root}>
                {this.renderSection(<InfoIcon />, translate('hostBasicInfo'), translate('hostOverviewDescription'), this.renderRows(basicRows))}
                <HostResourceTrendPanel
                    node={node}
                    session={this.props.session}
                    data={data}
                />
                {hasConnectedMetrics && this.renderSection(<DeviceHubIcon />, translate('hostConnectedResources'), translate('hostConnectedResourcesDescription'), (
                    <div className={classes.connectedResourceSectionStack}>
                        {this.renderConnectedResourceSubsection(<AccountTreeIcon />, translate('infrastructureMenu'), connectedResources, translate('hostNoConnectedResources'))}
                        {this.renderConnectedResourceSubsection(<DeviceHubIcon />, 'Kubernetes', kubernetesResources, translate('hostNoConnectedResources'))}
                    </div>
                ))}
                {this.renderSection(<PowerIcon />, translate('hostSocketsProcesses'), '수신 대기 서비스와 주요 소켓 프로세스를 요약합니다.', this.renderSocketProcessSummary())}
                {hasNetworkSummary && this.renderSection(<RouterIcon />, translate('hostNetworkSummary'), translate('hostNetworkSummaryDescription'), this.renderMetricGrid(networkMetrics, translate('hostNetworkDetailsMissing')))}
                {hasRecentSignals && this.renderSection(<InfoIcon />, translate('hostRecentSignals'), translate('hostRecentSignalsDescription'), this.renderRows(eventRows, translate('hostNoRecentSignals')))}

                {!hasMoldRows && (
                    <div className={classes.noticeCard}>
                        <InfoIcon />
                        <span>{translate('hostMoldMissing')}</span>
                    </div>
                )}
                {this.renderKubernetesNodePicker()}
            </div>
        )
    }
}

export default withStyles(styles)(HostDetailPanel)
