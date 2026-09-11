/*
 * Copyright (C) 2019 Sylvain Afchain
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { createStyles, Theme } from '@material-ui/core/styles'

/** Layout-only rules for the capture wizard. Controls and visual states are
 * provided by Ant Design and the shared Netdive detail/operations tokens. */
export const styles = (theme: Theme) => createStyles({
    captureWizard: {
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 280px',
        gap: 'var(--netdive-ops-section-gap)',
        alignItems: 'start',
        color: 'var(--netdive-detail-text-secondary)',
        fontSize: 'var(--netdive-detail-font-body-label)',
        [theme.breakpoints.down('md')]: { gridTemplateColumns: '1fr' }
    },
    captureFeedback: { gridColumn: '1 / -1', marginBottom: 0 },
    wizardMain: { display: 'flex', minWidth: 0, flexDirection: 'column', gap: 'var(--netdive-ops-section-gap)' },
    wizardMainCard: {
        minWidth: 0,
        padding: 'var(--netdive-ops-panel-padding)',
        border: '1px solid var(--netdive-detail-card-border)',
        borderRadius: 'var(--netdive-ops-radius)',
        background: 'var(--netdive-ant-bg)',
        boxShadow: 'var(--netdive-ant-card-shadow)'
    },
    wizardCardHeader: {
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 'var(--netdive-ops-card-gap)', marginBottom: 'var(--netdive-ops-card-gap)',
        '& .ant-tag': { marginRight: 0 }
    },
    wizardTitle: {
        margin: 0, color: 'var(--netdive-detail-text)',
        fontSize: 'var(--netdive-detail-font-section-title)',
        fontWeight: 600,
        lineHeight: 'var(--netdive-detail-line-section-title)'
    },
    wizardSubtitle: {
        margin: '2px 0 0', color: 'var(--netdive-detail-text-tertiary)',
        fontSize: 'var(--netdive-detail-font-supporting-text)',
        lineHeight: 'var(--netdive-detail-line-supporting-text)'
    },
    targetCard: {
        borderColor: 'var(--netdive-ops-border)', borderRadius: 'var(--netdive-ops-radius)',
        background: 'var(--netdive-ops-tint)', boxShadow: 'none',
        '& .ant-card-body': { padding: 'var(--netdive-ops-card-padding)' },
        '& .ant-descriptions-item': { paddingBottom: 6 },
        '& .ant-descriptions-item-label': {
            width: 104, color: 'var(--netdive-detail-text-tertiary)',
            fontSize: 'var(--netdive-detail-font-supporting-text)'
        },
        '& .ant-descriptions-item-content': {
            minWidth: 0, color: 'var(--netdive-detail-text-secondary)',
            fontSize: 'var(--netdive-detail-font-body-label)'
        },
        '& .ant-descriptions-item-content strong': {
            display: 'block', overflow: 'hidden', fontWeight: 600,
            textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        },
        '& .ant-tag': { marginRight: 0 }
    },
    simpleSettings: {
        marginTop: 'var(--netdive-ops-section-gap)', paddingTop: 'var(--netdive-ops-section-gap)',
        borderTop: '1px solid var(--netdive-detail-section-divider)'
    },
    compactAlert: {
        marginTop: 'var(--netdive-ops-card-gap)', borderRadius: 'var(--netdive-ant-radius)',
        '&.ant-alert-with-description': { padding: '7px 12px' },
        '& .ant-alert-icon': { top: 11, fontSize: 14 },
        '& .ant-alert-message': { marginBottom: 0, fontSize: 12, fontWeight: 600 },
        '& .ant-alert-description': { fontSize: 11, lineHeight: '16px' }
    },
    settingRow: {
        display: 'grid', gridTemplateColumns: '154px minmax(0, 1fr)', alignItems: 'center',
        gap: 'var(--netdive-ops-section-gap)', minHeight: 54,
        padding: 'var(--netdive-ops-card-gap) 0', borderBottom: '1px solid var(--netdive-detail-row-divider)',
        '& > div:first-child strong': {
            display: 'block', color: 'var(--netdive-detail-text)',
            fontSize: 'var(--netdive-detail-font-body-label)', fontWeight: 600
        },
        '& > div:first-child small': {
            display: 'block', marginTop: 2, color: 'var(--netdive-detail-text-tertiary)',
            fontSize: 'var(--netdive-detail-font-supporting-text)', lineHeight: 'var(--netdive-detail-line-supporting-text)'
        },
        [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' }
    },
    optionGroup: {
        display: 'flex', flexWrap: 'wrap', gap: 6,
        '& .ant-radio-button-wrapper': {
            height: 'var(--netdive-ops-control-height)', display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '0 12px', border: '1px solid var(--netdive-ant-border)',
            borderRadius: 'var(--netdive-ant-radius) !important', color: 'var(--netdive-detail-text-secondary)',
            fontSize: 12, lineHeight: '30px', boxShadow: 'none'
        },
        '& .ant-radio-button-wrapper::before': { display: 'none' },
        '& .ant-radio-button-wrapper:hover': { borderColor: 'var(--netdive-ant-primary)', color: 'var(--netdive-ant-primary)' },
        '& .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled)': {
            borderColor: 'var(--netdive-ant-primary)', background: 'var(--netdive-ant-primary)', color: '#fff', boxShadow: 'none'
        },
        '& small': { marginLeft: 2, color: 'inherit', fontSize: 11, opacity: 0.76 }
    },
    inlineFieldCard: {
        margin: 'var(--netdive-ops-card-gap) 0 0',
        '& .ant-form-item-label': { paddingBottom: 4 },
        '& .ant-form-item-label > label': { color: 'var(--netdive-detail-text-secondary)', fontSize: 12 }
    },
    wizardActions: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--netdive-ops-card-gap)', paddingTop: 'var(--netdive-ops-card-gap)'
    },
    advancedToggle: { paddingLeft: 0, color: 'var(--netdive-ant-primary)' },
    button: { height: 'var(--netdive-ops-control-height)', borderRadius: 'var(--netdive-ant-radius)', boxShadow: 'none' },
    advanced: {
        marginTop: 'var(--netdive-ops-card-gap)', overflow: 'hidden',
        borderColor: 'var(--netdive-ops-border)', borderRadius: 'var(--netdive-ops-radius)',
        background: 'var(--netdive-ant-bg)',
        '& > .ant-collapse-item > .ant-collapse-header': {
            minHeight: 40, alignItems: 'center', padding: '9px 12px',
            color: 'var(--netdive-detail-text)', fontWeight: 600
        },
        '& .ant-collapse-content-box': { padding: 'var(--netdive-ops-card-padding)' }
    },
    advancedTitleRow: {
        display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
        '& .ant-tag': { marginRight: 0, fontSize: 11 }
    },
    advancedContent: { display: 'grid', gap: 'var(--netdive-ops-section-gap)' },
    advancedSection: {
        paddingTop: 'var(--netdive-ops-card-gap)', borderTop: '1px solid var(--netdive-detail-section-divider)',
        '& > header': { marginBottom: 'var(--netdive-ops-card-gap)' },
        '& > header strong': {
            display: 'block', color: 'var(--netdive-detail-text)',
            fontSize: 'var(--netdive-detail-font-section-title)', fontWeight: 600
        },
        '& > header small': {
            display: 'block', marginTop: 2, color: 'var(--netdive-detail-text-tertiary)',
            fontSize: 'var(--netdive-detail-font-supporting-text)'
        }
    },
    advancedGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        alignItems: 'start', gap: 'var(--netdive-ops-card-gap) var(--netdive-ops-section-gap)',
        [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' }
    },
    advancedForm: {
        margin: 0,
        '&.ant-form-vertical .ant-form-item-label': {
            display: 'block', width: '100%', padding: '0 0 4px', textAlign: 'left', lineHeight: '18px'
        },
        '&.ant-form-vertical .ant-form-item-control': { display: 'block', width: '100%', minWidth: 0 },
        '&.ant-form-vertical .ant-form-item-control-input': { minHeight: 'var(--netdive-ops-control-height)' }
    },
    advancedOptionBlock: {
        minWidth: 0, marginBottom: 0,
        '& .ant-form-item-label > label': { height: 18, lineHeight: '18px' },
        '& .ant-form-item-extra, & .ant-form-item-explain': {
            minHeight: 16, marginTop: 2, color: 'var(--netdive-detail-text-tertiary)',
            fontSize: 'var(--netdive-detail-font-supporting-text)', lineHeight: 'var(--netdive-detail-line-supporting-text)'
        },
        '& .ant-select, & .ant-input': { width: '100%' }
    },
    advancedOptionLabel: {
        display: 'inline-flex', alignItems: 'center', gap: 5,
        color: 'var(--netdive-detail-text-secondary)', fontSize: 12, fontWeight: 600,
        '& em': {
            padding: '0 5px', borderRadius: 'var(--netdive-ant-radius)', background: 'var(--netdive-ant-selected)',
            color: 'var(--netdive-ant-primary)', fontSize: 11, fontStyle: 'normal'
        }
    },
    advancedMenuItem: {
        display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
        '& strong': { fontSize: 12, fontWeight: 600 },
        '& small': {
            overflow: 'hidden', color: 'var(--netdive-detail-text-tertiary)',
            fontSize: 11, textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }
    },
    advancedCheckList: {
        display: 'grid',
        '& > label': {
            display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr)', alignItems: 'start', gap: 6,
            minHeight: 46, padding: '7px 2px', borderBottom: '1px solid var(--netdive-detail-row-divider)', cursor: 'pointer'
        },
        '& > label:last-child': { borderBottom: 0 },
        '& .ant-checkbox-wrapper, & .ant-checkbox': { marginTop: 1 },
        '& strong': {
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4,
            color: 'var(--netdive-detail-text)', fontSize: 12, fontWeight: 600
        },
        '& .ant-tag': { marginRight: 0, fontSize: 11, lineHeight: '18px' },
        '& small': {
            display: 'block', marginTop: 2, color: 'var(--netdive-detail-text-tertiary)', fontSize: 11, lineHeight: '16px'
        }
    },
    captureExamples: {
        overflow: 'hidden', borderColor: 'var(--netdive-ops-border)',
        borderRadius: 'var(--netdive-ops-radius)', background: 'var(--netdive-ant-bg)',
        '& > .ant-collapse-item > .ant-collapse-header': {
            minHeight: 40, padding: '9px 12px', color: 'var(--netdive-detail-text)', fontSize: 13, fontWeight: 600
        },
        '& .ant-collapse-content-box': { padding: 'var(--netdive-ops-card-padding)' }
    },
    exampleGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--netdive-ops-card-gap)',
        '& > div': {
            minWidth: 0, padding: 'var(--netdive-ops-card-padding)', border: '1px solid var(--netdive-ops-border)',
            borderRadius: 'var(--netdive-ops-radius)', background: 'var(--netdive-ops-tint)'
        },
        '& header': { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
        '& header strong': { color: 'var(--netdive-detail-text)', fontSize: 12, fontWeight: 600 },
        '& .ant-tag': { flexShrink: 0, marginRight: 0, fontSize: 11 },
        '& small': { display: 'block', marginTop: 5, color: 'var(--netdive-detail-text-tertiary)', fontSize: 11, lineHeight: '16px' },
        [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' }
    },
    exampleCardAvailable: { background: '#f6ffed !important', borderColor: '#d9f7be !important' },
    exampleCardUnavailable: {},
    wizardHelpPanel: {
        position: 'sticky', top: 0, alignSelf: 'start', minWidth: 0,
        [theme.breakpoints.down('md')]: { position: 'static' }
    },
    capturePreflightPanel: {
        borderColor: 'var(--netdive-ops-border)', borderRadius: 'var(--netdive-ops-radius)',
        background: 'var(--netdive-ant-bg)', boxShadow: 'var(--netdive-ant-card-shadow)',
        '& > .ant-card-body': { padding: 'var(--netdive-ops-card-padding)' }
    },
    preflightPanelHeader: {
        paddingBottom: 'var(--netdive-ops-card-gap)', marginBottom: 'var(--netdive-ops-card-gap)',
        borderBottom: '1px solid var(--netdive-detail-section-divider)',
        '& strong': {
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--netdive-detail-text)', fontSize: 14, fontWeight: 600
        },
        '& strong svg': { color: 'var(--netdive-ant-primary)' },
        '& span': { display: 'block', marginTop: 2, color: 'var(--netdive-detail-text-tertiary)', fontSize: 11 }
    },
    preflightSection: {
        paddingBottom: 'var(--netdive-ops-card-gap)', marginBottom: 'var(--netdive-ops-card-gap)',
        borderBottom: '1px solid var(--netdive-detail-section-divider)'
    },
    sideCardTitle: {
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--netdive-detail-text)',
        '& svg': { color: 'var(--netdive-ops-icon-color)', fontSize: 15 },
        '& strong': { fontSize: 12, fontWeight: 600 }
    },
    captureSummaryRows: {
        '& .ant-descriptions-item': { paddingBottom: 4 },
        '& .ant-descriptions-item-label': { width: 58, color: 'var(--netdive-detail-text-tertiary)', fontSize: 11 },
        '& .ant-descriptions-item-content': {
            display: 'block', overflow: 'hidden', color: 'var(--netdive-detail-text)', fontSize: 12,
            fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }
    },
    captureCautionCard: {
        marginBottom: 'var(--netdive-ops-card-gap)', borderRadius: 'var(--netdive-ant-radius)',
        '&.ant-alert-with-description': { padding: '8px 10px' },
        '& .ant-alert-icon': { top: 11, fontSize: 14 },
        '& .ant-alert-message': { marginBottom: 4, fontSize: 12, fontWeight: 600 },
        '& .ant-alert-description': { fontSize: 11 },
        '& ul': { margin: 0, paddingLeft: 17 },
        '& li': { marginBottom: 2, lineHeight: '17px' }
    },
    captureHelpAccordion: {
        overflow: 'hidden', borderColor: 'var(--netdive-ops-border)',
        borderRadius: 'var(--netdive-ops-radius)', background: 'var(--netdive-ant-bg)',
        '& > .ant-collapse-item > .ant-collapse-header': { minHeight: 38, padding: '8px 10px', fontSize: 12, fontWeight: 600 },
        '& .ant-collapse-content-box': { padding: 'var(--netdive-ops-card-padding)' }
    },
    captureHelpList: {
        display: 'grid', gap: 7,
        '& > div': { display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', alignItems: 'start', gap: 6 },
        '& svg': { marginTop: 1, color: 'var(--netdive-detail-success)', fontSize: 14 },
        '& strong': { display: 'block', color: 'var(--netdive-detail-text)', fontSize: 12, fontWeight: 600 },
        '& small': { display: 'block', marginTop: 1, color: 'var(--netdive-detail-text-tertiary)', fontSize: 11, lineHeight: '16px' }
    }
})
