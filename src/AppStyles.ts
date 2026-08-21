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

const drawerWidth = 60
const topologyLevelMenuWidth = 188

export const styles = (theme: Theme) => createStyles({
  app: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--netdive-content-bg)',
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
    '--netdive-menu-active-soft': 'rgba(26, 115, 232, 0.08)',
    '--netdive-menu-active-text': '#1A73E8',
    '--netdive-menu-shadow': '0 18px 36px rgba(15, 23, 42, 0.10)',
    '--netdive-content-bg': '#f8fbff',
    '--netdive-appbar-bg': '#ffffff',
    '--netdive-appbar-text': '#0f172a',
    '--netdive-appbar-muted': '#64748b',
    '--netdive-appbar-border': '#eef2f7',
    '--netdive-search-bg': '#f8fafc',
    '--netdive-search-hover': '#f1f5f9',
    '--netdive-search-border': '#d8e2ef',
    '--netdive-search-text': '#0f172a',
    '--netdive-search-muted': '#64748b',
    '--netdive-action-btn-bg': '#f8fbff',
    '--netdive-action-btn-hover': '#eaf2ff',
    '--netdive-action-btn-border': '#dbe5f2',
    '--netdive-action-btn-border-hover': '#93c5fd',
    '--netdive-action-btn-text': '#1d4ed8',
    '--netdive-detail-bg': '#ffffff',
    '--netdive-detail-soft': '#f8fbff',
    '--netdive-detail-border': '#dbe5f2',
    '--netdive-detail-border-soft': '#e8eef6',
    '--netdive-detail-text': '#0f172a',
    '--netdive-detail-title': '#0f172a',
    '--netdive-detail-muted': '#475569',
    '--netdive-detail-section-bg': '#f8fbff',
    '--netdive-detail-accent': '#2bbbe6',
    '--netdive-detail-shadow': '0 10px 24px rgba(15, 23, 42, 0.08)',
    '--netdive-recent-glass-bg': 'rgba(255, 255, 255, 0.70)',
    '--netdive-recent-glass-hover': 'rgba(255, 255, 255, 0.98)',
    '--netdive-recent-glass-header': 'rgba(248, 250, 252, 0.76)',
    '--netdive-recent-glass-header-hover': 'rgba(248, 250, 252, 0.94)',
    '--netdive-ant-border': 'rgba(5, 5, 5, 0.06)',
    '--netdive-ant-shadow': '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12)',
    '--topology-bg': '#f8fbff',
    '--topology-level-zone-stroke': '#c8d1de',
    '--topology-level-zone-fill': '#fcfdff',
    '--topology-level-label-fill': '#f4f6f9',
    '--topology-level-label-stroke': '#e3e8ef',
    '--topology-level-label-text': '#4b5568',
    '--topology-level-label-icon': '#737e91',
    '--topology-level-label-title': '#4a5670',
    '--topology-level-label-hover': '#f3f8ff',
    '--topology-level-label-active-fill': '#e8f2ff',
    '--topology-level-label-active-stroke': '#cfe2ff',
    '--topology-level-label-active-text': '#1a73e8',
    '--topology-hiera-links': '#c4ccd9',
    '--topology-link-overlays': '#d7dfeb',
    '--topology-link-overlay-selected': '#7288b8',
    '--topology-links': '#9aa8c0',
    '--topology-link-marker': '#8e9bb2',
    '--topology-link-label': '#334155',
    '--topology-hiera-link': '#8ea0bc',
    '--topology-node-circle-fill': '#ffffff',
    '--topology-node-circle-stroke': '#c9d3e2',
    '--topology-node-overlay': '#d8e0ed',
    '--topology-node-disc': '#5f6f8f',
    '--topology-node-selected-fill': '#f0f3f8',
    '--topology-node-selected-stroke': '#445f8f',
    '--topology-node-selected-disc': '#526f9f',
    '--topology-node-icon': '#f8fafc',
    '--topology-node-name': '#0f172a',
    '--topology-node-name-wrap-fill': '#ffffff',
    '--topology-node-name-wrap-stroke': '#c6d2e4',
    '--topology-group-rect-fill': 'rgba(226, 236, 250, 0.42)',
    '--topology-group-rect-stroke': '#8ea7c7',
    '--topology-group-rect-selected-fill': 'rgba(201, 218, 238, 0.46)',
    '--topology-group-rect-selected-stroke': '#7b96ba',
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
    '--netdive-menu-active-soft': 'rgba(115, 167, 255, 0.12)',
    '--netdive-menu-active-text': '#73a7ff',
    '--netdive-menu-shadow': '0 18px 42px rgba(0, 0, 0, 0.28)',
    '--netdive-content-bg': '#0f1624',
    '--netdive-appbar-bg': '#101a2a',
    '--netdive-appbar-text': '#e5edf8',
    '--netdive-appbar-muted': '#9cafc6',
    '--netdive-appbar-border': '#223146',
    '--netdive-search-bg': '#1a2739',
    '--netdive-search-hover': '#23344a',
    '--netdive-search-border': '#31445d',
    '--netdive-search-text': '#e5edf8',
    '--netdive-search-muted': '#9cafc6',
    '--netdive-action-btn-bg': '#1a2a40',
    '--netdive-action-btn-hover': '#213753',
    '--netdive-action-btn-border': '#365073',
    '--netdive-action-btn-border-hover': '#4b78ab',
    '--netdive-action-btn-text': '#9cc0f7',
    '--netdive-detail-bg': '#182130',
    '--netdive-detail-soft': '#1f2a3c',
    '--netdive-detail-border': '#2b3a50',
    '--netdive-detail-border-soft': '#33445e',
    '--netdive-detail-text': '#e5edf8',
    '--netdive-detail-title': '#f1f6ff',
    '--netdive-detail-muted': '#9cafc6',
    '--netdive-detail-section-bg': '#1f2a3c',
    '--netdive-detail-accent': '#5bc0ff',
    '--netdive-detail-shadow': '0 20px 38px rgba(0, 0, 0, 0.35)',
    '--netdive-recent-glass-bg': 'rgba(24, 33, 48, 0.70)',
    '--netdive-recent-glass-hover': 'rgba(24, 33, 48, 0.98)',
    '--netdive-recent-glass-header': 'rgba(31, 42, 60, 0.76)',
    '--netdive-recent-glass-header-hover': 'rgba(31, 42, 60, 0.94)',
    '--netdive-ant-border': 'rgba(255, 255, 255, 0.10)',
    '--netdive-ant-shadow': '0 6px 16px 0 rgba(0, 0, 0, 0.24), 0 3px 6px -4px rgba(0, 0, 0, 0.32)',
    '--topology-bg': '#101826',
    '--topology-level-zone-stroke': '#334760',
    '--topology-level-zone-fill': '#131e2d',
    '--topology-level-label-fill': '#1d293b',
    '--topology-level-label-stroke': '#33465e',
    '--topology-level-label-text': '#c8d5e7',
    '--topology-level-label-icon': '#8ea4c1',
    '--topology-level-label-title': '#d2ddee',
    '--topology-level-label-hover': '#22314a',
    '--topology-level-label-active-fill': '#1f3b60',
    '--topology-level-label-active-stroke': '#3f6598',
    '--topology-level-label-active-text': '#7cb0ff',
    '--topology-hiera-links': '#4b607e',
    '--topology-link-overlays': '#2a3e58',
    '--topology-link-overlay-selected': '#86a7d8',
    '--topology-links': '#6f88ab',
    '--topology-link-marker': '#7d97bb',
    '--topology-link-label': '#c7d6ea',
    '--topology-hiera-link': '#88a4c8',
    '--topology-node-circle-fill': '#1d2a3d',
    '--topology-node-circle-stroke': '#415776',
    '--topology-node-overlay': '#334866',
    '--topology-node-disc': '#6f88ab',
    '--topology-node-selected-fill': '#253752',
    '--topology-node-selected-stroke': '#79a9f3',
    '--topology-node-selected-disc': '#8fb6f7',
    '--topology-node-icon': '#f0f6ff',
    '--topology-node-name': '#e6effd',
    '--topology-node-name-wrap-fill': '#152235',
    '--topology-node-name-wrap-stroke': '#3f5778',
    '--topology-group-rect-fill': 'rgba(53, 78, 114, 0.44)',
    '--topology-group-rect-stroke': '#6c8fbc',
    '--topology-group-rect-selected-fill': 'rgba(68, 96, 137, 0.48)',
    '--topology-group-rect-selected-stroke': '#86a8d4',
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
    top: 0,
    right: 0,
    height: 64,
    backgroundColor: 'var(--netdive-appbar-bg)',
    color: 'var(--netdive-appbar-text)',
    borderBottom: '1px solid var(--netdive-appbar-border)',
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
    minWidth: 'auto',
    width: 36,
    height: 36,
    marginRight: 12,
    padding: 0,
    borderRadius: 10,
    border: '1px solid var(--netdive-action-btn-border)',
    backgroundColor: 'transparent',
    color: 'var(--netdive-appbar-muted)',
    textTransform: 'none',
    '&:hover': {
      color: 'var(--netdive-appbar-text)',
      backgroundColor: 'var(--netdive-search-hover)',
      borderColor: 'var(--netdive-action-btn-border-hover)'
    },
    '& svg': {
      fontSize: '1.2rem'
    }
  },
  subTitle: {
    fontStyle: 'normal',
    fontWeight: 500,
    color: 'var(--netdive-appbar-muted)'
  },
  drawerPaper: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    whiteSpace: 'nowrap',
    width: drawerWidth,
    background: 'var(--netdive-menu-card)',
    borderRight: '1px solid var(--netdive-appbar-border)',
    boxShadow: 'none',
    padding: 0,
    boxSizing: 'border-box',
    // Keep the navigation rail and its flyouts above Netdive side panels
    // (1250), while leaving real Material UI dialogs (1300) modal.
    zIndex: theme.zIndex.modal - 10,
    overflow: 'visible',
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
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--netdive-menu-card)',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    overflow: 'visible',
    color: 'var(--netdive-menu-text)'
  },
  drawerMenu: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 0.75, 1),
    overflow: 'visible'
  },
  drawerMenuHeader: {
    display: 'flex',
    alignItems: 'center',
    height: 64,
    minHeight: 64,
    flex: '0 0 64px',
    justifyContent: 'center',
    width: '100%',
    padding: 0,
    borderBottom: '1px solid var(--netdive-appbar-border)',
    boxSizing: 'border-box',
    color: 'var(--netdive-menu-text)',
    lineHeight: 1.2
  },
  drawerBrandLogo: {
    display: 'block',
    width: 56,
    height: 34,
    objectFit: 'contain'
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
    position: 'relative',
    width: 48,
    height: 48,
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid transparent',
    borderRadius: 12,
    padding: 0,
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
    gridTemplateColumns: '32px 1fr',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 0.75),
    color: 'var(--netdive-menu-text)'
  },
  drawerMenuItemActive: {
    backgroundColor: 'var(--netdive-menu-active-soft)',
    borderColor: 'transparent',
    color: 'var(--netdive-menu-active-text)',
    '& $drawerMenuIcon, & $drawerMenuAux': {
      color: 'var(--netdive-menu-active-text)'
    },
    '&:before': {
      content: '""',
      position: 'absolute',
      left: -6,
      top: 9,
      bottom: 9,
      width: 2,
      borderRadius: '0 2px 2px 0',
      backgroundColor: 'var(--netdive-menu-active-text)'
    }
  },
  drawerMenuIcon: {
    width: 38,
    height: 38,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--netdive-menu-icon)',
    borderRadius: 10,
    backgroundColor: 'transparent',
    '& svg': {
      fontSize: 24
    }
  },
  drawerMenuGroup: {
    position: 'relative',
    width: 48,
    '&:hover $drawerFlyout, &:focus-within $drawerFlyout': {
      opacity: 1,
      visibility: 'visible',
      pointerEvents: 'auto',
      transform: 'translateX(0)'
    }
  },
  drawerFlyout: {
    position: 'absolute',
    left: 'calc(100% + 10px)',
    top: 0,
    width: 238,
    padding: theme.spacing(1),
    border: '1px solid var(--netdive-menu-border)',
    borderRadius: 14,
    backgroundColor: 'var(--netdive-menu-card)',
    boxShadow: 'var(--netdive-menu-shadow)',
    opacity: 0,
    visibility: 'hidden',
    pointerEvents: 'none',
    transform: 'translateX(-4px)',
    transition: 'opacity 140ms ease, transform 140ms ease, visibility 140ms ease',
    zIndex: theme.zIndex.modal - 5,
    '&:before': {
      content: '""',
      position: 'absolute',
      left: -11,
      top: 0,
      bottom: 0,
      width: 12
    }
  },
  drawerFlyoutTitle: {
    padding: theme.spacing(0.5, 0.75, 0.75),
    color: 'var(--netdive-menu-muted)',
    fontSize: 11,
    fontWeight: 800
  },
  drawerFlyoutItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5)
  },
  drawerMenuLabel: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: 14,
    fontWeight: 700,
    color: 'inherit'
  },
  drawerMenuAux: {},
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
  drawerThemePanel: {
    marginTop: theme.spacing(0.75),
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
  drawerPreferencesHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(0.35, 0.25, 1.25),
    marginBottom: theme.spacing(0.25),
    borderBottom: '1px solid var(--netdive-menu-border-soft)'
  },
  drawerPreferencesFlyout: {
    width: 270,
    padding: theme.spacing(1.25),
    '& $drawerFlyoutItems': {
      gap: theme.spacing(1.5)
    }
  },
  drawerPreferencesHeaderText: {
    minWidth: 0,
    '& strong': {
      display: 'block',
      color: 'var(--netdive-menu-text)',
      fontSize: 15,
      fontWeight: 800,
      lineHeight: 1.35
    },
    '& small': {
      display: 'block',
      marginTop: 4,
      color: 'var(--netdive-menu-muted)',
      opacity: 0.72,
      fontSize: 10,
      lineHeight: 1.4,
      wordBreak: 'keep-all'
    }
  },
  drawerPreferenceSection: {
    '& .MuiToggleButtonGroup-root': {
      width: '100%',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      marginTop: 6,
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid var(--netdive-menu-border)'
    },
    '& .MuiToggleButton-root': {
      minWidth: 0,
      minHeight: 34,
      padding: theme.spacing(0.75, 1),
      border: 'none',
      borderRadius: 0,
      color: 'var(--netdive-menu-muted)',
      backgroundColor: 'var(--netdive-menu-card)',
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1.25,
      transition: 'background-color 180ms ease, color 180ms ease, box-shadow 180ms ease'
    },
    '& .MuiToggleButton-root.Mui-selected': {
      color: 'var(--netdive-menu-active-text)',
      backgroundColor: 'var(--netdive-menu-active)',
      boxShadow: 'inset 0 0 0 1px rgba(22, 119, 255, 0.38), 0 1px 2px rgba(15, 23, 42, 0.08)'
    },
    '& .MuiToggleButton-root:hover': {
      color: 'var(--netdive-menu-active-text)',
      backgroundColor: 'var(--netdive-menu-hover)'
    }
  },
  drawerPreferenceLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 20,
    color: 'var(--netdive-menu-text)',
    fontSize: 12,
    fontWeight: 750,
    lineHeight: 1.3
  },
  drawerInitialLayerPanel: {
    paddingTop: theme.spacing(1.5),
    borderTop: '1px solid var(--netdive-menu-border-soft)',
    '& .MuiToggleButtonGroup-root': {
      width: '100%',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      marginTop: 6,
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid var(--netdive-menu-border)'
    },
    '& .MuiToggleButton-root': {
      minWidth: 0,
      minHeight: 34,
      padding: theme.spacing(0.75, 1),
      border: 'none',
      borderRadius: 0,
      color: 'var(--netdive-menu-muted)',
      backgroundColor: 'var(--netdive-menu-card)',
      fontSize: 11,
      fontWeight: 700,
      lineHeight: 1.25,
      whiteSpace: 'normal',
      transition: 'background-color 180ms ease, color 180ms ease, box-shadow 180ms ease'
    },
    '& .MuiToggleButton-root.Mui-selected': {
      color: 'var(--netdive-menu-active-text)',
      backgroundColor: 'var(--netdive-menu-active)',
      boxShadow: 'inset 0 0 0 1px rgba(22, 119, 255, 0.38), 0 1px 2px rgba(15, 23, 42, 0.08)'
    },
    '& .MuiToggleButton-root:hover': {
      backgroundColor: 'var(--netdive-menu-hover)'
    }
  },
  drawerPreferenceNotice: {
    paddingTop: theme.spacing(1),
    borderTop: '1px solid var(--netdive-menu-border-soft)',
    color: 'var(--netdive-menu-muted)',
    fontSize: 9.5,
    lineHeight: 1.45,
    opacity: 0.68,
    wordBreak: 'keep-all'
  },
  preferenceLabelIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    flexShrink: 0,
    color: 'var(--netdive-menu-icon)',
    '& svg': {
      width: 14,
      height: 14
    }
  },
  preferenceResetButton: {
    minWidth: 'auto !important',
    minHeight: '22px !important',
    height: '22px !important',
    alignSelf: 'baseline',
    padding: '0 5px !important',
    color: 'var(--netdive-menu-active-text) !important',
    fontSize: '11px !important',
    fontWeight: 700,
    lineHeight: '22px !important',
    whiteSpace: 'nowrap' as const,
    backgroundColor: 'transparent !important',
    '&:hover': {
      backgroundColor: 'var(--netdive-menu-hover) !important'
    }
  },
  drawerMenuBottomSpacer: {
    marginTop: 'auto'
  },
  drawerSettingHeader: {
    width: '100%',
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0.4, 0.75),
    border: '1px solid var(--netdive-menu-border-soft)',
    borderRadius: 10,
    backgroundColor: 'var(--netdive-menu-card-soft)',
    color: 'var(--netdive-menu-text)',
    cursor: 'pointer'
  },
  drawerSettingChevron: {
    display: 'inline-flex',
    color: 'var(--netdive-menu-muted)',
    transition: 'transform 150ms ease'
  },
  drawerSettingChevronOpen: {
    transform: 'rotate(180deg)'
  },
  drawerSettingsBody: {
    marginTop: theme.spacing(0.75),
    padding: theme.spacing(0.75),
    borderRadius: 10,
    border: '1px solid var(--netdive-menu-border-soft)',
    backgroundColor: 'var(--netdive-menu-card-soft)'
  },
  drawerKubernetesPanel: {
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(1),
    borderTop: '1px solid var(--netdive-menu-border-soft)',
    color: 'var(--netdive-menu-text)'
  },
  drawerKubernetesHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(0.75),
    '& .MuiButton-root': {
      minWidth: 0,
      color: 'var(--netdive-menu-active-text)',
      fontSize: 11,
      fontWeight: 700
    }
  },
  drawerKubernetesTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.6),
    minWidth: 0,
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--netdive-menu-text)',
    '& svg': {
      fontSize: 18,
      color: 'var(--netdive-menu-icon)'
    }
  },
  drawerKubernetesDescription: {
    marginTop: theme.spacing(0.5),
    color: 'var(--netdive-menu-muted)',
    fontSize: 11,
    lineHeight: 1.45
  },
  drawerKubernetesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.75)
  },
  drawerKubernetesEmpty: {
    padding: theme.spacing(1),
    borderRadius: 10,
    color: 'var(--netdive-menu-muted)',
    backgroundColor: 'var(--netdive-menu-card)',
    fontSize: 12
  },
  drawerKubernetesItem: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75),
    border: '1px solid var(--netdive-menu-border-soft)',
    borderRadius: 10,
    backgroundColor: 'transparent',
    color: 'var(--netdive-menu-text)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 160ms ease, border-color 160ms ease',
    '&:hover': {
      backgroundColor: 'var(--netdive-menu-hover)',
      borderColor: 'var(--netdive-menu-border)'
    },
    '&:disabled': {
      cursor: 'default',
      opacity: 0.65
    }
  },
  drawerKubernetesItemActive: {
    backgroundColor: 'var(--netdive-menu-active)',
    borderColor: 'var(--netdive-menu-active-text)'
  },
  drawerKubernetesItemMain: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  },
  drawerKubernetesName: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
    fontWeight: 800
  },
  drawerKubernetesMeta: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 10,
    color: 'var(--netdive-menu-muted)'
  },
  drawerKubernetesState: {
    padding: theme.spacing(0.2, 0.55),
    borderRadius: 999,
    backgroundColor: 'var(--netdive-menu-card)',
    color: 'var(--netdive-menu-muted)',
    fontSize: 10,
    fontWeight: 800
  },
  drawerKubernetesBadges: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4
  },
  drawerKubernetesCollect: {
    padding: theme.spacing(0.2, 0.55),
    borderRadius: 999,
    backgroundColor: 'var(--netdive-menu-card)',
    color: 'var(--netdive-menu-muted)',
    fontSize: 10,
    fontWeight: 800
  },
  drawerKubernetesCollectOn: {
    backgroundColor: 'var(--netdive-menu-active)',
    color: 'var(--netdive-menu-active-text)'
  },
  drawerKubernetesActions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(0.75),
    '& .MuiButton-root': {
      flex: 1,
      color: 'var(--netdive-menu-active-text)',
      border: '1px solid var(--netdive-menu-border-soft)',
      fontSize: 11,
      fontWeight: 800
    }
  },
  drawerKubernetesMessage: {
    marginTop: theme.spacing(0.75),
    color: 'var(--netdive-menu-muted)',
    fontSize: 11,
    lineHeight: 1.4
  },
  drawerIntegrationItem: {
    width: '100%',
    minHeight: 56,
    display: 'grid',
    gridTemplateColumns: '32px 1fr',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    border: '1px solid transparent',
    borderRadius: 12,
    padding: theme.spacing(0.75),
    backgroundColor: 'transparent',
    color: 'var(--netdive-menu-text)',
    cursor: 'pointer',
    textAlign: 'left',
    position: 'relative',
    transition: 'background-color 180ms ease, border-color 180ms ease, color 180ms ease',
    '&:hover': {
      backgroundColor: 'var(--netdive-menu-hover)',
      borderColor: 'var(--netdive-menu-border)'
    }
  },
  drawerIntegrationMain: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    overflow: 'hidden'
  },
  drawerIntegrationSummary: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--netdive-menu-muted)',
    fontSize: 11,
    fontWeight: 700
  },
  sideSettingsPanel: {
    position: 'absolute',
    top: 76,
    left: drawerWidth + 18,
    width: 420,
    maxHeight: 'calc(100vh - 104px)',
    zIndex: 1250,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    borderRadius: 18,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-bg)',
    color: 'var(--netdive-detail-text)',
    boxShadow: 'var(--netdive-detail-shadow)',
    overflow: 'auto'
  },
  sideSettingsHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2)
  },
  sideSettingsHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5)
  },
  sideSettingsTitle: {
    color: 'var(--netdive-detail-title)',
    fontSize: 18,
    fontWeight: 900
  },
  sideSettingsDescription: {
    marginTop: 4,
    color: 'var(--netdive-detail-muted)',
    fontSize: 13,
    lineHeight: 1.45
  },
  sideSettingsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75)
  },
  sideSettingsRow: {
    minHeight: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.1),
    borderRadius: 12,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    '& span': {
      color: 'var(--netdive-detail-title)',
      fontSize: 13,
      fontWeight: 800
    },
    '& small': {
      color: 'var(--netdive-detail-muted)',
      fontSize: 11,
      fontWeight: 700
    }
  },
  sideSettingsControlBlock: {
    padding: theme.spacing(1.2),
    borderRadius: 12,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    '& .MuiToggleButtonGroup-root': {
      width: '100%',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      marginTop: theme.spacing(0.75),
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid var(--netdive-menu-border)'
    },
    '& .MuiToggleButton-root': {
      minWidth: 0,
      minHeight: 36,
      padding: theme.spacing(0.8, 1.1),
      border: 'none',
      borderRadius: 0,
      color: 'var(--netdive-menu-muted)',
      backgroundColor: 'var(--netdive-menu-card)',
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1.25,
      transition: 'background-color 180ms ease, color 180ms ease, box-shadow 180ms ease'
    },
    '& .MuiToggleButton-root.Mui-selected': {
      color: 'var(--netdive-menu-active-text)',
      backgroundColor: 'var(--netdive-menu-active)',
      boxShadow: 'inset 0 0 0 1px rgba(22, 119, 255, 0.38), 0 1px 2px rgba(15, 23, 42, 0.08)'
    },
    '& .MuiToggleButton-root:hover': {
      color: 'var(--netdive-menu-active-text)',
      backgroundColor: 'var(--netdive-menu-hover)'
    }
  },
  sideSettingsControlTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    color: 'var(--netdive-detail-title)',
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.35
  },
  preferenceHeaderDescription: {
    opacity: 0.72
  },
  sidePreferenceNotice: {
    padding: theme.spacing(0.25, 0.25, 0),
    color: 'var(--netdive-detail-muted)',
    fontSize: 10.5,
    lineHeight: 1.45,
    opacity: 0.68
  },
  preferenceSettingsList: {
    gap: theme.spacing(1.5)
  },
  preferenceControlBlock: {
    padding: theme.spacing(1.35, 1.45),
    borderRadius: 12
  },
  sideSettingsText: {
    color: 'var(--netdive-detail-text)',
    fontSize: 13,
    lineHeight: 1.55
  },
  sideSettingsLink: {
    color: 'var(--netdive-menu-active-text)',
    fontWeight: 800,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline'
    }
  },
  aboutProductCard: {
    padding: theme.spacing(1.3, 1.4),
    borderRadius: 14,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.2)
  },
  aboutInfoRow: {
    display: 'grid',
    gridTemplateColumns: '96px minmax(0, 1fr)',
    alignItems: 'center',
    gap: theme.spacing(1),
    minHeight: 34,
    '& span': {
      color: 'var(--netdive-detail-muted)',
      fontSize: 12,
      fontWeight: 800
    },
    '& strong': {
      color: 'var(--netdive-detail-title)',
      fontSize: 13,
      fontWeight: 900
    }
  },
  aboutCopyright: {
    marginTop: theme.spacing(0.8),
    paddingTop: theme.spacing(1),
    borderTop: '1px solid var(--netdive-detail-border)',
    color: 'var(--netdive-detail-muted)',
    fontSize: 12,
    fontWeight: 700
  },
  aboutActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(0.9),
    '& .MuiButton-root': {
      minHeight: 30,
      padding: theme.spacing(0.45, 1),
      borderRadius: 9,
      color: 'var(--netdive-menu-active-text)',
      borderColor: 'var(--netdive-menu-active-border)',
      fontSize: 12,
      fontWeight: 800,
      textTransform: 'none'
    }
  },
  helpPageTabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.35),
    borderRadius: 12,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)'
  },
  helpPageTab: {
    minHeight: 34,
    padding: theme.spacing(0.6, 0.8),
    border: 'none',
    borderRadius: 9,
    backgroundColor: 'transparent',
    color: 'var(--netdive-detail-muted)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
    transition: 'background-color 160ms ease, color 160ms ease, box-shadow 160ms ease',
    '&:hover': {
      backgroundColor: 'var(--netdive-menu-active)',
      color: 'var(--netdive-menu-active-text)'
    }
  },
  helpPageTabActive: {
    backgroundColor: '#ffffff',
    color: 'var(--netdive-menu-active-text)',
    boxShadow: '0 6px 14px rgba(15, 23, 42, 0.08)'
  },
  helpGuideCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1.25),
    borderRadius: 14,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)'
  },
  helpGuideTitle: {
    color: 'var(--netdive-detail-title)',
    fontSize: 13,
    fontWeight: 900
  },
  helpGuideList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.45),
    '& span': {
      position: 'relative',
      paddingLeft: 14,
      color: 'var(--netdive-detail-muted)',
      fontSize: 12,
      lineHeight: 1.45,
      '&:before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 7,
        width: 5,
        height: 5,
        borderRadius: 999,
        backgroundColor: 'var(--netdive-menu-active-text)',
        opacity: 0.62
      }
    }
  },
  helpDocsCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25),
    borderRadius: 14,
    border: '1px solid rgba(26, 115, 232, 0.2)',
    backgroundColor: 'rgba(232, 242, 255, 0.46)'
  },
  helpDocsLink: {
    flexShrink: 0,
    padding: theme.spacing(0.7, 1),
    borderRadius: 10,
    border: '1px solid #bfdbfe',
    backgroundColor: '#ffffff',
    color: '#2563eb',
    fontSize: 12,
    fontWeight: 900,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    '&:hover': {
      backgroundColor: '#eff6ff'
    }
  },
  kubernetesManagerPanel: {
    position: 'absolute',
    top: 76,
    left: drawerWidth + 18,
    right: 28,
    maxWidth: 1180,
    maxHeight: 'calc(100vh - 104px)',
    zIndex: 1250,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    borderRadius: 18,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-bg)',
    color: 'var(--netdive-detail-text)',
    boxShadow: 'var(--netdive-detail-shadow)',
    overflow: 'auto'
  },
  kubernetesManagerHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2)
  },
  kubernetesManagerTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: 'var(--netdive-detail-title)'
  },
  kubernetesManagerDescription: {
    marginTop: 4,
    color: 'var(--netdive-detail-muted)',
    fontSize: 13,
    lineHeight: 1.45
  },
  kubernetesSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: theme.spacing(1),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
    }
  },
  kubernetesTopologySummaryGrid: {
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
    }
  },
  infrastructureSummaryCard: {
    minHeight: 104,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.7),
    borderRadius: 14,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    cursor: 'default',
    transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
    '&:not(div)': {
      cursor: 'pointer'
    },
    '&:not(div):hover': {
      borderColor: 'rgba(26, 115, 232, 0.28)',
      backgroundColor: 'var(--netdive-menu-active)'
    },
    '& small': {
      display: 'block',
      color: 'var(--netdive-detail-muted)',
      fontSize: 14,
      fontWeight: 900
    },
    '& strong': {
      display: 'block',
      marginTop: 8,
      color: 'var(--netdive-detail-title)',
      fontSize: 34,
      lineHeight: 1,
      fontWeight: 900
    }
  },
  kubernetesTopologySummaryCard: {
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
    '&:hover': {
      borderColor: 'rgba(26, 115, 232, 0.28)',
      backgroundColor: 'var(--netdive-menu-active)'
    },
    '&:disabled': {
      cursor: 'default',
      opacity: 0.52,
      backgroundColor: 'var(--netdive-detail-section-bg)'
    },
    '&:disabled:hover': {
      borderColor: 'var(--netdive-detail-border)',
      backgroundColor: 'var(--netdive-detail-section-bg)'
    }
  },
  kubernetesResourceExplorer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25),
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 12,
    backgroundColor: 'var(--netdive-detail-section-bg)'
  },
  kubernetesResourceExplorerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.5),
    '& > div': {
      display: 'flex',
      minWidth: 0,
      flexDirection: 'column'
    },
    '& strong': {
      color: 'var(--netdive-detail-title)',
      fontSize: 14,
      fontWeight: 800
    },
    '& small': {
      color: 'var(--netdive-detail-muted)',
      fontSize: 11
    }
  },
  kubernetesResourceExplorerList: {
    display: 'flex',
    maxHeight: 260,
    flexDirection: 'column',
    overflowY: 'auto',
    borderTop: '1px solid var(--netdive-detail-border)'
  },
  kubernetesResourceExplorerItem: {
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 1fr) 20px',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    minHeight: 66,
    padding: theme.spacing(0.75, 1),
    border: 0,
    borderBottom: '1px solid var(--netdive-detail-border)',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    background: 'transparent',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'var(--netdive-menu-active)'
    },
    '& > span:nth-child(2)': {
      display: 'flex',
      minWidth: 0,
      flexDirection: 'column'
    },
    '& strong': {
      overflow: 'hidden',
      color: 'var(--netdive-detail-title)',
      fontSize: 12,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    '& small': {
      overflow: 'hidden',
      color: 'var(--netdive-detail-muted)',
      fontSize: 10.5,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    '& > svg': {
      color: 'var(--netdive-menu-active-text)',
      fontSize: 16
    }
  },
  kubernetesResourceExplorerScope: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    '& b': {
      overflow: 'hidden',
      maxWidth: '52%',
      color: 'var(--netdive-detail-text)',
      fontWeight: 700,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    '& span': {
      overflow: 'hidden',
      minWidth: 0,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  },
  kubernetesResourceExplorerIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--netdive-menu-active-text)',
    fontSize: 18,
    '& img': {
      width: 20,
      height: 20,
      objectFit: 'contain'
    }
  },
  infrastructureCardIcon: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--netdive-menu-active-text)',
    fontFamily: '"Font Awesome 5 Free"',
    fontSize: 36,
    fontWeight: 900,
    lineHeight: 1,
    position: 'relative',
    '& i': {
      position: 'absolute',
      right: -8,
      bottom: -6,
      color: 'inherit',
      fontFamily: '"Font Awesome 5 Free"',
      fontSize: 13,
      fontStyle: 'normal',
      fontWeight: 900,
      textShadow: '0 0 0 var(--netdive-detail-section-bg)'
    },
    '& img': {
      width: 38,
      height: 38,
      objectFit: 'contain'
    }
  },
  infrastructureOverviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1.25),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr'
    }
  },
  infrastructureOverviewCard: {
    minHeight: 112,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.45, 1.55),
    borderRadius: 14,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
    '&:hover': {
      borderColor: 'rgba(26, 115, 232, 0.28)',
      backgroundColor: 'var(--netdive-menu-active)'
    },
    '&:disabled': {
      cursor: 'default',
      opacity: 0.52,
      backgroundColor: 'var(--netdive-detail-section-bg)'
    },
    '&:disabled:hover': {
      borderColor: 'var(--netdive-detail-border)',
      backgroundColor: 'var(--netdive-detail-section-bg)'
    },
    '& strong': {
      color: 'var(--netdive-detail-title)',
      fontSize: 15,
      fontWeight: 900
    },
    '& small': {
      color: 'var(--netdive-detail-muted)',
      fontSize: 13,
      lineHeight: 1.42,
      fontWeight: 700
    },
    '& em': {
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.9),
      color: 'var(--netdive-detail-title)',
      fontStyle: 'normal',
      fontWeight: 900
    },
    '& em strong': {
      fontSize: 24,
      lineHeight: 1
    },
    '& em svg': {
      color: 'var(--netdive-menu-active-text)',
      opacity: 0.72
    }
  },
  infrastructureOverviewCardMain: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    minWidth: 0,
    '& > span:last-child': {
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    },
    '& $infrastructureCardIcon': {
      fontSize: 30
    }
  },
  infrastructureOverviewCardActive: {
    borderColor: 'rgba(26, 115, 232, 0.38)',
    backgroundColor: 'var(--netdive-menu-active)',
    boxShadow: '0 8px 18px rgba(26, 115, 232, 0.1)'
  },
  infrastructureOverviewCardValueText: {
    fontSize: '20px !important'
  },
  infrastructureViewToggle: {
    '& .MuiToggleButton-root': {
      minHeight: 32,
      padding: theme.spacing(0.45, 1),
      border: '1px solid var(--netdive-detail-border)',
      color: 'var(--netdive-detail-muted)',
      fontSize: 12,
      fontWeight: 800
    },
    '& .MuiToggleButton-root.Mui-selected': {
      color: 'var(--netdive-menu-active-text)',
      backgroundColor: 'var(--netdive-menu-active)'
    }
  },
  infrastructureHostList: {
    maxHeight: 320,
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(0.8),
    paddingRight: theme.spacing(0.5),
    alignContent: 'start',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr'
    },
    '& $kubernetesEmptyRow': {
      gridColumn: '1 / -1'
    }
  },
  infrastructureHostCard: {
    padding: theme.spacing(0.9, 1),
    borderRadius: 12,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    minWidth: 0
  },
  infrastructureHostName: {
    color: 'var(--netdive-detail-title)',
    fontSize: 13,
    fontWeight: 900
  },
  infrastructureHostOverviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(0.7),
    marginTop: theme.spacing(0.7),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr'
    },
    '& $infrastructureOverviewCard': {
      minHeight: 96,
      backgroundColor: 'var(--netdive-detail-bg)'
    }
  },
  infrastructureHostOverviewCardCompact: {
    minHeight: 76,
    gap: theme.spacing(0.8),
    padding: theme.spacing(0.85, 0.95),
    borderRadius: 12,
    '& strong': {
      fontSize: 12.5
    },
    '& small': {
      fontSize: 11,
      lineHeight: 1.28
    },
    '& em': {
      gap: theme.spacing(0.45)
    },
    '& em strong': {
      fontSize: 19
    },
    '& em svg': {
      fontSize: 16
    },
    '& $infrastructureOverviewCardMain': {
      gap: theme.spacing(0.8)
    },
    '& $infrastructureCardIcon': {
      fontSize: 24
    }
  },
  kubernetesTableHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      alignItems: 'flex-start',
      flexDirection: 'column'
    }
  },
  kubernetesSectionTitleArea: {
    minWidth: 0
  },
  kubernetesSectionTitle: {
    color: 'var(--netdive-detail-title)',
    fontSize: 15,
    fontWeight: 900
  },
  kubernetesSectionTitleRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    flexWrap: 'wrap'
  },
  kubernetesPolicyButton: {
    height: 26,
    minHeight: 26,
    padding: theme.spacing(0, 0.9),
    border: '1px solid #bfdbfe',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    color: '#2563eb',
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
    '& .MuiButton-startIcon': {
      marginRight: 4
    },
    '& svg': {
      fontSize: 13
    },
    '&:hover': {
      borderColor: '#93c5fd',
      backgroundColor: '#eff6ff'
    }
  },
  kubernetesSectionHint: {
    marginTop: 4,
    color: 'var(--netdive-detail-muted)',
    fontSize: 12
  },
  kubernetesTableActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    '& .MuiButton-root': {
      height: 30,
      minHeight: 30,
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      textTransform: 'none',
      transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease'
    },
    '& .MuiButton-startIcon': {
      marginRight: 4
    },
    '& svg': {
      fontSize: 14
    },
    [theme.breakpoints.down('sm')]: {
      width: '100%',
      justifyContent: 'flex-end',
      flexWrap: 'wrap'
    }
  },
  kubernetesRefreshButton: {
    padding: theme.spacing(0, 1.05),
    border: '1px solid #bfdbfe',
    backgroundColor: '#ffffff',
    color: '#2563eb',
    '&:hover': {
      borderColor: '#93c5fd',
      backgroundColor: '#eff6ff'
    }
  },
  kubernetesTestAllButton: {
    padding: theme.spacing(0, 1.2),
    border: '1px solid #2563eb',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    boxShadow: '0 8px 18px rgba(37, 99, 235, 0.18)',
    '&:hover': {
      borderColor: '#1d4ed8',
      backgroundColor: '#1d4ed8',
      boxShadow: '0 10px 22px rgba(37, 99, 235, 0.24)'
    },
    '&.Mui-disabled': {
      borderColor: 'var(--netdive-detail-border)',
      backgroundColor: 'var(--netdive-detail-section-bg)',
      color: 'var(--netdive-detail-muted)',
      boxShadow: 'none'
    }
  },
  kubernetesTableWrap: {
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 14,
    overflow: 'auto',
    backgroundColor: 'var(--netdive-detail-bg)'
  },
  kubernetesTable: {
    minWidth: 1080
  },
  kubernetesTableHead: {
    display: 'grid',
    gridTemplateColumns: '1.55fr 0.9fr 0.8fr 1.7fr 1.1fr 1.15fr 1fr 1.25fr',
    gap: theme.spacing(1),
    padding: theme.spacing(1.1, 1.25),
    borderBottom: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    color: 'var(--netdive-detail-muted)',
    fontSize: 11,
    fontWeight: 900
  },
  kubernetesTableRow: {
    minHeight: 70,
    display: 'grid',
    gridTemplateColumns: '1.55fr 0.9fr 0.8fr 1.7fr 1.1fr 1.15fr 1fr 1.25fr',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.25),
    borderBottom: '1px solid var(--netdive-detail-border)',
    '&:last-child': {
      borderBottom: 'none'
    }
  },
  kubernetesEmptyRow: {
    padding: theme.spacing(2),
    color: 'var(--netdive-detail-muted)',
    fontSize: 13
  },
  kubernetesNameCell: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 900,
    color: 'var(--netdive-detail-title)'
  },
  kubernetesMutedCell: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--netdive-detail-muted)',
    fontSize: 12
  },
  kubernetesPill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 24,
    padding: theme.spacing(0.25, 0.8),
    borderRadius: 999,
    backgroundColor: 'var(--netdive-menu-active)',
    color: 'var(--netdive-menu-active-text)',
    fontSize: 11,
    fontWeight: 900
  },
  kubernetesApiCell: {
    minWidth: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.35),
    color: 'var(--netdive-detail-text)',
    fontSize: 12,
    '& .MuiIconButton-root': {
      padding: 3,
      color: 'var(--netdive-detail-muted)'
    }
  },
  kubernetesSwitchCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: 'var(--netdive-detail-text)',
    fontSize: 12,
    fontWeight: 800
  },
  kubernetesActionCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    '& .MuiButton-root': {
      minWidth: 0,
      padding: theme.spacing(0.35, 0.65),
      color: 'var(--netdive-menu-active-text)',
      fontSize: 11,
      fontWeight: 800
    }
  },
  kubernetesProbeInfoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr'
    }
  },
  kubernetesProbeInfoCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.65),
    padding: theme.spacing(1.2),
    borderRadius: 14,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    '& strong': {
      color: 'var(--netdive-detail-title)',
      fontSize: 13
    },
    '& small': {
      color: 'var(--netdive-detail-muted)',
      fontSize: 12,
      lineHeight: 1.45
    }
  },
  kubernetesPolicyNotice: {
    marginTop: theme.spacing(1),
    display: 'grid',
    gridTemplateColumns: '20px 1fr',
    gap: theme.spacing(0.75),
    alignItems: 'center',
    padding: theme.spacing(0.9, 1),
    borderRadius: 12,
    border: '1px solid rgba(26, 115, 232, 0.18)',
    backgroundColor: 'rgba(232, 242, 255, 0.52)',
    color: 'var(--netdive-detail-text)',
    fontSize: 12,
    lineHeight: 1.45,
    '& svg': {
      color: 'var(--netdive-menu-active-text)',
      fontSize: 18
    }
  },
  kubernetesProbeBadgeList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.25)
  },
  kubernetesProbeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 24,
    padding: theme.spacing(0.25, 0.75),
    borderRadius: 999,
    border: '1px solid rgba(26, 115, 232, 0.18)',
    backgroundColor: 'rgba(232, 242, 255, 0.68)',
    color: 'var(--netdive-menu-active-text)',
    fontSize: 11,
    fontWeight: 800
  },
  kubernetesProbeBadgeMuted: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 24,
    padding: theme.spacing(0.25, 0.75),
    borderRadius: 999,
    border: '1px solid rgba(180, 83, 9, 0.18)',
    backgroundColor: 'rgba(254, 243, 199, 0.58)',
    color: '#92400e',
    fontSize: 11,
    fontWeight: 800
  },
  kubernetesDialogText: {
    color: 'var(--netdive-detail-text)',
    fontSize: 14,
    lineHeight: 1.5
  },
  kubernetesDialogTarget: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: 12,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    color: 'var(--netdive-detail-title)',
    fontWeight: 900,
    '& strong': {
      display: 'block',
      color: 'var(--netdive-detail-title)',
      fontSize: 14
    },
    '& small': {
      display: 'block',
      marginTop: 4,
      color: 'var(--netdive-detail-muted)',
      fontSize: 12,
      lineHeight: 1.4,
      fontWeight: 700
    }
  },
  kubernetesTestDialogContent: {
    minHeight: 520,
    maxHeight: 520,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  kubernetesTestSummary: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(0.9, 1),
    borderRadius: 12,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-menu-active)',
    color: 'var(--netdive-menu-active-text)',
    fontSize: 13,
    fontWeight: 900
  },
  kubernetesStatusSteps: {
    marginTop: theme.spacing(1.25),
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(0.75),
    '& span': {
      padding: theme.spacing(0.75),
      borderRadius: 10,
      color: 'var(--netdive-detail-muted)',
      backgroundColor: 'var(--netdive-detail-section-bg)',
      fontSize: 12,
      fontWeight: 800
    }
  },
  kubernetesCheckList: {
    flex: 1,
    minHeight: 0,
    marginTop: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    overflowY: 'auto',
    paddingRight: theme.spacing(0.5)
  },
  kubernetesCheckItem: {
    display: 'grid',
    gridTemplateColumns: '28px 1fr',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: 12,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    '& strong': {
      display: 'block',
      color: 'var(--netdive-detail-title)',
      fontSize: 13
    },
    '& small': {
      display: 'block',
      marginTop: 3,
      color: 'var(--netdive-detail-muted)',
      fontSize: 12,
      lineHeight: 1.4
    }
  },
  kubernetesCheckOk: {
    color: '#16a34a',
    '& svg': {
      fontSize: 20
    }
  },
  kubernetesCheckFail: {
    color: '#dc2626',
    '& svg': {
      fontSize: 20
    }
  },
  kubernetesCheckPending: {
    color: 'var(--netdive-menu-active-text)',
    '& svg': {
      fontSize: 20
    }
  },
  kubernetesCheckWaiting: {
    color: 'var(--netdive-detail-muted)',
    opacity: 0.65,
    '& svg': {
      fontSize: 20
    }
  },
  content: {
    flexGrow: 1,
    position: 'relative',
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    height: '100vh',
    overflow: 'auto',
    background: 'var(--netdive-content-bg)',
    paddingTop: 64,
    boxSizing: 'border-box'
  },
  container: {
    paddingTop: theme.spacing(0),
    paddingBottom: theme.spacing(0),
    paddingLeft: theme.spacing(2.5),
    paddingRight: theme.spacing(0),
    boxSizing: 'border-box',
  },
  topology: {
    height: `calc(100vh - 64px)`,
    background: 'var(--topology-bg)',
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
    border: '1px solid var(--netdive-detail-border)',
    boxShadow: 'var(--netdive-detail-shadow)',
    backgroundColor: 'var(--netdive-detail-bg)',
    color: 'var(--netdive-detail-text)',
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
    left: topologyLevelMenuWidth + 16,
    top: 80,
    maxWidth: 'unset',
    width: 'unset',
    paddingTop: theme.spacing(0),
    paddingBottom: theme.spacing(0),
    paddingLeft: theme.spacing(0),
    paddingRight: theme.spacing(0),
  },
  nodeTagsPanelShift: {
    left: drawerWidth + 14,
  },
  nodeTagsFab: {
    margin: theme.spacing(1),
    boxShadow: 'unset',
    fontWeight: 'unset',
    fontSize: '0.8rem',
    padding: '0 12px !important'
  },
  linkTagsPanel: {
    position: 'fixed',
    left: drawerWidth + 24,
    right: 'auto',
    bottom: 40,
    maxWidth: `min(640px, calc(100vw - ${drawerWidth}px - 520px - 72px))`,
    width: `min(640px, calc(100vw - ${drawerWidth}px - 72px))`,
    paddingTop: theme.spacing(0),
    paddingBottom: theme.spacing(0),
    paddingLeft: theme.spacing(0),
    paddingRight: theme.spacing(0),
    pointerEvents: 'none',
    zIndex: 940,
    transform: 'none',
    [theme.breakpoints.down('sm')]: {
      left: 16,
      right: 16,
      bottom: 16,
      maxWidth: 'calc(100vw - 32px)',
    },
  },
  linkTagsPanelShift: {
    left: drawerWidth + 20,
  },
  recentViewedNodesPanel: {
    position: 'fixed',
    left: drawerWidth + 24,
    bottom: 40,
    width: `min(289px, calc(100vw - ${drawerWidth}px - 72px))`,
    maxWidth: `min(289px, calc(100vw - ${drawerWidth}px - 520px - 72px))`,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    zIndex: 940,
    pointerEvents: 'none',
    [theme.breakpoints.down('sm')]: {
      left: 16,
      right: 16,
      bottom: 16,
      width: 'calc(100vw - 32px)',
      maxWidth: 'calc(100vw - 32px)',
    },
  },
  recentViewedNodesPaper: {
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 248,
    borderRadius: 8,
    border: '1px solid var(--netdive-ant-border)',
    backgroundColor: 'var(--netdive-detail-bg)',
    boxShadow: 'var(--netdive-ant-shadow)',
    overflow: 'hidden',
  },
  recentViewedNodesPaperCollapsed: {
    maxHeight: 46,
  },
  recentViewedNodesPaperExpanded: {
    backgroundColor: 'var(--netdive-recent-glass-bg)',
    WebkitBackdropFilter: 'blur(8px)',
    backdropFilter: 'blur(8px)',
    boxShadow: 'var(--netdive-ant-shadow)',
    transition: 'background-color 180ms ease',
    '& $recentViewedNodesHeader': {
      background: 'var(--netdive-recent-glass-header)',
    },
    '&:hover': {
      backgroundColor: 'var(--netdive-recent-glass-hover)',
    },
    '&:hover $recentViewedNodesHeader': {
      background: 'var(--netdive-recent-glass-header-hover)',
    },
  },
  recentViewedNodesHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
    minHeight: 45,
    padding: '7px 8px',
    borderBottom: '1px solid var(--netdive-ant-border)',
    background: 'rgba(248, 250, 252, 0.9)',
  },
  recentViewedNodesHeaderTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    color: 'var(--netdive-detail-title)',
    fontSize: 12,
    fontWeight: 600,
  },
  recentViewedNodesHeaderIcon: {
    color: '#1A73E8',
    fontSize: 15,
    flexShrink: 0,
  },
  recentViewedNodesCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 19,
    height: 19,
    padding: '0 6px',
    borderRadius: 999,
    border: '1px solid #dbeafe',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: 600,
    lineHeight: 1,
  },
  recentViewedNodesHeaderActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  recentViewedNodesCollapseButton: {
    width: 22,
    height: 22,
    padding: 2,
    borderRadius: 6,
    border: '1px solid var(--netdive-ant-border)',
    color: 'var(--netdive-detail-muted)',
    backgroundColor: 'var(--netdive-detail-bg)',
    '&:hover': {
      color: '#1A73E8',
      backgroundColor: '#F3F8FF',
    },
    '& svg': {
      fontSize: 14,
    }
  },
  recentViewedNodesBody: {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: 5,
    '&::-webkit-scrollbar': {
      width: 5,
    },
    '&::-webkit-scrollbar-thumb': {
      borderRadius: 999,
      backgroundColor: 'rgba(100, 116, 139, 0.28)',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'transparent',
    },
  },
  recentViewedNodesEmpty: {
    color: 'var(--netdive-detail-muted)',
    fontSize: 10,
    lineHeight: 1.5,
    padding: '7px 5px',
  },
  recentViewedNodeItem: {
    appearance: 'none',
    width: '100%',
    border: '1px solid transparent',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--netdive-detail-text)',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: '24px minmax(0, 1fr)',
    alignItems: 'center',
    gap: 9,
    minHeight: 38,
    padding: '4px 5px',
    textAlign: 'left',
    transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
    '&:hover': {
      background: '#fbfdff',
      borderColor: '#dbeafe',
      boxShadow: 'none',
      transform: 'translateX(1px)',
    },
  },
  recentViewedNodeItemActive: {
    background: '#F8FBFF',
    borderColor: '#bfdbfe',
    boxShadow: 'none',
    '& $recentViewedNodeName': {
      color: '#2563EB',
    },
  },
  recentViewedNodeIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    '& svg': {
      fontSize: 13,
    },
    '& .fa': {
      fontSize: 12,
      lineHeight: 1,
    },
    '& img': {
      width: 15,
      height: 15,
      objectFit: 'contain',
    }
  },
  recentViewedNodeIconKubernetes: {
    color: 'var(--netdive-detail-connected-resource-icon)',
    background: 'var(--netdive-detail-connected-resource-icon-bg)',
    border: '1px solid var(--netdive-detail-connected-resource-icon-border)',
  },
  recentViewedNodeIconHost: {
    color: 'var(--netdive-detail-connected-resource-icon)',
    background: 'var(--netdive-detail-connected-resource-icon-bg)',
    border: '1px solid var(--netdive-detail-connected-resource-icon-border)',
  },
  recentViewedNodeIconUserVM: {
    color: 'var(--netdive-detail-connected-resource-icon)',
    background: 'var(--netdive-detail-connected-resource-icon-bg)',
    border: '1px solid var(--netdive-detail-connected-resource-icon-border)',
  },
  recentViewedNodeIconSystemVM: {
    color: 'var(--netdive-detail-connected-resource-icon)',
    background: 'var(--netdive-detail-connected-resource-icon-bg)',
    border: '1px solid var(--netdive-detail-connected-resource-icon-border)',
  },
  recentViewedNodeIconRouter: {
    color: 'var(--netdive-detail-connected-resource-icon)',
    background: 'var(--netdive-detail-connected-resource-icon-bg)',
    border: '1px solid var(--netdive-detail-connected-resource-icon-border)',
  },
  recentViewedNodeIconNetwork: {
    color: 'var(--netdive-detail-connected-resource-icon)',
    background: 'var(--netdive-detail-connected-resource-icon-bg)',
    border: '1px solid var(--netdive-detail-connected-resource-icon-border)',
  },
  recentViewedNodeText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  recentViewedNodeName: {
    color: 'var(--netdive-detail-title)',
    fontSize: 11,
    lineHeight: 1.3,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  recentViewedNodeType: {
    color: '#94A3B8',
    fontSize: 9.5,
    lineHeight: 1.35,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  linkTagsPanelPaper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.2),
    minWidth: 0,
    width: '100%',
    maxWidth: 640,
    maxHeight: 'calc(100vh - 160px)',
    overflowY: 'auto',
    padding: theme.spacing(1.6),
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 14,
    backgroundColor: 'var(--netdive-detail-bg)',
    boxShadow: 'var(--netdive-detail-shadow)',
    color: 'var(--netdive-detail-text)',
    pointerEvents: 'auto',
  },
  linkTagsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  linkTagsHeaderLeft: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  linkTagsTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  linkTagsTitle: {
    color: 'var(--netdive-detail-text)',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  linkTagsInfoIcon: {
    width: 16,
    height: 16,
    color: 'var(--netdive-detail-muted)',
    cursor: 'help',
  },
  linkTagsHeaderActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  linkTagsCollapseButton: {
    color: 'var(--netdive-detail-muted)',
    padding: 4,
    width: 30,
    height: 30,
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 8,
    backgroundColor: 'var(--netdive-detail-bg)',
    '&:hover': {
      color: '#1A73E8',
      backgroundColor: '#F3F8FF',
    },
  },
  linkLayerCards: {
    display: 'flex',
    alignItems: 'stretch',
    gap: theme.spacing(0.75),
    overflowX: 'auto',
    paddingBottom: 2,
    scrollbarWidth: 'thin',
  },
  linkLayerCard: {
    appearance: 'none',
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    color: 'var(--netdive-detail-text)',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 24px',
    alignItems: 'center',
    gap: theme.spacing(0.65),
    minWidth: 150,
    maxWidth: 176,
    padding: theme.spacing(0.58, 0.72),
    textAlign: 'left',
    position: 'relative',
    overflow: 'hidden',
    transition: 'border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease',
    '&:before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 0,
      backgroundColor: 'transparent',
      transition: 'width 160ms ease, background-color 160ms ease',
    },
    '&:hover': {
      borderColor: '#93C5FD',
      backgroundColor: '#F3F8FF',
      boxShadow: '0 8px 20px rgba(37, 99, 235, 0.08)',
    },
  },
  linkLayerCardVisible: {
    borderColor: '#1D4ED8',
    backgroundColor: '#EAF3FF',
    boxShadow: 'inset 0 0 0 1px rgba(37, 99, 235, 0.08)',
    '&:before': {
      width: 3,
      backgroundColor: '#2563EB',
    },
  },
  linkLayerCardEvent: {
    borderColor: '#1D4ED8',
    backgroundColor: '#EAF3FF',
    boxShadow: 'inset 0 0 0 1px rgba(37, 99, 235, 0.08)',
    '&:before': {
      width: 3,
      backgroundColor: '#2563EB',
    },
  },
  linkLayerCardHidden: {
    opacity: 0.92,
  },
  linkLayerCardMain: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  linkLayerCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    marginBottom: 3,
  },
  linkLayerCardKey: {
    alignSelf: 'flex-start',
    borderRadius: 0,
    backgroundColor: 'transparent',
    border: 0,
    color: 'var(--netdive-detail-text)',
    fontSize: 14,
    fontWeight: 650,
    lineHeight: 1,
    padding: 0,
    flexShrink: 0,
  },
  linkLayerCardBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    color: '#1D4ED8',
    fontSize: 9.5,
    fontWeight: 700,
    lineHeight: 1,
    padding: '2px 5px',
    whiteSpace: 'nowrap',
  },
  linkLayerCardName: {
    color: 'var(--netdive-detail-text)',
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  linkLayerCardSummary: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 400,
    lineHeight: 1.25,
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  linkLayerMoreHint: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    minWidth: 132,
    border: '1px dashed var(--netdive-detail-border)',
    borderRadius: 10,
    color: 'var(--netdive-detail-muted)',
    backgroundColor: 'var(--netdive-detail-soft-bg, #F8FAFC)',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.35,
    padding: theme.spacing(1, 1.1),
  },
  linkLayerStateIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 7,
    border: '1px solid var(--netdive-detail-border)',
    color: '#1A73E8',
    backgroundColor: '#ffffff',
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1,
    justifySelf: 'end',
    boxSizing: 'border-box',
  },
  linkLayerStateIconvisible: {
    borderColor: '#1A73E8',
    backgroundColor: '#E8F2FF',
  },
  linkLayerStateIconevent: {
    borderColor: '#93C5FD',
    backgroundColor: '#F3F8FF',
  },
  linkLayerStateIconhidden: {
    color: 'transparent',
    backgroundColor: '#ffffff',
  },
  linkTagsStateHelp: {
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    padding: theme.spacing(0.85, 0.9),
  },
  linkTagsStateHelpTitle: {
    display: 'block',
    color: 'var(--netdive-detail-text)',
    fontSize: 11.8,
    fontWeight: 700,
    marginBottom: 7,
  },
  linkTagsStateHelpItems: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: theme.spacing(0.55),
  },
  linkTagsStateHelpItem: {
    display: 'grid',
    gridTemplateColumns: '24px minmax(0, 1fr)',
    alignItems: 'start',
    gap: theme.spacing(0.65),
    color: 'var(--netdive-detail-text)',
    fontSize: 11.5,
    lineHeight: 1.3,
    '& strong': {
      display: 'block',
      fontWeight: 700,
      marginBottom: 2,
    },
    '& em': {
      display: 'block',
      color: 'var(--netdive-detail-muted)',
      fontStyle: 'normal',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  },
  linkTagsNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #BFDBFE',
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    color: '#1D4ED8',
    fontSize: 12,
    lineHeight: 1.4,
    padding: theme.spacing(0.9, 1),
  },
  linkTagsUsageExamples: {
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    padding: theme.spacing(0.48, 0.6),
  },
  linkTagsUsageToggle: {
    appearance: 'none',
    border: 0,
    background: 'transparent',
    color: 'var(--netdive-detail-text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    width: '100%',
    minHeight: 24,
    padding: theme.spacing(0.1, 0.25),
    fontSize: 13,
    fontWeight: 650,
    textAlign: 'left',
    '& svg': {
      color: 'var(--netdive-detail-muted)',
      flexShrink: 0,
    },
    '&:hover': {
      color: '#1A73E8',
    },
  },
  linkTagsUsageGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: theme.spacing(0.45),
    marginTop: theme.spacing(0.45),
  },
  linkTagsUsageCard: {
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    padding: theme.spacing(0.48, 0.55),
    color: 'var(--netdive-detail-text)',
    minWidth: 0,
    '& ul': {
      margin: '3px 0 0 0',
      paddingLeft: 14,
      color: 'var(--netdive-detail-muted)',
      fontSize: 12,
      lineHeight: 1.3,
    },
    '& li': {
      marginBottom: 1,
    },
  },
  linkTagsUsageHeader: {
    display: 'grid',
    gridTemplateColumns: '24px minmax(0, 1fr)',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: 'var(--netdive-detail-text)',
    fontSize: 13,
    fontWeight: 650,
    lineHeight: 1.22,
    '& strong': {
      display: 'block',
      minWidth: 0,
      overflow: 'visible',
      whiteSpace: 'normal',
      wordBreak: 'keep-all',
    },
  },
  linkUsageDiagram: {
    display: 'block',
    width: 88,
    height: 38,
    marginTop: 2,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--netdive-detail-border)',
  },
  linkUsageLineActive: {
    stroke: '#2563EB',
    strokeWidth: 2,
    strokeLinecap: 'round',
  },
  linkUsageLineMuted: {
    stroke: '#CBD5E1',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeDasharray: '3 4',
  },
  linkUsageNodeActive: {
    fill: '#E8F2FF',
    stroke: '#2563EB',
    strokeWidth: 1.6,
  },
  linkUsageNodeMuted: {
    fill: '#F8FAFC',
    stroke: '#CBD5E1',
    strokeWidth: 1.5,
  },
  linkUsageNodeSelected: {
    fill: '#FFFFFF',
    stroke: '#2563EB',
    strokeWidth: 2.2,
  },
  linkTagsCollapsedTab: {
    display: 'block',
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 14,
    backgroundColor: 'var(--netdive-detail-bg)',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    color: 'var(--netdive-detail-text)',
    width: 'fit-content',
    maxWidth: 'min(560px, 100%)',
    boxSizing: 'border-box',
    minHeight: 136,
    padding: theme.spacing(1.5, 1.6),
    pointerEvents: 'auto',
  },
  linkTagsCollapsedTabInfrastructure: {
    width: 'min(384px, 100%)',
  },
  linkTagsCollapsedTabKubernetes: {
    width: 'min(404px, 100%)',
  },
  linkTagsCollapsedMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.2),
    minWidth: 0,
  },
  linkTagsCollapsedHeader: {
    appearance: 'none',
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    width: '100%',
    padding: 0,
    textAlign: 'left',
    color: 'var(--netdive-detail-text)',
    '&:hover $linkTagsCollapsedTitle': {
      color: '#1A73E8',
    },
  },
  linkTagsCollapsedHeaderLeft: {
    display: 'grid',
    gridTemplateColumns: '24px minmax(0, 1fr)',
    alignItems: 'start',
    gap: theme.spacing(0.9),
    minWidth: 0,
  },
  linkTagsCollapsedHeaderIcon: {
    width: 20,
    height: 20,
    color: '#1A73E8',
    marginTop: 1,
  },
  linkTagsCollapsedTitle: {
    display: 'block',
    color: 'var(--netdive-detail-text)',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
  },
  linkTagsCollapsedDescription: {
    display: 'block',
    color: 'var(--netdive-detail-muted)',
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.4,
    marginTop: 3,
  },
  linkTagsCompactBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.8),
    minWidth: 0,
  },
  linkTagsCompactRow: {
    display: 'grid',
    gridTemplateColumns: '64px minmax(0, 1fr)',
    alignItems: 'center',
    gap: theme.spacing(0.9),
    minWidth: 0,
  },
  linkTagsCompactRowLabel: {
    color: 'var(--netdive-detail-muted)',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  linkTagsCompactDivider: {
    height: 1,
    backgroundColor: 'var(--netdive-detail-border)',
    margin: theme.spacing(0.3, 0),
  },
  linkTagsCompactSegment: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflowX: 'auto',
    minWidth: 0,
  },
  linkTagsCompactControl: {
    appearance: 'none',
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 9,
    backgroundColor: 'var(--netdive-detail-bg)',
    color: 'var(--netdive-detail-text)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
    height: 32,
    padding: '0 10px',
    flexShrink: 0,
    fontSize: 12.5,
    fontWeight: 600,
    lineHeight: 1,
    transition: 'border-color 160ms ease, background-color 160ms ease',
    '&:hover': {
      borderColor: '#93C5FD',
      backgroundColor: '#F3F8FF',
    },
  },
  linkTagsCompactControlActive: {
    borderColor: '#1A73E8',
    backgroundColor: '#E8F2FF',
    color: '#1A73E8',
  },
  connectionDisplayPopoverPaper: {
    marginTop: 6,
    width: 'min(410px, calc(100vw - 48px))',
    maxWidth: 420,
    maxHeight: 'calc(100vh - 96px)',
    borderRadius: 14,
    border: '1px solid var(--netdive-detail-border)',
    background: '#ffffff',
    boxShadow: '0 14px 34px rgba(15, 23, 42, 0.12)',
    overflowY: 'auto',
    zIndex: theme.zIndex.modal + 20,
    [theme.breakpoints.down('sm')]: {
      width: 'calc(100vw - 32px)',
      maxWidth: 'calc(100vw - 32px)',
    },
  },
  connectionDisplayPopoverContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.9),
    padding: theme.spacing(1.05),
    background: '#ffffff',
  },
  connectionDisplayDescription: {
    color: 'var(--netdive-detail-muted)',
    fontSize: 11.5,
    lineHeight: 1.45,
    fontWeight: 500,
    margin: 0,
    marginTop: 4,
  },
  connectionDisplayNotice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.65),
    padding: theme.spacing(0.7, 0.8),
    borderRadius: 10,
    border: '1px solid var(--netdive-detail-border-soft)',
    background: 'var(--netdive-detail-soft-card, #fbfdff)',
    color: 'var(--netdive-detail-muted)',
    fontSize: 11,
    lineHeight: 1.45,
    '& svg': {
      marginTop: 1,
      color: '#1A73E8',
      fontSize: 16,
      flexShrink: 0
    }
  },
  linkTagsCollapsedIcon: {
    color: 'var(--netdive-detail-muted)',
    flexShrink: 0,
    marginTop: 2,
  },
  search: {
    padding: theme.spacing(0.55, 1),
    position: 'relative',
    borderRadius: 8,
    backgroundColor: 'var(--netdive-search-bg)',
    border: '1px solid var(--netdive-search-border)',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: 'var(--netdive-search-hover)',
    },
    marginRight: theme.spacing(0.5),
    marginLeft: 0,
    width: 'auto',
    maxWidth: 360,
    minWidth: 150,
    flex: '1 2 320px',
    lineHeight: 1,
    fontSize: '2rem',
    '@media (max-width: 1450px)': {
      minWidth: 110,
      maxWidth: 260,
      paddingLeft: theme.spacing(0.5),
      paddingRight: theme.spacing(0.5),
    },
    '@media (max-width: 1150px)': {
      minWidth: 72,
      maxWidth: 190,
    }
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
    width: 44,
    height: 44,
    border: 0,
    color: 'var(--netdive-appbar-muted)',
    borderRadius: 0,
    marginLeft: 0,
    padding: 0,
    backgroundColor: 'transparent',
    transition: 'background-color 0.15s ease-out, color 0.15s ease-out',
    '&:hover': {
      color: 'var(--netdive-action-btn-text)',
      backgroundColor: 'var(--netdive-action-btn-hover)'
    },
    '&.Mui-disabled': {
      color: 'rgba(100, 116, 139, 0.38)',
      backgroundColor: 'transparent'
    },
    '&:focus-visible': {
      outline: '2px solid var(--netdive-action-btn-border-hover)',
      outlineOffset: -2
    },
    '& svg': {
      fontSize: 18
    },
    '@media (max-width: 1450px)': {
      width: 40,
      height: 42,
    }
  },
  topologyIconButtonActive: {
    color: 'var(--netdive-action-btn-text) !important',
    backgroundColor: 'var(--netdive-action-btn-hover) !important',
    boxShadow: 'inset 0 -2px 0 var(--netdive-action-btn-border-hover)'
  },
  topologyTextIconButton: {
    width: 52,
    '& span': {
      color: 'inherit',
      fontSize: 12,
      fontWeight: 800,
      lineHeight: 1,
      whiteSpace: 'nowrap'
    },
    [theme.breakpoints.down('sm')]: {
      width: 42,
      '& span': {
        fontSize: 11
      }
    },
    '@media (max-width: 1450px)': {
      width: 46,
    }
  },
  topologyZoomButtonText: {
    color: 'inherit',
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1
  },
  topologyZoomPercent: {
    width: 48,
    height: 44,
    border: 0,
    borderLeft: '1px solid var(--netdive-action-btn-border)',
    borderRight: '1px solid var(--netdive-action-btn-border)',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--netdive-detail-title)',
    backgroundColor: '#fbfdff',
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background-color 0.15s ease-out, color 0.15s ease-out',
    '&:hover': {
      color: 'var(--netdive-action-btn-text)',
      backgroundColor: 'var(--netdive-action-btn-hover)'
    },
    '&:focus-visible': {
      outline: '2px solid var(--netdive-action-btn-border-hover)',
      outlineOffset: -2
    },
    [theme.breakpoints.down('sm')]: {
      display: 'none'
    },
    '@media (max-width: 1450px)': {
      width: 42,
      height: 42,
    }
  },
  topologyStandaloneButton: {
    width: 48,
    height: 48,
    border: '1px solid #d7e2f0',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
    '&:hover': {
      borderColor: '#bfdbfe'
    },
    '@media (max-width: 1450px)': {
      width: 44,
      height: 44,
    }
  },
  layerFilterButton: {
    height: 48,
    minWidth: 140,
    maxWidth: 240,
    width: 'auto',
    flex: '1 1 220px',
    marginLeft: 0,
    padding: theme.spacing(0, 1.5),
    border: '1px solid #d7e2f0',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    color: 'var(--netdive-detail-title)',
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'none',
    whiteSpace: 'nowrap',
    lineHeight: 1,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
    '&:hover': {
      color: 'var(--netdive-detail-title)',
      backgroundColor: '#f8fbff',
      borderColor: '#bfdbfe',
      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)'
    },
    '& svg': {
      color: 'var(--netdive-detail-muted)',
      fontSize: '1.05rem'
    },
    '& .MuiButton-label': {
      width: '100%',
      display: 'grid',
      gridTemplateColumns: '20px minmax(0, 1fr) 16px',
      alignItems: 'center',
      columnGap: 10
    },
    '@media (max-width: 1450px)': {
      minWidth: 112,
      maxWidth: 200,
      height: 44,
      paddingLeft: 8,
      paddingRight: 8,
      '& .MuiButton-label': {
        gridTemplateColumns: '18px minmax(0, 1fr) 14px',
        columnGap: 6,
      }
    },
    '@media (max-width: 1150px)': {
      minWidth: 76,
      maxWidth: 128,
    }
  },
  displayOptionsButton: {
    minWidth: 130,
    maxWidth: 190,
    flexBasis: 170,
    marginLeft: 0,
    '@media (max-width: 1450px)': {
      minWidth: 104,
      maxWidth: 160,
    },
    '@media (max-width: 1150px)': {
      minWidth: 72,
      maxWidth: 112,
    }
  },
  layerFilterButtonIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    color: 'var(--netdive-action-btn-text)',
    '& svg': {
      color: 'currentColor',
      fontSize: 18
    }
  },
  layerFilterButtonText: {
    minWidth: 0,
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    overflow: 'hidden'
  },
  layerFilterButtonLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    lineHeight: 1,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'var(--netdive-detail-title)',
    fontSize: 13,
    fontWeight: 600
  },
  layerFilterButtonSummary: {
    display: 'block',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'var(--netdive-detail-muted)',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.1,
    '@media (max-width: 1150px)': {
      display: 'none'
    }
  },
  layerFilterButtonChevron: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    marginLeft: 'auto',
    '& svg': {
      fontSize: 16
    }
  },
  layerFilterMenuPaper: {
    marginTop: 7,
    minWidth: 250,
    borderRadius: 12,
    border: '1px solid #d7e2f0',
    background: '#ffffff',
    backgroundColor: '#ffffff !important',
    color: 'var(--netdive-detail-text)',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
    padding: theme.spacing(0.6),
    overflow: 'hidden',
    zIndex: theme.zIndex.modal + 20,
    '& .MuiList-root': {
      padding: 0,
      background: '#ffffff'
    }
  },
  layerFilterMenuItem: {
    width: '100%',
    minHeight: 58,
    display: 'grid',
    gridTemplateColumns: '28px minmax(0, 1fr) 20px',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.85, 1),
    borderRadius: 10,
    border: '1px solid transparent',
    '& .MuiListItemIcon-root': {
      minWidth: 28,
      color: 'var(--netdive-detail-muted)'
    },
    '& strong': {
      color: 'var(--netdive-detail-title)',
      fontSize: 13,
      fontWeight: 900
    },
    '& small': {
      color: 'var(--netdive-detail-muted)',
      fontSize: 11,
      fontWeight: 700
    },
    '&.Mui-selected': {
      backgroundColor: '#eff6ff',
      borderColor: '#dbeafe',
      '& .MuiListItemIcon-root, & strong, & $layerFilterMenuCheck': {
        color: 'var(--netdive-menu-active-text)'
      }
    },
    '&.Mui-selected:hover, &:hover': {
      backgroundColor: '#f3f8ff'
    }
  },
  layerFilterMenuText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflow: 'hidden'
  },
  layerFilterMenuCheck: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--netdive-menu-active-text)',
    '& svg': {
      fontSize: 17
    }
  },
  toolbar: {
    height: 64,
    minHeight: 64,
    boxSizing: 'border-box',
    minWidth: 0,
    paddingLeft: 16,
    paddingRight: 16,
    gap: theme.spacing(1),
    '@media (max-width: 1450px)': {
      paddingLeft: 10,
      paddingRight: 10,
      gap: 4,
    }
  },
  toolbarSectionDivider: {
    flex: '0 0 auto',
    width: 1,
    height: 36,
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
    backgroundColor: 'var(--netdive-action-btn-border)',
    opacity: 0.9,
    [theme.breakpoints.down('sm')]: {
      display: 'none'
    },
    '@media (max-width: 1150px)': {
      display: 'none'
    }
  },
  toolbarActionCluster: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1.05),
    marginLeft: theme.spacing(1),
    height: 48,
    flex: '0 0 auto',
    [theme.breakpoints.down('sm')]: {
      gap: theme.spacing(0.55),
      marginLeft: theme.spacing(0.5)
    },
    '@media (max-width: 1450px)': {
      gap: 4,
      marginLeft: 4,
      height: 44,
    }
  },
  toolbarActionGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0,
    height: 48,
    overflow: 'hidden',
    border: '1px solid #d7e2f0',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
    flex: '0 0 auto',
    '& > *:not(:first-child)': {
      borderLeft: '1px solid var(--netdive-action-btn-border)'
    },
    [theme.breakpoints.down('sm')]: {
      '& $topologyTextIconButton': {
        width: 40
      }
    },
    '@media (max-width: 1450px)': {
      height: 44,
    }
  },
  toolbarZoomGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0,
    height: 48,
    overflow: 'hidden',
    border: '1px solid #d7e2f0',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
    flex: '0 0 auto',
    '@media (max-width: 1450px)': {
      height: 44,
    }
  },
  toolbarUtilityActions: {
    display: 'inline-flex',
    flex: '0 0 auto',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    '& .MuiIconButton-root': {
      flex: '0 0 auto',
    },
    '@media (max-width: 1450px)': {
      '& .MuiIconButton-root': {
        width: 42,
        height: 42,
        padding: 8,
      }
    }
  },
  title: {
    paddingTop: 15,
    display: 'none',
    color: 'var(--netdive-appbar-text)',
    fontWeight: 700,
    letterSpacing: 0.2,
    [theme.breakpoints.up('sm')]: {
      display: 'block',
    },
  }
})
