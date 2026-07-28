/*
 * Copyright (C) 2019 Sylvain Afchain
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import * as React from "react"
import * as ReactDOM from "react-dom"
import { Avatar, Button, Card, Input, List, Tag, Typography } from 'antd'
import { hierarchy } from 'd3-hierarchy'
import { Selection, select, selectAll, event } from 'd3-selection'
import { line, linkVertical, curveCatmullRom, curveCardinalClosed } from 'd3-shape'
import { } from 'd3-transition'
import { zoom, zoomIdentity } from 'd3-zoom'
import ResizeObserver from 'react-resize-observer'
import { aggregateKubernetesPods, isCurrentKubernetesPod, isKubernetesPod, KubernetesPodAggregate } from './KubernetesPodLifecycle'

const flextree = require('d3-flextree').flextree;

import './Topology.css'

// 토폴로지 노드/링크 전환 애니메이션 시간(ms)입니다.
const animDuration = 500
// 이 개수 이하는 그룹 노드로 묶지 않고 일반 노드로 펼쳐 표시합니다.
const defaultGroupSize = 6
// 그룹 전체 펼침 시 최대 표시 가능한 하위 노드 수입니다.
const defaultMaxExpandSize = 100

// 기본 트리 레이아웃에서 노드가 차지하는 가로 간격입니다.
const nodeWidth = 320
// 기본 트리 레이아웃에서 계층 간 세로 간격입니다.
const nodeHeight = 200
// 짧은 이름 노드의 기본 카드 너비입니다.
const topologyCardWidth = 280
// 중간 길이 이름 노드의 카드 너비입니다.
const topologyMediumCardWidth = 360
// 노드 카드에서 아이콘/배지 영역을 제외한 텍스트 계산 여백입니다.
const topologyCardTextPadding = 104
// 같은 계층의 카드 경계 사이에 유지할 최소 가로 여백입니다.
const topologySiblingCardGap = 36
// 일반 토폴로지 노드 카드의 높이입니다.
const topologyCardHeight = 92
// 2줄 노드 이름의 줄 간격입니다.
const topologyCardTitleLineGap = 20
// 토폴로지 카드에 직접 노출하는 상태 배지 수입니다. 초과 상태는 +N으로 요약합니다.
const topologyVisibleStatusBadgeLimit = 2
// 상태 배지의 실제 렌더링 간격과 제목 사이의 안전 여백입니다.
const topologyStatusBadgeStep = 34
const topologyStatusBadgeSingleReserveWidth = 40
// 컨테이너형 그룹 UI의 전체 너비입니다.
const groupContainerWidth = 620
// 컨테이너형 그룹 UI의 헤더 높이입니다.
const groupContainerHeaderHeight = 24
// 컨테이너형 그룹 내부 미니 카드 시작 Y 오프셋입니다.
const groupContainerGridOffsetY = -28
// 컨테이너형 그룹 내부 미니 카드 사이 간격입니다.
const groupMiniCardGap = 8
// 컨테이너형 그룹에서 기본 표시하는 미니 카드 최대 개수입니다.
const groupMiniCardLimit = 24
// 컨테이너형 그룹 내부 좌우 패딩입니다.
const groupContainerPaddingX = 16
// 컨테이너형 그룹에서 넓은 미니 카드 한 칸의 너비입니다.
const groupWideMiniCardWidth = (groupContainerWidth - groupContainerPaddingX * 2 - groupMiniCardGap) / 2
// VM 그룹 Navigator 카드의 전체 너비입니다.
const groupListWidth = 620
// 짧은 이름 객체 그룹(NIC, Bridge, Port 등)에 사용하는 Navigator 카드 너비입니다.
const compactGroupListWidth = 550
// VM 그룹 Navigator 카드의 헤더 높이입니다.
const groupListHeaderHeight = 74
// VM 그룹 Navigator 리스트 한 행이 차지하는 높이입니다.
const groupListRowHeight = 70
// VM 그룹 Navigator에서 스크롤 없이 보이는 기준 행 개수입니다.
const groupListVisibleCount = 6
// VM 그룹 Navigator와 선택되어 오른쪽에 펼쳐지는 실제 VM 노드 사이 간격입니다.
const groupListSelectedNodeGap = 26
// 사용자 VM 계층에서 노드 간 가로 간격을 추가로 넓히는 값입니다.
const userVmHorizontalGapBoost = 100
// 사용자 VM 계층에서 노드 간 세로 간격을 추가로 넓히는 값입니다.
const userVmVerticalGapBoost = 35
// 사용자 VM 이름 표시 영역을 추가로 넓히는 값입니다.
const userVmNameWidthBoost = 130
// Kubernetes 클러스터 계층에서 노드 간 가로 간격을 추가로 넓히는 값입니다.
const kubernetesClusterHorizontalGapBoost = 220
// Kubernetes 노드 계층에서 노드 간 가로 간격을 추가로 넓히는 값입니다.
const kubernetesNodeHorizontalGapBoost = 150
// Kubernetes 노드 라벨 표시 영역을 추가로 넓히는 값입니다.
const kubernetesNodeLabelWidthBoost = 95
// Kubernetes 네임스페이스 계층에서 노드 간 가로 간격을 추가로 넓히는 값입니다.
const kubernetesNamespaceHorizontalGapBoost = 160
// Kubernetes 워크로드에서 파드 계층으로 내려갈 때 추가할 세로 여백입니다.
const kubernetesWorkloadVerticalGapBoost = 16
// 고정된 좌측 계층 라벨과 토폴로지 카드 사이의 화면 안전 영역입니다.
const topologyLevelLabelSafeInset = 200
// 시스템 VM / 가상 라우터 compact 레이아웃의 카드 및 그룹 최소 간격입니다.
const compactVmNodeGap = 24
const compactVmGroupGap = 64
// 서로 다른 호스트 서브트리 경계 사이에 유지할 최소 여백입니다.
const compactHostSubtreeGap = 80

const isTopologyInterfaceData = (data?: any): boolean => {
    if (!data) {
        return false
    }
    const type = String(data.Type || '').toLowerCase()
    const driver = String(data.Driver || '').toLowerCase()
    return type === 'tuntap' || driver === 'tuntap'
}

const isCompactGroupListType = (type?: any): boolean => {
    const normalized = String(type || '').toLowerCase()
    return ["device", "nic", "interface", "tun", "tap", "tuntap", "bridge", "ovsbridge", "openvswitch", "port", "switchport"].includes(normalized)
}

const topologyNodeStatus = (node: any): { label: string, className: string, kind: "ok" | "bad" | "warning" | "unknown" } => {
    const data = node?.data || {}
    const raw = String(data.State || data.Status || data.state || data.status || "").toLowerCase()
    if (/running|up|active|정상/.test(raw)) {
        return { label: "Running", className: "is-ok", kind: "ok" }
    }
    if (/warning|warn|degraded|주의|경고/.test(raw)) {
        return { label: "Warning", className: "is-warning", kind: "warning" }
    }
    if (/down|stopped|error|fail|disabled|비정상|중지/.test(raw)) {
        return { label: raw.includes("stop") || /중지/.test(raw) ? "Stopped" : "Error", className: "is-bad", kind: "bad" }
    }
    return { label: "Unknown", className: "is-unknown", kind: "unknown" }
}

const groupStatusSummary = (children: any[]): string => {
    let ok = 0
    let warning = 0
    let bad = 0
    children.forEach(child => {
        const status = topologyNodeStatus(child)
        if (status.kind === "ok") ok++
        if (status.kind === "warning") warning++
        if (status.kind === "bad") bad++
    })
    const parts = new Array<string>()
    if (ok) parts.push(`Running ${ok}`)
    if (warning) parts.push(`Warning ${warning}`)
    if (bad) parts.push(`Error ${bad}`)
    return parts.join(" · ")
}

const groupContainerVisibleCount = (count: number): number => Math.min(count, groupMiniCardLimit)

const groupMiniCardSize = (node: any): { width: number, height: number } => {
    const data = node?.data || {}
    const type = String(data.Type || '').toLowerCase()
    const manager = String(data.Manager || '').toLowerCase()
    if (type === 'libvirt' || type === 'host' || (manager === 'k8s' && type === 'node')) {
        return { width: groupWideMiniCardWidth, height: 44 }
    }
    if (type === 'device' || type === 'bridge' || type === 'ovsbridge' || type === 'openvswitch' || type === 'port') {
        return { width: groupWideMiniCardWidth, height: 44 }
    }
    return { width: groupWideMiniCardWidth, height: 44 }
}

const groupContainerLayout = (children: any[]): { items: Array<{ node: any, x: number, y: number, width: number, height: number }>, height: number, more: number } => {
    const visible = children.slice(0, groupMiniCardLimit)
    const maxContentWidth = groupContainerWidth - groupContainerPaddingX * 2
    const items = new Array<{ node: any, x: number, y: number, width: number, height: number }>()
    let x = 0
    let y = 0
    let rowHeight = 0

    visible.forEach(child => {
        const size = groupMiniCardSize(child)
        if (x > 0 && x + size.width > maxContentWidth) {
            x = 0
            y += rowHeight + groupMiniCardGap
            rowHeight = 0
        }
        items.push({ node: child, x, y, width: size.width, height: size.height })
        x += size.width + groupMiniCardGap
        rowHeight = Math.max(rowHeight, size.height)
    })

    const gridHeight = items.length ? y + rowHeight : 0
    const more = Math.max(0, children.length - groupMiniCardLimit)
    return { items, height: gridHeight, more }
}

const groupContainerHeight = (count: number): number => {
    const placeholder = new Array(groupContainerVisibleCount(count)).fill(null).map(() => ({ data: { Type: 'device' } }))
    const layout = groupContainerLayout(placeholder)
    return groupContainerHeaderHeight + layout.height + (count > groupMiniCardLimit ? 24 : 0) + 18
}

const groupContainerHeightForChildren = (children: any[]): number => {
    const layout = groupContainerLayout(children)
    return groupContainerHeaderHeight + layout.height + (layout.more > 0 ? 24 : 0) + 18
}

interface GroupContainerLayoutItem {
    node: any
    x: number
    y: number
    width: number
    height: number
}

interface GroupContainerNetworkItem {
    node: Node
    x: number
    y: number
    width: number
    height: number
}

interface GroupContainerDrilldownLayout {
    items: Array<GroupContainerLayoutItem>
    networkItems: Array<GroupContainerNetworkItem>
    height: number
    more: number
}

export enum LinkTagState {
    Hidden = 1,
    EventBased,
    Visible
}

interface NodeState {
    expanded: boolean
    selected: boolean
    mouseover: boolean
    groupOffset: number
    groupFullSize: boolean
}

export class Node {
    id: string
    tags: Array<string>
    data: any
    weight: number | ((node: Node) => number)
    children: Array<Node>
    state: NodeState
    parent: Node | null
    revision: number
    type: 'node'

    constructor(id: string, tags: Array<string>, data: any, state?: NodeState, weight?: number | ((node: Node) => number)) {
        this.id = id
        this.tags = tags
        this.data = data
        this.weight = weight || 0
        this.children = new Array<Node>()
        this.state = state || Topology.defaultState()
        this.type = 'node'
    }

    getWeight(): number {
        var weight = typeof this.weight === "function" ? this.weight(this) : this.weight
        var parentWeight = this.parent ? this.parent.getWeight() : 0

        if (!weight || weight < parentWeight) {
            weight = parentWeight
        }

        return weight
    }
}

interface LinkState {
    selected: boolean
}

export class Link {
    id: string
    tags: Array<string>
    source: Node
    target: Node
    data: any
    state: LinkState
    revision: number
    type: 'link'

    constructor(id: string, tags: Array<string>, source: Node, target: Node, data: any, state: LinkState) {
        this.id = id
        this.tags = tags
        this.source = source
        this.target = target
        this.data = data
        this.type = 'link'
        this.state = state
    }
}

interface VMGroupNavigatorProps {
    title: string
    nodes: Node[]
    selectedIDs: Set<string>
    search: string
    displayName: (node: Node) => string
    status: (node: Node) => { label: string, className: string, kind: "ok" | "bad" | "warning" | "unknown" }
    onSearchChange: (value: string) => void
}

class VMGroupNavigator extends React.PureComponent<VMGroupNavigatorProps> {
    private nodeIP(node: Node): string {
        const data = node.data || {}
        const value = data.IP || data.IPV4 || data.Address || data.MgtAddr || ""
        return Array.isArray(value) ? String(value[0] || "") : String(value || "")
    }

    private filteredNodes() {
        const search = this.props.search.trim().toLowerCase()
        return this.props.nodes.filter((node) => {
            const name = this.props.displayName(node)
            return !search || name.toLowerCase().indexOf(search) >= 0
        })
    }

    private stopTopologyEvent(event: React.SyntheticEvent<HTMLElement>, preventDefault = false) {
        if (preventDefault) {
            event.preventDefault()
        }
        event.stopPropagation()
    }

    render() {
        const filtered = this.filteredNodes()

        return (
            <Card
                className="topology-vm-navigator-card"
                bordered={true}
                onMouseDown={(event) => this.stopTopologyEvent(event)}
                onMouseOver={(event) => this.stopTopologyEvent(event)}
                onMouseOut={(event) => this.stopTopologyEvent(event)}
                onClick={(event) => this.stopTopologyEvent(event)}
                onWheel={(event) => this.stopTopologyEvent(event)}>
                <div className="topology-vm-navigator-header">
                    <div className="topology-vm-navigator-title-area">
                        <span className="topology-vm-navigator-icon">
                            <span className="topology-vm-navigator-icon-glyph">{"\uf108"}</span>
                        </span>
                        <span className="topology-vm-navigator-heading">
                            <Typography.Text className="topology-vm-navigator-title" ellipsis={true}>{this.props.title}</Typography.Text>
                            <span className="topology-vm-navigator-summary">
                                <span>{this.props.nodes.length}개</span>
                            </span>
                        </span>
                    </div>
                    <div className="topology-vm-navigator-tools">
                        <span className="topology-vm-navigator-actions">
                            <Button
                                size="small"
                                title="표시된 노드 전체 펼치기"
                                data-group-action="select-all"
                                icon={<span className="fa fas fa-expand" />} />
                            <Button
                                size="small"
                                title="선택 해제"
                                data-group-action="clear-selection"
                                icon={<span className="fa fas fa-times" />} />
                        </span>
                        <Input
                            prefix={<span className="fa fas fa-search" />}
                            placeholder="VM 검색"
                            value={this.props.search}
                            onChange={(event) => this.props.onSearchChange(event.target.value)} />
                    </div>
                </div>
                <div
                    className="topology-vm-navigator-scroll"
                    onWheel={(event) => this.stopTopologyEvent(event)}>
                    <List
                        className="topology-vm-navigator-list"
                        dataSource={filtered}
                        locale={{ emptyText: "표시할 VM이 없습니다." }}
                        renderItem={(node: Node) => {
                            const name = this.props.displayName(node)
                            const status = this.props.status(node)
                            const selected = this.props.selectedIDs.has(node.id)
                            const ip = this.nodeIP(node)
                            return (
                            <List.Item
                                data-node-id={node.id}
                                className={`topology-vm-navigator-item ${selected ? "is-selected" : ""}`}>
                                    <span className={`topology-vm-navigator-dot ${status.className}`} />
                                    <Avatar
                                        className={`topology-vm-navigator-node-avatar ${status.className}`}
                                        shape="square"
                                        icon={<span className="topology-vm-navigator-icon-glyph">{"\uf108"}</span>} />
                                    <span className="topology-vm-navigator-main">
                                        <Typography.Text className="topology-vm-navigator-name" ellipsis={true}>{name}</Typography.Text>
                                        <span className="topology-vm-navigator-meta">
                                            <Tag className={`topology-vm-navigator-status-tag ${status.className}`}>{status.label}</Tag>
                                            {ip && <Typography.Text className="topology-vm-navigator-ip" ellipsis={true}>· {ip}</Typography.Text>}
                                        </span>
                                    </span>
                                    <span className="topology-vm-navigator-arrow">›</span>
                                </List.Item>
                            )
                        }} />
                </div>
            </Card>
        )
    }
}

interface LevelNodes {
    weight: number
    nodes: Array<D3Node>
}

interface BoundingBox {
    x: number
    y: number
    width: number
    height: number
}

interface LevelRect {
    weight: number
    bb: BoundingBox
}

enum WrapperType {
    Normal = 1,
    Hidden,
    Group
}

class NodeWrapper {
    id: string
    wrapped: Node
    children: Array<NodeWrapper>
    parent: NodeWrapper | null
    type: WrapperType
    size: Array<number>

    constructor(id: string, type: WrapperType, node: Node, parent: NodeWrapper | null) {
        this.id = id
        this.wrapped = node
        this.parent = parent
        this.children = new Array<NodeWrapper>()
        this.type = type

        if (type === WrapperType.Hidden) {
            this.size = [50, nodeHeight]
        } else {
            const isUserVmNode = node?.data?.Type === "libvirt"
            const isVmInterfaceNode = isTopologyInterfaceData(node?.data)
            const isKubernetesCluster = node?.data?.Manager === "k8s" && node?.data?.Type === "cluster"
            const isKubernetesNode = node?.data?.Manager === "k8s" && node?.data?.Type === "node"
            const isKubernetesNamespace = node?.data?.Manager === "k8s" && node?.data?.Type === "namespace"
            const kubernetesType = node?.data?.Manager === "k8s" ? String(node?.data?.Type || "").toLowerCase() : ""
            const isKubernetesWorkload = ["deployment", "statefulset", "daemonset", "job", "cronjob"].indexOf(kubernetesType) >= 0
            const isKubernetesDenseLayer = isKubernetesWorkload
                || kubernetesType === "pod"
                || kubernetesType === "persistentvolume"
                || kubernetesType === "persistentvolumeclaim"
                || kubernetesType === "storageclass"
            const kubernetesName = String(node?.data?.Name || "")
            const kubernetesCardWidth = kubernetesName.length <= 14 ? topologyCardWidth : topologyMediumCardWidth
            const kubernetesDenseLayerWidth = Math.max(nodeWidth, kubernetesCardWidth + topologySiblingCardGap)
            this.size = [
                isUserVmNode || isVmInterfaceNode
                    ? nodeWidth + userVmHorizontalGapBoost
                    : isKubernetesCluster
                        ? nodeWidth + kubernetesClusterHorizontalGapBoost
                    : isKubernetesNode
                        ? nodeWidth + kubernetesNodeHorizontalGapBoost
                        : isKubernetesNamespace
                            ? nodeWidth + kubernetesNamespaceHorizontalGapBoost
                        : isKubernetesDenseLayer
                            ? kubernetesDenseLayerWidth
                        : nodeWidth,
                isUserVmNode || isVmInterfaceNode
                    ? nodeHeight + userVmVerticalGapBoost
                    : isKubernetesWorkload
                        ? nodeHeight + kubernetesWorkloadVerticalGapBoost
                        : nodeHeight
            ]
        }
    }
}

interface D3Node {
    data: NodeWrapper
    x: number
    y: number
    children: Array<D3Node>
    parent?: D3Node
}

interface Group {
    id: string
    nodes: Array<D3Node>
}

export interface NodeAttrs {
    name: string
    classes: Array<string>
    icon: string
    iconClass: string
    href: string
    badges: Array<BadgeAttrs>
    weight: number
}

export interface LinkAttrs {
    classes: Array<string>
    directed: boolean
    label: string
    icon: string
    iconClass: string
    href: string
}

export interface BadgeAttrs {
    text: string
    iconClass?: string
    fill?: string
    stroke?: string
    className?: string
}

interface Props {
    onClick: () => void
    sortNodesFnc: (node1: Node, node2: Node) => number
    onShowNodeContextMenu: (node: Node) => any
    onNodeSelected: (node: Node, isSelected: boolean) => void
    className: string
    nodeAttrs: (node: Node) => NodeAttrs
    linkAttrs: (link: Link) => LinkAttrs
    weightTitles?: Map<number, string>
    groupType?: (node: Node) => string
    groupName?: (node: Node, count?: number) => string
    groupSize?: number | ((node: Node) => number)
    groupThreshold?: number | ((node: Node) => number)
    nodeVisible?: (node: Node) => boolean
    onLinkSelected: (link: Link, isSelected: boolean) => void
    onLinkTagChange: (tags: Map<string, LinkTagState>) => void
    onNodeClicked: (node: Node) => void
    onNodeDblClicked: (node: Node) => void
    defaultNodeTag?: () => string
    defaultLinkTagMode?: (tag: string) => LinkTagState
    vmNameMap?: Record<string, string>
    vmNetworkMap?: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>>
    onZoomChange?: (zoom: number) => void
}

interface GroupNavigatorFilter {
    search: string
}

/**
 * Topology component. Based on a tree enhanced by multiple levels supports.
 */
export class Topology extends React.Component<Props, {}> {

    private tree: any
    private isCtrlPressed: boolean
    private svgDiv: HTMLElement | null
    private svg: Selection<SVGSVGElement, any, null, undefined>
    private g: Selection<SVGGraphicsElement, {}, null, undefined>
    private gLevels: Selection<SVGGraphicsElement, {}, null, undefined>
    private gLevelLabels: Selection<SVGGraphicsElement, {}, null, undefined>
    private gHieraLinks: Selection<SVGGraphicsElement, {}, null, undefined>
    private gLinkOverlays: Selection<SVGGraphicsElement, {}, null, undefined>
    private gLinks: Selection<SVGGraphicsElement, {}, null, undefined>
    private gLinkLabels: Selection<SVGGraphicsElement, {}, null, undefined>
    private gLinkWraps: Selection<SVGGraphicsElement, {}, null, undefined>
    private gGroups: Selection<SVGGraphicsElement, {}, null, undefined>
    private gGroupButtons: Selection<SVGGraphicsElement, {}, null, undefined>
    private gNodes: Selection<SVGGraphicsElement, {}, null, undefined>
    private gRaisedLinkLabels: Selection<SVGGraphicsElement, {}, null, undefined>
    private gContextMenu: Selection<SVGGraphicsElement, {}, null, undefined>
    private zoom: zoom
    private liner: line
    private showLevelLabelsTimeoutID: number
    private raisedLinkLabelID: string
    private d3nodes: Map<string, D3Node>
    private absTransformX: number
    private absTransformY: number
    private nodeTagActive: string
    private nodeTagCount: Map<string, number>
    private linkTagCount: Map<string, number>
    private invalidated: boolean
    private levelRects: Array<LevelRect>
    private groups: Map<string, NodeWrapper>
    private groupStates: Map<string, NodeState>
    private nodeGroup: Map<string, NodeWrapper>
    private weights: Array<number>
    private visibleLinksCache: Array<Link> | undefined
    private lastVmNameMapRef: Record<string, string> | undefined
    private lastVmNetworkMapRef: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>> | undefined
    private pinnedContainerMiniNodeID: string
    private expandedContainerMiniNodeIDs: Set<string>
    private selectedGroupListNodeIDs: Set<string>
    private groupNavigatorFilters: Map<string, GroupNavigatorFilter>
    private groupNavigatorRenderKeys: Map<string, string>

    root: Node
    nodes: Map<string, Node>
    links: Map<string, Link>
    nodeTagStates: Map<string, boolean>
    linkTagStates: Map<string, LinkTagState>
    weightTitles: Map<number, string>

    constructor(props: Props) {
        super(props)

        if (this.props.weightTitles) {
            this.weightTitles = this.props.weightTitles
        } else {
            this.weightTitles = new Map<number, string>()
        }

        this.tree = flextree();

        this.initTree()

        this.isCtrlPressed = false
        this.showLevelLabelsTimeoutID = 0
        this.raisedLinkLabelID = ""
        this.pinnedContainerMiniNodeID = ""
        this.expandedContainerMiniNodeIDs = new Set<string>()
        this.selectedGroupListNodeIDs = new Set<string>()
        this.groupNavigatorFilters = new Map<string, GroupNavigatorFilter>()
        this.groupNavigatorRenderKeys = new Map<string, string>()
    }
    componentDidMount() {
        select("body")
            .on("keydown.topology", () => {
                if (event.keyCode === 17) {
                    this.isCtrlPressed = true
                }
            })
            .on("keyup.topology", () => {
                if (event.keyCode === 17) {
                    this.isCtrlPressed = false
                }
            })

        this.createSVG()
    }

    componentWillUnmount() {
        select("body")
            .on("keydown.topology", null)
            .on("keyup.topology", null)

        if (this.showLevelLabelsTimeoutID) {
            window.clearTimeout(this.showLevelLabelsTimeoutID)
            this.showLevelLabelsTimeoutID = 0
        }

        if (this.svg) {
            this.svg.on(".zoom", null)
        }
        if (this.svgDiv) {
            select(this.svgDiv).select("svg").remove()
        }
    }

    private onResize(rect: any) {
        if (!this.svg) {
            return
        }
        this.svg
            .attr("width", rect.width)
            .attr("height", rect.height)
    }

    private nodeDisplayNameForGroupList(node: Node): string {
        const attrsName = this.props.nodeAttrs(node).name || node.data?.Name || node.id
        const vmNameMap = this.props.vmNameMap || {}
        if (String(node.data?.Type || "").toLowerCase() === "libvirt") {
            const candidates = [
                attrsName,
                node.data?.Name,
                node.data?.LibvirtName,
                node.data?.UUID,
                node.data?.ID,
                node.data?.ExtID
            ]
                .map((v) => typeof v === "string" ? v.trim() : "")
                .filter((v, idx, arr) => !!v && arr.indexOf(v) === idx)
            for (const key of candidates) {
                if (vmNameMap[key]) {
                    return vmNameMap[key]
                }
            }
        }
        return vmNameMap[attrsName] || attrsName
    }

    private groupNavigatorFilter(groupID: string): GroupNavigatorFilter {
        return this.groupNavigatorFilters.get(groupID) || { search: "" }
    }

    private setGroupNavigatorFilter(groupID: string, patch: Partial<GroupNavigatorFilter>) {
        const current = this.groupNavigatorFilter(groupID)
        this.groupNavigatorFilters.set(groupID, {
            search: patch.search !== undefined ? patch.search : current.search
        })
        this.renderTree()
    }

    private filteredGroupNavigatorNodes(nodes: Node[], groupID: string): Node[] {
        const filter = this.groupNavigatorFilter(groupID)
        const search = filter.search.trim().toLowerCase()
        return nodes.filter((node) => {
            const name = this.nodeDisplayNameForGroupList(node)
            return !search || name.toLowerCase().indexOf(search) >= 0
        })
    }

    private toggleGroupListNode(child: Node) {
        const group = this.nodeGroup.get(child.id)
        this.hideNodeContextMenu()
        if (group) {
            group.wrapped.state.expanded = true
            group.wrapped.state.groupFullSize = false
            group.wrapped.state.groupOffset = 0
        }
        const selected = this.selectedGroupListNodeIDs.has(child.id)
        if (selected) {
            this.selectedGroupListNodeIDs.delete(child.id)
            child.state.selected = false
        } else {
            this.selectedGroupListNodeIDs.add(child.id)
            child.state.selected = true
        }
        this.renderTree()
        this.hideLinks()
    }

    private setGroupListNodes(children: Node[], selected: boolean) {
        this.hideNodeContextMenu()
        children.forEach(child => {
            const group = this.nodeGroup.get(child.id)
            if (group) {
                group.wrapped.state.expanded = true
                group.wrapped.state.groupFullSize = false
                group.wrapped.state.groupOffset = 0
            }
            const alreadySelected = this.selectedGroupListNodeIDs.has(child.id)
            if (selected && !alreadySelected) {
                this.selectedGroupListNodeIDs.add(child.id)
                child.state.selected = true
            }
            if (!selected && alreadySelected) {
                this.selectedGroupListNodeIDs.delete(child.id)
                child.state.selected = false
            }
        })
        this.renderTree()
        this.hideLinks()
    }

    toggleGroupChildDisplay(child: Node) {
        this.toggleGroupListNode(child)
    }

    setGroupChildrenDisplay(children: Node[], visible: boolean) {
        this.setGroupListNodes(children, visible)
    }

    groupVisibleNodeIDs(): Set<string> {
        const ids = new Set(this.selectedGroupListNodeIDs)
        this.groups.forEach((group) => {
            if (!group.wrapped.state.expanded || !group.wrapped.state.groupFullSize) {
                return
            }
            group.wrapped.children
                .filter(child => !isKubernetesPod(child) || isCurrentKubernetesPod(child))
                .forEach((child) => ids.add(child.id))
        })
        return ids
    }

    private createSVG() {
        if (!this.svgDiv) {
            return
        }

        var width = this.svgDiv.clientWidth
        var height = this.svgDiv.clientHeight

        this.svg = select(this.svgDiv).append("svg")
            .attr("width", width)
            .attr("height", height)
            .on("click", () => {
                this.clearRaisedLinkLabel()
                this.hideNodeContextMenu()
                this.props.onClick()
            })

        var defs = this.svg.append("defs")

        defs
            .append("marker")
            .attr("id", "link-marker")
            .attr("viewBox", "-5 -5 10 10")
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("class", "link-marker")
            .attr("d", "M 0,0 m -5,-5 L 5,-5 L 5,5 L -5,5 Z")

        defs
            .append("marker")
            .attr("id", "link-directed-marker")
            .attr("viewBox", "-5 -5 10 10")
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto-start-reverse")
            .append("path")
            .attr("class", "link-marker link-directed-marker")
            .attr("d", "M 0,0 m -5,-5 L 5,0 L -5,5 Z")

        const markerOverlay = (id: string) => {
            defs
                .append("marker")
                .attr("id", id)
                .attr("viewBox", "-5 -5 10 10")
                .attr("markerWidth", 1)
                .attr("markerHeight", 1)
                .attr("orient", "auto")
                .append("path")
                .attr("class", id)
                .attr("d", "M 0,0 m -5,-5 L 5,-5 L 5,5 L -5,5 Z")
        }
        markerOverlay("link-overlay-marker")
        markerOverlay("link-overlay-selected-marker")

        var filter = defs.append("filter")
            .attr("id", "drop-shadow")
            .attr("height", "150%")

        filter.append("feGaussianBlur")
            .attr("in", "SourceGraphic")
            .attr("stdDeviation", 5)
            .attr("result", "blur")

        filter.append("feOffset")
            .attr("in", "blur")
            .attr("dx", 0)
            .attr("dy", 0)
            .attr("result", "offsetBlur")

        var feMerge = filter.append("feMerge")

        feMerge.append("feMergeNode")
            .attr("in", "offsetBlur")
        feMerge.append("feMergeNode")
            .attr("in", "SourceGraphic")

        this.absTransformX = this.absTransformY = 0

        this.zoom = zoom()
            .scaleExtent([0.1, 1.5])
            .on("zoom", () => {
                this.hideAllLevelLabels()
                this.hideNodeContextMenu()
                this.g.attr("transform", event.transform.toString())

                this.absTransformX = event.transform.x * 1 / event.transform.k
                this.absTransformY = event.transform.y * 1 / event.transform.k
                if (this.props.onZoomChange) {
                    this.props.onZoomChange(event.transform.k)
                }
            })
            .on("end", () => {
                if (this.showLevelLabelsTimeoutID) {
                    window.clearTimeout(this.showLevelLabelsTimeoutID)
                }
                this.showLevelLabelsTimeoutID = window.setTimeout(this.showAllLevelLabels.bind(this), 200)
            })

        this.svg.call(this.zoom)
            .on("dblclick.zoom", null)

        this.g = this.svg
            .append("g")

        // levels group
        this.gLevels = this.g.append("g")
            .attr("class", "levels")

        // groups group, yes read it correctly groups group
        this.gGroups = this.g.append("g")
            .attr("class", "groups")

        // hiera links group
        this.gHieraLinks = this.g.append("g")
            .attr("class", "hiera-links")

        // link overlay group, like highlight
        this.gLinkOverlays = this.g.append("g")
            .attr("class", "link-overlays")

        // non-hiera links group
        this.gLinks = this.g.append("g")
            .attr("class", "links")

        // link labels
        this.gLinkLabels = this.g.append("g")
            .attr("class", "link-labels")

        // link wrapper group, used to catch mouse event
        this.gLinkWraps = this.g.append("g")
            .attr("class", "link-wraps")

        // groups group, yes read it correctly groups group
        this.gGroupButtons = this.g.append("g")
            .attr("class", "group-buttons")

        // nodes group
        this.gNodes = this.g.append("g")
            .attr("class", "nodes")

        // levels group
        this.gLevelLabels = this.g.append("g")
            .attr("class", "level-labels")

        // clicked link labels are copied here so they can be read above nodes.
        this.gRaisedLinkLabels = this.g.append("g")
            .attr("class", "raised-link-labels")

        // context menu group
        this.gContextMenu = this.svg.append("g")
            .attr("class", "context-menu")

        this.liner = line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(curveCardinalClosed.tension(0.7))
    }

    static defaultState(): NodeState {
        return { expanded: false, selected: false, mouseover: false, groupOffset: 0, groupFullSize: false }
    }

    resetTree() {
        this.unpinNodes()
        this.unselectAllNodes()
        this.unselectAllLinks()
        this.initTree()
        this.renderTree()
    }

    private initTree() {
        var state = { expanded: true, selected: false, mouseover: false, groupOffset: 0, groupFullSize: false }

        this.root = new Node("root", ["root"], { Name: "root", Type: "root" }, state, 0)

        this.nodes = new Map<string, Node>()
        this.nodeTagStates = new Map<string, boolean>()
        this.nodeTagCount = new Map<string, number>()
        this.nodeTagActive = this.props.defaultNodeTag ? this.props.defaultNodeTag() : ""

        this.links = new Map<string, Link>()
        this.linkTagStates = new Map<string, LinkTagState>()
        this.linkTagCount = new Map<string, number>()

        this.levelRects = new Array<LevelRect>()

        this.groups = new Map<string, NodeWrapper>()
        this.groupStates = new Map<string, NodeState>()
        this.nodeGroup = new Map<string, NodeWrapper>()

        this.weights = new Array<number>()

        this.invalidated = true
    }

    setLinkTagState(tag: string, state: LinkTagState) {
        this.linkTagStates.set(tag, state)
        this.resetCacheAndRenderTree()
    }

    expandAllNodes() {
        // 1. 모든 실제 Node 트리를 전부 expanded 처리
        const expand = (node: Node | null) => {
            if (!node) {
                return
            }

            node.state.expanded = true
            node.children.forEach(child => expand(child))
        }

        // 1차: 실제 Node 트리를 전부 펼친 상태로 한 번 렌더링해서
        //      모든 그룹(NodeWrapper)과 groupStates 엔트리를 생성합니다.
        expand(this.root)
        this.invalidated = true
        this.resetCacheAndRenderTree()

        // 2차: 이제 groupStates 안에 새로 생성된 그룹 상태까지 모두 들어왔으므로
        //      여기에서 "완전 펼침" 설정을 일괄 적용합니다.
        this.groupStates.forEach((state, groupID) => {
            state.expanded = true
            state.groupFullSize = true
            state.groupOffset = 0
            const group = this.groups.get(groupID)
            if (group) this.setFullGroupSelection(group.wrapped, true)
        })

        // 3차: 그룹 상태 변경을 반영해서 다시 한 번 전체 토폴로지를 렌더링합니다.
        this.invalidated = true
        this.resetCacheAndRenderTree()
    }

    // 전체 토폴로지를 한 번에 접는 기능입니다.
    // - root 아래의 모든 Node.expanded 를 false 로
    // - 그룹 상태(groupStates)도 모두 접힌 상태로 초기화합니다.
    collapseAllNodes() {
        // 1) 실제 Node 트리 전체를 접기 (root 는 보존)
        const collapse = (node: Node | null, isRoot: boolean) => {
            if (!node) {
                return
            }

            // root 자체는 그대로 두고, 그 아래부터 모두 접습니다.
            if (!isRoot) {
                node.state.expanded = false
            }

            node.children.forEach(child => collapse(child, false))
        }

        collapse(this.root, true)

        // 2) 그룹 상태(NodeWrapper 에 대응되는 groupStates)도 모두 접기
        this.groupStates.forEach(state => {
            state.expanded = false
            state.groupFullSize = false
            state.groupOffset = 0
        })
        this.selectedGroupListNodeIDs.forEach(nodeID => {
            const node = this.nodes.get(nodeID)
            if (node) node.state.selected = false
        })
        this.selectedGroupListNodeIDs.clear()

        // 3) 전체 토폴로지 다시 그리기
        this.invalidated = true
        this.resetCacheAndRenderTree()
    }

    activeNodeTag(tag: string) {
        for (const [key, state] of this.nodeTagStates.entries()) {
            this.nodeTagStates.set(key, false)
        }
        if (this.nodeTagStates.has(tag)) {
            this.nodeTagStates.set(tag, true)
            this.nodeTagActive = tag
        } else {
            this.nodeTagStates.set(this.nodeTagActive, true)
        }
        this.invalidate()
    }

    activateNodeTagForNodes(nodeIDs: string[]): boolean {
        for (const id of nodeIDs) {
            const node = this.nodes.get(id)
            if (!node) {
                continue
            }
            const tag = node.tags.find((candidate) => this.nodeTagStates.has(candidate))
            if (!tag) {
                continue
            }
            if (this.nodeTagStates.get(tag)) {
                return false
            }
            this.activeNodeTag(tag)
            return true
        }
        return false
    }

    private resetCacheAndRenderTree() {
        // invalidate link cache
        this.visibleLinksCache = undefined

        this.renderTree()
    }

    private invalidate() {
        // invalidate the whole topology
        this.invalidated = true

        this.resetCacheAndRenderTree()
    }

    private updateWeighs(node: Node) {
        var weight = node.getWeight()
        if (!this.weights.includes(weight)) {
            this.weights.push(weight)
            this.weights = this.weights.sort((a, b) => a - b)
        }
    }

    addNode(id: string, tags: Array<string>, data: any, weight: number | ((node: Node) => number)): Node {
        var node = new Node(id, tags, data, Topology.defaultState(), weight)
        this.nodes.set(id, node)

        tags.forEach(tag => {
            if (!this.nodeTagActive) {
                this.nodeTagActive = tag
            }

            var count = this.nodeTagCount.get(tag) || 0
            this.nodeTagCount.set(tag, count + 1)

            if (!this.nodeTagStates.has(tag)) {
                this.nodeTagStates.set(tag, this.nodeTagActive == tag)
            }
        })

        this.updateWeighs(node)

        this.invalidated = true

        return node
    }

    updateNode(id: string, data: any): Node | null {
        var node = this.nodes.get(id)
        if (!node) {
            return null
        }
        var prevWeight = node.getWeight()
        node.data = data

        // check whether the new data have change the weight
        // in order to trigger a recalculation
        if (prevWeight !== node.getWeight()) {
            this.updateWeighs(node)

            this.invalidated = true
        }

        // keep it internal for now, don't use real revision number
        node.revision++

        return node
    }

    private getRandKey(m: Map<any, any>): any {
        let keys = Array.from(m.keys());
        return keys[Math.floor(Math.random() * keys.length)];
    }

    delNode(id: string) {
        var node = this.nodes.get(id)
        if (!node) {
            return
        }

        if (node.parent) {
            node.parent.children = node.parent.children.filter(c => node && c.id !== node.id)
        }

        for (const [id, link] of this.links.entries()) {
            if (link.source === node || link.target === node) {
                this.links.delete(id)
            }
        }

        // remove tags if needed
        node.tags.forEach(tag => {
            var count = this.nodeTagCount.get(tag) || 0
            if (!count) {
                this.nodeTagCount.delete(tag)
                this.nodeTagStates.delete(tag)

                if (this.nodeTagActive == tag) {
                    let tag = this.getRandKey(this.nodeTagStates)
                    this.nodeTagStates.set(tag, true)
                }
            } else {
                this.nodeTagCount.set(tag, count - 1)
            }
        })

        this.nodes.delete(node.id)

        this.invalidated = true
    }

    setParent(child: Node, parent: Node) {
        // remove from previous parent if needed
        if (child.parent) {
            child.parent.children = child.parent.children.filter(c => c.id !== child.id)
        }

        parent.children.push(child)
        child.parent = parent

        this.invalidated = true
    }

    addLink(id: string, node1: Node, node2: Node, tags: Array<string>, data: any) {
        this.links.set(id, new Link(id, tags, node1, node2, data, { selected: false }))

        tags.forEach(tag => {
            var count = this.linkTagCount.get(tag) || 0
            this.linkTagCount.set(tag, count + 1)

            if (!this.linkTagStates.has(tag)) {
                let mode = this.props.defaultLinkTagMode ? this.props.defaultLinkTagMode(tag) : LinkTagState.EventBased
                this.linkTagStates.set(tag, mode)
            }
        })

        // invalidate link cache
        this.visibleLinksCache = undefined
    }

    updateLink(id: string, data: any): boolean {
        var link = this.links.get(id)
        if (link) {
            link.data = link.data?.KubernetesPlacementLink
                ? { ...data, KubernetesPlacementLink: true }
                : data

            // just increase for now, do not use real revision number
            link.revision++

            // invalidate link cache
            this.visibleLinksCache = undefined

            return true
        }
        return false
    }

    delLink(id: string) {
        var link = this.links.get(id)
        if (link) {
            this.links.delete(id)

            // remove tags if needed
            link.tags.forEach(tag => {
                var count = this.linkTagCount.get(tag) || 0
                if (count <= 1) {
                    this.linkTagCount.delete(tag)
                    this.linkTagStates.delete(tag)
                } else {
                    this.linkTagCount.set(tag, count - 1)
                }
            })
            this.visibleLinksCache = undefined
        }
    }

    // group nodes
    private groupify(node: NodeWrapper): Map<string, NodeWrapper> {
        var groups = new Map<string, NodeWrapper>()

        const primitiveScopeValue = (value: any): string => typeof value === "string" ? value.trim() : ""
        const kubernetesGroupScope = (child: Node, groupParent?: Node): { label: string, clusterName: string, namespaceName: string, workloadName: string } => {
            const collectedClusterName = primitiveScopeValue(child.data?.ClusterName || child.data?.clusterName || child.data?.K8s?.ClusterName || child.data?.Cluster)
            const collectedNamespaceName = primitiveScopeValue(child.data?.Namespace || child.data?.K8s?.Namespace || child.data?.K8s?.Extra?.ObjectMeta?.Namespace)
            let clusterName = ""
            let namespaceName = ""
            let workloadName = ""
            // A topology group is created under `groupParent`. Prefer that
            // rendered hierarchy over the source node's parent, which can point
            // to an intermediate or stale object after the tree is cloned.
            let parent: Node | null | undefined = groupParent || child.parent
            while (parent) {
                const parentType = String(parent.data?.Type || "").toLowerCase()
                const parentName = primitiveScopeValue(parent.data?.Name)
                if (!clusterName && parentType === "cluster") clusterName = parentName
                if (!namespaceName && parentType === "namespace") namespaceName = parentName
                if (!workloadName && ["deployment", "statefulset", "daemonset", "job", "cronjob"].indexOf(parentType) >= 0) {
                    workloadName = parentName
                }
                parent = parent.parent
            }

            clusterName = clusterName || collectedClusterName
            namespaceName = namespaceName || collectedNamespaceName

            const childType = String(child.data?.Type || "").toLowerCase()
            let label = ""
            if (childType === "cluster") {
                label = ""
            } else if (childType === "node" || childType === "namespace") {
                label = clusterName
            } else if (childType === "pod") {
                label = workloadName || namespaceName || clusterName
            } else {
                label = namespaceName || clusterName
            }
            return { label, clusterName, namespaceName, workloadName }
        }
        var nodeTypeGID = (node: Node, child: Node): [string, string] | undefined => {
            var nodeType = this.props.groupType ? this.props.groupType(child) : child.data.Type
            if (!nodeType) {
                return
            }
            var gid = node.id + "_" + nodeType + "_" + child.getWeight()

            return [nodeType, gid]
        }
        const bypassTopologyGroup = (child: Node): boolean =>
            String(child.data?.Manager || '').toLowerCase() === 'k8s'
            && String(child.data?.Type || '').toLowerCase() === 'pod'

        // dispatch node per groups
        node.children.forEach(child => {
            // Kubernetes Pods preserve the real
            // Namespace -> Workload Controller -> Pod hierarchy. They must
            // never be wrapped in an intermediate Pod Group, regardless of
            // current count or terminated history.
            if (bypassTopologyGroup(child.wrapped)) {
                return
            }
            var ntg = nodeTypeGID(node.wrapped, child.wrapped)
            if (!ntg) {
                return
            }
            var [nodeType, gid] = ntg

            var wrapper = groups.get(gid)
            if (!wrapper) {
                var state = this.groupStates.get(gid) || { expanded: false, selected: false, mouseover: false, groupOffset: 0, groupFullSize: false }
                this.groupStates.set(gid, state)

                var name = this.props.groupName ? this.props.groupName(child.wrapped) : nodeType + '(s)'

                const groupData: any = { Name: name, Type: nodeType, IsTopologyGroup: true }
                if (child.wrapped.data.Manager === "k8s") {
                    groupData.Manager = child.wrapped.data.Manager
                    groupData.Type = child.wrapped.data.Type || nodeType
                    groupData.GroupType = nodeType
                    const scope = kubernetesGroupScope(child.wrapped, node.wrapped)
                    groupData.GroupScopeLabel = scope.label
                    groupData.GroupClusterName = scope.clusterName
                    groupData.GroupNamespaceName = scope.namespaceName
                    groupData.GroupWorkloadName = scope.workloadName
                }

                var wrapped = new Node(gid, [], groupData, state, () => { return child.wrapped.getWeight() })
                wrapper = new NodeWrapper(gid, WrapperType.Group, wrapped, node)
            }

            child.wrapped.tags.forEach(tag => {
                if (wrapper && !wrapper.wrapped.tags.includes(tag)) {
                    wrapper.wrapped.tags.push(tag)
                }
            })

            wrapper.wrapped.children.push(child.wrapped)
            wrapper.children.push(child)

            groups.set(gid, wrapper)
        })

        groups.forEach(wrapper => {
            const firstChild = wrapper.wrapped.children[0]
            if (firstChild && this.props.groupName) {
                wrapper.wrapped.data.Name = this.props.groupName(firstChild, wrapper.wrapped.children.length)
            }
        })

        var pushed = new Set<string>()

        // iterate one mode time children in order to
        // if a group doesn't reach the groupSize, then remove the group
        // and let the node as it is. If the group reach the groupSize
        // set the children according to the offset and the groupSize or
        // the expand parameter.
        var children = new Array<NodeWrapper>()
        node.children.forEach(child => {
            if (bypassTopologyGroup(child.wrapped)) {
                children.push(child)
                return
            }
            var ntg = nodeTypeGID(node.wrapped, child.wrapped)
            if (!ntg) {
                return
            }
            var [_, gid] = ntg

            if (pushed.has(gid)) {
                return
            }

            var wrapper = groups.get(gid)
            const configuredGroupSize = this.props.groupThreshold === undefined ? this.props.groupSize : this.props.groupThreshold
            var groupSize = typeof configuredGroupSize === 'function' ? configuredGroupSize(child.wrapped) : configuredGroupSize || defaultGroupSize
            const hasTerminatedPodHistory = !!wrapper && wrapper.wrapped.children.some(groupChild =>
                isKubernetesPod(groupChild) && !isCurrentKubernetesPod(groupChild))
            if (wrapper && (wrapper.wrapped.children.length > groupSize || hasTerminatedPodHistory)) {
                children.push(wrapper)
                if (wrapper.wrapped.state.expanded) {
                    const currentChildren = wrapper.children.filter(groupChild =>
                        !isKubernetesPod(groupChild.wrapped) || isCurrentKubernetesPod(groupChild.wrapped))
                    const visibleChildren = wrapper.wrapped.state.groupFullSize
                        ? currentChildren
                        : wrapper.children.filter(child => this.selectedGroupListNodeIDs.has(child.wrapped.id))
                    children = children.concat(visibleChildren)
                    wrapper.wrapped.state.groupOffset = 0
                }
                wrapper.size = [nodeWidth, nodeHeight]
                wrapper.wrapped.children.forEach(child => {
                    if (wrapper) {
                        this.nodeGroup.set(child.id, wrapper)
                    }
                })

                wrapper.children = []

                pushed.add(gid)
            } else {
                groups.delete(gid)
                children.push(child)
            }
        })
        node.children = children

        return groups
    }

    // clone using wrapped node
    private cloneTree(node: Node, parent: NodeWrapper | null): [NodeWrapper | null, Array<NodeWrapper> | null] {
        var cloned = new NodeWrapper(node.id, WrapperType.Normal, node, parent)

        var matchTags = node.tags.some(tag => this.nodeTagStates.get(tag))
        const nodeIsVisible = node.id === "root" || !this.props.nodeVisible || this.props.nodeVisible(node)
        // A filtered node must not bypass `nodeVisible` merely because it is
        // collapsed. This is especially important for ownerless/terminated
        // Kubernetes Pods kept under the internal root for detail lookup.
        if (nodeIsVisible && matchTags && !node.state.expanded) {
            return [cloned, null]
        }

        const filteredKubernetesNode = node.id !== "root"
            && String(node.data?.Manager || '').toLowerCase() === 'k8s'
            && !nodeIsVisible
        // Relationship-only Kubernetes resources must not promote their
        // descendants into an execution layer when the resource itself is
        // filtered out.
        if (filteredKubernetesNode) {
            return [null, []]
        }
        if (nodeIsVisible
            && String(node.data?.Manager || '').toLowerCase() === 'k8s'
            && String(node.data?.Type || '').toLowerCase() === 'pod') {
            return [cloned, null]
        }
        node.children.forEach(child => {
            let [subCloned, subChildren] = this.cloneTree(child, cloned)
            if (subCloned) {
                cloned.children.push(subCloned)
            } else if (subChildren) {
                subChildren.forEach(subChild => {
                    subChild.parent = cloned
                    cloned.children.push(subChild)
                })
            }
        })
        if (this.props.sortNodesFnc) {
            cloned.children.sort((a, b) => this.props.sortNodesFnc(a.wrapped, b.wrapped))
        }

        if (!nodeIsVisible) {
            return [null, cloned.children]
        }

        if (node.id === "root" || matchTags) {
            for (const [gid, group] of this.groupify(cloned).entries()) {
                this.groups.set(gid, group)
            }

            return [cloned, null]
        }

        return [null, cloned.children]
    }

    private normalizeTree(node: Node): NodeWrapper | null {
        // return depth of the given layer
        let layerHeight = (node: NodeWrapper, weight: number, currDepth: number): number => {
            if (node.wrapped.getWeight() > weight) {
                return 0
            }

            var maxDepth = currDepth
            node.children.forEach(child => {
                let depth = layerHeight(child, weight, currDepth + 1)
                if (depth > maxDepth) {
                    maxDepth = depth
                }
            })

            return maxDepth
        }

        // re-order tree to add wrapper node in order to separate levels
        let normalizeTreeHeight = (root: NodeWrapper, node: NodeWrapper, weight: number, currDepth: number, cache: { chains: Map<string, { first: NodeWrapper, last: NodeWrapper }> }) => {
            var nodeWeight = node.wrapped.getWeight()
            if (nodeWeight > weight) {
                return
            }

            if (nodeWeight === weight && node.parent && node.parent.wrapped.getWeight() !== weight) {
                let parentDepth = layerHeight(root, node.wrapped.getWeight() - 1, 0)
                if (currDepth > parentDepth) {
                    return
                }
                let path = node.parent.wrapped.id + "/" + nodeWeight

                let first: NodeWrapper, last: NodeWrapper
                let chain = cache.chains.get(path)
                if (chain) {
                    first = chain.first

                    node.parent.children = node.parent.children.filter(d => d !== node)

                    last = chain.last
                } else {
                    first = new NodeWrapper(node.id + "_" + currDepth, WrapperType.Hidden, node.wrapped, node.parent)

                    let children = node.parent.children
                    let index = children.indexOf(node)
                    children[index] = first

                    last = first

                    while (currDepth++ < parentDepth) {
                        let next = new NodeWrapper(node.id + "_" + currDepth, WrapperType.Hidden, node.wrapped, node.parent)

                        last.children = [next]
                        last = next
                    }

                    cache.chains.set(path, { first: first, last: last })
                }
                last.children.push(node)

                return
            }

            node.children.forEach(child => {
                normalizeTreeHeight(root, child, weight, currDepth + 1, cache)
            })
        }

        this.groups.clear()
        this.nodeGroup.clear()

        var [tree, _] = this.cloneTree(node, null)
        if (!tree) {
            return null
        }

        for (let weight of this.weights) {
            let cache = { chains: new Map<string, { first: NodeWrapper, last: NodeWrapper }>() }
            normalizeTreeHeight(tree, tree, weight, 0, cache)
        }

        return tree
    }

    private collapse(node: Node) {
        if (node.state) {
            node.state.expanded = false
        }
        node.children.forEach((child: Node) => this.collapse(child))
    }

    private setFullGroupSelection(groupNode: Node, selected: boolean) {
        groupNode.children.forEach(child => {
            if (selected && isKubernetesPod(child) && !isCurrentKubernetesPod(child)) {
                child.state.selected = false
                this.selectedGroupListNodeIDs.delete(child.id)
                return
            }
            child.state.selected = selected
            if (selected) {
                this.selectedGroupListNodeIDs.add(child.id)
            } else {
                this.selectedGroupListNodeIDs.delete(child.id)
            }
        })
    }

    expand(node: Node) {
        const isGroup = this.groupStates.has(node.id)
        if (node.state.expanded && (!isGroup || node.state.groupFullSize)) {
            this.setFullGroupSelection(node, false)
            this.collapse(node)
            node.state.groupFullSize = false
            node.state.groupOffset = 0
        } else {
            node.state.expanded = true
            if (isGroup) {
                node.state.groupFullSize = true
                node.state.groupOffset = 0
                this.setFullGroupSelection(node, true)
            }
        }

        // invalidate the whole topology rendering
        this.invalidated = true

        this.resetCacheAndRenderTree()
    }

    private hexagon(d: D3Node, size: number) {
        var s32 = (Math.sqrt(3) / 2)

        if (!size) {
            size = 20
        }

        return [
            { "x": size, "y": 0 },
            { "x": size / 2, "y": size * s32 },
            { "x": -size / 2, "y": size * s32 },
            { "x": -size, "y": 0 },
            { "x": -size / 2, "y": -size * s32 },
            { "x": size / 2, "y": -size * s32 }
        ]
    }

    private visibleLinks(): Array<Link> {
        if (this.visibleLinksCache) {
            return this.visibleLinksCache
        }

        var links = new Array<Link>()

        var findVisible = (node: Node | null) => {
            while (node) {
                if (this.d3nodes.get(node.id)) {
                    return node
                }

                // check within groups
                var group = this.nodeGroup.get(node.id)
                if (group) {
                    for (let child of group.wrapped.children) {
                        if (child.id === node.id && this.d3nodes.get(group.id)) {
                            return group.wrapped
                        }
                    }
                }

                node = node.parent
            }
        }

        // clear present tags map
        var tagPresent = new Map<string, boolean>()

        this.links.forEach((link: Link) => {
            if (link.data?.KubernetesPlacementLink) {
                // Node-Pod scheduling is a relationship shown in details, not a
                // topology edge in the OwnerReference execution hierarchy.
                return
            }
            const sourceKubernetesRelationship = String(link.source.data?.Manager || '').toLowerCase() === 'k8s'
                && this.props.nodeVisible
                && !this.props.nodeVisible(link.source)
            const targetKubernetesRelationship = String(link.target.data?.Manager || '').toLowerCase() === 'k8s'
                && this.props.nodeVisible
                && !this.props.nodeVisible(link.target)
            if (sourceKubernetesRelationship || targetKubernetesRelationship) {
                return
            }

            var source = findVisible(link.source)
            var target = findVisible(link.target)

            if (source && target && source.id !== "root" && target.id !== "root" && source !== target) {
                for (let tag of link.tags) {
                    tagPresent.set(tag, true)
                }

                // at least one tag is present
                if (link.tags.some(tag => this.linkTagStates.get(tag) !== LinkTagState.Hidden)) {
                    links.push(new Link(link.id, link.tags, source, target, {
                        ...link.data,
                        __sourceNodeID: link.source.id,
                        __targetNodeID: link.target.id
                    }, link.state))
                }
            }
        })

        // build link tag present on the current topology view
        var tags = new Map<string, LinkTagState>()
        this.linkTagStates.forEach((v, k) => {
            if (tagPresent.get(k)) {
                tags.set(k, v)
            }
        })

        this.props.onLinkTagChange(tags)

        // set the cache
        this.visibleLinksCache = links

        return links
    }

    private sceneSizeX() {
        var bb = Array<number>()
        var first = true

        Array.from(this.d3nodes.values()).forEach(node => {
            if (first == true || bb[0] > node.x) {
                bb[0] = node.x
            }
            if (first == true || bb[1] < node.x) {
                bb[1] = node.x
            }

            first = false
        })

        return bb
    }

    private nodesBB(d3nodes: Array<D3Node>): BoundingBox | null {
        if (d3nodes.length === 0) {
            return null
        }

        var node0 = d3nodes[0]
        const node0Width = node0.data.size ? node0.data.size[0] : nodeWidth
        const node0Height = node0.data.size ? node0.data.size[1] : nodeHeight
        var minX = node0.x - node0Width / 2
        var maxX = node0.x + node0Width / 2
        var minY = node0.y - node0Height / 2
        var maxY = node0.y + node0Height / 2

        for (let node of d3nodes) {
            const width = node.data.size ? node.data.size[0] : nodeWidth
            const height = node.data.size ? node.data.size[1] : nodeHeight
            const left = node.x - width / 2
            const right = node.x + width / 2
            const top = node.y - height / 2
            const bottom = node.y + height / 2

            if (minX > left) {
                minX = left
            }
            if (maxX < right) {
                maxX = right
            }
            if (minY > top) {
                minY = top
            }
            if (maxY < bottom) {
                maxY = bottom
            }
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        }
    }

    private levelRect(levelNodes: LevelNodes): LevelRect | null {
        if (!this.svgDiv) {
            return null
        }

        var node0 = levelNodes.nodes[0]
        var minY = node0.y, maxY = node0.y

        for (let node of levelNodes.nodes) {
            if (minY > node.y) {
                minY = node.y
            }
            if (maxY < node.y) {
                maxY = node.y
            }
        }

        var gBB = this.sceneSizeX()
        const margin = nodeHeight / 2

        var width = this.svgDiv.clientWidth * 10

        return {
            weight: levelNodes.weight,
            bb: {
                x: gBB[0] - width,
                y: minY - margin,
                width: (gBB[1] - gBB[0]) + width * 2,
                height: maxY - minY + margin * 2
            }
        }
    }

    private updateLevelRects(levels: Array<LevelNodes>) {
        this.levelRects = new Array<LevelRect>()

        var prevY = 0
        levels.reverse().forEach(levelNodes => {
            var rect = this.levelRect(levelNodes)
            if (rect) {
                // ensure there is no overlap between two zones
                if (prevY && rect.bb.y + rect.bb.height > prevY) {
                    rect.bb.height = prevY - rect.bb.y
                }
                this.levelRects.push(rect)

                prevY = rect.bb.y
            }
        })
    }

    private levelNodes(): Array<LevelNodes> {
        var levelNodes = new Map<number, LevelNodes>()
        Array.from(this.d3nodes.values()).forEach(node => {
            if (node.data.wrapped !== this.root && node.data.type !== WrapperType.Hidden) {
                var arr = levelNodes.get(node.data.wrapped.getWeight())
                if (!arr) {
                    arr = { weight: node.data.wrapped.getWeight(), nodes: [node] }
                    levelNodes.set(node.data.wrapped.getWeight(), arr)
                } else {
                    arr.nodes.push(node)
                }
            }
        })

        var levels = Array.from(levelNodes.values())
        levels.sort(function (a: LevelNodes, b: LevelNodes) {
            return a.weight - b.weight
        })

        return levels
    }

    private compactVmLayerKind(node: D3Node): 'system' | 'router' | undefined {
        const title = this.weightTitles.get(node.data.wrapped.getWeight()) || ''
        if (/system vm|시스템 가상머신/i.test(title)) return 'system'
        if (/virtual router|가상 라우터/i.test(title)) return 'router'
        return undefined
    }

    private topologyLayoutCardWidth(node: D3Node): number {
        const wrapped = node.data.wrapped
        const attrsName = String(this.props.nodeAttrs(wrapped).name || wrapped.data?.Name || '')
        const displayName = this.props.vmNameMap?.[attrsName] || attrsName
        const longestLineLength = displayName.split("\n").reduce((length, line) => Math.max(length, line.length), 0)
        return longestLineLength <= 14 ? topologyCardWidth : topologyMediumCardWidth
    }

    private shiftHierarchySubtreeX(node: D3Node, delta: number) {
        if (!delta) return
        node.x += delta
        ;(node.children || []).forEach(child => this.shiftHierarchySubtreeX(child, delta))
    }

    /**
     * System VM and virtual-router layers are compacted by their nearest visible
     * parent. The wider of the two child bundles determines the parent slot, so
     * sparse groups no longer inherit an equal share of the full layer width.
     */
    private compactSystemVmRouterLayout(root: any) {
        type LayerKind = 'system' | 'router'
        interface Bundle {
            kind: LayerKind
            parent?: D3Node
            items: D3Node[]
            width: number
        }
        interface Slot {
            parent?: D3Node
            bundles: Map<LayerKind, Bundle>
            width: number
            desiredCenter: number
            center: number
        }

        const descendants = root.descendants() as D3Node[]
        const bundles = new Map<string, Map<LayerKind, Bundle>>()
        const nearestVisibleParent = (node: D3Node): D3Node | undefined => {
            let parent = node.parent
            while (parent && (parent.data.type === WrapperType.Hidden || parent.data.wrapped === this.root)) {
                if (parent.data.wrapped === this.root) return undefined
                parent = parent.parent
            }
            return parent
        }

        descendants.forEach(node => {
            if (node.data.type === WrapperType.Hidden || node.data.wrapped === this.root) return
            const kind = this.compactVmLayerKind(node)
            if (!kind) return
            const parent = nearestVisibleParent(node)
            const parentKey = parent?.data.id || '__root__'
            let parentBundles = bundles.get(parentKey)
            if (!parentBundles) {
                parentBundles = new Map<LayerKind, Bundle>()
                bundles.set(parentKey, parentBundles)
            }
            let bundle = parentBundles.get(kind)
            if (!bundle) {
                bundle = { kind, parent, items: [], width: 0 }
                parentBundles.set(kind, bundle)
            }
            bundle.items.push(node)
        })

        const slots = new Array<Slot>()
        bundles.forEach(parentBundles => {
            let parent: D3Node | undefined
            let width = 0
            let itemCenterTotal = 0
            let itemCount = 0
            parentBundles.forEach(bundle => {
                bundle.items.sort((a, b) => a.x - b.x)
                bundle.width = bundle.items.reduce((total, item, index) => (
                    total + this.topologyLayoutCardWidth(item) + (index > 0 ? compactVmNodeGap : 0)
                ), 0)
                parent = parent || bundle.parent
                width = Math.max(width, bundle.width)
                bundle.items.forEach(item => {
                    itemCenterTotal += item.x
                    itemCount += 1
                })
            })
            if (parent) width = Math.max(width, this.topologyLayoutCardWidth(parent))
            const desiredCenter = parent?.x ?? (itemCount ? itemCenterTotal / itemCount : 0)
            slots.push({ parent, bundles: parentBundles, width, desiredCenter, center: desiredCenter })
        })

        if (!slots.length) return
        slots.sort((a, b) => a.desiredCenter - b.desiredCenter)
        const totalWidth = slots.reduce((total, slot, index) => (
            total + slot.width + (index > 0 ? compactVmGroupGap : 0)
        ), 0)
        const layoutCenter = (slots[0].desiredCenter + slots[slots.length - 1].desiredCenter) / 2
        let slotCursor = layoutCenter - totalWidth / 2

        slots.forEach(slot => {
            slot.center = slotCursor + slot.width / 2
            slotCursor += slot.width + compactVmGroupGap

            slot.bundles.forEach(bundle => {
                let itemCursor = slot.center - bundle.width / 2
                bundle.items.forEach(item => {
                    const cardWidth = this.topologyLayoutCardWidth(item)
                    const nextX = itemCursor + cardWidth / 2
                    this.shiftHierarchySubtreeX(item, nextX - item.x)
                    itemCursor += cardWidth + compactVmNodeGap

                    let ancestor = item.parent
                    while (ancestor && ancestor !== slot.parent) {
                        if (ancestor.data.type === WrapperType.Hidden) ancestor.x = slot.center
                        ancestor = ancestor.parent
                    }
                })
            })

            if (slot.parent) slot.parent.x = slot.center
        })
    }

    private isHostSubtreeRoot(node: D3Node): boolean {
        const data = node.data.wrapped.data || {}
        return node.data.type !== WrapperType.Hidden
            && !data.IsTopologyGroup
            && String(data.Type || '').toLowerCase() === 'host'
    }

    private visibleHostSubtreeNodes(host: D3Node): D3Node[] {
        const nodes = new Array<D3Node>()
        const visit = (node: D3Node) => {
            if (node !== host && this.isHostSubtreeRoot(node)) return
            if (node.data.type !== WrapperType.Hidden) nodes.push(node)
            ;(node.children || []).forEach(visit)
        }
        visit(host)
        return nodes
    }

    private horizontalNodeBounds(nodes: D3Node[]): { left: number, right: number } | undefined {
        if (!nodes.length) return undefined
        let left = Number.POSITIVE_INFINITY
        let right = Number.NEGATIVE_INFINITY
        nodes.forEach(node => {
            const halfWidth = this.topologyLayoutCardWidth(node) / 2
            left = Math.min(left, node.x - halfWidth)
            right = Math.max(right, node.x + halfWidth)
        })
        return Number.isFinite(left) && Number.isFinite(right) ? { left, right } : undefined
    }

    /**
     * Treat every visible physical host as an independent subtree root. Host
     * bounds are packed using their real card extents, never a screen-wide or
     * equal-width slot, and the host card remains centered above its children.
     */
    private compactHostSubtreeLayout(root: any) {
        interface HostSubtree {
            host: D3Node
            left: number
            width: number
            center: number
        }

        // Keep the hierarchy traversal order produced by sortNodesFnc. Sorting
        // again by the post-layout x coordinate makes a render capable of
        // swapping host slots, even when the render was triggered by selection.
        const hostSubtrees = (root.descendants() as D3Node[])
            .filter(node => this.isHostSubtreeRoot(node))
            .map(host => {
                const nodes = this.visibleHostSubtreeNodes(host)
                const childBounds = this.horizontalNodeBounds(nodes.filter(node => node !== host))
                if (childBounds) host.x = (childBounds.left + childBounds.right) / 2
                const bounds = this.horizontalNodeBounds(nodes)
                if (!bounds) return undefined
                return {
                    host,
                    left: bounds.left,
                    width: bounds.right - bounds.left,
                    center: (bounds.left + bounds.right) / 2
                }
            })
            .filter((subtree): subtree is HostSubtree => !!subtree)

        if (!hostSubtrees.length) return
        const totalWidth = hostSubtrees.reduce((total, subtree, index) => (
            total + subtree.width + (index > 0 ? compactHostSubtreeGap : 0)
        ), 0)
        const currentLeft = Math.min(...hostSubtrees.map(subtree => subtree.left))
        const currentRight = Math.max(...hostSubtrees.map(subtree => subtree.left + subtree.width))
        const layoutCenter = (currentLeft + currentRight) / 2
        let cursor = layoutCenter - totalWidth / 2

        hostSubtrees.forEach(subtree => {
            const targetLeft = cursor
            this.shiftHierarchySubtreeX(subtree.host, targetLeft - subtree.left)
            cursor += subtree.width + compactHostSubtreeGap
        })
    }

    private nodeByID(id: string): Node | undefined {
        let n = this.nodes.get(id)
        if (!n) {
            let g = this.groups.get(id)
            if (!g) {
                return g
            }
            n = g.wrapped
        }
        return n
    }

    private unselectAllNodes(exceptVisibleID?: string, notify: boolean = true): Node[] {
        var self = this
        const unselectedNodes: Node[] = []

        this.gNodes.selectAll(".node-selected").each(function () {
            var node = select(this)
            if (!node) {
                return
            }

            var id = node.attr("id")
            if (!id) {
                return
            }
            id = id.replace(/^node-/, '')
            if (id === exceptVisibleID) {
                return
            }
            node.classed("node-selected", false)

            let n = self.nodeByID(id)
            if (!n) {
                return
            }
            n.state.selected = false
            unselectedNodes.push(n)

            if (notify && self.props.onNodeSelected) {
                self.props.onNodeSelected(n, false)
            }
        })

        this.hideLinks()
        this.updateLevelLabelActiveClass()
        return unselectedNodes
    }

    private hideLinks() {
        var self = this

        selectAll("path.link-overlay").each(function (d: Link) {
            const overlayVisible = d.state.selected || self.isLinkNodeSelected(d)
            const displayOpacity = self.linkDisplayOpacity(d)
            select(this).style("opacity", displayOpacity > 0 && (overlayVisible || self.isActiveContainerMiniLink(d)) ? 1 : 0)
        })

        selectAll("path.link").each(function (d: Link) {
            select(this).style("opacity", self.linkDisplayOpacity(d))
        })

        selectAll("g.link-label").each(function (d: Link) {
            select(this).style("opacity", self.linkLabelOpacity(d))
        })
    }

    private clearRaisedLinkLabel() {
        this.raisedLinkLabelID = ""
        if (this.gRaisedLinkLabels) {
            this.gRaisedLinkLabels.selectAll("*").remove()
        }
    }

    private raiseLinkLabel(labelNode: SVGGElement, link: Link) {
        event.stopPropagation()

        if (!this.gRaisedLinkLabels) {
            return
        }

        if (this.raisedLinkLabelID === link.id) {
            this.clearRaisedLinkLabel()
            return
        }

        this.gRaisedLinkLabels.selectAll("*").remove()
        this.raisedLinkLabelID = link.id

        const clonedLabel = labelNode.cloneNode(true) as SVGGElement
        select(clonedLabel)
            .attr("id", "raised-link-label-" + link.id)
            .classed("link-label-raised", true)
            .style("opacity", 1)
            .style("pointer-events", "none")

        const overlayNode = this.gRaisedLinkLabels.node()
        if (overlayNode) {
            overlayNode.appendChild(clonedLabel)
        }
    }

    selectNode(id: string, active: boolean = true, keepExisting: boolean = false) {
        let n = this.nodeByID(id)
        if (!n) {
            return
        }
        const currentVisibleID = this.visibleNodeIDForID(id)
        let unselectedNodes: Node[] = []
        let shouldUnselectLinks = false
        if (!this.isCtrlPressed && active && !keepExisting) {
            unselectedNodes = this.unselectAllNodes(currentVisibleID, false)
            shouldUnselectLinks = true
        }
        const group = this.nodeGroup.get(id)
        if (active && group) {
            const shouldRenderExpandedGroup = !group.wrapped.state.expanded
            group.wrapped.state.expanded = true
            this.pinnedContainerMiniNodeID = id
            // Clicking an already visible child is selection-only. Rebuilding
            // the entire tree here can unnecessarily recalculate node slots.
            if (shouldRenderExpandedGroup) {
                this.renderTree()
            }
        } else if (active) {
            this.pinnedContainerMiniNodeID = ""
        }
        const visibleID = this.visibleNodeIDForID(id)
        const selectionChanged = n.state.selected !== active
        n.state.selected = active
        if (group) {
            group.wrapped.state.selected = false
        }

        select("#node-" + visibleID).classed("node-selected", active)
        if (active) {
            // Keep selected node (including its name label) above overlapping nodes.
            select("#node-" + visibleID).raise()
        }

        // Re-clicking the selected node should reopen the panel without first
        // dispatching an unselect that briefly empties the selection.
        if ((selectionChanged || active) && this.props.onNodeSelected) {
            this.props.onNodeSelected(n, active)
        }
        if (this.props.onNodeSelected) {
            unselectedNodes.forEach((node) => this.props.onNodeSelected!(node, false))
        }
        if (shouldUnselectLinks) {
            this.unselectAllLinks()
        }

        var d = this.d3nodes.get(visibleID)
        if (d) {
            this.highlightNeighborLinks(d, active)
        }
        this.syncContainerMiniCardActiveClass()
        this.syncContainerMiniLinkVisibility()
        this.hideLinks()
        this.updateLevelLabelActiveClass()
    }

    toggleNode(id: string) {
        if (select("#node-" + id).classed("node-selected")) {
            this.selectNode(id, false)
        } else {
            this.selectNode(id, true)
        }
    }

    private unselectAllLinks() {
        var self = this

        this.gLinkOverlays.selectAll(".link-overlay-selected").each(function () {
            var link = select(this)
            if (!link) {
                return
            }
            link.classed("link-overlay-selected", false)

            var id = link.attr("id")
            if (!id) {
                return
            }
            id = id.replace(/^link-overlay-/, '')

            let l = self.links.get(id)
            if (!l) {
                return
            }
            l.state.selected = false

            select("#link-overlay-" + id).style("opacity", self.isLinkVisible(l) ? 1 : 0)
            select("#link-" + id).style("opacity", self.isLinkVisible(l) ? 1 : 0)

            if (self.props.onLinkSelected) {
                self.props.onLinkSelected(l, false)
            }
        })
    }

    selectLink(id: string, active: boolean) {
        let l = this.links.get(id)
        if (!l) {
            return
        }
        l.state.selected = active

        if (!this.isCtrlPressed && active) {
            this.unselectAllNodes()
            this.unselectAllLinks()
        }

        if (!active) {
            this.hideLinks()
        }

        select("#link-overlay-" + id).classed("link-overlay-selected", active)

        if (this.props.onLinkSelected) {
            this.props.onLinkSelected(l, active)
        }
    }

    private viewSize(): { width: number, height: number } {
        var element = this.g.node()
        if (!element) {
            return { width: 0, height: 0 }
        }
        var parent = element.parentElement
        if (!parent) {
            return { width: 0, height: 0 }
        }

        return { width: parent.clientWidth || parent.parentNode.clientWidth, height: parent.clientHeight || parent.parentNode.clientHeight }
    }

    zoomFit() {
        if (!this.gNodes) {
            return
        }

        var element = this.gNodes.node()
        if (!element) {
            return
        }
        var bounds = element.getBBox()

        var viewSize = this.viewSize()

        var width = bounds.width, height = bounds.height
        if (width === 0 || height === 0) {
            return
        }
        var midX = bounds.x + width / 2, midY = bounds.y + height / 2

        const usableWidth = Math.max(320, viewSize.width - topologyLevelLabelSafeInset)
        var scale = 0.65 / Math.max(width / usableWidth, height / viewSize.height)
        if (scale > 1) {
            scale = 1
        }

        this.absTransformX = topologyLevelLabelSafeInset + usableWidth / 2 - midX * scale
        this.absTransformY = viewSize.height / 2 - midY * scale

        var t = zoomIdentity
            .translate(this.absTransformX, this.absTransformY)
            .scale(scale)
        this.svg
            .transition()
            .duration(animDuration)
            .call(this.zoom.transform, t)
    }

    currentZoom(): number {
        if (!this.svg) {
            return 1
        }
        const transform = (this.svg.node() as any).__zoom
        return transform?.k || 1
    }

    setZoomLevel(scale: number) {
        if (!this.svg || !this.g) {
            return
        }
        const current = (this.svg.node() as any).__zoom || zoomIdentity
        const viewSize = this.viewSize()
        const nextScale = Math.max(0.1, Math.min(1.5, scale))
        const centerX = viewSize.width / 2
        const centerY = viewSize.height / 2
        const sourceScale = current.k || 1
        const sourceX = (centerX - current.x) / sourceScale
        const sourceY = (centerY - current.y) / sourceScale
        const nextTransform = zoomIdentity
            .translate(centerX - sourceX * nextScale, centerY - sourceY * nextScale)
            .scale(nextScale)
        this.svg
            .transition()
            .duration(animDuration)
            .call(this.zoom.transform, nextTransform)
    }

    resetZoom() {
        this.setZoomLevel(1)
    }

    private showNodeContextMenu(d: D3Node) {
        if (!this.svgDiv) {
            return
        }

        // hide previous
        this.hideNodeContextMenu()

        if (this.props.onShowNodeContextMenu) {
            var data = this.props.onShowNodeContextMenu(d.data.wrapped)

            var divBB = this.svgDiv.getBoundingClientRect()

            var x = event.x - divBB.left, y = event.y - divBB.top

            var g = this.gContextMenu.append("g")
                .style("opacity", 0)
            g.transition()
                .duration(300)
                .style("opacity", 1)
            var rect = g.append("rect")
                .attr("filter", "url(#drop-shadow)")

            var marginX = 20, marginY = 10, paddingY = 30

            var dy = 0, rects = new Array<Selection<SVGGElement, {}, null, undefined>>()
            for (let item of data) {
                let gItem = g.append("g")
                    .attr("class", "context-menu-item " + item.class)
                let rect = gItem.append("rect")

                let text = gItem.append("text")
                    .classed("disabled", item.disabled)
                    .attr("x", x)
                    .attr("y", y + paddingY)
                    .attr("dy", dy)
                    .text(d => item.text)

                let element = text.node()
                if (!element) {
                    continue
                }

                let bb = element.getBBox()
                rect
                    .attr("x", bb.x - marginX + 1)
                    .attr("y", bb.y - paddingY / 4)
                    .attr("height", bb.height + paddingY / 2)
                    .style("opacity", 0)
                rects.push(rect)

                if (!item.disabled) {
                    gItem.on("click", () => { item.callback(d) })
                    gItem.on("mouseover", () => { rect.style("opacity", 1) })
                    gItem.on("mouseout", () => rect.style("opacity", 0))
                }

                dy += paddingY
            }

            var element = g.node()
            if (!element) {
                return
            }

            var bb = element.getBBox()
            rect
                .attr("x", bb.x - marginX)
                .attr("y", bb.y - marginY)
                .attr("width", bb.width + marginX * 2)
                .attr("height", bb.height + marginY * 2)

            for (let rect of rects) {
                rect.attr("width", bb.width + marginX * 2 - 2)
            }
        }
    }

    private hideNodeContextMenu() {
        this.gContextMenu.select("g").remove()
    }

    private nodeClicked(d: D3Node) {
        event.stopPropagation()
        this.clearRaisedLinkLabel()
        this.hideNodeContextMenu()

        if (this.props.onNodeClicked) {
            this.props.onNodeClicked(d.data.wrapped)
        }
    }

    private nodeDoubleClicked(d: D3Node) {
        event.stopPropagation()

        if (this.props.onNodeDblClicked) {
            this.props.onNodeDblClicked(d.data.wrapped)
        }
    }

    private neighborLinks(node: NodeWrapper, links: Array<Link>): Array<Link> {
        var neighbors = new Array<Link>()

        for (let link of links) {
            if (link.source.id === node.wrapped.id || link.target.id === node.wrapped.id) {
                neighbors.push(link)
            }
        }

        return neighbors
    }

    private showNode(node: Node) {
        const directGroup = this.nodeGroup.get(node.id)
        if (directGroup) {
            directGroup.wrapped.state.expanded = true
            this.pinnedContainerMiniNodeID = node.id
            this.renderTree()
            const groupNode = this.d3nodes.get(directGroup.id)
            if (groupNode) {
                this.moveTo(groupNode.x, groupNode.y)
            }
            this.syncContainerMiniCardActiveClass()
            this.syncContainerMiniLinkVisibility()
            return
        }

        // find next node to expand, can be either a parent of a group
        const nextId = () => {
            var id = "", gid = "", parent: Node | null = node
            while (parent) {
                var group = this.nodeGroup.get(parent.id)
                if (group && !group.wrapped.state.expanded) {
                    gid = group.id
                }
                if (!parent.state.expanded) {
                    id = parent.id
                }
                parent = parent.parent
            }

            return gid ? gid : id
        }

        var id = nextId()
        while (id) {
            var d = this.d3nodes.get(id)
            if (d) {
                this.expand(d.data.wrapped)
            } else {
                // part of a group then slide to the offset
                var group = this.nodeGroup.get(id)
                if (group) {
                    let offset = group.wrapped.children.findIndex(child => child.id === id)
                    if (offset >= 0) {
                        const configuredGroupSize = this.props.groupSize
                        let size = typeof configuredGroupSize === 'function' ? configuredGroupSize(group.wrapped.children[0] || group.wrapped) : configuredGroupSize || defaultGroupSize
                        if (offset + size > group.wrapped.children.length) {
                            offset = group.wrapped.children.length - size
                        }
                    }
                    group.wrapped.state.groupOffset = offset

                    this.renderTree()
                } else {
                    break
                }
            }
            id = nextId()
        }
    }

    private moveTo(x: number, y: number) {
        var scale = 0.8
        var viewSize = this.viewSize()

        var t = zoomIdentity
            .translate(viewSize.width / 2 - scale * x, viewSize.height / 2 - scale * y)
            .scale(scale)
        this.svg
            .transition()
            .duration(800)
            .call(this.zoom.transform, t)
    }

    centerLink(link: Link) {
        var el = select("#link-" + link.id).node()
        var bb = el.getBBox()

        var x = bb.x + (bb.width / 2), y = bb.y + (bb.height / 2)
        this.moveTo(x, y)
    }

    centerNode(node: Node) {
        if (!node) {
            return
        }
        const visibleID = this.visibleNodeIDForID(node.id)
        const d = this.d3nodes.get(visibleID) || this.d3nodes.get(node.id)
        if (!d) {
            return
        }
        this.moveTo(d.x, d.y)
    }

    clearInfrastructureFocus() {
        if (!this.gNodes || !this.gLinks || !this.gLinkOverlays || !this.gLinkLabels) {
            return
        }
        this.gNodes.selectAll("g.node")
            .classed("infra-focus-dim", false)
            .classed("infra-focus-hit", false)
        this.gLinks.selectAll("path.link")
            .classed("infra-focus-dim", false)
            .classed("infra-focus-hit", false)
        this.gLinkOverlays.selectAll("path.link-overlay")
            .classed("infra-focus-dim", false)
            .classed("infra-focus-hit", false)
            .style("opacity", (d: Link) => {
                const displayOpacity = this.linkDisplayOpacity(d)
                if (displayOpacity === 0) {
                    return 0
                }
                return d.state.selected || this.isLinkNodeSelected(d) || this.isActiveContainerMiniLink(d) ? 1 : 0
            })
        this.gLinkLabels.selectAll("g.link-label")
            .classed("infra-focus-dim", false)
            .classed("infra-focus-hit", false)
            .style("opacity", (d: Link) => this.linkLabelOpacity(d))
    }

    focusInfrastructureNodes(nodeIDs: string[], anchorNodeID?: string, revealTargets: boolean = false) {
        this.clearInfrastructureFocus()
        this.unpinNodes()
        const targets = new Set(nodeIDs)
        if (targets.size === 0) {
            this.zoomFit()
            return
        }

        const visibleTargetIDs = new Set<string>()
        const groupsToExpand = new Map<string, NodeWrapper>()
        let expandedContainerGroup = false
        const batchFocus = targets.size > 1
        if (batchFocus) {
            this.pinnedContainerMiniNodeID = ""
            this.expandedContainerMiniNodeIDs.clear()
        }
        if (anchorNodeID) {
            const anchorNode = this.nodes.get(anchorNodeID)
            if (anchorNode && !anchorNode.state.expanded) {
                this.showNode(anchorNode)
            }
        }
        if (revealTargets) {
            targets.forEach((id) => {
                let node: Node | null | undefined = this.nodes.get(id)
                while (node) {
                    node.state.expanded = true
                    node = node.parent
                }
            })

            // A target can be hidden behind multiple automatically generated
            // groups (for example Namespace group -> Service group). Groups at
            // the next depth do not exist until their parent group is rendered,
            // so reveal the target path one level at a time.
            const maxRevealPasses = 12
            for (let pass = 0; pass < maxRevealPasses; pass += 1) {
                this.renderTree()
                let expandedTargetPathGroup = false

                targets.forEach((id) => {
                    let node: Node | null | undefined = this.nodes.get(id)
                    while (node) {
                        const group = this.nodeGroup.get(node.id)
                        if (group && (!group.wrapped.state.expanded || !group.wrapped.state.groupFullSize)) {
                            group.wrapped.state.expanded = true
                            group.wrapped.state.groupFullSize = true
                            expandedTargetPathGroup = true
                        }
                        node = node.parent
                    }
                })

                if (!expandedTargetPathGroup) {
                    break
                }
            }
        }
        targets.forEach((id) => {
            const node = this.nodes.get(id)
            if (node) {
                const group = this.nodeGroup.get(id)
                if (group) {
                    groupsToExpand.set(group.id, group)
                    visibleTargetIDs.add(revealTargets ? id : group.id)
                    if (targets.size === 1) {
                        this.pinnedContainerMiniNodeID = id
                    }
                } else {
                    const visibleID = this.visibleNodeIDForID(id)
                    visibleTargetIDs.add(this.d3nodes.get(visibleID) ? visibleID : this.closestVisibleNodeID(node))
                    if (!batchFocus) {
                        this.showNode(node)
                    }
                }
            }
        })

        groupsToExpand.forEach((group) => {
            group.wrapped.state.expanded = true
            if (revealTargets) {
                group.wrapped.state.groupFullSize = true
            }
            expandedContainerGroup = true
        })

        if (expandedContainerGroup || this.pinnedContainerMiniNodeID || this.expandedContainerMiniNodeIDs.size > 0) {
            this.renderTree()
        }

        visibleTargetIDs.forEach((id) => {
            select("#node-pinned-" + id).style("opacity", 1)
        })

        const visibleTargets = Array.from(visibleTargetIDs)
        const bounds = this.infrastructureLayerBounds(visibleTargets) || this.focusBounds(visibleTargets)
        if (bounds) {
            this.fitBounds(bounds)
        }
        if (this.pinnedContainerMiniNodeID || this.expandedContainerMiniNodeIDs.size > 0) {
            this.syncContainerMiniCardActiveClass()
            this.syncContainerMiniLinkVisibility()
        }
    }

    private infrastructureLayerBounds(nodeIDs: string[]): DOMRect | null {
        const d3nodes = new Array<D3Node>()
        const weights = new Set<number>()
        nodeIDs.forEach((id) => {
            const node = this.nodes.get(id)
            const d3node = this.d3nodes.get(id)
            if (node) {
                weights.add(node.getWeight())
            }
            if (d3node) {
                d3nodes.push(d3node)
            }
        })

        const nodeBounds = this.nodesBB(d3nodes)
        if (!nodeBounds || weights.size === 0) {
            return null
        }

        const levelRects = this.levelRects.filter((level) => weights.has(level.weight))
        if (levelRects.length === 0) {
            return null
        }

        const y1 = Math.min(...levelRects.map((level) => level.bb.y))
        const y2 = Math.max(...levelRects.map((level) => level.bb.y + level.bb.height))
        return {
            x: nodeBounds.x,
            y: y1,
            width: nodeBounds.width,
            height: y2 - y1
        } as DOMRect
    }

    private focusBounds(nodeIDs: string[]): DOMRect | null {
        let bounds: DOMRect | null = null
        nodeIDs.forEach((id) => {
            const element = select("#node-" + id).node() as SVGGraphicsElement | null
            const d = this.d3nodes.get(id)
            if (!element) {
                return
            }
            const bb = element.getBBox()
            const nodeBounds = {
                x: (d ? d.x : 0) + bb.x,
                y: (d ? d.y : 0) + bb.y,
                width: bb.width,
                height: bb.height
            } as DOMRect
            if (!bounds) {
                bounds = nodeBounds
                return
            }
            const x1 = Math.min(bounds.x, nodeBounds.x)
            const y1 = Math.min(bounds.y, nodeBounds.y)
            const x2 = Math.max(bounds.x + bounds.width, nodeBounds.x + nodeBounds.width)
            const y2 = Math.max(bounds.y + bounds.height, nodeBounds.y + nodeBounds.height)
            bounds = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } as DOMRect
        })
        return bounds
    }

    private fitBounds(bounds: DOMRect) {
        var viewSize = this.viewSize()
        var padding = 160
        var width = bounds.width + padding, height = bounds.height + padding
        if (width === 0 || height === 0) {
            return
        }
        var midX = bounds.x + bounds.width / 2, midY = bounds.y + bounds.height / 2
        const usableWidth = Math.max(320, viewSize.width - topologyLevelLabelSafeInset)
        var scale = 0.72 / Math.max(width / usableWidth, height / viewSize.height)
        if (scale > 1) {
            scale = 1
        }
        if (scale < 0.18) {
            scale = 0.18
        }

        this.absTransformX = topologyLevelLabelSafeInset + usableWidth / 2 - midX * scale
        this.absTransformY = viewSize.height / 2 - midY * scale

        var t = zoomIdentity
            .translate(this.absTransformX, this.absTransformY)
            .scale(scale)
        this.svg
            .transition()
            .duration(animDuration)
            .call(this.zoom.transform, t)
    }

    pinNode(node: Node, active) {
        if (active) {
            this.showNode(node)
        }

        var d = this.d3nodes.get(node.id)
        if (!d) {
            return
        }

        select("#node-pinned-" + node.id)
            .style("opacity", active ? 1 : 0)

        if (!active) {
            return
        }

        this.moveTo(d.x, d.y)
    }

    unpinNodes() {
        selectAll("g.node-pinned").style("opacity", 0)
    }

    private isLinkNodeSelected(link: Link): boolean {
        return link.source.state.selected || link.target.state.selected
    }

    private activeContainerNodeID(): string {
        return this.pinnedContainerMiniNodeID
    }

    private activeContainerMiniNodeIDs(): Set<string> {
        const ids = new Set<string>()
        this.expandedContainerMiniNodeIDs.forEach(id => ids.add(id))
        const pinned = this.activeContainerNodeID()
        if (pinned) {
            ids.add(pinned)
        }
        return ids
    }

    private activeContainerLinkNodeIDs(): Set<string> {
        const ids = this.activeContainerMiniNodeIDs()
        const miniIDs = Array.from(ids)
        miniIDs.forEach(id => {
            const node = this.nodes.get(id)
            if (!node) {
                return
            }
            this.vmNetworkDrilldownNodes(node).forEach(network => ids.add(network.id))
        })
        return ids
    }

    private linkOriginalSourceID(link: Link): string {
        return link.data?.__sourceNodeID || link.source.id
    }

    private linkOriginalTargetID(link: Link): string {
        return link.data?.__targetNodeID || link.target.id
    }

    private isContainerProxyLink(link: Link): boolean {
        return this.linkOriginalSourceID(link) !== link.source.id || this.linkOriginalTargetID(link) !== link.target.id
    }

    private isActiveContainerMiniLink(link: Link): boolean {
        const activeIDs = this.activeContainerLinkNodeIDs()
        if (activeIDs.size === 0) {
            return false
        }
        return activeIDs.has(this.linkOriginalSourceID(link)) ||
            activeIDs.has(this.linkOriginalTargetID(link)) ||
            activeIDs.has(link.source.id) ||
            activeIDs.has(link.target.id)
    }

    private isVmNetworkDrilldownNode(node: Node): boolean {
        const data = node.data || {}
        const type = String(data.Type || "").toLowerCase()
        const driver = String(data.Driver || "").toLowerCase()
        const name = String(data.Name || data.IfName || data.Interface || "").toLowerCase()
        if (isTopologyInterfaceData(data)) {
            return true
        }
        if (/^vnet\d+/.test(name)) {
            return true
        }
        return ["tun", "tap", "tuntap", "interface", "veth", "device", "bridge", "ovsbridge", "openvswitch", "port"].includes(type) ||
            ["tun", "tap", "tuntap", "device", "bridge"].includes(driver)
    }

    private vmNetworkDrilldownNodes(vm: Node): Node[] {
        const nodes = new Array<Node>()
        const seen = new Set<string>()
        const add = (node?: Node) => {
            if (!node || node.id === vm.id || seen.has(node.id) || !this.isVmNetworkDrilldownNode(node)) {
                return
            }
            seen.add(node.id)
            nodes.push(node)
        }

        vm.children.forEach(child => add(child))
        this.links.forEach(link => {
            if (link.source.id === vm.id) {
                add(link.target)
            }
            if (link.target.id === vm.id) {
                add(link.source)
            }
        })

        return nodes.slice(0, 8)
    }

    private groupContainerDrilldownLayout(children: any[]): GroupContainerDrilldownLayout {
        const base = groupContainerLayout(children)
        const items = base.items.map(item => ({ ...item }))
        const expandedIDs = new Set<string>()
        this.expandedContainerMiniNodeIDs.forEach(id => expandedIDs.add(id))
        if (expandedIDs.size === 0) {
            return { items, networkItems: [], height: base.height, more: base.more }
        }

        const networkWidth = groupWideMiniCardWidth
        const networkHeight = 44
        const networkGap = 8
        const maxColumns = Math.max(1, Math.floor((groupContainerWidth - groupContainerPaddingX * 2 + networkGap) / (networkWidth + networkGap)))
        const drilldownTopGap = 8
        const drilldownBottomGap = 10

        let yShift = 0
        const networkItems = new Array<GroupContainerNetworkItem>()
        const rowYs = items
            .map(item => item.y)
            .filter((value, idx, arr) => arr.indexOf(value) === idx)
            .sort((a, b) => a - b)

        rowYs.forEach(rowY => {
            const rowItems = items.filter(item => item.y === rowY)
            const rowBottom = Math.max.apply(null, rowItems.map(item => item.y + item.height))
            rowItems.forEach(item => {
                item.y += yShift
            })

            const activeRowItems = rowItems.filter(item => expandedIDs.has(item.node.id))
            let rowDrilldownHeight = 0
            activeRowItems.forEach(activeItem => {
                const networks = this.vmNetworkDrilldownNodes(activeItem.node as Node)
                if (networks.length === 0) {
                    return
                }

                const rowCount = Math.ceil(networks.length / maxColumns)
                const itemDrilldownHeight = drilldownTopGap + rowCount * networkHeight + Math.max(0, rowCount - 1) * networkGap + drilldownBottomGap
                rowDrilldownHeight = Math.max(rowDrilldownHeight, itemDrilldownHeight)

                const rowWidth = Math.min(
                    networks.length,
                    maxColumns
                ) * networkWidth + Math.max(0, Math.min(networks.length, maxColumns) - 1) * networkGap
                const maxX = groupContainerWidth - groupContainerPaddingX * 2 - rowWidth
                const preferredX = activeItem.x + activeItem.width / 2 - rowWidth / 2
                const startX = Math.max(0, Math.min(maxX, preferredX))
                networks.forEach((network, idx) => {
                    const row = Math.floor(idx / maxColumns)
                    const col = idx % maxColumns
                    networkItems.push({
                        node: network,
                        x: startX + col * (networkWidth + networkGap),
                        y: rowBottom + yShift + drilldownTopGap + row * (networkHeight + networkGap),
                        width: networkWidth,
                        height: networkHeight
                    })
                })
            })

            if (rowDrilldownHeight > 0) {
                yShift += rowDrilldownHeight
            }
        })

        return { items, networkItems, height: base.height + yShift, more: base.more }
    }

    private groupContainerHeightForGroup(children: any[]): number {
        const layout = this.groupContainerDrilldownLayout(children)
        return groupContainerHeaderHeight + layout.height + (layout.more > 0 ? 24 : 0) + 18
    }

    private groupListHeight(count: number): number {
        const rows = Math.min(count, groupListVisibleCount)
        const rowGaps = rows > 0 ? rows - 1 : 0
        const scrollVerticalPadding = 14
        const cardBorderAllowance = 2
        return groupListHeaderHeight + rows * groupListRowHeight + rowGaps * 8 + scrollVerticalPadding + cardBorderAllowance
    }

    private linkDisplayOpacity(link: Link): number {
        if (!this.isLinkVisible(link)) {
            return 0
        }

        const activeIDs = this.activeContainerMiniNodeIDs()
        if (activeIDs.size > 0) {
            return this.isActiveContainerMiniLink(link) ? 1 : 0
        }

        return this.isContainerProxyLink(link) ? 0 : 1
    }

    private syncContainerMiniCardActiveClass() {
        const activeIDs = this.activeContainerMiniNodeIDs()
        const activeLinkIDs = this.activeContainerLinkNodeIDs()
        selectAll("g.node-container-mini-card")
            .classed("node-container-mini-card-active", function (d: GroupContainerLayoutItem) {
                return activeIDs.has(d.node.id)
            })
        selectAll("g.node-container-network-mini")
            .classed("node-container-network-mini-active", function (d: GroupContainerNetworkItem) {
                return activeLinkIDs.has(d.node.id)
            })
    }

    private syncContainerMiniLinkVisibility() {
        this.gLinks.selectAll("path.link")
            .interrupt()
            .style("opacity", (d: Link) => this.linkDisplayOpacity(d))

        this.gLinkOverlays.selectAll("path.link-overlay")
            .interrupt()
            .style("opacity", (d: Link) => {
                const displayOpacity = this.linkDisplayOpacity(d)
                if (displayOpacity === 0) {
                    return 0
                }
                return d.state.selected || this.isLinkNodeSelected(d) || this.isActiveContainerMiniLink(d) ? 1 : 0
            })

        this.gLinkLabels.selectAll("g.link-label")
            .interrupt()
            .style("opacity", (d: Link) => this.linkLabelOpacity(d))

        this.gLinkWraps.selectAll("path.link-wrap")
            .style("pointer-events", "auto")
    }

    private visibleNodeIDForID(id: string): string {
        if (this.d3nodes.get(id)) {
            return id
        }
        const group = this.nodeGroup.get(id)
        if (group && this.d3nodes.get(group.id)) {
            return group.id
        }
        return id
    }

    private closestVisibleNodeID(node: Node): string {
        let current: Node | null = node
        while (current) {
            const visibleID = this.visibleNodeIDForID(current.id)
            if (this.d3nodes.get(visibleID)) {
                return visibleID
            }
            current = current.parent
        }
        return node.id
    }

    private hasSelectedLinkNode(): boolean {
        return this.visibleLinks().some((link: Link) => this.isLinkNodeSelected(link))
    }

    private linkLabelOpacity(link: Link): number {
        const displayOpacity = this.linkDisplayOpacity(link)
        if (displayOpacity === 0) {
            return 0
        }
        if (this.isLinkNodeSelected(link)) {
            return 1
        }
        return this.hasSelectedLinkNode() ? 0.28 : displayOpacity
    }

    private highlightNeighborLinks(d: D3Node, active: boolean) {
        var opacity = active ? 1 : 0

        const isVisible = (d: Link) => {
            const displayOpacity = this.linkDisplayOpacity(d)
            return displayOpacity > 0 ? displayOpacity : opacity
        }

        var links = this.neighborLinks(d.data, this.visibleLinks())
        for (let link of links) {
            if (active || !this.isLinkNodeSelected(link)) {
                select("#link-" + link.id)
                    .attr("class", (d: Link) => isVisible(d) ? this.linkClass(d) : 'link')
                    .style("opacity", isVisible)
                select("#link-label-" + link.id)
                    .style("opacity", this.linkLabelOpacity(link))
                select("#link-overlay-" + link.id)
                    .style("opacity", link.state.selected || opacity)
            }
        }
    }

    private overNode(id: string, active: boolean) {
        var d = this.d3nodes.get(id)
        if (!d) {
            return false
        }

        var opacity = active ? 1 : 0

        if (active) {
            select("#node-" + id).raise()
        }

        select("#node-overlay-" + id)
            .style("opacity", opacity)
    }

    private isLinkVisible(link: Link): boolean {
        if (link.state.selected) {
            return true
        }

        return link.tags.some(tag => (this.linkTagStates.get(tag) === LinkTagState.Visible) ||
            this.linkTagStates.get(tag) === LinkTagState.EventBased &&
            (link.source.state.selected || link.target.state.selected))
    }

    private searchMetadata(data: any, values: Map<any, boolean>, remaining: number): boolean {
        for (let key in data) {
            if (typeof data[key] === "object") {
                if (this.searchMetadata(data[key], values, remaining)) {
                    return true
                }
            } else {
                let expected = data[key]
                for (const [key, value] of values.entries()) {
                    if (key === expected && !value) {
                        values.set(key, true)
                        remaining--
                    }

                    if (!remaining) {
                        return true
                    }
                }
            }
        }

        return false
    }

    searchNodes(values: Array<any>): Array<Node> {
        var vm = new Map<any, boolean>()

        var nodes = new Array<Node>()
        Array.from(this.nodes.values()).forEach(node => {
            // reset state of each value
            values.forEach(value => vm.set(value, false))

            if (this.searchMetadata(node.data, vm, values.length)) {
                nodes.push(node)
            }
        })

        return nodes
    }

    private showLevelLabel(d: LevelRect) {
        var label = select("#level-label-" + d.weight)
        label
            .attr("transform", `translate(${-this.absTransformX},${d.bb.y + 2})`)
            .select("rect")
            .attr("height", d.bb.height - 4)

        var text = label.select("text.level-label-title")
        var element = text.node()
        if (element) {
            const bbox = (element as SVGTextElement).getBBox()
            const centerY = d.bb.height / 2 + bbox.height / 4
            label.select("text.level-label-icon").attr("y", centerY - 32)
            const switchIconScale = 1.68
            const switchIconOffset = (1.4 - switchIconScale) * 32
            label.select("g.level-label-switch-icon")
                .attr("transform", `translate(${((localStorage.getItem("language") || "ko") === "en" ? 75 : 65) + switchIconOffset},${centerY - 86 + switchIconOffset}) scale(${switchIconScale})`)
            label.select("text.level-label-badge").attr("y", centerY - 32)
            const titleLines = label.select("text.level-label-title").selectAll("tspan").size()
            label.select("text.level-label-title").attr("y", centerY + (titleLines > 1 ? 32 : 44))
        }
        label.transition()
            .duration(animDuration)
            .style("opacity", 1)
    }

    private levelLabelTitleLines(title: string): Array<string> {
        switch (title) {
            case "쿠버네티스 네임스페이스":
                return ["쿠버네티스", "네임스페이스"]
            case "쿠버네티스 워크로드 컨트롤러":
                return ["쿠버네티스", "워크로드 컨트롤러"]
            case "쿠버네티스 스토리지":
                return ["쿠버네티스", "스토리지"]
            case "Kubernetes Namespaces":
                return ["Kubernetes", "Namespaces"]
            case "Kubernetes Workload Controllers":
                return ["Kubernetes", "Workload Controllers"]
            case "Kubernetes Storage":
                return ["Kubernetes", "Storage"]
            default:
                return [title]
        }
    }

    private updateLevelLabelTitleText(selection: any) {
        const self = this
        selection.each(function (d: LevelRect) {
            const text = select(this)
            const title = self.weightTitles.get(d.weight) || 'Level ' + d.weight
            const lines = self.levelLabelTitleLines(title)
            const x = text.attr("x")

            text.text(null)
            lines.forEach((line, index) => {
                text.append("tspan")
                    .attr("x", x)
                    .attr("dy", index === 0 ? 0 : "1.15em")
                    .text(line)
            })
        })
    }

    private selectedLevelWeight(): number | null {
        if (!this.d3nodes) {
            return null
        }
        for (const d3node of Array.from(this.d3nodes.values())) {
            if (d3node.data.wrapped.state.selected) {
                return d3node.data.wrapped.getWeight()
            }
        }
        return null
    }

    private updateLevelLabelActiveClass() {
        if (!this.gLevelLabels || !this.d3nodes) {
            return
        }
        const selectedWeight = this.selectedLevelWeight()
        this.gLevelLabels.selectAll('g.level-label')
            .classed("level-label-active", (d: LevelRect) => selectedWeight !== null && d.weight === selectedWeight)
    }

    private levelLabelIcon(title: string): string {
        if (/kubernetes.*federation|쿠버네티스.*페더레이션/i.test(title)) {
            return "\uf0e8"
        }
        if (/kubernetes.*cluster|쿠버네티스.*클러스터/i.test(title)) {
            return "\uf542"
        }
        if (/kubernetes.*node|쿠버네티스.*노드/i.test(title)) {
            return "\uf233"
        }
        if (/kubernetes.*workload|쿠버네티스.*워크로드/i.test(title)) {
            return "\uf5fd"
        }
        if (/kubernetes.*namespace|쿠버네티스.*네임스페이스/i.test(title)) {
            return "\uf07b"
        }
        if (/kubernetes.*pod|쿠버네티스.*파드/i.test(title)) {
            return "\uf1b3"
        }
        if (/kubernetes.*storage|쿠버네티스.*스토리지/i.test(title)) {
            return "\uf1c0"
        }
        if (/kubernetes.*container|쿠버네티스.*컨테이너/i.test(title)) {
            return "\uf4b7"
        }
        if (/other kubernetes|기타 쿠버네티스/i.test(title)) {
            return "\uf542"
        }
        if (/system vm|시스템 가상머신/i.test(title)) {
            return "\uf085"
        }
        if (/user vm|사용자 가상머신/i.test(title)) {
            return "\uf108"
        }
        if (/switch port|스위치 포트/i.test(title)) {
            return "\uf796"
        }
        if (/virtual port|가상 포트|physical port|포트/i.test(title)) {
            return "\uf796"
        }
        if (/switch|스위치/i.test(title)) {
            return "\uf6ff"
        }
        if (/host bridge|호스트 브릿지/i.test(title)) {
            return "\uf542"
        }
        if (/virtual bridge|가상 브릿지/i.test(title)) {
            return "\uf247"
        }
        if (/host|호스트/i.test(title)) {
            return "\uf233"
        }
        if (/nic/i.test(title)) {
            return "\uf538"
        }
        if (/virtual network|가상 네트워크|physical network|네트워크/i.test(title)) {
            return "\uf538"
        }
        if (/bond|본딩/i.test(title)) {
            return "\uf0c1"
        }
        if (/vlan/i.test(title)) {
            return "\uf0e8"
        }
        if (/router|라우터/i.test(title)) {
            return "\uf4d7"
        }
        if (/vm|가상머신/i.test(title)) {
            return "\uf108"
        }
        if (/not classified|분류되지 않음/i.test(title)) {
            return "\uf538"
        }
        return "\uf538"
    }

    private isSwitchLevelLabel(title: string): boolean {
        const isSwitchPort = /switch port|스위치 포트/i.test(title)
        return !isSwitchPort && /switch|스위치/i.test(title)
    }

    private levelLabelBadgeIcon(title: string): string {
        return /system vm|시스템 가상머신/i.test(title) ? "\uf013" : ""
    }

    private hideAllLevelLabels() {
        this.gLevelLabels.selectAll('g.level-label')
            .style("opacity", 0)
            .interrupt()
    }

    private showAllLevelLabels() {
        selectAll("g.level-label").each((d: LevelRect) => this.showLevelLabel(d))
    }

    private groupBB(node: NodeWrapper): BoundingBox | null {
        var d3nodes = new Array<D3Node>()

        let d3node = this.d3nodes.get(node.id)
        if (d3node) {
            d3nodes.push(d3node)
        }

        if (node.wrapped.state.expanded) {
            node.wrapped.children.forEach(child => {
                let d3node = this.d3nodes.get(child.id)
                if (d3node) {
                    d3nodes.push(d3node)
                }
            })
        }

        return this.nodesBB(d3nodes)
    }

    private linkClicked(d: Link) {
        event.stopPropagation()

        this.clearRaisedLinkLabel()
        this.hideNodeContextMenu()
        this.selectLink(d.id, true)
    }

    private renderLevels() {
        var self = this
        const lang = localStorage.getItem("language") || "ko";

        if (this.invalidated) {
            this.updateLevelRects(this.levelNodes())
        }

        var levelLabel = this.gLevelLabels.selectAll('g.level-label')
            .data(this.levelRects, (d: LevelRect) => "level-label-" + d.weight)
        var levelLabelEnter = levelLabel.enter()
            .append("g")
            .attr("id", (d: LevelRect) => "level-label-" + d.weight)
            .attr("class", "level-label")
            .style("opacity", 0)
            .attr("transform", (d: LevelRect) => `translate(${-self.absTransformX},${d.bb.y})`)
        levelLabelEnter.append("rect")
            .attr("width", lang === "en" ? 240 : 220)
            .attr("height", (d: LevelRect) => d.bb.height);
        levelLabelEnter.append("text")
            .attr("class", "level-label-icon")
            .attr("text-anchor", "middle")
            .attr("x", lang === "en" ? 120 : 110)
            .text((d: LevelRect) => self.levelLabelIcon(self.weightTitles.get(d.weight) || 'Level ' + d.weight))
        const switchIcon = levelLabelEnter.append("g")
            .attr("class", "level-label-switch-icon")
        switchIcon.append("rect")
            .attr("class", "level-label-switch-icon__body")
            .attr("x", 9)
            .attr("y", 21.5)
            .attr("width", 46)
            .attr("height", 21)
            .attr("rx", 3)
            .attr("ry", 3)
        const switchPortXs = [17, 21.7, 26.4, 31.1, 35.8, 40.5, 45.2]
        switchPortXs.forEach((x) => {
            switchIcon.append("rect")
                .attr("class", "level-label-switch-icon__detail")
                .attr("x", x)
                .attr("y", 29)
                .attr("width", 4)
                .attr("height", 6)
                .attr("rx", 0.6)
                .attr("ry", 0.6)
        })
        switchIcon.append("path")
            .attr("class", "level-label-switch-icon__detail")
            .attr("d", "M13.5 30.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 1 0 0-2.5M50.7 31.2a.8.8 0 1 0 0 1.6.8.8 0 1 0 0-1.6M52.8 31.2a.8.8 0 1 0 0 1.6.8.8 0 1 0 0-1.6")
        levelLabelEnter.append("text")
            .attr("class", "level-label-badge")
            .attr("text-anchor", "middle")
            .attr("x", lang === "en" ? 120 : 110)
            .text((d: LevelRect) => self.levelLabelBadgeIcon(self.weightTitles.get(d.weight) || 'Level ' + d.weight))
        levelLabelEnter.append("text")
            .attr("class", "level-label-title")
            .attr("text-anchor", "middle")
            .attr("x", lang === "en" ? 120 : 110)
        levelLabelEnter.append("title")
            .attr("class", "level-label-tooltip")
        this.updateLevelLabelTitleText(levelLabelEnter.select("text.level-label-title"))
        this.updateLevelLabelTitleText(levelLabel.select("text.level-label-title"))
        const allLevelLabels = levelLabelEnter.merge(levelLabel)
        allLevelLabels.classed("level-label-switch", (d: LevelRect) => self.isSwitchLevelLabel(self.weightTitles.get(d.weight) || 'Level ' + d.weight))
        allLevelLabels.select("title.level-label-tooltip")
            .text((d: LevelRect) => self.weightTitles.get(d.weight) || 'Level ' + d.weight)
        levelLabel.exit().remove()

        this.updateLevelLabelActiveClass()

        var level = this.gLevels.selectAll('g.level')
            .data(this.levelRects, (d: LevelRect) => "level-" + d.weight)
            .interrupt()
        var levelEnter = level.enter()
            .append('g')
            .attr("id", (d: LevelRect) => "level-" + d.weight)
            .attr("class", "level")
            .style("opacity", 0)
            .attr("transform", (d: LevelRect) => `translate(${d.bb.x},${d.bb.y})`)

        levelEnter.append("rect")
            .attr("id", (d: LevelRect) => "level-zone-" + d.weight)
            .attr("class", "level-zone")
            .attr("width", (d: LevelRect) => d.bb.width)
            .attr("height", (d: LevelRect) => d.bb.height)
        level.exit().remove()

        levelEnter.transition()
            .duration(animDuration)
            .style("opacity", 1)
            .on('end', d => this.showLevelLabel(d))

        level.transition()
            .duration(animDuration)
            .style("opacity", 1)
            .on('end', d => this.showLevelLabel(d))
            .attr("transform", (d: LevelRect) => `translate(${d.bb.x},${d.bb.y})`)
            .select('rect.level-zone')
            .attr("height", (d: LevelRect) => d.bb.height)
    }

    private renderHieraLinks(root: any) {
        const hieraLinker = linkVertical()
            .x(d => d.x)
            .y(d => d.y)

        var hieraLink = this.gHieraLinks.selectAll('path.hiera-link')
            .data(root.links(), (d: any) => d.source.data.id + d.target.data.id)
            .interrupt()
        var hieraLinkEnter = hieraLink.enter()
            .filter((d: any) => d.target.data.parent.wrapped !== this.root)
            .append('path')
            .attr("class", "hiera-link")
            .style("opacity", 0)
            .attr("d", hieraLinker)
        hieraLink.exit().remove()

        hieraLinkEnter.transition()
            .duration(animDuration)
            .style("opacity", 1)

        hieraLink.transition()
            .duration(animDuration)
            .attr("d", hieraLinker)
            .style("opacity", 1)
    }

    private renderGroups() {
        var group = this.gGroups.selectAll('g.group')
            .interrupt()
            .data(Array.from(this.groups.values()), (d: NodeWrapper) => d.id)
        var groupEnter = group.enter()
            .append("g")
            .attr("class", "group")
            .attr("id", (d: Group) => d.id)
            .style("opacity", 0)
        group.exit().remove()

        /*const curlyBrace = (x1: number, y1: number, x2: number, y2: number, w: number) => {
            var len = y2 - y1

            var qx1 = x1 - w, qy1 = y1
            var qx2 = x1 - w * 0.6, qy2 = y1 + len * 0.25
            var qx3 = x1 - w * 0.8, qy3 = y1 + len / 2
            var qx4 = x1 - w * 0.2, qy4 = y1 + len / 2
            var qx5 = x1 - w * 0.6, qy5 = y1 + len * 0.75

            return "Q " + qx1 + " " + qy1 + " " + qx2 + " " + qy2 +
                " T " + qx3 + " " + qy3 +
                " Q " + qx4 + " " + qy4 + " " + qx5 + " " + qy5 +
                " T " + x2 + " " + y2
        }*/

        const straightBrace = (x1: number, y1: number, x2: number, y2: number, m: number) => {
            return "M " + (x1 - m) + " " + y1 +
                " L " + (x2 - m) + " " + y2
        }

        const handleBraces = (g: any, d: NodeWrapper, animated: boolean) => {
            var bb = this.groupBB(d)
            if (!bb) {
                return
            }

            var x1 = bb.x - 10
            var y1 = bb.y - 10
            var x2 = bb.x + bb.width + 10
            var y2 = bb.y + bb.height + 10
            const isExpandedGroup = d.type === WrapperType.Group && d.wrapped.state.expanded
            const rawHeight = y2 - y1
            const maxBraceHeight = topologyCardHeight + 86
            if (rawHeight > maxBraceHeight) {
                const centerY = y1 + rawHeight / 2
                y1 = centerY - maxBraceHeight / 2
                y2 = centerY + maxBraceHeight / 2
            }
            var margin = 12

            //var left = curlyBrace(x1, y1, x1, y2, 15)
            //var right = curlyBrace(x2, y2, x2, y1, -15)

            var left = straightBrace(x1, y1, x1, y2, margin)
            var right = straightBrace(x2, y2, x2, y1, -margin)

            var bgRect = g.select("rect.group-brace-bg-rect")
            if (animated) {
                bgRect = bgRect.transition()
                    .duration(animDuration)
                    .style("opacity", 0)
            } else {
                bgRect.style("opacity", 0)
            }
            bgRect
                .attr("x", x1)
                .attr("y", y1)
                .attr("width", Math.max(x2 - x1, nodeWidth))
                .attr("height", Math.max(y2 - y1, topologyCardHeight + 64))

            var ownerBgRect = g.select("rect.group-brace-owner-bg-rect")
            if (animated) {
                ownerBgRect = ownerBgRect.transition()
                    .duration(animDuration)
                    .style("opacity", 0)
            } else {
                ownerBgRect.style("opacity", 0)
            }
            ownerBgRect
                .attr("x", x1)
                .attr("y", y1)
                .attr("width", Math.max(x2 - x1, nodeWidth))
                .attr("height", Math.max(y2 - y1, topologyCardHeight + 64))

            var brace = g.select("path.group-brace-left")
            if (animated) {
                brace = brace.transition()
                    .duration(animDuration)
                    .style("opacity", 0)
            } else {
                brace.style("opacity", 0)
            }
            brace.attr("d", "M " + x1 + " " + y1 + " " + left)

            brace = g.select("path.group-brace-right")
            if (animated) {
                brace = brace.transition()
                    .duration(animDuration)
                    .style("opacity", 0)
            } else {
                brace.style("opacity", 0)
            }
            brace.attr("d", "M " + x2 + " " + y2 + " " + right)

            brace = g.select("path.group-brace-bg")
            if (animated) {
                brace = brace.transition()
                    .duration(animDuration)
            }

            brace
                .attr("d", "")

            brace = g.select("path.group-brace-owner-bg")

            if (animated && d.wrapped.state.expanded) {
                brace = brace.transition()
                    .duration(animDuration)
                    .style("opacity", 0)
            } else {
                brace.style("opacity", 0)
            }

            let d3node = this.d3nodes.get(d.id)
            if (d3node) {
                brace.attr("d", "")
            }
        }

        groupEnter.transition()
            .duration(animDuration)
            .style("opacity", 1)

        groupEnter.append("rect")
            .attr("class", "group-brace-bg-rect")

        groupEnter.append("rect")
            .attr("class", "group-brace-owner-bg-rect")
            .style("opacity", 0)

        groupEnter.append("path")
            .attr("class", "group-brace-bg")

        groupEnter.append("path")
            .attr("class", "group-brace-owner-bg")
            .style("opacity", 1)

        groupEnter.append("path")
            .attr("class", "group-brace group-brace-left")

        groupEnter.append("path")
            .attr("class", "group-brace group-brace-right")

        groupEnter.each(function (d: NodeWrapper) { handleBraces(select(this), d, false) })
        group.each(function (d: NodeWrapper) { handleBraces(select(this), d, true) })

        this.gGroupButtons.selectAll('g.group-button')
            .interrupt()
            .remove()
    }

    private isGroupContainerNode(_: D3Node): boolean {
        return false
    }

    private renderNodes(root: any) {
        var self = this

        var node = this.gNodes.selectAll('g.node')
            .interrupt()
            .data(root.descendants(), (d: D3Node) => d.data.id)

        const nodeClass = (d: D3Node) => new Array<string>().concat("node",
            d.data.type === WrapperType.Group ? "node-group-card" : "",
            d.data.type === WrapperType.Group && d.data.wrapped.state.expanded ? "node-group-expanded" : "",
            this.props.nodeAttrs(d.data.wrapped).classes,
            d.data.wrapped.state.selected ? "node-selected" : "").join(" ")

        var nodeEnter = node.enter()
            .filter((d: D3Node) => d.data.type !== WrapperType.Hidden && d.data.wrapped !== this.root)
            .append("g")
            .attr("id", (d: D3Node) => "node-" + d.data.id)
            .attr("class", nodeClass)
            .style("opacity", 0)
            .attr("transform", (d: D3Node) => `translate(${d.x},${d.y})`)
            .on("dblclick", (d: D3Node) => this.nodeDoubleClicked(d))
            .on("click", (d: D3Node) => this.nodeClicked(d))
            .on("contextmenu", (d: D3Node) => {
                event.preventDefault()
                this.showNodeContextMenu(d)
            })
            .on("mouseover", (d: D3Node) => {
                this.overNode(d.data.id, true)
            })
            .on("mouseout", (d: D3Node) => {
                this.overNode(d.data.id, false)
            })
        node.exit()
            .transition()
            .duration(animDuration).style("opacity", 0)
            .remove()

        nodeEnter.transition()
            .duration(animDuration)
            .style("opacity", 1)

        const hexSize = 30

        nodeEnter.append("circle")
            .attr("id", (d: D3Node) => "node-overlay-" + d.data.id)
            .attr("class", "node-overlay")
            .attr("r", hexSize + 16)
            .style("opacity", 0)
            .attr("pointer-events", "none")

        var highlight = nodeEnter.append("g")
            .attr("id", (d: D3Node) => "node-pinned-" + d.data.id)
            .attr("class", "node-pinned")
            .style("opacity", 0)
            .attr("pointer-events", "none")
        highlight.append("circle")
            .attr("r", hexSize + 16)
        highlight.append("text")
            .text("\uf3c5")
            .attr("dy", -58)

        const isVmCardNode = (d: D3Node) => {
            const data = d.data.wrapped.data || {}
            const type = String(data.Type || '').toLowerCase()
            return type === 'libvirt' || isTopologyInterfaceData(data)
        }
        const isGroupCardNode = (d: D3Node) => d.data.type === WrapperType.Group
        const groupCardScope = (d: D3Node) => {
            const data = d.data.wrapped.data || {}
            const storedScope = String(data.GroupScopeLabel || '').trim()
            if (storedScope) return storedScope
            if (String(data.Manager || '').toLowerCase() !== 'k8s') return ''

            const parentData = d.parent?.data?.wrapped?.data || {}
            const parentType = String(parentData.Type || '').toLowerCase()
            if (["cluster", "namespace", "deployment", "statefulset", "daemonset", "job", "cronjob", "storageclass", "persistentvolumeclaim"].indexOf(parentType) < 0) {
                return ''
            }
            return String(parentData.Name || '').trim()
        }
        const groupCardTooltip = (d: D3Node) => {
            const groupName = String(self.props.nodeAttrs(d.data.wrapped).name || d.data.wrapped.data?.Name || '')
            const scope = groupCardScope(d)
            const scopedName = scope ? `${scope} / ${groupName}` : groupName
            return `${scopedName}\n${d.data.wrapped.state.expanded ? "더블클릭하여 접기" : "클릭하여 모든 노드 보기"}`
        }
        const isGroupContainerNode = (d: D3Node) => this.isGroupContainerNode(d)
        const isGroupListNode = (_: D3Node) => false
        const groupListWidthForNode = (node: Node) => isCompactGroupListType(node.data?.GroupType || node.data?.Type) ? compactGroupListWidth : groupListWidth
        const cardWidthForNode = (d: D3Node) => {
            if (isGroupListNode(d)) {
                return groupListWidthForNode(d.data.wrapped)
            }
            if (isGroupContainerNode(d)) {
                return groupContainerWidth
            }
            const displayName = getNodeDisplayName(d)
            const longestLineLength = displayName.split("\n").reduce((length, line) => Math.max(length, line.length), 0)
            return longestLineLength <= 14 ? topologyCardWidth : topologyMediumCardWidth
        }
        const cardIconX = (d: D3Node) => -cardWidthForNode(d) / 2 + 38
        const podNodesForSummary = (node: Node): Node[] => {
            // Workload children are reconciled from ownerReference once when
            // topology data changes. Reuse that hierarchy here instead of
            // resolving every Pod against every controller during each SVG
            // render.
            const directPods = (node.children || []).reduce((pods: Node[], child) => {
                if (!isKubernetesPod(child)) return pods
                const nestedPods = (child.children || []).filter(isKubernetesPod)
                if (child.data?.IsTopologyGroup && nestedPods.length > 0) {
                    pods.push(...nestedPods.filter(isCurrentKubernetesPod))
                } else if (isCurrentKubernetesPod(child)) {
                    pods.push(child)
                }
                return pods
            }, [])
            return Array.from(new Map(directPods.map(pod => [pod.id, pod])).values())
        }
        const workloadTypes = new Set(['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'])
        const isWorkloadControllerNode = (node: Node): boolean =>
            String(node.data?.Manager || '').toLowerCase() === 'k8s'
            && workloadTypes.has(String(node.data?.Type || '').toLowerCase())
        const podAggregateForNode = (node: Node): KubernetesPodAggregate | undefined => {
            const supportsPodSummary = (isKubernetesPod(node) && !!node.data?.IsTopologyGroup)
                || isWorkloadControllerNode(node)
            if (!supportsPodSummary) return undefined
            const pods = podNodesForSummary(node)
            return pods.length > 0 ? aggregateKubernetesPods(pods) : undefined
        }
        interface TopologyStatusBadge {
            key: string
            label: string
            count: number
            tone: 'running' | 'warning' | 'problem' | 'history' | 'overflow'
            tooltip: string
            displayText?: string
        }
        const warningProblemReasons = new Set(['pending', 'unschedulable', 'containercreating', 'terminating'])
        const podStatusBadges = (node: Node): TopologyStatusBadge[] | undefined => {
            const summary = podAggregateForNode(node)
            if (!summary) return undefined
            const warningCount = summary.currentProblemEntries.filter(entry =>
                warningProblemReasons.has(entry.lifecycle.reason)).length
            const criticalCount = Math.max(0, summary.currentProblems - warningCount)
            const badges: TopologyStatusBadge[] = []
            if (criticalCount > 0) {
                badges.push({
                    key: 'problem',
                    label: '비정상',
                    count: criticalCount,
                    tone: 'problem',
                    tooltip: `비정상 ${criticalCount}\n집계 기준: 현재 복구되지 않은 파드 오류`
                })
            }
            if (warningCount > 0) {
                badges.push({
                    key: 'warning',
                    label: '주의',
                    count: warningCount,
                    tone: 'warning',
                    tooltip: `주의 ${warningCount}\n집계 기준: Pending·Unschedulable·ContainerCreating·Terminating`
                })
            }
            if (summary.running > 0) {
                badges.push({
                    key: 'running',
                    label: '실행 중',
                    count: summary.running,
                    tone: 'running',
                    tooltip: `실행 중 ${summary.running}\n집계 기준: 현재 Running 파드`
                })
            }
            if (summary.terminated > 0) {
                badges.push({
                    key: 'history',
                    label: '종료 이력',
                    count: summary.terminated,
                    tone: 'history',
                    tooltip: `종료 이력 ${summary.terminated}\n집계 기준: Evicted·OOMKilled·Error 등 종료 파드`
                })
            }
            return badges
        }

        const valueAtPath = (source: any, path: string): any =>
            path.split('.').reduce((value, key) => value === undefined || value === null ? undefined : value[key], source)
        const firstRawValue = (source: any, paths: string[]): any => {
            for (const path of paths) {
                const value = valueAtPath(source, path)
                if (value !== undefined && value !== null && String(value).trim() !== '') return value
            }
            return undefined
        }
        const normalizedType = (node: Node): string => String(node.data?.Type || '').toLowerCase()
        const isKubernetesResource = (node: Node): boolean => String(node.data?.Manager || '').toLowerCase() === 'k8s'
        const isTopologyGroup = (node: Node): boolean => !!node.data?.IsTopologyGroup
        const namespaceForNode = (node: Node): string => {
            const collected = firstRawValue(node.data || {}, [
                'Namespace',
                'K8s.Namespace',
                'K8s.Extra.ObjectMeta.Namespace'
            ])
            if (collected) return String(collected)
            let parent = node.parent
            while (parent) {
                if (normalizedType(parent) === 'namespace') return String(parent.data?.Name || '')
                parent = parent.parent
            }
            return ''
        }
        const clusterForNode = (node: Node): string => {
            const collected = firstRawValue(node.data || {}, [
                'ClusterName',
                'clusterName',
                'Cluster',
                'K8s.ClusterName'
            ])
            if (collected) return String(collected)
            let parent: Node | null | undefined = node
            while (parent) {
                if (normalizedType(parent) === 'cluster') return String(parent.data?.Name || '')
                parent = parent.parent
            }
            return ''
        }
        const scopedNodes = (type: string, namespaceNames: Set<string>, clusterNames: Set<string>): Node[] =>
            Array.from(self.nodes.values()).filter(candidate => {
                if (!isKubernetesResource(candidate) || isTopologyGroup(candidate) || normalizedType(candidate) !== type) return false
                const namespace = namespaceForNode(candidate)
                const cluster = clusterForNode(candidate)
                if (namespaceNames.size && !namespaceNames.has(namespace)) return false
                return !clusterNames.size || clusterNames.has(cluster)
            })
        const workloadConditionFailed = (status: any): boolean => {
            const conditions = Array.isArray(status?.Conditions) ? status.Conditions : []
            return conditions.some((condition: any) => {
                const state = String(condition?.Status ?? condition?.status ?? '').toLowerCase()
                const type = String(condition?.Type ?? condition?.type ?? '').toLowerCase()
                const reason = String(condition?.Reason ?? condition?.reason ?? '').toLowerCase()
                return state === 'true' && (/fail|error|deadlineexceeded/.test(type) || /fail|error|deadlineexceeded/.test(reason))
            })
        }
        const workloadTone = (node: Node): 'problem' | 'warning' | 'running' => {
            const data = node.data || {}
            const type = normalizedType(node)
            const spec = firstRawValue(data, ['K8s.Extra.Spec']) || {}
            const status = firstRawValue(data, ['K8s.Extra.Status']) || {}
            const desired = Number(
                type === 'daemonset'
                    ? status.DesiredNumberScheduled ?? 0
                    : type === 'job'
                        ? spec.Completions ?? 1
                        : spec.Replicas ?? status.DesiredReplicas ?? 0
            )
            const ready = Number(
                type === 'deployment'
                    ? status.AvailableReplicas ?? status.ReadyReplicas ?? 0
                    : type === 'daemonset'
                        ? status.NumberAvailable ?? status.NumberReady ?? 0
                        : type === 'job'
                            ? status.Succeeded ?? 0
                            : status.ReadyReplicas ?? status.AvailableReplicas ?? status.Active ?? 0
            )
            const unavailable = Number(status.UnavailableReplicas ?? status.NumberUnavailable ?? status.NumberMisscheduled ?? status.Failed ?? 0)
            const updated = Number(status.UpdatedReplicas ?? status.UpdatedNumberScheduled ?? ready)
            if ((desired > 0 && ready === 0) || workloadConditionFailed(status)) return 'problem'
            if (unavailable > 0 || (desired > 0 && (ready < desired || updated < desired))) return 'warning'
            return 'running'
        }
        const namespaceStatusBadges = (node: Node): TopologyStatusBadge[] => {
            const namespaces = isTopologyGroup(node)
                ? node.children.filter(child => normalizedType(child) === 'namespace')
                : [node]
            const namespaceNames = new Set(namespaces.map(item => String(item.data?.Name || '')).filter(Boolean))
            const clusterNames = new Set(namespaces.map(clusterForNode).filter(Boolean))
            const workloads = Array.from(new Map(
                scopedNodes('deployment', namespaceNames, clusterNames)
                    .concat(scopedNodes('statefulset', namespaceNames, clusterNames))
                    .concat(scopedNodes('daemonset', namespaceNames, clusterNames))
                    .concat(scopedNodes('job', namespaceNames, clusterNames))
                    .concat(scopedNodes('cronjob', namespaceNames, clusterNames))
                    .map(item => [item.id, item])
            ).values())
            if (!workloads.length) return []
            return [{
                key: 'workloads',
                label: '워크로드',
                count: workloads.length,
                tone: 'running',
                tooltip: `워크로드 ${workloads.length}개\nNamespace 더블클릭 시 펼쳐지는 Workload Controller 수`
            }]
        }
        const workloadStatusBadges = (node: Node): TopologyStatusBadge[] => {
            // A workload number badge represents only the current Pods that
            // double-click can actually reveal. Replica/Available values remain
            // in the detail panel and must not fabricate a topology child count.
            return podStatusBadges(node) || []
        }
        const storageStatusBadges = (node: Node): TopologyStatusBadge[] => {
            const resources = node.children.filter(child => {
                const type = normalizedType(child)
                return !isTopologyGroup(child) && (type === 'persistentvolume' || type === 'persistentvolumeclaim')
            })
            const counts = resources.reduce((result, resource) => {
                const phase = String(firstRawValue(resource.data || {}, ['K8s.Extra.Status.Phase', 'K8s.Status', 'Status', 'Phase']) || '').toLowerCase()
                if (phase === 'lost' || phase === 'failed') result.problem += 1
                else if (phase === 'pending' || phase === 'released') result.warning += 1
                else if (phase === 'bound' || phase === 'available') result.running += 1
                return result
            }, { problem: 0, warning: 0, running: 0 })
            return [
                counts.problem ? { key: 'problem', label: 'Lost·Failed', count: counts.problem, tone: 'problem' as const, tooltip: `Lost·Failed ${counts.problem}\n집계 기준: 현재 Phase가 Lost 또는 Failed인 PVC·PV` } : undefined,
                counts.warning ? { key: 'warning', label: 'Pending·Released', count: counts.warning, tone: 'warning' as const, tooltip: `Pending·Released ${counts.warning}\n집계 기준: 현재 Phase가 Pending 또는 Released인 PVC·PV` } : undefined,
                counts.running ? { key: 'running', label: 'Bound·Available', count: counts.running, tone: 'running' as const, tooltip: `Bound·Available ${counts.running}\n집계 기준: 현재 Phase가 Bound 또는 Available인 PVC·PV` } : undefined
            ].filter(Boolean) as TopologyStatusBadge[]
        }
        const storageExpansionBadges = (node: Node): TopologyStatusBadge[] => {
            const type = normalizedType(node)
            const childType = type === 'storageclass'
                ? 'persistentvolumeclaim'
                : type === 'persistentvolumeclaim'
                    ? 'persistentvolume'
                    : ''
            if (!childType) return []
            const childCount = node.children.filter(child => !isTopologyGroup(child) && normalizedType(child) === childType).length
            if (childCount < 1) return []
            return [{
                key: 'children',
                label: childType === 'persistentvolumeclaim' ? '하위 PVC' : '연결된 PV',
                count: childCount,
                tone: 'running',
                tooltip: childType === 'persistentvolumeclaim'
                    ? `하위 PVC ${childCount}개`
                    : `연결된 PV ${childCount}개`
            }]
        }
        const aggregateStatusKind = (node: Node): 'namespace' | 'workload' | 'storage-group' | 'storage-expand' | undefined => {
            if (!isKubernetesResource(node)) return undefined
            const type = normalizedType(node)
            if (type === 'namespace') return 'namespace'
            if (isWorkloadControllerNode(node)) return 'workload'
            if (isTopologyGroup(node) && (type === 'persistentvolume' || type === 'persistentvolumeclaim' || type === 'storageclass')) return 'storage-group'
            if (!isTopologyGroup(node) && (type === 'storageclass' || type === 'persistentvolumeclaim')) return 'storage-expand'
            return undefined
        }
        const topologyStatusBadges = (node: Node): TopologyStatusBadge[] | undefined => {
            const kind = aggregateStatusKind(node)
            if (!kind) return undefined
            if (kind === 'namespace') return namespaceStatusBadges(node)
            if (kind === 'workload') return workloadStatusBadges(node)
            if (kind === 'storage-expand') return storageExpansionBadges(node)
            return storageStatusBadges(node)
        }

        const cardTextX = (d: D3Node) => cardIconX(d) + 43
        const displayedStatusBadgeCount = (node: Node): number => {
            const badges = topologyStatusBadges(node)
            if (!badges?.length) return 0
            return badges.length <= topologyVisibleStatusBadgeLimit
                ? badges.length
                : topologyVisibleStatusBadgeLimit + 1
        }
        const cardTextRightPadding = (d: D3Node) => {
            if (aggregateStatusKind(d.data.wrapped)) {
                const badgeCount = displayedStatusBadgeCount(d.data.wrapped)
                if (badgeCount === 0) return 18
                return topologyStatusBadgeSingleReserveWidth
                    + Math.max(0, badgeCount - 1) * topologyStatusBadgeStep
            }
            const hasBadge = d.data.wrapped.children.length > 0
                || self.props.nodeAttrs(d.data.wrapped).badges.length > 0
            return hasBadge ? 50 : 18
        }
        // 표시되는 배지 수만큼만 우측 공간을 예약합니다. 배지가 없는
        // `kube-public` 같은 짧은 이름에 최대 배지 폭을 강제하지 않습니다.
        const cardTextAvailableWidth = (d: D3Node) => Math.max(72, cardWidthForNode(d) / 2 - cardTextX(d) - cardTextRightPadding(d))
        const cardTitleX = (d: D3Node) => {
            const left = cardTextX(d)
            return left + cardTextAvailableWidth(d) / 2
        }
        const cardHeightForNode = (d: D3Node) => {
            if (isGroupListNode(d)) {
                const filtered = self.filteredGroupNavigatorNodes(d.data.wrapped.children as Node[], d.data.wrapped.id)
                return self.groupListHeight(filtered.length)
            }
            return isGroupContainerNode(d) ? this.groupContainerHeightForGroup(d.data.wrapped.children) : topologyCardHeight
        }
        const cardTopY = -topologyCardHeight / 2
        // 그룹 카드의 가까운 백플레이트가 앞 카드에서 분리되는 오른쪽/아래 간격입니다.
        const groupBackplateNearOffset = { x: 6, y: 5 }
        // 그룹 카드의 먼 백플레이트가 계층 깊이를 드러내는 오른쪽/아래 간격입니다.
        const groupBackplateFarOffset = { x: 13, y: 10.5 }

        var card = nodeEnter.append("g")
            .attr("class", "node-card")
            .attr("pointer-events", "all")

        card.append("rect")
            .attr("class", "node-group-backplate node-group-backplate-2")
            .attr("x", (d: D3Node) => -cardWidthForNode(d) / 2 + groupBackplateFarOffset.x)
            .attr("y", cardTopY + groupBackplateFarOffset.y)
            .attr("width", (d: D3Node) => cardWidthForNode(d))
            .attr("height", (d: D3Node) => topologyCardHeight)
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("pointer-events", "none")

        card.append("rect")
            .attr("class", "node-group-backplate node-group-backplate-1")
            .attr("x", (d: D3Node) => -cardWidthForNode(d) / 2 + groupBackplateNearOffset.x)
            .attr("y", cardTopY + groupBackplateNearOffset.y)
            .attr("width", (d: D3Node) => cardWidthForNode(d))
            .attr("height", (d: D3Node) => topologyCardHeight)
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("pointer-events", "none")

        card.append("rect")
            .attr("class", "node-card-bg")
            .attr("x", (d: D3Node) => -cardWidthForNode(d) / 2)
            .attr("y", cardTopY)
            .attr("width", (d: D3Node) => cardWidthForNode(d))
            .attr("height", (d: D3Node) => cardHeightForNode(d))
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("pointer-events", "all")
            .append("title")
            .text((d: D3Node) => isGroupCardNode(d) ? groupCardTooltip(d) : getNodeDisplayName(d))

        card.append("circle")
            .attr("class", "node-card-icon-bg")
            .attr("cx", (d: D3Node) => cardIconX(d))
            .attr("cy", 0)
            .attr("r", 29)

        nodeEnter.append("circle")
            .attr("class", "node-circle")
            .attr("r", hexSize + 16)

        nodeEnter.append("circle")
            .attr("class", "node-disc")
            .attr("r", hexSize + 8)
            .attr("pointer-events", "none")

        nodeEnter.append("path")
            .attr("class", "node-hexagon")
            .attr("d", (d: D3Node) => this.liner(this.hexagon(d, hexSize)))
            .attr("pointer-events", "none")

        const isImgIcon = (d: D3Node): boolean => {
            if (this.props.nodeAttrs(d.data.wrapped).href) {
                return true
            }
            return false
        }

        const imageIconDimensions = (d: D3Node): { width: number, height: number } => {
            return this.props.nodeAttrs(d.data.wrapped).iconClass === "network-switch-icon"
                ? { width: 48, height: 62 }
                : { width: 34, height: 34 }
        }

        nodeEnter.each(function (d: D3Node) {
            var el = select(this)
            var attrs = self.props.nodeAttrs(d.data.wrapped)

            if (isImgIcon(d)) {
                el.append("image")
                    .attr("class", (d: D3Node) => "node-icon " + attrs.iconClass)
                    .attr("transform", (d: D3Node) => {
                        const dimensions = imageIconDimensions(d)
                        return `translate(${cardIconX(d) - dimensions.width / 2},${-dimensions.height / 2})`
                    })
                    .attr("width", (d: D3Node) => imageIconDimensions(d).width)
                    .attr("height", (d: D3Node) => imageIconDimensions(d).height)
                    .attr("preserveAspectRatio", (d: D3Node) => attrs.iconClass === "network-switch-icon" ? "none" : "xMidYMid meet")
                    .attr("xlink:href", (d: D3Node) => attrs.href)
                    .attr("pointer-events", "none")
            } else {
                el.append("text")
                    .attr("class", (d: D3Node) => "node-icon " + attrs.iconClass)
                    .attr("x", (d: D3Node) => cardIconX(d))
                    .attr("dy", 10)
                    .text((d: D3Node) => attrs.icon)
                    .attr("pointer-events", "none")
            }
        })

        var wrapText = (text: Selection<SVGTextElement, any, null, undefined>, lineHeight: number, width: number) => {
            text.each(function () {
                var text = select(this)
                const d = text.datum() as D3Node
                const isUserVmNode = d?.data?.wrapped?.data?.Type === "libvirt"
                const isKubernetesNode = d?.data?.wrapped?.data?.Manager === "k8s" && d?.data?.wrapped?.data?.Type === "node"
                const labelWidth = isUserVmNode
                    ? width + userVmNameWidthBoost
                    : isKubernetesNode
                        ? width + kubernetesNodeLabelWidthBoost
                        : width
                var y = text.attr("y")
                var dy = parseFloat(text.attr("dy"))
                const rawText = text.text() || ""
                const explicitLines = rawText.split("\n").filter((v: string) => v.length > 0)

                text.text(null)
                text.append("title").text(rawText)

                // Respect explicit multi-line labels first (e.g. IP + network name).
                if (explicitLines.length > 1) {
                    explicitLines.forEach((lineText, idx) => {
                        text.append("tspan")
                            .attr("x", 0)
                            .attr("y", y)
                            .attr("dy", (dy + idx * lineHeight) + "em")
                            .text(lineText)
                    })
                } else {
                    let words: Array<string> | null = null
                    if (isKubernetesNode) {
                        const hyphenChunks = rawText
                            .split(/-/g)
                            .filter((chunk: string) => chunk.length > 0)
                            .map((chunk: string, idx: number, arr: Array<string>) => idx < arr.length - 1 ? `${chunk}-` : chunk)
                        words = hyphenChunks.length > 1 ? hyphenChunks : rawText.match(/.{1,12}/g)
                    } else {
                        words = rawText.match(/.{1,10}/g)
                    }
                    if (!words) {
                        words = [rawText]
                    }
                    words = words.reverse()
                    var line = new Array<string>()

                    var tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em")

                    var lineNumber = 0
                    var word = words.pop()
                    while (word) {
                        line.push(word)
                        tspan.text(line.join(""))

                        let element = tspan.node()
                        if (!element) {
                            continue
                        }
                        if (element.getComputedTextLength() > labelWidth) {
                            line.pop()

                            if (line.length) {
                                tspan.text(line.join(""))
                                line = [word]
                                tspan = text.append("tspan")
                                    .attr("x", 0)
                                    .attr("y", y)
                                    .attr("dy", ++lineNumber * lineHeight + dy + "em")
                                    .text(word)
                            }
                        }
                        word = words.pop()
                    }
                }

                var bb = this.getBBox()

                select(this.parentNode).insert("rect", "text")
                    .attr("class", "node-name-wrap")
                    .attr("x", bb.x - 12)
                    .attr("y", bb.y - 8)
                    .attr("width", bb.width + 24)
                    .attr("height", bb.height + 16)
                    .attr("rx", 10)
                    .attr("ry", 10)
            })
        }

        function getNodeDisplayName(d: D3Node) {
            const attrsName = self.props.nodeAttrs(d.data.wrapped).name
            const nodeData = d.data.wrapped.data || {}
            const vmNameMap = self.props.vmNameMap || {}
            const vmNetworkMap = self.props.vmNetworkMap || {}

            if (d.data.type === WrapperType.Group) {
                const scope = groupCardScope(d)
                if (scope) {
                    return `${attrsName}\n${scope}`
                }
            }

            if (d.data.type !== WrapperType.Group && String(nodeData.Manager || '').toLowerCase() === 'k8s') {
                const storageType = String(nodeData.Type || '').toLowerCase()
                if (storageType === 'storageclass') {
                    return `${attrsName}\nStorageClass`
                }
                if (storageType === 'persistentvolumeclaim') {
                    const namespace = String(
                        nodeData.Namespace
                        || nodeData.namespace
                        || nodeData.K8s?.Namespace
                        || nodeData.K8s?.namespace
                        || nodeData.K8s?.Extra?.ObjectMeta?.Namespace
                        || nodeData.K8s?.Extra?.ObjectMeta?.namespace
                        || nodeData.K8s?.Extra?.metadata?.namespace
                        || ''
                    ).trim()
                    return `${attrsName}\nPVC${namespace ? ` · ${namespace}` : ''}`
                }
                if (storageType === 'persistentvolume') {
                    return `${attrsName}\nPV`
                }
            }

            // For VM child NIC nodes, prefer operator-facing label:
            // IP > Mold network name > existing interface name.
            const nodeType = typeof nodeData.Type === "string" ? nodeData.Type.toLowerCase() : ""
            const nodeDriver = typeof nodeData.Driver === "string" ? nodeData.Driver.toLowerCase() : ""
            if (
                nodeType === "tuntap" ||
                nodeType === "tun" ||
                nodeDriver === "tun" ||
                nodeDriver === "tuntap"
            ) {
                let parent = d.data.wrapped.parent
                while (parent && parent.data?.Type !== "libvirt") {
                    parent = parent.parent
                }
                const libvirtName = parent?.data?.Name
                const parentDisplayName = parent ? self.props.nodeAttrs(parent).name : undefined
                const vmNameMapped = libvirtName ? vmNameMap[libvirtName] : undefined
                const vmKeys = [
                    libvirtName,
                    vmNameMapped,
                    parentDisplayName,
                    parent?.data?.UUID,
                    parent?.data?.ID,
                    parent?.data?.ExtID,
                    parent?.data?.VirtualMachineID,
                    parent?.data?.instanceName
                ]
                    .map((v) => (typeof v === "string" ? v.trim() : ""))
                    .filter((v, idx, arr) => !!v && arr.indexOf(v) === idx)
                let nicList: Array<{ networkName: string, macAddress: string, ipAddress: string }> = []
                for (const key of vmKeys) {
                    const found = vmNetworkMap[key]
                    if (Array.isArray(found) && found.length > 0) {
                        nicList = found
                        break
                    }
                }

                const normalizeMac = (value: any): string => {
                    if (typeof value !== "string") {
                        return ""
                    }
                    return value.toLowerCase().replace(/[^0-9a-f]/g, "")
                }
                const normalizeIP = (value: any): string => {
                    if (typeof value !== "string") {
                        return ""
                    }
                    return value.trim().split("/")[0]
                }
                const normalizeIfToken = (value: any): string => {
                    if (typeof value !== "string") {
                        return ""
                    }
                    return value.trim().toLowerCase()
                }
                const collectIfTokens = (value: any): string[] => {
                    const raw = normalizeIfToken(value)
                    if (!raw) {
                        return []
                    }
                    // e.g. "ens3 / vnet13" -> ["ens3", "vnet13"]
                    return raw.split(/[\/,\s]+/).map((v) => v.trim()).filter(Boolean)
                }
                const pickText = (obj: any, keys: string[]): string => {
                    for (const key of keys) {
                        const value = obj?.[key]
                        if (value !== undefined && value !== null) {
                            const text = String(value).trim()
                            if (text) {
                                return text
                            }
                        }
                    }
                    return ""
                }
                const nodeMacCandidates = [
                    nodeData.MAC,
                    nodeData.PeerIntfMAC,
                    nodeData?.Libvirt?.MAC,
                    nodeData?.Libvirt?.Mac,
                ]
                    .map((v) => normalizeMac(v))
                    .filter((v, idx, arr) => !!v && arr.indexOf(v) === idx)
                const nodeIPs = [
                    ...(Array.isArray(nodeData.IPV4) ? nodeData.IPV4 : [nodeData.IPV4]),
                    ...(Array.isArray(nodeData.IPV6) ? nodeData.IPV6 : [nodeData.IPV6]),
                    ...(Array.isArray(nodeData.IfAddr) ? nodeData.IfAddr : [nodeData.IfAddr]),
                    ...(Array.isArray(nodeData.Addresses) ? nodeData.Addresses : [nodeData.Addresses]),
                ]
                    .map((v) => normalizeIP(typeof v === "string" ? v : String(v || "")))
                    .filter((v) => !!v)
                const nodeIPSet = new Set(nodeIPs)
                const nodeIfTokens = [
                    ...collectIfTokens(nodeData.Name),
                    ...collectIfTokens(nodeData.IfName),
                    ...collectIfTokens(nodeData.PeerIfName),
                    ...collectIfTokens(nodeData.Interface),
                ]
                const nodeIfTokenSet = new Set(nodeIfTokens)
                const matchedNic = nicList.find((nic: any) => {
                    const nicIP = normalizeIP(pickText(nic, ["ipAddress", "ip", "ip_address", "fixedIp", "fixed_ip"]))
                    if (nicIP && nodeIPSet.has(nicIP)) {
                        return true
                    }
                    const nicMac = normalizeMac(pickText(nic, ["macAddress", "mac", "mac_address", "macAddr"]))
                    if (nicMac && nodeMacCandidates.some((m) => m === nicMac)) {
                        return true
                    }
                    if (nodeIfTokenSet.size === 0) {
                        return false
                    }
                    const nicIfCandidates = [
                        nic.interfaceName,
                        nic.ifName,
                        nic.tapName,
                        nic.tap_name,
                        nic.deviceName,
                        nic.device_name,
                        nic.device,
                        nic.name,
                        nic.iface,
                        nic.interface
                    ]
                    const nicTokens = nicIfCandidates.reduce((acc: string[], raw: any) => {
                        const tokens = collectIfTokens(raw)
                        if (tokens.length) {
                            acc.push(...tokens)
                        }
                        return acc
                    }, [] as string[])
                    if (nicTokens.length === 0) {
                        return false
                    }
                    return nicTokens.some((token) => nodeIfTokenSet.has(token))
                })

                const fallbackNic = matchedNic || (nicList.length === 1 ? nicList[0] : undefined)
                const ip = pickText(fallbackNic, ["ipAddress", "ip", "ip_address", "fixedIp", "fixed_ip"])
                const interfaceFromNic = pickText(fallbackNic, [
                    "interfaceName",
                    "ifName",
                    "guestInterface",
                    "guestInterfaceName",
                    "guestDeviceName",
                    "guestDevice",
                    "deviceName",
                    "device_name",
                    "device",
                    "iface",
                    "interface"
                ])
                const interfaceFromNode = pickText(nodeData, [
                    "GuestInterface",
                    "GuestInterfaceName",
                    "GuestDeviceName",
                    "GuestDevice",
                    "IfName",
                    "PeerIfName",
                    "Interface",
                    "Name"
                ])
                const pickInterfaceName = (...values: string[]): string => {
                    const tokens = values.reduce((acc: string[], value) => {
                        acc.push(...collectIfTokens(value))
                        return acc
                    }, [] as string[])
                        .filter((token, index, array) => !!token && array.indexOf(token) === index)
                    const guestToken = tokens.find((token) => /^(eth|ens|eno|enp)\d/i.test(token))
                    if (guestToken) {
                        return guestToken
                    }
                    const nonTapToken = tokens.find((token) => !/^(vnet|tap|tun|tuntap)/i.test(token))
                    return nonTapToken || tokens[0] || ""
                }
                const interfaceName = pickInterfaceName(interfaceFromNic, interfaceFromNode)
                const rawNetworkName = pickText(fallbackNic, ["networkName", "network", "network_name", "name"])
                const toText = (value: any): string => {
                    if (value === undefined || value === null) {
                        return ""
                    }
                    return String(value).trim()
                }
                const rawNodeNetwork = toText(nodeData.Network)
                const rawNodeIPv4 = Array.isArray(nodeData.IPV4)
                    ? toText(nodeData.IPV4[0])
                    : toText(nodeData.IPV4)
                const rawNodeIfAddr = Array.isArray(nodeData.IfAddr)
                    ? toText(nodeData.IfAddr[0])
                    : toText(nodeData.IfAddr)
                const rawNodeVlan = toText(nodeData.VLAN || nodeData.Vlan || nodeData.VLANID || nodeData.VlanID)
                const rawNodeVni = toText(nodeData.VNI || nodeData.Vni)
                const rawNodeBroadcast = toText(nodeData.Broadcast || nodeData.BROADCAST)
                const fallbackNodeIP = normalizeIP(rawNodeIPv4 || rawNodeIfAddr)
                const hasUntaggedHint = [rawNodeNetwork, rawNodeVlan, rawNodeVni, rawNodeBroadcast]
                    .some((v) => /(^|:\/\/)untagged$/i.test(v) || /untagged/i.test(v))
                const isUntaggedNetwork =
                    /^(vlan:\/\/)?untagged$/i.test(rawNetworkName || "") ||
                    /^(vlan:\/\/)?untagged$/i.test(rawNodeNetwork) ||
                    /^(vlan:\/\/)?untagged$/i.test(rawNodeVlan) ||
                    /^(vlan:\/\/)?untagged$/i.test(rawNodeVni) ||
                    /^(vlan:\/\/)?untagged$/i.test(rawNodeBroadcast) ||
                    (/^l2$/i.test(rawNetworkName || "") && hasUntaggedHint)
                const networkName = isUntaggedNetwork
                    ? "L2 Untagged"
                    : (rawNetworkName || rawNodeNetwork)
                const detectVlanId = (): string | undefined => {
                    const candidates = [
                        nodeData.VLAN,
                        nodeData.Vlan,
                        nodeData.VLANID,
                        nodeData.VlanID,
                        nodeData.Tag,
                        nodeData.ID,
                        rawNetworkName
                    ]
                    for (const raw of candidates) {
                        if (raw === undefined || raw === null) {
                            continue
                        }
                        const text = String(raw).trim()
                        if (!text) {
                            continue
                        }
                        if (/^\d+$/.test(text)) {
                            return text
                        }
                        const byKeyword = text.match(/vlan[-_ ]?(\d+)/i)
                        if (byKeyword && byKeyword[1]) {
                            return byKeyword[1]
                        }
                        const byDot = text.match(/\.(\d{1,4})$/)
                        if (byDot && byDot[1]) {
                            return byDot[1]
                        }
                    }
                    return undefined
                }
                const vlanId = detectVlanId()

                const displayIP = ip || fallbackNodeIP

                if (displayIP && interfaceName) {
                    return `${displayIP}\n${interfaceName}`
                }
                if (displayIP) {
                    return displayIP
                }
                if (interfaceName) {
                    return interfaceName
                }
                if (networkName && vlanId) {
                    return `${networkName}\nVLAN ${vlanId}`
                }
                if (networkName) {
                    return networkName
                }
                if (vlanId) {
                    return `VLAN ${vlanId}`
                }
                if (isUntaggedNetwork) {
                    return "L2 Untagged"
                }
                return attrsName
            }

            return vmNameMap[attrsName] || attrsName
        }

        const trimNodeTitle = (value: string, d?: D3Node) => {
            if (!value) return ''
            const width = d ? cardWidthForNode(d) : topologyCardWidth
            const textWidth = Math.max(80, width - topologyCardTextPadding)
            const maxLength = Math.max(8, Math.floor(textWidth / 11.5))
            return value.length > maxLength ? `${value.substring(0, Math.max(1, maxLength - 3))}...` : value
        }

        const fitNodeTitle = (text: Selection<SVGTextElement, D3Node, any, any>) => {
            text.each(function (d: D3Node) {
                const title = select(this)
                const fullText = getNodeDisplayName(d)
                const availableWidth = cardTextAvailableWidth(d)
                const textNode = this as SVGTextElement
                const textX = cardTitleX(d)

                const workloadTypes = new Set(["deployment", "statefulset", "daemonset", "job", "cronjob"])
                const isWorkloadCard = d.data.wrapped.data?.Manager === "k8s" && workloadTypes.has(String(d.data.wrapped.data?.Type || "").toLowerCase())
                const storageTypes = new Set(["storageclass", "persistentvolumeclaim", "persistentvolume"])
                const isStorageCard = d.data.type !== WrapperType.Group
                    && d.data.wrapped.data?.Manager === "k8s"
                    && storageTypes.has(String(d.data.wrapped.data?.Type || "").toLowerCase())
                const isScopedGroupCard = d.data.type === WrapperType.Group && !!String(d.data.wrapped.data?.GroupScopeLabel || '').trim()
                const fitLine = (value: string, fontSize?: number): string => {
                    if (fontSize) {
                        title.style("font-size", `${fontSize}px`)
                    }
                    title.text(value)
                    if (textNode.getComputedTextLength() <= availableWidth) {
                        if (fontSize) title.style("font-size", null)
                        return value
                    }
                    let low = 1
                    let high = value.length
                    let best = ""
                    while (low <= high) {
                        const mid = Math.floor((low + high) / 2)
                        const candidate = `${value.substring(0, mid)}...`
                        title.text(candidate)
                        if (textNode.getComputedTextLength() <= availableWidth) {
                            best = candidate
                            low = mid + 1
                        } else {
                            high = mid - 1
                        }
                    }
                    if (fontSize) title.style("font-size", null)
                    return best || "..."
                }

                title.attr("text-anchor", "middle")
                title.text(null)

                let targetLines: string[]
                let secondaryLineIndex = -1
                let secondaryLineClass = "node-card-title-secondary"
                const splitLongName = (value: string): string[] => {
                    title.text(value)
                    const fitsOneLine = textNode.getComputedTextLength() <= availableWidth
                    title.text(null)
                    if (fitsOneLine) {
                        return [value]
                    }

                    const midpoint = Math.ceil(value.length / 2)
                    let splitIndex = value.lastIndexOf("-", midpoint)
                    if (splitIndex < Math.max(6, midpoint - 12)) {
                        splitIndex = value.lastIndexOf("_", midpoint)
                    }
                    if (splitIndex < Math.max(6, midpoint - 12)) {
                        splitIndex = value.indexOf("-", midpoint)
                    }
                    if (splitIndex < 6) {
                        splitIndex = midpoint
                    }
                    const first = value.substring(0, splitIndex).replace(/[-_\s]+$/, "")
                    const second = value.substring(splitIndex).replace(/^[-_\s]+/, "")
                    return (second ? [first, second] : [value]).slice(0, 2)
                }

                const explicitLines = fullText.split("\n").filter((line) => line.length > 0)
                if (isWorkloadCard && explicitLines.length > 1) {
                    const workloadNameLines = splitLongName(explicitLines[0])
                    if (workloadNameLines.length === 1) {
                        targetLines = [workloadNameLines[0], explicitLines[1]]
                        secondaryLineIndex = 1
                    } else {
                        targetLines = workloadNameLines.slice(0, 2)
                    }
                } else if (isStorageCard && explicitLines.length > 1) {
                    targetLines = explicitLines.slice(0, 2)
                    secondaryLineIndex = 1
                    secondaryLineClass = "node-card-title-storage-secondary"
                } else if (fullText.indexOf("\n") < 0) {
                    targetLines = splitLongName(fullText)
                } else {
                    targetLines = explicitLines.length > 1 ? explicitLines.slice(0, 2) : [fullText]
                }

                const fittedLines = targetLines.map((line, index) => {
                    const secondaryFontSize = index === secondaryLineIndex
                        ? isStorageCard ? 14 : 17
                        : index === 1 && isScopedGroupCard
                            ? 15
                        : undefined
                    return fitLine(line, secondaryFontSize)
                })
                const titleY = fittedLines.length > 1 ? -4 : 7
                title.attr("y", titleY)
                title.text(null)
                fittedLines.forEach((line, index) => {
                    title.append("tspan")
                        .attr("class", index === secondaryLineIndex ? secondaryLineClass : null)
                        .attr("x", textX)
                        .attr("dy", index === 0 ? 0 : topologyCardTitleLineGap)
                        .text(line)
                })

                title.selectAll("title").remove()
                title.append("title").text(fullText)
            })
        }

        const cardTextEnter = nodeEnter.append("g")
            .attr("class", "node-card-text")
            .attr("pointer-events", "none")

        cardTextEnter.append("text")
            .attr("class", "node-card-title")
            .attr("x", (d: D3Node) => cardTitleX(d))
            .attr("y", 7)
            .each(function (d: D3Node) {
                fitNodeTitle(select(this) as Selection<SVGTextElement, D3Node, any, any>)
            })

        cardTextEnter.append("text")
            .attr("class", "node-card-chevron")
            .attr("x", (d: D3Node) => cardWidthForNode(d) / 2 - 18)
            .attr("y", 6)
            .text((d: D3Node) => isWorkloadControllerNode(d.data.wrapped) ? "›" : "")

        const clusterPreview = nodeEnter.append("g")
            .attr("class", "node-container-grid")
            .attr("pointer-events", "auto")
            .style("opacity", (d: D3Node) => isGroupCardNode(d) ? 1 : 0)

        clusterPreview.append("text")
            .attr("class", "node-container-more")
            .attr("x", (d: D3Node) => cardTextX(d) + 104)
            .attr("y", 33)

        nodeEnter.append("g")
            .attr("class", "node-group-list")
            .attr("pointer-events", "auto")

        // Update names only when vmNameMap changed to reduce long-running render overhead.
        if (this.lastVmNameMapRef !== this.props.vmNameMap || this.lastVmNetworkMapRef !== this.props.vmNetworkMap) {
            node.select("text.node-card-title")
                .each(function (d: D3Node) {
                    fitNodeTitle(select(this) as Selection<SVGTextElement, D3Node, any, any>)
                })
            this.lastVmNameMapRef = this.props.vmNameMap
            this.lastVmNetworkMapRef = this.props.vmNetworkMap
        }

        const renderNodeBadge = function (d: D3Node) {
            var badge = select(this).selectAll("g.node-badge")
                .data(self.props.nodeAttrs(d.data.wrapped).badges)

            var badgeEnter = badge.enter()
                .append("g")
            badge.exit().remove()

            badgeEnter
                .append("rect")

            badgeEnter
                .append("text")

            var badgeMerged = badgeEnter.merge(badge as any)

            badgeMerged
                .attr("class", (d: BadgeAttrs) => `node-badge ${d.className || ""}`.trim())

            badgeMerged
                .select("rect")
                .attr("x", (d: BadgeAttrs, i: number) => 66 - i * 28)
                .attr("y", -41)
                .attr("width", 24)
                .attr("height", 24)
                .attr("rx", 12)
                .attr("ry", 12)
                .attr("fill", (d: BadgeAttrs) => d.fill ? d.fill : "#6975a9")

            badgeMerged
                .select("text")
                .attr("class", (d: BadgeAttrs) => d.iconClass ? d.iconClass : "")
                .attr("dx", (d: BadgeAttrs, i: number) => 78 - i * 28)
                .attr("dy", -23)
                .text((d: BadgeAttrs) => d.text)
                .attr("pointer-events", "none")
                .attr("fill", (d: BadgeAttrs) => d.stroke ? d.stroke : "var(--topology-node-name-wrap-fill)")
        }

        nodeEnter
            .append("g")
            .attr("class", "node-badges")
            .attr("pointer-events", "none")
            .each(renderNodeBadge)

        node = node.merge(nodeEnter as any)

        node.attr("class", nodeClass)

        node.each(renderNodeBadge)

        node.select("rect.node-card-bg")
            .transition()
            .duration(animDuration)
            .attr("x", (d: D3Node) => -cardWidthForNode(d) / 2)
            .attr("width", (d: D3Node) => cardWidthForNode(d))
            .attr("height", (d: D3Node) => cardHeightForNode(d))

        node.select("rect.node-group-backplate-1")
            .interrupt()
            .attr("x", (d: D3Node) => -cardWidthForNode(d) / 2 + groupBackplateNearOffset.x)
            .attr("y", cardTopY + groupBackplateNearOffset.y)
            .attr("width", (d: D3Node) => cardWidthForNode(d))
            .attr("height", topologyCardHeight)

        node.select("rect.node-group-backplate-2")
            .interrupt()
            .attr("x", (d: D3Node) => -cardWidthForNode(d) / 2 + groupBackplateFarOffset.x)
            .attr("y", cardTopY + groupBackplateFarOffset.y)
            .attr("width", (d: D3Node) => cardWidthForNode(d))
            .attr("height", topologyCardHeight)

        node.select("rect.node-card-bg")
            .style("display", (d: D3Node) => isGroupListNode(d) ? "none" : null)

        node.select("circle.node-card-icon-bg")
            .attr("cx", (d: D3Node) => cardIconX(d))

        node.select("image.node-icon")
            .attr("class", (d: D3Node) => {
                const attrs = self.props.nodeAttrs(d.data.wrapped)
                return "node-icon " + attrs.iconClass
            })
            .attr("transform", (d: D3Node) => {
                const dimensions = imageIconDimensions(d)
                return `translate(${cardIconX(d) - dimensions.width / 2},${-dimensions.height / 2})`
            })
            .attr("width", (d: D3Node) => imageIconDimensions(d).width)
            .attr("height", (d: D3Node) => imageIconDimensions(d).height)
            .attr("preserveAspectRatio", (d: D3Node) => self.props.nodeAttrs(d.data.wrapped).iconClass === "network-switch-icon" ? "none" : "xMidYMid meet")
            .attr("xlink:href", (d: D3Node) => self.props.nodeAttrs(d.data.wrapped).href)

        node.select("text.node-icon")
            .attr("class", (d: D3Node) => {
                const attrs = self.props.nodeAttrs(d.data.wrapped)
                return "node-icon " + attrs.iconClass
            })
            .attr("x", (d: D3Node) => cardIconX(d))
            .text((d: D3Node) => self.props.nodeAttrs(d.data.wrapped).icon)

        node.select("text.node-card-title")
            .attr("x", (d: D3Node) => cardTitleX(d))
            .each(function (d: D3Node) {
                fitNodeTitle(select(this) as Selection<SVGTextElement, D3Node, any, any>)
            })

        node.select("text.node-card-chevron")
            .attr("x", (d: D3Node) => cardWidthForNode(d) / 2 - 18)
            .text((d: D3Node) => isWorkloadControllerNode(d.data.wrapped) ? "›" : "")

        node.select("rect.node-card-bg title")
            .text((d: D3Node) => isGroupCardNode(d)
                ? groupCardTooltip(d)
                : isWorkloadControllerNode(d.data.wrapped)
                    ? `${getNodeDisplayName(d)}\n클릭하여 상세 보기`
                    : getNodeDisplayName(d))

        node.select("text.node-container-more")
            .attr("x", (d: D3Node) => cardTextX(d) + 104)
            .text("")

        const miniCardDisplayName = (node: Node) => {
            return self.nodeDisplayNameForGroupList(node)
        }

        const miniCardName = (node: Node) => {
            const name = miniCardDisplayName(node)
            const type = String(node.data?.Type || "").toLowerCase()
            const maxLength = type === "libvirt" || type === "host" ? 52 : 44
            return name.length > maxLength ? `${name.substring(0, Math.max(1, maxLength - 3))}...` : name
        }

        const miniCardStatus = (node: Node) => {
            return topologyNodeStatus(node)
        }

        const miniCardTooltip = (node: Node) => {
            const attrs = self.props.nodeAttrs(node)
            const status = miniCardStatus(node)
            const data = node.data || {}
            const details = [
                miniCardDisplayName(node),
                `상태: ${status.label}`,
                data.IP || data.IPV4 || data.Address || data.MgtAddr ? `IP: ${data.IP || data.IPV4 || data.Address || data.MgtAddr}` : "",
                data.CPU || data.CPUNumber ? `CPU: ${data.CPU || data.CPUNumber}` : "",
                data.Memory || data.MemorySize ? `Memory: ${data.Memory || data.MemorySize}` : "",
                "Click → 상세 보기"
            ].filter(Boolean)
            return details.join("\n")
        }

        const renderGroupList = function (this: SVGGElement, d: D3Node) {
            const g = select(this)
            const data: D3Node[] = []
            var navigator = g.selectAll<SVGForeignObjectElement, D3Node>("foreignObject.node-group-navigator")
                .data(data, (d: D3Node) => d.data.wrapped.id)

            navigator.exit()
                .each(function (d: D3Node) {
                    const root = select(this).select("div.node-group-navigator-root").node()
                    if (root) {
                        ReactDOM.unmountComponentAtNode(root as Element)
                    }
                    self.groupNavigatorRenderKeys.delete(d.data.wrapped.id)
                })
                .remove()

            const navigatorEnter = navigator.enter()
                .append("foreignObject")
                .attr("class", "node-group-navigator")
                .attr("pointer-events", "all")

            navigatorEnter
                .append("xhtml:div")
                .attr("class", "node-group-navigator-root")

            navigator = navigatorEnter.merge(navigator as any)
            navigator
                .each(function (d: D3Node) {
                    const navigatorElement = this as SVGForeignObjectElement
                    const navigatorWidth = groupListWidthForNode(d.data.wrapped)
                    const navigatorHeight = self.groupListHeight(self.filteredGroupNavigatorNodes(d.data.wrapped.children as Node[], d.data.wrapped.id).length)
                    const navigatorAttrs: { [key: string]: number } = {
                        x: -navigatorWidth / 2,
                        y: -navigatorHeight / 2,
                        width: navigatorWidth,
                        height: navigatorHeight
                    }
                    Object.keys(navigatorAttrs).forEach((key) => {
                        const nextValue = String(navigatorAttrs[key])
                        if (navigatorElement.getAttribute(key) !== nextValue) {
                            navigatorElement.setAttribute(key, nextValue)
                        }
                    })
                    const root = select(this).select("div.node-group-navigator-root").node()
                    if (!root) {
                        return
                    }
                    const rootElement = root as HTMLElement
                    const groupID = d.data.wrapped.id
                    const filter = self.groupNavigatorFilter(groupID)
                    const children = d.data.wrapped.children as Node[]
                    // Navigator must stay mounted across name/status refreshes so its internal scroll position is not reset.
                    const nodeKey = children.map((node: Node) => node.id).join("|")
                    const renderKey = `${groupID}|${filter.search}|${nodeKey}`
                    if (self.groupNavigatorRenderKeys.get(groupID) !== renderKey) {
                        ReactDOM.render(
                            <VMGroupNavigator
                                title={self.props.nodeAttrs(d.data.wrapped).name || d.data.wrapped.data?.Name || "VM 그룹"}
                                nodes={children}
                                selectedIDs={new Set(self.selectedGroupListNodeIDs)}
                                search={filter.search}
                                displayName={(node: Node) => miniCardDisplayName(node)}
                                status={(node: Node) => miniCardStatus(node)}
                                onSearchChange={(value: string) => self.setGroupNavigatorFilter(groupID, { search: value })} />,
                            root as Element
                        )
                        self.groupNavigatorRenderKeys.set(groupID, renderKey)
                    }
                    rootElement.querySelectorAll(".topology-vm-navigator-item").forEach((rowElement: Element) => {
                        const row = rowElement as HTMLElement
                        const nodeID = row.getAttribute("data-node-id")
                        row.classList.toggle("is-selected", !!nodeID && self.selectedGroupListNodeIDs.has(nodeID))
                    })
                    const wheelGuard = (domEvent: WheelEvent) => {
                        domEvent.stopPropagation()
                        if (typeof (domEvent as any).stopImmediatePropagation === "function") {
                            ;(domEvent as any).stopImmediatePropagation()
                        }
                    }
                    if ((rootElement as any).__topologyWheelGuard) {
                        rootElement.removeEventListener("wheel", (rootElement as any).__topologyWheelGuard, true)
                    }
                    ;(rootElement as any).__topologyWheelGuard = wheelGuard
                    rootElement.addEventListener("wheel", wheelGuard, true)
                    rootElement.onmousedown = (domEvent: MouseEvent) => {
                        domEvent.stopPropagation()
                    }
                    rootElement.onmouseover = (domEvent: MouseEvent) => {
                        domEvent.stopPropagation()
                    }
                    rootElement.onmouseout = (domEvent: MouseEvent) => {
                        domEvent.stopPropagation()
                    }
                    rootElement.onclick = (domEvent: MouseEvent) => {
                        const target = domEvent.target as HTMLElement | null
                        if (!target) {
                            return
                        }
                        if (target.closest(".ant-input, .ant-input-affix-wrapper")) {
                            domEvent.stopPropagation()
                            return
                        }
                        const action = target.closest("[data-group-action]") as HTMLElement | null
                        if (action) {
                            const actionType = action.getAttribute("data-group-action")
                            domEvent.preventDefault()
                            domEvent.stopPropagation()
                            if (actionType === "select-all") {
                                const nodes = self.filteredGroupNavigatorNodes(d.data.wrapped.children as Node[], groupID)
                                self.setGroupListNodes(nodes, true)
                            }
                            if (actionType === "clear-selection") {
                                self.setGroupListNodes(d.data.wrapped.children as Node[], false)
                            }
                            return
                        }
                        const row = target.closest("[data-node-id]") as HTMLElement | null
                        if (!row) {
                            domEvent.stopPropagation()
                            return
                        }
                        const nodeID = row.getAttribute("data-node-id")
                        const child = (d.data.wrapped.children as Node[]).find((node: Node) => node.id === nodeID)
                        if (!child) {
                            return
                        }
                        domEvent.preventDefault()
                        domEvent.stopPropagation()
                        self.toggleGroupListNode(child)
                    }
                    rootElement.onwheel = (domEvent: WheelEvent) => {
                        domEvent.stopPropagation()
                        if (typeof (domEvent as any).stopImmediatePropagation === "function") {
                            ;(domEvent as any).stopImmediatePropagation()
                        }
                    }
                })
        }

        const renderContainerGrid = function (this: SVGGElement, d: D3Node) {
            const g = select(this)
            const expanded = isGroupContainerNode(d)
            const layout = expanded ? self.groupContainerDrilldownLayout(d.data.wrapped.children) : { items: [], networkItems: [], height: 0, more: 0 }
            var cards = g.selectAll<SVGGElement, GroupContainerLayoutItem>("g.node-container-mini-card")
                .data(layout.items, (item: GroupContainerLayoutItem) => item.node.id)

            cards.exit().remove()

            const cardsEnter = cards.enter()
                .append("g")
                .attr("class", "node-container-mini-card")
                .attr("pointer-events", "all")
                .on("click", (item: GroupContainerLayoutItem) => {
                    event.stopPropagation()
                    self.hideNodeContextMenu()
                    const child = item.node as Node
                    const isExpanded = self.expandedContainerMiniNodeIDs.has(child.id)
                    if (isExpanded) {
                        self.expandedContainerMiniNodeIDs.delete(child.id)
                        if (self.pinnedContainerMiniNodeID === child.id) {
                            self.pinnedContainerMiniNodeID = ""
                        }
                    } else {
                        self.expandedContainerMiniNodeIDs.add(child.id)
                        self.pinnedContainerMiniNodeID = child.id
                    }
                    self.renderTree()
                    self.syncContainerMiniCardActiveClass()
                    self.syncContainerMiniLinkVisibility()
                    if (self.props.onNodeSelected) {
                        self.props.onNodeSelected(child, !isExpanded)
                    }
                })
                .on("dblclick", (item: GroupContainerLayoutItem) => {
                    event.stopPropagation()
                    self.hideNodeContextMenu()
                    const child = item.node as Node
                    self.pinnedContainerMiniNodeID = child.id
                    self.expandedContainerMiniNodeIDs.add(child.id)
                    self.renderTree()
                    self.syncContainerMiniCardActiveClass()
                    self.syncContainerMiniLinkVisibility()
                    if (self.props.onNodeSelected) {
                        self.props.onNodeSelected(child, true)
                    }
                })

            cardsEnter.append("rect")
                .attr("class", "node-container-mini-card-bg")
                .attr("rx", 8)
                .attr("ry", 8)

            cardsEnter.append("text")
                .attr("class", "node-container-mini-card-title")

            cardsEnter.append("circle")
                .attr("class", "node-container-mini-card-status-dot")
                .attr("r", 3.5)

            cardsEnter.append("text")
                .attr("class", "node-container-mini-card-status")

            cardsEnter.append("title")

            cards = cardsEnter.merge(cards as any)
            cards
                .transition()
                .duration(animDuration)
                .attr("transform", (item: GroupContainerLayoutItem) => {
                    const x = -groupContainerWidth / 2 + groupContainerPaddingX + item.x
                    const y = groupContainerGridOffsetY + item.y
                    return `translate(${x},${y})`
                })

            cards.select("rect.node-container-mini-card-bg")
                .transition()
                .duration(animDuration)
                .attr("width", (item: GroupContainerLayoutItem) => item.width)
                .attr("height", (item: GroupContainerLayoutItem) => item.height)

            cards.select("text.node-container-mini-card-title")
                .attr("x", 10)
                .attr("y", 16)
                .text((item: GroupContainerLayoutItem) => miniCardName(item.node as Node))

            cards.select("circle.node-container-mini-card-status-dot")
                .attr("cx", 11)
                .attr("cy", 30)
                .attr("class", (item: GroupContainerLayoutItem) => `node-container-mini-card-status-dot ${miniCardStatus(item.node as Node).className}`)

            cards.select("text.node-container-mini-card-status")
                .attr("x", 20)
                .attr("y", 34)
                .attr("class", (item: GroupContainerLayoutItem) => `node-container-mini-card-status ${miniCardStatus(item.node as Node).className}`)
                .text((item: GroupContainerLayoutItem) => miniCardStatus(item.node as Node).label)

            cards.select("title")
                .text((item: GroupContainerLayoutItem) => miniCardTooltip(item.node as Node))

            var networkCards = g.selectAll<SVGGElement, GroupContainerNetworkItem>("g.node-container-network-mini")
                .data(layout.networkItems, (item: GroupContainerNetworkItem) => item.node.id)

            networkCards.exit().remove()

            const networkCardsEnter = networkCards.enter()
                .append("g")
                .attr("class", "node-container-network-mini")
                .attr("pointer-events", "all")
                .on("click", (item: GroupContainerNetworkItem) => {
                    event.stopPropagation()
                    self.hideNodeContextMenu()
                    const activeMiniNodeID = self.pinnedContainerMiniNodeID
                    self.selectNode(item.node.id, true)
                    self.pinnedContainerMiniNodeID = activeMiniNodeID
                    if (activeMiniNodeID) {
                        self.expandedContainerMiniNodeIDs.add(activeMiniNodeID)
                    }
                    self.syncContainerMiniCardActiveClass()
                    self.syncContainerMiniLinkVisibility()
                })

            networkCardsEnter.append("rect")
                .attr("class", "node-container-network-mini-bg")
                .attr("rx", 7)
                .attr("ry", 7)

            networkCardsEnter.append("text")
                .attr("class", "node-container-network-mini-title")

            networkCardsEnter.append("title")

            networkCards = networkCardsEnter.merge(networkCards as any)
            networkCards
                .transition()
                .duration(animDuration)
                .attr("transform", (item: GroupContainerNetworkItem) => {
                    const x = -groupContainerWidth / 2 + groupContainerPaddingX + item.x
                    const y = groupContainerGridOffsetY + item.y
                    return `translate(${x},${y})`
                })

            networkCards.select("rect.node-container-network-mini-bg")
                .transition()
                .duration(animDuration)
                .attr("width", (item: GroupContainerNetworkItem) => item.width)
                .attr("height", (item: GroupContainerNetworkItem) => item.height)

            networkCards.select("text.node-container-network-mini-title")
                .attr("x", 10)
                .attr("y", 25)
                .text((item: GroupContainerNetworkItem) => miniCardName(item.node))

            networkCards.select("title")
                .text((item: GroupContainerNetworkItem) => miniCardTooltip(item.node))

            g.select("text.node-container-more")
                .attr("x", -groupContainerWidth / 2 + groupContainerPaddingX)
                .attr("y", cardHeightForNode(d) - topologyCardHeight / 2 - 12)
                .text(layout.more > 0 ? `+${layout.more}개 더 있음` : "")
        }

        node.select("g.node-container-grid")
            .each(renderContainerGrid)

        node.select("g.node-group-list")
            .each(renderGroupList)

        var exco = nodeEnter
            .append("g")
            .attr("class", "node-exco")
            .attr("pointer-events", "all")

        interface DisplayBadge {
            key: string
            count: number
            tone: string
            tooltip: string
            displayText?: string
        }
        const compactStatusBadges = (badges: TopologyStatusBadge[]): DisplayBadge[] => {
            if (badges.length <= topologyVisibleStatusBadgeLimit) {
                return badges
            }
            const hidden = badges.slice(topologyVisibleStatusBadgeLimit)
            return [
                ...badges.slice(0, topologyVisibleStatusBadgeLimit),
                {
                    key: 'overflow',
                    count: hidden.length,
                    tone: 'overflow',
                    displayText: `+${hidden.length}`,
                    tooltip: hidden.map(item => item.tooltip).join('\n\n')
                }
            ]
        }
        const displayBadges = (d: D3Node): DisplayBadge[] => {
            const statusBadges = topologyStatusBadges(d.data.wrapped)
            if (statusBadges !== undefined) return compactStatusBadges(statusBadges)
            const type = normalizedType(d.data.wrapped)
            if (isKubernetesResource(d.data.wrapped)
                && (type === 'pod' || type === 'node' || type === 'persistentvolume' || type === 'persistentvolumeclaim')) {
                return []
            }
            const count = isKubernetesPod(d.data.wrapped)
                ? d.data.wrapped.children.filter(child => isCurrentKubernetesPod(child)).length
                : d.data.wrapped.children.length
            return count > 0
                ? [{ key: 'children', count, tone: 'running', tooltip: `연결된 자원 ${count}` }]
                : []
        }

        const renderStatusBadges = function (d: D3Node) {
            const root = select(this)
            const badges = isGroupContainerNode(d) || isGroupListNode(d) ? [] : displayBadges(d)
            let badge = root.selectAll<SVGGElement, DisplayBadge>("g.node-exco-badge")
                .data(badges, (item: DisplayBadge) => item.key)
            badge.exit().remove()
            const badgeEnter = badge.enter()
                .append("g")
                .attr("class", "node-exco-badge")
            badgeEnter.append("circle")
                .attr("class", "node-exco-circle")
                .attr("cy", -topologyCardHeight / 2 + 12)
                .attr("r", 15)
            badgeEnter.append("text")
                .attr("class", "node-exco-children")
                .attr("y", -topologyCardHeight / 2 + 17)
            badgeEnter.append("title")
            badge = badgeEnter.merge(badge as any)
            badge
                .attr("class", item => `node-exco-badge is-${item.tone}`)
                .attr("transform", (_item, index) => `translate(${(index - Math.max(0, badges.length - 1)) * 34},0)`)
            badge.select("circle")
                .attr("cx", cardWidthForNode(d) / 2 - 12)
            badge.select("text")
                .attr("x", cardWidthForNode(d) / 2 - 12)
                .style("font-size", item => item.displayText || item.count >= 100 ? "12px" : null)
                .text(item => item.displayText || item.count)
            badge.select("title")
                .text(item => item.tooltip)
            root.style("opacity", badges.length > 0 ? 1 : 0)
        }

        exco.each(renderStatusBadges)
        node.select("g.node-exco").each(renderStatusBadges)

        node.transition()
            .duration(animDuration)
            .style("opacity", 1)
            .attr("transform", (d: D3Node) => `translate(${d.x},${d.y})`)
            .attr("class", nodeClass)

        node
            .filter((d: D3Node) => d.data.wrapped.state.selected)
            .raise()
    }

    private linkClass(d: Link) {
        const directedClass = (d: Link) => {
            var dSource = this.d3nodes.get(d.source.id)
            var dTarget = this.d3nodes.get(d.target.id)

            if (!dSource || !dTarget) {
                return ""
            }

            if (dSource.y === dTarget.y) {
                return dSource.x > dTarget.x ? "directed-inv" : "directed"
            }

            if (dSource.y > dTarget.y || dSource.x > dTarget.x) {
                return "directed-inv"
            }
            return "directed"
        }

        var classes = new Array<string>()
        var attrs = this.props.linkAttrs(d)
        return classes.concat("link", attrs.classes, attrs.directed ? directedClass(d) : "").join(" ")
    }

    private renderLinks() {
        var linkerCache = new Map<string, any>()
        var visibleCache = new Map<string, any>()

        const resolveEndpoint = (link: Link, side: "source" | "target") => {
            const visibleNode = side === "source" ? link.source : link.target
            const originalID = side === "source" ? link.data?.__sourceNodeID : link.data?.__targetNodeID
            const d3node = this.d3nodes.get(visibleNode.id)
            if (!d3node) {
                return null
            }

            let group = originalID ? this.nodeGroup.get(originalID) : undefined
            let groupChildID = originalID
            if (!group && originalID) {
                let originalNode: Node | undefined = this.nodes.get(originalID)
                while (originalNode) {
                    const parentGroup = this.nodeGroup.get(originalNode.id)
                    if (parentGroup && parentGroup.id === visibleNode.id) {
                        group = parentGroup
                        groupChildID = originalNode.id
                        break
                    }
                    originalNode = originalNode.parent || undefined
                }
            }
            if (!group || group.id !== visibleNode.id || !group.wrapped.state.expanded || !this.isGroupContainerNode(d3node)) {
                return { x: d3node.x, y: d3node.y, node: visibleNode, embedded: false }
            }

            const layout = this.groupContainerDrilldownLayout(group.wrapped.children)
            const networkItem = originalID ? layout.networkItems.find(item => item.node.id === originalID) : undefined
            if (networkItem) {
                return {
                    x: d3node.x - groupContainerWidth / 2 + groupContainerPaddingX + networkItem.x + networkItem.width / 2,
                y: d3node.y + groupContainerGridOffsetY + networkItem.y + networkItem.height / 2,
                    node: visibleNode,
                    embedded: true
                }
            }

            const item = layout.items.find(item => item.node.id === groupChildID)
            if (!item) {
                return { x: d3node.x, y: d3node.y, node: visibleNode, embedded: false }
            }

            return {
                x: d3node.x - groupContainerWidth / 2 + groupContainerPaddingX + item.x + item.width / 2,
                y: d3node.y + groupContainerGridOffsetY + item.y + item.height / 2,
                node: visibleNode,
                embedded: true
            }
        }

        const isVisible = (d: any) => {
            let ok = visibleCache.has(d.id)
            if (ok) {
                return visibleCache.get(d.id)
            }

            let visible = this.isLinkVisible(d)
            visibleCache.set(d.id, visible)

            return visible
        }

        const shouldDrawLink = (d: Link) => {
            return !this.isContainerProxyLink(d) || this.linkDisplayOpacity(d) > 0
        }

        const linkPath = (d: Link) => {
            return shouldDrawLink(d) ? linker(d) : ""
        }

        const vLinker = linkVertical()
            .x((d: any) => d.x)
            .y((d: any) => d.y)

        const hLinker = (d: any) => {
            var x1 = d.source.x
            var x2 = d.target.x
            var y = d.source.y

            if (Math.abs(x1 - x2) > nodeWidth) {
                let len = x2 - x1
                var points = [
                    { x: x1 - 13, y: y + 35 },
                    { x: x1 + len / 4, y: y + 50 + 0.05 * len },
                    { x: x2 - len / 4, y: y + 50 + 0.05 * len },
                    { x: x2 + 13, y: y + 35 }
                ]
            } else {
                var points = [
                    { x: x1, y: y },
                    { x: x2, y: y }
                ]
            }

            const liner = line()
                .x(d => d.x)
                .y(d => d.y)
                .curve(curveCatmullRom.alpha(0.01))

            return liner(points)
        }

        var wrapperLink = (d: Link, margin: number) => {
            var dSource = resolveEndpoint(d, "source")
            var dTarget = resolveEndpoint(d, "target")

            if (!dSource || !dTarget) {
                return
            }

            var line = linkerCache.get(d.id)
            if (line) {
                return line
            }

            let endpointMargin = dSource.embedded || dTarget.embedded ? 22 : margin

            let source = dSource
            let target = dTarget
            if (dSource.y === dTarget.y) {
                if (dSource.x > dTarget.x) {
                    source = dTarget, target = dSource
                }

                line = hLinker({
                    source: { x: source.x + endpointMargin, y: source.y, node: d.source },
                    target: { x: target.x - endpointMargin, y: target.y, node: d.target }
                })

                linkerCache.set(d.id, line)

                return line
            }

            if (dSource.y > dTarget.y || dSource.x > dTarget.x) {
                source = dTarget, target = dSource
            }

            if (source.y > target.y) {
                endpointMargin *= -1
            }

            line = vLinker({
                source: { x: source.x, y: source.y + endpointMargin, node: d.source },
                target: { x: target.x, y: target.y - endpointMargin, node: d.target }
            })

            linkerCache.set(d.id, line)

            return line
        }
        const linker = (d: Link) => wrapperLink(d, 55)

        var visibleLinks = this.visibleLinks()

        const linkOverlayClass = (d: Link) => new Array<string>().concat("link-overlay",
            d.state.selected ? "link-overlay-selected" : "").join(" ")

        var linkOverlay = this.gLinkOverlays.selectAll('path.link-overlay')
            .interrupt()
            .data(visibleLinks, (d: Link) => d.id)
        var linkOverlayEnter = linkOverlay.enter()
            .append('path')
            .attr("id", (d: Link) => "link-overlay-" + d.id)
            .attr("class", linkOverlayClass)
            .style("opacity", 0)
        linkOverlay.exit().remove()

        linkOverlay = linkOverlay.merge(linkOverlayEnter)

        linkOverlay
            .transition()
            .duration(animDuration)
            .style("opacity", (d: Link) => {
                const displayOpacity = this.linkDisplayOpacity(d)
                if (displayOpacity === 0) {
                    return 0
                }
                return d.state.selected || this.isLinkNodeSelected(d) || this.isActiveContainerMiniLink(d) ? 1 : 0
            })
            .attr("d", linkPath)

        var link = this.gLinks.selectAll('path.link')
            .interrupt()
            .data(visibleLinks, (d: Link) => d.id)

        var linkEnter = link.enter()
            .append('path')
            .attr("id", (d: Link) => "link-" + d.id)
            .attr("class", "link")
            .style("opacity", 0)
        link.exit().remove()

        link = link.merge(linkEnter)
        link
            .attr("class", (d: Link) => isVisible(d) ? this.linkClass(d) : 'link')
            .transition()
            .duration(animDuration)
            .style("opacity", (d: Link) => this.linkDisplayOpacity(d))
            .attr("d", linkPath)

        const linkLabelClass = (d: Link) => new Array<string>().concat("link-label",
            this.isLinkNodeSelected(d) ? "link-label-priority" : "").join(" ")

        const linkLabelPosition = (d: Link) => {
            const dSource = resolveEndpoint(d, "source")
            const dTarget = resolveEndpoint(d, "target")

            if (!dSource || !dTarget) {
                return { x: 0, y: 0 }
            }

            const x1 = dSource.x
            const y1 = dSource.y
            const x2 = dTarget.x
            const y2 = dTarget.y
            const dx = x2 - x1
            const dy = y2 - y1
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            const mx = (x1 + x2) / 2
            const my = (y1 + y2) / 2

            let ox = 0
            let oy = 0

            if (Math.abs(dx) < nodeWidth * 0.35) {
                ox = 36
            } else if (Math.abs(dy) < nodeHeight * 0.2) {
                oy = -34
            } else {
                ox = (-dy / len) * 34
                oy = (dx / len) * 34
            }

            const label = this.props.linkAttrs(d).label || ""
            const labelWidth = Math.max(76, label.length * 18 + 22)
            const labelHeight = 42
            const intersects = (
                ax: number,
                ay: number,
                aw: number,
                ah: number,
                bx: number,
                by: number,
                bw: number,
                bh: number
            ) => Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh

            const countOverlaps = (x: number, y: number) => {
                let count = 0
                for (const node of this.d3nodes.values()) {
                    if (node.data.type === WrapperType.Hidden) {
                        continue
                    }

                    const nodeCardWidth = node.data.wrapped.data?.Type === "libvirt" || node.data.wrapped.data?.Type === "tuntap" || node.data.wrapped.data?.Type === "tun" || node.data.wrapped.data?.Type === "tap" ? topologyMediumCardWidth : topologyCardWidth
                    const overlapsNodeCard = intersects(x, y, labelWidth, labelHeight, node.x, node.y, nodeCardWidth + 16, topologyCardHeight + 16)
                    if (overlapsNodeCard) {
                        count++
                    }
                }
                return count
            }

            const isMostlyVertical = Math.abs(dx) < nodeWidth * 0.35
            const candidates = isMostlyVertical ? [
                { x: mx - 64, y: my },
                { x: mx + 64, y: my },
                { x: mx - 96, y: my },
                { x: mx + 96, y: my },
                { x: mx - 64, y: my + 42 },
                { x: mx + 64, y: my + 42 },
                { x: mx - 64, y: my - 42 },
                { x: mx + 64, y: my - 42 }
            ] : [
                { x: mx + ox, y: my + oy },
                { x: mx - ox, y: my - oy },
                { x: mx + ox * 1.6, y: my + oy * 1.6 },
                { x: mx - ox * 1.6, y: my - oy * 1.6 },
                { x: mx, y: my - 54 },
                { x: mx, y: my + 54 }
            ]

            let best = candidates[0]
            let bestOverlapCount = countOverlaps(best.x, best.y)
            for (const candidate of candidates.slice(1)) {
                const overlapCount = countOverlaps(candidate.x, candidate.y)
                if (overlapCount < bestOverlapCount) {
                    best = candidate
                    bestOverlapCount = overlapCount
                    if (bestOverlapCount === 0) {
                        break
                    }
                }
            }

            return best
        }

        const self = this
        var linkLabel = this.gLinkLabels.selectAll('g.link-label')
            .interrupt()
            .data(visibleLinks.filter((d: Link) => shouldDrawLink(d) && this.props.linkAttrs(d).label), (d: Link) => d.id)

        if (this.raisedLinkLabelID && !visibleLinks.some((d: Link) => d.id === this.raisedLinkLabelID && this.props.linkAttrs(d).label)) {
            this.clearRaisedLinkLabel()
        }

        var linkLabelEnter = linkLabel.enter()
            .append('g')
            .attr("class", linkLabelClass)
            .attr("id", (d: Link) => "link-label-" + d.id)
            .style("opacity", (d: Link) => this.linkLabelOpacity(d))
        linkLabelEnter.append('rect')
            .attr("class", "link-label-bg")
            .attr("rx", 7)
            .attr("ry", 7)
        linkLabelEnter.append('text')
            .attr("class", "link-label-text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .text((d: Link) => this.props.linkAttrs(d).label)
        linkLabel.exit().remove()

        linkLabel = linkLabel.merge(linkLabelEnter)
        linkLabel
            .attr("class", linkLabelClass)
            .style("opacity", (d: Link) => this.linkLabelOpacity(d))
            .attr("transform", (d: Link) => {
                const position = linkLabelPosition(d)
                return `translate(${position.x},${position.y})`
            })
            .on("click", function (d: Link) {
                self.raiseLinkLabel(this as SVGGElement, d)
            })
        linkLabel.select('text').text((d: Link) => this.props.linkAttrs(d).label)
        linkLabel.each(function () {
            const label = select(this)
            const text = label.select("text").node() as SVGTextElement | null
            if (!text) {
                return
            }

            const bb = text.getBBox()
            label.select("rect")
                .attr("x", bb.x - 10)
                .attr("y", bb.y - 6)
                .attr("width", bb.width + 20)
                .attr("height", bb.height + 12)
        })

        var linkWrap = this.gLinkWraps.selectAll('path.link-wrap')
            .interrupt()
            .data(visibleLinks, (d: Link) => d.id)
        var linkWrapEnter = linkWrap.enter()
            .append('path')
            .attr("class", "link-wrap")
            .on("click", (d: Link) => this.linkClicked(d))
            .on("mouseover", (d: Link) => {
                if (isVisible(d)) {
                    select("#link-overlay-" + d.id)
                        .style("opacity", 1)
                }
            })
            .on("mouseout", (d: Link) => {
                if (!d.source.state.selected && !d.target.state.selected) {
                    select("#link-overlay-" + d.id)
                        .style("opacity", (d: Link) => d.state.selected ? 1 : 0)
                }
            })
        linkWrap.exit().remove()

        linkWrap = linkWrap.merge(linkWrapEnter)
        linkWrap
            .style("pointer-events", "auto")
            .transition()
            .duration(animDuration)
            .attr("d", linkPath)

        this.syncContainerMiniCardActiveClass()
    }

    renderTree() {
        // Group expansion can replace a proxy group endpoint with an individual
        // child node, so visible links must follow the newly rendered tree.
        this.visibleLinksCache = undefined

        var normRoot = this.normalizeTree(this.root)

        var root = hierarchy(normRoot)
        this.tree(root)
        this.compactSystemVmRouterLayout(root)
        this.compactHostSubtreeLayout(root)

        // update d3nodes cache
        this.d3nodes = new Map<string, D3Node>()
        root.each(node => {
            this.d3nodes.set(node.data.id, node)
        })

        this.renderLevels()
        this.renderHieraLinks(root)
        this.renderNodes(root)
        this.renderGroups()
        this.renderLinks()

        this.invalidated = false
    }

    render() {
        return (
            <div
                className={this.props.className}
                ref={node => this.svgDiv = node}
                style={{ position: 'relative' }}
            >
                <ResizeObserver
                    onResize={(rect) => { this.onResize(rect) }} />
            </div>
        )
    }
}
