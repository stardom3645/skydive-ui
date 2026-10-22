/** Kubernetes 1.35+ conformance guarantees arbitrary-precision decimal ordering
 * within one API resource type. Callers must establish object/cluster identity
 * first. Older/unknown servers and nondecimal tokens support equality only.
 * https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-versions */
export const compareKubernetesResourceVersions = (left: string, right: string, serverVersion?: string): -1 | 0 | 1 | undefined => {
    if (left && left === right) return 0
    const version = /^v?(\d+)\.(\d+)(?:\.|$)/.exec(serverVersion || '')
    if (!version || Number(version[1]) < 1 || (Number(version[1]) === 1 && Number(version[2]) < 35)
        || !/^[1-9][0-9]*$/.test(left) || !/^[1-9][0-9]*$/.test(right)) return undefined
    if (left.length !== right.length) return left.length > right.length ? 1 : -1
    return left > right ? 1 : -1
}
