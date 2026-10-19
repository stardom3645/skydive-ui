import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Connected resource popover', () => {
    it('opens Kubernetes related-resource lists with the Ant 6 controlled prop and navigates storage items to their details', () => {
        const modal = read('src/DataPanels/common/KubernetesConnectedResourceModal.tsx')
        assert.ok(modal.includes('<HistoryModal open={visible}'))
        assert.ok(!modal.includes('<HistoryModal visible='))
        const storage = read('src/DataPanels/KubernetesStorageDetailPanel.tsx')
        assert.ok(storage.includes("navigateInfrastructureConnectedResources([resource.id], this.props.node.id, 'item')"))
        assert.ok(storage.includes('this.setState({ relatedModal: undefined })'))
    })
    it('keeps summary navigation separate from a multi-resource Ant popover', () => {
        const source = read('src/DataPanels/common/DetailComponents.tsx')
        assert.ok(source.includes('const hasResourceList = resources.length > 1'))
        assert.ok(source.includes('<Popover'))
        assert.ok(source.includes('<List'))
        assert.ok(source.includes('placement="bottomRight"'))
        assert.ok(source.includes('resourceCardRef.current.getBoundingClientRect().width'))
        assert.ok(source.includes("resourcesPopoverWidth === 'wide'"))
        assert.ok(source.includes('{ min: 560, max: 760, ratio: 2.8 }'))
        assert.ok(source.includes('{ min: 480, max: 640, ratio: 2.4 }'))
        assert.ok(source.includes('window.innerWidth - 24'))
        assert.ok(source.includes("styles={{ root: resourceListWidth ? { width: resourceListWidth } : undefined }}"))
        assert.ok(source.includes('autoAdjustOverflow'))
        assert.ok(source.includes('getPopupContainer={() => document.body}'))
        assert.ok(source.includes("document.addEventListener('mousedown', closeOnOutsideMouseDown, true)"))
        assert.ok(source.includes("target.closest('.netdive-connected-resource-popover-overlay')"))
        assert.ok(source.includes('resourceCardRef.current?.contains(target)'))
        assert.ok(source.includes('event.stopPropagation()'))
        const css = read('src/DataPanels/common/DetailComponents.css')
        const tokens = read('src/DataPanels/common/DetailDesignTokens.css')
        assert.ok(css.includes('.netdive-connected-resource-popover {'))
        assert.ok(css.includes('width: 100%'))
        assert.ok(css.includes('min-width: min(260px, calc(100vw - 24px))'))
        assert.ok(css.includes('.netdive-detail-resource--with-resource-list.ant-btn'))
        assert.ok(tokens.includes('--netdive-detail-resource-action-width: 32%'))
        assert.ok(css.includes('var(--netdive-detail-resource-action-width)'))
        assert.ok(css.includes('minmax(var(--netdive-detail-resource-value-min-width), max-content)'))
        assert.ok(css.includes('grid-column: 3'))
        assert.ok(css.includes('width: 100%'))
        assert.ok(css.includes('justify-content: center'))
        assert.ok(css.includes('stroke-width: 32'))
    })

    it('wraps long names and shows the full-name tooltip outside the scrollable overlay', () => {
        const source = read('src/DataPanels/common/DetailComponents.tsx')
        const css = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(source.includes('<Tooltip title={item.tooltip || item.name} placement="topLeft"'))
        assert.ok(source.includes("classNames={{ root: 'netdive-connected-resource-name-tooltip' }}"))
        assert.ok(source.includes('getPopupContainer={detailTooltipPopupContainer} autoAdjustOverflow'))
        assert.ok(css.includes('.netdive-connected-resource-popover__name.ant-typography'))
        const nameStyle = css.match(/\.netdive-connected-resource-popover__name\.ant-typography\s*\{([^}]+)\}/)![1]
        assert.ok(nameStyle.includes('white-space: normal'))
        assert.ok(nameStyle.includes('overflow-wrap: anywhere'))
        assert.ok(css.includes('max-width: min(640px, calc(100vw - 24px))'))
        assert.ok(css.includes('grid-template-columns: 28px minmax(0, 1fr) 14px'))
    })

    it('keeps zero counts static and separates navigation from the native popup trigger', () => {
        const source = read('src/DataPanels/common/DetailComponents.tsx')
        const css = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(source.includes('hoverable={interactive}'))
        assert.ok(source.includes('onClick={interactive ? onClick : undefined}'))
        assert.ok(source.includes('hasResourceList ? <Popover'))
        assert.ok(source.includes('onClick={event => event.stopPropagation()}'))
        assert.ok(source.includes(': interactive && <RightOutlined />'))
        assert.ok(source.includes('<Card.Meta'))
        assert.ok(source.includes('formatter={() => value}'))
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

    it('sorts shared connected-resource lists by display name using natural numeric order', () => {
        const source = read('src/DataPanels/common/DetailComponents.tsx')
        assert.ok(source.includes('const sortConnectedResourceItems'))
        assert.ok(source.includes('leftName.localeCompare(rightName, undefined'))
        assert.ok(source.includes('numeric: true'))
        assert.ok(source.includes('dataSource={sortedItems}'))
        assert.ok(source.includes('sortConnectedResourceItems(group.items).map'))
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
