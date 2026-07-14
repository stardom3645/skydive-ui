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
import { Button, Tooltip } from 'antd'
import { VideoCameraOutlined } from '@ant-design/icons'

import { styles } from '../DataPanels/PanelStyles'
import { Node, Link } from '../Topology'
import { translate } from '../Config'

interface Props {
    el: Node | Link
    onClick: (el: Node | Link) => void
}

export class CapturePanel extends React.Component<Props> {

    constructor(props) {
        super(props)
    }

    render() {
        return (
            <React.Fragment>
                {
                    this.props.el.type === 'node' &&
                    <Tooltip title={translate("Packet capture")}>
                        <Button
                            type="text"
                            shape="circle"
                            className="netdive-action-icon-button"
                            aria-label={translate("Packet capture")}
                            icon={<VideoCameraOutlined />}
                            onClick={() => this.props.onClick(this.props.el)}
                        />
                    </Tooltip>
                }
            </React.Fragment>
        )
    }
}

export default withStyles(styles)(CapturePanel)
