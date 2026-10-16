export interface VMOperatingSystem { name: string; family: 'windows' | 'linux' | 'apple' }

/** Use collected OS names; an unknown or absent OS gets no guessed icon. */
export function vmOperatingSystem(data: any): VMOperatingSystem | undefined {
    const fields = ['GuestOS', 'guestOS', 'guestos', 'OS', 'Os', 'os', 'OperatingSystem', 'OsDisplayName', 'osDisplayName', 'osdisplayname']
    const name = fields.map(key => data?.[key]).find(value => typeof value === 'string'
        && value.trim() && !/^(n\/a|unknown|other|–|-)$/i.test(value.trim()))?.trim()
    if (!name) return undefined
    if (/\bwindows\b/i.test(name)) return { name, family: 'windows' }
    if (/\b(linux|ubuntu|debian|rocky|centos|rhel|red\s*hat|fedora|alma(?:linux)?|suse|opensuse|alpine|coreos|flatcar|photon|talos)\b/i.test(name)) return { name, family: 'linux' }
    if (/\b(mac\s?os|os\s?x|darwin)\b/i.test(name)) return { name, family: 'apple' }
    return undefined
}
