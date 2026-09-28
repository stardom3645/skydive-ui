export type SwitchIdentitySource =
    'entity-model' |
    'explicit-model' |
    'entity-description' |
    'snmp-description' |
    'lldp-description' |
    'fallback' |
    ''

export interface RawSwitchIdentity {
    lldpSysName: string
    lldpSysDescr: string
    snmpSysName: string
    snmpSysDescr: string
    snmpSysObjectID: string
    entPhysicalModelName: string
    entPhysicalDescr: string
    explicitVendor: string
    explicitModel: string
}

export interface ParsedSwitchIdentity {
    vendor: string
    rawModel: string
    displayModel: string
    family: string
    source: SwitchIdentitySource
    raw: RawSwitchIdentity
}

interface VendorRule {
    vendor: string
    aliases: RegExp
    oidEnterprises?: string[]
    patterns: RegExp[]
    uniqueModelPrefix?: RegExp
    normalize?: (model: string) => string
    family?: (model: string) => string
}

const isRecord = (value: any): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value)

const parseRecord = (value: any): Record<string, any> => {
    if (isRecord(value)) return value
    if (Array.isArray(value)) return value.find(item => isRecord(item)) || {}
    if (typeof value === 'string') {
        try { return parseRecord(JSON.parse(value)) } catch (error) { return {} }
    }
    return {}
}

const compact = (value: any): string => String(value === undefined || value === null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const textValue = (source: any, keys: string[]): string => {
    const record = source || {}
    for (const key of keys) {
        const value = record[key]
        if (Array.isArray(value)) {
            const joined = value.map(compact).filter(Boolean).join(', ')
            if (joined) return joined
        } else if (!isRecord(value)) {
            const text = compact(value)
            if (text) return text
        }
    }
    return ''
}

const nestedRecord = (data: any, keys: string[]): Record<string, any> => {
    for (const key of keys) {
        const parsed = parseRecord(data && data[key])
        if (Object.keys(parsed).length) return parsed
    }
    return {}
}

const recursiveTextValue = (source: any, keys: string[], depth = 0): string => {
    if (!source || depth > 4) return ''
    if (Array.isArray(source)) {
        for (const item of source) {
            const found = recursiveTextValue(item, keys, depth + 1)
            if (found) return found
        }
        return ''
    }
    const record = parseRecord(source)
    const direct = textValue(record, keys)
    if (direct) return direct
    for (const value of Object.keys(record).map(key => record[key])) {
        if (isRecord(value) || Array.isArray(value)) {
            const found = recursiveTextValue(value, keys, depth + 1)
            if (found) return found
        }
    }
    return ''
}

const collectRecords = (source: any, depth = 0): Array<Record<string, any>> => {
    if (!source || depth > 6) return []
    if (typeof source === 'string') {
        try { return collectRecords(JSON.parse(source), depth + 1) } catch (error) { return [] }
    }
    if (Array.isArray(source)) {
        return source.reduce<Array<Record<string, any>>>((records, item) => records.concat(collectRecords(item, depth + 1)), [])
    }
    if (!isRecord(source)) return []
    return [source, ...Object.keys(source).reduce<Array<Record<string, any>>>((records, key) => {
        const value = source[key]
        return isRecord(value) || Array.isArray(value) ? records.concat(collectRecords(value, depth + 1)) : records
    }, [])]
}

const entityMIBValue = (source: Record<string, any>): any => {
    for (const key of ['ENTITY-MIB', 'EntityMIB', 'Entity', 'entityMIB', 'entity']) {
        if (source[key] !== undefined && source[key] !== null) return source[key]
    }
    return undefined
}

const chassisEntityRecord = (sources: any[]): Record<string, any> | undefined => {
    const records = sources.reduce<Array<Record<string, any>>>((all, source) => all.concat(collectRecords(source)), [])
    return records.find(record => {
        const entityClass = textValue(record, ['entPhysicalClass', 'EntPhysicalClass', 'PhysicalClass']).toLowerCase()
        return entityClass === '3' || entityClass === 'chassis' || entityClass.endsWith('(3)')
    })
}

const cleanModel = (value: string): string => compact(value)
    .replace(/^[\s"'([{]+|[\s"'\])},;:.]+$/g, '')
    .replace(/^(?:model|product|platform|system\s+type|part\s+number)\s*[:=]\s*/i, '')
    .trim()

const safeModelToken = (value: string): boolean => {
    const model = cleanModel(value)
    if (model.length < 3 || model.length > 80 || /\s/.test(model)) return false
    if (!/[a-z]/i.test(model) || !/\d/.test(model)) return false
    if (/^(?:v(?:ersion)?[-_. ]?)?\d+(?:\.\d+){1,4}$/i.test(model)) return false
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(model) || /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(model)) return false
    return !/^(?:x86|x86_64|amd64|arm64|802\.\d+)$/i.test(model)
}

const seriesFamily = (prefix: string, model: string): string => {
    const match = model.match(/^(?:AT-)?([A-Z]+\d{2,5}|[A-Z]+\d{1,3}[A-Z]|\d{4}[A-Z]?)/i)
    return match ? `${prefix} ${match[1].toUpperCase()} Series` : prefix
}

const ubiquitiCase = (model: string): string => model.toUpperCase()
    .replace(/^USW-/, 'USW-')
    .replace(/-PRO-/g, '-Pro-')
    .replace(/-MAX-/g, '-Max-')
    .replace(/-ENTERPRISE-/g, '-Enterprise-')
    .replace(/-LITE-/g, '-Lite-')
    .replace(/-FLEX(?=-|$)/g, '-Flex')
    .replace(/-MINI(?=-|$)/g, '-Mini')
    .replace(/-AGGREGATION(?=-|$)/g, '-Aggregation')
    .replace(/-POE\b/g, '-PoE')

const VENDOR_RULES: VendorRule[] = [
    {
        vendor: 'Cisco', aliases: /\b(?:cisco|catalyst|nexus)\b/i, oidEnterprises: ['9'],
        patterns: [
            /\b((?:N[3579]K-)?C\d{4,5}[A-Z0-9]*(?:-[A-Z0-9+.]+)+)\b/i,
            /\b((?:N[3579]K-)?C\d{4,5}[A-Z0-9]*)\b/i,
            /\b(WS-C\d{4}[A-Z0-9]*(?:-[A-Z0-9+.]+)*)\b/i,
            /\b((?:CBS|SG|MS)\d{3,4}(?:-[A-Z0-9+.]+)+)\b/i
        ],
        uniqueModelPrefix: /^(?:N[3579]K-C|C9[2-6]\d{2}|WS-C|CBS\d)/i,
        normalize: model => model.toUpperCase(),
        family: model => model.includes('N9K') ? 'Nexus 9000 Series' : model.startsWith('C9') ? `Catalyst ${model.slice(1, 5)} Series` : seriesFamily('Cisco', model)
    },
    {
        vendor: 'HPE Aruba Networking', aliases: /\b(?:aruba|hewlett[ -]packard|hpe|procurve)\b/i, oidEnterprises: ['11', '47196'],
        patterns: [
            /\b((?:JL\d{3}[A-Z]|[RS][0-9A-Z]{5}))\b/i,
            /\b((?:ARUBA\s+)?(?:CX\s+)?\d{4}[A-Z]?(?:-[A-Z0-9+.]+)*)(?=$|[\s,;.)])/i,
            /\b(J\d{4}[A-Z])\b/i
        ],
        normalize: model => model.replace(/^(?:ARUBA\s+)?(?:CX\s+)?/i, '').toUpperCase(),
        family: model => seriesFamily('Aruba CX', model)
    },
    {
        vendor: 'Juniper Networks', aliases: /\b(?:juniper|junos)\b/i, oidEnterprises: ['2636'],
        patterns: [/\b((?:EX|QFX)\d{4,5}(?:-[A-Z0-9+.]+)*)\b/i],
        uniqueModelPrefix: /^(?:EX|QFX)\d{4}/i, normalize: model => model.toUpperCase(),
        family: model => seriesFamily(model.startsWith('QFX') ? 'Juniper QFX' : 'Juniper EX', model)
    },
    {
        vendor: 'Dell Technologies', aliases: /\b(?:dell|force10|powerswitch|smartfabric)\b/i, oidEnterprises: ['674', '6027'],
        patterns: [/\b((?:S|Z)\d{4,5}[A-Z0-9]*(?:-[A-Z0-9+.]+)*(?:-ON)?)\b/i, /\b(N\d{4}[A-Z0-9-]*)\b/i],
        normalize: model => model.toUpperCase(), family: model => seriesFamily('Dell PowerSwitch', model)
    },
    {
        vendor: 'Arista Networks', aliases: /\b(?:arista|eos)\b/i, oidEnterprises: ['30065'],
        patterns: [/\b((?:DCS-)?\d{3,4}[A-Z0-9]*(?:-[A-Z0-9+.]+)+)\b/i, /\b(DCS-\d{3,4}[A-Z0-9]+)\b/i],
        uniqueModelPrefix: /^DCS-/i, normalize: model => model.replace(/^DCS-/i, '').toUpperCase(),
        family: model => seriesFamily('Arista', model)
    },
    {
        vendor: 'Extreme Networks', aliases: /\b(?:extreme networks|extremexos|switch engine|voss)\b/i, oidEnterprises: ['1916'],
        patterns: [/\b((?:X\d{3,4}|\d{4}[A-Z]?)(?:-[A-Z0-9+.]+)+)\b/i],
        normalize: model => model.toUpperCase(), family: model => seriesFamily('ExtremeSwitching', model)
    },
    {
        vendor: 'NVIDIA', aliases: /\b(?:nvidia|mellanox|mlnx|onyx|spectrum)\b/i, oidEnterprises: ['33049'],
        patterns: [/\b((?:M?SN|QM|MQM|CS)\d{4,5}[A-Z0-9]*(?:-[A-Z0-9+.]+)*)\b/i],
        uniqueModelPrefix: /^(?:M?SN|MQM)\d{4}/i,
        normalize: model => model.toUpperCase().replace(/^MSN(\d{4,5})(?:-[A-Z0-9+.]+)*$/, 'SN$1'),
        family: model => /^SN\d/.test(model) ? `NVIDIA Spectrum ${model.slice(0, 3)}00 Series` : seriesFamily('NVIDIA', model)
    },
    {
        vendor: 'Huawei', aliases: /\b(?:huawei|cloudengine|versatile routing platform|\bvrp\b)\b/i, oidEnterprises: ['2011'],
        patterns: [/\b((?:CE)?S\d{4,5}[A-Z]*(?:-[A-Z0-9+.]+)+)\b/i, /\b(CE\d{4,5}[A-Z0-9-]*)\b/i],
        normalize: model => model.toUpperCase(), family: model => seriesFamily('Huawei CloudEngine', model)
    },
    {
        vendor: 'H3C', aliases: /\b(?:h3c|comware)\b/i, oidEnterprises: ['25506'],
        patterns: [/\b(S\d{4,5}[A-Z]*(?:-[A-Z0-9+.]+)+)\b/i],
        normalize: model => model.toUpperCase(), family: model => seriesFamily('H3C', model)
    },
    {
        vendor: 'CommScope', aliases: /\b(?:commscope|ruckus|brocade|foundry|fastiron)\b/i, oidEnterprises: ['1991'],
        patterns: [/\b(ICX\d{4}(?:-[A-Z0-9+.]+)*)\b/i], uniqueModelPrefix: /^ICX\d{4}/i,
        normalize: model => model.toUpperCase(), family: model => seriesFamily('RUCKUS ICX', model)
    },
    {
        vendor: 'Ubiquiti', aliases: /\b(?:ubiquiti|unifi|edgeos|edgeswitch)\b/i, oidEnterprises: ['41112'],
        patterns: [/\b((?:USW|ES|ECS)-[A-Z0-9]+(?:-[A-Z0-9]+)*)\b/i], uniqueModelPrefix: /^USW-/i,
        normalize: ubiquitiCase, family: model => model.startsWith('USW-') ? 'UniFi Switch' : 'Ubiquiti EdgeSwitch'
    },
    {
        vendor: 'MikroTik', aliases: /\b(?:mikrotik|routeros|switchos|swos)\b/i, oidEnterprises: ['14988'],
        patterns: [/\b((?:CRS|CSS)\d{3,4}(?:-[A-Z0-9+]+)+)\b/i], uniqueModelPrefix: /^(?:CRS|CSS)\d/i,
        normalize: model => model.toUpperCase(), family: model => model.startsWith('CRS') ? 'MikroTik CRS Series' : 'MikroTik CSS Series'
    },
    {
        vendor: 'NETGEAR', aliases: /\bnetgear\b/i, oidEnterprises: ['4526'],
        patterns: [/\b(M4[235]\d{2}(?:-[A-Z0-9+.]+)+)(?=$|[\s,;.)])/i, /\b((?:GSM|XSM|MSM|VSM)\d{4}[A-Z]*)\b/i],
        normalize: model => model.toUpperCase().replace(/-POE(\+\+|\+)?$/, '-PoE$1'), family: model => seriesFamily('NETGEAR', model)
    },
    {
        vendor: 'TP-Link Omada', aliases: /\b(?:tp-?link|omada)\b/i, oidEnterprises: ['11863'],
        patterns: [/\b((?:TL-)?S[GX]\d{4}[A-Z]*(?:-[A-Z0-9+.]+)*)\b/i],
        normalize: model => model.toUpperCase(), family: model => seriesFamily('Omada', model)
    },
    {
        vendor: 'D-Link', aliases: /\bd-?link\b/i, oidEnterprises: ['171'],
        patterns: [/\b((?:DGS|DXS|DMS|DES|DIS|DSS)-\d{4}(?:-[A-Z0-9+.]+)*)\b/i], uniqueModelPrefix: /^(?:DGS|DXS|DMS)-/i,
        normalize: model => model.toUpperCase(), family: model => seriesFamily('D-Link', model)
    },
    {
        vendor: 'FS', aliases: /(?:^|\s)(?:fs\.com|fiberstore|fs)(?:\s|$)/i, oidEnterprises: ['52642'],
        patterns: [/\b((?:S|N)\d{4,5}[A-Z]*(?:-[A-Z0-9+.]+)+)\b/i],
        normalize: model => model.toUpperCase(), family: model => seriesFamily('FS', model)
    },
    {
        vendor: 'Edgecore Networks', aliases: /\b(?:edgecore|edge-core|accton)\b/i, oidEnterprises: ['259'],
        patterns: [/\b((?:ECS|AS)\d{4}(?:-[A-Z0-9+.]+)*)\b/i], uniqueModelPrefix: /^ECS\d{4}-/i,
        normalize: model => model.toUpperCase(), family: model => seriesFamily('Edgecore', model)
    },
    {
        vendor: 'Allied Telesis', aliases: /\ballied telesis\b/i, oidEnterprises: ['207'],
        patterns: [/\b((?:AT-)?X\d{3,4}[A-Z0-9]*(?:-[A-Z0-9+.]+)*)\b/i],
        normalize: model => model.replace(/^AT-/i, '').toUpperCase(), family: model => seriesFamily('Allied Telesis', model)
    },
    {
        vendor: 'Alcatel-Lucent Enterprise', aliases: /\b(?:alcatel-lucent enterprise|alcatel|omniswitch|ale)\b/i, oidEnterprises: ['6486'],
        patterns: [/\b(OS\d{4}[A-Z]*(?:-[A-Z0-9+.]+)*)\b/i], uniqueModelPrefix: /^OS(?:63|64|65|68|69|99)\d{2}/i,
        normalize: model => model.toUpperCase(), family: model => seriesFamily('ALE OmniSwitch', model)
    },
    {
        vendor: 'Zyxel Networks', aliases: /\bzyxel\b/i, oidEnterprises: ['890'],
        patterns: [/\b((?:XGS|XS|XMG|GS|CX)\d{4}(?:-[A-Z0-9+.]+)*)\b/i],
        normalize: model => model.toUpperCase(), family: model => seriesFamily('Zyxel', model)
    }
]

const enterpriseFromOID = (oid: string): string => {
    const match = oid.match(/(?:^|\.)1\.3\.6\.1\.4\.1\.(\d+)(?:\.|$)/)
    return match ? match[1] : ''
}

const detectVendor = (texts: string[], sysObjectID: string): VendorRule | undefined => {
    const explicitText = texts.filter(Boolean).join(' ')
    const aliasMatch = VENDOR_RULES.find(rule => rule.aliases.test(explicitText))
    if (aliasMatch) return aliasMatch
    const enterprise = enterpriseFromOID(sysObjectID)
    if (enterprise) {
        const oidMatch = VENDOR_RULES.find(rule => (rule.oidEnterprises || []).includes(enterprise))
        if (oidMatch) return oidMatch
    }
    for (const text of texts) {
        const token = cleanModel(text)
        const uniqueMatch = VENDOR_RULES.find(rule => rule.uniqueModelPrefix && rule.uniqueModelPrefix.test(token))
        if (uniqueMatch) return uniqueMatch
    }
    return undefined
}

const extractLabeledModel = (text: string): string => {
    const match = text.match(/(?:^|[\r\n;,])\s*(?:model(?:\s+(?:name|number))?|product(?:\s+name)?|platform|system\s+type|part\s+number)\s*[:=]\s*([^\r\n;,]+)/i)
    return cleanModel(match ? match[1] : '')
}

const safeVendorModelToken = (rule: VendorRule, model: string): boolean => safeModelToken(model) ||
    (rule.vendor === 'HPE Aruba Networking' && /^\d{4}$/.test(model)) ||
    (rule.vendor === 'Ubiquiti' && /^USW-[A-Z][A-Z0-9-]+$/i.test(model))

const matchVendorModel = (rule: VendorRule, texts: string[]): { raw: string, normalized: string } | undefined => {
    for (const text of texts) {
        const whole = cleanModel(text)
        const vendorSafeWhole = safeVendorModelToken(rule, whole)
        if (vendorSafeWhole && !/\s/.test(whole) && rule.patterns.some(pattern => pattern.test(whole))) {
            return { raw: whole, normalized: rule.normalize ? rule.normalize(whole) : whole }
        }
        for (const pattern of rule.patterns) {
            const match = text.match(pattern)
            const raw = cleanModel(match ? (match[1] || match[0]) : '')
            if (!safeVendorModelToken(rule, raw)) continue
            return { raw, normalized: rule.normalize ? rule.normalize(raw) : raw }
        }
    }
    return undefined
}

export const collectRawSwitchIdentity = (data: any): RawSwitchIdentity => {
    const root = parseRecord(data)
    const lldp = nestedRecord(root, ['LLDP', 'lldp', 'Lldp'])
    const snmp = nestedRecord(root, ['SNMP', 'Snmp', 'snmp'])
    const entitySources = [entityMIBValue(root), entityMIBValue(snmp)].filter(value => value !== undefined)
    const chassis = chassisEntityRecord(entitySources)
    const entPhysicalModelName = recursiveTextValue(chassis, ['entPhysicalModelName', 'EntPhysicalModelName', 'PhysicalModelName']) ||
        entitySources.map(source => recursiveTextValue(source, ['entPhysicalModelName', 'EntPhysicalModelName', 'PhysicalModelName'])).find(Boolean) ||
        recursiveTextValue(snmp, ['entPhysicalModelName', 'EntPhysicalModelName', 'PhysicalModelName']) ||
        textValue(root, ['entPhysicalModelName', 'EntPhysicalModelName'])
    const entPhysicalDescr = recursiveTextValue(chassis, ['entPhysicalDescr', 'EntPhysicalDescr', 'PhysicalDescription']) ||
        entitySources.map(source => recursiveTextValue(source, ['entPhysicalDescr', 'EntPhysicalDescr', 'PhysicalDescription'])).find(Boolean) ||
        recursiveTextValue(snmp, ['entPhysicalDescr', 'EntPhysicalDescr', 'PhysicalDescription']) ||
        textValue(root, ['entPhysicalDescr', 'EntPhysicalDescr'])

    return {
        lldpSysName: textValue(lldp, ['SysName', 'SystemName']),
        lldpSysDescr: textValue(lldp, ['Description', 'SysDescription', 'SystemDescription']),
        snmpSysName: textValue(snmp, ['sysName', 'SysName', 'SystemName']) || textValue(root, ['sysName']),
        snmpSysDescr: textValue(snmp, ['sysDescr', 'SysDescr', 'SystemDescription']) || textValue(root, ['sysDescr']),
        snmpSysObjectID: textValue(snmp, ['sysObjectID', 'SysObjectID', 'SystemObjectID']) || textValue(root, ['sysObjectID']),
        entPhysicalModelName,
        entPhysicalDescr,
        explicitVendor: textValue(root, ['Manufacturer', 'Vendor', 'VendorName', 'Make']) || textValue(snmp, ['Manufacturer', 'Vendor', 'VendorName']),
        explicitModel: textValue(root, ['Model', 'ModelName', 'ModelNumber', 'SystemType', 'Platform']) || textValue(snmp, ['Model', 'ModelName', 'ModelNumber', 'SystemType', 'Platform'])
    }
}

export const parseSwitchIdentity = (data: any): ParsedSwitchIdentity => {
    const raw = collectRawSwitchIdentity(data)
    const structuredCandidates: Array<{ value: string, source: SwitchIdentitySource }> = [
        { value: raw.entPhysicalModelName, source: 'entity-model' },
        { value: raw.explicitModel, source: 'explicit-model' }
    ]
    const descriptionCandidates: Array<{ value: string, source: SwitchIdentitySource }> = [
        { value: raw.entPhysicalDescr, source: 'entity-description' },
        { value: raw.snmpSysDescr, source: 'snmp-description' },
        { value: raw.lldpSysDescr, source: 'lldp-description' }
    ]
    const vendorRule = detectVendor([
        raw.explicitVendor,
        raw.entPhysicalModelName,
        raw.entPhysicalDescr,
        raw.snmpSysDescr,
        raw.lldpSysDescr,
        raw.lldpSysName
    ], raw.snmpSysObjectID)

    let matched: { raw: string, normalized: string } | undefined
    let source: SwitchIdentitySource = ''
    if (vendorRule) {
        for (const candidate of structuredCandidates) {
            matched = matchVendorModel(vendorRule, [candidate.value])
            if (matched) {
                source = candidate.source
                break
            }
        }
        if (!matched) {
            for (const candidate of descriptionCandidates) {
                const labeled = extractLabeledModel(candidate.value)
                matched = matchVendorModel(vendorRule, labeled ? [labeled] : []) ||
                    matchVendorModel(vendorRule, [candidate.value])
                if (matched) {
                    source = candidate.source
                    break
                }
            }
        }
    }

    if (!matched) {
        const fallback = [
            ...structuredCandidates.map(candidate => candidate.value),
            ...descriptionCandidates.map(candidate => extractLabeledModel(candidate.value))
        ]
            .map(cleanModel)
            .find(safeModelToken) || ''
        if (fallback) {
            matched = { raw: fallback, normalized: vendorRule?.normalize ? vendorRule.normalize(fallback) : fallback }
            source = 'fallback'
        }
    }

    const displayModel = matched ? matched.normalized : ''
    return {
        vendor: vendorRule ? vendorRule.vendor : compact(raw.explicitVendor),
        rawModel: matched ? matched.raw : '',
        displayModel,
        family: vendorRule && displayModel && vendorRule.family ? vendorRule.family(displayModel) : '',
        source,
        raw
    }
}

export const switchVendorRules = (): ReadonlyArray<{ vendor: string, patterns: ReadonlyArray<RegExp> }> =>
    VENDOR_RULES.map(rule => ({ vendor: rule.vendor, patterns: rule.patterns }))
