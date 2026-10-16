import * as React from 'react'
import { LogMatch } from '../KubernetesLogPresentation'

/** Show the API string directly. Only explicit search matches receive markup. */
export default function KubernetesLogText({ text, matches, active }: { text: string; matches: LogMatch[]; active: number }) {
    if (!matches.length) return <>{text}</>
    const parts: React.ReactNode[] = []
    let offset = 0
    matches.forEach((match, index) => {
        if (match.start > offset) parts.push(text.slice(offset, match.start))
        parts.push(<mark key={index} data-log-match={index} className={index === active ? 'is-active' : undefined}>{text.slice(match.start, match.end)}</mark>)
        offset = match.end
    })
    if (offset < text.length) parts.push(text.slice(offset))
    return <>{parts}</>
}
