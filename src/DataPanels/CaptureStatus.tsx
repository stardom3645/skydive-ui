import * as React from 'react'
import Button from '@material-ui/core/Button'
import LinearProgress from '@material-ui/core/LinearProgress'
import Typography from '@material-ui/core/Typography'
import Accordion from '@material-ui/core/Accordion'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import VideocamIcon from '@material-ui/icons/Videocam'
import StopIcon from '@material-ui/icons/Stop'
import ReplayIcon from '@material-ui/icons/Replay'
import GetAppIcon from '@material-ui/icons/GetApp'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import SwapVertIcon from '@material-ui/icons/SwapVert'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import TrackChangesIcon from '@material-ui/icons/TrackChanges'
import SecurityIcon from '@material-ui/icons/Security'
import { createStyles, Theme, withStyles } from '@material-ui/core/styles'

import { session } from '../Store'
import { Configuration } from '../api/configuration'
import { TopologyApi } from '../api'
import { Node } from '../Topology'
import FlowPanel from './Flow'

export interface SimpleCaptureSession {
  id: string
  captureID?: string
  status: string
  startedAt: string
  expiresAt: string
  targetName: string
  targetType: string
  scope: string
  filterPreset: string
  bpf: string
  durationSeconds: number
}

interface Props {
  classes: any
  capture: SimpleCaptureSession
  session: session
  el: Node
  onUpdate: (capture: SimpleCaptureSession) => void
  onClear: () => void
  onRetry: () => void
}

interface State {
  now: number
  loading: boolean
  error: string
  flows: CaptureFlowSummary[]
  expandedFlowKey: string
  showAllTopFlows: boolean
}

const terminalStatuses = new Set(['completed', 'expired', 'delete_failed', 'failed', 'stopped'])

interface CaptureFlowSummary {
  key: string
  protocol: string
  application: string
  source: string
  destination: string
  sourcePort: string
  destinationPort: string
  bytes: number
  packets: number
}

class CaptureStatusPanel extends React.Component<Props, State> {
  private tickTimer?: number
  private pollTimer?: number

  constructor(props: Props) {
    super(props)
    this.state = { now: Date.now(), loading: false, error: '', flows: [], expandedFlowKey: '', showAllTopFlows: false }
  }

  componentDidMount() {
    this.tickTimer = window.setInterval(() => this.tick(), 1000)
    this.pollTimer = window.setInterval(() => {
      this.fetchStatus()
      this.fetchFlows()
    }, 3000)
    this.fetchStatus()
    this.fetchFlows()
  }

  componentWillUnmount() {
    if (this.tickTimer) window.clearInterval(this.tickTimer)
    if (this.pollTimer) window.clearInterval(this.pollTimer)
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.capture.id !== this.props.capture.id) {
      this.setState({ now: Date.now(), error: '', flows: [], expandedFlowKey: '', showAllTopFlows: false })
      this.fetchStatus()
      this.fetchFlows()
    }
  }

  private normalizeCapture(raw: any): SimpleCaptureSession {
    return {
      id: raw.id || this.props.capture.id,
      captureID: raw.captureID || this.props.capture.captureID,
      status: raw.status || this.props.capture.status,
      startedAt: raw.startedAt || this.props.capture.startedAt,
      expiresAt: raw.expiresAt || this.props.capture.expiresAt,
      targetName: raw.target?.name || this.props.capture.targetName,
      targetType: raw.target?.type || this.props.capture.targetType,
      scope: raw.request?.scope || this.props.capture.scope,
      filterPreset: raw.request?.filterPreset || this.props.capture.filterPreset,
      bpf: raw.request?.bpf || this.props.capture.bpf,
      durationSeconds: raw.request?.durationSeconds || this.props.capture.durationSeconds,
    }
  }

  private async fetchStatus() {
    if (this.props.capture.id.startsWith('legacy-')) {
      return
    }

    if (terminalStatuses.has(this.props.capture.status)) {
      return
    }

    try {
      const response = await fetch(`${this.props.session.endpoint}/api/simple-capture/${this.props.capture.id}`, {
        headers: { 'X-Auth-Token': this.props.session.token }
      })
      if (!response.ok) {
        return
      }
      const raw = await response.json()
      this.props.onUpdate(this.normalizeCapture(raw))
    } catch (err) {
      // Status polling is best-effort. Keep the local timer visible if polling fails briefly.
    }
  }

  private async fetchFlows() {
    if (!this.props.el?.id) {
      return
    }
    if (terminalStatuses.has(this.props.capture.status) && this.state.flows.length > 0) {
      return
    }

    try {
      const conf = new Configuration({ basePath: this.props.session.endpoint + "/api", accessToken: this.props.session.token })
      const api = new TopologyApi(conf)
      const flows = await api.searchTopology({ GremlinQuery: `G.V('${this.props.el.id}').Flows()` })
      this.setState({ flows: this.normalizeFlows(Array.isArray(flows) ? flows : []) })
    } catch (err) {
      // Flow polling is best-effort. The capture status card remains useful without summary data.
    }
  }

  private normalizeFlows(flows: Array<any>): CaptureFlowSummary[] {
    return flows.map((flow, index) => {
      const metric = flow.Metric || {}
      const network = flow.Network || {}
      const transport = flow.Transport || {}
      const protocol = transport.Protocol || network.Protocol || flow.Application || '기타'
      const normalizedProtocol = String(protocol).toUpperCase()
      const sourcePort = transport.A !== undefined && transport.A !== null ? String(transport.A) : ''
      const destinationPort = transport.B !== undefined && transport.B !== null ? String(transport.B) : ''
      const application = flow.Application || this.portApplication(destinationPort)
      const normalizedApplication = String(application || '').toUpperCase()
      const source = network.A || flow.Link?.A || '-'
      const destination = network.B || flow.Link?.B || this.props.capture.targetName || '-'
      const abBytes = Number(metric.ABBytes || 0)
      const baBytes = Number(metric.BABytes || 0)
      const abPackets = Number(metric.ABPAckets || metric.ABPackets || 0)
      const baPackets = Number(metric.BAPAckets || metric.BAPackets || 0)

      return {
        key: flow.UUID || flow.ID || `${source}-${destination}-${sourcePort}-${destinationPort}-${index}`,
        protocol: normalizedProtocol,
        application: normalizedApplication && normalizedApplication !== normalizedProtocol ? application : '',
        source: `${source}${sourcePort ? `:${sourcePort}` : ''}`,
        destination: `${destination}${destinationPort ? `:${destinationPort}` : ''}`,
        sourcePort,
        destinationPort,
        bytes: abBytes + baBytes,
        packets: abPackets + baPackets,
      }
    }).sort((a, b) => b.bytes - a.bytes || b.packets - a.packets)
  }

  private portApplication(port: string): string {
    switch (port) {
      case '22': return 'SSH'
      case '53': return 'DNS'
      case '80': return 'HTTP'
      case '123': return 'NTP'
      case '443': return 'HTTPS'
      default: return ''
    }
  }

  private formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let unit = 0
    while (value >= 1024 && unit < units.length - 1) {
      value = value / 1024
      unit += 1
    }
    return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
  }

  private topProtocol(flows: CaptureFlowSummary[]): { label: string, percent: number } {
    if (flows.length === 0) return { label: '-', percent: 0 }
    const totals = flows.reduce((acc, flow) => {
      acc[flow.protocol] = (acc[flow.protocol] || 0) + Math.max(flow.bytes, 1)
      return acc
    }, {} as Record<string, number>)
    const totalBytes = Object.keys(totals).reduce((sum, key) => sum + totals[key], 0)
    const top = Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0]
    return { label: top || '-', percent: totalBytes > 0 ? Math.round((totals[top] / totalBytes) * 100) : 0 }
  }

  private topPeer(flows: CaptureFlowSummary[]): string {
    return this.topPeerSummary(flows).label
  }

  private topPeerSummary(flows: CaptureFlowSummary[]): { label: string, percent: number } {
    if (flows.length === 0) return { label: '-', percent: 0 }
    const totals = flows.reduce((acc, flow) => {
      const peer = flow.source.split(':')[0] || flow.destination.split(':')[0] || '-'
      acc[peer] = (acc[peer] || 0) + Math.max(flow.bytes, 1)
      return acc
    }, {} as Record<string, number>)
    const totalBytes = Object.keys(totals).reduce((sum, key) => sum + totals[key], 0)
    const top = Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0]
    return { label: top || '-', percent: totalBytes > 0 ? Math.round((totals[top] / totalBytes) * 100) : 0 }
  }

  private distributionByProtocol(flows: CaptureFlowSummary[]): Array<{ label: string, bytes: number, percent: number }> {
    const totalBytes = flows.reduce((sum, flow) => sum + flow.bytes, 0)
    const totals = flows.reduce((acc, flow) => {
      acc[flow.protocol] = (acc[flow.protocol] || 0) + flow.bytes
      return acc
    }, {} as Record<string, number>)
    return Object.keys(totals)
      .sort((a, b) => totals[b] - totals[a])
      .slice(0, 4)
      .map(label => ({ label, bytes: totals[label], percent: totalBytes > 0 ? Math.round((totals[label] / totalBytes) * 100) : 0 }))
  }

  private distributionByPort(flows: CaptureFlowSummary[]): Array<{ port: string, bytes: number, percent: number }> {
    const totalBytes = flows.reduce((sum, flow) => sum + flow.bytes, 0)
    const totals = flows.reduce((acc, flow) => {
      const port = flow.destinationPort || flow.sourcePort
      if (port) acc[port] = (acc[port] || 0) + flow.bytes
      return acc
    }, {} as Record<string, number>)
    return Object.keys(totals)
      .sort((a, b) => totals[b] - totals[a])
      .slice(0, 5)
      .map(port => ({ port, bytes: totals[port], percent: totalBytes > 0 ? Math.round((totals[port] / totalBytes) * 100) : 0 }))
  }

  private tick() {
    this.setState({ now: Date.now() }, () => {
      if (
        this.props.capture.id.startsWith('legacy-') &&
        this.props.capture.status === 'running' &&
        this.remainingSeconds() <= 0
      ) {
        this.props.onUpdate({ ...this.props.capture, status: 'completed' })
      }
    })
  }

  private async stopCapture() {
    this.setState({ loading: true, error: '' })
    try {
      const response = await fetch(`${this.props.session.endpoint}/api/simple-capture/${this.props.capture.id}`, {
        method: 'DELETE',
        headers: { 'X-Auth-Token': this.props.session.token }
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const raw = await response.json()
      this.props.onUpdate(this.normalizeCapture(raw))
    } catch (err) {
      this.setState({ error: '캡처 중지에 실패했습니다.' })
    } finally {
      this.setState({ loading: false })
    }
  }

  private remainingSeconds(): number {
    const expiresAt = new Date(this.props.capture.expiresAt).getTime()
    if (!Number.isFinite(expiresAt)) return 0
    return Math.max(0, Math.ceil((expiresAt - this.state.now) / 1000))
  }

  private progressValue(): number {
    const startedAt = new Date(this.props.capture.startedAt).getTime()
    const expiresAt = new Date(this.props.capture.expiresAt).getTime()
    if (!Number.isFinite(startedAt) || !Number.isFinite(expiresAt) || expiresAt <= startedAt) {
      return terminalStatuses.has(this.props.capture.status) ? 100 : 0
    }
    const elapsed = Math.max(0, Math.min(this.state.now - startedAt, expiresAt - startedAt))
    return Math.round((elapsed / (expiresAt - startedAt)) * 100)
  }

  private formatRemaining(): string {
    const remaining = this.remainingSeconds()
    const minutes = Math.floor(remaining / 60).toString().padStart(2, '0')
    const seconds = (remaining % 60).toString().padStart(2, '0')
    return `${minutes}:${seconds}`
  }

  private formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
    const rest = Math.max(0, seconds % 60).toString().padStart(2, '0')
    return `${minutes}:${rest}`
  }

  private elapsedSeconds(): number {
    const startedAt = new Date(this.props.capture.startedAt).getTime()
    if (!Number.isFinite(startedAt)) return 0
    const elapsed = Math.floor((this.state.now - startedAt) / 1000)
    return Math.max(0, Math.min(elapsed, this.props.capture.durationSeconds || elapsed))
  }

  private endpointAddress(endpoint: string): string {
    if (!endpoint) return '-'
    const lastColon = endpoint.lastIndexOf(':')
    if (lastColon > -1 && /^\d+$/.test(endpoint.slice(lastColon + 1))) {
      return endpoint.slice(0, lastColon)
    }
    return endpoint
  }

  private scopeLabel() {
    return this.props.capture.scope === 'all' ? '전체 트래픽' : '선택 노드 관련 트래픽'
  }

  private filterLabel() {
    if (this.props.capture.filterPreset === 'ssh') return 'SSH'
    if (this.props.capture.filterPreset === 'web') return 'HTTP/HTTPS'
    if (this.props.capture.filterPreset === 'custom') return this.props.capture.bpf || '직접 입력'
    return '전체'
  }

  private statusTitle() {
    switch (this.props.capture.status) {
      case 'completed': return '패킷 캡처 완료'
      case 'expired': return '패킷 캡처 완료'
      case 'stopped': return '패킷 캡처 중지됨'
      case 'delete_failed': return '패킷 캡처 중지 실패'
      case 'failed': return '패킷 캡처 실패'
      default: return '패킷 캡처 진행 중'
    }
  }

  private statusLabel(isRunning: boolean, isDone: boolean) {
    if (isRunning) return '실행 중'
    if (isDone) return '완료'
    if (this.props.capture.status === 'stopped') return '중지됨'
    if (this.props.capture.status === 'failed') return '실패'
    return '확인 필요'
  }

  private targetTypeLabel(): string {
    const rawType = this.props.capture.targetType || this.props.el?.data?.Type || 'Node'
    const type = String(rawType).toLowerCase()
    switch (type) {
      case 'bridge': return 'Bridge'
      case 'host': return 'Host'
      case 'device': return 'Interface'
      case 'bond': return 'Bond'
      case 'ovsport': return 'OVS Port'
      case 'dpdkport': return 'DPDK Port'
      case 'node': return 'Kubernetes Node'
      default: return rawType ? String(rawType) : 'Node'
    }
  }

  render() {
    const { classes, capture } = this.props
    const isRunning = capture.status === 'running'
    const isDone = terminalStatuses.has(capture.status) && capture.status !== 'delete_failed' && capture.status !== 'failed' && capture.status !== 'stopped'
    const isLegacy = capture.id.startsWith('legacy-')
    const isFailed = capture.status === 'failed' || capture.status === 'delete_failed'
    const statusBadgeClass = isRunning ? classes.captureStatusRunning : isDone ? classes.captureStatusDone : isFailed ? classes.captureStatusFailed : classes.captureStatusWarning
    const flows = this.state.flows
    const visibleTopFlows = this.state.showAllTopFlows ? flows : flows.slice(0, 5)
    const totalBytes = flows.reduce((sum, flow) => sum + flow.bytes, 0)
    const totalPackets = flows.reduce((sum, flow) => sum + flow.packets, 0)
    const protocol = this.topProtocol(flows)
    const peer = this.topPeerSummary(flows)
    const protocolDistribution = this.distributionByProtocol(flows)
    const portDistribution = this.distributionByPort(flows)
    const progress = isRunning ? this.progressValue() : 100
    const durationLabel = this.formatDuration(capture.durationSeconds || 0)

    return (
      <div className={classes.captureResultPanel}>
        <div className={classes.captureResultShell}>
          <section className={classes.captureStatusCard}>
            <div className={classes.captureStatusHeader}>
              <div>
                <Typography component="strong"><VideocamIcon /> {this.statusTitle()}</Typography>
                <span className={classes.captureMetaLine}>
                  <em>대상</em><b>{capture.targetName || '-'}</b>
                  <em>유형</em><b>{this.targetTypeLabel()}</b>
                  <em>범위</em><b>{this.scopeLabel()}</b>
                  <em>필터</em><b>{this.filterLabel()}</b>
                </span>
              </div>
              <div className={classes.captureHeroControls}>
                <em className={statusBadgeClass}>
                  {this.statusLabel(isRunning, isDone)}
                </em>
                <button type="button" onClick={this.props.onClear}>접기</button>
              </div>
            </div>

            <div className={classes.captureProgressPanel}>
              <div className={classes.captureCountdown}>
                <span>{isRunning ? `남은 시간 (${durationLabel})` : isDone ? '캡처 완료' : '소요 시간'}</span>
                <strong>{isRunning ? this.formatRemaining() : this.formatDuration(this.elapsedSeconds())}</strong>
              </div>
              <div className={classes.captureProgressRow}>
                <LinearProgress variant="determinate" value={progress} className={classes.captureProgress} />
                <span>{progress}%</span>
              </div>
            </div>

            {this.state.error && <p className={classes.captureStatusError}>{this.state.error}</p>}

            <div className={classes.captureStatusActions}>
              {isRunning &&
                <Button size="small" variant="outlined" startIcon={<StopIcon />} disabled={this.state.loading || isLegacy} onClick={() => this.stopCapture()}>
                  중지
                </Button>
              }
              {isFailed &&
                <Button size="small" variant="outlined" startIcon={<ReplayIcon />} onClick={this.props.onRetry}>
                  다시 시도
                </Button>
              }
              {isDone &&
                <span className={classes.downloadPending}><GetAppIcon /> 캡처 파일을 준비 중입니다.</span>
              }
              {!isRunning && !isFailed &&
                <Button size="small" variant="outlined" startIcon={<ReplayIcon />} onClick={this.props.onRetry}>
                  다시 캡처
                </Button>
              }
            </div>
          </section>

          <section className={classes.captureSummaryCard}>
            <div className={classes.captureSectionHeader}>
              <strong>캡처 요약</strong>
              <span>마지막 업데이트: {new Date(this.state.now).toLocaleTimeString()}</span>
            </div>
            <div className={classes.captureMetricGrid}>
              <div className={classes.captureMetricItem}>
                <i className={`${classes.captureMetricIcon} ${classes.captureMetricTraffic}`}><SwapVertIcon /></i>
                <span className={classes.captureMetricBody}><em>총 트래픽</em><strong>{this.formatBytes(totalBytes)}</strong><small>bytes</small></span>
              </div>
              <div className={classes.captureMetricItem}>
                <i className={`${classes.captureMetricIcon} ${classes.captureMetricFlow}`}><AccountTreeIcon /></i>
                <span className={classes.captureMetricBody}><em>총 플로우</em><strong>{flows.length.toLocaleString()}</strong><small>flows</small></span>
              </div>
              <div className={classes.captureMetricItem}>
                <i className={`${classes.captureMetricIcon} ${classes.captureMetricPeer}`}><TrackChangesIcon /></i>
                <span className={classes.captureMetricBody}><em>주요 통신 대상</em><strong title={peer.label}>{peer.label}</strong><small>{peer.percent}%</small></span>
              </div>
              <div className={classes.captureMetricItem}>
                <i className={`${classes.captureMetricIcon} ${classes.captureMetricProtocol}`}><SecurityIcon /></i>
                <span className={classes.captureMetricBody}><em>주요 프로토콜</em><strong>{protocol.label}</strong><small>{protocol.percent}%</small></span>
              </div>
            </div>
          </section>

          <section className={classes.captureSummaryCard}>
            <div className={classes.captureSectionHeader}>
              <strong>상위 통신</strong>
              {flows.length > 5 &&
                <button type="button" className={classes.moreButton} onClick={() => this.setState({ showAllTopFlows: !this.state.showAllTopFlows })}>
                  {this.state.showAllTopFlows ? '접기' : `더보기 (${flows.length - 5})`}
                </button>
              }
            </div>
            {visibleTopFlows.length === 0 &&
              <p className={classes.captureEmptyState}>아직 표시할 플로우가 없습니다. 캡처가 진행되면 요약이 갱신됩니다.</p>
            }
            <div className={`${classes.topFlowList} ${this.state.showAllTopFlows ? classes.topFlowListScrollable : ''}`}>
              {visibleTopFlows.map((flow, index) => {
                const percent = totalBytes > 0 ? Math.max(4, Math.round((flow.bytes / totalBytes) * 100)) : 0
                const packetPercent = totalPackets > 0 ? Math.round((flow.packets / totalPackets) * 100) : 0
                const expanded = this.state.expandedFlowKey === flow.key
                const sourceAddress = this.endpointAddress(flow.source)
                const destinationAddress = this.endpointAddress(flow.destination)
                const displayPort = flow.destinationPort || flow.sourcePort || '-'
                return (
                  <button
                    type="button"
                    key={flow.key}
                    className={`${classes.topFlowItem} ${expanded ? classes.topFlowItemExpanded : ''}`}
                    onClick={() => this.setState({ expandedFlowKey: expanded ? '' : flow.key })}>
                    <span className={classes.topFlowRank}>{index + 1}</span>
                    <span className={classes.topFlowMain}>
                      <strong title={`${flow.source} → ${flow.destination}`}>{sourceAddress} → {destinationAddress}</strong>
                      <em>
                        <span className={classes.flowBadge}>{flow.protocol}</span>
                        {flow.application && <span className={classes.flowBadge}>{flow.application}</span>}
                        <span className={classes.flowPort}>포트 {displayPort}</span>
                        <span className={classes.flowPort}>{flow.packets.toLocaleString()} 패킷</span>
                      </em>
                      <i style={{ width: `${percent}%` }} />
                      {expanded &&
                        <small>
                          원시 포트 {flow.sourcePort || '-'} → {flow.destinationPort || '-'} · 트래픽 {this.formatBytes(flow.bytes)} · {flow.packets.toLocaleString()} 패킷
                        </small>
                      }
                    </span>
                    <span className={classes.topFlowBytes}>
                      <strong>{this.formatBytes(flow.bytes)}</strong>
                      <small>{packetPercent}%</small>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className={classes.captureDistributionGrid}>
            <div className={classes.captureSummaryCard}>
              <strong className={classes.miniSectionTitle}>프로토콜 분포</strong>
              {protocolDistribution.length === 0 &&
                <p className={classes.captureEmptyState}>아직 프로토콜 분포가 없습니다.</p>
              }
              {protocolDistribution.map((item) => (
                <div className={classes.progressListRow} key={item.label}>
                  <span>{item.label}</span>
                  <i><b style={{ width: `${item.percent}%` }} /></i>
                  <em>{item.percent}% · {this.formatBytes(item.bytes)}</em>
                </div>
              ))}
            </div>
            <div className={classes.captureSummaryCard}>
              <strong className={classes.miniSectionTitle}>상위 포트</strong>
              {portDistribution.length === 0 &&
                <p className={classes.captureEmptyState}>아직 포트 통계가 없습니다.</p>
              }
              {portDistribution.map(({ port, bytes, percent }) => (
                <div className={classes.progressListRow} key={port}>
                  <span>{port} {this.portApplication(port)}</span>
                  <i><b style={{ width: `${percent}%` }} /></i>
                  <em>{this.formatBytes(bytes)} · {percent}%</em>
                </div>
              ))}
            </div>
          </section>

          <Accordion className={classes.rawFlowAccordion}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography component="strong">원시 플로우 보기</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FlowPanel el={this.props.el} />
            </AccordionDetails>
          </Accordion>

          <p className={classes.captureSummaryHint}>요약 정보는 실시간으로 갱신되며, 캡처 완료 후 최종 값이 확정됩니다.</p>
        </div>
      </div>
    )
  }
}

const styles = (theme: Theme) => createStyles({
  captureResultPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(0.8),
    border: '1px solid rgba(219, 231, 245, 0.72)',
    borderRadius: 16,
    background: 'linear-gradient(180deg, rgba(248, 250, 252, 0.82), rgba(255, 255, 255, 0.98))',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.045)',
  },
  captureResultShell: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  captureStatusCard: {
    padding: theme.spacing(1.45),
    border: '1px solid rgba(219, 231, 245, 0.82)',
    borderRadius: 16,
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.78))',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)',
  },
  captureStatusHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    '& strong': {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      color: 'var(--netdive-detail-text, #0f172a)',
      fontSize: 15,
      fontWeight: 900,
      '& svg': {
        width: 17,
        height: 17,
        color: '#0f172a',
      }
    },
  },
  captureMetaLine: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '4px 8px',
    marginTop: 7,
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 11.5,
    lineHeight: 1.45,
    '& em': {
      fontStyle: 'normal',
      color: '#94a3b8',
      fontWeight: 800,
    },
    '& b': {
      color: 'var(--netdive-detail-text, #0f172a)',
      fontWeight: 800,
    },
  },
  captureHeroControls: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    flex: '0 0 auto',
    '& em': {
      borderRadius: 999,
      padding: '4px 8px',
      fontStyle: 'normal',
      fontSize: 11,
      fontWeight: 800,
      whiteSpace: 'nowrap',
    },
    '& button': {
      appearance: 'none',
      border: 0,
      background: 'transparent',
      color: 'var(--netdive-detail-muted, #64748b)',
      borderRadius: 7,
      padding: '4px 6px',
      fontSize: 11,
      fontWeight: 800,
      cursor: 'pointer',
      '&:hover': {
        color: '#1a73e8',
        background: '#f3f8ff',
      }
    },
  },
  captureProgressPanel: {
    marginTop: theme.spacing(1.05),
  },
  captureStatusRunning: {
    color: '#3156c9',
    background: '#eef4ff',
    border: '1px solid #c7d7fe',
  },
  captureStatusDone: {
    color: '#15803d',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
  },
  captureStatusFailed: {
    color: '#b91c1c',
    background: '#fef2f2',
    border: '1px solid #fecaca',
  },
  captureStatusWarning: {
    color: '#b45309',
    background: '#fffbeb',
    border: '1px solid #fed7aa',
  },
  captureCountdown: {
    '& span': {
      display: 'block',
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 11,
      fontWeight: 800,
    },
    '& strong': {
      display: 'block',
      color: '#3156c9',
      fontSize: 29,
      lineHeight: 1.2,
      fontWeight: 800,
      letterSpacing: '-0.03em',
      marginTop: 2,
    }
  },
  captureProgress: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    '& .MuiLinearProgress-barColorPrimary': {
      backgroundColor: '#4f67c8',
    }
  },
  captureProgressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.8),
    marginTop: theme.spacing(0.75),
    '& span': {
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 11,
      fontWeight: 800,
      minWidth: 34,
      textAlign: 'right',
    }
  },
  captureStatusError: {
    color: '#b91c1c',
    fontSize: 12,
    margin: theme.spacing(0.8, 0, 0),
  },
  captureStatusActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.8),
    justifyContent: 'flex-end',
    marginTop: theme.spacing(1),
    flexWrap: 'wrap',
    '& .MuiButton-root': {
      borderColor: 'rgba(203, 213, 225, 0.95)',
      color: 'var(--netdive-detail-text, #0f172a)',
      borderRadius: 10,
      textTransform: 'none',
      fontWeight: 800,
      '&:hover': {
        borderColor: '#93c5fd',
        background: '#f3f8ff',
      }
    }
  },
  downloadPending: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 11.5,
    fontWeight: 800,
    marginRight: 'auto',
    '& svg': {
      width: 15,
      height: 15,
      color: '#64748b',
    }
  },
  captureSummaryCard: {
    border: '1px solid rgba(219, 231, 245, 0.82)',
    borderRadius: 16,
    background: 'var(--netdive-detail-bg, #fff)',
    padding: theme.spacing(1.25),
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.035)',
    minWidth: 0,
  },
  captureSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    '& strong': {
      color: 'var(--netdive-detail-text, #0f172a)',
      fontSize: 14,
      fontWeight: 900,
    },
    '& span': {
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 11,
      whiteSpace: 'nowrap',
    }
  },
  moreButton: {
    appearance: 'none',
    border: 0,
    background: 'transparent',
    color: '#3156c9',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    padding: theme.spacing(0.3, 0.4),
    borderRadius: 6,
    '&:hover': {
      background: '#eff6ff',
    }
  },
  captureMetricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 0,
    borderRadius: 14,
    background: 'transparent',
    overflow: 'hidden',
    '& $captureMetricItem': {
      border: 0,
      borderLeft: '1px solid rgba(226, 232, 240, 0.92)',
      '&:first-child': {
        borderLeft: 0,
      },
      '&:nth-child(3)': {
        borderLeft: 0,
        borderTop: '1px solid rgba(226, 232, 240, 0.92)',
      },
      '&:nth-child(4)': {
        borderTop: '1px solid rgba(226, 232, 240, 0.92)',
      }
    },
  },
  captureMetricItem: {
    display: 'grid',
    gridTemplateColumns: '38px minmax(0, 1fr)',
    gap: theme.spacing(0.85),
    alignItems: 'center',
    minWidth: 0,
    minHeight: 76,
    padding: theme.spacing(1.05, 1),
    boxSizing: 'border-box',
  },
  captureMetricIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 999,
    '& svg': {
      width: 17,
      height: 17,
    }
  },
  captureMetricTraffic: {
    color: '#475569',
    background: '#eef4ff',
  },
  captureMetricFlow: {
    color: '#3f7f67',
    background: '#e9f7ef',
  },
  captureMetricPeer: {
    color: '#6750a4',
    background: '#f1edff',
  },
  captureMetricProtocol: {
    color: '#8a5a2b',
    background: '#f7efe5',
  },
  captureMetricBody: {
    minWidth: 0,
    '& em': {
      display: 'block',
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 10.5,
      fontStyle: 'normal',
      fontWeight: 800,
      marginBottom: 3,
    },
    '& strong': {
      display: 'block',
      color: 'var(--netdive-detail-text, #0f172a)',
      fontSize: 18,
      fontWeight: 900,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      lineHeight: 1.18,
    },
    '& small': {
      display: 'block',
      marginTop: 3,
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 10.5,
      fontWeight: 700,
    }
  },
  captureEmptyState: {
    margin: 0,
    padding: theme.spacing(1),
    borderRadius: 10,
    background: '#f8fafc',
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 12,
    lineHeight: 1.5,
  },
  topFlowList: {
    display: 'grid',
    gap: 0,
  },
  topFlowListScrollable: {
    maxHeight: 360,
    overflowY: 'auto',
    paddingRight: 3,
    scrollbarGutter: 'stable',
  },
  topFlowItem: {
    appearance: 'none',
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '30px minmax(0, 1fr) 74px',
    gap: theme.spacing(1),
    alignItems: 'center',
    border: 0,
    borderBottom: '1px solid rgba(226, 232, 240, 0.78)',
    borderRadius: 0,
    background: 'transparent',
    padding: theme.spacing(1, 0.25),
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 160ms ease',
    '&:last-child': {
      borderBottom: 0,
    },
    '&:hover': {
      background: 'rgba(243, 248, 255, 0.72)',
    }
  },
  topFlowItemExpanded: {
    background: 'rgba(239, 246, 255, 0.72)',
  },
  topFlowRank: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 999,
    background: '#eef4ff',
    color: '#3156c9',
    fontSize: 11,
    fontWeight: 900,
  },
  topFlowMain: {
    minWidth: 0,
    '& strong': {
      display: 'block',
      color: 'var(--netdive-detail-text, #0f172a)',
      fontSize: 13.5,
      fontWeight: 900,
      lineHeight: 1.35,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '& em': {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 5,
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 11,
      fontStyle: 'normal',
      marginTop: 2,
    },
    '& i': {
      display: 'block',
      height: 3,
      borderRadius: 999,
      background: '#4f67c8',
      marginTop: 8,
      maxWidth: '100%',
    },
    '& small': {
      display: 'block',
      color: '#1e3a8a',
      fontSize: 11,
      marginTop: 5,
    }
  },
  topFlowBytes: {
    display: 'grid',
    justifyItems: 'end',
    gap: 2,
    minWidth: 0,
    color: 'var(--netdive-detail-text, #0f172a)',
    whiteSpace: 'nowrap',
    '& strong': {
      display: 'block',
      fontSize: 13,
      fontWeight: 900,
    },
    '& small': {
      display: 'block',
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 11,
      fontWeight: 700,
      lineHeight: 1.25,
      textAlign: 'right',
    }
  },
  flowBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    border: 0,
    borderRadius: 5,
    background: '#eef2f7',
    color: '#475569',
    padding: '1px 5px',
    fontSize: 10.5,
    fontWeight: 800,
    lineHeight: 1.35,
  },
  flowPort: {
    display: 'inline-flex',
    alignItems: 'center',
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 10.5,
    fontWeight: 800,
    lineHeight: 1.35,
  },
  captureDistributionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1),
    '@media (max-width: 560px)': {
      gridTemplateColumns: '1fr',
    },
  },
  miniSectionTitle: {
    display: 'block',
    marginBottom: theme.spacing(0.8),
    color: 'var(--netdive-detail-text, #0f172a)',
    fontSize: 13,
    fontWeight: 900,
  },
  progressListRow: {
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr) 82px',
    gap: theme.spacing(0.7),
    alignItems: 'center',
    marginBottom: theme.spacing(0.65),
    '& span': {
      color: 'var(--netdive-detail-text, #0f172a)',
      fontSize: 11.5,
      fontWeight: 800,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '& i': {
      display: 'block',
      height: 5,
      borderRadius: 999,
      background: '#e2e8f0',
      overflow: 'hidden',
    },
    '& b': {
      display: 'block',
      height: '100%',
      borderRadius: 999,
      background: '#2563eb',
    },
    '& em': {
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 11,
      fontStyle: 'normal',
      fontWeight: 700,
      textAlign: 'right',
    }
  },
  rawFlowAccordion: {
    boxShadow: 'none',
    border: '1px solid var(--netdive-detail-border, #dbe7f5)',
    borderRadius: '14px !important',
    background: 'var(--netdive-detail-bg, #fff)',
    overflow: 'hidden',
    '&::before': {
      display: 'none',
    },
    '& .MuiAccordionSummary-root': {
      minHeight: 46,
      padding: theme.spacing(0, 1.15),
    },
    '& .MuiAccordionSummary-content': {
      margin: theme.spacing(1, 0),
    },
    '& .MuiAccordionDetails-root': {
      display: 'block',
      padding: theme.spacing(0, 1, 1),
      overflowX: 'auto',
    },
    '& strong': {
      color: 'var(--netdive-detail-text, #0f172a)',
      fontSize: 14,
      fontWeight: 900,
    }
  },
  captureSummaryHint: {
    margin: 0,
    border: '1px solid #bfdbfe',
    borderRadius: 12,
    background: '#eff6ff',
    color: '#1e3a8a',
    padding: theme.spacing(0.9, 1),
    fontSize: 12,
    lineHeight: 1.45,
  }
})

export default withStyles(styles)(CaptureStatusPanel)
