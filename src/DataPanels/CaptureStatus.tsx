import * as React from 'react'
import { Alert, Button, Card, Collapse, ConfigProvider, Descriptions, Empty, Progress, Space, Statistic, Table, Tag, Typography } from 'antd'
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
import './CaptureStatus.css'

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

export class CaptureStatusPanel extends React.Component<Props, State> {
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
    const { capture } = this.props
    const isRunning = capture.status === 'running'
    const isDone = terminalStatuses.has(capture.status) && capture.status !== 'delete_failed' && capture.status !== 'failed' && capture.status !== 'stopped'
    const isLegacy = capture.id.startsWith('legacy-')
    const isFailed = capture.status === 'failed' || capture.status === 'delete_failed'
    const statusTone = isRunning ? 'processing' : isDone ? 'success' : isFailed ? 'error' : 'warning'
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

    const empty = (description: string) => <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
    const distribution = (items: Array<{ label: string, bytes: number, percent: number }>, description: string) =>
      items.length === 0 ? empty(description) : items.map(item =>
        <div className="netdive-capture-distribution-row" key={item.label}>
          <div className="netdive-capture-section-heading">
            <Typography.Text>{item.label}</Typography.Text>
            <Typography.Text type="secondary">{this.formatBytes(item.bytes)}</Typography.Text>
          </div>
          <Progress percent={item.percent} size="small" />
        </div>)

    return (
      <ConfigProvider theme={{
        // Match the surrounding detail panel: section 14, body 12, supporting 11.
        token: { fontSize: 12, fontSizeSM: 11 },
        components: {
          Card: { headerFontSize: 14, headerFontSizeSM: 14 },
          Statistic: { titleFontSize: 12, contentFontSize: 16 },
          Table: { cellFontSize: 12, cellFontSizeSM: 12 }
        }
      }}>
      <div className="netdive-capture-result">
        <Card size="small" title={<Space><VideoCameraOutlined />{this.statusTitle()}</Space>}
          extra={<Space size={4}><Tag color={statusTone}>{this.statusLabel(isRunning, isDone)}</Tag>
            <Button type="text" size="small" onClick={this.props.onClear}>접기</Button></Space>}>
          <Statistic title={isRunning ? `남은 시간 · 총 ${durationLabel}` : '소요 시간'}
            value={isRunning ? this.formatRemaining() : this.formatDuration(this.elapsedSeconds())}
            styles={{ content: { fontSize: 28, fontWeight: 600, lineHeight: 1.3 } }} />
          <Progress percent={progress} status={isFailed ? 'exception' : isDone ? 'success' : 'normal'} />
          <Descriptions className="netdive-capture-status-meta" size="small" column={2} colon={false} items={[
            { key: 'target', label: '대상', children: capture.targetName || '-' },
            { key: 'type', label: '유형', children: this.targetTypeLabel() },
            { key: 'scope', label: '범위', children: this.scopeLabel() },
            { key: 'filter', label: '필터', children: this.filterLabel() }
          ]} />
          {this.state.error && <Alert type="error" showIcon title={this.state.error} />}
          <div className="netdive-capture-status-actions">
            <Space wrap>
              {isRunning && <Button size="small" danger icon={<StopOutlined />} loading={this.state.loading}
                disabled={isLegacy} onClick={() => this.stopCapture()}>중지</Button>}
              {isFailed && <Button size="small" icon={<RedoOutlined />} onClick={this.props.onRetry}>다시 시도</Button>}
              {!isRunning && !isFailed && <>
                {isDone && <Button size="small" type="primary" icon={<DownloadOutlined />} loading={this.state.downloading}
                  disabled={isLegacy} onClick={() => this.downloadCapture()}>{this.state.downloading ? '다운로드 중' : '다운로드'}</Button>}
                <Button size="small" icon={<RedoOutlined />} onClick={this.props.onRetry}>다시 캡처</Button>
              </>}
            </Space>
          </div>
        </Card>

        <section>
          <div className="netdive-capture-section-heading">
            <Typography.Text strong className="netdive-capture-section-title">캡처 요약</Typography.Text>
            <Typography.Text type="secondary" className="netdive-capture-updated-at">
              마지막 업데이트: {new Date(this.state.now).toLocaleTimeString()}
            </Typography.Text>
          </div>
          <div className="netdive-capture-stat-grid">
            {[
              { title: '총 트래픽', icon: <SwapOutlined />, value: this.formatBytes(totalBytes), detail: 'bytes' },
              { title: '총 플로우', icon: <ApartmentOutlined />, value: flows.length.toLocaleString(), detail: 'flows' },
              { title: '주요 통신 대상', icon: <AimOutlined />, value: peer.label, detail: `${peer.percent}%` },
              { title: '주요 프로토콜', icon: <CodeOutlined />, value: protocol.label, detail: `${protocol.percent}%` }
            ].map(item => <Card key={item.title} size="small">
              <Statistic title={<Space size={6}>{item.icon}{item.title}</Space>} value={item.value}
                formatter={() => <span className="netdive-capture-stat-value" title={item.value}>{item.value}</span>}
                styles={{ content: { fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' } }} />
              <Typography.Text type="secondary" className="netdive-capture-supporting">{item.detail}</Typography.Text>
            </Card>)}
          </div>
        </section>

        <Card size="small" title="상위 통신" extra={flows.length > 5 ?
          <Button type="link" size="small" onClick={() => this.setState({ showAllTopFlows: !this.state.showAllTopFlows })}>
            {this.state.showAllTopFlows ? '접기' : `더보기 (${flows.length - 5})`}
          </Button> : undefined}>
          <Table<CaptureFlowSummary> size="small" rowKey="key" pagination={false} dataSource={visibleTopFlows}
            locale={{ emptyText: empty('아직 표시할 플로우가 없습니다. 캡처가 진행되면 요약이 갱신됩니다.') }}
            columns={[
              { title: '통신 대상', key: 'endpoints', render: (_, flow) => <Space orientation="vertical" size={4}>
                <Typography.Text title={`${flow.source} → ${flow.destination}`}>
                  {this.endpointAddress(flow.source)} → {this.endpointAddress(flow.destination)}
                </Typography.Text>
                <Space size={4} wrap><Tag color="blue">{flow.protocol}</Tag>{flow.application && <Tag>{flow.application}</Tag>}
                  <Typography.Text type="secondary" className="netdive-capture-supporting">포트 {flow.destinationPort || flow.sourcePort || '-'}</Typography.Text>
                </Space>
              </Space> },
              { title: '트래픽', key: 'traffic', align: 'right', width: 85, render: (_, flow) => <Space orientation="vertical" size={0}>
                <Typography.Text>{this.formatBytes(flow.bytes)}</Typography.Text>
                <Typography.Text type="secondary" className="netdive-capture-supporting">{totalPackets > 0 ? Math.round(flow.packets / totalPackets * 100) : 0}%</Typography.Text>
              </Space> }
            ]}
            expandable={{
              expandedRowKeys: this.state.expandedFlowKey ? [this.state.expandedFlowKey] : [],
              onExpand: (expanded, flow) => this.setState({ expandedFlowKey: expanded ? flow.key : '' }),
              expandedRowRender: flow => <>
                <Descriptions size="small" column={1} items={[
                  { key: 'ports', label: '원시 포트', children: `${flow.sourcePort || '-'} → ${flow.destinationPort || '-'}` },
                  { key: 'packets', label: '패킷', children: flow.packets.toLocaleString() }
                ]} />
                <Progress size="small" percent={totalBytes > 0 ? Math.round(flow.bytes / totalBytes * 100) : 0} />
              </>
            }} />
        </Card>

        <div className="netdive-capture-distribution-grid">
          <Card size="small" title="프로토콜 분포">
            {distribution(protocolDistribution, '아직 프로토콜 분포가 없습니다.')}
          </Card>
          <Card size="small" title="상위 포트">
            {distribution(portDistribution.map(item => ({ ...item, label: `${item.port} ${this.portApplication(item.port)}` })), '아직 포트 통계가 없습니다.')}
          </Card>
        </div>
        <Collapse size="small" expandIconPlacement="end" items={[{
          key: 'raw-flows', label: <Space><NodeIndexOutlined />원시 플로우 보기</Space>, children: <FlowPanel el={this.props.el} />
        }]} />
        <Typography.Paragraph type="secondary" className="netdive-capture-summary-hint">
          요약 정보는 실시간으로 갱신되며, 캡처 완료 후 최종 값이 확정됩니다.
        </Typography.Paragraph>
      </div>
      </ConfigProvider>
    )
  }
}

export default CaptureStatusPanel
