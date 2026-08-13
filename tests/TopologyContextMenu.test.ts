import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Topology context menu contract', () => {
    it('uses the shared navigation menu and removes capture actions', () => {
        const topology = read('src/Topology.tsx')
        const config = read('src/Config.ts')
        const defaultMenu = config.slice(
            config.lastIndexOf('    nodeMenu(node: Node): Array<MenuItem> {'),
            config.lastIndexOf('    nodeTags(data: any): Array<string> {')
        )

        ;[
            "text: '상세 보기'",
            "text: '화면 중앙으로 이동'",
            "text: '연결 자원 보기'",
            "text: isExpanded ? '하위 자원 접기' : '하위 자원 펼치기'",
            "text: '이상 경로 보기'",
            "text: '이름 복사'"
        ].forEach(label => assert.ok(topology.includes(label), `missing menu item: ${label}`))
        assert.ok(topology.includes("type TopologyFocusMode = 'connections' | 'problems'"))
        assert.ok(topology.includes('kubernetesTopologyNodeNeedsAttention(node)'))
        assert.ok(topology.includes("classed('topology-focus-dim'"))
        assert.ok(defaultMenu.includes('캡처 작업은 상세 패널에서만 제공합니다.'))
        assert.ok(!defaultMenu.includes('new window.API.CapturesApi'))
    })

    it('keeps context actions capability-based and restores focus', () => {
        const topology = read('src/Topology.tsx')
        const menu = read('src/TopologyContextMenu.tsx')
        const topologyCss = read('src/Topology.css')
        assert.ok(topology.includes('if (connectionFocus.nodeIDs.size > 1)'))
        assert.ok(topology.includes('if (hasChildren)'))
        assert.ok(topology.includes('if (hasProblemPath)'))
        assert.ok(topology.includes('this.clearTopologyNodeFocus()'))
        assert.ok(topology.includes('this.applyTopologyNodeFocus()'))
        assert.ok(topology.includes("this.gHieraLinks.selectAll('path.hiera-link').each"))
        assert.ok(topology.includes("this.gLinks.selectAll('path.link').each"))
        assert.ok(topology.includes('this.linkDisplayOpacity(link) <= 0'))
        assert.ok(topology.includes('focus.relationLinkIDs.has(link.id)'))
        assert.ok(topology.includes('focus.visibleRelationLinkIDs.has(link.id)'))
        assert.ok(topology.includes('focus.hierarchyLinkKeys.has(key)'))
        assert.ok(topology.includes('if (event.keyCode === 27)'))
        assert.ok(topology.includes('this.topologyNodeFocus.anchorID !== id'))
        assert.ok(!topology.includes('window.setTimeout(() => this.clearTopologyNodeFocus'))
        assert.ok(topologyCss.includes('filter: opacity(16%)'))
        assert.ok(!topologyCss.includes('.topology-focus-hit'))
        const focusCss = topologyCss.slice(topologyCss.indexOf('.topology-focus-dim'), topologyCss.indexOf('.MuiTableCell-root'))
        assert.ok(!focusCss.includes('opacity:'))
        assert.ok(menu.includes("renderSection('navigation', '탐색')"))
        assert.ok(menu.includes("renderSection('topology', '토폴로지')"))
        assert.ok(menu.includes('<Menu.Item key={action.key} icon={actionIcon(action.key)}>'))
    })

    it('shares the rendered direct-level Badge children with group detail rows', () => {
        const topology = read('src/Topology.tsx')
        const app = read('src/App.tsx')
        const selection = read('src/SelectionPanel.tsx')
        const groupDetail = read('src/DataPanels/GroupDetailPanel.tsx')

        assert.ok(topology.includes('topologyBadgeChildren(node: Node): Node[]'))
        assert.ok(topology.includes('return this.renderedKubernetesBadgeChildren(rendered.data)'))
        assert.ok(topology.includes('this.synthesizedKubernetesBadgeChildren(node)'))
        assert.ok(topology.includes('Pods are the actual next layer below a workload'))
        assert.ok(topology.includes('normalizeTreeHeight inserts Hidden wrappers'))
        assert.ok(topology.includes('collectNextRendered(child.children)'))
        assert.ok(app.includes('this.tc.topologyBadgeChildren(node)'))
        assert.ok(selection.includes('topologyBadgeChildren={this.props.topologyBadgeChildren}'))
        assert.ok(groupDetail.includes('kubernetesTopologyCountBadges(node, badgeChildren)'))
        assert.ok(groupDetail.includes('kubernetesTopologyBadgeGroupSummary(node, topologyBadges, badgeChildren)'))
    })

    it('keeps Kubernetes level gaps independent from resource type', () => {
        const topology = read('src/Topology.tsx')
        assert.ok(topology.includes('? nodeHeight + (topologyWorkloadCardHeight - topologyCardHeight)'))
        assert.ok(!topology.includes('kubernetesWorkloadVerticalGapBoost'))
    })
})
