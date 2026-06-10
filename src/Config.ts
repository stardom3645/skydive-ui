/*
 * Copyright (C) 2020 Sylvain Afchain
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

import { Node, Link, NodeAttrs, LinkAttrs, LinkTagState } from './Topology'
import Tools from './Tools'

const SHOW_DEBUG = false

const WEIGHT_K8S_FEDERATION = 3000
const WEIGHT_K8S_CLUSTER = 3010
const WEIGHT_K8S_NODE = 3020
const WEIGHT_K8S_NAMESPACE = 3030
const WEIGHT_K8S_POD = 3040
const WEIGHT_K8S_CONTAINER = 3050
const WEIGHT_K8S_SERVICE = 3060
const WEIGHT_K8S_OTHER = 3200

const WEIGHT_PHY_FABRIC = 5010
const WEIGHT_SWITCH = 5015
const WEIGHT_SWITCH_PORTS = 5018
const WEIGHT_PHY_HOST = 5020
const WEIGHT_PHY_NIC = 5030
const WEIGHT_PHY_BOND = 5032
const WEIGHT_BRIDGES = 5035
const WEIGHT_VLAN = 5040
const WEIGHT_PHY_NET = 5050
const WEIGHT_PHY_PORTS = 5060

const WEIGHT_VIRT_NAMESPACE = 7010
const WEIGHT_VIRT_CONTAINERS = 7030
const WEIGHT_VIRT_BRIDGES = 7040
const WEIGHT_VIRT_NET = 7050
const WEIGHT_SYSTEM_VMS = 7060
const WEIGHT_VIRT_ROUTERS = 7070
const WEIGHT_VIRT_VMS = 7080
const WEIGHT_VIRT_PORTS = 7090

const WEIGHT_NONE = 20000

export let currentLanguage: "en" | "ko" = "ko";

export const i18nMap = {
    en: {
        "k8s-Federations": "Kubernetes Federations",
        "k8s-clusters": "Kubernetes Clusters",
        "k8s-nodes": "Kubernetes Nodes",
        "k8s-namespaces": "Kubernetes Namespaces",
        "k8s-pods": "Kubernetes Pods",
        "k8s-containers": "Kubernetes Containers",
        "k8s-services": "Kubernetes Services",
        "k8s-more": "Other Kubernetes",

        "vlans": "VLAN",
        "system-VMs": "System VMs",
        "virt-Routers": "Virtual Routers",
        "virt-VMs": "User VMs",
        "virt-containers": "Virtual Containers",
        "virt-bridges": "Virtual Bridges",
        "virt-namespaces": "Virtual Namespaces",
        "virt-net": "Virtual Network",
        "virt-ports": "Virtual Ports",

        "phy-fabric": "Physical Fabric",
        "phy-switch": "Physical Switch",
        "phy-switch-ports": "Physical Switch Ports",
        "phy-hosts": "Physical Hosts",
        "phy-nics": "Physical NICs",
        "phy-bond": "Bond Interfaces",
        "host-bridges": "Host Bridges",
        "phy-net": "Physical Network",
        "phy-ports": "Physical Ports",

        "Not classified": "Not Classified",
        "device(s)-nic": "NIC Group",
        "device(s)-network": "Network Device Group",
        "libvirt(s)": "VM Group",
        "switchport(s)": "Switch Port Group",
        "virt-router(s)": "Virtual Routers",
        "system-vm(s)": "System VMs",
        "virt-bridge(s)": "Virtual Bridges",
        "host-bridge(s)": "Host Bridges",
        "bridge(s)": "Bridges",
        "bond(s)": "Bond Interfaces",

        RxPackets: "Received Packets",
        RxBytes: "Received Bytes",
        TxPackets: "Transmitted Packets",
        TxBytes: "Transmitted Bytes",
        Start: "Measurement Start Time",
        Last: "Last Collection Time",

        "infrastructure": "infrastructure",
        "general": "General",
        "sockets": "Sockets",
        "captures": "Captures",
        "injections": "Injections",
        "runc": "Runc",
        "ipv4": "IPV4",
        "ipv6": "IPV6",
        "lastUpdateMetric": "Last Update Metrics",
        "metric": "Metrics",
        "features": "Device Features",
        "fdb": "Forwarding Database (FDB)",
        "neighbors": "Neighbors",
        "routingTables": "Routing Tables",

        "networkLinkLayer": "Network Link Layer",
        "searchNodeByNameExample": "Search by node name (e.g., ccvm)",
        "close": "Close",
        "setting": "Setting",
        "refresh": "Refresh",
        "loading": "Loading",
        "kubernetesCollection": "Kubernetes Collection",
        "kubernetesCollectionDescription": "Mold registered clusters are shown automatically. Select one cluster as the Netdive collection target.",
        "kubernetesNoClusters": "No Kubernetes clusters found.",
        "connectionTest": "Connection Test",
        "collectionOff": "Collection OFF",
        "collectionOn": "ON",
        "collectionOffShort": "OFF",
        "collectionRunning": "Running",
        "collectionPending": "ON / starting",
        "moldStatus": "Mold",
        "netdiveCollection": "Collection",
        "kubernetesProbeStarted": "Kubeconfig saved and Kubernetes collection started.",
        "kubernetesProbeStartFailed": "Kubeconfig saved, but Kubernetes collection did not start. Check analyzer logs.",
        "kubernetesLoadFailed": "Failed to load Kubernetes clusters.",
        "kubernetesRequestTimeout": "Kubernetes request timed out. Check Mold API connectivity and try again.",
        "kubernetesSavedRestartRequired": "Kubeconfig saved. Restart analyzer if the K8s probe is not running.",
        "kubernetesCollectionDisabled": "Kubernetes collection disabled.",
        "kubernetesDisabledRestartRequired": "Collection disabled. Restart analyzer to stop an already running K8s probe.",
        "kubernetesSaveFailed": "Failed to update Kubernetes collection setting.",
        "kubernetesTestSuccess": "Kubernetes connection test succeeded.",
        "kubernetesTestFailed": "Kubernetes connection test failed.",
        "kubernetesManagerTitle": "Kubernetes Collection Management",
        "kubernetesManagerDescription": "Display Mold registered Kubernetes clusters in the Netdive topology.",
        "kubernetesTotalClusters": "Total clusters",
        "kubernetesClusterList": "Cluster List",
        "kubernetesTestAll": "Test All Connections",
        "kubernetesClusterName": "Cluster Name",
        "kubernetesMoldClusterId": "Mold Cluster ID",
        "kubernetesApiServer": "API Server",
        "kubernetesLastConnectionTest": "Last Connection Test",
        "kubernetesLastCollectionStatus": "Last Collection Status",
        "kubernetesActions": "Actions",
        "kubernetesNoSecretNotice": "Kubeconfig, token, and certificate data are never displayed.",
        "kubernetesEnableConfirmTitle": "Confirm Collection Activation",
        "kubernetesEnableConfirmDescription": "Enabling collection creates kubeconfig and starts the Netdive K8s probe.",
        "kubernetesDisableConfirmTitle": "Confirm Collection Stop",
        "kubernetesDisableConfirmDescription": "Stop collecting this Kubernetes cluster from Netdive topology.",
        "kubernetesStepKubeconfig": "Preparing kubeconfig",
        "kubernetesStepConnection": "Checking connection",
        "kubernetesNoTestResult": "Run a connection test to see itemized results.",
        "kubernetesDefaultEnabledProbes": "Default enabled probes",
        "kubernetesDefaultDisabledProbes": "Default disabled probes",
        "collectionRunningShort": "running",
        "collectionStoppedShort": "stopped",
        "collectionStopped": "Stopped",
        "collectionError": "Collection error",
        "moldStateRunning": "Running",
        "moldStateStopped": "Stopped",
        "moldStateError": "Error",
        "themeSetting": "Theme Setting",
        "connected": "Connected",
        "disconnected": "Disconnected",
        "diagnostics": "Diagnostics",
        "cancel": "Cancel",
        "activate": "Activate",
        "deactivate": "Deactivate",
        "details": "Details",
        "retry": "Retry",
        "copy": "Copy",
        "copied": "Copied",
        "success": "Success",
        "failed": "Failed",
        "collectionSection": "Collection",
        "viewSettingsSection": "View Settings",
        "helpSection": "Help",
        "kubernetesCollectionMenu": "Kubernetes Collection",
        "clusterCountPrefix": "",
        "clusterCountSuffix": " clusters",
        "screenConfig": "Screen Layout",
        "screenConfigDescription": "Manage topology display options.",
        "screenConfigComingSoon": "Available soon",
        "preferences": "Preferences",
        "preferencesDescription": "Manage language and screen theme.",
        "language": "Language",
        "showInfrastructureLayer": "Show Infrastructure Layer",
        "showKubernetesLayer": "Show Kubernetes Layer",
        "showNetworkLinkLayer": "Show Network Link Layer",
        "showTrafficLabels": "Show Traffic Labels",
        "nodeLabelDisplayMode": "Node Label Display Mode",
        "showGroupNodes": "Show Group Nodes",
        "kubernetesCheck-kubeconfig": "Create/read kubeconfig",
        "kubernetesCheck-apiserver": "API Server access",
        "kubernetesCheck-client": "API Server access",
        "kubernetesCheck-version": "/version call",
        "kubernetesCheck-namespaces": "List namespaces",
        "kubernetesCheck-nodes": "List nodes",
        "kubernetesCheck-pods": "List pods",
        "kubernetesCheck-services": "List services",
        "kubernetesCheck-networkpolicies": "List networkpolicies",

        "help": "Help",
        "netTopologyPageDescription": "- This page visualizes the network topology.",
        "searchByNodeNameExample": "- You can search by node name (e.g., bridge0, cloud0).",
        "filterByLinkType": "- You can filter connection layers by selecting a link type.",
        "moreInfoIntro": "For more details, check",
        "moreInfoOutro": "on the ABLESTACK Online Docs.",
        "layer2": "Physical Network Layer (Layer 2)",
        "vlayer2": "Virtual Network Layer (Virtual Layer 2)",
        "mirroring": "Mirroring (Mirroring)",

        "Key": "Key",
        "Value": "Value",
        "Name": "Name",
        "Type": "Type",
        "MAC": "MAC Address",
        "Driver": "Driver",
        "State": "State",
        "BusInfo": "Bus Information",
        "EncapType": "Encapsulation Type",
        "IfIndex": "Interface Index",
        "LinkFlags": "Link Flags",
        "MTU": "Maximum Transmission Unit",
        "Speed": "Speed",
        "TID": "Transaction ID",
        "Hostname": "Hostname",
        "KernelCmdLine": "Kernel Command Line",
        "KernelVersion": "Kernel Version",
        "Platform": "Platform",
        "PlatformVersion": "Platform Version",
        "VirtualizationRole": "Virtualization Role",
        "VirtualizationSystem": "Virtualization System",
        "Rows per page": "Rows per page",
        "LocalAddress": "Local Address",
        "LocalPort": "Local Port",
        "Pid": "Process ID",
        "Process": "Process Name",
        "Protocol": "Protocol",
        "RemoteAddress": "Remote Address",
        "RemotePort": "Remote Port",
        "ID": "ID",
        "Src": "Source",
        "Prefix": "Prefix",
        "Priority": "Priority",
        "IfAddr": "Interface Address",
        "IfName": "Interface Name",
        "Libvirt": "Libvirt Metadata",
        "MasterIndex": "Master Index",
        "PeerIntfMAC": "Peer Interface MAC Address",

        "Packet capture": "Packet capture",
        "Description": "Description",
        "Filter (BPF)": "Filter (BPF) ex: tcp port 22",
        "Advanced options": "Advanced options",
        "Capture Type": "Capture Type",
        "PCAP (Packet Capture library based probe)": "PCAP (Packet Capture library based probe)",
        "AFPacket (MMap'd AF_PACKET socket reading)": "AFPacket (MMap'd AF_PACKET socket reading)",
        "sFlow  (Socket reading sFlow frames)": "sFlow  (Socket reading sFlow frames)",
        "DPDK": "DPDK (Data Plane Development Kit)",
        "OVS Mirror  (Leverages mirroring to capture - experimental)": "OVS Mirror  (Leverages mirroring to capture - experimental)",
        "eBPF (Flow capture within kernel - experimental)": "eBPF (Flow capture within kernel - experimental)",
        "Layers used for Flow Key": "Layers used for Flow Key",
        "L2 (uses Layer 2 and beyond)": "L2 (uses Layer 2 and beyond)",
        "L3 (uses layer 3 and beyond)": "L3 (uses layer 3 and beyond)",
        "Header size": "Header size",
        "Extra TCP metric": "Extra TCP metric",
        "Defragment IPv4 packets": "Defragment IPv4 packets",
        "Reassemble TCP packets": "Reassemble TCP packets",
        "Raw packet limit": "Raw packet limit",
        "Select capture type": "Select capture type",

        "Flow table": "Flow table",
        "Application": "Application",
        "Network.A": "Network.A",
        "Network.B": "Network.B",
        "Transport.A": "Transport.A",
        "Transport.B": "Transport.B",
        "Total.ABBytes": "Total.ABBytes",
        "Total.BAPackets": "Total.BAPackets",
        "This panel displays captured network flows in real-time. Use filters above to narrow the results.": "This panel displays captured network flows in real-time. Use filters above to narrow the results.",
        "Displays general information about hosts and devices.": "Displays general information about hosts and devices.",
        "Displays socket connection information.": "Displays socket connection information.",
        "Lists active packet captures. Deletion is also available.": "Lists active packet captures. Deletion is also available.",
        "Displays the list of packet injections.": "Displays the list of packet injections.",
        "Displays information about Runc container runtime.": "Displays information about Runc container runtime.",
        "Displays the latest update metrics for this flow or node.": "Displays the latest update metrics for this flow or node.",
        "Displays overall metrics such as byte and packet counters.": "Displays overall metrics such as byte and packet counters.",
        "flow_table_help": "This panel displays captured network flows in real-time. Use filters above to narrow the results.",
        "device_functions_help": "Displays the supported hardware or software network functions of the selected device, such as bridge or router capabilities.",
        "fdb_help": "Displays the Forwarding Database (FDB) with MAC addresses and their associated output ports for Layer 2 forwarding.",
        "neighbors_help": "Displays the list of discovered neighboring devices and their network reachability information like ARP or NDP entries.",
        "routing_tables_help": "Displays routing table entries showing network destinations, next hops, and interface mappings for Layer 3 forwarding.",

        "capture": "Capture",
        "delete-captures": "Delete captures",

        "capture-extraTCPMetric-tooltip": "Includes TCP performance metrics such as RTT and retransmissions in the flow.",
        "capture-IPDefrag-tooltip": "Reassembles fragmented IP packets (e.g., large ICMP or UDP packets exceeding the MTU) into their original form for accurate flow analysis.",
        "capture-reassembleTCP-tooltip": "Reassembles multiple TCP segments to analyze higher-layer protocols such as HTTP or TLS.",
        "capture-rawPacketLimit-tooltip": "Click to view raw packet storage conditions.",
        "capture-rawPacketLimit-explained": "Limits how many raw packets are captured and saved. Accepts values between 1 and 10. Storing raw packets allows for deeper analysis but consumes more disk space.",
        "capture-headerSize-tooltip": "Sets how much of the beginning part (header) of each packet to include in the capture, in bytes.",
        "capture-headerSize-explained": "The header contains source/destination information and protocol metadata. This option sets how many bytes of the header to capture. Leave blank to use the default.",
        "capture-type-pcap": "A basic and widely compatible capture method. Easy to set up.",
        "capture-type-afpacket": "A Linux-specific method that's faster than PCAP, but slightly harder to configure.",
        "capture-type-ebpf": "High-performance method using kernel-level capture with low overhead. Requires recent Linux.",
        "capture-type-sflow": "Collects flow data sampled from switches/routers. Requires configuration on network devices.",
        "capture-type-dpdk": "Ultra-high-speed packet processing for advanced systems. Complex setup.",
        "capture-type-ovsmirror": "Mirrors traffic from OVS ports. Useful in virtualized environments.",
        "capture-headerSize-validation-error": "Header size must be between 14 and 4096.",
        "capture-rawPacketLimit-validation-error": "Valid values are 0 or between 1 and 10.",

        "capture-create-failed": "Capture creation failed",
        "capture-duplicate-error": "A capture with the same parameters already exists.",
        "capture-unknown-error": "An unknown error has occurred.",
        "capture-conflict-error": "A conflicting capture already exists with those parameters.",
        "capture-network-error": "The request failed due to a network error.",
        "capture-validation-error": "There is a problem with the input. Please check your values.",
        "capture-create-success": "Capture has been created. Click the node again to view the Flow Table.",
        "no-data-check-filter-or-capture": "No data available. Please check the capture type, configuration, or adjust the filter conditions.",
        "bpf-pcap-only": "BPF filters are only supported for PCAP captures.",
        "sflow-unavailable-no": "This interface does not have an IPv4 address, so sFlow capture cannot be configured.",
        "dpdk-unavailable": "This node is not a DPDK port, so DPDK capture is not available.",
        "ovs-mirror-physical-nic-only": "OVS Mirror is only available on OVS ports connected to a physical NIC.",
        "tooltip-pcap": "PCAP: The simplest capture driver with low performance, but works in most environments.",
        "tooltip-afpacket": "AFPacket: High-speed packet capture based on the Linux kernel. Recommended for general NICs.",
        "tooltip-ebpf": "eBPF: Requires a modern Linux kernel and enables high-performance capture and filtering.",
        "tooltip-sflow": "sFlow: Receives flow data collected from switches/routers. External configuration required.",
        "tooltip-dpdk": "DPDK: High-performance user-space packet processing. Requires dedicated drivers and hugepage setup.",
        "tooltip-afpacket-unavailable": "This node does not support AFPacket capture.",
        "tooltip-pcap-unavailable": "This node does not support PCAP capture.",
        "expandAllNodes": "Expand All Nodes",
        "collapseAllNodes": "Collapse All Nodes"
    },
    ko: {
        "k8s-Federations": "쿠버네티스 페더레이션",
        "k8s-clusters": "쿠버네티스 클러스터",
        "k8s-nodes": "쿠버네티스 노드",
        "k8s-namespaces": "쿠버네티스 네임스페이스",
        "k8s-pods": "쿠버네티스 파드",
        "k8s-containers": "쿠버네티스 컨테이너",
        "k8s-services": "쿠버네티스 서비스",
        "k8s-more": "기타 쿠버네티스",

        "vlans": "VLAN",
        "system-VMs": "시스템 가상머신",
        "virt-Routers": "가상 라우터",
        "virt-VMs": "사용자 가상머신",
        "virt-containers": "가상 컨테이너",
        "virt-bridges": "가상 브릿지",
        "virt-namespaces": "가상 네임스페이스",
        "virt-net": "가상 네트워크",
        "virt-ports": "가상 포트",

        "phy-fabric": "패브릭",
        "phy-switch": "스위치",
        "phy-switch-ports": "스위치 포트",
        "phy-hosts": "호스트",
        "phy-nics": "NIC",
        "phy-bond": "본딩 인터페이스",
        "host-bridges": "호스트 브릿지",
        "phy-net": "네트워크",
        "phy-ports": "포트",

        "Not classified": "분류되지 않음",
        "device(s)-nic": "NIC 그룹",
        "device(s)-network": "네트워크 장치 그룹",
        "libvirt(s)": "VM 그룹",
        "switchport(s)": "스위치 포트 그룹",
        "virt-router(s)": "가상 라우터",
        "system-vm(s)": "시스템 가상머신",
        "virt-bridge(s)": "가상 브릿지",
        "host-bridge(s)": "호스트 브릿지",
        "bridge(s)": "브릿지",
        "bond(s)": "본딩 인터페이스",

        "RxPackets": "수신 패킷 수",
        "RxBytes": "수신 바이트 수",
        "TxPackets": "송신 패킷 수",
        "TxBytes": "송신 바이트 수",
        "Start": "캡처 시작",
        "Last": "최종 수집 시간",

        "infrastructure": "인프라스트럭처 레이어",
        "general": "일반 정보",
        "sockets": "소켓",
        "captures": "트래픽 캡처",
        "injections": "패킷 주입",
        "runc": "컨테이너 런타임",
        "ipv4": "IPV4 주소",
        "ipv6": "IPV6 주소",
        "lastUpdateMetric": "최근 수집 지표",
        "metric": "누적 수집 지표",
        "features": "장비 기능",
        "fdb": "포워딩 데이터베이스 (FDB)",
        "neighbors": "인접 장비 정보",
        "routingTables": "라우팅 테이블",

        "networkLinkLayer": "네트워크 링크 계층",
        "searchNodeByNameExample": "노드 이름(예: ccvm)으로 검색",
        "close": "닫기",
        "setting": "설정",
        "refresh": "새로고침",
        "loading": "불러오는 중",
        "kubernetesCollection": "Kubernetes 수집",
        "kubernetesCollectionDescription": "Mold에 등록된 클러스터를 자동 표시합니다. Netdive 수집 대상은 하나만 선택합니다.",
        "kubernetesNoClusters": "Kubernetes 클러스터가 없습니다.",
        "connectionTest": "연결 테스트",
        "collectionOff": "수집 OFF",
        "collectionOn": "ON",
        "collectionOffShort": "OFF",
        "collectionRunning": "실행 중",
        "collectionPending": "ON / 시작 대기",
        "moldStatus": "Mold",
        "netdiveCollection": "수집",
        "kubernetesProbeStarted": "kubeconfig를 저장했고 Kubernetes 수집을 시작했습니다.",
        "kubernetesProbeStartFailed": "kubeconfig는 저장했지만 Kubernetes 수집을 시작하지 못했습니다. analyzer 로그를 확인하세요.",
        "kubernetesLoadFailed": "Kubernetes 클러스터 목록을 불러오지 못했습니다.",
        "kubernetesRequestTimeout": "Kubernetes 요청 시간이 초과되었습니다. Mold API 연결 상태를 확인하고 다시 시도하세요.",
        "kubernetesSavedRestartRequired": "kubeconfig를 저장했습니다. K8s probe가 실행 중이 아니면 analyzer 재시작이 필요합니다.",
        "kubernetesCollectionDisabled": "Kubernetes 수집을 비활성화했습니다.",
        "kubernetesDisabledRestartRequired": "수집을 비활성화했습니다. 실행 중인 K8s probe 중지는 analyzer 재시작이 필요합니다.",
        "kubernetesSaveFailed": "Kubernetes 수집 설정 변경에 실패했습니다.",
        "kubernetesTestSuccess": "Kubernetes 연결 테스트에 성공했습니다.",
        "kubernetesTestFailed": "Kubernetes 연결 테스트에 실패했습니다.",
        "kubernetesManagerTitle": "Kubernetes 수집 관리",
        "kubernetesManagerDescription": "Mold에 등록된 Kubernetes 클러스터를 Netdive 토폴로지에 표시합니다.",
        "kubernetesTotalClusters": "전체 클러스터",
        "kubernetesClusterList": "클러스터 목록",
        "kubernetesTestAll": "전체 연결 테스트",
        "kubernetesClusterName": "클러스터 이름",
        "kubernetesMoldClusterId": "Mold 클러스터 ID",
        "kubernetesApiServer": "API Server",
        "kubernetesLastConnectionTest": "마지막 연결 테스트",
        "kubernetesLastCollectionStatus": "마지막 수집 상태",
        "kubernetesActions": "작업",
        "kubernetesNoSecretNotice": "kubeconfig, token, 인증서 데이터는 화면에 표시하지 않습니다.",
        "kubernetesEnableConfirmTitle": "수집 활성화 확인",
        "kubernetesEnableConfirmDescription": "수집을 활성화하면 kubeconfig가 생성되고 Netdive K8s probe가 시작됩니다.",
        "kubernetesDisableConfirmTitle": "수집 중지 확인",
        "kubernetesDisableConfirmDescription": "이 Kubernetes 클러스터를 Netdive 토폴로지 수집 대상에서 제외합니다.",
        "kubernetesStepKubeconfig": "kubeconfig 준비 중",
        "kubernetesStepConnection": "연결 확인 중",
        "kubernetesNoTestResult": "연결 테스트를 실행하면 항목별 결과가 표시됩니다.",
        "kubernetesDefaultEnabledProbes": "기본 활성화 probe",
        "kubernetesDefaultDisabledProbes": "기본 비활성화 probe",
        "collectionRunningShort": "수집 중",
        "collectionStoppedShort": "중지",
        "collectionStopped": "수집 중지",
        "collectionError": "수집 오류",
        "moldStateRunning": "가동 중",
        "moldStateStopped": "정지됨",
        "moldStateError": "오류",
        "themeSetting": "화면 테마",
        "connected": "연결됨",
        "disconnected": "미연결",
        "diagnostics": "진단",
        "cancel": "취소",
        "activate": "활성화",
        "deactivate": "비활성화",
        "details": "상세 보기",
        "retry": "재시도",
        "copy": "복사",
        "copied": "복사됨",
        "success": "성공",
        "failed": "실패",
        "collectionSection": "수집",
        "viewSettingsSection": "보기 설정",
        "helpSection": "도움말",
        "kubernetesCollectionMenu": "Kubernetes 수집",
        "clusterCountPrefix": "클러스터",
        "clusterCountSuffix": "개",
        "screenConfig": "화면 구성",
        "screenConfigDescription": "토폴로지 표시 옵션을 관리합니다.",
        "screenConfigComingSoon": "준비 중",
        "preferences": "환경 설정",
        "preferencesDescription": "언어와 화면 테마를 설정합니다.",
        "language": "언어",
        "showInfrastructureLayer": "인프라스트럭처 레이어 표시",
        "showKubernetesLayer": "Kubernetes 레이어 표시",
        "showNetworkLinkLayer": "네트워크 링크 계층 표시",
        "showTrafficLabels": "트래픽 라벨 표시",
        "nodeLabelDisplayMode": "노드 라벨 표시 방식",
        "showGroupNodes": "그룹 노드 표시",
        "kubernetesCheck-kubeconfig": "kubeconfig 생성/읽기",
        "kubernetesCheck-apiserver": "API Server 접근",
        "kubernetesCheck-client": "API Server 접근",
        "kubernetesCheck-version": "/version 호출",
        "kubernetesCheck-namespaces": "namespace 목록 조회",
        "kubernetesCheck-nodes": "node 목록 조회",
        "kubernetesCheck-pods": "pod 목록 조회",
        "kubernetesCheck-services": "service 목록 조회",
        "kubernetesCheck-networkpolicies": "networkpolicy 목록 조회",

        "help": "도움말",
        "netTopologyPageDescription": "- 이 페이지는 네트워크 토폴로지를 시각화합니다.",
        "searchByNodeNameExample": "- 노드 이름(예: bridge0, cloud0)으로 검색할 수 있습니다.",
        "filterByLinkType": "- 링크 타입을 선택하여 연결 계층을 필터링할 수 있습니다.",
        "moreInfoIntro": "더 자세한 정보는",
        "moreInfoOutro": "에서 확인할 수 있습니다.",
        "layer2": "물리 네트워크 계층 (Layer 2)",
        "vlayer2": "가상 네트워크 계층 (Virtual Layer 2)",
        "mirroring": "미러링 (Mirroring)",

        "Key": "키",
        "Value": "값",
        "Name": "이름",
        "Type": "타입",
        "MAC": "맥 주소(MAC)",
        "Driver": "드라이버",
        "State": "상태",
        "BusInfo": "버스 정보",
        "EncapType": "캡슐화 타입",
        "IfIndex": "인터페이스 인덱스",
        "LinkFlags": "링크 플래그",
        "MTU": "최대 전송 단위(MTU)",
        "Speed": "속도",
        "TID": "트랜잭션 ID",
        "Hostname": "호스트명",
        "KernelCmdLine": "커널 명령줄",
        "KernelVersion": "커널 버전",
        "Platform": "플랫폼",
        "PlatformVersion": "플랫폼 버전",
        "VirtualizationRole": "가상화 역할",
        "VirtualizationSystem": "가상화 시스템",
        "Rows per page": "페이지당 행 수",
        "LocalAddress": "로컬 주소",
        "LocalPort": "로컬 포트",
        "Pid": "프로세스 ID",
        "Process": "프로세스 이름",
        "Protocol": "프로토콜",
        "RemoteAddress": "원격 주소",
        "RemotePort": "원격 포트",
        "ID": "ID",
        "Src": "출발지",
        "Prefix": "프리픽스",
        "Priority": "우선순위",
        "IfAddr": "인터페이스 주소",
        "IfName": "인터페이스 이름",
        "Libvirt": "Libvirt 메타데이터",
        "MasterIndex": "마스터 인덱스",
        "PeerIntfMAC": "피어 인터페이스 MAC 주소",

        "Packet capture": "패킷 캡처",
        "Description": "설명",
        "Filter (BPF)": "필터 (BPF) 예: tcp port 22",
        "Advanced options": "고급 옵션",
        "Capture Type": "캡처 타입",
        "PCAP (Packet Capture library based probe)": "PCAP (패킷 캡처 라이브러리 기반 프로브)",
        "AFPacket (MMap'd AF_PACKET socket reading)": "AFPacket (메모리 매핑된 AF_PACKET 소켓 읽기)",
        "sFlow  (Socket reading sFlow frames)": "sFlow (sFlow 프레임 소켓 읽기)",
        "DPDK": "DPDK (Data Plane Development Kit)",
        "OVS Mirror (Leverages mirroring to capture - experimental)": "OVS 미러 (미러링을 활용한 캡처 - 실험기능)",
        "eBPF (Flow capture within kernel - experimental)": "eBPF (커널 내 플로우 캡처 - 실험기능)",
        "Layers used for Flow Key": "플로우 키에 사용되는 레이어",
        "L2 (uses Layer 2 and beyond)": "L2 (2계층 및 그 이후 사용)",
        "L3 (uses layer 3 and beyond)": "L3 (3계층 및 그 이후 사용)",
        "Header size": "헤더 크기",
        "Extra TCP metric": "추가 TCP 메트릭",
        "Defragment IPv4 packets": "IPv4 패킷 재조립",
        "Reassemble TCP packets": "TCP 패킷 재조립",
        "Raw packet limit": "원시 패킷 제한",
        "Select capture type": "캡쳐 타입 선택",

        "Flow table": "플로우 테이블",
        "Application": "애플리케이션",
        "Network.A": "네트워크 A",
        "Network.B": "네트워크 B",
        "Transport.A": "트랜스포트 A",
        "Transport.B": "트랜스포트 B",
        "Total.ABBytes": "총 AB 바이트",
        "Total.BAPackets": "총 BA 패킷",
        "This panel displays captured network flows in real-time. Use filters above to narrow the results.": "이 패널은 실시간 네트워크 플로우를 표시합니다. 위의 필터를 사용해 결과를 좁힐 수 있습니다.",
        "Displays general information about hosts and devices.": "호스트 및 디바이스의 일반 정보를 보여줍니다.",
        "Displays socket connection information.": "소켓 연결 정보가 여기에 표시됩니다.",
        "Lists active packet captures. Deletion is also available.": "활성화된 패킷 캡처 목록입니다. 삭제도 가능합니다.",
        "Displays the list of packet injections.": "네트워크 테스트 또는 디버깅 목적으로 특정 패킷을 네트워크에 인위적으로 주입하는 작업의 목록이 표시됩니다. ",
        "Displays information about Runc container runtime.": "경량 컨테이너 런타임인 Runc에 대한 상태 정보와 동작 정보를 보여줍니다. 이는 도커 및 기타 컨테이너 관리 도구에서 컨테이너를 실행하는 데 사용됩니다.",
        "Displays the latest update metrics for this flow or node.": "이 플로우 또는 노드의 최신 업데이트 메트릭이 표시됩니다.",
        "Displays overall metrics such as byte and packet counters.": "바이트 및 패킷 수와 같은 전체 메트릭이 표시됩니다.",
        "flow_table_help": "이 패널은 선택한 노드에서 캡처한 네트워크 플로우 데이터를 실시간으로 보여줍니다. 애플리케이션 간 통신 패턴, 트래픽량, 플로우 단위의 통계를 분석할 수 있으며, 필터를 통해 특정 포트나 노드를 집중 분석할 수 있습니다.",
        "device_functions_help": "선택한 네트워크 인터페이스의 하드웨어 오프로드 및 장치 기능 플래그를 자세히 보여줍니다. 하드웨어 체크섬 오프로드, VLAN 필터링, 수신 오프로드 등 성능과 CPU 부하에 영향을 줄 수 있는 기능을 확인할 수 있습니다.",
        "fdb_help": "스위치나 브리지의 MAC 주소 전송 테이블(FDB)을 보여줍니다. MAC 주소와 포트 매핑을 확인하여 L2 전송 동작이 정상인지 검증하는 데 유용합니다.",
        "neighbors_help": "IPv4의 ARP(주소 결정 프로토콜) 또는 IPv6의 NDP(이웃 탐색 프로토콜)를 통해 발견된 인접 장비 목록을 보여줍니다. ARP는 IP 주소를 MAC 주소로 변환하고, NDP는 IPv6 환경에서 이와 유사한 기능을 수행합니다. 이 테이블은 MAC 주소, IP 주소, 인터페이스 인덱스를 제공하며, 네트워크 상의 활성 장비를 확인하거나 연결 불가, 주소 충돌과 같은 문제를 진단하는 데 도움을 줍니다.",
        "routing_tables_help": "장비의 라우팅 테이블 정보를 보여줍니다. 목적지 네트워크, 다음 홉, 인터페이스 정보를 통해 경로 설정이나 네트워크 분할 상태를 확인할 수 있습니다.",
        "capture": "캡처",
        "delete-captures": "캡처 삭제",

        "capture-extraTCPMetric-tooltip": "RTT, 재전송 횟수 등의 TCP 성능 정보를 플로우에 포함합니다.",
        "capture-IPDefrag-tooltip": "조각화된 IP 패킷(예: MTU보다 큰 ICMP나 UDP 등)을 하나의 원래 패킷으로 재조립해 정확한 흐름을 분석합니다.",
        "capture-reassembleTCP-tooltip": "여러 TCP 세그먼트를 조립해 HTTP, TLS 등의 상위 프로토콜을 분석할 수 있게 합니다.",
        "capture-rawPacketLimit-tooltip": "원시 패킷 저장 조건을 확인하려면 클릭하세요.",
        "capture-rawPacketLimit-explained": "캡처할 원시 패킷 수를 제한합니다. 1 이상 10 이하로 설정할 수 있습니다. 설정한 수만큼 패킷의 원문 데이터를 저장하며, 디스크 용량에 유의하세요. 너무 적게 설정하면 상세 분석이 제한될 수 있습니다.",
        "capture-headerSize-tooltip": "캡처할 패킷의 앞부분(헤더)을 얼마나 포함할지 바이트 단위로 설정합니다.",
        "capture-headerSize-explained": "헤더는 패킷의 출발지/목적지 정보, 프로토콜 정보 등이 담긴 부분입니다. 이 옵션은 분석을 위해 얼마만큼 캡처할지 바이트 단위로 지정합니다. 비워두면 기본값이 적용됩니다.",
        "capture-type-pcap": "기본적인 캡처 방식으로, 대부분 환경에서 동작하며 설정이 간단합니다.",
        "capture-type-afpacket": "리눅스 전용 고속 캡처 방식으로, PCAP보다 성능이 조금 더 좋지만 설정이 까다로울 수 있습니다.",
        "capture-type-ebpf": "커널 수준에서 동작하는 고성능 캡처 방식으로, 시스템 부하가 적고 최근 리눅스에 적합합니다.",
        "capture-type-sflow": "스위치/라우터에서 전송하는 샘플링 기반 흐름 데이터를 수집합니다. 장비 설정이 필요합니다.",
        "capture-type-dpdk": "매우 빠른 패킷 처리를 위한 전문 기술로, 고성능 시스템에서만 사용합니다. 설정이 복잡할 수 있습니다.",
        "capture-type-ovsmirror": "OVS의 포트 트래픽을 복제하여 캡처합니다. 가상환경에서 유용합니다.",
        "capture-headerSize-validation-error": "헤더 크기는 14 이상 4096 이하의 숫자여야 합니다.",
        "capture-rawPacketLimit-validation-error": "유효한 값은 0 또는 1~10 사이의 숫자입니다.",

        "capture-create-failed": "캡처 생성 실패",
        "capture-duplicate-error": "캡처가 이미 존재합니다.",
        "capture-unknown-error": "알 수 없는 오류가 발생했습니다.",
        "capture-conflict-error": "해당 조건으로는 중복된 캡처가 존재합니다.",
        "capture-network-error": "네트워크 오류로 요청이 실패했습니다.",
        "capture-validation-error": "입력값에 문제가 있습니다. 값을 확인해 주세요.",
        "capture-create-success": "캡처가 생성되었습니다. 해당 노드를 다시 클릭하면 '플로우 테이블'을 확인할 수 있습니다.",
        "no-data-check-filter-or-capture": "데이터가 없습니다. 필터 조건을 변경하거나 캡쳐 타입 및 구성을 확인하세요.",
        "bpf-pcap-only": "BPF 필터는 PCAP 캡처 경우에만 지원됩니다.",
        "ovs-mirror-only": "OVS 포트에서만 사용 가능합니다.",
        "sflow-unavailable-no": "이 노드에는 IPv4 주소가 없어 sFlow 캡처를 설정할 수 없습니다.",
        "dpdk-unavailable": "이 노드는 DPDK 포트가 아니므로 DPDK 캡처를 사용할 수 없습니다.",
        "tooltip-pcap": "가장 간단한 캡처 드라이버, 대부분 환경에서 동작.",
        "tooltip-afpacket": "리눅스 커널 기반 고속 패킷 캡처. 일반적인 NIC에 권장.",
        "tooltip-ebpf": "최신 리눅스 커널이 필요하며 고성능 캡처 및 필터링이 가능.",
        "tooltip-sflow": "스위치/라우터에서 수집된 플로우 데이터를 수신합니다. 외부 설정(sFlow Exporter) 필요.",
        "tooltip-dpdk": "고성능 사용자 공간 패킷 처리. 전용 드라이버 및 hugepage 설정 필요.",
        "tooltip-afpacket-unavailable": "이 노드는 AFPacket 캡처를 사용할 수 없습니다.",
        "tooltip-pcap-unavailable": "이 노드는 PCAP 캡처를 사용할 수 없습니다.",
        "expandAllNodes": "모든 노드 확장",
        "collapseAllNodes": "모든 노드 축소"
    }
};

export function translate(key: string): string {
    const lang = localStorage.getItem("language") || "ko";
    return i18nMap[lang][key] || key;
}

export interface Filter {
    id: string
    label: string
    category: string
    tag?: string
    callback: () => void
}

export interface MenuItem {
    class: string
    text: string
    disabled: boolean
    callback: () => void
}

export interface GraphField {
    type: string,
    data: any
}

export interface NodeDataField {
    field: string
    title?: string
    expanded: boolean
    icon: string
    iconClass?: string
    sortKeys?: (data: any) => Array<string>
    filterKeys?: (data: any) => Array<string>
    normalizer?: (data: any) => any
    graph?: (data: any) => GraphField
    deletable?: boolean
    onDelete?: (data: Array<Map<string, any>>) => void
    customRenders?: Map<string, (value: any) => any>
    helpTooltipText?: string
}

export interface LinkDataField {
    field: string
    title: string
    expanded: boolean
    icon: string
}

export interface Config {
    subTitle?(subTitle: string): string
    filters?(): Promise<Array<Filter>>
    defaultFilter?(): Filter

    nodeAttrs?(attrs: NodeAttrs | null, node: Node): NodeAttrs
    nodeSortFnc?(a: Node, b: Node): number
    nodeClicked?(node: Node): void
    nodeDblClicked?(node: Node): void

    nodeMenu?(items: Array<MenuItem>, node: Node): Array<MenuItem>
    nodeTags?(tags: Array<string>, data: any): Array<string>

    defaultNodeTag?(): string
    nodeTabTitle?(node: Node): string

    groupSize?(): number
    groupType?(node: Node): string | undefined
    groupName?(node: Node): string | undefined
    weightTitles?(): Map<number, string>

    suggestions?(): Array<string>

    nodeDataFields?(dataFields: Array<NodeDataField>): Array<NodeDataField>

    linkAttrs?(attrs: LinkAttrs | null, link: Link): LinkAttrs
    linkTabTitle?(link: Link): string
    isHierarchyLink?(data: any): boolean

    linkDataFields?(dataFields: Array<LinkDataField>): Array<LinkDataField>

    defaultLinkTagMode?(): number
}

class ConfigWithID {
    id: string
    config: Config

    constructor(id: string, config: Config) {
        this.id = id
        this.config = config
    }
}

export default class ConfigReducer {
    default: DefaultConfig
    configs: Array<ConfigWithID>

    constructor() {
        this.default = new DefaultConfig()
        this.configs = new Array<ConfigWithID>()
    }

    append(id: string, config: Config) {
        this.configs.push(new ConfigWithID(id, config))
    }

    appendURL(id: string, url: string): Promise<Config | undefined> {
        const promise = new Promise<Config | undefined>((resolve, reject) => {
            if (!url) {
                resolve(undefined)
                return
            }

            fetch(url)
                .then((resp) => {
                    return resp.text()
                })
                .then((data) => {
                    try {
                        const config = eval(data) as Config

                        this.append(id, config)
                        resolve(config)
                    } catch (e) {
                        reject(e)
                    }
                })
                .catch((reason) => {
                    reject(reason)
                })
        })

        return promise
    }

    subTitle(): string {
        var subTitle = this.default.subTitle()
        for (let c of this.configs) {
            if (c.config.subTitle) {
                subTitle = c.config.subTitle(subTitle)
            }
        }
        return subTitle
    }

    filters(): Promise<Array<Filter>> {
        var promise = new Promise<Array<Filter>>(resolve => {
            this.default.filters().then(filters => {
                var all = new Array<Promise<Array<Filter>>>()
                for (let c of this.configs) {
                    if (c.config.filters) {
                        all.push(c.config.filters())
                    }
                }

                if (all.length > 0) {
                    Promise.all(all).then(values => {
                        for (let vfs of values) {
                            for (let filter of vfs) {
                                if (!filters.some(f => filter.id === f.id)) {
                                    filters.push(filter)
                                }
                            }
                        }
                        resolve(filters)
                    })
                } else {
                    resolve(filters)
                }
            })
        })
        return promise
    }

    defaultFilter(): Filter {
        var defaultFilter = this.default.defaultFilter()
        for (let c of this.configs) {
            if (c.config.defaultFilter) {
                defaultFilter = c.config.defaultFilter()
            }
        }
        return defaultFilter
    }

    nodeAttrs(node: Node): NodeAttrs {
        var attrs = this.default.nodeAttrs(node)
        for (let c of this.configs) {
            if (c.config.nodeAttrs) {
                attrs = c.config.nodeAttrs(attrs, node)
            }
        }
        return attrs
    }

    nodeSortFnc(a: Node, b: Node): number {
        var fnc = this.default.nodeSortFnc
        for (let c of this.configs) {
            if (c.config.nodeSortFnc) {
                fnc = c.config.nodeSortFnc
            }
        }
        return fnc(a, b)
    }

    nodeClicked(node: Node): void {
        var fnc = this.default.nodeClicked
        for (let c of this.configs) {
            if (c.config.nodeClicked) {
                fnc = c.config.nodeClicked
            }
        }
        return fnc(node)
    }

    nodeDblClicked(node: Node): void {
        var fnc = this.default.nodeDblClicked
        for (let c of this.configs) {
            if (c.config.nodeDblClicked) {
                fnc = c.config.nodeDblClicked
            }
        }
        return fnc(node)
    }

    nodeMenu(node: Node): Array<MenuItem> {
        var items = this.default.nodeMenu(node)
        for (let c of this.configs) {
            if (c.config.nodeMenu) {
                items = c.config.nodeMenu(items, node)
            }
        }
        return items
    }

    nodeTags(data: any): Array<string> {
        var tags = this.default.nodeTags(data)
        for (let c of this.configs) {
            if (c.config.nodeTags) {
                tags = c.config.nodeTags([], data)
            }
        }
        return tags
    }

    defaultNodeTag(): string {
        var defaultNodeTag = this.default.defaultNodeTag()
        for (let c of this.configs) {
            if (c.config.defaultNodeTag) {
                defaultNodeTag = c.config.defaultNodeTag()
            }
        }
        return defaultNodeTag
    }

    nodeTabTitle(node: Node): string {
        var nodeTabTitle = this.default.nodeTabTitle(node)
        for (let c of this.configs) {
            if (c.config.nodeTabTitle) {
                nodeTabTitle = c.config.nodeTabTitle(node)
            }
        }
        return nodeTabTitle
    }

    groupSize(): number {
        var size = this.default.groupSize()
        for (let c of this.configs) {
            if (c.config.groupSize) {
                size = c.config.groupSize()
            }
        }
        return size
    }

    groupType(node: Node): string | undefined {
        var groupType = this.default.groupType(node)
        for (let c of this.configs) {
            if (c.config.groupType) {
                groupType = c.config.groupType(node)
            }
        }
        return groupType
    }

    groupName(node: Node): string | undefined {
        var groupName = this.default.groupName(node)
        for (let c of this.configs) {
            if (c.config.groupName) {
                groupName = c.config.groupName(node)
            }
        }
        return groupName
    }

    weightTitles(): Map<number, string> {
        var titles = this.default.weightTitles()
        for (let c of this.configs) {
            if (c.config.weightTitles) {
                titles = c.config.weightTitles()
            }
        }
        return titles
    }

    suggestions(): Array<string> {
        var result = this.default.suggestions()
        for (let c of this.configs) {
            if (c.config.suggestions) {
                result = c.config.suggestions()
            }
        }
        return result
    }

    nodeDataFields(): Array<NodeDataField> {
        var fields = this.default.nodeDataFields()
        for (let c of this.configs) {
            if (c.config.nodeDataFields) {
                fields = c.config.nodeDataFields(fields)
            }
        }
        return fields
    }

    linkAttrs(link: Link): LinkAttrs {
        var attrs = this.default.linkAttrs(link)
        for (let c of this.configs) {
            if (c.config.linkAttrs) {
                attrs = c.config.linkAttrs(attrs, link)
            }
        }
        return attrs
    }

    linkTabTitle(link: Link): string {
        var title = this.default.linkTabTitle(link)
        for (let c of this.configs) {
            if (c.config.linkTabTitle) {
                title = c.config.linkTabTitle(link)
            }
        }
        return title
    }

    isHierarchyLink(data: any): boolean {
        if (this.default.isHierarchyLink(data)) {
            return true
        }
        for (let c of this.configs) {
            if (c.config.isHierarchyLink) {
                if (c.config.isHierarchyLink(data)) {
                    return true
                }
            }
        }
        return false
    }

    linkDataFields(): Array<LinkDataField> {
        var fields = this.default.linkDataFields()
        for (let c of this.configs) {
            if (c.config.linkDataFields) {
                fields = c.config.linkDataFields(fields)
            }
        }
        return fields
    }

    defaultLinkTagMode(): number {
        var size = this.default.defaultLinkTagMode()
        for (let c of this.configs) {
            if (c.config.defaultLinkTagMode) {
                size = c.config.defaultLinkTagMode()
            }
        }
        return size
    }
}

class DefaultConfig {
    subTitle(): string {
        return ""
    }

    filters(): Promise<Array<Filter>> {
        var promise = new Promise<Array<Filter>>(resolve => {

            const nf = (name: string, type: string, tag: string, limit: number) => {
                return {
                    id: name,
                    label: name,
                    category: type,
                    tag: tag,
                    callback: () => {
                        var gremlin = "G.V().Has(" +
                            "'Name','" + name + "'," +
                            "'Type','" + type + "').descendants(10).as('k8s').Out().In().Has('Type', 'netns').Descendants(10).as('infra').select('k8s', 'infra').SubGraph()"
                        window.App.setGremlinFilter(gremlin)
                    }
                }
            }

            var filters = new Array<Filter>()

            // TODO replace by only one query once merged:
            // https://github.com/skydive-project/skydive/pull/2338
            var api = new window.API.TopologyApi(window.App.apiConf)
            api.searchTopology({ GremlinQuery: `G.V().Has("Type", "host").Values("Name")` }).then(result => {
                for (let name of result) {
                    filters.push(nf(name, "host", "infrastucture", 1))
                }

                api.searchTopology({ GremlinQuery: `G.V().Has("Type", "namespace").Values("Name")` }).then(result => {
                    if (result) {
                        for (let name of result) {
                            filters.push(nf(name, "namespace", "kubernetes", 10))
                        }
                        resolve(filters)
                    }
                })
            })
        })

        return promise
    }

    defaultFilter(): Filter {
        return {
            id: "default",
            label: "Default",
            category: "default",
            tag: "infrastructure",
            callback: () => {
                var gremlin = ""
                window.App.setGremlinFilter(gremlin)
            }
        }
    }
    private newAttrs(node: Node): NodeAttrs {
        var name = node.data.Name
        var ifName = node.data.IfName

        if (name.length > 24) {
            name = node.data.Name.substring(0, 24) + "."
        }

        // You can edid it. To change name of node
        if (ifName != "" && ifName !== undefined && node.data.Type == "tuntap") {
            name = ifName + " / " + name
        }

        var attrs = {
            classes: [node.data.Type],
            name: name,
            icon: "\uf192",
            href: '',
            iconClass: '',
            weight: 0,
            badges: []
        }

        return attrs
    }

    nodeAttrs(node: Node): NodeAttrs {
        switch (node.data.Manager) {
            case "k8s":
                return this.nodeAttrsK8s(node)
            default:
                return this.nodeAttrsInfra(node)
        }
    }

    private nodeAttrsK8s(node: Node): NodeAttrs {
        var attrs = this.newAttrs(node)

        switch (node.data.Type) {
            case "cluster":
                attrs.href = "assets/icons/cluster.png"
                attrs.weight = WEIGHT_K8S_CLUSTER
                break
            /*
            case "configmap":
                attrs.href = "assets/icons/configmap.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "cronjob":
                attrs.href = "assets/icons/cronjob.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "daemonset":
                attrs.href = "assets/icons/daemonset.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "deployment":
                attrs.href = "assets/icons/deployment.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "endpoints":
                attrs.href = "assets/icons/endpoints.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "ingress":
                attrs.href = "assets/icons/ingress.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "job":
                attrs.href = "assets/icons/job.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "persistentvolume":
                attrs.href = "assets/icons/persistentvolume.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "persistentvolumeclaim":
                attrs.href = "assets/icons/persistentvolumeclaim.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "networkpolicy":
                attrs.href = "assets/icons/networkpolicy.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "replicaset":
                attrs.href = "assets/icons/replicaset.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "replicationcontroller":
                attrs.href = "assets/icons/replicationcontroller.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "secret":
                attrs.href = "assets/icons/secret.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "statefulset":
                attrs.href = "assets/icons/statefulset.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "storageclass":
                attrs.href = "assets/icons/storageclass.png"
                attrs.weight = WEIGHT_K8S_NODE
                break
            */
            case "node":
                attrs.icon = "\uf109"
                attrs.weight = WEIGHT_K8S_NODE
                break
            case "namespace":
                attrs.icon = "\uf24d"
                attrs.weight = WEIGHT_K8S_NAMESPACE
                break
            case "pod":
                attrs.href = "assets/icons/pod.png"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "container":
                attrs.href = "assets/icons/container.png"
                attrs.weight = WEIGHT_K8S_CONTAINER
                break
            case "service":
                attrs.href = "assets/icons/service.png"
                attrs.weight = WEIGHT_K8S_SERVICE
                break
            default:
                attrs.href = "assets/icons/k8s.png"
                attrs.weight = WEIGHT_K8S_OTHER
        }

        if (SHOW_DEBUG) {
            attrs.name = attrs.weight.toString() + "|" + attrs.name
        }
        return attrs
    }

    private nodeAttrsInfra(node: Node): NodeAttrs {
        var attrs = this.newAttrs(node)
        switch (node.data.Type) {
            case "host":
                attrs.icon = "\uf109"
                attrs.weight = WEIGHT_PHY_HOST
                break
            case "switch":
                attrs.icon = "\uf6ff"
                attrs.weight = WEIGHT_SWITCH
                break
            case "bridge":
                attrs.icon = "\uf6ff"
                attrs.weight = WEIGHT_BRIDGES
                break
            case "patch":
            case "port":
            case "switchport":
                attrs.icon = "\uf0e8"
                attrs.weight = WEIGHT_SWITCH_PORTS
                break
            case "erspan":
                attrs.icon = "\uf1e0"
                attrs.weight = WEIGHT_PHY_PORTS
                break
            case "device":
                attrs.icon = "\uf796"
                attrs.weight = WEIGHT_PHY_NIC
                break
            case "bond":
                attrs.icon = "\uf0c1"
                attrs.weight = WEIGHT_PHY_BOND
                break
            case "internal":
            case "interface":
            case "tun":
            case "tap":
                attrs.icon = "\uf796"
                attrs.weight = WEIGHT_PHY_NET
                break
            case "geneve":
            case "vxlan":
            case "gre":
            case "gretap":
                attrs.icon = "\uf55b"
                attrs.weight = WEIGHT_VIRT_NET
                break
            case "veth":
                attrs.icon = "\uf4d7"
                attrs.weight = WEIGHT_VIRT_NET
                break
            case "ovsport":
                attrs.icon = "\uf0e8"
                attrs.weight = WEIGHT_VIRT_PORTS
                break
            case "ovsbridge":
            case "openvswitch":
                attrs.icon = "\uf6ff"
                attrs.weight = WEIGHT_VIRT_BRIDGES
                break
            case "netns":
                attrs.icon = "\uf24d"
                attrs.weight = WEIGHT_VIRT_NAMESPACE
                break
            case "libvirt":
                attrs.icon = "\uf109"
                attrs.weight = WEIGHT_VIRT_VMS
                break
            case "container":
                attrs.icon = "\uf49e"
                attrs.weight = WEIGHT_VIRT_CONTAINERS
                break
            case "vlan":
                attrs.icon = "\uf6ff"
                attrs.weight = WEIGHT_VLAN
                break
            default:
                attrs.icon = "\uf796"
                attrs.weight = WEIGHT_NONE
        }

        if (node.data.IPV4 && node.data.IPV4.length && node.data.Type === "bridge") {
            attrs.weight = WEIGHT_BRIDGES
        }

        if (!node.data.IPV4 && node.data.Type === "bridge") {
            attrs.weight = WEIGHT_VIRT_BRIDGES
        }

        if (node.data.Probe === "fabric") {
            attrs.weight = WEIGHT_PHY_FABRIC
        }

        if (node.data.OfPort) {
            attrs.weight = WEIGHT_VIRT_PORTS
        }

        if (node.data.Name === "lo") {
            attrs.weight = WEIGHT_PHY_NIC
        }

        if (typeof node.data.Driver === "string" && node.data.Driver.toLowerCase() === "bonding") {
            attrs.weight = WEIGHT_PHY_BOND
        }

        var regexpVirtRouter: RegExp = /^r-/
        var regexpSystemVm: RegExp = /(^s-)|(^v-)/
        if (regexpVirtRouter.test(node.data.Name)) {
            attrs.weight = WEIGHT_VIRT_ROUTERS
        }else if (regexpSystemVm.test(node.data.Name) || node.data.Name === "ccvm" || node.data.Name === "scvm" && node.data.Type === "libvirt") {
            attrs.weight = WEIGHT_SYSTEM_VMS
        }

        var virt = ["tap", "veth", "tun", "openvswitch"]
        if (
            node.data.Driver &&
            virt.indexOf(node.data.Driver) >= 0 &&
            node.data.Type !== "ovsbridge" &&
            node.data.Type !== "openvswitch" &&
            node.data.Type !== "ovsport"
        ) {
            attrs.weight = WEIGHT_VIRT_NET
        }

        if (node.data.Manager === "docker") {
            attrs.badges = [{ text: "\uf395", iconClass: 'font-brands', fill: '#3888ae', stroke: '#fff' }]
        } else if (node.data.Manager === "runc") {
            attrs.badges = [{ text: "\uf7bc", iconClass: 'font-brands', fill: '#000', stroke: '#f44336' }]
        }

        if (node.data.Captures) {
            attrs.badges = [{ text: "\uf03d" }]
        }

        // Keep node icons aligned 1:1 with left infrastructure layer icons.
        switch (attrs.weight) {
            case WEIGHT_SWITCH:
                attrs.icon = "\uf6ff"
                break
            case WEIGHT_SWITCH_PORTS:
                attrs.icon = "\uf796"
                break
            case WEIGHT_PHY_HOST:
                attrs.icon = "\uf233"
                break
            case WEIGHT_PHY_NIC:
                attrs.icon = "\uf538"
                break
            case WEIGHT_PHY_BOND:
                attrs.icon = "\uf0c1"
                break
            case WEIGHT_BRIDGES:
                attrs.icon = "\uf542"
                break
            case WEIGHT_VLAN:
                attrs.icon = "\uf0e8"
                break
            case WEIGHT_VIRT_BRIDGES:
                attrs.icon = "\uf247"
                break
            case WEIGHT_SYSTEM_VMS:
                attrs.icon = "\uf085"
                break
            case WEIGHT_VIRT_ROUTERS:
                attrs.icon = "\uf4d7"
                break
            case WEIGHT_VIRT_VMS:
                attrs.icon = "\uf108"
                break
            case WEIGHT_VIRT_PORTS:
                attrs.icon = "\uf796"
                break
        }

        if (SHOW_DEBUG) {
            attrs.name = attrs.weight.toString() + "|" + attrs.name
        }
        return attrs
    }

    nodeSortFnc(a: Node, b: Node): number {
        return a.data.Name.localeCompare(b.data.Name)
    }

    nodeClicked(node: Node): void {
        window.App.tc.selectNode(node.id)
    }

    nodeDblClicked(node: Node): void {
        window.App.tc.expand(node)
    }

    nodeMenu(node: Node): Array<MenuItem> {
        var captures = node.data.Captures?.length
        const alreadyCaptured = captures > 0;

        // 캡처 비허용 타입 정의
        const disallowedCaptureTypes = ["switch", "switchport", "host", "libvirt", "tuntap", "system", "ovsbridge"];
        const isDisallowed = disallowedCaptureTypes.includes(node.data.Type);

        return [
            {
                class: "",
                text: translate("capture"),
                disabled: alreadyCaptured || isDisallowed,
                callback: () => {
                    if (isDisallowed) return;
                    const api = new window.API.CapturesApi(window.App.apiConf);
                    api.createCapture({ GremlinQuery: `G.V('${node.id}')` }).then(result => {
                        console.log(result);
                    });
                }
            },
            {
                class: "",
                text: translate("delete-captures"),
                disabled: !captures,
                callback: () => {
                    const api = new window.API.CapturesApi(window.App.apiConf);

                    const captureIDs = [...node.data.Captures.map(c => c.ID)];
                    const isOvsPort = node.data.Type === "ovsport";

                    Promise.all(
                        captureIDs.map(captureID => {
                            return api.deleteCapture(captureID).then(result => {
                                console.log("Deleted:", captureID);
                                return captureID;
                            });
                        })
                    ).then(deletedIDs => {
                        node.data = {
                            ...node.data,
                            Captures: node.data.Captures.filter(c => !deletedIDs.includes(c.ID))
                        };

                        if ((node as any).metadata) {
                            delete (node as any).metadata.Captures;
                            delete (node as any).metadata.CaptureState;
                            (node as any).metadata = { ...(node as any).metadata };
                        }

                        // OVS 포트 노드면 전체 리프레시
                        if (isOvsPort) {
                            window.refreshTopology?.();
                        }
                    });
                }
            },

            //{ class: "", text: "Capture all", disabled: true, callback: () => { console.log("Capture all") } },
            //{ class: "", text: "Injection", disabled: false, callback: () => { console.log("Injection") } },
            //{ class: "", text: "Flows", disabled: false, callback: () => { console.log("Flows") } },
            //{ class: "", text: "Filter NS(demo)", disabled: false, callback: () => { window.App.loadExtraConfig("/assets/nsconfig.js") } }
        ]
    }

    nodeTags(data: any): Array<string> {
        if (data.Manager && data.Manager === "k8s") {
            return ["kubernetes"]
        } else {
            return [translate("infrastructure")]
        }
    }

    defaultNodeTag() {
        return translate("infrastructure")
    }

    private normalizeNodeIP(value: any): string {
        if (typeof value !== "string") {
            return ""
        }
        return value.trim().split("/")[0]
    }

    private pickNodeText(obj: any, keys: string[]): string {
        for (const key of keys) {
            const value = obj?.[key]
            if (value !== undefined && value !== null) {
                const text = String(value).trim()
                if (text) {
                    return text
                }
            }
        }
        return ""
    }

    private normalizeNodeMac(value: any): string {
        if (typeof value !== "string") {
            return ""
        }
        return value.toLowerCase().replace(/[^0-9a-f]/g, "")
    }

    private collectNodeIfTokens(value: any): string[] {
        if (typeof value !== "string") {
            return []
        }
        return value.trim().toLowerCase().split(/[\/,\s]+/).map((v) => v.trim()).filter(Boolean)
    }

    private vmChildNetworkTabTitle(node: Node): string | undefined {
        const nodeData = node.data || {}
        const nodeType = typeof nodeData.Type === "string" ? nodeData.Type.toLowerCase() : ""
        const nodeDriver = typeof nodeData.Driver === "string" ? nodeData.Driver.toLowerCase() : ""
        if (nodeType !== "tuntap" && nodeType !== "tun" && nodeDriver !== "tun" && nodeDriver !== "tuntap") {
            return undefined
        }

        let parent = node.parent
        while (parent && parent.data?.Type !== "libvirt") {
            parent = parent.parent
        }

        const appState = (window as any).App?.state || {}
        const vmNameMap = appState.vmNameMap || {}
        const vmNetworkMap = appState.vmNetworkMap || {}
        const libvirtName = parent?.data?.Name
        const vmKeys = [
            libvirtName,
            typeof libvirtName === "string" ? vmNameMap[libvirtName] : undefined,
            parent?.data?.UUID,
            parent?.data?.ID,
            parent?.data?.ExtID,
            parent?.data?.VirtualMachineID,
            parent?.data?.instanceName
        ]
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter((v, idx, arr) => !!v && arr.indexOf(v) === idx)

        let nicList: Array<any> = []
        for (const key of vmKeys) {
            const found = vmNetworkMap[key]
            if (Array.isArray(found) && found.length > 0) {
                nicList = found
                break
            }
        }

        const nodeMacCandidates = [
            nodeData.MAC,
            nodeData.PeerIntfMAC,
            nodeData?.Libvirt?.MAC,
            nodeData?.Libvirt?.Mac,
        ].map((v) => this.normalizeNodeMac(v)).filter((v, idx, arr) => !!v && arr.indexOf(v) === idx)
        const nodeIPs = [
            ...(Array.isArray(nodeData.IPV4) ? nodeData.IPV4 : [nodeData.IPV4]),
            ...(Array.isArray(nodeData.IPV6) ? nodeData.IPV6 : [nodeData.IPV6]),
            ...(Array.isArray(nodeData.IfAddr) ? nodeData.IfAddr : [nodeData.IfAddr]),
            ...(Array.isArray(nodeData.Addresses) ? nodeData.Addresses : [nodeData.Addresses]),
        ].map((v) => this.normalizeNodeIP(typeof v === "string" ? v : String(v || ""))).filter((v) => !!v)
        const nodeIPSet = new Set(nodeIPs)
        const nodeIfTokenSet = new Set([
            ...this.collectNodeIfTokens(nodeData.Name),
            ...this.collectNodeIfTokens(nodeData.IfName),
            ...this.collectNodeIfTokens(nodeData.PeerIfName),
            ...this.collectNodeIfTokens(nodeData.Interface),
        ])

        const matchedNic = nicList.find((nic: any) => {
            const nicIP = this.normalizeNodeIP(this.pickNodeText(nic, ["ipAddress", "ip", "ip_address", "fixedIp", "fixed_ip"]))
            if (nicIP && nodeIPSet.has(nicIP)) {
                return true
            }
            const nicMac = this.normalizeNodeMac(this.pickNodeText(nic, ["macAddress", "mac", "mac_address", "macAddr"]))
            if (nicMac && nodeMacCandidates.some((m) => m === nicMac)) {
                return true
            }
            const nicTokens = [
                nic.interfaceName,
                nic.ifName,
                nic.tapName,
                nic.tap_name,
                nic.deviceName,
                nic.device_name,
                nic.device,
                nic.name,
                nic.iface,
                nic.interface
            ].reduce((acc: string[], raw: any) => {
                acc.push(...this.collectNodeIfTokens(raw))
                return acc
            }, [] as string[])
            return nicTokens.some((token) => nodeIfTokenSet.has(token))
        })

        const fallbackNic = matchedNic || (nicList.length === 1 ? nicList[0] : undefined)
        const mappedIP = this.pickNodeText(fallbackNic, ["ipAddress", "ip", "ip_address", "fixedIp", "fixed_ip"])
        const mappedNetwork = this.pickNodeText(fallbackNic, ["networkName", "network", "network_name", "name"])
        const nodeIP = this.normalizeNodeIP(
            Array.isArray(nodeData.IPV4) ? String(nodeData.IPV4[0] || "") :
                Array.isArray(nodeData.IfAddr) ? String(nodeData.IfAddr[0] || "") :
                    String(nodeData.IPV4 || nodeData.IfAddr || "")
        )
        const nodeNetwork = this.pickNodeText(nodeData, ["Network"])
        const displayIP = mappedIP || nodeIP
        const displayNetwork = mappedNetwork || nodeNetwork

        if (displayIP && displayNetwork) {
            return `${displayIP}\n${displayNetwork}`
        }
        if (displayIP) {
            return displayIP
        }
        if (displayNetwork) {
            return displayNetwork
        }
        return undefined
    }

    nodeTabTitle(node: Node): string {
        const name = node?.data?.Name
        if (!name || typeof name !== "string") {
            return ""
        }
        if (node.data?.Type === "libvirt") {
            return (window as any).App?.state?.vmNameMap?.[name] || name
        }
        const vmChildNetworkTitle = this.vmChildNetworkTabTitle(node)
        if (vmChildNetworkTitle) {
            return vmChildNetworkTitle
        }
        return name
    }

    groupSize(): number {
        return 3
    }

    groupType(node: Node): string | undefined {
        var nodeType = node.data.Type
        if (!nodeType) {
            return
        }

        switch (nodeType) {
            case "configmap":
            case "cronjob":
            case "daemonset":
            case "deployment":
            case "endpoints":
            case "ingress":
            case "job":
            case "persistentvolume":
            case "persistentvolumeclaim":
            case "pod":
            case "networkpolicy":
            case "replicaset":
            case "replicationcontroller":
            case "secret":
            case "service":
            case "statefulset":
                return "app"
            default:
                return nodeType
        }
    }

    groupName(node: Node): string | undefined {
        if (node.data.K8s) {
            var labels = node.data.K8s.Labels
            if (!labels) {
                return name + "(s)"
            }

            var app = labels["k8s-app"] || labels["app"]
            if (!app) {
                return "default"
            }
            return app
        }

        var nodeType = this.groupType(node)
        if (!nodeType) {
            return
        }

        var regexpVirtRouter: RegExp = /^r-/
        var regexpSystemVm: RegExp = /^[s-]^[v-]/
        var regexpVirtBridge: RegExp = /^brenp/

        if (regexpVirtRouter.test(node.data.Name)) {
            nodeType = "virt-router"
        }else if (regexpSystemVm.test(node.data.Name) || node.data.Name === "ccvm" || node.data.Name === "scvm") {
            nodeType = "system-vm"
        }

        if (regexpVirtBridge.test(node.data.Name) && node.data.Type === "bridge") {
            nodeType = "virt-bridge"
        }else if (node.data.Type === "bridge"){
            nodeType = "host-bridge"
        }

        const groupKey = nodeType + "(s)"
        if (groupKey === "device(s)") {
            return translate(node.getWeight() === WEIGHT_PHY_NIC ? "device(s)-nic" : "device(s)-network")
        }
        return translate(groupKey)
    }

    weightTitles(): Map<number, string> {
        var wt = new Map<number, string>()


        wt.set(WEIGHT_K8S_FEDERATION, translate("k8s-Federations"))
        wt.set(WEIGHT_K8S_CLUSTER, translate("k8s-clusters"))
        wt.set(WEIGHT_K8S_NODE, translate("k8s-nodes"))
        wt.set(WEIGHT_K8S_NAMESPACE, translate("k8s-namespaces"))
        wt.set(WEIGHT_K8S_POD, translate("k8s-pods"))
        wt.set(WEIGHT_K8S_CONTAINER, translate("k8s-containers"))
        wt.set(WEIGHT_K8S_SERVICE, translate("k8s-services"))
        wt.set(WEIGHT_K8S_OTHER, translate("k8s-more"))

        wt.set(WEIGHT_VLAN, translate("vlans"))
        wt.set(WEIGHT_SYSTEM_VMS, translate("system-VMs"))
        wt.set(WEIGHT_VIRT_ROUTERS, translate("virt-Routers"))
        wt.set(WEIGHT_VIRT_VMS, translate("virt-VMs"))
        wt.set(WEIGHT_VIRT_CONTAINERS, translate("virt-containers"))
        wt.set(WEIGHT_VIRT_BRIDGES, translate("virt-bridges"))
        wt.set(WEIGHT_VIRT_NAMESPACE, translate("virt-namespaces"))
        wt.set(WEIGHT_VIRT_NET, translate("virt-net"))
        wt.set(WEIGHT_VIRT_PORTS, translate("virt-ports"))

        wt.set(WEIGHT_PHY_FABRIC, translate("phy-fabric"))
        wt.set(WEIGHT_SWITCH, translate("phy-switch"))
        wt.set(WEIGHT_SWITCH_PORTS, translate("phy-switch-ports"))
        wt.set(WEIGHT_PHY_HOST, translate("phy-hosts"))
        wt.set(WEIGHT_PHY_NIC, translate("phy-nics"))
        wt.set(WEIGHT_PHY_BOND, translate("phy-bond"))
        wt.set(WEIGHT_BRIDGES, translate("host-bridges"))
        wt.set(WEIGHT_PHY_NET, translate("phy-net"))
        wt.set(WEIGHT_PHY_PORTS, translate("phy-ports"))

        wt.set(WEIGHT_NONE, translate("Not classified"))

        if (SHOW_DEBUG) {
            for (let [key, value] of wt) {
                wt.set(key, key.toString() + "|" + value)
            }
        }

        return wt
    }

    suggestions(): Array<string> {
        return [
            "data.IPV4",
            "data.MAC",
            "data.Name"
        ]
    }

    nodeDataFields(): Array<NodeDataField> {
        return [
            {
                field: "",
                title: translate("general"),
                expanded: true,
                icon: "\uf05a",
                helpTooltipText: translate("Displays general information about hosts and devices."),
                sortKeys: (data: any): Array<string> => {
                    return ['Name', 'Type', 'MAC', 'Driver', 'State']
                },
                filterKeys: (data: any): Array<string> => {
                    switch (data.Type) {
                        case "host":
                            return []
                        case "switch":
                            return ['Name','Type', 'LLDP','Probe']
                        case "switchport":
                            return ['Name','Type', 'LLDP','RemoteSysName']
                        default:
                            return []
                    }
                },
            },
            {
                field: "Sockets",
                title: translate("sockets"),
                expanded: false,
                icon: "\uf1e6",
                helpTooltipText: translate("Displays socket connection information.")
            },
            {
                field: "Captures",
                title: translate("captures"),
                expanded: false,
                icon: "\uf51f",
                helpTooltipText: translate("Lists active packet captures. Deletion is also available."),
                customRenders: new Map<string, (value: any) => any>([
                    [
                        'ID', (value: any): any => {
                            return value.split('-')[0]
                        }
                    ]
                ]),
                deletable: true,
                onDelete: (data: Array<Map<string, any>>) => {
                    data.forEach(values => {
                        var api = new window.API.CapturesApi(window.App.apiConf)
                        api.deleteCapture(values['ID']).then(result => {
                            console.log( result)
                        })
                    })
                }
            },
            {
                field: "Injections",
                title: translate("injections"),
                expanded: false,
                icon: "\uf48e",
                helpTooltipText: translate("Displays the list of packet injections.")
            },
            {
                field: "Docker",
                expanded: false,
                icon: "\uf395",
                iconClass: "font-brands"
            },
            {
                field: "Runc",
                title: translate("runc"),
                expanded: false,
                icon: "\uf7bc",
                helpTooltipText: translate("Displays information about Runc container runtime."),
                iconClass: "font-brands"
            },
            {
                field: "IPV4",
                title: translate("ipv4"),
                expanded: true,
                icon: "\uf1fa"
            },
            {
                field: "IPV6",
                title: translate("ipv6"),
                expanded: true,
                icon: "\uf1fa"
            },
            {
                field: "LastUpdateMetric",
                title: translate("lastUpdateMetric"),
                expanded: false,
                icon: "\uf201",
                helpTooltipText: translate("Displays the latest update metrics for this flow or node."),
                normalizer: (data: any): any => {
                    return {
                        [translate("RxPackets")]: data.RxPackets ? data.RxPackets.toLocaleString() : 0,
                        [translate("RxBytes")]: data.RxBytes ? Tools.prettyBytes(data.RxBytes) : 0,
                        [translate("TxPackets")]: data.TxPackets ? data.TxPackets.toLocaleString() : 0,
                        [translate("TxBytes")]: data.TxBytes ? Tools.prettyBytes(data.TxBytes) : 0,
                        [translate("Start")]: data.Start ? new Date(data.Start).toLocaleString() : 0,
                        [translate("Last")]: data.Last ? new Date(data.Last).toLocaleString() : 0
                    }
                },
                graph: (data: any): any => {
                    return {
                        type: "LineChart",
                        data: [
                            [
                                { type: "datetime", label: "time" },
                                translate("RxBytes"),
                                translate("TxBytes")
                            ],
                            [new Date(data.Last || 0), data.RxBytes || 0, data.TxBytes || 0]
                        ]
                    }
                }
            },
            {
                field: "Metric",
                title: translate("metric"),
                expanded: false,
                icon: "\uf201",
                helpTooltipText: translate("Displays overall metrics such as byte and packet counters."),
                normalizer: (data: any): any => {
                    return {
                        [translate("RxPackets")]: data.RxPackets ? data.RxPackets.toLocaleString() : 0,
                        [translate("RxBytes")]: data.RxBytes ? Tools.prettyBytes(data.RxBytes) : 0,
                        [translate("TxPackets")]: data.TxPackets ? data.TxPackets.toLocaleString() : 0,
                        [translate("TxBytes")]: data.TxBytes ? Tools.prettyBytes(data.TxBytes) : 0,
                        [translate("Last")]: data.Last ? new Date(data.Last).toLocaleString() : 0
                    }
                }
            },
            {
                field: "Features",
                title: translate("features"),
                expanded: false,
                icon: "\uf022",
                helpTooltipText: translate("device_functions_help")
            },
            {
                field: "FDB",
                title: translate("fdb"),
                expanded: false,
                icon: "\uf0ce",
                helpTooltipText: translate("fdb_help")
            },
            {
                field: "Neighbors",
                title: translate("neighbors"),
                expanded: false,
                icon: "\uf0ce",
                helpTooltipText: translate("neighbors_help")
            },
            {
                field: "RoutingTables",
                title: translate("routingTables"),
                expanded: false,
                icon: "\uf0ce",
                helpTooltipText: translate("routing_tables_help"),
                normalizer: (data: any): any => {
                    var rows = new Array<any>()
                    for (let table of data) {
                        if (!table.Routes) {
                            continue
                        }
                        for (let route of table.Routes) {
                            if (!route.NextHops) {
                                continue
                            }
                            for (let nh of route.NextHops) {
                                rows.push({
                                    ID: table.ID,
                                    Src: table.Src,
                                    Protocol: route["Protocol"],
                                    Prefix: route["Prefix"],
                                    Priority: nh["Priority"],
                                    IP: nh["IP"],
                                    IfIndex: nh["IfIndex"]
                                })
                            }
                        }
                    }

                    return rows
                }
            }
        ]
    }

    linkAttrs(link: Link): LinkAttrs {
        const trafficNodeMetric = (node: Node) => {
            const data = node.data || {}
            const type = typeof data.Type === "string" ? data.Type.toLowerCase() : ""
            const driver = typeof data.Driver === "string" ? data.Driver.toLowerCase() : ""
            const bus = typeof data.BusInfo === "string" ? data.BusInfo.toLowerCase() : ""
            const ovs = data.Ovs || {}

            if (
                type === "tuntap" ||
                type === "tun" ||
                type === "device" ||
                type === "switchport" ||
                driver === "tun" ||
                bus === "tap"
            ) {
                return {
                    metric: data.LastUpdateMetric || ovs.LastUpdateMetric
                }
            }

            return { metric: undefined }
        }

        const sourceMetric = trafficNodeMetric(link.source)
        const targetMetric = trafficNodeMetric(link.target)
        var metric = sourceMetric.metric || targetMetric.metric || link.source.data.LastUpdateMetric
        var bandwidth = 0
        if (metric && metric.Last > metric.Start) {
            bandwidth = (metric.RxBytes + metric.TxBytes) * 8
            bandwidth /= (metric.Last - metric.Start) / 1000
        }
        const hasVisibleBandwidth = Number.isFinite(bandwidth) && bandwidth >= 1

        var attrs = {
            classes: [link.data.RelationType],
            icon: "\uf362",
            directed: false,
            href: '',
            iconClass: '',
            label: hasVisibleBandwidth ? Tools.prettyBandwidth(bandwidth) : ""
        }

        if (hasVisibleBandwidth) {
            attrs.classes.push('traffic')
        }

        if (link.data.RelationType === "layer2" || link.data.RelationType === "vlayer2") {
            attrs.classes.push("traffic")
        }

        if (link.data.Directed) {
            attrs.directed = true
        }

        return attrs
    }

    linkTabTitle(link: Link): string {
        var src = link.source.data.Name
        var dst = link.target.data.Name
        if (src && dst) {
            return src.substring(0, 8) + " / " + dst.substring(0, 8)
        }
        return link.id.split("-")[0]
    }

    isHierarchyLink(data: any): boolean {
        return data?.RelationType === "ownership" || data?.RelationType === "vownership"
    }

    linkDataFields(): Array<LinkDataField> {
        return [
            {
                field: "",
                title: "General",
                expanded: true,
                icon: "\uf05a",
            },
            {
                field: "NSM",
                title: "Network Service Mesh",
                expanded: true,
                icon: "\uf542",
            },
            {
                field: "NSM.Source",
                title: "Source",
                expanded: false,
                icon: "\uf018",
            },
            {
                field: "NSM.Via",
                title: "Via",
                expanded: false,
                icon: "\uf018",
            },
            {
                field: "NSM.Destination",
                title: "Destination",
                expanded: false,
                icon: "\uf018",
            }
        ]
    }

    defaultLinkTagMode(): number {
        return LinkTagState.EventBased
    }
}
