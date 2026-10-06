import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Selection panel single-resource header width', () => {
  it('uses the available title width while reserving the action rail outside the active line', () => {
    const css = read('src/SelectionPanel.css')
    const source = read('src/SelectionPanel.tsx')
    assert.ok(css.includes('.ant-tabs-nav-list { width: 100%; }'))
    assert.ok(css.includes('.ant-tabs-tab { width: calc(100% - 136px);'))
    assert.ok(css.includes('min-width: 0'))
    assert.ok(source.includes('items={this.renderTabs(classes).filter'))
    assert.ok(!source.includes('@material-ui/'))
  })
})
