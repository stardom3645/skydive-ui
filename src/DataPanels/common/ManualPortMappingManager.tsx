import * as React from 'react'
import { Alert, Badge, Button, Dropdown, Input, Menu, Modal, Popconfirm, Select, Space, Table, Tooltip } from 'antd'
import { DownOutlined, DeleteOutlined, EditOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons'

import { translate } from '../../Config'
import {
	InfrastructurePortMapping,
	infrastructurePortConnectionState,
	isManualPortMappingNICEligible,
	manualPortNameConflict,
	ManualPortMappingRecord
} from '../../InfrastructurePortMapping'
import {
	createManualPortMapping,
	disableManualPortMapping,
	updateManualPortMapping
} from '../../ManualPortMappingAPI'
import { session } from '../../Store'
import { Node } from '../../Topology'

interface Props {
	switchNode: Node
	nodes: Node[]
	automaticMappings: InfrastructurePortMapping[]
	mappings: ManualPortMappingRecord[]
	allMappings: ManualPortMappingRecord[]
	session?: session
	onChanged: () => Promise<void> | void
}

interface State {
	visible: boolean
	view: 'form' | 'list'
	switchPortName: string
	selectedNICID: string
	editingID?: number
	saving: boolean
	error?: string
}

const nodeType = (node?: Node): string => String(node?.data?.Type || node?.data?.type || '').trim().toLowerCase()
const nodeName = (node?: Node): string => String(node?.data?.Name || node?.data?.name || node?.id || '').trim()

const ancestorOfType = (node: Node | undefined, type: string): Node | undefined => {
	let current = node
	while (current) {
		if (nodeType(current) === type) return current
		current = current.parent || undefined
	}
	return undefined
}

export class ManualPortMappingManager extends React.PureComponent<Props, State> {
	state: State = {
		visible: false,
		view: 'form',
		switchPortName: '',
		selectedNICID: '',
		saving: false
	}

	private hostNICs(): Array<{ node: Node, host: Node }> {
		return this.props.nodes
			.filter(isManualPortMappingNICEligible)
			.map(node => ({ node, host: ancestorOfType(node, 'host') }))
			.filter((item): item is { node: Node, host: Node } => !!item.host)
			.sort((left, right) => {
				const hostOrder = nodeName(left.host).localeCompare(nodeName(right.host), undefined, { numeric: true })
				return hostOrder || nodeName(left.node).localeCompare(nodeName(right.node), undefined, { numeric: true })
			})
	}

	private automaticallyConnectedNICs(): Set<string> {
		return new Set(this.props.automaticMappings
			.map(mapping => mapping.hostNicNodeID)
			.filter((nodeID): nodeID is string => !!nodeID))
	}

	private resetForm = () => this.setState({ switchPortName: '', selectedNICID: '', editingID: undefined, error: undefined })

	private openAdd = () => this.setState({
		visible: true,
		view: 'form',
		switchPortName: '',
		selectedNICID: '',
		editingID: undefined,
		error: undefined
	})

	private openList = () => this.setState({
		visible: true,
		view: 'list',
		switchPortName: '',
		selectedNICID: '',
		editingID: undefined,
		error: undefined
	})

	private close = () => this.setState({ visible: false, error: undefined }, this.resetForm)

	private edit = (mapping: ManualPortMappingRecord) => this.setState({
		visible: true,
		view: 'form',
		switchPortName: mapping.switchPortName,
		selectedNICID: mapping.hostNicNodeId,
		editingID: mapping.id,
		error: undefined
	})

	private save = async () => {
		const switchPortName = this.state.switchPortName.trim()
		const nic = this.hostNICs().find(item => item.node.id === this.state.selectedNICID)
		if (!switchPortName) {
			this.setState({ error: translate('manualPortMappingPortRequired') })
			return
		}
		if (!nic) {
			this.setState({ error: translate('manualPortMappingSelectionRequired') })
			return
		}
		if (this.automaticallyConnectedNICs().has(nic.node.id)) {
			this.setState({ error: translate('manualPortMappingNICAutomaticConflict') })
			return
		}
		if (this.props.allMappings.some(mapping => mapping.id !== this.state.editingID && mapping.hostNicNodeId === nic.node.id)) {
			this.setState({ error: translate('manualPortMappingNICDuplicate') })
			return
		}
		const conflict = manualPortNameConflict(
			this.props.switchNode.id,
			switchPortName,
			this.props.automaticMappings,
			this.props.mappings,
			this.state.editingID
		)
		if (conflict) {
			this.setState({ error: translate(conflict === 'automatic'
				? 'manualPortMappingAutomaticConflict'
				: 'manualPortMappingDuplicate') })
			return
		}
		this.setState({ saving: true, error: undefined })
		const input = {
			switchNodeId: this.props.switchNode.id,
			switchPortName,
			hostNodeId: nic.host.id,
			hostNicNodeId: nic.node.id,
			enabled: true
		}
		try {
			if (this.state.editingID) {
				await updateManualPortMapping(this.props.session, this.state.editingID, input)
			} else {
				await createManualPortMapping(this.props.session, input)
			}
			await this.props.onChanged()
			this.setState({ saving: false, view: 'list' }, this.resetForm)
		} catch (error) {
			this.setState({ saving: false, error: error instanceof Error ? error.message : String(error) })
		}
	}

	private disable = async (mapping: ManualPortMappingRecord) => {
		this.setState({ saving: true, error: undefined })
		try {
			await disableManualPortMapping(this.props.session, mapping.id)
			await this.props.onChanged()
			const editingDeleted = this.state.editingID === mapping.id
			this.setState({ saving: false, view: editingDeleted ? 'list' : this.state.view }, editingDeleted ? this.resetForm : undefined)
		} catch (error) {
			this.setState({ saving: false, error: error instanceof Error ? error.message : String(error) })
		}
	}

	render() {
		const editing = this.state.editingID !== undefined
		const assignedNICs = new Set(this.props.allMappings.filter(item => item.id !== this.state.editingID).map(item => item.hostNicNodeId))
		const automaticallyConnectedNICs = this.automaticallyConnectedNICs()
		const hostNICs = this.hostNICs()
		const availableNICs = hostNICs.filter(item =>
			!assignedNICs.has(item.node.id) && !automaticallyConnectedNICs.has(item.node.id))
			.sort((left, right) => {
				const stateRank = { connected: 0, disconnected: 1, unknown: 2 }
				return stateRank[infrastructurePortConnectionState(left.node)] - stateRank[infrastructurePortConnectionState(right.node)]
			})
		const unavailableNICs = hostNICs.filter(item =>
			assignedNICs.has(item.node.id) || automaticallyConnectedNICs.has(item.node.id))
		const managementMenu = <Menu onClick={event => event.key === 'add' ? this.openAdd() : this.openList()}>
			<Menu.Item key="add" icon={<PlusOutlined />}>{translate('manualPortMappingMenuAdd')}</Menu.Item>
			<Menu.Item key="list" icon={<UnorderedListOutlined />}>{translate('manualPortMappingMenuList')}</Menu.Item>
		</Menu>
		const columns = [
			{ title: translate('switchPortMappingPort'), dataIndex: 'switchPortName', key: 'port' },
			{ title: translate('switchPortMappingHost'), dataIndex: 'hostName', key: 'host' },
			{ title: translate('switchPortMappingNic'), dataIndex: 'hostNicName', key: 'nic' },
			{
				title: translate('manualPortMappingActions'), key: 'actions', width: 86,
				render: (_: any, mapping: ManualPortMappingRecord) => <Space size={2}>
					<Button type="text" size="small" icon={<EditOutlined />} aria-label={translate('manualPortMappingEdit')} onClick={() => this.edit(mapping)} />
					<Popconfirm title={translate('manualPortMappingDeleteConfirm')} onConfirm={() => this.disable(mapping)}>
						<Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={translate('manualPortMappingDelete')} />
					</Popconfirm>
				</Space>
			}
		]

		return <React.Fragment>
			<Dropdown
				overlay={managementMenu}
				overlayClassName="netdive-manual-port-mapping-dropdown"
				placement="bottomRight"
				trigger={['click']}>
				<Button className="netdive-manual-port-mapping-trigger" onClick={event => event.preventDefault()}>
					<PlusOutlined />
					<span>{translate('manualPortMappingManage')}</span>
					<DownOutlined className="netdive-manual-port-mapping-trigger__chevron" />
				</Button>
			</Dropdown>
			<Modal
				visible={this.state.visible}
				wrapClassName="netdive-manual-port-mapping-modal"
				title={translate(this.state.view === 'list'
					? 'manualPortMappingMenuList'
					: editing
						? 'manualPortMappingEdit'
						: 'manualPortMappingMenuAdd')}
				width={720}
				footer={null}
				destroyOnClose
				onCancel={this.close}>
				<div className="netdive-manual-port-mapping-manager">
					{this.state.error && <Alert type="error" showIcon message={this.state.error} />}
					{this.state.view === 'form' ? <React.Fragment>
						<Alert type="info" showIcon message={translate('manualPortMappingGuidance')} />
						<div className="netdive-manual-port-mapping-manager__form">
						<label>
							<span>{translate('switchPortMappingPort')}</span>
							<Input
								maxLength={255}
								placeholder={translate('manualPortMappingSelectPort')}
								value={this.state.switchPortName}
								onChange={event => this.setState({ switchPortName: event.target.value, error: undefined })}
								onBlur={() => this.setState(state => ({ switchPortName: state.switchPortName.trim() }))} />
						</label>
						<label>
							<span>{translate('switchPortMappingNic')}</span>
							<Select
								showSearch
								dropdownClassName="netdive-manual-port-mapping-nic-dropdown"
								filterOption={(input, option) => String(option?.title || '').toLowerCase().includes(input.trim().toLowerCase())}
								placeholder={translate('manualPortMappingSelectNic')}
								notFoundContent={translate('manualPortMappingNoNicSearchResults')}
								value={this.state.selectedNICID || undefined}
								onChange={(value: string) => this.setState({ selectedNICID: value, error: undefined })}>
								<Select.OptGroup label={translate('manualPortMappingAvailableNics')}>
									{availableNICs.length > 0
										? availableNICs.map(item => {
											const state = infrastructurePortConnectionState(item.node)
											const stateLabel = translate(state === 'connected'
												? 'manualPortMappingNicUp'
												: state === 'disconnected'
													? 'manualPortMappingNicDown'
													: 'manualPortMappingNicUnknown')
											const statusBadge = <Badge
												status={state === 'connected' ? 'success' : state === 'disconnected' ? 'warning' : 'default'}
												text={stateLabel} />
											return <Select.Option
												key={item.node.id}
												value={item.node.id}
												title={`${nodeName(item.host)} / ${nodeName(item.node)} ${stateLabel}`}>
												<span className="netdive-manual-port-mapping-manager__nic-option">
													<span>{nodeName(item.host)} / {nodeName(item.node)}</span>
													{state === 'disconnected'
														? <Tooltip title={translate('manualPortMappingNicDownHelp')} placement="right">{statusBadge}</Tooltip>
														: statusBadge}
												</span>
											</Select.Option>
										})
										: <Select.Option key="no-available-nic" value="__no_available_nic__" disabled>{translate('manualPortMappingNoAvailableNic')}</Select.Option>}
								</Select.OptGroup>
								{unavailableNICs.length > 0 && <Select.OptGroup label={translate('manualPortMappingUnavailableNics')}>
									{unavailableNICs.map(item => <Select.Option key={item.node.id} value={item.node.id} disabled>
										{nodeName(item.host)} / {nodeName(item.node)} ({translate(automaticallyConnectedNICs.has(item.node.id)
											? 'manualPortMappingNicAutoInUse'
											: 'manualPortMappingNicManualInUse')})
									</Select.Option>)}
								</Select.OptGroup>}
							</Select>
						</label>
						<div className="netdive-manual-port-mapping-manager__form-actions">
							{editing && <Button size="small" onClick={this.openList}>{translate('manualPortMappingCancelEdit')}</Button>}
							<Button
								className="netdive-manual-port-mapping-manager__submit"
								type="primary"
								loading={this.state.saving}
								onClick={this.save}>
								{translate(editing ? 'manualPortMappingUpdate' : 'manualPortMappingAdd')}
							</Button>
						</div>
						</div>
					</React.Fragment> : <Table<ManualPortMappingRecord>
						size="small"
						pagination={false}
						rowKey="id"
						columns={columns}
						dataSource={this.props.mappings}
						locale={{ emptyText: translate('manualPortMappingEmpty') }} />}
				</div>
			</Modal>
		</React.Fragment>
	}
}

export default ManualPortMappingManager
