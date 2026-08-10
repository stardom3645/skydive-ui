import * as assert from 'assert'

import {
    kubernetesPodContainerRuntime,
    kubernetesPodPhaseLabel,
    kubernetesPodVolumePresentations,
    mergeKubernetesPodDetail
} from '../src/KubernetesPodDetailAggregation'

describe('Kubernetes Pod detail aggregation', () => {
    it('uses user-facing Pod phases', () => {
        assert.strictEqual(kubernetesPodPhaseLabel('Running'), '실행 중')
        assert.strictEqual(kubernetesPodPhaseLabel('Pending'), '대기 중')
        assert.strictEqual(kubernetesPodPhaseLabel(undefined), '수집되지 않음')
    })

    it('treats a successful init-container termination as healthy', () => {
        assert.deepStrictEqual(kubernetesPodContainerRuntime({ type: 'INIT', state: 'TERMINATED', terminatedReason: 'Completed', exitCode: 0 }), {
            label: '완료', tone: 'success', healthy: true, readyLabel: '완료'
        })
        assert.strictEqual(kubernetesPodContainerRuntime({ type: 'APPLICATION', state: 'WAITING', waitingReason: 'CrashLoopBackOff' }).tone, 'danger')
    })

    it('keeps spec-only container configuration when API runtime data is merged', () => {
        const merged = mergeKubernetesPodDetail({ containers: [{ type: 'APPLICATION', name: 'app', pullPolicy: 'IfNotPresent', resources: { Requests: { cpu: '10m' } } }] }, {
            containers: [{ type: 'APPLICATION', name: 'app', state: 'RUNNING', ready: true }]
        })
        assert.strictEqual(merged.containers[0].pullPolicy, 'IfNotPresent')
        assert.strictEqual(merged.containers[0].state, 'RUNNING')
    })

    it('deduplicates volumes by name and preserves source and container mounts', () => {
        const volumes = kubernetesPodVolumePresentations({
            Volumes: [
                { Name: 'config', ConfigMap: { Name: 'app-config' } },
                { Name: 'data', PersistentVolumeClaim: { ClaimName: 'data-pvc' } },
                { Name: 'data', PersistentVolumeClaim: { ClaimName: 'duplicate' } }
            ],
            InitContainers: [{ Name: 'init', VolumeMounts: [{ Name: 'config', MountPath: '/config', ReadOnly: true }] }],
            Containers: [{ Name: 'app', VolumeMounts: [{ Name: 'data', MountPath: '/data' }] }]
        })
        assert.strictEqual(volumes.length, 2)
        assert.strictEqual(volumes[0].sourceType, 'ConfigMap')
        assert.strictEqual(volumes[0].mounts[0].containerKind, '초기화 컨테이너')
        assert.deepStrictEqual(volumes[1].references, [{ kind: 'PVC', name: 'data-pvc' }])
        assert.strictEqual(volumes[1].mounts[0].path, '/data')
        assert.strictEqual(volumes[1].mountsCollected, true)
        assert.strictEqual(volumes[1].mountState, 'mounted')
    })

    it('keeps projected sources structured and distinguishes missing mount collection', () => {
        const volumes = kubernetesPodVolumePresentations({
            Volumes: [{
                Name: 'projected',
                Projected: { Sources: [
                    { Secret: { LocalObjectReference: { Name: 'token-secret' } } },
                    { ConfigMap: { Name: 'cluster-ca' } },
                    { ServiceAccountToken: { Path: 'token', Audience: 'api' } }
                ] }
            }]
        })
        assert.strictEqual(volumes[0].sourceType, 'Projected')
        assert.deepStrictEqual(volumes[0].references.map(reference => reference.kind), ['Secret', 'ConfigMap', 'ServiceAccountToken'])
        assert.strictEqual(volumes[0].references[0].name, 'token-secret')
        assert.strictEqual(volumes[0].mountsCollected, false)
        assert.strictEqual(volumes[0].mountState, 'uncollected')
        assert.strictEqual(volumes[0].mounts.length, 0)
    })

    it('marks a collected empty mount list separately from uncollected data', () => {
        const volumes = kubernetesPodVolumePresentations({
            Volumes: [{ Name: 'cache', EmptyDir: {} }],
            Containers: [{ Name: 'app', VolumeMounts: [] }]
        })
        assert.strictEqual(volumes[0].sourceType, 'EmptyDir')
        assert.strictEqual(volumes[0].mountState, 'none')
        assert.deepStrictEqual(volumes[0].references, [])
    })
})
