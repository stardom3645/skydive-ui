import * as React from 'react'
import Button from '@material-ui/core/Button'
import KeyboardArrowDown from '@material-ui/icons/KeyboardArrowDown'
import './TopologyToolbarButton.css'

/** Share the existing two-line toolbar trigger, including its responsive JSS
 * classes, instead of embedding small form controls directly in the toolbar. */
export const TopologyToolbarButton = React.forwardRef<HTMLButtonElement, {
    title: string; summary: string; summaryTitle?: string; icon: React.ReactNode; classes?: Record<string, string>
    onClick?: React.MouseEventHandler; [key: string]: any
}>(({ title, summary, summaryTitle, icon, classes = {}, ...props }, ref) => <Button {...props} ref={ref}
    className={`netdive-topology-toolbar-button ${classes.layerFilterButton || ''} ${props.className || ''}`}
    aria-label={title} aria-haspopup={props['aria-haspopup'] ?? true}>
    <span className={`netdive-topology-toolbar-button__icon ${classes.layerFilterButtonIcon || ''}`}>{icon}</span>
    <span className={`netdive-topology-toolbar-button__text ${classes.layerFilterButtonText || ''}`}>
        <span className={classes.layerFilterButtonLabel}>{title}</span>
        <span className={`netdive-topology-toolbar-button__summary ${classes.layerFilterButtonSummary || ''}`} title={summaryTitle || summary}>{summary}</span>
    </span>
    <span className={classes.layerFilterButtonChevron}><KeyboardArrowDown fontSize="small" /></span>
</Button>)
