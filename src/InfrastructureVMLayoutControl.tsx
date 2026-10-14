import * as React from 'react'
import { Checkbox, Segmented, Tooltip } from 'antd'
import { InfrastructureVMLayoutMode } from './InfrastructureCompactLayout'
import './InfrastructureVMLayoutControl.css'

export const InfrastructureVMLayoutControl = ({ value, result, onChange, embedded = false, inline = false }: {
    value: InfrastructureVMLayoutMode
    result?: { wrappedVMs: number; rowCount: number; reason: string }
    onChange: (value: InfrastructureVMLayoutMode) => void
    embedded?: boolean
    inline?: boolean
}) => <div className={`infrastructure-vm-layout${inline ? ' is-inline' : embedded ? ' is-embedded' : ''}`}>
    <Tooltip placement={inline ? 'left' : 'bottom'} autoAdjustOverflow trigger={['hover', 'focus']}
        getPopupContainer={() => document.body} classNames={{ root: 'netdive-view-option-tooltip' }} title={value === 'compact' && result
        ? result.wrappedVMs ? `사용자 VM ${result.wrappedVMs}개를 최대 ${result.rowCount}줄로 배치했습니다.`
            : result.reason === 'connections' ? '연결선 교차가 늘어날 수 있어 기존 한 줄 배치를 유지합니다.'
                : result.reason === 'obstacles' ? '카드와 연결선이 겹치지 않도록 기존 한 줄 배치를 유지합니다.'
                    : '현재 화면에서는 한 줄 배치가 더 적합합니다. VM을 펼치면 다시 계산합니다.'
        : '사용자 VM과 하위 NIC 너비에 따라 한 줄에 최대 8개씩 배치하고, 필요한 만큼 아래 행으로 이어집니다. 모든 객체와 개별 연결은 유지됩니다.'}>
        <span className="infrastructure-vm-layout__title">{inline ? <Checkbox checked={value === 'compact'}
            onChange={event => onChange(event.target.checked ? 'compact' : 'linear')}>가상머신 배치 최적화</Checkbox> : 'VM 배치'}
            {!inline && value === 'compact' && result && <span>{result.wrappedVMs ? `${result.rowCount}줄 적용` : '1줄 유지'}</span>}
        </span>
    </Tooltip>
    {!inline && <Segmented size="small" block aria-label="사용자 VM 배치 방식" value={value}
        options={[{ label: '기존 배치', value: 'linear' }, { label: 'Compact 배치', value: 'compact' }]}
        onChange={mode => onChange(mode as InfrastructureVMLayoutMode)} />}
</div>
