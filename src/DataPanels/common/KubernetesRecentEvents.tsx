import * as React from 'react'
import { Tooltip } from 'antd'

import { translate } from '../../Config'
import { DetailEmpty, DetailStatusIndicator } from './DetailComponents'
import './KubernetesRecentEvents.css'

export type KubernetesEventTone = 'success' | 'warning' | 'danger'

export interface KubernetesEventGroup {
    reason: string
    tone: KubernetesEventTone
    resource: string
    resourceKind?: string
    resourceName?: string
    resourceUid?: string
    description: string
    count: number
    time: any
}

const valueByPath = (data: any, path: string): any => path.split('.').reduce((value, key) => value === undefined || value === null ? undefined : value[key], data)
const firstRaw = (data: any, paths: string[]): any => {
    for (const path of paths) {
        const value = valueByPath(data, path)
        if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return undefined
}
const firstValue = (data: any, paths: string[]): string => {
    const value = firstRaw(data, paths)
    if (value === undefined || value === null) return ''
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
const normalizedReason = (reason: string): string => reason.toLowerCase().replace(/[\s_-]+/g, '')
const eventTime = (event: any): any => {
    const value = firstRaw(event, ['lastTimestamp', 'LastTimestamp', 'eventTime', 'EventTime', 'lastObservedTime', 'LastObservedTime', 'metadata.creationTimestamp', 'ObjectMeta.CreationTimestamp'])
    return value && typeof value === 'object' && value.Time ? value.Time : value
}
const eventsFromSources = (sources: any[], combineSources = false): any[] => {
    if (combineSources) {
        const events = ([] as any[]).concat(...sources.map(source =>
            Array.isArray(source) ? source : Array.isArray(source?.items) ? source.items : Array.isArray(source?.Items) ? source.Items : []))
        const seen = new Set<string>()
        return events.filter(event => {
            const key = firstValue(event, ['metadata.uid', 'ObjectMeta.UID']) || [
                firstValue(event, ['reason', 'Reason']),
                firstValue(event, ['involvedObject.uid', 'InvolvedObject.UID', 'regarding.uid', 'Regarding.UID']),
                String(eventTime(event) || ''),
                firstValue(event, ['message', 'Message', 'note', 'Note'])
            ].join('\u0000')
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }
    for (const source of sources) {
        const events = Array.isArray(source) ? source : Array.isArray(source?.items) ? source.items : Array.isArray(source?.Items) ? source.Items : []
        if (events.length) return events
    }
    return []
}

export interface KubernetesEventCollectionOptions {
    combineSources?: boolean
    sinceMs?: number
    now?: number
    eventFilter?: (event: any) => boolean
    fallbackResourceKind?: string
    fallbackResourceName?: string
    fallbackResourceUid?: string
}

export const collectKubernetesEventGroups = (
    sources: any[],
    tones: Record<string, KubernetesEventTone>,
    options: KubernetesEventCollectionOptions = {}
): KubernetesEventGroup[] => {
    const groups = new Map<string, KubernetesEventGroup>()
    const now = options.now === undefined ? Date.now() : options.now
    eventsFromSources(sources, options.combineSources).forEach(event => {
        if (options.eventFilter && !options.eventFilter(event)) return
        const reason = firstValue(event, ['reason', 'Reason'])
        const normalized = normalizedReason(reason)
        const tone = tones[normalized]
        if (!tone) return
        const resourceKind = firstValue(event, ['involvedObject.kind', 'InvolvedObject.Kind', 'regarding.kind', 'Regarding.Kind']) || options.fallbackResourceKind || ''
        const resourceName = firstValue(event, ['involvedObject.name', 'InvolvedObject.Name', 'regarding.name', 'Regarding.Name']) || options.fallbackResourceName || ''
        const resourceUid = firstValue(event, ['involvedObject.uid', 'InvolvedObject.UID', 'regarding.uid', 'Regarding.UID']) || options.fallbackResourceUid || ''
        const resource = [resourceKind, resourceName].filter(Boolean).join(': ') || translate('kubernetesResource')
        const description = firstValue(event, ['message', 'Message', 'note', 'Note']) || translate('kubernetesNoReason')
        const countValue = firstRaw(event, ['count', 'Count', 'series.count', 'Series.Count'])
        const count = Math.max(1, Number(countValue || 1))
        const time = eventTime(event)
        if (options.sinceMs !== undefined) {
            const timestamp = new Date(time || 0).getTime()
            if (Number.isNaN(timestamp) || timestamp < now - options.sinceMs || timestamp > now) return
        }
        const key = `${normalized}:${resource}`
        const existing = groups.get(key)
        if (!existing) {
            groups.set(key, { reason, tone, resource, resourceKind, resourceName, resourceUid, description, count, time })
            return
        }
        existing.count += count
        const existingTime = new Date(existing.time || 0).getTime()
        const nextTime = new Date(time || 0).getTime()
        if (!Number.isNaN(nextTime) && (Number.isNaN(existingTime) || nextTime > existingTime)) {
            existing.time = time
            existing.description = description
        }
    })
    return Array.from(groups.values()).sort((left, right) => new Date(right.time || 0).getTime() - new Date(left.time || 0).getTime())
}

const relativeTime = (value: any): string => {
    const time = new Date(value || 0).getTime()
    if (Number.isNaN(time) || time <= 0) return translate('kubernetesNotCollected')
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
    if (elapsedSeconds < 60) return translate('kubernetesEventJustNow')
    const minutes = Math.floor(elapsedSeconds / 60)
    if (minutes < 60) return translate('kubernetesEventMinutesAgo').replace('{count}', String(minutes))
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return translate('kubernetesEventHoursAgo').replace('{count}', String(hours))
    return translate('kubernetesEventDaysAgo').replace('{count}', String(Math.floor(hours / 24)))
}

export interface KubernetesRecentEventsProps {
    groups: KubernetesEventGroup[]
    emptyText?: React.ReactNode
    lookbackLabel?: string
    onResourceClick?: (group: KubernetesEventGroup) => void
}

export const KubernetesRecentEvents = ({ groups, emptyText, lookbackLabel, onResourceClick }: KubernetesRecentEventsProps) => {
    const resolvedEmptyText = emptyText || (lookbackLabel ? `${lookbackLabel} 동안 발생한 중요 이벤트가 없습니다.` : undefined)
    if (!groups.length) return resolvedEmptyText ? <DetailEmpty description={resolvedEmptyText} compact /> : null
    return <div className="netdive-k8s-recent-events">{groups.map(group => <div key={`${group.reason}:${group.resource}`} className={`is-${group.tone}`}>
        <span className="netdive-k8s-recent-events__dot" />
        <div className="netdive-k8s-recent-events__main">
            <Tooltip title={<div><strong>{group.reason}</strong><br />{group.description}<br />{String(group.time || translate('kubernetesNotCollected'))}</div>} placement="top">
                <div>
                    <strong>{group.reason}</strong>
                    <DetailStatusIndicator tone={group.tone}>
                        {group.tone === 'danger'
                            ? translate('kubernetesHealthCritical')
                            : group.tone === 'warning'
                                ? translate('kubernetesHealthWarning')
                                : translate('kubernetesHealthNormal')}
                    </DetailStatusIndicator>
                </div>
            </Tooltip>
            <Tooltip title={group.resource} placement="top">
                {onResourceClick && (group.resourceUid || group.resourceName)
                    ? <button type="button" onClick={() => onResourceClick(group)}>{group.resource}</button>
                    : <span>{group.resource}</span>}
            </Tooltip>
            <small>{group.description} · {translate('kubernetesEventOccurrenceCount').replace('{count}', String(group.count))}</small>
        </div>
        <time title={String(group.time || '')}>{relativeTime(group.time)}</time>
    </div>)}</div>
}
