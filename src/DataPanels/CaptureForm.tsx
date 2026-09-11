import * as React from 'react'
import { withStyles } from '@material-ui/core/styles'
import { Alert, Button, Card, Checkbox, Collapse, Descriptions, Form, Input, Radio, Select, Tag } from 'antd'
import {
  CheckCircleFilled,
  CheckCircleOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  VideoCameraOutlined,
  WarningOutlined
} from '@ant-design/icons'

import { Node } from '../Topology'
import { Configuration } from '../api/configuration'
import { CapturesApi } from '../api'
import { styles } from './CaptureFormStyles'
import { AppState, session } from '../Store'
import { connect } from 'react-redux'
import { translate } from "../Config"
import { SimpleCaptureSession } from './CaptureStatus'

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
  private feedbackTimer?: number

  constructor(props) {
    super(props)

    this.state = {
      name: props.defaultName || "",
      description: "",
      bpf: "",
      captureType: this.defaultCaptureType(props.node),
      layerKey: "L3",
      headerSize: "",
      rawPacketLimit: "10",
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

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.snackbarOpen && !prevState.snackbarOpen) {
      if (this.feedbackTimer) {
        window.clearTimeout(this.feedbackTimer)
      }
      this.feedbackTimer = window.setTimeout(() => {
        this.setState({ snackbarOpen: false })
      }, 4000)
    }

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
      rawPacketLimit: "10",
      showAdvanced: false
    })
  }

  componentWillUnmount() {
    if (this.feedbackTimer) {
      window.clearTimeout(this.feedbackTimer)
    }
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

    return rows
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
      this.state.rawPacketLimit !== "10" ||
      this.state.extraTCPMetric ||
      this.state.defragIPv4 ||
      this.state.reassembleTCP
  }

  private captureTypeDescription(captureType: string): string {
    switch (captureType) {
      case "afpacket": return "Linux 패킷 소켓 기반 수집 방식입니다. 일반 환경에서는 PCAP을 권장합니다."
      case "sflow": return "샘플링 기반 트래픽 수집 방식입니다."
      case "dpdk": return "고성능 패킷 처리 환경에서 사용하는 방식입니다."
      case "ovsmirror": return "OVS 미러링 기반 캡처 방식입니다."
      case "pcap":
      default: return "일반적인 패킷 캡처 방식입니다. 기본값으로 권장합니다."
    }
  }

  private captureTypeLabel(captureType: string): string {
    switch (captureType) {
      case "afpacket": return "AFPacket"
      case "sflow": return "sFlow"
      case "dpdk": return "DPDK"
      case "ovsmirror": return "OVS Mirror"
      case "pcap":
      default: return "PCAP"
    }
  }

  private renderAdvancedLabel(classes: any, label: string, changed = false) {
    return (
      <span className={classes.advancedOptionLabel}>
        {label}
        {changed && <em>변경됨</em>}
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
          DurationSeconds: this.captureDurationSeconds(),
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
    const capabilityLabel = this.captureCapabilityLabel(capability)
    const capabilityColor = capability === "available" ? "success" : capability === "conditional" ? "warning" : "default"
    const advancedHeader = <span className={classes.advancedTitleRow}>
      <span>{this.state.showAdvanced ? "고급 옵션 숨기기" : "고급 옵션 보기"}</span>
      <Tag color="warning">전문가용</Tag>
      <Tag color={advancedChanged ? "blue" : "success"}>{advancedChanged ? "기본값 변경됨" : "기본값 사용 중"}</Tag>
    </span>
    return (
      <div className={classes.captureWizard}>
        {this.state.snackbarOpen && <Alert
          className={classes.captureFeedback}
          type={this.state.snackbarSeverity === "success" ? "success" : "error"}
          showIcon closable
          message={this.state.snackbarMessage}
          onClose={() => this.setState({ snackbarOpen: false })} />}
            <section className={classes.wizardMain}>
              <div className={classes.wizardMainCard}>
                <div className={classes.wizardCardHeader}>
                  <div>
                    <h3 className={classes.wizardTitle}>대상 확인</h3>
                    <p className={classes.wizardSubtitle}>선택한 노드의 캡처 가능 여부를 확인합니다.</p>
                  </div>
                  <Tag color={capabilityColor} icon={capability === "available" ? <CheckCircleOutlined /> : <WarningOutlined />}>{capabilityLabel}</Tag>
                </div>

                <Card size="small" className={classes.targetCard}>
                  <Descriptions size="small" column={2} colon={false}>
                    <Descriptions.Item label="선택 대상"><strong>{this.props.defaultName || this.props.node?.data?.Name || "-"}</strong></Descriptions.Item>
                    <Descriptions.Item label="자원 타입"><Tag>{this.targetTypeLabel(this.props.node)}</Tag></Descriptions.Item>
                    {targetRows.map(row => <Descriptions.Item key={row.label} label={row.label}><strong title={row.value}>{row.value}</strong></Descriptions.Item>)}
                    <Descriptions.Item label="캡처 가능 여부"><Tag color={capabilityColor}>{capabilityLabel}</Tag></Descriptions.Item>
                  </Descriptions>
                </Card>

                <div className={classes.simpleSettings}>
                  <h3 className={classes.wizardTitle}>캡처 설정</h3>
                  <Alert className={classes.compactAlert} type="info" showIcon message="권장 기본값" description="자동 종료와 안전한 기본 옵션으로 캡처를 시작합니다." />
                  <div className={classes.settingRow}>
                    <div>
                      <strong>캡처 범위</strong>
                      <small>문제 재현 시간을 고려하여 적절한 범위를 선택하세요.</small>
                    </div>
                    <Radio.Group className={classes.optionGroup} value={this.state.captureScope} onChange={event => this.setState({ captureScope: event.target.value })}>
                      <Radio.Button value="related">선택 노드 관련 트래픽</Radio.Button>
                      <Radio.Button value="all">전체 트래픽</Radio.Button>
                    </Radio.Group>
                  </div>

                  <div className={classes.settingRow}>
                    <div>
                      <strong>캡처 시간</strong>
                      <small>설정한 시간이 지나면 자동 종료됩니다.</small>
                    </div>
                    <Radio.Group className={classes.optionGroup} value={this.state.captureDuration} onChange={event => this.setState({ captureDuration: event.target.value })}>
                      <Radio.Button value="30s">30초</Radio.Button><Radio.Button value="1m">1분</Radio.Button><Radio.Button value="3m">3분</Radio.Button>
                    </Radio.Group>
                  </div>

                  <div className={classes.settingRow}>
                    <div>
                      <strong>필터</strong>
                      <small>필요한 경우에만 트래픽 필터를 제한합니다.</small>
                    </div>
                    <Radio.Group className={classes.optionGroup} value={this.state.filterPreset} onChange={event => event.target.value === 'all'
                      ? this.setState({ filterPreset: 'all', bpf: '' })
                      : this.setState({ filterPreset: event.target.value })}>
                      <Radio.Button value="all">전체</Radio.Button>
                      <Radio.Button value="ssh" disabled={!isPcapEligible}>SSH <small>tcp 22</small></Radio.Button>
                      <Radio.Button value="web" disabled={!isPcapEligible}>HTTP/HTTPS <small>80/443</small></Radio.Button>
                      <Radio.Button value="custom" disabled={!isPcapEligible}>직접 입력</Radio.Button>
                    </Radio.Group>
                  </div>

                  {this.state.filterPreset === "custom" &&
                    <Form.Item className={classes.inlineFieldCard} label="직접 입력 BPF">
                      <Input placeholder="예: tcp port 22" value={this.state.bpf} onChange={this.handleChange("bpf")} />
                    </Form.Item>
                  }
                </div>

                <div className={classes.wizardActions}>
                  <Button
                    type="text"
                    className={classes.advancedToggle}
                    onClick={() => this.setState({ showAdvanced: !this.state.showAdvanced })}>
                    {this.state.showAdvanced ? "고급 옵션 숨기기" : "고급 옵션 보기"}
                  </Button>
                  <Button
                    type="primary"
                    className={classes.button}
                    onClick={this.onClick}
                    disabled={isCaptureDisabled || hasValidationError || capability !== "available"}
                    icon={<PlayCircleOutlined />}>
                    캡처 시작
                  </Button>
                </div>

                <Collapse className={classes.advanced} activeKey={this.state.showAdvanced ? ['advanced'] : []}
                  onChange={keys => this.setState({ showAdvanced: (keys as string[]).includes('advanced') })}>
                  <Collapse.Panel key="advanced" header={advancedHeader}>
                      <div className={classes.advancedContent}>
                        <Alert className={classes.compactAlert} type="warning" showIcon message="전문가용 옵션입니다. 일반적인 캡처는 기본값을 권장합니다. 옵션을 변경하면 캡처 결과, 성능, 파일 크기에 영향을 줄 수 있습니다." />

                        <section className={classes.advancedSection}>
                          <header>
                            <strong>수집 방식</strong>
                            <small>패킷을 어떤 방식과 기준으로 수집할지 설정합니다.</small>
                          </header>
                          <Form className={classes.advancedForm} layout="vertical" colon={false}>
                          <div className={classes.advancedGrid}>
                            <Form.Item className={classes.advancedOptionBlock} label={this.renderAdvancedLabel(classes, translate("Capture Type"), captureType !== defaultCaptureType)} extra={captureType === defaultCaptureType ? "기본값으로 권장합니다." : this.captureTypeDescription(captureType)}>
                              <Select id="capture-type" value={captureType} optionLabelProp="label" onChange={value => this.setState({ captureType: String(value) })}>
                                {[['pcap', isPcapEligible], ['afpacket', isAfpacketEligible], ['sflow', isSflowEligible], ['dpdk', isDPDKPort], ['ovsmirror', isOvsMirrorEligible]].map(([value, enabled]: [string, boolean]) =>
                                  <Select.Option key={value} value={value} label={this.captureTypeLabel(value)} disabled={!enabled}>
                                    <span className={classes.advancedMenuItem}><strong>{this.captureTypeLabel(value)}</strong><small>{enabled ? this.captureTypeDescription(value) : "현재 환경에서 사용할 수 없습니다."}</small></span>
                                  </Select.Option>)}
                              </Select>
                            </Form.Item>

                            <Form.Item className={classes.advancedOptionBlock} label={this.renderAdvancedLabel(classes, translate("Layers used for Flow Key"), this.state.layerKey !== "L3")} extra="플로우 묶음 기준입니다. 기본값: L3">
                              <Select id="layer-key" value={this.state.layerKey} onChange={value => this.setState({ layerKey: String(value) })}>
                                <Select.Option value="L2">L2</Select.Option><Select.Option value="L3">L3</Select.Option>
                              </Select>
                            </Form.Item>

                            <Form.Item className={classes.advancedOptionBlock} label={this.renderAdvancedLabel(classes, translate("Header size"), this.state.headerSize !== "")}
                              validateStatus={!!this.state.headerSize && !this.isHeaderSizeValid() ? 'error' : undefined}
                              help={!!this.state.headerSize && !this.isHeaderSizeValid() ? translate("capture-headerSize-validation-error") : undefined}
                              extra="저장할 헤더 길이입니다. 비우면 기본값 사용">
                              <Input type="number" placeholder="기본값" value={this.state.headerSize} onChange={this.handleChange("headerSize")} />
                            </Form.Item>

                            <Form.Item className={classes.advancedOptionBlock} label={this.renderAdvancedLabel(classes, translate("Raw packet limit"), this.state.rawPacketLimit !== "10")}
                              extra="PCAP 다운로드용 원시 패킷을 각 flow마다 최대 0~10개 저장합니다. 0은 저장 안 함">
                              <Select id="raw-packet-limit" value={this.state.rawPacketLimit} onChange={value => this.setState({ rawPacketLimit: String(value) })}>
                                {Array.from({ length: 11 }, (_, value) => <Select.Option key={value} value={String(value)}>{value === 0 ? "0 - 저장 안 함" : `${value}개 / flow`}</Select.Option>)}
                              </Select>
                            </Form.Item>
                          </div>
                          </Form>
                        </section>

                        <section className={classes.advancedSection}>
                          <header>
                            <strong>분석 옵션</strong>
                            <small>정확도와 상세 분석을 높일 수 있지만 캡처 부하가 증가할 수 있습니다.</small>
                          </header>
                          <div className={classes.advancedCheckList}>
                            <label>
                              <Checkbox checked={this.state.extraTCPMetric} onChange={this.handleChange("extraTCPMetric")} />
                              <span>
                                <strong>{translate("Extra TCP metric")} <Tag color="warning">성능 영향</Tag>{this.state.extraTCPMetric && <Tag color="blue">변경됨</Tag>}</strong>
                                <small>TCP 지연, 재전송 등 추가 분석 정보를 수집합니다.</small>
                              </span>
                            </label>
                            <label>
                              <Checkbox checked={this.state.defragIPv4} onChange={this.handleChange("defragIPv4")} />
                              <span>
                                <strong>{translate("Defragment IPv4 packets")} <Tag color="warning">성능 영향</Tag>{this.state.defragIPv4 && <Tag color="blue">변경됨</Tag>}</strong>
                                <small>분할된 IPv4 패킷을 다시 조립해 분석합니다.</small>
                              </span>
                            </label>
                            <label>
                              <Checkbox checked={this.state.reassembleTCP} onChange={this.handleChange("reassembleTCP")} />
                              <span>
                                <strong>{translate("Reassemble TCP packets")} <Tag color="warning">성능 영향 · 파일 크기 증가</Tag>{this.state.reassembleTCP && <Tag color="blue">변경됨</Tag>}</strong>
                                <small>TCP 스트림을 재조립해 상위 프로토콜 분석에 활용합니다.</small>
                              </span>
                            </label>
                          </div>
                        </section>
                      </div>
                  </Collapse.Panel>
                </Collapse>
              </div>

              <Collapse className={classes.captureExamples}>
                <Collapse.Panel key="policy" header={translate("capture-target-policy-title")}>
                  <div className={classes.exampleGrid}>
                    <div className={classes.exampleCardAvailable}>
                      <header><strong>{translate("capture-target-policy-capturable-layers")}</strong><Tag color="success">{translate("capture-target-policy-direct")}</Tag></header>
                      <small>{translate("capture-target-policy-infra-desc")}</small>
                    </div>
                    <div className={classes.exampleCardUnavailable}>
                      <header><strong>{translate("capture-target-policy-logical-layers")}</strong><Tag color="warning">{translate("capture-target-policy-unavailable")}</Tag></header>
                      <small>{translate("capture-target-policy-logical-desc")}</small>
                    </div>
                    <div className={classes.exampleCardUnavailable}>
                      <header><strong>{translate("capture-target-policy-k8s-layers")}</strong><Tag color="warning">{translate("capture-target-policy-unavailable")}</Tag></header>
                      <small>{translate("capture-target-policy-k8s-desc")}</small>
                    </div>
                    <div className={classes.exampleCardUnavailable}>
                      <header><strong>{translate("capture-target-policy-k8s-logical-targets")}</strong><Tag color="warning">{translate("capture-target-policy-unavailable")}</Tag></header>
                      <small>{translate("capture-target-policy-k8s-logical-desc")}</small>
                    </div>
                  </div>
                </Collapse.Panel>
              </Collapse>
            </section>

            <aside className={classes.wizardHelpPanel}>
              <Card className={classes.capturePreflightPanel}>
                <div className={classes.preflightPanelHeader}>
                  <strong><InfoCircleOutlined /> 시작 전 확인</strong>
                  <span>현재 캡처 설정을 확인합니다.</span>
                </div>

                <section className={classes.preflightSection}>
                  <div className={classes.sideCardTitle}>
                    <VideoCameraOutlined />
                    <strong>캡처 요약</strong>
                  </div>
                  <Descriptions className={classes.captureSummaryRows} size="small" column={1} colon={false}>
                    <Descriptions.Item label="대상">{this.props.defaultName || this.props.node?.data?.Name || "-"}</Descriptions.Item>
                    <Descriptions.Item label="유형">{this.targetTypeLabel(this.props.node)}</Descriptions.Item>
                    <Descriptions.Item label="범위">{this.captureScopeLabel()}</Descriptions.Item>
                    <Descriptions.Item label="시간">{this.captureDurationLabel()}</Descriptions.Item>
                    <Descriptions.Item label="필터"><span title={this.filterSummaryLabel()}>{this.filterSummaryLabel()}</span></Descriptions.Item>
                  </Descriptions>
                </section>

                <Alert className={classes.captureCautionCard} type="warning" showIcon message="캡처 시 유의사항" description={<ul>
                    <li>캡처 중에는 성능에 영향을 줄 수 있습니다.</li>
                    <li>캡처 파일에는 민감한 정보가 포함될 수 있습니다.</li>
                    <li>필요한 시간만 짧게 캡처하세요.</li>
                  </ul>} />

                <Collapse className={classes.captureHelpAccordion}>
                  <Collapse.Panel key="help" header="캡처 도움말">
                    <div className={classes.captureHelpList}>
                      <div>
                        <CheckCircleFilled />
                        <span>
                          <strong>대상 정보 확인</strong>
                          <small>선택한 대상 정보를 확인합니다.</small>
                        </span>
                      </div>
                      <div>
                        <CheckCircleFilled />
                        <span>
                          <strong>권장 기본값 사용</strong>
                          <small>안전한 기본값으로 캡처를 시작합니다.</small>
                        </span>
                      </div>
                      <div>
                        <CheckCircleFilled />
                        <span>
                          <strong>결과 확인</strong>
                          <small>완료 후 오른쪽 상세 패널에서 요약과 상태를 확인합니다.</small>
                        </span>
                      </div>
                    </div>
                  </Collapse.Panel>
                </Collapse>
              </Card>
            </aside>
      </div>
    )
  }
}

export const mapStateToProps = (state: AppState) => ({
  session: state.session
})

export const mapDispatchToProps = ({ })

export default withStyles(styles)(connect(mapStateToProps, mapDispatchToProps)(CaptureForm))
