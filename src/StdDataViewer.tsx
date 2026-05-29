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

import * as React from 'react'
import MUIDataTable from 'mui-datatables'
import TableRow from "@material-ui/core/TableRow"
import TableCell from "@material-ui/core/TableCell"
import { Chart } from 'react-google-charts'
import JSONTree from 'react-json-tree'
import FilterNoneIcon from '@material-ui/icons/FilterNone'
import IconButton from '@material-ui/core/IconButton'
import Tooltip from '@material-ui/core/Tooltip'
import DeleteIcon from '@material-ui/icons/Delete'

import { Column, Graph } from './StdDataNormalizer'
import './StdDataViewer.css'
import { translate } from "./Config"
import Popover from '@material-ui/core/Popover';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';

interface Props {
    title?: string
    columns: Array<Column>
    data: Array<Array<any>>
    graph?: Graph
    details: Map<number, any>
    filterKeys?: Array<string>
    onFilterReset?: () => void
    defaultColumns?: Array<string>
    deletable?: boolean
    onDelete?: (data: Array<Map<string, any>>) => void
    customRenders?: Map<string, (value: any) => any>
    helpTooltipText?: string
}

interface State {
    sortOrder: Map<any, any>
    sortField: string
    filterList: Map<string, Array<any>>
    graph?: Graph
    rowsExpanded: Array<number>
    rowsSelected: Array<number>
}

export class DataViewer extends React.Component<Props, State> {

    state: State
    applyDefaultColumns: boolean

    constructor(props) {
        super(props)

        this.applyDefaultColumns = true

        this.state = {
            sortOrder: new Map<any, any>(),
            sortField: "",
            filterList: new Map<string, Array<any>>(),
            rowsExpanded: new Array<number>(),
            rowsSelected: new Array<number>()
        }
    }

    static getDerivedStateFromProps(props, state) {
        if (props.defaultColumns) {
            state.defaultColumns = props.defaultColumns
        }

        if (props.graph) {
            if (state.graph) {
                state.graph.data = state.graph.data.concat(props.graph.data.slice(1))
            } else {
                state.graph = props.graph
            }
        }

        return state
    }

    private resetFilter() {
        this.setState({ filterList: new Map<string, Array<any>>() })

        if (this.props.onFilterReset) {
            this.props.onFilterReset()
        }
    }

    render() {
        var options: any = {
            filterType: 'multiselect',
            selectableRows: 'none',
            responsive: 'vertical',
            print: false,
            download: false,
            customToolbar: () => {
                return (
                    <React.Fragment>
                        <Tooltip title="Apply default filters" aria-label="Apply default filters">
                            <IconButton onClick={this.resetFilter.bind(this)}>
                                <FilterNoneIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={this.props.helpTooltipText || "No help available"}>
                            <IconButton>
                                <HelpOutlineIcon />
                            </IconButton>
                        </Tooltip>
                    </React.Fragment>
                )
            },
            rowsSelected: this.state.rowsSelected,
            setRowProps: (row, dataIndex) => {
                if (!this.props.details.get(dataIndex)) {
                    return { "className": "not-expandable" }
                }
                return {}
            },
            expandableRows: true,
            expandableRowsHeader: false,
            expandableRowsOnClick: true,
            isRowExpandable: (dataIndex, expandedRows) => {
                if (this.props.details.get(dataIndex)) {
                    return true
                }
                return false
            },
            renderExpandableRow: (rowData, rowMeta) => {
                const colSpan = rowData.length
                return (
                    <TableRow>
                        <TableCell />
                        <TableCell colSpan={colSpan}>
                            <div className="netdive-json-tree">
                                <JSONTree data={this.props.details.get(rowMeta.dataIndex)} theme="bright"
                                    invertTheme={true} sortObjectKeys={true} hideRoot={true} />
                            </div>
                        </TableCell>
                    </TableRow>
                )
            },
            rowsExpanded: this.state.rowsExpanded,
            onRowExpansionChange: (currentRowsExpanded, allRowsExpanded) => {
                this.setState({ rowsExpanded: allRowsExpanded.map(entry => entry.dataIndex) })
            },
            onColumnSortChange: (field: string, direction: string) => {
                this.setState({ sortField: field })
            },
            onColumnViewChange: (column: string, action: string) => {
            },
            onFilterChange: (field: string, filterList: Array<any>) => {
                var newList = new Array<any>()

                filterList.forEach((a: Array<any>) => {
                    if (a.length) {
                        newList = newList.concat(a)
                    }
                })

                this.state.filterList.set(field, newList)
                this.setState({ filterList: this.state.filterList })
            },
            sortOrder: this.state.sortOrder
        }

        if (this.props.deletable) {
            options.selectableRows = 'multiple'
            options.onRowSelectionChange = (currentRowsSelected, allRowsSelected, rowsSelected) => {
                this.state.rowsSelected = rowsSelected
                this.setState({ rowsSelected: this.state.rowsSelected })
            }
            options.customToolbarSelect = (selectedRows, displayData, setSelectedRows) => {
                var data = new Array<Map<string, any>>()
                selectedRows.data.forEach((el: any) => {
                    let row: any = this.props.data[el.dataIndex]

                    let values = new Map<string, any>()
                    for (let i = 0; i != this.props.columns.length; i++) {
                        values[this.props.columns[i].name] = row[i]
                    }
                    data.push(values)
                });

                return (
                    <Tooltip title="Delete selection" aria-label="Delete selection">
                        <IconButton onClick={() => this.props.onDelete && this.props.onDelete(data)}>
                            <DeleteIcon />
                        </IconButton>
                    </Tooltip>
                )
            }
        }

        // re-apply sort and filter if need
        for (let i = 0; i < this.props.columns.length; i++) {
            const column = this.props.columns[i];
            const colName = column.name;
          
            // 기본 컬럼 표시 설정
            if (this.applyDefaultColumns && this.props.defaultColumns) {
              if (!this.props.defaultColumns.includes(colName)) {
                column.options.display = 'false';
              }
            }
          
            // 필터 리스트 적용
            if (colName === "Key" && this.props.filterKeys) {
              column.options.filterList = this.props.filterKeys;
            }
          
            const filterList = this.state.filterList.get(colName);
            if (filterList) {
              column.options.filterList = filterList;
            }
          
            // "Name" 컬럼은 libvirt → vmNameMap 적용
            if (colName === "Value") {
                column.options.customBodyRenderLite = (_dataIndex: number, rowIndex: number): any => {
                    const kvPair = this.props.data[rowIndex];
                
                    if (!kvPair || !Array.isArray(kvPair)) return "";
                
                    // (1) IPv4 or IPv6 단독 주소 처리
                    if (kvPair.length === 1 && typeof kvPair[0] === "string") {
                        const value = kvPair[0];
                        if (value.includes(".") && value.includes("/")) {
                        return `IPv4: ${value}`;
                        } else if (value.includes(":") && value.includes("/")) {
                        return `IPv6: ${value}`;
                        } else {
                        return value; // fallback
                        }
                    }
                
                    // (2) 일반 key-value 쌍
                    if (kvPair.length >= 2) {
                        const key = kvPair[0];
                        const value = kvPair[1];
              
                    // libvirt 이름 매핑
                    if (key === "Name") {
                      const type = this.props.data.find(d => Array.isArray(d) && d[0] === "Type")?.[1];
                      const libvirtName = value;
                      const mapped = (window as any).App?.state?.vmNameMap?.[libvirtName];
                      if (type === "libvirt" && mapped) {
                        return `${mapped} (${libvirtName})`;
                      }
                    }

                    if (key === "IPV4" || key === "MAC" || key === "Network") {
                      const type = this.props.data.find(d => Array.isArray(d) && d[0] === "Type")?.[1];
                      const libvirtName = this.props.data.find(d => Array.isArray(d) && d[0] === "Name")?.[1];
                      const vmNetworkMap = (window as any).App?.state?.vmNetworkMap || {};
                      const nicList = libvirtName ? (vmNetworkMap[libvirtName] || []) : [];

                      if (type === "libvirt" && nicList.length) {
                        if (key === "IPV4") {
                          const ips = Array.from(new Set(nicList.map((n: any) => n.ipAddress).filter((ip: string) => !!ip)));
                          if (ips.length) {
                            return ips.join(",");
                          }
                        }
                        if (key === "MAC") {
                          const macs = Array.from(new Set(nicList.map((n: any) => n.macAddress).filter((m: string) => !!m)));
                          if (macs.length) {
                            return macs.join(",");
                          }
                        }
                        if (key === "Network") {
                          const networks = Array.from(new Set(nicList.map((n: any) => n.networkName).filter((n: string) => !!n)));
                          if (networks.length) {
                            return networks.join(",");
                          }
                        }
                      }
                    }
              
                        return value ?? "";
                    }
                
                    return "";
                };
            }
          
            // 그 외 컬럼은 customRender 적용
            const cb = this.props.customRenders?.get(colName);
            if (cb) {
              column.options.customBodyRenderLite = (_dataIndex: number, rowIndex: number): any => {
                const value = this.props.data[rowIndex][i];
                return cb(value);
              };
            }
        }
        this.applyDefaultColumns = false

        const translatedData = this.props.data.map((row: any[]) => {
            return row.map((cell, index) => index === 0 ? translate(cell) : cell);
        });

        const translatedColumns = this.props.columns.map(c => ({
            ...c,
            label: translate(c.name)
        }))

        return (
            <React.Fragment>
                <MUIDataTable
                    title={this.props.title}
                    data={translatedData}
                    columns={translatedColumns}
                    options={options} />
                { this.state.graph && 
                    <Chart
                        height={300}
                        chartType={this.state.graph.type}
                        loader={<div>Loading Chart</div>}
                        data={this.state.graph.data}
                        options={{ chart: {} }}
                    />
                }
            </React.Fragment>
        )
    }
}
