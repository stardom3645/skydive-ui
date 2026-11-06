import * as React from 'react'
import { Alert, Button, Dropdown, Form, Input, Modal, Popconfirm, Space, Spin, Tag, Tooltip } from 'antd'
import {
  ApiOutlined,
  CheckCircleFilled,
  CloudServerOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  ExperimentOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ExportOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  UpOutlined
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
import { moldIntegrationDescription } from './MoldIntegrationHealth'
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
  const [apiFormCollapsed, setAPIFormCollapsed] = React.useState(false)
  const [dbChecking, setDBChecking] = React.useState(false)
  const [apiHelpOpen, setAPIHelpOpen] = React.useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false)
  const statusRequest = React.useRef<AbortController | null>(null)
  const dbRequest = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    let active = true
    const controller = new AbortController()
    statusRequest.current = controller
    setLoadingStatus(true)
    setDBChecking(false)
    setBusy(current => current === 'db-test' ? null : current)
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
    return () => { active = false; controller.abort(); dbRequest.current?.abort() }
  }, [userSession?.endpoint, userSession?.token])

  React.useEffect(() => {
    if (initialSetup) return
    if (dbPasswordConfigured !== true) { setDBChecking(false); setDBFeedback(null); return }
    // One actual connection check when the settings become available. No timer
    // or background polling; closing the panel/session change cancels the check.
    const controller = new AbortController()
    dbRequest.current?.abort()
    dbRequest.current = controller
    setDBChecking(true)
    setDBFeedback(null)
    testMoldDBConnection(userSession, '', controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setDBFeedback({ type: 'success', message: translate('moldDBTestSuccess') })
      })
      .catch(error => {
        if (!controller.signal.aborted) setDBFeedback({ type: 'error', message: error.message })
      })
      .finally(() => {
        if (!controller.signal.aborted) setDBChecking(false)
        if (dbRequest.current === controller) dbRequest.current = null
      })
    return () => { controller.abort() }
  }, [initialSetup, dbPasswordConfigured, userSession?.endpoint, userSession?.token])

  const stopStatusRequest = () => {
    statusRequest.current?.abort()
    setLoadingStatus(false)
  }

  const input = (): MoldCredentialsInput => ({
    apiKey: apiKey.trim(),
    secretKey: secretKey.trim(),
    dbPassword: ''
  })
  const showAPIInput = initialSetup || (!apiFormCollapsed && (editingAPI || (health?.state !== 'HEALTHY' &&
    (loadingStatus || !apiConfigured || health?.state === 'AUTHENTICATION_FAILED'))))
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
    const controller = new AbortController()
    dbRequest.current?.abort()
    dbRequest.current = controller
    setDBChecking(false)
    setBusy('db-test')
    setDBFeedback(null)
    try {
      await testMoldDBConnection(userSession, '', controller.signal)
      if (controller.signal.aborted) return
      setDBFeedback({ type: 'success', message: translate('moldDBTestSuccess') })
      setDBTestPassed(true)
      if (initialSetup) setSetupStep(3)
    } catch (error) {
      if (controller.signal.aborted) return
      setDBTestPassed(false)
      setDBFeedback({ type: 'error', message: error.message })
    } finally {
      if (!controller.signal.aborted) setBusy(null)
      if (dbRequest.current === controller) dbRequest.current = null
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
      setAPIFormCollapsed(true)
      setAPIFeedback(null)
      if (initialSetup) setDBFeedback(null)
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
      setAPIFormCollapsed(false)
      setAPIFeedback(null)
      if (initialSetup) setDBFeedback(null)
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

  const resetConfirmation = {
    title: <div className="mold-credentials-reset-confirm">
      <strong>{translate('moldResetConfirmTitle')}</strong><span>{translate('moldResetConfirmDescription')}</span>
    </div>,
    okText: translate('moldReset'), cancelText: translate('moldCancel'), okButtonProps: { danger: true }, onConfirm: reset
  }
  const resetAction = <Popconfirm {...resetConfirmation}>
    <Button danger size="small" icon={<DeleteOutlined />}
      disabled={busy !== null} loading={busy === 'reset'}>{translate('moldResetConnection')}</Button>
  </Popconfirm>

  if (!initialSetup) {
    // Presentation only: stored credentials are not connection evidence. API
    // health describes saved keys; draft tests must not change that summary.
    type Status = 'success' | 'failure' | 'unconfigured' | 'checking'
    const state = health?.state || 'UNKNOWN'
    const savedAPIStatus: Status = apiConfigured === false || state === 'UNCONFIGURED' ? 'unconfigured'
      : state === 'HEALTHY' ? 'success' : state === 'UNKNOWN' ? 'checking' : 'failure'
    const hasAPIDraft = showAPIInput && (apiKey.trim() !== '' || secretKey.trim() !== '')
    const apiStatus: Status = busy === 'api-test' ? 'checking'
      : hasAPIDraft ? apiFeedback ? apiFeedback.type === 'success' ? 'success' : 'failure' : 'checking' : savedAPIStatus
    const dbStatus: Status = !loadingStatus && dbPasswordConfigured === false ? 'unconfigured'
      : busy === 'db-test' || dbChecking || loadingStatus ? 'checking'
        : dbFeedback ? dbFeedback.type === 'success' ? 'success' : 'failure' : 'checking'
    const integrationStatus: Status = [savedAPIStatus, dbStatus].includes('failure') ? 'failure'
      : [savedAPIStatus, dbStatus].includes('unconfigured') ? 'unconfigured'
        : savedAPIStatus === 'success' && dbStatus === 'success' ? 'success' : 'checking'
    const statusKey = (status: Status) => ({ success: 'moldSettingsSuccess', failure: 'moldSettingsFailure',
      unconfigured: 'moldNotConfigured', checking: 'moldChecking' }[status])
    const statusTag = (status: Status) => <Tag color={status === 'success' ? 'success' : status === 'failure' ? 'error' : 'default'}>
      {translate(statusKey(status))}
    </Tag>
    const feedbackLine = (value: Feedback) => value && <div
      role={value.type === 'error' ? 'alert' : 'status'} className={`mold-settings-feedback is-${value.type}`}>
      {value.type === 'success' ? <CheckCircleFilled /> : value.type === 'error' ? <ExclamationCircleOutlined /> : <InfoCircleOutlined />}
      <span>{value.message}</span>
    </div>
    const summaryKey = { success: 'moldSettingsSummarySuccess', failure: 'moldSettingsSummaryFailure',
      unconfigured: 'moldSettingsSummaryUnconfigured', checking: 'moldSettingsSummaryChecking' }[integrationStatus]
    return <div className="mold-credentials-settings mold-settings">
      <Form layout="vertical" className="mold-settings-form" onFinish={save}>
        <section className="mold-settings-section" aria-labelledby="mold-connection-heading">
          <div className="mold-settings-section-heading">
            <h3 id="mold-connection-heading">{translate('moldConnectionStatus')}</h3>
            {statusTag(integrationStatus)}
          </div>
          <div className={`mold-settings-connection is-${integrationStatus}`} role="status">
            <span className="mold-settings-connection-icon" aria-hidden="true">
              {integrationStatus === 'success' ? <CheckCircleFilled /> : integrationStatus === 'failure' ? <ExclamationCircleOutlined /> : <InfoCircleOutlined />}
            </span>
            <div><strong>{translate(summaryKey)}</strong>
              <p className="mold-settings-description mold-settings-connection-summary">
                <span><ApiOutlined aria-hidden="true" />API: {translate(statusKey(savedAPIStatus))}</span>
                <span aria-hidden="true">·</span>
                <span><DatabaseOutlined aria-hidden="true" />DB: {translate(statusKey(dbStatus))}</span>
              </p>
            </div>
          </div>
        </section>

        <section className="mold-settings-section" aria-labelledby="mold-api-credentials-heading">
          <div className="mold-settings-section-heading">
            <div className="mold-settings-section-title"><h3 id="mold-api-credentials-heading">{translate('moldAPICredentialsTitle')}</h3>
              {statusTag(apiStatus)}
            </div>
            <Space size={8}>
              <Tooltip title={showAPIInput ? translate('moldCollapse') : undefined}>
              <Button size="small" type={showAPIInput ? 'text' : 'default'} icon={showAPIInput ? <UpOutlined /> : undefined} onClick={() => {
                setAPIFormCollapsed(showAPIInput)
                setEditingAPI(!showAPIInput)
              }} disabled={busy !== null}
                aria-label={translate(showAPIInput ? 'moldCollapse' : 'moldCredentialsEdit')}
                aria-expanded={showAPIInput} aria-controls="mold-api-credentials-fields">
                {showAPIInput ? undefined : translate('moldCredentialsEdit')}
              </Button>
              </Tooltip>
              <Popconfirm {...resetConfirmation} trigger={[]} open={resetConfirmOpen} onOpenChange={setResetConfirmOpen} zIndex={1400}
                classNames={{ root: 'mold-settings-reset-popover' }}>
                <Dropdown trigger={['click']} placement="bottomRight" getPopupContainer={() => document.body}
                  styles={{ root: { zIndex: 1400 } }}
                  disabled={busy !== null} menu={{ selectable: false, items: [
                    ...(moldUIURL ? [{ key: 'issue', icon: <ExportOutlined />, label: <a href={moldUIURL} target="_blank" rel="noopener noreferrer">{translate('moldOpenAccountUser')}</a> }] : []),
                    { key: 'help', icon: <QuestionCircleOutlined />, label: translate('moldAPIKeyHelpTitle') },
                    { type: 'divider' },
                    { key: 'reset', danger: true, icon: <DeleteOutlined />, label: translate('moldResetConnection') }
                  ], onClick: ({ key }) => {
                    if (key === 'help') setAPIHelpOpen(true)
                    if (key === 'reset') setResetConfirmOpen(true)
                  } }}>
                  <Button size="small" type="text" icon={<EllipsisOutlined />} disabled={busy !== null}
                    aria-label={translate('moldAPIMoreActions')} />
                </Dropdown>
              </Popconfirm>
            </Space>
          </div>
          <p className="mold-settings-description">{translate('moldCredentialsStorageDescription')}</p>
          {apiConfigured === false && <p className="mold-settings-note">{translate('moldCredentialsEmptyDescription')}</p>}
          {savedAPIStatus === 'checking' && apiConfigured === true && <p className="mold-settings-note">{translate('moldAPIPendingVerification')}</p>}
          {savedAPIStatus === 'failure' && !hasAPIDraft && health && feedbackLine({ type: 'error', message: moldIntegrationDescription(health) })}
          {showAPIInput && <div id="mold-api-credentials-fields" className="mold-settings-management-body">{apiFields}</div>}
          {feedbackLine(apiFeedback)}
          {hasAPIDraft && apiFeedback && <p className="mold-settings-note">{translate('moldAPIDraftVerification')}</p>}
          {feedbackLine(feedback)}
          {showAPIInput && <div className="mold-settings-actions">
            <Space wrap size={8} className="mold-settings-edit-actions">
              <Button size="small" icon={<ApiOutlined />} onClick={testAPI} disabled={!canTestAPI} loading={busy === 'api-test'}>
                {translate('moldAPITest')}
              </Button>
              <Button size="small" type="primary" htmlType="submit" icon={<SaveOutlined />} disabled={!canSave} loading={busy === 'save'}>
                {translate('moldSave')}
              </Button>
            </Space>
          </div>}
        </section>

        <section className="mold-settings-section" aria-labelledby="mold-db-connection-heading">
          <div className="mold-settings-section-heading">
            <div className="mold-settings-section-title"><h3 id="mold-db-connection-heading">{translate('moldDBConnectionTitle')}</h3>
              {statusTag(dbStatus)}
            </div>
            <Space size={8}>
              <Tooltip title={dbSettingsOpen ? translate('moldCollapse') : undefined}>
              <Button size="small" type={dbSettingsOpen ? 'text' : 'default'} icon={dbSettingsOpen ? <UpOutlined /> : undefined} onClick={() => setDBSettingsOpen(!dbSettingsOpen)} disabled={busy !== null}
                aria-label={translate(dbSettingsOpen ? 'moldCollapse' : 'moldDBConnectionEdit')}
                aria-expanded={dbSettingsOpen} aria-controls="mold-db-connection-details">
                {dbSettingsOpen ? undefined : translate('moldDBConnectionEdit')}
              </Button>
              </Tooltip>
              <Button size="small" type="text" icon={<ReloadOutlined />} onClick={testDB} disabled={!canTestDB || dbChecking}
                loading={dbChecking || busy === 'db-test'} aria-label={translate('moldDBRecheck')} />
            </Space>
          </div>
          <p className="mold-settings-description">{translate('moldDBManagedDescription')}</p>
          {!loadingStatus && dbPasswordConfigured !== true && feedbackLine({ type: 'error',
            message: translate(dbPasswordConfigured === undefined ? 'moldDBStatusUnavailable' : 'moldDBSystemNotConfigured') })}
          {dbSettingsOpen && <div id="mold-db-connection-details" className="mold-settings-management-body">
            <p className="mold-settings-description">{translate('moldDBConnectionManagementDescription')}</p>
            {dbPasswordConfigured && <p className="mold-settings-note">{translate('moldDBStoredConnectionDescription')}</p>}
          </div>}
          {dbFeedback?.type === 'error' && feedbackLine(dbFeedback)}
        </section>
      </Form>
      <Modal open={apiHelpOpen} title={translate('moldAPIKeyHelpTitle')} onCancel={() => setAPIHelpOpen(false)}
        footer={null} className="netdive-list-modal" width={480} zIndex={1400}>
        <ol className="mold-settings-key-help">{['moldAPIKeyHelpAdminFilter', 'moldAPIKeyHelpSelectAdmin', 'moldAPIKeyHelpOpenTab', 'moldAPIKeyHelpGenerate']
          .map(key => <li key={key}>{translate(key)}</li>)}</ol>
      </Modal>
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
