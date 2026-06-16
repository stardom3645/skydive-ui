import * as React from 'react'
import TextField from '@material-ui/core/TextField'
import Button from '@material-ui/core/Button'
import { withStyles } from '@material-ui/core/styles'
import VideocamIcon from '@material-ui/icons/Videocam'
import Accordion from '@material-ui/core/Accordion'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import InputLabel from '@material-ui/core/InputLabel'
import Select from '@material-ui/core/Select'
import MenuItem from '@material-ui/core/MenuItem'
import FormControl from '@material-ui/core/FormControl'
import Typography from '@material-ui/core/Typography'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Checkbox from '@material-ui/core/Checkbox'
import Snackbar from '@material-ui/core/Snackbar'
import MuiAlert from '@material-ui/lab/Alert'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import CheckCircleIcon from '@material-ui/icons/CheckCircle'
import WarningIcon from '@material-ui/icons/Warning'
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'

import { Node } from '../Topology'
import { Configuration } from '../api/configuration'
import Panel from './Panel'
import { CapturesApi } from '../api'
import { styles } from './CaptureFormStyles'
import { AppState, session } from '../Store'
import { connect } from 'react-redux'
import { translate } from "../Config"
import Tooltip from '@material-ui/core/Tooltip'
import { SimpleCaptureSession } from './CaptureStatus'

function Alert(props) {
  return <MuiAlert elevation={6} variant="filled" {...props} />
}

interface Props {
  classes: any
  defaultName: string
  gremlin: string
  session: session
  onCaptureCreated?: (capture?: SimpleCaptureSession) => void
  node: Node
}

interface State {
  name: string
  description: string
  bpf: string
  captureType: string
  layerKey: string
  headerSize: string
  rawPacketLimit: string
  extraTCPMetric: boolean
  defragIPv4: boolean
  reassembleTCP: boolean
  captureScope: string
  captureDuration: string
  filterPreset: string
  showAdvanced: boolean
  snackbarOpen: boolean
  snackbarMessage: string
  snackbarSeverity: "success" | "error"
}

type CaptureCapability = "available" | "conditional" | "unavailable"
class CaptureForm extends React.Component<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      name: props.defaultName || "",
      description: "",
      bpf: "",
      captureType: this.defaultCaptureType(props.node),
      layerKey: "L3",
      headerSize: "",
      rawPacketLimit: "0",
      extraTCPMetric: false,
      defragIPv4: false,
      reassembleTCP: false,
      captureScope: "related",
      captureDuration: "30s",
      filterPreset: "all",
      showAdvanced: false,
      snackbarOpen: false,
      snackbarMessage: "",
      snackbarSeverity: "error"
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.nodeKey(prevProps.node) === this.nodeKey(this.props.node)) {
      return
    }

    const defaultCaptureType = this.defaultCaptureType(this.props.node)
    this.setState({
      name: this.props.defaultName || "",
      captureType: this.isCaptureTypeEligible(this.props.node, this.state.captureType) ? this.state.captureType : defaultCaptureType,
      bpf: "",
      description: "",
      captureScope: "related",
      captureDuration: "30s",
      filterPreset: "all",
      showAdvanced: false
    })
  }

  private nodeKey(node?: Node): string {
    return node?.data?.TID || node?.id || ""
  }

  private nodeType(node?: Node): string {
    return typeof node?.data?.Type === "string" ? node.data.Type.toLowerCase() : ""
  }

  private nodeIPv4List(node?: Node): any[] {
    return Array.isArray(node?.data?.IPV4) ? node!.data.IPV4 : []
  }

  private isKubernetesNode(node?: Node): boolean {
    return typeof node?.data?.Manager === "string" && node.data.Manager.toLowerCase() === "k8s"
  }

  private isOvsPort(node?: Node): boolean {
    return this.nodeType(node) === "ovsport"
  }

  private isDPDKPort(node?: Node): boolean {
    return this.nodeType(node) === "dpdkport"
  }

  private isOvsMirrorEligible(node?: Node): boolean {
    return this.isOvsPort(node) &&
      typeof node?.data?.Name === "string" &&
      !/^ovs-port-mir/i.test(node.data.Name)
  }

  private isSflowEligible(node?: Node): boolean {
    return this.nodeIPv4List(node).length > 0
  }

  private eligibleCaptureTypes(node?: Node): string[] {
    const eligibleTypes: string[] = []

    if (!this.isOvsPort(node)) {
      eligibleTypes.push("pcap", "afpacket")
    }
    if (this.isSflowEligible(node)) {
      eligibleTypes.push("sflow")
    }
    if (this.isDPDKPort(node)) {
      eligibleTypes.push("dpdk")
    }
    if (this.isOvsMirrorEligible(node)) {
      eligibleTypes.push("ovsmirror")
    }

    return eligibleTypes
  }

  private defaultCaptureType(node?: Node): string {
    return this.eligibleCaptureTypes(node)[0] || ""
  }

  private isCaptureTypeEligible(node: Node | undefined, captureType: string): boolean {
    return !!captureType && this.eligibleCaptureTypes(node).includes(captureType)
  }

  private captureCapability(node?: Node): CaptureCapability {
    const type = this.nodeType(node)
    if (this.isKubernetesNode(node)) {
      return type === "node" ? "conditional" : "unavailable"
    }

    if (this.isCaptureDisabled(node)) {
      return "unavailable"
    }

    return "available"
  }

  private isCaptureDisabled(node?: Node): boolean {
    const type = this.nodeType(node)
    const disallowedTypes = ["switch", "switchport", "host", "libvirt", "tuntap", "system", "ovsbridge"]

    return this.isKubernetesNode(node) || !node?.data?.TID || disallowedTypes.includes(type) || this.eligibleCaptureTypes(node).length === 0
  }

  private isHeaderSizeValid(): boolean {
    if (!this.state.headerSize) {
      return true
    }

    const headerSize = parseInt(this.state.headerSize, 10)
    return !isNaN(headerSize) && headerSize >= 14 && headerSize <= 4096
  }

  private isRawPacketLimitValid(): boolean {
    if (!this.state.rawPacketLimit) {
      return true
    }

    const rawPacketLimit = parseInt(this.state.rawPacketLimit, 10)
    return !isNaN(rawPacketLimit) && (rawPacketLimit === 0 || (rawPacketLimit > 0 && rawPacketLimit <= 10))
  }

  private targetTypeLabel(node?: Node): string {
    const type = this.nodeType(node)
    if (this.isKubernetesNode(node)) {
      switch (type) {
        case "node": return translate("capture-target-k8s-node")
        case "pod": return translate("capture-target-k8s-pod")
        case "service": return translate("capture-target-k8s-service")
        case "namespace": return translate("capture-target-k8s-namespace")
        case "daemonset": return translate("capture-target-k8s-daemonset")
        case "deployment": return translate("capture-target-k8s-deployment")
        case "cluster": return translate("capture-target-k8s-cluster")
        default: return translate("capture-target-k8s-resource")
      }
    }

    switch (type) {
      case "host": return translate("phy-hosts")
      case "device": return translate("phy-nics")
      case "bond": return translate("phy-bond")
      case "bridge": return translate("host-bridges")
      case "ovsport": return "OVS Port"
      case "dpdkport": return "DPDK Port"
      case "port": return translate("phy-ports")
      case "internal": return translate("phy-nics")
      default: return type || "Node"
    }
  }

  private targetIPAddress(node?: Node): string | undefined {
    const ipv4 = this.nodeIPv4List(node)
    if (ipv4.length > 0) {
      return ipv4.join(", ")
    }
    if (Array.isArray(node?.data?.IPV6) && node!.data.IPV6.length > 0) {
      return node!.data.IPV6.join(", ")
    }
    return undefined
  }

  private targetInfoRows(node?: Node): Array<{ label: string, value: string }> {
    const rows: Array<{ label: string, value: string }> = []
    const ip = this.targetIPAddress(node)
    const os = node?.data?.OS || node?.data?.Platform || node?.data?.KernelVersion
    const state = node?.data?.State || node?.data?.Status
    const ifName = node?.data?.IfName || node?.data?.Name
    const driver = node?.data?.Driver
    const mac = node?.data?.MAC

    if (ip) rows.push({ label: "IP 주소", value: ip })
    if (os) rows.push({ label: "운영체제", value: os })
    if (state) rows.push({ label: "상태", value: state })
    if (ifName) rows.push({ label: "주요 인터페이스", value: ifName })
    if (driver) rows.push({ label: "드라이버", value: driver })
    if (mac) rows.push({ label: "MAC 주소", value: mac })

    return rows.slice(0, 5)
  }

  private bpfForPreset(preset: string): string {
    switch (preset) {
      case "ssh": return "tcp port 22"
      case "web": return "tcp port 80 or tcp port 443"
      case "custom": return this.state.bpf
      default: return ""
    }
  }

  private captureDurationSeconds(): number {
    switch (this.state.captureDuration) {
      case "1m": return 60
      case "3m": return 180
      default: return 30
    }
  }

  private captureCapabilityLabel(capability: CaptureCapability): string {
    switch (capability) {
      case "available": return "캡처 가능"
      case "conditional": return "조건부 가능"
      default: return "직접 캡처 불가"
    }
  }

  private captureScopeLabel(): string {
    return this.state.captureScope === "all" ? "전체 트래픽" : "선택 노드 관련 트래픽"
  }

  private captureDurationLabel(): string {
    switch (this.state.captureDuration) {
      case "1m": return "1분"
      case "3m": return "3분"
      default: return "30초"
    }
  }

  private filterSummaryLabel(): string {
    const bpf = this.bpfForPreset(this.state.filterPreset).trim()
    switch (this.state.filterPreset) {
      case "ssh": return "SSH (tcp port 22)"
      case "web": return "HTTP/HTTPS (80/443)"
      case "custom": return bpf ? `직접 입력 (${bpf})` : "직접 입력"
      default: return "전체"
    }
  }

  private isAdvancedDefaultChanged(captureType: string, defaultCaptureType: string): boolean {
    return captureType !== defaultCaptureType ||
      this.state.layerKey !== "L3" ||
      this.state.headerSize !== "" ||
      this.state.rawPacketLimit !== "0" ||
      this.state.extraTCPMetric ||
      this.state.defragIPv4 ||
      this.state.reassembleTCP
  }

  private renderAdvancedLabel(classes: any, label: string, tooltip: string) {
    return (
      <span className={classes.advancedOptionLabel}>
        {label}
        <Tooltip title={tooltip} arrow>
          <HelpOutlineIcon />
        </Tooltip>
      </span>
    )
  }

  private normalizeSimpleCapture(raw: any, bpf: string): SimpleCaptureSession {
    const request = raw?.request || {}
    const target = raw?.target || {}
    return {
      id: raw?.id || "",
      captureID: raw?.captureID,
      status: raw?.status || "running",
      startedAt: raw?.startedAt || new Date().toISOString(),
      expiresAt: raw?.expiresAt || new Date(Date.now() + this.captureDurationSeconds() * 1000).toISOString(),
      targetName: target.name || this.props.defaultName || this.props.node?.data?.Name || "-",
      targetType: target.type || this.nodeType(this.props.node),
      scope: request.scope || this.state.captureScope,
      filterPreset: request.filterPreset || this.state.filterPreset,
      bpf: request.bpf || bpf,
      durationSeconds: request.durationSeconds || this.captureDurationSeconds()
    }
  }

  private legacyCaptureSession(captureType: string, bpf: string): SimpleCaptureSession {
    const now = Date.now()
    return {
      id: `legacy-${this.nodeKey(this.props.node)}-${now}`,
      status: "running",
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.captureDurationSeconds() * 1000).toISOString(),
      targetName: this.props.defaultName || this.props.node?.data?.Name || "-",
      targetType: this.nodeType(this.props.node),
      scope: this.state.captureScope,
      filterPreset: this.state.filterPreset,
      bpf,
      durationSeconds: this.captureDurationSeconds()
    }
  }

  private async createSimpleCapture(captureType: string, bpf: string): Promise<SimpleCaptureSession | null> {
    const response = await fetch(`${this.props.session.endpoint}/api/simple-capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": this.props.session.token
      },
      body: JSON.stringify({
        nodeTID: this.props.node?.data?.TID || "",
        nodeID: this.props.node?.id || "",
        scope: this.state.captureScope,
        durationSeconds: this.captureDurationSeconds(),
        filterPreset: this.state.filterPreset,
        bpf,
        captureType,
        layerKeyMode: this.state.layerKey,
        headerSize: this.state.headerSize ? parseInt(this.state.headerSize, 10) : 0,
        rawPacketLimit: this.state.rawPacketLimit ? parseInt(this.state.rawPacketLimit, 10) : 0,
        extraTCPMetric: this.state.extraTCPMetric,
        ipDefrag: this.state.defragIPv4,
        reassembleTCP: this.state.reassembleTCP
      })
    })

    const contentType = response.headers.get("content-type") || ""
    if (response.status === 404 && !contentType.includes("application/json")) {
      return null
    }
    if (response.status < 200 || response.status >= 300) {
      throw response
    }
    return this.normalizeSimpleCapture(await response.json(), bpf)
  }

  handleChange = (field: keyof State) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    this.setState({ [field]: value } as Pick<State, keyof State>)
  }

  onClick = async () => {
    const captureType = this.state.captureType || this.defaultCaptureType(this.props.node)
    const bpf = this.bpfForPreset(this.state.filterPreset)

    if (this.isCaptureDisabled(this.props.node) || !this.isCaptureTypeEligible(this.props.node, captureType)) {
      this.setState({
        snackbarOpen: true,
        snackbarMessage: translate("capture-validation-error"),
        snackbarSeverity: "error"
      })
      return
    }

    if (!this.isHeaderSizeValid() || !this.isRawPacketLimitValid()) {
      this.setState({
        snackbarOpen: true,
        snackbarMessage: translate("capture-validation-error"),
        snackbarSeverity: "error"
      })
      return
    }

    if (captureType !== "pcap" && bpf.trim() !== "") {
      this.setState({
        snackbarOpen: true,
        snackbarMessage: translate("bpf-pcap-only"),
        snackbarSeverity: "error"
      })
      return
    }

    try {
      let createdCapture = await this.createSimpleCapture(captureType, bpf)
      if (!createdCapture) {
        const conf = new Configuration({
          basePath: this.props.session.endpoint + "/api",
          accessToken: this.props.session.token
        })
        const api = new CapturesApi(conf)

        const payload = {
          GremlinQuery: this.props.gremlin,
          Name: this.state.name,
          Description: this.state.description,
          BPFFilter: bpf,
          Type: captureType,
          LayerKeyMode: this.state.layerKey,
          HeaderSize: this.state.headerSize ? parseInt(this.state.headerSize, 10) : undefined,
          RawPacketLimit: this.state.rawPacketLimit ? parseInt(this.state.rawPacketLimit, 10) : 0,
          ExtraTCPMetric: this.state.extraTCPMetric,
          IPDefrag: this.state.defragIPv4,
          ReassembleTCP: this.state.reassembleTCP
        }

        await api.createCapture(payload as any)
        createdCapture = this.legacyCaptureSession(captureType, bpf)
      }

      this.setState({
        snackbarOpen: true,
        snackbarMessage: translate("capture-create-success"),
        snackbarSeverity: "success"
      })

      if (this.props.onCaptureCreated) {
        this.props.onCaptureCreated(createdCapture)
      }

    } catch (err) {
      console.error("에러 발생:", err)
      let message = translate("capture-create-failed")

      if (err instanceof Response) {
        if (err.status === 409) {
          message += ": " + translate("capture-duplicate-error")
        } else if (err.status === 400) {
          message += ": " + translate("capture-validation-error")
        } else {
          message += ": " + translate("capture-unknown-error")
        }
      } else if (err.message?.includes("Network Error")) {
        message += ": " + translate("capture-network-error")
      } else if (err.message) {
        message += ": " + err.message
      } else {
        message += ": " + translate("capture-unknown-error")
      }

      this.setState({
        snackbarOpen: true,
        snackbarMessage: message,
        snackbarSeverity: "error"
      })
    }
  }

  private renderOptionButton(classes: any, label: string, selected: boolean, onClick: () => void, helper?: string, disabled?: boolean) {
    return (
      <button
        type="button"
        className={`${classes.wizardOptionButton} ${selected ? classes.wizardOptionButtonActive : ""}`}
        disabled={disabled === true}
        onClick={onClick}>
        <span>{label}</span>
        {helper && <small>{helper}</small>}
      </button>
    )
  }

  private renderCompactTextField(classes: any, props: any) {
    return (
      <TextField
        {...props}
        className={`${classes.compactField} ${props.className || ""}`}
        variant="outlined"
        fullWidth
        margin="none"
      />
    )
  }

  render() {
    const { classes } = this.props
    const capability = this.captureCapability(this.props.node)
    const isCaptureDisabled = this.isCaptureDisabled(this.props.node)
    const isPcapEligible = this.isCaptureTypeEligible(this.props.node, "pcap")
    const isAfpacketEligible = this.isCaptureTypeEligible(this.props.node, "afpacket")
    const isSflowEligible = this.isCaptureTypeEligible(this.props.node, "sflow")
    const isDPDKPort = this.isCaptureTypeEligible(this.props.node, "dpdk")
    const isOvsMirrorEligible = this.isCaptureTypeEligible(this.props.node, "ovsmirror")
    const defaultCaptureType = this.defaultCaptureType(this.props.node)
    const captureType = this.state.captureType || defaultCaptureType
    const hasValidationError = !this.isHeaderSizeValid() || !this.isRawPacketLimitValid()
    const advancedChanged = this.isAdvancedDefaultChanged(captureType, defaultCaptureType)
    const targetRows = this.targetInfoRows(this.props.node)
    const statusClass = capability === "available" ? classes.statusAvailable : capability === "conditional" ? classes.statusConditional : classes.statusUnavailable
    const StatusIcon = capability === "available" ? CheckCircleIcon : capability === "conditional" ? WarningIcon : ErrorOutlineIcon
    const capabilityLabel = this.captureCapabilityLabel(capability)
    return (
      <>
        <Panel icon={<VideocamIcon />} title={translate("Packet capture")} content={
          <div className={classes.captureWizard}>
            <section className={classes.wizardMain}>
              <div className={classes.wizardMainCard}>
                <div className={classes.wizardCardHeader}>
                  <div>
                    <Typography component="h3" className={classes.wizardTitle}>1. 대상 확인</Typography>
                    <Typography component="p" className={classes.wizardSubtitle}>선택한 노드의 캡처 가능 여부를 확인합니다.</Typography>
                  </div>
                  <span className={`${classes.captureStatusBadge} ${statusClass}`}>
                    <StatusIcon fontSize="small" />
                    {capabilityLabel}
                  </span>
                </div>

                <div className={classes.targetSummaryGrid}>
                  <div className={classes.targetCard}>
                    <span className={classes.sectionLabel}>선택한 대상</span>
                    <div className={classes.targetNameRow}>
                      <strong>{this.props.defaultName || this.props.node?.data?.Name || "-"}</strong>
                      <span>{this.targetTypeLabel(this.props.node)}</span>
                    </div>
                    {targetRows.length > 0 &&
                      <div className={classes.targetInfoGrid}>
                        {targetRows.map((row) => (
                          <div key={row.label}>
                            <span>{row.label}</span>
                            <strong>{row.value}</strong>
                          </div>
                        ))}
                      </div>
                    }
                  </div>
                </div>

                <div className={classes.simpleSettings}>
                  <Typography component="h3" className={classes.wizardTitle}>2. 캡처 설정</Typography>
                  <div className={classes.simpleApiBanner}>
                    <CheckCircleIcon />
                    <div>
                      <strong>권장 기본값</strong>
                      <span>자동 종료와 안전한 기본 옵션은 Simple Capture API에서 처리합니다.</span>
                    </div>
                  </div>
                  <div className={classes.settingRow}>
                    <div>
                      <strong>캡처 범위</strong>
                      <small>문제 재현 시간을 고려하여 적절한 범위를 선택하세요.</small>
                    </div>
                    <div className={classes.optionGroup}>
                      {this.renderOptionButton(classes, "선택 노드 관련 트래픽", this.state.captureScope === "related", () => this.setState({ captureScope: "related" }))}
                      {this.renderOptionButton(classes, "전체 트래픽", this.state.captureScope === "all", () => this.setState({ captureScope: "all" }))}
                    </div>
                  </div>

                  <div className={classes.settingRow}>
                    <div>
                      <strong>캡처 시간</strong>
                      <small>설정한 시간이 지나면 자동 종료됩니다.</small>
                    </div>
                    <div className={classes.optionGroup}>
                      {this.renderOptionButton(classes, "30초", this.state.captureDuration === "30s", () => this.setState({ captureDuration: "30s" }))}
                      {this.renderOptionButton(classes, "1분", this.state.captureDuration === "1m", () => this.setState({ captureDuration: "1m" }))}
                      {this.renderOptionButton(classes, "3분", this.state.captureDuration === "3m", () => this.setState({ captureDuration: "3m" }))}
                    </div>
                  </div>

                  <div className={classes.settingRow}>
                    <div>
                      <strong>필터</strong>
                      <small>필요한 경우에만 트래픽 필터를 제한합니다.</small>
                    </div>
                    <div className={classes.optionGroup}>
                      {this.renderOptionButton(classes, "전체", this.state.filterPreset === "all", () => this.setState({ filterPreset: "all", bpf: "" }))}
                      {this.renderOptionButton(classes, "SSH", this.state.filterPreset === "ssh", () => this.setState({ filterPreset: "ssh" }), "tcp 22", !isPcapEligible)}
                      {this.renderOptionButton(classes, "HTTP/HTTPS", this.state.filterPreset === "web", () => this.setState({ filterPreset: "web" }), "80/443", !isPcapEligible)}
                      {this.renderOptionButton(classes, "직접 입력", this.state.filterPreset === "custom", () => this.setState({ filterPreset: "custom" }), undefined, !isPcapEligible)}
                    </div>
                  </div>

                  {this.state.filterPreset === "custom" &&
                    <div className={classes.inlineFieldCard}>
                      <span className={classes.sectionLabel}>직접 입력 BPF</span>
                      {this.renderCompactTextField(classes, {
                        label: translate("Filter (BPF)"),
                        placeholder: "예: tcp port 22",
                        value: this.state.bpf,
                        onChange: this.handleChange("bpf")
                      })}
                    </div>
                  }
                </div>

                <div className={classes.wizardActions}>
                  <Button
                    className={classes.advancedToggle}
                    onClick={() => this.setState({ showAdvanced: !this.state.showAdvanced })}>
                    {this.state.showAdvanced ? "고급 옵션 숨기기" : "고급 옵션 보기"}
                  </Button>
                  <Button
                    variant="contained"
                    className={classes.button}
                    color="primary"
                    onClick={this.onClick}
                    disabled={isCaptureDisabled || hasValidationError || capability !== "available"}
                    startIcon={<PlayArrowIcon />}>
                    간단 캡처 시작
                  </Button>
                </div>

                {this.state.showAdvanced &&
                  <Accordion className={classes.advanced} expanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} className={classes.advancedSummary}>
                      <div className={classes.advancedTitleRow}>
                        <Typography className={classes.heading}>{translate("Advanced options")}</Typography>
                        <span className={classes.expertBadge}>전문가용</span>
                        <span className={advancedChanged ? classes.advancedChangedBadge : classes.advancedDefaultBadge}>
                          {advancedChanged ? "기본값 변경됨" : "기본값 사용 중"}
                        </span>
                      </div>
                    </AccordionSummary>
                    <AccordionDetails>
                      <div className={classes.advancedContent}>
                        <div className={classes.advancedNotice}>
                          <WarningIcon />
                          <span>전문가용 옵션입니다. 일반적인 캡처는 기본값을 권장합니다. 옵션을 변경하면 캡처 결과, 성능, 파일 크기에 영향을 줄 수 있습니다.</span>
                        </div>

                        <section className={classes.advancedSection}>
                          <header>
                            <strong>수집 방식</strong>
                            <small>패킷을 어떤 방식과 기준으로 수집할지 설정합니다.</small>
                          </header>
                          <div className={classes.advancedGrid}>
                            <div className={classes.advancedOptionBlock}>
                              <FormControl variant="outlined" fullWidth className={classes.compactField}>
                                <InputLabel id="capture-type-label">
                                  {this.renderAdvancedLabel(classes, translate("Capture Type"), "패킷을 수집하는 방식을 선택합니다. 일반적으로 PCAP을 사용합니다.")}
                                </InputLabel>
                                <Select
                                  id="capture-type"
                                  labelId="capture-type-label"
                                  value={captureType}
                                  onChange={this.handleChange("captureType")}
                                  label={translate("Capture Type")}>
                                  <MenuItem value="pcap" disabled={!isPcapEligible} title={!isPcapEligible ? "현재 환경에서 사용할 수 없습니다." : ""}>PCAP</MenuItem>
                                  <MenuItem value="afpacket" disabled={!isAfpacketEligible} title={!isAfpacketEligible ? "현재 환경에서 사용할 수 없습니다." : ""}>AFPacket</MenuItem>
                                  <MenuItem value="sflow" disabled={!isSflowEligible} title={!isSflowEligible ? "현재 환경에서 사용할 수 없습니다." : ""}>sFlow</MenuItem>
                                  <MenuItem value="dpdk" disabled={!isDPDKPort} title={!isDPDKPort ? "현재 환경에서 사용할 수 없습니다." : ""}>DPDK</MenuItem>
                                  <MenuItem value="ovsmirror" disabled={!isOvsMirrorEligible} title={!isOvsMirrorEligible ? "현재 환경에서 사용할 수 없습니다." : ""}>OVS Mirror</MenuItem>
                                </Select>
                              </FormControl>
                              <small>패킷을 수집하는 방식을 선택합니다. 기본값: PCAP</small>
                            </div>

                            <div className={classes.advancedOptionBlock}>
                              <FormControl variant="outlined" fullWidth className={classes.compactField}>
                                <InputLabel id="layer-key-label">
                                  {this.renderAdvancedLabel(classes, translate("Layers used for Flow Key"), "플로우를 어떤 네트워크 계층 기준으로 묶을지 선택합니다. 일반적으로 L3를 사용합니다.")}
                                </InputLabel>
                                <Select
                                  id="layer-key"
                                  labelId="layer-key-label"
                                  value={this.state.layerKey}
                                  onChange={this.handleChange("layerKey")}
                                  label={translate("Layers used for Flow Key")}>
                                  <MenuItem value="L2">L2</MenuItem>
                                  <MenuItem value="L3">L3</MenuItem>
                                </Select>
                              </FormControl>
                              <small>플로우를 어떤 네트워크 계층 기준으로 묶을지 선택합니다. 기본값: L3</small>
                            </div>

                            <div className={classes.advancedOptionBlock}>
                              {this.renderCompactTextField(classes, {
                                label: this.renderAdvancedLabel(classes, translate("Header size"), "저장할 패킷 헤더 길이를 제한합니다. 비워두면 기본값을 사용합니다."),
                                type: "number",
                                value: this.state.headerSize,
                                onChange: this.handleChange("headerSize"),
                                error: !!this.state.headerSize && !this.isHeaderSizeValid(),
                                helperText: !!this.state.headerSize && !this.isHeaderSizeValid() ? translate("capture-headerSize-validation-error") : ""
                              })}
                              <small>저장할 패킷 헤더 길이를 제한합니다. 비워두면 기본값을 사용합니다.</small>
                            </div>

                            <div className={classes.advancedOptionBlock}>
                              {this.renderCompactTextField(classes, {
                                label: this.renderAdvancedLabel(classes, translate("Raw packet limit"), "저장할 원시 패킷 수를 제한합니다. 0이면 제한하지 않습니다."),
                                type: "number",
                                value: this.state.rawPacketLimit,
                                onChange: this.handleChange("rawPacketLimit"),
                                error: !!this.state.rawPacketLimit && !this.isRawPacketLimitValid(),
                                helperText: !!this.state.rawPacketLimit && !this.isRawPacketLimitValid() ? translate("capture-rawPacketLimit-validation-error") : ""
                              })}
                              <small>저장할 원시 패킷 수를 제한합니다. 0이면 제한하지 않습니다.</small>
                            </div>
                          </div>
                        </section>

                        <section className={classes.advancedSection}>
                          <header>
                            <strong>분석 옵션</strong>
                            <small>정확도와 상세 분석을 높일 수 있지만 캡처 부하가 증가할 수 있습니다.</small>
                          </header>
                          <div className={classes.advancedCheckList}>
                            <div>
                              <FormControlLabel control={<Checkbox checked={this.state.extraTCPMetric} onChange={this.handleChange("extraTCPMetric")} color="primary" />} label={this.renderAdvancedLabel(classes, translate("Extra TCP metric"), "TCP 지연, 재전송 등 추가 분석 정보를 수집합니다. 캡처 부하가 증가할 수 있습니다.")} />
                              <small>TCP 지연, 재전송 등 추가 분석 정보를 수집합니다.</small>
                              <em>성능 영향</em>
                            </div>
                            <div>
                              <FormControlLabel control={<Checkbox checked={this.state.defragIPv4} onChange={this.handleChange("defragIPv4")} color="primary" />} label={this.renderAdvancedLabel(classes, translate("Defragment IPv4 packets"), "분할된 IPv4 패킷을 다시 조립해 분석합니다. 분석 정확도는 높아질 수 있으나 부하가 증가합니다.")} />
                              <small>분할된 IPv4 패킷을 다시 조립해 분석합니다.</small>
                              <em>성능 영향</em>
                            </div>
                            <div>
                              <FormControlLabel control={<Checkbox checked={this.state.reassembleTCP} onChange={this.handleChange("reassembleTCP")} color="primary" />} label={this.renderAdvancedLabel(classes, translate("Reassemble TCP packets"), "TCP 스트림을 재조립해 상위 프로토콜 분석에 활용합니다. HTTP/TLS 분석에 유용하지만 부하가 증가합니다.")} />
                              <small>TCP 스트림을 재조립해 상위 프로토콜 분석에 활용합니다.</small>
                              <em>성능 영향 · 파일 크기 증가</em>
                            </div>
                          </div>
                        </section>
                      </div>
                    </AccordionDetails>
                  </Accordion>
                }
              </div>

              <Accordion className={classes.captureExamples}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" className={classes.wizardTitle}>{translate("capture-target-policy-title")}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <div className={classes.exampleGrid}>
                    <div className={classes.exampleCardAvailable}>
                      <header><strong>{translate("capture-target-policy-capturable-layers")}</strong><span>{translate("capture-target-policy-direct")}</span></header>
                      <small>{translate("capture-target-policy-infra-desc")}</small>
                    </div>
                    <div className={classes.exampleCardUnavailable}>
                      <header><strong>{translate("capture-target-policy-logical-layers")}</strong><span>{translate("capture-target-policy-unavailable")}</span></header>
                      <small>{translate("capture-target-policy-logical-desc")}</small>
                    </div>
                    <div className={classes.exampleCardUnavailable}>
                      <header><strong>{translate("capture-target-policy-k8s-layers")}</strong><span>{translate("capture-target-policy-unavailable")}</span></header>
                      <small>{translate("capture-target-policy-k8s-desc")}</small>
                    </div>
                    <div className={classes.exampleCardUnavailable}>
                      <header><strong>{translate("capture-target-policy-k8s-logical-targets")}</strong><span>{translate("capture-target-policy-unavailable")}</span></header>
                      <small>{translate("capture-target-policy-k8s-logical-desc")}</small>
                    </div>
                  </div>
                </AccordionDetails>
              </Accordion>
            </section>

            <aside className={classes.wizardHelpPanel}>
              <div className={classes.captureSideCard}>
                <div className={classes.sideCardTitle}>
                  <VideocamIcon />
                  <strong>캡처 요약</strong>
                </div>
                <div className={classes.captureSummaryRows}>
                  <div>
                    <span>대상</span>
                    <strong>{this.props.defaultName || this.props.node?.data?.Name || "-"}</strong>
                  </div>
                  <div>
                    <span>유형</span>
                    <strong>{this.targetTypeLabel(this.props.node)}</strong>
                  </div>
                  <div>
                    <span>범위</span>
                    <strong>{this.captureScopeLabel()}</strong>
                  </div>
                  <div>
                    <span>시간</span>
                    <strong>{this.captureDurationLabel()}</strong>
                  </div>
                  <div>
                    <span>필터</span>
                    <strong title={this.filterSummaryLabel()}>{this.filterSummaryLabel()}</strong>
                  </div>
                </div>
              </div>

              <div className={classes.captureCautionCard}>
                <strong>캡처 시 유의사항</strong>
                <ul>
                  <li>캡처 중에는 성능에 영향을 줄 수 있습니다.</li>
                  <li>캡처 파일에는 민감한 정보가 포함될 수 있습니다.</li>
                  <li>필요한 시간만 짧게 캡처하세요.</li>
                </ul>
              </div>

              <Accordion className={classes.captureHelpAccordion}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3">간단 캡처 도움말</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <div>
                    <p>간단 캡처는 대상 정보를 확인하고 안전한 기본값으로 캡처를 시작합니다.</p>
                    <p>캡처 완료 후 오른쪽 상세 패널에서 결과 상태를 확인할 수 있습니다.</p>
                    <p>필요하면 고급 옵션에서 세부 설정을 변경할 수 있습니다.</p>
                  </div>
                </AccordionDetails>
              </Accordion>
            </aside>
          </div>
        } />

        <Snackbar
          open={this.state.snackbarOpen}
          autoHideDuration={4000}
          onClose={() => this.setState({ snackbarOpen: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={() => this.setState({ snackbarOpen: false })} severity={this.state.snackbarSeverity}>
            {this.state.snackbarMessage}
          </Alert>
        </Snackbar>
      </>
    )
  }
}

export const mapStateToProps = (state: AppState) => ({
  session: state.session
})

export const mapDispatchToProps = ({ })

export default withStyles(styles)(connect(mapStateToProps, mapDispatchToProps)(CaptureForm))
