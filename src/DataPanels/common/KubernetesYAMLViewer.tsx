import * as React from 'react'
import { Alert, Button, ConfigProvider, Empty, Input, Spin, Tooltip, theme } from 'antd'
import { CodeOutlined, CopyOutlined, DownOutlined, ExpandOutlined, InfoCircleOutlined, LockOutlined, ReloadOutlined, SafetyOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons'
import { KubernetesResourceYAML, kubernetesYAMLFailure, kubernetesYAMLLoadReducer } from '../../KubernetesResourceYAML'
import { findLogMatches } from '../../KubernetesLogPresentation'
import { DetailCopyButton, DetailSectionCard, HistoryModal } from './DetailComponents'
import { KubernetesLogRequestStatus } from '../KubernetesLogWorkspace'
import KubernetesYAMLText from './KubernetesYAMLText'
import '../KubernetesPodLogPanel.css'
import './KubernetesYAMLViewer.css'

export interface KubernetesYAMLViewerProps {
    active: boolean; requestKey: string; available: boolean; resourceName: string
    load: (signal: AbortSignal) => Promise<KubernetesResourceYAML>
}

/** A read-only resource viewer. Data lives only in this mounted selection:
 * changing tabs/modals never creates a second viewer or a second request. */
export default function KubernetesYAMLViewer(props: KubernetesYAMLViewerProps) {
    const { token } = theme.useToken()
    const [state, dispatch] = React.useReducer(kubernetesYAMLLoadReducer, { key: '', loading: false })
    const [refresh, setRefresh] = React.useState(0)
    const [expanded, setExpanded] = React.useState(false)
    const [query, setQuery] = React.useState('')
    const [activeMatch, setActiveMatch] = React.useState(0)
    const attempt = React.useRef<{ key: string; refresh: number; finished: boolean }>()
    const scroll = React.useRef({ top: 0, left: 0 })
    const viewport = React.useRef<HTMLDivElement | null>(null)
    const key = props.requestKey
    const current = state.key === key ? state : { key, loading: props.active && props.available }
    const yaml = current.result?.yaml || ''
    const search = React.useMemo(() => findLogMatches(yaml, query), [yaml, query])
    const match = Math.min(activeMatch, Math.max(0, search.matches.length - 1))
    const saveScroll = () => { if (viewport.current) scroll.current = { top: viewport.current.scrollTop, left: viewport.current.scrollLeft } }
    const setViewport = React.useCallback((node: HTMLDivElement | null) => {
        viewport.current = node
        if (node) { node.scrollTop = scroll.current.top; node.scrollLeft = scroll.current.left }
    }, [])
    React.useEffect(() => { setActiveMatch(0) }, [query, yaml])
    React.useEffect(() => { if (!props.active) { saveScroll(); setExpanded(false) } }, [props.active])
    React.useEffect(() => {
        if (query && search.matches.length) viewport.current?.querySelector(`[data-yaml-match="${match}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }, [match, query, yaml])
    React.useEffect(() => {
        if (!props.active || !props.available) return
        if (attempt.current?.key === key && attempt.current.refresh === refresh && attempt.current.finished) return
        const controller = new AbortController()
        let active = true, timedOut = false
        attempt.current = { key, refresh, finished: false }
        dispatch({ type: 'start', key })
        const timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 25000)
        props.load(controller.signal).then(result => {
            if (active) { attempt.current = { key, refresh, finished: true }; dispatch({ type: 'success', key, result }) }
        }).catch(error => {
            if (active) { attempt.current = { key, refresh, finished: true }; dispatch({ type: 'failure', key, failure: kubernetesYAMLFailure(error, timedOut) }) }
        }).finally(() => window.clearTimeout(timeout))
        return () => { active = false; controller.abort(); window.clearTimeout(timeout) }
    }, [key, refresh, props.active, props.available, props.load])

    const variables = {
        '--log-surface': token.colorBgContainer, '--log-soft': token.colorFillQuaternary,
        '--log-text': token.colorText, '--log-muted': token.colorTextSecondary, '--log-border': token.colorBorderSecondary,
        '--log-radius': `${token.borderRadius}px`, '--log-font': token.fontFamilyCode,
        '--log-highlight': token.colorPrimaryBg, '--log-active': token.colorPrimaryBorder,
        '--log-success-text': token.colorSuccessText, '--log-error-text': token.colorErrorText,
        '--yaml-scroll-thumb': token.colorFillSecondary, '--yaml-scroll-hover': token.colorFill,
        '--yaml-key': token.colorPrimaryText, '--yaml-string': token.colorSuccessText, '--yaml-number': token.colorWarningText
    } as React.CSSProperties
    const retry = () => setRefresh(value => value + 1)
    const changeExpanded = (value: boolean) => { saveScroll(); setExpanded(value) }
    const move = (direction: number) => setActiveMatch((match + direction + search.matches.length) % search.matches.length)
    const status = <KubernetesLogRequestStatus status={current.loading ? 'YAML 불러오는 중' : current.failure ? '조회 실패' : current.result ? yaml ? '조회 완료' : 'YAML 없음' : '조회 대기'}
        busy={current.loading} tone={current.loading ? 'loading' : current.failure ? 'error' : yaml ? 'success' : 'empty'} fetchedAt={current.result?.fetchedAt} />
    const failure = current.failure && <Alert showIcon type="error" title={current.failure.title} description={<>{current.failure.description}
        {yaml && <div>갱신하지 못했습니다. 마지막 조회 결과를 표시합니다.</div>}</>}
        action={<Button size="small" icon={<ReloadOutlined />} onClick={retry}>재시도</Button>} />
    let message: React.ReactNode
    if (!props.available) message = <Alert showIcon type="info" title="클러스터와 파드 정보를 확인하세요." description="Kubernetes API 연결과 파드 식별 정보가 확인되면 YAML을 조회할 수 있습니다." />
    else if (current.loading && !yaml) message = <div className="netdive-log-console__loading" role="status"><Spin /><span>현재 리소스 YAML을 불러오고 있습니다.</span></div>
    else if (failure && !yaml) message = failure
    else if (!yaml) message = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="표시할 YAML이 없습니다."><Button size="small" onClick={retry}>다시 조회</Button></Empty>
    const workspace = <section className={`netdive-yaml-workspace${expanded ? ' is-expanded' : ''}`} style={variables} aria-label="읽기 전용 YAML 뷰어">
        <div className="netdive-yaml-meta">
            <span><LockOutlined /> 읽기 전용</span>
            <span><SafetyOutlined /> 민감 정보 보호</span>
            <Tooltip title="Kubernetes API에서 조회한 현재 리소스이며, 최초 배포한 YAML과 다를 수 있습니다. 민감할 수 있는 값은 [REDACTED]로 숨기고, managedFields 등 일부 관리 필드는 제외합니다. 편집·적용은 지원하지 않습니다." trigger={['hover', 'focus']} zIndex={1600}>
                <Button type="text" icon={<InfoCircleOutlined />} aria-label="YAML 표시 기준" />
            </Tooltip>
        </div>
        <div className="netdive-log-tools netdive-yaml-tools">
            <div className="netdive-log-tools__search">
                <Input aria-label="YAML 내 검색" placeholder="YAML 내 검색" prefix={<SearchOutlined />} allowClear value={query}
                    onChange={e => setQuery(e.target.value)} onPressEnter={e => search.matches.length && move(e.shiftKey ? -1 : 1)}
                    suffix={query ? <span className="netdive-log-tools__matches" aria-live="polite">{search.total ? `${match + 1}/${search.total.toLocaleString()}` : '0건'}</span> : undefined} />
                {query && <>
                    <Tooltip title="이전 검색 결과"><Button type="text" icon={<UpOutlined />} aria-label="YAML 이전 검색 결과" disabled={!search.matches.length} onClick={() => move(-1)} /></Tooltip>
                    <Tooltip title="다음 검색 결과"><Button type="text" icon={<DownOutlined />} aria-label="YAML 다음 검색 결과" disabled={!search.matches.length} onClick={() => move(1)} /></Tooltip>
                </>}
            </div>
            <div className="netdive-log-tools__actions"><Tooltip title="YAML 새로고침"><Button type="text" icon={<ReloadOutlined />} aria-label="YAML 새로고침" disabled={!props.available} loading={current.loading} onClick={retry} /></Tooltip>
                {yaml ? <DetailCopyButton value={yaml} tooltip="YAML 전체 복사" />
                    : <Button type="text" disabled aria-label="YAML 전체 복사" icon={<CopyOutlined />} />}
            </div>
        </div>
        {yaml && failure && <div className="netdive-log-console__notice">{failure}</div>}
        {query && !search.total && yaml && <div className="netdive-log-console__search-empty" role="status">검색 결과가 없습니다.</div>}
        {search.total > search.matches.length && <p className="netdive-yaml-notice">처음 5,000건을 강조합니다. 검색어를 좁혀 주세요.</p>}
        {message ? <div className="netdive-log-console__message" aria-busy={current.loading}>{message}</div>
            : <div ref={setViewport} className="netdive-yaml-viewport" onScroll={saveScroll} tabIndex={0} aria-label="YAML 내용" aria-busy={current.loading}>
                <KubernetesYAMLText text={yaml} matches={search.matches} active={match} />
            </div>}
        {current.result && <footer className="netdive-log-console__footer netdive-yaml-footer">
            <time dateTime={current.result.fetchedAt}>마지막 조회 {new Date(current.result.fetchedAt).toLocaleTimeString()}</time></footer>}
    </section>
    return <ConfigProvider componentSize="small" theme={{ token: { fontSize: 12, controlHeightSM: 28, borderRadiusSM: token.borderRadius } }}>
        <div className="netdive-log-panel netdive-yaml-panel" style={variables}>
            <DetailSectionCard className="netdive-log-section" title="YAML" icon={<CodeOutlined />}
                action={<div className="netdive-log-header">{status}<Tooltip title="YAML 확장 보기"><Button type="text" icon={<ExpandOutlined />} aria-label="YAML 확장 보기" onClick={() => changeExpanded(true)}>확장</Button></Tooltip></div>}>
                {expanded ? <p className="netdive-log-panel__placeholder">확장 화면에서 YAML을 확인하고 있습니다.</p> : workspace}
            </DetailSectionCard>
            <HistoryModal open={expanded} onCancel={() => changeExpanded(false)} centered width="88vw" zIndex={1500}
                title={<div className="netdive-log-modal__header"><span><CodeOutlined /> YAML</span>{status}</div>}
                className="netdive-log-modal netdive-yaml-modal" style={variables} styles={{
                    container: { height: '84vh', maxHeight: '84vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' },
                    header: { flexShrink: 0, margin: 0, padding: '16px 48px 16px 20px', borderBottom: `1px solid ${token.colorBorderSecondary}` },
                    body: { flex: 1, minHeight: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
                }}>{expanded && workspace}</HistoryModal>
        </div>
    </ConfigProvider>
}
