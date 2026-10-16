export interface VMOperatingSystem { name: string; family: 'windows' | 'linux' | 'apple' | 'other' | 'unknown' }

/** Use collected OS names only, with neutral icons for other / missing OS data. */
export function vmOperatingSystem(data: any): VMOperatingSystem {
    const fields = ['GuestOS', 'guestOS', 'guestos', 'OS', 'Os', 'os', 'OperatingSystem', 'OsDisplayName', 'osDisplayName', 'osdisplayname',
        'OsTypeName', 'osTypeName', 'ostypename']
    const name = fields.map(key => data?.[key]).find(value => typeof value === 'string'
        && value.trim() && !/^(n\/a|unknown|–|-)$/i.test(value.trim()))?.trim()
    if (!name) return { name: '운영체제 정보 없음', family: 'unknown' }
    if (/\bwindows\b/i.test(name)) return { name, family: 'windows' }
    if (/\b(linux|ubuntu|debian|rocky|centos|rhel|red\s*hat|fedora|alma(?:linux)?|suse|opensuse|alpine|coreos|flatcar|photon|talos)\b/i.test(name)) return { name, family: 'linux' }
    if (/\b(mac\s?os|os\s?x|darwin)\b/i.test(name)) return { name, family: 'apple' }
    return { name, family: 'other' }
}
