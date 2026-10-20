export type KubernetesServiceTone = 'success' | 'warning' | 'danger' | 'default'

export interface KubernetesServiceOperationalSnapshot {
    endpointDataAvailable: boolean
    endpointCount?: number
    readyEndpointCount?: number
    currentProblemCount?: number
    readySummary: string
    tone: KubernetesServiceTone
    verdict: string
    impact: string
    impactDescription: string
    selectorlessDirectEndpoints: boolean
}

const list = (value: any): any[] => Array.isArray(value) ? value : []
const hasSelector = (value: any): boolean => !!value && typeof value === 'object' && Object.keys(value).length > 0

export const kubernetesEndpointReady = (ready: boolean | null | undefined): boolean => ready !== false

export const kubernetesLogicalEndpoints = (items: any[]): any[] => {
    const targets = new Map<string, any>()
    items.forEach((item, index) => {
        const uid = item.targetUid || item.podUid
        const key = uid ? `uid:${uid}` : item.address ? `address:${item.address}` : `unknown:${index}`
        const previous = targets.get(key)
        targets.set(key, previous ? { ...previous,
            ready: kubernetesEndpointReady(previous.ready) && kubernetesEndpointReady(item.ready),
            nodeName: previous.nodeName === item.nodeName ? previous.nodeName : undefined
        } : { ...item })
    })
    return Array.from(targets.values())
}

/** Canonical Service current-state evaluation. Pod relationship counts are
 * deliberately not part of health: selector-less Services can route directly
 * to EndpointSlice addresses without any Pod targetRef. */
export const aggregateKubernetesServiceOperationalStatus = (detail: any): KubernetesServiceOperationalSnapshot => {
    const endpointDataAvailable = detail?.endpointDataAvailable === true
    const endpoints = kubernetesLogicalEndpoints(list(detail?.endpoints))
    const endpointCount = endpointDataAvailable
        ? Number(detail?.endpointCount === undefined ? endpoints.length : detail.endpointCount)
        : undefined
    const readyEndpointCount = endpointDataAvailable
        ? Number(detail?.readyEndpointCount === undefined ? endpoints.filter(endpoint => kubernetesEndpointReady(endpoint?.ready)).length : detail.readyEndpointCount)
        : undefined
    const externalName = String(detail?.type || '').toLowerCase() === 'externalname'
    const selectorlessDirectEndpoints = endpointDataAvailable && !hasSelector(detail?.selector)
        && endpoints.some(endpoint => !endpoint?.targetKind && !endpoint?.targetName && !endpoint?.podName)
    const notReady = endpointDataAvailable
        ? Number(detail?.notReadyEndpointCount === undefined ? Math.max(0, Number(endpointCount) - Number(readyEndpointCount)) : detail.notReadyEndpointCount)
        : undefined
    const currentProblemCount = externalName
        ? 0
        : endpointDataAvailable
            ? Number(endpointCount) === 0 ? 1 : Number(notReady || 0)
            : undefined

    if (externalName && detail?.collectionState !== 'unavailable') return {
        endpointDataAvailable,
        endpointCount,
        readyEndpointCount,
        currentProblemCount,
        readySummary: endpointDataAvailable ? `${readyEndpointCount || 0}/${endpointCount || 0}` : '해당 없음',
        tone: 'success',
        verdict: '정상',
        impact: 'DNS 별칭 설정됨',
        impactDescription: 'ExternalName DNS 별칭 설정입니다. 외부 대상의 가용성과 실제 통신 성공은 확인하지 않았습니다.',
        selectorlessDirectEndpoints
    }
    if (!endpointDataAvailable) return {
        endpointDataAvailable,
        readySummary: '수집되지 않음',
        tone: 'default',
        verdict: '확인 불가',
        impact: '확인 불가',
        impactDescription: 'Endpoint 또는 EndpointSlice 데이터를 수집하지 못해 현재 트래픽 제공 상태를 확인할 수 없습니다.',
        selectorlessDirectEndpoints
    }
    if (Number(readyEndpointCount) > 0) return {
        endpointDataAvailable,
        endpointCount,
        readyEndpointCount,
        currentProblemCount,
        readySummary: `${readyEndpointCount}/${endpointCount}`,
        tone: Number(notReady || 0) > 0 ? 'warning' : 'success',
        verdict: Number(notReady || 0) > 0 ? '보완 권장' : '정상',
        impact: 'Ready 대상 확인',
        impactDescription: `Ready Endpoint ${readyEndpointCount}개가 확인되었습니다. 실제 애플리케이션 통신 성공을 의미하지 않습니다.`,
        selectorlessDirectEndpoints
    }
    return {
        endpointDataAvailable,
        endpointCount,
        readyEndpointCount,
        currentProblemCount,
        readySummary: `0/${endpointCount}`,
        tone: Number(endpointCount) > 0 ? 'danger' : 'warning',
        verdict: Number(endpointCount) > 0 ? '위험' : '보완 권장',
        impact: Number(endpointCount) > 0 ? '트래픽 제공 불가' : '제공 대상 없음',
        impactDescription: Number(endpointCount) > 0
            ? '수집된 Endpoint 중 Ready 상태인 대상이 없어 현재 트래픽을 전달할 수 없습니다.'
            : '수집된 Endpoint가 없어 현재 트래픽을 전달할 대상을 확인할 수 없습니다.',
        selectorlessDirectEndpoints
    }
}

