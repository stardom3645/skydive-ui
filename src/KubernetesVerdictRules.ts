type Rule = { label: string; description: string }
export const kubernetesVerdictRules = (kind: string): Rule[] => {
    switch (kind.toLowerCase()) {
    case 'persistentvolume': return [
        { label: '정상', description: 'Available(사용 가능), Bound이며 claimRef.name이 확인된 상태, 또는 Released(클레임 해제 후 회수 대기)입니다. Retain은 정상적인 수동 회수 정책이며, Retain이나 Released만으로 이상을 판정하지 않습니다. Released의 정상 판정은 새 PVC에 바인딩할 수 있다는 의미는 아닙니다.' },
        { label: '보완 권장', description: 'Bound이나 클레임 참조를 확인할 수 없어 관계 확인이 필요한 상태입니다. 실제 볼륨 회수 실패(Failed)와 데이터 수집 누락을 구분합니다.' },
        { label: '위험', description: 'Failed: 볼륨 회수·삭제 처리 실패 상태입니다. status.message, 회수 정책과 수집된 이벤트를 함께 확인해야 합니다.' },
        { label: '미확인', description: 'phase가 없거나 지원되는 상태로 해석할 수 없거나, 상태 데이터가 미수집·오래된 상태인 경우입니다. 누락된 용량·메트릭·이벤트만으로 장애를 만들지 않습니다.' }
    ]
    case 'persistentvolumeclaim': return [
        { label: '정상', description: 'Bound이며 spec.volumeName에 바인딩된 PV 이름이 확인된 상태입니다. PV 목록 미수집만으로 바인딩 손실을 판정하지 않습니다.' },
        { label: '보완 권장', description: 'Pending(바인딩 대기), 또는 Bound이나 PV 이름이 확인되지 않는 상태입니다. WaitForFirstConsumer 등의 의도된 대기일 수 있으므로 Pending만으로 서비스 장애를 확정하지 않습니다.' },
        { label: '위험', description: 'Lost: 기존에 바인딩된 볼륨과의 연결을 잃었다고 Kubernetes가 보고한 상태입니다.' },
        { label: '미확인', description: 'phase가 없거나 해석할 수 없거나, 상태 데이터가 미수집·오래된 상태인 경우입니다. 관련 PV·파드·이벤트 목록의 미수집은 데이터 수집 범위로 별도 표시합니다.' }
    ]
    case 'pod': return [
        { label: '위험', description: 'Evicted가 아닌 파드의 현재 문제 컨테이너에서 OOMKilled, CrashLoopBackOff, ImagePullBackOff, ErrImagePull 사유가 확인된 경우입니다.' },
        { label: '주의', description: '위험 조건에 해당하지 않으면서 대기 중인 컨테이너, Ready가 아닌 실행 컨테이너, 정상 완료가 아닌 종료 컨테이너 또는 활성 파드의 현재 문제 사유가 있는 경우입니다. 활성 파드의 Ready=false, 이미지·설정·실행 오류 등을 확인하며, 정상 종료한 Init 컨테이너는 제외합니다.' },
        { label: '정상·종료됨', description: '현재 문제 없이 phase가 확인되면 정상으로 표시합니다. Evicted는 종료됨으로 구분하며 과거 종료 이력과 재시작 누계는 별도로 표시합니다.' },
        { label: '미확인', description: '확인된 컨테이너·파드 문제도 없고 현재 phase 등 판정에 필요한 상태를 확인할 수 없는 경우입니다.' }
    ]
    case 'node': return [
        { label: '심각', description: 'Ready=false로 노드가 준비되지 않았다고 확인된 경우입니다.' },
        { label: '주의', description: '심각 조건이 없으면서 Ready가 True가 아닌 Condition, MemoryPressure·DiskPressure·PIDPressure·NetworkUnavailable=True, 현재 문제 파드 또는 spec.unschedulable=True가 확인된 경우입니다.' },
        { label: '정상', description: 'Ready=true이고 자체 이상·현재 문제 파드·스케줄링 제한이 없는 경우입니다.' },
        { label: '확인 불가', description: '확인된 심각·주의 근거가 없고 Ready·Condition 등 필요한 상태를 확인할 수 없습니다. CPU·메모리 메트릭 미수집과 노드 장애는 별개입니다.' }
    ]
    case 'namespace': return [
        { label: '심각', description: '네임스페이스가 Terminating 상태인 경우입니다.' },
        { label: '주의', description: 'Terminating은 아니지만 자체 상태가 Active가 아니거나, 현재 문제 파드·미가용 워크로드·사용할 수 없는 Endpoint가 1개 이상 확인된 경우입니다. 현재 문제 수는 파드와 미가용 워크로드를 UID 기준으로 중복 제거해 계산합니다.' },
        { label: '정상', description: '확인된 네임스페이스 상태에서 위의 현재 문제가 없는 경우입니다. 워크로드 미가용과 서비스 영향은 별도 근거와 함께 표시합니다.' },
        { label: '확인 불가', description: '확인된 심각·주의 근거가 없고 네임스페이스 상태를 확인할 수 없습니다. 정상 완료한 Job, 과거 종료 파드, 최근 이벤트 및 누적 이력은 현재 문제 수와 구분합니다.' }
    ]
    case 'service': return [
        { label: '정상', description: 'Ready Endpoint가 있고 준비되지 않은 Endpoint가 없는 경우입니다. ExternalName 유형은 Endpoint 기반 판정에서 제외하고 정상으로 표시하며, 실제 외부 대상의 가용성까지 확인한 것은 아닙니다.' },
        { label: '보완 권장', description: '일부 Endpoint가 준비되지 않았거나 제공 대상 Endpoint가 없는 경우입니다.' },
        { label: '위험', description: 'Endpoint가 존재하지만 Ready Endpoint가 없어 현재 트래픽을 제공할 대상이 없는 경우입니다.' },
        { label: '확인 불가', description: 'Endpoint 가용성 등 필요한 데이터가 수집되지 않은 경우입니다. selector 없는 Service는 직접 Endpoint 주소를 기준으로 평가합니다.' }
    ]
    case 'deployment': return [
        { label: '심각', description: '목표 복제본이 1개 이상인데 Available=0, ProgressDeadlineExceeded, 또는 ReplicaFailure=True인 경우입니다. 다른 진행 상태보다 우선합니다.' },
        { label: '업데이트 중', description: '심각 조건이 없고 배포가 일시 중지되었거나, Updated/Available이 목표보다 적지만 Progressing=True이고 Available이 1개 이상인 경우입니다.' },
        { label: '주의', description: '업데이트 진행 중 조건에 해당하지 않으면서 Updated/Available이 목표보다 적거나 Unavailable이 1개 이상인 경우입니다.' },
        { label: '정상', description: '위 조건에 해당하지 않고 목표 복제본이 충족된 경우입니다. 관련 파드 문제 수와 최근 이벤트는 별도 근거로 표시합니다.' },
        { label: '확인 불가', description: '현재 워크로드 상태를 수집하지 못했거나 오래된 상태만 있는 경우입니다.' }
    ]
    case 'statefulset': return [
        { label: '알 수 없음', description: 'Desired·Ready·Current·Updated 또는 CurrentRevision·UpdateRevision 중 판정에 필요한 값이 없는 경우입니다. 현재 워크로드 상태 자체가 미수집이면 확인 불가로 표시합니다.' },
        { label: '위험', description: '필수 상태가 확인된 상태에서 실패 Condition 또는 관련 PVC Lost가 있거나, 목표가 1개 이상인데 Ready=0인 경우입니다.' },
        { label: '주의', description: 'Ready가 목표보다 적거나 Unavailable이 1개 이상인 경우입니다. 리비전과 복제본이 모두 정상이어도 관련 PVC가 Pending이면 주의로 표시합니다.' },
        { label: '정상', description: 'CurrentRevision=UpdateRevision, Current=Updated=Ready=Desired이고 Unavailable=0인 경우입니다.' },
        { label: '업데이트 중', description: '가용성 저하 없이 리비전 또는 복제본 동기화가 아직 완료되지 않은 경우입니다.' }
    ]
    case 'daemonset': return [
        { label: '주의', description: 'Current·Ready·Available·Updated 중 확인된 값이 Desired보다 적거나, NumberUnavailable 또는 NumberMisscheduled가 1개 이상인 경우입니다.' },
        { label: '정상', description: '수집된 배치 상태에서 위의 부족·미가용·비대상 배치 문제가 없는 경우입니다. 누락된 개별 수치를 임의로 0으로 채우지 않습니다.' },
        { label: '확인 불가', description: '배치 상태 수치가 모두 미수집이거나 현재 워크로드 상태를 확인할 수 없는 경우입니다.' }
    ]
    case 'job': return [
        { label: '심각', description: 'Failed가 1개 이상이고 Active=0인 경우입니다.' },
        { label: '주의', description: '심각 조건이 없지만 실패 수, 현재 문제 파드 또는 자체 상태 이상이 있는 경우입니다. 자체 상태는 실패 Condition, Completions 대비 Succeeded 부족 등 현재 수집 값으로 평가합니다.' },
        { label: '정상', description: '현재 상태가 확인되고 위의 문제가 없는 경우입니다. 정상 완료와 과거 종료 이력은 구분해 표시합니다.' },
        { label: '확인 불가', description: '현재 Job 상태를 확인할 수 없는 경우입니다.' }
    ]
    case 'cronjob': return [
        { label: '주의', description: 'Suspend=True, 현재 문제 파드 또는 실패 Condition 등 자체 상태 이상이 있는 경우입니다. 일시 중지는 운영 확인 대상으로 표시하며 서비스 장애를 확정하지 않습니다.' },
        { label: '정상', description: '현재 상태가 확인되고 위의 문제가 없는 경우입니다. 스케줄·활성 Job 수·마지막 실행 시각은 별도 정보이며 임의로 실행 지연을 추정하지 않습니다.' },
        { label: '확인 불가', description: '현재 CronJob 상태를 확인할 수 없는 경우입니다.' }
    ]
    default: return [
        { label: '판정 근거', description: '현재 수집된 원본 상태와 상세 패널의 설명을 기준으로 확인합니다. 미수집 데이터나 과거 이력만으로 현재 장애를 확정하지 않습니다.' }
    ]
    }
}

