import * as React from 'react'
import { Alert, Button, Form, Input, Popconfirm, Space, Spin, Tag, Tooltip } from 'antd'
import {
  CheckCircleFilled,
  CloudServerOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownOutlined,
  ExperimentOutlined,
  ExportOutlined,
  QuestionCircleOutlined,
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
  const [apiConfigured, setAPIConfigured] = React.useState(false)
  const [dbPasswordConfigured, setDBPasswordConfigured] = React.useState(false)
  const [moldUIURL, setMoldUIURL] = React.useState('')
  const [loadingStatus, setLoadingStatus] = React.useState(true)
  const [busy, setBusy] = React.useState<'api-test' | 'db-test' | 'save' | 'reset' | null>(null)
  const [feedback, setFeedback] = React.useState<Feedback>(null)
  const [apiFeedback, setAPIFeedback] = React.useState<Feedback>(null)
  const [dbFeedback, setDBFeedback] = React.useState<Feedback>(null)
  const [setupStep, setSetupStep] = React.useState<1 | 2 | 3>(1)
  const [apiTestPassed, setAPITestPassed] = React.useState(false)
  const [dbTestPassed, setDBTestPassed] = React.useState(false)
  const [dbSettingsOpen, setDBSettingsOpen] = React.useState(false)

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
      .finally(() => {
        if (active) setLoadingStatus(false)
      })
    return () => { active = false }
  }, [userSession])

  const input = (): MoldCredentialsInput => ({
    apiKey: apiKey.trim(),
    secretKey: secretKey.trim(),
    dbPassword: ''
  })
  const showAPIInput = initialSetup || (!loadingStatus && !apiConfigured)
  const canTestAPI = apiKey.trim() !== '' && secretKey.trim() !== '' && busy === null
  const canTestDB = dbPasswordConfigured && busy === null
  const canSave = apiKey.trim() !== '' && secretKey.trim() !== '' &&
    dbPasswordConfigured && busy === null &&
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
      await testMoldDBConnection(userSession, '')
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
      const status = await resetMoldCredentials(userSession)
      setAPIConfigured(status.apiConfigured)
      setDBPasswordConfigured(status.dbPasswordConfigured)
      setAPIKey('')
      setSecretKey('')
      setAPIFeedback(null)
      setDBFeedback(null)
      setAPITestPassed(false)
      setDBTestPassed(false)
      setSetupStep(1)
      setLoadingStatus(false)
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
                </a>{' '}
                <Tooltip
                  placement="bottomLeft"
                  overlayClassName="mold-credentials-account-help-tooltip"
                  title={<div className="mold-credentials-account-help">
                    <strong>{translate('moldAPIKeyHelpTitle')}</strong>
                    <ol>
                      <li>{translate('moldAPIKeyHelpAdminFilter')}</li>
                      <li>{translate('moldAPIKeyHelpSelectAdmin')}</li>
                      <li>{translate('moldAPIKeyHelpOpenTab')}</li>
                      <li>{translate('moldAPIKeyHelpGenerate')}</li>
                    </ol>
                  </div>}>
                  <button
                    type="button"
                    className="mold-credentials-account-help-trigger"
                    aria-label={translate('moldAPIKeyHelpTitle')}>
                    <QuestionCircleOutlined />
                  </button>
                </Tooltip></React.Fragment>}
              </span>
            </div>
          </div>
          {!initialSetup && showAPIInput && <Button
              icon={<ExperimentOutlined />}
              onClick={testAPI}
              disabled={!canTestAPI}
              loading={busy === 'api-test'}>
              {translate('moldAPITest')}
            </Button>}
        </div>
        {showAPIInput
          ? <React.Fragment>
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
          </React.Fragment>
          : <div className="mold-credentials-configured-value">
            {loadingStatus
              ? <React.Fragment><Spin size="small" /><span>{translate('moldChecking')}</span></React.Fragment>
              : <React.Fragment>
                <CheckCircleFilled className="mold-credentials-configured-icon" />
                <div>
                  <strong>{translate('moldAPIConfiguredTitle')}</strong>
                  <span>{translate('moldConfiguredValueHidden')}</span>
                </div>
                <Tag color="success">{translate('moldConfigured')}</Tag>
              </React.Fragment>}
          </div>}
        {apiFeedback && <Alert showIcon type={apiFeedback.type} message={apiFeedback.message} />}
      </section>}

      {(!initialSetup || setupStep === 2) && (!initialSetup
        ? <section className="mold-credentials-db-advanced">
          <button
            type="button"
            className="mold-credentials-db-advanced-toggle"
            aria-expanded={dbSettingsOpen}
            onClick={() => setDBSettingsOpen(!dbSettingsOpen)}>
            <span className="mold-credentials-test-section-icon"><DatabaseOutlined /></span>
            <span className="mold-credentials-db-advanced-copy">
              <strong>{translate('moldDBAdvancedTitle')}</strong>
              <span>{translate('moldDBManagedDescription')}</span>
            </span>
            {!loadingStatus && <Tag color={dbPasswordConfigured ? 'success' : 'warning'}>
              {translate(dbPasswordConfigured ? 'moldConfigured' : 'moldNotConfigured')}
            </Tag>}
            <DownOutlined className={dbSettingsOpen ? 'is-open' : ''} />
          </button>
          {dbSettingsOpen && <div className="mold-credentials-db-advanced-body">
            {dbPasswordConfigured
              ? <React.Fragment>
                <div className="mold-credentials-db-private-note">
                  <CheckCircleFilled />
                  <span>{translate('moldDBStoredConnectionDescription')}</span>
                </div>
                <Button
                  icon={<ExperimentOutlined />}
                  onClick={testDB}
                  disabled={!canTestDB}
                  loading={busy === 'db-test'}>
                  {translate('moldDBTest')}
                </Button>
              </React.Fragment>
              : <Alert showIcon type="warning" message={translate('moldDBSystemNotConfigured')} />}
            {dbFeedback && <Alert showIcon type={dbFeedback.type} message={dbFeedback.message} />}
          </div>}
        </section>
        : <section className="mold-credentials-test-section">
        <div className="mold-credentials-test-section-header">
          <div className="mold-credentials-test-section-identity">
            <span className="mold-credentials-test-section-icon"><DatabaseOutlined /></span>
            <div>
              <strong>{translate('moldDB')}</strong>
              <span>{translate('moldDBTestDescription')}</span>
            </div>
          </div>
        </div>
        <div className={`mold-credentials-configured-value${!loadingStatus && !dbPasswordConfigured ? ' is-missing' : ''}`}>
          {loadingStatus
            ? <React.Fragment><Spin size="small" /><span>{translate('moldChecking')}</span></React.Fragment>
            : dbPasswordConfigured
              ? <React.Fragment>
                <CheckCircleFilled className="mold-credentials-configured-icon" />
                <div>
                  <strong>{translate('moldDBConfiguredTitle')}</strong>
                  <span>{translate('moldDBStoredConnectionDescription')}</span>
                </div>
                <Tag color="success">{translate('moldConfigured')}</Tag>
              </React.Fragment>
              : <Alert showIcon type="warning" message={translate('moldDBSystemNotConfigured')} />}
        </div>
        {dbFeedback && <Alert showIcon type={dbFeedback.type} message={dbFeedback.message} />}
      </section>)}

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
          {apiConfigured && <Popconfirm
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
          {(initialSetup ? setupStep === 3 : showAPIInput) && <Button
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
