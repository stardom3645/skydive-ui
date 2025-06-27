// src/components/HelpIconWithDialog.tsx

import * as React from 'react'
import { IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText } from '@material-ui/core'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'
import { translate } from "../Config"

interface Props {
  topic: string
}

export default function HelpIconWithDialog({ topic }: Props) {
  const [open, setOpen] = React.useState(false)
  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)

  const getContent = () => {
    switch (topic) {
      case "raw-packet-limit":
        return (
          <>
            <DialogTitle>{translate("Raw packet limit")}</DialogTitle>
            <DialogContent>
              <DialogContentText>
                {translate("capture-rawPacketLimit-explained")}
              </DialogContentText>
            </DialogContent>
          </>
        )

      case "header-size":
        return (
          <>
            <DialogTitle>{translate("Header size")}</DialogTitle>
            <DialogContent>
              <DialogContentText>
                {translate("capture-headerSize-explained")}
              </DialogContentText>
            </DialogContent>
          </>
        )

      case "capture-type":
        return (
          <>
            <DialogTitle>{translate("Capture Type")}</DialogTitle>
            <DialogContent>
              <DialogContentText component="div">
                <ul style={{ paddingLeft: 16 }}>
                  <li><b>PCAP:</b> {translate("capture-type-pcap")}</li>
                  <li><b>AFPacket:</b> {translate("capture-type-afpacket")}</li>
                  <li><b>eBPF:</b> {translate("capture-type-ebpf")}</li>
                  <li><b>sFlow:</b> {translate("capture-type-sflow")}</li>
                  <li><b>DPDK:</b> {translate("capture-type-dpdk")}</li>
                  <li><b>OVS Mirror:</b> {translate("capture-type-ovsmirror")}</li>
                </ul>
              </DialogContentText>
            </DialogContent>
          </>
        )

      default:
        return null
    }
  }

  return (
    <>
      <Tooltip title={translate(`${topic}-tooltip`)} arrow>
        <IconButton
          size="small"
          onClick={handleOpen}
          style={{ marginLeft: 4, padding: 4 }}
        >
          <HelpOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={handleClose}>
        {getContent()}
      </Dialog>
    </>
  )
}
