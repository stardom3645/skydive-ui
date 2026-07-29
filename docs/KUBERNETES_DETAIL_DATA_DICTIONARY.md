# Kubernetes 상세 패널 데이터 사전

이 문서는 클러스터·노드 상세 패널이 사용하는 현재 상태와 이력의 의미를
고정한다. React 컴포넌트는 아래 규칙을 다시 계산하지 않고 공통 집계 DTO만
사용한다.

## Pod 분류

| 이름 | 고정 정의 | 현재 수치 포함 |
| --- | --- | --- |
| `activePod` | `deletionTimestamp`가 없고 phase가 `Pending` 또는 `Running` | 포함 |
| `runningPod` | `activePod` 중 phase가 `Running` | 포함 |
| `pendingPod` | `activePod` 중 phase가 `Pending` | 포함 |
| `problemPod` | `activePod` 중 Ready=false, 조치가 필요한 Waiting reason 또는 현재/직전 OOMKilled | 포함 |
| `terminatedPod` | 삭제 중이거나 phase가 `Succeeded`/`Failed`, reason이 `Evicted`/`Completed` | 제외 |
| `evictedPod` | reason이 `Evicted`인 종료 Pod | 이력만 |
| `restartHistoryPod` | `activePod` 중 컨테이너 restartCount 합계가 1 이상 | 보조 현황 |
| `currentOOMKilledPod` | `activePod`의 현재 또는 직전 컨테이너 상태가 OOMKilled | 현재 문제 |

조치 대상 Waiting reason은 다음 값으로 고정한다.

- `CrashLoopBackOff`
- `ImagePullBackOff`
- `ErrImagePull`
- `CreateContainerConfigError`
- `CreateContainerError`
- `RunContainerError`
- `ContainerStatusUnknown`

모든 중복 제거 키는 `metadata.uid`이며 UID가 없는 비정상 입력만
`namespace/name` 또는 토폴로지 노드 ID를 보조 키로 사용한다.

## 범위

- 클러스터: 모든 `activePod`. `spec.nodeName`이 없는 Pending도 포함한다.
- 노드: `activePod` 중 `spec.nodeName`이 해당 노드명과 같은 Pod.
- 향후 Namespace: 같은 공통 집계에 `namespace` 범위만 적용한다.
- 향후 Workload: 최종 상위 컨트롤러 UID resolver와 `ownerUID` 범위를 적용한다.

클러스터 활성 Pod 수는 `노드별 활성 Pod 합계 + 미스케줄 Pending Pod`로
설명 가능해야 한다.

## 최종 상위 Workload Controller

- Deployment: `Pod → ReplicaSet → Deployment`
- StatefulSet: `Pod → StatefulSet`
- DaemonSet: `Pod → DaemonSet`
- CronJob: `Pod → Job → CronJob`
- Job: CronJob 소유가 없으면 `Pod → Job`

워크로드 집계는 최종 컨트롤러의 `metadata.uid`로 중복 제거한다.
단일 Replica는 desired replicas가 1인 Deployment/StatefulSet만 포함하고,
DaemonSet과 Job은 제외한다.

노드 로컬 스토리지 의존 워크로드는 hostPath, local PV 또는 local 계열
StorageClass를 사용하는 최종 컨트롤러만 포함한다. `emptyDir`는 제외한다.

## Service 현재 영향

Service 영향은 종료 Pod 이력이 아닌 현재 제공 가능성만 판정한다.

1. EndpointSlice가 있으면 Ready이며 현재 영향 Pod가 아닌 Endpoint가 하나라도
   존재할 때 정상이다.
2. EndpointSlice가 있으나 정상 Ready Endpoint가 0이면 영향받은 Service다.
3. EndpointSlice 증거가 없을 때만 selector로 활성 Pod를 평가한다.
4. selector가 없는 Service는 근거 부족으로 영향 수에 임의 포함하지 않는다.
5. 종료 Pod는 Service 현재 영향 판정에서 제외한다.

## 현재 장애 영향·종료 이력·최근 불안정성

- 현재 장애 영향: NotReady 노드, 현재 `problemPod`, 정상 Ready Endpoint가 없는
  Service처럼 현재 조치가 필요한 데이터만 사용한다.
- 종료 이력: `terminatedPod`와 종료 reason 집계다. 현재 장애 점수에 합산하지 않는다.
- 최근 불안정성: 종료 이력 중 선택 기간에 해당하는 항목이다. 시간 기준은
  종료 시각 → 상태 전환 시각 → Event 시각 → 생성 시각(추정) 순서다.

## 값 상태

- 정상적으로 집계된 빈 목록: 숫자 `0`
- 원본 필드 자체가 없음: `없음`
- API 또는 Metrics 조회 실패: `조회 실패`

