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
        gridTemplateColumns: '150px minmax(0, 1fr) 190px',
        gap: theme.spacing(1.4),
        alignItems: 'start',
        background: 'var(--netdive-detail-panel-bg, #f8fafc)',
        padding: theme.spacing(1.2),
        borderRadius: 14,
        boxSizing: 'border-box',
        [theme.breakpoints.down('md')]: {
            gridTemplateColumns: '1fr',
        }
    },
    wizardSteps: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1),
    },
    wizardStep: {
        display: 'grid',
        gridTemplateColumns: '28px minmax(0, 1fr)',
        gap: theme.spacing(0.8),
        alignItems: 'center',
        padding: theme.spacing(0.9),
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: 12,
        background: 'var(--netdive-detail-bg, #fff)',
        color: 'var(--netdive-detail-muted, #64748b)',
        '& strong': {
            display: 'block',
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 12.5,
            lineHeight: 1.25,
        },
        '& small': {
            display: 'block',
            fontSize: 11,
            lineHeight: 1.3,
        }
    },
    wizardStepActive: {
        borderColor: '#93c5fd',
        background: '#eff6ff',
    },
    wizardStepCircle: {
        width: 26,
        height: 26,
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a73e8',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        '& svg': {
            width: 15,
            height: 15,
        }
    },
    wizardWarningCard: {
        display: 'flex',
        gap: theme.spacing(0.7),
        padding: theme.spacing(1),
        borderRadius: 12,
        border: '1px solid #fed7aa',
        background: '#fff7ed',
        color: '#9a3412',
        fontSize: 11.5,
        lineHeight: 1.45,
        '& svg': {
            width: 16,
            height: 16,
            flexShrink: 0,
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
        gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
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
    diagnosisCard: {
        border: '1px solid var(--netdive-detail-border, #dbe7f5)',
        borderRadius: 14,
        padding: theme.spacing(1.2),
        '& > svg': {
            width: 18,
            height: 18,
        },
        '& strong': {
            display: 'block',
            marginTop: theme.spacing(0.5),
            fontSize: 13,
        },
        '& p': {
            margin: theme.spacing(0.5, 0),
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 12,
            lineHeight: 1.45,
        },
        '& button': {
            appearance: 'none',
            border: 0,
            background: 'transparent',
            color: '#1a73e8',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            padding: 0,
        },
        '& small': {
            display: 'block',
            marginTop: theme.spacing(0.7),
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 11,
            lineHeight: 1.45,
        }
    },
    simpleSettings: {
        marginTop: theme.spacing(1.5),
        borderTop: '1px solid var(--netdive-detail-border, #dbe7f5)',
        paddingTop: theme.spacing(1.3),
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
        borderRadius: 16,
        padding: theme.spacing(1.3),
    },
    exampleGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: theme.spacing(0.8),
        marginTop: theme.spacing(1),
        '& div': {
            border: '1px solid var(--netdive-detail-border, #dbe7f5)',
            borderRadius: 12,
            padding: theme.spacing(1),
            background: '#fff',
        },
        '& span': {
            display: 'inline-flex',
            color: '#1a73e8',
            background: '#eff6ff',
            borderRadius: 999,
            padding: '2px 7px',
            fontSize: 10.5,
            fontWeight: 700,
        },
        '& strong': {
            display: 'block',
            marginTop: theme.spacing(0.6),
            color: 'var(--netdive-detail-text, #0f172a)',
            fontSize: 12.5,
        },
        '& small': {
            display: 'block',
            marginTop: theme.spacing(0.4),
            color: 'var(--netdive-detail-muted, #64748b)',
            fontSize: 11,
            lineHeight: 1.35,
        }
    },
    wizardHelpPanel: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1),
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
    supportList: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: theme.spacing(0.7),
        color: 'var(--netdive-detail-text, #0f172a)',
        fontSize: 11.5,
        '& svg': {
            width: 15,
            height: 15,
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
        },
        '& a': {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginTop: theme.spacing(0.8),
            color: '#1a73e8',
            fontSize: 11.5,
            fontWeight: 700,
        }
    },
    textField: {
        marginLeft: 0,
        marginRight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
    },
    button: {
        borderRadius: 10,
        boxShadow: '0 8px 18px rgba(26, 115, 232, 0.22)',
        fontWeight: 700,
        padding: '7px 14px',
    },
    control: {
        display: "block !important",
        "& .MuiInputBase-root": {
            display: "block !important",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box"
        },
        "& .MuiSelect-root, & .MuiInputBase-input, & textarea, & input": {
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            paddingLeft: "5px"
        },
        marginTop: 24,
        marginLeft: 0,
        marginRight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
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
    }
})
