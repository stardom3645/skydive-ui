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

import * as React from 'react'
import clsx from 'clsx'
import Websocket from 'react-websocket'
import { debounce } from 'throttle-debounce'

import { withStyles } from '@material-ui/core/styles'
import CssBaseline from '@material-ui/core/CssBaseline'
import Drawer from '@material-ui/core/Drawer'
import AppBar from '@material-ui/core/AppBar'
import Toolbar from '@material-ui/core/Toolbar'
import IconButton from '@material-ui/core/IconButton'
import Typography from '@material-ui/core/Typography'
import KeyboardArrowDown from '@material-ui/icons/KeyboardArrowDown'
import RemoveShoppingCartIcon from '@material-ui/icons/RemoveShoppingCart'
import AccessTimeIcon from '@material-ui/icons/AccessTime'
import RestoreIcon from '@material-ui/icons/Restore'
import Divider from '@material-ui/core/Divider'
import Container from '@material-ui/core/Container'
import Paper from '@material-ui/core/Paper'
import ToggleButton from '@material-ui/lab/ToggleButton'
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup'
import { withSnackbar, WithSnackbarProps } from 'notistack'
import { connect } from 'react-redux'
import AccountCircle from '@material-ui/icons/AccountCircle'
import MenuItem from '@material-ui/core/MenuItem'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import Menu from '@material-ui/core/Menu'
import Fab from '@material-ui/core/Fab'
import Badge from '@material-ui/core/Badge'
import ListIcon from '@material-ui/icons/List'
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete'
import TextField from '@material-ui/core/TextField'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogContent from '@material-ui/core/DialogContent'
import DialogActions from '@material-ui/core/DialogActions'
import Button from '@material-ui/core/Button'
import Switch from '@material-ui/core/Switch'
import Chip from '@material-ui/core/Chip'
import Tooltip from '@material-ui/core/Tooltip'
import Popover from '@material-ui/core/Popover'
import UnfoldMoreIcon from '@material-ui/icons/UnfoldMore'
import UnfoldLessIcon from '@material-ui/icons/UnfoldLess'
import InfoIcon from '@material-ui/icons/Info'
import LibraryBooksIcon from '@material-ui/icons/LibraryBooks'
import Brightness4Icon from '@material-ui/icons/Brightness4'
import CloseIcon from '@material-ui/icons/Close'
import FileCopyIcon from '@material-ui/icons/FileCopy'
import CheckCircleIcon from '@material-ui/icons/CheckCircle'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import RefreshIcon from '@material-ui/icons/Refresh'
import AccountTreeIcon from '@material-ui/icons/AccountTree'
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet'
import ChevronRightIcon from '@material-ui/icons/ChevronRight'
import CheckIcon from '@material-ui/icons/Check'
import LogoLight from '../assets/logo-ablestack.png'
import LogoDark from '../assets/ablestack-logo.png'

import { styles } from './AppStyles'
import { Topology, Node, NodeAttrs, LinkAttrs, LinkTagState, Link } from './Topology'
import AutoCompleteInput from './AutoComplete'
import {
  AppState,
  selectElement, unselectElement,
  bumpRevision,
  session, closeSession
} from './Store'
import { withRouter } from 'react-router-dom'
import SelectionPanel from './SelectionPanel'
import { Configuration } from './api/configuration'
import * as api from './api/api'
import { StatusApi, APIInfoApi, ConfigApi } from './api'
import Tools from './Tools'
import CaptureButton from './ActionButtons/Capture'
import VMConsoleButton from './ActionButtons/VMConsole'
import CapturePanel from './DataPanels/Capture'
import CaptureStatusPanel, { SimpleCaptureSession } from './DataPanels/CaptureStatus'
import FlowPanel from './DataPanels/Flow'
import TimetravelPanel from './TimetravelPanel'

import LanguageToggle from './LanguageToggle'

import './App.css'
import ConfigReducer, { Filter } from './Config'
import { fetchVmNameMap } from "./api";

import { translate } from "./Config"

export let currentLanguage: "en" | "ko" = "ko";

// expose app ouside
declare global {
  interface Window {
    API: any,
    App: any,
    Tools: Tools
    refreshTopology?: () => void;
  }
}
window.API = api
window.Tools = Tools

interface Props extends WithSnackbarProps {
  classes: any
  configURL?: string
  dataURL?: string
  logo?: string

  selectElement: typeof selectElement
  unselectElement: typeof unselectElement
  selection: Array<Node | Link>
  bumpRevision: typeof bumpRevision
  session: session
  closeSession: typeof closeSession
  history: any
}

export interface WSContext {
  GremlinFilter: string | null
  Time: number | null
}

interface AddFilterValue {
  label: string
  gremlinFilter: string
}

const addFilterValue = createFilterOptions<AddFilterValue>();

type NetdiveTheme = "light" | "dark"
type HelpSection = "menu" | "toolbar" | "topology"
type InfrastructureFocusKey = "networkObjects" | "routers" | "userVMs" | "systemVMs" | "totalNodes"
type InfrastructureViewMode = "all" | "hosts"
type RecentNodeLayerTag = "kubernetes" | "infrastructure"

interface RecentViewedNodeItem {
  id: string
  name: string
  rawType: string
  layerTag: RecentNodeLayerTag
  iconGlyph?: string
  iconTone?: string
}

const RECENT_VIEWED_NODES_STORAGE_KEY = "netdive-recent-viewed-nodes"

const getSavedNetdiveTheme = (): NetdiveTheme => {
  const savedTheme = localStorage.getItem("netdive-theme")
  return savedTheme === "dark" ? "dark" : "light"
}

const getSavedRecentViewedNodes = (): RecentViewedNodeItem[] => {
  try {
    const raw = localStorage.getItem(RECENT_VIEWED_NODES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
      .slice(0, 10)
  } catch (e) {
    return []
  }
}

interface State {
  vmNameMap?: Record<string, string>
  vmNetworkMap?: Record<string, Array<{ networkName: string, macAddress: string, ipAddress: string }>>
  vmDetailMap?: Record<string, any>
  moldInventory?: any
  isContextMenuOn: string
  contextMenuX: number
  contextMenuY: number
  isNavOpen: boolean
  nodeTagStates: Map<string, boolean>
  linkTagStates: Map<string, LinkTagState>
  filters: Array<Filter>
  activeFilter: Filter | null
  suggestions: Array<string>
  anchorEl: Map<string, null | HTMLElement>
  isSelectionOpen: boolean
  isTimetravelOpen: boolean
  wsContext: WSContext
  isGremlinPanelOpen: boolean
  isCapturePanelOpen: boolean
  captureSessions: Record<string, SimpleCaptureSession>
  addFilterOpened: boolean
  addFilterValue: AddFilterValue
  isAboutOpen: boolean
  isHelpOpen: boolean
  helpActiveSection: HelpSection
  appVersion: string
  timeContext: Date | null
  language: "en" | "ko"
  isVMConsoleOpening: boolean
  isLinkTagsCollapsed: boolean
  isLinkTagExamplesOpen: boolean
  isVMConsoleEnabled: boolean
  netdiveTheme: NetdiveTheme
  isInfrastructurePanelOpen: boolean
  infrastructureFocus: InfrastructureFocusKey | ""
  infrastructureViewMode: InfrastructureViewMode
  isScreenConfigOpen: boolean
  isPreferencesPanelOpen: boolean
  kubernetesClusters: MoldKubernetesCluster[]
  kubernetesSelectedIds: string[]
  kubernetesLoading: boolean
  kubernetesMessage: string
  isKubernetesManagerOpen: boolean
  kubernetesPolicyDialogOpen: boolean
  kubernetesConfirmClusterId: string
  kubernetesStopClusterId: string
  kubernetesTestDialogOpen: boolean
  kubernetesTestClusterId: string
  kubernetesTestLoading: boolean
  kubernetesTestAllLoading: boolean
  kubernetesTestResults: KubernetesCheckResult[]
  kubernetesLastTests: Record<string, KubernetesLastTest>
  kubernetesCopiedClusterId: string
  moldIntegrationConnected: boolean
  recentViewedNodes: RecentViewedNodeItem[]
  isRecentViewedNodesCollapsed: boolean
  topologyZoom: number
}

interface VMConsoleResponse {
  url?: string
}

interface VMConsoleAPIError extends Error {
  status?: number
}

interface MoldKubernetesCluster {
  id: string
  name: string
  state: string
  apiServer: string
  collectionEnabled: boolean
  collectionRunning: boolean
}

interface KubernetesCheckResult {
  key: string
  label: string
  ok: boolean
  reason?: string
  message?: string
  pending?: boolean
  waiting?: boolean
}

interface KubernetesLastTest {
  ok: boolean
  checkedAt: string
  message?: string
}

interface KubernetesTopologySummary {
  clusters: number
  nodes: number
  namespaces: number
  pods: number
  services: number
  clusterNodeIDs: string[]
  nodeNodeIDs: string[]
  namespaceNodeIDs: string[]
  podNodeIDs: string[]
  serviceNodeIDs: string[]
}

interface InfrastructureSummary {
  hosts: number
  userVMs: number
  systemVMs: number
  routers: number
  networkObjects: number
  links: number
  totalNodes: number
  hostNodeIDs: string[]
  userVMNodeIDs: string[]
  systemVMNodeIDs: string[]
  routerNodeIDs: string[]
  networkObjectNodeIDs: string[]
  infrastructureNodeIDs: string[]
  hostsById: Record<string, InfrastructureHostSummary>
}

interface InfrastructureHostSummary {
  id: string
  name: string
  userVMs: number
  systemVMs: number
  routers: number
  networkObjects: number
  userVMNodeIDs: string[]
  systemVMNodeIDs: string[]
  routerNodeIDs: string[]
  networkObjectNodeIDs: string[]
}

class App extends React.Component<Props, State> {

  tc: Topology | null
  websocket: Websocket | null
  synced: boolean
  state: State
  refreshTopology: any
  bumpRevision: typeof bumpRevision
  checkAuthID: number
  vmNameMapRefreshID: number
  apiConf: Configuration
  wsContext: WSContext
  connected: boolean
  debSetState: (state: any) => void
  debUpdateFilters: () => void
  config: ConfigReducer
  filters: Map<string, Filter>
  nextTag?: string
  filterInput: string
  customFilters: Array<Filter>
  private wsOnOpen: () => void
  private wsOnMessage: (msg: string) => void
  private wsOnClose: () => void
  private documentMouseDown: (event: MouseEvent) => void
  private kubernetesRequestSeq: number
  private kubernetesTestRequestSeq: number
  private kubernetesTestProgressTimers: number[]
  private kubernetesCheckListRef: React.RefObject<HTMLDivElement>
  private moldInventoryFailureLogged: boolean
  private moldInventoryUnavailable: boolean

  constructor(props) {
    super(props)

    this.state = {
      isContextMenuOn: "none",
      contextMenuX: 0,
      contextMenuY: 0,
      isNavOpen: true,
      nodeTagStates: new Map<string, boolean>(),
      linkTagStates: new Map<string, LinkTagState>(),
      filters: new Array<Filter>(),
      suggestions: new Array<string>(),
      anchorEl: new Map<string, null | HTMLElement>(),
      isSelectionOpen: false,
      isTimetravelOpen: false,
      wsContext: { GremlinFilter: null, Time: null },
      isGremlinPanelOpen: false,
      isCapturePanelOpen: false,
      captureSessions: {},
      activeFilter: null,
      addFilterOpened: false,
      addFilterValue: { label: "", gremlinFilter: "" },
      isAboutOpen: false,
      isHelpOpen: false,
      helpActiveSection: "menu",
      appVersion: "",
      timeContext: null,
      language: "ko",
      vmNameMap: {},
      vmNetworkMap: {},
      vmDetailMap: {},
      moldInventory: undefined,
      isVMConsoleOpening: false,
      isLinkTagsCollapsed: true,
      isLinkTagExamplesOpen: false,
      isVMConsoleEnabled: true,
      netdiveTheme: getSavedNetdiveTheme(),
      isInfrastructurePanelOpen: false,
      infrastructureFocus: "",
      infrastructureViewMode: "all",
      isScreenConfigOpen: false,
      isPreferencesPanelOpen: false,
      kubernetesClusters: [],
      kubernetesSelectedIds: [],
      kubernetesLoading: false,
      kubernetesMessage: "",
      isKubernetesManagerOpen: false,
      kubernetesPolicyDialogOpen: false,
      kubernetesConfirmClusterId: "",
      kubernetesStopClusterId: "",
      kubernetesTestDialogOpen: false,
      kubernetesTestClusterId: "",
      kubernetesTestLoading: false,
      kubernetesTestAllLoading: false,
      kubernetesTestResults: [],
      kubernetesLastTests: {},
      kubernetesCopiedClusterId: "",
      moldIntegrationConnected: false,
      recentViewedNodes: getSavedRecentViewedNodes(),
      isRecentViewedNodesCollapsed: false,
      topologyZoom: 1
    }

    this.synced = false

    this.refreshTopology = debounce(300, this._refreshTopology.bind(this))

    // we will refresh info each 1s
    this.bumpRevision = debounce(1000, this.props.bumpRevision.bind(this))

    // debounce version of setState
    this.debSetState = debounce(200, this.setState.bind(this))

    // debounce updateFilters
    this.debUpdateFilters = debounce(5000, this.updateFilters.bind(this))

    // will handle multiple configuration files
    this.config = new ConfigReducer()

    this.filters = new Map<string, Filter>()

    this.customFilters = new Array<Filter>()

    this.wsOnOpen = this.onWebSocketOpen.bind(this)
    this.wsOnMessage = this.onWebSocketMessage.bind(this)
    this.wsOnClose = this.onWebSocketClose.bind(this)
    this.documentMouseDown = this.onDocumentMouseDown.bind(this)
    this.kubernetesRequestSeq = 0
    this.kubernetesTestRequestSeq = 0
    this.kubernetesTestProgressTimers = []
    this.kubernetesCheckListRef = React.createRef()
    this.moldInventoryFailureLogged = false
    this.moldInventoryUnavailable = false
  }

  setLanguage(lang: "en" | "ko") {
    this.setState({ language: lang });
  }

  toggleLanguage() {
    const newLang = this.state.language === 'en' ? 'ko' : 'en';
    this.setLanguage(newLang);
  }

  componentDidMount() {
    // make the application available globally
    window.App = this
    document.addEventListener("mousedown", this.documentMouseDown, true)

    if (this.props.configURL) {
      this.config.appendURL("URL", this.props.configURL)
    }

    if (!this.props.dataURL) {
      this.checkAuthID = window.setInterval(() => {
        this.checkAuth()
      }, 15000)
    } else {
      this.loadStaticData(this.props.dataURL)
    }
    const savedLinkTagPanel = localStorage.getItem("netdive-link-tags-collapsed")
    if (savedLinkTagPanel === "1") {
      this.state.isLinkTagsCollapsed = true
      this.setState(this.state)
    } else if (savedLinkTagPanel === "0") {
      this.state.isLinkTagsCollapsed = false
      this.setState(this.state)
    }

    // Libvirt VM 이름 매핑 정보 불러오기 (초기 + 주기 갱신)
    this.refreshVmNameMap()
    this.refreshVmNetworkMap()
    this.refreshVmDetailMap()
    this.refreshMoldInventory()
    this.refreshVMConsoleEnabled()
    this.refreshKubernetesClusters()
    this.vmNameMapRefreshID = window.setInterval(() => {
      this.refreshVmNameMap()
      this.refreshVmNetworkMap()
      this.refreshVmDetailMap()
      this.refreshMoldInventory()
    }, 10000)
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.documentMouseDown, true)
    if (this.checkAuthID) {
      window.clearInterval(this.checkAuthID)
    }
    if (this.vmNameMapRefreshID) {
      window.clearInterval(this.vmNameMapRefreshID)
    }
    this.clearKubernetesTestProgress()
  }

  private onDocumentMouseDown(event: MouseEvent) {
    const isLinkTagsExpanded = !this.state.isLinkTagsCollapsed && this.state.linkTagStates.size !== 0
    if (!this.state.isInfrastructurePanelOpen && !this.state.isKubernetesManagerOpen && !this.state.isScreenConfigOpen && !this.state.isPreferencesPanelOpen && !this.state.isHelpOpen && !this.state.isAboutOpen && !isLinkTagsExpanded) {
      return
    }
    const target = event.target as Element | null
    if (!target || !target.closest) {
      return
    }
    if (target.closest('[data-netdive-side-panel="true"], [data-netdive-link-tags="true"], [data-netdive-recent-nodes="true"], [class*="kubernetesManagerPanel"], [class*="sideSettingsPanel"], [data-netdive-drawer="true"], .MuiDialog-root')) {
      return
    }
    if (isLinkTagsExpanded) {
      localStorage.setItem("netdive-link-tags-collapsed", "1")
    }
    this.closeSidePanels({ isLinkTagsCollapsed: isLinkTagsExpanded ? true : undefined })
  }

  private closeSidePanels(extraState: { isNavOpen?: boolean, isSelectionOpen?: boolean, isTimetravelOpen?: boolean, isLinkTagsCollapsed?: boolean } = {}) {
    this.setState({
      isNavOpen: extraState.isNavOpen !== undefined ? extraState.isNavOpen : this.state.isNavOpen,
      isSelectionOpen: extraState.isSelectionOpen !== undefined ? extraState.isSelectionOpen : this.state.isSelectionOpen,
      isTimetravelOpen: extraState.isTimetravelOpen !== undefined ? extraState.isTimetravelOpen : this.state.isTimetravelOpen,
      isLinkTagsCollapsed: extraState.isLinkTagsCollapsed !== undefined ? extraState.isLinkTagsCollapsed : this.state.isLinkTagsCollapsed,
      isInfrastructurePanelOpen: false,
      isKubernetesManagerOpen: false,
      isScreenConfigOpen: false,
      isPreferencesPanelOpen: false,
      isHelpOpen: false,
      isAboutOpen: false
    })
  }

  private refreshVmNameMap() {
    fetchVmNameMap().then((data) => {
      const prev = this.state.vmNameMap || {}
      const same = JSON.stringify(prev) === JSON.stringify(data)
      if (!same) {
        const suggestions = [...this.state.suggestions]
        Object.values(data).forEach((displayName) => {
          if (displayName && !suggestions.includes(displayName)) {
            suggestions.push(displayName)
          }
        })
        this.setState({ vmNameMap: data, suggestions })
        this.refreshTopology()
      }
    }).catch((err) => {
      console.debug("Failed to refresh vmNameMap", err)
    })
  }


  private refreshVmNetworkMap() {
    const ts = Date.now()
    fetch(`/api/vm-network-map?_=${ts}`, { cache: "no-store" }).then((resp) => {
      if (!resp.ok) {
        throw new Error(`vm-network-map api failed: ${resp.status}`)
      }
      return resp.json()
    }).then((data) => {
      const prev = this.state.vmNetworkMap || {}
      const same = JSON.stringify(prev) === JSON.stringify(data)
      if (!same) {
        this.setState({ vmNetworkMap: data })
        this.refreshTopology()
      }
    }).catch((err) => {
      console.debug("Failed to refresh vmNetworkMap", err)
    })
  }

  private refreshVmDetailMap() {
    const ts = Date.now()
    fetch(`/api/vm-detail-map?_=${ts}`, { cache: "no-store" }).then((resp) => {
      if (!resp.ok) {
        throw new Error(`vm-detail-map api failed: ${resp.status}`)
      }
      return resp.json()
    }).then((data) => {
      const prev = this.state.vmDetailMap || {}
      const same = JSON.stringify(prev) === JSON.stringify(data)
      if (!same) {
        this.setState({ vmDetailMap: data })
        this.refreshTopology()
      }
    }).catch((err) => {
      console.debug("Failed to refresh vmDetailMap", err)
    })
  }

  private refreshMoldInventory() {
    if (this.moldInventoryUnavailable) {
      return
    }
    const ts = Date.now()
    fetch(`/api/mold/inventory?_=${ts}`, { cache: "no-store" }).then((resp) => {
      if (!resp.ok) {
        if (resp.status === 404 || resp.status === 501) {
          this.moldInventoryUnavailable = true
        }
        throw new Error(`mold inventory api failed: ${resp.status}`)
      }
      return resp.json()
    }).then((data) => {
      const prev = this.state.moldInventory || {}
      const same = JSON.stringify(prev) === JSON.stringify(data || {})
      this.moldInventoryFailureLogged = false
      if (!same) {
        this.setState({ moldInventory: data })
      }
    }).catch((err) => {
      if (!this.moldInventoryFailureLogged) {
        console.debug("Failed to refresh moldInventory", err)
        this.moldInventoryFailureLogged = true
      }
    })
  }

  private refreshVMConsoleEnabled() {
    const conf = new Configuration({ basePath: this.props.session.endpoint + "/api", accessToken: this.props.session.token })
    const configAPI = new ConfigApi(conf)
    configAPI.getConfig("mold.console.enabled").then((data: any) => {
      let enabled = true
      if (typeof data === "boolean") {
        enabled = data
      } else if (typeof data === "string") {
        enabled = data.toLowerCase() === "true"
      } else if (typeof data === "number") {
        enabled = data !== 0
      } else if (data && typeof data === "object") {
        const value = (data as any).value ?? (data as any).Value
        if (typeof value === "boolean") {
          enabled = value
        } else if (typeof value === "string") {
          enabled = value.toLowerCase() === "true"
        } else if (typeof value === "number") {
          enabled = value !== 0
        }
      }
      this.setState({ isVMConsoleEnabled: enabled })
    }).catch((err) => {
      // keep default(true) for backward compatibility when key is unavailable
      console.debug("Failed to read mold.console.enabled config", err)
    })
  }

  private fetchKubernetesAPI(path: string, options: RequestInit = {}, timeoutMs = 15000): Promise<any> {
    const controller = new AbortController()
    const timeoutID = window.setTimeout(() => controller.abort(), timeoutMs)
    const requestOptions = {
      ...options,
      signal: controller.signal
    }
    return fetch(path, requestOptions).then((resp) => {
      if (!resp.ok) {
        throw new Error(`kubernetes api failed: ${resp.status}`)
      }
      return resp.json()
    }).finally(() => {
      window.clearTimeout(timeoutID)
    })
  }

  private refreshKubernetesClusters() {
    const requestSeq = ++this.kubernetesRequestSeq
    this.setState({ kubernetesLoading: true, kubernetesMessage: "" })
    this.fetchKubernetesAPI("/api/mold/kubernetes-clusters", { cache: "no-store" }).then((data) => {
      if (requestSeq !== this.kubernetesRequestSeq) {
        return
      }
      const clusters = data.clusters || []
      const selectedIds = Array.isArray(data.selectedIds)
        ? data.selectedIds
        : (data.selectedId ? [data.selectedId] : clusters.filter((cluster: MoldKubernetesCluster) => cluster.collectionEnabled).map((cluster: MoldKubernetesCluster) => cluster.id))
      this.setState({
        kubernetesClusters: clusters,
        kubernetesSelectedIds: selectedIds,
        kubernetesLoading: false,
        moldIntegrationConnected: true
      })
    }).catch((err) => {
      if (requestSeq !== this.kubernetesRequestSeq) {
        return
      }
      this.setState({
        kubernetesLoading: false,
        moldIntegrationConnected: false,
        kubernetesMessage: err && err.name === "AbortError" ? translate("kubernetesRequestTimeout") : translate("kubernetesLoadFailed")
      })
      console.debug("Failed to refresh kubernetes clusters", err)
    })
  }

  private saveKubernetesClusterSelection(selectedIds: string[], changedClusterID?: string, successMessage?: string) {
    const requestSeq = ++this.kubernetesRequestSeq
    this.setState({
      kubernetesLoading: true,
      kubernetesMessage: "",
      kubernetesSelectedIds: selectedIds,
      kubernetesClusters: this.state.kubernetesClusters.map((cluster) => ({
        ...cluster,
        collectionEnabled: selectedIds.includes(cluster.id),
        collectionRunning: selectedIds.includes(cluster.id) ? cluster.collectionRunning : false
      }))
    })
    const request = selectedIds.length === 0
      ? this.fetchKubernetesAPI("/api/mold/kubernetes-clusters/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: changedClusterID || "", ids: [] })
      })
      : this.fetchKubernetesAPI("/api/mold/kubernetes-clusters/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: changedClusterID || selectedIds[0], ids: selectedIds })
      })
    return request.then((data) => {
      if (requestSeq !== this.kubernetesRequestSeq) {
        return
      }
      const message = selectedIds.length === 0
        ? translate("kubernetesCollectionDisabled")
        : (successMessage || (data.probeRunning ? translate("kubernetesProbeStarted") : translate("kubernetesProbeStartFailed")))
      this.setState({ kubernetesMessage: message })
      this.refreshKubernetesClusters()
      window.setTimeout(() => this.sync(), 500)
    }).catch((err) => {
      if (requestSeq === this.kubernetesRequestSeq) {
        this.setState({
          kubernetesLoading: false,
          kubernetesMessage: err && err.name === "AbortError" ? translate("kubernetesRequestTimeout") : translate("kubernetesSaveFailed")
        })
      }
      console.debug("Failed to select kubernetes cluster", err)
    })
  }

  private selectKubernetesCluster(clusterID: string) {
    if (!clusterID) {
      return
    }
    const selectedIds = Array.from(new Set([...this.state.kubernetesSelectedIds, clusterID]))
    this.saveKubernetesClusterSelection(selectedIds, clusterID)
  }

  private disableKubernetesCollection(clusterID?: string) {
    const selectedIds = clusterID
      ? this.state.kubernetesSelectedIds.filter((id) => id !== clusterID)
      : []
    this.saveKubernetesClusterSelection(selectedIds, clusterID)
  }

  private testKubernetesConnection(clusterID?: string, openDialog = true, quiet = false): Promise<any> {
    const targetID = clusterID || this.state.kubernetesSelectedIds[0]
    if (!targetID || (openDialog && this.state.kubernetesTestLoading)) {
      return Promise.resolve(null)
    }
    const requestSeq = ++this.kubernetesTestRequestSeq
    if (openDialog) {
      this.startKubernetesTestProgress(targetID)
      this.setState({
        kubernetesTestDialogOpen: true,
        kubernetesTestClusterId: targetID,
        kubernetesTestLoading: true,
        kubernetesTestResults: this.kubernetesWaitingChecks("kubeconfig")
      })
    }
    return this.fetchKubernetesAPI("/api/mold/kubernetes-clusters/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: targetID })
    }, 30000).then((data) => {
      if (requestSeq !== this.kubernetesTestRequestSeq && openDialog) {
        return data
      }
      const lastTests = {
        ...this.state.kubernetesLastTests,
        [targetID]: { ok: !!data.ok, checkedAt: new Date().toLocaleString(), message: data.message || "" }
      }
      this.clearKubernetesTestProgress()
      if (openDialog) {
        this.revealKubernetesTestResults(targetID, requestSeq, data.checks || [], {
          kubernetesLastTests: lastTests,
          kubernetesMessage: data.ok ? translate("kubernetesTestSuccess") : translate("kubernetesTestFailed")
        })
      } else {
        const nextState: any = { kubernetesLastTests: lastTests }
        if (!quiet) {
          nextState.kubernetesTestLoading = false
          nextState.kubernetesMessage = data.ok ? translate("kubernetesTestSuccess") : translate("kubernetesTestFailed")
        }
        this.setState(nextState)
      }
      return { ...data, clusterID: targetID }
    }).catch((err) => {
      this.clearKubernetesTestProgress()
      const lastTests = {
        ...this.state.kubernetesLastTests,
        [targetID]: { ok: false, checkedAt: new Date().toLocaleString(), message: translate("kubernetesTestFailed") }
      }
      if (requestSeq === this.kubernetesTestRequestSeq || !openDialog) {
        const nextState: any = {
          kubernetesTestResults: [],
          kubernetesLastTests: lastTests
        }
        if (!quiet) {
          nextState.kubernetesTestLoading = false
          nextState.kubernetesMessage = err && err.name === "AbortError" ? translate("kubernetesRequestTimeout") : translate("kubernetesTestFailed")
        }
        this.setState(nextState)
      }
      console.debug("Failed to test kubernetes connection", err)
      return null
    })
  }

  private kubernetesDefaultCheckKeys() {
    return [
      "kubeconfig",
      "apiserver",
      "client",
      "version",
      "namespaces",
      "nodes",
      "pods",
      "services",
      "networkpolicies"
    ]
  }

  private kubernetesPendingCheck(key: string): KubernetesCheckResult {
    return {
      key,
      label: translate(`kubernetesCheck-${key}`),
      ok: false,
      pending: true,
      message: translate("testing")
    }
  }

  private kubernetesWaitingCheck(key: string): KubernetesCheckResult {
    return {
      key,
      label: translate(`kubernetesCheck-${key}`),
      ok: false,
      waiting: true,
      message: translate("waiting")
    }
  }

  private kubernetesWaitingChecks(activeKey?: string): KubernetesCheckResult[] {
    return this.kubernetesDefaultCheckKeys().map((key) => (
      key === activeKey ? this.kubernetesPendingCheck(key) : this.kubernetesWaitingCheck(key)
    ))
  }

  private clearKubernetesTestProgress() {
    this.kubernetesTestProgressTimers.forEach((timerID) => window.clearTimeout(timerID))
    this.kubernetesTestProgressTimers = []
  }

  private scrollKubernetesCheckListToBottom() {
    window.setTimeout(() => {
      const list = this.kubernetesCheckListRef.current
      if (list) {
        list.scrollTop = list.scrollHeight
      }
    }, 0)
  }

  private startKubernetesTestProgress(targetID: string) {
    this.clearKubernetesTestProgress()
    const keys = this.kubernetesDefaultCheckKeys()
    keys.slice(1).forEach((key, index) => {
      const timerID = window.setTimeout(() => {
        if (!this.state.kubernetesTestLoading || this.state.kubernetesTestClusterId !== targetID) {
          return
        }
        this.setState({
          kubernetesTestResults: this.state.kubernetesTestResults.map((check) => (
            check.key === key ? this.kubernetesPendingCheck(key) : check
          ))
        }, () => this.scrollKubernetesCheckListToBottom())
      }, 220 * (index + 1))
      this.kubernetesTestProgressTimers.push(timerID)
    })
  }

  private revealKubernetesTestResults(targetID: string, requestSeq: number, checks: KubernetesCheckResult[], finalState: any) {
    this.clearKubernetesTestProgress()
    checks = this.normalizeKubernetesTestChecks(checks)
    const orderedChecks = this.kubernetesDefaultCheckKeys().map((key) => checks.find((check) => check.key === key)).filter((check): check is KubernetesCheckResult => !!check)
    const resultChecks = orderedChecks.length > 0 ? orderedChecks : checks

    if (resultChecks.length === 0) {
      this.setState({
        ...finalState,
        kubernetesTestLoading: false,
        kubernetesTestResults: this.kubernetesWaitingChecks()
      })
      return
    }

    if (resultChecks.length === 1) {
      this.setState({
        ...finalState,
        kubernetesTestLoading: false,
        kubernetesTestResults: this.kubernetesWaitingChecks().map((check) => (
          check.key === resultChecks[0].key ? resultChecks[0] : check
        ))
      })
      return
    }

    this.setState({
      kubernetesTestLoading: true,
      kubernetesTestResults: this.kubernetesWaitingChecks(resultChecks[0].key).map((check) => (
        check.key === resultChecks[0].key ? resultChecks[0] : check
      ))
    }, () => this.scrollKubernetesCheckListToBottom())
    resultChecks.slice(1).forEach((check, index) => {
      const resultIndex = index + 1
      const timerID = window.setTimeout(() => {
        if (requestSeq !== this.kubernetesTestRequestSeq || this.state.kubernetesTestClusterId !== targetID) {
          return
        }
        const completed = resultChecks.slice(0, resultIndex + 1)
        const completedByKey = new Map(completed.map((item) => [item.key, item]))
        const isLast = resultIndex === resultChecks.length - 1
        this.setState({
          ...(isLast ? finalState : {}),
          kubernetesTestLoading: !isLast,
          kubernetesTestResults: this.kubernetesWaitingChecks(resultChecks[resultIndex + 1]?.key).map((item) => completedByKey.get(item.key) || item)
        }, () => {
          if (!isLast) {
            this.scrollKubernetesCheckListToBottom()
          }
        })
      }, 180 * resultIndex)
      this.kubernetesTestProgressTimers.push(timerID)
    })
  }

  private normalizeKubernetesTestChecks(checks: KubernetesCheckResult[]) {
    const keys = checks.map((check) => check.key)
    if (keys.indexOf("client") >= 0) {
      return checks
    }
    const apiserverIndex = checks.findIndex((check) => check.key === "apiserver" && check.ok)
    if (apiserverIndex < 0) {
      return checks
    }
    const normalized = checks.slice()
    normalized.splice(apiserverIndex + 1, 0, {
      key: "client",
      label: translate("kubernetesCheck-client"),
      ok: true,
      message: translate("kubernetesClientCreated")
    })
    return normalized
  }

  private testAllKubernetesConnections() {
    if (this.state.kubernetesTestLoading || this.state.kubernetesTestAllLoading || this.state.kubernetesClusters.length === 0) {
      return
    }
    this.setState({ kubernetesTestAllLoading: true, kubernetesMessage: translate("kubernetesTestAllRunning") })
    Promise.all(this.state.kubernetesClusters.map((cluster) => this.testKubernetesConnection(cluster.id, false, true))).then((results) => {
      const total = results.length
      const failed = results.filter((result) => !result || !result.ok).length
      const passedIds = results.filter((result) => result && result.ok && result.clusterID).map((result) => result.clusterID)
      const summaryMessage = failed === 0 ? translate("kubernetesTestAllSuccess") : `${failed} / ${total} ${translate("kubernetesTestAllFailedSuffix")}`
      const finalize = () => this.setState({
        kubernetesTestAllLoading: false,
        kubernetesMessage: summaryMessage
      })
      if (passedIds.length > 0) {
        this.saveKubernetesClusterSelection(Array.from(new Set(passedIds)), passedIds[0], summaryMessage).finally(finalize)
        return
      }
      finalize()
    }).catch(() => {
      this.setState({
        kubernetesTestAllLoading: false,
        kubernetesMessage: translate("kubernetesTestAllFailed")
      })
    })
  }

  private selectedKubernetesCluster(clusterID: string): MoldKubernetesCluster | undefined {
    return this.state.kubernetesClusters.find((cluster) => cluster.id === clusterID)
  }

  private kubernetesTopologySummary(): KubernetesTopologySummary {
    const summary: KubernetesTopologySummary = {
      clusters: 0,
      nodes: 0,
      namespaces: 0,
      pods: 0,
      services: 0,
      clusterNodeIDs: [],
      nodeNodeIDs: [],
      namespaceNodeIDs: [],
      podNodeIDs: [],
      serviceNodeIDs: []
    }
    if (!this.tc) {
      return summary
    }
    this.tc.nodes.forEach((node) => {
      if (node.data.Manager !== "k8s") {
        return
      }
      switch (node.data.Type) {
        case "cluster":
          summary.clusters += 1
          summary.clusterNodeIDs.push(node.id)
          break
        case "node":
          summary.nodes += 1
          summary.nodeNodeIDs.push(node.id)
          break
        case "namespace":
          summary.namespaces += 1
          summary.namespaceNodeIDs.push(node.id)
          break
        case "pod":
          summary.pods += 1
          summary.podNodeIDs.push(node.id)
          break
        case "service":
          summary.services += 1
          summary.serviceNodeIDs.push(node.id)
          break
        default:
          break
      }
    })
    return summary
  }

  private isKubernetesCollectionEnabled(cluster: MoldKubernetesCluster) {
    return this.state.kubernetesSelectedIds.length > 0 ? this.state.kubernetesSelectedIds.includes(cluster.id) : cluster.collectionEnabled
  }

  private localizeMoldState(state: string) {
    switch ((state || "").toLowerCase()) {
      case "running":
        return translate("moldStateRunning")
      case "stopped":
        return translate("moldStateStopped")
      case "error":
        return translate("moldStateError")
      default:
        return state || "-"
    }
  }

  private collectionStateLabel(cluster: MoldKubernetesCluster) {
    const enabled = this.isKubernetesCollectionEnabled(cluster)
    const last = this.state.kubernetesLastTests[cluster.id]
    if (enabled && last && !last.ok) {
      return translate("collectionError")
    }
    if (enabled && cluster.collectionRunning) {
      return translate("collectionRunning")
    }
    if (enabled) {
      return translate("collectionPending")
    }
    return translate("collectionStopped")
  }

  private middleEllipsis(value: string, max = 30) {
    if (!value || value.length <= max) {
      return value || "-"
    }
    const head = Math.ceil((max - 3) * 0.62)
    const tail = Math.max(max - 3 - head, 4)
    return `${value.slice(0, head)}...${value.slice(value.length - tail)}`
  }

  private compactIdentifier(value: string) {
    if (!value || value.length <= 15) {
      return value || "-"
    }
    return `${value.slice(0, 6)}...${value.slice(value.length - 6)}`
  }

  private copyKubernetesAPIServer(cluster: MoldKubernetesCluster) {
    if (!cluster.apiServer) {
      return
    }
    const done = () => {
      this.setState({ kubernetesCopiedClusterId: cluster.id })
      window.setTimeout(() => {
        if (this.state.kubernetesCopiedClusterId === cluster.id) {
          this.setState({ kubernetesCopiedClusterId: "" })
        }
      }, 1400)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cluster.apiServer).then(done).catch(done)
    } else {
      done()
    }
  }

  private confirmKubernetesEnable() {
    const clusterID = this.state.kubernetesConfirmClusterId
    if (!clusterID) {
      return
    }
    this.setState({ kubernetesConfirmClusterId: "" })
    this.selectKubernetesCluster(clusterID)
  }

  private confirmKubernetesDisable() {
    if (!this.state.kubernetesStopClusterId) {
      return
    }
    const targetID = this.state.kubernetesStopClusterId
    this.setState({ kubernetesStopClusterId: "" })
    this.disableKubernetesCollection(targetID)
  }

  private onKubernetesCollectionToggle(cluster: MoldKubernetesCluster, checked: boolean) {
    if (checked) {
      this.setState({ kubernetesConfirmClusterId: cluster.id })
      return
    }
    if (this.isKubernetesCollectionEnabled(cluster)) {
      this.setState({ kubernetesStopClusterId: cluster.id })
    }
  }

  private kubernetesCheckLabel(check: KubernetesCheckResult) {
    const key = `kubernetesCheck-${check.key}`
    const translated = translate(key)
    return translated === key ? check.label : translated
  }

  private kubernetesTestSummaryText() {
    const checks = this.state.kubernetesTestResults
    const completed = checks.filter((check) => !check.pending && !check.waiting).length
    const failed = checks.filter((check) => !check.pending && !check.waiting && !check.ok).length
    if (checks.length === 0) {
      return translate("kubernetesNoTestResult")
    }
    if (!this.state.kubernetesTestLoading && failed === 0 && completed === checks.length) {
      return translate("kubernetesAllTestsPassed")
    }
    if (!this.state.kubernetesTestLoading && failed > 0) {
      return `${failed}${translate("kubernetesFailedCountSuffix")}`
    }
    return `${completed} / ${checks.length} ${translate("kubernetesCheckedCountSuffix")}`
  }


  loadStaticData(url: string) {
    fetch(url).then(resp => {
      resp.json().then(data => {
        if (!Array.isArray(data)) {
          throw "topology schema error"
        }
        this.parseTopology(data[0])
      }).catch(() => {
        this.notify("Unable to load or parse topology data", "error")
      })
    })
  }

  private applyDefaultFilter(): boolean {
    var filter = this.config.defaultFilter()
    if (filter) {
      this.nextTag = filter.tag
      filter.callback()

      return true
    }

    return false
  }

  private applyFilter(filter: Filter | null) {
    this.state.activeFilter = filter
    this.debSetState(this.state)

    if (filter) {
      this.nextTag = filter.tag
      filter.callback()
    } else {
      this.applyDefaultFilter()
    }
  }

  private updateFilters() {
    this.config.filters().then(filters => {
      for (let filter of filters) {
        if (!this.filters.has(filter.id)) {
          this.filters.set(filter.id, filter)
        }
      }

      let fnc = (a: Filter, b: Filter) => {
        if (a.category == b.category) {
          return a.label.localeCompare(b.label)
        }
        return a.category.localeCompare(b.category)
      }

      let configFilters = Array.from(this.filters.values()).sort(fnc)
      this.state.filters = this.customFilters.concat(configFilters)

      this.debSetState(this.state)
    })
  }

  private updateSuggestions(node: Node) {
    var suggestions = this.state.suggestions
    var updated: boolean = false

    for (let key of this.config.suggestions()) {
      try {
        var value = eval("node." + key)
        if (Array.isArray(value)) {
          for (let v of value) {
            if (!suggestions.includes(v)) {
              suggestions.push(v)
              updated = true
            }
          }
        } else if (typeof value === "string") {
          if (!suggestions.includes(value)) {
            suggestions.push(value)
            updated = true
          }
        }
      } catch (e) { }
    }

    if (updated) {
      this.state.suggestions = suggestions
      this.debSetState(this.state)
    }
  }

  addNode(node: any): boolean {
    if (!this.tc) {
      return false
    }

    // ignore Type ofrule
    if (node.Metadata.Type === "ofrule") {
      return false
    }

    var tags = this.config.nodeTags(node.Metadata)

    let n = this.tc.addNode(node.ID, tags, node.Metadata, (n: Node): number => this.config.nodeAttrs(n).weight)
    this.tc.setParent(n, this.tc.root)

    this.updateSuggestions(n)

    this.debUpdateFilters()

    return true
  }

  updatedNode(node: any): boolean {
    if (!this.tc) {
      return false
    }
    if (!node.Metadata) {
      console.warn("no metadata found: " + node)
      return false
    }

    // ignore Type ofrule
    if (node.Metadata.Type === "ofrule") {
      return false
    }

    var n = this.tc.updateNode(node.ID, node.Metadata)
    if (!n) {
      return false
    }

    // eventually update the panels
    this.bumpRevision(node.ID)

    this.debUpdateFilters()

    return true
  }

  delNode(node: any): boolean {
    if (!this.tc) {
      return false
    }

    this.tc.delNode(node.ID)

    return true
  }

  addEdge(edge: any): boolean {
    if (!this.tc) {
      return false
    }

    let parent = this.tc.nodes.get(edge.Parent)
    let child = this.tc.nodes.get(edge.Child)

    if (parent && child) {
      if (this.config.isHierarchyLink(edge.Metadata)) {
        this.tc.setParent(child, parent)
      } else {
        this.tc.addLink(edge.ID, parent, child, [edge.Metadata.RelationType], edge.Metadata)
      }
    }

    return true
  }

  updatedEdge(edge: any): boolean {
    if (!this.tc) {
      return false
    }

    this.tc.updateLink(edge.ID, edge.Metadata)

    return true
  }

  delEdge(edge: any): boolean {
    if (!this.tc) {
      return false
    }

    this.tc.delLink(edge.ID)

    return true
  }

  parseTopology(data: { Nodes: any, Edges: any }) {
    if (!this.tc) {
      return
    }

    if (!data.Nodes) {
      return
    }

    // first add all the nodes
    for (let node of data.Nodes) {
      this.addNode(node)
    }

    if (data.Edges) {
      // then add ownership links
      for (let edge of data.Edges) {
        if (edge.Metadata.RelationType === "ownership") {
          this.addEdge(edge)
        }
      }

      // finally add remaining links
      // then add ownership links
      for (let edge of data.Edges) {
        if (edge.Metadata.RelationType !== "ownership") {
          this.addEdge(edge)
        }
      }
    }

    if (this.nextTag) {
      this.tc.activeNodeTag(this.nextTag)
      this.nextTag = ""
    } else {
      this.tc.activeNodeTag(this.config.defaultNodeTag())
    }

    this.state.nodeTagStates = this.tc.nodeTagStates
    this.debSetState(this.state)

    this.updateFilters()

    this.tc.zoomFit()
    this.pruneRecentViewedNodes()
  }

  nodeAttrs(node: Node): NodeAttrs {
    var attrs = this.config.nodeAttrs(node)
    if (node.data.State) {
      attrs.classes.push(node.data.State.toLowerCase())
    }

    return attrs
  }

  linkAttrs(link: Link): LinkAttrs {
    return this.config.linkAttrs(link)
  }

  onNodeSelected(node: Node, active: boolean) {
    if (active) {
      this.props.selectElement(node)
      this.addRecentViewedNode(node)
      this.openSelection()
    } else {
      if (this.tc) {
        this.tc.pinNode(node, false)
      }
      this.props.unselectElement(node)
    }
  }

  onLinkSelected(link: Link, active: boolean) {
    if (active) {
      this.props.selectElement(link)
      this.openSelection()
    } else {
      this.props.unselectElement(link)
    }
  }

  sortNodesFnc(a: Node, b: Node) {
    return this.config.nodeSortFnc(a, b)
  }

  onShowNodeContextMenu(node: Node) {
    return this.config.nodeMenu(node)
  }

  _refreshTopology() {
    if (this.tc) {
      this.tc.renderTree();
      this.pruneRecentViewedNodes()
    }
  }

  onWebSocketMessage(msg: string) {
    var data: { Type: string, Obj: any } = JSON.parse(msg)
    switch (data.Type) {
      case "SyncReply":
        this.state.suggestions = []
        if (this.tc) {
          this.tc.resetTree()
          this.parseTopology(data.Obj)
        }
        this.synced = true
        break
      case "NodeAdded":
        if (!this.synced) {
          return
        }
        if (this.addNode(data.Obj)) {
          this.refreshTopology()
        }
        break
      case "NodeUpdated":
        if (!this.synced) {
          return
        }

        if (this.updatedNode(data.Obj)) {
          this.refreshTopology()
        }
        break
      case "NodeDeleted":
        if (!this.synced) {
          return
        }
        if (this.delNode(data.Obj)) {
          this.refreshTopology()
        }
        break
      case "EdgeAdded":
        if (!this.synced) {
          return
        }
        if (this.addEdge(data.Obj)) {
          this.refreshTopology()

          if (this.tc) {
            this.state.linkTagStates = this.tc.linkTagStates
            this.debSetState(this.state)
          }
        }
        break
      case "EdgeUpdated":
        if (!this.synced) {
          return
        }

        if (this.updatedEdge(data.Obj)) {
          this.refreshTopology()
        }
        break
      case "EdgeDeleted":
        if (!this.synced) {
          return
        }
        if (this.delEdge(data.Obj)) {
          this.refreshTopology()
        }
        break
      default:
        break
    }
  }

  onWebSocketClose() {
    this.connected = false

    if (this.synced) {
      this.notify("Disconnected", "error")
    } else {
      this.notify("Not connected", "error")
    }

    this.state.appVersion = ""
    this.setState(this.state)

    this.synced = false

    // check if still authenticated
    this.checkAuth()
  }

  checkAuth() {
    var conf = new Configuration({ basePath: this.props.session.endpoint + "/api", accessToken: this.props.session.token })
    var api = new StatusApi(conf)

    api.getStatus().catch(err => {
      if (err.status === 401) {
        this.logout()
      }
    })
  }

  getAppVersion() {
    var conf = new Configuration({ basePath: this.props.session.endpoint + "/api", accessToken: this.props.session.token })
    var api = new APIInfoApi(conf)

    api.getApi().then(data => {
      this.state.appVersion = data.Version || ""
      this.setState(this.state)
    })
  }

  sendMessage(data: any) {
    if (this.websocket) {
      this.websocket.sendMessage(JSON.stringify(data))
    }
  }

  setWSContext(context: WSContext) {
    this.state.wsContext = context
    this.setState(this.state)
    this.sync()
  }

  setGremlinFilter(gremlin: string) {
    if (this.state.wsContext.GremlinFilter !== gremlin) {
      this.state.wsContext.GremlinFilter = gremlin
      this.setWSContext(this.state.wsContext)
    }
  }

  sync() {
    if (!this.tc || !this.connected) {
      return
    }

    this.nextTag = this.activeNodeTagName()

    var obj = {}
    if (this.state.wsContext.GremlinFilter) {
      obj["GremlinFilter"]
    }
    if (this.state.wsContext.Time) {
      obj["Time"] = this.state.wsContext.Time
    }

    // then reset the topology view and re-sync
    var msg = { "Namespace": "Graph", "Type": "SyncRequest", "Obj": obj }
    this.sendMessage(msg)
  }

  onWebSocketOpen() {
    this.connected = true

    if (!this.tc) {
      return
    }

    this.notify("Connected", "info")
    if (!this.applyDefaultFilter()) {
      this.sync()
    }

    // set API configuration
    this.apiConf = new Configuration({ basePath: this.props.session.endpoint + "/api", accessToken: this.props.session.token })

    this.getAppVersion()
  }

  notify(msg, variant) {
    this.props.enqueueSnackbar(msg, {
      variant: variant,
      autoHideDuration: 1000,
      anchorOrigin: {
        vertical: 'bottom',
        horizontal: 'right',
      }
    })
  }

  openDrawer() {
    this.state.isNavOpen = !this.state.isNavOpen
    this.setState(this.state)
  }

  closeDrawer() {
    this.closeSidePanels({ isNavOpen: false })
  }

  onLinkTagStateChange(event) {
    this.cycleLinkTagState(event.target.value)
  }

  private cycleLinkTagState(tag: string) {
    if (!this.tc) {
      return
    }

    switch (this.tc.linkTagStates.get(tag)) {
      case LinkTagState.Hidden:
        this.tc.setLinkTagState(tag, LinkTagState.EventBased)
        break
      case LinkTagState.EventBased:
        this.tc.setLinkTagState(tag, LinkTagState.Visible)
        break
      case LinkTagState.Visible:
        this.tc.setLinkTagState(tag, LinkTagState.Hidden)
        break
    }
  }

  private linkTagMeta(tag: string) {
    const normalized = tag.toLowerCase()
    const meta: { [key: string]: { key: string, name: string, summary: string, description: string, badge?: string } } = {
      layer2: {
        key: "L2",
        name: translate("connectionDisplayLayer2Name"),
        summary: "Layer 2",
        description: translate("connectionDisplayLayer2Description"),
        badge: translate("connectionDisplayPhysicalBadge")
      },
      vlayer2: {
        key: "vL2",
        name: translate("connectionDisplayVLayer2Name"),
        summary: "Virtual Layer 2",
        description: translate("connectionDisplayVLayer2Description"),
        badge: translate("connectionDisplayVirtualBadge")
      },
      service: {
        key: "Service",
        name: translate("connectionDisplayServiceName"),
        summary: translate("connectionDisplayRelatedResourceSummary"),
        description: translate("connectionDisplayServiceDescription"),
        badge: "K8s"
      },
      node: {
        key: "Node",
        name: translate("connectionDisplayNodeName"),
        summary: translate("connectionDisplayRelatedResourceSummary"),
        description: translate("connectionDisplayNodeDescription"),
        badge: "K8s"
      },
      daemonset: {
        key: "DaemonSet",
        name: translate("connectionDisplayDaemonSetName"),
        summary: translate("connectionDisplayPodNodeSummary"),
        description: translate("connectionDisplayDaemonSetDescription"),
        badge: "K8s"
      }
    }
    return meta[normalized] || {
      key: tag,
      name: translate("connectionDisplayGenericLayerNamePattern").replace("{name}", translate(tag)),
      summary: translate("connectionDisplayAdditionalLayerSummary"),
      description: translate("connectionDisplayAdditionalLayerDescription")
    }
  }

  private orderedLinkTagsForActiveLayer(): string[] {
    const tags = Array.from(this.state.linkTagStates.keys())
    const preferred = this.isKubernetesLayerActive()
      ? ["service", "node", "daemonset"]
      : ["layer2", "vlayer2"]
    const preferredSet = new Set(preferred)
    const infraSet = new Set(["layer2", "vlayer2"])
    const kubernetesSet = new Set([
      "cluster",
      "namespace",
      "node",
      "pod",
      "service",
      "deployment",
      "daemonset",
      "statefulset",
      "ingress",
      "networkpolicy"
    ])
    const normalizedToTag = new Map(tags.map((tag) => [tag.toLowerCase(), tag]))
    const ordered = preferred
      .map((tag) => normalizedToTag.get(tag))
      .filter((tag): tag is string => !!tag)
    const extras = tags.filter((tag) => {
      const normalized = tag.toLowerCase()
      if (preferredSet.has(normalized)) {
        return false
      }
      return this.isKubernetesLayerActive() ? !infraSet.has(normalized) : !kubernetesSet.has(normalized)
    })
    return ordered.concat(extras)
  }

  private linkTagStateInfo(state: LinkTagState | undefined) {
    switch (state) {
      case LinkTagState.Visible:
        return {
          icon: "V",
          label: translate("connectionDisplayVisibleLabel"),
          description: translate("connectionDisplayVisibleDescription"),
          className: "visible"
        }
      case LinkTagState.EventBased:
        return {
          icon: "-",
          label: translate("connectionDisplayRelatedLabel"),
          description: translate("connectionDisplayRelatedDescription"),
          className: "event"
        }
      default:
        return {
          icon: "",
          label: translate("connectionDisplayHiddenLabel"),
          description: translate("connectionDisplayHiddenDescription"),
          className: "hidden"
        }
    }
  }

  private renderLinkUsageDiagram(classes: any, mode: "event" | "visible" | "hidden") {
    const active = mode === "visible" ? [1, 2, 3, 4, 5] : mode === "event" ? [2, 3, 4] : [3]
    const lineClass = (index: number) => active.indexOf(index) !== -1 ? classes.linkUsageLineActive : classes.linkUsageLineMuted
    const nodeClass = (index: number) => active.indexOf(index) !== -1 ? classes.linkUsageNodeActive : classes.linkUsageNodeMuted
    return (
      <svg className={classes.linkUsageDiagram} viewBox="0 0 120 64" aria-hidden="true">
        <line x1="24" y1="18" x2="58" y2="32" className={lineClass(2)} />
        <line x1="24" y1="48" x2="58" y2="32" className={lineClass(3)} />
        <line x1="58" y1="32" x2="96" y2="18" className={lineClass(4)} />
        <line x1="58" y1="32" x2="96" y2="48" className={lineClass(5)} />
        <circle cx="24" cy="18" r="6" className={nodeClass(1)} />
        <circle cx="24" cy="48" r="6" className={nodeClass(2)} />
        <circle cx="58" cy="32" r="8" className={classes.linkUsageNodeSelected} />
        <circle cx="96" cy="18" r="6" className={nodeClass(4)} />
        <circle cx="96" cy="48" r="6" className={nodeClass(5)} />
      </svg>
    )
  }

  private renderLinkUsageExamples(classes: any) {
    const examples = [
      {
        mode: "event" as const,
        state: LinkTagState.EventBased,
        title: translate("connectionDisplayUsageRelatedTitle"),
        points: [translate("connectionDisplayUsageRelatedPoint1"), translate("connectionDisplayUsageRelatedPoint2")]
      },
      {
        mode: "visible" as const,
        state: LinkTagState.Visible,
        title: translate("connectionDisplayUsageVisibleTitle"),
        points: [translate("connectionDisplayUsageVisiblePoint1"), translate("connectionDisplayUsageVisiblePoint2")]
      },
      {
        mode: "hidden" as const,
        state: LinkTagState.Hidden,
        title: translate("connectionDisplayUsageHiddenTitle"),
        points: [translate("connectionDisplayUsageHiddenPoint1"), translate("connectionDisplayUsageHiddenPoint2")]
      }
    ]

    return (
      <div className={classes.linkTagsUsageExamples}>
        <button
          type="button"
          className={classes.linkTagsUsageToggle}
          onClick={() => this.setState({ isLinkTagExamplesOpen: !this.state.isLinkTagExamplesOpen })}>
          <span>{translate("connectionDisplayUsageToggle")}</span>
          {this.state.isLinkTagExamplesOpen ? <UnfoldLessIcon fontSize="small" /> : <UnfoldMoreIcon fontSize="small" />}
        </button>
        {this.state.isLinkTagExamplesOpen &&
          <div className={classes.linkTagsUsageGrid}>
            {examples.map((example) => {
              const stateInfo = this.linkTagStateInfo(example.state)
              return (
                <div key={example.mode} className={classes.linkTagsUsageCard}>
                  <div className={classes.linkTagsUsageHeader}>
                    <span className={clsx(classes.linkLayerStateIcon, classes[`linkLayerStateIcon${stateInfo.className}`])}>
                      {stateInfo.icon}
                    </span>
                    <strong>{example.title}</strong>
                  </div>
                  {this.renderLinkUsageDiagram(classes, example.mode)}
                  <ul>
                    {example.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                </div>
              )
            })}
          </div>
        }
      </div>
    )
  }

  private primaryCompactLinkTag(tags: string[]) {
    return tags.find((tag) => this.state.linkTagStates.get(tag) !== LinkTagState.Hidden) || tags[0] || ""
  }

  private compactLinkRangeLabel(tag: string) {
    const state = this.state.linkTagStates.get(tag)
    if (state === LinkTagState.Visible) {
      return translate("connectionDisplayVisibleShort")
    }
    if (state === LinkTagState.EventBased) {
      return translate("connectionDisplayRelatedShort")
    }
    return translate("connectionDisplayHiddenShort")
  }

  private compactLinkLayerLabel(tag: string) {
    const meta = this.linkTagMeta(tag)
    const normalized = tag.toLowerCase()
    if (normalized === "layer2") {
      return "L2"
    }
    if (normalized === "vlayer2") {
      return "vL2"
    }
    return meta.key
  }

  private compactLinkLayerDescription() {
    return this.isKubernetesLayerActive()
      ? translate("connectionDisplayKubernetesDescription")
      : translate("connectionDisplayInfrastructureDescription")
  }

  private connectionDisplaySummary(tags: string[]) {
    const primaryTag = this.primaryCompactLinkTag(tags)
    if (!primaryTag) {
      return translate("loading")
    }
    return `${this.compactLinkLayerLabel(primaryTag)} · ${this.compactLinkRangeLabel(primaryTag)}`
  }

  private selectCompactLinkTag(tag: string, tags: string[]) {
    if (!this.tc) {
      return
    }
    tags.forEach((candidate) => {
      this.tc!.setLinkTagState(candidate, candidate === tag ? LinkTagState.EventBased : LinkTagState.Hidden)
    })
  }

  private setCompactLinkRange(tag: string, state: LinkTagState) {
    if (!this.tc || !tag) {
      return
    }
    this.tc.setLinkTagState(tag, state)
  }

  private renderCompactLinkTagControls(classes: any, tags: string[]) {
    const primaryTag = this.primaryCompactLinkTag(tags)
    const activeState = this.state.linkTagStates.get(primaryTag) || LinkTagState.Hidden
    const rangeOptions = [
      {
        state: LinkTagState.EventBased,
        label: translate("connectionDisplayRelatedShort"),
        tooltip: translate("connectionDisplayRelatedTooltip")
      },
      {
        state: LinkTagState.Visible,
        label: translate("connectionDisplayVisibleShort"),
        tooltip: translate("connectionDisplayVisibleDescription")
      },
      {
        state: LinkTagState.Hidden,
        label: translate("connectionDisplayHiddenShort"),
        tooltip: translate("connectionDisplayHiddenDescription")
      }
    ]

    return (
      <div className={classes.linkTagsCompactBody}>
        <div className={classes.linkTagsCompactRow}>
          <span className={classes.linkTagsCompactRowLabel}>계층</span>
          <div className={classes.linkTagsCompactSegment}>
            {tags.map((tag) => {
              const meta = this.linkTagMeta(tag)
              const isActive = tag === primaryTag
              return (
                <Tooltip key={tag} title={meta.description}>
                  <button
                    type="button"
                    className={clsx(classes.linkTagsCompactControl, isActive && classes.linkTagsCompactControlActive)}
                    onClick={(event) => {
                      event.stopPropagation()
                      this.selectCompactLinkTag(tag, tags)
                    }}>
                    {this.compactLinkLayerLabel(tag)}
                  </button>
                </Tooltip>
              )
            })}
          </div>
        </div>
        <div className={classes.linkTagsCompactDivider} />
        <div className={classes.linkTagsCompactRow}>
          <span className={classes.linkTagsCompactRowLabel}>{translate("connectionDisplayRangeTitle")}</span>
          <div className={classes.linkTagsCompactSegment}>
            {rangeOptions.map((option) => (
              <Tooltip key={option.label} title={option.tooltip}>
                <button
                  type="button"
                  className={clsx(classes.linkTagsCompactControl, activeState === option.state && classes.linkTagsCompactControlActive)}
                  onClick={(event) => {
                    event.stopPropagation()
                    this.setCompactLinkRange(primaryTag, option.state)
                  }}>
                  {option.label}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    )
  }

  private additionalLinkTagCount(tags: string[]) {
    const baseCount = this.isKubernetesLayerActive() ? 3 : 2
    return Math.max(0, tags.length - baseCount)
  }

  onLinkTagChange(tags: Map<string, LinkTagState>) {
    this.state.linkTagStates = tags
    this.debSetState(this.state)
  }

  onSearchChange(selected: Array<string>) {
    if (!this.tc) {
      return
    }

    const vmNameMap = this.state.vmNameMap || {}
    const reverseVmNameMap = new Map<string, string>()
    Object.keys(vmNameMap).forEach((libvirtName) => {
      const displayName = vmNameMap[libvirtName]
      if (displayName) {
        reverseVmNameMap.set(displayName, libvirtName)
      }
    })

    const expandedSearchTerms = new Array<string>()
    selected.forEach((term) => {
      if (!expandedSearchTerms.includes(term)) {
        expandedSearchTerms.push(term)
      }
      const mappedLibvirtName = reverseVmNameMap.get(term)
      if (mappedLibvirtName && !expandedSearchTerms.includes(mappedLibvirtName)) {
        expandedSearchTerms.push(mappedLibvirtName)
      }
    })

    const matchedNodes = this.searchTopologyNodes(expandedSearchTerms)
    this.syncTopologyNodeTagForNodes(matchedNodes.map(node => node.id))
    this.tc.unpinNodes()
    matchedNodes.forEach(node => {
      if (this.tc) {
        this.tc.pinNode(node, true)
      }
    })
  }

  private searchTopologyNodes(values: string[]): Node[] {
    if (!this.tc) {
      return []
    }
    const terms = values
      .filter((value) => typeof value === "string")
      .map((value) => value.trim())
      .filter((value, index, array) => !!value && array.indexOf(value) === index)
    if (terms.length === 0) {
      return []
    }

    const exactMatches: Node[] = []
    this.tc.nodes.forEach((node) => {
      const candidates = [
        node.data?.Name,
        this.config.nodeTabTitle(node),
        this.config.nodeAttrs(node).name
      ].filter((candidate) => typeof candidate === "string") as string[]

      if (candidates.some((candidate) => terms.includes(candidate.trim()))) {
        exactMatches.push(node)
      }
    })

    return exactMatches.length > 0 ? exactMatches : this.tc.searchNodes(terms)
  }

  subscriberURL(): string {
    var url = new URL(`/ws/subscriber?x-client-type=webui&x-auth-token=${this.props.session.token}`, this.props.session.endpoint)
    if (url.protocol.startsWith('https')) {
      url.protocol = 'wss:'
    } else {
      url.protocol = 'ws'
    }

    return url.toString()
  }

  openMenu(id: string, event: React.MouseEvent<HTMLElement>) {
    this.state.anchorEl.set(id, event.currentTarget)
    this.setState(this.state)
  }

  closeMenu(id) {
    this.state.anchorEl.set(id, null)
    this.setState(this.state)
  }

  logout() {
    this.props.closeSession()
    this.props.history.push("/login")
  }

  activeNodeTag(tag: string) {
    if (!this.tc) {
      return
    }

    if (tag !== this.activeNodeTagName()) {
      this.clearSelectionForLayerChange()
    }

    this.tc.activeNodeTag(tag)

    this.state.nodeTagStates = this.tc.nodeTagStates
    this.setState(this.state)
    this.pruneRecentViewedNodes()

    this.tc.zoomFit()
  }

  private activeNodeTagName(): string {
    for (const [tag, active] of this.state.nodeTagStates.entries()) {
      if (active) {
        return tag
      }
    }
    return this.config.defaultNodeTag()
  }

  private isKubernetesLayerActive(): boolean {
    return this.activeNodeTagName() === "kubernetes"
  }

  private saveRecentViewedNodes(items: RecentViewedNodeItem[]) {
    localStorage.setItem(RECENT_VIEWED_NODES_STORAGE_KEY, JSON.stringify(items.slice(0, 10)))
  }

  private sameRecentViewedNodes(a: RecentViewedNodeItem[], b: RecentViewedNodeItem[]) {
    return a.length === b.length && a.every((item, index) => item.id === b[index].id)
  }

  private recentViewedNodeExists(item: RecentViewedNodeItem) {
    if (!this.tc) {
      return false
    }
    const node = this.tc.nodes.get(item.id)
    return Boolean(node)
  }

  private pruneRecentViewedNodes() {
    if (!this.tc) {
      return
    }
    const next = this.state.recentViewedNodes
      .filter((item) => this.recentViewedNodeExists(item))
      .slice(0, 10)

    if (this.sameRecentViewedNodes(this.state.recentViewedNodes, next)) {
      return
    }

    this.saveRecentViewedNodes(next)
    this.setState({ recentViewedNodes: next })
  }

  private removeRecentViewedNode(nodeID: string) {
    const next = this.state.recentViewedNodes.filter((item) => item.id !== nodeID)
    if (next.length === this.state.recentViewedNodes.length) {
      return
    }
    this.saveRecentViewedNodes(next)
    this.setState({ recentViewedNodes: next })
  }

  private nodeDisplayName(node: Node): string {
    const attrs = this.nodeAttrs(node)
    return attrs.name || node.data?.Name || node.id
  }

  private nodePrimaryLayerTag(node: Node): RecentNodeLayerTag {
    return node.tags.includes("kubernetes") ? "kubernetes" : "infrastructure"
  }

  private recentNodeRawType(node: Node): string {
    return String(node.data?.Type || "").toLowerCase()
  }

  private recentNodeIconTone(node: Node): string {
    const type = this.recentNodeRawType(node)
    if (node.tags.includes("kubernetes")) {
      switch (type) {
        case "node":
          return "host"
        case "pod":
        case "deployment":
        case "daemonset":
        case "statefulset":
        case "replicaset":
          return "system-vm"
        case "namespace":
        case "cluster":
        case "service":
        default:
          return "network"
      }
    }
    switch (type) {
      case "host":
        return "host"
      case "libvirt":
        return "user-vm"
      case "system":
        return "system-vm"
      case "router":
      case "vrouter":
        return "router"
      default:
        return "network"
    }
  }

  private recentNodeFallbackIcon(item: RecentViewedNodeItem): { glyph: string, tone: string } {
    const type = item.rawType || ""
    if (item.layerTag === "kubernetes") {
      switch (type) {
        case "node":
          return { glyph: "\uf233", tone: "host" }
        case "namespace":
          return { glyph: "\uf07b", tone: "network" }
        case "pod":
        case "deployment":
        case "daemonset":
        case "statefulset":
        case "replicaset":
          return { glyph: "\uf1b3", tone: "system-vm" }
        case "service":
          return { glyph: "\uf0e8", tone: "network" }
        case "cluster":
        default:
          return { glyph: "\uf542", tone: "network" }
      }
    }
    switch (type) {
      case "host":
        return { glyph: "\uf233", tone: "host" }
      case "libvirt":
        return { glyph: "\uf108", tone: "user-vm" }
      case "system":
        return { glyph: "\uf085", tone: "system-vm" }
      case "router":
      case "vrouter":
        return { glyph: "\uf4d7", tone: "router" }
      case "switchport":
      case "port":
      case "patch":
        return { glyph: "\uf796", tone: "network" }
      case "bridge":
        return { glyph: "\uf542", tone: "network" }
      case "bond":
        return { glyph: "\uf0c1", tone: "network" }
      default:
        return { glyph: "\uf6ff", tone: "network" }
    }
  }

  private addRecentViewedNode(node: Node) {
    if (!this.tc || !this.tc.nodes.has(node.id)) {
      return
    }
    const item: RecentViewedNodeItem = {
      id: node.id,
      name: this.nodeDisplayName(node),
      rawType: this.recentNodeRawType(node),
      layerTag: this.nodePrimaryLayerTag(node),
      iconGlyph: this.nodeAttrs(node).icon,
      iconTone: this.recentNodeIconTone(node)
    }
    const next = [item]
      .concat(this.state.recentViewedNodes.filter((existing) => existing.id !== item.id))
      .slice(0, 10)
    this.saveRecentViewedNodes(next)
    this.setState({ recentViewedNodes: next })
  }

  private recentNodeTypeLabel(item: RecentViewedNodeItem) {
    const isKo = currentLanguage === "ko"
    const type = item.rawType || ""

    if (item.layerTag === "kubernetes") {
      switch (type) {
        case "cluster":
          return isKo ? "쿠버네티스 클러스터" : "Kubernetes Cluster"
        case "node":
          return isKo ? "쿠버네티스 노드" : "Kubernetes Node"
        case "namespace":
          return isKo ? "쿠버네티스 네임스페이스" : "Kubernetes Namespace"
        case "pod":
          return isKo ? "쿠버네티스 파드" : "Kubernetes Pod"
        case "service":
          return isKo ? "쿠버네티스 서비스" : "Kubernetes Service"
        default:
          return isKo ? "쿠버네티스 리소스" : "Kubernetes Resource"
      }
    }

    switch (type) {
      case "host":
        return isKo ? "호스트" : "Host"
      case "switch":
        return isKo ? "스위치" : "Switch"
      case "bridge":
        return isKo ? "브리지" : "Bridge"
      case "switchport":
      case "port":
      case "patch":
        return isKo ? "포트" : "Port"
      case "libvirt":
        return isKo ? "사용자 VM" : "User VM"
      case "system":
        return isKo ? "시스템 VM" : "System VM"
      case "router":
      case "vrouter":
        return isKo ? "가상 라우터" : "Virtual Router"
      case "device":
        return isKo ? "네트워크 장치" : "Network Device"
      default:
        return type || (isKo ? "노드" : "Node")
    }
  }

  private renderRecentNodeIcon(classes: any, item: RecentViewedNodeItem) {
    const fallback = this.recentNodeFallbackIcon(item)
    const glyph = item.iconGlyph || fallback.glyph
    const tone = item.iconTone || fallback.tone
    const toneClass = tone === "host"
      ? classes.recentViewedNodeIconHost
      : tone === "user-vm"
        ? classes.recentViewedNodeIconUserVM
        : tone === "system-vm"
          ? classes.recentViewedNodeIconSystemVM
          : tone === "router"
            ? classes.recentViewedNodeIconRouter
            : classes.recentViewedNodeIconNetwork
    return (
      <span className={clsx(classes.recentViewedNodeIcon, toneClass)}>
        {this.infrastructureIcon(glyph, tone)}
      </span>
    )
  }

  private focusRecentViewedNode(item: RecentViewedNodeItem) {
    const focusNode = () => {
      if (!this.tc) {
        return
      }
      const node = this.tc.nodes.get(item.id)
      if (!node || this.nodePrimaryLayerTag(node) !== item.layerTag) {
        this.removeRecentViewedNode(item.id)
        this.notify(translate("recentViewedNodeNotFound"), "info")
        return
      }
      this.tc.selectNode(item.id, true)
      this.tc.unpinNodes()
      this.tc.pinNode(node, true)
      this.openSelection()
    }

    if (item.layerTag === "kubernetes" && !this.isKubernetesLayerActive()) {
      this.activeNodeTag("kubernetes")
      window.setTimeout(focusNode, 0)
      return
    }

    if (item.layerTag === "infrastructure" && this.isKubernetesLayerActive()) {
      this.activeNodeTag(this.config.defaultNodeTag())
      window.setTimeout(focusNode, 0)
      return
    }

    focusNode()
  }

  private selectedNodeID(): string {
    const selected = this.props.selection.find((element) => element.type === "node") as Node | undefined
    return selected ? selected.id : ""
  }

  private searchPlaceholder(): string {
    return this.isKubernetesLayerActive()
      ? translate("searchKubernetesByNameExample")
      : translate("searchNodeByNameExample")
  }

  private selectTopologyLayer(tag: string) {
    this.closeMenu("layer-filter")
    this.activeNodeTag(tag)
  }

  private clearSelectionForLayerChange() {
    if (!this.tc) {
      return
    }

    this.props.selection.slice().forEach((el) => {
      if (el.type === 'node') {
        this.tc!.selectNode(el.id, false)
      } else {
        this.tc!.selectLink(el.id, false)
      }
    })
    this.tc.unpinNodes()
    this.setState({
      isSelectionOpen: false,
      isTimetravelOpen: false
    })
  }

  private syncTopologyNodeTagForNodes(nodeIDs: string[]) {
    if (!this.tc || nodeIDs.length === 0) {
      return
    }
    if (this.tc.activateNodeTagForNodes(nodeIDs)) {
      this.state.nodeTagStates = this.tc.nodeTagStates
      this.setState(this.state)
    }
  }

  onSelectionLocation(el: Node | Link) {
    if (!this.tc) {
      return
    }

    if (el.type === 'node') {
      this.tc.unpinNodes()
      this.tc.pinNode(el, true)
    } else {
      this.tc.centerLink(el)
    }
  }

  onTopologyClick() {
    this.closeSidePanels({
      isSelectionOpen: false,
      isTimetravelOpen: false
    })
  }

  onSelectionClose(el: Node | Link) {
    this.selectionClose(el)
  }

  selectionClose(el: Node | Link) {
    if (!this.tc) {
      return
    }

    if (el.type === 'node') {
      this.tc.selectNode(el.id, false)
    } else {
      this.tc.selectLink(el.id, false)
    }

    if (this.props.selection.length == 1) {
      this.state.isSelectionOpen = false
      this.setState(this.state)
    }
  }

  openSelection() {
    this.state.isSelectionOpen = true
    this.state.isTimetravelOpen = false
    this.setState(this.state)
  }

  unselectAll() {
    this.props.selection.forEach(el => {
      this.selectionClose(el)
    })
  }

  openTimetravel() {
    this.state.isTimetravelOpen = true
    this.setState(this.state)
  }

  resetTimetravel() {
    this.state.timeContext = null
    this.state.wsContext.Time = null
    this.setState(this.state)
    this.sync()
  }

  // 모든 노드를 확 펼치는 버튼에서 사용할 메서드입니다.
  // Topology 컴포넌트에 구현된 expandAllNodes()를 호출합니다.
  expandAllNodes() {
    if (!this.tc) {
      return
    }

    this.tc.expandAllNodes()
  }

  collapseAllNodes() {
    if (!this.tc) {
      return
    }
  
    this.tc.collapseAllNodes()
  }

  onTopologyZoomChange(zoom: number) {
    const normalized = Math.max(0.1, Math.min(1.5, zoom || 1))
    if (Math.abs((this.state.topologyZoom || 1) - normalized) < 0.005) {
      return
    }
    this.setState({ topologyZoom: normalized })
  }

  zoomTopology(delta: number) {
    if (!this.tc) {
      return
    }
    const current = this.tc.currentZoom ? this.tc.currentZoom() : this.state.topologyZoom
    this.tc.setZoomLevel(current + delta)
  }

  resetTopologyZoom() {
    if (!this.tc) {
      return
    }
    this.tc.resetZoom()
  }

  fitTopology() {
    if (!this.tc) {
      return
    }
    this.tc.zoomFit()
  }

  renderTopologyZoomControls(classes: any) {
    const zoom = this.state.topologyZoom || 1
    const zoomPercent = `${Math.round(zoom * 100)}%`
    const canZoomOut = zoom > 0.105
    const canZoomIn = zoom < 1.495
    return (
      <React.Fragment>
        <span className={classes.toolbarActionDivider} />
        <Tooltip title={translate("topologyZoomOut")}>
          <span>
            <IconButton
              color="inherit"
              disabled={!canZoomOut}
              onClick={() => this.zoomTopology(-0.1)}
              className={classes.topologyIconButton}
            >
              <span className={classes.topologyZoomButtonText}>-</span>
            </IconButton>
          </span>
        </Tooltip>
        <span className={classes.topologyZoomPercent}>{zoomPercent}</span>
        <Tooltip title={translate("topologyZoomIn")}>
          <span>
            <IconButton
              color="inherit"
              disabled={!canZoomIn}
              onClick={() => this.zoomTopology(0.1)}
              className={classes.topologyIconButton}
            >
              <span className={classes.topologyZoomButtonText}>+</span>
            </IconButton>
          </span>
        </Tooltip>
        <span className={classes.toolbarActionDivider} />
        <Tooltip title={translate("topologyZoomReset")}>
          <IconButton
            color="inherit"
            onClick={this.resetTopologyZoom.bind(this)}
            className={clsx(classes.topologyIconButton, classes.topologyTextIconButton)}
          >
            <span>100%</span>
          </IconButton>
        </Tooltip>
        <Tooltip title={translate("topologyZoomFit")}>
          <IconButton
            color="inherit"
            onClick={this.fitTopology.bind(this)}
            className={clsx(classes.topologyIconButton, classes.topologyTextIconButton)}
          >
            <span>{translate("topologyZoomFitShort")}</span>
          </IconButton>
        </Tooltip>
        <span className={classes.toolbarActionDivider} />
      </React.Fragment>
    )
  }

  renderSelectionMenuItem(classes: any) {
    return this.props.selection.map((el: Node | Link, i: number) => {
      var className = classes.menuItemIconFree

      if (el.type === 'node') {
        let attrs = this.config.nodeAttrs(el)
        var icon: string = attrs.icon
        var href: string = attrs.href

        if (attrs.iconClass === "font-brands") {
          className = classes.menuItemIconBrands
        }

        var title = this.config.nodeTabTitle(el)
      } else {
        let attrs = this.config.linkAttrs(el)
        var icon: string = attrs.icon
        var href: string = attrs.href

        if (attrs.iconClass === "font-brands") {
          className = classes.menuItemIconBrands
        }

        var title = this.config.linkTabTitle(el)
      }

      const iconRender = () => {
        if (href) {
          return (
            <img src={href} className={classes.menuItemIconImg} />
          )
        }
        return icon
      }

      return (
        <MenuItem key={"menu-item-" + i} >
          <span className={className}>{iconRender()}</span>
          <Typography>{title}</Typography>
        </MenuItem>
      )
    })
  }

  connection() {
    return (
      <React.Fragment>
        {
          this.props.dataURL === undefined &&
          <Websocket ref={node => this.websocket = node} url={this.subscriberURL()} onOpen={this.wsOnOpen}
            onMessage={this.wsOnMessage} onClose={this.wsOnClose}
            reconnectIntervalInMilliSeconds={2500} />
        }
      </React.Fragment>
    )
  }

  private isPacketCaptureAvailable(el: Node | Link): el is Node {
    if (el.type !== 'node') {
      return false
    }

    const node = el as Node
    const type = typeof node.data?.Type === "string" ? node.data.Type.toLowerCase() : ""
    const manager = typeof node.data?.Manager === "string" ? node.data.Manager.toLowerCase() : ""
    const tid = node.data?.TID

    if (manager === "k8s" || !tid) {
      return false
    }

    const disallowedCaptureTypes = new Set([
      "switch",
      "switchport",
      "host",
      "libvirt",
      "system",
      "tuntap",
      "ovsbridge"
    ])

    return !disallowedCaptureTypes.has(type)
  }

  private captureSessionKey(node: Node): string {
    return node.data?.TID || node.id
  }

  private setCaptureSession(node: Node, capture?: SimpleCaptureSession) {
    if (!capture) {
      return
    }

    const key = this.captureSessionKey(node)
    this.setState({
      captureSessions: {
        ...this.state.captureSessions,
        [key]: capture
      },
      isCapturePanelOpen: false
    })
    this.props.enqueueSnackbar("패킷 캡처를 시작했습니다. 오른쪽 상세 패널에서 진행 상태를 확인할 수 있습니다.", { variant: "success" })
  }

  private updateCaptureSession(node: Node, capture: SimpleCaptureSession) {
    const key = this.captureSessionKey(node)
    this.setState({
      captureSessions: {
        ...this.state.captureSessions,
        [key]: capture
      }
    })
  }

  private clearCaptureSession(node: Node) {
    const key = this.captureSessionKey(node)
    const captureSessions = { ...this.state.captureSessions }
    delete captureSessions[key]
    this.setState({ captureSessions })
  }

  actionButtons(el: Node | Link) {
    const showVMConsoleButton = this.state.isVMConsoleEnabled && el.type === 'node' && this.isVMNode(el)
    const vmNode = showVMConsoleButton ? (el as Node) : undefined
    const vmID = vmNode ? this.getMoldVMID(vmNode) : undefined
    const instanceName = vmNode ? this.getMoldInstanceName(vmNode) : undefined
    const showCaptureButton = this.isPacketCaptureAvailable(el)

    return (
      <React.Fragment>
        {showCaptureButton &&
          <CaptureButton el={el} onClick={() => {
            this.state.isCapturePanelOpen = true
            this.setState(this.state)
          }} />
        }
        {showVMConsoleButton &&
          <VMConsoleButton
            el={vmNode as Node}
            onClick={() => this.openVMConsole(el as Node)}
            disabled={this.state.isVMConsoleOpening || (!vmID && !instanceName)}
          />
        }
      </React.Fragment>
    )
  }

  private getNodeMetadataValue(node: Node, key: string): string {
    const value = node.data ? node.data[key] : undefined
    if (value === undefined || value === null) {
      return ""
    }
    return String(value).toLowerCase()
  }

  private getNodeMetadataRawValue(node: Node, key: string): string | undefined {
    const value = node.data ? node.data[key] : undefined
    if (value === undefined || value === null) {
      return undefined
    }
    return String(value)
  }

  private isUUID(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  }

  private getMoldVMID(node: Node): string | undefined {
    const candidates = [
      this.getNodeMetadataRawValue(node, "UUID"),
      this.getNodeMetadataRawValue(node, "uuid"),
      this.getNodeMetadataRawValue(node, "VmUUID"),
      this.getNodeMetadataRawValue(node, "vmUUID"),
      this.getNodeMetadataRawValue(node, "vmUuid"),
      this.getNodeMetadataRawValue(node, "virtualMachineId"),
      this.getNodeMetadataRawValue(node, "VirtualMachineId"),
      this.getNodeMetadataRawValue(node, "vmId"),
      this.getNodeMetadataRawValue(node, "VmId"),
      this.getNodeMetadataRawValue(node, "id"),
    ]

    for (const candidate of candidates) {
      if (candidate && this.isUUID(candidate)) {
        return candidate
      }
    }
    return undefined
  }

  private getMoldInstanceName(node: Node): string | undefined {
    const candidates = [
      this.getNodeMetadataRawValue(node, "instance_name"),
      this.getNodeMetadataRawValue(node, "InstanceName"),
      this.getNodeMetadataRawValue(node, "instanceName"),
      this.getNodeMetadataRawValue(node, "Name"),
      this.getNodeMetadataRawValue(node, "name"),
    ]

    for (const candidate of candidates) {
      if (candidate && /^[irsv]-\d+(?:-\d+)?-VM$/i.test(candidate)) {
        return candidate
      }
    }
    return undefined
  }

  private isVMNode(node: Node): boolean {
    const candidates = [
      this.getNodeMetadataValue(node, "Type"),
      this.getNodeMetadataValue(node, "type"),
      this.getNodeMetadataValue(node, "Manager"),
      this.getNodeMetadataValue(node, "manager"),
      this.getNodeMetadataValue(node, "HostType"),
      this.getNodeMetadataValue(node, "hostType"),
      this.getNodeMetadataValue(node, "Name"),
      this.getNodeMetadataValue(node, "name"),
      this.getNodeMetadataValue(node, "UUID"),
      this.getNodeMetadataValue(node, "uuid"),
    ]

    const vmKeywords = ["vm", "virtualmachine", "virtual-machine", "instance"]
    return candidates.some(value => vmKeywords.some(keyword => value.indexOf(keyword) >= 0))
  }

  private openVMConsole(node: Node) {
    const vmID = this.getMoldVMID(node)
    const instanceName = this.getMoldInstanceName(node)
    if (!vmID && !instanceName) {
      this.notify("VM ID를 찾을 수 없습니다.", "error")
      console.debug("VM UUID/instanceName not found from node metadata", node.data)
      return
    }

    if (this.state.isVMConsoleOpening) {
      return
    }

    this.state.isVMConsoleOpening = true
    this.setState(this.state)

    this.fetchVMConsoleURL(node, vmID, instanceName).then((result) => {
      if (!result.url) {
        this.notify("콘솔 URL을 가져오지 못했습니다.", "error")
        console.debug("No console url in response", result)
        return
      }

      window.open(result.url, "_blank", "noopener,noreferrer")
    }).catch((err: VMConsoleAPIError) => {
      this.notify(this.getVMConsoleErrorMessage(err.status), "error")
      console.debug("Failed to open VM console", err)
    }).finally(() => {
      this.state.isVMConsoleOpening = false
      this.setState(this.state)
    })
  }

  private getVMConsoleErrorMessage(status?: number): string {
    switch (status) {
      case 401:
        return "Mold API 인증에 실패했습니다."
      case 403:
        return "콘솔 접근 권한이 없습니다."
      case 404:
        return "대상 VM을 찾을 수 없습니다."
      case 503:
        return "콘솔 기능이 비활성화 상태입니다. (API Key/Secret 확인 필요)"
      case 502:
        return "Mold 콘솔 API 호출에 실패했습니다."
      default:
        return "콘솔 열기에 실패했습니다."
    }
  }

  private fetchVMConsoleURL(node: Node, vmID?: string, instanceName?: string): Promise<VMConsoleResponse> {
    const endpoint = `${this.props.session.endpoint}/api/mold/vmconsole`
    const params = new URLSearchParams()
    if (vmID) {
      params.set("vmId", vmID)
    }
    params.set("nodeId", node.id)
    if (instanceName) {
      params.set("instanceName", instanceName)
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "X-Auth-Token": this.props.session.token,
    }

    return fetch(`${endpoint}?${params.toString()}`, {
      method: "GET",
      headers: headers,
    }).then((resp) => {
      if (!resp.ok) {
        const error: VMConsoleAPIError = new Error(`vm console api failed: ${resp.status}`)
        error.status = resp.status
        throw error
      }
      return resp.json()
    })
  }

  dataPanels(el: Node | Link) {
    return (
      <React.Fragment>
        {el.type === 'node' && this.state.captureSessions[this.captureSessionKey(el as Node)] &&
          <CaptureStatusPanel
            el={el as Node}
            capture={this.state.captureSessions[this.captureSessionKey(el as Node)]}
            session={this.props.session}
            onUpdate={(capture) => this.updateCaptureSession(el as Node, capture)}
            onClear={() => this.clearCaptureSession(el as Node)}
            onRetry={() => this.setState({ isCapturePanelOpen: true })}
          />
        }
        {this.isPacketCaptureAvailable(el) &&
          <CapturePanel
            el={el}
            expanded={this.state.isCapturePanelOpen}
            config={this.config}
            onClose={() => this.setState({ isCapturePanelOpen: false })}
            onCaptureCreated={(node, capture) => this.setCaptureSession(node, capture)}
          />
        }
        {el.data!.Captures && !(el.type === 'node' && this.state.captureSessions[this.captureSessionKey(el as Node)]) &&
          <FlowPanel el={el} />
        }
      </React.Fragment>
    )
  }

  handleAddFilterOpen() {
    this.state.addFilterOpened = true
    this.state.addFilterValue.label = ""
    this.setState(this.state)
  }

  handleAddFilterClose() {
    this.state.addFilterOpened = false
    this.setState(this.state)
  }

  setAddFilterDialogLabel(label: string) {
    this.state.addFilterValue.label = label
    this.setState(this.state)
  }

  setAddFilterDialogGremlin(gremlin: string) {
    this.state.addFilterValue.gremlinFilter = gremlin
    this.setState(this.state)
  }

  updateFilterInput(value: string) {
    this.filterInput = value
  }

  handleAddFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    var filter = {
      id: this.state.addFilterValue.label,
      label: this.state.addFilterValue.label,
      category: "User defined",
      callback: () => {
        this.setGremlinFilter(this.state.addFilterValue.gremlinFilter + ".SubGraph()")
      }
    }

    this.customFilters.push(filter)
    this.updateFilters()

    this.handleAddFilterClose()
  }

  renderFilters(classes: any) {
    return (
      <Container className={classes.filtersPanel}>
        <Autocomplete
          options={this.state.filters}
          value={this.state.activeFilter}
          onChange={(event: any, newValue: any) => {
            if (typeof newValue === 'string') {
              // timeout to avoid instant validation of the dialog's form.
              setTimeout(() => {
                this.handleAddFilterOpen()
                this.setAddFilterDialogGremlin(newValue)
              })
            } else if (newValue && newValue.label && !newValue.id) {
              this.handleAddFilterOpen()
              this.setAddFilterDialogGremlin(newValue.gremlinFilter)
            } else {
              this.applyFilter(newValue)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              this.setGremlinFilter(this.filterInput)
            }
          }}
          filterOptions={(options, params) => {
            const filtered = addFilterValue(options, params) as AddFilterValue[]

            if (params.inputValue !== '') {
              filtered.push({
                label: `Add "${params.inputValue}"`,
                gremlinFilter: params.inputValue
              })
            }

            return filtered
          }}
          getOptionLabel={(filter: Filter) => filter.label}
          groupBy={(filter: Filter) => filter.category}
          style={{ width: 300 }}
          size="small"
          renderInput={(params) => <TextField {...params} label="Filter" variant="outlined" onChange={(event) => {
            let fnc = this.updateFilterInput.bind(this)
            fnc(event.target.value + ".SubGraph()")
          }} />}
        />
        <Dialog open={this.state.addFilterOpened} onClose={this.handleAddFilterClose.bind(this)} aria-labelledby="form-dialog-title">
          <form onSubmit={this.handleAddFilterSubmit.bind(this)}>
            <DialogTitle id="form-dialog-title">Add a new filter</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                id="label"
                value={this.state.addFilterValue.label}
                onChange={(event) => {
                  let fnc = this.setAddFilterDialogLabel.bind(this)
                  fnc(event.target.value)
                }}
                label="Label"
                type="text"
              />
              <TextField
                margin="dense"
                id="name"
                value={this.state.addFilterValue.gremlinFilter}
                onChange={(event) => {
                  let fnc = this.setAddFilterDialogGremlin.bind(this)
                  fnc(event.target.value)
                }}
                label="Gremlin Filter"
                type="text"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={this.handleAddFilterClose.bind(this)} color="primary">
                Cancel
            </Button>
              <Button type="submit" color="primary">
                Add
            </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Container>
    )
  }

  renderLinkTagButtons(classes: any) {
    const selectedNodeID = this.selectedNodeID()
    const isCollapsed = this.state.isRecentViewedNodesCollapsed
    return (
      <React.Fragment>
        <Container className={classes.recentViewedNodesPanel} data-netdive-recent-nodes="true">
          <Paper className={clsx(classes.recentViewedNodesPaper, isCollapsed && classes.recentViewedNodesPaperCollapsed)}>
            <div className={classes.recentViewedNodesHeader}>
              <div className={classes.recentViewedNodesHeaderTitle}>
                <AccessTimeIcon className={classes.recentViewedNodesHeaderIcon} />
                <span>{translate("recentViewedNodes")}</span>
              </div>
              <div className={classes.recentViewedNodesHeaderActions}>
                {this.state.recentViewedNodes.length > 0 &&
                  <span className={classes.recentViewedNodesCount}>{this.state.recentViewedNodes.length}</span>
                }
                <Tooltip title={isCollapsed ? translate("expand") : translate("collapse")}>
                  <IconButton
                    size="small"
                    className={classes.recentViewedNodesCollapseButton}
                    onClick={() => this.setState({ isRecentViewedNodesCollapsed: !isCollapsed })}>
                    {isCollapsed ? <KeyboardArrowDown fontSize="small" /> : <UnfoldLessIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </div>
            </div>
            {!isCollapsed &&
              <div className={classes.recentViewedNodesBody}>
                {this.state.recentViewedNodes.length === 0 &&
                  <div className={classes.recentViewedNodesEmpty}>{translate("recentViewedNodesEmpty")}</div>
                }
                {this.state.recentViewedNodes.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={clsx(classes.recentViewedNodeItem, selectedNodeID === item.id && classes.recentViewedNodeItemActive)}
                    onClick={() => this.focusRecentViewedNode(item)}>
                    {this.renderRecentNodeIcon(classes, item)}
                    <span className={classes.recentViewedNodeText}>
                      <Tooltip title={item.name}>
                        <span className={classes.recentViewedNodeName}>{item.name}</span>
                      </Tooltip>
                      <span className={classes.recentViewedNodeType}>{this.recentNodeTypeLabel(item)}</span>
                    </span>
                  </button>
                ))}
              </div>
            }
          </Paper>
        </Container>
      </React.Fragment>
    )
  }

  renderConnectionDisplayMenu(classes: any) {
    const tags = this.orderedLinkTagsForActiveLayer()
    const visibleTags = tags.filter((tag) => tag !== "ownership" && tag !== "vownership")
    if (visibleTags.length === 0) {
      return null
    }

    const activeIcon = <SettingsEthernetIcon fontSize="small" />

    return (
      <React.Fragment>
        <Tooltip title={translate("connectionDisplay")}>
          <Button
            aria-controls="connection-display-popover"
            aria-haspopup="true"
            onClick={(event: React.MouseEvent<HTMLElement>) => this.openMenu("connection-display", event)}
            className={classes.layerFilterButton}>
            <span className={classes.layerFilterButtonIcon}>{activeIcon}</span>
            <span className={classes.layerFilterButtonText}>
              <span className={classes.layerFilterButtonLabel}>{translate("connectionDisplay")}</span>
              <span className={classes.layerFilterButtonSummary}>{this.connectionDisplaySummary(visibleTags)}</span>
            </span>
            <span className={classes.layerFilterButtonChevron}><KeyboardArrowDown fontSize="small" /></span>
          </Button>
        </Tooltip>
        <Popover
          id="connection-display-popover"
          anchorEl={this.state.anchorEl.get("connection-display")}
          open={Boolean(this.state.anchorEl.get("connection-display"))}
          onClose={this.closeMenu.bind(this, "connection-display")}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          classes={{ paper: classes.connectionDisplayPopoverPaper }}>
          <div className={classes.connectionDisplayPopoverContent}>
            <div className={classes.linkTagsHeader}>
              <div className={classes.linkTagsHeaderLeft}>
                <div className={classes.linkTagsTitleRow}>
                  <Typography component="h6" className={classes.linkTagsTitle}>
                    {translate("connectionDisplay")}
                  </Typography>
                  <Tooltip title={translate("connectionDisplayInfoTooltip")}>
                    <InfoIcon className={classes.linkTagsInfoIcon} />
                  </Tooltip>
                </div>
                <Typography component="p" className={classes.connectionDisplayDescription}>
                  {this.compactLinkLayerDescription()}
                </Typography>
              </div>
            </div>
            <div className={classes.linkLayerCards}>
              {visibleTags.map((key) => {
                const meta = this.linkTagMeta(key)
                const stateInfo = this.linkTagStateInfo(this.state.linkTagStates.get(key))
                const stateClass = stateInfo.className === "visible"
                  ? classes.linkLayerCardVisible
                  : stateInfo.className === "event"
                    ? classes.linkLayerCardEvent
                    : classes.linkLayerCardHidden
                return (
                  <button
                    type="button"
                    key={key}
                    className={clsx(classes.linkLayerCard, stateClass)}
                    onClick={() => this.cycleLinkTagState(key)}
                    title={`${meta.description} ${translate("connectionDisplayCurrentState")}: ${stateInfo.label}`}>
                    <div className={classes.linkLayerCardMain}>
                      <span className={classes.linkLayerCardTop}>
                        <span className={classes.linkLayerCardKey}>{meta.key}</span>
                        {meta.badge && <span className={classes.linkLayerCardBadge}>{meta.badge}</span>}
                      </span>
                      <span className={classes.linkLayerCardName}>{meta.name}</span>
                      <span className={classes.linkLayerCardSummary}>{meta.summary}</span>
                    </div>
                    <span className={clsx(classes.linkLayerStateIcon, classes[`linkLayerStateIcon${stateInfo.className}`])}>
                      {stateInfo.icon}
                    </span>
                  </button>
                )
              })}
              {this.additionalLinkTagCount(visibleTags) > 0 &&
                <span className={classes.linkLayerMoreHint}>{translate("connectionDisplayAdditionalHintPattern").replace("{count}", String(this.additionalLinkTagCount(visibleTags)))}</span>
              }
            </div>
            <div className={classes.linkTagsStateHelp}>
              <Typography component="strong" className={classes.linkTagsStateHelpTitle}>
                {translate("connectionDisplayRangeTitle")}
              </Typography>
              <div className={classes.linkTagsStateHelpItems}>
                {[LinkTagState.EventBased, LinkTagState.Visible, LinkTagState.Hidden].map((state) => {
                  const stateInfo = this.linkTagStateInfo(state)
                  return (
                    <div key={stateInfo.className} className={classes.linkTagsStateHelpItem}>
                      <span className={clsx(classes.linkLayerStateIcon, classes[`linkLayerStateIcon${stateInfo.className}`])}>
                        {stateInfo.icon}
                      </span>
                      <span>
                        <strong>{stateInfo.label}</strong>
                        <em>{stateInfo.description}</em>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            {this.renderLinkUsageExamples(classes)}
            {this.isKubernetesLayerActive() &&
              <div className={classes.connectionDisplayNotice}>
                <InfoIcon fontSize="small" />
                <span>{translate("connectionDisplayKubernetesNotice")}</span>
              </div>
            }
          </div>
        </Popover>
      </React.Fragment>
    )
  }

  renderNodeTagButtons(classes: any) {
    return (
      <Container className={classes.nodeTagsPanel}>
        {Array.from(this.state.nodeTagStates.keys()).sort((a, b) => {
          if (a === this.config.defaultNodeTag()) {
            return -1
          } else if (b === this.config.defaultNodeTag()) {
            return 1
          }
          return 0
        }).map((tag) => (
          <Fab key={tag} variant="extended" aria-label="delete" size="small"
            color={this.state.nodeTagStates.get(tag) ? "primary" : "default"}
            className={classes.nodeTagsFab}
            onClick={this.activeNodeTag.bind(this, tag)}>
            {tag}
          </Fab>
        ))}
      </Container>
    )
  }

  renderLayerFilterMenu(classes: any) {
    const infrastructureTag = this.config.defaultNodeTag()
    const activeTag = this.activeNodeTagName()
    const activeLabel = activeTag === "kubernetes" ? "Kubernetes" : translate("infrastructureMenu")
    const activeSummary = activeLabel
    const activeIcon = activeTag === "kubernetes" ? this.kubernetesIcon() : <AccountTreeIcon fontSize="small" />
    const items = [
      {
        tag: infrastructureTag,
        label: translate("infrastructureMenu"),
        summary: translate("infrastructureLayerSummary"),
        icon: <AccountTreeIcon fontSize="small" />
      },
      {
        tag: "kubernetes",
        label: "Kubernetes",
        summary: translate("kubernetesLayerSummary"),
        icon: this.kubernetesIcon()
      }
    ]
    return (
      <React.Fragment>
        <Tooltip title={translate("layerFilter")}>
          <Button
            aria-controls="menu-layer-filter"
            aria-haspopup="true"
            onClick={(event: React.MouseEvent<HTMLElement>) => this.openMenu("layer-filter", event)}
            className={classes.layerFilterButton}>
            <span className={classes.layerFilterButtonIcon}>{activeIcon}</span>
            <span className={classes.layerFilterButtonText}>
              <span className={classes.layerFilterButtonLabel}>{translate("topologyLayer")}</span>
              <span className={classes.layerFilterButtonSummary}>{activeSummary}</span>
            </span>
            <span className={classes.layerFilterButtonChevron}><KeyboardArrowDown fontSize="small" /></span>
          </Button>
        </Tooltip>
        <Menu
          id="menu-layer-filter"
          anchorEl={this.state.anchorEl.get("layer-filter")}
          keepMounted
          open={Boolean(this.state.anchorEl.get("layer-filter"))}
          onClose={this.closeMenu.bind(this, "layer-filter")}
          classes={{ paper: classes.layerFilterMenuPaper }}>
          {items.map((item) => (
            <MenuItem
              key={item.tag}
              selected={activeTag === item.tag}
              onClick={() => this.selectTopologyLayer(item.tag)}
              className={classes.layerFilterMenuItem}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <span className={classes.layerFilterMenuText}>
                <strong>{item.label}</strong>
                <small>{item.summary}</small>
              </span>
              <span className={classes.layerFilterMenuCheck}>
                {activeTag === item.tag && <CheckIcon fontSize="small" />}
              </span>
            </MenuItem>
          ))}
        </Menu>
      </React.Fragment>
    )
  }

  renderMenuButtons(classes: any) {
    return (
      <div>
        {this.state.timeContext &&
          <Chip
            icon={<RestoreIcon />}
            label={this.state.timeContext.toString().split(" (")[0]}
            color="primary"
            onClick={() => this.openTimetravel()}
            onDelete={() => this.resetTimetravel()}
          />
        }
        {!this.state.timeContext &&
          <IconButton
            aria-controls="menu-time"
            aria-haspopup="true"
            onClick={() => this.openTimetravel()}
            color="inherit">
            <Badge color="secondary">
              <RestoreIcon />
            </Badge>
          </IconButton>
        }
        <IconButton
          aria-controls="menu-selection"
          aria-haspopup="true"
          onClick={(event: React.MouseEvent<HTMLElement>) => this.props.selection.length > 0 && this.openMenu("selection", event)}
          color="inherit">
          <Badge badgeContent={this.props.selection.length} color="secondary">
            <ListIcon />
          </Badge>
        </IconButton>
        <Menu
          id="menu-selection"
          anchorEl={this.state.anchorEl.get("selection")}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          keepMounted
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          open={Boolean(this.state.anchorEl.get("selection"))}
          onClose={this.closeMenu.bind(this, "selection")}>
          <MenuItem onClick={() => { this.closeMenu("selection"); this.openSelection() }}>
            <ListItemIcon>
              <KeyboardArrowDown fontSize="small" />
            </ListItemIcon>
            <Typography>Show selection</Typography>
          </MenuItem>
          <Divider />
          {this.renderSelectionMenuItem(classes)}
          <Divider />
          <MenuItem onClick={() => { this.closeMenu("selection"); this.unselectAll() }}>
            <ListItemIcon>
              <RemoveShoppingCartIcon fontSize="small" />
            </ListItemIcon>
            <Typography>Unselect all</Typography>
          </MenuItem>
        </Menu>
        {/* <IconButton
          aria-label="account of current user"
          aria-controls="menu-profile"
          aria-haspopup="true"
          onClick={this.openMenu.bind(this, "profile")}
          color="inherit">
          <AccountCircle />
        </IconButton> */}
        <Menu
          id="menu-profile"
          anchorEl={this.state.anchorEl.get("profile")}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          keepMounted
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          open={Boolean(this.state.anchorEl.get("profile"))}
          onClose={this.closeMenu.bind(this, "profile")}>
          <MenuItem onClick={this.logout.bind(this)}>Logout</MenuItem>
        </Menu>
      </div>
    )
  }

  closeAboutDialog() {
    this.setState({ isAboutOpen: false })
  }

  openAboutDialog() {
    this.setState({
      isInfrastructurePanelOpen: false,
      isKubernetesManagerOpen: false,
      isScreenConfigOpen: false,
      isPreferencesPanelOpen: false,
      isHelpOpen: false,
      isAboutOpen: true
    })
  }

  closeHelpDialog() {
    this.setState({ isHelpOpen: false })
  }

  openHelpDialog() {
    this.setState({
      isInfrastructurePanelOpen: false,
      isKubernetesManagerOpen: false,
      isScreenConfigOpen: false,
      isPreferencesPanelOpen: false,
      isAboutOpen: false,
      isHelpOpen: true
    })
  }

  private setNetdiveTheme(theme: NetdiveTheme) {
    this.state.netdiveTheme = theme
    localStorage.setItem("netdive-theme", theme)
    this.setState(this.state)
  }

  private onThemeToggleChange(event: React.MouseEvent<HTMLElement>, newTheme: NetdiveTheme | null) {
    if (!newTheme) {
      return
    }
    this.setNetdiveTheme(newTheme)
  }

  private renderDrawerMenuItem(classes: any, icon: React.ReactNode, label: string, onClick?: () => void, active?: boolean) {
    return (
      <button
        type="button"
        className={clsx(classes.drawerMenuItem, active && classes.drawerMenuItemActive)}
        onClick={onClick}>
        <span className={classes.drawerMenuIcon}>{icon}</span>
        <span className={classes.drawerMenuLabel}>{label}</span>
      </button>
    )
  }

  private renderDrawerIntegrationItem(classes: any, icon: React.ReactNode, label: string, summary: string, onClick?: () => void, active?: boolean) {
    return (
      <button
        type="button"
        className={clsx(classes.drawerIntegrationItem, active && classes.drawerMenuItemActive)}
        onClick={onClick}>
        <span className={classes.drawerMenuIcon}>{icon}</span>
        <span className={classes.drawerIntegrationMain}>
          <span className={classes.drawerMenuLabel}>{label}</span>
          {summary && <span className={classes.drawerIntegrationSummary}>{summary}</span>}
        </span>
      </button>
    )
  }

  private openKubernetesManager() {
    this.setState({
      isInfrastructurePanelOpen: false,
      isKubernetesManagerOpen: true,
      isScreenConfigOpen: false,
      isPreferencesPanelOpen: false,
      isHelpOpen: false,
      isAboutOpen: false
    }, () => {
      if (this.state.kubernetesClusters.length === 0) {
        this.refreshKubernetesClusters()
      }
    })
  }

  private openInfrastructureTopology() {
    this.setState({
      isInfrastructurePanelOpen: true,
      isKubernetesManagerOpen: false,
      isScreenConfigOpen: false,
      isPreferencesPanelOpen: false,
      isHelpOpen: false,
      isAboutOpen: false
    })
  }

  private infrastructureSummary(): InfrastructureSummary {
    const summary: InfrastructureSummary = {
      hosts: 0,
      userVMs: 0,
      systemVMs: 0,
      routers: 0,
      networkObjects: 0,
      links: 0,
      totalNodes: 0,
      hostNodeIDs: [],
      userVMNodeIDs: [],
      systemVMNodeIDs: [],
      routerNodeIDs: [],
      networkObjectNodeIDs: [],
      infrastructureNodeIDs: [],
      hostsById: {}
    }

    if (!this.tc) {
      return summary
    }

    this.tc.nodes.forEach((node) => {
      if (!node || node === this.tc?.root || node.data?.Manager === "k8s") {
        return
      }
      const type = typeof node.data?.Type === "string" ? node.data.Type.toLowerCase() : ""
      const name = typeof node.data?.Name === "string" ? node.data.Name : ""
      summary.totalNodes += 1
      summary.infrastructureNodeIDs.push(node.id)

      if (type === "host") {
        summary.hosts += 1
        summary.hostNodeIDs.push(node.id)
        summary.hostsById[node.id] = {
          id: node.id,
          name: name || node.id,
          userVMs: 0,
          systemVMs: 0,
          routers: 0,
          networkObjects: 0,
          userVMNodeIDs: [],
          systemVMNodeIDs: [],
          routerNodeIDs: [],
          networkObjectNodeIDs: []
        }
      }

      if (type === "libvirt") {
        if (/^r-/.test(name)) {
          summary.routers += 1
          summary.routerNodeIDs.push(node.id)
        } else if (/^(s-|v-)/.test(name) || name === "ccvm" || name === "scvm") {
          summary.systemVMs += 1
          summary.systemVMNodeIDs.push(node.id)
        } else {
          summary.userVMs += 1
          summary.userVMNodeIDs.push(node.id)
        }
      }

      if ([
        "device",
        "bond",
        "bridge",
        "vlan",
        "switch",
        "switchport",
        "patch",
        "port",
        "ovsbridge",
        "openvswitch",
        "ovsport",
        "tun",
        "tap",
        "tuntap",
        "internal",
        "interface",
        "veth",
        "vxlan",
        "geneve",
        "gre",
        "gretap"
      ].indexOf(type) >= 0) {
        summary.networkObjects += 1
        summary.networkObjectNodeIDs.push(node.id)
      }
    })

    this.tc.nodes.forEach((node) => {
      if (!node || node === this.tc?.root || node.data?.Manager === "k8s" || node.data?.Type === "host") {
        return
      }
      const host = this.findInfrastructureHostSummary(summary, node)
      if (host) {
        this.addInfrastructureHostChildSummary(host, node)
      }
    })

    this.tc.links.forEach((link) => {
      const relationType = link.data?.RelationType
      if (relationType !== "ownership" && relationType !== "vownership") {
        summary.links += 1
      }
    })

    return summary
  }

  private findInfrastructureHostSummary(summary: InfrastructureSummary, node: Node): InfrastructureHostSummary | undefined {
    let parent = node.parent
    while (parent) {
      const host = summary.hostsById[parent.id]
      if (host) {
        return host
      }
      parent = parent.parent
    }
    return undefined
  }

  private addHostNodeID(ids: string[], nodeID: string): boolean {
    if (ids.indexOf(nodeID) >= 0) {
      return false
    }
    ids.push(nodeID)
    return true
  }

  private addInfrastructureHostChildSummary(host: InfrastructureHostSummary, node: Node) {
    if (!node || node.data?.Manager === "k8s") {
      return
    }
    const type = typeof node.data?.Type === "string" ? node.data.Type.toLowerCase() : ""
    const name = typeof node.data?.Name === "string" ? node.data.Name : ""
    if (type === "libvirt") {
      if (/^r-/.test(name)) {
        if (this.addHostNodeID(host.routerNodeIDs, node.id)) {
          host.routers += 1
        }
      } else if (/^(s-|v-)/.test(name) || name === "ccvm" || name === "scvm") {
        if (this.addHostNodeID(host.systemVMNodeIDs, node.id)) {
          host.systemVMs += 1
        }
      } else {
        if (this.addHostNodeID(host.userVMNodeIDs, node.id)) {
          host.userVMs += 1
        }
      }
      return
    }
    if ([
      "device",
      "bond",
      "bridge",
      "vlan",
      "switch",
      "switchport",
      "patch",
      "port",
      "ovsbridge",
      "openvswitch",
      "ovsport",
      "tun",
      "tap",
      "tuntap",
      "internal",
      "interface",
      "veth",
      "vxlan",
      "geneve",
      "gre",
      "gretap"
    ].indexOf(type) >= 0) {
      if (this.addHostNodeID(host.networkObjectNodeIDs, node.id)) {
        host.networkObjects += 1
      }
    }
  }

  private infrastructureFocusNodeIDs(summary: InfrastructureSummary, key: InfrastructureFocusKey): string[] {
    switch (key) {
      case "networkObjects":
        return summary.networkObjectNodeIDs
      case "routers":
        return summary.routerNodeIDs
      case "userVMs":
        return summary.userVMNodeIDs
      case "systemVMs":
        return summary.systemVMNodeIDs
      case "totalNodes":
        return summary.infrastructureNodeIDs
      default:
        return []
    }
  }

  private focusInfrastructureOverview(key: InfrastructureFocusKey | "", summary: InfrastructureSummary) {
    if (!this.tc) {
      return
    }
    if (!key) {
      this.tc.clearInfrastructureFocus()
      this.tc.unpinNodes()
      this.tc.activeNodeTag(this.config.defaultNodeTag())
      this.tc.zoomFit()
      this.setState({ infrastructureFocus: "", nodeTagStates: this.tc.nodeTagStates })
      return
    }
    const nodeIDs = this.infrastructureFocusNodeIDs(summary, key)
    this.syncTopologyNodeTagForNodes(nodeIDs)
    this.tc.focusInfrastructureNodes(nodeIDs)
    this.setState({ infrastructureFocus: key })
  }

  private focusInfrastructureNodeIDs(nodeIDs: string[]) {
    if (!this.tc) {
      return
    }
    this.syncTopologyNodeTagForNodes(nodeIDs)
    this.tc.focusInfrastructureNodes(nodeIDs)
  }

  private selectInfrastructureNodeID(nodeID: string) {
    if (!this.tc || !nodeID) {
      return
    }
    this.syncTopologyNodeTagForNodes([nodeID])
    this.tc.focusInfrastructureNodes([nodeID])
    this.tc.selectNode(nodeID, true)
  }

  private infrastructureIcon(glyph: string, tone: string, badge?: string) {
    const colors: Record<string, string> = {
      host: "#3b82f6",
      "user-vm": "#41a878",
      "system-vm": "#6d4bd8",
      network: "#3f7ee8",
      router: "#7c4bd3"
    }
    return (
      <span className={clsx("fa", "fas", "fa-fw")} style={{ color: colors[tone] || "#3f7ee8" }}>
        {glyph}
        {badge && <i>{badge}</i>}
      </span>
    )
  }

  private kubernetesIcon(className?: string) {
    return (
      <span className={className} aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false" style={{ width: "1em", height: "1em", display: "block" }}>
          <path
            fill="currentColor"
            d="M12 2.25 4.13 5.72 2.18 14.1 7.62 20.9h8.76l5.44-6.8-1.95-8.38L12 2.25Zm0 2.18 5.92 2.61 1.47 6.31-4.1 5.12H8.71l-4.1-5.12 1.47-6.31L12 4.43Z" />
          <path
            fill="currentColor"
            d="M12 7.15a4.85 4.85 0 1 0 0 9.7 4.85 4.85 0 0 0 0-9.7Zm0 2.05a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z" />
          <path
            fill="currentColor"
            d="M11.1 3.5h1.8v4.9h-1.8V3.5Zm0 12.1h1.8v4.9h-1.8v-4.9ZM3.97 8.1l.9-1.56 4.24 2.45-.9 1.56L3.97 8.1Zm10.92 6.3.9-1.56 4.24 2.45-.9 1.56-4.24-2.45Zm5.14-6.3-4.24 2.45-.9-1.56 4.24-2.45.9 1.56ZM9.11 14.4l-4.24 2.45-.9-1.56 4.24-2.45.9 1.56Z" />
        </svg>
      </span>
    )
  }

  private topologyImageIcon(src: string, alt: string) {
    return <img src={src} alt={alt} />
  }

  private renderInfrastructureSummaryCard(classes: any, icon: React.ReactNode, label: string, value: number) {
    return (
      <div className={classes.infrastructureSummaryCard}>
        <span className={classes.infrastructureCardIcon}>{icon}</span>
        <span>
          <small>{label}</small>
          <strong>{value}</strong>
        </span>
      </div>
    )
  }

  private renderKubernetesTopologySummaryCard(classes: any, icon: React.ReactNode, label: string, value: number, nodeIDs: string[]) {
    return (
      <button
        type="button"
        className={clsx(classes.infrastructureSummaryCard, classes.kubernetesTopologySummaryCard)}
        onClick={() => this.focusInfrastructureNodeIDs(nodeIDs)}
        disabled={nodeIDs.length === 0}>
        <span className={classes.infrastructureCardIcon}>{icon}</span>
        <span>
          <small>{label}</small>
          <strong>{value}</strong>
        </span>
      </button>
    )
  }

  private renderInfrastructureOverviewCard(classes: any, key: InfrastructureFocusKey | "", icon: React.ReactNode, label: string, description: string, count: number | string, summary: InfrastructureSummary) {
    const selected = key !== "" && this.state.infrastructureFocus === key
    return (
      <button
        type="button"
        className={clsx(classes.infrastructureOverviewCard, selected && classes.infrastructureOverviewCardActive)}
        onClick={() => this.focusInfrastructureOverview(key, summary)}>
        <span className={classes.infrastructureOverviewCardMain}>
          <span className={classes.infrastructureCardIcon}>{icon}</span>
          <span>
            <strong>{label}</strong>
            <small>{description}</small>
          </span>
        </span>
        <em>
          <strong className={typeof count === "string" ? classes.infrastructureOverviewCardValueText : undefined}>{count}</strong>
          <ChevronRightIcon fontSize="small" />
        </em>
      </button>
    )
  }

  private renderInfrastructureHostOverviewCard(classes: any, icon: React.ReactNode, label: string, description: string, count: number, nodeIDs: string[]) {
    return (
      <button
        type="button"
        className={clsx(classes.infrastructureOverviewCard, classes.infrastructureHostOverviewCardCompact)}
        onClick={() => this.focusInfrastructureNodeIDs(nodeIDs)}
        disabled={nodeIDs.length === 0}>
        <span className={classes.infrastructureOverviewCardMain}>
          <span className={classes.infrastructureCardIcon}>{icon}</span>
          <span>
            <strong>{label}</strong>
            <small>{description}</small>
          </span>
        </span>
        <em>
          <strong>{count}</strong>
          <ChevronRightIcon fontSize="small" />
        </em>
      </button>
    )
  }

  private renderInfrastructureHostSummary(classes: any, host: InfrastructureHostSummary) {
    return (
      <div className={classes.infrastructureHostCard} key={host.id}>
        <div className={classes.infrastructureHostName}>{host.name}</div>
        <div className={classes.infrastructureHostOverviewGrid}>
          {this.renderInfrastructureHostOverviewCard(classes, this.infrastructureIcon("\uf108", "user-vm"), translate("infrastructureUserVMs"), translate("infrastructureUserVMsDescription"), host.userVMs, host.userVMNodeIDs)}
          {this.renderInfrastructureHostOverviewCard(classes, this.infrastructureIcon("\uf085", "system-vm"), translate("infrastructureSystemVMs"), translate("infrastructureSystemVMsDescription"), host.systemVMs, host.systemVMNodeIDs)}
          {this.renderInfrastructureHostOverviewCard(classes, this.infrastructureIcon("\uf4d7", "router"), translate("infrastructureRouters"), translate("infrastructureRoutersDescription"), host.routers, host.routerNodeIDs)}
          {this.renderInfrastructureHostOverviewCard(classes, this.infrastructureIcon("\uf6ff", "network"), translate("infrastructureNetworkObjects"), translate("infrastructureNetworkObjectsDescription"), host.networkObjects, host.networkObjectNodeIDs)}
        </div>
      </div>
    )
  }

  private openScreenConfigPanel() {
    this.setState({
      isInfrastructurePanelOpen: false,
      isKubernetesManagerOpen: false,
      isScreenConfigOpen: true,
      isPreferencesPanelOpen: false,
      isHelpOpen: false,
      isAboutOpen: false
    })
  }

  private openPreferencesPanel() {
    this.setState({
      isInfrastructurePanelOpen: false,
      isKubernetesManagerOpen: false,
      isScreenConfigOpen: false,
      isPreferencesPanelOpen: true,
      isHelpOpen: false,
      isAboutOpen: false
    })
  }

  private renderInfrastructurePanel(classes: any) {
    if (!this.state.isInfrastructurePanelOpen) {
      return null
    }
    const summary = this.infrastructureSummary()
    const hostSummaries = Object.values(summary.hostsById)
    return (
      <Paper className={classes.kubernetesManagerPanel} data-netdive-side-panel="true">
        <div className={classes.kubernetesManagerHeader}>
          <div>
            <div className={classes.kubernetesManagerTitle}>{translate("infrastructurePanelTitle")}</div>
            <div className={classes.kubernetesManagerDescription}>{translate("infrastructurePanelDescription")}</div>
          </div>
          <IconButton size="small" onClick={() => this.setState({ isInfrastructurePanelOpen: false })}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <div className={classes.kubernetesSummaryGrid}>
          {this.renderInfrastructureSummaryCard(classes, this.infrastructureIcon("\uf233", "host"), translate("infrastructureHosts"), summary.hosts)}
          {this.renderInfrastructureSummaryCard(classes, this.infrastructureIcon("\uf108", "user-vm"), translate("infrastructureUserVMs"), summary.userVMs)}
          {this.renderInfrastructureSummaryCard(classes, this.infrastructureIcon("\uf085", "system-vm"), translate("infrastructureSystemVMs"), summary.systemVMs)}
          {this.renderInfrastructureSummaryCard(classes, this.infrastructureIcon("\uf0e8", "network"), translate("infrastructureNetworkLinks"), summary.links)}
        </div>
        <div className={classes.kubernetesTableHeader}>
          <div>
            <div className={classes.kubernetesSectionTitle}>{translate("infrastructureOverview")}</div>
            <div className={classes.kubernetesSectionHint}>{translate("infrastructureOverviewDescription")}</div>
          </div>
          <ToggleButtonGroup
            value={this.state.infrastructureViewMode}
            exclusive
            onChange={(event: React.MouseEvent<HTMLElement>, mode: InfrastructureViewMode | null) => mode && this.setState({ infrastructureViewMode: mode })}
            className={classes.infrastructureViewToggle}
            aria-label="Infrastructure view mode">
            <ToggleButton value="all" aria-label="All">{translate("infrastructureViewAll")}</ToggleButton>
            <ToggleButton value="hosts" aria-label="By host">{translate("infrastructureViewHosts")}</ToggleButton>
          </ToggleButtonGroup>
        </div>
        {this.state.infrastructureViewMode === "all" &&
          <div className={classes.infrastructureOverviewGrid}>
            {this.renderInfrastructureOverviewCard(classes, "networkObjects", this.infrastructureIcon("\uf6ff", "network"), translate("infrastructureNetworkObjects"), translate("infrastructureNetworkObjectsDescription"), summary.networkObjects, summary)}
            {this.renderInfrastructureOverviewCard(classes, "routers", this.infrastructureIcon("\uf4d7", "router"), translate("infrastructureRouters"), translate("infrastructureRoutersDescription"), summary.routers, summary)}
            {this.renderInfrastructureOverviewCard(classes, "userVMs", this.infrastructureIcon("\uf108", "user-vm"), translate("infrastructureUserVMs"), translate("infrastructureUserVMsDescription"), summary.userVMs, summary)}
            {this.renderInfrastructureOverviewCard(classes, "systemVMs", this.infrastructureIcon("\uf085", "system-vm"), translate("infrastructureSystemVMs"), translate("infrastructureSystemVMsDescription"), summary.systemVMs, summary)}
            {this.renderInfrastructureOverviewCard(classes, "totalNodes", this.infrastructureIcon("\uf233", "host"), translate("infrastructureTotalNodes"), translate("infrastructureTotalNodesDescription"), summary.totalNodes, summary)}
            {this.renderInfrastructureOverviewCard(classes, "", this.infrastructureIcon("\uf0ac", "network"), translate("infrastructureShowAll"), translate("infrastructureShowAllDescription"), translate("all"), summary)}
          </div>
        }
        {this.state.infrastructureViewMode === "hosts" &&
          <div className={classes.infrastructureHostList}>
            {hostSummaries.length === 0 && <div className={classes.kubernetesEmptyRow}>{translate("infrastructureNoHosts")}</div>}
            {hostSummaries.map((host) => this.renderInfrastructureHostSummary(classes, host))}
          </div>
        }
      </Paper>
    )
  }

  private renderScreenConfigPanel(classes: any) {
    if (!this.state.isScreenConfigOpen) {
      return null
    }
    const options = [
      "showInfrastructureLayer",
      "showKubernetesLayer",
      "showNetworkLinkLayer",
      "showTrafficLabels",
      "nodeLabelDisplayMode",
      "showGroupNodes"
    ]
    return (
      <Paper className={classes.sideSettingsPanel} data-netdive-side-panel="true">
        <div className={classes.sideSettingsHeader}>
          <div>
            <div className={classes.sideSettingsTitle}>{translate("screenConfig")}</div>
            <div className={classes.sideSettingsDescription}>{translate("screenConfigDescription")}</div>
          </div>
          <IconButton size="small" onClick={() => this.setState({ isScreenConfigOpen: false })}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <div className={classes.sideSettingsList}>
          {options.map((key) => (
            <div className={classes.sideSettingsRow} key={key}>
              <span>{translate(key)}</span>
              <small>{translate("screenConfigComingSoon")}</small>
            </div>
          ))}
        </div>
      </Paper>
    )
  }

  private renderPreferencesPanel(classes: any) {
    if (!this.state.isPreferencesPanelOpen) {
      return null
    }
    return (
      <Paper className={classes.sideSettingsPanel} data-netdive-side-panel="true">
        <div className={classes.sideSettingsHeader}>
          <div>
            <div className={classes.sideSettingsTitle}>{translate("preferences")}</div>
            <div className={classes.sideSettingsDescription}>{translate("preferencesDescription")}</div>
          </div>
          <IconButton size="small" onClick={() => this.setState({ isPreferencesPanelOpen: false })}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <div className={classes.sideSettingsList}>
          <div className={classes.sideSettingsControlBlock}>
            <div className={classes.sideSettingsControlTitle}>{translate("language")}</div>
            <LanguageToggle />
          </div>
          <div className={classes.sideSettingsControlBlock}>
            <div className={classes.sideSettingsControlTitle}>{translate("themeSetting")}</div>
            <ToggleButtonGroup
              value={this.state.netdiveTheme}
              exclusive
              onChange={this.onThemeToggleChange.bind(this)}
              aria-label="Theme selection">
              <ToggleButton value="light" aria-label="Light">Light</ToggleButton>
              <ToggleButton value="dark" aria-label="Dark">Dark</ToggleButton>
            </ToggleButtonGroup>
          </div>
        </div>
      </Paper>
    )
  }

  private renderHelpPanel(classes: any) {
    if (!this.state.isHelpOpen) {
      return null
    }
    const helpSections: Array<HelpSection> = ["menu", "toolbar", "topology"]
    const activeSection = this.state.helpActiveSection
    return (
      <Paper className={classes.sideSettingsPanel} data-netdive-side-panel="true">
        <div className={classes.sideSettingsHeader}>
          <div>
            <div className={classes.sideSettingsTitle}>{translate("help")}</div>
            <div className={classes.sideSettingsDescription}>{translate("helpPanelDescription")}</div>
          </div>
          <IconButton size="small" onClick={() => this.setState({ isHelpOpen: false })}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <div className={classes.sideSettingsList}>
          <div className={classes.helpPageTabs}>
            {helpSections.map((section) => (
              <button
                key={section}
                type="button"
                className={clsx(classes.helpPageTab, activeSection === section && classes.helpPageTabActive)}
                onClick={() => this.setState({ helpActiveSection: section })}>
                {translate(`helpSection-${section}`)}
              </button>
            ))}
          </div>
          {activeSection === "menu" &&
            <div className={classes.helpGuideCard}>
              <div className={classes.helpGuideTitle}>{translate("helpMenuTitle")}</div>
              <div className={classes.sideSettingsText}>{translate("helpMenuDescription")}</div>
              <div className={classes.helpGuideList}>
                <span>{translate("helpMenuPointCollection")}</span>
                <span>{translate("helpMenuPointKubernetes")}</span>
                <span>{translate("helpMenuPointView")}</span>
                <span>{translate("helpMenuPointPreferences")}</span>
                <span>{translate("helpMenuPointHelp")}</span>
              </div>
            </div>
          }
          {activeSection === "toolbar" &&
            <div className={classes.helpGuideCard}>
              <div className={classes.helpGuideTitle}>{translate("helpToolbarTitle")}</div>
              <div className={classes.sideSettingsText}>{translate("helpToolbarDescription")}</div>
              <div className={classes.helpGuideList}>
                <span>{translate("helpToolbarPointLogo")}</span>
                <span>{translate("helpToolbarPointSearch")}</span>
                <span>{translate("helpToolbarPointExpand")}</span>
                <span>{translate("helpToolbarPointStatus")}</span>
                <span>{translate("helpToolbarPointDrawer")}</span>
              </div>
            </div>
          }
          {activeSection === "topology" &&
            <React.Fragment>
              <div className={classes.helpGuideCard}>
                <div className={classes.helpGuideTitle}>{translate("helpTopologyTitle")}</div>
                <div className={classes.sideSettingsText}>{translate("helpTopologyDescription")}</div>
                <div className={classes.helpGuideList}>
                  <span>{translate("helpTopologyPointLayers")}</span>
                  <span>{translate("helpTopologyPointNode")}</span>
                  <span>{translate("helpTopologyPointLink")}</span>
                  <span>{translate("helpTopologyPointDetail")}</span>
                </div>
              </div>
              <div className={classes.helpGuideCard}>
                <div className={classes.helpGuideTitle}>{translate("helpKubernetesTitle")}</div>
                <div className={classes.sideSettingsText}>{translate("helpKubernetesDescription")}</div>
                <div className={classes.helpGuideList}>
                  <span>{translate("helpKubernetesPointCollection")}</span>
                  <span>{translate("helpKubernetesPointTopology")}</span>
                  <span>{translate("helpKubernetesPointPolicy")}</span>
                </div>
              </div>
            </React.Fragment>
          }
          <div className={classes.helpDocsCard}>
            <div>
              <div className={classes.helpGuideTitle}>{translate("helpDocsTitle")}</div>
              <div className={classes.sideSettingsText}>{translate("helpDocsDescription")}</div>
            </div>
            <a className={classes.helpDocsLink} href="https://docs.ablecloud.io/latest/administration/wall/netdive-guide/" target="_blank" rel="noopener noreferrer">ABLESTACK Online Docs</a>
          </div>
        </div>
      </Paper>
    )
  }

  private renderAboutPanel(classes: any) {
    if (!this.state.isAboutOpen) {
      return null
    }
    return (
      <Paper className={classes.sideSettingsPanel} data-netdive-side-panel="true">
        <div className={classes.sideSettingsHeader}>
          <div>
            <div className={classes.sideSettingsTitle}>ABLESTACK NETDIVE</div>
            <div className={classes.sideSettingsDescription}>{translate("aboutPanelDescription")}</div>
          </div>
          <IconButton size="small" onClick={() => this.setState({ isAboutOpen: false })}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <div className={classes.sideSettingsList}>
          <div className={classes.aboutProductCard}>
            <div className={classes.aboutInfoRow}>
              <span>{translate("version")}</span>
              <strong>4.2.2</strong>
            </div>
            <div className={classes.aboutInfoRow}>
              <span>{translate("productFamily")}</span>
              <strong>ABLESTACK</strong>
            </div>
            <div className={classes.aboutInfoRow}>
              <span>{translate("vendor")}</span>
              <strong>ABLECLOUD.Co.Ltd</strong>
            </div>
            <div className={classes.aboutCopyright}>Copyright © 2025 ABLECLOUD.Co.Ltd</div>
            <div className={classes.aboutActions}>
              <Button
                variant="outlined"
                size="small"
                href="https://docs.ablecloud.io/latest/administration/wall/netdive-guide/"
                target="_blank"
                rel="noopener noreferrer">
                {translate("documentation")}
              </Button>
            </div>
          </div>
        </div>
      </Paper>
    )
  }

  private renderKubernetesManagerPanel(classes: any) {
    if (!this.state.isKubernetesManagerOpen) {
      return null
    }
    const summary = this.kubernetesTopologySummary()
    return (
      <Paper className={classes.kubernetesManagerPanel} data-netdive-side-panel="true">
        <div className={classes.kubernetesManagerHeader}>
          <div>
            <div className={classes.kubernetesManagerTitle}>{translate("kubernetesManagerTitle")}</div>
            <div className={classes.kubernetesManagerDescription}>{translate("kubernetesManagerDescription")}</div>
          </div>
          <IconButton size="small" onClick={() => this.setState({ isKubernetesManagerOpen: false })}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <div className={clsx(classes.kubernetesSummaryGrid, classes.kubernetesTopologySummaryGrid)}>
          {this.renderKubernetesTopologySummaryCard(classes, this.infrastructureIcon("\uf542", "network"), translate("kubernetesTopologyClusters"), summary.clusters, summary.clusterNodeIDs)}
          {this.renderKubernetesTopologySummaryCard(classes, this.infrastructureIcon("\uf233", "host"), translate("kubernetesTopologyNodes"), summary.nodes, summary.nodeNodeIDs)}
          {this.renderKubernetesTopologySummaryCard(classes, this.infrastructureIcon("\uf07b", "network"), translate("kubernetesTopologyNamespaces"), summary.namespaces, summary.namespaceNodeIDs)}
          {this.renderKubernetesTopologySummaryCard(classes, this.infrastructureIcon("\uf1b3", "network"), translate("kubernetesTopologyPods"), summary.pods, summary.podNodeIDs)}
          {this.renderKubernetesTopologySummaryCard(classes, this.infrastructureIcon("\uf0e8", "network"), translate("kubernetesTopologyServices"), summary.services, summary.serviceNodeIDs)}
        </div>
        <div className={classes.kubernetesTableHeader}>
          <div className={classes.kubernetesSectionTitleArea}>
            <div className={classes.kubernetesSectionTitleRow}>
              <div className={classes.kubernetesSectionTitle}>{translate("kubernetesCollectionManagementSection")}</div>
              <Button
                size="small"
                className={classes.kubernetesPolicyButton}
                startIcon={<InfoIcon fontSize="small" />}
                onClick={() => this.setState({ kubernetesPolicyDialogOpen: true })}>
                {translate("kubernetesCollectionPolicy")}
              </Button>
            </div>
            <div className={classes.kubernetesSectionHint}>{this.state.kubernetesMessage || translate("kubernetesClusterListDescription")}</div>
          </div>
          <div className={classes.kubernetesTableActions}>
            <Button
              size="small"
              className={classes.kubernetesRefreshButton}
              startIcon={<RefreshIcon fontSize="small" />}
              onClick={this.refreshKubernetesClusters.bind(this)}>
              {translate("refresh")}
            </Button>
            <Button
              size="small"
              className={classes.kubernetesTestAllButton}
              startIcon={this.kubernetesIcon()}
              onClick={this.testAllKubernetesConnections.bind(this)}
              disabled={this.state.kubernetesTestLoading || this.state.kubernetesTestAllLoading || this.state.kubernetesClusters.length === 0}>
              {this.state.kubernetesTestAllLoading ? translate("kubernetesTestAllRunning") : translate("kubernetesTestAll")}
            </Button>
          </div>
        </div>
        <div className={classes.kubernetesTableWrap}>
          <div className={classes.kubernetesTable}>
            <div className={classes.kubernetesTableHead}>
              <span>{translate("kubernetesClusterName")}</span>
              <span>{translate("kubernetesMoldClusterId")}</span>
              <span>{translate("moldStatus")}</span>
              <span>{translate("kubernetesApiServer")}</span>
              <span>{translate("netdiveCollection")}</span>
              <span>{translate("kubernetesLastConnectionTest")}</span>
              <span>{translate("kubernetesLastCollectionStatus")}</span>
              <span>{translate("kubernetesActions")}</span>
            </div>
            {this.state.kubernetesClusters.length === 0 &&
              <div className={classes.kubernetesEmptyRow}>{this.state.kubernetesLoading ? translate("loading") : translate("kubernetesNoClusters")}</div>
            }
            {this.state.kubernetesClusters.map((cluster) => {
              const last = this.state.kubernetesLastTests[cluster.id]
              const collectionEnabled = this.isKubernetesCollectionEnabled(cluster)
              return (
                <div className={classes.kubernetesTableRow} key={cluster.id}>
                  <Tooltip title={cluster.name || cluster.id}>
                    <span className={classes.kubernetesNameCell}>{cluster.name || cluster.id}</span>
                  </Tooltip>
                  <Tooltip title={cluster.id || "-"}>
                    <span className={classes.kubernetesMutedCell}>{this.compactIdentifier(cluster.id)}</span>
                  </Tooltip>
                  <span><span className={classes.kubernetesPill}>{this.localizeMoldState(cluster.state)}</span></span>
                  <span className={classes.kubernetesApiCell}>
                    <Tooltip title={cluster.apiServer || "-"}>
                      <span>{this.middleEllipsis(cluster.apiServer, 32)}</span>
                    </Tooltip>
                    {cluster.apiServer &&
                      <Tooltip title={this.state.kubernetesCopiedClusterId === cluster.id ? translate("copied") : translate("copy")}>
                        <IconButton size="small" onClick={() => this.copyKubernetesAPIServer(cluster)}>
                          <FileCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    }
                  </span>
                  <span className={classes.kubernetesSwitchCell}>
                    <Switch
                      color="primary"
                      size="small"
                      checked={collectionEnabled}
                      onChange={(event) => this.onKubernetesCollectionToggle(cluster, event.target.checked)} />
                    <span>{this.collectionStateLabel(cluster)}</span>
                  </span>
                  <Tooltip title={last ? `${last.ok ? translate("success") : translate("failed")} · ${last.checkedAt}` : "-"}>
                    <span className={classes.kubernetesMutedCell}>{last ? `${last.ok ? translate("success") : translate("failed")} · ${last.checkedAt}` : "-"}</span>
                  </Tooltip>
                  <span className={classes.kubernetesMutedCell}>{this.collectionStateLabel(cluster)}</span>
                  <span className={classes.kubernetesActionCell}>
                    <Button size="small" onClick={() => this.testKubernetesConnection(cluster.id, true)} disabled={this.state.kubernetesTestLoading || this.state.kubernetesTestAllLoading}>{translate("connectionTest")}</Button>
                    {last && !last.ok && <Button size="small" onClick={() => this.testKubernetesConnection(cluster.id, true)} disabled={this.state.kubernetesTestLoading || this.state.kubernetesTestAllLoading}>{translate("retry")}</Button>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </Paper>
    )
  }

  private renderKubernetesDialogs(classes: any) {
    const confirmCluster = this.selectedKubernetesCluster(this.state.kubernetesConfirmClusterId)
    const stopCluster = this.selectedKubernetesCluster(this.state.kubernetesStopClusterId)
    const testCluster = this.selectedKubernetesCluster(this.state.kubernetesTestClusterId)
    const defaultEnabledKubernetesProbes = ["cluster", "namespace", "node", "pod", "service", "deployment", "daemonset", "statefulset", "ingress", "networkpolicy"]
    const defaultDisabledKubernetesProbes = ["secret", "configmap"]
    return (
      <React.Fragment>
        <Dialog open={!!this.state.kubernetesConfirmClusterId} onClose={() => this.setState({ kubernetesConfirmClusterId: "" })} maxWidth="xs" fullWidth>
          <DialogTitle>{translate("kubernetesEnableConfirmTitle")}</DialogTitle>
          <DialogContent>
            <div className={classes.kubernetesDialogText}>{translate("kubernetesEnableConfirmDescription")}</div>
            {confirmCluster && <div className={classes.kubernetesDialogTarget}>{confirmCluster.name || confirmCluster.id}</div>}
            <div className={classes.kubernetesStatusSteps}>
              <span>{translate("kubernetesStepKubeconfig")}</span>
              <span>{translate("kubernetesStepConnection")}</span>
              <span>{translate("collectionRunning")}</span>
              <span>{translate("collectionError")}</span>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ kubernetesConfirmClusterId: "" })}>{translate("cancel")}</Button>
            <Button color="primary" variant="contained" onClick={this.confirmKubernetesEnable.bind(this)}>{translate("activate")}</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={!!this.state.kubernetesStopClusterId} onClose={() => this.setState({ kubernetesStopClusterId: "" })} maxWidth="xs" fullWidth>
          <DialogTitle>{translate("kubernetesDisableConfirmTitle")}</DialogTitle>
          <DialogContent>
            <div className={classes.kubernetesDialogText}>{translate("kubernetesDisableConfirmDescription")}</div>
            {stopCluster && <div className={classes.kubernetesDialogTarget}>{stopCluster.name || stopCluster.id}</div>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ kubernetesStopClusterId: "" })}>{translate("cancel")}</Button>
            <Button color="primary" onClick={this.confirmKubernetesDisable.bind(this)}>{translate("deactivate")}</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={this.state.kubernetesTestDialogOpen} onClose={() => this.setState({ kubernetesTestDialogOpen: false })} maxWidth="sm" fullWidth>
          <DialogTitle>{translate("connectionTest")}</DialogTitle>
          <DialogContent className={classes.kubernetesTestDialogContent}>
            <div className={classes.kubernetesDialogTarget}>
              <small>{translate("kubernetesTestDescription")}</small>
            </div>
            <div className={classes.kubernetesTestSummary}>{this.kubernetesTestSummaryText()}</div>
            <div className={classes.kubernetesCheckList} ref={this.kubernetesCheckListRef}>
              {!this.state.kubernetesTestLoading && this.state.kubernetesTestResults.length === 0 && <div className={classes.kubernetesEmptyRow}>{translate("kubernetesNoTestResult")}</div>}
              {this.state.kubernetesTestResults.map((check) => (
                <div key={check.key} className={classes.kubernetesCheckItem}>
                  <span className={check.waiting ? classes.kubernetesCheckWaiting : check.pending ? classes.kubernetesCheckPending : check.ok ? classes.kubernetesCheckOk : classes.kubernetesCheckFail}>{check.waiting ? <AccessTimeIcon /> : check.pending ? <AccessTimeIcon /> : check.ok ? <CheckCircleIcon /> : <ErrorOutlineIcon />}</span>
                  <span>
                    <strong>{this.kubernetesCheckLabel(check)}</strong>
                    <small>{check.waiting ? (check.message || translate("waiting")) : check.pending ? (check.message || translate("testing")) : check.ok ? (check.message || translate("success")) : (check.message || translate("failed"))}</small>
                    {!check.waiting && !check.pending && !check.ok && check.reason && <small>{check.reason}</small>}
                  </span>
                </div>
              ))}
            </div>
          </DialogContent>
          <DialogActions>
            {testCluster && <Button onClick={() => this.testKubernetesConnection(testCluster.id, true)} disabled={this.state.kubernetesTestLoading}>{translate("retry")}</Button>}
            <Button onClick={() => this.setState({ kubernetesTestDialogOpen: false })}>{translate("close")}</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={this.state.kubernetesPolicyDialogOpen} onClose={() => this.setState({ kubernetesPolicyDialogOpen: false })} maxWidth="sm" fullWidth>
          <DialogTitle>{translate("kubernetesCollectionPolicy")}</DialogTitle>
          <DialogContent>
            <div className={classes.kubernetesDialogText}>{translate("kubernetesCollectionPolicyDescription")}</div>
            <div className={classes.kubernetesPolicyNotice}>
              <InfoIcon fontSize="small" />
              <span>{translate("kubernetesCollectionPolicyNotice")}</span>
            </div>
            <div className={classes.kubernetesProbeInfoGrid}>
              <div className={classes.kubernetesProbeInfoCard}>
                <strong>{translate("kubernetesDefaultEnabledProbes")}</strong>
                <small>{translate("kubernetesDefaultEnabledProbesDescription")}</small>
                <div className={classes.kubernetesProbeBadgeList}>
                  {defaultEnabledKubernetesProbes.map((probe) => <span key={probe} className={classes.kubernetesProbeBadge}>{probe}</span>)}
                </div>
              </div>
              <div className={classes.kubernetesProbeInfoCard}>
                <strong>{translate("kubernetesDefaultDisabledProbes")}</strong>
                <small>{translate("kubernetesDefaultDisabledProbesDescription")}</small>
                <div className={classes.kubernetesProbeBadgeList}>
                  {defaultDisabledKubernetesProbes.map((probe) => <span key={probe} className={classes.kubernetesProbeBadgeMuted}>{probe}</span>)}
                </div>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ kubernetesPolicyDialogOpen: false })}>{translate("close")}</Button>
          </DialogActions>
        </Dialog>
      </React.Fragment>
    )
  }

  private renderDrawerMenu(classes: any) {
    const isDark = this.state.netdiveTheme === "dark"
    return (
      <div className={classes.drawerMenu}>
        <div className={classes.drawerMenuHeader}>
          <img
            src={isDark ? LogoDark : LogoLight}
            alt="ABLESTACK"
            className={clsx(classes.drawerBrandLogo, isDark && classes.drawerBrandLogoDark)}
          />
        </div>
        <div className={classes.drawerMenuSectionTitle}>{translate("collectionSection")}</div>
        {this.renderDrawerIntegrationItem(classes, <AccountTreeIcon />, translate("infrastructureMenu"), translate("infrastructureMenuSummary"), () => this.openInfrastructureTopology(), this.state.isInfrastructurePanelOpen)}
        {this.renderDrawerIntegrationItem(classes, this.kubernetesIcon(), translate("kubernetesCollectionMenu"), translate("kubernetesMenuSummary"), () => this.openKubernetesManager(), this.state.isKubernetesManagerOpen)}
        <div className={classes.drawerMenuSectionTitle}>{translate("viewSettingsSection")}</div>
        {this.renderDrawerMenuItem(classes, <Brightness4Icon />, translate("preferences"), () => this.openPreferencesPanel(), this.state.isPreferencesPanelOpen)}
        <div className={classes.drawerMenuSectionTitle}>{translate("helpSection")}</div>
        {this.renderDrawerMenuItem(classes, <LibraryBooksIcon />, "Help", this.openHelpDialog.bind(this), this.state.isHelpOpen)}
        {this.renderDrawerMenuItem(classes, <InfoIcon />, "About", this.openAboutDialog.bind(this), this.state.isAboutOpen)}
      </div>
    )
  }


  onNavigate(date: Date) {
    this.state.isTimetravelOpen = false
    this.state.timeContext = date
    this.state.wsContext.Time = date.getTime()
    this.setState(this.state)
    this.sync()
  }

  render() {
    const { classes } = this.props
    const isDark = this.state.netdiveTheme === "dark"
    const infrastructureHostSummaries = this.infrastructureSummary().hostsById
    return (
      <div className={clsx(classes.app, isDark && classes.appDark)}>
        <CssBaseline />
        {this.connection()}
        <AppBar position="absolute" className={clsx(classes.appBar, classes.appBarShift)}>
          <Toolbar className={classes.toolbar}>
            {this.config.subTitle &&
              <Typography className={classes.subTitle} variant="caption">{this.config.subTitle()}</Typography>
            }
            <div className={classes.search}>
              <AutoCompleteInput placeholder={this.searchPlaceholder()} suggestions={this.state.suggestions} onChange={this.onSearchChange.bind(this)} />
            </div>
            <span className={classes.toolbarSectionDivider} />
            {this.renderLayerFilterMenu(classes)}
            {this.renderConnectionDisplayMenu(classes)}
            <span className={classes.toolbarSectionDivider} />
            <div className={classes.toolbarActionGroup}>
              <Tooltip title={translate("expandAllNodes")}>
                <IconButton
                  color="inherit"
                  onClick={this.expandAllNodes.bind(this)}
                  className={classes.topologyIconButton}
                >
                  <UnfoldMoreIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={translate("collapseAllNodes")}>
                <IconButton
                  color="inherit"
                  onClick={this.collapseAllNodes.bind(this)}
                  className={classes.topologyIconButton}
                >
                  <UnfoldLessIcon />
                </IconButton>
              </Tooltip>
              {this.renderTopologyZoomControls(classes)}
              <Tooltip title={translate("refresh")}>
                <IconButton
                  color="inherit"
                  onClick={this.sync.bind(this)}
                  className={classes.topologyIconButton}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </div>
            <div className={classes.grow} />
            {this.renderMenuButtons(classes)}
          </Toolbar>
        </AppBar>
        <Drawer
          variant="permanent"
          classes={{
            paper: classes.drawerPaper,
          }}
          open={true}>
          <div className={classes.drawerCard} data-netdive-drawer="true">
          {this.renderDrawerMenu(classes)}
          </div>
        </Drawer>
        {this.renderInfrastructurePanel(classes)}
        {this.renderKubernetesManagerPanel(classes)}
        {this.renderScreenConfigPanel(classes)}
        {this.renderPreferencesPanel(classes)}
        {this.renderHelpPanel(classes)}
        {this.renderAboutPanel(classes)}
        {this.renderKubernetesDialogs(classes)}
        <main className={classes.content}>
          <Container maxWidth="xl" className={classes.container}>
            <Topology className={classes.topology} ref={node => this.tc = node}
              nodeAttrs={this.nodeAttrs.bind(this)}
              linkAttrs={this.linkAttrs.bind(this)}
              onNodeSelected={this.onNodeSelected.bind(this)}
              sortNodesFnc={this.sortNodesFnc.bind(this)}
              onShowNodeContextMenu={this.onShowNodeContextMenu.bind(this)}
              weightTitles={this.config.weightTitles()}
              groupSize={this.config.groupSize()}
              groupType={this.config.groupType.bind(this.config)}
              groupName={this.config.groupName.bind(this.config)}
              onClick={this.onTopologyClick.bind(this)}
              onLinkSelected={this.onLinkSelected.bind(this)}
              onLinkTagChange={this.onLinkTagChange.bind(this)}
              onNodeClicked={this.config.nodeClicked.bind(this.config)}
              onNodeDblClicked={this.config.nodeDblClicked.bind(this.config)}
              defaultNodeTag={this.config.defaultNodeTag.bind(this.config)}
              defaultLinkTagMode={this.config.defaultLinkTagMode.bind(this.config)}
              vmNameMap={this.state.vmNameMap}
              vmNetworkMap={this.state.vmNetworkMap}
              onZoomChange={this.onTopologyZoomChange.bind(this)}
            />
          </Container>
          <Container className={classes.rightPanel}>
            <Paper className={clsx(classes.rightPanelPaper, (!this.state.isSelectionOpen && !this.state.isTimetravelOpen) && classes.rightPanelPaperClose)}
              square={true}>
              {!this.state.isTimetravelOpen &&
                <SelectionPanel onLocation={this.onSelectionLocation.bind(this)} onClose={this.onSelectionClose.bind(this)} config={this.config}
                  buttonsContent={this.actionButtons.bind(this)} panelsContent={this.dataPanels.bind(this)} moldInventory={this.state.moldInventory} infrastructureHostSummaries={infrastructureHostSummaries} kubernetesClusters={this.state.kubernetesClusters}
                  vmNameMap={this.state.vmNameMap} vmNetworkMap={this.state.vmNetworkMap} vmDetailMap={this.state.vmDetailMap} />
              }
              {this.state.isTimetravelOpen &&
                <TimetravelPanel config={this.config} onNavigate={this.onNavigate.bind(this)} />
              }
            </Paper>
          </Container>
          {this.renderFilters(classes)}
          {this.renderLinkTagButtons(classes)}
        </main>
      </div>
    )
  }
}

export const mapStateToProps = (state: AppState) => ({
  selection: state.selection,
  session: state.session,
})

export const mapDispatchToProps = ({
  selectElement,
  unselectElement,
  bumpRevision,
  closeSession,
})

export default withStyles(styles)(connect(mapStateToProps, mapDispatchToProps)(withSnackbar(withRouter(App))))
