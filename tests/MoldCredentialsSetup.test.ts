import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const read = (relativePath: string) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')

describe('Mold credential first-run setup', () => {
  it('opens a cancellable setup modal only when every Mold credential is initially absent', () => {
    const app = read('src/App.tsx')
    assert.ok(app.includes('this.checkInitialMoldCredentialsSetup()'))
    assert.ok(app.includes('!status.apiConfigured && !status.dbPasswordConfigured && !dismissed'))
    assert.ok(app.includes("window.sessionStorage.setItem(MOLD_SETUP_DISMISSED_SESSION_KEY, '1')"))
    assert.ok(app.includes('maskClosable={false}'))
    assert.ok(app.includes('onCancel={this.closeMoldCredentialsWizard}'))
    assert.ok(app.includes('onCancel={this.dismissMoldCredentialsWizard}'))
    assert.ok(app.includes('private closeMoldCredentialsWizard'))
    assert.ok(app.includes('onSaved={this.completeMoldCredentialsWizard}'))
    assert.ok(!app.includes('Mold 연동 정보가 설정되지 않았습니다. 모든 기능'))
  })

  it('requires and submits API Key, Secret Key and DB password together during initial setup', () => {
    const panel = read('src/MoldCredentialsPanel.tsx')
    const api = read('src/MoldCredentialsAPI.ts')
    assert.ok(panel.includes('const needsDBPassword = initialSetup || !dbPasswordConfigured'))
    assert.ok(panel.includes("dbPassword.trim() !== ''"))
    assert.ok(panel.includes("translate(initialSetup ? 'moldSaveAndConnect' : 'moldSave')"))
    assert.ok(panel.includes("translate('moldConfigureLater')"))
    assert.ok(api.includes("request(userSession, '/api/mold/credentials/test/api'"))
    assert.ok(api.includes("request(userSession, '/api/mold/credentials/test/db'"))
    assert.ok(api.includes('body: JSON.stringify(input)'))
    assert.ok(panel.includes("status.uiURL || ''"))
    assert.ok(panel.includes("translate('moldOpenAccountUser')"))
    assert.ok(panel.includes('href={moldUIURL}'))
    assert.ok(panel.includes('target="_blank"'))
    assert.ok(panel.includes('rel="noopener noreferrer"'))
  })

  it('uses the Mold-style blue wizard hierarchy without changing the side-panel flow', () => {
    const panel = read('src/MoldCredentialsPanel.tsx')
    const styles = read('src/MoldCredentialsPanel.css')
    assert.ok(panel.includes('mold-credentials-setup-steps'))
    assert.ok(panel.includes("translate('moldAPI')"))
    assert.ok(panel.includes("translate('moldDB')"))
    assert.ok(panel.includes("translate('moldSaveAndConnect')"))
    assert.ok(panel.includes('setupStep === 1'))
    assert.ok(panel.includes('setupStep === 2'))
    assert.ok(panel.includes('setupStep === 3'))
    assert.ok(panel.includes("if (initialSetup) setSetupStep(2)"))
    assert.ok(panel.includes("if (initialSetup) setSetupStep(3)"))
    assert.ok(panel.includes("initialSetup ? 'blue' : 'warning'"))
    assert.ok(styles.includes('.mold-credentials-setup-step.is-current'))
    assert.ok(styles.includes('justify-content: space-between'))
    assert.ok(styles.includes('.mold-credentials-status-summary'))
    assert.ok(panel.includes("translate('moldAPITest')"))
    assert.ok(panel.includes("translate('moldDBTest')"))
    assert.ok(read('src/MoldCredentialsAPI.ts').includes("translate('moldCredentialsEndpointUnavailable')"))
    const config = read('src/Config.ts')
    assert.strictEqual((config.match(/"moldCredentialsNetworkError"/g) || []).length, 2)
    assert.strictEqual((config.match(/"moldCredentialsEndpointUnavailable"/g) || []).length, 2)
  })

  it('offers a confirmed credential-only reset from the Mold integration panel', () => {
    const panel = read('src/MoldCredentialsPanel.tsx')
    const api = read('src/MoldCredentialsAPI.ts')
    assert.ok(panel.includes("translate('moldResetConfirmTitle')"))
    assert.ok(panel.includes("translate('moldResetConfirmDescription')"))
    assert.ok(panel.includes('onConfirm={reset}'))
    assert.ok(panel.includes("translate('moldResetConnection')"))
    assert.ok(api.includes("method: 'DELETE'"))
  })

  it('does not place any Mold plaintext credential filename in source configuration', () => {
    const config = read('../skydive/config/config.go')
    const analyzerConfig = read('../skydive/etc/skydive-analyzer.yml.ablecloud.default')
    const forbidden = ['mold-api-key', 'mold-secret-key', 'mold-db-password', 'apiKeyFile', 'secretKeyFile', 'passwordFile']
    forbidden.forEach(value => {
      assert.ok(!config.includes(value), `${value} remains in config defaults`)
      assert.ok(!analyzerConfig.includes(value), `${value} remains in analyzer template`)
    })
  })
})
