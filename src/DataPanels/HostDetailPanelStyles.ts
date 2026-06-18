import { createStyles, Theme } from '@material-ui/core'

export const styles = (theme: Theme) => createStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    color: 'var(--netdive-detail-text)'
  },
  sectionCard: {
    border: '1px solid var(--netdive-detail-border-soft)',
    borderRadius: 14,
    background: 'var(--netdive-detail-card-bg, #ffffff)',
    overflow: 'hidden',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.035)'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.9),
    padding: theme.spacing(1.35, 1.5),
    borderBottom: '1px solid var(--netdive-detail-border-soft)',
    background: 'var(--netdive-detail-section-header, #f8fafc)'
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--topology-level-label-active-text)',
    background: 'rgba(232, 242, 255, 0.82)',
    '& svg': {
      fontSize: 17
    }
  },
  sectionTitleBlock: {
    minWidth: 0
  },
  sectionTitle: {
    color: 'var(--netdive-detail-text)',
    fontSize: 14,
    lineHeight: 1.2,
    fontWeight: 800
  },
  sectionDescription: {
    marginTop: 3,
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 11.5,
    lineHeight: 1.35,
    fontWeight: 500
  },
  rows: {
    padding: theme.spacing(0.35, 1.5)
  },
  kvRow: {
    display: 'grid',
    gridTemplateColumns: '112px minmax(0, 1fr)',
    gap: theme.spacing(1.25),
    alignItems: 'center',
    minHeight: 40,
    borderBottom: '1px solid var(--netdive-detail-border-subtle, rgba(226, 232, 240, 0.72))',
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
    fontSize: 12,
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
    fontWeight: 700,
    textAlign: 'right'
  },
  copyButton: {
    width: 26,
    height: 26,
    padding: 4,
    flex: '0 0 26px',
    color: 'var(--netdive-detail-muted, #64748b)',
    '& svg': {
      fontSize: 15
    }
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1),
    padding: theme.spacing(1.35, 1.5, 1.5),
    [theme.breakpoints.down(420)]: {
      gridTemplateColumns: '1fr'
    }
  },
  metricTile: {
    border: '1px solid var(--netdive-detail-border-soft)',
    borderRadius: 12,
    padding: theme.spacing(1.15),
    background: 'var(--netdive-detail-soft-card, #fbfdff)',
    minWidth: 0
  },
  metricTileMuted: {
    background: 'rgba(248, 250, 252, 0.78)',
    '& $metricValue': {
      color: 'var(--netdive-detail-muted, #64748b)'
    }
  },
  metricLabel: {
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 11.5,
    fontWeight: 700
  },
  metricValue: {
    marginTop: 5,
    color: 'var(--netdive-detail-text)',
    fontSize: 21,
    lineHeight: 1.1,
    fontWeight: 800,
    overflowWrap: 'anywhere'
  },
  metricSub: {
    marginTop: 5,
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 11.5,
    fontWeight: 600
  },
  progressTrack: {
    height: 5,
    marginTop: 9,
    borderRadius: 999,
    overflow: 'hidden',
    background: 'rgba(148, 163, 184, 0.18)'
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: 'var(--netdive-detail-accent, #1A73E8)'
  },
  emptyState: {
    padding: theme.spacing(1.5),
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 12.5,
    lineHeight: 1.5,
    fontWeight: 600
  },
  portList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1.5, 1.45)
  },
  networkNotice: {
    margin: theme.spacing(0, 1.5, 1),
    padding: theme.spacing(0.85, 1),
    borderRadius: 10,
    border: '1px solid var(--netdive-detail-border-soft)',
    background: 'rgba(248, 250, 252, 0.86)',
    color: 'var(--netdive-detail-muted, #64748b)',
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 600
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: '100%',
    minWidth: 0,
    padding: '5px 9px',
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
  rawAccordion: {
    border: '1px solid var(--netdive-detail-border-soft)',
    borderRadius: '14px !important',
    background: 'var(--netdive-detail-card-bg, #ffffff)',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.035)',
    '&:before': {
      display: 'none'
    },
    '&.Mui-expanded': {
      margin: 0
    }
  },
  rawSummary: {
    minHeight: '52px !important',
    padding: theme.spacing(0, 1.5),
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
    padding: theme.spacing(0, 1.25, 1.5),
    '& .MuiAccordion-root': {
      boxShadow: 'none',
      border: '1px solid var(--netdive-detail-border-soft)',
      borderRadius: '10px !important',
      marginBottom: theme.spacing(1),
      '&:before': {
        display: 'none'
      }
    }
  },
  codeBlock: {
    maxHeight: 160,
    overflow: 'auto',
    margin: theme.spacing(0.75, 1.5, 1.5),
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
