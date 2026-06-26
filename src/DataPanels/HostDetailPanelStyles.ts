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
        fontWeight: 700
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
        fontWeight: 720,
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
    connectedResourceGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: theme.spacing(0.85),
        padding: theme.spacing(1, 1.15, 1.15),
        [theme.breakpoints.down('sm')]: {
            gridTemplateColumns: '1fr'
        }
    },
    connectedResourceSectionStack: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(0.9),
        padding: theme.spacing(1, 1.15, 1.15)
    },
    connectedResourceSection: {
        border: '1px solid var(--netdive-detail-border-soft)',
        borderRadius: 12,
        background: 'var(--netdive-detail-soft-card, #fbfdff)',
        overflow: 'hidden'
    },
    connectedResourceSectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.75),
        padding: theme.spacing(0.8, 0.95),
        borderBottom: '1px solid var(--netdive-detail-border-soft)',
        background: 'rgba(248, 250, 252, 0.9)'
    },
    connectedResourceSectionIcon: {
        width: 24,
        height: 24,
        borderRadius: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--topology-level-label-active-text)',
        background: 'rgba(232, 242, 255, 0.82)',
        '& svg': {
            fontSize: 15
        }
    },
    connectedResourceSectionTitle: {
        color: 'var(--netdive-detail-title)',
        fontSize: 12.5,
        fontWeight: 850
    },
    connectedResourceCard: {
        position: 'relative',
        minHeight: 58,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(0.85),
        padding: theme.spacing(0.9, 1),
        borderRadius: 12,
        border: '1px solid var(--netdive-detail-border)',
        backgroundColor: 'var(--netdive-detail-section-bg)',
        textAlign: 'left',
        transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        '&:disabled': {
            cursor: 'default'
        },
        '& strong': {
            color: 'var(--netdive-detail-title)',
            fontSize: 12.6,
            lineHeight: 1.15,
            fontWeight: 820,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        }
    },
    connectedResourceCardClickable: {
        cursor: 'pointer',
        '&:hover': {
            borderColor: 'rgba(26, 115, 232, 0.34)',
            backgroundColor: 'rgba(232, 242, 255, 0.28)',
            boxShadow: '0 6px 16px rgba(15, 23, 42, 0.055)',
            transform: 'translateY(-1px)'
        }
    },
    connectedResourceCardStatic: {
        cursor: 'default'
    },
    connectedResourceCardMain: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.75),
        minWidth: 0,
        '& > span:last-child': {
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
        }
    },
    connectedResourceCardIcon: {
        flexShrink: 0,
        width: 30,
        height: 30,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(248, 250, 252, 0.96)',
        '& svg': {
            fontSize: 16
        }
    },
    connectedResourceFaIcon: {
        fontFamily: '"Font Awesome 5 Free"',
        fontSize: 17,
        fontWeight: 900,
        lineHeight: 1
    },
    connectedResourceCardValue: {
        flexShrink: 0,
        color: 'var(--netdive-detail-title)',
        fontSize: 18,
        lineHeight: 1,
        fontWeight: 820,
        minWidth: 22,
        textAlign: 'right',
        letterSpacing: '-0.015em'
    },
    connectedResourceCardAction: {
        flex: '0 0 auto',
        color: 'var(--topology-level-label-active-text)',
        fontSize: 18,
        lineHeight: 1,
        fontWeight: 600,
        opacity: 0.86
    },
    connectedResourceCardActionHidden: {
        visibility: 'hidden'
    },
    metricGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 8,
        padding: theme.spacing(1.1, 1.25, 1.25)
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
    socketSection: {
        padding: theme.spacing(1, 1.15, 1.15),
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1)
    },
    socketBlock: {
        border: '1px solid var(--netdive-detail-border-soft)',
        borderRadius: 12,
        background: 'var(--netdive-detail-soft-card, #fbfdff)',
        padding: theme.spacing(1, 1.05)
    },
    socketBlockHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(0.7)
    },
    socketBlockTitle: {
        color: 'var(--netdive-detail-text)',
        fontSize: 12.4,
        lineHeight: 1.2,
        fontWeight: 850,
        '& span': {
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 11.2,
            fontWeight: 700
        }
    },
    socketMoreLink: {
        color: 'var(--topology-level-label-active-text)',
        fontSize: 10.8,
        fontWeight: 850,
        whiteSpace: 'nowrap'
    },
    socketMoreButton: {
        border: 0,
        padding: 0,
        background: 'transparent',
        color: 'var(--topology-level-label-active-text)',
        fontSize: 11,
        lineHeight: 1.3,
        fontWeight: 700,
        cursor: 'pointer'
    },
    socketSummaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 6
    },
    socketSummaryTile: {
        borderRadius: 9,
        border: '1px solid var(--netdive-detail-border-soft)',
        background: 'rgba(248, 250, 252, 0.7)',
        padding: '8px 10px'
    },
    socketSummaryLabel: {
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 10.8,
        lineHeight: 1.25,
        fontWeight: 700
    },
    socketSummaryValue: {
        marginTop: 3,
        color: 'var(--netdive-detail-title)',
        fontSize: 17,
        lineHeight: 1.1,
        fontWeight: 800,
        letterSpacing: '-0.02em'
    },
    socketServiceList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6
    },
    socketServiceRow: {
        display: 'grid',
        gridTemplateColumns: '88px minmax(0, 1fr)',
        alignItems: 'center',
        gap: 10,
        minHeight: 28,
        maxWidth: '100%',
        color: 'var(--netdive-detail-text)',
        fontSize: 11.4,
        lineHeight: 1.2,
        fontWeight: 700
    },
    socketServicePortBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 24,
        padding: '3px 8px',
        borderRadius: 999,
        border: '1px solid rgba(148, 163, 184, 0.24)',
        background: 'rgba(248, 250, 252, 0.96)',
        color: 'var(--netdive-detail-title)',
        fontWeight: 800,
        whiteSpace: 'nowrap',
        fontSize: 10.6,
        letterSpacing: '-0.01em'
    },
    socketServiceProcess: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--netdive-detail-text)',
        fontWeight: 700
    },
    socketProcessList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6
    },
    socketProcessRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 54px 110px',
        alignItems: 'center',
        gap: 8,
        color: 'var(--netdive-detail-text)',
        fontSize: 11.2,
        fontWeight: 750
    },
    socketProcessName: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--netdive-detail-text)',
        fontWeight: 760
    },
    socketProcessBarTrack: {
        height: 5,
        borderRadius: 999,
        overflow: 'hidden',
        background: 'rgba(148, 163, 184, 0.15)'
    },
    socketProcessBarFill: {
        height: '100%',
        borderRadius: 999,
        background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.72), rgba(99, 102, 241, 0.62))'
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
    },
    kubernetesNodePickerDrawer: {
        width: 'min(480px, calc(100vw - var(--sidebar-width, 220px) - 48px))',
        maxWidth: '480px',
        right: '16px !important',
        top: '76px !important',
        height: 'calc(100vh - 92px) !important',
        border: '1px solid rgba(203, 213, 225, 0.72)',
        borderRadius: 16,
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        boxShadow: '0 18px 44px rgba(15, 23, 42, 0.16)',
        overflow: 'hidden',
        [theme.breakpoints.down('sm')]: {
            width: 'min(94vw, 480px)',
            maxWidth: '94vw',
            right: '3vw !important',
            top: '12px !important',
            height: 'calc(100vh - 24px) !important'
        }
    },
    kubernetesNodePickerContent: {
        height: '100%',
        boxSizing: 'border-box',
        padding: theme.spacing(1.45, 1.45, 1.15),
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(0.95),
        overflow: 'hidden'
    },
    kubernetesNodePickerHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: theme.spacing(1.05),
        paddingBottom: theme.spacing(0.25)
    },
    kubernetesNodePickerHeaderIcon: {
        width: 38,
        height: 38,
        flex: '0 0 auto',
        borderRadius: 12,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        boxShadow: '0 8px 18px rgba(37, 99, 235, 0.22)',
        color: '#ffffff',
        '& svg': {
            fontSize: 23
        }
    },
    kubernetesNodePickerHeaderBlock: {
        minWidth: 0,
        flex: 1
    },
    kubernetesNodePickerTitle: {
        color: 'var(--netdive-detail-title)',
        fontSize: 20,
        lineHeight: 1.2,
        fontWeight: 850
    },
    kubernetesNodePickerDescription: {
        marginTop: 5,
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 12,
        lineHeight: 1.45,
        fontWeight: 650
    },
    kubernetesNodePickerClose: {
        width: 32,
        height: 32,
        padding: 4,
        color: 'var(--netdive-detail-muted, #64748b)',
        border: '1px solid transparent',
        borderRadius: 8,
        '& svg': {
            fontSize: 18
        },
        '&:hover': {
            background: 'rgba(248, 250, 252, 0.96)',
            borderColor: 'var(--netdive-detail-border-soft)'
        }
    },
    kubernetesNodePickerToolbar: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: theme.spacing(0.75),
        alignItems: 'center',
        [theme.breakpoints.down('sm')]: {
            gridTemplateColumns: '1fr',
            '& button': {
                width: '100%'
            }
        }
    },
    kubernetesNodePickerSearch: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.75),
        minHeight: 42,
        padding: theme.spacing(0, 1.1),
        borderRadius: 8,
        border: '1px solid rgba(186, 199, 219, 0.94)',
        background: '#ffffff',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.045)',
        color: 'var(--netdive-detail-muted, #64748b)',
        '& svg': {
            fontSize: 17,
            color: 'var(--topology-level-label-active-text)'
        }
    },
    kubernetesNodePickerSearchInput: {
        width: '100%',
        border: 0,
        outline: 'none',
        background: 'transparent',
        color: 'var(--netdive-detail-text)',
        fontSize: 12.3,
        lineHeight: 1.4,
        fontWeight: 600,
        fontFamily: 'inherit',
        '&::placeholder': {
            color: 'var(--netdive-detail-muted, #94a3b8)',
            opacity: 1
        }
    },
    kubernetesNodePickerFilterButton: {
        minHeight: 42,
        padding: '0 14px',
        borderRadius: 12,
        border: '1px solid var(--netdive-detail-border-soft)',
        background: 'rgba(248, 250, 252, 0.92)',
        color: 'var(--netdive-detail-title)',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
        transition: 'border-color 160ms ease, background-color 160ms ease',
        '&:hover': {
            borderColor: 'rgba(26, 115, 232, 0.24)',
            background: 'rgba(232, 242, 255, 0.28)'
        }
    },
    kubernetesNodePickerSummary: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        alignItems: 'center',
        gap: theme.spacing(0.75),
        padding: theme.spacing(0.1, 0, 0.2),
        color: 'var(--netdive-detail-muted, #64748b)',
        [theme.breakpoints.down('sm')]: {
            alignItems: 'stretch',
            gridTemplateColumns: '1fr'
        },
        '& strong': {
            color: 'var(--netdive-detail-title)',
            fontSize: 18,
            lineHeight: 1,
            fontWeight: 850
        }
    },
    kubernetesNodePickerSummaryGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.65)
    },
    kubernetesNodePickerSummaryItem: {
        minHeight: 54,
        minWidth: 0,
        padding: theme.spacing(0.75, 0.95),
        borderRadius: 10,
        border: '1px solid rgba(203, 213, 225, 0.72)',
        background: '#ffffff',
        display: 'grid',
        gridTemplateColumns: '32px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: theme.spacing(0.75),
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.035)'
    },
    kubernetesNodePickerSummaryIcon: {
        width: 30,
        height: 30,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(239, 246, 255, 0.95)',
        color: 'var(--topology-level-label-active-text)',
        '& svg': {
            fontSize: 18
        }
    },
    kubernetesNodePickerSummaryLabel: {
        display: 'block',
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 10.7,
        lineHeight: 1.35,
        fontWeight: 780
    },
    kubernetesNodePickerToolbarActions: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.65)
    },
    kubernetesNodePickerExpandAllButton: {
        minHeight: 42,
        padding: '0 12px',
        borderRadius: 8,
        border: '1px solid rgba(186, 199, 219, 0.9)',
        background: '#ffffff',
        color: 'var(--netdive-detail-title)',
        fontSize: 12,
        lineHeight: 1.4,
        fontWeight: 760,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'border-color 160ms ease, background-color 160ms ease',
        '&:hover': {
            borderColor: 'rgba(26, 115, 232, 0.42)',
            background: 'rgba(232, 242, 255, 0.32)'
        }
    },
    kubernetesNodePickerHighlightAllButton: {
        minHeight: 42,
        padding: '0 12px',
        borderRadius: 8,
        border: '1px solid rgba(37, 99, 235, 0.34)',
        background: 'linear-gradient(180deg, rgba(239, 246, 255, 0.96) 0%, rgba(219, 234, 254, 0.86) 100%)',
        color: '#1d4ed8',
        fontSize: 12,
        lineHeight: 1.4,
        fontWeight: 800,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'border-color 160ms ease, background-color 160ms ease',
        '&:hover': {
            borderColor: 'rgba(26, 115, 232, 0.46)',
            background: 'rgba(232, 242, 255, 0.95)'
        },
        '&:disabled': {
            opacity: 0.48,
            cursor: 'default'
        }
    },
    kubernetesNodePickerBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(0.8),
        minHeight: 0,
        flex: 1,
        overflowY: 'auto',
        padding: theme.spacing(0.1, 0.2, 0.1, 0)
    },
    kubernetesNodeClusterGroup: {
        border: '1px solid rgba(203, 213, 225, 0.68)',
        borderRadius: 13,
        background: 'var(--netdive-detail-card-bg, #ffffff)',
        overflow: 'hidden',
        boxShadow: '0 6px 16px rgba(15, 23, 42, 0.045)'
    },
    kubernetesNodeClusterBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(0.45),
        padding: theme.spacing(0.45, 0.55, 0.55),
        background: 'var(--netdive-detail-card-bg, #ffffff)'
    },
    kubernetesNodeClusterHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(1),
        padding: theme.spacing(0.9, 1),
        borderBottom: '1px solid rgba(226, 232, 240, 0.74)',
        background: 'linear-gradient(180deg, rgba(248, 250, 252, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)',
        borderLeft: '3px solid rgba(37, 99, 235, 0.70)',
        [theme.breakpoints.down('sm')]: {
            alignItems: 'flex-start',
            flexDirection: 'column'
        }
    },
    kubernetesNodeClusterHeaderClickable: {
        cursor: 'pointer',
        '&:hover': {
            background: 'linear-gradient(180deg, rgba(239, 246, 255, 0.84) 0%, rgba(255, 255, 255, 0.98) 100%)'
        }
    },
    kubernetesNodeClusterHeaderMain: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.95),
        minWidth: 0,
        flex: 1,
        '& > svg': {
            fontSize: 18,
            color: 'var(--topology-level-label-active-text)'
        }
    },
    kubernetesNodeClusterInlineChevron: {
        width: 18,
        height: 18,
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--netdive-detail-muted, #64748b)',
        '& svg': {
            fontSize: 18
        }
    },
    kubernetesNodeClusterIcon: {
        width: 26,
        height: 26,
        borderRadius: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, rgba(219, 234, 254, 0.94) 0%, rgba(239, 246, 255, 0.96) 100%)',
        boxShadow: 'inset 0 0 0 1px rgba(147, 197, 253, 0.28)',
        '& svg': {
            fontSize: 17,
            color: 'var(--topology-level-label-active-text)'
        }
    },
    kubernetesNodeClusterTitleBlock: {
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
    },
    kubernetesNodeClusterName: {
        color: 'var(--netdive-detail-title)',
        fontSize: 13.1,
        lineHeight: 1.2,
        fontWeight: 840,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    kubernetesNodeClusterMeta: {
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 10.9,
        lineHeight: 1.35,
        fontWeight: 700
    },
    kubernetesNodeClusterRightChevron: {
        width: 24,
        height: 24,
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--netdive-detail-muted, #475569)',
        '& svg': {
            fontSize: 20
        }
    },
    kubernetesNodeList: {
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        gap: theme.spacing(0.35),
        background: 'transparent',
        border: 0,
        borderRadius: 0,
        overflow: 'visible'
    },
    kubernetesNodeListSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: 0
    },
    kubernetesNodeRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        columnGap: theme.spacing(1),
        minHeight: 46,
        padding: theme.spacing(0.65, 0.8),
        border: '1px solid rgba(226, 232, 240, 0.70)',
        borderRadius: 10,
        background: '#ffffff',
        cursor: 'pointer',
        transition: 'background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
        '&:hover': {
            background: 'rgba(232, 242, 255, 0.58)',
            borderColor: 'rgba(59, 130, 246, 0.34)',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
        },
        '&:focus': {
            outline: '2px solid rgba(59, 130, 246, 0.24)',
            outlineOffset: -2,
            background: 'rgba(232, 242, 255, 0.42)',
            borderColor: 'rgba(59, 130, 246, 0.36)'
        },
        [theme.breakpoints.down('sm')]: {
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gridTemplateAreas: '"name status" "role role"',
            rowGap: theme.spacing(0.45),
            alignItems: 'center',
            minHeight: 54
        }
    },
    kubernetesNodeCardMain: {
        minWidth: 0,
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 6
    },
    kubernetesNodeCardAside: {
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.8),
        [theme.breakpoints.down('sm')]: {
            width: '100%',
            justifyContent: 'space-between'
        }
    },
    kubernetesNodeNameWrap: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        [theme.breakpoints.down('sm')]: {
            gridArea: 'name'
        }
    },
    kubernetesNodeStatusDot: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        display: 'inline-block',
        flex: '0 0 auto'
    },
    kubernetesNodeStatusReady: {
        background: '#22c55e'
    },
    kubernetesNodeStatusNotReady: {
        background: '#ef4444'
    },
    kubernetesNodeStatusUnknown: {
        background: '#94a3b8'
    },
    kubernetesNodeName: {
        minWidth: 0,
        color: 'var(--netdive-detail-text)',
        fontSize: 12.2,
        lineHeight: 1.35,
        fontWeight: 800,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    kubernetesNodeNodeText: {
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
    },
    kubernetesNodeMetaLine: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: theme.spacing(0.65),
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 10.6,
        lineHeight: 1.3,
        fontWeight: 650,
        '& span': {
            display: 'inline-flex',
            alignItems: 'center',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        }
    },
    kubernetesNodeRoleCell: {
        minWidth: 0,
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 11.6,
        lineHeight: 1.35,
        fontWeight: 720,
        justifySelf: 'start',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        [theme.breakpoints.down('sm')]: {
            gridArea: 'role'
        }
    },
    kubernetesNodeVersionCell: {
        minWidth: 0,
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 11.4,
        lineHeight: 1.35,
        fontWeight: 700,
        justifySelf: 'start',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        [theme.breakpoints.down('sm')]: {
            display: 'none'
        }
    },
    kubernetesNodeStatusBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 20,
        minWidth: 48,
        padding: '0 8px',
        borderRadius: 999,
        fontSize: 10.4,
        lineHeight: 1,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        justifySelf: 'end',
        [theme.breakpoints.down('sm')]: {
            gridArea: 'status',
            justifySelf: 'end'
        }
    },
    kubernetesNodeRowAside: {
        display: 'inline-flex',
        alignItems: 'center',
        justifySelf: 'end',
        gap: theme.spacing(0.45),
        color: 'var(--netdive-detail-muted, #94a3b8)',
        '& svg': {
            fontSize: 18
        }
    },
    kubernetesNodeStatusBadgeReady: {
        color: '#15803d',
        background: 'rgba(220, 252, 231, 0.95)',
        border: '1px solid rgba(134, 239, 172, 0.85)'
    },
    kubernetesNodeStatusBadgeNotReady: {
        color: '#dc2626',
        background: 'rgba(254, 226, 226, 0.92)',
        border: '1px solid rgba(252, 165, 165, 0.82)'
    },
    kubernetesNodeStatusBadgeUnknown: {
        color: '#475569',
        background: 'transparent',
        border: '1px solid transparent'
    },
    kubernetesNodeStatusPlain: {
        justifySelf: 'end',
        color: 'var(--netdive-detail-muted, #94a3b8)',
        fontSize: 11,
        lineHeight: 1,
        fontWeight: 700
    },
    kubernetesNodeMoveButton: {
        display: 'none'
    },
    kubernetesNodeExpandButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: '100%',
        marginTop: 0,
        border: '1px dashed rgba(59, 130, 246, 0.18)',
        borderRadius: 11,
        padding: theme.spacing(0.85, 1.15),
        background: 'rgba(255, 255, 255, 0.76)',
        color: 'var(--topology-level-label-active-text)',
        fontSize: 12,
        lineHeight: 1.4,
        fontWeight: 750,
        cursor: 'pointer',
        textAlign: 'center',
        '&:hover': {
            background: 'rgba(232, 242, 255, 0.42)',
            borderColor: 'rgba(26, 115, 232, 0.28)'
        }
    },
    kubernetesNodePickerActions: {
        display: 'none'
    },
    kubernetesNodePickerPrimaryAction: {
        border: '1px solid rgba(37, 99, 235, 0.28)',
        background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
        color: '#ffffff',
        minHeight: 40,
        minWidth: 132,
        padding: '0 16px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
        '&:disabled': {
            opacity: 0.5,
            cursor: 'default'
        }
    },
    kubernetesNodePickerSecondaryAction: {
        border: '1px solid rgba(59, 130, 246, 0.22)',
        background: '#ffffff',
        color: 'var(--topology-level-label-active-text)',
        minHeight: 40,
        minWidth: 148,
        padding: '0 16px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer'
    }
})
