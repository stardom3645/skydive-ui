import * as React from 'react'
import { Alert, Button, Modal, Popconfirm, Select, Space, Table } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'

import { translate } from '../../Config'
import { ManualPortMappingRecord } from '../../InfrastructurePortMapping'
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
	mappings: ManualPortMappingRecord[]
	session?: session
	onChanged: () => Promise<void> | void
}

interface State {
	visible: boolean
	selectedPortID: string
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

const belongsTo = (node: Node, ancestorID: string): boolean => {
	let current = node.parent
	while (current) {
		if (current.id === ancestorID) return true
		current = current.parent
	}
	return false
}

const isPhysicalNIC = (node: Node): boolean => ['device', 'nic', 'interface', 'ethernet'].includes(nodeType(node))

export class ManualPortMappingManager extends React.PureComponent<Props, State> {
	state: State = {
		visible: false,
		selectedPortID: '',
		selectedNICID: '',
		saving: false
	}

	private switchPorts(): Node[] {
		return this.props.nodes
			.filter(node => ['switchport', 'port'].includes(nodeType(node)) && belongsTo(node, this.props.switchNode.id))
			.sort((left, right) => nodeName(left).localeCompare(nodeName(right), undefined, { numeric: true }))
	}

	private hostNICs(): Array<{ node: Node, host: Node }> {
		return this.props.nodes
			.filter(isPhysicalNIC)
			.map(node => ({ node, host: ancestorOfType(node, 'host') }))
			.filter((item): item is { node: Node, host: Node } => !!item.host)
			.sort((left, right) => {
				const hostOrder = nodeName(left.host).localeCompare(nodeName(right.host), undefined, { numeric: true })
				return hostOrder || nodeName(left.node).localeCompare(nodeName(right.node), undefined, { numeric: true })
			})
	}

	private resetForm = () => this.setState({ selectedPortID: '', selectedNICID: '', editingID: undefined, error: undefined })

	private open = () => this.setState({ visible: true, error: undefined })

	private close = () => this.setState({ visible: false, error: undefined }, this.resetForm)

	private edit = (mapping: ManualPortMappingRecord) => this.setState({
		selectedPortID: mapping.switchPortNodeId,
		selectedNICID: mapping.hostNicNodeId,
		editingID: mapping.id,
		error: undefined
	})

	private save = async () => {
		const port = this.switchPorts().find(node => node.id === this.state.selectedPortID)
		const nic = this.hostNICs().find(item => item.node.id === this.state.selectedNICID)
		if (!port || !nic) {
			this.setState({ error: translate('manualPortMappingSelectionRequired') })
			return
		}
		this.setState({ saving: true, error: undefined })
		const input = {
			switchNodeId: this.props.switchNode.id,
			switchPortNodeId: port.id,
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
			this.setState({ saving: false }, this.resetForm)
		} catch (error) {
			this.setState({ saving: false, error: error instanceof Error ? error.message : String(error) })
		}
	}

	private disable = async (mapping: ManualPortMappingRecord) => {
		this.setState({ saving: true, error: undefined })
		try {
			await disableManualPortMapping(this.props.session, mapping.id)
			await this.props.onChanged()
			this.setState({ saving: false })
			if (this.state.editingID === mapping.id) this.resetForm()
		} catch (error) {
			this.setState({ saving: false, error: error instanceof Error ? error.message : String(error) })
		}
	}

	render() {
		const editing = this.state.editingID !== undefined
		const assignedPorts = new Set(this.props.mappings.filter(item => item.id !== this.state.editingID).map(item => item.switchPortNodeId))
		const assignedNICs = new Set(this.props.mappings.filter(item => item.id !== this.state.editingID).map(item => item.hostNicNodeId))
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
			<Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={this.open}>
				{translate('manualPortMappingManage')}
			</Button>
			<Modal
				visible={this.state.visible}
				title={translate('manualPortMappingTitle')}
				width={720}
				footer={null}
				destroyOnClose
				onCancel={this.close}>
				<div className="netdive-manual-port-mapping-manager">
					{this.state.error && <Alert type="error" showIcon message={this.state.error} />}
					<div className="netdive-manual-port-mapping-manager__form">
						<label>
							<span>{translate('switchPortMappingPort')}</span>
							<Select
								showSearch
								optionFilterProp="children"
								placeholder={translate('manualPortMappingSelectPort')}
								value={this.state.selectedPortID || undefined}
								onChange={(value: string) => this.setState({ selectedPortID: value, error: undefined })}>
								{this.switchPorts().map(port => <Select.Option key={port.id} value={port.id} disabled={assignedPorts.has(port.id)}>{nodeName(port)}</Select.Option>)}
							</Select>
						</label>
						<label>
							<span>{translate('switchPortMappingNic')}</span>
							<Select
								showSearch
								optionFilterProp="children"
								placeholder={translate('manualPortMappingSelectNic')}
								value={this.state.selectedNICID || undefined}
								onChange={(value: string) => this.setState({ selectedNICID: value, error: undefined })}>
								{this.hostNICs().map(item => <Select.Option key={item.node.id} value={item.node.id} disabled={assignedNICs.has(item.node.id)}>{nodeName(item.host)} / {nodeName(item.node)}</Select.Option>)}
							</Select>
						</label>
						<div className="netdive-manual-port-mapping-manager__form-actions">
							{editing && <Button size="small" onClick={this.resetForm}>{translate('manualPortMappingCancelEdit')}</Button>}
							<Button size="small" type="primary" loading={this.state.saving} onClick={this.save}>
								{translate(editing ? 'manualPortMappingUpdate' : 'manualPortMappingAdd')}
							</Button>
						</div>
					</div>
					<Table<ManualPortMappingRecord>
						size="small"
						pagination={false}
						rowKey="id"
						columns={columns}
						dataSource={this.props.mappings}
						locale={{ emptyText: translate('manualPortMappingEmpty') }} />
				</div>
			</Modal>
		</React.Fragment>
	}
}

export default ManualPortMappingManager
