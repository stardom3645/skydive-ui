import * as React from 'react'
import { Input, Tooltip } from 'antd'
import { SearchOutlined } from '@ant-design/icons'

import {
    InfrastructurePortConnectionState,
    InfrastructurePortMapping,
    InfrastructurePortMappingSource
} from '../../InfrastructurePortMapping'
import { translate } from '../../Config'
import {
    detailTooltipPopupContainer,
    DetailBadge,
    DetailEmpty,
    DetailStatusIndicator
} from './DetailComponents'
import { DetailTable } from './DetailTable'

export interface InfrastructurePortMappingTableProps {
    mappings: InfrastructurePortMapping[]
    onNavigate?: (mapping: InfrastructurePortMapping) => void
    perspective?: 'switch' | 'host'
}

interface State {
    search: string
}

const connectionPresentation = (state: InfrastructurePortConnectionState) => {
    if (state === 'connected') return { label: translate('switchPortMappingConnected'), tone: 'success' as const }
    if (state === 'disconnected') return { label: translate('switchPortMappingDisconnected'), tone: 'danger' as const }
    return { label: translate('switchPortMappingUnknown'), tone: 'default' as const }
}

const sourcePresentation = (source: InfrastructurePortMappingSource) => {
    if (source === 'manual') return { label: translate('switchPortMappingManual'), tone: 'info' as const }
    if (source === 'mismatch') return { label: translate('switchPortMappingMismatch'), tone: 'warning' as const }
    return { label: translate('switchPortMappingAutomatic'), tone: 'default' as const }
}

const compareMappingField = (field: keyof InfrastructurePortMapping) => (
    left: InfrastructurePortMapping,
    right: InfrastructurePortMapping
) => String(left[field] || '').localeCompare(String(right[field] || ''), undefined, {
    numeric: true,
    sensitivity: 'base'
})

const singleLineValue = (value: string, fallback?: string) => {
    const displayValue = value || fallback || ''
    if (displayValue.length <= 8) {
        return <Tooltip
            title={displayValue}
            placement="top"
            overlayClassName="netdive-detail-table-value-tooltip"
            getPopupContainer={detailTooltipPopupContainer}
            autoAdjustOverflow>
            <span className="netdive-detail-search-table__nowrap-value">{displayValue}</span>
        </Tooltip>
    }
    const tailLength = Math.min(8, Math.max(4, Math.ceil(displayValue.length * 0.3)))
    const head = displayValue.slice(0, -tailLength)
    const tail = displayValue.slice(-tailLength)
    return <Tooltip
        title={displayValue}
        placement="top"
        overlayClassName="netdive-detail-table-value-tooltip"
        getPopupContainer={detailTooltipPopupContainer}
        autoAdjustOverflow>
        <span className="netdive-detail-search-table__middle-value">
            <span className="netdive-detail-search-table__middle-head">{head}</span>
            <span className="netdive-detail-search-table__middle-tail">{tail}</span>
        </span>
    </Tooltip>
}

/** Shared searchable relationship table. Its normalized source field allows a
 * future manual/mismatch provider without changing the Switch detail layout. */
export class InfrastructurePortMappingTable extends React.PureComponent<InfrastructurePortMappingTableProps, State> {
    state: State = { search: '' }

    private filteredMappings(): InfrastructurePortMapping[] {
        const query = this.state.search.trim().toLowerCase()
        if (!query) return this.props.mappings
        return this.props.mappings.filter(mapping => [
            mapping.switchPortName,
            mapping.switchName,
            mapping.hostName,
            mapping.hostNicName,
            (mapping as any).bondInterfaceName
        ].some(value => String(value || '').toLowerCase().includes(query)))
    }

    render() {
        const hostPerspective = this.props.perspective === 'host'
        if (this.props.mappings.length === 0) {
            return <DetailEmpty description={translate(hostPerspective ? 'hostSwitchPortConnectionsEmpty' : 'switchPortMappingEmpty')} compact />
        }

        const mappings = this.filteredMappings()
        const switchColumns = [
            {
                title: translate('switchPortMappingPort'),
                dataIndex: 'switchPortName',
                key: 'switchPortName',
                width: '20%',
                sorter: compareMappingField('switchPortName'),
                render: (value: string) => <strong className="netdive-detail-search-table__primary">{value}</strong>
            },
            {
                title: translate('switchPortMappingHost'),
                dataIndex: 'hostName',
                key: 'hostName',
                width: '25%',
                sorter: compareMappingField('hostName'),
                className: 'netdive-detail-search-table__nowrap',
                render: (value: string) => singleLineValue(value)
            },
            {
                title: translate('switchPortMappingNic'),
                dataIndex: 'hostNicName',
                key: 'hostNicName',
                width: '24%',
                sorter: compareMappingField('hostNicName'),
                className: 'netdive-detail-search-table__nowrap',
                render: (value: string) => singleLineValue(value, translate('switchPortMappingUncollected'))
            },
            {
                title: translate('switchPortMappingState'),
                dataIndex: 'connectionState',
                key: 'connectionState',
                width: '16%',
                sorter: compareMappingField('connectionState'),
                className: 'netdive-detail-search-table__fixed-column',
                render: (value: InfrastructurePortConnectionState) => {
                    const status = connectionPresentation(value)
                    return <DetailStatusIndicator tone={status.tone} variant="table">{status.label}</DetailStatusIndicator>
                }
            },
            {
                title: translate('switchPortMappingSource'),
                dataIndex: 'source',
                key: 'source',
                width: '15%',
                sorter: compareMappingField('source'),
                className: 'netdive-detail-search-table__fixed-column',
                render: (value: InfrastructurePortMappingSource) => {
                    const source = sourcePresentation(value)
                    return <DetailBadge tone={source.tone}>{source.label}</DetailBadge>
                }
            }
        ]
        const hostColumns = [
            {
                title: translate('switchPortMappingNic'),
                dataIndex: 'hostNicName',
                key: 'hostNicName',
                width: '30%',
                sorter: compareMappingField('hostNicName'),
                className: 'netdive-detail-search-table__nowrap',
                render: (value: string, mapping: InfrastructurePortMapping) => <div className="netdive-detail-search-table__stacked-cell">
                    <strong className="netdive-detail-search-table__primary">
                        {singleLineValue(value, translate('switchPortMappingUncollected'))}
                    </strong>
                    <span className="netdive-detail-search-table__stacked-secondary">
                        <span className="netdive-detail-search-table__stacked-label">{translate('hostSwitchPortBondInterface')}</span>
                        <span className="netdive-detail-search-table__stacked-value">
                            {singleLineValue((mapping as any).bondInterfaceName, translate('hostSwitchPortNoBond'))}
                        </span>
                    </span>
                </div>
            },
            {
                title: translate('hostSwitchPortConnectedSwitch'),
                dataIndex: 'switchName',
                key: 'switchName',
                width: '36%',
                sorter: compareMappingField('switchName'),
                className: 'netdive-detail-search-table__nowrap',
                render: (value: string, mapping: InfrastructurePortMapping) => <div className="netdive-detail-search-table__stacked-cell">
                    <strong className="netdive-detail-search-table__primary">
                        {singleLineValue(value, translate('switchPortMappingUncollected'))}
                    </strong>
                    <span className="netdive-detail-search-table__stacked-secondary">
                        <span className="netdive-detail-search-table__stacked-label">{translate('switchPortMappingPort')}</span>
                        <span className="netdive-detail-search-table__stacked-value">
                            {singleLineValue(mapping.switchPortName, translate('switchPortMappingUncollected'))}
                        </span>
                    </span>
                </div>
            },
            {
                title: translate('switchPortMappingState'),
                dataIndex: 'connectionState',
                key: 'connectionState',
                width: '18%',
                sorter: compareMappingField('connectionState'),
                className: 'netdive-detail-search-table__fixed-column',
                render: (value: InfrastructurePortConnectionState) => {
                    const status = connectionPresentation(value)
                    return <DetailStatusIndicator tone={status.tone} variant="table">{status.label}</DetailStatusIndicator>
                }
            },
            {
                title: translate('switchPortMappingSource'),
                dataIndex: 'source',
                key: 'source',
                width: '16%',
                sorter: compareMappingField('source'),
                className: 'netdive-detail-search-table__fixed-column',
                render: (value: InfrastructurePortMappingSource) => {
                    const source = sourcePresentation(value)
                    return <DetailBadge tone={source.tone}>{source.label}</DetailBadge>
                }
            }
        ]
        const columns = hostPerspective ? hostColumns : switchColumns

        return <div className="netdive-detail-search-table">
            <div className="netdive-detail-search-table__toolbar">
                <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder={translate(hostPerspective ? 'hostSwitchPortConnectionsSearch' : 'switchPortMappingSearch')}
                    value={this.state.search}
                    onChange={event => this.setState({ search: event.target.value })} />
            </div>
            {mappings.length === 0
                ? <DetailEmpty description={translate(hostPerspective ? 'hostSwitchPortConnectionsNoSearchResults' : 'switchPortMappingNoSearchResults')} compact />
                : <div className="netdive-detail-table-scroll">
                    <DetailTable<InfrastructurePortMapping>
                        className="netdive-detail-search-table__table"
                        columns={columns}
                        dataSource={mappings}
                        rowKey="key"
                        onRow={mapping => this.props.onNavigate ? ({
                            className: 'is-interactive',
                            tabIndex: 0,
                            onClick: () => this.props.onNavigate!(mapping),
                            onKeyDown: event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    this.props.onNavigate!(mapping)
                                }
                            }
                        }) : ({})} />
                </div>}
        </div>
    }
}

export default InfrastructurePortMappingTable
