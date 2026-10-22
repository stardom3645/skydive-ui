import * as React from 'react'
import { Button, Card, Tag, Tooltip, Typography } from 'antd'
import { InfoCircleOutlined, NodeIndexOutlined } from '@ant-design/icons'
import { ProblemStatus, problemStatusLabels } from './CurrentProblems'

/** Presentation only: retain the verdict and separate its observation qualifier. */
export default function TopologyProblemContext({ name, typeLabel, scope, reason, collectedAt, related,
    onClear, onCenter, onReturn, onInspect, onRelated }: {
    name: string; typeLabel?: string; scope?: string; reason?: string; collectedAt?: string
    related: Array<{ id: string; name: string; status: ProblemStatus }>
    onClear: () => void; onCenter: () => void; onReturn: () => void; onInspect: () => void
    onRelated: (id: string) => void
}) {
    const observation = !!reason?.startsWith('관측값 · ')
    const displayReason = (observation ? reason!.slice('관측값 · '.length) : reason) || '판정 사유를 확인할 수 없습니다.'
    const undated = !collectedAt || collectedAt === '확인 불가'
    const collectionLabel = undated ? '마지막 수집 시각 미확인' : `${observation ? '관측값 · ' : ''}수집 ${collectedAt}`
    const collectionHelp = undated
        ? '수집 시각을 확인할 수 없어 현재 표시 상태의 최신성을 보장할 수 없습니다. 객체 상세에서 수집 상태와 현재 지속 여부를 확인하세요.'
        : observation ? '표시된 수집 시각과 함께 객체 상세에서 수집 상태 및 현재 지속 여부를 확인하세요.'
            : '마지막으로 확인된 수집 시각입니다. 객체 상세에서 현재 상태를 확인할 수 있습니다.'
    return <Card size="small" className="topology-problem-context" role="region" aria-label="토폴로지 문제 탐색"
        title={<span><NodeIndexOutlined /> 문제 탐색 경로</span>}
        extra={<Button type="text" size="small" aria-label="문제 자원 강조 해제" onClick={onClear}><kbd>Esc</kbd><span>해제</span></Button>}
        onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
        <div className="topology-problem-context__content">
            <section className="topology-problem-context__summary" aria-label="선택 문제 요약">
                <div className="topology-problem-context__identity">
                    <Tooltip title={`${name} · 클릭하여 중앙에 표시`}>
                        <button className="topology-problem-context__name" aria-label={`${name} · 중앙에 표시`} onClick={onCenter}>
                            <Typography.Text>{name}</Typography.Text>
                        </button>
                    </Tooltip>
                    {typeLabel && <Typography.Text type="secondary" className="topology-problem-context__type">{typeLabel}</Typography.Text>}
                    {scope && <Typography.Paragraph type="secondary" className="topology-problem-context__scope" ellipsis={{ rows: 2, tooltip: scope }}>{scope}</Typography.Paragraph>}
                </div>
                <div className="topology-problem-context__issue">
                    <span className="topology-problem-context__section-title">판정 사유</span>
                    <Typography.Paragraph className="topology-problem-context__reason" ellipsis={{ rows: 3, tooltip: displayReason }}>{displayReason}</Typography.Paragraph>
                </div>
            </section>
            <div className="topology-problem-context__collection" aria-label="데이터 신뢰성">
                <Tooltip title={collectionHelp} trigger={['hover', 'focus']}><InfoCircleOutlined tabIndex={0} aria-label="수집 신뢰성 안내" /></Tooltip>
                <Typography.Text ellipsis={{ tooltip: `${collectionLabel} · ${collectionHelp}` }}>{collectionLabel}</Typography.Text>
            </div>
            <section className="topology-problem-context__exploration" aria-label="탐색 상태">
                <div className="topology-problem-context__section-heading">
                    <Typography.Text strong>탐색 상태</Typography.Text>
                    <Tooltip title="굵은 테두리는 선택 객체입니다. 색상은 관측된 상태이며, 연관 관계가 장애 원인이나 영향의 확정을 뜻하지는 않습니다." trigger={['hover', 'focus']}>
                        <InfoCircleOutlined tabIndex={0} aria-label="객체 강조 기준 안내" />
                    </Tooltip>
                </div>
                <div className="topology-problem-focus-legend" aria-label="노드 상태 범례"><span className="is-problem">문제</span><span className="is-attention">확인 필요</span><span className="is-related">연관</span></div>
                {!!related.length && <div className="topology-problem-context__related">
                    <div className="topology-problem-context__section-title">연관 문제 자원 <span>{related.length}</span></div>
                    {related.map(resource => <button key={resource.id} onClick={() => onRelated(resource.id)}>
                        <Typography.Text ellipsis={{ tooltip: resource.name }}>{resource.name}</Typography.Text>
                        <Tag color={resource.status === 'problem' ? 'error' : resource.status === 'attention' ? 'warning' : 'default'}>{problemStatusLabels[resource.status]}</Tag>
                    </button>)}
                </div>}
            </section>
        </div>
        <div className="topology-problem-context__actions">
            <Button onClick={onReturn}>문제 목록</Button>
            <Button type="primary" onClick={onInspect}>객체 상세</Button>
        </div>
    </Card>
}
