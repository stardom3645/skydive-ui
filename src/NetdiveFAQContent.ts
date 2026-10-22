export type FAQLanguage = 'ko' | 'en'
export type FAQCategory = 'collection' | 'traffic' | 'connections' | 'kubernetes' | 'operations'
export type FAQFilter = FAQCategory | 'all'
type Localized<T> = Record<FAQLanguage, T>
export interface NetdiveFAQEntry {
    id: string
    category: FAQCategory
    question: Localized<string>
    answer: Localized<string[]>
}

export const faqCategories: Array<{ key: FAQFilter; label: Localized<string> }> = [
    { key: 'all', label: { ko: '전체', en: 'All' } },
    { key: 'collection', label: { ko: '수집·갱신 주기', en: 'Collection & refresh' } },
    { key: 'traffic', label: { ko: '트래픽·수치 해석', en: 'Traffic & measurements' } },
    { key: 'connections', label: { ko: '토폴로지·포트 연결', en: 'Topology & port mapping' } },
    { key: 'kubernetes', label: { ko: 'Kubernetes', en: 'Kubernetes' } },
    { key: 'operations', label: { ko: '상태·화면 이용', en: 'Status & navigation' } }
]

const entry = (id: string, category: FAQCategory, ko: string, koAnswer: string[], en: string, enAnswer: string[]): NetdiveFAQEntry =>
    ({ id, category, question: { ko, en }, answer: { ko: koAnswer, en: enAnswer } })

// Keep collection, query and display intervals distinct. Sources are recorded
// beside each topic so future behavior changes can update the corresponding FAQ.
export const netdiveFAQs: NetdiveFAQEntry[] = [
    // skydive/config/config.go; topology/probes/netlink/netlink.go;
    // Topology.tsx resourceRefreshTimer; TopologyResourceData.ts;
    // KubernetesDetailRefresh.ts; App.tsx vmNameMapRefreshID.
    entry('refresh-intervals', 'collection', '트래픽과 CPU·메모리는 몇 초마다 갱신되나요?', [
        'NIC 트래픽: 현재 Agent의 기본 수집 주기는 10초입니다. 두 번의 누적 카운터 차이를 실제 측정 시간으로 나눈 구간 평균을 표시합니다. Agent 설정을 따로 지정했거나 이전 버전을 실행 중이면 주기가 다를 수 있습니다.',
        'CPU·메모리·루트 디스크: 토폴로지 카드의 리소스(자원) 정보는 약 60초 간격으로 다시 조회합니다. Wall의 원본 수집 주기는 별도이며, 추이 조회의 60초 데이터 간격을 원본 수집 주기로 해석하면 안 됩니다. CPU 사용률 등의 계산에는 최근 1분의 표본을 사용합니다.',
        'Mold 인벤토리: 화면에서 약 10초 간격으로 다시 조회합니다. VM 이름·구성 등의 정보이며 모든 성능 지표가 10초마다 측정된다는 뜻은 아닙니다.',
        'Kubernetes 상세 정보: 패널을 열 때 조회하고, 이후 조회 완료 약 60초 뒤 다시 조회합니다. 토폴로지 객체의 변경 반영은 별도의 Kubernetes Watch 경로를 사용합니다.',
        '수집 → 서버 처리 → 화면 조회에 시간이 걸립니다. 화면의 숫자는 순간값이 아니므로, 트래픽 상세의 측정 구간·측정 시각과 각 데이터의 출처를 함께 확인하세요.'
    ], 'How often do traffic, CPU and memory values refresh?', [
        'NIC traffic: the current Agent source defaults to a 10-second collection interval. Rates are averages calculated from two cumulative counters and their actual elapsed time. Explicit Agent settings or older running versions can use a different interval.',
        'CPU, memory and root disk: the topology requests supplementary resource data about every 60 seconds. Wall has its own source collection interval; a 60-second trend query step is not the source collection interval. Some rate calculations, including CPU, use samples from the past minute.',
        'Mold inventory: the screen requests inventory about every 10 seconds. This includes VM names and configuration, not a guarantee that all performance metrics are measured every 10 seconds.',
        'Kubernetes details: panels query on opening and again about 60 seconds after a request completes. Topology object changes use a separate Kubernetes Watch path.',
        'Collection, server processing and screen queries introduce delay. Values are not instantaneous. Check the traffic measurement interval, sample time and the source of each metric.'
    ]),
    // App.tsx coalesceUpdates; KubernetesDetailRefresh.ts visibility handling.
    entry('screen-refresh', 'collection', '화면이 갱신되면 원본 데이터도 새로 수집하나요?', [
        '화면 다시 그리기, 서버 데이터 조회, Agent의 원본 수집은 서로 다른 작업입니다. 화면을 새로고침해도 Agent나 Wall의 수집 주기가 빨라지지는 않습니다.',
        'Kubernetes 상세 패널은 브라우저 탭이 숨겨지면 주기 조회를 멈추고, 다시 보이면 조회를 재개합니다. 표시된 값이 언제 측정·조회된 것인지 확인하세요.'
    ], 'Does refreshing the screen collect a new source sample?', [
        'Screen redraws, server queries and Agent collection are separate operations. Reloading the page does not speed up Agent or Wall collection.',
        'Kubernetes detail panels pause periodic queries while the browser tab is hidden and resume when it becomes visible. Check when a value was measured or queried.'
    ]),
    // TopologyResourceMetrics.ts; TopologyResourceData.ts topologyResourcePlan.
    entry('resource-basis', 'collection', 'CPU 사용률·할당률·용량은 같은 뜻인가요?', [
        '사용률은 측정된 이용 정도이고, 할당률은 자원을 얼마나 배정했는지 나타냅니다. 용량은 전체 또는 할당 가능한 자원 크기입니다. 서로 대체할 수 없습니다.',
        '실측값이 없으면 카드가 CPU 할당, 메모리 할당 또는 용량을 표시할 수 있습니다. 라벨과 툴팁의 출처를 확인하세요. Kubernetes 노드에 표시되는 Wall · VM 값은 게스트 OS 또는 하이퍼바이저 기준이며 Kubernetes 할당 가능 자원 기준과 다를 수 있습니다.'
    ], 'Are usage, allocation and capacity the same thing?', [
        'Usage is measured consumption, allocation is assigned resources, and capacity is the total or allocatable resource size. They are not interchangeable.',
        'When measurements are unavailable, cards may show allocation or capacity. Check labels and source tooltips. Wall · VM values on Kubernetes nodes use guest OS or hypervisor measurements and can differ from Kubernetes allocatable-resource percentages.'
    ]),
    // TopologyLinkTraffic.ts; Tools.ts prettyBandwidth.
    entry('traffic-average', 'traffic', '트래픽은 실시간 속도인가요? 짧은 전송은 왜 작게 보이나요?', [
        '연결선의 트래픽은 측정 구간의 평균 전송률입니다. 예를 들어 10초 구간 중 1초만 전송했다면, 그 전송량을 전체 측정 시간으로 나누므로 순간 최대 속도보다 작게 보입니다.',
        '선 위의 작은 박스는 단위를 바꾸며 정수로 줄여 표시하므로 서로 다른 값도 같은 Kbit/s 또는 Mbit/s로 보일 수 있습니다. 연결선 상세에서 수신·송신 값과 측정 구간을 함께 확인하세요.'
    ], 'Is traffic instantaneous? Why does a short transfer look small?', [
        'Link traffic is an average over a measurement interval. A one-second transfer within a ten-second interval is divided by the entire elapsed interval, so it appears below the peak transfer speed.',
        'Small labels on links shorten values to integer units. Different rates can display the same Kbit/s or Mbit/s label. Check receive, transmit and the measurement interval in link details.'
    ]),
    // TopologyLinkTraffic.ts totalBps; Tools.ts prettyBandwidth.
    entry('traffic-units', 'traffic', '연결선 숫자는 수신인가요, 송신인가요? MB/s와 왜 다른가요?', [
        '트래픽 박스는 선택된 측정 인터페이스의 평균 수신(RX)과 송신(TX) 전송률을 합산합니다. 양방향 합계이므로 한 방향의 링크 속도와 그대로 비교하면 안 됩니다.',
        'bit/s는 초당 비트이고 파일 전송 도구의 B/s는 초당 바이트입니다. 1바이트는 8비트입니다. 측정 구간과 프로토콜 부가 트래픽도 달라 파일 전송 속도와 정확히 같지는 않습니다.'
    ], 'Does a link label show receive or transmit? Why is it different from MB/s?', [
        'The traffic label adds average receive (RX) and transmit (TX) rates from the selected measurement interface. This is a bidirectional total, so do not compare it directly with a one-direction link speed.',
        'bit/s means bits per second; file transfer tools often use bytes per second (B/s). One byte is eight bits. Measurement windows and protocol overhead can also differ.'
    ]),
    // TopologyLinkTraffic.ts manual-port endpoint resolution; LinkDetailPanel.tsx.
    entry('switch-traffic-source', 'traffic', '스위치 연결선에 보이는 트래픽은 스위치가 직접 측정한 값인가요?', [
        '수동 포트 매핑의 연결선은 등록한 호스트 NIC의 측정값을 사용합니다. 스위치 포트의 하드웨어 카운터를 직접 읽은 값이 아닙니다. 자동 연결도 연결선 상세의 측정 기준 인터페이스를 먼저 확인하세요.',
        '호스트 NIC의 송신은 연결 상대의 수신 방향에 해당합니다. 양쪽 측정 시각·범위가 다르면 수치가 다를 수 있습니다. 이 값만으로 스위치 포트의 실제 Up/Down, 오류·드롭이나 전체 스위치 처리량을 확인할 수는 없습니다.'
    ], 'Is switch-link traffic measured directly on the switch?', [
        'A manual port mapping uses measurements from its registered host NIC, not switch hardware counters. For automatic links, also check the measurement interface in link details first.',
        'Host NIC transmit corresponds to receive at the other end. Measurement times and scopes can differ. These values alone do not establish the switch port’s actual Up/Down state, errors, drops or the switch’s total throughput.'
    ]),
    // TopologyLinkTraffic.ts counter validity; Config.ts link labels.
    entry('zero-unavailable', 'traffic', '트래픽 0과 숫자가 없는 상태는 같은 뜻인가요?', [
        '유효한 두 표본 사이의 카운터 증가가 없으면 0입니다. 반면 측정값이나 유효한 시간 구간이 없으면 전송률을 계산할 수 없습니다. 수동 연결은 유효한 0을 표시하고, 미수집 값을 0으로 대체하지 않습니다.',
        '연결 종류와 표시 조건에 따라 트래픽 박스가 생략될 수도 있습니다. 숫자가 없거나 이전 값이 보인다는 이유만으로 무트래픽·장애·정상을 단정하지 말고 상세의 측정 시각과 수집 상태를 확인하세요.'
    ], 'Is zero traffic the same as a missing number?', [
        'Zero means valid samples show no counter increase. Missing measurements or an invalid elapsed interval cannot produce a rate. Manual links display a valid zero and do not replace missing data with zero.',
        'Labels may also be omitted by link type or display conditions. A missing label or an old value does not prove no traffic, failure or health. Check the sample time and collection state.'
    ]),
    // Infrastructure topology uses interface counters, not per-VM traffic attribution.
    entry('vm-traffic-path', 'traffic', 'VM이 많은데 물리 NIC 트래픽이 적을 수 있나요? 호스트 간 전송은요?', [
        'VM 개수는 전송량이 아닙니다. 같은 호스트 안에서 브리지로 처리되는 VM 간 통신은 물리 NIC를 통과하지 않을 수 있습니다. 반대로 다른 호스트로 나가는 통신은 실제로 사용한 물리 경로의 카운터에 반영됩니다.',
        '테스트 전송이 선택한 NIC·Bond·브리지를 지나는지 확인하세요. 한 패킷이 논리 인터페이스와 물리 인터페이스에서 각각 집계될 수 있으므로, 이 값들을 모두 더해 호스트 전체 트래픽으로 해석하면 중복될 수 있습니다.'
    ], 'Can many VMs have little physical NIC traffic? What about host-to-host transfers?', [
        'VM count is not traffic volume. VM communication handled by a bridge within one host may not cross a physical NIC. Traffic to another host is counted on the physical path it actually uses.',
        'Check which NIC, bond or bridge carries a test transfer. A packet may be counted at both logical and physical interfaces, so summing all interface values can double-count host traffic.'
    ]),
    // InfrastructurePortMapping.ts infrastructurePortMappings; LLDPTopologyValidity.ts.
    entry('missing-switch-ports', 'connections', '스위치 포트가 일부만 보이거나 자동 연결이 없는 이유는 무엇인가요?', [
        'LLDP로 발견된 포트 목록은 스위치의 전체 포트 인벤토리가 아닙니다. 이웃 정보가 들어오지 않는 포트와 미사용 포트까지 모두 표시된다는 보장은 없습니다.',
        '자동 연결이 없다는 사실만으로 실제 배선이 없거나 링크가 Down이라고 판단할 수 없습니다. 스위치와 호스트의 LLDP 송수신, 수집 상태와 실제 배선을 확인하고, 확인한 연결은 수동 매핑으로 보완할 수 있습니다.'
    ], 'Why are only some switch ports or automatic connections visible?', [
        'LLDP-discovered ports are not a full switch port inventory. Ports without received neighbor information, including unused ports, are not guaranteed to appear.',
        'A missing automatic connection does not prove missing cabling or a Down link. Check LLDP transmission and reception, collection state and physical cabling. Verified cabling can be supplemented with a manual mapping.'
    ]),
    // InfrastructurePortMapping.ts buildManualPortMappingCandidates.
    entry('manual-candidates', 'connections', '수동 매핑의 NIC 추천은 실제 연결을 찾아낸 결과인가요?', [
        '아닙니다. 자동 연결과 기존 수동 매핑이 없는 NIC 후보를 정리한 목록입니다. Up 상태와 같은 호스트의 다른 자동 연결 정보 등은 추천 순서를 정하는 참고 자료이며 실제 배선의 증거가 아닙니다.',
        '기본 목록에서는 Down·상태 미확인 NIC를 숨깁니다. 필요하면 포함 옵션을 켜세요. 등록 전 스위치 포트와 호스트 NIC가 실제로 연결되어 있는지 운영자가 확인해야 합니다.'
    ], 'Do recommended NICs prove the actual cable connection?', [
        'No. The list contains eligible NICs without automatic or existing manual mappings. Up state and other automatic links on the same host help rank candidates; they do not prove cabling.',
        'Down and unknown-state NICs are hidden by default. Enable the inclusion option if needed. Verify the actual switch port and host NIC connection before registering it.'
    ]),
    // InfrastructurePortMapping.ts manualPortNameSuggestions; ManualPortMappingManager.tsx.
    entry('manual-port-name', 'connections', '추천된 manual- 포트명은 실제 장비의 포트 번호인가요?', [
        '아닙니다. 수동 포트 표시명은 Netdive 토폴로지에서 사용할 이름입니다. 추천값은 발견된 포트명의 형식 등을 참고해 만들지만, 실제 배선이나 장비 포트 번호를 확인한 결과가 아닙니다.',
        '입력란에서 이름을 직접 수정할 수 있습니다. 이름을 등록해도 장비 설정이나 실제 배선은 변경되지 않습니다.'
    ], 'Is a suggested manual- port name the actual device port number?', [
        'No. A manual port display name is a name used in the Netdive topology. Suggestions may follow discovered naming patterns but do not verify the actual cable or device port number.',
        'You can edit the name directly. Registering a name does not change device configuration or physical cabling.'
    ]),
    // InfrastructurePortMapping.ts buildManualPortMappingTopologyLinks.
    entry('automatic-priority', 'connections', '수동 매핑 후 LLDP 자동 연결이 발견되면 어떻게 되나요?', [
        'LLDP 자동 연결을 우선 표시합니다. 같은 NIC나 포트와 충돌하는 수동 연결선은 중복으로 그리지 않으며 수동 등록 기록은 유지합니다.',
        '수동 매핑은 자동 탐지를 대신하는 장비 검증 기능이 아닙니다. 배선이 바뀌면 등록 정보도 실제 연결과 맞는지 다시 확인하세요.'
    ], 'What happens if LLDP discovers a manually mapped connection?', [
        'LLDP automatic links take precedence. Conflicting manual links on the same NIC or port are not drawn twice, while the manual registration remains stored.',
        'Manual mapping does not verify hardware. Recheck the registration against the actual connection whenever cabling changes.'
    ]),
    // TopologySearch.ts host context; InfrastructurePortMapping.ts NIC identity.
    entry('duplicate-nic-names', 'connections', '여러 호스트에 eno12399처럼 같은 NIC 이름이 있어도 정상인가요?', [
        '네. 인터페이스 이름은 호스트 안에서 구분되는 이름이므로 여러 호스트에서 같을 수 있습니다. 검색 결과의 호스트 이름을 함께 보고, 상세의 MAC과 연결 정보를 확인하세요.',
        '수동 매핑에서도 NIC 이름만 같다고 같은 인터페이스가 아닙니다. 선택한 호스트와 NIC를 함께 확인해야 합니다.'
    ], 'Can multiple hosts have the same NIC name, such as eno12399?', [
        'Yes. Interface names identify interfaces within a host and may repeat across hosts. Check the host context in search results and the MAC and connections in details.',
        'The same NIC name on another host is not the same interface. Check both host and NIC when making manual mappings.'
    ]),
    // KubernetesWorkloadStatus.ts; DataPanels/common/KubernetesStatusPolicy.tsx.
    entry('pod-running-ready', 'kubernetes', 'Pod가 Running인데 Netdive는 왜 주의·장애로 판정하나요?', [
        'Running은 Pod의 실행 단계이고 Ready는 트래픽을 처리할 준비 상태입니다. 실행 중이어도 컨테이너 준비 실패, 재시작 또는 대기 사유가 있을 수 있습니다.',
        'Netdive 판정은 API 원본 상태와 준비 상태·문제 사유 등을 함께 해석한 결과입니다. 판정 항목을 눌러 기준을 확인하고, Ready 조건·컨테이너 상태·이벤트·로그를 함께 확인하세요.'
    ], 'Why does Netdive warn about a Running Pod?', [
        'Running is a Pod phase; Ready describes readiness to serve traffic. A running Pod can still have unready containers, restarts or waiting reasons.',
        'Netdive interprets API state together with readiness and problem reasons. Click the assessment to see its criteria, then check Ready conditions, container state, events and logs.'
    ]),
    // KubernetesWorkloadStatus.ts; KubernetesWorkloadOwnership.ts.
    entry('replicas-rollout', 'kubernetes', 'Deployment의 Replica 수만 맞으면 배포가 정상인가요?', [
        '원하는 Replica 수와 현재 개수만 같아도 가용·준비·갱신 Replica가 부족하거나 롤아웃이 진행 중일 수 있습니다. 컨트롤러 조건과 하위 Pod 상태를 함께 확인해야 합니다.',
        'Deployment, StatefulSet, DaemonSet, Job은 정상 완료의 의미가 다릅니다. 객체별 판정 기준과 API 상태를 확인하고, 실패 원인은 이벤트와 Pod의 대기·종료 사유를 통해 좁혀가세요.'
    ], 'Is a Deployment healthy when its replica count matches?', [
        'Matching desired and current counts can still hide shortages in available, ready or updated replicas, or an unfinished rollout. Check controller conditions and child Pods.',
        'Deployment, StatefulSet, DaemonSet and Job have different success criteria. Check each assessment and API state, then inspect events and Pod waiting or termination reasons.'
    ]),
    // TopologyResourceMetrics.ts; skydive/api/server/mold_kubernetes_api.go.
    entry('kubernetes-metrics', 'kubernetes', 'Kubernetes 용량은 보이는데 사용량이 미수집인 이유는 무엇인가요?', [
        'Capacity·Allocatable·Request·Limit은 구성 또는 예약 정보입니다. 실제 CPU·메모리 사용량은 별도 메트릭 조회가 가능해야 표시됩니다.',
        '클러스터의 메트릭 API 제공 여부와 접근 권한·수집 상태를 확인하세요. 사용량이 없다는 사실은 사용량이 0이거나 자원이 정상이라는 뜻이 아닙니다.'
    ], 'Why is Kubernetes capacity visible while usage is unavailable?', [
        'Capacity, allocatable resources, requests and limits describe configuration or reservation. Actual CPU and memory usage requires a working metrics query.',
        'Check metrics API availability, permissions and collection state. Missing usage does not mean zero usage or a healthy resource.'
    ]),
    // KubernetesServiceDetailPanel.tsx; KubernetesRiskResilience.ts.
    entry('service-endpoints', 'kubernetes', 'Ready Endpoint가 없거나 한 노드에 몰리면 서비스 장애인가요?', [
        'Ready Endpoint가 없으면 준비된 서비스 대상이 없는 상태를 의심할 수 있습니다. Selector, 대상 Pod의 Ready 상태와 Endpoint 정보를 함께 확인하세요. 조회 실패나 정보 부족으로 확인하지 못한 상태와 0개는 구분해야 합니다.',
        '한 노드 집중은 그 노드 장애 시 영향이 커질 수 있는 가용성 위험입니다. 그 자체가 현재 접속 실패를 뜻하지는 않습니다. 표시된 관계만으로 실제 사용자 경로의 통신 성공까지 검증하지는 않습니다.'
    ], 'Do missing or single-node Ready Endpoints prove a service outage?', [
        'No Ready Endpoints can indicate no ready service targets. Check selectors, Pod readiness and endpoint information. Distinguish a confirmed zero from unavailable endpoint data.',
        'Concentration on one node is an availability risk if that node fails, not proof of a current connectivity failure. Displayed relationships do not validate successful communication along the actual user path.'
    ]),
    // KubernetesPodLogPanel.tsx; KubernetesPodLogs.ts.
    entry('pod-logs', 'kubernetes', '컨테이너 로그는 계속 실시간으로 들어오나요? 이전 로그는 무엇인가요?', [
        '로그는 선택한 Pod·컨테이너와 줄 수 조건으로 조회한 결과입니다. 계속 이어지는 실시간 스트리밍이 아니므로 새로운 내용은 새로 조회해야 합니다.',
        '이전 로그는 재시작 직전 컨테이너의 로그를 요청합니다. 모든 재시작 이력을 보관하는 기능이 아니며, Kubernetes에 남아 있지 않거나 권한·연결 문제가 있으면 확인할 수 없습니다.'
    ], 'Are container logs streamed live? What are previous logs?', [
        'Logs are a queried result for the selected Pod, container and line limit. They are not a continuous live stream; query again to get new output.',
        'Previous logs request the immediately preceding container instance after a restart, not a complete restart archive. They may be unavailable because Kubernetes no longer retains them or access fails.'
    ]),
    // KubernetesNamespaceDetailAggregation.ts; TopologyStatusBadge.tsx.
    entry('group-status', 'operations', '그룹에 경고가 보이면 그룹 자체가 고장 난 건가요?', [
        '그룹 요약에는 하위 자원의 이상 상태가 집계될 수 있습니다. 그룹 자체의 상태와 하위 자원의 문제를 구분하고, 현재 문제 목록이나 연결 자원에서 해당 객체를 확인하세요.',
        'Netdive 판정과 API 원본 상태는 해석 기준이 다릅니다. 이상 배지만으로 원인을 확정하지 말고 상세 판정 사유와 관련 객체를 함께 확인하세요.'
    ], 'Does a warning on a group mean the group itself has failed?', [
        'Group summaries may aggregate problems in child resources. Distinguish the group’s own state from child issues, and inspect individual objects in current problems or connected resources.',
        'Netdive assessments and raw API states use different interpretations. Check assessment reasons and related resources before deciding the cause.'
    ]),
    // Topology.tsx display filters/expansion; App.tsx layer controls.
    entry('hidden-objects', 'operations', '객체나 연결선이 안 보이면 삭제된 건가요?', [
        '선택한 레이어, 검색·필터, 그룹 접힘, 다운된 객체 숨김과 연결 표시 설정 때문에 화면에서 보이지 않을 수 있습니다. 먼저 보기 설정과 펼침 상태를 확인하세요.',
        '실제 수집 결과에서도 사라진 것인지, 화면 표시 조건 때문에 숨겨진 것인지는 구분해야 합니다. 검색과 연결 자원 탐색을 함께 사용해 확인하세요.'
    ], 'Is an object deleted when it or its link is not visible?', [
        'The selected layer, search or filters, collapsed groups, hidden Down objects and connection display settings can hide objects. Check view settings and expansion first.',
        'Distinguish absence from the collected graph from hiding by display conditions. Use search and connected-resource navigation to investigate.'
    ]),
    // KubernetesDetailRefresh.ts; skydive/api/server/mold_kubernetes_detail_api.go;
    // DataPanels/common/KubernetesStatusPolicy.tsx.
    entry('collection-vs-failure', 'operations', '값이 안 바뀌거나 미수집이면 실제 장비 장애인가요?', [
        '장비·서비스 장애와 Agent, API, Wall, 권한 또는 네트워크 문제에 따른 수집 실패는 다릅니다. 마지막 측정 시각, 조회 오류, Kubernetes 수집 상태와 API 원본 상태를 함께 확인하세요.',
        '일부 정보가 남아 있다고 현재 정상이라는 뜻은 아닙니다. Netdive의 관계·상태 정보만으로 모든 장애 원인과 실제 통신 영향을 자동 확정할 수는 없으며, 필요한 경우 장비·서비스 측 조회로 검증해야 합니다.'
    ], 'Does stale or missing data mean the device has failed?', [
        'A device or service failure differs from collection failure caused by an Agent, API, Wall, permissions or networking. Check sample times, query errors, Kubernetes collection state and raw API status together.',
        'Remaining data is not proof of current health. Relationships and status do not automatically establish every root cause or actual communication impact; verify on the device or service when necessary.'
    ])
]

/** Search every word across the question, answer and localized category. */
export const filterNetdiveFAQs = (language: FAQLanguage, category: FAQFilter = 'all', query = ''): NetdiveFAQEntry[] => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return netdiveFAQs.filter(faq => {
        if (category !== 'all' && faq.category !== category) return false
        const categoryLabel = faqCategories.find(item => item.key === faq.category)!.label[language]
        const text = [categoryLabel, faq.question[language], ...faq.answer[language]].join(' ').toLocaleLowerCase()
        return words.every(word => text.includes(word))
    })
}
