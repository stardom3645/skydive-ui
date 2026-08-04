import * as React from 'react'
import { Progress, Table, Tooltip, Typography } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

import { DetailCopyButton } from './DetailComponents'
import {
    cpuBasisRatios,
    formatPodCpuUsage,
    formatPodMemoryUsage,
    memoryBasisRatios,
    progressPercent,
    relativePodUsagePercent
} from './KubernetesPodUsageMetrics'
import './KubernetesPodUsageTable.css'

export type KubernetesPodUsageMetric = 'cpu' | 'memory'

export interface KubernetesPodUsageTableItem {
    namespace: string
    name: string
    nodeName: string
    usageCpuCores: number
    usageMemoryBytes: number
    requestCpuCores?: number
    limitCpuCores?: number
    requestMemoryBytes?: number
    limitMemoryBytes?: number
    nodeAllocatableCpuCores?: number
    nodeAllocatableMemoryBytes?: number
}

export interface KubernetesPodUsageTableProps {
    metric: KubernetesPodUsageMetric
    items: KubernetesPodUsageTableItem[]
    onRowClick?: (item: KubernetesPodUsageTableItem) => void
    onPodClick?: (item: KubernetesPodUsageTableItem) => void
}

export interface KubernetesModalResourceCellProps {
    namespace?: string
    name: string
    resourceType?: string
    copyLabel?: string
    onClick?: () => void
}

const preferredBreaks = (value: string) => String(value || '').split(/([/-])/).map((part, index) =>
    <React.Fragment key={`${part}-${index}`}>
        {part}
        {(part === '/' || part === '-') && <wbr />}
    </React.Fragment>
)

const trimNumber = (value: number, digits = 2) =>
    value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0$/, '$1')

export const KubernetesModalResourceCell = ({
    namespace,
    name,
    resourceType,
    copyLabel = '리소스 이름 복사',
    onClick
}: KubernetesModalResourceCellProps) => {
    const context = [resourceType, namespace].filter(Boolean).join(' · ')
    const fullName = namespace ? `${namespace}/${name}` : name
    return <span className="netdive-k8s-pod-usage-table__resource">
        {context && <Typography.Text type="secondary" className="netdive-k8s-pod-usage-table__namespace">
            {preferredBreaks(context)}
        </Typography.Text>}
        <span className="netdive-k8s-pod-usage-table__name-row">
            <Tooltip title={fullName}>
                <button type="button" onClick={event => {
                    event.stopPropagation()
                    if (onClick) onClick()
                }}>
                    {preferredBreaks(name)}
                </button>
            </Tooltip>
            <DetailCopyButton value={name} tooltip={copyLabel} />
        </span>
    </span>
}

const usageValue = (item: KubernetesPodUsageTableItem, metric: KubernetesPodUsageMetric) =>
    metric === 'memory'
        ? formatPodMemoryUsage(item.usageMemoryBytes)
        : formatPodCpuUsage(item.usageCpuCores)

const cpuBasisText = (item: KubernetesPodUsageTableItem): React.ReactNode => {
    const ratios = cpuBasisRatios(item.usageCpuCores, item.requestCpuCores, item.limitCpuCores)
    const request = ratios.requestPercent === undefined
        ? 'Request 미설정'
        : `Request 대비 ${trimNumber(ratios.requestPercent, 1)}%`
    const limit = ratios.limitPercent === undefined
        ? 'Limit 미설정'
        : `Limit 대비 ${trimNumber(ratios.limitPercent, 1)}%`
    if (ratios.requestPercent === undefined && ratios.limitPercent === undefined) {
        return <span>Request/Limit 미설정</span>
    }
    return <React.Fragment><span>{request}</span><span>{limit}</span></React.Fragment>
}

const memoryBasisText = (item: KubernetesPodUsageTableItem): React.ReactNode => {
    const ratios = memoryBasisRatios(item.usageMemoryBytes, item.requestMemoryBytes, item.limitMemoryBytes)
    const request = ratios.requestPercent === undefined
        ? 'Request 미설정'
        : `Request 대비 ${trimNumber(ratios.requestPercent, 1)}%`
    const limit = ratios.limitPercent === undefined
        ? 'Limit 미설정'
        : `Limit 대비 ${trimNumber(ratios.limitPercent, 1)}%`
    if (ratios.requestPercent === undefined && ratios.limitPercent === undefined) {
        return <span>Request/Limit 미설정</span>
    }
    return <React.Fragment><span>{request}</span><span>{limit}</span></React.Fragment>
}

export const KubernetesPodUsageTable = ({
    metric,
    items,
    onRowClick,
    onPodClick
}: KubernetesPodUsageTableProps) => {
    const maximumUsage = items.reduce((maximum, item) =>
        Math.max(maximum, metric === 'memory' ? item.usageMemoryBytes : item.usageCpuCores), 0)

    return <Table<KubernetesPodUsageTableItem>
        size="small"
        pagination={false}
        tableLayout="fixed"
        rowKey={item => `${item.namespace}/${item.name}`}
        dataSource={items}
        className="netdive-k8s-pod-usage-table netdive-modal-table"
        onRow={item => ({
            onClick: () => onRowClick && onRowClick(item)
        })}
        columns={[
            {
                title: 'Pod',
                key: 'pod',
                width: '56%',
                render: (_value, item) => {
                    return <KubernetesModalResourceCell
                        namespace={item.namespace || 'default'}
                        name={item.name}
                        copyLabel="Pod 이름 복사"
                        onClick={() => onPodClick && onPodClick(item)}
                    />
                }
            },
            {
                title: metric === 'cpu'
                    ? <span className="netdive-k8s-pod-usage-table__usage-title">
                        <span>사용량</span>
                        <Tooltip title="mCore는 Core의 1/1000 단위이며 1000 mCore = 1 Core">
                            <InfoCircleOutlined aria-label="CPU 단위 설명" />
                        </Tooltip>
                    </span>
                    : '사용량',
                key: 'usage',
                width: '18%',
                render: (_value, item) => {
                    const relativePercent = relativePodUsagePercent(
                        metric === 'memory' ? item.usageMemoryBytes : item.usageCpuCores,
                        maximumUsage
                    )
                    const memoryRatios = memoryBasisRatios(
                        item.usageMemoryBytes,
                        item.requestMemoryBytes,
                        item.limitMemoryBytes
                    )
                    const memoryComparisonPercent = memoryRatios.limitPercent !== undefined
                        ? memoryRatios.limitPercent
                        : memoryRatios.requestPercent !== undefined
                            ? memoryRatios.requestPercent
                            : relativePercent
                    const memoryComparisonLabel = memoryRatios.limitPercent !== undefined
                        ? `Limit 기준 ${trimNumber(memoryComparisonPercent, 1)}%`
                        : memoryRatios.requestPercent !== undefined
                            ? `Request 기준 ${trimNumber(memoryComparisonPercent, 1)}%`
                            : `상대 비교 ${trimNumber(memoryComparisonPercent, 1)}%`
                    const memoryComparisonTooltip = memoryRatios.limitPercent !== undefined
                        ? 'Memory Limit 대비 현재 사용량'
                        : memoryRatios.requestPercent !== undefined
                            ? 'Memory Request 대비 현재 사용량'
                            : '현재 목록의 최대 사용량 기준 상대 비교값'
                    return <span className="netdive-k8s-pod-usage-table__usage">
                        <strong>{usageValue(item, metric)}</strong>
                        {metric === 'cpu'
                            ? <React.Fragment>
                                <Tooltip title="현재 목록의 최대 사용량 기준 상대 비교값">
                                    <span className="netdive-k8s-pod-usage-table__relative">
                                        <small>상대 비교 {trimNumber(relativePercent, 1)}%</small>
                                        <Progress
                                            size="small"
                                            showInfo={false}
                                            percent={progressPercent(relativePercent)}
                                            strokeColor="#1677ff"
                                        />
                                    </span>
                                </Tooltip>
                                <small className="netdive-k8s-pod-usage-table__basis">{cpuBasisText(item)}</small>
                            </React.Fragment>
                            : <React.Fragment>
                                <Tooltip title={memoryComparisonTooltip}>
                                    <span className="netdive-k8s-pod-usage-table__relative">
                                        <small>{memoryComparisonLabel}</small>
                                        <Progress
                                            size="small"
                                            showInfo={false}
                                            percent={progressPercent(memoryComparisonPercent)}
                                            strokeColor="#1677ff"
                                        />
                                    </span>
                                </Tooltip>
                                <small className="netdive-k8s-pod-usage-table__basis">{memoryBasisText(item)}</small>
                            </React.Fragment>}
                    </span>
                }
            },
            {
                title: 'Node',
                key: 'node',
                width: '26%',
                render: (_value, item) => <span className="netdive-k8s-pod-usage-table__node">
                    <Tooltip title={item.nodeName || '없음'}>
                        <span>{preferredBreaks(item.nodeName || '없음')}</span>
                    </Tooltip>
                    {item.nodeName && <DetailCopyButton value={item.nodeName} tooltip="Node 이름 복사" />}
                </span>
            }
        ]}
    />
}
