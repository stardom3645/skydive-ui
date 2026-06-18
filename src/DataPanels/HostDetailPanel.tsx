import * as React from 'react'
import Accordion from '@material-ui/core/Accordion'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import IconButton from '@material-ui/core/IconButton'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import FileCopyIcon from '@material-ui/icons/FileCopy'
import InfoIcon from '@material-ui/icons/Info'
import StorageIcon from '@material-ui/icons/Storage'
import ComputerIcon from '@material-ui/icons/Computer'
import TimelineIcon from '@material-ui/icons/Timeline'
import DeviceHubIcon from '@material-ui/icons/DeviceHub'
import PowerIcon from '@material-ui/icons/Power'
import LabelIcon from '@material-ui/icons/Label'
import CodeIcon from '@material-ui/icons/Code'
import SecurityIcon from '@material-ui/icons/Security'
import RouterIcon from '@material-ui/icons/Router'
import ArrowForwardIosIcon from '@material-ui/icons/ArrowForwardIos'
import { withStyles } from '@material-ui/core/styles'

import { Node } from '../Topology'
import { session } from '../Store'
import { translate } from '../Config'
import { styles } from './HostDetailPanelStyles'

interface Props {
  classes: any
  node: Node
  session?: session
}

interface State {
  moldDetail?: any
  moldDetailLoadedFor?: string
}

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

interface PillItem {
  label: string
  title?: string
}

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

const percentValue = (data: any, keys: string[]): number | undefined => {
  const value = numberValue(data, keys)
  if (value === undefined) return undefined
  return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value))
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

class HostDetailPanel extends React.Component<Props, State> {
  state: State = {}

  componentDidMount() {
    this.loadMoldHostDetail()
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.node.id !== this.props.node.id) {
      this.loadMoldHostDetail()
    }
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
      ...(this.state.moldDetail || {}),
      ...(this.props.node.data || {})
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
        this.setState({ moldDetail: detail && (detail.host || detail.data || detail) })
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
      ...asArray(data.ManagementIp),
    ].map(stringify).filter(Boolean)
  }

  private macs(): string[] {
    const data = this.mergedData()
    return [
      ...asArray(data.MAC),
      ...asArray(data.Mac),
      ...asArray(data.MACs),
      ...asArray(data.MacAddress),
      ...asArray(data.macaddress),
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
    const explicit = firstValue(data, ['Interface', 'IfName', 'IfAlias', 'IfDescr', 'ManagementInterface'])
    if (explicit) return explicit
    const firstInterface = this.interfaces()[0]
    return firstValue(firstInterface, ['Name', 'name', 'Interface', 'IfName', 'Device'])
  }

  private socketStats() {
    const sockets = this.sockets()
    const ports = new Set<string>()
    let listen = 0
    let external = 0
    sockets.forEach(socket => {
      const port = stringify(socket.LocalPort || socket.Port || socket.localPort)
      if (port) ports.add(port)
      const state = stringify(socket.State || socket.Status).toLowerCase()
      const remote = stringify(socket.RemoteAddress || socket.RemoteAddr || socket.remoteAddress)
      if (state === 'listen' || state === 'listening' || (!remote && port)) listen += 1
      if (remote && remote !== '127.0.0.1' && remote !== '::1' && remote !== '0.0.0.0') external += 1
    })
    return { total: sockets.length, ports: ports.size, listen, external }
  }

  private topPorts(): PillItem[] {
    const ports = new Map<string, PillItem>()
    this.sockets().forEach(socket => {
      const port = stringify(socket.LocalPort || socket.Port || socket.localPort)
      if (!port) return
      const process = stringify(socket.Process || socket.ProcessName || socket.Name || socket.Service)
      const shortProcess = compactProcessName(process)
      ports.set(port, {
        label: shortProcess ? `${port} / ${shortProcess}` : port,
        title: process ? `${port} / ${process}` : port
      })
    })
    const values = Array.from(ports.values())
    if (values.length > 4) {
      return values.slice(0, 4).concat({
        label: `+${values.length - 4} more`,
        title: translate('hostMoreSocketInfo')
      })
    }
    return values
  }

  private renderValue(row: KeyValueRow) {
    const { classes } = this.props
    const value = stringify(row.value) || 'N/A'
    return (
      <div className={classes.kvValueWrap}>
        <Tooltip title={value} placement="top" arrow>
          <span className={classes.kvValue}>{value}</span>
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

  private renderRows(rows: KeyValueRow[]) {
    const { classes } = this.props
    const visible = rows.filter(row => !isBlank(row.value))
    if (!visible.length) return <div className={classes.emptyState}>{translate('hostNoData')}</div>
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

  private renderMetricGrid(items: MetricItem[]) {
    const { classes } = this.props
    const visible = items.filter(item => item.value)
    if (!visible.length) return <div className={classes.emptyState}>{translate('hostNoResourceMetrics')}</div>
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

  private renderPath(items: string[]) {
    const { classes } = this.props
    const visible = items.filter(Boolean)
    if (!visible.length) return <div className={classes.emptyState}>{translate('hostNoTopologyPath')}</div>
    return (
      <div className={classes.pathRow}>
        {visible.map((item, index) => (
          <React.Fragment key={`${item}-${index}`}>
            <span className={classes.pathChip}>{item}</span>
            {index < visible.length - 1 && <ArrowForwardIosIcon className={classes.pathArrow} />}
          </React.Fragment>
        ))}
      </div>
    )
  }

  render() {
    const { classes, node } = this.props
    const data = this.mergedData()
    const rawData = node.data || {}
    const name = firstValue(data, ['Name', 'Hostname', 'HostName']) || node.id
    const ipList = this.ips()
    const macList = this.macs()
    const representativeIp = ipList[0] || ''
    const kernelCmdLine = firstValue(data, ['KernelCmdLine', 'CommandLine'])
    const socketStats = this.socketStats()
    const virtualization = firstValue(data, ['VirtualizationSystem', 'Hypervisor', 'HypervisorType', 'Platform'])
    const zone = firstValue(data, ['Zone', 'ZoneName'])
    const cluster = firstValue(data, ['Cluster', 'ClusterName'])
    const pod = firstValue(data, ['Pod', 'PodName'])
    const domain = firstValue(data, ['Domain', 'DomainName'])
    const account = firstValue(data, ['Account', 'AccountName'])
    const resourceState = firstValue(data, ['ResourceState', 'AllocationState'])
    const managementServer = firstValue(data, ['ManagementServer', 'ManagementIP', 'ManagementIp'])
    const vmCount = numberValue(data, ['VmCount', 'VMCount', 'UserVmCount', 'RunningVms', 'VirtualMachineCount'])
    const systemVmCount = numberValue(data, ['SystemVmCount', 'SystemVMCount'])
    const cpuPercent = percentValue(data, ['CPUUsage', 'CpuUsage', 'CPU'])
    const memoryPercent = percentValue(data, ['MemoryUsage', 'MemUsage', 'Memory'])
    const storagePercent = percentValue(data, ['StorageUsage', 'DiskUsage', 'Storage'])
    const tags = [
      data.Type ? `type: ${data.Type}` : '',
      data.Manager ? `manager: ${data.Manager}` : '',
      data.Probe ? `probe: ${data.Probe}` : '',
      data.Role ? `role: ${data.Role}` : '',
      zone ? `zone: ${zone}` : ''
    ].filter(Boolean)

    const basicRows: KeyValueRow[] = [
      { label: translate('Type'), value: data.Type || 'host' },
      { label: translate('hostVirtualizationSystem'), value: virtualization },
      { label: translate('hostResourceState'), value: resourceState },
      { label: translate('TID'), value: rawData.TID || data.TID, copy: true }
    ]

    const eventRows: KeyValueRow[] = [
      { label: translate('hostCollectionState'), value: translate('hostStatusCollected') },
      { label: translate('hostAgent'), value: this.statusText() },
      { label: translate('hostLastUpdate'), value: formatDate(firstValue(data, ['UpdatedAt', 'LastUpdate', 'LastSeen', '@UpdatedAt', '@CreatedAt', 'CreatedAt'])) },
      { label: translate('hostBootTime'), value: formatDate(firstValue(data, ['BootTime', 'StartedAt', 'StartTime'])) },
      { label: translate('KernelVersion'), value: data.KernelVersion, copy: true }
    ]

    const resourceMetrics: MetricItem[] = [
      { label: translate('hostCpuUsage'), value: cpuPercent !== undefined ? `${Math.round(cpuPercent)}%` : '', percent: cpuPercent, icon: <TimelineIcon /> },
      { label: translate('hostMemoryUsage'), value: memoryPercent !== undefined ? `${Math.round(memoryPercent)}%` : '', percent: memoryPercent, icon: <StorageIcon /> },
      { label: translate('hostStorageUsage'), value: storagePercent !== undefined ? `${Math.round(storagePercent)}%` : '', percent: storagePercent, icon: <StorageIcon /> },
      { label: translate('hostSocketsProcesses'), value: socketStats.total ? String(socketStats.total) : '', sub: `${translate('hostOpenPorts')} ${socketStats.ports || 0}`, icon: <PowerIcon /> }
    ]

    const interfaceCount = this.interfaces().length || (this.mainInterface() ? 1 : 0)
    const connectedMetrics: MetricItem[] = [
      { label: translate('hostConnectedVMs'), value: vmCount !== undefined ? String(vmCount) : '', sub: systemVmCount !== undefined ? `${translate('hostSystemVMs')} ${systemVmCount}` : undefined, icon: <ComputerIcon /> },
      { label: translate('hostInterfaceCount'), value: interfaceCount ? String(interfaceCount) : '', sub: this.mainInterface() || undefined, icon: <DeviceHubIcon /> },
      { label: translate('hostIpCount'), value: ipList.length ? String(ipList.length) : '', sub: representativeIp || undefined, icon: <RouterIcon /> },
      { label: translate('hostListenPorts'), value: socketStats.total ? String(socketStats.listen || 0) : '', sub: `${translate('hostExternalConnections')} ${socketStats.external || 0}`, muted: socketStats.listen === 0, icon: <SecurityIcon /> }
    ]

    const moldRows: KeyValueRow[] = [
      { label: translate('hostZone'), value: zone },
      { label: translate('hostCluster'), value: cluster },
      { label: translate('hostPod'), value: pod },
      { label: translate('hostDomain'), value: domain },
      { label: translate('hostAccount'), value: account },
      { label: translate('hostMoldHostId'), value: firstValue(data, ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID']), copy: true },
      { label: translate('hostManagementServer'), value: managementServer }
    ]

    const hasMoldRows = moldRows.some(row => !isBlank(row.value))
    const topologyPath = [zone, cluster, pod, name]

    return (
      <div className={classes.root}>
        <div className={classes.overviewGrid}>
          {this.renderSection(<InfoIcon />, translate('hostBasicInfo'), translate('hostOverviewDescription'), this.renderRows(basicRows), classes.overviewCard)}
          {this.renderSection(<TimelineIcon />, translate('hostResourceUsage'), translate('hostResourceUsageDescription'), this.renderMetricGrid(resourceMetrics), classes.overviewCard)}
          {this.renderSection(<DeviceHubIcon />, translate('hostConnectedResources'), translate('hostConnectedResourcesDescription'), this.renderMetricGrid(connectedMetrics), classes.overviewCard)}
          {this.renderSection(<InfoIcon />, translate('hostRecentSignals'), translate('hostRecentSignalsDescription'), this.renderRows(eventRows), classes.overviewCard)}
        </div>

        {this.renderSection(<RouterIcon />, translate('hostTopologyPath'), translate('hostTopologyPathDescription'), this.renderPath(topologyPath))}

        {hasMoldRows && this.renderSection(<StorageIcon />, translate('hostMoldContext'), translate('hostMoldContextDescription'), this.renderRows(moldRows))}

        {this.renderSection(<PowerIcon />, translate('hostSocketsProcesses'), translate('hostSocketsProcessesDescription'), (
          <React.Fragment>
            {this.renderPills(this.topPorts(), translate('hostNoSocketInfo'))}
          </React.Fragment>
        ))}

        {kernelCmdLine && (
          <Accordion className={classes.rawAccordion} TransitionProps={{ unmountOnExit: true }}>
            <AccordionSummary className={classes.rawSummary} expandIcon={<ExpandMoreIcon />}>
              <span className={classes.panelIcon}><CodeIcon /></span>
              <Typography>{translate('hostKernelCmdLineView')}</Typography>
            </AccordionSummary>
            <AccordionDetails className={classes.rawDetails}>
              <pre className={classes.codeBlock}>{kernelCmdLine}</pre>
            </AccordionDetails>
          </Accordion>
        )}

        {tags.length > 1 && this.renderSection(<LabelIcon />, translate('hostSystemTags'), translate('hostSystemTagsDescription'), this.renderPills(tags, translate('hostNoTags')))}

        {!hasMoldRows && (
          <div className={classes.noticeCard}>
            <InfoIcon />
            <span>{translate('hostMoldMissing')}</span>
          </div>
        )}
      </div>
    )
  }
}

export default withStyles(styles)(HostDetailPanel)
