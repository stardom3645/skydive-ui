import { strict as assert } from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Kubernetes common metadata and selector modal usage', () => {
    const namespace = read('src/DataPanels/KubernetesNamespaceDetailPanel.tsx')
    const workload = read('src/DataPanels/KubernetesWorkloadDetailPanel.tsx')
    const pod = read('src/DataPanels/KubernetesPodDetailPanel.tsx')
    const service = read('src/DataPanels/KubernetesServiceDetailPanel.tsx')
    const selection = read('src/SelectionPanel.tsx')
    const commonIndex = read('src/DataPanels/common/index.ts')
    const metadata = read('src/DataPanels/common/KubernetesMetadataModal.tsx')
    const selector = read('src/DataPanels/common/KubernetesSelectorSummary.tsx')

    it('routes Deployment, StatefulSet and DaemonSet through one workload panel', () => {
        assert.ok(selection.includes("['deployment', 'statefulset', 'daemonset', 'job', 'cronjob']"))
        assert.ok(selection.includes('<KubernetesWorkloadDetailPanel'))
        assert.ok(workload.includes('<KubernetesMetadataRows'))
        assert.ok(workload.includes('<KubernetesSelectorSummary'))
        assert.ok(workload.includes('mode="labelSelector"'))
    })

    it('uses the same metadata entry point in Namespace, workload, Pod and Service panels', () => {
        ;[namespace, workload, pod, service].forEach(source => {
            assert.ok(source.includes('KubernetesMetadataRows,'))
            assert.ok(source.includes("from './common'"))
            assert.ok(source.includes('<KubernetesMetadataRows'))
            assert.ok(!source.includes('<KubernetesMetadataModal'))
            assert.ok(!source.includes('renderMetadataItems'))
            assert.ok(!source.includes('<pre'))
            assert.ok(!source.includes('<DetailMetadataSummary'))
        })
        assert.ok(commonIndex.includes("} from './KubernetesMetadataModal'"))
        assert.ok(metadata.includes('export const KubernetesMetadataRows'))
        assert.ok(metadata.includes('<KubernetesMetadataModal'))
        assert.ok(metadata.includes('<KubernetesStructuredDataTable'))
        assert.ok(metadata.includes('<KubernetesRawJsonCollapse'))
        assert.ok(metadata.includes('className="netdive-detail-metadata-row is-empty"'))
        assert.ok(metadata.includes('<strong>{item.label}</strong><span>없음</span>'))
        assert.ok(metadata.includes('description={`총 ${entries.length}개'))
    })

    it('uses the common selector modes for workload and Service selectors', () => {
        assert.ok(workload.includes('mode="labelSelector"'))
        assert.ok(service.includes('mode="simpleMap"'))
        ;[workload, service].forEach(source => {
            assert.ok(source.includes('KubernetesSelectorSummary,'))
            assert.ok(!source.includes('<KubernetesSelectorModal'))
            assert.ok(!source.includes('selectorModal'))
        })
        assert.ok(commonIndex.includes("} from './KubernetesSelectorSummary'"))
        assert.ok(selector.includes('export const KubernetesSelectorSummary'))
        assert.ok(selector.includes('<KubernetesSelectorModal'))
        assert.ok(selector.includes('<KubernetesStructuredDataTable'))
        assert.ok(selector.includes('<KubernetesRawJsonCollapse'))
    })

    it('keeps resource-specific selector and metadata CSS out of scoped panels', () => {
        const cssFiles = [
            'src/DataPanels/KubernetesNamespaceDetailPanel.css',
            'src/DataPanels/KubernetesWorkloadDetailPanel.css',
            'src/DataPanels/KubernetesPodDetailPanel.css',
            'src/DataPanels/KubernetesServiceDetailPanel.css'
        ]
        cssFiles.forEach(file => {
            const css = read(file)
            assert.ok(!/__(metadata|selector|selectors)(?:\b|[-_])/.test(css), `${file} contains a resource-specific metadata/selector rule`)
        })
    })
})
