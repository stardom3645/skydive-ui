import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

import { appendSelectionHistory, appendSelectionHistoryAt, nextSelectionTarget, previousSelectionTarget } from '../src/SelectionHistory'

describe('Detail selection history', () => {
  it('does not duplicate an unchanged selection', () => {
    const history = [{ id: 'node-a', name: 'Node A' }]
    assert.strictEqual(appendSelectionHistory(history, { id: 'node-a', name: 'Node A' }), history)
  })

  it('returns the previous valid resource and skips removed resources', () => {
    const history = [
      { id: 'node-a', name: 'Node A' },
      { id: 'removed', name: 'Removed' },
      { id: 'node-b', name: 'Node B' }
    ]
    const target = previousSelectionTarget(history, 2, id => id !== 'removed')
    assert.deepStrictEqual(target, { item: history[0], index: 0 })
  })

  it('returns the next valid resource and skips removed resources', () => {
    const history = [
      { id: 'node-a', name: 'Node A' },
      { id: 'removed', name: 'Removed' },
      { id: 'node-b', name: 'Node B' }
    ]
    const target = nextSelectionTarget(history, 0, id => id !== 'removed')
    assert.deepStrictEqual(target, { item: history[2], index: 2 })
  })

  it('drops forward history when a new resource is selected after going back', () => {
    const history = [
      { id: 'node-a', name: 'Node A' },
      { id: 'node-b', name: 'Node B' },
      { id: 'node-c', name: 'Node C' }
    ]
    const next = appendSelectionHistoryAt(history, 1, { id: 'node-d', name: 'Node D' })
    assert.deepStrictEqual(next, {
      history: [history[0], history[1], { id: 'node-d', name: 'Node D' }],
      index: 2
    })
  })

  it('uses the shared Ant header action and the existing reveal/select/center path', () => {
    const root = path.resolve(__dirname, '..')
    const panel = fs.readFileSync(path.join(root, 'src/SelectionPanel.tsx'), 'utf8')
    const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
    assert.ok(panel.includes('icon={<ArrowLeftOutlined className="netdive-action-icon--previous" />}'))
    assert.ok(panel.includes('icon={<ArrowRightOutlined className="netdive-action-icon--next" />}'))
    assert.ok(panel.includes('className="netdive-action-icon-button"'))
    assert.ok(!panel.includes('{translate("previousSelection")}'))
    const antTheme = fs.readFileSync(path.join(root, 'src/antd-netdive.css'), 'utf8')
    assert.ok(antTheme.includes('.netdive-action-icon--previous'))
    assert.ok(antTheme.includes('font-size: 16px'))
    assert.ok(panel.includes('className={classes.tabNavigationActions}'))
    assert.ok(panel.includes('className={classes.tabObjectActions}'))
    assert.ok(panel.indexOf('className={classes.tabNavigationActions}') < panel.indexOf('className={classes.tabObjectActions}'))
    assert.ok(!panel.includes('<Divider type="vertical" />'))
    assert.ok(panel.includes('previousSelectionNamedTooltip'))
    assert.ok(panel.includes('nextSelectionNamedTooltip'))
    assert.ok(app.includes('navigateConnectedResources([target.item.id], undefined, true)'))
    assert.ok(app.includes('selectionHistoryNavigating'))
    assert.ok(app.includes('navigateToNextSelection'))
    assert.ok(app.includes('selectionHistoryIndex'))
  })

  it('renders only the active object in the shared detail header', () => {
    const root = path.resolve(__dirname, '..')
    const panel = fs.readFileSync(path.join(root, 'src/SelectionPanel.tsx'), 'utf8')
    const activeOnlyGuards = panel.match(/if \(this\.state\.tab !== i\) \{/g) || []
    assert.strictEqual(activeOnlyGuards.length, 2)
    assert.ok(/private renderTabs[\s\S]*?if \(this\.state\.tab !== i\)[\s\S]*?<Tab[\s\S]*?value=\{i\}/.test(panel))
    assert.ok(panel.includes('this.renderNodeContext(el as Node)'))
  })
})
