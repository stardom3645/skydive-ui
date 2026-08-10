export interface KubernetesDaemonSetPlacementSnapshot {
    collected: boolean
    desired?: number
    current?: number
    ready?: number
    available?: number
    updated?: number
    unavailable?: number
    misscheduled?: number
}

const numericField = (source: any, pascal: string, camel: string): number | undefined => {
    const value = source?.[pascal] ?? source?.[camel]
    if (value === undefined || value === null || value === '' || Number.isNaN(Number(value))) return undefined
    return Number(value)
}

/** One normalized status dataset shared by DaemonSet verdicts and UI evidence. */
export const kubernetesDaemonSetPlacementSnapshot = (status: any): KubernetesDaemonSetPlacementSnapshot => {
    const snapshot = {
        desired: numericField(status, 'DesiredNumberScheduled', 'desiredNumberScheduled'),
        current: numericField(status, 'CurrentNumberScheduled', 'currentNumberScheduled'),
        ready: numericField(status, 'NumberReady', 'numberReady'),
        available: numericField(status, 'NumberAvailable', 'numberAvailable'),
        updated: numericField(status, 'UpdatedNumberScheduled', 'updatedNumberScheduled'),
        unavailable: numericField(status, 'NumberUnavailable', 'numberUnavailable'),
        misscheduled: numericField(status, 'NumberMisscheduled', 'numberMisscheduled')
    }
    return { collected: Object.values(snapshot).some(value => value !== undefined), ...snapshot }
}

export const kubernetesDaemonSetPlacementHasProblem = (snapshot: KubernetesDaemonSetPlacementSnapshot): boolean =>
    (snapshot.desired !== undefined && snapshot.current !== undefined && snapshot.current < snapshot.desired)
    || (snapshot.desired !== undefined && snapshot.ready !== undefined && snapshot.ready < snapshot.desired)
    || (snapshot.desired !== undefined && snapshot.available !== undefined && snapshot.available < snapshot.desired)
    || (snapshot.desired !== undefined && snapshot.updated !== undefined && snapshot.updated < snapshot.desired)
    || (snapshot.unavailable !== undefined && snapshot.unavailable > 0)
    || (snapshot.misscheduled !== undefined && snapshot.misscheduled > 0)
