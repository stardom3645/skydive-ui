import * as React from 'react'
import IconButton from '@material-ui/core/IconButton'
import { Tooltip } from 'antd'
import { translate } from './Config'

/** D3 emits per-frame zoom updates. Keep its readout outside the App render
 * path so updating a percentage does not rebuild summaries or resource panels. */
export default class TopologyZoomControls extends React.PureComponent<{
    classes: any; initialZoom: number; onZoom: (delta: number) => void; onReset: () => void
}, { zoom: number }> {
    state = { zoom: this.props.initialZoom }

    setZoom(zoom: number) {
        const normalized = Math.max(0.1, Math.min(1.5, zoom || 1))
        if (Math.abs(this.state.zoom - normalized) < 0.005) return
        this.setState({ zoom: normalized })
    }

    render() {
        const { classes } = this.props
        const zoom = this.state.zoom || 1
        const zoomPercent = `${Math.round(zoom * 100)}%`
        const canZoomOut = zoom > 0.105
        const canZoomIn = zoom < 1.495
        return (
          <div className={classes.toolbarZoomGroup}>
            <Tooltip title={translate("topologyZoomOut")}>
              <span>
                <IconButton
                  color="inherit"
                  disabled={!canZoomOut}
                  onClick={() => this.props.onZoom(-0.1)}
                  className={classes.topologyIconButton}
                >
                  <span className={classes.topologyZoomButtonText}>-</span>
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={translate("topologyZoomReset")}>
              <button
                type="button"
                className={classes.topologyZoomPercent}
                onClick={this.props.onReset}
              >
                {zoomPercent}
              </button>
            </Tooltip>
            <Tooltip title={translate("topologyZoomIn")}>
              <span>
                <IconButton
                  color="inherit"
                  disabled={!canZoomIn}
                  onClick={() => this.props.onZoom(0.1)}
                  className={classes.topologyIconButton}
                >
                  <span className={classes.topologyZoomButtonText}>+</span>
                </IconButton>
              </span>
            </Tooltip>
          </div>
        )
    }
}
