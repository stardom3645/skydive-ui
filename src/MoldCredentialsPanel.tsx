import * as React from 'react'
import { Alert, Button, Collapse, Form, Input, Popconfirm, Space, Spin, Tag, Tooltip } from 'antd'
import {
  CheckCircleFilled,
  CloudServerOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
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
import { moldIntegrationIssue, moldIntegrationLabel, moldIntegrationDescription } from './MoldIntegrationHealth'
import type { MoldIntegrationHealth } from './MoldIntegrationHealth'

interface Props {
  userSession?: session
  initialSetup?: boolean
  onCancel?: () => void
  onSaved?: () => void
  onReset?: () => void
  health?: MoldIntegrationHealth
}

type Feedback = { type: 'success' | 'error' | 'info', message: string } | null

const MoldCredentialsPanel = ({ userSession, initialSetup = false, onCancel, onSaved, onReset, health }: Props) => {
  const [apiKey, setAPIKey] = React.useState('')
  const [secretKey, setSecretKey] = React.useState('')
  const [apiConfigured, setAPIConfigured] = React.useState<boolean | undefined>(undefined)
  const [dbPasswordConfigured, setDBPasswordConfigured] = React.useState<boolean | undefined>(undefined)
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
  const [editingAPI, setEditingAPI] = React.useState(false)
  const statusRequest = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    let active = true
    const controller = new AbortController()
    statusRequest.current = controller
    setLoadingStatus(true)
    getMoldCredentialsStatus(userSession, controller.signal)
      .then(status => {
        if (active && !controller.signal.aborted) {
          setAPIConfigured(status.apiConfigured)
          setDBPasswordConfigured(status.dbPasswordConfigured)
          setMoldUIURL(status.uiURL || '')
        }
      })
      .catch(error => {
        if (active && !controller.signal.aborted) setFeedback({ type: 'error', message: error.message })
      })
      .finally(() => {
        if (active && !controller.signal.aborted) setLoadingStatus(false)
      })
    return () => { active = false; controller.abort() }
  }, [userSession?.endpoint, userSession?.token])

  const stopStatusRequest = () => {
    statusRequest.current?.abort()
    setLoadingStatus(false)
  }

  const input = (): MoldCredentialsInput => ({
    apiKey: apiKey.trim(),
    secretKey: secretKey.trim(),
    dbPassword: ''
  })
  const showAPIInput = initialSetup || editingAPI || (health?.state !== 'HEALTHY' &&
    (loadingStatus || !apiConfigured || health?.state === 'AUTHENTICATION_FAILED'))
  const canTestAPI = apiKey.trim() !== '' && secretKey.trim() !== '' && busy === null
  const canTestDB = dbPasswordConfigured && busy === null
  const canSave = apiKey.trim() !== '' && secretKey.trim() !== '' &&
    (!initialSetup || dbPasswordConfigured) && busy === null &&
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
    stopStatusRequest()
    setBusy('save')
    setFeedback(null)
    try {
      const status = await saveMoldCredentials(userSession, input())
      setAPIConfigured(status.apiConfigured)
      setDBPasswordConfigured(status.dbPasswordConfigured)
      setAPIKey('')
      setSecretKey('')
      setEditingAPI(false)
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
    stopStatusRequest()
    setBusy('reset')
    setFeedback(null)
    try {
      const status = await resetMoldCredentials(userSession)
      setAPIConfigured(status.apiConfigured)
      setDBPasswordConfigured(status.dbPasswordConfigured)
      setAPIKey('')
      setSecretKey('')
      setEditingAPI(true)
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

  const accountHelp = moldUIURL && <span className="mold-credentials-account-tools">
    <a className="mold-credentials-account-link" href={moldUIURL} target="_blank" rel="noopener noreferrer">
      {translate('moldOpenAccountUser')} <ExportOutlined />
    </a>
    <Tooltip placement="bottomLeft" classNames={{ root: 'mold-credentials-account-help-tooltip' }}
      title={<div className="mold-credentials-account-help">
        <strong>{translate('moldAPIKeyHelpTitle')}</strong>
        <ol>{['moldAPIKeyHelpAdminFilter', 'moldAPIKeyHelpSelectAdmin', 'moldAPIKeyHelpOpenTab', 'moldAPIKeyHelpGenerate']
          .map(key => <li key={key}>{translate(key)}</li>)}</ol>
      </div>}>
      <button type="button" className="mold-credentials-account-help-trigger" aria-label={translate('moldAPIKeyHelpTitle')}>
        <QuestionCircleOutlined />
      </button>
    </Tooltip>
  </span>

  const apiFields = <div className="mold-credentials-fields">
    <Form.Item label={translate('moldAPIKey')} required>
      <Input.Password aria-label={translate('moldAPIKey')} value={apiKey}
        onChange={event => { setEditingAPI(true); setAPIKey(event.target.value); setAPIFeedback(null); setAPITestPassed(false) }}
        placeholder={translate('moldAPIKeyPlaceholder')} autoComplete="off" maxLength={4096} disabled={busy !== null} />
    </Form.Item>
    <Form.Item label={translate('moldSecretKey')} required>
      <Input.Password aria-label={translate('moldSecretKey')} value={secretKey}
        onChange={event => { setEditingAPI(true); setSecretKey(event.target.value); setAPIFeedback(null); setAPITestPassed(false) }}
        placeholder={translate('moldSecretKeyPlaceholder')} autoComplete="new-password" maxLength={4096} disabled={busy !== null} />
    </Form.Item>
  </div>

  const resetAction = <Popconfirm
    title={<div className="mold-credentials-reset-confirm">
      <strong>{translate('moldResetConfirmTitle')}</strong><span>{translate('moldResetConfirmDescription')}</span>
    </div>}
    okText={translate('moldReset')} cancelText={translate('moldCancel')} okButtonProps={{ danger: true }} onConfirm={reset}>
    <Button danger type={initialSetup ? 'default' : 'text'} size="small" icon={<DeleteOutlined />}
      disabled={busy !== null} loading={busy === 'reset'}>{translate('moldResetConnection')}</Button>
  </Popconfirm>

  const dbContent = <div className="mold-credentials-db-advanced-body">
    {dbPasswordConfigured ? <React.Fragment>
      <p className="mold-settings-description">{translate('moldDBStoredConnectionDescription')}</p>
      <Button size="small" icon={<ExperimentOutlined />} onClick={testDB} disabled={!canTestDB} loading={busy === 'db-test'}>
        {translate('moldDBTest')}
      </Button>
    </React.Fragment> : <Alert showIcon type="warning"
      title={translate(dbPasswordConfigured === undefined ? 'moldDBStatusUnavailable' : 'moldDBSystemNotConfigured')} />}
    {dbFeedback && <Alert showIcon type={dbFeedback.type} title={dbFeedback.message} />}
  </div>

  if (!initialSetup) {
    const state = health?.state || 'UNKNOWN'
    const registration = apiConfigured === true || state === 'HEALTHY'
      ? 'moldCredentialsRegistered' : apiConfigured === false ? 'moldCredentialsUnregistered' : loadingStatus ? 'moldChecking' : 'moldStatusUnknown'
    const connectionTag = state === 'HEALTHY' ? 'moldConnected' : state === 'UNCONFIGURED' ? 'moldNotConfigured'
      : state === 'UNKNOWN' ? 'moldChecking' : 'moldDisconnected'
    const feedbackLine = (value: Feedback) => value && <div
      role={value.type === 'error' ? 'alert' : 'status'} className={`mold-settings-feedback is-${value.type}`}>
      {value.type === 'success' ? <CheckCircleFilled /> : value.type === 'error' ? <ExclamationCircleOutlined /> : <InfoCircleOutlined />}
      <span>{value.message}</span>
    </div>
    return <div className="mold-credentials-settings mold-settings">
      <Form layout="vertical" className="mold-settings-form" onFinish={save}>
        <section className="mold-settings-section" aria-labelledby="mold-connection-heading">
          <div className="mold-settings-section-heading">
            <h3 id="mold-connection-heading">{translate('moldConnectionStatus')}</h3>
            <Tag color={state === 'HEALTHY' ? 'success' : moldIntegrationIssue(health) ? 'error' : 'default'}>
              {translate(connectionTag)}
            </Tag>
          </div>
          <div className={`mold-settings-connection is-${state.toLowerCase()}`} role="status">
            <span className="mold-settings-connection-icon" aria-hidden="true">
              {state === 'HEALTHY' ? <CheckCircleFilled /> : moldIntegrationIssue(health) ? <ExclamationCircleOutlined /> : <InfoCircleOutlined />}
            </span>
            <div><strong>{state === 'HEALTHY' ? translate('moldAuthenticationSuccess') : health ? moldIntegrationLabel(health) : translate('moldChecking')}</strong>
              <p className="mold-settings-description">{health ? moldIntegrationDescription(health) : translate('moldConnectionPendingDescription')}</p>
            </div>
          </div>
        </section>

        <section className="mold-settings-section" aria-labelledby="mold-api-credentials-heading">
          <div className="mold-settings-section-heading">
            <div className="mold-settings-section-title"><h3 id="mold-api-credentials-heading">{translate('moldAPICredentialsTitle')}</h3>
              <Tag>{translate(registration)}</Tag>
            </div>
            {!showAPIInput && <Button size="small" onClick={() => setEditingAPI(true)} disabled={busy !== null}>
              {translate('moldCredentialsEdit')}
            </Button>}
          </div>
          {apiConfigured === false && <p className="mold-settings-empty">{translate('moldCredentialsEmptyDescription')}</p>}
          <p className="mold-settings-description">{translate('moldCredentialsStorageDescription')}</p>
          {accountHelp}
          {showAPIInput && apiFields}
          {feedbackLine(apiFeedback)}
          {feedbackLine(feedback)}
          <div className="mold-settings-actions">
            {resetAction}
            {showAPIInput && <Space wrap size={8} className="mold-settings-edit-actions">
              <Button size="small" icon={<ExperimentOutlined />} onClick={testAPI} disabled={!canTestAPI} loading={busy === 'api-test'}>
                {translate('moldAPITest')}
              </Button>
              <Button size="small" type="primary" htmlType="submit" icon={<SaveOutlined />} disabled={!canSave} loading={busy === 'save'}>
                {translate('moldSave')}
              </Button>
            </Space>}
          </div>
        </section>

        <Collapse className="mold-settings-advanced mold-credentials-db-advanced" bordered={false}
          activeKey={dbSettingsOpen ? ['db'] : []} onChange={keys => setDBSettingsOpen(keys.includes('db'))}
          expandIconPlacement="end" items={[{ key: 'db',
            label: <div className="mold-settings-advanced-label"><h3>{translate('moldDBAdvancedTitle')}</h3>
              <span className="mold-settings-description">{translate('moldDBManagedDescription')}</span></div>,
            extra: <Tag>{translate(dbPasswordConfigured === undefined ? loadingStatus ? 'moldChecking' : 'moldStatusUnknown'
              : dbPasswordConfigured ? 'moldConfigured' : 'moldNotConfigured')}</Tag>, children: dbContent }]} />
      </Form>
    </div>
  }

  return <div className="mold-credentials-settings mold-credentials-initial-setup">
    <div className="mold-credentials-setup-steps" aria-label="Mold 연동 설정 단계">
      {[1, 2, 3].map(step => <React.Fragment key={step}>
        {step > 1 && <span className={`mold-credentials-setup-step-line${setupStep >= step ? ' is-complete' : ''}`} />}
        <div className={`mold-credentials-setup-step${setupStepClass(step)}`}>
          <span className="mold-credentials-setup-step-marker">{setupStep > step ? '✓' : String(step)}</span>
          <span>{translate(step === 1 ? 'moldAPI' : step === 2 ? 'moldDB' : 'moldSaveAndConnect')}</span>
        </div>
      </React.Fragment>)}
    </div>
    <div className="mold-credentials-setup-intro"><div>
      <strong>{translate(setupStep === 1 ? 'moldAPIConnectTitle' : setupStep === 2 ? 'moldDBConnectTitle' : 'moldReadyTitle')}</strong>
      <span>{translate(setupStep === 1 ? 'moldAPIConnectDescription' : setupStep === 2 ? 'moldDBConnectDescription' : 'moldReadyDescription')}</span>
    </div></div>
    <Form layout="horizontal" labelCol={{ span: 7 }} wrapperCol={{ span: 16 }} className="mold-credentials-form" onFinish={save}>
      {setupStep === 1 && <section className="mold-credentials-test-section">
        <div className="mold-credentials-test-section-header"><div className="mold-credentials-test-section-identity">
          <span className="mold-credentials-test-section-icon"><CloudServerOutlined /></span>
          <div><strong>{translate('moldAPI')}</strong><span>{translate('moldAPIPairDescription')} {accountHelp}</span></div>
        </div></div>
        {apiFields}
        {apiFeedback && <Alert showIcon type={apiFeedback.type} message={apiFeedback.message} />}
      </section>}
      {setupStep === 2 && <section className="mold-credentials-test-section">
        <div className="mold-credentials-test-section-header"><div className="mold-credentials-test-section-identity">
          <span className="mold-credentials-test-section-icon"><DatabaseOutlined /></span>
          <div><strong>{translate('moldDB')}</strong><span>{translate('moldDBTestDescription')}</span></div>
        </div></div>
        <div className={`mold-credentials-configured-value${!loadingStatus && !dbPasswordConfigured ? ' is-missing' : ''}`}>
          {loadingStatus ? <React.Fragment><Spin size="small" /><span>{translate('moldChecking')}</span></React.Fragment>
            : dbPasswordConfigured ? <React.Fragment><CheckCircleFilled className="mold-credentials-configured-icon" />
              <div><strong>{translate('moldDBConfiguredTitle')}</strong><span>{translate('moldDBStoredConnectionDescription')}</span></div>
              <Tag color="success">{translate('moldConfigured')}</Tag></React.Fragment>
              : <Alert showIcon type="warning" message={translate('moldDBSystemNotConfigured')} />}
        </div>
        {dbFeedback && <Alert showIcon type={dbFeedback.type} message={dbFeedback.message} />}
      </section>}
      {setupStep === 3 && <section className="mold-credentials-review">
        {['moldAPIReviewComplete', 'moldDBReviewComplete'].map((key, index) => <div key={key} className="mold-credentials-review-row">
          <span className="mold-credentials-review-check">✓</span><div><strong>{translate(index === 0 ? 'moldAPI' : 'moldDB')}</strong><span>{translate(key)}</span></div>
        </div>)}
      </section>}
      {feedback && <Alert showIcon type={feedback.type} message={feedback.message} />}
      <div className="mold-credentials-actions"><Space>
        {onCancel && <Button onClick={onCancel} disabled={busy !== null}>{translate('moldConfigureLater')}</Button>}
        {setupStep > 1 && <Button onClick={() => setSetupStep(setupStep === 3 ? 2 : 1)} disabled={busy !== null}>{translate('moldPrevious')}</Button>}
      </Space><Space className="mold-credentials-primary-actions">
        {apiConfigured && resetAction}
        {setupStep === 1 && <Button type="primary" icon={<ExperimentOutlined />} onClick={testAPI} disabled={!canTestAPI} loading={busy === 'api-test'}>{translate('moldNext')}</Button>}
        {setupStep === 2 && <Button type="primary" icon={<ExperimentOutlined />} onClick={testDB} disabled={!canTestDB} loading={busy === 'db-test'}>{translate('moldNext')}</Button>}
        {setupStep === 3 && <Button type="primary" htmlType="submit" icon={<SaveOutlined />} disabled={!canSave} loading={busy === 'save'}>{translate('moldSaveAndConnect')}</Button>}
      </Space></div>
    </Form>
  </div>
}

export default MoldCredentialsPanel
