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
    series: TrendSeries[]
}

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
        minWidth: 0
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
    body: {
        padding: theme.spacing(1.1, 1.25, 1.25)
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
        [theme.breakpoints.down('sm')]: {
            gridTemplateColumns: '1fr'
        }
    },
    trendTile: {
        minWidth: 0,
        border: '1px solid var(--netdive-detail-border-soft)',
        borderRadius: 12,
        padding: '10px 12px',
        background: 'var(--netdive-detail-soft-card, #fbfdff)'
    },
    trendTop: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 8
    },
    trendLabel: {
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 11.5,
        lineHeight: 1.2,
        fontWeight: 750,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    trendValue: {
        color: 'var(--netdive-detail-text)',
        fontSize: 15,
        lineHeight: 1.1,
        fontWeight: 850,
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
        borderTop: '2px dashed rgba(100, 116, 139, 0.9)'
    },
    svg: {
        width: '100%',
        height: 44,
        display: 'block'
    },
    axis: {
        stroke: 'rgba(148, 163, 184, 0.26)',
        strokeWidth: 1
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
        stroke: 'rgba(100, 116, 139, 0.9)',
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
        marginBottom: 8,
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
        loadedFor: ''
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
        const loadedFor = this.hostQueryKey(node, data)

        const params = new URLSearchParams()
        params.set('host', host)
        params.set('name', name)
        params.set('range', '3h')
        params.set('step', '60s')
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
            return `${value.toFixed(value >= 10 ? 0 : 2)} count`
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
                value: `RX ${rxValue} / TX ${txValue}`,
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

    private pointRange(seriesList: TrendSeries[]): { min: number, max: number } {
        const values = seriesList.flatMap(series => (series.values || [])
            .filter(point => typeof point.value === 'number')
            .map(point => Number(point.value)))

        if (!values.length) return { min: 0, max: 1 }
        const min = Math.min(...values)
        const max = Math.max(...values)
        if (min === max) return { min: Math.max(0, min - 1), max: max + 1 }
        return { min, max }
    }

    private buildPath(points: TrendPoint[], width: number, height: number, min: number, max: number): string {
        const valid = points.filter(point => typeof point.value === 'number') as Array<TrendPoint & { value: number }>
        if (valid.length < 2) return ''

        const range = max - min || 1
        const left = 4
        const right = width - 4
        const top = 5
        const bottom = height - 6

        return valid.map((point, index) => {
            const x = left + ((right - left) * index) / Math.max(valid.length - 1, 1)
            const y = bottom - ((point.value - min) / range) * (bottom - top)
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
        }).join(' ')
    }

    private buildFillPath(linePath: string, width: number, height: number): string {
        if (!linePath) return ''
        return `${linePath} L ${width - 4} ${height - 6} L 4 ${height - 6} Z`
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

    private renderSparkline(item: TrendDisplayItem) {
        const { classes } = this.props
        const width = 240
        const height = 44
        const { min, max } = this.pointRange(item.series)
        const linePaths = item.series.map(series => this.buildPath(series.values || [], width, height, min, max))
        const firstLinePath = linePaths[0] || ''
        const fillPath = item.series.length === 1 ? this.buildFillPath(firstLinePath, width, height) : ''

        if (!linePaths.some(Boolean)) {
            return <div className={classes.empty}>수집된 추이 데이터가 없습니다.</div>
        }

        return (
            <svg className={classes.svg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                <line className={classes.axis} x1="4" y1={height - 6} x2={width - 4} y2={height - 6} />
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
                        <div className={classes.title}>리소스 3시간 추이</div>
                        <div className={classes.description}>CPU, Memory, Storage IOPS, Network Traffic, Drops 추이를 조회합니다.</div>
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
                                <div className={classes.trendTile} key={item.key}>
                                    <div className={classes.trendTop}>
                                        <div className={classes.trendLabel}>{item.label}</div>
                                        <div className={classes.trendValue}>{item.value}</div>
                                    </div>
                                    {this.renderLegend(item)}
                                    {this.renderSparkline(item)}
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
