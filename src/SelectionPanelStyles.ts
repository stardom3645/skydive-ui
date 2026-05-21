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

import { createStyles, Theme } from '@material-ui/core'

export const styles = (theme: Theme) => createStyles({
  rightPanelPaperContent: {
    paddingTop: theme.spacing(2.5),
    paddingBottom: theme.spacing(2.5),
    paddingLeft: theme.spacing(2.5),
    paddingRight: theme.spacing(3.25),
    width: `100%`,
    height: `100%`,
    maxHeight: 'calc(100% - 90px)',
    backgroundColor: '#ffffff',
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollbarGutter: 'stable',
    boxSizing: 'border-box',
    '& .MuiInputBase-input.MuiInput-input:not(.MuiTablePagination-select), & .MuiSelect-select:not(.MuiTablePagination-select)': {
      height: 'auto',
      minHeight: 32,
      lineHeight: 1.5,
      padding: '8px 0 8px',
      boxSizing: 'border-box'
    }
  },
  jsonTree: {
    backgroundColor: 'unset'
  },
  tabs: {
    height: `100%`,
    backgroundColor: '#ffffff',
    '& .MuiTabs-indicator': {
      backgroundColor: '#1A73E8'
    }
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1e293b'
  },
  tabActions: {
    display: 'flex',
    flexDirection: 'row-reverse',
    marginBottom: theme.spacing(1.5),
    borderBottom: '1px solid #1A73E8',
    paddingBottom: theme.spacing(1)
  },
  gremlinExpr: {
    fontSize: '16px',
    padding: 0
  },
  actionPanel: {
    marginBottom: 16
  },
  iconImg: {
    maxWidth: 32,
    maxHeight: 32,
    verticalAlign: 'middle'
  },
  tabIconFree: {
    fontFamily: `"Font Awesome 5 Free" !important`,
    fontWeight: 900,
    fontSize: 35,
    marginBottom: `0 !important`,
    color: '#1a73e8'
  },
  tabIconBrands: {
    fontFamily: `"Font Awesome 5 Brands" !important`,
    fontWeight: 900,
    fontSize: 35,
    marginBottom: `0 !important`,
    color: '#1a73e8'
  }
})
