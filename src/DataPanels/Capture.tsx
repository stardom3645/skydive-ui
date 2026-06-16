/*
 * Copyright (C) 2020 Sylvain Afchain
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
import { withStyles } from '@material-ui/core/styles'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'

import CaptureForm from "./CaptureForm"
import { styles } from './CaptureStyles'
import { Node, Link } from '../Topology'
import ConfigReducer from '../Config'

interface Props {
    classes: any
    el: Node | Link
    expanded: boolean
    config: ConfigReducer
    onClose: () => void
}

export class CapturePanel extends React.Component<Props> {

    constructor(props: Props) {
        super(props)
    }

    private dataAttrs(el: Node | Link): any {
        if (el.type === 'node') {
            return this.props.config.nodeAttrs(el)
        } else {
            return this.props.config.linkAttrs(el)
        }
    }

    render() {
        var classes = this.props.classes

        if (this.props.el.type !== 'node') {
            return null
        }

        const node = this.props.el as Node

        return (
            <Dialog
                open={this.props.expanded}
                onClose={this.props.onClose}
                maxWidth="lg"
                fullWidth
                classes={{ paper: classes.dialogPaper }}
                aria-labelledby="capture-wizard-dialog">
                <IconButton
                    className={classes.closeButton}
                    aria-label="close"
                    onClick={this.props.onClose}>
                    <CloseIcon />
                </IconButton>
                <DialogContent className={classes.dialogContent}>
                    <CaptureForm defaultName={this.dataAttrs(node).name} gremlin={`G.V().Has('TID', '${node.data.TID}')`} node={node} onCaptureCreated={this.props.onClose} />
                </DialogContent>
            </Dialog>
        )
    }
}

export default withStyles(styles)(CapturePanel)
