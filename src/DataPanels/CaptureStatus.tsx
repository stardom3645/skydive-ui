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
import { createStyles, Theme, withStyles } from '@material-ui/core/styles'

import Panel from './Panel'
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
    this.state = { now: Date.now(), loading: false, error: '', flows: [], expandedFlowKey: '' }
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
      this.setState({ now: Date.now(), error: '', flows: [], expandedFlowKey: '' })
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
      const sourcePort = transport.A !== undefined && transport.A !== null ? String(transport.A) : ''
      const destinationPort = transport.B !== undefined && transport.B !== null ? String(transport.B) : ''
      const source = network.A || flow.Link?.A || '-'
      const destination = network.B || flow.Link?.B || this.props.capture.targetName || '-'
      const abBytes = Number(metric.ABBytes || 0)
      const baBytes = Number(metric.BABytes || 0)
      const abPackets = Number(metric.ABPAckets || metric.ABPackets || 0)
      const baPackets = Number(metric.BAPAckets || metric.BAPackets || 0)

      return {
        key: flow.UUID || flow.ID || `${source}-${destination}-${sourcePort}-${destinationPort}-${index}`,
        protocol: String(protocol).toUpperCase(),
        application: flow.Application || this.portApplication(destinationPort),
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

  private topPort(flows: CaptureFlowSummary[]): string {
    const totals = flows.reduce((acc, flow) => {
      const port = flow.destinationPort || flow.sourcePort
      if (port) acc[port] = (acc[port] || 0) + Math.max(flow.bytes, 1)
      return acc
    }, {} as Record<string, number>)
    return Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0] || '-'
  }

  private topPeer(flows: CaptureFlowSummary[]): string {
    const topFlow = flows[0]
    if (!topFlow) return '-'
    return topFlow.source.split(':')[0] || topFlow.destination.split(':')[0] || '-'
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

  render() {
    const { classes, capture } = this.props
    const isRunning = capture.status === 'running'
    const isDone = terminalStatuses.has(capture.status) && capture.status !== 'delete_failed' && capture.status !== 'failed' && capture.status !== 'stopped'
    const isLegacy = capture.id.startsWith('legacy-')
    const flows = this.state.flows
    const topFlows = flows.slice(0, 5)
    const totalBytes = flows.reduce((sum, flow) => sum + flow.bytes, 0)
    const totalPackets = flows.reduce((sum, flow) => sum + flow.packets, 0)
    const protocol = this.topProtocol(flows)
    const topPort = this.topPort(flows)
    const progress = isRunning ? this.progressValue() : 100

    return (
      <Panel icon={<VideocamIcon />} title="패킷 캡처 상태" content={
        <div className={classes.captureResultShell}>
          <div className={classes.captureStatusCard}>
            <div className={classes.captureStatusHeader}>
              <div>
                <Typography component="strong">{this.statusTitle()}</Typography>
                <span>{capture.targetName || '-'} · {this.scopeLabel()} · 필터: {this.filterLabel()}</span>
              </div>
              <em className={isRunning ? classes.captureStatusRunning : isDone ? classes.captureStatusDone : classes.captureStatusWarning}>
                {this.statusLabel(isRunning, isDone)}
              </em>
            </div>
            <div className={classes.captureCountdown}>
              <span>{isRunning ? '남은 시간' : '소요 시간'}</span>
              <strong>{isRunning ? this.formatRemaining() : '00:00'}</strong>
            </div>
            <div className={classes.captureProgressRow}>
              <LinearProgress variant="determinate" value={progress} className={classes.captureProgress} />
              <span>{progress}%</span>
            </div>
            {capture.captureID &&
              <Accordion className={classes.captureDetailsAccordion}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="span">상세 정보</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <span>Capture ID: {capture.captureID}</span>
                </AccordionDetails>
              </Accordion>
            }
            {this.state.error && <p className={classes.captureStatusError}>{this.state.error}</p>}
            <div className={classes.captureStatusActions}>
              {isRunning &&
                <Button size="small" variant="outlined" startIcon={<StopIcon />} disabled={this.state.loading || isLegacy} onClick={() => this.stopCapture()}>
                  중지
                </Button>
              }
              {isDone &&
                <Button size="small" color="primary" variant="outlined" startIcon={<GetAppIcon />} disabled>
                  다운로드 준비 중
                </Button>
              }
              {!isRunning &&
                <Button size="small" variant="outlined" startIcon={<ReplayIcon />} onClick={this.props.onRetry}>
                  다시 캡처
                </Button>
              }
              {!isRunning &&
                <Button size="small" onClick={this.props.onClear}>
                  닫기
                </Button>
              }
            </div>
          </div>

          <section className={classes.captureSummaryCard}>
            <div className={classes.captureSectionHeader}>
              <strong>실시간 요약</strong>
              <span>마지막 업데이트: {new Date(this.state.now).toLocaleTimeString()}</span>
            </div>
            <div className={classes.captureMetricGrid}>
              <div><span>총 플로우</span><strong>{flows.length.toLocaleString()}</strong></div>
              <div><span>총 트래픽</span><strong>{this.formatBytes(totalBytes)}</strong></div>
              <div><span>주요 프로토콜</span><strong>{protocol.label}</strong><small>{protocol.percent}%</small></div>
              <div><span>주요 통신 대상</span><strong title={this.topPeer(flows)}>{this.topPeer(flows)}</strong></div>
              <div><span>상위 포트</span><strong>{topPort}</strong><small>{this.portApplication(topPort)}</small></div>
            </div>
          </section>

          <section className={classes.captureSummaryCard}>
            <div className={classes.captureSectionHeader}>
              <strong>상위 통신</strong>
              <span>{totalPackets.toLocaleString()} 패킷</span>
            </div>
            {topFlows.length === 0 &&
              <p className={classes.captureEmptyState}>아직 표시할 플로우가 없습니다. 캡처가 진행되면 요약이 갱신됩니다.</p>
            }
            <div className={classes.topFlowList}>
              {topFlows.map((flow, index) => {
                const percent = totalBytes > 0 ? Math.max(4, Math.round((flow.bytes / totalBytes) * 100)) : 0
                const expanded = this.state.expandedFlowKey === flow.key
                return (
                  <button
                    type="button"
                    key={flow.key}
                    className={`${classes.topFlowItem} ${expanded ? classes.topFlowItemExpanded : ''}`}
                    onClick={() => this.setState({ expandedFlowKey: expanded ? '' : flow.key })}>
                    <span className={classes.topFlowRank}>{index + 1}</span>
                    <span className={classes.topFlowMain}>
                      <strong title={`${flow.source} → ${flow.destination}`}>{flow.source} → {flow.destination}</strong>
                      <em>{flow.protocol}{flow.application ? ` · ${flow.application}` : ''} · {flow.packets.toLocaleString()} 패킷</em>
                      <i style={{ width: `${percent}%` }} />
                      {expanded &&
                        <small>
                          포트 {flow.sourcePort || '-'} → {flow.destinationPort || '-'} · 트래픽 {this.formatBytes(flow.bytes)}
                        </small>
                      }
                    </span>
                    <span className={classes.topFlowBytes}>{this.formatBytes(flow.bytes)}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className={classes.captureDistributionGrid}>
            <div className={classes.captureSummaryCard}>
              <strong className={classes.miniSectionTitle}>프로토콜 분포</strong>
              {Object.entries(flows.reduce((acc, flow) => {
                acc[flow.protocol] = (acc[flow.protocol] || 0) + flow.bytes
                return acc
              }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, bytes]) => (
                <div className={classes.progressListRow} key={name}>
                  <span>{name}</span>
                  <i><b style={{ width: `${totalBytes > 0 ? Math.round((bytes / totalBytes) * 100) : 0}%` }} /></i>
                  <em>{totalBytes > 0 ? Math.round((bytes / totalBytes) * 100) : 0}%</em>
                </div>
              ))}
            </div>
            <div className={classes.captureSummaryCard}>
              <strong className={classes.miniSectionTitle}>상위 포트</strong>
              {Object.entries(flows.reduce((acc, flow) => {
                const port = flow.destinationPort || flow.sourcePort
                if (port) acc[port] = (acc[port] || 0) + flow.bytes
                return acc
              }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([port, bytes]) => (
                <div className={classes.progressListRow} key={port}>
                  <span>{port} {this.portApplication(port)}</span>
                  <i><b style={{ width: `${totalBytes > 0 ? Math.round((bytes / totalBytes) * 100) : 0}%` }} /></i>
                  <em>{this.formatBytes(bytes)}</em>
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
      } />
    )
  }
}

const styles = (theme: Theme) => createStyles({
  captureResultShell: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  captureStatusCard: {
    padding: theme.spacing(1.2),
    border: '1px solid var(--netdive-detail-border, #dbe7f5)',
    borderRadius: 14,
    background: 'var(--netdive-detail-bg, #fff)',
  },
  captureStatusHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    '& strong': {
      display: 'block',
      color: 'var(--netdive-detail-text, #0f172a)',
      fontSize: 14,
      fontWeight: 800,
    },
    '& span': {
      display: 'block',
      marginTop: 3,
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 12,
    },
    '& em': {
      alignSelf: 'flex-start',
      borderRadius: 999,
      padding: '4px 8px',
      fontStyle: 'normal',
      fontSize: 11,
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }
  },
  captureStatusRunning: {
    color: '#1d4ed8',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
  },
  captureStatusDone: {
    color: '#15803d',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
  },
  captureStatusWarning: {
    color: '#b45309',
    background: '#fffbeb',
    border: '1px solid #fed7aa',
  },
  captureCountdown: {
    marginTop: theme.spacing(1),
    '& span': {
      display: 'block',
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 12,
      fontWeight: 700,
    },
    '& strong': {
      display: 'block',
      color: '#1d4ed8',
      fontSize: 23,
      lineHeight: 1.2,
      fontWeight: 900,
      letterSpacing: '-0.03em',
      marginTop: 2,
    }
  },
  captureStatusMeta: {
    display: 'grid',
    gap: 4,
    marginTop: theme.spacing(1),
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 12,
  },
  captureProgress: {
    flex: 1,
    height: 8,
    borderRadius: 999,
  },
  captureProgressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.8),
    marginTop: theme.spacing(1),
    '& span': {
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 11,
      fontWeight: 800,
      minWidth: 34,
      textAlign: 'right',
    }
  },
  captureDetailsAccordion: {
    marginTop: theme.spacing(0.8),
    boxShadow: 'none',
    border: '1px solid var(--netdive-detail-border, #dbe7f5)',
    borderRadius: '10px !important',
    overflow: 'hidden',
    '&::before': {
      display: 'none',
    },
    '& .MuiAccordionSummary-root': {
      minHeight: 34,
      padding: theme.spacing(0, 1),
    },
    '& .MuiAccordionSummary-content': {
      margin: theme.spacing(0.7, 0),
    },
    '& .MuiAccordionDetails-root': {
      padding: theme.spacing(0, 1, 0.9),
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 11.5,
      wordBreak: 'break-all',
    }
  },
  captureStatusError: {
    color: '#b91c1c',
    fontSize: 12,
    margin: theme.spacing(0.8, 0, 0),
  },
  captureStatusActions: {
    display: 'flex',
    gap: theme.spacing(0.8),
    justifyContent: 'flex-end',
    marginTop: theme.spacing(1.1),
    flexWrap: 'wrap',
  },
  captureSummaryCard: {
    border: '1px solid var(--netdive-detail-border, #dbe7f5)',
    borderRadius: 14,
    background: 'var(--netdive-detail-bg, #fff)',
    padding: theme.spacing(1.15),
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.04)',
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
  captureMetricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(0.8),
    '& div': {
      border: '1px solid rgba(219, 231, 245, 0.9)',
      borderRadius: 12,
      padding: theme.spacing(0.9),
      minWidth: 0,
      background: '#fff',
    },
    '& span': {
      display: 'block',
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 11,
      fontWeight: 800,
      marginBottom: 4,
    },
    '& strong': {
      display: 'block',
      color: 'var(--netdive-detail-text, #0f172a)',
      fontSize: 17,
      fontWeight: 900,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '& small': {
      display: 'block',
      marginTop: 2,
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 11,
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
    gap: theme.spacing(0.55),
  },
  topFlowItem: {
    appearance: 'none',
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '24px minmax(0, 1fr) auto',
    gap: theme.spacing(0.8),
    alignItems: 'center',
    border: '1px solid transparent',
    borderRadius: 12,
    background: '#fff',
    padding: theme.spacing(0.7),
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 160ms ease, background-color 160ms ease',
    '&:hover': {
      borderColor: '#bfdbfe',
      background: '#f3f8ff',
    }
  },
  topFlowItemExpanded: {
    borderColor: '#93c5fd',
    background: '#eff6ff',
  },
  topFlowRank: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 999,
    background: '#e8f2ff',
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: 900,
  },
  topFlowMain: {
    minWidth: 0,
    '& strong': {
      display: 'block',
      color: 'var(--netdive-detail-text, #0f172a)',
      fontSize: 12.5,
      fontWeight: 800,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '& em': {
      display: 'block',
      color: 'var(--netdive-detail-muted, #64748b)',
      fontSize: 11,
      fontStyle: 'normal',
      marginTop: 2,
    },
    '& i': {
      display: 'block',
      height: 4,
      borderRadius: 999,
      background: '#2563eb',
      marginTop: 6,
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
    color: 'var(--netdive-detail-text, #0f172a)',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  captureDistributionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: theme.spacing(1),
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
    gridTemplateColumns: '64px minmax(0, 1fr) 54px',
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
