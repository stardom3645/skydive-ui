import * as React from 'react'
import { Button, Card, List, Space, Tag, Tooltip, Typography, theme } from 'antd'
import { AimOutlined, InfoCircleOutlined, NodeIndexOutlined, RightOutlined } from '@ant-design/icons'
import { ProblemStatus, problemStatusLabels } from './CurrentProblems'
import { OverflowTooltip } from './OverflowTooltip'

// Presentation only: translate known observed states, retaining their source
// text below. Do not turn an unfamiliar reason into a guessed diagnosis.
const readableStates: Record<string, string> = {
    'Ready=false': '준비되지 않은 상태',
    'Ready=Unknown': '준비 상태를 확인할 수 없음',
    'MemoryPressure=true': '메모리 자원 부족 상태',
    'DiskPressure=true': '디스크 자원 부족 상태',
    'PIDPressure=true': '프로세스 수용 여유 부족',
    'NetworkUnavailable=true': '네트워크 사용 불가 상태',
    CrashLoopBackOff: '반복 재시작으로 대기 중',
    ImagePullBackOff: '이미지 다운로드 재시도 대기',
    ErrImagePull: '이미지 다운로드 실패',
    OOMKilled: '메모리 부족으로 종료됨'
}

export default function TopologyProblemContext({ name, typeLabel, scope, clusterName, namespace, status, reason, collectedAt, related,
    onClear, onCenter, onReturn, onInspect, onRelated }: {
    name: string; typeLabel?: string; scope?: string; clusterName?: string; namespace?: string
    status?: ProblemStatus; reason?: string; collectedAt?: string
    related: Array<{ id: string; name: string; typeLabel?: string; status: ProblemStatus }>
    onClear: () => void; onCenter: () => void; onReturn: () => void; onInspect: () => void
    onRelated: (id: string) => void
}) {
    const { token } = theme.useToken()
    const issueStyle = { '--problem-context-accent': status === 'problem' ? token.colorError
        : status === 'attention' ? token.colorWarning : token.colorBorderSecondary } as React.CSSProperties
    const observation = !!reason?.startsWith('관측값 · ')
    const originalReason = (observation ? reason!.slice('관측값 · '.length) : reason) || '판정 사유를 확인할 수 없습니다.'
    const displayReason = originalReason.replace(/\b(?:Ready=(?:false|Unknown)|(?:MemoryPressure|DiskPressure|PIDPressure|NetworkUnavailable)=true|CrashLoopBackOff|ImagePullBackOff|ErrImagePull|OOMKilled)\b/g,
        value => readableStates[value])
    const undated = !collectedAt || collectedAt === '확인 불가'
    const collectionLabel = undated ? '마지막 수집 시각 미확인' : `최근 수집 ${collectedAt}`
    const collectionHelp = undated
        ? '수집 시각을 확인할 수 없어 현재 표시 상태의 최신성을 보장할 수 없습니다. 객체 상세에서 수집 상태와 현재 지속 여부를 확인하세요.'
        : observation ? '표시된 수집 시각과 함께 객체 상세에서 수집 상태 및 현재 지속 여부를 확인하세요.'
            : '마지막으로 확인된 수집 시각입니다. 객체 상세에서 현재 상태를 확인할 수 있습니다.'
    return <Card size="small" className="topology-problem-context" role="region" aria-label="토폴로지 문제 탐색"
        title={<Space size={6}><NodeIndexOutlined />문제 탐색</Space>}
        extra={<Button type="text" size="small" aria-label="문제 자원 강조 해제" onClick={onClear}>해제 <kbd>Esc</kbd></Button>}
        onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
        <div className="topology-problem-context__content">
            <section className="topology-problem-context__identity" aria-label="선택 객체">
                <div className="topology-problem-context__section-heading">
                    <Typography.Text strong className="topology-problem-context__section-title">선택 객체</Typography.Text>
                    {typeLabel && <Tag>{typeLabel}</Tag>}
                </div>
                <div className="topology-problem-context__identity-heading">
                    <Typography.Paragraph strong className="topology-problem-context__name" ellipsis={{ rows: 2, tooltip: name }}>{name}</Typography.Paragraph>
                    <Tooltip title="선택 객체 중앙에 표시">
                        <Button type="text" size="small" icon={<AimOutlined />} aria-label={`${name} · 중앙에 표시`} onClick={onCenter} />
                    </Tooltip>
                </div>
                {(clusterName || namespace || scope) && <dl className="topology-problem-context__scope">
                    {clusterName && <><dt>클러스터</dt><dd><Typography.Text ellipsis={{ tooltip: clusterName }}>{clusterName}</Typography.Text></dd></>}
                    {namespace && <><dt>네임스페이스</dt><dd><Typography.Text ellipsis={{ tooltip: namespace }}>{namespace}</Typography.Text></dd></>}
                    {!clusterName && !namespace && scope && <><dt>소속</dt><dd><Typography.Paragraph ellipsis={{ rows: 2, tooltip: scope }}>{scope}</Typography.Paragraph></dd></>}
                </dl>}
            </section>
            <section className="topology-problem-context__issue" aria-label="발견된 문제" style={issueStyle}>
                <div className="topology-problem-context__section-heading">
                    <Typography.Text type="secondary">발견된 문제</Typography.Text>
                    {observation && <Tag>관측값</Tag>}
                </div>
                <Typography.Title level={5} className="topology-problem-context__reason" ellipsis={{ rows: 3, tooltip: displayReason }}>{displayReason}</Typography.Title>
                {displayReason !== originalReason && <Typography.Paragraph type="secondary" className="topology-problem-context__original">
                    원본: <Typography.Text code>{originalReason}</Typography.Text>
                </Typography.Paragraph>}
            </section>
            <section className="topology-problem-context__related" aria-label="함께 확인할 객체">
                <div className="topology-problem-context__section-heading">
                    <Typography.Text strong className="topology-problem-context__section-title">함께 확인할 객체{related.length > 0 && ` · ${related.length}`}</Typography.Text>
                    <Tooltip title="기존 관계 정보에서 확인된 관련 문제 객체입니다. 장애 원인이나 영향 전파를 의미하지 않습니다." trigger={['hover', 'focus']}>
                        <InfoCircleOutlined tabIndex={0} aria-label="관련 객체 관계 안내" />
                    </Tooltip>
                </div>
                <List size="small" className="topology-problem-context__related-list" aria-label="관련 문제 객체 목록"
                    locale={{ emptyText: <Typography.Text type="secondary">표시할 관련 문제 객체가 없습니다.</Typography.Text> }}
                    dataSource={related} renderItem={resource => <List.Item>
                        <Typography.Link href="#" className="topology-problem-context__related-link"
                            onClick={event => { event.preventDefault(); onRelated(resource.id) }}>
                            <span className="topology-problem-context__related-identity">
                                <OverflowTooltip title={resource.name}><Typography.Text ellipsis>{resource.name}</Typography.Text></OverflowTooltip>
                                <Typography.Text type="secondary">{resource.typeLabel || '유형 미확인'}</Typography.Text>
                            </span>
                            <Space size={4}>
                                <Tag color={resource.status === 'problem' ? 'error' : resource.status === 'attention' ? 'warning' : 'default'}>{problemStatusLabels[resource.status]}</Tag>
                                <RightOutlined aria-hidden="true" />
                            </Space>
                        </Typography.Link>
                    </List.Item>} />
            </section>
            <section className="topology-problem-context__collection" aria-label="수집 상태">
                <Tooltip title={collectionHelp} trigger={['hover', 'focus']}><InfoCircleOutlined tabIndex={0} aria-label="수집 신뢰성 안내" /></Tooltip>
                <Typography.Text type="secondary">{collectionLabel}</Typography.Text>
            </section>
        </div>
        <div className="topology-problem-context__actions">
            <Space size={8} wrap>
                <Button onClick={onReturn}>문제 목록</Button>
                <Button type="primary" onClick={onInspect}>객체 상세</Button>
            </Space>
        </div>
    </Card>
}
