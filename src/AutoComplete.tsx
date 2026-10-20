/*
 * Copyright (C) 2019 Sylvain Afchain
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import * as React from 'react'
import { Select, Tag, Tooltip, Empty, Button, Typography } from 'antd'
import type { RefSelectProps } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { createTopologySearchIndex, TopologySearchEntry, prioritizeRecentSearch, topologySearchResultIdentity } from './TopologySearch'
import { TopologyTypeIcon } from './TopologyNodeCard'
import './AutoComplete.css'

const highlight = (text: string, query: string): React.ReactNode => {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!terms.length) return text
  const pattern = new RegExp(`(${terms.join('|')})`, 'ig')
  return text.split(pattern).map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part)
}
const displayName = (entry: TopologySearchEntry) => entry.label === entry.id ? `${entry.type} · 이름 없음` : entry.label
// Ant Typography only opens this name tooltip when its ellipsis actually clips.
const nameEllipsis = (name: string) => ({ tooltip: { title: name, placement: 'bottom' as const,
  getPopupContainer: () => document.body, classNames: { root: 'netdive-search-name-tooltip' } } })
const compactIdentity = (value: string) => value.toLowerCase().replace(/[\s._:/-]+/g, '')
const EMPTY_RECENTS: string[] = []

export default function Autocomplete({ placeholder, suggestions, onChange, onSelect, recentIDs = EMPTY_RECENTS, activeLayer = 'infrastructure' }: {
  placeholder: string; suggestions: TopologySearchEntry[]; onChange: (selected: string[]) => void; activeLayer?: string
  onSelect?: (id: string) => void; recentIDs?: string[]
}) {
  const [query, setQuery] = React.useState(''), [selected, setSelected] = React.useState<string[]>([]), [limit, setLimit] = React.useState(40)
  const [open, setOpen] = React.useState(false)
  const search = React.useRef<RefSelectProps>(null)
  const removingTag = React.useRef(false)
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K'
  const rank = React.useMemo(() => createTopologySearchIndex(suggestions), [suggestions])
  const ranked = React.useMemo(() => rank(query, activeLayer), [rank, query, activeLayer])
  const matches = React.useMemo(() => prioritizeRecentSearch(ranked, recentIDs, query), [ranked, recentIDs, query])
  const entries = React.useMemo(() => new Map(suggestions.map(entry => [entry.id, entry])), [suggestions])
  React.useEffect(() => {
    const activate = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.isComposing && event.key.toLowerCase() === 'k') {
        event.preventDefault(); event.stopPropagation(); search.current?.focus(); setOpen(true)
      }
    }
    window.addEventListener('keydown', activate, true)
    return () => window.removeEventListener('keydown', activate, true)
  }, [])
  // Deleted resources must not keep stale search pins/tags after a graph refresh.
  React.useEffect(() => {
    const next = selected.filter(id => entries.has(id))
    if (next.length !== selected.length) { setSelected(next); onChange(next) }
  }, [entries])
  return <div className="netdive-topology-search" data-netdive-search="true" onMouseDownCapture={() => { removingTag.current = false }}>
    <Select ref={search} mode="multiple" showSearch allowClear virtual filterOption={false}
      aria-label="토폴로지 객체 검색" placeholder={placeholder} prefix={<SearchOutlined />} suffixIcon={<kbd>{shortcut}</kbd>}
      variant="borderless" value={selected} searchValue={query} maxTagCount="responsive"
      open={open} onOpenChange={setOpen}
      onInputKeyDown={event => {
        removingTag.current = event.key === 'Backspace' || event.key === 'Delete'
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false) }
      }}
      defaultActiveFirstOption popupMatchSelectWidth={600} listItemHeight={56} listHeight={504} placement="bottomLeft" getPopupContainer={() => document.body}
      classNames={{ popup: { root: 'netdive-topology-search-popup' } }}
      onSearch={value => { setQuery(value); setLimit(40); setOpen(true) }}
      onChange={values => { setSelected(values); setQuery(''); setLimit(40); onChange(values) }}
      onSelect={id => { onSelect?.(id); setOpen(false) }}
      onDeselect={id => {
        // Choosing a recent result again focuses it; tag removal still removes a pin.
        if (open && !removingTag.current) {
          setSelected(selected); onChange(selected); onSelect?.(id); setOpen(false)
        }
      }}
      options={matches.slice(0, limit).map(match => ({ value: match.entry.id, label: displayName(match.entry), title: '', match }))}
      tagRender={({ value, label, closable, onClose }) => <Tooltip title={entries.has(value) ? displayName(entries.get(value)!) : label} placement="bottom" getPopupContainer={() => document.body}>
        <Tag color="blue" className="netdive-topology-search__tag" closable={closable} onClose={event => {
          removingTag.current = true
          try { onClose?.(event) } finally { removingTag.current = false }
        }}
          onMouseDown={event => { event.preventDefault(); event.stopPropagation() }}>
          <span>{entries.has(value) ? displayName(entries.get(value)!) : label}</span>
        </Tag>
      </Tooltip>}
      optionRender={option => {
        const { entry, fuzzy } = option.data.match
        const identity = topologySearchResultIdentity(option.data.match, query)
        const identityMatched = identity && query.trim().split(/\s+/).filter(Boolean).some(term =>
          identity.value.toLowerCase().includes(term.toLowerCase()) || compactIdentity(identity.value).includes(compactIdentity(term)))
        const detail = identityMatched ? `${identity!.kind} ${identity!.value}`
          : entry.context.split(' › ')[0] || (identity?.kind === 'IP' ? identity.value : '')
        const name = displayName(entry), status = entry.status || { tone: 'unknown', label: '알 수 없음', description: '상태 데이터가 없습니다.' }
        const layer = entry.layer === 'kubernetes' ? 'Kubernetes' : 'Infrastructure'
        return <div className="netdive-topology-search__result">
          <TopologyTypeIcon icon={entry.icon || ''} iconClass={entry.iconClass} href={entry.href} />
          <div className="netdive-topology-search__body">
            <div className="netdive-topology-search__heading">
              <Typography.Text strong ellipsis={nameEllipsis(name)} className="netdive-topology-search__name">{highlight(name, query)}</Typography.Text>
              <Tag className={`topology-object-status is-${status.tone}`}><span className="topology-object-status__dot" />{status.label}</Tag>
            </div>
            <div className="netdive-topology-search__meta">
              <span className="netdive-topology-search__type">{highlight(entry.type, query)}</span><span aria-hidden="true">·</span><span>{layer}</span>
              {detail && <><span aria-hidden="true">·</span><span className="netdive-topology-search__detail">{highlight(detail, query)}</span></>}
              {entry.hidden && <span className="netdive-topology-search__flag">필터로 숨김</span>}{fuzzy && <span className="netdive-topology-search__flag">유사</span>}
            </div>
          </div>
        </div>
      }}
      notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="일치하는 객체가 없습니다. 이름 일부, IP, MAC, UUID로 검색하세요." />}
      popupRender={menu => <div data-netdive-search="true">
        <div className="netdive-topology-search__summary" role="status">
          <Typography.Text strong>{query.trim() ? `검색 결과 ${matches.length.toLocaleString()}개` : '객체 검색'}</Typography.Text>
          <Typography.Text type="secondary">전체 {suggestions.length.toLocaleString()}개</Typography.Text>
        </div>
        {menu}
        <div className="netdive-topology-search__footer">
          <span className="netdive-topology-search__keys">↑↓ 탐색 · Enter 선택 · Esc 닫기</span>
          {matches.length > limit && <Button type="text" size="small" onMouseDown={event => event.preventDefault()} onClick={() => setLimit(value => value + 40)}>
            더 보기 {Math.min(limit, matches.length)} / {matches.length}
          </Button>}
        </div>
      </div>}
    />
  </div>
}
