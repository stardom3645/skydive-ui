const isRecord = (value: any): value is Record<string, any> => {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}

const parseRecord = (value: any): Record<string, any> => {
    if (isRecord(value)) return value
    if (Array.isArray(value)) {
        const record = value.find(item => isRecord(item))
        return record || {}
    }
    if (typeof value === 'string') {
        try {
            return parseRecord(JSON.parse(value))
        } catch (error) {
            return {}
        }
    }
    return {}
}

export const switchLLDPData = (data: any): Record<string, any> => {
    return parseRecord(data && (data.LLDP || data.lldp || data.Lldp))
}

export const switchTextValue = (data: any, keys: string[]): string => {
    const source = data || {}
    for (const key of keys) {
        const raw = source[key]
        if (raw === undefined || raw === null) continue
        if (Array.isArray(raw)) {
            const value = raw.map(item => String(item || '').trim()).filter(Boolean).join(', ')
            if (value) return value
            continue
        }
        if (typeof raw === 'object') continue
        const value = String(raw).trim()
        if (value) return value
    }
    return ''
}

export const switchDisplayName = (data: any, fallback = ''): string => {
    const lldp = switchLLDPData(data)
    return switchTextValue(lldp, [
        'Description',
        'SystemDescription',
        'SysDescription',
        'SystemName',
        'SysName',
        'Name'
    ]) || switchTextValue(data, ['Description', 'SystemName', 'SysName', 'Name', 'name']) || fallback
}

export const switchManagementAddress = (data: any): string => {
    const lldp = switchLLDPData(data)
    return switchTextValue(lldp, ['MgmtAddress', 'ManagementAddress', 'MgmtAddr', 'Address']) ||
        switchTextValue(data, ['MgmtAddress', 'ManagementAddress', 'MgtAddr', 'MgtIP', 'IPV4', 'IP'])
}
