import * as React from 'react'
import { Button, Collapse, Empty, Input, Select, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { FAQLanguage, FAQFilter, faqCategories, filterNetdiveFAQs, netdiveFAQs } from './NetdiveFAQContent'
import './NetdiveFAQ.css'

export default function NetdiveFAQ({ language }: { language: FAQLanguage }) {
    const ko = language === 'ko'
    const [category, setCategory] = React.useState<FAQFilter>('all')
    const [query, setQuery] = React.useState('')
    const [openKeys, setOpenKeys] = React.useState<string[]>(['refresh-intervals'])
    const results = filterNetdiveFAQs(language, category, query)
    return <div className="netdive-faq">
        <Input allowClear prefix={<SearchOutlined />} value={query}
            aria-label={ko ? 'FAQ 검색' : 'Search FAQ'}
            placeholder={ko ? '질문·답변 검색 (예: 수집 주기, 트래픽)' : 'Search questions and answers'}
            onChange={event => setQuery(event.target.value)} />
        <div className="netdive-faq__filters">
            <Select<FAQFilter> aria-label={ko ? 'FAQ 분류' : 'FAQ category'} value={category}
                onChange={setCategory} options={faqCategories.map(item => ({
                    value: item.key, label: item.label[language]
                }))} />
            <Typography.Text type="secondary" role="status" aria-live="polite">
                {ko ? `${results.length}개 / 전체 ${netdiveFAQs.length}개` : `${results.length} of ${netdiveFAQs.length}`}
            </Typography.Text>
        </div>
        {results.length ? <Collapse activeKey={openKeys} onChange={keys => setOpenKeys(typeof keys === 'string' ? [keys] : keys)}
            items={results.map(faq => ({ key: faq.id, label: faq.question[language], children:
                <div className="netdive-faq__answer">{faq.answer[language].map((paragraph, index) =>
                    <Typography.Paragraph key={index}>{paragraph}</Typography.Paragraph>)}</div>
            }))} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={ko ? '검색 조건에 맞는 질문이 없습니다.' : 'No questions match your filters.'}>
                <Button onClick={() => { setCategory('all'); setQuery('') }}>
                    {ko ? '검색·분류 초기화' : 'Reset search and category'}
                </Button>
            </Empty>}
    </div>
}
