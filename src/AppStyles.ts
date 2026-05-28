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
    '--netdive-menu-bg': '#eef2f8',
    '--netdive-menu-card': '#ffffff',
    '--netdive-menu-card-soft': '#f6f9ff',
    '--netdive-menu-border': '#d6dfec',
    '--netdive-menu-border-soft': '#e7edf6',
    '--netdive-menu-text': '#1e293b',
    '--netdive-menu-muted': '#64748b',
    '--netdive-menu-icon': '#52617a',
    '--netdive-menu-hover': '#f3f8ff',
    '--netdive-menu-active': '#e8f2ff',
    '--netdive-menu-active-text': '#1A73E8',
    '--netdive-menu-shadow': '0 18px 36px rgba(15, 23, 42, 0.10)',
  },
  appDark: {
    '--netdive-menu-bg': '#121823',
    '--netdive-menu-card': '#182130',
    '--netdive-menu-card-soft': '#202b3c',
    '--netdive-menu-border': '#2b3a50',
    '--netdive-menu-border-soft': '#253246',
    '--netdive-menu-text': '#e5edf8',
    '--netdive-menu-muted': '#95a3b8',
    '--netdive-menu-icon': '#a7b4c8',
    '--netdive-menu-hover': '#22314a',
    '--netdive-menu-active': '#18345a',
    '--netdive-menu-active-text': '#73a7ff',
    '--netdive-menu-shadow': '0 18px 42px rgba(0, 0, 0, 0.28)',
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
    background: 'var(--netdive-menu-bg)',
    borderRight: '1px solid var(--netdive-menu-border-soft)',
    boxShadow: 'none',
    padding: theme.spacing(1.5),
    boxSizing: 'border-box',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  drawerPaperClose: {
    overflowX: 'hidden',
    padding: 0,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up('sm')]: {
      width: theme.spacing(0),
    },
  },
  drawerCard: {
    height: 'calc(100vh - 24px)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--netdive-menu-card)',
    border: '1px solid var(--netdive-menu-border)',
    borderRadius: 18,
    boxShadow: 'var(--netdive-menu-shadow)',
    overflow: 'hidden',
    color: 'var(--netdive-menu-text)'
  },
  drawerMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1.25, 1.1),
    overflowY: 'auto',
    overflowX: 'hidden'
  },
  drawerTopActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(0.75)
  },
  drawerTopActionButton: {
    minHeight: 40,
    borderRadius: 12,
    border: '1px solid var(--netdive-menu-border)',
    backgroundColor: 'var(--netdive-menu-card-soft)',
    color: 'var(--netdive-menu-text)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background-color 140ms ease, color 140ms ease, border-color 140ms ease',
    '&:hover': {
      backgroundColor: 'var(--netdive-menu-hover)',
      borderColor: 'var(--netdive-menu-border)'
    }
  },
  drawerDivider: {
    margin: `${theme.spacing(0.65)}px 0 ${theme.spacing(0.15)}px`,
    backgroundColor: 'var(--netdive-menu-border-soft)'
  },
  drawerMenuSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75),
    borderRadius: 12,
    backgroundColor: 'var(--netdive-menu-card-soft)',
    border: '1px solid var(--netdive-menu-border-soft)'
  },
  drawerMenuSectionTitle: {
    padding: theme.spacing(0.4, 0.75, 0.25),
    color: 'var(--netdive-menu-muted)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0,
    opacity: 0.85
  },
  drawerMenuItem: {
    width: '100%',
    minHeight: 54,
    display: 'grid',
    gridTemplateColumns: '32px 1fr 24px',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    border: '1px solid transparent',
    borderRadius: 12,
    padding: theme.spacing(0.75, 0.75),
    backgroundColor: 'transparent',
    color: 'var(--netdive-menu-text)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 180ms ease, border-color 180ms ease, color 180ms ease',
    '&:hover': {
      backgroundColor: 'var(--netdive-menu-hover)',
      borderColor: 'var(--netdive-menu-border)'
    },
    '&:focus-visible': {
      outline: '2px solid var(--netdive-menu-active-text)',
      outlineOffset: 2
    }
  },
  drawerMenuStaticItem: {
    width: '100%',
    minHeight: 54,
    display: 'grid',
    gridTemplateColumns: '32px 1fr 24px',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 0.75),
    color: 'var(--netdive-menu-text)'
  },
  drawerMenuItemActive: {
    backgroundColor: 'var(--netdive-menu-active)',
    borderColor: 'var(--netdive-menu-border)',
    color: 'var(--netdive-menu-active-text)',
    '& $drawerMenuIcon, & $drawerMenuAux': {
      color: 'var(--netdive-menu-active-text)'
    }
  },
  drawerMenuIcon: {
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--netdive-menu-icon)',
    borderRadius: 10,
    backgroundColor: 'transparent',
    '& svg': {
      fontSize: 20
    }
  },
  drawerMenuLabel: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: 14,
    fontWeight: 700,
    color: 'inherit'
  },
  drawerMenuAux: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--netdive-menu-muted)',
    '& svg': {
      fontSize: 18
    }
  },
  drawerLanguagePanel: {
    padding: theme.spacing(0.5, 0),
    '& .MuiToggleButtonGroup-root': {
      width: '100%',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid var(--netdive-menu-border)'
    },
    '& .MuiToggleButton-root': {
      minWidth: 0,
      padding: theme.spacing(0.8, 0.5),
      border: 'none',
      borderRadius: 0,
      color: 'var(--netdive-menu-muted)',
      backgroundColor: 'var(--netdive-menu-card)',
      fontSize: 12,
      fontWeight: 700
    },
    '& .MuiToggleButton-root.Mui-selected': {
      color: 'var(--netdive-menu-active-text)',
      backgroundColor: 'var(--netdive-menu-active)'
    },
    '& .MuiToggleButton-root:hover': {
      backgroundColor: 'var(--netdive-menu-hover)'
    }
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
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
    backgroundColor: '#ffffff',
    color: '#0f172a',
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
  linkTagsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(0.5)
  },
  linkTagsCollapseButton: {
    color: '#64748b',
    padding: 4
  },
  linkTagsCollapsedTab: {
    cursor: 'pointer',
    border: '1px solid #dbe5f2',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
    padding: theme.spacing(0.9, 1.4)
  },
  linkTagsCollapsedText: {
    fontSize: 13,
    fontWeight: 600
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
    paddingTop: 15,
    display: 'none',
    color: '#0f172a',
    fontWeight: 700,
    letterSpacing: 0.2,
    [theme.breakpoints.up('sm')]: {
      display: 'block',
    },
  }
})
