import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Connected resource popover', () => {
    it('keeps summary navigation separate from a multi-resource Ant popover', () => {
        const source = read('src/DataPanels/common/DetailComponents.tsx')
        assert.ok(source.includes('const hasResourceList = resources.length > 1'))
        assert.ok(source.includes('<Popover'))
        assert.ok(source.includes('<List'))
        assert.ok(source.includes('autoAdjustOverflow'))
        assert.ok(source.includes('getPopupContainer={() => document.body}'))
        assert.ok(source.includes('event.stopPropagation()'))
        const css = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(css.includes('.netdive-detail-resource--with-resource-list.ant-btn'))
        assert.ok(css.includes('grid-template-columns: minmax(0, 1fr) max-content 32%'))
        assert.ok(css.includes('grid-column: 3'))
        assert.ok(css.includes('justify-content: center'))
        assert.ok(css.includes('stroke-width: 32'))
    })

    it('navigates each list row through the existing real-node item path', () => {
        const source = read('src/DataPanels/common/DetailComponents.tsx')
        assert.ok(source.includes("navigateInfrastructureConnectedResources([node.id], options.anchorNodeID, 'item')"))
        assert.ok(source.includes('const unique = new Map<string, Node>()'))
        assert.ok(source.includes('max-height: 300px') === false)
        const css = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(css.includes('max-height: 300px'))
        assert.ok(css.includes('overflow-y: auto'))
    })

    it('centers every topology icon inside the fixed popover icon square', () => {
        const css = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(css.includes('.netdive-connected-resource-popover__icon {'))
        assert.ok(css.includes('flex: 0 0 28px'))
        assert.ok(css.includes('.netdive-connected-resource-popover__icon > *'))
        assert.ok(css.includes('position: static'))
        assert.ok(css.includes('transform: none'))
        assert.ok(css.includes('.netdive-connected-resource-popover__icon img'))
        assert.ok(css.includes('.netdive-connected-resource-popover__icon svg'))
    })

    it('is wired to both infrastructure and Kubernetes summary cards', () => {
        ;[
            'src/DataPanels/SwitchDetailPanel.tsx',
            'src/DataPanels/SwitchPortDetailPanel.tsx',
            'src/DataPanels/HostDetailPanel.tsx',
            'src/DataPanels/KubernetesClusterDetailPanel.tsx',
            'src/DataPanels/KubernetesNamespaceDetailPanel.tsx',
            'src/DataPanels/KubernetesServiceDetailPanel.tsx',
            'src/DataPanels/KubernetesStorageDetailPanel.tsx'
        ].forEach(file => assert.ok(read(file).includes('connectedResourcePopoverItems'), `${file} is not using the shared resource list`))
    })
})
