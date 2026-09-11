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
import { Modal } from 'antd'
import { VideoCameraOutlined } from '@ant-design/icons'

import CaptureForm from "./CaptureForm"
import { styles } from './CaptureStyles'
import { Node, Link } from '../Topology'
import ConfigReducer, { translate } from '../Config'
import { SimpleCaptureSession } from './CaptureStatus'

interface Props {
    classes: any
    el: Node | Link
    expanded: boolean
    config: ConfigReducer
    onClose: () => void
    onCaptureCreated?: (node: Node, capture?: SimpleCaptureSession) => void
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
            <Modal
                visible={this.props.expanded}
                onCancel={this.props.onClose}
                width={1120}
                footer={null}
                style={{ top: 72 }}
                destroyOnClose
                wrapClassName={classes.dialogRoot}
                title={<span className={classes.dialogTitle}><VideoCameraOutlined /><span>{translate("Packet capture")}</span></span>}
                aria-labelledby="capture-wizard-dialog">
                <CaptureForm
                    defaultName={this.dataAttrs(node).name}
                    gremlin={`G.V().Has('TID', '${node.data.TID}')`}
                    node={node}
                    onCaptureCreated={(capture) => {
                        if (this.props.onCaptureCreated) {
                            this.props.onCaptureCreated(node, capture)
                        }
                        this.props.onClose()
                    }}
                />
            </Modal>
        )
    }
}

export default withStyles(styles)(CapturePanel)
