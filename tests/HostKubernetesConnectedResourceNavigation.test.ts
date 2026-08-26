import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'src/DataPanels/HostDetailPanel.tsx'), 'utf8')

describe('Host Kubernetes connected-resource navigation', () => {
    it('routes node-backed cards through the shared connected-resource navigation', () => {
        assert.ok(source.includes('|| (!!item.nodeIDs && item.nodeIDs.length > 0)'))
        assert.ok(source.includes("this.focusConnectedResource(item.actionKey, item.nodeIDs)"))
        assert.ok(source.includes("navigateInfrastructureConnectedResources(ids, this.props.node.id, 'summary')"))
    })

    it('does not open the Kubernetes node picker from the connected-resource card', () => {
        const kubernetesResourceBlock = source.slice(
            source.indexOf('const kubernetesResources: OverviewCardItem[]'),
            source.indexOf('const resolvedPhysicalNicCount')
        )
        assert.ok(kubernetesResourceBlock.includes('nodeIDs: kubernetesNodes.map(item => item.id)'))
        assert.ok(kubernetesResourceBlock.includes("resourcesPopoverWidth: 'wide'"))
        assert.ok(!kubernetesResourceBlock.includes('openKubernetesNodePicker'))
    })

    it('keeps popover rows on the shared concrete-resource item path', () => {
        assert.ok(source.includes('connectedResourcePopoverItems(resourceNodes'))
    })
})
