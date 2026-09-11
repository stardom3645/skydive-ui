import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Packet capture Ant Design UI contract', () => {
  const modal = read('src/DataPanels/Capture.tsx')
  const form = read('src/DataPanels/CaptureForm.tsx')
  const styles = read('src/DataPanels/CaptureFormStyles.ts')

  it('uses the shared Ant modal shell and built-in close control', () => {
    assert.ok(modal.includes("import { Modal } from 'antd'"))
    assert.ok(modal.includes('<Modal'))
    assert.ok(modal.includes('footer={null}'))
    assert.ok(modal.includes('onCancel={this.props.onClose}'))
    assert.ok(!modal.includes('@material-ui/core/Dialog'))
    assert.ok(!modal.includes('<IconButton'))
  })

  it('keeps the full capture workflow on Ant controls', () => {
    ;['Alert', 'Button', 'Card', 'Checkbox', 'Collapse', 'Descriptions', 'Form', 'Input', 'Radio', 'Select', 'Tag']
      .forEach(control => assert.ok(form.includes(control), `missing Ant ${control}`))
    ;['<Radio.Group', '<Collapse', '<Descriptions', '<Alert', '<Form.Item', '<Select', '<Checkbox', '<Button']
      .forEach(control => assert.ok(form.includes(control), `missing ${control}`))
    assert.ok(form.includes('layout="vertical" colon={false}'))
    assert.ok(form.includes('optionLabelProp="label"'))
    ;['캡처 범위', '캡처 시간', '필터', '수집 방식', '분석 옵션', 'capture-target-policy-title', '시작 전 확인']
      .forEach(label => assert.ok(form.includes(label), `missing ${label}`))
  })

  it('does not reintroduce Material capture controls or screen-specific visual primitives', () => {
    ;['@material-ui/core/TextField', '@material-ui/core/Button', '@material-ui/core/Accordion', '@material-ui/core/Select', '@material-ui/core/Checkbox', '@material-ui/core/Snackbar']
      .forEach(control => assert.ok(!form.includes(control), `legacy control remains: ${control}`))
    assert.ok(!styles.includes('.Mui'))
    assert.ok(styles.includes('var(--netdive-ops-panel-padding)'))
    assert.ok(styles.includes('var(--netdive-ant-radius)'))
    assert.ok(styles.includes('var(--netdive-detail-section-divider)'))
  })

  it('preserves transient capture feedback behavior', () => {
    assert.ok(form.includes('window.setTimeout'))
    assert.ok(form.includes('4000'))
    assert.ok(form.includes('componentWillUnmount'))
    assert.ok(form.includes('window.clearTimeout'))
  })
})
