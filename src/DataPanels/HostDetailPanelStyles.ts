import { createStyles, Theme } from '@material-ui/core'

export const styles = (theme: Theme) => createStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        color: 'var(--netdive-detail-text)',
        paddingBottom: theme.spacing(1)
    },
    panelCard: {
        border: '1px solid #f0f0f0 !important',
        borderRadius: '10px !important',
        background: '#ffffff',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(16, 24, 40, 0.035)',
        '&.ant-card': {
            color: 'var(--netdive-detail-text)',
            lineHeight: 1.45
        },
        '& .ant-card-head': {
            minHeight: '44px !important',
            padding: '0 16px !important',
            borderBottom: '1px solid #f0f0f0 !important',
            background: '#ffffff'
        },
        '& .ant-card-head-title': {
            padding: '11px 0 !important',
            minWidth: 0
        },
        '& .ant-card-extra': {
            padding: '8px 0 !important'
        },
        '& .ant-card-body': {
            background: '#ffffff'
        }
    },
    panelHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(1),
        minHeight: 22,
        width: '100%',
        padding: 0,
        borderBottom: 0,
        background: 'transparent'
    },
    panelHeaderMain: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.75),
        minWidth: 0
    },
    panelHeaderActions: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: theme.spacing(0.75),
        minWidth: 0,
        marginLeft: 'auto'
    },
    panelIcon: {
        width: 18,
        height: 18,
        borderRadius: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 18px',
        color: '#1677ff',
        background: 'transparent',
        border: 0,
        '& svg': {
            fontSize: 15
        }
    },
    panelTitleBlock: {
        minWidth: 0
    },
    panelTitle: {
        color: '#101828',
        fontSize: 14,
        lineHeight: 1.2,
        fontWeight: 600
    },
    panelDescription: {
        marginTop: 3,
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 11.5,
        lineHeight: 1.35,
        fontWeight: 500
    },
    detailTabsCard: {
        border: '1px solid var(--netdive-ant-border, #d9d9d9)',
        borderRadius: '8px !important',
        background: '#ffffff',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        '& .ant-card-body': {
            background: '#ffffff'
        }
    },
    detailTabs: {
        '& .ant-tabs-nav': {
            margin: '0 !important',
            padding: '0 16px',
            background: '#ffffff',
            borderBottom: '1px solid #f0f0f0'
        },
        '& .ant-tabs-tab': {
            padding: '13px 0 !important',
            color: '#595959',
            fontSize: '13px',
            fontWeight: 500
        },
        '& .ant-tabs-tab + .ant-tabs-tab': {
            margin: '0 0 0 28px !important'
        },
        '& .ant-tabs-tab-active .ant-tabs-tab-btn': {
            color: 'var(--netdive-ant-primary, #1677ff) !important',
            fontWeight: 600
        },
        '& .ant-tabs-content-holder': {
            background: '#ffffff'
        }
    },
    detailTabPane: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 0,
        '& $panelCard': {
            borderLeft: 0,
            borderRight: 0,
            borderRadius: '0 !important',
            boxShadow: 'none'
        }
    },
    rowsCompact: {
        padding: '6px 14px 10px'
    },
    antInfoList: {
        padding: '6px 18px 10px',
        background: '#ffffff'
    },
    antInfoRow: {
        display: 'grid',
        gridTemplateColumns: '116px minmax(0, 1fr)',
        alignItems: 'center',
        columnGap: 12,
        minHeight: 42,
        padding: '9px 0',
        borderBottom: '1px solid #f2f4f7',
        background: '#ffffff',
        '&:last-child': {
            borderBottom: 0
        }
    },
    antInfoLabel: {
        minWidth: 0,
        color: '#667085',
        fontSize: 12,
        lineHeight: '18px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    antInfoValue: {
        minWidth: 0,
        color: '#101828',
        fontSize: 13,
        lineHeight: '20px',
        fontWeight: 500
    },
    antDescriptions: {
        margin: '0 !important',
        padding: '10px 14px 12px',
        '& .ant-descriptions-view, & .ant-descriptions-view table': {
            width: '100%'
        },
        '& .ant-descriptions-row > td': {
            paddingBottom: '8px !important'
        },
        '& .ant-descriptions-row:last-child > td': {
            paddingBottom: '0 !important'
        },
        '& .ant-descriptions-item': {
            display: 'grid !important',
            gridTemplateColumns: '92px minmax(0, 1fr)',
            gap: '12px',
            alignItems: 'start',
            minHeight: 28,
            padding: '0 !important'
        },
        '& .ant-descriptions-item-label, & .ant-descriptions-item-content': {
            display: 'block !important',
            minWidth: 0
        },
        '& .ant-descriptions-item-label': {
            color: 'var(--netdive-ant-muted, #64748b) !important',
            background: 'transparent !important',
            padding: '0 !important',
            fontSize: '12px !important',
            lineHeight: '1.3 !important',
            fontWeight: '600 !important',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        },
        '& .ant-descriptions-item-content': {
            color: 'var(--netdive-ant-text, #0f172a) !important',
            background: 'transparent !important',
            padding: '0 !important',
            fontSize: '12.5px !important',
            lineHeight: '1.35 !important',
            fontWeight: '500 !important',
            overflow: 'visible',
            wordBreak: 'break-word'
        }
    },
    kvRow: {
        display: 'grid',
        gridTemplateColumns: '92px minmax(0, 1fr)',
        gap: theme.spacing(1),
        alignItems: 'center',
        minHeight: 36,
        borderBottom: '1px solid #f0f0f0',
        transition: 'background-color 140ms ease',
        '&:hover': {
            background: '#fafafa'
        },
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
        justifyContent: 'flex-start',
        gap: 6,
        minWidth: 0,
        width: '100%',
        maxWidth: '100%'
    },
    kvValue: {
        flex: '1 1 auto',
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        wordBreak: 'normal',
        overflowWrap: 'normal',
        color: '#101828',
        fontSize: 13,
        lineHeight: '20px',
        fontWeight: 500,
        textAlign: 'left'
    },
    kvStatusBadge: {
        minWidth: 0,
        maxWidth: '100%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        color: 'var(--netdive-detail-text) !important',
        fontSize: 12,
        lineHeight: 1.2,
        fontWeight: 500,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginRight: 0
    },
    kvStatusDot: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        flex: '0 0 8px',
        background: '#52c41a'
    },
    copyButton: {
        width: '22px !important',
        height: '22px !important',
        minWidth: '22px !important',
        padding: '4px !important',
        flex: '0 0 22px',
        marginLeft: 'auto !important',
        color: '#667085 !important',
        border: '0 !important',
        background: 'transparent !important',
        '& svg': {
            fontSize: '13px !important'
        }
    },
    connectedResourceGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 10,
        padding: '12px 16px 16px',
        [theme.breakpoints.down('sm')]: {
            gridTemplateColumns: '1fr'
        }
    },
    connectedResourceSectionStack: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '12px 14px 14px'
    },
    connectedResourceSection: {
        border: 0,
        borderRadius: 0,
        background: '#ffffff',
        overflow: 'visible',
        boxShadow: 'none'
    },
    connectedResourceSectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.75),
        padding: '0 2px 8px',
        borderBottom: 0,
        background: '#ffffff'
    },
    connectedResourceSectionIcon: {
        width: 22,
        height: 22,
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#1677ff',
        background: '#f0f7ff',
        '& svg': {
            fontSize: 14
        }
    },
    connectedResourceSectionKubernetesNodeIcon: {
        width: 24,
        height: 24,
        borderRadius: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#2563eb',
        background: 'rgba(239, 246, 255, 0.96)',
        boxShadow: 'inset 0 0 0 1px rgba(219, 234, 254, 0.96)',
        '& svg': {
            width: 15,
            height: 15,
            display: 'block'
        }
    },
    connectedResourceSectionTitle: {
        color: '#101828',
        fontSize: 13,
        fontWeight: 600
    },
    connectedResourceCard: {
        position: 'relative',
        minHeight: 64,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(0.85),
        padding: 0,
        borderRadius: 10,
        border: '1px solid #eef0f4',
        backgroundColor: '#ffffff',
        textAlign: 'left',
        transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        boxShadow: '0 2px 6px rgba(16, 24, 40, 0.035)',
        '&:disabled': {
            cursor: 'default'
        },
        '& strong': {
            color: '#101828',
            fontSize: 12.6,
            lineHeight: 1.15,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        }
    },
    connectedResourceCardClickable: {
        cursor: 'pointer',
        '&:hover': {
            borderColor: '#91caff',
            backgroundColor: '#f8fbff',
            boxShadow: '0 4px 12px rgba(16, 24, 40, 0.06)',
            transform: 'translateY(-1px)'
        }
    },
    connectedResourceCardStatic: {
        cursor: 'default',
        opacity: 0.76
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
        borderRadius: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(248, 250, 252, 0.96)',
        '& svg': {
            fontSize: 16
        }
    },
    connectedResourceHostIcon: {
        color: '#2563eb',
        background: 'rgba(239, 246, 255, 0.96)',
        boxShadow: 'inset 0 0 0 1px rgba(191, 219, 254, 0.9)'
    },
    connectedResourceNicIcon: {
        color: '#0f766e',
        background: 'rgba(240, 253, 250, 0.96)',
        boxShadow: 'inset 0 0 0 1px rgba(153, 246, 228, 0.9)'
    },
    connectedResourceBridgeIcon: {
        color: '#7c3aed',
        background: 'rgba(245, 243, 255, 0.96)',
        boxShadow: 'inset 0 0 0 1px rgba(221, 214, 254, 0.95)'
    },
    connectedResourceNetworkIcon: {
        color: '#ea580c',
        background: 'rgba(255, 247, 237, 0.96)',
        boxShadow: 'inset 0 0 0 1px rgba(254, 215, 170, 0.92)'
    },
    connectedResourceNodeIcon: {
        color: '#2563eb',
        background: '#eff6ff',
        border: '1px solid #dbeafe',
        '& svg': {
            width: 14,
            height: 14,
            display: 'block'
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
        color: '#101828',
        fontSize: 21,
        lineHeight: 1,
        fontWeight: 600,
        minWidth: 22,
        textAlign: 'right',
        letterSpacing: 0
    },
    connectedResourceCardAction: {
        flex: '0 0 auto',
        color: '#1677ff',
        fontSize: 18,
        lineHeight: 1,
        fontWeight: 500,
        opacity: 0.78
    },
    connectedResourceCardActionHidden: {
        visibility: 'hidden'
    },
    antOverviewGridItem: {
        float: 'none',
        width: '100% !important',
        margin: '0 !important',
        padding: '10px 12px !important',
        border: '1px solid #eef0f4 !important',
        borderRadius: '8px !important',
        background: '#ffffff !important',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.03) !important',
        '&.ant-card-grid-hoverable:hover': {
            borderColor: '#91caff !important',
            boxShadow: '0 4px 12px rgba(22, 119, 255, 0.10) !important',
            transform: 'translateY(-1px)'
        }
    },
    antOverviewButton: {
        width: '100%',
        minHeight: 62,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(0.85),
        padding: '12px 12px',
        border: 0,
        background: 'transparent',
        textAlign: 'left',
        cursor: 'inherit',
        color: 'inherit',
        font: 'inherit'
    },
    metricGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 10,
        padding: '12px 14px 14px'
    },
    metricTile: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: theme.spacing(0.35),
        border: '1px solid #eef0f4 !important',
        borderRadius: '10px !important',
        padding: '10px 12px',
        background: '#ffffff',
        minHeight: 62,
        minWidth: 0,
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.03)',
        '& .ant-card-body': {
            padding: '0 !important'
        }
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
    antStatistic: {
        minWidth: 0,
        '& .ant-statistic-title': {
            marginBottom: 4,
            color: '#667085',
            fontSize: '12px !important',
            lineHeight: '1.2 !important',
            fontWeight: '500 !important',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        },
        '& .ant-statistic-content': {
            color: '#101828',
            fontSize: '18px !important',
            lineHeight: '1.12 !important',
            fontWeight: '600 !important',
            letterSpacing: 0,
            overflowWrap: 'anywhere'
        },
        '& .ant-statistic-content-value': {
            display: 'inline',
            color: 'inherit'
        }
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
    detailSummaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
        gap: 8,
        padding: theme.spacing(1.1, 1.25, 1.25)
    },
    detailSummaryTile: {
        minWidth: 0,
        minHeight: 64,
        border: '1px solid var(--netdive-detail-border-soft)',
        borderRadius: 10,
        padding: '9px 11px',
        background: 'var(--netdive-detail-soft-card, #fbfdff)'
    },
    detailSummaryLabel: {
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 11.2,
        lineHeight: 1.2,
        fontWeight: 700,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    detailSummaryValue: {
        marginTop: 5,
        color: 'var(--netdive-detail-title, #0f172a)',
        fontSize: 13.5,
        lineHeight: 1.2,
        fontWeight: 820,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    detailBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 22,
        maxWidth: '100%',
        padding: '2px 8px',
        borderRadius: 999,
        border: '1px solid #d8e2ee',
        background: '#f8fafc',
        color: '#475569',
        fontSize: 11.5,
        lineHeight: 1.2,
        fontWeight: 800,
        whiteSpace: 'nowrap'
    },
    detailBadgeBlue: {
        color: '#1d4ed8',
        background: '#eff6ff',
        borderColor: '#bfdbfe'
    },
    detailBadgeIndigo: {
        color: '#5b21b6',
        background: '#f5f3ff',
        borderColor: '#ddd6fe'
    },
    detailBadgeGreen: {
        color: '#047857',
        background: '#ecfdf5',
        borderColor: '#bbf7d0'
    },
    detailBadgeRed: {
        color: '#b91c1c',
        background: '#fef2f2',
        borderColor: '#fecaca'
    },
    detailBadgeWarning: {
        color: '#92400e',
        background: '#fffbeb',
        borderColor: '#fde68a'
    },
    detailHelperText: {
        margin: '-4px 14px 10px',
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 11.5,
        lineHeight: 1.45,
        fontWeight: 550
    },
    detailPathText: {
        margin: theme.spacing(1.05, 1.25, 0.2),
        padding: '8px 10px',
        borderRadius: 10,
        border: '1px solid var(--netdive-detail-border-soft)',
        background: 'rgba(248, 250, 252, 0.82)',
        color: 'var(--netdive-detail-text)',
        fontSize: 12,
        lineHeight: 1.35,
        fontWeight: 720,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    collapsibleHeaderButton: {
        width: '100%',
        border: 0,
        padding: '0 16px',
        margin: 0,
        background: '#ffffff',
        textAlign: 'left',
        cursor: 'pointer',
        borderBottom: '1px solid #f0f0f0'
    },
    collapsibleHeaderInner: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(1),
        minHeight: 44,
        padding: 0,
        background: '#ffffff'
    },
    collapsibleHeaderChevron: {
        marginLeft: 'auto',
        color: 'var(--netdive-detail-muted, #64748b)',
        display: 'inline-flex',
        alignItems: 'center',
        '& svg': {
            fontSize: 18
        }
    },
    jsonBox: {
        margin: theme.spacing(1.05, 1.25, 1.25),
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--netdive-detail-border-soft)',
        background: 'rgba(248, 250, 252, 0.82)',
        color: 'var(--netdive-detail-text)',
        fontSize: 11.5,
        lineHeight: 1.45,
        fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
    },
    featureTable: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        paddingTop: 4
    },
    featureRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 10,
        minHeight: 38,
        padding: '0 14px',
        borderTop: '1px solid var(--netdive-detail-border-subtle, rgba(226, 232, 240, 0.62))',
        '&:first-child': {
            borderTop: 0
        }
    },
    featureName: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--netdive-detail-text)',
        fontSize: 12.5,
        fontWeight: 680
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
    antMetricProgress: {
        marginTop: 8,
        lineHeight: 1,
        '& .ant-progress-outer': {
            paddingRight: '0 !important'
        },
        '& .ant-progress-inner': {
            height: '4px !important',
            borderRadius: '999px !important',
            verticalAlign: 'top'
        },
        '& .ant-progress-bg': {
            height: '4px !important',
            borderRadius: '999px !important'
        }
    },
    socketSection: {
        padding: '12px 14px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
    },
    socketBlock: {
        border: '1px solid #eef0f4 !important',
        borderRadius: '10px !important',
        background: '#ffffff',
        overflow: 'hidden',
        padding: 0,
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.03)',
        '& .ant-card-head': {
            minHeight: '40px !important',
            padding: '0 12px !important',
            borderBottom: '1px solid #f5f5f5 !important',
            background: '#ffffff !important'
        },
        '& .ant-card-head-title': {
            padding: '9px 0 !important',
            color: '#101828',
            fontSize: '13px !important',
            fontWeight: '600 !important'
        },
        '& .ant-card-extra': {
            padding: '0 !important'
        }
    },
    socketBlockHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(1),
        minHeight: 42,
        padding: '10px 12px',
        borderBottom: '1px solid #EEF2F7'
    },
    socketBlockTitle: {
        color: 'var(--netdive-detail-text)',
        fontSize: 13.5,
        lineHeight: 1.2,
        fontWeight: 800,
        '& span': {
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 12,
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
        height: '24px !important',
        padding: '0 !important',
        color: 'var(--netdive-ant-primary, #1677ff) !important',
        fontSize: '12px !important',
        fontWeight: 600
    },
    socketSummaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 10
    },
    socketSummaryTile: {
        border: '1px solid #eef0f4 !important',
        borderRadius: '10px !important',
        background: '#ffffff !important',
        padding: '10px 12px',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.03)',
        '& .ant-card-body': {
            padding: '0 !important'
        }
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
    antDataTable: {
        '& .ant-table': {
            color: '#101828',
            fontSize: '12.5px'
        },
        '& .ant-table-thead > tr > th': {
            height: 32,
            padding: '7px 12px !important',
            color: '#667085 !important',
            background: '#ffffff !important',
            borderBottom: '1px solid #f5f5f5 !important',
            fontSize: '12px !important',
            fontWeight: '600 !important'
        },
        '& .ant-table-tbody > tr > td': {
            padding: '9px 12px !important',
            borderBottom: '1px solid #f5f5f5 !important',
            verticalAlign: 'middle'
        },
        '& .ant-table-tbody > tr:hover > td': {
            background: '#fafafa !important'
        },
        '& .ant-table-tbody > tr:last-child > td': {
            borderBottom: '0 !important'
        }
    },
    antTablePrimaryText: {
        display: 'block',
        color: '#101828',
        fontSize: 12.5,
        lineHeight: 1.35,
        fontWeight: 600,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    antTableStrongNumber: {
        color: '#101828',
        fontSize: 13,
        fontWeight: 600
    },
    antTableProgressCell: {
        display: 'grid',
        gridTemplateColumns: '32px minmax(42px, 1fr)',
        alignItems: 'center',
        gap: 8,
        color: 'var(--netdive-ant-muted, #64748b)',
        fontSize: 12,
        fontWeight: 600
    },
    antTableProgress: {
        lineHeight: 1,
        '& .ant-progress-outer': {
            paddingRight: '0 !important'
        },
        '& .ant-progress-inner': {
            height: '4px !important',
            borderRadius: '999px !important'
        },
        '& .ant-progress-bg': {
            height: '4px !important',
            borderRadius: '999px !important'
        }
    },
    antPortText: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 22,
        padding: '1px 8px',
        borderRadius: 999,
        border: '1px solid #eef0f4',
        background: '#fafafa',
        color: '#101828',
        fontSize: 12,
        lineHeight: '18px',
        fontWeight: 500,
        whiteSpace: 'nowrap'
    },
    socketServiceList: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        paddingTop: 6
    },
    socketServiceRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(92px, auto)',
        alignItems: 'center',
        gap: 12,
        minHeight: 42,
        maxWidth: '100%',
        padding: '0 12px',
        borderTop: '1px solid #EEF2F7',
        color: '#111827',
        fontSize: 13,
        lineHeight: 1.2,
        fontWeight: 600,
        cursor: 'pointer',
        '&:first-child': {
            borderTop: 0
        },
        '&:hover': {
            background: '#F8FAFC'
        }
    },
    socketServicePortBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        justifySelf: 'end',
        minHeight: 22,
        padding: '2px 7px',
        borderRadius: 999,
        border: '1px solid rgba(148, 163, 184, 0.28)',
        background: 'rgba(248, 250, 252, 0.96)',
        color: '#111827',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        fontSize: 12,
        letterSpacing: '-0.01em'
    },
    socketServiceProcess: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: '#111827',
        fontWeight: 600
    },
    socketProcessList: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        paddingTop: 6
    },
    socketTableHeader: {
        display: 'grid',
        alignItems: 'center',
        minHeight: 34,
        padding: '0 12px',
        borderBottom: '1px solid #EEF2F7',
        color: '#64748B',
        fontSize: 12,
        lineHeight: 1.2,
        fontWeight: 600
    },
    socketProcessTableHeader: {
        gridTemplateColumns: 'minmax(0, 1fr) 56px 126px',
        gap: 10
    },
    socketServiceTableHeader: {
        gridTemplateColumns: 'minmax(0, 1fr) minmax(92px, auto)',
        gap: 12
    },
    socketTableHeaderRight: {
        justifySelf: 'end',
        textAlign: 'right'
    },
    socketProcessRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 56px 126px',
        alignItems: 'center',
        gap: 10,
        minHeight: 42,
        padding: '0 12px',
        borderBottom: '1px solid #EEF2F7',
        color: '#111827',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        '&:last-child': {
            borderBottom: 0
        },
        '&:hover': {
            background: '#F8FAFC'
        }
    },
    socketProcessName: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: '#111827',
        fontWeight: 600
    },
    socketProcessCount: {
        color: '#111827',
        fontWeight: 700,
        justifySelf: 'end'
    },
    socketProcessPercentCell: {
        display: 'grid',
        gridTemplateColumns: '38px minmax(48px, 1fr)',
        alignItems: 'center',
        gap: 8,
        minWidth: 0
    },
    socketProcessPercent: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'right'
    },
    socketProcessBarTrack: {
        height: 4,
        borderRadius: 999,
        overflow: 'hidden',
        background: '#EEF2F7'
    },
    socketProcessBarFill: {
        height: '100%',
        borderRadius: 999,
        background: 'var(--netdive-detail-accent, #1A73E8)'
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
    antEmpty: {
        padding: theme.spacing(1.15),
        '& .ant-empty-image': {
            height: 38,
            marginBottom: 6
        },
        '& .ant-empty-description': {
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 12.5,
            lineHeight: 1.5,
            fontWeight: 600
        }
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
        borderLeft: 0,
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
        background: 'linear-gradient(180deg, rgba(239, 246, 255, 0.94) 0%, rgba(248, 250, 252, 0.98) 100%)',
        boxShadow: 'inset 0 0 0 1px rgba(147, 197, 253, 0.34)',
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
