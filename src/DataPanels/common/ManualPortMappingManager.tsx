import * as React from 'react'
import { Alert, AutoComplete, Badge, Button, Checkbox, Collapse, Dropdown, Input, Menu, Modal, Popconfirm, Select, Space, Table, Tooltip, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, InfoCircleOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons'

import { translate } from '../../Config'
import {
	InfrastructurePortMapping,
	buildManualPortMappingCandidates,
	infrastructurePortConnectionState,
	isManualPortMappingNICEligible,
	manualPortNameConflict,
	manualPortNameSuggestions,
	ManualPortMappingRecord
} from '../../InfrastructurePortMapping'
import {
	createManualPortMapping,
	listManualPortMappings,
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
	candidateSearch: string
	candidateShowInactive: boolean
	refreshing: boolean
	candidateMappings?: ManualPortMappingRecord[]
	portNameEdited: boolean
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
	private candidateRequestID = 0
	componentWillUnmount() { this.candidateRequestID += 1 }
	state: State = {
		visible: false,
		view: 'form',
		switchPortName: '',
		selectedNICID: '',
		saving: false,
		candidateSearch: '',
		candidateShowInactive: false,
		refreshing: false,
		portNameEdited: false
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

	private resetForm = () => this.setState({ switchPortName: '', selectedNICID: '', editingID: undefined, error: undefined, candidateSearch: '', candidateShowInactive: false, portNameEdited: false })

	private selectNIC = (selectedNICID: string) => this.setState(state => ({
		selectedNICID, error: undefined,
		switchPortName: state.portNameEdited || state.editingID !== undefined ? state.switchPortName
			: manualPortNameSuggestions(this.props.switchNode.id, this.props.nodes, this.props.automaticMappings,
				state.candidateMappings || this.props.allMappings)[0]?.value || ''
	}))

	private openAdd = async () => {
		const requestID = ++this.candidateRequestID
		this.setState({
			visible: true,
			view: 'form',
			candidateSearch: '',
			candidateShowInactive: false,
			switchPortName: '',
			selectedNICID: '',
			editingID: undefined,
			error: undefined,
			refreshing: true,
			candidateMappings: undefined,
			portNameEdited: false
		})
		try {
			const candidateMappings = await listManualPortMappings(this.props.session)
			if (requestID !== this.candidateRequestID) return
			if (this.state.visible && this.state.view === 'form') this.setState(state => ({
				candidateMappings, refreshing: false,
				switchPortName: state.portNameEdited ? state.switchPortName : manualPortNameSuggestions(
					this.props.switchNode.id, this.props.nodes, this.props.automaticMappings, candidateMappings)[0]?.value || ''
			}))
		} catch (error) {
			if (requestID !== this.candidateRequestID) return
			this.setState({ refreshing: false, error: error instanceof Error ? error.message : String(error) })
		}
	}

	private openList = () => {
		this.candidateRequestID += 1
		this.setState({
			visible: true,
			view: 'list',
			candidateMappings: undefined,
			switchPortName: '',
			selectedNICID: '',
			editingID: undefined,
			error: undefined
		})
		// The manager may stay mounted across the initial session/topology sync.
		// Always reconcile the list with SQLite when the user opens it.
		Promise.resolve(this.props.onChanged()).catch(error => {
			console.warn('[ManualPortMapping] failed to refresh mapping list', error)
		})
	}

	private close = () => {
		this.candidateRequestID += 1
		this.setState({ visible: false, error: undefined }, this.resetForm)
	}

	private edit = (mapping: ManualPortMappingRecord) => this.setState({
		visible: true,
		view: 'form',
		switchPortName: mapping.switchPortName,
		selectedNICID: mapping.hostNicNodeId,
		editingID: mapping.id,
		candidateMappings: undefined,
		portNameEdited: true,
		error: undefined
	})

	private save = async () => {
		if (this.state.refreshing || (!this.state.editingID && !this.state.candidateMappings)) return
		const allMappings = this.state.candidateMappings || this.props.allMappings
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
		if (!buildManualPortMappingCandidates(this.props.switchNode.id, this.props.nodes,
			this.props.automaticMappings, allMappings, this.state.editingID).some(item => item.node.id === nic.node.id)) {
			this.setState({ error: translate('manualPortMappingNICDuplicate') })
			return
		}
		const conflict = manualPortNameConflict(
			this.props.switchNode.id,
			switchPortName,
			this.props.automaticMappings,
			allMappings.filter(mapping => mapping.switchNodeId === this.props.switchNode.id),
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
		const automaticallyConnectedNICs = this.automaticallyConnectedNICs()
		const portSuggestions = manualPortNameSuggestions(this.props.switchNode.id, this.props.nodes,
			this.props.automaticMappings, this.state.candidateMappings || this.props.allMappings, this.state.editingID)
		const hostNICs = this.hostNICs()
		const availableNICs = buildManualPortMappingCandidates(this.props.switchNode.id, this.props.nodes,
			this.props.automaticMappings, this.state.candidateMappings || this.props.allMappings, this.state.editingID)
		const availableIDs = new Set(availableNICs.map(item => item.node.id))
		const unavailableNICs = hostNICs.filter(item => !availableIDs.has(item.node.id))
		const search = this.state.candidateSearch.trim().toLowerCase()
		const candidates = (this.state.candidateMappings ? availableNICs : [])
			.filter(item => this.state.candidateShowInactive || item.state === 'connected')
			.filter(item => `${nodeName(item.host)} ${nodeName(item.node)} ${item.node.data?.MAC || ''}`.toLowerCase().includes(search))
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
					<Popconfirm
						title={translate('manualPortMappingDeleteConfirm')}
						okText={translate('manualPortMappingDeleteOk')}
						cancelText={translate('cancel')}
						placement="bottomRight"
						overlayClassName="netdive-manual-port-mapping-delete-confirm"
						getPopupContainer={() => document.body}
						onConfirm={() => this.disable(mapping)}>
						<Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={translate('manualPortMappingDelete')} />
					</Popconfirm>
				</Space>
			}
		]

		return <React.Fragment>
			<Tooltip
				title={translate('manualPortMappingManage')}
				placement="top"
				overlayClassName="netdive-port-mapping-action-tooltip"
				getPopupContainer={() => document.body}
				autoAdjustOverflow
					destroyOnHidden>
			<Dropdown
				popupRender={() => managementMenu}
				classNames={{ root: 'netdive-manual-port-mapping-dropdown' }}
				placement="bottomRight"
				getPopupContainer={() => document.body}
				trigger={['click']}>
				<Button
					className="netdive-manual-port-mapping-trigger"
					icon={<PlusOutlined />}
					aria-label={translate('manualPortMappingManage')}
					onClick={event => event.preventDefault()} />
			</Dropdown>
			</Tooltip>
			<Modal
				open={this.state.visible}
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
					{this.state.view === 'form' && <Alert className="netdive-manual-port-mapping-manager__notice"
						type="info" showIcon title={translate('manualPortMappingGuidance')} />}
					<Collapse className="netdive-manual-port-mapping-manager__help" ghost size="small" defaultActiveKey={[]}
						styles={{ header: { padding: '2px 0' }, body: { padding: '4px 0 2px 20px' } }}
						items={[{ key: 'limits', label: <Typography.Text type="secondary">{translate('manualPortMappingLimitsTitle')}</Typography.Text>,
							children: <ol>{['manualPortMappingLimitsRelation', 'manualPortMappingLimitsMetrics', 'manualPortMappingLimitsAccuracy']
								.map(key => <li key={key}><Typography.Text>{translate(key)}</Typography.Text></li>)}</ol>
						}]} />
					{this.state.view === 'form' ? <React.Fragment>
						{!editing && <section className="netdive-manual-port-mapping-manager__candidates">
							<div className="netdive-manual-port-mapping-manager__candidate-heading">
								<Typography.Title level={5}>{translate('manualPortMappingCandidatesTitle')}</Typography.Title>
								<Tooltip title={translate('manualPortMappingCandidatesPriority')} getPopupContainer={() => document.body}>
									<Button type="text" size="small" icon={<InfoCircleOutlined />}
										aria-label={translate('manualPortMappingCandidatesPriorityTitle')} />
								</Tooltip>
							</div>
							<Typography.Paragraph type="secondary" className="netdive-manual-port-mapping-manager__candidate-description">
								{translate('manualPortMappingCandidatesHelp')}</Typography.Paragraph>
							<Input.Search allowClear placeholder={translate('manualPortMappingCandidatesSearch')}
								value={this.state.candidateSearch} onChange={event => this.setState({ candidateSearch: event.target.value })} />
							<Checkbox className="netdive-manual-port-mapping-manager__include-inactive" checked={this.state.candidateShowInactive}
								onChange={event => this.setState({ candidateShowInactive: event.target.checked })}>
								{translate('manualPortMappingCandidatesIncludeInactive')}</Checkbox>
							<Table size="small" rowKey={item => item.node.id} dataSource={candidates} loading={this.state.refreshing}
								pagination={{ pageSize: 5, hideOnSinglePage: true, showSizeChanger: false }}
								locale={{ emptyText: translate('manualPortMappingCandidatesEmpty') }}
								columns={[
									{ title: translate('switchPortMappingHost'), key: 'host', render: (_, item) => nodeName(item.host) },
									{ title: translate('switchPortMappingNic'), key: 'nic', render: (_, item) => <>{nodeName(item.node)}
										<div className="netdive-manual-port-mapping-manager__candidate-mac">{String(item.node.data?.MAC || '-')}</div></> },
									{ title: translate('switchPortMappingState'), key: 'state', render: (_, item) => <Badge
										status={item.state === 'connected' ? 'success' : item.state === 'disconnected' ? 'warning' : 'default'}
										text={translate(item.state === 'connected' ? 'manualPortMappingNicUp' : item.state === 'disconnected' ? 'manualPortMappingNicDown' : 'manualPortMappingNicUnknown')} /> },
									{ title: translate('manualPortMappingCandidateEvidence'), key: 'evidence', render: (_, item) => translate(item.hostObservedOnSwitch
										? 'manualPortMappingCandidateSibling' : 'manualPortMappingCandidateUnassigned') },
									{ title: '', key: 'select', render: (_, item) => <Button size="small" disabled={this.state.saving}
										type={this.state.selectedNICID === item.node.id ? 'primary' : 'default'}
										onClick={() => this.selectNIC(item.node.id)}>
										{translate(this.state.selectedNICID === item.node.id ? 'manualPortMappingCandidateSelected' : 'manualPortMappingCandidateSelect')}</Button> }
								]} />
						</section>}
						<div className="netdive-manual-port-mapping-manager__form">
						<label>
							<span>{translate('manualPortMappingPortDisplayName')}</span>
							<AutoComplete
								options={portSuggestions.map(item => ({ value: item.value,
									label: item.value }))}
								getPopupContainer={() => document.body}
								value={this.state.switchPortName}
								onChange={(value: string) => this.setState({ switchPortName: value, portNameEdited: true, error: undefined })}
								onBlur={() => this.setState(state => ({ switchPortName: state.switchPortName.trim() }))}>
								<Input maxLength={255} aria-label={translate('manualPortMappingPortDisplayName')}
									placeholder={translate('manualPortMappingSelectPort')} onFocus={event => event.target.select()} />
							</AutoComplete>
						</label>
						<label>
							<span>{translate('switchPortMappingNic')}</span>
							<Select
								showSearch
								optionLabelProp="label"
								dropdownClassName="netdive-manual-port-mapping-nic-dropdown"
								filterOption={(input, option) => String(option?.title || '').toLowerCase().includes(input.trim().toLowerCase())}
								placeholder={translate('manualPortMappingSelectNic')}
								notFoundContent={translate('manualPortMappingNoNicSearchResults')}
								value={this.state.selectedNICID || undefined}
								onChange={this.selectNIC}>
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
												label={`${nodeName(item.host)} / ${nodeName(item.node)}`}
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
							{editing && <Button className="netdive-manual-port-mapping-manager__cancel" onClick={this.openList}>{translate('manualPortMappingCancelEdit')}</Button>}
							<Button
								className="netdive-manual-port-mapping-manager__submit"
								type="primary"
								disabled={this.state.refreshing || (!editing && !this.state.candidateMappings)}
								loading={this.state.saving}
								onClick={this.save}>
								{translate(editing ? 'manualPortMappingUpdate' : 'manualPortMappingAdd')}
							</Button>
						</div>
						<Typography.Text type="secondary" className="netdive-manual-port-mapping-manager__port-hint">
							{translate('manualPortMappingPortSuggestionHelp')}</Typography.Text>
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
