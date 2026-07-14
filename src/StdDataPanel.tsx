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
import { Spin } from 'antd'
import { withStyles } from '@material-ui/core/styles'

import { DataViewer } from './StdDataViewer'
import { DataNormalizer, Result, Graph } from './StdDataNormalizer'
import { styles } from './StdDataPanelStyles'
import { translate } from "./Config"
import { DetailEmpty, DetailSection } from './DataPanels/common'

interface Props {
    title: string
    icon?: string
    iconClass?: string
    data?: any
    fetch?: () => Promise<any>
    classes: any
    defaultExpanded?: boolean
    normalizer?: (data: any) => any
    graph?: (data: any) => Graph
    exclude?: Array<string>
    sortKeys?: Array<string>
    filterKeys?: Array<string>
    defaultColumns?: Array<string>
    revision: number
    deletable?: boolean
    onDelete?: (data: Array<Map<string, any>>) => void
    customRenders?: Map<string, (value: any) => any>
    helpTooltipText?: string
}

interface State {
    data?: any
    result?: Result
    filterKeys?: Array<string>
    columns?: Array<string>
    error?: string
    expanded: boolean
}

class DataPanel extends React.Component<Props, State> {

    private timeoutHandle?: ReturnType<typeof setTimeout>;

    state: State

    constructor(props) {
        super(props)

        this.state = {
            data: props.data,
            columns: props.columns,
            expanded: !!props.defaultExpanded
        }
    }

    static normalizeData(data: any, normalizer?: (data: any) => any, graph?: (data: any) => Graph, exclude?: Array<string>, sortKeys?: Array<string>): Result {
        var dataNormalizer = new DataNormalizer(normalizer, graph, exclude, sortKeys)
        return dataNormalizer.normalize(data)
    }

    static normalizeFilterKeys(data: any, filterKeys: Array<string> | undefined): Array<string> | undefined {
        if (!filterKeys) {
            return
        }
        return filterKeys.filter(key => Boolean(data[key]))
    }

    static getDerivedStateFromProps(props, state) {
        return {
            data: props.data,
            columns: props.columns,
        }
    }

    componentDidMount() {
        if (this.props.defaultExpanded) {
            this.refreshData()
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.revision !== this.props.revision) {
            this.refreshData()
        }
    }

    private refreshData() {
        // 이전 타임아웃 제거
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle)
            this.timeoutHandle = undefined
        }
        
        if (this.state.data) {
            this.setState({
            result: DataPanel.normalizeData(this.state.data, this.props.normalizer, this.props.graph, this.props.exclude, this.props.sortKeys),
            filterKeys: DataPanel.normalizeFilterKeys(this.state.data, this.props.filterKeys),
            })
        } else if (this.props.fetch) {
            // 타임아웃 설정
            this.timeoutHandle = setTimeout(() => {
            console.warn("[StdDataPanel] 15초 초과: 서버 응답 지연됨")
            this.setState({
                error: "서버 응답이 지연되고 있습니다."
            })
            this.timeoutHandle = undefined
            }, 15000)
        
            this.props.fetch()
            .then(data => {
                if (this.timeoutHandle) {
                clearTimeout(this.timeoutHandle)
                this.timeoutHandle = undefined
                }
        
                if (data) {
                this.setState({
                    result: DataPanel.normalizeData(data, this.props.normalizer, this.props.graph, this.props.exclude, this.props.sortKeys),
                    filterKeys: DataPanel.normalizeFilterKeys(data, this.props.filterKeys),
                    error: undefined
                })
                } else {
                console.warn("[StdDataPanel] fetch() 결과 없음")
                this.setState({ error: "No data available" })
                }
            })
            .catch(err => {
                if (this.timeoutHandle) {
                clearTimeout(this.timeoutHandle)
                this.timeoutHandle = undefined
                }
        
                console.error("[StdDataPanel] fetch() 오류:", err)
                this.setState({ error: err.message })
            })
        } 
    }

    private onExpandChange(expanded: boolean) {
        if (expanded) {
            this.refreshData()
        }
        this.setState({ expanded })
    }

    private onFilterReset() {
        this.refreshData()
    }

    render() {
        const { classes } = this.props

        const iconClass = this.props.iconClass === "font-brands" ? classes.panelIconBrands : classes.panelIconFree

        var details: React.ReactNode = <div className={classes.loadingState}><Spin size="small" /></div>
        if (this.state.error) {
            details = <DetailEmpty description={this.state.error} compact />
          } else if (this.state.result) {
            if (this.state.result.rows.length === 0) {
              details = <DetailEmpty description={translate("no-data-check-filter-or-capture")} compact />
            } else {
              details = (
                <DataViewer
                  columns={this.state.result.columns}
                  data={this.state.result.rows}
                  filterKeys={this.state.filterKeys}
                  graph={this.state.result.graph}
                  details={this.state.result.details}
                  onFilterReset={this.onFilterReset.bind(this)}
                  defaultColumns={this.props.defaultColumns}
                  deletable={this.props.deletable}
                  onDelete={this.props.onDelete}
                  customRenders={this.props.customRenders}
                  helpTooltipText={this.props.helpTooltipText}
                />
              )
            }
          }
          return (
            <DetailSection
              icon={this.props.icon ? <span className={iconClass}>{this.props.icon}</span> : undefined}
              title={this.props.title}
              collapsible
              collapsed={!this.state.expanded}
              onToggle={() => this.onExpandChange(!this.state.expanded)}
              bodyClassName={classes.panelBody}>
                {details}
            </DetailSection>
          )
        }
    }

    export default withStyles(styles)(DataPanel)
