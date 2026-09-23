import * as React from 'react'
import { Alert, Button, Form, Input, Space, Tag } from 'antd'
import { ExperimentOutlined, KeyOutlined, SaveOutlined } from '@ant-design/icons'

import { session } from './Store'
import {
  getMoldCredentialsStatus,
  MoldCredentialsInput,
  saveMoldCredentials,
  testMoldCredentials
} from './MoldCredentialsAPI'

import './MoldCredentialsPanel.css'

interface Props {
  userSession?: session
}

type Feedback = { type: 'success' | 'error' | 'info', message: string } | null

const MoldCredentialsPanel = ({ userSession }: Props) => {
  const [apiKey, setAPIKey] = React.useState('')
  const [secretKey, setSecretKey] = React.useState('')
  const [dbPassword, setDBPassword] = React.useState('')
  const [apiConfigured, setAPIConfigured] = React.useState(false)
  const [dbPasswordConfigured, setDBPasswordConfigured] = React.useState(false)
  const [loadingStatus, setLoadingStatus] = React.useState(true)
  const [busy, setBusy] = React.useState<'test' | 'save' | null>(null)
  const [feedback, setFeedback] = React.useState<Feedback>(null)

  React.useEffect(() => {
    let active = true
    getMoldCredentialsStatus(userSession)
      .then(status => {
        if (active) {
          setAPIConfigured(status.apiConfigured)
          setDBPasswordConfigured(status.dbPasswordConfigured)
        }
      })
      .catch(error => {
        if (active) setFeedback({ type: 'error', message: error.message })
      })
      .finally(() => {
        if (active) setLoadingStatus(false)
      })
    return () => { active = false }
  }, [userSession])

  const input = (): MoldCredentialsInput => ({
    apiKey: apiKey.trim(),
    secretKey: secretKey.trim(),
    dbPassword: dbPassword.trim()
  })
  const canTest = apiKey.trim() !== '' && secretKey.trim() !== '' && busy === null
  const canSave = canTest && (dbPasswordConfigured || dbPassword.trim() !== '')

  const test = async () => {
    setBusy('test')
    setFeedback(null)
    try {
      const status = await testMoldCredentials(userSession, input())
      setFeedback({ type: 'success', message: status.message || 'Mold API 연결에 성공했습니다.' })
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    setBusy('save')
    setFeedback(null)
    try {
      const status = await saveMoldCredentials(userSession, input())
      setAPIConfigured(status.apiConfigured)
      setDBPasswordConfigured(status.dbPasswordConfigured)
      setAPIKey('')
      setSecretKey('')
      setDBPassword('')
      setFeedback({ type: 'success', message: status.message || 'Mold API 연동 정보를 저장했습니다.' })
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setBusy(null)
    }
  }

  return <div className="mold-credentials-settings">
    <section className="mold-credentials-status-card">
      <span className="mold-credentials-status-icon"><KeyOutlined /></span>
      <div>
        <strong>연동 상태</strong>
        <p>API 키와 DB 비밀번호는 Netdive DB에 암호화되어 저장되며 다시 표시되지 않습니다.</p>
      </div>
      <Space>
        {loadingStatus
          ? <Tag>확인 중</Tag>
          : <React.Fragment>
            <Tag color={apiConfigured ? 'success' : 'warning'}>API {apiConfigured ? '설정됨' : '미설정'}</Tag>
            <Tag color={dbPasswordConfigured ? 'success' : 'warning'}>DB {dbPasswordConfigured ? '설정됨' : '미설정'}</Tag>
          </React.Fragment>}
      </Space>
    </section>

    <Form layout="vertical" className="mold-credentials-form" onFinish={save}>
      <Form.Item label="API Key" required>
        <Input.Password
          value={apiKey}
          onChange={event => setAPIKey(event.target.value)}
          placeholder="Mold API Key 입력"
          autoComplete="off"
          maxLength={4096}
          disabled={busy !== null}
        />
      </Form.Item>
      <Form.Item label="Secret Key" required>
        <Input.Password
          value={secretKey}
          onChange={event => setSecretKey(event.target.value)}
          placeholder="Mold Secret Key 입력"
          autoComplete="new-password"
          maxLength={4096}
          disabled={busy !== null}
        />
      </Form.Item>
      <Form.Item
        label="Mold DB Password"
        required={!dbPasswordConfigured}
        extra={dbPasswordConfigured ? '현재 값이 설정되어 있습니다. 변경할 경우에만 새 비밀번호를 입력하세요.' : '최초 설정에 필요한 Mold DB 비밀번호를 입력하세요.'}>
        <Input.Password
          value={dbPassword}
          onChange={event => setDBPassword(event.target.value)}
          placeholder={dbPasswordConfigured ? '변경할 경우에만 입력' : 'Mold DB Password 입력'}
          autoComplete="new-password"
          maxLength={4096}
          disabled={busy !== null}
        />
      </Form.Item>

      {feedback && <Alert showIcon type={feedback.type} message={feedback.message} />}

      <div className="mold-credentials-actions">
        <Space>
          <Button
            icon={<ExperimentOutlined />}
            onClick={test}
            disabled={!canTest}
            loading={busy === 'test'}>
            API 연결 테스트
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            disabled={!canSave}
            loading={busy === 'save'}>
            저장
          </Button>
        </Space>
      </div>
    </Form>
  </div>
}

export default MoldCredentialsPanel
