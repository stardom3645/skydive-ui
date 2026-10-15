import * as React from 'react'
import { Alert, Button, Empty, Segmented, Select, Skeleton } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { session } from '../Store'
import {
    fetchKubernetesPodLogs, kubernetesLogContainerChoices, KubernetesLogContainer,
    KubernetesPodLogs, KubernetesPodLogRequest, kubernetesPodLogRequestKey
} from '../KubernetesPodLogs'
import './KubernetesPodLogPanel.css'

interface Props {
    session: session; clusterID?: string; uid: string; namespace?: string; name?: string
    containers: KubernetesLogContainer[]
}
interface LogState { key: string; loading: boolean; result?: KubernetesPodLogs; error?: string }

export default function KubernetesPodLogPanel(props: Props) {
    const choices = kubernetesLogContainerChoices(props.containers)
    const [container, setContainer] = React.useState('')
    const [previous, setPrevious] = React.useState(false)
    const [tailLines, setTailLines] = React.useState(500)
    const [refresh, setRefresh] = React.useState(0)
    const [state, setState] = React.useState<LogState>({ key: '', loading: false })
    const selected = choices.some(choice => choice.value === container) ? container : choices[0]?.value || ''
    const request: KubernetesPodLogRequest = {
        endpoint: props.session?.endpoint || `${window.location.protocol}//${window.location.host}`,
        token: props.session?.token, clusterID: props.clusterID || '', uid: props.uid,
        namespace: props.namespace, name: props.name, container: selected, previous, tailLines
    }
    const key = kubernetesPodLogRequestKey(request)
    const enabled = !!props.clusterID && !!props.uid && !!selected
    const current = state.key === key ? state : { key, loading: enabled }

    React.useEffect(() => {
        if (!enabled) return
        const controller = new AbortController()
        let active = true, timedOut = false
        setState({ key, loading: true })
        const timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 25000)
        fetchKubernetesPodLogs(request, controller.signal).then(result => {
            if (active) setState({ key, loading: false, result })
        }).catch(error => {
            if (active) setState({ key, loading: false, error: timedOut ? '로그 조회 시간이 초과되었습니다. 다시 조회하세요.'
                : error?.name === 'AbortError' ? '로그 조회가 취소되었습니다.'
                    : error instanceof TypeError ? 'Netdive 서버에 연결하지 못했습니다. 연결 상태를 확인하세요.' : error.message })
        }).finally(() => window.clearTimeout(timeout))
        return () => { active = false; window.clearTimeout(timeout); controller.abort() }
    }, [key, refresh, enabled])

    if (!props.clusterID) return <Alert type="info" showIcon title="클러스터 연동을 확인하세요." description="이 파드의 Kubernetes API 연결을 찾을 수 없어 로그를 조회할 수 없습니다." />
    if (!choices.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="조회할 컨테이너 정보가 없습니다." />

    return <section className="netdive-k8s-pod-logs" aria-label="컨테이너 로그">
        <div className="netdive-k8s-pod-logs__container">
            <label htmlFor="netdive-pod-log-container">컨테이너</label>
            <Select id="netdive-pod-log-container" aria-label="로그 컨테이너 선택" value={selected} options={choices}
                onChange={value => { setContainer(value); setPrevious(false) }} />
        </div>
        <div className="netdive-k8s-pod-logs__toolbar">
            <Segmented aria-label="로그 조회 대상" value={previous ? 'previous' : 'current'}
                options={[{ label: '현재 로그', value: 'current' }, { label: '이전 로그', value: 'previous' }]}
                onChange={value => setPrevious(value === 'previous')} />
            <Select aria-label="최근 로그 줄 수" value={tailLines} onChange={setTailLines}
                options={[100, 500, 1000, 2000].map(value => ({ value, label: `최근 ${value.toLocaleString()}줄` }))} />
            <Button aria-label="로그 새로고침" icon={<ReloadOutlined />} loading={current.loading}
                onClick={() => setRefresh(value => value + 1)}>새로고침</Button>
        </div>
        {previous && <div className="netdive-k8s-pod-logs__hint">재시작 직전 컨테이너의 로그를 조회합니다.</div>}
        {current.error ? <Alert type="warning" showIcon title="로그를 조회할 수 없습니다." description={current.error} />
            : current.loading ? <div className="netdive-k8s-pod-logs__loading"><Skeleton active paragraph={{ rows: 5 }} title={false} /></div>
                : current.result && <React.Fragment>
                    <div className="netdive-k8s-pod-logs__meta">
                        <span>{current.result.namespace} / {current.result.name}</span>
                        {current.result.fetchedAt && <time dateTime={current.result.fetchedAt}>조회 {new Date(current.result.fetchedAt).toLocaleTimeString()}</time>}
                    </div>
                    {current.result.truncated && <Alert type="info" showIcon title="로그가 길어 최대 1MiB까지만 표시합니다." />}
                    {current.result.logs ? <pre className="netdive-k8s-pod-logs__content" tabIndex={0} aria-label="컨테이너 로그 내용">{current.result.logs}</pre>
                        : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={previous ? '이전 컨테이너가 출력한 로그가 없습니다.' : '컨테이너가 출력한 로그가 없습니다.'} />}
                </React.Fragment>}
    </section>
}
