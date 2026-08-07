export const KUBERNETES_WORKLOAD_TYPES = ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'] as const

export const KUBERNETES_WORKLOAD_KIND_LABELS: Record<string, string> = {
    deployment: 'Deployment',
    statefulset: 'StatefulSet',
    daemonset: 'DaemonSet',
    job: 'Job',
    cronjob: 'CronJob'
}

export const isKubernetesWorkloadType = (value: any): boolean =>
    KUBERNETES_WORKLOAD_TYPES.indexOf(String(value || '').toLowerCase() as any) >= 0

export const kubernetesWorkloadKindLabel = (value: any): string => {
    const type = String(value || '').toLowerCase()
    return KUBERNETES_WORKLOAD_KIND_LABELS[type] || String(value || '')
}

export interface KubernetesWorkloadNodeText {
    name: string
    kind: string
    accessibleName: string
}

/** Canonical text contract for every Kubernetes workload topology node. */
export const kubernetesWorkloadNodeText = (name: any, type: any): KubernetesWorkloadNodeText => {
    const resourceName = String(name || '')
    const kind = kubernetesWorkloadKindLabel(type)
    return {
        name: resourceName,
        kind,
        accessibleName: [resourceName, kind].filter(Boolean).join('\n')
    }
}
