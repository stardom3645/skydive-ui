import * as React from 'react'
import { Button, Checkbox, ConfigProvider, Divider, Input, Segmented, Select, Spin, Tooltip, theme } from 'antd'
import { CheckCircleOutlined, CheckOutlined, CopyOutlined, DownOutlined, InfoCircleOutlined, ReloadOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons'
import { DetailCopyButton } from './common/DetailComponents'
import { findLogMatches } from '../KubernetesLogPresentation'

export interface KubernetesLogPodSelection {
    value?: string
    options: { value: string; label: string; title: string }[]
    onChange: (uid: string) => void
}

function TargetLabel({ label, title, query = '' }: { label: string; title?: string; query?: string }) {
    const matches = findLogMatches(label, query).matches
    let offset = 0
    const parts: React.ReactNode[] = []
    matches.forEach(match => {
        parts.push(label.slice(offset, match.start), <mark key={match.start}>{label.slice(match.start, match.end)}</mark>)
        offset = match.end
    })
    parts.push(label.slice(offset))
    return <Tooltip title={title || label} placement="topLeft" mouseEnterDelay={0.6}>
        <span className="netdive-log-target-label">{parts}</span>
    </Tooltip>
}

/** Presentation only. The request owner keeps state when the workspace changes. */
export function KubernetesLogTargets(props: {
    id: string; podSelection?: KubernetesLogPodSelection; podName?: string
    container: string; choices: { value: string; label: string }[]; loading?: boolean
    onContainerChange: (value: string) => void
}) {
    const { token } = theme.useToken()
    const [podSearch, setPodSearch] = React.useState('')
    const popupStyle = {
        '--log-option-text': token.colorText, '--log-option-hover': token.controlItemBgHover,
        '--log-option-selected': token.colorPrimaryBg, '--log-option-primary': token.colorPrimaryText,
        '--log-option-match': token.colorFillSecondary
    } as React.CSSProperties
    return <ConfigProvider theme={{ components: { Select: { optionHeight: 28, optionPadding: '4px 8px', optionFontSize: 12, optionLineHeight: 20 / 12 } } }}>
        <div className="netdive-log-targets" role="group" aria-label="로그 조회 대상">
            <div className="netdive-log-targets__row">
                <label htmlFor={props.podSelection ? `${props.id}-pod` : undefined}>파드</label>
                {props.podSelection
                    ? <Select id={`${props.id}-pod`} aria-label="로그 파드 선택" variant="borderless"
                        showSearch={{ optionFilterProp: 'label', onSearch: setPodSearch }} onOpenChange={open => { if (!open) setPodSearch('') }}
                        value={props.podSelection.value} options={props.podSelection.options} onChange={props.podSelection.onChange}
                        listHeight={256} listItemHeight={28} classNames={{ popup: { root: 'netdive-log-target-popup' } }}
                        styles={{ popup: { root: popupStyle } }} menuItemSelectedIcon={<CheckOutlined />}
                        labelRender={option => <TargetLabel label={String(option.label || option.value)} title={props.podSelection?.options.find(item => item.value === option.value)?.title} />}
                        optionRender={option => <TargetLabel label={option.data.label} title={option.data.title} query={podSearch} />}
                        placeholder="조회할 파드 없음" disabled={!props.podSelection.options.length} getPopupContainer={() => document.body} />
                    : <span className="netdive-log-targets__value" title={props.podName}>{props.podName || '선택한 파드'}</span>}
            </div>
            <div className="netdive-log-targets__row">
                <label htmlFor={`${props.id}-container`}>컨테이너</label>
                <Select id={`${props.id}-container`} aria-label="로그 컨테이너 선택" variant="borderless" value={props.container || undefined}
                    options={props.choices} loading={props.loading} disabled={!props.choices.length} placeholder="컨테이너 없음"
                    listHeight={256} listItemHeight={28} classNames={{ popup: { root: 'netdive-log-target-popup' } }}
                    styles={{ popup: { root: popupStyle } }} menuItemSelectedIcon={<CheckOutlined />}
                    labelRender={option => <TargetLabel label={String(option.label || option.value)} />}
                    optionRender={option => <TargetLabel label={option.data.label} />}
                    onChange={props.onContainerChange} getPopupContainer={() => document.body} />
            </div>
        </div>
    </ConfigProvider>
}

export function KubernetesLogQueryToolbar(props: {
    previous: boolean; enabled: boolean; busy: boolean; tailLines: number
    onPreviousChange: (previous: boolean) => void; onTailLinesChange: (lines: number) => void; onRefresh: () => void
}) {
    return <div className="netdive-log-query" role="group" aria-label="로그 조회 도구">
        <Segmented aria-label="로그 조회 유형" value={props.previous ? 'previous' : 'current'} disabled={!props.enabled}
            options={[{ label: '현재 로그', value: 'current' }, { label: '이전 로그', value: 'previous' }]}
            onChange={value => props.onPreviousChange(value === 'previous')} />
        <div className="netdive-log-query__actions">
            <Select aria-label="최근 로그 줄 수" value={props.tailLines} onChange={props.onTailLinesChange}
                options={[100, 500, 1000, 2000].map(value => ({ value, label: `${value.toLocaleString()}줄` }))}
                getPopupContainer={() => document.body} />
            <Tooltip title="로그 새로고침"><Button type="text" aria-label="로그 새로고침" icon={<ReloadOutlined />} loading={props.busy}
                disabled={!props.enabled} onClick={props.onRefresh} /></Tooltip>
        </div>
    </div>
}

export function KubernetesLogDisplayToolbar(props: {
    query: string; total: number; active: number; hasMatches: boolean; wrap: boolean; logs: string
    onQueryChange: (query: string) => void; onMoveMatch: (direction: number) => void; onWrapChange: () => void
}) {
    return <div className="netdive-log-tools" role="group" aria-label="로그 표시 도구">
        <div className="netdive-log-tools__search">
            <Input aria-label="로그 내 검색" placeholder="로그 내 검색" prefix={<SearchOutlined />} allowClear value={props.query}
                onChange={event => props.onQueryChange(event.target.value)}
                onPressEnter={event => { if (props.hasMatches) props.onMoveMatch(event.shiftKey ? -1 : 1) }}
                suffix={props.query ? <span className="netdive-log-tools__matches" aria-live="polite">
                    {props.total ? `${props.active + 1}/${props.total.toLocaleString()}` : '0건'}
                </span> : undefined} />
            {props.query && <div className="netdive-log-tools__match-actions">
                <Tooltip title="이전 검색 결과"><Button type="text" aria-label="이전 검색 결과" icon={<UpOutlined />} disabled={!props.hasMatches} onClick={() => props.onMoveMatch(-1)} /></Tooltip>
                <Tooltip title="다음 검색 결과"><Button type="text" aria-label="다음 검색 결과" icon={<DownOutlined />} disabled={!props.hasMatches} onClick={() => props.onMoveMatch(1)} /></Tooltip>
            </div>}
        </div>
        <div className="netdive-log-tools__actions">
            <Checkbox aria-label="자동 줄바꿈" checked={props.wrap} onChange={props.onWrapChange}>줄바꿈</Checkbox>
            {props.logs ? <DetailCopyButton value={props.logs} tooltip="로그 전체 복사" />
                : <Button type="text" disabled aria-label="로그 전체 복사" icon={<CopyOutlined />} />}
        </div>
    </div>
}

export function KubernetesLogRequestStatus(props: { status: string; tone: string; busy: boolean; fetchedAt?: string }) {
    return <Tooltip title={props.fetchedAt ? `마지막 조회 ${new Date(props.fetchedAt).toLocaleString()}` : undefined}>
        <span className={`netdive-log-request-status is-${props.tone}`} role="status">
            {props.busy ? <Spin size="small" /> : props.tone === 'success' ? <CheckCircleOutlined /> : <InfoCircleOutlined />}{props.status}
        </span>
    </Tooltip>
}

export default function KubernetesLogWorkspace(props: {
    expanded: boolean; fluid: boolean; style: React.CSSProperties
    targets: React.ReactNode; queryToolbar: React.ReactNode; displayToolbar: React.ReactNode
    hint?: string; console: React.ReactNode
}) {
    return <section className={`netdive-log-workspace${props.expanded ? ' is-expanded' : ''}${props.fluid ? ' is-fluid' : ''}`}
        style={props.style} aria-label="컨테이너 로그">
        {props.expanded ? <>
            <aside className="netdive-log-workspace__source" aria-label="로그 조회 설정">
                <div className="netdive-log-workspace__heading">조회 대상</div>
                {props.targets}
                <Divider />
                <div className="netdive-log-workspace__heading">조회 옵션</div>
                {props.queryToolbar}
                {props.hint && <p className="netdive-log-workspace__hint">{props.hint}</p>}
            </aside>
            <div className="netdive-log-workspace__analysis">
                {props.displayToolbar}
                {props.console}
            </div>
        </> : <>
            <div className="netdive-log-workspace__source" role="group" aria-label="로그 조회 설정">
                {props.targets}
                {props.hint && <p className="netdive-log-workspace__hint">{props.hint}</p>}
            </div>
            <Divider />
            <div className="netdive-log-workspace__operations">
                {props.queryToolbar}
                {props.displayToolbar}
            </div>
            <Divider />
            {props.console}
        </>}
    </section>
}
