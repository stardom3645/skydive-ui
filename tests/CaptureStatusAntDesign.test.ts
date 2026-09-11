import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const source = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/CaptureStatus.tsx'), 'utf8')

describe('Packet capture status detail UI contract', () => {
  it('uses Ant controls and the canonical detail-panel building blocks', () => {
    ;['Alert', 'Button', 'Collapse', 'Progress', 'Tag']
      .forEach(control => assert.ok(source.includes(control), `missing Ant ${control}`))
    ;['DetailSectionCard', 'DetailBadge', 'DetailCardSubsectionHeader', 'DetailKeyValueList', 'DetailMetricRow', 'CompactEmptyState']
      .forEach(component => assert.ok(source.includes(component), `missing shared ${component}`))
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

  it('uses shared detail tokens for surfaces and typography', () => {
    ;['--netdive-detail-card-border', '--netdive-detail-card-radius', '--netdive-detail-card-shadow', '--netdive-detail-font-section-title', '--netdive-detail-row-divider']
      .forEach(token => assert.ok(source.includes(token), `missing ${token}`))
    assert.ok(source.includes('captureSupportingSection'))
    assert.ok(source.includes('miniStatPanel'))
    assert.ok(source.includes("padding: '0 40px 0 var(--netdive-detail-card-padding-x)'"))
    assert.ok(source.includes("alignItems: 'center', justifyContent: 'center', width: 16, height: 16"))
  })
})
