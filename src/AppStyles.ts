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
const topologyLevelMenuWidth = 188

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
    marginRight: 12,
    color: 'var(--netdive-appbar-text)'
  },
  menuButtonHidden: {
    display: 'none',
  },
  subTitle: {
    fontStyle: 'normal',
    fontWeight: 500,
    color: 'var(--netdive-appbar-muted)'
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
    gridTemplateColumns: '32px 1fr',
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
    gridTemplateColumns: '32px 1fr',
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
    gap: 3
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
    }
  },
  sideSettingsControlTitle: {
    color: 'var(--netdive-detail-title)',
    fontSize: 13,
    fontWeight: 900
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
  kubernetesSummaryCard: {
    minHeight: 86,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: theme.spacing(1.4),
    borderRadius: 14,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    '& span': {
      color: 'var(--netdive-detail-muted)',
      fontSize: 12,
      fontWeight: 800
    },
    '& strong': {
      color: 'var(--netdive-detail-title)',
      fontSize: 28,
      lineHeight: 1
    }
  },
  kubernetesTableHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.spacing(2)
  },
  kubernetesSectionTitle: {
    color: 'var(--netdive-detail-title)',
    fontSize: 15,
    fontWeight: 900
  },
  kubernetesSectionHint: {
    marginTop: 4,
    color: 'var(--netdive-detail-muted)',
    fontSize: 12
  },
  kubernetesTableActions: {
    display: 'inline-flex',
    gap: theme.spacing(0.75),
    '& .MuiButton-root': {
      border: '1px solid var(--netdive-detail-border)',
      color: 'var(--netdive-menu-active-text)',
      fontWeight: 800
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
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr'
    }
  },
  kubernetesProbeInfoCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.2),
    borderRadius: 14,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    '& strong': {
      color: 'var(--netdive-detail-title)',
      fontSize: 13
    },
    '& span': {
      color: 'var(--netdive-detail-muted)',
      fontSize: 12,
      lineHeight: 1.45
    }
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
    height: '100vh',
    overflow: 'auto',
    background: 'var(--netdive-content-bg)',
  },
  container: {
    paddingTop: theme.spacing(0),
    paddingBottom: theme.spacing(0),
    paddingLeft: theme.spacing(0),
    paddingRight: theme.spacing(0),
  },
  topology: {
    height: `calc(100vh - 10px)`,
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
  linkTagsPanelShift: {
    left: drawerWidth + 20,
  },
  linkTagsPanelPaper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '100px',
    padding: theme.spacing(2),
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 12,
    backgroundColor: 'var(--netdive-detail-bg)',
    boxShadow: 'var(--netdive-detail-shadow)',
    color: 'var(--netdive-detail-text)',
  },
  linkTagsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(0.5)
  },
  linkTagsCollapseButton: {
    color: 'var(--netdive-detail-muted)',
    padding: 4
  },
  linkTagsCollapsedTab: {
    cursor: 'pointer',
    border: '1px solid var(--netdive-detail-border)',
    borderRadius: 10,
    backgroundColor: 'var(--netdive-detail-bg)',
    boxShadow: 'var(--netdive-detail-shadow)',
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
    backgroundColor: 'var(--netdive-search-bg)',
    border: '1px solid var(--netdive-search-border)',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: 'var(--netdive-search-hover)',
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
    border: '1px solid var(--netdive-action-btn-border)',
    color: 'var(--netdive-action-btn-text)',
    borderRadius: 8,
    marginLeft: theme.spacing(1),
    padding: theme.spacing(0.65),
    backgroundColor: 'var(--netdive-action-btn-bg)',
    transition: 'all 0.15s ease-out',
    '&:hover': {
      backgroundColor: 'var(--netdive-action-btn-hover)',
      borderColor: 'var(--netdive-action-btn-border-hover)'
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
    color: 'var(--netdive-appbar-text)',
    fontWeight: 700,
    letterSpacing: 0.2,
    [theme.breakpoints.up('sm')]: {
      display: 'block',
    },
  }
})
