import type { Node } from './Topology'
import type { TopologyMetric } from './TopologyNodePresentation'
import type { TopologyResourceSnapshot } from './TopologyResourceData'

export interface TopologySystemVMInformation {
    role: string
    state: TopologyMetric
    purpose: string
    agent: TopologyMetric
    sessions?: number
}

/** Only canonical Mold domain names identify service VMs. Local CCVM/SCVM
 * and user VMs retain their existing resource usage cards. */
export const topologyServiceVMRole = (node: Node, data: any = node.data): string | undefined => {
    if (String(node.data?.Type).toLowerCase() !== 'libvirt'
        || String(node.data?.Manager).toLowerCase() === 'k8s' || node.data?.IsTopologyGroup) return undefined
    const domain = String(data?.InstanceName || data?.instanceName || data?.instancename || node.data?.Name || '').trim()
    if (/^(ccvm|scvm)[0-9]*$/i.test(domain)) return undefined
    if (/^s-\d+-VM$/i.test(domain)) return '보조 스토리지'
    if (/^v-\d+-VM$/i.test(domain)) return '콘솔 프록시'
    if (/^r-\d+-VM$/i.test(domain)) return '가상 라우터'
    return undefined
}

const value = (data: any, keys: string[]) => keys.map(key => data?.[key])
    .find(item => item !== undefined && item !== null && String(item).trim() !== '')

export const topologyServiceVMInformation = (node: Node, data: any, role: string): TopologyMetric[] => {
    const rawState = String(value(node.data, ['State', 'state']) ?? value(data, ['state', 'State']) ?? '')
    const states: Record<string, string> = { up: '실행 중', running: '실행 중', down: '중지', stopped: '중지',
        starting: '시작 중', stopping: '중지 중', migrating: '이동 중', destroyed: '삭제됨', expunging: '삭제 중' }
    const privateIP = String(value(data, ['privateIp', 'PrivateIP', 'privateip', 'privateipaddress']) || '미수집')
    let host = value(data, ['hostName', 'HostName', 'Hostname'])
    // Follow ownership only; never borrow a neighbouring VM's host or IP.
    const seen = new Set<Node>()
    for (let parent = node.parent; !host && parent && !seen.has(parent); parent = parent.parent) {
        seen.add(parent)
        if (String(parent.data?.Type).toLowerCase() === 'host') host = parent.data?.Name
    }
    return [
        { key: 'service-role', label: '역할', value: role },
        { key: 'service-state', label: '실행 상태', value: states[rawState.toLowerCase()] || rawState || '미확인',
            description: '가상머신의 운영 상태이며 이상 판정과는 별개입니다.' },
        { key: 'service-ip', label: role === '가상 라우터' && /^169\.254\./.test(privateIP) ? '제어 IP' : '사설 IP', value: privateIP },
        { key: 'service-host', label: '호스트', value: String(host || '미수집') }
    ]
}

/** Service cards describe operation, independently of utilization and health.
 * Only a real console session count is shown; absent values are never zero. */
export const topologySystemVMInformation = (node: Node, data: any, role: string,
    snapshot: TopologyResourceSnapshot = {}): TopologySystemVMInformation => {
    const service = snapshot.service || data
    const type = String(value(service, ['systemVmType', 'systemvmtype']) || '').toLowerCase()
    const console = type ? type === 'consoleproxy' : role === '콘솔 프록시'
    const agentState = String(value(service, ['agentState', 'agentstate', 'AgentState']) || '')
    const agentStates = { up: '연결됨', connected: '연결됨', down: '연결 끊김', disconnected: '연결 끊김',
        connecting: '연결 중', alert: '확인 필요', removed: '등록 해제' }
    const rawSessions = value(service, ['activeViewerSessions', 'activeviewersessions'])
    const sessions = rawSessions !== undefined && typeof rawSessions !== 'boolean' && String(rawSessions).trim() !== ''
        ? Number(rawSessions) : NaN
    return { role: `${console ? '콘솔 프록시' : '보조 스토리지'} VM`,
        purpose: console ? '브라우저와 VM 콘솔 연결 중계' : '템플릿·ISO 전송 및 스냅샷 백업',
        state: topologyServiceVMInformation(node, data, role)[1],
        agent: { key: 'service-agent', label: '에이전트 연결', value: agentStates[agentState.toLowerCase()] || (agentState ? '알 수 없음' : '미수집'),
            description: `Mold가 보고한 에이전트 상태${agentState ? `: ${agentState}` : '가 없습니다.'} · 연결 여부가 서비스 작업의 성공을 뜻하지는 않습니다.` },
        sessions: console && Number.isSafeInteger(sessions) && sessions >= 0 ? sessions : undefined }
}
