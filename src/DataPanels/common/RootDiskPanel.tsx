import * as React from 'react'
import { Descriptions, Divider, Progress, Space, Spin } from 'antd'
import { HddOutlined, FundProjectionScreenOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { ResourceSectionCard, RESOURCE_PRESENTATION_COLORS } from './ResourcePresentation'
import { DetailSectionIcon } from './DetailSectionIcon'
import { rootDiskResources, formatRootDiskBytes, resourceUsagePercent } from './RootDiskResources'

export interface ResourceUsageDetails {
    cpu?: { percent?: number; capacity?: React.ReactNode }
    memory?: { percent?: number; capacity?: React.ReactNode }
    additional?: Array<{ label: string; value: React.ReactNode }>
}

export const RootDiskPanel = ({ wall, loading, error, vm, usageDetails }: {
    wall?: Parameters<typeof rootDiskResources>[0]; loading: boolean; error?: string; vm: boolean; usageDetails?: ResourceUsageDetails
}) => {
    const disk = rootDiskResources(wall)
    if (disk) return <ResourceSectionCard icon={<DetailSectionIcon role="resources" />} title="리소스 사용 현황">
        <div className="netdive-resource-usage">
            <div className="netdive-resource-usage__metrics">
                {(['cpu', 'memory'] as const).map(key => {
                    const percent = resourceUsagePercent(wall, key, usageDetails?.[key]?.percent)
                    return <div className="netdive-resource-usage__metric" key={key}>
                        <Space className="netdive-resource-usage__label" size={6}>
                            {key === 'cpu' ? <ThunderboltOutlined /> : <FundProjectionScreenOutlined />}{key === 'cpu' ? 'CPU' : '메모리'}
                        </Space>
                        <strong className="netdive-resource-usage__value">{percent === undefined ? '미수집' : `${Number(percent.toFixed(1))}%`}</strong>
                        {percent !== undefined && <Progress percent={Math.min(100, percent)} size="small" showInfo={false} strokeColor={RESOURCE_PRESENTATION_COLORS.primary} />}
                        {usageDetails?.[key]?.capacity && <div className="netdive-resource-usage__label">{usageDetails[key]!.capacity}</div>}
                    </div>
                })}
            </div>
            <Divider />
            <div className="netdive-resource-usage__disk-header">
                <Space size={6}><HddOutlined />루트 디스크 (/)</Space>
                <strong>{disk.percent === undefined ? '사용률 미수집' : `${Number(disk.percent.toFixed(1))}%`}</strong>
            </div>
            {disk.percent !== undefined && <Progress percent={Number(disk.percent.toFixed(1))} size="small" showInfo={false}
                strokeColor={disk.percent >= 90 ? '#ff8a80' : disk.percent >= 75 ? '#ffc36b' : RESOURCE_PRESENTATION_COLORS.primary} />}
            <Descriptions size="small" column={3} layout="vertical" items={[
                { key: 'total', label: '전체 용량', children: formatRootDiskBytes(disk.total) },
                { key: 'used', label: '사용 용량', children: formatRootDiskBytes(disk.used) },
                { key: 'available', label: '가용 용량', children: formatRootDiskBytes(disk.available) }
            ]} />
            {!!usageDetails?.additional?.length && <Descriptions size="small" column={1} items={usageDetails.additional.map((item, key) => ({ key, label: item.label, children: item.value }))} />}
        </div>
    </ResourceSectionCard>
    return <ResourceSectionCard icon={<HddOutlined />} title="루트 디스크 (/)" empty={!disk}>
        {loading ? <Spin size="small" /> : <span style={{ color: 'var(--netdive-detail-muted, #64748b)', fontSize: 12 }}>
            {error ? 'Wall 자원 데이터를 조회하지 못했습니다.' : vm
                ? 'VM의 / 파일시스템 정보가 미수집 상태입니다. Guest Agent와 Wall 수집 상태를 확인하세요.'
                : '호스트의 / 파일시스템 정보가 미수집 상태입니다. Wall 수집 상태를 확인하세요.'}
        </span>}
    </ResourceSectionCard>
}
