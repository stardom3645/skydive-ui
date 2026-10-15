import * as React from 'react'
import { Alert, Empty, Select, Skeleton } from 'antd'
import type { Node } from '../Topology'
import type { session } from '../Store'
import type { KubernetesLogContainer } from '../KubernetesPodLogs'
import { kubernetesLogCluster, kubernetesPodLogTarget, kubernetesResourceLogPods } from '../KubernetesLogScopes'
import KubernetesPodLogPanel from './KubernetesPodLogPanel'

interface Props { node: Node; nodes: Node[]; session: session; kubernetesClusters?: any[] }

/** One Pod at a time, using the same bounded log reader as Pod details. */
export default function KubernetesResourceLogPanel(props: Props) {
    const cluster = kubernetesLogCluster(props.node, props.kubernetesClusters || [])
    const pods = kubernetesResourceLogPods(props.node, props.nodes)
    const [selectedUID, setSelectedUID] = React.useState('')
    const [detail, setDetail] = React.useState<{ key: string; containers: KubernetesLogContainer[]; error?: boolean }>()
    const targets = pods.map(pod => ({ pod, ...kubernetesPodLogTarget(pod) }))
    const target = targets.find(pod => pod.uid === selectedUID) || targets[0]
    const endpoint = props.session?.endpoint || `${window.location.protocol}//${window.location.host}`
    const requestKey = JSON.stringify([cluster?.id, target?.uid, endpoint, props.session?.token])
    const needsContainers = !!cluster?.id && !!target && !target.containers.length

    // Keep the default selection stable when live inventory inserts a Pod
    // earlier in the sorted list. Only a removed target selects a replacement.
    React.useEffect(() => {
        if (target && target.uid !== selectedUID) setSelectedUID(target.uid)
    }, [target?.uid, selectedUID])

    // Most targets already contain the collected Pod spec. If not, reuse the
    // existing Pod detail API for this selected Pod only; never fetch all Pods.
    React.useEffect(() => {
        if (!needsContainers || !target) return
        const controller = new AbortController()
        let active = true
        const timeout = window.setTimeout(() => controller.abort(), 25000)
        fetch(`${endpoint}/api/mold/kubernetes-clusters/pods/detail?id=${encodeURIComponent(cluster.id)}&uid=${encodeURIComponent(target.uid)}`, {
            signal: controller.signal, cache: 'no-store', headers: props.session?.token ? { 'X-Auth-Token': props.session.token } : undefined
        }).then(response => { if (!response.ok) throw new Error('detail unavailable'); return response.json() }).then(payload => {
            if (payload.uid !== target.uid || payload.clusterId !== cluster.id) throw new Error('detail mismatch')
            if (active) setDetail({ key: requestKey, containers: Array.isArray(payload.containers) ? payload.containers : [] })
        }).catch(() => { if (active) setDetail({ key: requestKey, containers: [], error: true }) })
            .finally(() => window.clearTimeout(timeout))
        return () => { active = false; window.clearTimeout(timeout); controller.abort() }
    }, [requestKey, needsContainers])

    if (!cluster) return <Alert type="info" showIcon title="클러스터 연동을 확인하세요." description="선택한 자원의 Kubernetes API 연결을 찾을 수 없습니다." />
    if (!target) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="이 범위에서 조회할 파드가 없습니다." />
    const multipleNamespaces = new Set(targets.map(pod => pod.namespace)).size > 1
    const containers = target.containers.length ? target.containers : detail?.key === requestKey ? detail.containers : undefined
    return <section className="netdive-k8s-resource-logs" aria-label="소속 파드 로그">
        {String(props.node.data?.Type || '').toLowerCase() === 'node' && <div className="netdive-k8s-pod-logs__hint">이 노드에 배치된 파드의 컨테이너 로그입니다.</div>}
        <div className="netdive-k8s-resource-logs__target">
            <div className="netdive-k8s-resource-logs__label"><label htmlFor="netdive-resource-log-pod">파드</label><span>{targets.length}개</span></div>
            <Select id="netdive-resource-log-pod" aria-label="로그 파드 선택" showSearch optionFilterProp="label"
                value={target.uid} onChange={setSelectedUID} options={targets.map(pod => ({
                    value: pod.uid, label: multipleNamespaces ? `${pod.namespace} / ${pod.name}` : pod.name,
                    title: `${pod.namespace} / ${pod.name}`
                }))} />
        </div>
        {!containers ? <Skeleton active paragraph={{ rows: 3 }} title={false} />
            : detail?.key === requestKey && detail.error && !containers.length ? <Alert type="warning" showIcon title="컨테이너 정보를 조회하지 못했습니다." description="다른 파드를 선택하거나 로그 탭을 다시 열어 주세요." />
                : <KubernetesPodLogPanel key={`${cluster.id}:${target.uid}`} session={props.session} clusterID={cluster.id}
                    uid={target.uid} namespace={target.namespace} name={target.name} containers={containers} />}
    </section>
}
