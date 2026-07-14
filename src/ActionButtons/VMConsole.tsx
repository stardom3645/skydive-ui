import * as React from 'react'
import { withStyles } from '@material-ui/core/styles'
import { Button, Tooltip } from 'antd'
import { DesktopOutlined } from '@ant-design/icons'

import { styles } from '../DataPanels/PanelStyles'
import { Node } from '../Topology'
import { translate } from '../Config'

interface Props {
  el: Node
  onClick: (el: Node) => void
  disabled?: boolean
}

export class VMConsoleButton extends React.Component<Props> {
  render() {
    return (
      <Tooltip title={translate("openConsole")}>
        <span>
          <Button
            type="text"
            shape="circle"
            className="netdive-action-icon-button"
            aria-label={translate("openConsole")}
            icon={<DesktopOutlined />}
            onClick={() => this.props.onClick(this.props.el)}
            disabled={this.props.disabled === true} />
        </span>
      </Tooltip>
    )
  }
}

export default withStyles(styles)(VMConsoleButton)
