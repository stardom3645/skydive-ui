export const KUBERNETES_WORKLOAD_TYPES = ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'] as const
export const KUBERNETES_STORAGE_TYPES = ['storageclass', 'persistentvolumeclaim', 'persistentvolume'] as const

export const KUBERNETES_WORKLOAD_KIND_LABELS: Record<string, string> = {
    deployment: 'Deployment',
    statefulset: 'StatefulSet',
    daemonset: 'DaemonSet',
    job: 'Job',
    cronjob: 'CronJob'
}

export const isKubernetesWorkloadType = (value: any): boolean =>
    KUBERNETES_WORKLOAD_TYPES.indexOf(String(value || '').toLowerCase() as any) >= 0

export const isKubernetesStorageType = (value: any): boolean =>
    KUBERNETES_STORAGE_TYPES.indexOf(String(value || '').toLowerCase() as any) >= 0

export const isKubernetesThreeLineTopologyType = (value: any): boolean =>
    isKubernetesWorkloadType(value) || isKubernetesStorageType(value)

export const kubernetesWorkloadKindLabel = (value: any): string => {
    const type = String(value || '').toLowerCase()
    return KUBERNETES_WORKLOAD_KIND_LABELS[type] || String(value || '')
}

export interface KubernetesWorkloadNodeText {
    name: string
    kind: string
    accessibleName: string
}

export const kubernetesTopologyKindLabel = (type: any, namespace?: any): string => {
    const normalized = String(type || '').toLowerCase()
    if (isKubernetesWorkloadType(normalized)) return kubernetesWorkloadKindLabel(normalized)
    if (normalized === 'storageclass') return 'StorageClass'
    if (normalized === 'persistentvolumeclaim') {
        const namespaceName = String(namespace || '').trim()
        return `PVC${namespaceName ? ` · ${namespaceName}` : ''}`
    }
    if (normalized === 'persistentvolume') return 'PV'
    return String(type || '')
}

/** Canonical name(2 rows) + kind/context(1 row) contract shared by Kubernetes
 * workload and storage topology nodes. The renderer performs the two-line fit. */
export const kubernetesTopologyNodeText = (name: any, type: any, namespace?: any): KubernetesWorkloadNodeText => {
    const resourceName = String(name || '')
    const kind = kubernetesTopologyKindLabel(type, namespace)
    return {
        name: resourceName,
        kind,
        accessibleName: [resourceName, kind].filter(Boolean).join('\n')
    }
}

/** Canonical text contract for every Kubernetes workload topology node. */
export const kubernetesWorkloadNodeText = (name: any, type: any): KubernetesWorkloadNodeText => {
    return kubernetesTopologyNodeText(name, type)
}
