/*
 * Copyright (C) 2019 Sylvain Afchain
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

import * as React from "react"
import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'
import { connect } from 'react-redux'
import IconButton from '@material-ui/core/IconButton'
import LocationOnIcon from '@material-ui/icons/LocationOn'
import CancelIcon from '@material-ui/icons/Cancel'
import Tooltip from '@material-ui/core/Tooltip'
import { withStyles } from '@material-ui/core/styles'

import { Node, Link } from './Topology'
import DataPanel from './StdDataPanel'
import { a11yProps, TabPanel } from './Tabs'
import { AppState, session } from './Store'
import { styles } from './SelectionPanelStyles'
import ConfigReducer, { translate } from './Config'
import HostDetailPanel from './DataPanels/HostDetailPanel'


interface Props {
  classes: any
  selection: Array<Node | Link>
  revision: number
  session: session
  onLocation?: (node: Node | Link) => void
  onClose?: (node: Node | Link) => void
  config: ConfigReducer
  buttonsContent?: (el: Node | Link) => JSX.Element
  panelsContent?: (el: Node | Link) => JSX.Element
  moldInventory?: any
  infrastructureHostSummaries?: Record<string, any>
  kubernetesClusters?: any[]
}

interface State {
  tab: number
  gremlin: string
  captureForm: boolean
}

class SelectionPanel extends React.Component<Props, State> {

  state: State

  constructor(props) {
    super(props)

    this.state = {
      tab: 0,
      gremlin: "",
      captureForm: false
    }
  }

  static getDerivedStateFromProps(props, state) {
    var tab = state.tab
    if (tab >= props.selection.length) {
      tab = props.selection.length - 1
    }
    if (tab < 0) {
      tab = 0
    }
    return {
      tab: tab
    }
  }

  private renderTabs(classes: any) {
    return this.props.selection.map((el: Node | Link, i: number) => {
      var className = classes.tabIconFree

      if (el.type === 'node') {
        let attrs = this.props.config.nodeAttrs(el)
        var icon: string = attrs.icon
        var href: string = attrs.href

        if (attrs.iconClass === "font-brands") {
          className = classes.tabIconBrands
        }

        var title = this.props.config.nodeTabTitle(el)
      } else {
        let attrs = this.props.config.linkAttrs(el)
        var icon: string = attrs.icon
        var href: string = attrs.href

        if (attrs.iconClass === "font-brands") {
          className = classes.tabIconBrands
        }

        var title = this.props.config.linkTabTitle(el)
      }

      const iconRender = () => {
        if (href) {
          return (
            <img src={href} className={classes.iconImg} />
          )
        }
        return icon
      }

      const subtitle = this.tabSubtitle(el)

      return (
        <Tab className={classes.tabRoot} icon={<span className={className}>{iconRender()}</span>}
          key={"tab-" + i}
          label={
            <Tooltip title={title} placement="bottom" arrow classes={{ tooltip: classes.tabTitleTooltip }}>
              <span className={classes.tabLabelBlock}>
                <span className={`${classes.tabTitle} ${title.includes("\n") ? classes.tabTitleMulti : ""}`} title={title}>{title}</span>
                {subtitle && <span className={classes.tabSubtitle} title={subtitle}>{subtitle}</span>}
              </span>
            </Tooltip>
          }
          {...a11yProps(i)} />
      )
    })
  }

  private tabSubtitle(el: Node | Link): string {
    if (!el || !el.data) {
      return ""
    }

    const rawType = String(el.data.Type || el.data.type || el.type || "").trim()
    const type = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : ""
    const ipv4 = Array.isArray(el.data.IPV4) && el.data.IPV4.length > 0 ? String(el.data.IPV4[0]) : ""
    const ipv6 = Array.isArray(el.data.IPV6) && el.data.IPV6.length > 0 ? String(el.data.IPV6[0]) : ""
    const address = ipv4 || ipv6

    if (type && address) {
      return `${type} · ${address}`
    }
    return type || address
  }

  private dataFields(el: Node | Link): Array<any> {
    if (el.type === 'node') {
      return this.props.config.nodeDataFields()
    } else {
      return this.props.config.linkDataFields()
    }
  }

  renderTabPanels(classes: any) {
    const dataByPath = (data: any, path: string): any => {
      for (let key of path.split(".")) {
        data = data[key]
        if (!data) {
          break
        }
      }

      return data
    }

    const renderDataPanels = (el: Node | Link) => {
      return this.dataFields(el).map(entry => {
        var data = el.data
        var exclude = new Array<any>()

        if (entry.field) {
          data = dataByPath(el.data, entry.field)
        } else if (entry.data) {
          data = entry.data(el)
        }

        exclude = this.dataFields(el).filter(cfg => cfg.field).map(cfg => {
          if (entry.field) {
            return cfg.field.replace(entry.field + ".", "")
          } else {
            return cfg.field
          }
        })

        if (data) {
          var title = entry.title || entry.field || "General"
          var sortKeys = entry.sortKeys ? entry.sortKeys(data) : null
          var filterKeys = entry.filterKeys ? entry.filterKeys(data) : null

          var suffix = title.toLowerCase().replace(" ", "-")
          return (
            <DataPanel key={"dataviewer-" + el.id + "-" + suffix} title={title} revision={this.props.revision}
              defaultExpanded={entry.expanded} data={data} exclude={exclude} sortKeys={sortKeys} filterKeys={filterKeys}
              normalizer={entry.normalizer} graph={entry.graph} icon={entry.icon} iconClass={entry.iconClass}
              deletable={entry.deletable} customRenders={entry.customRenders} onDelete={entry.onDelete} helpTooltipText={entry.helpTooltipText}/>
          )
        }
      })
    }

    return this.props.selection.map((el: Node | Link, i: number) => {
      if (this.state.tab !== i) {
        return null
      }

      return (
        <React.Fragment key={el.id}>
          <div className={classes.tabActions}>
            <Tooltip title={translate("removeFromSelection")} aria-label={translate("removeFromSelection")}>
              <IconButton
                onClick={() => this.props.onClose && this.props.onClose(el)}
                color="inherit"
                aria-label={translate("removeFromSelection")}>
                <CancelIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={translate("pinNode")} aria-label={translate("pinNode")}>
              <IconButton
                onClick={() => this.props.onLocation && this.props.onLocation(el)}
                color="inherit"
                aria-label={translate("pinNode")}>
                <LocationOnIcon />
              </IconButton>
            </Tooltip>
            {this.props.buttonsContent && this.props.buttonsContent(el)}
          </div>
          {this.props.panelsContent && this.props.panelsContent(el)}
          <TabPanel key={"tabpanel-" + el.id} value={this.state.tab} index={i}>
            {el.type === 'node' && String(el.data?.Type || '').toLowerCase() === 'host'
              ? <HostDetailPanel node={el as Node} session={this.props.session} moldInventory={this.props.moldInventory} infrastructureHostSummaries={this.props.infrastructureHostSummaries} kubernetesClusters={this.props.kubernetesClusters} />
              : renderDataPanels(el)
            }
          </TabPanel>
        </React.Fragment>
      )
    })
  }

  onTabChange(event: React.ChangeEvent<{}>, value: number) {
    this.setState({ tab: value, gremlin: "" })
  }

  render() {
    const { classes } = this.props

    return (
      <div className={classes.tabs}>
        <Tabs
          orientation="horizontal"
          variant="scrollable"
          value={this.state.tab}
          onChange={this.onTabChange.bind(this)}
          aria-label="Metadata"
          indicatorColor="primary">
          {this.renderTabs(classes)}
        </Tabs>
        <div className={classes.rightPanelPaperContent}>
          {this.renderTabPanels(classes)}
        </div>
      </div>
    )
  }
}

export const mapStateToProps = (state: AppState) => ({
  selection: state.selection,
  revision: state.selectionRevision,
  session: state.session
})

export const mapDispatchToProps = ({
})

export default withStyles(styles)(connect(mapStateToProps, mapDispatchToProps)(SelectionPanel))
