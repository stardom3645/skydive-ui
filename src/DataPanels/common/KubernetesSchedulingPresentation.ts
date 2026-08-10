export interface KubernetesSchedulingConfiguration {
    nodeSelector: Record<string, any>
    affinity: Record<string, any>
    nodeAffinity: Record<string, any>
    tolerations: any[]
    nodeSelectionCount: number
    affinityConditionCount: number
    tolerationCount: number
}

const objectValue = (value: any): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const listValue = (value: any): any[] => Array.isArray(value) ? value : []

/** Normalizes the PodSpec scheduling fields without serializing large affinity
 * or toleration payloads into a resource-specific detail card. */
export const normalizeKubernetesSchedulingConfiguration = (podSpec: any): KubernetesSchedulingConfiguration => {
    const source = objectValue(podSpec)
    const nodeSelector = objectValue(source.NodeSelector ?? source.nodeSelector)
    const affinity = objectValue(source.Affinity ?? source.affinity)
    const tolerations = listValue(source.Tolerations ?? source.tolerations)
    const nodeAffinity = objectValue(affinity.NodeAffinity ?? affinity.nodeAffinity)
    const required = objectValue(nodeAffinity.RequiredDuringSchedulingIgnoredDuringExecution ?? nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution)
    const affinityConditionCount = listValue(required.NodeSelectorTerms ?? required.nodeSelectorTerms).length
        + listValue(nodeAffinity.PreferredDuringSchedulingIgnoredDuringExecution ?? nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution).length
    return {
        nodeSelector,
        affinity,
        nodeAffinity,
        tolerations,
        nodeSelectionCount: Object.keys(nodeSelector).length + affinityConditionCount,
        affinityConditionCount,
        tolerationCount: tolerations.length
    }
}

export const kubernetesSchedulingMetadata = (configuration: KubernetesSchedulingConfiguration) => ({
    nodeSelector: configuration.nodeSelector,
    affinity: Object.keys(configuration.nodeAffinity).length ? { nodeAffinity: configuration.nodeAffinity } : {},
    tolerations: configuration.tolerations.reduce((result: Record<string, any>, toleration: any, index: number) => {
        result[`toleration ${index + 1}`] = toleration
        return result
    }, {})
})
