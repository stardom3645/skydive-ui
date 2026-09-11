import * as React from 'react'
import { Alert, Button, Collapse, Progress, Tag } from 'antd'
import {
  ApartmentOutlined,
  AimOutlined,
  CodeOutlined,
  DownloadOutlined,
  NodeIndexOutlined,
  RedoOutlined,
  StopOutlined,
  SwapOutlined,
  VideoCameraOutlined
} from '@ant-design/icons'
import { createStyles, Theme, withStyles } from '@material-ui/core/styles'

import { session } from '../Store'
import { Configuration } from '../api/configuration'
import { TopologyApi } from '../api'
import { Node } from '../Topology'
import FlowPanel from './Flow'
import {
  CompactEmptyState,
  DetailBadge,
  DetailCardSubsectionHeader,
  DetailKeyValueList,
  DetailMetricRow,
  DetailSectionCard
} from './common/DetailComponents'

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
  downloading: boolean
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
    this.state = { now: Date.now(), loading: false, downloading: false, error: '', flows: [], expandedFlowKey: '', showAllTopFlows: false }
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
      this.setState({ now: Date.now(), error: '', flows: [], expandedFlowKey: '', showAllTopFlows: false, downloading: false })
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

  private downloadFilename(response: Response): string {
    const disposition = response.headers.get('content-disposition') || ''
    const match = disposition.match(/filename="?([^"]+)"?/i)
    if (match && match[1]) {
      return match[1]
    }
    const safeName = String(this.props.capture.targetName || 'capture').replace(/[^\w.-]+/g, '-')
    return `netdive-capture-${safeName}-${this.props.capture.id}.pcap`
  }

  private async downloadCapture() {
    if (this.props.capture.id.startsWith('legacy-')) {
      this.setState({ error: '기존 캡처는 다운로드를 지원하지 않습니다.' })
      return
    }

    this.setState({ downloading: true, error: '' })
    try {
      const response = await fetch(`${this.props.session.endpoint}/api/simple-capture/${this.props.capture.id}/download`, {
        headers: { 'X-Auth-Token': this.props.session.token }
      })
      if (!response.ok) {
        let message = `HTTP ${response.status}`
        try {
          const body = await response.json()
          if (body?.error) {
            message = body.error
          }
        } catch (err) {
          // Keep the HTTP status message if the server returned a non-JSON error.
        }
        if (message === 'downloadable packet data is not available' || message === 'raw packet capture was disabled') {
          message = '다운로드할 패킷 데이터가 없습니다.'
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      if (blob.size === 0) {
        throw new Error('다운로드할 패킷 데이터가 없습니다.')
      }
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = this.downloadFilename(response)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      this.setState({ error: err instanceof Error ? err.message : '캡처 파일 다운로드에 실패했습니다.' })
    } finally {
      this.setState({ downloading: false })
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
    const statusTone = isRunning ? 'info' : isDone ? 'success' : isFailed ? 'danger' : 'warning'
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
          <DetailSectionCard
            className={classes.captureStatusCard}
            icon={<VideoCameraOutlined />}
            title={this.statusTitle()}
            action={<span className={classes.captureHeroControls}>
              <DetailBadge tone={statusTone}>{this.statusLabel(isRunning, isDone)}</DetailBadge>
              <Button type="text" size="small" onClick={this.props.onClear}>접기</Button>
            </span>}>
            <div className={classes.captureProgressPanel}>
              <div className={classes.captureCountdown}>
                <span>{isRunning ? `남은 시간 · 총 ${durationLabel}` : '소요 시간'}</span>
                <strong>{isRunning ? this.formatRemaining() : this.formatDuration(this.elapsedSeconds())}</strong>
              </div>
              <div className={classes.captureProgressRow}>
                <Progress percent={progress} showInfo={false} strokeColor={isDone ? 'var(--netdive-detail-success)' : 'var(--netdive-ant-primary)'} />
                <strong>{progress}%</strong>
              </div>
            </div>

            <DetailKeyValueList
              className={classes.captureMetaGrid}
              density="compact"
              labelWidth={50}
              rows={[
                { key: 'target', label: '대상', value: capture.targetName || '-', textValue: capture.targetName || '-' },
                { key: 'type', label: '유형', value: this.targetTypeLabel() },
                { key: 'scope', label: '범위', value: this.scopeLabel() },
                { key: 'filter', label: '필터', value: this.filterLabel(), textValue: this.filterLabel() }
              ]} />

            {this.state.error && <Alert className={classes.captureStatusError} type="error" showIcon message={this.state.error} />}

            <div className={classes.captureStatusActions}>
              {isRunning &&
                <Button size="small" danger icon={<StopOutlined />} loading={this.state.loading} disabled={isLegacy} onClick={() => this.stopCapture()}>
                  중지
                </Button>
              }
              {isFailed &&
                <Button size="small" icon={<RedoOutlined />} onClick={this.props.onRetry}>
                  다시 시도
                </Button>
              }
              {!isRunning && !isFailed &&
                <>
                  {isDone &&
                    <Button size="small" icon={<DownloadOutlined />} loading={this.state.downloading} disabled={isLegacy} onClick={() => this.downloadCapture()}>
                      {this.state.downloading ? '다운로드 중' : '다운로드'}
                    </Button>
                  }
                  <Button size="small" icon={<RedoOutlined />} onClick={this.props.onRetry}>
                    다시 캡처
                  </Button>
                </>
              }
            </div>
          </DetailSectionCard>

          <section className={classes.captureSupportingSection}>
            <DetailCardSubsectionHeader
              first
              title="캡처 요약"
              action={<span className={classes.captureUpdatedAt}>마지막 업데이트: {new Date(this.state.now).toLocaleTimeString()}</span>} />
            <div className={classes.captureMetricGrid}>
              <div className={classes.captureMetricItem}>
                <i className={classes.captureMetricIcon}><SwapOutlined /></i>
                <span className={classes.captureMetricBody}><em>총 트래픽</em><strong>{this.formatBytes(totalBytes)}</strong><small>bytes</small></span>
              </div>
              <div className={classes.captureMetricItem}>
                <i className={classes.captureMetricIcon}><ApartmentOutlined /></i>
                <span className={classes.captureMetricBody}><em>총 플로우</em><strong>{flows.length.toLocaleString()}</strong><small>flows</small></span>
              </div>
              <div className={classes.captureMetricItem}>
                <i className={classes.captureMetricIcon}><AimOutlined /></i>
                <span className={classes.captureMetricBody}><em>주요 통신 대상</em><strong title={peer.label}>{peer.label}</strong><small>{peer.percent}%</small></span>
              </div>
              <div className={classes.captureMetricItem}>
                <i className={classes.captureMetricIcon}><CodeOutlined /></i>
                <span className={classes.captureMetricBody}><em>주요 프로토콜</em><strong>{protocol.label}</strong><small>{protocol.percent}%</small></span>
              </div>
            </div>
          </section>

          <section className={classes.captureSupportingSection}>
            <DetailCardSubsectionHeader
              first
              title="상위 통신"
              action={flows.length > 5 ?
                <Button type="link" size="small" className={classes.moreButton} onClick={() => this.setState({ showAllTopFlows: !this.state.showAllTopFlows })}>
                  {this.state.showAllTopFlows ? '접기' : `더보기 (${flows.length - 5})`}
                </Button> : undefined} />
            {visibleTopFlows.length === 0 &&
              <CompactEmptyState description="아직 표시할 플로우가 없습니다. 캡처가 진행되면 요약이 갱신됩니다." />
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
                        <Tag className={classes.flowBadge}>{flow.protocol}</Tag>
                        {flow.application && <Tag className={classes.flowBadge}>{flow.application}</Tag>}
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
            <DetailSectionCard className={classes.miniStatPanel} title="프로토콜 분포">
              {protocolDistribution.length === 0 &&
                <CompactEmptyState description="아직 프로토콜 분포가 없습니다." />
              }
              {protocolDistribution.map((item, index) => <DetailMetricRow
                key={item.label}
                label={item.label}
                value={this.formatBytes(item.bytes)}
                ratio={`${item.percent}%`}
                primary={index === 0}
                progressPercent={item.percent}
                progressColor={index === 0 ? 'var(--netdive-ant-primary)' : 'var(--netdive-ops-icon-color)'} />)}
            </DetailSectionCard>
            <DetailSectionCard className={classes.miniStatPanel} title="상위 포트">
              {portDistribution.length === 0 &&
                <CompactEmptyState description="아직 포트 통계가 없습니다." />
              }
              {portDistribution.map(({ port, bytes, percent }, index) => <DetailMetricRow
                key={port}
                label={`${port} ${this.portApplication(port)}`}
                value={this.formatBytes(bytes)}
                ratio={`${percent}%`}
                primary={index === 0}
                progressPercent={percent}
                progressColor={index === 0 ? 'var(--netdive-ant-primary)' : 'var(--netdive-ops-icon-color)'} />)}
            </DetailSectionCard>
          </section>

          <Collapse className={classes.rawFlowAccordion} expandIconPosition="right">
            <Collapse.Panel key="raw-flows" header={<span><NodeIndexOutlined /> 원시 플로우 보기</span>}>
              <FlowPanel el={this.props.el} />
            </Collapse.Panel>
          </Collapse>

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
    gap: 'var(--netdive-detail-panel-gap)',
    padding: '4px 0 var(--netdive-detail-panel-bottom-padding)',
    background: 'transparent',
  },
  captureResultShell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  captureStatusCard: {
    padding: 0,
    borderColor: 'var(--netdive-detail-card-border)',
    borderRadius: 'var(--netdive-detail-card-radius)',
    background: 'var(--netdive-detail-bg)',
    boxShadow: 'var(--netdive-detail-card-shadow)',
    '& .netdive-detail-section__body': { padding: '12px var(--netdive-detail-card-body-padding-x)' },
  },
  captureMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0 12px',
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1px solid var(--netdive-detail-section-divider)',
    '& > .netdive-detail-kv__row': { minWidth: 0 },
  },
  captureHeroControls: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    flex: '0 0 auto',
    '& .ant-tag': { marginRight: 0 },
    '& .ant-btn': { height: 24, padding: '0 4px', color: 'var(--netdive-detail-text-tertiary)', fontSize: 'var(--netdive-detail-font-supporting-text)' },
  },
  captureProgressPanel: {
    marginTop: theme.spacing(0.75),
  },
  captureCountdown: {
    '& span': {
      display: 'block',
      color: 'var(--netdive-detail-text-tertiary)',
      fontSize: 'var(--netdive-detail-font-supporting-text)',
      fontWeight: 'var(--netdive-detail-weight-body-label)',
    },
    '& strong': {
      display: 'block',
      color: 'var(--netdive-detail-text)',
      fontSize: 32,
      lineHeight: 1.2,
      fontWeight: 700,
      letterSpacing: '-0.03em',
      marginTop: 2,
    }
  },
  captureProgressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.8),
    marginTop: theme.spacing(0.55),
    '& .ant-progress': { flex: 1, margin: 0 },
    '& .ant-progress-inner': { borderRadius: 'var(--netdive-ant-radius)' },
    '& .ant-progress-bg': { height: '4px !important', borderRadius: 'var(--netdive-ant-radius)' },
    '& > strong': {
      color: 'var(--netdive-detail-text-secondary)',
      fontSize: 'var(--netdive-detail-font-supporting-text)',
      fontWeight: 'var(--netdive-detail-weight-body-label)',
      minWidth: 34,
      textAlign: 'right',
    }
  },
  captureStatusError: {
    margin: theme.spacing(0.8, 0, 0),
    borderRadius: 'var(--netdive-ant-radius)',
    '& .ant-alert-message': { fontSize: 'var(--netdive-detail-font-body-label)' },
  },
  captureStatusActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.8),
    justifyContent: 'flex-end',
    marginTop: theme.spacing(0.75),
    flexWrap: 'wrap',
    '& .ant-btn': { borderRadius: 'var(--netdive-ant-radius)', fontSize: 'var(--netdive-detail-font-body-label)' }
  },
  captureSupportingSection: {
    paddingBottom: 8,
    borderBottom: '1px solid var(--netdive-detail-section-divider)',
    background: 'var(--netdive-detail-bg)',
    '& $captureMetricGrid, & $topFlowList': { margin: '0 var(--netdive-detail-card-body-padding-x)' },
  },
  miniStatPanel: {
    height: '100%',
    borderColor: 'var(--netdive-detail-row-divider)',
    borderRadius: 'var(--netdive-detail-card-radius)',
    background: 'var(--netdive-ops-tint, #fafcff)',
    boxShadow: 'none',
    minWidth: 0,
    '& .ant-card-head': { minHeight: 36, background: 'transparent' },
    '& .netdive-detail-section__header': { minHeight: 36 },
    '& .netdive-detail-section__body': { padding: '6px var(--netdive-detail-card-body-padding-x) 10px' },
  },
  captureUpdatedAt: { color: 'var(--netdive-detail-text-tertiary)', fontSize: 'var(--netdive-detail-font-supporting-text)', whiteSpace: 'nowrap' },
  moreButton: {
    height: 24,
    padding: '0 2px',
    color: 'var(--netdive-ant-primary)',
    fontSize: 'var(--netdive-detail-font-body-label)',
    fontWeight: 600,
  },
  captureMetricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 6,
    borderRadius: 0,
    background: 'transparent',
  },
  captureMetricItem: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(0, 1fr)',
    gap: 10,
    alignItems: 'center',
    minWidth: 0,
    minHeight: 66,
    padding: 8,
    boxSizing: 'border-box',
    border: '1px solid var(--netdive-detail-row-divider)',
    borderRadius: 'var(--netdive-detail-card-radius)',
    background: 'var(--netdive-ops-tint, #fafcff)',
  },
  captureMetricIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    border: '1px solid var(--netdive-detail-connected-resource-icon-border)',
    borderRadius: 'var(--netdive-detail-card-radius)',
    background: 'var(--netdive-detail-connected-resource-icon-bg)',
    color: 'var(--netdive-detail-connected-resource-icon)',
    '& svg': {
      width: 17,
      height: 17,
    }
  },
  captureMetricBody: {
    minWidth: 0,
    '& em': {
      display: 'block',
      color: 'var(--netdive-detail-text-tertiary)',
      fontSize: 'var(--netdive-detail-font-supporting-text)',
      fontStyle: 'normal',
      fontWeight: 'var(--netdive-detail-weight-body-label)',
      marginBottom: 3,
    },
    '& strong': {
      display: 'block',
      color: 'var(--netdive-detail-text)',
      fontSize: 'var(--netdive-detail-font-primary-value)',
      fontWeight: 'var(--netdive-detail-weight-primary-value)',
      overflowWrap: 'anywhere',
      whiteSpace: 'normal',
      lineHeight: 1.18,
    },
    '& small': {
      display: 'block',
      marginTop: 3,
      color: 'var(--netdive-detail-text-tertiary)',
      fontSize: 'var(--netdive-detail-font-supporting-text)',
      fontWeight: 'var(--netdive-detail-weight-supporting-text)',
    }
  },
  topFlowList: {
    display: 'grid',
    gap: 0,
    '& $topFlowItem:nth-child(n+2) $topFlowMain i': {
      background: 'var(--netdive-ops-icon-color)',
      opacity: 0.4,
    }
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
    gridTemplateColumns: '26px minmax(0, 1fr) 68px',
    gap: 8,
    alignItems: 'center',
    border: 0,
    borderBottom: '1px solid var(--netdive-detail-row-divider)',
    borderRadius: 0,
    background: 'transparent',
    padding: '7px 2px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 160ms ease',
    '&:last-child': {
      borderBottom: 0,
    },
    '&:hover': {
      background: 'var(--netdive-detail-hover)',
    }
  },
  topFlowItemExpanded: {
    background: 'var(--netdive-detail-selected)',
  },
  topFlowRank: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 'var(--netdive-detail-card-radius)',
    background: 'var(--netdive-ant-table-header)',
    color: 'var(--netdive-detail-text-secondary)',
    fontSize: 'var(--netdive-detail-font-supporting-text)',
    fontWeight: 600,
  },
  topFlowMain: {
    minWidth: 0,
    '& strong': {
      display: 'block',
      color: 'var(--netdive-detail-text)',
      fontSize: 'var(--netdive-detail-font-body-label)',
      fontWeight: 'var(--netdive-detail-weight-section-title)',
      lineHeight: 'var(--netdive-detail-line-body-label)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '& em': {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      color: 'var(--netdive-detail-text-tertiary)',
      fontSize: 'var(--netdive-detail-font-supporting-text)',
      fontStyle: 'normal',
      marginTop: 2,
    },
    '& i': {
      display: 'block',
      height: 2,
      borderRadius: 999,
      background: 'var(--netdive-ant-primary)',
      opacity: 0.74,
      marginTop: 7,
      maxWidth: '100%',
    },
    '& small': {
      display: 'block',
      color: 'var(--netdive-detail-primary)',
      fontSize: 'var(--netdive-detail-font-supporting-text)',
      marginTop: 5,
    }
  },
  topFlowBytes: {
    display: 'grid',
    justifyItems: 'end',
    gap: 2,
    minWidth: 0,
    color: 'var(--netdive-detail-text)',
    whiteSpace: 'nowrap',
    '& strong': {
      display: 'block',
      fontSize: 'var(--netdive-detail-font-body-label)',
      fontWeight: 'var(--netdive-detail-weight-section-title)',
    },
    '& small': {
      display: 'block',
      color: 'var(--netdive-detail-text-tertiary)',
      fontSize: 'var(--netdive-detail-font-supporting-text)',
      fontWeight: 'var(--netdive-detail-weight-supporting-text)',
      lineHeight: 1.25,
      textAlign: 'right',
    }
  },
  flowBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    border: 0,
    margin: 0,
    borderRadius: 'var(--netdive-ant-radius)',
    background: 'var(--netdive-ant-table-header)',
    color: 'var(--netdive-detail-text-secondary)',
    padding: '1px 5px',
    fontSize: 'var(--netdive-detail-font-status-tag)',
    fontWeight: 600,
    lineHeight: 1.35,
  },
  flowPort: {
    display: 'inline-flex',
    alignItems: 'center',
    color: 'var(--netdive-detail-text-tertiary)',
    fontSize: 'var(--netdive-detail-font-supporting-text)',
    fontWeight: 500,
    lineHeight: 1.35,
  },
  captureDistributionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1),
    '@media (max-width: 720px)': {
      gridTemplateColumns: '1fr',
    },
  },
  rawFlowAccordion: {
    marginTop: 2,
    boxShadow: 'none',
    border: '1px solid var(--netdive-detail-card-border)',
    borderRadius: 'var(--netdive-detail-card-radius)',
    background: 'var(--netdive-detail-bg)',
    overflow: 'hidden',
    '& > .ant-collapse-item > .ant-collapse-header': {
      display: 'flex',
      minHeight: 'var(--netdive-detail-card-head-height)',
      alignItems: 'center',
      padding: '0 40px 0 var(--netdive-detail-card-padding-x)',
      color: 'var(--netdive-detail-text)',
      fontSize: 'var(--netdive-detail-font-section-title)',
      fontWeight: 'var(--netdive-detail-weight-section-title)',
      lineHeight: 'var(--netdive-detail-line-section-title)',
    },
    '& > .ant-collapse-item > .ant-collapse-header::before, & > .ant-collapse-item > .ant-collapse-header::after': { display: 'none' },
    '& > .ant-collapse-item > .ant-collapse-header > span:not(.ant-collapse-arrow)': {
      display: 'inline-flex', alignItems: 'center', minHeight: 20, gap: 6, lineHeight: '20px'
    },
    '& > .ant-collapse-item > .ant-collapse-header > span:not(.ant-collapse-arrow) svg': { display: 'block', fontSize: 14 },
    '& > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow': {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, lineHeight: 1
    },
    '& .ant-collapse-content-box': { padding: '0 var(--netdive-detail-card-body-padding-x) 12px', overflowX: 'auto' },
  },
  captureSummaryHint: {
    margin: '2px 0 8px',
    color: 'var(--netdive-detail-text-tertiary)',
    padding: '0 2px',
    fontSize: 'var(--netdive-detail-font-supporting-text)',
    lineHeight: 'var(--netdive-detail-line-supporting-text)',
  }
})

export default withStyles(styles)(CaptureStatusPanel)
