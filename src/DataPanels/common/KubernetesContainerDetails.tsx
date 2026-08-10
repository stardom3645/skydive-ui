import * as React from 'react'

import { translate } from '../../Config'
import {
    CompactEmptyState,
    DetailLongValue,
    DetailMetaInfoItem,
    DetailMetaInfoRow,
    DetailStatusIndicator
} from './DetailComponents'
import {
    KubernetesResourceConfigurationRows,
    kubernetesSingleContainerResourceCoverage
} from './KubernetesResourceConfigurationCard'

export interface KubernetesContainerRuntimeDetail {
    label: React.ReactNode
    tone?: 'success' | 'warning' | 'danger' | 'default'
    readyLabel?: React.ReactNode
    restartCount?: number
    reason?: React.ReactNode
    exitCode?: React.ReactNode
}

export interface KubernetesContainerDetailItem {
    key: React.Key
    name: string
    kindLabel: React.ReactNode
    image: string
    pullPolicy?: React.ReactNode
    ports?: React.ReactNode[]
    resources: any
    resourcesCollected: boolean
    runtime?: KubernetesContainerRuntimeDetail
}

export interface KubernetesContainerDetailsProps {
    containers: KubernetesContainerDetailItem[]
    summaryItems?: DetailMetaInfoItem[]
    emptyText?: React.ReactNode
}

/** Shared workload/Pod container presentation. Runtime data is optional so the
 * same structure can show PodTemplate configuration and live Pod state. */
export const KubernetesContainerDetails = ({
    containers,
    summaryItems,
    emptyText = translate('kubernetesPodContainersUnavailable')
}: KubernetesContainerDetailsProps) => {
    const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>(containers.length ? [containers[0].key] : [])
    const identity = containers.map(container => String(container.key)).join('\u0001')
    React.useEffect(() => {
        const available = new Set(containers.map(container => container.key))
        setExpandedKeys(keys => keys.filter(key => available.has(key)))
    }, [identity])
    if (!containers.length) return <CompactEmptyState description={emptyText} compact />
    return <React.Fragment>
        {summaryItems && summaryItems.length > 0 && <DetailMetaInfoRow items={summaryItems} />}
        <div className="netdive-k8s-container-details">{containers.map(container => {
            const expanded = expandedKeys.indexOf(container.key) >= 0
            const coverage = kubernetesSingleContainerResourceCoverage(container.resources, container.resourcesCollected)
            const ports = container.ports || []
            return <details
                className="netdive-k8s-container-details__item"
                open={expanded}
                key={container.key}
                onToggle={event => {
                    const open = (event.currentTarget as HTMLDetailsElement).open
                    setExpandedKeys(keys => open
                        ? keys.indexOf(container.key) >= 0 ? keys : keys.concat(container.key)
                        : keys.filter(key => key !== container.key))
                }}>
                <summary>
                    <span>
                        <strong>{container.name}</strong>
                        <small>{container.kindLabel}</small>
                        {container.runtime && <small className="netdive-k8s-container-details__summary-meta">누적 재시작 {container.runtime.restartCount === undefined ? '확인 불가' : `${container.runtime.restartCount}회`}</small>}
                    </span>
                    {container.runtime && <DetailStatusIndicator tone={container.runtime.tone}>{container.runtime.label}</DetailStatusIndicator>}
                    <i />
                </summary>
                <div className="netdive-k8s-container-details__body">
                    <div className="netdive-k8s-container-details__image">
                        <span>{translate('kubernetesContainerImage')}</span>
                        <div><DetailLongValue value={container.image} copy={!!container.image && container.image !== translate('kubernetesImageUnavailable')} copyTooltip={translate('copy')} /></div>
                    </div>
                    <div className="netdive-k8s-container-details__runtime">
                        <div className="netdive-k8s-container-details__row"><span>{translate('kubernetesImagePullPolicy')}</span><b>{container.pullPolicy || '설정되지 않음'}</b></div>
                        <div className="netdive-k8s-container-details__row"><span>{translate('kubernetesContainerPorts')}</span><b className="netdive-k8s-container-details__port-list">{ports.length ? ports.map((port, index) => <span key={index}>{port}</span>) : translate('kubernetesNone')}</b></div>
                        {container.runtime && <React.Fragment>
                            <div className="netdive-k8s-container-details__row"><span>현재 상태</span><DetailStatusIndicator tone={container.runtime.tone}>{container.runtime.label}</DetailStatusIndicator></div>
                            <div className="netdive-k8s-container-details__row"><span>준비 상태</span><b>{container.runtime.readyLabel || '미확인'}</b></div>
                            <div className="netdive-k8s-container-details__row"><span>누적 재시작</span><b>{container.runtime.restartCount === undefined ? '확인 불가' : `${container.runtime.restartCount}회`}</b></div>
                            {container.runtime.reason && <div className="netdive-k8s-container-details__row"><span>상태 사유</span><b>{container.runtime.reason}</b></div>}
                            {container.runtime.exitCode !== undefined && <div className="netdive-k8s-container-details__row"><span>종료 코드</span><b>{container.runtime.exitCode}</b></div>}
                        </React.Fragment>}
                    </div>
                    <div className="netdive-k8s-container-details__subtitle">{translate('kubernetesResourceConfiguration')}</div>
                    <KubernetesResourceConfigurationRows coverage={coverage} mode="single" />
                </div>
            </details>
        })}</div>
    </React.Fragment>
}
