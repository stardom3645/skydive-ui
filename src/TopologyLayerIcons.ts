/** Layer weights are stable graph identities; translated titles and synthetic
 * group names must not decide which resource icon is shown. */
const layerGlyphs: Record<number, string> = {
    3000: '\uf0e8', 3010: '\uf542', 3020: '\uf233', 3030: '\uf07b',
    3035: '\uf5fd', 3040: '\uf1b3', 3050: '\uf1b3', 3060: '\uf6ff',
    3070: '\uf1c0', 3200: '\uf542',
    5010: '\uf0ac', 5015: '\uf6ff', 5018: '\uf796', 5020: '\uf233',
    5030: '\uf538', 5032: '\uf0c1', 5035: '\uf542', 5040: '\uf0e8',
    5050: '\uf538', 5060: '\uf796',
    7010: '\uf24d', 7030: '\uf49e', 7040: '\uf247', 7050: '\uf538',
    7060: '\uf085', 7070: '\uf4d7', 7080: '\uf108', 7090: '\uf796',
    20000: '\uf538'
}

export const topologyLayerGlyph = (weight?: number): string | undefined => weight === undefined ? undefined : layerGlyphs[weight]

// These layers share a collector Type, so Type alone loses their actual role.
const layerKinds: Record<number, string> = {
    7010: '가상 네임스페이스', 7030: '가상 컨테이너', 7040: '가상 브리지',
    7060: '시스템 가상머신', 7070: '가상 라우터', 7080: '사용자 가상머신'
}
export const topologyLayerKind = (weight?: number): string | undefined => weight === undefined ? undefined : layerKinds[weight]
