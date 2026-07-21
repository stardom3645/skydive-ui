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
import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'
import { connect } from 'react-redux'
import { withStyles } from '@material-ui/core/styles'
import { Button, Tooltip } from 'antd'
import { CloseOutlined, EnvironmentOutlined } from '@ant-design/icons'

import { Node, Link } from './Topology'
import DataPanel from './StdDataPanel'
import { a11yProps, TabPanel } from './Tabs'
import { AppState, session } from './Store'
import { styles } from './SelectionPanelStyles'
import ConfigReducer, { translate, WEIGHT_BRIDGES, WEIGHT_VIRT_BRIDGES } from './Config'
import HostDetailPanel from './DataPanels/HostDetailPanel'
import VMDetailPanel from './DataPanels/VMDetailPanel'
import SystemVMDetailPanel from './DataPanels/SystemVMDetailPanel'
import VMNetworkDetailPanel from './DataPanels/VMNetworkDetailPanel'
import GroupDetailPanel from './DataPanels/GroupDetailPanel'
import SwitchDetailPanel from './DataPanels/SwitchDetailPanel'
import SwitchPortDetailPanel from './DataPanels/SwitchPortDetailPanel'
import BondDetailPanel from './DataPanels/BondDetailPanel'
import NicDetailPanel from './DataPanels/NicDetailPanel'
import HostBridgeDetailPanel from './DataPanels/HostBridgeDetailPanel'
import VirtualBridgeDetailPanel from './DataPanels/VirtualBridgeDetailPanel'
import VlanDetailPanel from './DataPanels/VlanDetailPanel'
import KubernetesClusterDetailPanel from './DataPanels/KubernetesClusterDetailPanel'
import KubernetesNodeDetailPanel from './DataPanels/KubernetesNodeDetailPanel'
import KubernetesNamespaceDetailPanel from './DataPanels/KubernetesNamespaceDetailPanel'
import KubernetesPodDetailPanel from './DataPanels/KubernetesPodDetailPanel'
import KubernetesWorkloadDetailPanel from './DataPanels/KubernetesWorkloadDetailPanel'
import KubernetesServiceDetailPanel from './DataPanels/KubernetesServiceDetailPanel'
import NodeContextBreadcrumb, { NodeContextIcon, NodeContextItem } from './DataPanels/common/NodeContextBreadcrumb'


interface Props {
  classes: any
  selection: Array<Node | Link>
  revision: number
  session: session
  onLocation?: (node: Node | Link) => void
  onClose?: (node: Node | Link) => void
  config: ConfigReducer
  buttonsContent?: (el: Node | Link) => JSX.Element
  panelsContent?: (el: Node | Link) => JSX.Element
  moldInventory?: any
  infrastructureHostSummaries?: Record<string, any>
  kubernetesClusters?: any[]
  vmNameMap?: Record<string, string>
  vmNetworkMap?: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>>
  vmDetailMap?: Record<string, any>
  managementServers?: any[]
  groupVisibleNodeIDs?: Set<string>
  nodeDisplayName?: (node: Node) => string
  onGroupChildToggle?: (node: Node) => void
  onGroupChildrenDisplayChange?: (nodes: Node[], visible: boolean) => void
}

interface State {
  tab: number
  gremlin: string
  captureForm: boolean
  selectionKey: string
  preferredTabID: string
}

class SelectionPanel extends React.Component<Props, State> {

  state: State

  constructor(props) {
    super(props)

    this.state = {
      tab: 0,
      gremlin: "",
      captureForm: false,
      selectionKey: "",
      preferredTabID: ""
    }
  }

  static getDerivedStateFromProps(props, state) {
    const selectionKey = props.selection.map((el: Node | Link) => el.id).join("|")
    if (selectionKey !== state.selectionKey) {
      const preferredIndex = state.preferredTabID
        ? props.selection.findIndex((el: Node | Link) => el.id === state.preferredTabID)
        : -1
      return {
        tab: preferredIndex >= 0 ? preferredIndex : (props.selection.length > 0 ? props.selection.length - 1 : 0),
        selectionKey: selectionKey,
        preferredTabID: ""
      }
    }

    var tab = state.tab
    if (tab >= props.selection.length) {
      tab = props.selection.length - 1
    }
    if (tab < 0) {
      tab = 0
    }
    return {
      tab: tab,
      selectionKey: selectionKey
    }
  }

  private renderTabs(classes: any) {
    return this.props.selection.map((el: Node | Link, i: number) => {
      var className = classes.tabIconFree

      if (el.type === 'node') {
        let attrs = this.props.config.nodeAttrs(el)
        var icon: string = attrs.icon
        var href: string = attrs.href
        var iconClass: string = attrs.iconClass || ""

        if (attrs.iconClass === "font-brands") {
          className = classes.tabIconBrands
        }

        var title = this.props.config.nodeTabTitle(el)
      } else {
        let attrs = this.props.config.linkAttrs(el)
        var icon: string = attrs.icon
        var href: string = attrs.href
        var iconClass: string = attrs.iconClass || ""

        if (attrs.iconClass === "font-brands") {
          className = classes.tabIconBrands
        }

        var title = this.props.config.linkTabTitle(el)
      }

      const subtitle = this.tabSubtitle(el)
      const isSwitchIcon = el.type === 'node' && String(el.data?.Type || el.data?.type || '').toLowerCase() === 'switch'
      const isDeploymentIcon = iconClass.split(/\s+/).indexOf('k8s-deployment-icon') >= 0
      const isDaemonSetIcon = iconClass.split(/\s+/).indexOf('k8s-daemonset-icon') >= 0
      const tabIcon = isSwitchIcon
        ? <span className={classes.tabSwitchIcon} aria-hidden="true" />
        : isDeploymentIcon
        ? <span className={classes.tabDeploymentIcon} aria-hidden="true" />
        : isDaemonSetIcon
        ? <span className={classes.tabDaemonSetIcon} aria-hidden="true" />
        : href
        ? <img src={href} className={classes.tabIconImage} alt="" />
        : <span className={className}>{icon}</span>

      return (
        <Tab className={classes.tabRoot} icon={tabIcon}
          key={"tab-" + i}
          label={
            <Tooltip title={title} placement="bottom">
              <span className={classes.tabLabelBlock}>
                <span className={`${classes.tabTitle} ${title.includes("\n") ? classes.tabTitleMulti : ""}`} title={title}>{title}</span>
                {subtitle && <span className={classes.tabSubtitle} title={subtitle}>{subtitle}</span>}
              </span>
            </Tooltip>
          }
          {...a11yProps(i)} />
      )
    })
  }

  private tabSubtitle(el: Node | Link): string {
    if (!el || !el.data) {
      return ""
    }

    const rawType = String(el.data.Type || el.data.type || el.type || "").trim()
    const type = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : ""
    const ipv4 = Array.isArray(el.data.IPV4) && el.data.IPV4.length > 0 ? String(el.data.IPV4[0]) : ""
    const ipv6 = Array.isArray(el.data.IPV6) && el.data.IPV6.length > 0 ? String(el.data.IPV6[0]) : ""
    const address = ipv4 || ipv6

    if (type && address) {
      return `${type} · ${address}`
    }
    return type || address
  }

  private dataFields(el: Node | Link): Array<any> {
    if (el.type === 'node') {
      return this.props.config.nodeDataFields()
    } else {
      return this.props.config.linkDataFields()
    }
  }

  private topologyNodes(): Node[] {
    const nodes = (window as any).App?.tc?.nodes
    if (nodes instanceof Map) return Array.from(nodes.values())
    return Array.isArray(nodes) ? nodes : []
  }

  private contextNodeName(node: Node): string {
    const displayName = this.props.nodeDisplayName ? this.props.nodeDisplayName(node) : this.props.config.nodeTabTitle(node)
    return String(displayName || node.data?.Name || node.id).replace(/\s*\n\s*/g, ' ').trim()
  }

  private nodeAncestors(node: Node): Node[] {
    const ancestors: Node[] = []
    const visited = new Set<string>()
    let current: Node | null | undefined = node
    while (current && current.id !== 'root' && !visited.has(current.id)) {
      ancestors.unshift(current)
      visited.add(current.id)
      current = current.parent
    }
    return ancestors
  }

  private contextTypeLabel(node: Node): string {
    const data = node.data || {}
    const type = String(data.Type || data.type || '').toLowerCase()
    const name = String(data.Name || data.name || '').toLowerCase()
    if (String(data.Manager || '').toLowerCase() === 'k8s') {
      const labels: Record<string, string> = {
        cluster: 'Cluster', node: 'Node', namespace: 'Namespace', deployment: 'Deployment', statefulset: 'StatefulSet',
        daemonset: 'DaemonSet', job: 'Job', cronjob: 'CronJob', pod: 'Pod', service: 'Service'
      }
      return labels[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Kubernetes')
    }
    if (type === 'host') return 'Host'
    if (type === 'libvirt') {
      if (/^(s-|v-)/.test(name) || name === 'ccvm' || name === 'scvm') return 'System VM'
      if (/^r-/.test(name)) return 'Virtual Router'
      return 'User VM'
    }
    if (type === 'bridge') {
      return this.props.config.nodeAttrs(node).weight === WEIGHT_VIRT_BRIDGES ? 'Virtual Bridge' : 'Host Bridge'
    }
    const labels: Record<string, string> = {
      bond: 'Bond Interface', device: 'NIC', internal: 'Interface', interface: 'Interface', tuntap: 'VM Interface',
      tun: 'VM Interface', tap: 'VM Interface', veth: 'Virtual Ethernet', ovsbridge: 'Virtual Bridge',
      openvswitch: 'Virtual Bridge', ovsport: 'Virtual Port', patch: 'Patch Port', port: 'Port', switchport: 'Switch Port',
      erspan: 'ERSPAN', geneve: 'Geneve', vxlan: 'VXLAN', gre: 'GRE', gretap: 'GRE Tap', switch: 'Switch',
      vlan: 'VLAN', netns: 'Network Namespace', namespace: 'Namespace', container: 'Container'
    }
    return labels[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Node')
  }

  private descendantPods(node: Node): Node[] {
    const pods: Node[] = []
    const visited = new Set<string>()
    const visit = (current: Node) => {
      if (visited.has(current.id)) return
      visited.add(current.id)
      if (String(current.data?.Manager || '').toLowerCase() === 'k8s' && String(current.data?.Type || '').toLowerCase() === 'pod') {
        pods.push(current)
        return
      }
      ;(current.children || []).forEach(visit)
    }
    visit(node)
    return pods
  }

  private kubernetesClusterAncestor(node: Node): Node | undefined {
    return this.nodeAncestors(node).find(item => String(item.data?.Manager || '').toLowerCase() === 'k8s' && String(item.data?.Type || '').toLowerCase() === 'cluster')
  }

  private servicePods(service: Node): Node[] {
    const data = service.data || {}
    const selector = data.K8s?.Extra?.Spec?.Selector || {}
    const keys = selector && typeof selector === 'object' ? Object.keys(selector) : []
    if (!keys.length) return []
    const namespace = String(data.K8s?.Namespace || data.Namespace || data.K8s?.Extra?.ObjectMeta?.Namespace || '')
    const cluster = this.kubernetesClusterAncestor(service)
    return this.topologyNodes().filter(node => {
      if (String(node.data?.Manager || '').toLowerCase() !== 'k8s' || String(node.data?.Type || '').toLowerCase() !== 'pod') return false
      const podNamespace = String(node.data?.K8s?.Namespace || node.data?.Namespace || node.data?.K8s?.Extra?.ObjectMeta?.Namespace || '')
      if (podNamespace !== namespace) return false
      if (cluster && this.kubernetesClusterAncestor(node)?.id !== cluster.id) return false
      const labels = node.data?.K8s?.Labels || node.data?.K8s?.Extra?.ObjectMeta?.Labels || {}
      return keys.every(key => String(labels[key]) === String(selector[key]))
    })
  }

  private kubernetesContextAnchor(node: Node): NodeContextItem {
    const allNodes = this.topologyNodes()
    const type = String(node.data?.Type || '').toLowerCase()
    if (type === 'node') return { id: node.id, label: this.contextNodeName(node), node }

    let pods = this.descendantPods(node)
    if (type === 'service') pods = this.servicePods(node)
    const nodeNames = new Set<string>()
    pods.forEach(pod => {
      const nodeName = String(pod.data?.K8s?.Extra?.Spec?.NodeName || pod.data?.K8s?.Node || pod.data?.NodeName || '').trim()
      if (nodeName) nodeNames.add(nodeName)
    })

    const cluster = this.kubernetesClusterAncestor(node) || (type === 'cluster' ? node : undefined)
    if (type === 'cluster' && cluster) {
      allNodes.forEach(candidate => {
        if (String(candidate.data?.Manager || '').toLowerCase() !== 'k8s' || String(candidate.data?.Type || '').toLowerCase() !== 'node') return
        if (this.kubernetesClusterAncestor(candidate)?.id === cluster.id) nodeNames.add(this.contextNodeName(candidate))
      })
    }

    const names = Array.from(nodeNames)
    const anchorNode = names.length === 1 ? allNodes.find(candidate => String(candidate.data?.Type || '').toLowerCase() === 'node' && this.contextNodeName(candidate) === names[0]) : undefined
    if (names.length) return { id: anchorNode?.id || `k8s-nodes-${node.id}`, label: `${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ''}`, node: anchorNode }
    return { id: `k8s-node-unresolved-${node.id}`, label: 'Kubernetes Node · 확인 불가' }
  }

  private nodeContext(node: Node): { icon: NodeContextIcon, items: NodeContextItem[] } {
    const isGroup = !!node.data?.IsTopologyGroup
    const representative = isGroup && node.children?.length ? node.children[0] : node
    const isKubernetes = String(representative.data?.Manager || node.data?.Manager || '').toLowerCase() === 'k8s'
    const chain = isGroup
      ? [...this.nodeAncestors(representative.parent || representative), node]
      : this.nodeAncestors(node)

    let anchor: NodeContextItem
    if (isKubernetes) {
      anchor = this.kubernetesContextAnchor(representative)
    } else {
      const host = chain.find(item => String(item.data?.Type || '').toLowerCase() === 'host')
      const rootContext = host || chain[0] || node
      anchor = { id: rootContext.id, label: this.contextNodeName(rootContext), node: rootContext }
    }

    const isRoot = !node.parent || node.parent.id === 'root' || anchor.node?.id === node.id
    const items: NodeContextItem[] = []

    if (isRoot) {
      items.push({ id: `${node.id}-current`, label: this.contextNodeName(node), node })
    } else {
      items.push(anchor)
      chain.forEach(item => {
        if (item.id === anchor.node?.id || item.id === node.id) return
        const label = this.contextTypeLabel(item)
        if (!items.length || items[items.length - 1].label !== label) {
          items.push({ id: `${item.id}-type`, label, node: item })
        }
      })
      const currentTypeNode = isGroup ? representative : node
      const currentTypeLabel = this.contextTypeLabel(currentTypeNode)
      if (!items.length || items[items.length - 1].label !== currentTypeLabel) {
        items.push({ id: `${node.id}-current-type`, label: currentTypeLabel, node })
      }
      items.push({ id: `${node.id}-current`, label: this.contextNodeName(node), node })
    }

    const attrs = this.props.config.nodeAttrs(node)
    return {
      icon: { icon: attrs.icon, href: attrs.href, iconClass: attrs.iconClass },
      items
    }
  }

  private renderNodeContext(node: Node) {
    const context = this.nodeContext(node)
    return <NodeContextBreadcrumb icon={context.icon} items={context.items} />
  }

  renderTabPanels(classes: any) {
    const dataByPath = (data: any, path: string): any => {
      for (let key of path.split(".")) {
        data = data[key]
        if (!data) {
          break
        }
      }

      return data
    }

    const renderDataPanels = (el: Node | Link) => {
      return this.dataFields(el).map(entry => {
        var data = el.data
        var exclude = new Array<any>()

        if (entry.field) {
          data = dataByPath(el.data, entry.field)
        } else if (entry.data) {
          data = entry.data(el)
        }

        exclude = this.dataFields(el).filter(cfg => cfg.field).map(cfg => {
          if (entry.field) {
            return cfg.field.replace(entry.field + ".", "")
          } else {
            return cfg.field
          }
        })

        if (data) {
          var title = entry.title || entry.field || "General"
          var sortKeys = entry.sortKeys ? entry.sortKeys(data) : null
          var filterKeys = entry.filterKeys ? entry.filterKeys(data) : null

          var suffix = title.toLowerCase().replace(" ", "-")
          return (
            <DataPanel key={"dataviewer-" + el.id + "-" + suffix} title={title} revision={this.props.revision}
              defaultExpanded={entry.expanded} data={data} exclude={exclude} sortKeys={sortKeys} filterKeys={filterKeys}
              normalizer={entry.normalizer} graph={entry.graph} icon={entry.icon} iconClass={entry.iconClass}
              deletable={entry.deletable} customRenders={entry.customRenders} onDelete={entry.onDelete} helpTooltipText={entry.helpTooltipText}/>
          )
        }
      })
    }

    const isVMNode = (el: Node | Link): boolean => {
      if (el.type !== 'node') return false
      const data = el.data || {}
      const type = String(data.Type || data.type || '').toLowerCase()
      const name = String(data.Name || data.name || '')
      return type === 'libvirt' || type === 'vm' || type === 'virtualmachine' || /^r-/.test(name) || /^(s-|v-)/.test(name) || name === 'ccvm' || name === 'scvm'
    }

    const isSystemVMNode = (el: Node | Link): boolean => {
      if (el.type !== 'node') return false
      const name = String(el.data?.Name || el.data?.name || '').toLowerCase()
      return /^(s-|v-)/.test(name) || name === 'ccvm' || name === 'scvm'
    }

    const isVMNetworkNode = (el: Node | Link): boolean => {
      if (el.type !== 'node') return false
      const data = el.data || {}
      const type = String(data.Type || data.type || '').toLowerCase()
      const name = String(data.Name || data.name || data.InterfaceName || data.IfName || '').toLowerCase()
      const interfaceType = String(data.InterfaceType || data.IfaceType || data.IfType || data.Kind || data.LinkType || data.TunType || data.TUNType || '').toLowerCase()
      const driver = String(data.Driver || data.driver || '').toLowerCase()
      const isVirtualInterface = /^vnet/.test(name) || /tap|tun|tuntap/.test(type) || /tap|tun|tuntap/.test(interfaceType) || /tap|tun|tuntap/.test(driver)
      return isVirtualInterface
    }

    const isTopologyGroupNode = (el: Node | Link): boolean => {
      if (el.type !== 'node') return false
      return !!el.data?.IsTopologyGroup
    }

    const isKubernetesClusterNode = (el: Node | Link): boolean => {
      if (el.type !== 'node' || el.data?.IsTopologyGroup) return false
      return String(el.data?.Manager || '').toLowerCase() === 'k8s'
        && String(el.data?.Type || '').toLowerCase() === 'cluster'
    }

    const isKubernetesNode = (el: Node | Link): boolean => {
      if (el.type !== 'node' || el.data?.IsTopologyGroup) return false
      return String(el.data?.Manager || '').toLowerCase() === 'k8s'
        && String(el.data?.Type || '').toLowerCase() === 'node'
    }

    const isKubernetesNamespace = (el: Node | Link): boolean => {
      if (el.type !== 'node' || el.data?.IsTopologyGroup) return false
      return String(el.data?.Manager || '').toLowerCase() === 'k8s'
        && String(el.data?.Type || '').toLowerCase() === 'namespace'
    }

    const isKubernetesPod = (el: Node | Link): boolean => {
      if (el.type !== 'node' || el.data?.IsTopologyGroup) return false
      return String(el.data?.Manager || '').toLowerCase() === 'k8s'
        && String(el.data?.Type || '').toLowerCase() === 'pod'
    }

    const isKubernetesWorkload = (el: Node | Link): boolean => {
      if (el.type !== 'node' || el.data?.IsTopologyGroup || String(el.data?.Manager || '').toLowerCase() !== 'k8s') return false
      return ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].indexOf(String(el.data?.Type || '').toLowerCase()) >= 0
    }

    const isKubernetesService = (el: Node | Link): boolean => {
      if (el.type !== 'node' || el.data?.IsTopologyGroup) return false
      return String(el.data?.Manager || '').toLowerCase() === 'k8s'
        && String(el.data?.Type || '').toLowerCase() === 'service'
    }

    const isSwitchNode = (el: Node | Link): boolean => {
      return el.type === 'node' && String(el.data?.Type || el.data?.type || '').toLowerCase() === 'switch'
    }

    const isSwitchPortNode = (el: Node | Link): boolean => {
      return el.type === 'node' && String(el.data?.Type || el.data?.type || '').toLowerCase() === 'switchport'
    }

    const isBondNode = (el: Node | Link): boolean => {
      if (el.type !== 'node') return false
      const type = String(el.data?.Type || el.data?.type || '').toLowerCase()
      const driver = String(el.data?.Driver || el.data?.driver || '').toLowerCase()
      return type === 'bond' || driver === 'bonding'
    }

    const isNicNode = (el: Node | Link): boolean => {
      if (el.type !== 'node') return false
      const type = String(el.data?.Type || el.data?.type || '').toLowerCase()
      const probe = String(el.data?.Probe || el.data?.probe || '').toLowerCase()
      return type === 'device' && probe !== 'fabric'
    }

    const isVlanNode = (el: Node | Link): boolean => {
      return el.type === 'node' && String(el.data?.Type || el.data?.type || '').toLowerCase() === 'vlan'
    }

    const isHostBridgeNode = (el: Node | Link): boolean => {
      if (el.type !== 'node') return false
      const data = el.data || {}
      const type = String(data.Type || data.type || '').toLowerCase()
      return type === 'bridge' && this.props.config.nodeAttrs(el).weight === WEIGHT_BRIDGES
    }

    const isVirtualBridgeNode = (el: Node | Link): boolean => {
      if (el.type !== 'node') return false
      const data = el.data || {}
      const type = String(data.Type || data.type || '').toLowerCase()
      return type === 'bridge' && this.props.config.nodeAttrs(el).weight === WEIGHT_VIRT_BRIDGES
    }

    return this.props.selection.map((el: Node | Link, i: number) => {
      if (this.state.tab !== i) {
        return null
      }

      return (
        <React.Fragment key={el.id}>
          <div className={classes.tabActions}>
            <Tooltip title={translate("removeFromSelection")}>
              <Button
                type="text"
                shape="circle"
                className="netdive-action-icon-button"
                icon={<CloseOutlined />}
                onClick={() => this.props.onClose && this.props.onClose(el)}
                aria-label={translate("removeFromSelection")} />
            </Tooltip>
            <Tooltip title={translate("pinNode")}>
              <Button
                type="text"
                shape="circle"
                className="netdive-action-icon-button"
                icon={<EnvironmentOutlined />}
                onClick={() => this.props.onLocation && this.props.onLocation(el)}
                aria-label={translate("pinNode")} />
            </Tooltip>
            {this.props.buttonsContent && this.props.buttonsContent(el)}
          </div>
          {el.type === 'node' && this.renderNodeContext(el as Node)}
          {this.props.panelsContent && this.props.panelsContent(el)}
          <TabPanel key={"tabpanel-" + el.id} value={this.state.tab} index={i}>
            {isTopologyGroupNode(el)
              ? <GroupDetailPanel
                  node={el as Node}
                  visibleNodeIDs={this.props.groupVisibleNodeIDs || new Set<string>()}
                  nodeAttrs={(node: Node) => this.props.config.nodeAttrs(node)}
                  nodeDisplayName={this.props.nodeDisplayName}
                  vmNetworkMap={this.props.vmNetworkMap}
                  onNodeSelect={(node: Node) => {
                    this.setState({ preferredTabID: el.id })
                    this.props.onGroupChildToggle && this.props.onGroupChildToggle(node)
                  }}
                  onNodesSelect={(nodes: Node[]) => {
                    this.setState({ preferredTabID: el.id })
                    this.props.onGroupChildrenDisplayChange && this.props.onGroupChildrenDisplayChange(nodes, true)
                  }}
                  onNodeDeselect={(node: Node) => {
                    this.setState({ preferredTabID: el.id })
                    this.props.onGroupChildrenDisplayChange && this.props.onGroupChildrenDisplayChange([node], false)
                  }} />
              : isSwitchPortNode(el)
              ? <SwitchPortDetailPanel node={el as Node} />
              : isBondNode(el)
              ? <BondDetailPanel node={el as Node} />
              : isVlanNode(el)
              ? <VlanDetailPanel node={el as Node} />
              : isNicNode(el)
              ? <NicDetailPanel node={el as Node} />
              : isHostBridgeNode(el)
              ? <HostBridgeDetailPanel node={el as Node} nodeDisplayName={this.props.nodeDisplayName} />
              : isVirtualBridgeNode(el)
              ? <VirtualBridgeDetailPanel node={el as Node} nodeDisplayName={this.props.nodeDisplayName} />
              : isVMNetworkNode(el)
              ? <VMNetworkDetailPanel node={el as Node} moldInventory={this.props.moldInventory} vmNameMap={this.props.vmNameMap} vmNetworkMap={this.props.vmNetworkMap} vmDetailMap={this.props.vmDetailMap} />
              : el.type === 'node' && String(el.data?.Type || '').toLowerCase() === 'host'
              ? <HostDetailPanel node={el as Node} session={this.props.session} moldInventory={this.props.moldInventory} infrastructureHostSummaries={this.props.infrastructureHostSummaries} kubernetesClusters={this.props.kubernetesClusters} />
              : isKubernetesClusterNode(el)
              ? <KubernetesClusterDetailPanel
                  node={el as Node}
                  nodeAttrs={(node: Node) => this.props.config.nodeAttrs(node)}
                  session={this.props.session}
                  vmDetailMap={this.props.vmDetailMap}
                  kubernetesClusters={this.props.kubernetesClusters} />
              : isKubernetesNode(el)
              ? <KubernetesNodeDetailPanel
                  node={el as Node}
                  nodeAttrs={(node: Node) => this.props.config.nodeAttrs(node)}
                  session={this.props.session}
                  vmDetailMap={this.props.vmDetailMap}
                  kubernetesClusters={this.props.kubernetesClusters} />
              : isKubernetesNamespace(el)
              ? <KubernetesNamespaceDetailPanel
                  node={el as Node}
                  nodeAttrs={(node: Node) => this.props.config.nodeAttrs(node)}
                  session={this.props.session}
                  kubernetesClusters={this.props.kubernetesClusters} />
              : isKubernetesPod(el)
              ? <KubernetesPodDetailPanel
                  node={el as Node}
                  nodeAttrs={(node: Node) => this.props.config.nodeAttrs(node)}
                  session={this.props.session}
                  kubernetesClusters={this.props.kubernetesClusters} />
              : isKubernetesWorkload(el)
              ? <KubernetesWorkloadDetailPanel
                  node={el as Node}
                  nodeAttrs={(node: Node) => this.props.config.nodeAttrs(node)} />
              : isKubernetesService(el)
              ? <KubernetesServiceDetailPanel
                  node={el as Node}
                  nodeAttrs={(node: Node) => this.props.config.nodeAttrs(node)}
                  session={this.props.session}
                  kubernetesClusters={this.props.kubernetesClusters} />
              : isSystemVMNode(el)
              ? <SystemVMDetailPanel node={el as Node} session={this.props.session} moldInventory={this.props.moldInventory} vmNameMap={this.props.vmNameMap} vmNetworkMap={this.props.vmNetworkMap} vmDetailMap={this.props.vmDetailMap} managementServers={this.props.managementServers} />
              : isVMNode(el)
              ? <VMDetailPanel node={el as Node} session={this.props.session} moldInventory={this.props.moldInventory} vmNameMap={this.props.vmNameMap} vmNetworkMap={this.props.vmNetworkMap} vmDetailMap={this.props.vmDetailMap} />
              : isSwitchNode(el)
              ? <SwitchDetailPanel node={el as Node} />
              : renderDataPanels(el)
            }
          </TabPanel>
        </React.Fragment>
      )
    })
  }

  onTabChange(event: React.ChangeEvent<{}>, value: number) {
    this.setState({ tab: value, gremlin: "", preferredTabID: "" })
  }

  render() {
    const { classes } = this.props
    if (this.props.selection.length === 0) {
      return null
    }

    return (
      <div className={classes.tabs}>
        <Tabs
          orientation="horizontal"
          variant="scrollable"
          value={this.state.tab}
          onChange={this.onTabChange.bind(this)}
          aria-label="Metadata"
          indicatorColor="primary">
          {this.renderTabs(classes)}
        </Tabs>
        <div className={classes.rightPanelPaperContent}>
          {this.renderTabPanels(classes)}
        </div>
      </div>
    )
  }
}

export const mapStateToProps = (state: AppState) => ({
  selection: state.selection,
  revision: state.selectionRevision,
  session: state.session
})

export const mapDispatchToProps = ({
})

export default withStyles(styles)(connect(mapStateToProps, mapDispatchToProps)(SelectionPanel))
