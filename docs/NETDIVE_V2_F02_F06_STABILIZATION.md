# Netdive v2 F02~F06 안정화 결과

작성일: 2026-10-19 · 후속 수정: 2026-10-20

## 작업 범위와 검증 수준

첨부된 안정화 지침에 따라 F02 → F03 → F04 → F05 → F06 순서로 원인 확인, 수정, 회귀 테스트를 진행했다. 최종 교차 검토에서 Namespace 요약, 로그 대상 선택, 에이전트 중단 후 화면의 LLDP 만료 처리를 추가로 같은 정책에 맞췄다.

프론트엔드와 접근 가능한 형제 저장소의 백엔드를 함께 수정했다. 두 저장소는 작업 시작 시 미커밋 변경이 없었다. 새 프레임워크·DB·외부 의존성을 추가하지 않았다. 로그인 체계, 기존 noauth 설정, Kubernetes Secret/API Key 등록·저장, 수집 연동 방식, API 경로·기존 응답 필드, 포트·프로토콜·배포 방식, UI 디자인·메뉴·주요 조작은 유지했다. LLDP 간선에는 유효기간을 판단하는 관측 메타데이터를 추가했다.

운영 배포, 서비스 재시작, Git commit/push는 수행하지 않았다. 빌드 산출물은 `/tmp/netdive-f02-f06-build`에만 만들었다. 실제 Kubernetes 클러스터·물리 스위치·Linux LLDP 캡처 통합 검증은 수행하지 못했다. 아래의 완료 표시는 단위/Mock/로컬 빌드 결과와 구분해서 읽어야 한다.

## 항목별 결과

| 항목 | 진행 상태 | 주요 원인 | 수정 내용 | 검증 결과 | 추가 확인 사항 |
|---|---|---|---|---|---|
| F02. Kubernetes 상태 판정 | 수정 완료 / 실환경 검증 필요 | 카드·상태 목록과 상세 패널의 별도 판정식, 성공한 Job의 Failed 누계 재사용, 과거 롤아웃 사유 우선 | 공통 워크로드 판정 사용, 현재 가용성/진행 상태/종료 이력 분리, observedGeneration 반영 대기, Namespace 집계 공통화 | Deployment·StatefulSet·DaemonSet·Job 상태 및 기존 직접 하위 배지 회귀 검사 통과 | 실제 롤아웃·복구 때 카드/목록/상세의 동시 갱신 확인 |
| F03. Service Endpoint 계산 | 수정 완료 / 실환경 검증 필요 | 상세의 Ready=nil 오판, NotReady 노드까지 포함한 집중도, 중복/dual-stack 대상 과대 집계 | nil을 Ready로 통일, UID/주소별 중복 제거, Ready 대상 노드만 집계, 미수집/빈 목록 구분, ExternalName 별도 처리 | 백엔드 집계 및 프론트 집계 경계 조건 검사 통과 | 실제 dual-stack·수동 EndpointSlice·legacy Endpoints 확인 |
| F04. 상세 패널 자동 갱신 | 수정 완료 / 실환경 검증 필요 | requestKey가 같은 객체의 모든 후속 조회를 차단, 취소/해제 처리가 없는 단발 요청 | Service·Pod·Node·Namespace·Cluster 상세의 공통 60초 갱신, 단일 진행 요청, 15초 제한, 선택 변경/해제/비활성 문서 취소 | 가상 타이머 및 실제 Service 조회 메서드 Mock으로 1→0→1, 실패→복구, Pod UID 변경, 지연 응답 무효화 검사 통과 | 브라우저 장시간 사용·숨김 복귀·네트워크 제한에서 요청량/취소 확인 |
| F05. LLDP 연결 만료 | 수정 완료 / 실환경 검증 필요 | 수신부의 TTL 미구현, 영구 간선, 내부 chassis–port 간선의 수동 매핑 충돌 오판 | TTL/LastSeen/ExpiresAt 저장, 만료 간선만 제거, 케이블 이동/TTL=0 처리, 재시작 복원, 만료 매핑 무시, 화면 만료 재계산 | 순수 그래프 TTL/이동/재시작/수동 보존, DB/API 충돌, 화면 타이머 검사 통과 | Linux/CGo 캡처 파일은 macOS 빌드 대상 밖이다. Linux 빌드·실제 LLDP·재시작 검증 필요 |
| F06. Kubernetes 소유 관계 | 수정 완료 / 실환경 검증 필요 | StatefulSet/DaemonSet selector 연결, UID 불일치 뒤 이름 fallback, 오래된 계층/캐시 우회 | controller ownerReferences 우선, UID 일치 강제, 클러스터/namespace 범위 검사, 검증 불가한 추정 관계 제거, 로그/상세 탐색 정책 일치 | 같은 selector·같은 이름 재생성·다중 클러스터·소유 사슬·캐시 교체 검사 통과 | 실제 informer 이벤트 순서와 접기/펼치기·더블클릭·관련 객체 탐색 확인 |

## F02: 상태 판정의 적용 정책

`evaluateKubernetesWorkload`를 토폴로지 자체 상태, 상태 목록이 사용하는 자체 상태 함수, 워크로드 상세 및 Namespace 워크로드 집계가 재사용한다. StatefulSet 리비전 판정과 DaemonSet 배치 수치 정규화는 기존 함수를 활용한다.

- Deployment: 목표 가용/업데이트 복제본이 충족되면 남아 있는 과거 실패 사유만으로 위험으로 만들지 않는다. 실제 가용 대상 0, 부분 미가용, 미완료 롤아웃 실패 조건은 구별한다. 실패 조건은 Type/Status/Reason을 함께 확인한다.
- Job: Complete=True 또는 명시된 completions 충족은 정상 완료로 판정한다. 성공 전의 Failed 누계는 과거 이력이다. 실행 중은 진행 상태, Failed=True/FailureTarget=True는 현재 실패로 구분한다. 누계만 있고 terminal 조건이 없으면 최종 실패라고 단정하지 않는다.
- observedGeneration과 metadata.generation이 모두 수집되고 전자가 작으면 최신 설정 반영 대기로 표시한다. 값이 없을 때 임의 세대를 만들지 않는다.
- 정상/업데이트 중 객체를 복제본 일부 교체 자체만으로 장애로 집계하지 않는다. 진행 상태는 상세에 정보성 상태로 표시하며, 기존 숫자 배지의 자체 이상 수에는 포함하지 않는다.
- 객체 자체 판정과 하위 Pod/PVC 문제·이력은 분리한다. 관련 PVC 정보와 Pod 문제 목록은 유지한다. 실패한 자식 Job 때문에 CronJob 자체를 별도 장애로 중복 계산하지 않는다. 의도적인 CronJob suspend는 Namespace의 미가용 워크로드 수와 구분한다.
- 직접 하위 객체를 집계하는 숫자 배지의 범위·전파 규칙은 변경하지 않았다. 정상 StatefulSet 테스트 fixture에는 실제 판정에 필요한 current/revision 수치를 보충했다.

## F03: Endpoint 계산의 적용 정책

`kubernetesEndpointReady`, `kubernetesLogicalEndpoints`, `applyKubernetesServiceEndpointStatus`가 백엔드의 공통 기준이다. 프론트엔드 fallback과 Endpoint 행 표시도 같은 Ready 기본값을 사용한다.

- EndpointSlice Ready=true/nil은 Ready, false는 NotReady다. 수집 실패를 Ready=nil과 혼동하지 않는다. 수집 자체의 성공 여부는 기존 endpointDataAvailable로 판정한다.
- target UID가 있으면 같은 UID의 여러 Slice/주소/포트는 하나의 제공 대상으로 센다. UID가 없으면 주소를 기준으로 중복을 제거한다. UID가 다른 재생성 객체는 합치지 않는다.
- 같은 주소 행의 중복은 제거하고 포트 목록을 합친다. IPv4/IPv6 주소 행은 모두 유지한다. 따라서 dual-stack에서는 제공 대상 수와 주소 행 수가 다를 수 있다. API 필드는 유지하되 중복으로 부풀려진 수치를 바로잡은 것이다.
- 동일 대상의 Ready 값이 충돌하면 보수적으로 NotReady로 취급한다. 배치 노드가 충돌하거나 Ready 대상의 노드가 누락되면 단일 노드 집중이라고 단정하지 않는다.
- NotReady 대상이 다른 노드에 있어도 Ready 대상들이 한 노드에 모여 있으면 집중 위험을 표시한다. Ready 대상 1개의 위험은 노드 이름이 없어도 상세에서 확인할 수 있다.
- 클러스터의 기존 단일 노드 위험 집계는 노드가 확인된 단일 Ready 대상도 계속 포함한다. 상세에서는 단일 대상과 여러 대상의 한 노드 집중을 나눠 표시한다.
- selectorless Service의 직접 주소를 유효한 대상으로 인정한다. ExternalName은 DNS 설정으로 평가하고 Endpoint 부재 장애에서 제외한다. 최신 API 조회 실패 시에는 ExternalName도 미확인으로 표시한다.
- Ready 대상이 있다는 사실을 애플리케이션 통신 성공으로 표현하던 문구를 수정했다. 실제 통신, 네트워크 정책, DNS 응답, publishNotReadyAddresses에 따른 애플리케이션 준비 상태는 별도 확인 사항이다.

## F04: 갱신·취소·실패 처리

`KubernetesDetailRefresh`는 기존 fetch와 AbortController를 사용한다. 즉시 최초 조회하고, 요청이 끝난 뒤 60초 후 다음 요청을 예약한다. 한 패널의 요청은 겹치지 않는다. 선택 변경에는 이전 요청을 취소하고 세대 번호를 바꿔 A→B→A 이동에서도 오래된 응답이 적용되지 않게 한다.

15초 제한으로 응답 지연을 제어하고, 실패 후 다음 주기에 재시도한다. 패널 해제와 document.hidden에서는 타이머·요청·visibility listener를 정리한다. 다시 활성화되면 즉시 조회한다. SelectionPanel은 비활성 선택 패널을 unmount하므로 기존 구조로 비활성 요청도 중단된다.

같은 requestKey를 영구 조회 금지 키로 사용하던 조건을 제거했다. key는 선택 식별과 데이터 교체에 계속 사용한다. Node의 기존 공통 메트릭 구독은 유지했다. Workload/Storage 상세는 별도 단발 fetch가 아닌 토폴로지 데이터 소비 방식이므로 불필요한 폴링을 추가하지 않았다.

API 실패는 오류/미수집으로 표시한다. Pod/Service가 토폴로지 fallback만으로 정상으로 승격되는 경로를 보완했다. 성공한 백그라운드 갱신 중에는 기존 데이터를 유지하고, 실패 시에는 기존 오류 안내와 미확인 상태를 사용한다. 새 UI나 로그인 절차를 추가하지 않았다.

### 2026-10-20: 브라우저 타이머 `Illegal invocation` 수정

F04의 기본 환경에서 네이티브 `setTimeout`/`clearTimeout`을 객체 속성으로 복사한 뒤 그 객체의 메서드로 호출했다. 브라우저가 요구하는 호출 문맥과 달라 Cluster 상세의 mount/unmount에서 `TypeError: Illegal invocation`이 발생했다. 기존 테스트는 주입한 가상 타이머만 사용해 기본 브라우저 환경의 문맥 제약을 검증하지 못했다.

기본 환경의 두 타이머를 전역 함수를 직접 호출하는 래퍼로 수정했다. 공통 갱신기를 사용하는 Cluster·Node·Namespace·Pod·Service 상세에 함께 적용된다. 폴링 간격, 요청·응답, 취소 정책과 백엔드는 바꾸지 않았다.

수정 전 실제 headless Chrome에서 같은 오류를 재현했다. 수정 후 실제 Chrome의 네이티브 타이머로 최초 실행·반복 갱신·요청 교체·종료 후 중단을 확인했다. 기본 환경의 호출 문맥을 강제하는 회귀 테스트도 추가했다. 관련 테스트 5개, 전체 테스트 794개가 통과했고 기존 실패 23개의 식별자는 동일하다. TypeScript 및 webpack 빌드도 통과했다. 이 검증은 실제 Kubernetes API에 연결한 전체 상세 패널 UI 통합 시험을 대신하지 않는다.

## F05: LLDP 관측의 수명

`observeLLDPLink`와 `expireLLDPLinks`가 그래프 잠금 아래에서 동작한다. 간선의 LLDP 메타데이터에 AgentID, LocalNodeID, TTL(초), LastSeen/ExpiresAt(Unix 밀리초)을 기록한다. Probe는 1초 주기로 만료를 확인한다.

- 재수신은 같은 간선 ID의 수명을 갱신한다. 만료 후 재수신도 기존 결정적 ID로 복원한다.
- TTL 만료는 해당 자동 port–NIC 간선을 제거한다. switch/port 노드, 내부 chassis–port, NIC–Bond/Bridge, VM 관계는 유지한다. State=DOWN을 만들지 않는다.
- 다른 포트의 새 관측은 이전 자동 이웃을 교체한다. 이전 포트에서 늦게 온 TTL=0 철회가 새 포트의 연결을 삭제하지 않도록 한다.
- 재시작은 저장된 ExpiresAt을 재사용하며 TTL을 임의로 연장하지 않는다. TTL 없는 이전 버전의 로컬 LLDP 관측은 재시작 시 검증 불가한 간선만 제거하고 재수신으로 복구한다. 이때 LLDP 수신 주기 동안 연결선이 일시적으로 없을 수 있다.
- API의 수동 매핑 검증과 화면의 매핑 투영 모두 만료된 자동 간선을 무시한다. 내부 chassis–port 연결만으로 수동 매핑을 차단하지 않는다. 유효한 AUTO 우선 충돌 정책은 유지한다.
- 수동 DB 레코드를 TTL 때문에 삭제하거나 자동으로 재활성화하지 않는다. 이전에 AUTO로 비활성화된 매핑은 기존 이력 정책을 그대로 유지한다.
- 화면은 ExpiresAt에 맞춰 한 개의 타이머로 다음 만료를 예약하고 연결선·관계 근거를 갱신한다. 에이전트 중단으로 삭제 이벤트가 오지 않아도 만료 간선을 현재 연결로 표시하지 않는다. 이 타이머는 API를 호출하지 않는다.
- NIC DOWN은 기존 NIC 상태 수집으로 확인하고, LLDP 수신 중단/만료와 구분한다. 만료 자체로 케이블 단절이나 물리 장애를 확정하지 않는다.

## F06: 소유 관계와 다른 관계의 구분

백엔드 StatefulSet/DaemonSet의 Pod 링크는 namespace와 실제 controller ownerReference를 사용한다. Deployment→ReplicaSet→Pod 사슬은 유지한다. Service selector 선택, Node 배치, Namespace 소속, NetworkPolicy 선택 관계는 소유 관계로 바꾸지 않았다.

UID가 있으면 이름으로 재시도하지 않는다. 명시적인 Controller=false 참조는 소유 컨트롤러에서 제외하고, Controller=true가 있으면 그 참조를 우선한다. 이전 수집 데이터에 controller 플래그가 빠진 참조는 기존 호환 범위에서 허용한다. UID가 없는 name-only 참조는 같은 scope에 후보가 하나인 경우만 프론트엔드에서 허용한다.

백엔드 ResourceCache의 namespace/name 조회에는 현재 UID와 클러스터 검사를 추가했다. 동일 이름으로 재생성된 객체나 다른 클러스터의 graph event가 현재 로컬 캐시에 잘못 연결되는 것을 차단한다.

프론트엔드는 명시적 클러스터 ID, 클러스터 그래프 anchor, 이름과 namespace를 구별한다. Mold connection ID와 그래프 anchor ID를 같은 값으로 가정하지 않는다. ReplicaSet이 없을 때 이름 prefix와 selector로 Deployment를 추정하는 경로, stale TopologyWorkloadControllerID나 parent를 소유 근거로 재사용하는 로그 경로를 제거했다. Cluster 패널의 워크로드 이름 추정과 UID가 다른 상세 객체로 이름만 보고 이동하는 경로도 보완했다.

실제 ReplicaSet 메타데이터가 있는 정상 Deployment 사슬의 표시 구조는 유지된다. 사슬이 미수집이면 임의 관계를 만들지 않는다. 이런 Pod는 기존의 소유 미확정 Pod 처리에 따라 기본 워크로드 토폴로지에서 빠질 수 있지만 원본 인벤토리·Namespace/Node 탐색 대상은 유지된다. Collector가 ReplicaSet을 수집하도록 구성됐는지 실환경에서 확인해야 한다.

## 검증 결과

| 검사 | 수정 전 | 최종 | 판정 |
|---|---|---|---|
| 프론트엔드 전체 `npm test` | 771 통과 / 23 실패 | 794 통과 / 23 실패 | 신규 회귀 테스트 23개 통과. 실패 23개의 suite/test 식별자가 수정 전과 정확히 같다. 전체 테스트 성공으로 보고하지 않는다. |
| TypeScript `npx tsc --noEmit` | 기준 검사 대상 밖 | 오류 0 | 통과 |
| 프론트엔드 webpack 빌드 | 기준 검사 대상 밖 | 성공, 경고 5개 / 오류 0 | 최종 소스 검사 |
| 백엔드 관련 검사 | 최초 6개 패키지 통과 | 7개 패키지 통과, 테스트/하위 테스트 199 통과·1 skip·0 실패 (`-count=1`) | 신규 LLDP 검사 패키지 포함. skip: `TestWallSystemVMLiveMetrics` |
| Go race 검사 | 기준 검사 대상 밖 | `api/server`, `topology/probes/lldp`, `topology/probes/k8s` 통과 | 검증 OS에서 포함되는 코드 대상 |
| `git diff --check` | 변경 없음 | 두 저장소 통과 | 공백/패치 오류 없음 |

기존 실패 분류:

- DataNormalizer: 1개
- Infrastructure summary panel density: 2개
- Kubernetes detail UI contract: 8개
- Every Netdive verdict exposes its criteria: 1개
- Operational panel shared visual contract: 2개
- Topology context menu contract: 1개
- Topology display options interactions: 3개
- Namespace summary badge rendering: 1개
- Kubernetes virtual group presentation: 1개
- Shared topology presentation: 2개
- Search layer-switch animation lifecycle: 1개

신규/보강 회귀 테스트의 중심 파일:

- F02: `KubernetesWorkloadStatus.test.ts` — 복제본 완료, 부족·0, 진행, 미수집, 세대 지연, Job 재시도 완료, 리비전·배치와 토폴로지 자체 상태 일치.
- F03: `KubernetesServiceDetailAggregation.test.ts`, `kubernetes_endpoint_status_test.go` — nil/true/false, 중복 Slice/dual-stack, 서로 다른 Ready/NotReady 노드, 누락된 노드, ExternalName, 주소·포트 병합, 단일 Ready 대상의 위험 유지.
- F04: `KubernetesDetailRefresh.test.ts` — 타이머/취소/응답 세대 및 실제 Service loadDetail 메서드의 Mock 요청. 같은 requestKey에서도 1→0→오류→1과 Pod UID 교체를 검증.
- F05: `lease_test.go`, `manual_port_mapping_api_test.go`, `InfrastructurePortMapping.test.ts`, `LLDPTopologyValidity.test.ts`, `TopologyGroupSelection.test.ts` — lease와 DB/화면의 충돌 정책, 만료 시각 재렌더링, 선택된 간선도 만료되면 숨기는 정책.
- F06: `owner_relationship_test.go`, `cache_identity_test.go`, `KubernetesWorkloadOwnership.test.ts`, `KubernetesLogScopes.test.ts` — UID 우선, 명시적 controller, selector-only 거부, 다중 클러스터, 캐시 교체, 로그 범위.


신규 프론트엔드 회귀 검사는 공통 워크로드 상태, 상세 조회 갱신, Endpoint nil/중복/ExternalName, LLDP 매핑·타이머, UID/클러스터/캐시·로그 scope를 다룬다. 기존 테스트의 요구 수준을 낮추는 대신, 제거한 추정 정책을 정확히 거부하도록 기대값을 바꾸고 관련 fixture·추출 메서드 mock에 새 공통 의존성을 제공했다.

주요 실행 명령:

```sh
# skydive-ui
npm test
npx tsc --noEmit
npm run build -- --output-path /tmp/netdive-f02-f06-build

# skydive
# graffiti/http는 별도 모듈이므로 import path로 실행한다.
go test -json -count=1 ./api/server ./common ./netdive/database ./netdive/eventhistory ./topology/probes/k8s ./topology/probes/lldp github.com/skydive-project/skydive/graffiti/http
go test -race ./api/server ./topology/probes/lldp ./topology/probes/k8s
```

로컬 로그는 `/tmp/netdive-f02-f06-*`에 있다. 단위 테스트가 통과한 것을 실제 클러스터/스위치 통합 검증으로 간주하지 않았다.

## 수정 파일

### 프론트엔드 구현

- [src/DataPanels/KubernetesClusterDetailPanel.tsx](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/DataPanels/KubernetesClusterDetailPanel.tsx)
- [src/DataPanels/KubernetesNamespaceDetailPanel.tsx](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/DataPanels/KubernetesNamespaceDetailPanel.tsx)
- [src/DataPanels/KubernetesNodeDetailPanel.tsx](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/DataPanels/KubernetesNodeDetailPanel.tsx)
- [src/DataPanels/KubernetesPodDetailPanel.tsx](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/DataPanels/KubernetesPodDetailPanel.tsx)
- [src/DataPanels/KubernetesServiceDetailPanel.tsx](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/DataPanels/KubernetesServiceDetailPanel.tsx)
- [src/DataPanels/KubernetesWorkloadDetailPanel.tsx](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/DataPanels/KubernetesWorkloadDetailPanel.tsx)
- [src/DataPanels/common/KubernetesEndpointList.tsx](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/DataPanels/common/KubernetesEndpointList.tsx)
- [src/InfrastructurePortMapping.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/InfrastructurePortMapping.ts)
- [src/KubernetesLogScopes.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/KubernetesLogScopes.ts)
- [src/KubernetesNamespaceDetailAggregation.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/KubernetesNamespaceDetailAggregation.ts)
- [src/KubernetesServiceDetailAggregation.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/KubernetesServiceDetailAggregation.ts)
- [src/KubernetesTopologyBadgeAggregation.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/KubernetesTopologyBadgeAggregation.ts)
- [src/KubernetesVerdictRules.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/KubernetesVerdictRules.ts)
- [src/KubernetesWorkloadOwnership.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/KubernetesWorkloadOwnership.ts)
- [src/Topology.tsx](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/Topology.tsx)
- [src/KubernetesDetailRefresh.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/KubernetesDetailRefresh.ts)
- [src/KubernetesWorkloadStatus.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/KubernetesWorkloadStatus.ts)
- [src/LLDPTopologyValidity.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/src/LLDPTopologyValidity.ts)

### 프론트엔드 테스트

- [tests/InfrastructurePortMapping.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/InfrastructurePortMapping.test.ts)
- [tests/KubernetesDetailUiContract.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/KubernetesDetailUiContract.test.ts)
- [tests/KubernetesLogScopes.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/KubernetesLogScopes.test.ts)
- [tests/KubernetesNamespaceDetailAggregation.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/KubernetesNamespaceDetailAggregation.test.ts)
- [tests/KubernetesNodeDetailMetrics.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/KubernetesNodeDetailMetrics.test.ts)
- [tests/KubernetesServiceDetailAggregation.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/KubernetesServiceDetailAggregation.test.ts)
- [tests/KubernetesTopologyBadgeAggregation.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/KubernetesTopologyBadgeAggregation.test.ts)
- [tests/KubernetesWorkloadOwnership.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/KubernetesWorkloadOwnership.test.ts)
- [tests/TopologyAutoFit.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/TopologyAutoFit.test.ts)
- [tests/TopologyGroupSelection.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/TopologyGroupSelection.test.ts)
- [tests/KubernetesDetailRefresh.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/KubernetesDetailRefresh.test.ts)
- [tests/KubernetesWorkloadStatus.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/KubernetesWorkloadStatus.test.ts)
- [tests/LLDPTopologyValidity.test.ts](/Users/hongwookryu/repository/GitHub/stardom3645/skydive-ui/tests/LLDPTopologyValidity.test.ts)

### 백엔드 구현

- [api/server/kubernetes_service_impact.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/api/server/kubernetes_service_impact.go)
- [api/server/manual_port_mapping_api.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/api/server/manual_port_mapping_api.go)
- [api/server/mold_kubernetes_api.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/api/server/mold_kubernetes_api.go)
- [api/server/mold_kubernetes_detail_api.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/api/server/mold_kubernetes_detail_api.go)
- [topology/probes/k8s/cache.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/topology/probes/k8s/cache.go)
- [topology/probes/k8s/daemonset.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/topology/probes/k8s/daemonset.go)
- [topology/probes/k8s/graph.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/topology/probes/k8s/graph.go)
- [topology/probes/k8s/statefulset.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/topology/probes/k8s/statefulset.go)
- [topology/probes/lldp/lldp.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/topology/probes/lldp/lldp.go)
- [api/server/kubernetes_endpoint_status.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/api/server/kubernetes_endpoint_status.go)
- [topology/lldp_validity.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/topology/lldp_validity.go)
- [topology/probes/lldp/lease.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/topology/probes/lldp/lease.go)

### 백엔드 테스트

- [api/server/manual_port_mapping_api_test.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/api/server/manual_port_mapping_api_test.go)
- [topology/probes/k8s/owner_relationship_test.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/topology/probes/k8s/owner_relationship_test.go)
- [api/server/kubernetes_endpoint_status_test.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/api/server/kubernetes_endpoint_status_test.go)
- [topology/probes/k8s/cache_identity_test.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/topology/probes/k8s/cache_identity_test.go)
- [topology/probes/lldp/lease_test.go](/Users/hongwookryu/repository/GitHub/stardom3645/skydive/topology/probes/lldp/lease_test.go)

### 결과 문서

이 파일: `docs/NETDIVE_V2_F02_F06_STABILIZATION.md`. 기존 경쟁력 평가 보고서는 변경하지 않았다.

## 실제 배포 환경의 검증 절차

1. F02: replicas 3 Deployment를 롤아웃/실패/복구하고 카드·상태 목록·상세의 자체 이상을 대조한다. observedGeneration이 뒤처진 순간을 포함한다. Job에 초기 실패 후 성공하는 재시도를 실행해 완료 후 Failed 누계가 위험으로 남지 않는지 확인한다. StatefulSet revision 교체와 DaemonSet 준비/미배치도 확인한다. 하위 Pod 이상 배지가 자체 이상과 섞이지 않아야 한다.
2. F03: Service에 Ready/NotReady 및 nil EndpointSlice를 구성한다. Ready 2개는 node-a, NotReady 1개는 node-b에 두어 집중 경고를 확인한다. 같은 Pod의 IPv4/IPv6 및 겹치는 Slice, selectorless 직접 주소, ExternalName, legacy Endpoints, endpoint 조회 권한 오류를 각각 확인한다. 대상 수와 주소 행 수를 구분한다.
3. F04: 같은 Service를 선택한 채 Ready 대상을 1→0→1로 바꾸고 한 갱신 주기 안에 상세가 바뀌는지 확인한다. Pod를 삭제/재생성하고 UID를 대조한다. API를 일시 차단했다 복구하고 오류→미확인→정상 복귀를 확인한다. 브라우저 Network에서 중복 요청·15초 취소·숨김 중 요청 중단·패널 변경 후 이전 응답 무시를 확인한다.
4. F05: 운영과 동일한 Linux/CGo 의존성을 갖춘 빌드에서 LLDP Probe를 먼저 빌드/검사한다. 짧은 TTL 패킷 반복→송신 중단→만료→재수신, 케이블 이동, TTL=0, NIC DOWN을 구분해 시험한다. 만료 전후 간선 ID와 ExpiresAt, port/NIC State를 비교한다. Probe 재시작 및 에이전트 강제 종료로 삭제 이벤트가 오지 않는 경우의 화면 만료도 확인한다. 수동 매핑 생성·AUTO 전환 이력과 Bond/Bridge/VM 관계 보존을 확인한다.
5. F06: 같은 selector의 StatefulSet/DaemonSet 두 개와 비소유 Pod를 두고 실제 owner만 연결되는지 확인한다. 같은 이름 컨트롤러 재생성 시 이전 UID의 Pod가 새 객체에 붙지 않아야 한다. 같은 namespace/이름을 가진 다중 클러스터를 대조한다. Deployment→ReplicaSet→Pod, CronJob→Job→Pod의 관련 탐색·로그·접기/펼치기·더블클릭·배지를 확인한다. ReplicaSet 수집 지연 시 잘못된 추정 연결이 생기지 않고, 수집 복구 후 올바른 사슬이 다시 구성돼야 한다.

## 남은 제약과 후속 확인

- macOS 검사에서는 Linux/CGo LLDP 패킷 수신 파일이 컴파일/실행되지 않는다. 순수 그래프 lease 테스트와 race 검사로 실제 AF_PACKET/스위치 연동을 대체할 수 없다.
- Endpoint 준비 상태는 Kubernetes가 제공하는 라우팅 대상 정보다. 애플리케이션 통신 성공·실패에 대한 능동 검사는 이번 범위에 없다.
- 브라우저 백그라운드 타이머 지연과 수집기/브라우저 시계 차이는 LLDP 화면 만료 시점에 영향을 줄 수 있다. 실환경의 시간 동기화를 함께 확인한다.
- 기존 프론트엔드 실패 테스트는 별도 작업으로 최신 공통 UI/테스트 harness 계약에 맞춰 분석해야 한다. 이번 수정의 성공 근거로 전체 테스트가 통과했다고 주장하지 않는다.
- 설정 변경은 필요 없다. 배포에 반영하려면 수정된 프론트엔드 정적 자산과 백엔드 바이너리를 기존 방식으로 빌드·교체해야 한다. 이 작업에서는 배포나 재시작을 수행하지 않았다.
