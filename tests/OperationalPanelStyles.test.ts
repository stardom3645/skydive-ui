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

  it('keeps the status summary compact and separates its content with shared divider tokens', () => {
    assert.strictEqual(rules.statusSummaryPanel.width, 'min(940px, calc(100vw - 106px))')
    assert.strictEqual(rules.statusSummaryPanel.gap, 0)
    assert.strictEqual(rules.statusSummarySection.borderBottom, '1px solid var(--netdive-ant-divider)')
    assert.strictEqual(rules.statusSummaryCard.minHeight, undefined)
    assert.strictEqual(panel['& $statusSummaryGrid'].gridTemplateColumns, 'repeat(5, minmax(0, 1fr))')
  })

  it('shows only status, type, name and action columns in the status summary table', () => {
    const app = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
    const summary = app.slice(app.indexOf('private renderStatusSummary'), app.indexOf('private renderInfrastructurePanel'))
    assert.ok(summary.includes("renderCollectionPanelHeader(classes, '상태 요약'"))
    for (const title of ["title: '상태'", "title: '유형'", "title: '이름'", "title: '작업'"]) assert.ok(summary.includes(title))
    assert.ok(!summary.includes("title: '상태 사유'"))
    assert.ok(!summary.includes('마지막 수집 시각'))
    assert.ok(summary.includes('scroll={{ x: 640 }}'))
  })

  it('keeps status summary implemented but hidden from the drawer', () => {
    const app = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8')
    const drawer = app.slice(app.indexOf('private renderDrawerMenu(classes'), app.indexOf('\n\n  onNavigate'))
    const collection = drawer.slice(drawer.indexOf('"collection"'), drawer.indexOf('"preferences"'))
    assert.ok(app.includes('const STATUS_SUMMARY_MENU_ENABLED = false'))
    assert.ok(drawer.includes("STATUS_SUMMARY_MENU_ENABLED && this.renderDrawerMenuItem(classes, <DashboardOutlined />, '상태 요약'"))
    assert.ok(!collection.includes("'상태 요약'"))
    assert.ok(!collection.includes("'확인 필요'"))
  })
})
