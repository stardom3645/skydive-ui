import * as React from 'react'
import { Avatar, Button, Input, List, Space, Tooltip, Typography } from 'antd'
import { DownOutlined, RightOutlined } from '@ant-design/icons'
import { Node, NodeAttrs } from '../Topology'
import {
    aggregateKubernetesPods,
    isKubernetesPod,
    kubernetesPodStatusEntry,
    KubernetesPodLifecycle,
    KubernetesPodStatusEntry,
    KubernetesPodStatusGroup
} from '../KubernetesPodLifecycle'
import {
    kubernetesTopologyBadgeGroupSummary,
    kubernetesTopologyCountBadges
} from '../KubernetesTopologyBadgeAggregation'
import { TopologyStatusBadgeGroup } from '../TopologyStatusBadge'
import { DetailBadge, DetailEmpty, DetailSection } from './common'
import './GroupDetailPanel.css'

interface Props {
    node: Node
    visibleNodeIDs: Set<string>
    nodeAttrs: (node: Node) => NodeAttrs
    nodeDisplayName?: (node: Node) => string
    vmNetworkMap?: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>>
    onNodeSelect: (node: Node) => void
    onNodeFocus: (node: Node) => void
    onNodesSelect: (nodes: Node[]) => void
    onNodeDeselect: (node: Node) => void
    topologyBadgeChildren?: (node: Node) => Node[]
}

interface State {
    search: string
    historyExpanded: boolean
    expandedProblemReasons: string[]
    expandedHistoryReasons: string[]
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
        search: '',
        historyExpanded: false,
        expandedProblemReasons: [],
        expandedHistoryReasons: []
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.node.id !== this.props.node.id) {
            this.setState({ search: '', historyExpanded: false, expandedProblemReasons: [], expandedHistoryReasons: [] })
        }
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

    private isPodGroup(): boolean {
        const children = this.children()
        return isKubernetesPod(this.props.node) || (!!children.length && children.every(isKubernetesPod))
    }

    private matchesSearch(node: Node): boolean {
        const search = this.state.search.trim().toLowerCase()
        if (!search) return true
        const entry = kubernetesPodStatusEntry(node)
        return `${this.displayName(node)} ${entry.lifecycle.phase} ${entry.lifecycle.reason} ${entry.lifecycle.label} ${entry.namespace} ${entry.nodeName} ${entry.workload}`.toLowerCase().indexOf(search) >= 0
    }

    private toggleProblemReason(reason: string) {
        const expanded = this.state.expandedProblemReasons.indexOf(reason) >= 0
        this.setState({
            expandedProblemReasons: expanded
                ? this.state.expandedProblemReasons.filter(item => item !== reason)
                : [...this.state.expandedProblemReasons, reason]
        })
    }

    private toggleHistoryReason(reason: string) {
        const expanded = this.state.expandedHistoryReasons.indexOf(reason) >= 0
        this.setState({
            expandedHistoryReasons: expanded
                ? this.state.expandedHistoryReasons.filter(item => item !== reason)
                : [...this.state.expandedHistoryReasons, reason]
        })
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

    private renderNodeItem(node: Node, lifecycle?: KubernetesPodLifecycle, podEntry?: KubernetesPodStatusEntry) {
        const attrs = this.props.nodeAttrs(node)
        const name = this.displayName(node)
        const genericStatus = statusOf(node)
        const status = lifecycle
            ? lifecycle.kind === 'problem'
                ? { label: lifecycle.label, className: 'is-warning', visible: true }
                : lifecycle.kind === 'terminated'
                    ? { label: lifecycle.label, className: 'is-history', visible: true }
                    : { label: '', className: 'is-ok', visible: false }
            : genericStatus
        const networkSummary = this.vmNetworkSummary(node)
        const ip = networkSummary ? networkSummary.text : ipOf(node)
        const visible = this.isNodeVisible(node)
        const badgeChildren = this.props.topologyBadgeChildren
            ? this.props.topologyBadgeChildren(node)
            : undefined
        const topologyBadges = String(node.data?.Manager || '').toLowerCase() === 'k8s'
            ? kubernetesTopologyCountBadges(node, badgeChildren)
            : []
        const topologyBadgeSummary = kubernetesTopologyBadgeGroupSummary(node, topologyBadges, badgeChildren)
        const tone: 'warning' | 'default' | 'danger' = status.className === 'is-warning'
            ? 'warning'
            : status.className === 'is-history'
                ? 'default'
                : 'danger'
        return (
            <List.Item
                key={node.id}
                className={`netdive-group-detail-item ${visible ? 'is-selected' : ''} ${lifecycle?.kind === 'terminated' ? 'is-history' : ''}`}
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
                    {(status.visible || ip || (lifecycle && lifecycle.kind !== 'running')) && (
                        <span className="netdive-group-detail-meta">
                            {status.visible && <DetailBadge className={`netdive-group-detail-tag ${status.className}`} tone={tone}>{status.label}</DetailBadge>}
                            {!status.visible && lifecycle && lifecycle.kind !== 'running' && <span>{lifecycle.label}</span>}
                            {ip && (
                                <Tooltip title={networkSummary ? networkSummary.tooltip : ip}>
                                    <Typography.Text className="netdive-group-detail-ip" ellipsis={true}>{status.visible ? '· ' : ''}{ip}</Typography.Text>
                                </Tooltip>
                            )}
                        </span>
                    )}
                    {podEntry && lifecycle && (lifecycle.kind === 'problem' || lifecycle.kind === 'terminated') && (
                        <span className="netdive-group-detail-podContext">
                            <span><small>파드명</small><Tooltip title={podEntry.podName}><b>{podEntry.podName}</b></Tooltip></span>
                            <span><small>Namespace</small><Tooltip title={podEntry.namespace}><b>{podEntry.namespace}</b></Tooltip></span>
                            <span><small>노드</small><Tooltip title={podEntry.nodeName}><b>{podEntry.nodeName}</b></Tooltip></span>
                            <span><small>워크로드</small><Tooltip title={podEntry.workload}><b>{podEntry.workload}</b></Tooltip></span>
                            <span><small>Reason</small><Tooltip title={lifecycle.originalReason || lifecycle.label}><b>{lifecycle.originalReason || lifecycle.label}</b></Tooltip></span>
                            <span><small>발생 시각</small><Tooltip title={`시간 기준: ${podEntry.time.source}`}><b>{podEntry.time.text} · {podEntry.time.accuracy}</b></Tooltip></span>
                        </span>
                    )}
                </span>
                <TopologyStatusBadgeGroup
                    badges={topologyBadges}
                    summary={topologyBadgeSummary}
                    className="netdive-group-detail-topologyBadges" />
                <Tooltip title="상세 보기">
                    <Button
                        type="text"
                        className="netdive-group-detail-arrow"
                        aria-label={`${name} 상세 보기`}
                        onClick={(event) => {
                            event.stopPropagation()
                            this.props.onNodeFocus(node)
                        }}>
                        <span>상세</span>
                        <RightOutlined />
                    </Button>
                </Tooltip>
            </List.Item>
        )
    }

    private renderPodStatusGroup(group: KubernetesPodStatusGroup, history: boolean) {
        const expanded = !!this.state.search.trim() || (history
            ? this.state.expandedHistoryReasons.indexOf(group.key) >= 0
            : this.state.expandedProblemReasons.indexOf(group.key) >= 0)
        return <div key={group.key} className={`netdive-group-detail-historyGroup ${history ? 'is-history' : 'is-problem'}`}>
            <button
                type="button"
                onClick={() => history ? this.toggleHistoryReason(group.key) : this.toggleProblemReason(group.key)}>
                <span>{group.label}</span>
                <b>{group.entries.length}</b>
                <DownOutlined className={expanded ? 'is-expanded' : ''} />
            </button>
            {expanded && <List
                className="netdive-group-detail-list netdive-group-detail-historyList"
                dataSource={group.entries}
                renderItem={entry => this.renderNodeItem(entry.node, entry.lifecycle, entry)} />}
        </div>
    }

    render() {
        const children = this.children()
        const filtered = this.filteredChildren()
        const podGroup = this.isPodGroup()
        const podAggregate = podGroup ? aggregateKubernetesPods(children) : undefined
        const filteredPodAggregate = podGroup
            ? aggregateKubernetesPods(children.filter(node => this.matchesSearch(node)))
            : undefined
        const runningEntries = filteredPodAggregate?.runningEntries || []
        const otherCurrentEntries = filteredPodAggregate?.currentEntries || []
        const currentProblemGroups = filteredPodAggregate?.currentProblemGroups || []
        const terminationGroups = filteredPodAggregate?.terminationHistoryGroups || []
        const runningCount = podAggregate?.running || 0
        const problemCount = podAggregate?.currentProblems || 0
        const terminatedCount = podAggregate?.terminated || 0
        const currentExpandTargets = podGroup
            ? [...(filteredPodAggregate?.currentProblemEntries || []), ...runningEntries, ...otherCurrentEntries].map(entry => entry.node)
            : filtered
        const visibleCount = children.filter((node) => this.isNodeVisible(node)).length
        const groupScope = this.groupScope()
        const groupCountDescription = `${children.length}개 객체${visibleCount > 0 ? ` · 표시 ${visibleCount}` : ''}`
        const showHistory = this.state.historyExpanded || !!this.state.search.trim()

        return (
            <div className="netdive-group-detail">
                <DetailSection
                    className="netdive-group-detail-card"
                    bodyClassName="netdive-group-detail-content"
                    icon={<span className="fa fas fa-layer-group" />}
                    title={this.groupTitle()}
                    description={podGroup ? groupScope || undefined : groupScope ? `${groupScope} · ${groupCountDescription}` : groupCountDescription}
                    action={
                        <Space size={6}>
                            <Button type="primary" onClick={() => this.props.onNodesSelect(currentExpandTargets)} disabled={currentExpandTargets.length === 0}>
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
                            placeholder={podGroup ? '파드 검색' : '노드 검색'}
                            value={this.state.search}
                            onChange={(event) => this.setState({ search: event.target.value })} />
                    </div>
                    {podGroup && <div className="netdive-group-detail-podSummary" aria-label="파드 그룹 상태 요약">
                        <span><small>현재 파드</small><strong>{podAggregate?.current || 0}</strong></span>
                        <span className="is-running"><small>실행 중</small><strong>{runningCount}</strong></span>
                        <button
                            type="button"
                            className={problemCount ? 'is-problem' : ''}
                            disabled={!problemCount}
                            onClick={() => this.setState({
                                expandedProblemReasons: currentProblemGroups.map(group => group.key)
                            })}>
                            <small>비정상</small><strong>{problemCount}</strong>
                        </button>
                        <button
                            type="button"
                            className="is-history"
                            disabled={!terminatedCount}
                            onClick={() => this.setState({ historyExpanded: true })}>
                            <small>종료</small><strong>{terminatedCount}</strong>
                        </button>
                    </div>}
                    {podGroup ? (
                        <React.Fragment>
                            {problemCount > 0 && <div className="netdive-group-detail-problems">
                                <div className="netdive-group-detail-podSectionTitle">
                                    <strong>현재 문제</strong>
                                    <span>{problemCount}개 파드</span>
                                </div>
                                <div className="netdive-group-detail-problemGroups">
                                    {currentProblemGroups.map(group => this.renderPodStatusGroup(group, false))}
                                </div>
                            </div>}
                            <div className="netdive-group-detail-podSection">
                                <div className="netdive-group-detail-podSectionTitle">
                                    <strong>실행 중 파드</strong>
                                    <span>{runningCount}</span>
                                </div>
                                {runningEntries.length === 0 && otherCurrentEntries.length === 0
                                    ? <DetailEmpty description={this.state.search ? '검색 조건에 맞는 실행 중 파드가 없습니다.' : '현재 실행 중인 파드가 없습니다.'} compact />
                                    : <List
                                        className="netdive-group-detail-list"
                                        dataSource={[...runningEntries, ...otherCurrentEntries]}
                                        renderItem={entry => this.renderNodeItem(entry.node, entry.lifecycle, entry)} />}
                            </div>
                            {terminatedCount > 0 && <div className="netdive-group-detail-history">
                                <button
                                    type="button"
                                    className={`netdive-group-detail-historyToggle ${showHistory ? 'is-expanded' : ''}`}
                                    onClick={() => this.setState({ historyExpanded: !this.state.historyExpanded })}>
                                    <span><strong>종료 이력</strong><b>{terminatedCount}</b></span>
                                    <DownOutlined />
                                </button>
                                {showHistory && <div className="netdive-group-detail-historyGroups">
                                    {terminationGroups.length === 0
                                        ? <DetailEmpty description="검색 조건에 맞는 종료 이력이 없습니다." compact />
                                        : terminationGroups.map(group => this.renderPodStatusGroup(group, true))}
                                </div>}
                            </div>}
                        </React.Fragment>
                    ) : filtered.length === 0 ? (
                        <DetailEmpty description="표시할 노드가 없습니다." compact />
                    ) : (
                        <List
                            className="netdive-group-detail-list"
                            dataSource={filtered}
                            renderItem={(node: Node) => this.renderNodeItem(node)} />
                    )}
                </DetailSection>
            </div>
        )
    }
}

export default GroupDetailPanel
