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

function Alert(props) {
  return <MuiAlert elevation={6} variant="filled" {...props} />
}

interface Props {
  classes: any
  defaultName: string
  gremlin: string
  session: session
  onCaptureCreated?: () => void
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
  snackbarOpen: boolean
  snackbarMessage: string
  snackbarSeverity: "success" | "error"
}

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
      description: ""
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

  private isCaptureDisabled(node?: Node): boolean {
    const type = this.nodeType(node)
    const manager = typeof node?.data?.Manager === "string" ? node.data.Manager.toLowerCase() : ""
    const disallowedTypes = ["switch", "switchport", "host", "libvirt", "tuntap", "system", "ovsbridge"]

    return manager === "k8s" || !node?.data?.TID || disallowedTypes.includes(type) || this.eligibleCaptureTypes(node).length === 0
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

  handleChange = (field: keyof State) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    this.setState({ [field]: value } as Pick<State, keyof State>)
  }

  onClick = async () => {
    const captureType = this.state.captureType || this.defaultCaptureType(this.props.node)

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

    if (captureType !== "pcap" && this.state.bpf.trim() !== "") {
      this.setState({
        snackbarOpen: true,
        snackbarMessage: translate("bpf-pcap-only"),
        snackbarSeverity: "error"
      });
      return;
    }

    try {
      const conf = new Configuration({
        basePath: this.props.session.endpoint + "/api",
        accessToken: this.props.session.token
      })
      const api = new CapturesApi(conf)

      const payload = {
        GremlinQuery: this.props.gremlin,
        Name: this.state.name,
        Description: this.state.description,
        BPFFilter: this.state.bpf,
        Type: captureType,
        LayerKeyMode: this.state.layerKey,
        HeaderSize: this.state.headerSize ? parseInt(this.state.headerSize, 10) : undefined,
        RawPacketLimit: this.state.rawPacketLimit ? parseInt(this.state.rawPacketLimit, 10) : 0,
        ExtraTCPMetric: this.state.extraTCPMetric,
        IPDefrag: this.state.defragIPv4,
        ReassembleTCP: this.state.reassembleTCP
      }

      await api.createCapture(payload as any)

      // 캡처 성공 시 부모 콜백 호출
      this.setState({
        snackbarOpen: true,
        snackbarMessage: translate("capture-create-success"),
        snackbarSeverity: "success"
      })
      
      if (this.props.onCaptureCreated) {
        this.props.onCaptureCreated()
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

    const isCaptureDisabled = this.isCaptureDisabled(this.props.node)
    const isPcapEligible = this.isCaptureTypeEligible(this.props.node, "pcap")
    const isAfpacketEligible = this.isCaptureTypeEligible(this.props.node, "afpacket")
    const isSflowEligible = this.isCaptureTypeEligible(this.props.node, "sflow")
    const isDPDKPort = this.isCaptureTypeEligible(this.props.node, "dpdk")
    const isOvsMirrorEligible = this.isCaptureTypeEligible(this.props.node, "ovsmirror")
    const defaultCaptureType = this.defaultCaptureType(this.props.node)
    const captureType = this.state.captureType || defaultCaptureType
    const hasValidationError = !this.isHeaderSizeValid() || !this.isRawPacketLimitValid()

    return (
      <>
        <Panel icon={<VideocamIcon />} title={translate("Packet capture")} content={
          <>
            <TextField
              label={translate("Name")}
              className={classes.textField}
              fullWidth
              margin="normal"
              value={this.state.name}
              onChange={this.handleChange("name")}
            />
            <TextField
              label={translate("Description")}
              className={classes.textField}
              fullWidth
              multiline
              margin="normal"
              value={this.state.description}
              onChange={this.handleChange("description")}
            />
            <TextField
              label={translate("Filter (BPF)")}
              className={classes.textField}
              fullWidth
              margin="normal"
              value={this.state.bpf}
              onChange={this.handleChange("bpf")}
            />
            <Accordion className={classes.advanced}>
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
                      label={translate("Capture Type")}
                    >
                      {isPcapEligible ? (
                        <MenuItem value="pcap">
                          <Tooltip title={translate("tooltip-pcap")} placement="right" arrow>
                            <span>PCAP</span>
                          </Tooltip>
                        </MenuItem>
                      ) : (
                        <Tooltip title={translate("tooltip-pcap-unavailable")} placement="right" arrow>
                          <span>
                            <MenuItem value="pcap" disabled>PCAP</MenuItem>
                          </span>
                        </Tooltip>
                      )}

                      {isAfpacketEligible ? (
                        <MenuItem value="afpacket">
                          <Tooltip title={translate("tooltip-afpacket")} placement="right" arrow>
                            <span>AFPacket</span>
                          </Tooltip>
                        </MenuItem>
                      ) : (
                        <Tooltip title={translate("tooltip-afpacket-unavailable")} placement="right" arrow>
                          <span>
                            <MenuItem value="afpacket" disabled>AFPacket</MenuItem>
                          </span>
                        </Tooltip>
                      )}

                      {/* <MenuItem value="ebpf">
                        <Tooltip title={translate("tooltip-ebpf")} placement="right" arrow>
                          <span>eBPF</span>
                        </Tooltip>
                      </MenuItem> */}

                      {isSflowEligible ? (
                        <MenuItem value="sflow">
                          <Tooltip title={translate("tooltip-sflow")} placement="right" arrow>
                            <span>sFlow</span>
                          </Tooltip>
                        </MenuItem>
                      ) : (
                        <Tooltip
                          title={translate("sflow-unavailable-no")}
                          placement="right"
                          arrow
                        >
                          <span>
                            <MenuItem value="sflow" disabled>
                              sFlow
                            </MenuItem>
                          </span>
                        </Tooltip>
                      )}

                      {isDPDKPort ? (
                        <MenuItem value="dpdk">
                          <Tooltip title={translate("tooltip-dpdk")} placement="right" arrow>
                            <span>DPDK</span>
                          </Tooltip>
                        </MenuItem>
                      ) : (
                        <Tooltip
                          title={translate("dpdk-unavailable")}
                          placement="right"
                          arrow
                        >
                          <span>
                            <MenuItem value="dpdk" disabled>
                              DPDK
                            </MenuItem>
                          </span>
                        </Tooltip>
                      )}
                      
                      {isOvsMirrorEligible ? (
                        <MenuItem value="ovsmirror">OVS Mirror</MenuItem>
                      ) : (
                        <Tooltip
                          title={translate("ovs-mirror-only")}
                          placement="right"
                          arrow
                        >
                          <span>
                            <MenuItem value="ovsmirror" disabled>
                              OVS Mirror
                            </MenuItem>
                          </span>
                        </Tooltip>
                      )}
                    </Select>
                  </FormControl>
                  <FormControl variant="outlined" fullWidth className={classes.control}>
                    <InputLabel id="layer-key-label">{translate("Layers used for Flow Key")}</InputLabel>
                    <Select
                      id="layer-key"
                      labelId="layer-key-label"
                      value={this.state.layerKey}
                      onChange={this.handleChange("layerKey")}
                      label={translate("Layers used for Flow Key")}
                    >
                      <MenuItem value="L2">L2</MenuItem>
                      <MenuItem value="L3">L3</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label={translate("Header size")}
                    type="number"
                    value={this.state.headerSize}
                    onChange={this.handleChange("headerSize")}
                    error={
                      !!this.state.headerSize &&
                      !this.isHeaderSizeValid()
                    }
                    helperText={
                      !!this.state.headerSize &&
                      !this.isHeaderSizeValid()
                        ? translate("capture-headerSize-validation-error")
                        : ""
                    }
                    fullWidth
                    margin="normal"
                  />
                  <FormControl component="fieldset" className={classes.control}>
                    <Tooltip title={translate("capture-extraTCPMetric-tooltip")} arrow>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={this.state.extraTCPMetric}
                            onChange={this.handleChange("extraTCPMetric")}
                            color="primary"
                          />
                        }
                        label={translate("Extra TCP metric")}
                      />
                    </Tooltip>
                    <Tooltip title={translate("capture-IPDefrag-tooltip")} arrow>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={this.state.defragIPv4}
                            onChange={this.handleChange("defragIPv4")}
                            color="primary"
                          />
                        }
                        label={translate("Defragment IPv4 packets")}
                      />
                    </Tooltip>
                    <Tooltip title={translate("capture-reassembleTCP-tooltip")} arrow>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={this.state.reassembleTCP}
                            onChange={this.handleChange("reassembleTCP")}
                            color="primary"
                          />
                        }
                        label={translate("Reassemble TCP packets")}
                      />
                    </Tooltip>
                  </FormControl>
                  <FormControl fullWidth>
                    <TextField
                      label={
                        <span style={{ display: "flex", alignItems: "center" }}>
                          {translate("Raw packet limit")}
                          <HelpIconWithDialog topic="raw-packet-limit" />
                        </span>
                      }
                      type="number"
                      value={this.state.rawPacketLimit}
                      onChange={this.handleChange("rawPacketLimit")}
                      error={
                        !!this.state.rawPacketLimit &&
                        !this.isRawPacketLimitValid()
                      }
                      helperText={
                        !!this.state.rawPacketLimit &&
                        !this.isRawPacketLimitValid()
                          ? translate("capture-rawPacketLimit-validation-error")
                          : ""
                      }
                      fullWidth
                      margin="normal"
                    />
                  </FormControl>
                </div>
              </AccordionDetails>
            </Accordion>
            <Button
              variant="contained"
              className={classes.button}
              color="primary"
              onClick={this.onClick}
              disabled={isCaptureDisabled || hasValidationError}
            >
              {translate("Start")}
            </Button>
          </>
        } />

        <Snackbar
          open={this.state.snackbarOpen}
          autoHideDuration={4000}
          onClose={() => this.setState({ snackbarOpen: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => this.setState({ snackbarOpen: false })}
            severity={this.state.snackbarSeverity}
          >
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
