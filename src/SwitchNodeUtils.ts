import { parseSwitchIdentity } from './SwitchIdentity'

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

const compactSwitchText = (value: string): string => value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()

const looksLikeSwitchDescription = (value: string): boolean => {
    const normalized = compactSwitchText(value)
    if (!normalized) return true
    return normalized.length > 128 || /(?:copyright|all rights reserved|system description|\b(?:os|software|firmware)\s+version\s*:)/i.test(normalized)
}

const labeledDescriptionValue = (description: string, labels: string[]): string => {
    if (!description) return ''
    const escaped = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    const nextLabel = '(?=\\s+(?:system\\s+(?:name|type|description)|host\\s*name|device\\s+name|switch\\s+name|node\\s+name|manufacturer|vendor|make|model(?:\\s+name|\\s+number)?|product\\s+name|platform|operating\\s+system|network\\s+operating\\s+system|(?:os|software|firmware)\\s+version|version|copyright)\\s*[:=]|$)'
    const match = description.match(new RegExp(`(?:^|[\\r\\n.;])\\s*(?:${escaped})\\s*[:=]\\s*(.+?)${nextLabel}`, 'i'))
    return compactSwitchText(match ? match[1] : '').replace(/[.;,]+$/, '').trim()
}

const modelFromSwitchDescription = (description: string): string => {
    const model = labeledDescriptionValue(description, [
        'system type', 'model', 'model name', 'model number', 'product name', 'platform'
    ])
    return model && !looksLikeSwitchDescription(model) ? model : ''
}

const nameFromSwitchDescription = (description: string): string => {
    const explicitName = labeledDescriptionValue(description, [
        'system name', 'sysname', 'host name', 'hostname', 'device name', 'switch name', 'node name'
    ])
    if (explicitName && !looksLikeSwitchDescription(explicitName)) return explicitName

    // Some devices omit the optional LLDP System Name TLV but include a model
    // identifier in System Description. A concise model is safer than showing
    // the entire vendor/copyright banner as the node name.
    return modelFromSwitchDescription(description)
}

const normalizedManufacturer = (value: string): string => {
    const compact = compactSwitchText(value).replace(/\b(?:incorporated|inc\.?|corporation|corp\.?|ltd\.?|limited|llc)\b.*$/i, '').trim()
    const aliases: Array<[RegExp, string]> = [
        [/\bdell\b/i, 'Dell'],
        [/\bcisco\b/i, 'Cisco'],
        [/\bjuniper\b/i, 'Juniper Networks'],
        [/\barista\b/i, 'Arista Networks'],
        [/\b(?:hewlett[ -]packard|hpe)\b/i, 'HPE'],
        [/\bhuawei\b/i, 'Huawei'],
        [/\bextreme(?: networks)?\b/i, 'Extreme Networks'],
        [/\bnokia\b/i, 'Nokia'],
        [/\b(?:nvidia|mellanox)\b/i, 'NVIDIA'],
        [/\bbrocade\b/i, 'Brocade'],
        [/\bmikrotik\b/i, 'MikroTik'],
        [/\bubiquiti\b/i, 'Ubiquiti'],
        [/\bfortinet\b/i, 'Fortinet']
    ]
    const alias = aliases.find(([pattern]) => pattern.test(compact))
    return alias ? alias[1] : compact
}

export interface SwitchSystemInfo {
    manufacturer: string
    operatingSystem: string
    osVersion: string
    model: string
    description: string
}

export const switchSystemInfo = (data: any): SwitchSystemInfo => {
    const lldp = switchLLDPData(data)
    const identity = parseSwitchIdentity(data)
    const description = switchTextValue(lldp, ['Description', 'SystemDescription', 'SysDescription']) ||
        switchTextValue(data, ['Description', 'SystemDescription', 'SysDescription'])

    let manufacturer = identity.vendor
    if (!manufacturer) {
        manufacturer = switchTextValue(lldp, ['Manufacturer', 'Vendor', 'VendorName', 'Make']) ||
            switchTextValue(data, ['Manufacturer', 'Vendor', 'VendorName', 'Make']) ||
            labeledDescriptionValue(description, ['manufacturer', 'vendor', 'make'])
        if (!manufacturer) {
            const copyrightVendor = description.match(/\bcopyright\b.*?\bby\s+([^.;\r\n]+)/i)
            manufacturer = copyrightVendor ? copyrightVendor[1] : description
        }
        manufacturer = normalizedManufacturer(manufacturer)
    }
    if (manufacturer === compactSwitchText(description)) manufacturer = ''

    let operatingSystem = switchTextValue(lldp, ['OperatingSystem', 'OS', 'SoftwareName']) ||
        switchTextValue(data, ['OperatingSystem', 'OS', 'SoftwareName']) ||
        labeledDescriptionValue(description, ['operating system', 'network operating system', 'system description'])
    if (!operatingSystem) {
        const knownOS = description.match(/\b(OS\s*\d+(?:\s+Enterprise)?|NX-?OS|EOS|Junos(?: OS)?|IOS(?:[ -](?:XE|XR))?|RouterOS|SONiC|Comware|VRP|Cumulus Linux)\b/i)
        operatingSystem = knownOS ? knownOS[1] : ''
    }

    const osVersion = switchTextValue(lldp, ['OSVersion', 'SoftwareVersion', 'FirmwareVersion', 'Version']) ||
        switchTextValue(data, ['OSVersion', 'SoftwareVersion', 'FirmwareVersion']) ||
        labeledDescriptionValue(description, ['os version', 'software version', 'firmware version', 'version'])
    const model = identity.displayModel || switchTextValue(lldp, ['Model', 'ModelName', 'ModelNumber', 'SystemType', 'Platform']) ||
        switchTextValue(data, ['Model', 'ModelName', 'ModelNumber', 'SystemType', 'Platform']) ||
        modelFromSwitchDescription(description)

    return {
        manufacturer: compactSwitchText(manufacturer),
        operatingSystem: compactSwitchText(operatingSystem),
        osVersion: compactSwitchText(osVersion),
        model: compactSwitchText(model),
        description
    }
}

export const switchDisplayName = (data: any, fallback = ''): string => {
    const lldp = switchLLDPData(data)
    const identity = parseSwitchIdentity(data)
    if (identity.displayModel) return identity.displayModel
    const description = switchTextValue(lldp, ['Description', 'SystemDescription', 'SysDescription']) ||
        switchTextValue(data, ['Description', 'SystemDescription', 'SysDescription'])
    const descriptionName = nameFromSwitchDescription(description)
    const explicitCandidates = [
        switchTextValue(lldp, ['SystemName', 'SysName', 'RemoteSystemName', 'RemoteSysName', 'Name']),
        switchTextValue(data, ['SystemName', 'SysName', 'HostName', 'Hostname', 'Name', 'name'])
    ]
    for (const candidate of explicitCandidates) {
        const compact = compactSwitchText(candidate)
        if (compact && !looksLikeSwitchDescription(compact)) {
            return compact
        }
    }

    return descriptionName ||
        compactSwitchText(switchTextValue(lldp, ['ChassisID', 'ChassisId', 'Chassis'])) ||
        compactSwitchText(fallback)
}

export const switchManagementAddress = (data: any): string => {
    const lldp = switchLLDPData(data)
    return switchTextValue(lldp, ['MgmtAddress', 'ManagementAddress', 'MgmtAddr', 'Address']) ||
        switchTextValue(data, ['MgmtAddress', 'ManagementAddress', 'MgtAddr', 'MgtIP', 'IPV4', 'IP'])
}
