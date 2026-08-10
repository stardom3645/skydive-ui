import { strict as assert } from 'assert'

import {
    DAEMONSET_CONDITION_DEFINITIONS,
    DEPLOYMENT_CONDITION_DEFINITIONS,
    POD_CONDITION_DEFINITIONS,
    kubernetesConditionPresentation
} from '../src/DataPanels/common/KubernetesConditionPresentation'

describe('Kubernetes Condition presentation', () => {
    it('treats Progressing=True and Available=True as healthy', () => {
        const progressing = kubernetesConditionPresentation({ Type: 'Progressing', Status: 'True', Reason: 'NewReplicaSetAvailable' }, DEPLOYMENT_CONDITION_DEFINITIONS)
        const available = kubernetesConditionPresentation({ Type: 'Available', Status: 'True', Reason: 'MinimumReplicasAvailable' }, DEPLOYMENT_CONDITION_DEFINITIONS)
        assert.equal(progressing.title, '진행 상태')
        assert.equal(progressing.tone, 'success')
        assert.equal(available.title, '가용 상태')
        assert.equal(available.tone, 'success')
    })

    it('treats ReplicaFailure=False as healthy and True as dangerous', () => {
        const healthy = kubernetesConditionPresentation({ Type: 'ReplicaFailure', Status: 'False' }, DEPLOYMENT_CONDITION_DEFINITIONS)
        const failed = kubernetesConditionPresentation({ Type: 'ReplicaFailure', Status: 'True', Reason: 'FailedCreate', Message: 'quota exceeded' }, DEPLOYMENT_CONDITION_DEFINITIONS)
        assert.equal(healthy.tone, 'success')
        assert.equal(failed.title, '복제본 실패')
        assert.equal(failed.tone, 'danger')
        assert.ok(failed.detail.includes('quota exceeded'))
    })

    it('uses user-facing DaemonSet condition labels and polarity', () => {
        const available = kubernetesConditionPresentation({ Type: 'Available', Status: 'True' }, DAEMONSET_CONDITION_DEFINITIONS)
        const failed = kubernetesConditionPresentation({ Type: 'ReplicaFailure', Status: 'True' }, DAEMONSET_CONDITION_DEFINITIONS)
        assert.equal(available.title, '가용 상태')
        assert.equal(available.tone, 'success')
        assert.equal(failed.title, '파드 배치 실패')
        assert.equal(failed.tone, 'danger')
    })

    it('uses Pod-specific Condition meanings without exposing raw booleans as the result', () => {
        const ready = kubernetesConditionPresentation({ Type: 'Ready', Status: 'False', Reason: 'ContainersNotReady' }, POD_CONDITION_DEFINITIONS)
        assert.strictEqual(ready.title, '준비 상태')
        assert.strictEqual(ready.stateLabel, '주의')
        const initialized = kubernetesConditionPresentation({ Type: 'Initialized', Status: 'True' }, POD_CONDITION_DEFINITIONS)
        assert.strictEqual(initialized.title, '초기화 완료')
        assert.strictEqual(initialized.tone, 'success')
    })
})
