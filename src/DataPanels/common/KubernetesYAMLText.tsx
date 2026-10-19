import * as React from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import yaml from 'react-syntax-highlighter/dist/cjs/languages/hljs/yaml'
import { LogMatch } from '../../KubernetesLogPresentation'

SyntaxHighlighter.registerLanguage('yaml', yaml)

/** Highlight token text as React nodes, never HTML. Search offsets refer to the
 * unchanged YAML string; gutter numbers are excluded from those offsets. */
export default function KubernetesYAMLText({ text, matches, active }: { text: string; matches: LogMatch[]; active: number }) {
    const renderRows = ({ rows }: { rows: any[] }) => {
        let offset = 0, nextMatch = 0
        const render = (node: any, key: string): React.ReactNode => {
            if (node.type === 'text') {
                // The highlighter synthesizes an EOF newline for its last row.
                // Do not let that change the API text or search offsets.
                const value = String(node.value).slice(0, Math.max(0, text.length - offset)), start = offset, end = start + value.length
                offset = end
                const parts: React.ReactNode[] = []
                let cursor = start, index = nextMatch
                while (index < matches.length && matches[index].start < end) {
                    const match = matches[index]
                    if (match.end <= start) { index++; nextMatch = index; continue }
                    const a = Math.max(start, match.start), b = Math.min(end, match.end)
                    if (a > cursor) parts.push(value.slice(cursor - start, a - start))
                    parts.push(<mark key={`${key}-${index}`} data-yaml-match={index}
                        className={index === active ? 'is-active' : undefined}>{value.slice(a - start, b - start)}</mark>)
                    cursor = b
                    if (match.end <= end) { index++; nextMatch = index } else break
                }
                if (cursor < end) parts.push(value.slice(cursor - start))
                return <React.Fragment key={key}>{parts}</React.Fragment>
            }
            const props = node.properties || {}, classes: string[] = props.className || []
            if (classes.includes('react-syntax-highlighter-line-number')) return <span key={key}
                className="netdive-yaml-line-number" aria-hidden="true">{node.children?.map((child: any) => child.value).join('')}</span>
            return <span key={key} className={classes.join(' ')}>{node.children?.map((child: any, i: number) => render(child, `${key}-${i}`))}</span>
        }
        return rows.map((row, i) => render(row, String(i)))
    }
    return <SyntaxHighlighter language="yaml" useInlineStyles={false} showLineNumbers wrapLines
        className="netdive-yaml-code" PreTag="div" renderer={renderRows}
        customStyle={{ margin: 0, padding: 0, background: 'transparent' }}>{text}</SyntaxHighlighter>
}
