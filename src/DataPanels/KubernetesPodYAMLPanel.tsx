import * as React from 'react'
import { session } from '../Store'
import { fetchKubernetesPodYAML, kubernetesYAMLRequestKey } from '../KubernetesResourceYAML'
import KubernetesYAMLViewer from './common/KubernetesYAMLViewer'

export default function KubernetesPodYAMLPanel(props: {
    session: session; clusterID?: string; uid: string; namespace?: string; name?: string; active: boolean
}) {
    const request = { endpoint: props.session?.endpoint || `${window.location.protocol}//${window.location.host}`,
        token: props.session?.token, clusterID: props.clusterID || '', uid: props.uid, namespace: props.namespace || '', name: props.name || '' }
    const key = kubernetesYAMLRequestKey(request)
    const load = React.useCallback((signal: AbortSignal) => fetchKubernetesPodYAML(request, signal), [key])
    return <KubernetesYAMLViewer key={key} active={props.active} requestKey={key}
        available={!!request.clusterID && !!request.uid && !!request.namespace && !!request.name}
        resourceName={`${request.namespace} / ${request.name}`} load={load} />
}
