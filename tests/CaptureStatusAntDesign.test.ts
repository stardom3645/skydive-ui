import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const source = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/CaptureStatus.tsx'), 'utf8')

describe('Packet capture status detail UI contract', () => {
  it('uses native Ant components for the status and results', () => {
    ;['Alert', 'Button', 'Card', 'Collapse', 'Descriptions', 'Empty', 'Progress', 'Statistic', 'Table', 'Tag']
      .forEach(control => assert.ok(source.includes(control), `missing Ant ${control}`))
    assert.ok(!source.includes('DetailComponents'))
  })

  it('removes Material controls from capture status rendering', () => {
    ;['@material-ui/core/Button', '@material-ui/core/LinearProgress', '@material-ui/core/Accordion', '@material-ui/core/Typography', '@material-ui/icons/']
      .forEach(control => assert.ok(!source.includes(control), `legacy control remains: ${control}`))
    assert.ok(!source.includes('<Accordion'))
    assert.ok(!source.includes('<LinearProgress'))
  })

  it('preserves capture lifecycle actions and result sections', () => {
    ;['중지', '다시 시도', '다운로드', '다시 캡처', '캡처 요약', '상위 통신', '프로토콜 분포', '상위 포트', '원시 플로우 보기']
      .forEach(label => assert.ok(source.includes(label), `missing ${label}`))
    assert.ok(source.includes('this.stopCapture()'))
    assert.ok(source.includes('this.downloadCapture()'))
    assert.ok(source.includes('this.props.onRetry'))
  })

  it('does not use Material styling or deprecated collapse panels', () => {
    assert.ok(!source.includes('@material-ui/'))
    assert.ok(!source.includes('withStyles'))
    assert.ok(!source.includes('Collapse.Panel'))
  })
})
