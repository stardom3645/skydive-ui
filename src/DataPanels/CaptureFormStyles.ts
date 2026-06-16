/*
 * Copyright (C) 2019 Sylvain Afchain
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { createStyles, Theme } from '@material-ui/core/styles'

export const styles = (theme: Theme) => createStyles({
    captureWizard: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 280px',
        gap: theme.spacing(1.5),
        alignItems: 'start',
        background: 'var(--netdive-detail-panel-bg, #f8fafc)',
        padding: theme.spacing(1.2),
        borderRadius: 14,
        boxSizing: 'border-box',
        [theme.breakpoints.down('md')]: {
            gridTemplateColumns: '1fr',
        }
    },
    wizardMain: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1.2),
        minWidth: 0,
    },
    wizardMainCard: {
        background: 'var(--netdive-detail-bg, #fff)',
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: 16,
        padding: theme.spacing(1.5),
        boxShadow: '0 10px 26px rgba(15, 23, 42, 0.06)',
        minWidth: 0,
    },
    wizardCardHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(1.2),
    },
    wizardTitle: {
        margin: 0,
        color: 'var(--netdive-detail-text, #0f172a)',
        fontSize: 15,
        fontWeight: 800,
        lineHeight: 1.25,
    },
    wizardSubtitle: {
        margin: theme.spacing(0.35, 0, 0),
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 12,
        lineHeight: 1.45,
    },
    captureStatusBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        borderRadius: 999,
        padding: '5px 9px',
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        border: '1px solid transparent',
    },
    statusAvailable: {
        color: '#15803d',
        borderColor: '#bbf7d0',
        background: '#f0fdf4',
    },
    statusConditional: {
        color: '#b45309',
        borderColor: '#fed7aa',
        background: '#fffbeb',
    },
    statusUnavailable: {
        color: '#b91c1c',
        borderColor: '#fecaca',
        background: '#fef2f2',
    },
    targetSummaryGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: theme.spacing(1),
        [theme.breakpoints.down('sm')]: {
            gridTemplateColumns: '1fr',
        }
    },
    targetCard: {
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: 14,
        padding: theme.spacing(1.2),
        background: '#fff',
    },
    sectionLabel: {
        display: 'block',
        color: 'var(--netdive-detail-muted, #64748b)',
        fontSize: 11.5,
        fontWeight: 700,
        marginBottom: theme.spacing(0.7),
    },
    targetNameRow: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: theme.spacing(0.7),
        '& strong': {
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 17,
            lineHeight: 1.25,
        },
        '& span': {
            borderRadius: 999,
            padding: '3px 8px',
            background: '#eff6ff',
            color: '#1a73e8',
            border: '1px solid #bfdbfe',
            fontSize: 11,
            fontWeight: 700,
        }
    },
    targetInfoGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: theme.spacing(0.8),
        marginTop: theme.spacing(1.2),
        '& div': {
            minWidth: 0,
        },
        '& span': {
            display: 'block',
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 11,
            marginBottom: 2,
        },
        '& strong': {
            display: 'block',
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        }
    },
    targetStatusLine: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginTop: theme.spacing(1),
        borderRadius: 10,
        padding: theme.spacing(0.7, 0.9),
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.4,
    },
    simpleSettings: {
        marginTop: theme.spacing(1.5),
        borderTop: '1px solid var(--netdive-detail-border, #dbe7f5)',
        paddingTop: theme.spacing(1.3),
    },
    simpleApiBanner: {
        display: 'grid',
        gridTemplateColumns: '22px minmax(0, 1fr)',
        gap: theme.spacing(0.8),
        alignItems: 'start',
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(0.6),
        padding: theme.spacing(1),
        border: '1px solid #bfdbfe',
        borderRadius: 12,
        background: '#eff6ff',
        color: '#1e3a8a',
        '& svg': {
            width: 18,
            height: 18,
            marginTop: 1,
            color: '#1a73e8',
        },
        '& strong': {
            display: 'block',
            fontSize: 12.5,
            fontWeight: 800,
            lineHeight: 1.25,
        },
        '& span': {
            display: 'block',
            marginTop: 3,
            fontSize: 11.5,
            lineHeight: 1.45,
        }
    },
    settingRow: {
        display: 'grid',
        gridTemplateColumns: '150px minmax(0, 1fr)',
        gap: theme.spacing(1),
        alignItems: 'start',
        padding: theme.spacing(1, 0),
        borderBottom: '1px solid rgba(219, 231, 245, 0.65)',
        '& > div:first-child strong': {
            display: 'block',
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 13,
        },
        '& > div:first-child small': {
            display: 'block',
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 11,
            lineHeight: 1.45,
            marginTop: 3,
        },
        [theme.breakpoints.down('sm')]: {
            gridTemplateColumns: '1fr',
        }
    },
    optionGroup: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7,
    },
    wizardOptionButton: {
        appearance: 'none',
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: 10,
        background: '#fff',
        color: 'var(--netdive-detail-text, #0f172a)',
        cursor: 'pointer',
        minHeight: 34,
        padding: '6px 10px',
        display: 'inline-flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: 2,
        fontSize: 12,
        fontWeight: 700,
        transition: 'border-color 160ms ease, background-color 160ms ease, color 160ms ease',
        '& small': {
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 10.5,
            fontWeight: 600,
        },
        '&:hover': {
            borderColor: '#93c5fd',
            background: '#f3f8ff',
        },
        '&:disabled': {
            cursor: 'not-allowed',
            opacity: 0.45,
            background: '#f8fafc',
        }
    },
    wizardOptionButtonActive: {
        borderColor: '#1a73e8',
        background: '#e8f2ff',
        color: '#1a73e8',
    },
    inlineFieldCard: {
        marginTop: theme.spacing(0.8),
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: 12,
        background: '#f8fafc',
        padding: theme.spacing(1),
    },
    compactField: {
        margin: 0,
        '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#fff',
            minHeight: 42,
            '& fieldset': {
                borderColor: 'var(--netdive-detail-border, #dbe7f5)',
            },
            '&:hover fieldset': {
                borderColor: '#93c5fd',
            },
            '&.Mui-focused fieldset': {
                borderColor: '#1a73e8',
                borderWidth: 1,
            },
        },
        '& .MuiInputBase-input': {
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 13,
            lineHeight: 1.45,
            padding: '11px 12px',
            boxSizing: 'border-box',
        },
        '& .MuiInputLabel-outlined': {
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 12,
        },
        '& .MuiFormHelperText-root': {
            marginLeft: 2,
            fontSize: 11,
        },
        '& .MuiSelect-select': {
            minHeight: 'auto',
            padding: '11px 32px 11px 12px',
            fontSize: 13,
            boxSizing: 'border-box',
        }
    },
    fieldLabelWithHelp: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
    },
    wizardActions: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.spacing(1),
        marginTop: theme.spacing(1.2),
    },
    advancedToggle: {
        color: '#1a73e8',
        fontWeight: 700,
    },
    captureExamples: {
        background: 'var(--netdive-detail-bg, #fff)',
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: '14px !important',
        boxShadow: 'none',
        overflow: 'hidden',
        '&::before': {
            display: 'none',
        },
        '& .MuiAccordionSummary-root': {
            minHeight: 44,
            padding: theme.spacing(0, 1.2),
        },
        '& .MuiAccordionSummary-content': {
            margin: theme.spacing(1, 0),
        },
        '& .MuiAccordionDetails-root': {
            padding: theme.spacing(0, 1.2, 1.2),
            display: 'block',
        }
    },
    exampleGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: theme.spacing(0.8),
        marginTop: theme.spacing(1),
        '& div': {
            border: '1px solid var(--netdive-detail-border, #dbe7f5)',
            borderRadius: 12,
            padding: theme.spacing(1.1),
            background: '#fff',
            minWidth: 0,
        },
        '& header': {
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: theme.spacing(1),
            minWidth: 0,
        },
        '& header span': {
            display: 'inline-flex',
            flexShrink: 0,
            borderRadius: 999,
            padding: '3px 7px',
            fontSize: 10.5,
            fontWeight: 800,
        },
        '& strong': {
            display: 'block',
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 13.5,
            fontWeight: 800,
            lineHeight: 1.25,
            minWidth: 0,
        },
        '& small': {
            display: 'block',
            marginTop: theme.spacing(0.75),
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 11.5,
            lineHeight: 1.4,
        }
    },
    exampleCardAvailable: {
        borderColor: '#bbf7d0 !important',
        background: '#f0fdf4 !important',
        '& header span': {
            color: '#15803d',
            background: '#dcfce7',
            border: '1px solid #86efac',
        }
    },
    exampleCardUnavailable: {
        '& header span': {
            color: '#b45309',
            background: '#fffbeb',
            border: '1px solid #fed7aa',
        }
    },
    wizardHelpPanel: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1),
        minWidth: 0,
    },
    captureSideCard: {
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: 14,
        background: 'var(--netdive-detail-bg, #fff)',
        padding: theme.spacing(1.1),
        boxShadow: '0 8px 20px rgba(15, 23, 42, 0.04)',
    },
    sideCardTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.7),
        paddingBottom: theme.spacing(0.8),
        marginBottom: theme.spacing(0.8),
        borderBottom: '1px solid rgba(219, 231, 245, 0.8)',
        color: 'var(--netdive-detail-text, #0f172a)',
        '& svg': {
            width: 17,
            height: 17,
            color: '#1a73e8',
        },
        '& strong': {
            fontSize: 13.5,
            fontWeight: 800,
        }
    },
    captureSummaryRows: {
        display: 'grid',
        gap: theme.spacing(0.75),
        '& div': {
            display: 'grid',
            gridTemplateColumns: '66px minmax(0, 1fr)',
            alignItems: 'center',
            gap: theme.spacing(0.8),
            minWidth: 0,
        },
        '& span': {
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 12,
            fontWeight: 700,
        },
        '& strong': {
            display: 'block',
            minWidth: 0,
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 12.5,
            fontWeight: 800,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        }
    },
    summaryStatusBadge: {
        display: 'inline-flex',
        width: 'fit-content',
        maxWidth: '100%',
        borderRadius: 999,
        padding: '3px 8px',
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1.25,
    },
    preflightList: {
        display: 'grid',
        gap: theme.spacing(0.65),
        margin: 0,
        padding: 0,
        listStyle: 'none',
        '& li': {
            display: 'grid',
            gridTemplateColumns: '18px minmax(0, 1fr)',
            gap: theme.spacing(0.6),
            alignItems: 'start',
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 12.2,
            lineHeight: 1.45,
        },
        '& svg': {
            width: 16,
            height: 16,
            marginTop: 1,
            color: '#16a34a',
        }
    },
    preflightWarning: {
        color: '#92400e !important',
        '& svg': {
            color: '#d97706 !important',
        }
    },
    captureCautionCard: {
        border: '1px solid #fde68a',
        borderRadius: 14,
        background: '#fffbeb',
        padding: theme.spacing(1.1),
        color: '#78350f',
        '& strong': {
            display: 'block',
            fontSize: 13.5,
            fontWeight: 800,
            marginBottom: theme.spacing(0.7),
        },
        '& ul': {
            margin: 0,
            paddingLeft: 17,
        },
        '& li': {
            fontSize: 12,
            lineHeight: 1.5,
            marginBottom: theme.spacing(0.35),
        },
        '& li:last-child': {
            marginBottom: 0,
        }
    },
    captureHelpAccordion: {
        background: 'var(--netdive-detail-bg, #fff)',
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: '14px !important',
        boxShadow: 'none',
        overflow: 'hidden',
        '&::before': {
            display: 'none',
        },
        '& .MuiAccordionSummary-root': {
            minHeight: 44,
            padding: theme.spacing(0, 1.1),
        },
        '& .MuiAccordionSummary-content': {
            margin: theme.spacing(1, 0),
        },
        '& h3': {
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 13.5,
            fontWeight: 800,
        },
        '& .MuiAccordionDetails-root': {
            padding: theme.spacing(0, 1.1, 1.1),
        },
        '& p': {
            margin: theme.spacing(0, 0, 0.7),
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 12,
            lineHeight: 1.5,
        },
        '& p:last-child': {
            marginBottom: 0,
        }
    },
    helpCard: {
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: 14,
        background: 'var(--netdive-detail-bg, #fff)',
        padding: theme.spacing(1.1),
        '& > svg': {
            color: '#1a73e8',
            width: 18,
            height: 18,
        },
        '& strong': {
            display: 'block',
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 13,
            marginTop: theme.spacing(0.3),
        },
        '& p, & li': {
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 11.5,
            lineHeight: 1.45,
        },
        '& ol': {
            paddingLeft: 16,
            margin: theme.spacing(0.7, 0, 0),
        }
    },
    helpNotice: {
        border: '1px solid #bfdbfe',
        borderRadius: 14,
        background: '#eff6ff',
        padding: theme.spacing(1.1),
        color: '#1e3a8a',
        '& strong': {
            display: 'block',
            fontSize: 13,
            marginBottom: 4,
        },
        '& span': {
            display: 'block',
            fontSize: 11.5,
            lineHeight: 1.45,
        }
    },
    button: {
        borderRadius: 10,
        boxShadow: '0 8px 18px rgba(26, 115, 232, 0.22)',
        fontWeight: 700,
        padding: '7px 14px',
    },
    advanced: {
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        boxShadow: "unset !important",
        marginTop: theme.spacing(1.2),
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: '12px !important',
        '&::before': {
            top: 0,
            height: 0
        }
    },
    advancedSummary: {
        padding: theme.spacing(0, 1),
        color: "var(--netdive-detail-text)",
        backgroundColor: "unset !important",
        borderColor: "unset",
        '& .MuiAccordionSummary-content': {
            backgroundColor: "unset",
        }
    },
    heading: {
        color: 'var(--netdive-detail-text, #0f172a)',
        fontWeight: 700,
        fontSize: 13,
    },
    advancedGrid: {
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: theme.spacing(1),
        [theme.breakpoints.down('sm')]: {
            gridTemplateColumns: '1fr',
        }
    },
    advancedChecks: {
        gridColumn: '1 / -1',
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: 12,
        background: '#f8fafc',
        padding: theme.spacing(0.8, 1),
        '& .MuiFormControlLabel-root': {
            marginRight: theme.spacing(1.4),
            marginLeft: 0,
            color: 'var(--netdive-detail-text, #0f172a)',
        },
        '& .MuiFormControlLabel-label': {
            fontSize: 12.5,
        },
        '& .MuiCheckbox-root': {
            padding: 6,
        }
    }
})
