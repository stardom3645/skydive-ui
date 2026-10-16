import * as React from 'react'
import { Progress, Space } from 'antd'
import { FundProjectionScreenOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { RESOURCE_PRESENTATION_COLORS } from './ResourcePresentation'

export interface ResourceUsageMetric {
    percent?: number
    value?: React.ReactNode
    capacity?: React.ReactNode
    strokeColor?: string
}

// Shared by VM and Kubernetes Node resource summaries. Inventory capacity stays
// auxiliary; a missing measurement never becomes a zero-percent progress bar.
export const ResourceUsageMetrics = ({ cpu, memory }: { cpu?: ResourceUsageMetric; memory?: ResourceUsageMetric }) => (
    <div className="netdive-resource-usage__metrics">
        {(['cpu', 'memory'] as const).map(key => {
            const metric = (key === 'cpu' ? cpu : memory) || {}
            const percent = metric.percent
            return <div className="netdive-resource-usage__metric" key={key}>
                <Space className="netdive-resource-usage__label" size={6}>
                    {key === 'cpu' ? <ThunderboltOutlined /> : <FundProjectionScreenOutlined />}{key === 'cpu' ? 'CPU' : '메모리'}
                </Space>
                <strong className="netdive-resource-usage__value">{metric.value ?? (percent === undefined ? '미수집' : `${Number(percent.toFixed(1))}%`)}</strong>
                {percent !== undefined && <Progress percent={Math.min(100, percent)} size="small" showInfo={false}
                    strokeColor={metric.strokeColor || RESOURCE_PRESENTATION_COLORS.primary} />}
                {metric.capacity && <div className="netdive-resource-usage__label">{metric.capacity}</div>}
            </div>
        })}
    </div>
)
