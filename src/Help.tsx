import * as React from 'react'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'

import { translate } from "./Config"

export interface HelpProps {
    open: boolean
    onClose: () => void
}

export default function HelpDialog(props: HelpProps) {
    const { open, onClose } = props

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle> {translate("help")} </DialogTitle>
            <DialogContent>
                <div style={{ minWidth: 400 }}>
                    <DialogContentText>
                        {translate("netTopologyPageDescription")}
                    </DialogContentText>
                    <DialogContentText>
                        {translate("searchByNodeNameExample")}
                    </DialogContentText>
                    <DialogContentText>
                        {translate("filterByLinkType")}
                    </DialogContentText>
                    <DialogContentText>
                        {translate("moreInfoIntro")}&nbsp;
                        <a href="https://docs.ablecloud.io/latest/administration/wall/netdive-guide/" 
                           target="_blank" 
                           rel="noopener noreferrer">
                           ABLESTACK Online Docs
                          </a>
                          {translate("moreInfoOutro")}
                    </DialogContentText>
                </div>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary" autoFocus>
                    닫기
                </Button>
            </DialogActions>
        </Dialog>
    )
}
