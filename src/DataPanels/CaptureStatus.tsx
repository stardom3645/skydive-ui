import * as React from 'react'
import Button from '@material-ui/core/Button'
import LinearProgress from '@material-ui/core/LinearProgress'
import Typography from '@material-ui/core/Typography'
import VideocamIcon from '@material-ui/icons/Videocam'
import StopIcon from '@material-ui/icons/Stop'
import ReplayIcon from '@material-ui/icons/Replay'
import { createStyles, Theme, withStyles } from '@material-ui/core/styles'

import Panel from './Panel'
import { session } from '../Store'

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
  onUpdate: (capture: SimpleCaptureSession) => void
  onClear: () => void
  onRetry: () => void
}

interface State {
  now: number
  loading: boolean
  error: string
}

const terminalStatuses = new Set(['completed', 'expired', 'delete_failed', 'failed'])

class CaptureStatusPanel extends React.Component<Props, State> {
  private tickTimer?: number
  private pollTimer?: number

  constructor(props: Props) {
    super(props)
    this.state = { now: Date.now(), loading: false, error: '' }
  }

  componentDidMount() {
    this.tickTimer = window.setInterval(() => this.tick(), 1000)
    this.pollTimer = window.setInterval(() => this.fetchStatus(), 3000)
    this.fetchStatus()
  }

  componentWillUnmount() {
    if (this.tickTimer) window.clearInterval(this.tickTimer)
    if (this.pollTimer) window.clearInterval(this.pollTimer)
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.capture.id !== this.props.capture.id) {
      this.setState({ now: Date.now(), error: '' })
      this.fetchStatus()
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
      case 'delete_failed': return '패킷 캡처 중지 실패'
      case 'failed': return '패킷 캡처 실패'
      default: return '패킷 캡처 진행 중'
    }
  }

  render() {
    const { classes, capture } = this.props
    const isRunning = capture.status === 'running'
    const isDone = terminalStatuses.has(capture.status) && capture.status !== 'delete_failed' && capture.status !== 'failed'
    const isLegacy = capture.id.startsWith('legacy-')

    return (
      <Panel icon={<VideocamIcon />} title="패킷 캡처 상태" content={
        <div className={classes.captureStatusCard}>
          <div className={classes.captureStatusHeader}>
            <div>
              <Typography component="strong">{this.statusTitle()}</Typography>
              <span>{capture.targetName || '-'} · {this.scopeLabel()}</span>
            </div>
            <em className={isRunning ? classes.captureStatusRunning : classes.captureStatusDone}>
              {isRunning ? '실행 중' : isDone ? '완료' : '확인 필요'}
            </em>
          </div>
          <div className={classes.captureStatusMeta}>
            <span>필터: {this.filterLabel()}</span>
            <span>남은 시간: {isRunning ? this.formatRemaining() : '00:00'}</span>
            {capture.captureID && <span>Capture ID: {capture.captureID.slice(0, 8)}...</span>}
          </div>
          <LinearProgress variant="determinate" value={isRunning ? this.progressValue() : 100} className={classes.captureProgress} />
          {this.state.error && <p className={classes.captureStatusError}>{this.state.error}</p>}
          <div className={classes.captureStatusActions}>
            {isRunning &&
              <Button size="small" variant="outlined" startIcon={<StopIcon />} disabled={this.state.loading || isLegacy} onClick={() => this.stopCapture()}>
                중지
              </Button>
            }
            {isDone &&
              <Button size="small" variant="outlined" startIcon={<ReplayIcon />} onClick={this.props.onRetry}>
                다시 캡처
              </Button>
            }
            {isDone &&
              <Button size="small" color="primary" variant="outlined" disabled>
                다운로드 준비 중
              </Button>
            }
            {!isRunning &&
              <Button size="small" onClick={this.props.onClear}>
                닫기
              </Button>
            }
          </div>
        </div>
      } />
    )
  }
}

const styles = (theme: Theme) => createStyles({
  captureStatusCard: {
    padding: theme.spacing(1.2),
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
  captureStatusMeta: {
    display: 'grid',
    gap: 4,
    marginTop: theme.spacing(1),
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 12,
  },
  captureProgress: {
    height: 8,
    borderRadius: 999,
    marginTop: theme.spacing(1),
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
  }
})

export default withStyles(styles)(CaptureStatusPanel)
