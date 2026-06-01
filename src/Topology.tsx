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
import { hierarchy } from 'd3-hierarchy'
import { Selection, select, selectAll, event } from 'd3-selection'
import { line, linkVertical, curveCatmullRom, curveCardinalClosed } from 'd3-shape'
import { } from 'd3-transition'
import { zoom, zoomIdentity } from 'd3-zoom'
import ResizeObserver from 'react-resize-observer'

const flextree = require('d3-flextree').flextree;

import './Topology.css'

const animDuration = 500
const defaultGroupSize = 6
const defaultMaxExpandSize = 100

const nodeWidth = 170
const nodeHeight = 280
const userVmHorizontalGapBoost = 40

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
            this.size = [isUserVmNode ? nodeWidth + userVmHorizontalGapBoost : nodeWidth, nodeHeight]
        }
    }
}

interface D3Node {
    data: NodeWrapper
    x: number
    y: number
    children: Array<D3Node>
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
    groupName?: (node: Node) => string
    groupSize?: number
    onLinkSelected: (link: Link, isSelected: boolean) => void
    onLinkTagChange: (tags: Map<string, LinkTagState>) => void
    onNodeClicked: (node: Node) => void
    onNodeDblClicked: (node: Node) => void
    defaultLinkTagMode?: (tag: string) => LinkTagState
    vmNameMap?: Record<string, string>
    vmNetworkMap?: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>>
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
    private gContextMenu: Selection<SVGGraphicsElement, {}, null, undefined>
    private zoom: zoom
    private liner: line
    private nodeClickedID: number
    private showLevelLabelsTimeoutID: number
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
        this.nodeClickedID = 0
        this.showLevelLabelsTimeoutID = 0
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

        if (this.nodeClickedID) {
            window.clearTimeout(this.nodeClickedID)
            this.nodeClickedID = 0
        }
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
        this.nodeTagActive = ""

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
        this.groupStates.forEach(state => {
            state.expanded = true
            state.groupFullSize = true
            state.groupOffset = 0
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
            link.data = data

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
                if (!count) {
                    this.linkTagCount.delete(tag)
                    this.linkTagStates.delete(tag)
                } else {
                    this.linkTagCount.set(tag, count - 1)
                }
            })
        }
    }

    // group nodes
    private groupify(node: NodeWrapper): Map<string, NodeWrapper> {
        var groups = new Map<string, NodeWrapper>()

        var nodeTypeGID = (node: Node, child: Node): [string, string] | undefined => {
            var nodeType = this.props.groupType ? this.props.groupType(child) : child.data.Type
            if (!nodeType) {
                return
            }
            var gid = node.id + "_" + nodeType + "_" + child.getWeight()

            return [nodeType, gid]
        }

        // dispatch node per groups
        node.children.forEach(child => {
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

                var wrapped = new Node(gid, [], { Name: name, Type: nodeType }, state, () => { return child.wrapped.getWeight() })
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

        var pushed = new Set<string>()

        // iterate one mode time children in order to
        // if a group doesn't reach the groupSize, then remove the group
        // and let the node as it is. If the group reach the groupSize
        // set the children according to the offset and the groupSize or
        // the expand parameter.
        var children = new Array<NodeWrapper>()
        node.children.forEach(child => {
            var ntg = nodeTypeGID(node.wrapped, child.wrapped)
            if (!ntg) {
                return
            }
            var [_, gid] = ntg

            if (pushed.has(gid)) {
                return
            }

            var wrapper = groups.get(gid)
            var groupSize = this.props.groupSize || defaultGroupSize
            if (wrapper && wrapper.wrapped.children.length > groupSize) {
                children.push(wrapper)
                if (wrapper.wrapped.state.expanded) {
                    if (wrapper.wrapped.state.groupFullSize) {
                        children = children.concat(wrapper.children)
                    } else {
                        children = children.concat(
                            wrapper.children.splice(wrapper.wrapped.state.groupOffset, groupSize)
                        )
                    }
                }
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
        if (matchTags && !node.state.expanded) {
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

    expand(node: Node) {
        if (node.state.expanded) {
            this.collapse(node)
        } else {
            node.state.expanded = true
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
            var source = findVisible(link.source)
            var target = findVisible(link.target)

            if (source && target && source.id !== "root" && target.id !== "root" && source !== target) {
                for (let tag of link.tags) {
                    tagPresent.set(tag, true)
                }

                // at least one tag is present
                if (link.tags.some(tag => this.linkTagStates.get(tag) !== LinkTagState.Hidden)) {
                    links.push(new Link(link.id, link.tags, source, target, link.data, link.state))
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
        var minX = node0.x, maxX = node0.x, minY = node0.y, maxY = node0.y

        for (let node of d3nodes) {
            if (minX > node.x) {
                minX = node.x
            }
            if (maxX < node.x) {
                maxX = node.x
            }
            if (minY > node.y) {
                minY = node.y
            }
            if (maxY < node.y) {
                maxY = node.y
            }
        }

        return {
            x: minX - nodeWidth / 2,
            y: minY - nodeHeight / 2,
            width: maxX - minX + nodeWidth,
            height: maxY - minY + nodeHeight
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

    private unselectAllNodes() {
        var self = this

        this.gNodes.selectAll(".node-selected").each(function () {
            var node = select(this)
            if (!node) {
                return
            }
            node.classed("node-selected", false)

            var id = node.attr("id")
            if (!id) {
                return
            }
            id = id.replace(/^node-/, '')

            let n = self.nodeByID(id)
            if (!n) {
                return
            }
            n.state.selected = false

            if (self.props.onNodeSelected) {
                self.props.onNodeSelected(n, false)
            }
        })

        this.hideLinks()
        this.updateLevelLabelActiveClass()
    }

    private hideLinks() {
        var self = this

        selectAll("path.link-overlay").each(function (d: Link) {
            const overlayVisible = d.state.selected || self.isLinkNodeSelected(d) || self.isLinkNodeMouseOver(d)
            select(this).style("opacity", overlayVisible ? 1 : 0)
        })

        selectAll("path.link").each(function (d: Link) {
            select(this).style("opacity", self.isLinkVisible(d) ? 1 : 0)
        })

        selectAll("text.link-label").each(function (d: Link) {
            select(this).style("opacity", self.isLinkVisible(d) ? 1 : 0)
        })
    }

    selectNode(id: string, active: boolean = true) {
        if (!this.isCtrlPressed && active) {
            this.unselectAllNodes()
            this.unselectAllLinks()
        }
        let n = this.nodeByID(id)
        if (!n) {
            return
        }
        n.state.selected = active

        select("#node-" + id).classed("node-selected", active)
        if (active) {
            // Keep selected node (including its name label) above overlapping nodes.
            select("#node-" + id).raise()
        }

        if (this.props.onNodeSelected) {
            let n = this.nodes.get(id)
            if (n) {
                this.props.onNodeSelected(n, active)
            }
        }

        var d = this.d3nodes.get(id)
        if (d) {
            this.highlightNeighborLinks(d, active)
        }
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

        var scale = 0.65 / Math.max(width / viewSize.width, height / viewSize.height)
        if (scale > 1) {
            scale = 1
        }

        this.absTransformX = viewSize.width / 2 - midX * scale
        this.absTransformY = viewSize.height / 2 - midY * scale

        var t = zoomIdentity
            .translate(this.absTransformX, this.absTransformY)
            .scale(scale)
        this.svg
            .transition()
            .duration(animDuration)
            .call(this.zoom.transform, t)
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

        if (this.nodeClickedID) {
            return
        }

        this.nodeClickedID = window.setTimeout(() => {
            this.nodeClickedID = 0

            this.hideNodeContextMenu()

            if (this.props.onNodeClicked) {
                this.props.onNodeClicked(d.data.wrapped)
            }
        }, 170)
    }

    private nodeDoubleClicked(d: D3Node) {
        // it's a dbl click then stop click handler
        if (this.nodeClickedID) {
            clearTimeout(this.nodeClickedID)
            this.nodeClickedID = 0
        }

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
                        let size = this.props.groupSize || defaultGroupSize
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

    private isLinkNodeMouseOver(link: Link): boolean {
        return link.source.state.mouseover || link.target.state.mouseover
    }

    private highlightNeighborLinks(d: D3Node, active: boolean) {
        var opacity = active ? 1 : 0

        const isVisible = (d: Link) => {
            return this.isLinkVisible(d) ? 1 : opacity
        }

        var links = this.neighborLinks(d.data, this.visibleLinks())
        for (let link of links) {
            if (active || !this.isLinkNodeSelected(link)) {
                select("#link-" + link.id)
                    .attr("class", (d: Link) => isVisible(d) ? this.linkClass(d) : 'link')
                    .style("opacity", isVisible)
                select("#link-label-" + link.id)
                    .style("opacity", isVisible)
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
        d.data.wrapped.state.mouseover = active

        var opacity = active ? 1 : 0

        select("#node-overlay-" + id)
            .style("opacity", opacity)

        if (!d.data.wrapped.state.selected) {
            this.highlightNeighborLinks(d, active)
        }
    }

    private isLinkVisible(link: Link): boolean {
        if (link.state.selected) {
            return true
        }

        return link.tags.some(tag => (this.linkTagStates.get(tag) === LinkTagState.Visible) ||
            this.linkTagStates.get(tag) === LinkTagState.EventBased &&
            (link.source.state.selected || link.target.state.selected ||
                link.source.state.mouseover || link.target.state.mouseover))
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

        var text = label.select("text")
            .attr("style", "")
        var element = text.node()
        if (element) {
            const bbox = (element as SVGTextElement).getBBox()
            const centerY = d.bb.height / 2 + bbox.height / 4
            label.select("text.level-label-icon").attr("y", centerY - 32)
            label.select("text.level-label-badge").attr("y", centerY - 32)
            label.select("text.level-label-title").attr("y", centerY + 44)
        }
        label.transition()
            .duration(animDuration)
            .style("opacity", 1)
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
        if (/system vm|시스템 가상머신/i.test(title)) {
            return "\uf085"
        }
        if (/user vm|사용자 가상머신/i.test(title)) {
            return "\uf108"
        }
        if (/switch port|스위치 포트/i.test(title)) {
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
        return "\uf1b2"
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
        levelLabelEnter.append("text")
            .attr("class", "level-label-badge")
            .attr("text-anchor", "middle")
            .attr("x", lang === "en" ? 120 : 110)
            .text((d: LevelRect) => self.levelLabelBadgeIcon(self.weightTitles.get(d.weight) || 'Level ' + d.weight))
        levelLabelEnter.append("text")
            .attr("class", "level-label-title")
            .attr("text-anchor", "middle")
            .attr("x", lang === "en" ? 120 : 110)
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
        var self = this

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

            var x1 = bb.x + 15
            var y1 = bb.y + 70
            var x2 = bb.x + bb.width - 15
            var y2 = bb.y + bb.height - 70
            var margin = 12

            //var left = curlyBrace(x1, y1, x1, y2, 15)
            //var right = curlyBrace(x2, y2, x2, y1, -15)

            var left = straightBrace(x1, y1, x1, y2, margin)
            var right = straightBrace(x2, y2, x2, y1, -margin)

            var brace = g.select("path.group-brace-left")
            if (animated) {
                brace = brace.transition()
                    .duration(animDuration)
            }
            brace.attr("d", "M " + x1 + " " + y1 + " " + left)

            brace = g.select("path.group-brace-right")
            if (animated) {
                brace = brace.transition()
                    .duration(animDuration)
            }
            brace.attr("d", "M " + x2 + " " + y2 + " " + right)

            brace = g.select("path.group-brace-bg")
            if (animated) {
                brace = brace.transition()
                    .duration(animDuration)
            }

            brace
                .attr("d",
                    "M " + (x1 - margin) + " " + y1 + " " +
                    left +
                    " L " + (x2 + margin) + " " + y2 + " " +
                    right +
                    " L " + (x1 - margin) + " " + y1 + " "
                )

            brace = g.select("path.group-brace-owner-bg")

            if (animated && d.wrapped.state.expanded) {
                brace = brace.transition()
                    .duration(animDuration)
                    .style("opacity", d.wrapped.state.expanded ? 1 : 0)
            } else {
                brace.style("opacity", d.wrapped.state.expanded ? 1 : 0)
            }

            let d3node = this.d3nodes.get(d.id)
            if (d3node) {
                let xEnd = d.wrapped.state.expanded ? d3node.x + nodeWidth / 2 : x2
                let junction = d.wrapped.state.expanded ? " L " + xEnd + " " + y1 + " " : right
                brace
                    .attr("d",
                        "M " + (x1 - margin) + " " + y1 + " " +
                        left +
                        " L " + xEnd + " " + y2 + " " +
                        junction +
                        " L " + (x1 - margin) + " " + y1 + " ")
            }
        }

        groupEnter.transition()
            .duration(animDuration)
            .style("opacity", 1)

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

        const handleIcon = (gIcon: any, d: NodeWrapper, dy: number, disabled: boolean) => {
            let d3node = this.d3nodes.get(d.id)
            if (!d3node) {
                return
            }

            var y = d3node.y - nodeWidth / 2

            var text = gIcon.select("text")
            var bb = text.node().getBBox()

            gIcon.select("rect")
                .attr("x", bb.x + 2)
                .attr("y", bb.y + 2)
                .attr("width", bb.width - 4)
                .attr("height", bb.height - 4)

            gIcon = gIcon.transition()
                .duration(animDuration)

            var opacity = 0
            if (d.wrapped.state.expanded) {
                opacity = disabled ? 0.5 : 1
            }

            gIcon
                .style("opacity", opacity)
                .attr("transform", (d: D3Node) => d3node ? `translate(${d3node.x + nodeWidth / 2},${y + dy})` : ``)
        }

        const handleOffset = (gIcon: any, d: NodeWrapper, dy: number, offset: number, disabled: boolean) => {
            let d3node = this.d3nodes.get(d.id)
            if (!d3node) {
                return
            }

            var y = d3node.y - nodeWidth / 2

            var text = gIcon.select("text")
            text.text(offset)

            var bb = text.node().getBBox()
            text
                .attr("dx", 6)
                .attr("dy", 1)

            gIcon.select("rect")
                .attr("x", bb.x - 6)
                .attr("y", bb.y - 1)
                .attr("width", bb.width + 12)
                .attr("height", 21)

            var opacity = 0
            if (d.wrapped.state.expanded) {
                opacity = disabled ? 0.5 : 1
            }

            gIcon = gIcon.transition()
                .duration(animDuration)
                .style("opacity", opacity)
                .attr("transform", (d: D3Node) => d3node ? `translate(${d3node.x + nodeWidth / 2},${y + dy})` : ``)
        }

        var groupButton = this.gGroupButtons.selectAll('g.group-button')
            .interrupt()
            .data(Array.from(this.groups.values()), (d: NodeWrapper) => d.id)
        var groupButtonEnter = groupButton.enter()
            .append("g")
            .attr("class", "group-button")
            .attr("id", (d: Group) => d.id)
        groupButton.exit().remove()

        var offsetIcon = groupButtonEnter.append("g")
            .attr("class", "brace-offset")
            .style("opacity", 1)
        offsetIcon.append("rect")
            .attr("rx", 2)
            .attr("ry", 2)
        offsetIcon.append("text")

        var leftIcon = groupButtonEnter.append("g")
            .attr("class", "brace-icon brace-left-icon")
            .style("opacity", 0)
        leftIcon.append("rect")
            .attr("rx", 5)
            .attr("ry", 5)
        leftIcon.append("text")
            .text("\uf191")
            .on("click", (d: NodeWrapper) => {
                if (!d.wrapped.state.expanded) {
                    return
                }

                if (d.wrapped.state.groupOffset > 0) {
                    d.wrapped.state.groupOffset--
                    self.resetCacheAndRenderTree()
                }
            })

        var rightIcon = groupButtonEnter.append("g")
            .attr("class", "brace-icon brace-right-icon")
            .style("opacity", 0)
        rightIcon.append("rect")
            .attr("rx", 5)
            .attr("ry", 5)
        rightIcon.append("text")
            .text("\uf152")
            .on("click", (d: NodeWrapper) => {
                if (!d.wrapped.state.expanded) {
                    return
                }

                var size = this.props.groupSize || defaultGroupSize
                if (d.wrapped.state.groupOffset + size < d.wrapped.children.length) {
                    d.wrapped.state.groupOffset++
                    self.resetCacheAndRenderTree()
                }
            })

        var fullIcon = groupButtonEnter.append("g")
            .attr("class", "brace-icon brace-full-icon")
            .style("opacity", 0)
        fullIcon.append("rect")
            .attr("rx", 5)
            .attr("ry", 5)
        fullIcon.append("text")
            .text("\uf0fe")
            .on("click", function (d: NodeWrapper) {
                if (d.wrapped.state.groupFullSize) {
                    d.wrapped.state.groupFullSize = false
                    select(this).text("\uf0fe")
                } else {
                    d.wrapped.state.groupFullSize = true
                    select(this).text("\uf146")
                }

                self.resetCacheAndRenderTree()
            })

            const handleIcons = (g: any, d: NodeWrapper) => {
                var size = this.props.groupSize || defaultGroupSize

                // 오프셋 숫자 뱃지
                handleOffset(
                    g.select("g.brace-offset"),
                    d,
                    25,
                    d.wrapped.state.groupOffset,
                    d.wrapped.state.groupFullSize
                )

                // 좌/우 화살표 아이콘
                handleIcon(
                    g.select("g.brace-left-icon"),
                    d,
                    80,
                    d.wrapped.state.groupFullSize || d.wrapped.state.groupOffset === 0
                )
                handleIcon(
                    g.select("g.brace-right-icon"),
                    d,
                    55,
                    d.wrapped.state.groupFullSize || d.wrapped.state.groupOffset + size >= d.wrapped.children.length
                )

                // 전체 펼치기/접기 아이콘 (+ / -) 처리
                if (d.wrapped.children.length <= defaultMaxExpandSize) {
                    const fullIconGroup = g.select("g.brace-full-icon")

                    // 위치/투명도 등 기본 렌더링
                    handleIcon(fullIconGroup, d, 105, false)

                    // 여기서 groupFullSize 값에 맞춰 + / - 아이콘 문자 동기화
                    const fullIconText = fullIconGroup.select("text")
                    if (!fullIconText.empty()) {
                        // true 면 '-' (minus-square), false 면 '+' (plus-square)
                        fullIconText.text(d.wrapped.state.groupFullSize ? "\uf146" : "\uf0fe")
                    }
                }
            }

        groupButtonEnter.each(function (d: NodeWrapper) { handleIcons(select(this), d) })
        groupButton.each(function (d: NodeWrapper) { handleIcons(select(this), d) })
    }

    private renderNodes(root: any) {
        var self = this

        var node = this.gNodes.selectAll('g.node')
            .interrupt()
            .data(root.descendants(), (d: D3Node) => d.data.id)

        const nodeClass = (d: D3Node) => new Array<string>().concat("node",
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
            .attr("dy", -60)

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

        nodeEnter.each(function (d: D3Node) {
            var el = select(this)
            var attrs = self.props.nodeAttrs(d.data.wrapped)

            if (isImgIcon(d)) {
                el.append("image")
                    .attr("class", (d: D3Node) => "node-icon " + attrs.iconClass)
                    .attr("transform", "translate(-16,-16)")
                    .attr("width", 32)
                    .attr("heigh", 32)
                    .attr("xlink:href", (d: D3Node) => attrs.href)
                    .attr("pointer-events", "none")
            } else {
                el.append("text")
                    .attr("class", (d: D3Node) => "node-icon " + attrs.iconClass)
                    .attr("dy", 9)
                    .text((d: D3Node) => attrs.icon)
                    .attr("pointer-events", "none")
            }
        })

        var wrapText = (text: Selection<SVGTextElement, any, null, undefined>, lineHeight: number, width: number) => {
            text.each(function () {
                var text = select(this)
                var y = text.attr("y")
                var dy = parseFloat(text.attr("dy"))
                const rawText = text.text() || ""
                const explicitLines = rawText.split("\n").filter((v: string) => v.length > 0)

                text.text(null)

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
                    var words = rawText.match(/.{1,10}/g)
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
                        if (element.getComputedTextLength() > width) {
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

        const getNodeDisplayName = (d: D3Node) => {
            const attrsName = this.props.nodeAttrs(d.data.wrapped).name
            const nodeData = d.data.wrapped.data || {}
            const vmNameMap = this.props.vmNameMap || {}
            const vmNetworkMap = this.props.vmNetworkMap || {}

            // For VM child NIC nodes, prefer operator-facing label:
            // IP > Mold network name > existing interface name.
            if (nodeData.Type === "tuntap") {
                let parent = d.data.wrapped.parent
                while (parent && parent.data?.Type !== "libvirt") {
                    parent = parent.parent
                }
                const libvirtName = parent?.data?.Name
                const parentDisplayName = parent ? this.props.nodeAttrs(parent).name : undefined
                const vmNameMapped = libvirtName ? vmNameMap[libvirtName] : undefined
                const vmKeys = [libvirtName, vmNameMapped, parentDisplayName]
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
                const nodeMac = normalizeMac(nodeData.MAC)
                const nodeIfName = typeof nodeData.Name === "string" ? nodeData.Name.trim().toLowerCase() : ""
                const matchedNic = nicList.find((nic: any) => {
                    const nicMac = normalizeMac(nic.macAddress)
                    if (nodeMac && nicMac && nodeMac === nicMac) {
                        return true
                    }
                    if (!nodeIfName) {
                        return false
                    }
                    const nicIfCandidates = [
                        nic.interfaceName,
                        nic.ifName,
                        nic.tapName,
                        nic.deviceName,
                        nic.device,
                        nic.name
                    ]
                    return nicIfCandidates.some((raw) =>
                        typeof raw === "string" && raw.trim().toLowerCase() === nodeIfName
                    )
                })

                const ip = matchedNic?.ipAddress?.trim()
                const rawNetworkName = matchedNic?.networkName?.trim()
                const toText = (value: any): string => {
                    if (value === undefined || value === null) {
                        return ""
                    }
                    return String(value).trim()
                }
                const rawNodeNetwork = toText(nodeData.Network)
                const rawNodeVlan = toText(nodeData.VLAN || nodeData.Vlan || nodeData.VLANID || nodeData.VlanID)
                const rawNodeVni = toText(nodeData.VNI || nodeData.Vni)
                const rawNodeBroadcast = toText(nodeData.Broadcast || nodeData.BROADCAST)
                const hasUntaggedHint = [rawNodeNetwork, rawNodeVlan, rawNodeVni, rawNodeBroadcast]
                    .some((v) => /(^|:\/\/)untagged$/i.test(v) || /untagged/i.test(v))
                const isUntaggedNetwork =
                    /^(vlan:\/\/)?untagged$/i.test(rawNetworkName || "") ||
                    /^(vlan:\/\/)?untagged$/i.test(rawNodeNetwork) ||
                    /^(vlan:\/\/)?untagged$/i.test(rawNodeVlan) ||
                    /^(vlan:\/\/)?untagged$/i.test(rawNodeVni) ||
                    /^(vlan:\/\/)?untagged$/i.test(rawNodeBroadcast) ||
                    (/^l2$/i.test(rawNetworkName || "") && hasUntaggedHint)
                const networkName = isUntaggedNetwork ? "L2 Untagged" : rawNetworkName
                const detectVlanId = (): string | undefined => {
                    const candidates = [
                        nodeData.VLAN,
                        nodeData.Vlan,
                        nodeData.VLANID,
                        nodeData.VlanID,
                        nodeData.Tag,
                        nodeData.ID,
                        matchedNic?.networkName
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

                if (ip && networkName) {
                    return `${ip}\n${networkName}`
                }
                if (ip) {
                    return ip
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

        nodeEnter.append("g")
            .append("text")
            .attr("class", "node-name")
            .attr("dy", ".35em")
            .attr("y", 85)
            .text((d: D3Node) => getNodeDisplayName(d))
            .attr("pointer-events", "none")
            .call(wrapText, 1.15, nodeWidth + 38)

        // Update names only when vmNameMap changed to reduce long-running render overhead.
        if (this.lastVmNameMapRef !== this.props.vmNameMap || this.lastVmNetworkMapRef !== this.props.vmNetworkMap) {
            node.selectAll<SVGRectElement, D3Node>("rect.node-name-wrap").remove()
            node.select("text.node-name")
                .text((d: D3Node) => getNodeDisplayName(d))
                .call(wrapText, 1.15, nodeWidth + 38)
            this.lastVmNameMapRef = this.props.vmNameMap
            this.lastVmNetworkMapRef = this.props.vmNetworkMap
        }

        const renderNodeBadge = function (d: D3Node) {
            var badge = select(this).selectAll("g.node-badge")
                .data(self.props.nodeAttrs(d.data.wrapped).badges)

            var badgeEnter = badge.enter()
                .append("g")
                .attr("class", "node-badge")
            badge.exit().remove()

            badgeEnter
                .append("rect")
                .attr("x", (d: BadgeAttrs, i: number) => 38 - i * 28)
                .attr("y", -60)
                .attr("width", 24)
                .attr("height", 24)
                .attr("rx", 5)
                .attr("ry", 5)
                .attr("fill", (d: BadgeAttrs) => d.fill ? d.fill : "#6975a9")

            badgeEnter
                .append("text")
                .attr("class", (d: BadgeAttrs) => d.iconClass ? d.iconClass : "")
                .attr("dx", (d: BadgeAttrs, i: number) => 50 - i * 28)
                .attr("dy", -41)
                .text((d: BadgeAttrs) => d.text)
                .attr("pointer-events", "none")
                .attr("fill", (d: BadgeAttrs) => d.stroke ? d.stroke : "var(--topology-node-name-wrap-fill)")
        }

        nodeEnter
            .append("g")
            .attr("class", "node-badges")
            .attr("pointer-events", "none")
            .each(renderNodeBadge)

        node.each(renderNodeBadge)

        var exco = nodeEnter
            .append("g")
            .attr("class", "node-exco")
            .attr("pointer-events", "none")
            .style("opacity", ((d: D3Node) => d.data.wrapped.children.length > 0 ? 1 : 0))

        exco.append("circle")
            .attr("class", "node-exco-circle")
            .attr("cx", hexSize + 10)
            .attr("cy", hexSize)
            .attr("r", 18)

        const num = (node: NodeWrapper) => {
            var n = 0
            if (node.type == WrapperType.Group && node.wrapped.state.expanded) {
                if (!node.wrapped.state.groupFullSize) {
                    var size = this.props.groupSize || defaultGroupSize
                    n = node.wrapped.children.length - size
                }
            } else {
                n = node.wrapped.children.length
            }
            return n > 99 ? "+99" : n
        }

        exco.append("text")
            .attr("id", (d: D3Node) => "exco-" + d.data.id)
            .attr("class", "node-exco-children")
            .attr("x", hexSize + 10)
            .attr("y", hexSize + 6)
            .text((d: D3Node) => num(d.data))

        node.select("g.node-exco")
            .filter((d: D3Node) => d.data.wrapped.children.length > 0)
            .style('opacity', 1)

        node.select("text.node-exco-children")
            .filter((d: D3Node) => d.data.wrapped.children.length > 0)
            .text((d: D3Node) => num(d.data))

        node.transition()
            .duration(animDuration)
            .style("opacity", 1)
            .attr("transform", (d: D3Node) => `translate(${d.x},${d.y})`)
            .attr("class", nodeClass)
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

        const isVisible = (d: any) => {
            let ok = visibleCache.has(d.id)
            if (ok) {
                return visibleCache.get(d.id)
            }

            let visible = this.isLinkVisible(d)
            visibleCache.set(d.id, visible)

            return visible
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
            var dSource = this.d3nodes.get(d.source.id)
            var dTarget = this.d3nodes.get(d.target.id)

            if (!dSource || !dTarget) {
                return
            }

            var line = linkerCache.get(d.id)
            if (line) {
                return line
            }

            let source = dSource
            let target = dTarget
            if (dSource.y === dTarget.y) {
                if (dSource.x > dTarget.x) {
                    source = dTarget, target = dSource
                }

                line = hLinker({
                    source: { x: source.x + margin, y: source.y, node: d.source },
                    target: { x: target.x - margin, y: target.y, node: d.target }
                })

                linkerCache.set(d.id, line)

                return line
            }

            if (dSource.y > dTarget.y || dSource.x > dTarget.x) {
                source = dTarget, target = dSource
            }

            if (source.y > target.y) {
                margin *= -1
            }

            line = vLinker({
                source: { x: source.x, y: source.y + margin, node: d.source },
                target: { x: target.x, y: target.y - margin, node: d.target }
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
            .style("opacity", (d: Link) => d.state.selected || this.isLinkNodeSelected(d) || this.isLinkNodeMouseOver(d) ? 1 : 0)
            .attr("d", linker)

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
            .style("opacity", (d: Link) => isVisible(d) ? 1 : 0)
            .attr("d", linker)

        var linkLabel = this.gLinkLabels.selectAll('text.link-label')
            .interrupt()
            .data(visibleLinks.filter((d: Link) => this.props.linkAttrs(d).label), (d: Link) => d.id)

        var linkLabelEnter = linkLabel.enter()
            .append('text')
            .attr("class", "link-label")
            .attr("id", (d: Link) => "link-label-" + d.id)
            .attr("dy", -8)
            .style("opacity", (d: Link) => isVisible(d) ? 1 : 0)
        linkLabelEnter.append('textPath')
            .attr("xlink:href", (d: Link) => "#link-" + d.id)
            .attr("text-anchor", "middle")
            .attr("startOffset", "50%")
            .text((d: Link) => this.props.linkAttrs(d).label)
        linkLabel.exit().remove()

        linkLabel = linkLabel.merge(linkLabelEnter)
        linkLabel.style("opacity", (d: Link) => isVisible(d) ? 1 : 0)
        linkLabel.select('textPath').text((d: Link) => this.props.linkAttrs(d).label)

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
            .transition()
            .duration(animDuration)
            .attr("d", linker)
    }

    renderTree() {
        var normRoot = this.normalizeTree(this.root)

        var root = hierarchy(normRoot)
        this.tree(root)

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
