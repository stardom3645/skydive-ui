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
    assert.ok(app.includes('onCancel={this.dismissMoldCredentialsWizard}'))
    assert.ok(app.includes('onSaved={this.completeMoldCredentialsWizard}'))
    assert.ok(!app.includes('Mold 연동 정보가 설정되지 않았습니다. 모든 기능'))
  })

  it('requires and submits API Key, Secret Key and DB password together during initial setup', () => {
    const panel = read('src/MoldCredentialsPanel.tsx')
    const api = read('src/MoldCredentialsAPI.ts')
    assert.ok(panel.includes('const needsDBPassword = initialSetup || !dbPasswordConfigured'))
    assert.ok(panel.includes("dbPassword.trim() !== ''"))
    assert.ok(panel.includes("{initialSetup ? '저장 및 연동' : '저장'}"))
    assert.ok(panel.includes('나중에 설정'))
    assert.ok(api.includes("request(userSession, '/api/mold/credentials/test'"))
    assert.ok(api.includes('body: JSON.stringify(input)'))
  })

  it('offers a confirmed credential-only reset from the Mold integration panel', () => {
    const panel = read('src/MoldCredentialsPanel.tsx')
    const api = read('src/MoldCredentialsAPI.ts')
    assert.ok(panel.includes('Mold 연동 정보를 초기화하시겠습니까?'))
    assert.ok(panel.includes('저장된 API Key, Secret Key와 DB 비밀번호만 삭제합니다.'))
    assert.ok(panel.includes('onConfirm={reset}'))
    assert.ok(panel.includes('연동 초기화'))
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
