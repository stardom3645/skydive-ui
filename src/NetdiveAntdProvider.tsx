import * as React from 'react'
import { ConfigProvider } from 'antd'
import enUS from 'antd/es/locale/en_US'
import koKR from 'antd/es/locale/ko_KR'

interface Props {
  children: React.ReactNode
}

const locale = () => {
  return localStorage.getItem('language') === 'en' ? enUS : koKR
}

const NetdiveAntdProvider = ({ children }: Props) => (
  <ConfigProvider
    locale={locale()}
    getPopupContainer={(triggerNode?: HTMLElement) => triggerNode?.parentElement || document.body}
  >
    <div className="netdive-ant-theme">{children}</div>
  </ConfigProvider>
)

export default NetdiveAntdProvider
