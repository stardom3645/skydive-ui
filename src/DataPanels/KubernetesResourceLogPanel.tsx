import * as React from 'react'
import type { Node } from '../Topology'
import type { session } from '../Store'
import { KubernetesPodLogError } from '../KubernetesPodLogs'
import { kubernetesLogFailure, KubernetesLogFailure } from '../KubernetesLogViewerState'
import type { KubernetesLogContainer } from '../KubernetesPodLogs'
import { kubernetesLogCluster, kubernetesPodLogTarget, kubernetesResourceLogPods } from '../KubernetesLogScopes'
import KubernetesPodLogPanel from './KubernetesPodLogPanel'

interface Props { node: Node; nodes: Node[]; session: session; kubernetesClusters?: any[] }

/** One Pod at a time, using the same bounded log reader as Pod details. */
export default function KubernetesResourceLogPanel(props: Props) {
    const cluster = kubernetesLogCluster(props.node, props.kubernetesClusters || [])
    const pods = kubernetesResourceLogPods(props.node, props.nodes)
    const [retry, setRetry] = React.useState(0)
    const [selectedUID, setSelectedUID] = React.useState('')
    const [detail, setDetail] = React.useState<{ key: string; containers: KubernetesLogContainer[]; error?: KubernetesLogFailure }>()
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
        let active = true, timedOut = false
        const timeout = window.setTimeout(() => { timedOut = true; controller.abort() }, 25000)
        fetch(`${endpoint}/api/mold/kubernetes-clusters/pods/detail?id=${encodeURIComponent(cluster.id)}&uid=${encodeURIComponent(target.uid)}`, {
            signal: controller.signal, cache: 'no-store', headers: props.session?.token ? { 'X-Auth-Token': props.session.token } : undefined
        }).then(async response => {
            const payload = await response.json().catch(() => undefined)
            if (!response.ok) throw new KubernetesPodLogError('컨테이너 정보를 조회하지 못했습니다.', response.status, payload?.code)
            return payload
        }).then(payload => {
            if (!payload || payload.uid !== target.uid || payload.clusterId !== cluster.id) throw new Error('선택한 파드와 컨테이너 정보가 일치하지 않습니다. 다시 조회하세요.')
            if (active) setDetail({ key: requestKey, containers: Array.isArray(payload.containers) ? payload.containers : [] })
        }).catch(error => { if (active) setDetail({ key: requestKey, containers: [], error: kubernetesLogFailure(error, false, timedOut) }) })
            .finally(() => window.clearTimeout(timeout))
        return () => { active = false; window.clearTimeout(timeout); controller.abort() }
    }, [requestKey, needsContainers, retry])

    const multipleNamespaces = new Set(targets.map(pod => pod.namespace)).size > 1
    const containers = target?.containers.length ? target.containers : detail?.key === requestKey ? detail.containers : undefined
    return <KubernetesPodLogPanel session={props.session} clusterID={cluster?.id}
        uid={target?.uid || ''} namespace={target?.namespace} name={target?.name} containers={containers || []}
        containersLoading={needsContainers && !containers} containersError={needsContainers && detail?.key === requestKey ? detail.error : undefined}
        onContainersRetry={() => { setDetail(undefined); setRetry(value => value + 1) }}
        scopeHint={String(props.node.data?.Type || '').toLowerCase() === 'node' ? '이 노드에 배치된 파드의 컨테이너 로그입니다.' : undefined}
        podSelection={{ value: target?.uid, onChange: setSelectedUID, options: targets.map(pod => ({
            value: pod.uid, label: multipleNamespaces ? `${pod.namespace} / ${pod.name}` : pod.name,
            title: `${pod.namespace} / ${pod.name}`
        })) }} />
}
