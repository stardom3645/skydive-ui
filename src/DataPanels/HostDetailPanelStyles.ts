import { createStyles, Theme } from '@material-ui/core'

export const styles = (theme: Theme) => createStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    color: 'var(--netdive-detail-text)',
    paddingBottom: theme.spacing(1)
  },
  panelCard: {
    border: '1px solid var(--netdive-detail-border-soft)',
    borderRadius: 16,
    background: 'var(--netdive-detail-card-bg, #ffffff)',
    overflow: 'hidden',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.035)'
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.9),
    padding: theme.spacing(1.25, 1.35),
    borderBottom: '1px solid var(--netdive-detail-border-subtle, rgba(226, 232, 240, 0.72))',
    background: 'var(--netdive-detail-section-header, #f8fafc)'
  },
  panelIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 28px',
    color: 'var(--topology-level-label-active-text)',
    background: 'rgba(232, 242, 255, 0.82)',
    '& svg': {
      fontSize: 17
    }
  },
  panelTitleBlock: {
    minWidth: 0
  },
  panelTitle: {
    color: 'var(--netdive-detail-text)',
    fontSize: 14,
    lineHeight: 1.2,
    fontWeight: 800
  },
  panelDescription: {
    marginTop: 3,
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 11.5,
    lineHeight: 1.35,
    fontWeight: 500
  },
  statusTileList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: 8,
    padding: theme.spacing(1.1, 1.25, 1.25)
  },
  statusTile: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '22px minmax(0, 1fr)',
    alignItems: 'center',
    columnGap: theme.spacing(0.75),
    rowGap: 2,
    minHeight: 58,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--netdive-detail-border-soft)',
    background: 'rgba(240, 253, 244, 0.56)',
    overflow: 'hidden'
  },
  statusTileMuted: {
    borderColor: 'var(--netdive-detail-border-soft)',
    background: 'rgba(248, 250, 252, 0.82)',
    '& $statusDot': {
      background: 'rgba(148, 163, 184, 0.75)'
    }
  },
  statusTileWarning: {
    borderColor: 'rgba(253, 186, 116, 0.72)',
    background: 'rgba(255, 247, 237, 0.72)',
    '& $statusDot': {
      background: '#f97316'
    }
  },
  statusDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 999,
    background: '#22c55e'
  },
  statusTileIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--topology-level-label-active-text)',
    background: 'rgba(255, 255, 255, 0.76)',
    '& svg': {
      fontSize: 14
    }
  },
  statusTileText: {
    minWidth: 0,
    maxWidth: '100%',
    paddingRight: 10
  },
  statusTileLabel: {
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 11.4,
    lineHeight: 1.2,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  statusTileValue: {
    marginTop: 2,
    color: 'var(--netdive-detail-text)',
    fontSize: 13,
    lineHeight: 1.2,
    fontWeight: 800,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  rowsCompact: {
    padding: theme.spacing(0.25, 1.35)
  },
  kvRow: {
    display: 'grid',
    gridTemplateColumns: '92px minmax(0, 1fr)',
    gap: theme.spacing(1),
    alignItems: 'center',
    minHeight: 34,
    borderBottom: '1px solid var(--netdive-detail-border-subtle, rgba(226, 232, 240, 0.62))',
    '&:last-child': {
      borderBottom: 0
    }
  },
  kvLabel: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 11.5,
    fontWeight: 650
  },
  kvValueWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    minWidth: 0
  },
  kvValue: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--netdive-detail-text)',
    fontSize: 12.5,
    fontWeight: 750,
    textAlign: 'right'
  },
  copyButton: {
    width: 24,
    height: 24,
    padding: 4,
    flex: '0 0 24px',
    color: 'var(--netdive-detail-muted, #64748b)',
    '& svg': {
      fontSize: 14
    }
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: 8,
    padding: theme.spacing(1.1, 1.25, 1.25)
  },
  connectedResourceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1),
    padding: theme.spacing(1.1, 1.25, 1.25),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr'
    }
  },
  connectedResourceCard: {
    minHeight: 96,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.45, 1.5),
    borderRadius: 14,
    border: '1px solid var(--netdive-detail-border)',
    backgroundColor: 'var(--netdive-detail-section-bg)',
    textAlign: 'left',
    transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
    '& strong': {
      color: 'var(--netdive-detail-title)',
      fontSize: 15,
      lineHeight: 1.15,
      fontWeight: 900
    },
    '& small': {
      color: 'var(--netdive-detail-muted)',
      fontSize: 13,
      lineHeight: 1.4,
      fontWeight: 700
    }
  },
  connectedResourceCardMain: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    minWidth: 0,
    '& > span:last-child': {
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  },
  connectedResourceCardIcon: {
    flexShrink: 0,
    width: 30,
    height: 30,
    borderRadius: 11,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--topology-level-label-active-text)',
    background: 'rgba(232, 242, 255, 0.82)',
    '& svg': {
      fontSize: 17
    }
  },
  connectedResourceCardValue: {
    flexShrink: 0,
    color: 'var(--netdive-detail-title)',
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 900,
    minWidth: 0,
    textAlign: 'right'
  },
  metricTile: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: theme.spacing(0.35),
    border: '1px solid var(--netdive-detail-border-soft)',
    borderRadius: 10,
    padding: '10px 12px',
    background: 'var(--netdive-detail-soft-card, #fbfdff)',
    minHeight: 64,
    minWidth: 0
  },
  metricTileMuted: {
    background: 'rgba(248, 250, 252, 0.78)',
    '& $metricValue': {
      color: 'var(--netdive-detail-muted, #64748b)'
    }
  },
  metricIcon: {
    display: 'none'
  },
  metricBody: {
    minWidth: 0
  },
  metricLabel: {
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 11.2,
    lineHeight: 1.2,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'left'
  },
  metricValue: {
    marginTop: 2,
    color: 'var(--netdive-detail-text)',
    fontSize: 18,
    lineHeight: 1.12,
    fontWeight: 850,
    overflowWrap: 'anywhere'
  },
  metricSub: {
    marginTop: 2,
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 11.2,
    lineHeight: 1.25,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  progressTrack: {
    height: 4,
    marginTop: 8,
    borderRadius: 999,
    overflow: 'hidden',
    background: 'rgba(148, 163, 184, 0.18)'
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: 'var(--netdive-detail-accent, #1A73E8)',
    opacity: 0.82
  },
  pathRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.7),
    padding: theme.spacing(1.35)
  },
  pathChip: {
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: 160,
    minHeight: 30,
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid var(--netdive-detail-border-soft)',
    background: 'var(--netdive-detail-soft-card, #fbfdff)',
    color: 'var(--netdive-detail-text)',
    fontSize: 12,
    lineHeight: 1.2,
    fontWeight: 750,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  pathArrow: {
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: '12px !important',
    opacity: 0.72
  },
  emptyState: {
    padding: theme.spacing(1.35),
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 12.5,
    lineHeight: 1.5,
    fontWeight: 600
  },
  pillList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1.25, 1.35, 1.35)
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: '100%',
    minWidth: 0,
    padding: '6px 9px',
    borderRadius: 999,
    border: '1px solid var(--netdive-detail-border-soft)',
    background: 'var(--netdive-detail-pill-bg, #f8fafc)',
    color: 'var(--netdive-detail-text)',
    fontSize: 11.5,
    lineHeight: 1.2,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  noticeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.8),
    padding: theme.spacing(1.1, 1.25),
    borderRadius: 14,
    border: '1px solid var(--netdive-detail-border-soft)',
    background: 'rgba(248, 250, 252, 0.82)',
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 12.5,
    lineHeight: 1.45,
    fontWeight: 600,
    '& svg': {
      fontSize: 17,
      color: 'var(--topology-level-label-active-text)'
    }
  },
  rawAccordion: {
    border: '1px solid var(--netdive-detail-border-soft)',
    borderRadius: '16px !important',
    background: 'var(--netdive-detail-card-bg, #ffffff)',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.035)',
    '&:before': {
      display: 'none'
    },
    '&.Mui-expanded': {
      margin: 0
    }
  },
  inlineAccordion: {
    margin: theme.spacing(0.5, 1.35, 1.35),
    border: '1px solid var(--netdive-detail-border-soft)',
    borderRadius: '12px !important',
    background: 'var(--netdive-detail-soft-card, #fbfdff)',
    boxShadow: 'none',
    '&:before': {
      display: 'none'
    },
    '&.Mui-expanded': {
      margin: theme.spacing(0.5, 1.35, 1.35)
    }
  },
  inlineSummary: {
    minHeight: '48px !important',
    padding: theme.spacing(0, 1),
    '&.Mui-expanded': {
      minHeight: '48px !important'
    },
    '& .MuiAccordionSummary-content': {
      alignItems: 'center',
      gap: theme.spacing(0.8),
      margin: '10px 0 !important'
    }
  },
  rawSummary: {
    minHeight: '52px !important',
    padding: theme.spacing(0, 1.35),
    '&.Mui-expanded': {
      minHeight: '52px !important'
    },
    '& .MuiAccordionSummary-content': {
      alignItems: 'center',
      gap: theme.spacing(1),
      margin: '12px 0 !important'
    }
  },
  rawDetails: {
    display: 'block',
    padding: theme.spacing(0, 1.25, 1.5)
  },
  codeBlock: {
    maxHeight: 160,
    overflow: 'auto',
    margin: theme.spacing(0.75, 0, 0),
    padding: theme.spacing(1),
    borderRadius: 10,
    border: '1px solid var(--netdive-detail-border-soft)',
    background: 'rgba(15, 23, 42, 0.035)',
    color: 'var(--netdive-detail-text)',
    fontSize: 11.5,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }
})
