import * as React from 'react'
import { withStyles } from '@material-ui/core/styles'
import Tooltip from '@material-ui/core/Tooltip'
import IconButton from '@material-ui/core/IconButton'
import DesktopWindowsIcon from '@material-ui/icons/DesktopWindows'

import { styles } from '../DataPanels/PanelStyles'
import { Node } from '../Topology'

interface Props {
  el: Node
  onClick: (el: Node) => void
  disabled?: boolean
}

export class VMConsoleButton extends React.Component<Props> {
  render() {
    return (
      <Tooltip title="콘솔 열기" aria-label="콘솔 열기">
        <span>
          <IconButton
            aria-label="Open VM console"
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
