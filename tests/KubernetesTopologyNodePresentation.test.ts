import { strict as assert } from 'assert'
import {
    isKubernetesWorkloadType,
    kubernetesWorkloadNodeText
} from '../src/KubernetesTopologyNodePresentation'

describe('Kubernetes workload topology node presentation', () => {
    it('uses one resource-kind line for every workload controller type', () => {
        const expected: Record<string, string> = {
            deployment: 'Deployment',
            statefulset: 'StatefulSet',
            daemonset: 'DaemonSet',
            job: 'Job',
            cronjob: 'CronJob'
        }
        Object.keys(expected).forEach(type => {
            assert.equal(isKubernetesWorkloadType(type), true)
            assert.deepEqual(kubernetesWorkloadNodeText('api', type), {
                name: 'api',
                kind: expected[type],
                accessibleName: `api\n${expected[type]}`
            })
        })
    })

    it('preserves the complete short and long name for the shared two-line fitter', () => {
        assert.equal(kubernetesWorkloadNodeText('api', 'deployment').name, 'api')
        assert.equal(
            kubernetesWorkloadNodeText('very-long-stateful-workload-controller-name', 'statefulset').name,
            'very-long-stateful-workload-controller-name'
        )
    })
})
