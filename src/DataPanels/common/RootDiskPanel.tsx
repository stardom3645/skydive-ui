import * as React from 'react'
import { Descriptions, Progress, Spin } from 'antd'
import { HddOutlined } from '@ant-design/icons'
import { ResourceSectionCard } from './ResourcePresentation'
import { rootDiskResources, formatRootDiskBytes } from './RootDiskResources'

export const RootDiskPanel = ({ wall, loading, error, vm }: {
    wall?: Parameters<typeof rootDiskResources>[0]; loading: boolean; error?: string; vm: boolean
}) => {
    const disk = rootDiskResources(wall)
    return <ResourceSectionCard icon={<HddOutlined />} title="루트 디스크 (/)" empty={!disk}>
        {disk ? <>
            <Descriptions size="small" column={3} layout="vertical" items={[
                { key: 'total', label: '전체 용량', children: formatRootDiskBytes(disk.total) },
                { key: 'used', label: '사용 용량', children: formatRootDiskBytes(disk.used) },
                { key: 'available', label: '가용 용량', children: formatRootDiskBytes(disk.available) }
            ]} />
            {disk.percent !== undefined && <Progress percent={Number(disk.percent.toFixed(1))}
                strokeColor={disk.percent >= 90 ? '#ff8a80' : disk.percent >= 75 ? '#ffc36b' : '#5795ff'}
                format={percent => `사용 ${percent}%`} />}
        </> : loading ? <Spin size="small" /> : <span style={{ color: 'var(--netdive-detail-muted, #64748b)', fontSize: 12 }}>
            {error ? 'Wall 자원 데이터를 조회하지 못했습니다.' : vm
                ? 'VM의 / 파일시스템 정보가 미수집 상태입니다. Guest Agent와 Wall 수집 상태를 확인하세요.'
                : '호스트의 / 파일시스템 정보가 미수집 상태입니다. Wall 수집 상태를 확인하세요.'}
        </span>}
    </ResourceSectionCard>
}
