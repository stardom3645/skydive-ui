import type { Node } from './Topology'

const labels: Record<string, string> = {
    nic: 'NIC', bond: '본딩 인터페이스', bridge: '호스트 브리지', vlan: 'VLAN', virtualNIC: '가상 NIC',
    virtualBridge: '가상 브리지', systemVM: '시스템 가상머신', router: '가상 라우터', userVM: '사용자 가상머신', other: '기타 자원'
}

/** Partition the exact children counted by the host badge, never recursively
 * adding guest NICs or mixing Mold inventory counts with topology counts. */
export function topologyHostChildBreakdown(children: Node[]): Array<{ key: string; label: string; count: number }> {
    const counts = new Map<string, number>()
    for (const child of children) {
        const type = String(child.data?.Type || '').toLowerCase(), name = String(child.data?.Name || '')
        const weight = child.getWeight?.()
        let key = 'other'
        if (type === 'libvirt') {
            // Use the same VM roles as Infrastructure host summaries/layers.
            key = weight === 7070 || /^r-/.test(name) ? 'router'
                : weight === 7060 || /^(s-|v-)/.test(name) || /^(ccvm|scvm)[0-9]*$/i.test(name) ? 'systemVM' : 'userVM'
        } else if (['ovsbridge', 'openvswitch'].includes(type) || weight === 7040) key = 'virtualBridge'
        else if (type === 'bridge') key = 'bridge'
        else if (type === 'bond') key = 'bond'
        else if (type === 'vlan') key = 'vlan'
        else if (['tun', 'tap', 'tuntap', 'veth'].includes(type)
            || ['tun', 'tap', 'tuntap', 'veth'].includes(String(child.data?.Driver || '').toLowerCase())) key = 'virtualNIC'
        else if (['device', 'nic', 'interface', 'internal', 'port', 'switchport', 'ovsport'].includes(type)) key = 'nic'
        counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Object.keys(labels).filter(key => counts.has(key)).map(key => ({ key, label: labels[key], count: counts.get(key)! }))
}
