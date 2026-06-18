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
import { withStyles } from '@material-ui/core/styles'

import { Node } from '../Topology'
import { translate } from '../Config'
import { styles } from './HostDetailPanelStyles'

interface Props {
  classes: any
  node: Node
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
}

interface InsightItem {
  label: string
  value: string
  sub?: string
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

class HostDetailPanel extends React.Component<Props> {
  private copyValue(value: string) {
    if (!value) return
    const nav: any = navigator
    if (nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(value)
    }
  }

  private ips(): string[] {
    const data = this.props.node.data || {}
    return [
      ...asArray(data.IPV4),
      ...asArray(data.IPV6),
      ...asArray(data.IP),
      ...asArray(data.Addr),
    ].map(stringify).filter(Boolean)
  }

  private macs(): string[] {
    const data = this.props.node.data || {}
    return [
      ...asArray(data.MAC),
      ...asArray(data.Mac),
      ...asArray(data.MACs),
    ].map(stringify).filter(Boolean)
  }

  private networks(): string[] {
    const data = this.props.node.data || {}
    return [
      ...asArray(data.Network),
      ...asArray(data.Networks),
      ...asArray(data.VRF),
      ...asArray(data.Zone),
    ].map(stringify).filter(Boolean)
  }

  private sockets(): any[] {
    const sockets = this.props.node.data?.Sockets
    return Array.isArray(sockets) ? sockets : []
  }

  private statusText(): string {
    const data = this.props.node.data || {}
    const state = firstValue(data, ['State', 'Status', 'AgentStatus'])
    if (!state) return translate('hostStatusCollected')
    const normalized = state.toLowerCase()
    if (normalized === 'up' || normalized === 'running' || normalized === 'ok' || normalized === 'connected') {
      return translate('hostStatusNormal')
    }
    return state
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
    if (!visible.length) {
      return <div className={classes.emptyState}>{translate('hostNoData')}</div>
    }
    return (
      <div className={classes.rows}>
        {visible.map(row => (
          <div className={classes.kvRow} key={row.label}>
            <div className={classes.kvLabel}>{row.label}</div>
            {this.renderValue(row)}
          </div>
        ))}
      </div>
    )
  }

  private renderSection(icon: React.ReactNode, title: string, description: string, children: React.ReactNode) {
    const { classes } = this.props
    return (
      <section className={classes.sectionCard}>
        <div className={classes.sectionHeader}>
          <span className={classes.sectionIcon}>{icon}</span>
          <div className={classes.sectionTitleBlock}>
            <div className={classes.sectionTitle}>{title}</div>
            {description && <div className={classes.sectionDescription}>{description}</div>}
          </div>
        </div>
        {children}
      </section>
    )
  }

  private renderHero(items: InsightItem[], chips: string[]) {
    const { classes } = this.props
    const visible = items.filter(item => item.value)
    return (
      <section className={classes.heroCard}>
        <div className={classes.heroHeader}>
          <div>
            <div className={classes.heroTitle}>{translate('hostOperationsSummary')}</div>
            <div className={classes.heroDescription}>{translate('hostOperationsDescription')}</div>
          </div>
          <div className={classes.heroChips}>
            {chips.filter(Boolean).slice(0, 3).map(chip => <span className={classes.statusChip} key={chip}>{chip}</span>)}
          </div>
        </div>
        <div className={classes.heroInsights}>
          {visible.map(item => (
            <div className={classes.heroInsight} key={item.label}>
              <span className={classes.heroInsightIcon}>{item.icon || <InfoIcon />}</span>
              <div className={classes.heroInsightText}>
                <div className={classes.heroInsightLabel}>{item.label}</div>
                <Tooltip title={item.value} placement="top" arrow>
                  <div className={classes.heroInsightValue}>{item.value}</div>
                </Tooltip>
                {item.sub && <div className={classes.heroInsightSub}>{item.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  private renderMetrics(items: MetricItem[]) {
    const { classes } = this.props
    const visible = items.filter(item => item.value)
    if (!visible.length) {
      return <div className={classes.emptyState}>{translate('hostNoResourceMetrics')}</div>
    }
    return (
      <div className={classes.metricGrid}>
        {visible.map(item => (
          <div className={`${classes.metricTile} ${item.muted ? classes.metricTileMuted : ''}`} key={item.label}>
            <div className={classes.metricLabel}>{item.label}</div>
            <div className={classes.metricValue}>{item.value}</div>
            {item.sub && <div className={classes.metricSub}>{item.sub}</div>}
            {item.percent !== undefined && (
              <div className={classes.progressTrack}>
                <div className={classes.progressFill} style={{ width: `${item.percent}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  private renderPills(values: Array<string | PillItem>, emptyText: string) {
    const { classes } = this.props
    if (!values.length) return <div className={classes.emptyState}>{emptyText}</div>
    return (
      <div className={classes.portList}>
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

  private mainInterface(): string {
    const data = this.props.node.data || {}
    return firstValue(data, ['Interface', 'IfName', 'IfAlias', 'IfDescr'])
  }

  private shortProcessName(process: string): string {
    if (!process) return ''
    const command = process.split(/\s+/)[0]
    const base = command.split('/').filter(Boolean).pop() || command
    if (base.indexOf('qemu-system') === 0) return 'qemu-system'
    return base
  }

  private topPorts(): PillItem[] {
    const ports = new Map<string, PillItem>()
    this.sockets().forEach(socket => {
      const port = stringify(socket.LocalPort || socket.Port || socket.localPort)
      if (!port) return
      const process = stringify(socket.Process || socket.ProcessName || socket.Name || socket.Service)
      const shortProcess = this.shortProcessName(process)
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

  private socketSummary(): KeyValueRow[] {
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
    return [
      { label: translate('hostTotalSockets'), value: sockets.length ? sockets.length : '' },
      { label: translate('hostOpenPorts'), value: ports.size ? ports.size : '' },
      { label: translate('hostListenPorts'), value: listen || '' },
      { label: translate('hostExternalConnections'), value: external || '' }
    ]
  }

  private moldRows(): KeyValueRow[] {
    const data = this.props.node.data || {}
    return [
      { label: translate('hostZone'), value: firstValue(data, ['Zone', 'ZoneName']) },
      { label: translate('hostCluster'), value: firstValue(data, ['Cluster', 'ClusterName']) },
      { label: translate('hostPod'), value: firstValue(data, ['Pod', 'PodName']) },
      { label: translate('hostDomain'), value: firstValue(data, ['Domain', 'DomainName']) },
      { label: translate('hostAccount'), value: firstValue(data, ['Account', 'AccountName']) },
      { label: translate('hostMoldHostId'), value: firstValue(data, ['MoldHostId', 'CloudStackHostId', 'HostId', 'HostID']), copy: true },
      { label: translate('hostResourceState'), value: firstValue(data, ['ResourceState']) },
      { label: translate('hostAllocationState'), value: firstValue(data, ['AllocationState']) },
      { label: translate('hostManagementServer'), value: firstValue(data, ['ManagementServer', 'ManagementIP', 'ManagementIp']) }
    ]
  }

  render() {
    const { classes, node } = this.props
    const data = node.data || {}
    const name = firstValue(data, ['Name', 'Hostname', 'HostName']) || node.id
    const ipList = this.ips()
    const macList = this.macs()
    const networkList = this.networks()
    const representativeIp = ipList[0] || ''
    const kernelCmdLine = firstValue(data, ['KernelCmdLine', 'CommandLine'])
    const tags = [
      data.Type ? `type: ${data.Type}` : '',
      data.Manager ? `manager: ${data.Manager}` : '',
      data.Probe ? `probe: ${data.Probe}` : '',
      data.Role ? `role: ${data.Role}` : '',
      data.Site ? `site: ${data.Site}` : '',
      data.Zone ? `zone: ${data.Zone}` : ''
    ].filter(Boolean)

    const hostName = firstValue(data, ['Hostname', 'HostName'])
    const basicRows: KeyValueRow[] = [
      ...(hostName && hostName !== name ? [{ label: translate('Hostname'), value: hostName }] : []),
      { label: translate('Type'), value: data.Type },
      { label: translate('TID'), value: data.TID, copy: true },
      { label: translate('hostVirtualizationRole'), value: firstValue(data, ['VirtualizationRole', 'HypervisorRole', 'Role']) },
      { label: translate('hostVirtualizationSystem'), value: firstValue(data, ['VirtualizationSystem', 'Hypervisor', 'Platform']) }
    ]

    const osRows: KeyValueRow[] = [
      { label: translate('hostOS'), value: firstValue(data, ['OS', 'Os', 'OperatingSystem']) },
      { label: translate('Platform'), value: data.Platform },
      { label: translate('PlatformVersion'), value: data.PlatformVersion },
      { label: translate('KernelVersion'), value: data.KernelVersion, copy: true },
      { label: translate('hostBootImage'), value: firstValue(data, ['BootImage', 'KernelImage', 'Image']), copy: true },
      { label: translate('hostBootTime'), value: formatDate(firstValue(data, ['BootTime', 'StartedAt', 'StartTime'])) }
    ]

    const statusRows: KeyValueRow[] = [
      { label: translate('hostCollectionState'), value: translate('hostStatusCollected') },
      { label: translate('hostAgent'), value: firstValue(data, ['State', 'Status', 'AgentStatus']) ? this.statusText() : '' },
      { label: translate('hostLastUpdate'), value: formatDate(firstValue(data, ['UpdatedAt', 'LastUpdate', 'LastSeen', '@UpdatedAt', '@CreatedAt', 'CreatedAt'])) },
      { label: translate('hostMonitoringPeriod'), value: firstValue(data, ['Uptime', 'MonitoringPeriod']) },
      { label: translate('hostLocation'), value: [data.Zone, data.Rack, data.Site].map(stringify).filter(Boolean).join(' / ') }
    ]

    const virtualization = firstValue(data, ['VirtualizationSystem', 'Hypervisor', 'Platform'])
    const platform = [firstValue(data, ['OS', 'Os', 'OperatingSystem']), data.Platform, data.PlatformVersion].map(stringify).filter(Boolean).join(' · ')
    const socketCount = this.sockets().length
    const openPortCount = new Set(this.sockets().map(socket => stringify(socket.LocalPort || socket.Port || socket.localPort)).filter(Boolean)).size
    const heroItems: InsightItem[] = [
      {
        label: translate('hostHypervisor'),
        value: virtualization || translate('hostInfoUnavailable'),
        sub: platform || undefined,
        icon: <ComputerIcon />
      },
      {
        label: translate('hostSocketFootprint'),
        value: socketCount ? String(socketCount) : translate('hostInfoUnavailable'),
        sub: openPortCount ? `${translate('hostOpenPorts')} ${openPortCount}` : undefined,
        icon: <PowerIcon />
      },
      {
        label: translate('hostRepresentativeAddress'),
        value: representativeIp || translate('hostNoRepresentativeIp'),
        sub: this.mainInterface() || undefined,
        icon: <DeviceHubIcon />
      }
    ]
    const heroChips = [this.statusText(), virtualization, data.Platform].map(stringify).filter(Boolean)

    const resourceMetrics: MetricItem[] = [
      { label: translate('hostCpuUsage'), value: percentValue(data, ['CPUUsage', 'CpuUsage', 'CPU']) !== undefined ? `${Math.round(percentValue(data, ['CPUUsage', 'CpuUsage', 'CPU'])!)}%` : '', percent: percentValue(data, ['CPUUsage', 'CpuUsage', 'CPU']) },
      { label: translate('hostMemoryUsage'), value: percentValue(data, ['MemoryUsage', 'MemUsage', 'Memory']) !== undefined ? `${Math.round(percentValue(data, ['MemoryUsage', 'MemUsage', 'Memory'])!)}%` : '', percent: percentValue(data, ['MemoryUsage', 'MemUsage', 'Memory']) },
      { label: translate('hostStorageUsage'), value: percentValue(data, ['StorageUsage', 'DiskUsage', 'Storage']) !== undefined ? `${Math.round(percentValue(data, ['StorageUsage', 'DiskUsage', 'Storage'])!)}%` : '', percent: percentValue(data, ['StorageUsage', 'DiskUsage', 'Storage']) }
    ]

    const networkMetrics: MetricItem[] = [
      { label: translate('hostIpCount'), value: String(ipList.length), muted: ipList.length === 0 },
      { label: translate('hostInterfaceCount'), value: String(numberValue(data, ['InterfaceCount', 'InterfacesCount']) || (this.mainInterface() ? 1 : 0)), muted: !this.mainInterface() },
      { label: translate('hostMacCount'), value: String(macList.length), muted: macList.length === 0 },
      { label: translate('hostNetworkCount'), value: String(networkList.length), muted: networkList.length === 0 }
    ]
    const networkDetailMissing = ipList.length === 0 && macList.length === 0 && networkList.length === 0
    const moldRows = this.moldRows()

    return (
      <div className={classes.root}>
        {this.renderHero(heroItems, heroChips)}
        {this.renderSection(<InfoIcon />, translate('hostStatusSection'), translate('hostStatusSectionDescription'), this.renderRows(statusRows))}
        {this.renderSection(<StorageIcon />, translate('hostMoldContext'), translate('hostMoldContextDescription'), (
          moldRows.some(row => !isBlank(row.value))
            ? this.renderRows(moldRows)
            : <div className={classes.emptyState}>{translate('hostMoldMissing')}</div>
        ))}
        {this.renderSection(<StorageIcon />, translate('hostBasicInfo'), translate('hostBasicInfoDescription'), this.renderRows(basicRows))}
        {this.renderSection(<ComputerIcon />, translate('hostOsPlatform'), translate('hostOsPlatformDescription'), (
          <React.Fragment>
            {this.renderRows(osRows)}
            {kernelCmdLine && (
              <Accordion className={classes.rawAccordion} TransitionProps={{ unmountOnExit: true }}>
                <AccordionSummary className={classes.rawSummary} expandIcon={<ExpandMoreIcon />}>
                  <span className={classes.sectionIcon}><CodeIcon /></span>
                  <Typography>{translate('hostKernelCmdLineView')}</Typography>
                </AccordionSummary>
                <AccordionDetails className={classes.rawDetails}>
                  <pre className={classes.codeBlock}>{kernelCmdLine}</pre>
                </AccordionDetails>
              </Accordion>
            )}
          </React.Fragment>
        ))}
        {this.renderSection(<TimelineIcon />, translate('hostResourceUsage'), translate('hostResourceUsageDescription'), this.renderMetrics(resourceMetrics))}
        {this.renderSection(<DeviceHubIcon />, translate('hostNetworkSummary'), translate('hostNetworkSummaryDescription'), (
          <React.Fragment>
            {this.renderMetrics(networkMetrics)}
            {networkDetailMissing && <div className={classes.networkNotice}>{translate('hostNetworkDetailsMissing')}</div>}
            {this.renderRows([
              { label: translate('hostRepresentativeIp'), value: representativeIp, copy: true },
              { label: translate('hostMainInterface'), value: this.mainInterface() || translate('hostInfoUnavailable') },
              { label: translate('MAC'), value: macList.join(', '), copy: true }
            ])}
          </React.Fragment>
        ))}
        {this.renderSection(<PowerIcon />, translate('hostSocketsProcesses'), translate('hostSocketsProcessesDescription'), (
          <React.Fragment>
            {this.renderMetrics(this.socketSummary().map(row => ({ label: row.label, value: stringify(row.value) })))}
            <div className={classes.subsectionLabel}>{translate('hostTopPorts')}</div>
            {this.renderPills(this.topPorts(), translate('hostNoSocketInfo'))}
          </React.Fragment>
        ))}
        {this.renderSection(<LabelIcon />, translate('hostSystemTags'), translate('hostSystemTagsDescription'), this.renderPills(tags, translate('hostNoTags')))}
      </div>
    )
  }
}

export default withStyles(styles)(HostDetailPanel)
