import * as React from 'react'
import { Button, Input, Popover, Select, Spin, Tooltip } from 'antd'
import { AppstoreOutlined, CloudOutlined, AreaChartOutlined, HddOutlined,
  ExportOutlined, DownOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import type { session } from './Store'
import { translate } from './Config'
import { CubeHost, RelatedServices, getCubeHosts, getRelatedServices, validCubePort,
  cubeHostURL, filterCubeHosts, serviceBrowserURL } from './RelatedServicesAPI'
import './RelatedServicesMenu.css'

const RelatedServicesMenu = ({ userSession }: { userSession?: session }) => {
  const [open, setOpen] = React.useState(false)
  const [cubeOpen, setCubeOpen] = React.useState(false)
  const [services, setServices] = React.useState<RelatedServices>()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [hosts, setHosts] = React.useState<CubeHost[]>()
  const [hostsLoading, setHostsLoading] = React.useState(false)
  const [hostsError, setHostsError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [ports, setPorts] = React.useState<Record<string, number>>({})
  const [retry, setRetry] = React.useState(0)
  const [hostsRetry, setHostsRetry] = React.useState(0)
  const endpoint = userSession?.endpoint, token = userSession?.token

  React.useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setServices(undefined); setLoading(true); setError('')
    setHosts(undefined); setHostsError(''); setPorts({}); setSearch('')
    getRelatedServices(userSession, controller.signal).then(setServices).catch(reason => {
      if (!controller.signal.aborted) setError(reason.message || translate('relatedServicesLoadFailed'))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [open, endpoint, token, retry])

  React.useEffect(() => {
    if (!open || !cubeOpen) return
    const controller = new AbortController()
    setHostsLoading(true); setHostsError(''); setHosts(undefined)
    getCubeHosts(userSession, controller.signal).then(setHosts).catch(reason => {
      if (!controller.signal.aborted) setHostsError(reason.message || translate('cubeHostsLoadFailed'))
    }).finally(() => { if (!controller.signal.aborted) setHostsLoading(false) })
    return () => controller.abort()
  }, [open, cubeOpen, endpoint, token, hostsRetry, retry])

  const serviceRow = (key: 'mold' | 'wall', Icon: typeof CloudOutlined, name: string, description: string) => {
    const url = serviceBrowserURL(services?.[key]?.url)
    const reason = loading ? translate('loading') : error || services?.[key]?.message || translate('relatedServiceNotConfigured')
    return <Tooltip title={url ? translate('relatedServiceNewTab') : reason} placement="left">
      <span className="netdive-related-services__row-wrap">
        {url ? <a className="netdive-related-services__row" href={url} target="_blank" rel="noopener noreferrer">
          <Icon /><span className="netdive-related-services__identity"><strong>{name}</strong><small>{description}</small></span><ExportOutlined className="netdive-related-services__external" />
        </a> : <button className="netdive-related-services__row" disabled aria-label={`${name}: ${reason}`}>
          <Icon /><span className="netdive-related-services__identity"><strong>{name}</strong><small>{description}</small></span><ExportOutlined className="netdive-related-services__external" />
        </button>}
      </span>
    </Tooltip>
  }
  const configuredPort = services?.cube?.port
  const matchingHosts = filterCubeHosts(hosts || [], search)
  const content = <div className="netdive-related-services">
    <div className="netdive-related-services__heading"><AppstoreOutlined /><strong>{translate('relatedServices')}</strong>{loading && <Spin size="small" />}</div>
    {serviceRow('mold', CloudOutlined, 'Mold', translate('relatedMoldDescription'))}
    {serviceRow('wall', AreaChartOutlined, 'Wall', translate('relatedWallDescription'))}
    {error && <div className="netdive-related-services__notice" role="status"><span>{error}</span><Button type="text" size="small" icon={<ReloadOutlined />} aria-label={translate('retry')} onClick={() => setRetry(value => value + 1)} /></div>}
    <div className="netdive-related-services__cube">
      <button className="netdive-related-services__row" aria-expanded={cubeOpen} aria-controls="netdive-cube-hosts" onClick={() => setCubeOpen(value => !value)}>
        <HddOutlined /><span className="netdive-related-services__identity"><strong>Cube</strong><small>{translate('relatedCubeDescription')}</small></span><DownOutlined className={`netdive-related-services__chevron ${cubeOpen ? 'is-open' : ''}`} />
      </button>
      {cubeOpen && <div id="netdive-cube-hosts" className="netdive-related-services__hosts">
        <Input size="small" allowClear prefix={<SearchOutlined />} placeholder={translate('cubeHostSearch')} aria-label={translate('cubeHostSearch')} value={search} onChange={event => setSearch(event.target.value)} />
        <div className="netdive-related-services__host-list" aria-busy={hostsLoading}>
          {hostsLoading ? <div className="netdive-related-services__empty"><Spin size="small" /><span>{translate('cubeHostsLoading')}</span></div>
            : hostsError ? <div className="netdive-related-services__notice" role="status"><span>{hostsError}</span><Button size="small" onClick={() => setHostsRetry(value => value + 1)}>{translate('retry')}</Button></div>
              : matchingHosts.length === 0 ? <div className="netdive-related-services__empty" role="status">{translate(hosts?.length ? 'cubeNoMatchingHosts' : 'cubeNoHosts')}</div>
                : matchingHosts.map(host => {
                  const validIP = !!cubeHostURL(host.managementIp, 9090)
                  const port = validCubePort(configuredPort) ? configuredPort : ports[host.id]
                  const url = !loading && !error ? cubeHostURL(host.managementIp, port) : undefined
                  const reason = !validIP ? translate('cubeHostIPMissing') : loading ? translate('loading') : error || translate('cubeChoosePort')
                  const identity = <span className="netdive-related-services__identity"><strong>{host.name}</strong><small>{host.managementIp || translate('cubeHostIPMissing')}</small></span>
                  return <div className="netdive-related-services__host" key={host.id}>
                    <Tooltip title={url ? translate('relatedServiceNewTab') : reason} placement="left">
                      <span className="netdive-related-services__row-wrap">{url
                        ? <a className="netdive-related-services__host-link" href={url} target="_blank" rel="noopener noreferrer">{identity}<ExportOutlined /></a>
                        : <button className="netdive-related-services__host-link" disabled aria-label={`${host.name}: ${reason}`}>{identity}<ExportOutlined /></button>}</span>
                    </Tooltip>
                    {!loading && !error && !validCubePort(configuredPort) && validIP && <Select size="small" className="netdive-related-services__port" placeholder={translate('cubeChoosePort')} aria-label={`${host.name} ${translate('cubeChoosePort')}`}
                      value={ports[host.id]} onChange={value => setPorts(previous => ({ ...previous, [host.id]: value }))} options={[{ value: 9090, label: '9090' }, { value: 19100, label: '19100' }]} />}
                  </div>
                })}
        </div>
        {!loading && !error && !validCubePort(configuredPort) && (hosts?.length || 0) > 0 && <p className="netdive-related-services__hint">{translate('cubePortFallback')}</p>}
      </div>}
    </div>
  </div>
  return <Popover trigger="click" placement="bottomRight" open={open} onOpenChange={value => { setOpen(value); if (!value) setCubeOpen(false) }} content={content}
    classNames={{ root: 'netdive-related-services-popup' }} arrow={false}>
    <Tooltip title={translate('relatedServices')}>
      <Button className="netdive-related-services-trigger" type="text" shape="circle" icon={<AppstoreOutlined />} aria-label={translate('relatedServices')} aria-expanded={open} />
    </Tooltip>
  </Popover>
}

export default RelatedServicesMenu
