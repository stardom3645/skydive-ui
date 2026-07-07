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
    paddingTop: 12,
    paddingBottom: theme.spacing(2.5),
    paddingLeft: 18,
    paddingRight: 22,
    width: `100%`,
    height: `100%`,
    maxHeight: 'calc(100% - 70px)',
    backgroundColor: 'var(--netdive-detail-bg)',
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
    },
    '& .MuiInputBase-input, & .MuiSelect-select, & .MuiInputLabel-root, & .MuiFormLabel-root, & .MuiTypography-root, & .MuiSvgIcon-root': {
      color: 'var(--netdive-detail-text)'
    },
    '& .MuiInput-underline:before': {
      borderBottomColor: 'var(--netdive-detail-border-soft)'
    },
    '& .MuiInput-underline:hover:not(.Mui-disabled):before': {
      borderBottomColor: 'var(--netdive-detail-border)'
    },
    '& .MuiInput-underline:after': {
      borderBottomColor: 'var(--netdive-detail-accent)'
    }
  },
  jsonTree: {
    backgroundColor: 'unset'
  },
  tabs: {
    height: `100%`,
    backgroundColor: 'var(--netdive-detail-bg)',
    '& .MuiTabs-indicator': {
      height: 2,
      backgroundColor: '#1677ff'
    },
    '& .MuiTab-wrapper': {
      width: '100%'
    }
  },
  tabRoot: {
    minWidth: 210,
    maxWidth: 320,
    paddingLeft: 12,
    paddingRight: 12,
    overflow: 'hidden',
    '&.MuiTab-labelIcon': {
      minHeight: 48
    },
    '& .MuiTab-wrapper': {
      width: '100%',
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexDirection: 'row',
      gap: theme.spacing(1)
    }
  },
  tabLabelBlock: {
    display: 'block',
    maxWidth: '100%',
    minWidth: 0,
    textAlign: 'left',
    flex: '1 1 auto'
  },
  tabTitle: {
    display: 'block',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 15,
    lineHeight: 1.18,
    fontWeight: 600,
    color: '#101828',
    cursor: 'help'
  },
  tabSubtitle: {
    display: 'block',
    maxWidth: '100%',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 11.5,
    lineHeight: 1.25,
    fontWeight: 600,
    letterSpacing: 0.1
  },
  tabTitleMulti: {
    whiteSpace: 'pre-line',
    textAlign: 'center',
    lineHeight: 1.2,
    textOverflow: 'clip'
  },
  tabTitleTooltip: {
    fontSize: 14
  },
  tabActions: {
    display: 'flex',
    flexDirection: 'row-reverse',
    marginBottom: 10,
    borderBottom: '1px solid #eef0f4',
    paddingBottom: 8,
    '& .MuiIconButton-root': {
      width: 34,
      height: 34,
      padding: 7,
      color: '#101828'
    },
    '& .MuiSvgIcon-root': {
      fontSize: 19
    }
  },
  gremlinExpr: {
    fontSize: '16px',
    padding: 0
  },
  actionPanel: {
    marginBottom: 16
  },
  iconImg: {
    maxWidth: 30,
    maxHeight: 30,
    verticalAlign: 'middle'
  },
  tabIconFree: {
    fontFamily: `"Font Awesome 5 Free" !important`,
    fontWeight: 900,
    fontSize: 26,
    marginBottom: `0 !important`,
    flex: '0 0 auto',
    color: '#1677ff'
  },
  tabIconBrands: {
    fontFamily: `"Font Awesome 5 Brands" !important`,
    fontWeight: 900,
    fontSize: 26,
    marginBottom: `0 !important`,
    flex: '0 0 auto',
    color: '#1677ff'
  }
})
