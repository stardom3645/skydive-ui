import * as React from 'react'
import { Alert, Button, Form, Input, Space, Tag } from 'antd'
import { CheckCircleOutlined, ExperimentOutlined, KeyOutlined, SaveOutlined } from '@ant-design/icons'

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
  const [configured, setConfigured] = React.useState<boolean | null>(null)
  const [loadingStatus, setLoadingStatus] = React.useState(true)
  const [busy, setBusy] = React.useState<'test' | 'save' | null>(null)
  const [feedback, setFeedback] = React.useState<Feedback>(null)

  React.useEffect(() => {
    let active = true
    getMoldCredentialsStatus(userSession)
      .then(status => {
        if (active) setConfigured(status.configured)
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
    secretKey: secretKey.trim()
  })
  const canSubmit = apiKey.trim() !== '' && secretKey.trim() !== '' && busy === null

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
      setConfigured(status.configured)
      setAPIKey('')
      setSecretKey('')
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
        <p>키는 Netdive DB에 암호화되어 저장되며 화면에 다시 표시되지 않습니다.</p>
      </div>
      {loadingStatus
        ? <Tag>확인 중</Tag>
        : configured
          ? <Tag color="success" icon={<CheckCircleOutlined />}>설정됨</Tag>
          : <Tag color="warning">미설정</Tag>}
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

      {feedback && <Alert showIcon type={feedback.type} message={feedback.message} />}

      <div className="mold-credentials-actions">
        <Space>
          <Button
            icon={<ExperimentOutlined />}
            onClick={test}
            disabled={!canSubmit}
            loading={busy === 'test'}>
            연결 테스트
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            disabled={!canSubmit}
            loading={busy === 'save'}>
            저장
          </Button>
        </Space>
      </div>
    </Form>
  </div>
}

export default MoldCredentialsPanel
