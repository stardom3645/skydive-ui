import * as React from 'react'
import { ApartmentOutlined, InfoCircleOutlined } from '@ant-design/icons'

import { Node } from '../Topology'
import { translate } from '../Config'
import {
    switchDisplayName,
    switchLLDPData,
    switchManagementAddress,
    switchTextValue
} from '../SwitchNodeUtils'
import { DetailEmpty, DetailKeyValueList, DetailSection } from './common'
import './SwitchDetailPanel.css'

interface Props {
    node: Node
}

class SwitchDetailPanel extends React.Component<Props> {
    private data(): any {
        return this.props.node.data || {}
    }

    private lldp(): Record<string, any> {
        return switchLLDPData(this.data())
    }

    private basicRows() {
        const data = this.data()
        const lldp = this.lldp()
        const name = switchDisplayName(data, this.props.node.id)
        const managementAddress = switchManagementAddress(data)
        const type = switchTextValue(data, ['Type', 'type']) || 'switch'
        const probe = switchTextValue(data, ['Probe', 'probe'])

        return [
            { key: 'name', label: translate('switchName'), value: name, textValue: name, copyText: name },
            { key: 'managementAddress', label: translate('switchManagementIp'), value: managementAddress || '-', textValue: managementAddress || '-', copyText: managementAddress || undefined },
            { key: 'type', label: translate('switchType'), value: type, textValue: type },
            { key: 'probe', label: translate('switchProbe'), value: probe || '-', textValue: probe || '-' }
        ]
    }

    private lldpRows() {
        const lldp = this.lldp()
        const chassisID = switchTextValue(lldp, ['ChassisID', 'ChassisId', 'Chassis'])
        const chassisIDType = switchTextValue(lldp, ['ChassisIDType', 'ChassisIdType'])
        const description = switchTextValue(lldp, ['Description', 'SystemDescription', 'SysDescription'])
        const managementAddress = switchTextValue(lldp, ['MgmtAddress', 'ManagementAddress', 'MgmtAddr', 'Address'])
        return [
            { key: 'chassisID', label: translate('switchChassisId'), value: chassisID || '-', textValue: chassisID || '-', copyText: chassisID || undefined },
            { key: 'chassisIDType', label: translate('switchChassisIdType'), value: chassisIDType || '-', textValue: chassisIDType || '-' },
            { key: 'description', label: translate('switchSystemDescription'), value: description || '-', textValue: description || '-' },
            { key: 'managementAddress', label: translate('switchManagementAddress'), value: managementAddress || '-', textValue: managementAddress || '-', copyText: managementAddress || undefined }
        ]
    }

    render() {
        return (
            <div className="netdive-switch-detail">
                <DetailSection icon={<InfoCircleOutlined />} title={translate('switchBasicInfo')}>
                    <DetailKeyValueList rows={this.basicRows()} copyTooltip={translate('copy')} />
                </DetailSection>
                <DetailSection icon={<ApartmentOutlined />} title={translate('switchLldpInfo')}>
                    {Object.keys(this.lldp()).length > 0
                        ? <DetailKeyValueList rows={this.lldpRows()} copyTooltip={translate('copy')} />
                        : <DetailEmpty description={translate('switchNoLldp')} compact />}
                </DetailSection>
            </div>
        )
    }
}

export default SwitchDetailPanel
