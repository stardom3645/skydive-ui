import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Selection panel single-resource header width', () => {
  it('uses the available title width while reserving the action rail outside the active line', () => {
    const styles = read('src/SelectionPanelStyles.ts')
    const tabRoot = styles.slice(styles.indexOf('tabRoot:'), styles.indexOf('tabLabelBlock:'))

    assert.ok(styles.includes("'& .MuiTabs-scroller, & .MuiTabs-flexContainer':"))
    assert.ok(tabRoot.includes("width: 'calc(100% - 136px)'"))
    assert.ok(tabRoot.includes('minWidth: 0'))
    assert.ok(tabRoot.includes("maxWidth: 'calc(100% - 136px)'"))
    assert.ok(tabRoot.includes("flex: '0 1 calc(100% - 136px)'"))
    assert.ok(tabRoot.includes("flexBasis: 'calc(100% - 136px)'"))
    assert.ok(!tabRoot.includes('minWidth: 210'))
    assert.ok(!tabRoot.includes('maxWidth: 320'))
  })
})
