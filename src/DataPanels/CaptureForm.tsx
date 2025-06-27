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
      captureType: "pcap",
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

  handleChange = (field: keyof State) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    this.setState({ [field]: value } as Pick<State, keyof State>)
  }

  onClick = async () => {
    if (this.state.captureType !== "pcap" && this.state.bpf.trim() !== "") {
      this.setState({
        snackbarOpen: true,
        snackbarMessage: "BPF 필터는 PCAP 캡처 경우에만 지원됩니다.",
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
        Type: this.state.captureType,
        LayerKeyMode: this.state.layerKey,
        HeaderSize: this.state.headerSize ? parseInt(this.state.headerSize) : undefined,
        RawPacketLimit: this.state.rawPacketLimit ? parseInt(this.state.rawPacketLimit) : 0,
        ExtraTCPMetric: this.state.extraTCPMetric,
        IPDefrag: this.state.defragIPv4,
        ReassembleTCP: this.state.reassembleTCP
      }

      const result = await api.createCapture(payload as any)
      console.log("Capture created:", result)

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
                      value={this.state.captureType}
                      onChange={this.handleChange("captureType")}
                      label={translate("Capture Type")}
                    >
                      <MenuItem value="pcap">PCAP</MenuItem>
                      <MenuItem value="afpacket">AFPacket</MenuItem>
                      <MenuItem value="ebpf">eBPF</MenuItem>
                      <MenuItem value="sflow">sFlow</MenuItem>
                      <MenuItem value="dpdk">DPDK</MenuItem>
                      <MenuItem value="ovsmirror">OVS Mirror</MenuItem>
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
                      (parseInt(this.state.headerSize) < 14 || parseInt(this.state.headerSize) > 4096)
                    }
                    helperText={
                      !!this.state.headerSize &&
                      (parseInt(this.state.headerSize) < 14 || parseInt(this.state.headerSize) > 4096)
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
                  <FormControl>
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
                        !(
                          parseInt(this.state.rawPacketLimit) === 0 ||
                          (parseInt(this.state.rawPacketLimit) > 0 &&
                           parseInt(this.state.rawPacketLimit) <= 10)
                        )
                      }
                      helperText={
                        !!this.state.rawPacketLimit &&
                        !(
                          parseInt(this.state.rawPacketLimit) === 0 ||
                          (parseInt(this.state.rawPacketLimit) > 0 &&
                           parseInt(this.state.rawPacketLimit) <= 10)
                        )
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
