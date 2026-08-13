import * as React from 'react'
import { Button } from 'antd'

import { DetailCopyButton, DetailEmpty, DetailKeyValueList, DetailLongValue, DetailStatusIndicator } from './DetailComponents'
import './KubernetesEndpointList.css'

export interface KubernetesEndpointItem {
    address?: string
    ready?: boolean
    targetKind?: string
    targetName?: string
    podName?: string
    nodeName?: string
    ports?: Array<{ name?: string, port?: number, protocol?: string }>
}

export interface KubernetesEndpointListProps {
    endpoints: KubernetesEndpointItem[]
    collected: boolean
    onTargetClick?: (endpoint: KubernetesEndpointItem) => void
    onNodeClick?: (endpoint: KubernetesEndpointItem) => void
    isTargetClickable?: (endpoint: KubernetesEndpointItem) => boolean
    isNodeClickable?: (endpoint: KubernetesEndpointItem) => boolean
}

const portSummary = (ports: KubernetesEndpointItem['ports']): string => {
    if (!Array.isArray(ports) || !ports.length) return '해당 없음'
    return ports.map(port => [port.name, port.port, port.protocol].filter(value => value !== undefined && value !== '').join(' · ')).join(', ')
}

export const KubernetesEndpointList = ({ endpoints, collected, onTargetClick, onNodeClick, isTargetClickable, isNodeClickable }: KubernetesEndpointListProps) => {
    if (!collected) return <DetailEmpty description="Endpoint 데이터가 수집되지 않았습니다." compact />
    if (!endpoints.length) return <DetailEmpty description="연결된 Endpoint가 없습니다." compact />
    return <div className="netdive-k8s-endpoint-list">{endpoints.map((endpoint, index) => {
        const address = String(endpoint.address || '수집되지 않음')
        const targetName = String(endpoint.targetName || endpoint.podName || '')
        const targetKind = String(endpoint.targetKind || (endpoint.podName ? 'Pod' : ''))
        const targetValue = targetName
            ? onTargetClick && (!isTargetClickable || isTargetClickable(endpoint))
                ? <Button type="text" className="netdive-k8s-endpoint-list__link" onClick={() => onTargetClick(endpoint)}><DetailLongValue value={targetName} maxLines={2} /></Button>
                : <DetailLongValue value={targetName} maxLines={2} />
            : '해당 없음'
        const nodeValue = endpoint.nodeName
            ? onNodeClick && (!isNodeClickable || isNodeClickable(endpoint))
                ? <Button type="text" className="netdive-k8s-endpoint-list__link" onClick={() => onNodeClick(endpoint)}><DetailLongValue value={String(endpoint.nodeName)} maxLines={2} /></Button>
                : <DetailLongValue value={String(endpoint.nodeName)} maxLines={2} />
            : '해당 없음'
        return <section className="netdive-k8s-endpoint-list__item" key={`${address}:${targetName}:${index}`}>
            <header>
                <span className="netdive-k8s-endpoint-list__address"><DetailLongValue value={address} maxLines={2} /><DetailCopyButton value={address} tooltip="Endpoint 주소 복사" /></span>
                <DetailStatusIndicator tone={endpoint.ready === true ? 'success' : endpoint.ready === false ? 'danger' : 'default'}>
                    {endpoint.ready === true ? 'Ready' : endpoint.ready === false ? 'Not Ready' : '미확인'}
                </DetailStatusIndicator>
            </header>
            <DetailKeyValueList density="compact" labelWidth={88} rows={[
                { key: 'target', label: '대상', value: targetValue, tooltip: targetName ? undefined : 'targetRef가 없는 직접 Endpoint이므로 연결 대상 객체가 없습니다.' },
                ...(targetName ? [{ key: 'kind', label: '대상 종류', value: targetKind || '해당 없음' }] : []),
                { key: 'node', label: '노드', value: nodeValue, tooltip: endpoint.nodeName ? undefined : 'Endpoint에 nodeName이 설정되지 않았습니다.' },
                { key: 'ports', label: '포트', value: portSummary(endpoint.ports) }
            ]} />
        </section>
    })}</div>
}
