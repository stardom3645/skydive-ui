import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Infrastructure summary panel density', () => {
  const styles = read('src/AppStyles.ts')
  const app = read('src/App.tsx')

  it('uses an infrastructure-only compact variant for the four KPI cards', () => {
    assert.ok(styles.includes('const infrastructureKpiCompactRatio = 0.76'))
    assert.ok(styles.includes('const infrastructureIconCompactRatio = 0.88'))
    assert.ok(styles.includes('const infrastructureGapCompactRatio = 0.88'))
    assert.ok(styles.includes("const infrastructurePanelCompactWidth = 'min(880px, calc(100vw - 106px))'"))
    assert.ok(styles.includes('infrastructureSummaryCardCompact:'))
    assert.ok(styles.includes('minHeight: 74 * infrastructureKpiCompactRatio'))
    assert.ok(styles.includes('padding: theme.spacing(0.85 * infrastructureKpiCompactRatio, 0.95 * infrastructureKpiCompactRatio)'))
    assert.ok(styles.includes("infrastructureSummaryGrid: {\n    width: '100%',\n    margin: 0"))
    assert.ok(app.includes('classes.infrastructureSummaryCardCompact'))
    assert.ok(app.includes('classes.infrastructureSummaryGrid'))
    assert.ok(styles.includes("gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'"))
  })

  it('uses a three-column overview grid while preserving the per-host two-column grid', () => {
    const overviewGrid = styles.slice(
      styles.indexOf('infrastructureOverviewGrid:'),
      styles.indexOf('infrastructureOverviewCard:')
    )
    const hostOverviewGrid = styles.slice(
      styles.indexOf('infrastructureHostOverviewGrid:'),
      styles.indexOf('infrastructureHostOverviewCardCompact:')
    )

    assert.ok(styles.includes('const infrastructureOverviewCompactRatio = 0.82'))
    assert.ok(styles.includes('infrastructureOverviewCard: {\n    minHeight: 80 * infrastructureOverviewCompactRatio'))
    assert.ok(styles.includes('padding: theme.spacing(0.68 * infrastructureOverviewCompactRatio, 0.9 * 0.92)'))
    assert.ok(overviewGrid.includes("width: '100%'"))
    assert.ok(overviewGrid.includes('margin: 0'))
    assert.ok(styles.includes("'& $infrastructureOverviewCard': {\n      minHeight: 78 * infrastructureOverviewCompactRatio"))
    assert.ok(styles.includes('infrastructureHostOverviewCardCompact: {\n    minHeight: 78 * infrastructureOverviewCompactRatio'))
    assert.ok(overviewGrid.includes("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'"))
    assert.ok(hostOverviewGrid.includes("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'"))
    assert.ok(styles.includes("textOverflow: 'ellipsis'"))
    assert.ok(styles.includes("whiteSpace: 'nowrap'"))
    assert.ok(app.includes('description &&\n              <Tooltip title={description} placement="top">'))
    assert.ok(app.includes('translate("infrastructureShowAll"), "", translate("all"), summary'))
  })

  it('reduces infrastructure section spacing without changing the shared Kubernetes panel', () => {
    assert.ok(styles.includes('infrastructureManagerPanel:'))
    assert.ok(styles.includes("right: 'auto',\n    width: infrastructurePanelCompactWidth,\n    maxWidth: 'none'"))
    assert.ok(styles.includes('gap: theme.spacing(1.5 * infrastructureOverviewCompactRatio)'))
    assert.ok(app.includes('classes.infrastructureManagerPanel'))
  })

  it('uses the shared detail-panel primary blue for every infrastructure summary icon', () => {
    const iconRenderer = app.slice(
      app.indexOf('private infrastructureIcon('),
      app.indexOf('private kubernetesIcon(')
    )

    assert.ok(iconRenderer.includes('const primaryResourceIconColor = "var(--netdive-detail-connected-resource-icon)"'))
    assert.ok(iconRenderer.includes('style={{ color: primaryResourceIconColor }}'))
    assert.ok(!iconRenderer.includes('#41a878'))
    assert.ok(!iconRenderer.includes('#6d4bd8'))
    assert.ok(!iconRenderer.includes('#7c4bd3'))
  })
})
