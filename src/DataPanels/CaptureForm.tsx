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

function Alert(props) {
  return <MuiAlert elevation={6} variant="filled" {...props} />
}

interface Props {
  classes: any
  defaultName: string
  gremlin: string
  session: session
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
      snackbarMessage: ""
    }
  }

  handleChange = (field: keyof State) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    this.setState({ [field]: value } as Pick<State, keyof State>)
  }

  onClick = async () => {
    if (this.state.captureType === "ebpf" && this.state.bpf.trim() !== "") {
      this.setState({
        snackbarOpen: true,
        snackbarMessage: "eBPF 캡처는 BPF 필터를 지원하지 않습니다."
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
        IPDefragment: this.state.defragIPv4,
        TCPreassembly: this.state.reassembleTCP
      }

      console.log("Payload:", payload)

      const result = await api.createCapture(payload as any)
      console.log("Capture created:", result)
    } catch (err) {
      this.setState({
        snackbarOpen: true,
        snackbarMessage: "캡처 생성 실패: " + err.message
      });
      console.error("Capture creation failed:", err)
    }
  }

  render() {
    const { classes } = this.props

    return (
      <>
        <Panel icon={<VideocamIcon />} title={translate("Packet capture")} content={
          <React.Fragment>
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
                  fullWidth
                  margin="normal"
                  value={this.state.headerSize}
                  onChange={this.handleChange("headerSize")}
                />
                <FormControl component="fieldset" className={classes.control}>
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
                </FormControl>
                <TextField
                  label={translate("Raw packet limit")}
                  fullWidth
                  margin="normal"
                  value={this.state.rawPacketLimit}
                  onChange={this.handleChange("rawPacketLimit")}
                />
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
          </React.Fragment>
        } />

        <Snackbar
          open={this.state.snackbarOpen}
          autoHideDuration={4000}
          onClose={() => this.setState({ snackbarOpen: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => this.setState({ snackbarOpen: false })} severity="error">
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
