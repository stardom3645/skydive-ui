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
import HelpIconWithDialog from './HelpIconWithDialog'
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
  showDetails: boolean
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
      showDetails: false,
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
      showAdvanced: false,
      showDetails: false
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
        case "node": return "Kubernetes Node"
        case "pod": return "Pod"
        case "service": return "Service"
        case "namespace": return "Namespace"
        case "daemonset": return "DaemonSet"
        case "deployment": return "Deployment"
        case "cluster": return "Cluster"
        default: return "Kubernetes"
      }
    }

    switch (type) {
      case "host": return "Host"
      case "device": return "Interface"
      case "bond": return "Bond"
      case "bridge": return "Bridge"
      case "ovsport": return "OVS Port"
      case "dpdkport": return "DPDK Port"
      case "port": return "Port"
      case "internal": return "Interface"
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

  private recommendedCaptureType(node?: Node): string {
    const types = this.eligibleCaptureTypes(node)
    if (types.includes("pcap")) return "pcap"
    return types[0] || ""
  }

  private captureDurationSeconds(): number {
    switch (this.state.captureDuration) {
      case "1m": return 60
      case "3m": return 180
      default: return 30
    }
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
    const targetRows = this.targetInfoRows(this.props.node)
    const statusClass = capability === "available" ? classes.statusAvailable : capability === "conditional" ? classes.statusConditional : classes.statusUnavailable
    const StatusIcon = capability === "available" ? CheckCircleIcon : capability === "conditional" ? WarningIcon : ErrorOutlineIcon
    const statusSummary = capability === "available"
      ? "이 대상은 기본 패킷 캡처를 사용할 수 있습니다."
      : capability === "conditional"
        ? "이 대상은 관련 인프라 노드에서 캡처하는 정책을 권장합니다."
        : "이 리소스는 직접 캡처 대상이 아닙니다."

    return (
      <>
        <Panel icon={<VideocamIcon />} title={translate("Packet capture")} content={
          <div className={classes.captureWizard}>
            <aside className={classes.wizardSteps}>
              {[
                ["1", "대상 확인", "자동 진단"],
                ["2", "캡처 설정", "간단 설정"]
              ].map((step, index) => (
                <div key={step[0]} className={`${classes.wizardStep} ${classes.wizardStepActive}`}>
                  <span className={classes.wizardStepCircle}>{step[0]}</span>
                  <span>
                    <strong>{step[1]}</strong>
                    <small>{step[2]}</small>
                  </span>
                </div>
              ))}
              <div className={classes.wizardWarningCard}>
                <WarningIcon />
                <span>패킷 캡처는 네트워크 성능에 영향을 줄 수 있습니다.</span>
              </div>
            </aside>

            <section className={classes.wizardMain}>
              <div className={classes.wizardMainCard}>
                <div className={classes.wizardCardHeader}>
                  <div>
                    <Typography component="h3" className={classes.wizardTitle}>1. 대상 확인</Typography>
                    <Typography component="p" className={classes.wizardSubtitle}>선택한 노드의 캡처 가능 여부를 확인합니다.</Typography>
                  </div>
                  <span className={`${classes.captureStatusBadge} ${statusClass}`}>
                    <StatusIcon fontSize="small" />
                    {capability === "available" ? "캡처 가능" : capability === "conditional" ? "조건부 가능" : "직접 캡처 불가"}
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
                    <div className={`${classes.targetStatusLine} ${statusClass}`}>
                      <StatusIcon fontSize="small" />
                      <span>{statusSummary}</span>
                    </div>
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
                    <TextField
                      label={translate("Filter (BPF)")}
                      className={classes.textField}
                      fullWidth
                      margin="normal"
                      placeholder="예: tcp port 22"
                      value={this.state.bpf}
                      onChange={this.handleChange("bpf")}
                    />
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
                      <Typography className={classes.heading}>{translate("Advanced options")}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <div style={{ width: "100%" }}>
                        <FormControl variant="outlined" fullWidth className={classes.control}>
                          <InputLabel id="capture-type-label">{translate("Capture Type")}</InputLabel>
                          <Select
                            id="capture-type"
                            labelId="capture-type-label"
                            value={captureType}
                            onChange={this.handleChange("captureType")}
                            label={translate("Capture Type")}>
                            {isPcapEligible ? <MenuItem value="pcap">PCAP</MenuItem> : <MenuItem value="pcap" disabled>PCAP</MenuItem>}
                            {isAfpacketEligible ? <MenuItem value="afpacket">AFPacket</MenuItem> : <MenuItem value="afpacket" disabled>AFPacket</MenuItem>}
                            {isSflowEligible ? <MenuItem value="sflow">sFlow</MenuItem> : <MenuItem value="sflow" disabled>sFlow</MenuItem>}
                            {isDPDKPort ? <MenuItem value="dpdk">DPDK</MenuItem> : <MenuItem value="dpdk" disabled>DPDK</MenuItem>}
                            {isOvsMirrorEligible ? <MenuItem value="ovsmirror">OVS Mirror</MenuItem> : <MenuItem value="ovsmirror" disabled>OVS Mirror</MenuItem>}
                          </Select>
                        </FormControl>
                        <FormControl variant="outlined" fullWidth className={classes.control}>
                          <InputLabel id="layer-key-label">{translate("Layers used for Flow Key")}</InputLabel>
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
                        <TextField
                          label={translate("Header size")}
                          type="number"
                          value={this.state.headerSize}
                          onChange={this.handleChange("headerSize")}
                          error={!!this.state.headerSize && !this.isHeaderSizeValid()}
                          helperText={!!this.state.headerSize && !this.isHeaderSizeValid() ? translate("capture-headerSize-validation-error") : ""}
                          fullWidth
                          margin="normal"
                        />
                        <FormControl component="fieldset" className={classes.control}>
                          <Tooltip title={translate("capture-extraTCPMetric-tooltip")} arrow>
                            <FormControlLabel control={<Checkbox checked={this.state.extraTCPMetric} onChange={this.handleChange("extraTCPMetric")} color="primary" />} label={translate("Extra TCP metric")} />
                          </Tooltip>
                          <Tooltip title={translate("capture-IPDefrag-tooltip")} arrow>
                            <FormControlLabel control={<Checkbox checked={this.state.defragIPv4} onChange={this.handleChange("defragIPv4")} color="primary" />} label={translate("Defragment IPv4 packets")} />
                          </Tooltip>
                          <Tooltip title={translate("capture-reassembleTCP-tooltip")} arrow>
                            <FormControlLabel control={<Checkbox checked={this.state.reassembleTCP} onChange={this.handleChange("reassembleTCP")} color="primary" />} label={translate("Reassemble TCP packets")} />
                          </Tooltip>
                        </FormControl>
                        <FormControl fullWidth>
                          <TextField
                            label={<span style={{ display: "flex", alignItems: "center" }}>{translate("Raw packet limit")}<HelpIconWithDialog topic="raw-packet-limit" /></span>}
                            type="number"
                            value={this.state.rawPacketLimit}
                            onChange={this.handleChange("rawPacketLimit")}
                            error={!!this.state.rawPacketLimit && !this.isRawPacketLimitValid()}
                            helperText={!!this.state.rawPacketLimit && !this.isRawPacketLimitValid() ? translate("capture-rawPacketLimit-validation-error") : ""}
                            fullWidth
                            margin="normal"
                          />
                        </FormControl>
                      </div>
                    </AccordionDetails>
                  </Accordion>
                }
              </div>

              <Accordion className={classes.captureExamples}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" className={classes.wizardTitle}>대상 유형별 캡처 정책 보기</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <div className={classes.exampleGrid}>
                    <div><span>Host / Interface / Bridge</span><strong>직접 캡처 가능</strong><small>선택한 인프라 노드에서 캡처합니다.</small></div>
                    <div><span>Kubernetes Node</span><strong>조건부 가능</strong><small>연결된 인프라 노드 기준 캡처를 권장합니다.</small></div>
                    <div><span>Pod</span><strong>조건부 가능</strong><small>Pod가 실행 중인 Node 매핑이 필요합니다.</small></div>
                    <div><span>Service / Namespace / DaemonSet</span><strong>직접 캡처 불가</strong><small>관련 Pod 또는 Node를 먼저 확인합니다.</small></div>
                  </div>
                </AccordionDetails>
              </Accordion>
            </section>

            <aside className={classes.wizardHelpPanel}>
              <div className={classes.helpCard}>
                <HelpOutlineIcon />
                <strong>간단 캡처 마법사란?</strong>
                <p>복잡한 옵션 없이 빠르게 패킷을 캡처할 수 있도록 대상 정보를 진단하고 안전한 기본값을 추천합니다.</p>
              </div>
              <div className={classes.helpCard}>
                <strong>이렇게 동작합니다</strong>
                <ol>
                  <li>대상 정보를 진단합니다.</li>
                  <li>기본 옵션으로 캡처를 시작합니다.</li>
                  <li>진행 상태는 상세 패널에서 확인합니다.</li>
                </ol>
              </div>
              <div className={classes.helpCard}>
                <strong>API 권장 구조</strong>
                <p>간단 캡처는 Simple Capture API를 사용하고, 전문 옵션이 필요한 경우에만 기존 Capture API를 유지합니다.</p>
              </div>
              <div className={classes.helpNotice}>
                <strong>캡처 시 유의사항</strong>
                <span>권한, 성능 영향, 저장 공간, 민감정보 포함 여부를 확인하세요.</span>
              </div>
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
