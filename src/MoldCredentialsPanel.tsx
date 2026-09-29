import * as React from 'react'
import { Alert, Button, Form, Input, Popconfirm, Space } from 'antd'
import {
  CloudServerOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  ExportOutlined,
  SaveOutlined
} from '@ant-design/icons'

import { translate } from './Config'
import { session } from './Store'
import {
  getMoldCredentialsStatus,
  MoldCredentialsInput,
  resetMoldCredentials,
  saveMoldCredentials,
  testMoldAPIConnection,
  testMoldDBConnection
} from './MoldCredentialsAPI'

import './MoldCredentialsPanel.css'

interface Props {
  userSession?: session
  initialSetup?: boolean
  onCancel?: () => void
  onSaved?: () => void
  onReset?: () => void
}

type Feedback = { type: 'success' | 'error' | 'info', message: string } | null

const MoldCredentialsPanel = ({ userSession, initialSetup = false, onCancel, onSaved, onReset }: Props) => {
  const [apiKey, setAPIKey] = React.useState('')
  const [secretKey, setSecretKey] = React.useState('')
  const [dbPassword, setDBPassword] = React.useState('')
  const [apiConfigured, setAPIConfigured] = React.useState(false)
  const [dbPasswordConfigured, setDBPasswordConfigured] = React.useState(false)
  const [moldUIURL, setMoldUIURL] = React.useState('')
  const [busy, setBusy] = React.useState<'api-test' | 'db-test' | 'save' | 'reset' | null>(null)
  const [feedback, setFeedback] = React.useState<Feedback>(null)
  const [apiFeedback, setAPIFeedback] = React.useState<Feedback>(null)
  const [dbFeedback, setDBFeedback] = React.useState<Feedback>(null)
  const [setupStep, setSetupStep] = React.useState<1 | 2 | 3>(1)
  const [apiTestPassed, setAPITestPassed] = React.useState(false)
  const [dbTestPassed, setDBTestPassed] = React.useState(false)

  React.useEffect(() => {
    let active = true
    getMoldCredentialsStatus(userSession)
      .then(status => {
        if (active) {
          setAPIConfigured(status.apiConfigured)
          setDBPasswordConfigured(status.dbPasswordConfigured)
          setMoldUIURL(status.uiURL || '')
        }
      })
      .catch(error => {
        if (active) setFeedback({ type: 'error', message: error.message })
      })
    return () => { active = false }
  }, [userSession])

  const input = (): MoldCredentialsInput => ({
    apiKey: apiKey.trim(),
    secretKey: secretKey.trim(),
    dbPassword
  })
  const needsDBPassword = initialSetup || !dbPasswordConfigured
  const canTestAPI = apiKey.trim() !== '' && secretKey.trim() !== '' && busy === null
  const canTestDB = (dbPasswordConfigured || dbPassword.trim() !== '') && busy === null
  const canSave = apiKey.trim() !== '' && secretKey.trim() !== '' &&
    (dbPasswordConfigured || dbPassword.trim() !== '') && busy === null &&
    (!initialSetup || (apiTestPassed && dbTestPassed))

  const testAPI = async () => {
    setBusy('api-test')
    setAPIFeedback(null)
    try {
      await testMoldAPIConnection(userSession, input())
      setAPIFeedback({ type: 'success', message: translate('moldAPITestSuccess') })
      setAPITestPassed(true)
      if (initialSetup) setSetupStep(2)
    } catch (error) {
      setAPITestPassed(false)
      setAPIFeedback({ type: 'error', message: error.message })
    } finally {
      setBusy(null)
    }
  }

  const testDB = async () => {
    setBusy('db-test')
    setDBFeedback(null)
    try {
      await testMoldDBConnection(userSession, dbPassword)
      setDBFeedback({ type: 'success', message: translate('moldDBTestSuccess') })
      setDBTestPassed(true)
      if (initialSetup) setSetupStep(3)
    } catch (error) {
      setDBTestPassed(false)
      setDBFeedback({ type: 'error', message: error.message })
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
      setAPIFeedback(null)
      setDBFeedback(null)
      setAPITestPassed(false)
      setDBTestPassed(false)
      setFeedback({ type: 'success', message: translate('moldCredentialsSaveSuccess') })
      onSaved?.()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setBusy(null)
    }
  }

  const reset = async () => {
    setBusy('reset')
    setFeedback(null)
    try {
      await resetMoldCredentials(userSession)
      setAPIConfigured(false)
      setDBPasswordConfigured(false)
      setAPIKey('')
      setSecretKey('')
      setDBPassword('')
      setAPIFeedback(null)
      setDBFeedback(null)
      setAPITestPassed(false)
      setDBTestPassed(false)
      setSetupStep(1)
      setFeedback({ type: 'success', message: translate('moldCredentialsResetSuccess') })
      onReset?.()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setBusy(null)
    }
  }

  const setupStepClass = (step: number): string => {
    if (setupStep > step) return ' is-complete'
    if (setupStep === step) return ' is-current'
    return ''
  }

  return <div className={`mold-credentials-settings${initialSetup ? ' mold-credentials-initial-setup' : ''}`}>
    {initialSetup && <React.Fragment>
      <div className="mold-credentials-setup-steps" aria-label="Mold 연동 설정 단계">
        <div className={`mold-credentials-setup-step${setupStepClass(1)}`}>
          <span className="mold-credentials-setup-step-marker">{setupStep > 1 ? '✓' : '1'}</span>
          <span>{translate('moldAPI')}</span>
        </div>
        <span className={`mold-credentials-setup-step-line${setupStep > 1 ? ' is-complete' : ''}`} />
        <div className={`mold-credentials-setup-step${setupStepClass(2)}`}>
          <span className="mold-credentials-setup-step-marker">{setupStep > 2 ? '✓' : '2'}</span>
          <span>{translate('moldDB')}</span>
        </div>
        <span className={`mold-credentials-setup-step-line${setupStep > 2 ? ' is-complete' : ''}`} />
        <div className={`mold-credentials-setup-step${setupStepClass(3)}`}>
          <span className="mold-credentials-setup-step-marker">3</span>
          <span>{translate('moldSaveAndConnect')}</span>
        </div>
      </div>
      <div className="mold-credentials-setup-intro">
        <div>
          <strong>{translate(setupStep === 1 ? 'moldAPIConnectTitle' : setupStep === 2 ? 'moldDBConnectTitle' : 'moldReadyTitle')}</strong>
          <span>{translate(setupStep === 1 ? 'moldAPIConnectDescription' : setupStep === 2 ? 'moldDBConnectDescription' : 'moldReadyDescription')}</span>
        </div>
      </div>
    </React.Fragment>}

    <Form
      layout={initialSetup ? 'horizontal' : 'vertical'}
      labelCol={initialSetup ? { span: 7 } : undefined}
      wrapperCol={initialSetup ? { span: 16 } : undefined}
      className="mold-credentials-form"
      onFinish={save}>
      {(!initialSetup || setupStep === 1) && <section className="mold-credentials-test-section">
        <div className="mold-credentials-test-section-header">
          <div className="mold-credentials-test-section-identity">
            <span className="mold-credentials-test-section-icon"><CloudServerOutlined /></span>
            <div>
              <strong>{translate('moldAPI')}</strong>
              <span>
                {translate('moldAPIPairDescription')}
                {moldUIURL && <React.Fragment>{' '}<a
                  className="mold-credentials-account-link"
                  href={moldUIURL}
                  target="_blank"
                  rel="noopener noreferrer">
                  {translate('moldOpenAccountUser')} <ExportOutlined />
                </a></React.Fragment>}
              </span>
            </div>
          </div>
          {!initialSetup && <Button
              icon={<ExperimentOutlined />}
              onClick={testAPI}
              disabled={!canTestAPI}
              loading={busy === 'api-test'}>
              {translate('moldAPITest')}
            </Button>}
        </div>
        <Form.Item label={translate('moldAPIKey')} required>
          <Input.Password
            value={apiKey}
            onChange={event => { setAPIKey(event.target.value); setAPIFeedback(null); setAPITestPassed(false) }}
            placeholder={translate('moldAPIKeyPlaceholder')}
            autoComplete="off"
            maxLength={4096}
            disabled={busy !== null}
          />
        </Form.Item>
        <Form.Item label={translate('moldSecretKey')} required>
          <Input.Password
            value={secretKey}
            onChange={event => { setSecretKey(event.target.value); setAPIFeedback(null); setAPITestPassed(false) }}
            placeholder={translate('moldSecretKeyPlaceholder')}
            autoComplete="new-password"
            maxLength={4096}
            disabled={busy !== null}
          />
        </Form.Item>
        {apiFeedback && <Alert showIcon type={apiFeedback.type} message={apiFeedback.message} />}
      </section>}

      {(!initialSetup || setupStep === 2) && <section className="mold-credentials-test-section">
        <div className="mold-credentials-test-section-header">
          <div className="mold-credentials-test-section-identity">
            <span className="mold-credentials-test-section-icon"><DatabaseOutlined /></span>
            <div>
              <strong>{translate('moldDB')}</strong>
              <span>{translate('moldDBTestDescription')}</span>
            </div>
          </div>
          {!initialSetup && <Button
            icon={<ExperimentOutlined />}
            onClick={testDB}
            disabled={!canTestDB}
            loading={busy === 'db-test'}>
            {translate('moldDBTest')}
          </Button>}
        </div>
        <Form.Item
          label={translate('moldDBPassword')}
          required={needsDBPassword}
          extra={translate(dbPasswordConfigured ? 'moldDBPasswordConfiguredHelp' : 'moldDBPasswordInitialHelp')}>
          <Input.Password
            value={dbPassword}
            onChange={event => { setDBPassword(event.target.value); setDBFeedback(null); setDBTestPassed(false) }}
            placeholder={translate(dbPasswordConfigured ? 'moldDBPasswordChangePlaceholder' : 'moldDBPasswordPlaceholder')}
            autoComplete="new-password"
            maxLength={4096}
            disabled={busy !== null}
          />
        </Form.Item>
        {dbFeedback && <Alert showIcon type={dbFeedback.type} message={dbFeedback.message} />}
      </section>}

      {initialSetup && setupStep === 3 && <section className="mold-credentials-review">
        <div className="mold-credentials-review-row">
          <span className="mold-credentials-review-check">✓</span>
          <div><strong>{translate('moldAPI')}</strong><span>{translate('moldAPIReviewComplete')}</span></div>
        </div>
        <div className="mold-credentials-review-row">
          <span className="mold-credentials-review-check">✓</span>
          <div><strong>{translate('moldDB')}</strong><span>{translate('moldDBReviewComplete')}</span></div>
        </div>
      </section>}

      {feedback && <Alert showIcon type={feedback.type} message={feedback.message} />}

      <div className="mold-credentials-actions">
        <Space>
          {onCancel && <Button onClick={onCancel} disabled={busy !== null}>{translate('moldConfigureLater')}</Button>}
          {initialSetup && setupStep > 1 && <Button
            onClick={() => setSetupStep(setupStep === 3 ? 2 : 1)}
            disabled={busy !== null}>
            {translate('moldPrevious')}
          </Button>}
        </Space>
        <Space className="mold-credentials-primary-actions">
          {initialSetup && setupStep === 1 && <Button
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={testAPI}
            disabled={!canTestAPI}
            loading={busy === 'api-test'}>
            {translate('moldNext')}
          </Button>}
          {initialSetup && setupStep === 2 && <Button
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={testDB}
            disabled={!canTestDB}
            loading={busy === 'db-test'}>
            {translate('moldNext')}
          </Button>}
          {(apiConfigured || dbPasswordConfigured) && <Popconfirm
            title={<div className="mold-credentials-reset-confirm">
              <strong>{translate('moldResetConfirmTitle')}</strong>
              <span>{translate('moldResetConfirmDescription')}</span>
            </div>}
            okText={translate('moldReset')}
            cancelText={translate('moldCancel')}
            okButtonProps={{ danger: true }}
            onConfirm={reset}>
            <Button danger icon={<DeleteOutlined />} disabled={busy !== null} loading={busy === 'reset'}>
              {translate('moldResetConnection')}
            </Button>
          </Popconfirm>}
          {(!initialSetup || setupStep === 3) && <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            disabled={!canSave}
            loading={busy === 'save'}>
            {translate(initialSetup ? 'moldSaveAndConnect' : 'moldSave')}
          </Button>}
        </Space>
      </div>
    </Form>
  </div>
}

export default MoldCredentialsPanel
