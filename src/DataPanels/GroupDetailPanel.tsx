import * as React from 'react'
import { Avatar, Button, Input, List, Space, Tooltip, Typography } from 'antd'
import { Node, NodeAttrs } from '../Topology'
import { DetailBadge, DetailEmpty, DetailSection } from './common'
import './GroupDetailPanel.css'

interface Props {
    node: Node
    visibleNodeIDs: Set<string>
    nodeAttrs: (node: Node) => NodeAttrs
    nodeDisplayName?: (node: Node) => string
    vmNetworkMap?: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>>
    onNodeSelect: (node: Node) => void
    onNodesSelect: (nodes: Node[]) => void
    onNodeDeselect: (node: Node) => void
}

interface State {
    search: string
}

const statusOf = (node: Node): { label: string, className: string, visible: boolean } => {
    const raw = String(node.data?.State || node.data?.Status || node.data?.state || node.data?.status || '').trim()
    const normalized = raw.toLowerCase()
    const label = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : ''
    if (normalized === 'down') {
        return { label: label || 'Down', className: 'is-bad', visible: true }
    }
    return { label: label || '', className: 'is-unknown', visible: false }
}

const ipOf = (node: Node): string => {
    const data = node.data || {}
    const value = data.IP || data.IPV4 || data.Address || data.MgtAddr || data.MgtIP || ''
    if (Array.isArray(value)) {
        return String(value[0] || '')
    }
    return String(value || '')
}

interface NetworkSummary {
    text: string
    tooltip: React.ReactNode
}

class GroupDetailPanel extends React.Component<Props, State> {
    state: State = {
        search: ''
    }

    private children(): Node[] {
        return (this.props.node.children || []).slice()
    }

    private displayName(node: Node): string {
        if (this.props.nodeDisplayName) {
            return this.props.nodeDisplayName(node)
        }
        return this.props.nodeAttrs(node).name || node.data?.Name || node.id
    }

    private filteredChildren(): Node[] {
        const search = this.state.search.trim().toLowerCase()
        const children = this.children()
        if (!search) {
            return children
        }
        return children.filter((node) => this.displayName(node).toLowerCase().indexOf(search) >= 0)
    }

    private groupTitle(): string {
        return this.props.nodeAttrs(this.props.node).name || this.props.node.data?.Name || '그룹'
    }

    private groupScope(): string {
        return String(this.props.node.data?.GroupScopeLabel || '').trim()
    }

    private isNodeVisible(node: Node): boolean {
        return this.props.visibleNodeIDs.has(node.id) || !!node.state?.selected
    }

    private vmNetworkSummary(node: Node): NetworkSummary | undefined {
        if (String(node.data?.Type || '').toLowerCase() !== 'libvirt') {
            return undefined
        }
        const vmNetworkMap = this.props.vmNetworkMap || {}
        const attrsName = this.props.nodeAttrs(node).name
        const candidates = [
            node.data?.Name,
            attrsName,
            this.displayName(node),
            node.data?.LibvirtName,
            node.data?.UUID,
            node.data?.ID,
            node.data?.ExtID,
            node.data?.VirtualMachineID,
            node.data?.instanceName
        ]
            .map((value) => typeof value === 'string' ? value.trim() : '')
            .filter((value, index, array) => !!value && array.indexOf(value) === index)

        let networks: Array<{ networkName: string, macAddress: string, ipAddress: string }> = []
        for (const key of candidates) {
            const found = vmNetworkMap[key]
            if (Array.isArray(found) && found.length > 0) {
                networks = found
                break
            }
        }
        const rows = networks
            .map((network) => ({
                ip: String(network.ipAddress || '').trim(),
                name: String(network.networkName || '').trim()
            }))
            .filter((network) => !!network.ip)
        if (rows.length === 0) {
            return undefined
        }
        const primary = rows[0]
        const extraCount = rows.length - 1
        const text = extraCount > 0 ? `${primary.ip} · 외 ${extraCount}개` : primary.ip
        const tooltip = (
            <div className="netdive-group-detail-networkTooltip">
                {rows.map((row, index) => (
                    <div key={`${row.ip}-${index}`} className="netdive-group-detail-networkTooltipRow">
                        <span className="netdive-group-detail-networkTooltipIp">{row.ip}</span>
                        {row.name && <span className="netdive-group-detail-networkTooltipName">{row.name}</span>}
                    </div>
                ))}
            </div>
        )
        return { text, tooltip }
    }

    render() {
        const children = this.children()
        const filtered = this.filteredChildren()
        const visibleCount = children.filter((node) => this.isNodeVisible(node)).length
        const groupScope = this.groupScope()
        const groupCountDescription = `${children.length}개 노드${visibleCount > 0 ? ` · 표시 ${visibleCount}` : ''}`

        return (
            <div className="netdive-group-detail">
                <DetailSection
                    className="netdive-group-detail-card"
                    bodyClassName="netdive-group-detail-content"
                    icon={<span className="fa fas fa-layer-group" />}
                    title={this.groupTitle()}
                    description={groupScope ? `${groupScope} · ${groupCountDescription}` : groupCountDescription}
                    action={
                        <Space size={6}>
                            <Button type="primary" onClick={() => this.props.onNodesSelect(filtered)} disabled={filtered.length === 0}>
                                모두 펼치기
                            </Button>
                            <Button onClick={() => children.forEach((node) => this.props.onNodeDeselect(node))} disabled={visibleCount === 0}>
                                모두 접기
                            </Button>
                        </Space>
                    }>
                    <div className="netdive-group-detail-toolbar">
                        <Input
                            allowClear={true}
                            prefix={<span className="fa fas fa-search" />}
                            placeholder="노드 검색"
                            value={this.state.search}
                            onChange={(event) => this.setState({ search: event.target.value })} />
                    </div>
                    {filtered.length === 0 ? (
                        <DetailEmpty description="표시할 노드가 없습니다." compact />
                    ) : (
                        <List
                            className="netdive-group-detail-list"
                            dataSource={filtered}
                            renderItem={(node: Node) => {
                                const attrs = this.props.nodeAttrs(node)
                                const name = this.displayName(node)
                                const status = statusOf(node)
                                const networkSummary = this.vmNetworkSummary(node)
                                const ip = networkSummary ? networkSummary.text : ipOf(node)
                                const visible = this.isNodeVisible(node)
                                return (
                                    <List.Item
                                        className={`netdive-group-detail-item ${visible ? 'is-selected' : ''}`}
                                        aria-selected={visible}
                                        onClick={() => this.props.onNodeSelect(node)}>
                                        <Avatar
                                            className={`netdive-group-detail-nodeAvatar ${status.className}`}
                                            shape="square"
                                            icon={<span className={attrs.iconClass || 'fa'}>{attrs.href ? '' : attrs.icon}</span>} />
                                        <span className="netdive-group-detail-main">
                                            <Tooltip title={name}>
                                                <Typography.Text className="netdive-group-detail-name" ellipsis={true}>{name}</Typography.Text>
                                            </Tooltip>
                                            {(status.visible || ip) && (
                                                <span className="netdive-group-detail-meta">
                                                    {status.visible && <DetailBadge className={`netdive-group-detail-tag ${status.className}`} tone="danger">{status.label}</DetailBadge>}
                                                    {ip && (
                                                        <Tooltip title={networkSummary ? networkSummary.tooltip : ip}>
                                                            <Typography.Text className="netdive-group-detail-ip" ellipsis={true}>{status.visible ? '· ' : ''}{ip}</Typography.Text>
                                                        </Tooltip>
                                                    )}
                                                </span>
                                            )}
                                        </span>
                                        <span className="netdive-group-detail-arrow">›</span>
                                    </List.Item>
                                )
                            }} />
                    )}
                </DetailSection>
            </div>
        )
    }
}

export default GroupDetailPanel
