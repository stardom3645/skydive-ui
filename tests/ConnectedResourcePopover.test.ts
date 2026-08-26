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
        assert.ok(source.includes('placement="bottomRight"'))
        assert.ok(source.includes('resourceCardRef.current.getBoundingClientRect().width'))
        assert.ok(source.includes("resourcesPopoverWidth === 'wide'"))
        assert.ok(source.includes('{ min: 360, max: 600, ratio: 1.85 }'))
        assert.ok(source.includes('{ min: 260, max: 440, ratio: 1.35 }'))
        assert.ok(source.includes('overlayStyle={resourceListWidth ? { width: resourceListWidth } : undefined}'))
        assert.ok(source.includes('autoAdjustOverflow'))
        assert.ok(source.includes('getPopupContainer={() => document.body}'))
        assert.ok(source.includes('event.stopPropagation()'))
        const css = read('src/DataPanels/common/DetailComponents.css')
        const tokens = read('src/DataPanels/common/DetailDesignTokens.css')
        assert.ok(css.includes('.netdive-connected-resource-popover {'))
        assert.ok(css.includes('width: 100%'))
        assert.ok(css.includes('min-width: 260px'))
        assert.ok(css.includes('.netdive-detail-resource--with-resource-list.ant-btn'))
        assert.ok(tokens.includes('--netdive-detail-resource-action-width: 32%'))
        assert.ok(css.includes('var(--netdive-detail-resource-action-width)'))
        assert.ok(css.includes('minmax(var(--netdive-detail-resource-value-min-width), max-content)'))
        assert.ok(css.includes('grid-column: 3'))
        assert.ok(css.includes('width: 100%'))
        assert.ok(css.includes('justify-content: center'))
        assert.ok(css.includes('stroke-width: 32'))
    })

    it('keeps names on one line with a full-name tooltip in the wider shared overlay', () => {
        const source = read('src/DataPanels/common/DetailComponents.tsx')
        const css = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(source.includes('<Tooltip title={item.tooltip} placement="top">'))
        assert.ok(css.includes('.netdive-connected-resource-popover__name.ant-typography'))
        assert.ok(css.includes('text-overflow: ellipsis'))
        assert.ok(css.includes('white-space: nowrap'))
        assert.ok(css.includes('grid-template-columns: 28px minmax(0, 1fr) 14px'))
    })

    it('keeps label, count and action columns stable for zero, single and multiple resources', () => {
        const source = read('src/DataPanels/common/DetailComponents.tsx')
        const css = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(source.includes("!interactive && 'netdive-detail-resource__action--hidden'"))
        assert.ok(source.includes('hasResourceList ? <Popover'))
        assert.ok(source.includes('<RightOutlined />'))
        assert.ok(css.includes('.netdive-detail-resource__action--hidden'))
        assert.ok(css.includes('visibility: hidden'))
        assert.ok(css.includes('padding: 0 0 0 9px'))
    })

    it('navigates each list row through the existing real-node item path', () => {
        const source = read('src/DataPanels/common/DetailComponents.tsx')
        assert.ok(source.includes("navigateInfrastructureConnectedResources([node.id], options.anchorNodeID, 'item')"))
        assert.ok(source.includes('const unique = new Map<string, Node>()'))
        assert.ok(/className="netdive-connected-resource-popover__item"[\s\S]*?onClick=\{event => \{[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?onNavigate\(item\)/.test(source))
        assert.ok(source.includes('max-height: 208px') === false)
        const css = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(css.includes('max-height: 208px'))
        assert.ok(css.includes('overflow-y: auto'))
    })

    it('centers every topology icon inside the fixed popover icon square', () => {
        const css = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(css.includes('.netdive-connected-resource-popover__item.ant-btn > .netdive-connected-resource-popover__icon {'))
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
