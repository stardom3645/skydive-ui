import { strict as assert } from 'assert'

import {
    kubernetesDaemonSetPlacementHasProblem,
    kubernetesDaemonSetPlacementSnapshot
} from '../src/KubernetesDaemonSetDetailAggregation'

describe('Kubernetes DaemonSet detail aggregation', () => {
    it('normalizes the seven placement values from one status dataset', () => {
        const snapshot = kubernetesDaemonSetPlacementSnapshot({
            DesiredNumberScheduled: 2,
            CurrentNumberScheduled: 2,
            NumberReady: 2,
            NumberAvailable: 2,
            UpdatedNumberScheduled: 2,
            NumberUnavailable: 0,
            NumberMisscheduled: 0
        })
        assert.deepEqual(snapshot, {
            collected: true,
            desired: 2,
            current: 2,
            ready: 2,
            available: 2,
            updated: 2,
            unavailable: 0,
            misscheduled: 0
        })
        assert.equal(kubernetesDaemonSetPlacementHasProblem(snapshot), false)
    })

    it('supports Kubernetes JSON casing and detects deficits or incorrect placement', () => {
        const deficit = kubernetesDaemonSetPlacementSnapshot({
            desiredNumberScheduled: 3,
            currentNumberScheduled: 2,
            numberReady: 2,
            numberAvailable: 2,
            updatedNumberScheduled: 2,
            numberUnavailable: 1,
            numberMisscheduled: 1
        })
        assert.equal(deficit.desired, 3)
        assert.equal(deficit.misscheduled, 1)
        assert.equal(kubernetesDaemonSetPlacementHasProblem(deficit), true)
        assert.equal(kubernetesDaemonSetPlacementSnapshot({}).collected, false)
    })
})
