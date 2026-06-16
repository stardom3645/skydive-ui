import * as React from 'react'
import { withStyles } from '@material-ui/core/styles'
import Tooltip from '@material-ui/core/Tooltip'
import IconButton from '@material-ui/core/IconButton'
import DesktopWindowsIcon from '@material-ui/icons/DesktopWindows'

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
      <Tooltip title={translate("openConsole")} aria-label={translate("openConsole")}>
        <span>
          <IconButton
            aria-label={translate("openConsole")}
            onClick={() => this.props.onClick(this.props.el)}
            color="inherit"
            disabled={this.props.disabled === true}>
            <DesktopWindowsIcon />
          </IconButton>
        </span>
      </Tooltip>
    )
  }
}

export default withStyles(styles)(VMConsoleButton)
