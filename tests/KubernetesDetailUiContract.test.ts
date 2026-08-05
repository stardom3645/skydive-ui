import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

import { kubernetesDetailPreviewFixtures } from '../src/DataPanels/common/KubernetesDetailPreviewFixtures'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Kubernetes detail UI contract', () => {
    it('covers normal, exceptional, empty, failure, long-name, and narrow states', () => {
        const states = new Set(kubernetesDetailPreviewFixtures.map(fixture => fixture.key))
        ;['normal', 'warning', 'danger', 'empty', 'fetch-error', 'long-name', 'narrow-panel']
            .forEach(state => assert.ok(states.has(state as any), `missing ${state} fixture`))
        assert.ok(kubernetesDetailPreviewFixtures.some(fixture => fixture.panelWidth <= 340))
        assert.ok(kubernetesDetailPreviewFixtures.some(fixture => fixture.resourceName.length > 50))
    })

    it('keeps the cluster and node panels on canonical shared components', () => {
        const cluster = read('src/DataPanels/KubernetesClusterDetailPanel.tsx')
        const node = read('src/DataPanels/KubernetesNodeDetailPanel.tsx')
        ;['DetailSectionCard', 'BasicInfoRows', 'StatusSummaryGrid', 'ResourceMetricBlock', 'RelatedResourceGrid', 'CompactEmptyState']
            .forEach(component => {
                assert.ok(cluster.includes(component), `cluster does not use ${component}`)
                assert.ok(node.includes(component), `node does not use ${component}`)
            })
        assert.ok(cluster.includes('StatusEvidenceRow'))
        assert.ok(node.includes('StatusEvidenceRow'))
    })

    it('defines the fixed visual tokens and removes node-specific duplicate metric rows', () => {
        const tokens = read('src/DataPanels/common/DetailDesignTokens.css')
        const common = read('src/DataPanels/common/DetailComponents.css')
        const commonComponents = read('src/DataPanels/common/DetailComponents.tsx')
        const cluster = read('src/DataPanels/KubernetesClusterDetailPanel.tsx')
        const clusterCss = read('src/DataPanels/KubernetesClusterDetailPanel.css')
        const node = read('src/DataPanels/KubernetesNodeDetailPanel.tsx')
        const nodeCss = read('src/DataPanels/KubernetesNodeDetailPanel.css')
        ;[
            '--netdive-detail-panel-gap',
            '--netdive-detail-card-padding-x',
            '--netdive-detail-row-height',
            '--netdive-detail-evidence-row-padding-y',
            '--netdive-detail-evidence-column-gap',
            '--netdive-detail-evidence-info-gap',
            '--netdive-detail-progress-height',
            '--netdive-detail-result-state-width',
            '--netdive-detail-result-value-width',
            '--netdive-detail-resource-icon-size',
            '--netdive-detail-resource-value-min-width',
            '--netdive-detail-resource-action-width',
            '--netdive-detail-resource-column-gap',
            '--netdive-detail-font-panel-title: 15px',
            '--netdive-detail-font-section-title: 14px',
            '--netdive-detail-font-primary-value: 16px',
            '--netdive-detail-font-body-label: 12px',
            '--netdive-detail-font-supporting-text: 11px',
            '--netdive-detail-font-status-tag: 11px',
            '--netdive-detail-font-tooltip-body: 12px'
        ].forEach(token => assert.ok(tokens.includes(token), `missing ${token}`))
        assert.ok(!nodeCss.includes('netdive-k8s-node-detail__resource-row'))
        assert.ok(!nodeCss.includes('netdive-k8s-node-detail__dependency-metrics'))
        assert.ok(!nodeCss.includes('netdive-k8s-node-detail__metric-rows'))
        assert.ok(cluster.includes('BasicInfoRows density="compact"'))
        assert.ok(node.includes('BasicInfoRows density="compact"'))
        assert.ok(!clusterCss.includes('basic-kv .netdive-detail-kv__row'))
        assert.ok(!nodeCss.includes('basic-kv .netdive-detail-kv__row'))
        assert.ok(common.includes('@container (max-width: 360px)'))
        assert.ok(common.includes('.netdive-detail-empty--compact:not(.ant-empty)'))
        assert.ok(commonComponents.includes("joinClassNames('netdive-list-modal', className)"))
    })

    it('keeps node information hierarchy and workload exploration compact', () => {
        const node = read('src/DataPanels/KubernetesNodeDetailPanel.tsx')
        const nodeCss = read('src/DataPanels/KubernetesNodeDetailPanel.css')
        const common = read('src/DataPanels/common/DetailComponents.tsx')
        assert.ok(node.includes('DetailAdvancedInfo'))
        assert.ok(common.includes('netdive-detail-advanced-collapse'))
        assert.ok(node.includes('density="compact"'))
        assert.ok(common.includes("density?: 'default' | 'compact'"))
        assert.ok(!nodeCss.includes('netdive-k8s-node-detail__condition-summary'))
        assert.ok(node.includes('riskModalConfigs'))
        assert.ok(node.includes("riskModal: 'single-replica'"))
        assert.ok(node.includes("riskModal: 'local-storage'"))
        assert.ok(node.includes('workloadModalOpen'))
        assert.ok(node.includes('HistoryModal'))
        assert.ok(node.includes('title={`전체 워크로드 컨트롤러 ${workloads.length}개`}'))
        assert.ok(node.includes("label: 'Pod 사용량'"))
        assert.ok(node.includes('nodeConditionDescription(condition)'))
        assert.ok(node.includes('tooltipRawValue={rawCondition}'))
        assert.ok(node.includes('tooltipRawValue={NODE_METRIC_MAPPING.singleReplicaRaw}'))
        assert.ok(node.includes('현재 노드에 배치된 Deployment·StatefulSet 중 replica가 1개인 워크로드입니다.'))
        assert.ok(node.includes("onClick: workloads.length ? () => this.setState({ workloadModalOpen: true"))
        assert.ok(!node.includes('workloadsExpanded'))
        assert.ok(!nodeCss.includes('workload-filters'))
        assert.ok(!nodeCss.includes('workload-more'))
        assert.ok(!nodeCss.includes('workload-heading'))
        assert.ok(!nodeCss.includes('workload-list'))
        assert.ok(!nodeCss.includes('condition-tooltip'))
        assert.ok(node.includes('return `${display} Core`'))
    })

    it('keeps risk evaluation rows separate from connected-resource exploration', () => {
        const node = read('src/DataPanels/KubernetesNodeDetailPanel.tsx')
        const nodeCss = read('src/DataPanels/KubernetesNodeDetailPanel.css')
        assert.ok(!node.includes('title="관련 위험 워크로드"'))
        assert.ok(!node.includes('relatedRiskWorkloads'))
        assert.ok(!node.includes('DetailCompactResourceList'))
        assert.ok(!node.includes('DetailCompactResourceItem'))
        assert.ok(node.includes("'single-replica': { title: '단일 Replica 워크로드'"))
        assert.ok(node.includes("'local-storage': { title: '로컬 스토리지 의존 워크로드'"))
        assert.ok(node.includes('const localStorageDependencies = kubernetesNodeLocalStorageDependencies(connected.pods, allNodes)'))
        assert.ok(node.includes("pending: { title: 'Pending Pod'"))
        assert.ok(node.includes("restart: { title: '최근 재시작 Pod'"))
        assert.ok(node.includes("'oom-killed': { title: '현재·최근 OOMKilled Pod'"))
        assert.ok(node.includes("onClick={() => this.setState({ riskModal: 'single-replica' })}"))
        assert.ok(node.includes("onClick={() => this.setState({ riskModal: 'local-storage' })}"))
        assert.ok(node.includes("this.setState({ riskModal: item[5] as RiskModalKey })"))
        assert.ok(node.includes('집계 결과는 있으나 연결된 리소스를 현재 토폴로지에서 확인할 수 없습니다.'))
        assert.ok(!node.includes('netdive-k8s-node-detail__problem-list-title'))
        assert.ok(!nodeCss.includes('netdive-k8s-node-detail__problem-list-title'))
        assert.ok(node.includes("label: 'Pod', count: connected.pods.length"))
        assert.ok(node.includes("this.setState({ podModalOpen: true })"))
        assert.ok(node.includes('title={`전체 Pod ${connected.pods.length}개`}'))
        assert.ok(node.includes('title={`전체 워크로드 컨트롤러 ${workloads.length}개`}'))
        assert.ok(node.includes("title: '이 노드의 Pod'"))
        assert.ok(node.includes("['현재·최근 OOMKilled 파드'"))
        assert.ok(node.includes('현재 종료 상태이거나 조회 기간 내 OOMKilled가 발생한 Pod입니다.'))
        assert.strictEqual((node.match(/childrenColumnName="__netdiveNoTreeChildren"/g) || []).length, 2)
        assert.ok(node.includes("metadata={item[6]}"))
        assert.ok(node.includes("{ key: 'window', label: '조회 기간', value: '최근 1시간' }"))
        assert.ok(node.includes("{ key: 'history', label: '누적 이력', value: `${restartHistoryPodCount}개` }"))
        assert.ok(node.includes("{ key: 'history', label: '누적 이력', value: `${oomKilledHistoryPodCount}개` }"))
        assert.ok(!node.includes('evidenceTooltip='))
        const common = read('src/DataPanels/common/DetailComponents.tsx')
        const commonCss = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(common.includes('metadata?: ReadonlyArray'))
        assert.ok(common.includes('netdive-detail-evidence-row__metadata'))
        const evidenceRule = commonCss.match(/\.netdive-detail-evidence-row__evidence\s*\{([\s\S]*?)\}/)
        assert.ok(evidenceRule)
        assert.ok(!evidenceRule![1].includes('line-clamp'))
        assert.ok(!evidenceRule![1].includes('ellipsis'))
        assert.ok(!evidenceRule![1].includes('overflow: hidden'))
    })

    it('uses the shared operational tooltip hierarchy for cluster and node KPIs', () => {
        const common = read('src/DataPanels/common/DetailComponents.tsx')
        const commonCss = read('src/DataPanels/common/DetailComponents.css')
        const node = read('src/DataPanels/KubernetesNodeDetailPanel.tsx')
        const nodeCss = read('src/DataPanels/KubernetesNodeDetailPanel.css')
        const clusterCss = read('src/DataPanels/KubernetesClusterDetailPanel.css')
        assert.ok(common.includes('tooltipDetail?: React.ReactNode'))
        assert.ok(common.includes('tooltipRawValue?: React.ReactNode'))
        assert.ok(common.includes('원본 값: {rawValue}'))
        assert.ok(common.includes('overlayClassName="netdive-operational-tooltip"'))
        assert.ok(commonCss.includes('.netdive-operational-tooltip .ant-tooltip-inner'))
        assert.ok(commonCss.includes('max-width: 320px'))
        assert.ok(commonCss.includes('white-space: normal'))
        assert.ok(node.includes('현재 노드에 할당된 고유 Pod 중 Succeeded·Failed 종료 Pod와 삭제 대상을 제외한 수입니다.'))
        assert.ok(node.includes('현재 노드에 할당된 고유 Pod 중 현재 이상 상태로 판정된 Pod 수입니다.'))
        assert.ok(node.includes('이 노드에 새 Pod를 배치할 수 있는 상태입니다.'))
        assert.ok(node.includes('노드에 설정된 Taint 수이며 Pod 스케줄링 제약에 영향을 줄 수 있습니다.'))
        assert.ok(!nodeCss.includes('operational-tooltip'))
        assert.ok(!clusterCss.includes('operational-tooltip'))
    })

    it('keeps node accuracy rules on shared presentation contracts', () => {
        const node = read('src/DataPanels/KubernetesNodeDetailPanel.tsx')
        const common = read('src/DataPanels/common/DetailComponents.tsx')
        const commonCss = read('src/DataPanels/common/DetailComponents.css')
        const selection = read('src/SelectionPanel.tsx')
        assert.ok(selection.includes('titleMaxLines={isKubernetesNode ? 2 : 1}'))
        assert.ok(selection.includes('const displayTitle = isKubernetesNode ? fullTitle'))
        assert.ok(common.includes('titleMaxLines?: 1 | 2'))
        assert.ok(commonCss.includes('-webkit-line-clamp: 2'))
        assert.ok(node.includes("{ label: 'Kubelet 버전'"))
        assert.ok(node.includes('formatKubernetesValueState'))
        assert.ok(node.includes('basis="Allocatable"'))
        assert.ok(common.includes('basis?: React.ReactNode'))
        assert.ok(node.includes('const currentPodCount = connected.pods.length'))
        assert.ok(node.includes('{this.renderCapacity(currentPodCount)}'))
        assert.ok(node.includes("label: 'Pod', count: connected.pods.length"))
        assert.ok(node.includes('const problemCount = connected.problemPods.length'))
        assert.ok(node.includes('const recentRestartPodCount = connected.recentRestartPods.length'))
        assert.ok(node.includes('value: `${restartHistoryPodCount}개`'))
        assert.ok(node.includes('최근 1시간 동안 발생한 중요 이벤트가 없습니다.'))
        assert.ok(node.includes('<KubernetesRecentEvents'))
        assert.ok(!node.includes('netdive-k8s-node-detail__events'))
    })

    it('keeps risk evidence rows on one shared three-column status pattern', () => {
        const common = read('src/DataPanels/common/DetailComponents.tsx')
        const commonCss = read('src/DataPanels/common/DetailComponents.css')
        const node = read('src/DataPanels/KubernetesNodeDetailPanel.tsx')
        const cluster = read('src/DataPanels/KubernetesClusterDetailPanel.tsx')
        const nodeCss = read('src/DataPanels/KubernetesNodeDetailPanel.css')
        const clusterCss = read('src/DataPanels/KubernetesClusterDetailPanel.css')
        assert.ok(common.includes('DetailStatusIndicator'))
        assert.ok(common.includes('StatusEvidenceList'))
        assert.ok(common.includes('netdive-detail-evidence-row__state'))
        assert.ok(common.includes('netdive-detail-evidence-row__value'))
        assert.ok(commonCss.includes('var(--netdive-detail-result-state-width)'))
        assert.ok(commonCss.includes('var(--netdive-detail-result-value-width)'))
        assert.ok(commonCss.includes('.netdive-detail-evidence-list'))
        assert.ok(commonCss.includes('.netdive-detail-status-indicator.is-success'))
        assert.ok(common.includes('<i />'))
        assert.ok(!common.includes("? <DetailBadge tone={tone} className={className}>{children}</DetailBadge>"))
        assert.ok(commonCss.includes('.netdive-detail-status-indicator.is-warning'))
        assert.ok(commonCss.includes('.netdive-detail-status-indicator.is-danger'))
        assert.ok(commonCss.includes('.netdive-detail-status-indicator.is-default'))
        assert.ok(commonCss.includes('.netdive-detail-evidence-row__value.is-grade'))
        assert.ok(commonCss.includes('.netdive-detail-evidence-row__value.is-score'))
        assert.ok(cluster.includes("<StatusEvidenceList columnHeaders={{ state: '상태', value: '평가' }}>"))
        assert.ok(node.includes("<StatusEvidenceList columnHeaders={{ state: '상태', value: '대상 수' }}>"))
        assert.ok(!node.includes("value: '현재 수'"))
        assert.ok(common.includes('columnHeaders?:'))
        assert.ok(common.includes('netdive-detail-evidence-list__column-headers'))
        assert.ok(commonCss.includes('.netdive-detail-evidence-list__column-headers'))
        assert.ok(commonCss.includes('.netdive-detail-evidence-list__column-headers > span:last-child'))
        assert.ok(cluster.includes('status={{ label, tone }}'))
        assert.ok(cluster.includes('valueVariant={valueVariant}'))
        assert.ok(!clusterCss.includes('netdive-k8s-cluster-detail__resilience-rows'))
        assert.ok(!nodeCss.includes('netdive-k8s-node-detail__risk-rows'))
        assert.ok(!commonCss.includes('.netdive-detail-evidence-row__interactive .netdive-detail-evidence-row'))
        assert.ok(!commonCss.includes('.netdive-detail-evidence-row__result'))
        assert.ok(node.includes("status={singleReplicaWorkloadCount > 0 ? { label: '보완 권장', tone: 'warning' }"))
        assert.ok(node.includes("{ label: tone === 'danger' ? '위험' : '보완 권장', tone: tone === 'danger' ? 'danger' : 'warning' }"))
        assert.ok(!node.includes('<DetailBadge tone="warning">확인 필요</DetailBadge>'))
        assert.ok(!node.includes('<DetailBadge tone={tone}>확인 필요</DetailBadge>'))
    })

    it('keeps shared connected-resource labels readable for up to two lines', () => {
        const commonCss = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(commonCss.includes('minmax(var(--netdive-detail-resource-value-min-width), max-content)'))
        assert.ok(commonCss.includes('var(--netdive-detail-resource-action-width)'))
        assert.ok(commonCss.includes('max-height: calc(var(--netdive-detail-line-body-label) + var(--netdive-detail-line-body-label))'))
        assert.ok(commonCss.includes('-webkit-line-clamp: 2'))
        assert.ok(commonCss.includes('overflow-wrap: anywhere'))
        assert.ok(commonCss.includes('grid-auto-rows: var(--netdive-detail-resource-height)'))
        assert.ok(!commonCss.includes('max-height: 28px'))
    })

    it('keeps the namespace panel on the cluster and node shared detail grammar', () => {
        const namespace = read('src/DataPanels/KubernetesNamespaceDetailPanel.tsx')
        const namespaceCss = read('src/DataPanels/KubernetesNamespaceDetailPanel.css')
        const recentEvents = read('src/DataPanels/common/KubernetesRecentEvents.tsx')
        const visualPreview = read('tests/visual/KubernetesDetailVisualRegression.tsx')
        ;[
            '<DetailSectionCard',
            '<BasicInfoRows',
            '<DetailAdvancedInfo',
            '<StatusSummaryGrid',
            '<DetailNavigationTabs',
            '<DetailMetaInfoRow',
            '<DetailCollectionStatusRow',
            '<StatusEvidenceList',
            '<StatusEvidenceRow',
            '<ResourceMetricBlock',
            '<DetailMetricRow',
            '<RelatedResourceGrid',
            '<KubernetesRecentEvents',
            '<HistoryModal'
        ].forEach(component => assert.ok(namespace.includes(component), `namespace is missing ${component}`))
        assert.ok(namespace.includes("problem: { title: translate('kubernetesProblemPods')"))
        assert.ok(namespace.includes("podModal: item[4] as NamespacePodModalKey"))
        assert.ok(namespace.includes("<StatusEvidenceList columnHeaders={{ state: '상태', value: '결과' }}>"))
        assert.ok(namespace.includes("<StatusEvidenceList columnHeaders={{ state: '상태', value: '대상 수' }}>"))
        assert.ok(namespace.includes("<StatusEvidenceList columnHeaders={{ state: '상태', value: '설정' }}>"))
        assert.ok(namespace.includes('현재·최근 OOMKilled Pod'))
        assert.ok(namespace.includes("{ key: 'window', label: '조회 기간', value: '최근 1시간' }"))
        assert.ok(namespace.includes("<DetailMetaInfoRow items={[{ key: 'window', label: '조회 기간', value: '최근 1시간' }]} />"))
        assert.ok(namespace.includes('<DetailCollectionStatusRow'))
        assert.ok(namespace.includes('<DetailNavigationTabs'))
        assert.ok(!namespace.includes('<Tabs'))
        assert.ok(!namespace.includes('<Dropdown'))
        const commonComponents = read('src/DataPanels/common/DetailComponents.tsx')
        const commonCss = read('src/DataPanels/common/DetailComponents.css')
        assert.ok(commonComponents.includes('activeKey={activeKey}'))
        assert.ok(!commonComponents.includes('tabBarExtraContent'))
        assert.ok(!commonComponents.includes('<Dropdown'))
        assert.ok(!commonComponents.includes('<Menu'))
        assert.ok(!namespace.includes('overflowTabs='))
        assert.ok(namespace.includes("{ key: 'ingress', label: 'Ingress' }"))
        assert.ok(namespace.includes("{ key: 'configuration', label: '정책 및 설정' }"))
        assert.ok(namespace.includes("{ key: 'storage', label: '스토리지' }"))
        assert.ok(commonCss.includes('.netdive-detail-navigation-tabs .ant-tabs-content-holder'))
        assert.ok(commonCss.includes('.netdive-detail-meta-info-row'))
        assert.ok(commonCss.includes('.netdive-detail-collection-status-row'))
        assert.ok(namespace.includes('ResourceQuota'))
        assert.ok(namespace.includes('LimitRange'))
        assert.ok(namespace.includes("label: 'PVC'"))
        assert.ok(!namespace.includes("label: 'PV'"))
        assert.ok(!namespace.includes("label: 'StorageClass'"))
        assert.ok(namespace.includes('childrenColumnName="__netdiveNoTreeChildren"'))
        assert.ok(!namespaceCss.includes('overflow-x: auto'))
        assert.ok(!namespaceCss.includes('navigation'))
        assert.ok(!namespaceCss.includes('netdive-k8s-namespace-detail__resource-policy'))
        assert.ok(namespace.includes('집계 결과는 있으나 연결된 Pod를 현재 토폴로지에서 확인할 수 없습니다.'))
        assert.ok(!namespace.includes("import './KubernetesNodeDetailPanel.css'"))
        assert.ok(!namespace.includes('netdive-k8s-node-detail'))
        assert.ok(!namespace.includes('<DetailBadge'))
        assert.ok(!namespace.includes('<DetailKeyValueList'))
        assert.ok(!namespace.includes('<ConnectedResourcesSection'))
        assert.ok(!namespace.includes('<DetailResourceGrid'))
        assert.ok(!namespace.includes('<KubernetesStateSeparation'))
        assert.ok(!namespace.includes('state={<DetailStatusIndicator'))
        assert.ok(!namespace.includes('detail.cpuRequests'))
        assert.ok(!namespace.includes('detail.cpuLimits'))
        assert.ok(!namespace.includes('detail.memoryRequests'))
        assert.ok(!namespace.includes('detail.memoryLimits'))
        assert.ok(namespace.includes("value={!quotaCollected ? '수집되지 않음' : quotaCount}"))
        assert.ok(namespace.includes("value={!limitRangeCollected ? '수집되지 않음' : limitRangeCount}"))
        assert.ok(!namespaceCss.includes('!important'))
        assert.ok(!namespaceCss.includes('font-size: 10'))
        assert.ok(recentEvents.includes('<DetailStatusIndicator tone={group.tone}>'))
        assert.ok(!recentEvents.includes('<DetailBadge'))
        assert.ok(visualPreview.includes("type PreviewResource = 'cluster' | 'node' | 'namespace'"))
        assert.ok(visualPreview.includes('<DetailStatusIndicator'))
        assert.ok(!visualPreview.includes('<DetailBadge'))
    })

    it('keeps every Kubernetes resource panel on the shared detail grammar', () => {
        const panels = [
            {
                name: 'workload',
                source: read('src/DataPanels/KubernetesWorkloadDetailPanel.tsx'),
                required: ['<DetailSectionCard', '<BasicInfoRows', '<DetailAdvancedInfo', '<StatusSummaryGrid', '<StatusEvidenceRow', '<KubernetesRecentEvents']
            },
            {
                name: 'pod',
                source: read('src/DataPanels/KubernetesPodDetailPanel.tsx'),
                required: ['<DetailSectionCard', '<BasicInfoRows', '<DetailAdvancedInfo', '<StatusSummaryGrid', '<StatusEvidenceRow', '<KubernetesRecentEvents']
            },
            {
                name: 'service',
                source: read('src/DataPanels/KubernetesServiceDetailPanel.tsx'),
                required: ['<DetailSectionCard', '<BasicInfoRows', '<DetailAdvancedInfo', '<StatusSummaryGrid', '<StatusEvidenceRow', '<RelatedResourceGrid', '<KubernetesRecentEvents']
            },
            {
                name: 'storage',
                source: read('src/DataPanels/KubernetesStorageDetailPanel.tsx'),
                required: ['<DetailSectionCard', '<BasicInfoRows', '<DetailAdvancedInfo', '<StatusSummaryGrid', '<RelatedResourceGrid', '<KubernetesRecentEvents']
            },
            {
                name: 'relationship',
                source: read('src/DataPanels/KubernetesRelationshipResourceDetailPanel.tsx'),
                required: ['<DetailSectionCard', '<BasicInfoRows', '<DetailAdvancedInfo', '<ConnectedResourceListSection']
            }
        ]
        panels.forEach(panel => {
            panel.required.forEach(component => assert.ok(panel.source.includes(component), `${panel.name} is missing ${component}`))
            assert.ok(!panel.source.includes("import './KubernetesNodeDetailPanel.css'"), `${panel.name} imports node panel CSS`)
            assert.ok(!panel.source.includes('className="netdive-k8s-node-detail'), `${panel.name} uses the node panel wrapper`)
            assert.ok(!panel.source.includes('<DetailKeyValueList'), `${panel.name} uses the legacy key/value alias`)
            assert.ok(!panel.source.includes('<DetailSection '), `${panel.name} uses the legacy section alias`)
            assert.ok(!panel.source.includes('<ConnectedResourcesSection'), `${panel.name} uses the legacy related-resource alias`)
        })
    })

    it('keeps all shared Kubernetes detail typography on the 11px semantic floor', () => {
        const tokens = read('src/DataPanels/common/DetailDesignTokens.css')
        ;[
            '--netdive-detail-font-evidence-value: 12px',
            '--netdive-detail-font-evidence-score: 13px',
            '--netdive-detail-line-evidence-value: 18px',
            '--netdive-detail-weight-evidence-number: 600',
            '--netdive-detail-weight-evidence-grade: 500',
            '--netdive-detail-weight-evidence-score: 600'
        ].forEach(token => assert.ok(tokens.includes(token), `missing shared evidence token: ${token}`))
        const files = [
            'src/DataPanels/common/DetailComponents.css',
            'src/DataPanels/common/KubernetesAnalysisConfidence.css',
            'src/DataPanels/common/KubernetesPodUsageTable.css',
            'src/DataPanels/common/KubernetesRecentEvents.css',
            'src/DataPanels/common/KubernetesStatusPolicy.css',
            'src/DataPanels/common/NodeContextBreadcrumb.css',
            'src/DataPanels/KubernetesClusterDetailPanel.css',
            'src/DataPanels/KubernetesNamespaceDetailPanel.css',
            'src/DataPanels/KubernetesNodeDetailPanel.css',
            'src/DataPanels/KubernetesWorkloadDetailPanel.css',
            'src/DataPanels/KubernetesPodDetailPanel.css',
            'src/DataPanels/KubernetesServiceDetailPanel.css',
            'src/DataPanels/KubernetesStorageDetailPanel.css',
            'src/DataPanels/KubernetesRelationshipResourceDetailPanel.css'
        ]
        const belowMinimum = /font-size:\s*(?:[0-9](?:\.[0-9]+)?|10(?:\.[0-9]+)?)px/g
        const fractionalExceptions = /font-size:\s*(?:10\.5|11\.5|12\.5)px/g
        files.forEach(file => {
            const css = read(file)
            assert.strictEqual(css.match(belowMinimum), null, `${file} contains a font below 11px`)
            assert.strictEqual(css.match(fractionalExceptions), null, `${file} contains an ad-hoc fractional font size`)
        })
    })
})
