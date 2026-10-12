import * as React from 'react'
import { Segmented, Tooltip } from 'antd'
import { InfrastructureVMLayoutMode } from './InfrastructureCompactLayout'
import './InfrastructureVMLayoutControl.css'

export const InfrastructureVMLayoutControl = ({ value, result, onChange }: {
    value: InfrastructureVMLayoutMode
    result?: { twoRowVMs: number; reason: string }
    onChange: (value: InfrastructureVMLayoutMode) => void
}) => <div className="infrastructure-vm-layout">
    <Tooltip title={value === 'compact' && result
        ? result.twoRowVMs ? `사용자 VM ${result.twoRowVMs}개를 두 줄로 배치했습니다.`
            : result.reason === 'connections' ? '연결선 교차가 늘어날 수 있어 기존 한 줄 배치를 유지합니다.'
                : result.reason === 'obstacles' ? '카드와 연결선이 겹치지 않도록 기존 한 줄 배치를 유지합니다.'
                    : '현재 화면에서는 한 줄 배치가 더 적합합니다. VM을 펼치면 다시 계산합니다.'
        : '사용자 VM만 연결 관계와 화면 공간에 따라 최대 두 줄로 배치합니다. 모든 객체와 개별 연결은 유지됩니다.'}>
        <span className="infrastructure-vm-layout__title">VM 배치
            {value === 'compact' && result && <span>{result.twoRowVMs ? '2줄 적용' : '1줄 유지'}</span>}
        </span>
    </Tooltip>
    <Segmented size="small" block aria-label="사용자 VM 배치 방식" value={value}
        options={[{ label: '기존 배치', value: 'linear' }, { label: 'Compact 배치', value: 'compact' }]}
        onChange={mode => onChange(mode as InfrastructureVMLayoutMode)} />
</div>
