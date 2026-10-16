import { strict as assert } from 'assert'
import { kubernetesStorageCardMetrics } from '../src/KubernetesStorageCardPresentation'
import { topologyNodePresentation } from '../src/TopologyNodePresentation'

const node = (data: any): any => ({ id: 'storage', data: { Manager: 'k8s', Name: 'storage', ...data }, state: {}, children: [] })
const present = (data: any) => topologyNodePresentation(node(data), { name: 'storage' })
const rows = (data: any) => kubernetesStorageCardMetrics(data).map(({ key, label, value }) => [key, label, value])

describe('Kubernetes storage card inventory information', () => {
    it('uses the actual collector PV capacity even when the Go Quantity object has lost its numeric value', () => {
        const data = { Type: 'persistentvolume', K8s: { capacity: '5Gi', AccessModes: ['ReadWriteOnce'], ReclaimPolicy: 'Retain',
            Extra: { Spec: { Capacity: { storage: { Format: 'BinarySI' } } } } } }
        assert.deepEqual(rows(data), [['capacity', '볼륨 용량', '5Gi'], ['access-modes', '접근 모드', 'RWO'], ['reclaim-policy', '회수 정책', '유지']])
        assert.ok(present(data).metrics.every(metric => metric.percent === undefined))
    })
    it('shows PVC allocation, not requested size or a fabricated usage rate', () => {
        const data = { Type: 'persistentvolumeclaim', K8s: { actualCapacity: '10Gi', requestStorage: '5Gi', Status: 'Bound',
            Extra: { Spec: { AccessModes: ['ReadWriteMany'], StorageClassName: 'glue-cephfs' }, Status: { Capacity: { storage: { Format: 'BinarySI' } } } } } }
        assert.deepEqual(rows(data), [['capacity', '할당 용량', '10Gi'], ['access-modes', '접근 모드', 'RWX'], ['storage-class', '스토리지 클래스', 'glue-cephfs']])
        assert.ok(present(data).metrics.every(metric => metric.percent === undefined))
    })
    it('labels Pending PVC capacity as requested and ignores any old allocation', () => {
        assert.deepEqual(rows({ Type: 'persistentvolumeclaim', K8s: { Status: 'Pending', requestStorage: '2Gi', actualCapacity: '1Gi' } }),
            [['capacity', '요청 용량', '2Gi']])
    })
    it('does not present a Bound PVC request as a confirmed allocation when capacity is missing', () => {
        assert.deepEqual(rows({ Type: 'persistentvolumeclaim', K8s: { Status: 'Bound', requestStorage: '8Gi' } }), [])
    })
    it('omits an unset StorageClass and preserves lowercase API quantities and multiple access modes', () => {
        assert.deepEqual(rows({ Type: 'persistentvolumeclaim', K8s: { Extra: { status: { phase: 'Bound', capacity: { storage: { String: '120Gi' } } },
            spec: { accessModes: ['ReadWriteOnce', 'ReadOnlyMany'], storageClassName: '' } } } }),
            [['capacity', '할당 용량', '120Gi'], ['access-modes', '접근 모드', 'RWO, ROX']])
    })
    it('tries another real quantity if a normalized field is unusable and does not invent missing information', () => {
        assert.deepEqual(rows({ Type: 'persistentvolume', K8s: { capacity: { Format: 'BinarySI' }, Extra: { Spec: { Capacity: { storage: '20Gi' } } } } }),
            [['capacity', '볼륨 용량', '20Gi']])
        assert.deepEqual(rows({ Type: 'persistentvolume' }), [])
        assert.deepEqual(rows({ Type: 'persistentvolume', K8s: { capacity: { Format: 'BinarySI' } } }), [['capacity', '볼륨 용량', '확인 불가']])
    })
    it('keeps card dimensions, status and badge behavior stable as inventory fields arrive', () => {
        const data: any = { Type: 'persistentvolume', K8s: { Status: 'Released', ReclaimPolicy: 'Retain' } }
        const before = present(data)
        data.K8s.capacity = '5Gi'; data.K8s.AccessModes = ['ReadWriteMany']
        const after = present(data)
        assert.equal(before.height, after.height)
        assert.equal(before.width, after.width)
        assert.deepEqual(before.status, after.status)
        assert.deepEqual(before.badges, after.badges)
    })
})
