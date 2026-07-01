import * as React from 'react'
import CircularProgress from '@material-ui/core/CircularProgress'
import Tooltip from '@material-ui/core/Tooltip'
import InfoIcon from '@material-ui/icons/Info'
import TimelineIcon from '@material-ui/icons/Timeline'
import { createStyles, Theme, withStyles } from '@material-ui/core/styles'

import { Node } from '../Topology'
import { session } from '../Store'

interface Props {
    classes: any
    node: Node
    session?: session
    data?: any
    target?: 'host' | 'vm'
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
        padding: '13px 15px 12px',
        background: 'var(--netdive-detail-soft-card, #fbfdff)',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        transition: 'border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease',
        '&:hover': {
            borderColor: 'rgba(148, 163, 184, 0.42)',
            background: 'var(--netdive-detail-soft-card-hover, #ffffff)',
            boxShadow: '0 8px 18px rgba(15, 23, 42, 0.045)'
        }
    },
    trendHeaderBlock: {
        display: 'grid',
        gap: 8,
        minWidth: 0,
        padding: '0 5px 9px',
        borderBottom: '1px solid rgba(226, 232, 240, 0.34)'
    },
    trendTop: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minWidth: 0,
        minHeight: 26
    },
    trendLabel: {
        minWidth: 0,
        color: 'var(--netdive-detail-title, #0f172a)',
        fontSize: 14,
        lineHeight: 1.2,
        fontWeight: 700,
        whiteSpace: 'nowrap'
    },
    trendHeaderRight: {
        minWidth: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        marginLeft: 'auto',
        whiteSpace: 'nowrap'
    },
    trendValue: {
        color: '#111827',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        lineHeight: 1,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap'
    },
    trendValueNumber: {
        fontSize: 14,
        fontWeight: 700,
        color: '#111827',
        lineHeight: 1
    },
    trendValueUnit: {
        fontSize: 10,
        fontWeight: 700,
        color: '#64748b',
        lineHeight: 1,
        letterSpacing: 0,
        transform: 'translateY(-0.5px)'
    },
    trendInfoButton: {
        width: 22,
        height: 22,
        border: 0,
        padding: 0,
        borderRadius: 7,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: 'var(--netdive-detail-muted, #64748b)',
        cursor: 'help',
        flex: '0 0 22px',
        opacity: 0.62,
        transition: 'opacity 140ms ease, background-color 140ms ease, color 140ms ease',
        '&:hover': {
            opacity: 1,
            background: 'rgba(148, 163, 184, 0.12)',
            color: 'var(--netdive-detail-title, #0f172a)'
        }
    },
    trendInfoIcon: {
        width: 15,
        height: 15,
        color: 'currentColor'
    },
    metricTooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        color: '#f8fafc',
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
        fontSize: 12,
        lineHeight: 1.45,
        maxWidth: 260
    },
    metricTooltipArrow: {
        color: 'rgba(15, 23, 42, 0.94)'
    },
    tooltipContent: {
        display: 'grid',
        gap: 6,
        minWidth: 118,
        padding: 0
    },
    tooltipRow: {
        display: 'grid',
        gridTemplateColumns: '42px max-content',
        alignItems: 'center',
        justifyContent: 'space-between',
        columnGap: 14,
        fontSize: 12,
        lineHeight: 1.35,
        '& span': {
            color: '#cbd5e1',
            opacity: 1
        },
        '& strong': {
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'right',
            whiteSpace: 'nowrap'
        }
    },
    tooltipSection: {
        display: 'grid',
        gap: 4
    },
    tooltipSectionTitle: {
        fontSize: 12,
        lineHeight: 1.2,
        fontWeight: 800
    },
    tooltipSectionDivider: {
        height: 1,
        background: 'rgba(148, 163, 184, 0.28)',
        margin: '2px 0'
    },
    networkCurrentBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: 10,
        minWidth: 0,
        color: '#111827',
        fontSize: 14,
        lineHeight: 1.15,
        fontWeight: 700,
        whiteSpace: 'nowrap'
    },
    networkCurrentDivider: {
        width: 1,
        height: 15,
        background: 'rgba(148, 163, 184, 0.28)',
        flex: '0 0 1px'
    },
    networkCurrentItem: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap'
    },
    networkSeriesLabel: {
        fontSize: 11,
        fontWeight: 800
    },
    rxText: {
        color: 'var(--netdive-detail-accent, #1A73E8)'
    },
    txText: {
        color: '#f97316'
    },
    svg: {
        width: '100%',
        height: 98,
        display: 'block',
        overflow: 'visible'
    },
    axis: {
        stroke: 'rgba(148, 163, 184, 0.18)',
        strokeWidth: 1
    },
    guide: {
        stroke: 'rgba(148, 163, 184, 0.16)',
        strokeWidth: 1,
        strokeDasharray: '3 3'
    },
    axisLabel: {
        fill: '#64748b',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0
    },
    timeLabel: {
        fill: '#64748b',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0
    },
    line: {
        fill: 'none',
        stroke: 'var(--netdive-detail-accent, #1A73E8)',
        strokeWidth: 1.2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
    },
    lineSecondary: {
        fill: 'none',
        stroke: '#f97316',
        strokeWidth: 1.2,
        strokeDasharray: '4 3',
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
    },
    fill: {
        fill: 'rgba(26, 115, 232, 0.045)'
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

const firstAddressValue = (data: any, keys: string[]): string => {
    for (const key of keys) {
        const value = data?.[key]
        const candidates = Array.isArray(value) ? value : [value]
        for (const candidate of candidates) {
            const text = stringify(candidate)
            if (text) return text
        }
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
        const prevKey = this.queryKey(prevProps.node, prevProps.data, prevProps.target)
        const nextKey = this.queryKey(this.props.node, this.props.data, this.props.target)

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

    private isVMTarget(target = this.props.target): boolean {
        return target === 'vm'
    }

    private queryKey(node = this.props.node, data = this.props.data, target = this.props.target): string {
        if (this.isVMTarget(target)) {
            return this.vmQueryKey(node, data)
        }
        return this.hostQueryKey(node, data)
    }

    private hostQueryKey(node = this.props.node, data = this.props.data): string {
        const detail = data || node.data || {}
        const name = firstValue(detail, ['Name', 'Hostname', 'HostName']) || node.id
        const managementIp = firstAddressValue(detail, ['ManagementIP', 'ManagementIp', 'managementIp', 'IpAddress', 'ipaddress', 'IPV4', 'IPv4', 'ipv4', 'IfAddr'])
        return `${node.id}:${name}:${managementIp}`
    }

    private vmQueryKey(node = this.props.node, data = this.props.data): string {
        const detail = data || node.data || {}
        const name = firstValue(detail, ['Name', 'name']) || node.id
        const instanceName = firstValue(detail, ['InstanceName', 'instanceName', 'instancename'])
        const uuid = firstValue(detail, ['UUID', 'uuid', 'ID', 'Id', 'id', 'ExtID', 'VirtualMachineID', 'virtualMachineId', 'vmid'])
        const displayName = firstValue(detail, ['DisplayName', 'displayName', 'displayname'])
        return `${node.id}:${name}:${instanceName}:${uuid}:${displayName}`
    }

    private loadTrend() {
        const { node, data } = this.props
        const detail = data || node.data || {}
        const trendRange = this.state.trendRange
        const target = this.props.target || 'host'
        const loadedFor = `${target}:${this.queryKey(node, data, target)}:${trendRange}`

        const params = new URLSearchParams()
        params.set('range', trendRange)
        params.set('step', '60s')
        params.set('_', String(Date.now()))

        let path = '/api/wall/hosts/trend'
        if (this.isVMTarget(target)) {
            path = '/api/wall/vms/trend'
            const name = firstValue(detail, ['Name', 'name']) || node.id
            const instanceName = firstValue(detail, ['InstanceName', 'instanceName', 'instancename'])
            const uuid = firstValue(detail, ['UUID', 'uuid', 'ID', 'Id', 'id', 'ExtID', 'VirtualMachineID', 'virtualMachineId', 'vmid'])
            const displayName = firstValue(detail, ['DisplayName', 'displayName', 'displayname'])
            params.set('name', name)
            params.set('domain', name)
            if (instanceName) params.set('instanceName', instanceName)
            if (uuid) {
                params.set('uuid', uuid)
                params.set('vmId', uuid)
            }
            if (displayName) params.set('displayName', displayName)
        } else {
            const name = firstValue(detail, ['Name', 'Hostname', 'HostName']) || node.id
            const managementIp = firstAddressValue(detail, ['ManagementIP', 'ManagementIp', 'managementIp', 'IpAddress', 'ipaddress', 'IPV4', 'IPv4', 'ipv4', 'IfAddr'])
            const host = firstValue(detail, ['Hostname', 'HostName', 'Name']) || name
            params.set('host', host)
            params.set('name', name)
            params.set('job', 'cube')
            params.set('port', '3003')
            if (managementIp) {
                params.set('managementIp', managementIp)
                params.set('ip', managementIp)
            }
        }

        this.setState({ loading: true, error: '', loadedFor })

        fetch(`${this.endpoint()}${path}?${params.toString()}`, {
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
            return `${Math.round(value)} 회`
        }

        return String(Math.round(value))
    }

    private splitValueText(value: string): { number: string, unit: string } {
        const text = value || 'N/A'
        const match = text.match(/^([^\s]+)(?:\s+(.+))?$/)
        if (!match) return { number: text, unit: '' }
        return { number: match[1], unit: match[2] || '' }
    }

    private renderMetricValue(value: string) {
        const { classes } = this.props
        const parts = this.splitValueText(value)
        return (
            <span className={classes.trendValue}>
                <span className={classes.trendValueNumber}>{parts.number}</span>
                {parts.unit && <span className={classes.trendValueUnit}>{parts.unit}</span>}
            </span>
        )
    }

    private normalizePointValue(value: number, unit: string): number {
        if (unit === 'count') {
            return Math.max(0, Math.round(value))
        }
        return value
    }

    private seriesByKey(series: TrendSeries[], key: string): TrendSeries | undefined {
        return series.find(item => item.key === key)
    }

    private hasValues(series?: TrendSeries): boolean {
        return !!series && Array.isArray(series.values) && series.values.some(point => typeof point.value === 'number')
    }

    private numericValues(series?: TrendSeries): number[] {
        if (!series || !Array.isArray(series.values)) return []
        return series.values
            .filter(point => typeof point.value === 'number')
            .map(point => Number(point.value))
            .filter(value => !Number.isNaN(value))
    }

    private averageValue(series?: TrendSeries): number | undefined {
        const values = this.numericValues(series)
        if (!values.length) return undefined
        return values.reduce((sum, value) => sum + value, 0) / values.length
    }

    private maxValue(series?: TrendSeries): number | undefined {
        const values = this.numericValues(series)
        if (!values.length) return undefined
        return Math.max.apply(null, values)
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
                label: 'CPU 사용 현황',
                unit: 'percent',
                value: this.formatValue(cpu?.lastValue, 'percent'),
                series: [cpu as TrendSeries]
            })
        }

        if (this.hasValues(memory)) {
            items.push({
                key: 'memory',
                label: '메모리 사용 현황',
                unit: 'percent',
                value: this.formatValue(memory?.lastValue, 'percent'),
                series: [memory as TrendSeries]
            })
        }

        if (this.hasValues(storageIops)) {
            items.push({
                key: 'storageIops',
                label: '스토리지 IOPS',
                unit: 'iops',
                value: this.formatValue(storageIops?.lastValue, 'iops'),
                series: [storageIops as TrendSeries]
            })
        }

        if (this.hasValues(networkRx) || this.hasValues(networkTx)) {
            items.push({
                key: 'networkTraffic',
                label: '네트워크 트래픽',
                unit: 'bps',
                value: '',
                series: [networkRx, networkTx].filter(Boolean) as TrendSeries[]
            })
        }

        if (this.hasValues(networkDrops)) {
            items.push({
                key: 'networkDrops',
                label: '네트워크 드롭 / 오류',
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
                .map(point => this.normalizePointValue(Number(point.value), unit))
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
            const rounded = Math.max(1, Math.ceil(value))
            return rounded < 3 ? 3 : rounded
        }

        return nice * multiplier
    }

    private renderTrendHeader(item: TrendDisplayItem) {
        const { classes } = this.props
        const isNetworkTraffic = item.key === 'networkTraffic'

        return (
            <div className={classes.trendHeaderBlock}>
                <div className={classes.trendTop}>
                    <div className={classes.trendLabel}>{item.label}</div>
                    <div className={classes.trendHeaderRight}>
                        {isNetworkTraffic ? this.renderNetworkCurrentValues(item) : this.renderMetricValue(item.value)}
                        {this.renderInfoTooltip(item)}
                    </div>
                </div>
            </div>
        )
    }

    private renderInfoTooltip(item: TrendDisplayItem) {
        const { classes } = this.props
        return (
            <Tooltip
                title={this.renderTooltipContent(item)}
                placement="top"
                arrow
                classes={{ tooltip: classes.metricTooltip, arrow: classes.metricTooltipArrow }}
            >
                <button className={classes.trendInfoButton} type="button" aria-label={`${item.label} 상세 통계`}>
                    <InfoIcon className={classes.trendInfoIcon} />
                </button>
            </Tooltip>
        )
    }

    private renderNetworkCurrentValues(item: TrendDisplayItem) {
        const { classes } = this.props
        const rx = this.seriesByKey(item.series, 'networkRx')
        const tx = this.seriesByKey(item.series, 'networkTx')

        return (
            <div className={classes.networkCurrentBar}>
                <div className={classes.networkCurrentItem}>
                    <span className={`${classes.networkSeriesLabel} ${classes.rxText}`}>RX</span>
                    {this.renderMetricValue(this.formatValue(rx?.lastValue, 'bps'))}
                </div>
                <span className={classes.networkCurrentDivider} aria-hidden="true" />
                <div className={classes.networkCurrentItem}>
                    <span className={`${classes.networkSeriesLabel} ${classes.txText}`}>TX</span>
                    {this.renderMetricValue(this.formatValue(tx?.lastValue, 'bps'))}
                </div>
            </div>
        )
    }

    private renderTooltipContent(item: TrendDisplayItem) {
        const { classes } = this.props
        if (item.key === 'networkTraffic') {
            const rx = this.seriesByKey(item.series, 'networkRx')
            const tx = this.seriesByKey(item.series, 'networkTx')
            const hasRx = this.hasValues(rx)
            const hasTx = this.hasValues(tx)

            return (
                <div className={classes.tooltipContent}>
                    {hasRx && this.renderNetworkTooltipSection('RX', rx, classes.rxText)}
                    {hasRx && hasTx && <div className={classes.tooltipSectionDivider} />}
                    {hasTx && this.renderNetworkTooltipSection('TX', tx, classes.txText)}
                </div>
            )
        }

        const primary = item.series[0]
        return (
            <div className={classes.tooltipContent}>
                {this.renderTooltipRow('현재', item.value)}
                {this.renderTooltipRow('평균', this.formatValue(this.averageValue(primary), item.unit))}
                {this.renderTooltipRow('최대', this.formatValue(this.maxValue(primary), item.unit))}
            </div>
        )
    }

    private renderNetworkTooltipSection(label: string, series: TrendSeries | undefined, colorClassName: string) {
        const { classes } = this.props
        return (
            <div className={classes.tooltipSection}>
                <div className={`${classes.tooltipSectionTitle} ${colorClassName}`}>{label}</div>
                {this.renderTooltipRow('현재', this.formatValue(series?.lastValue, 'bps'))}
                {this.renderTooltipRow('평균', this.formatValue(this.averageValue(series), 'bps'))}
                {this.renderTooltipRow('최대', this.formatValue(this.maxValue(series), 'bps'))}
            </div>
        )
    }

    private renderTooltipRow(label: string, value: string) {
        const { classes } = this.props
        return (
            <div className={classes.tooltipRow}>
                <span>{label}</span>
                <strong>{value}</strong>
            </div>
        )
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
            return `${Math.round(value)} 회`
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
        const height = 98
        const leftGutter = 78
        const rightPadding = 10
        const topPadding = 8
        const bottomPadding = 24
        const plotLeft = leftGutter
        const plotRight = width - rightPadding
        const plotTop = topPadding
        const plotBottom = height - bottomPadding
        const yLabelX = plotLeft - 12
        const { min, max } = this.pointRange(item.series, item.unit)
        const range = max - min || 1
        const linePaths = item.series.map(series => {
            const valid = (series.values || [])
                .filter(point => typeof point.value === 'number')
                .map(point => ({ ...point, value: this.normalizePointValue(Number(point.value), item.unit) }))
            if (valid.length < 2) return ''
            return valid.map((point, index) => {
                const x = plotLeft + ((plotRight - plotLeft) * index) / Math.max(valid.length - 1, 1)
                const y = plotBottom - ((point.value - min) / range) * (plotBottom - plotTop)
                return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
            }).join(' ')
        })
        const firstLinePath = linePaths[0] || ''
        const fillPath = item.series.length === 1 && firstLinePath ? `${firstLinePath} L ${plotRight} ${plotBottom} L ${plotLeft} ${plotBottom} Z` : ''
        const mid = min + ((max - min) / 2)
        const axisLabels = this.timeAxisLabels(trend?.start, trend?.end)

        if (!linePaths.some(Boolean)) {
            return <div className={classes.empty}>수집된 추이 데이터가 없습니다.</div>
        }

        return (
            <svg className={classes.svg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
                <line className={classes.guide} x1={plotLeft} y1={plotTop} x2={plotRight} y2={plotTop} />
                <line className={classes.guide} x1={plotLeft} y1={(plotTop + plotBottom) / 2} x2={plotRight} y2={(plotTop + plotBottom) / 2} />
                <line className={classes.axis} x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} />
                <line className={classes.axis} x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} />
                <text className={classes.axisLabel} x={yLabelX} y={plotTop + 4} textAnchor="end">{this.formatAxisValue(max, item.unit)}</text>
                <text className={classes.axisLabel} x={yLabelX} y={((plotTop + plotBottom) / 2) + 3} textAnchor="end">{this.formatAxisValue(mid, item.unit)}</text>
                <text className={classes.axisLabel} x={yLabelX} y={plotBottom + 3} textAnchor="end">{this.formatAxisValue(min, item.unit)}</text>
                <text className={classes.timeLabel} x={plotLeft} y={height - 4}>{axisLabels[0]}</text>
                <text className={classes.timeLabel} x={(plotLeft + plotRight) / 2} y={height - 4} textAnchor="middle">{axisLabels[1]}</text>
                <text className={classes.timeLabel} x={plotRight} y={height - 4} textAnchor="end">{axisLabels[2]}</text>
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
                                    {this.renderTrendHeader(item)}
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
