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

/** Canonical Service current-state evaluation. Pod relationship counts are
 * deliberately not part of health: selector-less Services can route directly
 * to EndpointSlice addresses without any Pod targetRef. */
export const aggregateKubernetesServiceOperationalStatus = (detail: any): KubernetesServiceOperationalSnapshot => {
    const endpointDataAvailable = detail?.endpointDataAvailable === true
    const endpoints = list(detail?.endpoints)
    const endpointCount = endpointDataAvailable
        ? Number(detail?.endpointCount === undefined ? endpoints.length : detail.endpointCount)
        : undefined
    const readyEndpointCount = endpointDataAvailable
        ? Number(detail?.readyEndpointCount === undefined ? endpoints.filter(endpoint => endpoint?.ready === true).length : detail.readyEndpointCount)
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

    if (externalName) return {
        endpointDataAvailable,
        endpointCount,
        readyEndpointCount,
        currentProblemCount,
        readySummary: endpointDataAvailable ? `${readyEndpointCount || 0}/${endpointCount || 0}` : '해당 없음',
        tone: 'success',
        verdict: '정상',
        impact: '정상 제공 중',
        impactDescription: 'ExternalName 대상이 설정되어 DNS 별칭으로 트래픽을 전달합니다.',
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
        impact: '정상 제공 중',
        impactDescription: `Ready Endpoint ${readyEndpointCount}개가 현재 트래픽을 제공 중입니다.`,
        selectorlessDirectEndpoints
    }
    return {
        endpointDataAvailable,
        endpointCount,
        readyEndpointCount,
        currentProblemCount,
        readySummary: `0/${endpointCount}`,
        tone: 'danger',
        verdict: Number(endpointCount) > 0 ? '위험' : '보완 권장',
        impact: Number(endpointCount) > 0 ? '트래픽 제공 불가' : '제공 대상 없음',
        impactDescription: Number(endpointCount) > 0
            ? '수집된 Endpoint 중 Ready 상태인 대상이 없어 현재 트래픽을 전달할 수 없습니다.'
            : '수집된 Endpoint가 없어 현재 트래픽을 전달할 대상을 확인할 수 없습니다.',
        selectorlessDirectEndpoints
    }
}

