export const toggleKubernetesStructuredExpandedKey = <T extends string | number>(keys: T[], key: T): T[] =>
    keys.indexOf(key) >= 0 ? keys.filter(item => item !== key) : keys.concat(key)
