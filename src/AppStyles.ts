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

const drawerWidth = 216

export const styles = (theme: Theme) => createStyles({
  app: {
    display: 'flex',
  },
  grow: {
    flexGrow: 1
  },
  avatar: {
    margin: 10,
    color: '#121212',
    backgroundColor: '#757575'
  },
  toolbarIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 8px',
    ...theme.mixins.toolbar,
  },
  appBar: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    borderBottom: '1px solid #eef2f7',
    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  menuButton: {
    marginRight: 12,
    color: '#334155'
  },
  menuButtonHidden: {
    display: 'none',
  },
  subTitle: {
    fontStyle: 'normal',
    fontWeight: 500,
    color: '#64748b'
  },
  drawerPaper: {
    position: 'relative',
    whiteSpace: 'nowrap',
    width: drawerWidth,
    background: '#ffffff',
    borderRight: '1px solid #eef2f7',
    boxShadow: 'none',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  drawerPaperClose: {
    overflowX: 'hidden',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up('sm')]: {
      width: theme.spacing(0),
    },
  },
  content: {
    flexGrow: 1,
    height: '100vh',
    overflow: 'auto',
    background: '#f8fbff',
  },
  container: {
    paddingTop: theme.spacing(0),
    paddingBottom: theme.spacing(0),
    paddingLeft: theme.spacing(0),
    paddingRight: theme.spacing(0),
  },
  topology: {
    height: `calc(100vh - 10px)`,
  },
  rightPanel: {
    position: 'absolute',
    top: 65,
    right: 0,
    bottom: 0,
    maxWidth: 'unset',
    width: 'unset',
    zIndex: 1000,
    paddingTop: theme.spacing(0),
    paddingBottom: theme.spacing(0),
    paddingLeft: theme.spacing(0),
    paddingRight: theme.spacing(0),
  },
  rightPanelPaper: {
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: 600,
    [theme.breakpoints.down('xl')]: {
      width: 500
    },
    height: `100%`,
    marginTop: 8,
    marginRight: 12,
    borderRadius: 14,
    border: '1px solid #dbe5f2',
    boxShadow: '0 14px 28px rgba(15, 23, 42, 0.08)',
    backgroundColor: '#ffffff',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    })
  },
  rightPanelPaperClose: {
    overflow: 'hidden',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up('sm')]: {
      width: theme.spacing(0),
    },
  },
  nodeTagsPanel: {
    position: 'absolute',
    left: 115,
    top: 80,
    maxWidth: 'unset',
    width: 'unset',
    paddingTop: theme.spacing(0),
    paddingBottom: theme.spacing(0),
    paddingLeft: theme.spacing(0),
    paddingRight: theme.spacing(0),
  },
  nodeTagsFab: {
    margin: theme.spacing(1),
    boxShadow: 'unset',
    fontWeight: 'unset',
    fontSize: '0.8rem',
    padding: '0 12px !important'
  },
  linkTagsPanel: {
    position: 'absolute',
    left: 120,
    bottom: 20,
    maxWidth: 'unset',
    width: 'unset',
    paddingTop: theme.spacing(0),
    paddingBottom: theme.spacing(0),
    paddingLeft: theme.spacing(0),
    paddingRight: theme.spacing(0),
  },
  linkTagsPanelPaper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '100px',
    padding: theme.spacing(2),
    border: '1px solid #dbe5f2',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)'
  },
  search: {
    padding: theme.spacing(0.55, 1),
    position: 'relative',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    border: '1px solid #d8e2ef',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: '#f1f5f9',
    },
    marginRight: theme.spacing(2.5),
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      marginLeft: theme.spacing(2.5),
      width: 'auto',
    },
    lineHeight: 1,
    fontSize: '2rem',
    minWidth: 320
  },
  filtersPanel: {
    position: 'absolute',
    right: 120,
    top: 80,
    maxWidth: 'unset',
    width: 'unset',
    paddingTop: theme.spacing(0),
    paddingBottom: theme.spacing(0),
    paddingLeft: theme.spacing(0),
    paddingRight: theme.spacing(0),
    backgroundColor: theme.palette.common.white,
    display: 'none',
  },
  filtersFab: {
    margin: theme.spacing(1),
    boxShadow: 'unset',
    fontWeight: 'unset',
    fontSize: '0.8rem',
    padding: '6px 12px !important'
  },
  menuItemIconFree: {
    fontFamily: `"Font Awesome 5 Free" !important`,
    fontWeight: 900,
    fontSize: 16,
    marginBottom: `0 !important`,
    minWidth: 32
  },
  menuItemIconBrands: {
    fontFamily: `"Font Awesome 5 Brands" !important`,
    fontWeight: 900,
    fontSize: 16,
    marginBottom: `0 !important`,
    minWidth: 32
  },
  menuItemIconImg: {
    maxWidth: 18,
    maxHeight: 18,
    verticalAlign: 'middle'
  },
  topologyIconButton: {
    border: '1px solid #dbe5f2',
    color: '#1d4ed8',
    borderRadius: 8,
    marginLeft: theme.spacing(1),
    padding: theme.spacing(0.65),
    backgroundColor: '#f8fbff',
    transition: 'all 0.15s ease-out',
    '&:hover': {
      backgroundColor: '#eaf2ff',
      borderColor: '#93c5fd'
    },
    '& svg': {
      fontSize: '1.1rem'
    }
  },
  toolbar: {
    paddingRight: 20,
    minHeight: 56,
  },
  title: {
    display: 'none',
    color: '#0f172a',
    fontWeight: 700,
    letterSpacing: 0.2,
    [theme.breakpoints.up('sm')]: {
      display: 'block',
    },
  }
})
