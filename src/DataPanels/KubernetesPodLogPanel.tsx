import * as React from 'react'
import { Alert, Button, ConfigProvider, Empty, Spin, Tooltip, theme } from 'antd'
import { CodeOutlined, ExpandOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { session } from '../Store'
import {
    fetchKubernetesPodLogs, kubernetesLogContainerChoices, KubernetesLogContainer,
    KubernetesPodLogRequest, kubernetesPodLogRequestKey
} from '../KubernetesPodLogs'
import { kubernetesLogFailure, kubernetesLogLoadReducer, KubernetesLogLoadState, KubernetesLogFailure, kubernetesLogStatus } from '../KubernetesLogViewerState'
import { findLogMatches } from '../KubernetesLogPresentation'
import { DetailSectionCard, HistoryModal } from './common/DetailComponents'
import KubernetesLogText from './KubernetesLogText'
import KubernetesLogWorkspace, { KubernetesLogPodSelection, KubernetesLogTargets, KubernetesLogQueryToolbar, KubernetesLogDisplayToolbar, KubernetesLogRequestStatus } from './KubernetesLogWorkspace'
import './KubernetesPodLogPanel.css'

interface Props {
    session: session; clusterID?: string; uid: string; namespace?: string; name?: string
    containers: KubernetesLogContainer[]; containersLoading?: boolean; containersError?: KubernetesLogFailure; onContainersRetry?: () => void; scopeHint?: string
    podSelection?: KubernetesLogPodSelection
}

export default function KubernetesPodLogPanel(props: Props) {
    const { token } = theme.useToken()
    const targetKey = JSON.stringify([props.clusterID, props.uid])
    const choices = kubernetesLogContainerChoices(props.containers)
    const [selection, setSelection] = React.useState({ targetKey, container: '', previous: false })
    const [tailLines, setTailLines] = React.useState(500)
    const [refresh, setRefresh] = React.useState(0)
    const [expanded, setExpanded] = React.useState(false)
    const [wrap, setWrap] = React.useState(true)
    const [query, setQuery] = React.useState('')
    const [activeMatch, setActiveMatch] = React.useState(0)
    const [state, dispatch] = React.useReducer(kubernetesLogLoadReducer, { key: '', loading: false })
    const consoleRef = React.useRef<HTMLPreElement>(null)
    const id = React.useId()
    const selected = selection.targetKey === targetKey && choices.some(choice => choice.value === selection.container)
        ? selection.container : choices[0]?.value || ''
    const previous = selection.targetKey === targetKey && selection.previous
    const request: KubernetesPodLogRequest = {
        endpoint: props.session?.endpoint || `${window.location.protocol}//${window.location.host}`,
        token: props.session?.token, clusterID: props.clusterID || '', uid: props.uid,
        namespace: props.namespace, name: props.name, container: selected, previous, tailLines
    }
    const key = kubernetesPodLogRequestKey(request)
    const enabled = !!props.clusterID && !!props.uid && !!selected && !props.containersLoading && !props.containersError
    const current: KubernetesLogLoadState = state.key === key && enabled ? state : { key, loading: enabled }
    const failure = props.containersError || current.failure
    const busy = !!props.containersLoading || current.loading
    const hasResult = !!current.result
    const previousUnavailable = failure?.kind === 'previous-unavailable'
    const logs = current.result?.logs || ''
    const search = React.useMemo(() => findLogMatches(logs, query), [logs, query])
    const active = Math.min(activeMatch, Math.max(0, search.matches.length - 1))
    React.useEffect(() => { setActiveMatch(0) }, [query, logs])
    React.useEffect(() => {
        if (query && search.matches.length) consoleRef.current?.querySelector(`[data-log-match="${active}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }, [active, query, logs, expanded])

    React.useEffect(() => {
        if (!enabled) return
        const controller = new AbortController()
        let active = true, timedOut = false
        dispatch({ type: 'start', key })
        const timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 25000)
        fetchKubernetesPodLogs(request, controller.signal).then(result => {
            if (active) dispatch({ type: 'success', key, result })
        }).catch(error => {
            if (active) dispatch({ type: 'failure', key, failure: kubernetesLogFailure(error, previous, timedOut) })
        }).finally(() => window.clearTimeout(timeout))
        return () => { active = false; window.clearTimeout(timeout); controller.abort() }
    }, [key, refresh, enabled])

    const variables = {
        '--log-surface': token.colorBgContainer, '--log-soft': token.colorFillQuaternary, '--log-text': token.colorText,
        '--log-radius': `${token.borderRadius}px`, '--log-selected': token.colorPrimaryBg, '--log-primary': token.colorPrimaryText,
        '--log-muted': token.colorTextSecondary, '--log-border': token.colorBorderSecondary,
        '--log-highlight': token.colorPrimaryBg, '--log-active': token.colorPrimaryBorder,
        '--log-success-text': token.colorSuccessText, '--log-error-text': token.colorErrorText, '--log-font': token.fontFamilyCode
    } as React.CSSProperties
    const moveMatch = (direction: number) => setActiveMatch((active + direction + search.matches.length) % search.matches.length)
    const retry = () => props.containersError ? props.onContainersRetry?.() : setRefresh(value => value + 1)
    const showCurrent = () => setSelection({ targetKey, container: selected, previous: false })
    const status = props.containersLoading ? '컨테이너 확인 중' : kubernetesLogStatus({ ...current, failure }, previous)
    const statusTone = busy ? 'loading' : failure && !previousUnavailable ? 'error' : hasResult && !!logs ? 'success' : 'empty'
    const emptyPrevious = previous && (previousUnavailable || hasResult && !logs)
    const failureNotice = failure && !previousUnavailable && <Alert type="error" showIcon title={failure.title}
        description={<>{failure.description}{hasResult && <div className="netdive-log-console__retained">갱신하지 못했습니다. 마지막 조회 결과를 표시합니다.</div>}</>}
        action={<Button size="small" onClick={retry} icon={<ReloadOutlined />} aria-label="로그 조회 재시도">재시도</Button>} />
    let body: React.ReactNode
    if (!props.clusterID) body = <Alert type="info" showIcon title="클러스터 연동을 확인하세요." description="Kubernetes API 연결을 찾을 수 없어 로그를 조회할 수 없습니다." />
    else if (!props.uid) body = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="이 범위에서 조회할 파드가 없습니다." />
    else if (busy && !hasResult) body = <div className="netdive-log-console__loading" role="status"><Spin /><span>{props.containersLoading ? '컨테이너 정보를 확인하고 있습니다.' : '로그를 불러오고 있습니다.'}</span></div>
    else if (failureNotice && !hasResult) body = failureNotice
    else if (emptyPrevious) body = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><strong>이전 로그가 없습니다.</strong><div>재시작 직전 컨테이너의 로그가 남아 있지 않습니다.</div></>}>
        <Button size="small" onClick={showCurrent}>현재 로그 보기</Button>
    </Empty>
    else if (!choices.length || hasResult && !logs) body = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={!choices.length ? '조회할 컨테이너 정보가 없습니다.' : '컨테이너가 출력한 로그가 없습니다.'} />
    const statusView = <KubernetesLogRequestStatus status={status} tone={statusTone} busy={busy} fetchedAt={current.result?.fetchedAt} />
    const fluid = !!logs || busy && !hasResult
    const consoleView = <div className={`netdive-log-console${body ? ' is-message' : ''}`} aria-label="로그 뷰어">
        {search.total > search.matches.length && <p className="netdive-log-console__notice">검색 결과 중 처음 5,000건을 강조합니다. 검색어를 좁혀 주세요.</p>}
        {current.result?.truncated && <p className="netdive-log-console__notice">로그가 길어 최대 1MiB까지만 표시합니다.</p>}
        {logs && query && !search.total && <div className="netdive-log-console__search-empty" role="status">
            <SearchOutlined />검색 결과가 없습니다. 전체 로그를 표시합니다.
            <Button size="small" type="link" onClick={() => setQuery('')}>검색 지우기</Button>
        </div>}
        {hasResult && failureNotice && <div className="netdive-log-console__notice">{failureNotice}</div>}
        {body ? <div className="netdive-log-console__message" aria-busy={busy}>{body}</div>
            : <pre ref={consoleRef} className={`netdive-log-console__text${wrap ? ' is-wrapped' : ''}`} tabIndex={0}
                aria-label="컨테이너 로그 내용" aria-busy={busy}><KubernetesLogText text={logs} matches={search.matches} active={active} /></pre>}
        {current.result?.fetchedAt && <footer className="netdive-log-console__footer">
            <span title={props.namespace && props.name ? `${props.namespace} / ${props.name}` : undefined}>
                {props.namespace && props.name ? `${props.namespace} / ${props.name}` : '컨테이너 출력'}
            </span>
            <time dateTime={current.result.fetchedAt}>마지막 조회 {new Date(current.result.fetchedAt).toLocaleTimeString()}</time>
        </footer>}
    </div>
    // Shared controls and console; inline and expanded workspaces arrange them differently.
    const workspace = <KubernetesLogWorkspace expanded={expanded} fluid={fluid} style={variables}
        targets={<KubernetesLogTargets id={id} podSelection={props.podSelection} podName={props.name}
            container={selected} choices={choices} loading={props.containersLoading}
            onContainerChange={container => setSelection({ targetKey, container, previous })} />}
        queryToolbar={<KubernetesLogQueryToolbar previous={previous} enabled={enabled} busy={busy} tailLines={tailLines}
            onPreviousChange={previous => setSelection({ targetKey, container: selected, previous })}
            onTailLinesChange={setTailLines} onRefresh={() => setRefresh(value => value + 1)} />}
        displayToolbar={<KubernetesLogDisplayToolbar query={query} total={search.total} active={active}
            hasMatches={!!search.matches.length} logs={logs} wrap={wrap} onQueryChange={setQuery}
            onMoveMatch={moveMatch} onWrapChange={() => setWrap(value => !value)} />}
        hint={previous ? '재시작 직전 컨테이너의 로그입니다.' : props.scopeHint} console={consoleView} />
    return <ConfigProvider componentSize="small" theme={{
        token: { fontSize: 12, fontSizeSM: 12, controlHeightSM: 28, borderRadiusSM: token.borderRadius },
        components: { Select: { fontSize: 12, optionFontSize: 12 } }
    }}><div className="netdive-log-panel" style={variables}>
        <DetailSectionCard className="netdive-log-section" icon={<CodeOutlined />} title="컨테이너 로그"
            action={<div className="netdive-log-header">
                {statusView}
                <Tooltip title="로그 확장 보기"><Button size="small" type="text" aria-label="로그 확장 보기"
                    icon={<ExpandOutlined />} onClick={() => setExpanded(true)}>확장</Button></Tooltip>
            </div>}>
            {expanded ? <p className="netdive-log-panel__placeholder">확장 화면에서 로그를 확인하고 있습니다.</p> : workspace}
        </DetailSectionCard>
        <HistoryModal open={expanded} onCancel={() => setExpanded(false)}
            title={<div className="netdive-log-modal__header"><span><CodeOutlined /> 컨테이너 로그</span>{statusView}</div>}
            centered width="88vw" zIndex={1500} className="netdive-log-modal" style={variables} styles={{
                container: { height: fluid ? '84vh' : undefined, maxHeight: '84vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' },
                header: { flexShrink: 0, margin: 0, padding: '16px 48px 16px 20px', borderBottom: `1px solid ${token.colorBorderSecondary}` },
                body: { flex: 1, minHeight: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
            }}>{expanded && workspace}</HistoryModal>
    </div></ConfigProvider>
}
