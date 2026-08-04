import { strict as assert } from 'assert'

import {
    cpuBasisRatios,
    formatPodCpuUsage,
    formatPodMemoryUsage,
    memoryBasisRatios,
    podCpuResourceCores,
    podMemoryResourceBytes,
    progressPercent,
    relativePodUsagePercent
} from '../src/DataPanels/common/KubernetesPodUsageMetrics'

describe('KubernetesPodUsageMetrics', () => {
    it('formats sub-Core CPU as integer mCore and Core values with at most two decimals', () => {
        assert.equal(formatPodCpuUsage(0), '0 mCore')
        assert.equal(formatPodCpuUsage(0.051), '51 mCore')
        assert.equal(formatPodCpuUsage(0.14), '140 mCore')
        assert.equal(formatPodCpuUsage(0.005), '5 mCore')
        assert.equal(formatPodCpuUsage(1.25), '1.25 Core')
        assert.equal(formatPodCpuUsage(2), '2 Core')
    })

    it('calculates a safe list-relative comparison and clamps only Progress output', () => {
        assert.equal(relativePodUsagePercent(0.14, 0.14), 100)
        assert.equal(relativePodUsagePercent(0.07, 0.14), 50)
        assert.equal(relativePodUsagePercent(0, 0), 0)
        assert.equal(relativePodUsagePercent(Number.NaN, 0), 0)
        assert.equal(progressPercent(140), 100)
        assert.equal(progressPercent(Number.POSITIVE_INFINITY), 0)
    })

    it('keeps missing Request and Limit distinct and preserves ratios over 100%', () => {
        assert.deepEqual(cpuBasisRatios(0.14, 0.1, 0.2), {
            requestPercent: 140,
            limitPercent: 70
        })
        assert.deepEqual(cpuBasisRatios(0.14, undefined, 0), {
            requestPercent: undefined,
            limitPercent: undefined
        })
    })

    it('uses the larger of application-container sum and init-container maximum', () => {
        const spec = {
            Containers: [
                { Resources: { Requests: { cpu: '100m' }, Limits: { cpu: '250m' } } },
                { Resources: { Requests: { cpu: '200m' } } }
            ],
            InitContainers: [
                { Resources: { Requests: { cpu: '500m' }, Limits: { cpu: '1' } } }
            ]
        }
        assert.equal(podCpuResourceCores(spec, 'Requests'), 0.5)
        assert.equal(podCpuResourceCores(spec, 'Limits'), 1)
        assert.equal(podCpuResourceCores({ Containers: [{}] }, 'Requests'), undefined)
    })

    it('formats memory as integer MiB below one GiB and GiB otherwise', () => {
        assert.equal(formatPodMemoryUsage(0), '0 MiB')
        assert.equal(formatPodMemoryUsage(512 * Math.pow(1024, 2)), '512 MiB')
        assert.equal(formatPodMemoryUsage(1.25 * Math.pow(1024, 3)), '1.25 GiB')
        assert.equal(formatPodMemoryUsage(2 * Math.pow(1024, 3)), '2 GiB')
    })

    it('calculates Memory Request and Limit independently', () => {
        assert.deepEqual(memoryBasisRatios(700, 500, 400), {
            requestPercent: 140,
            limitPercent: 175
        })
        assert.deepEqual(memoryBasisRatios(700, undefined, 0), {
            requestPercent: undefined,
            limitPercent: undefined
        })
    })

    it('preserves missing memory resources and applies Pod effective resource rules', () => {
        const spec = {
            Containers: [
                { Resources: { Requests: { memory: '128Mi' }, Limits: { memory: '256Mi' } } },
                { Resources: { Requests: { memory: '128Mi' } } }
            ],
            InitContainers: [
                { Resources: { Requests: { memory: '512Mi' }, Limits: { memory: '1Gi' } } }
            ]
        }
        assert.equal(podMemoryResourceBytes(spec, 'Requests'), 512 * Math.pow(1024, 2))
        assert.equal(podMemoryResourceBytes(spec, 'Limits'), Math.pow(1024, 3))
        assert.equal(podMemoryResourceBytes({ Containers: [{}] }, 'Limits'), undefined)
    })
})
