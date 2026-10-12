import * as React from 'react'
import { Select } from 'antd'
import { ApartmentOutlined } from '@ant-design/icons'
import { MoldNICNetwork } from './MoldTopologyNetworks'
import './MoldNetworkViewControl.css'

export const MoldNetworkViewControl = ({ networks, value, onChange }: {
    networks: MoldNICNetwork[]; value?: string; onChange: (value?: string) => void
}) => <div className="mold-network-view">
    <span className="mold-network-view__title"><ApartmentOutlined /> 네트워크별 보기</span>
    <Select showSearch allowClear value={value || ''} onChange={value => onChange(value || undefined)} placeholder="전체 보기"
        aria-label="Mold 네트워크별 보기" variant="borderless" size="small"
        popupMatchSelectWidth={360} optionFilterProp="searchText"
        notFoundContent="일치하는 Mold 네트워크가 없습니다."
        options={[{ value: '', label: '전체 보기', searchText: '전체 보기', title: '네트워크 강조 해제' }, ...networks.map(network => ({ value: network.networkId!.toLowerCase(),
            label: `${network.networkName || network.networkId}${network.zoneName ? ` · ${network.zoneName}` : ''}`,
            searchText: [network.networkName, network.networkId, network.networkType, network.cidr, network.zoneName, network.vlan].filter(Boolean).join(' '),
            title: [network.networkName, network.networkType, network.cidr, network.zoneName].filter(Boolean).join(' · ') }))]} />
</div>
