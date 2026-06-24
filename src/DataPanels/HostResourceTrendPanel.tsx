import * as React from 'react'
import CircularProgress from '@material-ui/core/CircularProgress'
import TimelineIcon from '@material-ui/icons/Timeline'
import { createStyles, Theme, withStyles } from '@material-ui/core/styles'

import { Node } from '../Topology'
import { session } from '../Store'

interface Props {
    classes: any
    node: Node
    session?: session
    data?: any
}

interface State {
    loading: boolean
    error: string
    trend?: HostTrendResponse
    loadedFor: string
    trendRange: string
}

interface HostTrendResponse {
    host: string
    range: string
    step: string
    start: number
    end: number
    series: TrendSeries[]
    warnings?: string[]
}

interface TrendSeries {
    key: string
    label: string
    unit: string
    values: TrendPoint[]
    lastValue?: number
}

interface TrendPoint {
    timestamp: number
    value?: number
}

interface TrendDisplayItem {
    key: string
    label: string
    unit: string
    value: string
    valueLines?: string[]
    series: TrendSeries[]
}

const trendRanges = [
    { label: '1시간', value: '1h' },
    { label: '3시간', value: '3h' },
    { label: '6시간', value: '6h' },
    { label: '12시간', value: '12h' }
]

const styles = (theme: Theme) => createStyles({
    card: {
        border: '1px solid var(--netdive-detail-border-soft)',
        borderRadius: 16,
        background: 'var(--netdive-detail-card-bg, #ffffff)',
        overflow: 'hidden',
        boxShadow: '0 8px 22px rgba(15, 23, 42, 0.035)'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.9),
        padding: theme.spacing(1.25, 1.35),
        borderBottom: '1px solid var(--netdive-detail-border-subtle, rgba(226, 232, 240, 0.72))',
        background: 'var(--netdive-detail-section-header, #f8fafc)'
    },
    icon: {
        width: 28,
        height: 28,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 28px',
        color: 'var(--topology-level-label-active-text)',
        background: 'rgba(232, 242, 255, 0.82)',
        '& svg': {
            fontSize: 17
        }
    },
    titleBlock: {
        minWidth: 0,
        flex: '1 1 auto'
    },
    title: {
        color: 'var(--netdive-detail-text)',
        fontSize: 14,
        lineHeight: 1.2,
        fontWeight: 800
    },
    description: {
        marginTop: 3,
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 11.5,
        lineHeight: 1.35,
        fontWeight: 500
    },
    headerActions: {
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
        flex: '0 0 auto'
    },
    rangeSelect: {
        height: 30,
        minWidth: 78,
        border: '1px solid var(--netdive-detail-border-soft)',
        borderRadius: 9,
        padding: '0 24px 0 9px',
        color: 'var(--netdive-detail-text)',
        background: 'var(--netdive-detail-soft-card, #fbfdff)',
        fontSize: 11.5,
        fontWeight: 750,
        outline: 'none'
    },
    body: {
        padding: theme.spacing(1.1, 1.25, 1.25)
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 8
    },
    trendTile: {
        minWidth: 0,
        border: '1px solid var(--netdive-detail-border-soft)',
        borderRadius: 12,
        padding: '9px 12px',
        background: 'var(--netdive-detail-soft-card, #fbfdff)'
    },
    trendTop: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 6
    },
    trendLabel: {
        minWidth: 0,
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 11.5,
        lineHeight: 1.2,
        fontWeight: 750,
        whiteSpace: 'nowrap'
    },
    trendValue: {
        flex: '0 0 auto',
        color: 'var(--netdive-detail-title, #0f172a)',
        fontSize: 12.8,
        lineHeight: 1.15,
        fontWeight: 760,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        textAlign: 'right'
    },
    trendValueStack: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 2,
        flex: '0 0 auto',
        maxWidth: '62%'
    },
    trendValueLine: {
        color: 'var(--netdive-detail-title, #0f172a)',
        fontSize: 11.2,
        lineHeight: 1.16,
        fontWeight: 760,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap'
    },
    legend: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: -2,
        marginBottom: 6,
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 10.5,
        fontWeight: 700
    },
    legendItem: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4
    },
    legendLine: {
        width: 14,
        height: 0,
        borderTop: '2px solid var(--netdive-detail-accent, #1A73E8)'
    },
    legendLineSecondary: {
        width: 14,
        height: 0,
        borderTop: '2px dashed #f97316'
    },
    svg: {
        width: '100%',
        height: 78,
        display: 'block',
        overflow: 'visible'
    },
    axis: {
        stroke: 'rgba(148, 163, 184, 0.28)',
        strokeWidth: 1
    },
    guide: {
        stroke: 'rgba(148, 163, 184, 0.32)',
        strokeWidth: 1,
        strokeDasharray: '3 3'
    },
    axisLabel: {
        fill: 'rgba(71, 85, 105, 0.86)',
        fontSize: 8.8,
        fontWeight: 560,
        letterSpacing: 0
    },
    timeLabel: {
        fill: 'rgba(71, 85, 105, 0.82)',
        fontSize: 8.8,
        fontWeight: 560,
        letterSpacing: 0
    },
    line: {
        fill: 'none',
        stroke: 'var(--netdive-detail-accent, #1A73E8)',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
    },
    lineSecondary: {
        fill: 'none',
        stroke: '#f97316',
        strokeWidth: 2,
        strokeDasharray: '4 3',
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
    },
    fill: {
        fill: 'rgba(26, 115, 232, 0.08)'
    },
    empty: {
        padding: theme.spacing(1.35),
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 12.5,
        lineHeight: 1.5,
        fontWeight: 600
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 12.5,
        fontWeight: 650
    },
    refreshing: {
        marginBottom: 6,
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 11,
        fontWeight: 650
    }
})

const isBlank = (value: any): boolean => {
    if (value === undefined || value === null) return true
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'string') return value.trim() === ''
    return false
}

const stringify = (value: any): string => {
    if (isBlank(value)) return ''
    if (Array.isArray(value)) return value.map(v => stringify(v)).filter(Boolean).join(', ')
    if (typeof value === 'object') return ''
    return String(value)
}

const firstValue = (data: any, keys: string[]): string => {
    for (const key of keys) {
        const value = stringify(data?.[key])
        if (value) return value
    }
    return ''
}

class HostResourceTrendPanel extends React.Component<Props, State> {
    state: State = {
        loading: false,
        error: '',
        loadedFor: '',
        trendRange: '3h'
    }

    componentDidMount() {
        this.loadTrend()
    }

    componentDidUpdate(prevProps: Props) {
        const prevKey = this.hostQueryKey(prevProps.node, prevProps.data)
        const nextKey = this.hostQueryKey(this.props.node, this.props.data)

        if (prevKey !== nextKey) {
            this.loadTrend()
        }
    }

    private endpoint(): string {
        return this.props.session?.endpoint || `${window.location.protocol}//${window.location.host}`
    }

    private rangeLabel(): string {
        const item = trendRanges.find(range => range.value === this.state.trendRange)
        return item ? item.label : this.state.trendRange
    }

    private handleRangeChange(event: React.ChangeEvent<HTMLSelectElement>) {
        const trendRange = event.target.value
        if (trendRange === this.state.trendRange) return
        this.setState({ trendRange, trend: undefined, error: '', loading: true }, () => this.loadTrend())
    }

    private hostQueryKey(node = this.props.node, data = this.props.data): string {
        const detail = data || node.data || {}
        const name = firstValue(detail, ['Name', 'Hostname', 'HostName']) || node.id
        const managementIp = firstValue(detail, ['ManagementIP', 'ManagementIp', 'managementIp', 'IpAddress', 'ipaddress'])
        return `${node.id}:${name}:${managementIp}`
    }

    private loadTrend() {
        const { node, data } = this.props
        const detail = data || node.data || {}
        const name = firstValue(detail, ['Name', 'Hostname', 'HostName']) || node.id
        const managementIp = firstValue(detail, ['ManagementIP', 'ManagementIp', 'managementIp', 'IpAddress', 'ipaddress'])
        const host = firstValue(detail, ['Hostname', 'HostName', 'Name']) || name
        const trendRange = this.state.trendRange
        const loadedFor = `${this.hostQueryKey(node, data)}:${trendRange}`

        const params = new URLSearchParams()
        params.set('host', host)
        params.set('name', name)
        params.set('range', trendRange)
        params.set('step', '60s')
        params.set('_', String(Date.now()))
        params.set('job', 'cube')
        params.set('port', '3003')
        if (managementIp) {
            params.set('managementIp', managementIp)
            params.set('ip', managementIp)
        }

        this.setState({ loading: true, error: '', loadedFor })

        fetch(`${this.endpoint()}/api/wall/hosts/trend?${params.toString()}`, {
            cache: 'no-store',
            headers: this.props.session?.token ? { 'X-Auth-Token': this.props.session.token } : undefined
        }).then(resp => {
            if (!resp.ok) {
                throw new Error(`trend unavailable: ${resp.status}`)
            }
            return resp.json()
        }).then((trend: HostTrendResponse) => {
            if (this.state.loadedFor === loadedFor) {
                this.setState({ loading: false, trend, error: '' })
            }
        }).catch(error => {
            if (this.state.loadedFor === loadedFor) {
                this.setState({ loading: false, error: error.message || 'trend unavailable' })
            }
        })
    }

    private formatValue(value: number | undefined, unit: string): string {
        if (value === undefined || value === null || Number.isNaN(value)) return 'N/A'

        if (unit === 'percent' || unit === 'percentage' || unit === '%') {
            return `${Math.round(value)}%`
        }

        if (unit === 'bps') {
            if (value >= 1000 * 1000 * 1000) return `${(value / 1000 / 1000 / 1000).toFixed(1)} Gbps`
            if (value >= 1000 * 1000) return `${(value / 1000 / 1000).toFixed(1)} Mbps`
            if (value >= 1000) return `${(value / 1000).toFixed(1)} Kbps`
            return `${Math.round(value)} bps`
        }

        if (unit === 'iops') {
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K IOPS`
            return `${value.toFixed(value >= 10 ? 0 : 1)} IOPS`
        }

        if (unit === 'count') {
            return `${Math.floor(value)} 회`
        }

        return String(Math.round(value))
    }

    private seriesByKey(series: TrendSeries[], key: string): TrendSeries | undefined {
        return series.find(item => item.key === key)
    }

    private hasValues(series?: TrendSeries): boolean {
        return !!series && Array.isArray(series.values) && series.values.some(point => typeof point.value === 'number')
    }

    private displayItems(series: TrendSeries[]): TrendDisplayItem[] {
        const cpu = this.seriesByKey(series, 'cpu')
        const memory = this.seriesByKey(series, 'memory')
        const storageIops = this.seriesByKey(series, 'storageIops')
        const networkRx = this.seriesByKey(series, 'networkRx')
        const networkTx = this.seriesByKey(series, 'networkTx')
        const networkDrops = this.seriesByKey(series, 'networkDrops')
        const items: TrendDisplayItem[] = []

        if (this.hasValues(cpu)) {
            items.push({
                key: 'cpu',
                label: 'CPU Usage',
                unit: 'percent',
                value: this.formatValue(cpu?.lastValue, 'percent'),
                series: [cpu as TrendSeries]
            })
        }

        if (this.hasValues(memory)) {
            items.push({
                key: 'memory',
                label: 'Memory Usage',
                unit: 'percent',
                value: this.formatValue(memory?.lastValue, 'percent'),
                series: [memory as TrendSeries]
            })
        }

        if (this.hasValues(storageIops)) {
            items.push({
                key: 'storageIops',
                label: 'Storage IOPS',
                unit: 'iops',
                value: this.formatValue(storageIops?.lastValue, 'iops'),
                series: [storageIops as TrendSeries]
            })
        }

        if (this.hasValues(networkRx) || this.hasValues(networkTx)) {
            const rxValue = this.formatValue(networkRx?.lastValue, 'bps')
            const txValue = this.formatValue(networkTx?.lastValue, 'bps')
            items.push({
                key: 'networkTraffic',
                label: 'Network Traffic',
                unit: 'bps',
                value: '',
                valueLines: [`RX ${rxValue}`, `TX ${txValue}`],
                series: [networkRx, networkTx].filter(Boolean) as TrendSeries[]
            })
        }

        if (this.hasValues(networkDrops)) {
            items.push({
                key: 'networkDrops',
                label: 'Network Drops / Errors',
                unit: 'count',
                value: this.formatValue(networkDrops?.lastValue, 'count'),
                series: [networkDrops as TrendSeries]
            })
        }

        return items
    }

    private pointRange(seriesList: TrendSeries[], unit: string): { min: number, max: number } {
        const values = seriesList.reduce<number[]>((acc, series) => {
            const points = (series.values || [])
                .filter(point => typeof point.value === 'number')
                .map(point => Number(point.value))
            return acc.concat(points)
        }, [])

        if (unit === 'percent' || unit === 'percentage' || unit === '%') {
            return { min: 0, max: 100 }
        }

        if (!values.length) return { min: 0, max: 1 }

        const max = Math.max.apply(null, values)
        return { min: 0, max: this.niceAxisMax(max, unit) }
    }

    private niceAxisMax(value: number, unit: string): number {
        if (!isFinite(value) || value <= 0) return 1

        const multiplier = unit === 'count' ? 1 : Math.pow(10, Math.floor(Math.log(value) / Math.LN10))
        const normalized = value / multiplier
        let nice = 1

        if (normalized <= 1) {
            nice = 1
        } else if (normalized <= 2) {
            nice = 2
        } else if (normalized <= 5) {
            nice = 5
        } else {
            nice = 10
        }

        if (unit === 'count') {
            return Math.max(1, Math.ceil(value))
        }

        return nice * multiplier
    }

    private renderLegend(item: TrendDisplayItem) {
        const { classes } = this.props
        if (item.key !== 'networkTraffic') return null

        return (
            <div className={classes.legend}>
                <span className={classes.legendItem}><span className={classes.legendLine} />RX</span>
                <span className={classes.legendItem}><span className={classes.legendLineSecondary} />TX</span>
            </div>
        )
    }

    private renderTrendValue(item: TrendDisplayItem) {
        const { classes } = this.props
        if (item.valueLines && item.valueLines.length > 0) {
            return (
                <div className={classes.trendValueStack}>
                    {item.valueLines.map(line => (
                        <div className={classes.trendValueLine} key={line}>{line}</div>
                    ))}
                </div>
            )
        }

        return <div className={classes.trendValue}>{item.value}</div>
    }

    private formatAxisValue(value: number, unit: string): string {
        if (unit === 'percent' || unit === 'percentage' || unit === '%') {
            return `${Math.round(value)}%`
        }
        if (unit === 'bps') {
            if (value >= 1000 * 1000 * 1000) return `${this.trimFixed(value / 1000 / 1000 / 1000)} Gbps`
            if (value >= 1000 * 1000) return `${this.trimFixed(value / 1000 / 1000)} Mbps`
            if (value >= 1000) return `${this.trimFixed(value / 1000)} Kbps`
            return `${Math.round(value)} bps`
        }
        if (unit === 'iops') {
            if (value >= 1000) return `${this.trimFixed(value / 1000)}K IOPS`
            return `${Math.round(value)} IOPS`
        }
        if (unit === 'count') {
            return `${Math.floor(value)} 회`
        }
        return `${Math.round(value)}`
    }

    private trimFixed(value: number): string {
        const fixed = value >= 10 ? value.toFixed(0) : value.toFixed(1)
        return fixed.replace(/\.0$/, '')
    }

    private formatTimeLabel(timestamp: number): string {
        if (!timestamp) return '--:--'
        const date = new Date(timestamp * 1000)
        const hours = this.padTime(date.getHours())
        const minutes = this.padTime(date.getMinutes())
        return `${hours}:${minutes}`
    }

    private padTime(value: number): string {
        return value < 10 ? `0${value}` : String(value)
    }

    private timeAxisLabels(start?: number, end?: number): string[] {
        if (!start || !end || end <= start) {
            return ['--:--', '--:--', '--:--']
        }

        const mid = start + Math.floor((end - start) / 2)
        return [this.formatTimeLabel(start), this.formatTimeLabel(mid), this.formatTimeLabel(end)]
    }

    private renderSparkline(item: TrendDisplayItem, trend?: HostTrendResponse) {
        const { classes } = this.props
        const width = 430
        const height = 78
        const left = 52
        const right = width - 8
        const top = 8
        const bottom = height - 22
        const { min, max } = this.pointRange(item.series, item.unit)
        const range = max - min || 1
        const linePaths = item.series.map(series => {
            const valid = (series.values || []).filter(point => typeof point.value === 'number') as Array<TrendPoint & { value: number }>
            if (valid.length < 2) return ''
            return valid.map((point, index) => {
                const x = left + ((right - left) * index) / Math.max(valid.length - 1, 1)
                const y = bottom - ((point.value - min) / range) * (bottom - top)
                return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
            }).join(' ')
        })
        const firstLinePath = linePaths[0] || ''
        const fillPath = item.series.length === 1 && firstLinePath ? `${firstLinePath} L ${right} ${bottom} L ${left} ${bottom} Z` : ''
        const mid = min + ((max - min) / 2)
        const axisLabels = this.timeAxisLabels(trend?.start, trend?.end)

        if (!linePaths.some(Boolean)) {
            return <div className={classes.empty}>수집된 추이 데이터가 없습니다.</div>
        }

        return (
            <svg className={classes.svg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
                <line className={classes.guide} x1={left} y1={top} x2={right} y2={top} />
                <line className={classes.guide} x1={left} y1={(top + bottom) / 2} x2={right} y2={(top + bottom) / 2} />
                <line className={classes.axis} x1={left} y1={bottom} x2={right} y2={bottom} />
                <line className={classes.axis} x1={left} y1={top} x2={left} y2={bottom} />
                <text className={classes.axisLabel} x="6" y={top + 4}>{this.formatAxisValue(max, item.unit)}</text>
                <text className={classes.axisLabel} x="6" y={((top + bottom) / 2) + 3}>{this.formatAxisValue(mid, item.unit)}</text>
                <text className={classes.axisLabel} x="6" y={bottom + 3}>{this.formatAxisValue(min, item.unit)}</text>
                <text className={classes.timeLabel} x={left} y={height - 4}>{axisLabels[0]}</text>
                <text className={classes.timeLabel} x={(left + right) / 2} y={height - 4} textAnchor="middle">{axisLabels[1]}</text>
                <text className={classes.timeLabel} x={right} y={height - 4} textAnchor="end">{axisLabels[2]}</text>
                {fillPath && <path className={classes.fill} d={fillPath} />}
                {linePaths.map((path, index) => path && (
                    <path className={index === 0 ? classes.line : classes.lineSecondary} d={path} key={`${item.key}-${index}`} />
                ))}
            </svg>
        )
    }

    render() {
        const { classes } = this.props
        const { loading, error, trend } = this.state
        const displayItems = this.displayItems(trend?.series || [])
        const hasTrend = displayItems.length > 0

        return (
            <section className={classes.card}>
                <div className={classes.header}>
                    <span className={classes.icon}><TimelineIcon /></span>
                    <div className={classes.titleBlock}>
                        <div className={classes.title}>리소스 {this.rangeLabel()} 추이</div>
                    </div>
                    <div className={classes.headerActions}>
                        <select
                            className={classes.rangeSelect}
                            value={this.state.trendRange}
                            onChange={event => this.handleRangeChange(event)}
                            aria-label="리소스 추이 시간 범위"
                        >
                            {trendRanges.map(range => (
                                <option value={range.value} key={range.value}>{range.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className={classes.body}>
                    {loading && !hasTrend && (
                        <div className={classes.loading}>
                            <CircularProgress size={16} />
                            <span>추이 데이터를 조회하는 중입니다.</span>
                        </div>
                    )}

                    {loading && hasTrend && (
                        <div className={classes.refreshing}>추이 데이터를 갱신하는 중입니다.</div>
                    )}

                    {!loading && error && !hasTrend && (
                        <div className={classes.empty}>Wall Prometheus 추이 데이터를 조회하지 못했습니다.</div>
                    )}

                    {!loading && !error && !hasTrend && (
                        <div className={classes.empty}>표시할 리소스 추이 데이터가 없습니다.</div>
                    )}

                    {hasTrend && (
                        <div className={classes.grid}>
                            {displayItems.map(item => (
                                <div className={classes.trendTile} key={`${item.key}-${this.state.trendRange}-${trend?.start || 0}-${trend?.end || 0}`}>
                                    <div className={classes.trendTop}>
                                        <div className={classes.trendLabel}>{item.label}</div>
                                        {this.renderTrendValue(item)}
                                    </div>
                                    {this.renderLegend(item)}
                                    {this.renderSparkline(item, trend)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        )
    }
}

export default withStyles(styles)(HostResourceTrendPanel)
