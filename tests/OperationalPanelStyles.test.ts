import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { createMuiTheme } from '@material-ui/core/styles'
import { styles } from '../src/AppStyles'

describe('Operational panel shared visual contract', () => {
  const rules: any = styles(createMuiTheme())
  const panel = rules.kubernetesManagerPanel

  it('shares card density across infrastructure, Kubernetes and status cards', () => {
    const card = panel['& $infrastructureSummaryCard, & $kubernetesTopologySummaryCard, & $infrastructureOverviewCard']
    assert.strictEqual(card.padding, 'var(--netdive-ops-card-padding)')
    assert.strictEqual(card.minHeight, 'var(--netdive-ops-card-height)')
    assert.strictEqual(card['&:not(div):hover:not(:disabled)'].transform, 'none')
  })

  it('keeps semantic differences as palette variables, not separate card geometry', () => {
    for (const key of ['statusSummaryCardProblem', 'statusSummaryCardAttention', 'statusSummaryCardUnavailable', 'statusSummaryCardInactive']) {
      assert.ok(Object.keys(rules[key]).every(property => property.startsWith('--netdive-card-')))
    }
    assert.strictEqual(rules.statusSummaryCardProblem['--netdive-card-icon-color'], 'var(--netdive-detail-danger)')
  })

  it('shares table cell rhythm without per-screen padding overrides', () => {
    assert.strictEqual(panel['& .ant-table .ant-table-thead > tr > th, & .ant-table .ant-table-tbody > tr > td'].padding, 'var(--netdive-ops-cell-padding)')
    assert.strictEqual(rules.kubernetesCollectionTable['& .ant-table-tbody > tr > td'].padding, undefined)
    assert.strictEqual(rules.statusSummaryTable['& .ant-table-tbody > tr > td'], undefined)
  })

  it('keeps primary status pills and secondary resource pills distinct', () => {
    assert.strictEqual(rules.statusSummaryFilters['& .ant-radio-button-wrapper-checked'].color, '#fff')
    assert.strictEqual(rules.statusSummaryResourceFilters['& .ant-radio-button-wrapper-checked'].backgroundColor, 'var(--netdive-ant-bg)')
    assert.strictEqual(rules.statusSummaryResourceFilters['& .ant-radio-button-wrapper'].border, '0 !important')
  })

  it('uses selection color only in filters, not status KPI outlines', () => {
    assert.deepStrictEqual(rules.statusSummaryCardSelected, {})
    assert.strictEqual(panel['& .ant-table'].border, 0)
  })

  it('normalizes image-backed resource icons to the shared neutral icon tone', () => {
    const cardIcons = panel['& $infrastructureSummaryCard $infrastructureCardIcon, & $kubernetesTopologySummaryCard $infrastructureCardIcon, & $infrastructureOverviewCard $infrastructureCardIcon']
    assert.strictEqual(cardIcons['& img'].filter, 'var(--netdive-ops-icon-image-filter)')
    assert.strictEqual(rules.kubernetesResourceExplorerIcon['& img'].filter, 'var(--netdive-ops-icon-image-filter)')
  })

  it('uses the Korean service label in the Kubernetes collection panel', () => {
    const app = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
    assert.ok(app.includes("kubernetesResourceExplorerTitle: 'Kubernetes 서비스'"))
    assert.ok(!app.includes("kubernetesResourceExplorerTitle: 'Kubernetes Services'"))
  })

  it('promotes events to a top-level flyout and removes the summary screen entry', () => {
    const app = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
    const drawer = app.slice(app.indexOf('private renderDrawerMenu(classes'), app.indexOf('\n\n  onNavigate'))
    const collection = drawer.slice(drawer.indexOf('"collection"'), drawer.indexOf('"preferences"'))
    assert.ok(drawer.includes('"events"'))
    assert.ok(drawer.includes("'이벤트 목록'"))
    assert.ok(drawer.includes("'자원 상태와 연결 관계의 최근 변경'"))
    assert.ok(!app.includes('private renderDrawerMenuItem'))
    assert.strictEqual(rules.drawerEventIcon['& svg'].fontSize, '20px !important')
    assert.ok(!drawer.includes("'요약'"))
    assert.ok(!app.includes('private renderStatusSummary'))
    assert.ok(!collection.includes("'상태 요약'"))
    assert.ok(!collection.includes("'확인 필요'"))
  })

  it('builds event history with the same shared panel grammar as Kubernetes collection', () => {
    const app = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
    const history = fs.readFileSync(path.resolve(__dirname, '../src/EventHistory.tsx'), 'utf8')
    for (const sharedComponent of [
      'DetailInlineSectionHeader', 'DetailFilterBar', 'DetailFilterField', 'DetailResultCount',
      'DetailTable', 'DetailResourceIdentity', 'DetailChangeDiff',
      'DetailEmpty'
    ]) assert.ok(history.includes(sharedComponent))
    for (const standaloneShell of ['<Card', '<PageHeader', '<Form', '<Row', '<Col']) {
      assert.ok(!history.includes(standaloneShell))
    }
    assert.ok(history.includes('type="info" showIcon'))
    assert.ok(history.includes('icon={<ReloadOutlined />}'))
    assert.ok(app.includes('classes.kubernetesManagerPanel, classes.kubernetesManagerPanelCompact, classes.eventHistoryPanel'))
    assert.ok(app.includes('renderHeader={refreshAction => this.renderCollectionPanelHeader'))
    assert.ok(app.includes('tableClassName={classes.kubernetesCollectionTable}'))
  })

  it('uses a narrower content-sized variant of the Kubernetes panel for events', () => {
    const app = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
    const history = fs.readFileSync(path.resolve(__dirname, '../src/EventHistory.tsx'), 'utf8')
    assert.strictEqual(rules.eventHistoryPanel.width, 'min(760px, calc(100vw - 106px))')
    assert.strictEqual(rules.eventHistoryPanel.height, undefined)
    assert.strictEqual(rules.eventHistoryPanel['& .ant-table-body'], undefined)
    assert.ok(app.includes('classes.eventHistoryPanel'))
    assert.ok(!history.includes("title: '작업'"))
    assert.ok(!history.includes('>이동</'))
    assert.ok(history.includes('scroll={{ y: 480 }}'))
    assert.ok(history.includes('showSorterTooltip={false}'))
    assert.ok(history.includes("rowClassName={event => canNavigate(event) ? 'netdive-event-history-row--navigable' : ''}"))
    assert.ok(history.includes('className="netdive-event-history-footer"'))
    assert.ok(history.includes('className="netdive-event-history-surface"'))
    assert.ok(history.includes('netdive-event-history-filter-surface'))
    assert.ok(history.includes('className="netdive-event-history-filter-pills"'))
    assert.ok(history.includes('className="netdive-event-history-context-toolbar"'))
    assert.ok(history.includes("defaultSortOrder: 'descend'"))
    assert.ok(history.includes('netdive-event-history-resource-link'))
    assert.ok(history.includes('netdive-event-history-resource-name'))
    assert.ok(!history.includes("<Tooltip title={new Date(event.occurredAt"))
    assert.ok(!history.includes("<Tooltip title={event.resourceName || event.resourceId}"))
    assert.strictEqual(rules.eventHistoryPanel['& .netdive-event-history-resource-name'].WebkitLineClamp, 3)
    assert.strictEqual(rules.eventHistoryPanel['& .netdive-event-history-footer'].flexShrink, 0)
    assert.strictEqual(rules.eventHistoryPanel['& .netdive-event-history-footer']['& .ant-alert-message'].fontSize, 'var(--netdive-ops-meta-size)')
    assert.strictEqual(rules.eventHistoryPanel['& .netdive-event-history-footer']['& .ant-alert-message'].fontWeight, 400)
    assert.strictEqual(rules.eventHistoryPanel['& .netdive-event-history-surface'].display, 'flex')
    assert.strictEqual(rules.eventHistoryPanel['& .netdive-event-history-context-toolbar'].minHeight, 30)
    assert.strictEqual(rules.eventHistoryPanel.overflow, 'hidden')
    assert.ok(history.includes("position: ['bottomRight']"))
  })
})
