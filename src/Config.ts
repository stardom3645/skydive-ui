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
import { switchDisplayName } from './SwitchNodeUtils'
import { isKubernetesTopologyData } from './KubernetesInfrastructureEvidence'
import { kubernetesWorkloadNodeText } from './KubernetesTopologyNodePresentation'

const SHOW_DEBUG = false

const WEIGHT_K8S_FEDERATION = 3000
const WEIGHT_K8S_CLUSTER = 3010
const WEIGHT_K8S_NODE = 3020
const WEIGHT_K8S_NAMESPACE = 3030
const WEIGHT_K8S_WORKLOAD = 3035
const WEIGHT_K8S_POD = 3040
const WEIGHT_K8S_CONTAINER = 3050
const WEIGHT_K8S_SERVICE = 3060
const WEIGHT_K8S_STORAGE = 3070
const WEIGHT_K8S_OTHER = 3200

const WEIGHT_PHY_FABRIC = 5010
const WEIGHT_SWITCH = 5015
const WEIGHT_SWITCH_PORTS = 5018
const WEIGHT_PHY_HOST = 5020
const WEIGHT_PHY_NIC = 5030
const WEIGHT_PHY_BOND = 5032
export const WEIGHT_BRIDGES = 5035
const WEIGHT_VLAN = 5040
const WEIGHT_PHY_NET = 5050
const WEIGHT_PHY_PORTS = 5060

const WEIGHT_VIRT_NAMESPACE = 7010
const WEIGHT_VIRT_CONTAINERS = 7030
export const WEIGHT_VIRT_BRIDGES = 7040
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
        "k8s-workloads": "Kubernetes Workload Controllers",
        "k8s-pods": "Kubernetes Pods",
        "k8s-storage": "Kubernetes Storage",
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
        "virt-router(s)": "Virtual Router Group",
        "system-vm(s)": "System VM Group",
        "virt-bridge(s)": "Virtual Bridge Group",
        "host-bridge(s)": "Host Bridge Group",
        "bridge(s)": "Bridge Group",
        "bond(s)": "Bond Interface Group",
        "vlan(s)": "VLAN Group",
        "groupSuffix": "Group",
        "k8s-cluster-group": "Kubernetes Cluster Group",
        "k8s-node-group": "Kubernetes Node Group",
        "k8s-namespace-group": "Kubernetes Namespace Group",
        "k8s-pod-group": "Kubernetes Pod Group",
        "k8s-service-group": "Kubernetes Service Group",
        "k8s-app-group": "Kubernetes Resource Group",

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
        "hostStatusCollected": "Collected",
        "hostStatusNormal": "Normal",
        "hostInfoUnavailable": "No information",
        "hostNoData": "No collected data.",
        "hostNoResourceMetrics": "No resource usage information collected.",
        "hostOperationsSummary": "Host operations summary",
        "hostOperationsDescription": "Key virtualization, network, and socket signals for this host.",
        "hostName": "Host name",
        "hostHypervisor": "Hypervisor",
        "hostSocketFootprint": "Socket footprint",
        "hostRepresentativeAddress": "Representative address",
        "hostNoRepresentativeIp": "No representative IP",
        "hostOperationalStatus": "Operational status",
        "hostOperationalStatusDescription": "Mold, Netdive collection, and agent state at a glance.",
        "hostManagementIp": "Management IP",
        "hostOverviewDescription": "Identity, virtualization, and Mold inventory signals.",
        "hostConnectedResources": "Connected resources",
        "hostConnectedResourcesDescription": "VM, router, and network resources associated with this host.",
        "hostInfrastructureResources": "Infrastructure resources",
        "hostNoConnectedResources": "No connected resource summary has been collected yet.",
        "hostRecentSignals": "Recent signals",
        "hostRecentSignalsDescription": "Recent update, event, capture, and state-change signals.",
        "hostNoRecentSignals": "No recent signals collected.",
        "hostTopologyPath": "Topology visibility path",
        "hostTopologyPathDescription": "Placement path used to understand where this host belongs.",
        "hostNoTopologyPath": "No placement path information collected.",
        "hostConnectedVMs": "Connected VMs",
        "hostConnectedVMsDescription": "User workload VMs",
        "hostSystemVMs": "System VMs",
        "hostSystemVMsDescription": "Infrastructure system VMs",
        "hostVirtualRouters": "Virtual routers",
        "hostVirtualRoutersDescription": "Network routing VMs",
        "hostNetworkCountDescription": "Network objects and interfaces",
        "hostMoldContext": "Mold context",
        "hostMoldContextDescription": "Placement and cloud metadata collected from Mold or host inventory.",
        "hostMoldMissing": "No Mold placement metadata has been collected for this host.",
        "hostZone": "Zone",
        "hostCluster": "Cluster",
        "hostPod": "Pod",
        "hostDomain": "Domain",
        "hostAccount": "Account",
        "hostMoldHostId": "Mold host ID",
        "hostResourceState": "Resource state",
        "hostAllocationState": "Allocation state",
        "hostManagementServer": "Management server",
        "hostTopPorts": "Major ports",
        "hostStatusSection": "Status",
        "hostStatusSectionDescription": "Agent and latest collection state.",
        "hostCollectionState": "Collection state",
        "hostAgent": "Agent",
        "hostLastUpdate": "Last update",
        "hostRecentEvent": "Recent event",
        "hostRecentCapture": "Recent capture",
        "hostRecentStateChange": "Recent state change",
        "hostMonitoringPeriod": "Monitoring period",
        "hostLocation": "Location",
        "hostBasicInfo": "Basic information",
        "switchBasicInfo": "Basic information",
        "switchName": "Name",
        "switchManagementIp": "Management IP",
        "switchType": "Type",
        "switchProbe": "Collection probe",
        "switchLldpInfo": "LLDP information",
        "switchChassisId": "Chassis ID",
        "switchChassisIdType": "Chassis ID type",
        "switchSystemDescription": "System description",
        "switchManagementAddress": "Management address",
        "switchNoLldp": "No LLDP information has been collected.",
        "switchPortConnectedNodes": "Connected nodes",
        "switchPortPortId": "Port ID",
        "switchPortPortIdType": "Port ID type",
        "switchPortDescription": "Port description",
        "switchPortRemoteSystem": "Remote system",
        "switchPortRemotePort": "Remote port",
        "switchPortRemoteDescription": "Remote port description",
        "bondMode": "Bond mode",
        "bondConfiguration": "Bond configuration",
        "bondSlaveInterface": "Slave interface",
        "bondSlaveInterfaces": "Slave interfaces",
        "bondNoData": "No information has been collected.",
        "nicConnectedNodes": "Connected nodes",
        "nicLinkStatus": "Link status",
        "nicDuplex": "Duplex",
        "nicAutoNegotiation": "Auto negotiation",
        "nicCarrier": "Carrier",
        "nicLldpNeighbor": "LLDP neighbor",
        "detailAdvancedInfo": "Advanced information",
        "nicNetlinkInfo": "Netlink information",
        "nicNoData": "No information has been collected.",
        "bridgeMemberInterfaces": "Member interfaces",
        "bridgeConfiguration": "Bridge configuration",
        "bridgeNetworkAddresses": "Network addresses",
        "bridgeInterfaceInfo": "Interface information",
        "bridgeUplink": "Uplink",
        "bridgeNoData": "No information has been collected.",
        "vlanConfiguration": "VLAN configuration",
        "vlanId": "VLAN ID",
        "vlanParentInterface": "Parent interface",
        "vlanConnectedInterfaces": "Connected interfaces",
        "vlanProtocol": "VLAN protocol",
        "vlanInterfaceInfo": "Interface information",
        "vlanNoData": "No information has been collected.",
        "managementServerInfo": "Mold management server",
        "managementServerResources": "Management server resources",
        "managementServerJvm": "JVM status",
        "managementCollectionTime": "Collection time",
        "managementUsageLocal": "Usage server installed locally",
        "managementDbLocal": "Database running locally",
        "managementLastStart": "Last management server start",
        "managementLastStop": "Last management server stop",
        "managementLastBoot": "Management server system boot time",
        "managementLogInfo": "Log file information",
        "managementSystemCpu": "Total CPU capacity across all cores (MHz)",
        "managementLoadAverages": "1, 5, 15 minute load averages",
        "managementCycleUsage": "User, system, and idle cycles",
        "managementSystemMemoryTotal": "Total system memory",
        "managementSystemMemoryFree": "Available system memory",
        "managementVirtualMemory": "Total virtual process size",
        "managementAvailableProcessors": "Available processor cores",
        "managementJavaDistribution": "Java Runtime distribution",
        "managementJavaVersion": "Java Runtime version",
        "managementOsDistribution": "OS distribution",
        "managementKernelVersion": "Kernel version",
        "managementAgentCount": "Connected agents",
        "managementSessions": "Active client sessions",
        "managementHeapUsed": "Used heap memory",
        "managementHeapTotal": "Available heap memory",
        "managementThreadsBlocked": "Blocked threads",
        "managementThreadsRunnable": "Runnable threads",
        "managementThreadsTotal": "Total threads",
        "managementThreadsWaiting": "Waiting threads",
        "hostBasicInfoDescription": "Host identity and virtualization metadata.",
        "hostVirtualizationRole": "Virtualization role",
        "hostVirtualizationSystem": "Virtualization system",
        "hostOsPlatform": "OS & platform",
        "hostOsPlatformDescription": "Operating system, kernel, and boot information.",
        "hostOS": "OS",
        "hostBootImage": "Boot image",
        "hostBootTime": "Boot time",
        "hostKernelCmdLineView": "View kernel command line",
        "hostResourceUsage": "Resource usage",
        "hostResourceUsageDescription": "Collected CPU, memory, and storage utilization.",
        "hostCpuUsage": "CPU usage",
        "hostMemoryUsage": "Memory usage",
        "hostStorageUsage": "Storage usage",
        "resourceTrendTitlePattern": "Resource {range} trend",
        "resourceTrendRange1h": "1h",
        "resourceTrendRange3h": "3h",
        "resourceTrendRange6h": "6h",
        "resourceTrendRange12h": "12h",
        "resourceTrendCpuUsage": "CPU usage",
        "resourceTrendMemoryUsage": "Memory usage",
        "resourceTrendStorageIops": "Storage IOPS",
        "resourceTrendNetworkTraffic": "Network traffic",
        "resourceTrendNetworkDropsErrors": "Network drops / errors",
        "resourceTrendAverage": "Avg",
        "resourceTrendMax": "Max",
        "resourceTrendDetailsAria": "details statistics",
        "resourceTrendRangeAria": "Resource trend time range",
        "resourceTrendLoading": "Loading trend data.",
        "resourceTrendRefreshing": "Refreshing trend data.",
        "resourceTrendUnavailable": "Unable to load Wall Prometheus trend data.",
        "resourceTrendEmpty": "No resource trend data to display.",
        "resourceTrendSeriesEmpty": "No collected trend data.",
        "resourceTrendCountUnit": "count",
        "hostNetworkSummary": "Network summary",
        "hostNetworkSummaryDescription": "Representative addresses and interface counts.",
        "hostIpCount": "IP addresses",
        "hostInterfaceCount": "Interfaces",
        "hostMacCount": "MAC addresses",
        "hostNetworkCount": "Networks",
        "hostRepresentativeIp": "Representative IP",
        "hostMainInterface": "Main interface",
        "hostNetworkDetailsMissing": "Collected network detail is limited.",
        "hostSocketsProcesses": "Sockets & processes",
        "hostSocketsProcessesDescription": "Socket and major port summary.",
        "hostTotalSockets": "Total sockets",
        "hostOpenPorts": "Open ports",
        "hostListenPorts": "Listening ports",
        "hostExternalConnections": "External connections",
        "hostNoSocketInfo": "No socket information collected.",
        "hostMoreSocketInfo": "Open socket details for the full list.",
        "hostSystemTags": "System tags",
        "hostSystemTagsDescription": "Collected host classification tags.",
        "hostNoTags": "No collected tags.",
        "hostRawInfo": "View raw information",
        "vmBasicInfo": "VM basic information",
        "vmOverviewDescription": "Identity, display name, runtime state, and guest OS information.",
        "vmName": "VM name",
        "vmLibvirtName": "Libvirt name",
        "vmInstanceName": "Instance name",
        "vmId": "VM ID",
        "vmType": "VM type",
        "vmPrivateIp": "Private IP",
        "vmPublicIp": "Public IP",
        "vmCpu": "CPU",
        "vmMemory": "Memory",
        "vmServiceOffering": "Service offering",
        "vmResourceUsageDescription": "Collected vCPU, memory, and storage information for this VM.",
        "vmConnectedResourcesDescription": "Host and network topology objects associated with this VM.",
        "vmNetworkSummaryDescription": "NIC, IP, MAC, and Mold network information.",
        "vmMoldContextDescription": "Placement and tenant metadata collected from Mold inventory.",
        "vmNics": "NICs",
        "vmNoNicInfo": "No NIC information collected.",

        "networkLinkLayer": "Network Link Layer",
        "connectionDisplay": "Connection Display",
        "connectionDisplayLayer2Name": "Physical network layer",
        "connectionDisplayVLayer2Name": "Virtual network layer",
        "connectionDisplayLayer2Description": "Shows physical switching and device links.",
        "connectionDisplayVLayer2Description": "Shows VM, virtual switch, and virtual network links.",
        "connectionDisplayPhysicalBadge": "Physical",
        "connectionDisplayVirtualBadge": "Virtual",
        "connectionDisplayServiceName": "Service",
        "connectionDisplayNodeName": "Node",
        "connectionDisplayDaemonSetName": "DaemonSet",
        "connectionDisplayRelatedResourceSummary": "Related resources",
        "connectionDisplayPodNodeSummary": "Pod / node links",
        "connectionDisplayServiceDescription": "Shows links between Kubernetes Services and related resources.",
        "connectionDisplayNodeDescription": "Shows links between Kubernetes Nodes and related resources.",
        "connectionDisplayDaemonSetDescription": "Shows links between Kubernetes DaemonSets, Pods, and Nodes.",
        "connectionDisplayGenericLayerNamePattern": "{name} links",
        "connectionDisplayAdditionalLayerSummary": "Additional link layer",
        "connectionDisplayAdditionalLayerDescription": "Additional link layer provided by collected graph data.",
        "connectionDisplayVisibleLabel": "Show all node links",
        "connectionDisplayRelatedLabel": "Show related links",
        "connectionDisplayHiddenLabel": "Hide layer",
        "connectionDisplayVisibleDescription": "Shows links for all nodes.",
        "connectionDisplayRelatedDescription": "Shows links directly connected to the selected node.",
        "connectionDisplayHiddenDescription": "Hides links in this layer.",
        "connectionDisplayUsageRelatedTitle": "Show related links",
        "connectionDisplayUsageRelatedPoint1": "Shows links connected to the selected node.",
        "connectionDisplayUsageRelatedPoint2": "Reduces unrelated links.",
        "connectionDisplayUsageVisibleTitle": "Show all links",
        "connectionDisplayUsageVisiblePoint1": "Shows the full network flow.",
        "connectionDisplayUsageVisiblePoint2": "Useful for overall checks.",
        "connectionDisplayUsageHiddenTitle": "Hide layer",
        "connectionDisplayUsageHiddenPoint1": "Hides layers not needed now.",
        "connectionDisplayUsageHiddenPoint2": "Reduces visual noise.",
        "connectionDisplayUsageToggle": "View usage examples",
        "connectionDisplayVisibleShort": "All links",
        "connectionDisplayRelatedShort": "Related links",
        "connectionDisplayHiddenShort": "Hidden",
        "connectionDisplayKubernetesDescription": "Choose how Kubernetes resource links are displayed.",
        "connectionDisplayInfrastructureDescription": "Choose connection layers and traffic range to display.",
        "connectionDisplayRelatedTooltip": "Shows links directly connected to the selected node.",
        "connectionDisplayInfoTooltip": "Choose the network connection range and traffic display mode.",
        "connectionDisplayAdditionalHintPattern": "Scroll horizontally to view {count} more layers",
        "connectionDisplayRangeTitle": "Display range",
        "connectionDisplayCurrentState": "Current state",
        "connectionDisplayKubernetesNotice": "Additional link layers may appear depending on collected resources.",
        "recentViewedNodes": "Recent Nodes",
        "recentViewedNodesEmpty": "Recently viewed nodes will appear here.",
        "recentViewedNodeNotFound": "This node does not exist in the current topology.",
        "expand": "Expand",
        "collapse": "Collapse",
        "searchNodeByNameExample": "Search by node name (e.g., ccvm)",
        "searchKubernetesByNameExample": "Search by cluster, node, or pod name",
        "layerFilter": "Layer filter",
        "topologyLayer": "Topology Layer",
        "infrastructureLayerSummary": "Network · Host · VM",
        "kubernetesLayerSummary": "Cluster · Node · Pod",
        "close": "Close",
        "removeFromSelection": "Remove from selection",
        "pinNode": "Pin node",
        "openConsole": "Open console",
        "setting": "Setting",
        "refresh": "Refresh",
        "loading": "Loading",
        "kubernetesCollection": "Kubernetes Collection",
        "kubernetesCollectionDescription": "Mold registered clusters are shown automatically. You can select multiple clusters as Netdive collection targets.",
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
        "kubernetesManagerTitle": "Kubernetes Topology",
        "kubernetesManagerDescription": "Summary of currently loaded Kubernetes topology resources.",
        "kubernetesWorkloadTypeFilter": "Workload type",
        "kubernetesWorkloadTypeFilterDescription": "Filters Workload Controller nodes without hiding their Pods.",
        "kubernetesTopologyClusters": "Clusters",
        "kubernetesTopologyNodes": "Nodes",
        "kubernetesTopologyNamespaces": "Namespaces",
        "kubernetesTopologyWorkloadControllers": "Workload Controllers",
        "kubernetesTopologyPods": "Pods",
        "kubernetesTopologyServices": "Services",
        "kubernetesClusterBasicInfo": "Cluster basic information",
        "kubernetesClusterOverview": "Cluster overview",
        "kubernetesAdvancedInformation": "Advanced information",
        "kubernetesClusterStatus": "Cluster status",
        "kubernetesClusterActive": "Active",
        "kubernetesClusterUid": "Cluster UID",
        "kubernetesVersion": "Kubernetes version",
        "kubernetesApiConnectionStatus": "API connection status",
        "kubernetesNodeOperationalStatus": "Node operational status",
        "kubernetesNodeReady": "Ready",
        "kubernetesNodeNotReady": "NotReady",
        "kubernetesNodeNoCurrentImpact": "No current workload impact",
        "kubernetesNodeUnavailableConclusion": "Workloads on this node may be affected",
        "kubernetesNodeStatusUnavailable": "Not enough data to determine node status",
        "kubernetesNodeServiceImpact": "{count} services affected",
        "kubernetesPlacedPods": "Assigned Pods",
        "kubernetesProblemPods": "Problem Pods",
        "kubernetesSchedulingShort": "Scheduling",
        "kubernetesAllowed": "Allowed",
        "kubernetesBlocked": "Blocked",
        "kubernetesNodeConditions": "Node Conditions",
        "kubernetesNodeConditionsUnavailable": "Node Condition data has not been collected.",
        "kubernetesNoReason": "No reason provided",
        "kubernetesSchedulingAndTaints": "Scheduling and Taints",
        "kubernetesScheduling": "Scheduling status",
        "kubernetesSchedulingAllowed": "Scheduling allowed",
        "kubernetesNone": "None",
        "kubernetesMaxPodCount": "Maximum Pods",
        "kubernetesCurrentPodCount": "Current Pods",
        "kubernetesCapacityAllocatable": "Capacity and Allocatable",
        "kubernetesCapacity": "Capacity",
        "kubernetesPodCapacity": "Pod capacity",
        "kubernetesNodeCapacityUnavailable": "Capacity data has not been collected.",
        "kubernetesNodeWorkloads": "Node workloads and impact",
        "kubernetesNodeResources": "Node resources",
        "kubernetesNodeConditionAuxiliary": "Node operational information",
        "kubernetesCurrentMaxPods": "Current / maximum Pods",
        "kubernetesNodeWorkloadStatus": "Workload status",
        "kubernetesRunningPods": "Running Pods",
        "kubernetesRestartedPods": "Restarted Pods",
        "kubernetesImpactedPods": "Impacted Pods",
        "kubernetesSingleReplicaWorkloads": "Single-replica workloads",
        "kubernetesSingleReplicaWorkloadsDescription": "A workload with only one replica. A node failure may interrupt the service.",
        "kubernetesLocalStorageWorkloads": "Local-storage workloads",
        "kubernetesLocalStorageWorkloadsDescription": "A workload that uses node-local disks. Data access may be limited when moving to another node.",
        "kubernetesInfrastructureRelationship": "Infrastructure relationship",
        "kubernetesPhysicalHost": "Physical host",
        "kubernetesRelationshipConfidence": "Relationship confidence",
        "kubernetesRelationshipConfirmed": "Confirmed",
        "kubernetesRelationshipInferred": "Inferred",
        "kubernetesRelationshipUnknown": "Relationship not identified",
        "kubernetesConditionInterpretedStatus": "Status",
        "kubernetesConditionRawValue": "Raw value",
        "kubernetesNodeRecentEvents": "Recent events",
        "kubernetesNodeNoImportantEvents": "No recent important events.",
        "kubernetesNotCollectedShort": "Not collected",
        "kubernetesNodeBasicInfo": "Node basic information",
        "kubernetesNodeName": "Node name",
        "kubernetesNodeRoles": "Roles",
        "kubernetesKernelVersion": "Kernel version",
        "kubernetesArchitecture": "Architecture",
        "kubernetesContainerRuntime": "Container runtime",
        "kubernetesNodeDetailFallback": "Live node details could not be collected. Available topology data is shown instead.",
        "kubernetesNamespaceOperationalStatus": "Namespace operational status",
        "kubernetesNamespaceNoCurrentImpact": "No current workload impact",
        "kubernetesNamespaceStatusUnavailable": "Insufficient data to determine namespace status",
        "kubernetesNamespaceTerminatingConclusion": "Namespace deletion is in progress",
        "kubernetesNamespaceEndpointImpact": "{count} services have no available endpoints",
        "kubernetesNamespaceProblemConclusion": "{count} Pods require attention",
        "kubernetesNamespaceWorkloads": "Workloads and resources",
        "kubernetesNamespaceAvailability": "Placement and availability",
        "kubernetesScheduledNodes": "Scheduled nodes",
        "kubernetesEndpointUnavailableServices": "Services without endpoints",
        "kubernetesNamespacePlacement": "Pod placement",
        "kubernetesNamespacePlacementConcentratedDescription": "All Running Pods are placed on a single node.",
        "kubernetesNamespacePlacementDistributedDescription": "Running Pods are distributed across multiple nodes.",
        "kubernetesNamespaceResourcePolicy": "Resource requests and limits",
        "kubernetesNamespaceResourcePolicyEmpty": "No Resource Requests or Limits are configured for this namespace.",
        "kubernetesTopologyFallbackStatus": "Topology data",
        "kubernetesNamespaceRecentEvents": "Recent events",
        "kubernetesNamespaceNoImportantEvents": "No recent important events.",
        "kubernetesEventOccurrenceCount": "{count} occurrences",
        "kubernetesEventJustNow": "just now",
        "kubernetesEventMinutesAgo": "{count} min ago",
        "kubernetesEventHoursAgo": "{count} hr ago",
        "kubernetesEventDaysAgo": "{count} days ago",
        "kubernetesResource": "Resource",
        "kubernetesCpuRequests": "CPU Requests",
        "kubernetesCpuLimits": "CPU Limits",
        "kubernetesMemoryRequests": "Memory Requests",
        "kubernetesMemoryLimits": "Memory Limits",
        "kubernetesNamespaceBasicInfo": "Namespace basic information",
        "kubernetesNamespaceName": "Namespace name",
        "kubernetesNamespacePhase": "Phase",
        "kubernetesNamespaceDetailFallback": "Live namespace details could not be collected. Available topology data is shown instead.",
        "kubernetesPodOperationalStatus": "Pod operational status",
        "kubernetesPodResources": "Pod resources",
        "kubernetesPodVolumesAndNetwork": "Volumes and network",
        "kubernetesPodRecentEvents": "Recent events",
        "kubernetesPodNoCurrentImpact": "All containers are running normally",
        "kubernetesPodWarningConclusion": "One or more containers require attention",
        "kubernetesPodCriticalConclusion": "A failed or terminated container was detected",
        "kubernetesPodStatusUnavailable": "Insufficient data to determine Pod status",
        "kubernetesContainers": "Containers",
        "kubernetesRestarts": "Restarts",
        "kubernetesConnectedServices": "Connected services",
        "kubernetesContainerStatus": "Container status",
        "kubernetesPodContainersUnavailable": "No container status has been collected.",
        "kubernetesResourceConfigurationNone": "No resource requests or limits",
        "kubernetesConfiguredProbes": "Probes",
        "kubernetesPodConditions": "Pod Conditions",
        "kubernetesPodConditionsUnavailable": "No Pod Condition information has been collected.",
        "kubernetesSchedulingRelationships": "Scheduling and relationships",
        "kubernetesScheduledNode": "Scheduled node",
        "kubernetesOwner": "Owner",
        "kubernetesSelectedByServices": "Selected by services",
        "kubernetesStorageAndQos": "Storage and QoS",
        "kubernetesVolumes": "Volumes",
        "kubernetesPodBasicInfo": "Pod basic information",
        "kubernetesPodName": "Pod name",
        "kubernetesStartedAt": "Started at",
        "kubernetesPodDetailFallback": "Live Pod details could not be collected. Available topology data is shown instead.",
        "kubernetesServiceOperationalStatus": "Service operational status",
        "kubernetesServiceStatusDanger": "Danger",
        "kubernetesServiceReadyEndpointsServing": "{count} Ready Endpoints are serving traffic",
        "kubernetesServiceNoReadyEndpointAvailable": "No Endpoints are Ready",
        "kubernetesServiceNoEndpoints": "No Endpoints are connected to this Service",
        "kubernetesServicePorts": "Service ports",
        "kubernetesAllEndpoints": "All Endpoints",
        "kubernetesReadyEndpoints": "Ready Endpoints",
        "kubernetesTargetPods": "Target Pods",
        "kubernetesNodePrefix": "Node ·",
        "kubernetesAvailabilityWarning": "Availability warning",
        "kubernetesAvailabilityNormal": "Availability normal",
        "kubernetesServiceType": "Service type",
        "kubernetesTargetPort": "Target port",
        "kubernetesAdditionalItems": "{count} more",
        "kubernetesAvailabilitySingleEndpoint": "Single Endpoint",
        "kubernetesAvailabilitySingleEndpointSummary": "No failover capacity",
        "kubernetesAvailabilitySingleEndpointDescription": "A node failure may interrupt the Service connection.",
        "kubernetesAvailabilityDistributionWarning": "Distribution warning",
        "kubernetesAvailabilityDistributionWarningSummary": "All Ready Endpoints are concentrated on one node",
        "kubernetesEndpointDistributionWarning": "Endpoint node distribution warning",
        "kubernetesEndpointDistributionWarningDescription": "All {count} Ready Endpoints share one node. A node failure may affect the Service connection.",
        "kubernetesAvailabilityDistributed": "Distributed",
        "kubernetesAvailabilityDistributedSummary": "Distributed across {count} nodes",
        "kubernetesAvailabilityDistributedDescription": "Ready Endpoints are distributed across {count} nodes.",
        "kubernetesServiceEndpointAvailability": "Endpoints and availability",
        "kubernetesServiceAvailabilitySummary": "Availability summary",
        "kubernetesServicePortsTraffic": "Ports and traffic",
        "kubernetesServiceRecentEvents": "Recent events",
        "kubernetesConnectionRelationships": "Connections",
        "kubernetesConnectedResourceGroup": "Kubernetes",
        "kubernetesInfrastructureResourceGroup": "Infrastructure resources",
        "kubernetesServiceEndpointsAvailable": "Ready Endpoints are serving traffic",
        "kubernetesServiceNoReadyEndpoints": "All ready Endpoints are unavailable",
        "kubernetesServicePartialEndpoints": "Some Endpoints require attention",
        "kubernetesServiceStatusUnavailable": "Endpoint availability has not been collected",
        "kubernetesServiceExternalNameConfigured": "ExternalName routing is configured",
        "kubernetesServicePodsReadyInferred": "Connected Pods are Ready (collected relationship inference)",
        "kubernetesServicePodsProblemInferred": "A connected Pod requires attention (collected relationship inference)",
        "kubernetesPorts": "Ports",
        "kubernetesServicePortsAndRouting": "Ports and routing",
        "kubernetesServicePortsUnavailable": "No Service port information has been collected.",
        "kubernetesPortName": "Name",
        "kubernetesServicePort": "Service port",
        "kubernetesServiceEndpointsUnavailable": "EndpointSlice data is unavailable and no connected Pods were identified.",
        "kubernetesServiceNetworkExposure": "Network exposure",
        "kubernetesExternalTrafficPolicy": "External traffic policy",
        "kubernetesInternalTrafficPolicy": "Internal traffic policy",
        "kubernetesSessionAffinity": "Session affinity",
        "kubernetesNotApplicable": "Not applicable",
        "kubernetesServiceSelectionAndResilience": "Selection and resilience",
        "kubernetesRelationshipSource": "Relationship source",
        "kubernetesEndpointData": "Endpoint data",
        "kubernetesCollected": "Collected",
        "kubernetesEndpointNodeDistribution": "Endpoint node distribution",
        "kubernetesSingleNodeConcentration": "All ready Endpoints are on one node",
        "kubernetesDistributedOrSingleEndpoint": "No multi-Endpoint single-node concentration detected",
        "kubernetesEvaluationUnavailable": "Unable to evaluate",
        "kubernetesPublishNotReadyAddresses": "Publish NotReady addresses",
        "kubernetesServiceBasicInfo": "Service basic information",
        "kubernetesServiceName": "Service name",
        "kubernetesServiceDetailFallback": "Live EndpointSlice details could not be collected. Available Service and collected relationship data is shown instead.",
        "kubernetesOperationalStatusShort": "operational status",
        "kubernetesWorkloadNormalConclusion": "Desired workload capacity is available",
        "kubernetesWorkloadWarningConclusion": "Replica or Pod availability requires attention",
        "kubernetesWorkloadFailedConclusion": "The workload has failed executions",
        "kubernetesDesiredReplicas": "Desired",
        "kubernetesAvailableReplicas": "Available",
        "kubernetesUpdatedReplicas": "Updated",
        "kubernetesUnavailableReplicas": "Unavailable",
        "kubernetesReadyReplicas": "Ready",
        "kubernetesCurrentReplicas": "Current",
        "kubernetesDesiredNodes": "Desired nodes",
        "kubernetesReadyNodes": "Ready nodes",
        "kubernetesAvailableNodes": "Available nodes",
        "kubernetesMisscheduledNodes": "Misscheduled",
        "kubernetesCurrentNodes": "Current nodes",
        "kubernetesUpdatedNodes": "Updated nodes",
        "kubernetesUnavailableNodes": "Unavailable nodes",
        "kubernetesParallelism": "Parallelism",
        "kubernetesSchedule": "Schedule",
        "kubernetesSuspend": "Suspend",
        "kubernetesActiveJobs": "Active Jobs",
        "kubernetesLastSchedule": "Last schedule",
        "kubernetesLastSuccessful": "Last successful",
        "kubernetesDeploymentStrategy": "Deployment strategy",
        "kubernetesUpdateStrategy": "Update strategy",
        "kubernetesProgress": "Rollout status",
        "kubernetesInProgress": "In progress",
        "kubernetesStable": "Stable",
        "kubernetesRolloutComplete": "Rollout complete",
        "kubernetesRolloutInProgress": "Rollout in progress",
        "kubernetesRolloutDelayed": "Rollout delayed",
        "kubernetesRolloutFailed": "Rollout failed",
        "kubernetesRolloutPaused": "Rollout paused",
        "kubernetesRevisionStatus": "Revision status",
        "kubernetesRevisionSynced": "Revision synchronized",
        "kubernetesRevisionUpdating": "Revision update in progress",
        "kubernetesWorkloadUpdating": "Updating",
        "kubernetesWorkloadCapacityReady": "The requested workload capacity is available.",
        "kubernetesWorkloadPartialReplicas": "Some Replicas are not ready yet.",
        "kubernetesWorkloadNoAvailableReplicas": "No Replicas are currently available.",
        "kubernetesWorkloadNoReadyReplicas": "No Replicas are currently Ready.",
        "kubernetesWorkloadRevisionApplying": "A new Revision or Replica is being applied.",
        "kubernetesCompletionMode": "Completion mode",
        "kubernetesWorkloadConfiguration": "Workload configuration",
        "kubernetesConnectedPods": "Target Pods",
        "kubernetesNoConnectedPods": "No connected Pods were identified.",
        "kubernetesSinglePod": "Single Pod",
        "kubernetesPlacementAndRelations": "Placement and relationships",
        "kubernetesPlacementNodes": "Placement nodes",
        "kubernetesPodDistribution": "Pod distribution",
        "kubernetesPodOwners": "Pod owners",
        "kubernetesWorkloadConditions": "Status conditions",
        "kubernetesNoConditions": "No Conditions have been collected.",
        "kubernetesWorkloadBasicInfo": "Workload basic information",
        "kubernetesWorkloadType": "Type",
        "kubernetesReplicaRollout": "Replicas and rollout",
        "kubernetesCurrentReplicaSet": "Current ReplicaSet",
        "kubernetesPreviousReplicaSets": "Previous ReplicaSets",
        "kubernetesPodManagementPolicy": "Pod management policy",
        "kubernetesStartOrdinal": "Start ordinal",
        "kubernetesContainersImages": "Containers and images",
        "kubernetesContainerImage": "Image",
        "kubernetesImageUnavailable": "Image information unavailable",
        "kubernetesInformationUnavailable": "Information unavailable",
        "kubernetesImagePullPolicy": "Image pull policy",
        "kubernetesContainerPorts": "Container ports",
        "kubernetesResourceConfiguration": "Resource settings",
        "kubernetesConditionStatus": "Status",
        "kubernetesStorageConfiguration": "Storage configuration",
        "kubernetesPvcTemplate": "PVC Template",
        "kubernetesRequestedCapacity": "Requested capacity",
        "kubernetesWorkloadPodsResources": "Pods and resources",
        "kubernetesWorkloadRecentEvents": "Recent events",
        "kubernetesWorkloadName": "Workload name",
        "yes": "Yes",
        "no": "No",
        "kubernetesCreatedAt": "Created at",
        "kubernetesClusterResources": "Cluster resources",
        "kubernetesClusterResourcesDescription": "Resources observed in this cluster topology by Netdive.",
        "kubernetesClusterNodeDescription": "Compute nodes",
        "kubernetesClusterNamespaceDescription": "Workload scopes",
        "kubernetesClusterPodDescription": "Running workload units",
        "kubernetesClusterServiceDescription": "Service endpoints",
        "kubernetesNetdiveObservation": "Netdive observation",
        "kubernetesNetdiveObservationDescription": "Collection source and topology update information.",
        "kubernetesCollector": "Collector",
        "kubernetesTopologyOrigin": "Topology origin",
        "kubernetesTopologyRevision": "Topology revision",
        "kubernetesMetadata": "Kubernetes metadata",
        "kubernetesLabels": "Labels",
        "kubernetesAnnotations": "Annotations",
        "kubernetesNoLabels": "No labels have been collected.",
        "kubernetesNoAnnotations": "No annotations have been collected.",
        "kubernetesClusterMoldMissing": "This topology cluster is not matched with the current Mold cluster inventory.",
        "kubernetesClusterHealth": "Cluster health overview",
        "kubernetesClusterHealthDescription": "Live Kubernetes health combined with the Mold inventory.",
        "kubernetesControlPlaneStatus": "Control Plane status",
        "kubernetesNodeStatus": "Node status",
        "kubernetesPodStatus": "Pod status",
        "kubernetesAbnormalOverview": "Abnormal status",
        "kubernetesStatusDistribution": "status distribution",
        "kubernetesNoServiceImpact": "No impact",
        "kubernetesServiceAffected": "Affected",
        "kubernetesDataCollectionStatus": "Data collection status",
        "kubernetesNoCollectionRecord": "No collection record",
        "kubernetesLastCollected": "Last collected",
        "kubernetesResourceStatus": "Resource status",
        "kubernetesResourceStatusDescription": "Current node, namespace, Pod, and service state.",
        "kubernetesWorkloadScopes": "Workload scopes",
        "kubernetesServiceEndpoints": "Service endpoints",
        "kubernetesResourceCapacity": "Resource capacity",
        "kubernetesResourceCapacityDescription": "Usage, requests, limits, and remaining allocatable capacity.",
        "kubernetesCpuUsage": "CPU usage",
        "kubernetesMemoryUsage": "Memory usage",
        "kubernetesMetricsUnavailable": "Metrics unavailable",
        "kubernetesResourceRequests": "Total Requests",
        "kubernetesResourceLimits": "Total Limits",
        "kubernetesResourceHeadroom": "Request headroom",
        "kubernetesMoldProvisioned": "Mold provisioned capacity",
        "kubernetesMajorRisks": "Operational alerts and infrastructure risks",
        "kubernetesRiskResilience": "Risk and resilience",
        "kubernetesControlPlaneResilience": "Control Plane resilience",
        "kubernetesSingleConfiguration": "Single configuration",
        "kubernetesMultipleConfiguration": "Multiple configuration",
        "kubernetesRiskNotReadyNodes": "NotReady nodes",
        "kubernetesRiskNotReadyNodesDescription": "One or more nodes are not Ready.",
        "kubernetesRiskFailedPods": "Failed Pods",
        "kubernetesRiskFailedPodsDescription": "One or more Pods have failed.",
        "kubernetesRiskPendingPods": "Pending Pods",
        "kubernetesRiskPendingPodsDescription": "One or more Pods are waiting to be scheduled or started.",
        "kubernetesAffectedServices": "Affected services",
        "kubernetesAffectedServicesDescription": "Services are affected by a failed node or Pod.",
        "kubernetesNoMajorRisks": "No major risks detected.",
        "kubernetesNetdiveImpact": "Netdive impact analysis",
        "kubernetesNetdiveImpactDescription": "Correlates Kubernetes resources with physical hosts and network paths.",
        "kubernetesPhysicalHostConcentration": "Physical host concentration",
        "kubernetesSwitchConcentration": "Same-switch concentration",
        "kubernetesExternalPaths": "External connection paths",
        "kubernetesClusterImpact": "Cluster impact score",
        "kubernetesPlacementUnknown": "Unmapped",
        "kubernetesRecentChanges": "Recent state changes",
        "kubernetesRecentChangesViewAll": "View all",
        "kubernetesRecentChangesAllTitle": "All recent state changes",
        "kubernetesNoRecentChanges": "No state changes were detected in the last 24 hours.",
        "kubernetesZone": "Mold zone",
        "kubernetesNetwork": "Mold network",
        "kubernetesServiceOffering": "Service offering",
        "kubernetesSummaryFallback": "Some live metrics could not be collected, so the panel is based on currently available topology and Mold inventory data.",
        "kubernetesOperationalStatus": "Cluster operational status",
        "kubernetesStatus": "Kubernetes status",
        "kubernetesHealthNormal": "Normal",
        "kubernetesHealthWarning": "Caution",
        "kubernetesHealthCritical": "Critical",
        "kubernetesHealthUnknown": "Unknown",
        "kubernetesMetricsCollection": "Metrics collection",
        "kubernetesMetricsNormal": "Normal",
        "kubernetesMetricsNormalDescription": "CPU and memory metrics are being collected normally.",
        "kubernetesMetricsPreparing": "Preparing",
        "kubernetesMetricsPreparingDescription": "Cluster resource metrics are being prepared.",
        "kubernetesMetricsApiUnavailable": "API unavailable",
        "kubernetesMetricsApiUnavailableDescription": "Check Prometheus integration or Federation status.",
        "kubernetesMetricsNotConfigured": "Not configured",
        "kubernetesMetricsNotConfiguredDescription": "Metrics integration is not configured or metrics-server data is unavailable.",
        "kubernetesMetricsCannotCollect": "Cluster resource metrics cannot be collected.",
        "kubernetesCollectedJustNow": "just now",
        "kubernetesMinutesAgo": " minutes ago",
        "kubernetesHoursAgo": " hours ago",
        "kubernetesOperationalHealthyDescription": "All {control} Control Plane and {worker} Worker Nodes are healthy, with no failed or pending Pods.",
        "kubernetesOperationalUnknownDescription": "There is not enough collected data to determine the current Kubernetes operational status.",
        "kubernetesWorkerNode": "Worker Node",
        "kubernetesUnitNode": "",
        "kubernetesUnitItem": "",
        "kubernetesDetectedSuffix": " detected.",
        "kubernetesServiceImpactSentence": "Up to {count} services may be affected.",
        "kubernetesRiskAvailability": "Availability",
        "kubernetesRiskWorkload": "Workload",
        "kubernetesRiskResource": "Resources",
        "kubernetesRiskNetwork": "Network",
        "kubernetesRiskStorage": "Storage",
        "kubernetesRiskInfrastructure": "Infrastructure",
        "kubernetesRiskChecksDescription": "Node state, Pod failures, resource shortages, service endpoints, physical hosts, and network path concentration were checked.",
        "kubernetesHostConcentrationRisk": "Physical host concentration",
        "kubernetesHostConcentrationRiskDescription": "All mapped Kubernetes nodes are concentrated on one physical host.",
        "kubernetesSwitchConcentrationRisk": "Network path concentration",
        "kubernetesSwitchConcentrationRiskDescription": "All mapped Kubernetes nodes use the same switch path.",
        "kubernetesCurrentAffectedServices": "Currently affected services",
        "kubernetesPhysicalHostDistribution": "Physical host distribution",
        "kubernetesNetworkPathDistribution": "Network path distribution",
        "kubernetesDistributionGood": "Good",
        "kubernetesDistributionCaution": "Caution",
        "kubernetesKnownHostBasis": "Based on mapped physical hosts, ",
        "kubernetesKnownNetworkBasis": "Based on identified network paths, ",
        "kubernetesHostDistributionGoodDescription": "{nodes} Kubernetes nodes are distributed across {targets} physical hosts.",
        "kubernetesHostDistributionCautionDescription": "{percent}% of mapped Kubernetes nodes are concentrated on one physical host.",
        "kubernetesNetworkDistributionGoodDescription": "{nodes} Kubernetes nodes are distributed across {targets} switch paths.",
        "kubernetesNetworkDistributionCautionDescription": "{percent}% of mapped Kubernetes nodes use the same switch path.",
        "kubernetesHostPlacementUnknown": "Physical host mapping data has not been collected.",
        "kubernetesNetworkPlacementUnknown": "Network path mapping data has not been collected.",
        "kubernetesImpactDetected": "Impact detected",
        "kubernetesImpactNone": "No current impact",
        "kubernetesAffectedServiceDetectedDescription": "{count} services may currently be affected by node or Pod failures.",
        "kubernetesAffectedServiceNormalDescription": "No services are currently identified as affected by node or Pod failures.",
        "kubernetesExternalPathUnknownDescription": "External path data cannot be verified from the currently collected data.",
        "kubernetesExternalPathSingleDescription": "Only one identified external connection path exists.",
        "kubernetesExternalPathMultipleDescription": "{count} external connection paths have been identified.",
        "kubernetesExternalPathNoneDescription": "No exposed external connection path has been identified.",
        "kubernetesCurrentFailureImpact": "Current failure impact",
        "kubernetesPotentialInfrastructureRisk": "Structural risk",
        "kubernetesCurrentFailureImpactTooltip": "Calculated from NotReady nodes, abnormal Pods, and currently affected services.",
        "kubernetesPotentialInfrastructureRiskTooltip": "Calculated separately from operational status using only evaluated physical-host concentration, switch-path concentration, single Control Plane, and single external paths.",
        "kubernetesImpactLow": "Low",
        "kubernetesImpactCaution": "Caution",
        "kubernetesImpactHigh": "High",
        "kubernetesImpactCritical": "Critical",
        "kubernetesFocusNodes": "Show only this cluster's nodes in the topology",
        "kubernetesFocusNamespaces": "Show only this cluster's namespaces in the topology",
        "kubernetesFocusPods": "Show only this cluster's Pods in the topology",
        "kubernetesFocusServices": "Open this cluster's service list",
        "kubernetesCurrentUsage": "Current usage",
        "kubernetesUsageRate": "Usage",
        "kubernetesAllocatableLabel": "Available resources",
        "kubernetesRequestRate": "Reservation rate",
        "kubernetesReservationRateDescription": "Reservation rate = Requests / Kubernetes available resources. This is not real-time usage.",
        "kubernetesReservable": "Reservable",
        "kubernetesMemory": "Memory",
        "kubernetesMoldVmAllocation": "Mold VM resources",
        "kubernetesAllocatableCapacity": "Kubernetes available resources",
        "kubernetesCurrentUsageDescription": "Current CPU and memory usage reported by Metrics Server.",
        "kubernetesAllocatableDescription": "This is the Kubernetes Allocatable value. Resources available to Pods after operating system and Kubernetes system reservations are excluded from total node resources.",
        "kubernetesRequestDescription": "Sum of configured Requests. Only containers with a configured value are included; unconfigured containers are excluded.\n\nThis value is different from current usage (Current).",
        "kubernetesLimitDescription": "Sum of configured Limits. Only containers with a configured value are included; unconfigured containers are excluded.\n\nLimits can therefore appear lower than Requests. This is normal Kubernetes behavior, not a data error.",
        "kubernetesReservableDescription": "Allocatable minus Requests. This is the remaining resource that new Pods can reserve through Requests, not a value based on current usage.",
        "kubernetesCpuUnitDescription": "1 Core = 1000m",
        "kubernetesMemoryUnitDescription": "Memory values are displayed in GiB. Kubernetes source units are available in tooltips.",
        "kubernetesCpuReservationRate": "CPU reservation rate",
        "kubernetesMemoryReservationRate": "Memory reservation rate",
        "kubernetesDisplayedValue": "Displayed value",
        "kubernetesOriginalValue": "Original value",
        "kubernetesMoldVmAllocationDescription": "Total vCPU and memory allocated by Mold to the Kubernetes cluster VMs.",
        "kubernetesAllocatableCapacityDescription": "Total resources Kubernetes can actually provide to Pods.",
        "kubernetesGroupedEvents": "{count} events",
        "kubernetesAdditionalEvents": "+{count}",
        "kubernetesRelatedEvents": "Related events {count}",
        "kubernetesCollapseEvents": "Collapse",
        "kubernetesEventInfo": "Info",
        "kubernetesUnknown": "Unknown",
        "kubernetesNotCollected": "Not collected",
        "kubernetesNoConnectionInfo": "No connection information",
        "kubernetesMoldDeploymentStatus": "Mold deployment status",
        "kubernetesSummaryFallbackDetail": "CPU and memory usage and the latest collection time may not be displayed.",
        "kubernetesSingleHost": "Single host",
        "kubernetesSingleSwitch": "Single switch",
        "kubernetesRiskReview": "Review",
        "kubernetesHeroControlPlaneFailure": "{count} Control Plane node unavailable",
        "kubernetesHeroWorkerFailure": "{count} Worker Node unavailable",
        "kubernetesHeroPodFailure": "{count} failed Pods",
        "kubernetesHeroServiceImpact": "{count} services affected",
        "kubernetesHeroNetworkConcentration": "Network path concentration",
        "kubernetesHeroHostConcentration": "Physical host concentration",
        "kubernetesHeroPendingPods": "{count} pending Pods",
        "kubernetesHeroNoImpact": "No current impact",
        "kubernetesAffectedServiceKpi": "Affected services",
        "kubernetesPotentialRiskKpi": "Potential risk",
        "kubernetesCurrentState": "Current state",
        "kubernetesPlacementRisk": "Placement risk",
        "kubernetesHostDistributionShort": "Host distribution",
        "kubernetesNetworkPathShort": "Network path",
        "kubernetesConcentrated": "Concentrated",
        "kubernetesDistributed": "Distributed",
        "kubernetesCurrentAlerts": "Current alerts",
        "kubernetesNoCurrentAlerts": "No operational alerts detected",
        "kubernetesPotentialRisks": "Potential risks",
        "kubernetesNoPotentialRisks": "No evaluable potential risks detected",
        "kubernetesResilienceGood": "Good",
        "kubernetesResilienceRecommended": "Improvement recommended",
        "kubernetesResilienceVulnerable": "Vulnerable",
        "kubernetesResilienceVeryVulnerable": "Highly vulnerable",
        "kubernetesResilienceUnavailable": "Not evaluated",
        "kubernetesSingleControlPlaneRisk": "Single Control Plane",
        "kubernetesSingleControlPlaneRiskDescription": "Only one Control Plane node has been identified.",
        "kubernetesSingleExternalPathRisk": "Single external path",
        "kubernetesSingleExternalPathRiskDescription": "Only one currently identified external connection path exists.",
        "kubernetesSinglePath": "Single path",
        "kubernetesMultiplePaths": "Multiple paths",
        "kubernetesNoExternalExposure": "No external exposure",
        "kubernetesAnalysisConfidence": "Analysis confidence",
        "kubernetesConfidenceLimited": "Limited",
        "kubernetesConfidenceSufficient": "Sufficient",
        "kubernetesConfidenceLimitedDescription": "All redundant physical-host or network paths may not have been collected.",
        "kubernetesConfidencePartial": "Partial",
        "kubernetesConfidenceInsufficient": "Insufficient",
        "kubernetesConfidenceUnavailable": "Unavailable",
        "kubernetesConfidenceSufficientSummary": "Required data collection complete",
        "kubernetesConfidencePartialSummary": "Some required data is missing",
        "kubernetesConfidenceInsufficientSummary": "Major required data is missing",
        "kubernetesConfidenceUnavailableSummary": "Collection status is unavailable",
        "kubernetesConfidenceDefinition": "Indicates the collection completeness of status, placement, and relationship data required to calculate the current risk and resilience results.",
        "kubernetesConfidenceSufficientDescription": "All data required for the analysis has been collected.",
        "kubernetesConfidencePartialDescription": "Some required data is missing, so some analysis results may be limited.",
        "kubernetesConfidenceInsufficientDescription": "Multiple required inputs are missing, so confidence in the analysis is low.",
        "kubernetesConfidenceUnavailableDescription": "The data collection status cannot be determined.",
        "kubernetesConfidenceCurrent": "Current analysis confidence: {state}",
        "kubernetesConfidenceCollectedData": "Collected",
        "kubernetesConfidenceMissingData": "Missing",
        "kubernetesConfidenceNoMissingData": "No required data is missing",
        "kubernetesConfidenceDataNodeReady": "Node status and Ready state",
        "kubernetesConfidenceDataControlPlane": "Control Plane configuration and status",
        "kubernetesConfidenceDataPodStatus": "Pod and problem Pod status",
        "kubernetesConfidenceDataAffectedServices": "Affected services",
        "kubernetesConfidenceDataHostDistribution": "Host distribution",
        "kubernetesConfidenceDataNetworkPath": "Network paths",
        "kubernetesConfidenceDataExternalPath": "External connection paths",
        "kubernetesConfidenceDataNetworkUnavailable": "NetworkUnavailable condition",
        "kubernetesConfidenceDataMemoryPressure": "MemoryPressure condition",
        "kubernetesConfidenceDataDiskPressure": "DiskPressure condition",
        "kubernetesConfidenceDataPidPressure": "PIDPressure condition",
        "kubernetesConfidenceDataPodCapacity": "Current and maximum Pods",
        "kubernetesConfidenceDataSingleReplica": "Single-replica workloads",
        "kubernetesConfidenceDataLocalStorage": "Local-storage workloads",
        "kubernetesConfidenceDataMoldVm": "Mold VM relationship",
        "kubernetesConfidenceDataPhysicalHost": "Physical-host relationship",
        "kubernetesNodeSelectorSearchPlaceholder": "Search by node or cluster name",
        "kubernetesNodeSelectorHighlightAll": "Highlight all nodes",
        "kubernetesNodeSelectorEmpty": "No Kubernetes nodes are associated with this host.",
        "kubernetesNodeSelectorNoResults": "No matching Kubernetes nodes were found.",
        "kubernetesNodeSelectorMoreSuffix": " more",
        "kubernetesNodeSelectorClusterCountLabel": "Clusters",
        "kubernetesNodeSelectorNodeCountLabel": "Nodes",
        "kubernetesNodeSelectorClusterLabel": "Cluster",
        "kubernetesNodeSelectorNodeLabel": "Node",
        "kubernetesNodeSelectorExpandAll": "Expand all",
        "kubernetesNodeSelectorCollapseAll": "Collapse all",
        "kubernetesNodeSelectorExpandAllClusters": "Expand all clusters",
        "kubernetesNodeSelectorCollapseAllClusters": "Collapse all clusters",
        "kubernetesNodeSelectorTopologyHighlight": "Highlight in topology",
        "kubernetesNodeExplorerTitle": "Kubernetes node explorer",
        "kubernetesNodeExplorerDescriptionPattern": "Kubernetes nodes placed on this host ({host}).",
        "kubernetesNodeSelectorWorkerNodePattern": "Worker Node {count}",
        "kubernetesNodeSelectorControlPlaneNodePattern": "Control Plane Node {count}",
        "kubernetesNodeSelectorRoleNodePattern": "{role} Node {count}",
        "kubernetesNodeSelectorControlPlaneWorkerPattern": "Control Plane {controlPlane} · Worker {worker}",
        "kubernetesNodeSelectorCountSuffix": "",
        "kubernetesNodeSelectorRemainingPrefix": "More",
        "kubernetesNodeSelectorRemainingSuffix": " nodes",
        "move": "Move",
        "filter": "Filter",
        "role": "Role",
        "status": "Status",
        "kubernetesTotalClusters": "Total clusters",
        "kubernetesCollectionManagementSection": "Kubernetes Collection Management",
        "kubernetesClusterList": "Cluster List",
        "kubernetesClusterListDescription": "Check Kubernetes connection tests and Netdive collection status.",
        "kubernetesAutoCollectionStarting": "Starting collection for newly discovered Mold clusters...",
        "kubernetesAutoCollectionStarted": "Collection started automatically for newly discovered Mold clusters.",
        "kubernetesAutoCollectionFailed": "Failed to start collection automatically for a newly discovered Mold cluster.",
        "kubernetesCollectionPolicy": "Collection Policy",
        "kubernetesCollectionPolicyDescription": "Resource scope collected by Netdive to build the Kubernetes topology.",
        "kubernetesCollectionPolicyNotice": "secret and configmap are excluded by default to reduce exposure of sensitive information and configuration data.",
        "kubernetesTestAll": "Test All Connections",
        "kubernetesTestAllRunning": "Testing all connections...",
        "kubernetesTestAllSuccess": "All Kubernetes connection tests succeeded.",
        "kubernetesTestAllFailed": "Some Kubernetes connection tests failed.",
        "kubernetesTestAllFailedSuffix": "connection tests failed",
        "kubernetesClusterName": "Cluster Name",
        "kubernetesMoldClusterId": "Mold Cluster ID",
        "kubernetesApiServer": "API Server",
        "kubernetesLastConnectionTest": "Last Connection Test",
        "kubernetesLastCollectionStatus": "Last Collection Status",
        "kubernetesActions": "Actions",
        "kubernetesEnableConfirmTitle": "Confirm Collection Activation",
        "kubernetesEnableConfirmDescription": "Enabling collection creates kubeconfig and starts the Netdive K8s probe.",
        "kubernetesDisableConfirmTitle": "Confirm Collection Stop",
        "kubernetesDisableConfirmDescription": "Stop collecting this Kubernetes cluster from Netdive topology.",
        "kubernetesStepKubeconfig": "Preparing kubeconfig",
        "kubernetesStepConnection": "Checking connection",
        "kubernetesNoTestResult": "Run a connection test to see itemized results.",
        "kubernetesDefaultEnabledProbes": "Default collection targets",
        "kubernetesDefaultEnabledProbesDescription": "Kubernetes resources required to build the topology.",
        "kubernetesDefaultDisabledProbes": "Default exclusions",
        "kubernetesDefaultDisabledProbesDescription": "Excluded by default because they may expose sensitive information or configuration data.",
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
        "testing": "Testing",
        "waiting": "Waiting",
        "kubernetesTestDescription": "Checks Kubernetes API connectivity and basic read permissions.",
        "kubernetesAllTestsPassed": "All tests passed",
        "kubernetesCheckedCountSuffix": "checked",
        "kubernetesFailedCountSuffix": " items failed",
        "collectionSection": "Collection",
        "viewSettingsSection": "View Settings",
        "helpSection": "Help",
        "infrastructureMenu": "Infrastructure",
        "infrastructureMenuSummary": "Switches · Hosts · VMs",
        "infrastructurePanelTitle": "Infrastructure Topology",
        "infrastructurePanelDescription": "Summary of the currently loaded host, network, and VM topology.",
        "infrastructureHosts": "Hosts",
        "infrastructureUserVMs": "User VMs",
        "infrastructureSystemVMs": "System VMs",
        "infrastructureNetworkLinks": "Network links",
        "infrastructureOverview": "Topology Overview",
        "infrastructureOverviewDescription": "Counts are calculated from the current Netdive graph.",
        "infrastructureNetworkObjects": "Network objects",
        "infrastructureNetworkObjectsDescription": "Bridge, network, and interface objects",
        "infrastructureRouters": "Virtual routers",
        "infrastructureRoutersDescription": "System VMs responsible for network paths",
        "infrastructureUserVMsDescription": "User workload virtual machines",
        "infrastructureSystemVMsDescription": "Infrastructure operation virtual machines",
        "infrastructureTotalNodes": "Total infrastructure nodes",
        "infrastructureTotalNodesDescription": "All currently displayable infrastructure nodes",
        "infrastructureShowAll": "Show all",
        "infrastructureShowAllDescription": "Clear topology focus and show all infrastructure nodes",
        "infrastructureViewAll": "Overall",
        "infrastructureViewHosts": "By host",
        "infrastructureNoHosts": "No host information collected.",
        "all": "All",
        "kubernetesCollectionMenu": "Kubernetes",
        "kubernetesMenuSummary": "Cluster · Node · Pod",
        "clusterCountPrefix": "",
        "clusterCountSuffix": " clusters",
        "screenConfig": "Screen Layout",
        "screenConfigDescription": "Manage topology display options.",
        "screenConfigComingSoon": "Available soon",
        "preferences": "Preferences",
        "preferencesDescription": "Customize the service environment to your preferences.",
        "language": "Language",
        "initialTopologyLayer": "Default topology",
        "initialTopologyLayerDescription": "※ Changes are applied after the next sign-in or refresh.",
        "restoreDefaults": "Defaults",
        "showInfrastructureLayer": "Show Infrastructure Layer",
        "showKubernetesLayer": "Show Kubernetes Layer",
        "showNetworkLinkLayer": "Show Network Link Layer",
        "showTrafficLabels": "Show Traffic Labels",
        "nodeLabelDisplayMode": "Node Label Display Mode",
        "showGroupNodes": "Show Group Nodes",
        "helpPanelDescription": "Netdive topology screen guide.",
        "aboutPanelDescription": "Visualizes infrastructure and Kubernetes topology.",
        "version": "Version",
        "productFamily": "Product family",
        "vendor": "Provider",
        "documentation": "Documentation",
        "kubernetesCheck-kubeconfig": "Create/read kubeconfig",
        "kubernetesCheck-apiserver": "API Server access",
        "kubernetesCheck-client": "Kubernetes client check",
        "kubernetesClientCreated": "Kubernetes client was created.",
        "kubernetesCheck-version": "/version call",
        "kubernetesCheck-namespaces": "List namespaces",
        "kubernetesCheck-nodes": "List nodes",
        "kubernetesCheck-pods": "List pods",
        "kubernetesCheck-services": "List services",
        "kubernetesCheck-networkpolicies": "List networkpolicies",

        "help": "Help",
        "helpSection-menu": "Menu",
        "helpSection-toolbar": "Toolbar",
        "helpSection-topology": "Topology",
        "helpMenuTitle": "Left menu",
        "helpMenuDescription": "Use the left menu as the entry point for collection, display settings, preferences, and help.",
        "helpMenuPointCollection": "Infrastructure returns to the default host, network, and VM topology.",
        "helpMenuPointKubernetes": "Kubernetes opens cluster collection management, connection tests, and collection policy.",
        "helpMenuPointView": "Kubernetes opens collection management, while Screen Layout and Preferences manage display options.",
        "helpMenuPointPreferences": "Preferences contains language and screen theme settings.",
        "helpMenuPointHelp": "Help and About open as side panels without leaving the topology screen.",
        "helpToolbarTitle": "Top toolbar",
        "helpToolbarDescription": "The top toolbar provides quick actions used while exploring the topology.",
        "helpToolbarPointLogo": "The logo area identifies Netdive and keeps the workspace context visible.",
        "helpToolbarPointSearch": "Search by host, VM, interface, Kubernetes object, or display name.",
        "helpToolbarPointExpand": "Use expand/collapse controls to open or group topology nodes quickly.",
        "helpToolbarPointStatus": "Connection and notification icons show current UI/session status.",
        "helpToolbarPointDrawer": "The menu button opens the left navigation panel without leaving the current topology.",
        "helpTopologyTitle": "Topology canvas",
        "helpTopologyDescription": "The canvas visualizes infrastructure and Kubernetes relationships in layered form.",
        "helpTopologyPointLayers": "Left-side layer labels show whether nodes belong to host, NIC, bridge, VM, or Kubernetes layers.",
        "helpTopologyPointNode": "Select a node to bring its label forward and inspect details in the right panel.",
        "helpTopologyPointLink": "Links represent ownership, network connection, and traffic flow without changing the source graph.",
        "helpTopologyPointDetail": "The right detail panel follows the selected node and shows properties, tables, and available actions.",
        "helpKubernetesTitle": "Kubernetes collection",
        "helpKubernetesDescription": "Shows Mold registered Kubernetes clusters and displays collected Kubernetes resources in the topology.",
        "helpKubernetesPointCollection": "Open Kubernetes from the left menu to enable collection, refresh clusters, or run connection tests.",
        "helpKubernetesPointTopology": "The Kubernetes topology shows clusters, nodes, namespaces, workload controllers, Pods, and storage resources.",
        "helpKubernetesPointPolicy": "Collection Policy explains included resources and default exclusions such as secret/configmap.",
        "helpViewTitle": "View and display options",
        "helpViewDescription": "Use view settings to keep the topology readable while exploring large environments.",
        "helpViewPointLayerFilter": "Filter infrastructure, Kubernetes, and network link layers depending on what you need to inspect.",
        "helpViewPointTraffic": "Traffic labels help identify active links without changing the underlying graph data.",
        "helpViewPointTheme": "Language and screen theme are managed from Preferences.",
        "helpDocsTitle": "Need more details?",
        "helpDocsDescription": "Open the online guide for setup and operation details.",
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
        "capture-target-k8s-node": "Kubernetes Node",
        "capture-target-k8s-pod": "Kubernetes Pod",
        "capture-target-k8s-service": "Kubernetes Service",
        "capture-target-k8s-namespace": "Kubernetes Namespace",
        "capture-target-k8s-daemonset": "Kubernetes DaemonSet",
        "capture-target-k8s-deployment": "Kubernetes Deployment",
        "capture-target-k8s-cluster": "Kubernetes Cluster",
        "capture-target-k8s-resource": "Kubernetes Resource",
        "capture-target-policy-title": "View capture policy by layer",
        "capture-target-policy-direct": "Direct capture available",
        "capture-target-policy-unavailable": "Direct capture unavailable",
        "capture-target-policy-capturable-layers": "Physical NICs / Bond Interfaces / Host Bridges",
        "capture-target-policy-logical-layers": "Hosts / Switches / User VMs / System VMs",
        "capture-target-policy-k8s-layers": "Kubernetes Nodes / Namespaces / Pods",
        "capture-target-policy-k8s-logical-targets": "Kubernetes Services / Namespaces / DaemonSets",
        "capture-target-policy-infra-desc": "Run capture on infrastructure objects that have a capturable TID and capture type.",
        "capture-target-policy-logical-desc": "These are logical or upper-level objects. Capture from a related NIC, bond interface, or host bridge.",
        "capture-target-policy-k8s-desc": "For Kubernetes layers, select a related infrastructure capture target.",
        "capture-target-policy-k8s-logical-desc": "Check the related Pod, Node, and infrastructure object first.",

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
        "capture-rawPacketLimit-explained": "Limits how many raw packets are saved per flow for PCAP download. Accepts values from 0 to 10. 0 disables raw packet storage.",
        "capture-headerSize-tooltip": "Sets how much of the beginning part (header) of each packet to include in the capture, in bytes.",
        "capture-headerSize-explained": "The header contains source/destination information and protocol metadata. This option sets how many bytes of the header to capture. Leave blank to use the default.",
        "capture-type-pcap": "A basic and widely compatible capture method. Easy to set up.",
        "capture-type-afpacket": "A Linux-specific method that's faster than PCAP, but slightly harder to configure.",
        "capture-type-ebpf": "High-performance method using kernel-level capture with low overhead. Requires recent Linux.",
        "capture-type-sflow": "Collects flow data sampled from switches/routers. Requires configuration on network devices.",
        "capture-type-dpdk": "Ultra-high-speed packet processing for advanced systems. Complex setup.",
        "capture-type-ovsmirror": "Mirrors traffic from OVS ports. Useful in virtualized environments.",
        "capture-headerSize-validation-error": "Header size must be between 14 and 4096.",
        "capture-rawPacketLimit-validation-error": "Valid values are 0 to 10.",

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
        "ovs-mirror-only": "Only available on eligible OVS ports.",
        "ovs-mirror-physical-nic-only": "OVS Mirror is only available on OVS ports connected to a physical NIC.",
        "tooltip-pcap": "PCAP: The simplest capture driver with low performance, but works in most environments.",
        "tooltip-afpacket": "AFPacket: High-speed packet capture based on the Linux kernel. Recommended for general NICs.",
        "tooltip-ebpf": "eBPF: Requires a modern Linux kernel and enables high-performance capture and filtering.",
        "tooltip-sflow": "sFlow: Receives flow data collected from switches/routers. External configuration required.",
        "tooltip-dpdk": "DPDK: High-performance user-space packet processing. Requires dedicated drivers and hugepage setup.",
        "tooltip-afpacket-unavailable": "This node does not support AFPacket capture.",
        "tooltip-pcap-unavailable": "This node does not support PCAP capture.",
        "expandAllNodes": "Expand All Nodes",
        "collapseAllNodes": "Collapse All Nodes",
        "hostListeningServices": "Listening services",
        "hostTopSocketProcesses": "Socket processes",
        "hostConnectionStates": "Connection states",
        "hostSocketMoreItems": "more",
        "hostSocketViewAll": "View all >",
        "hostSocketProcessColumn": "Process",
        "hostSocketCountColumn": "Count",
        "hostSocketRatioColumn": "Ratio",
        "hostSocketServiceColumn": "Service",
        "hostSocketPortProtocolColumn": "Port / protocol",
        "hostSocketProtocolTcp": "TCP",
        "hostSocketProtocolUdp": "UDP",
        "hostSocketStateListen": "LISTEN",
        "hostSocketStateEstablished": "ESTABLISHED",
        "hostSocketStateTimeWait": "TIME_WAIT",
        "hostSocketStateCloseWait": "CLOSE_WAIT",
        "hostSocketNoProcess": "Unknown process",
        "hostSocketNoService": "No listening service",
        "hostSocketNoConnectionState": "No connection state",
        "hostSocketCollapse": "Collapse",
        "topologyZoomOut": "Zoom out",
        "topologyZoomIn": "Zoom in",
        "topologyZoomReset": "Reset to 100%",
        "topologyZoomFit": "Fit to screen",
        "topologyZoomFitShort": "Fit"
    },
    ko: {
        "k8s-Federations": "쿠버네티스 페더레이션",
        "k8s-clusters": "쿠버네티스 클러스터",
        "k8s-nodes": "쿠버네티스 노드",
        "k8s-namespaces": "쿠버네티스 네임스페이스",
        "k8s-workloads": "쿠버네티스 워크로드 컨트롤러",
        "k8s-pods": "쿠버네티스 파드",
        "k8s-storage": "쿠버네티스 스토리지",
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
        "virt-router(s)": "가상 라우터 그룹",
        "system-vm(s)": "시스템 가상머신 그룹",
        "virt-bridge(s)": "가상 브릿지 그룹",
        "host-bridge(s)": "호스트 브릿지 그룹",
        "bridge(s)": "브릿지 그룹",
        "bond(s)": "본딩 인터페이스 그룹",
        "vlan(s)": "VLAN 그룹",
        "groupSuffix": "그룹",
        "k8s-cluster-group": "클러스터 그룹",
        "k8s-node-group": "노드 그룹",
        "k8s-namespace-group": "네임스페이스 그룹",
        "k8s-pod-group": "파드 그룹",
        "k8s-service-group": "서비스 그룹",
        "k8s-app-group": "리소스 그룹",

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
        "hostStatusCollected": "수집됨",
        "hostStatusNormal": "정상",
        "hostInfoUnavailable": "정보 없음",
        "hostNoData": "수집된 데이터가 없습니다.",
        "hostNoResourceMetrics": "수집된 리소스 사용량 정보가 없습니다.",
        "hostOperationsSummary": "호스트 운영 요약",
        "hostOperationsDescription": "가상화, 네트워크, 소켓 관측값을 먼저 확인합니다.",
        "hostName": "호스트명",
        "hostHypervisor": "하이퍼바이저",
        "hostSocketFootprint": "소켓 관측",
        "hostRepresentativeAddress": "대표 주소",
        "hostNoRepresentativeIp": "대표 IP 없음",
        "hostOperationalStatus": "운영 상태",
        "hostOperationalStatusDescription": "Mold, Netdive 수집, 에이전트 상태를 한눈에 확인합니다.",
        "hostManagementIp": "관리 IP",
        "hostOverviewDescription": "식별 정보, 가상화 정보, Mold 인벤토리 신호입니다.",
        "hostConnectedResources": "연결 자원",
        "hostConnectedResourcesDescription": "이 호스트와 연결된 VM, 라우터, 네트워크 자원입니다.",
        "hostInfrastructureResources": "인프라 자원",
        "hostNoConnectedResources": "연결 자원 정보가 아직 수집되지 않았습니다.",
        "hostRecentSignals": "최근 신호",
        "hostRecentSignalsDescription": "최근 업데이트, 이벤트, 캡처, 상태 변경 신호입니다.",
        "hostNoRecentSignals": "최근 신호가 없습니다.",
        "hostTopologyPath": "상위 연결 경로",
        "hostTopologyPathDescription": "이 호스트가 어떤 배치 경로에 속하는지 확인합니다.",
        "hostNoTopologyPath": "수집된 배치 경로 정보가 없습니다.",
        "hostConnectedVMs": "연결 VM",
        "hostConnectedVMsDescription": "사용자 워크로드 VM",
        "hostSystemVMs": "시스템 VM",
        "hostSystemVMsDescription": "인프라 운영 시스템 VM",
        "hostVirtualRouters": "가상 라우터",
        "hostVirtualRoutersDescription": "네트워크 경로 VM",
        "hostNetworkCountDescription": "네트워크 객체와 인터페이스",
        "hostMoldContext": "Mold 컨텍스트",
        "hostMoldContextDescription": "Mold 또는 호스트 인벤토리에서 수집된 배치 메타데이터입니다.",
        "hostMoldMissing": "이 호스트의 Mold 배치 메타데이터가 아직 수집되지 않았습니다.",
        "hostZone": "Zone",
        "hostCluster": "클러스터",
        "hostPod": "Pod",
        "hostDomain": "도메인",
        "hostAccount": "계정",
        "hostMoldHostId": "Mold 호스트 ID",
        "hostResourceState": "리소스 상태",
        "hostAllocationState": "할당 상태",
        "hostManagementServer": "관리 서버",
        "hostTopPorts": "주요 포트",
        "hostStatusSection": "상태",
        "hostStatusSectionDescription": "에이전트와 최근 수집 상태입니다.",
        "hostCollectionState": "수집 상태",
        "hostAgent": "에이전트",
        "hostLastUpdate": "최근 업데이트",
        "hostRecentEvent": "최근 이벤트",
        "hostRecentCapture": "최근 캡처",
        "hostRecentStateChange": "최근 상태 변경",
        "hostMonitoringPeriod": "모니터링 기간",
        "hostLocation": "위치",
        "hostBasicInfo": "기본 정보",
        "switchBasicInfo": "기본 정보",
        "switchName": "이름",
        "switchManagementIp": "관리 IP",
        "switchType": "타입",
        "switchProbe": "수집 Probe",
        "switchLldpInfo": "LLDP 정보",
        "switchChassisId": "Chassis ID",
        "switchChassisIdType": "Chassis ID 유형",
        "switchSystemDescription": "시스템 설명",
        "switchManagementAddress": "관리 주소",
        "switchNoLldp": "수집된 LLDP 정보가 없습니다.",
        "switchPortConnectedNodes": "연결 노드",
        "switchPortPortId": "포트 ID",
        "switchPortPortIdType": "포트 ID 유형",
        "switchPortDescription": "포트 설명",
        "switchPortRemoteSystem": "원격 시스템",
        "switchPortRemotePort": "원격 포트",
        "switchPortRemoteDescription": "원격 포트 설명",
        "bondMode": "본딩 모드",
        "bondConfiguration": "Bond 구성",
        "bondSlaveInterface": "Slave 인터페이스",
        "bondSlaveInterfaces": "Slave 인터페이스",
        "bondNoData": "수집된 정보가 없습니다.",
        "nicConnectedNodes": "연결 노드",
        "nicLinkStatus": "Link 상태",
        "nicDuplex": "Duplex",
        "nicAutoNegotiation": "Auto Negotiation",
        "nicCarrier": "Carrier",
        "nicLldpNeighbor": "LLDP Neighbor",
        "detailAdvancedInfo": "고급 정보",
        "nicNetlinkInfo": "Netlink 정보",
        "nicNoData": "수집된 정보가 없습니다.",
        "bridgeMemberInterfaces": "멤버 인터페이스",
        "bridgeConfiguration": "Bridge 구성",
        "bridgeNetworkAddresses": "네트워크 주소",
        "bridgeInterfaceInfo": "인터페이스 정보",
        "bridgeUplink": "업링크",
        "bridgeNoData": "수집된 정보가 없습니다.",
        "vlanConfiguration": "VLAN 구성",
        "vlanId": "VLAN ID",
        "vlanParentInterface": "부모 인터페이스",
        "vlanConnectedInterfaces": "연결 인터페이스",
        "vlanProtocol": "VLAN 프로토콜",
        "vlanInterfaceInfo": "인터페이스 정보",
        "vlanNoData": "수집된 정보가 없습니다.",
        "managementServerInfo": "Mold 관리 서버",
        "managementServerResources": "관리 서버 리소스",
        "managementServerJvm": "JVM 상태",
        "managementCollectionTime": "수집 시간",
        "managementUsageLocal": "사용 서버가 로컬에 설치됨",
        "managementDbLocal": "DB가 로컬에서 실행",
        "managementLastStart": "관리서버의 마지막 시작 시간",
        "managementLastStop": "관리서버의 마지막 정지 시간",
        "managementLastBoot": "관리서버 시스템의 부팅 시간",
        "managementLogInfo": "로그 파일 정보",
        "managementSystemCpu": "모든 코어의 전체 CPU 용량(MHz)",
        "managementLoadAverages": "1, 5, 15분 로드 평균",
        "managementCycleUsage": "사용자, 시스템 및 Idle 주기",
        "managementSystemMemoryTotal": "전체 시스템 메모리",
        "managementSystemMemoryFree": "사용 가능한 시스템 메모리",
        "managementVirtualMemory": "가상 전체 프로세스 크기",
        "managementAvailableProcessors": "사용 가능한 프로세서 코어",
        "managementJavaDistribution": "Java Runtime 배포",
        "managementJavaVersion": "Java Runtime Version",
        "managementOsDistribution": "OS 배포",
        "managementKernelVersion": "Kernel Version",
        "managementAgentCount": "연결된 에이전트 수",
        "managementSessions": "Active 클라이언트 세션",
        "managementHeapUsed": "사용 Heap-memory",
        "managementHeapTotal": "사용가능 Heap-memory",
        "managementThreadsBlocked": "차단된 스레드",
        "managementThreadsRunnable": "실행 가능한 스레드",
        "managementThreadsTotal": "전체 스레드 수",
        "managementThreadsWaiting": "대기 중인 스레드",
        "hostBasicInfoDescription": "호스트 식별 정보와 가상화 메타데이터입니다.",
        "hostVirtualizationRole": "가상화 역할",
        "hostVirtualizationSystem": "가상화 시스템",
        "hostOsPlatform": "운영체제 & 플랫폼",
        "hostOsPlatformDescription": "운영체제, 커널, 부팅 정보입니다.",
        "hostOS": "OS",
        "hostBootImage": "부트 이미지",
        "hostBootTime": "부팅 시간",
        "hostKernelCmdLineView": "커널 명령줄 보기",
        "hostResourceUsage": "리소스 사용량",
        "hostResourceUsageDescription": "수집된 CPU, 메모리, 스토리지 사용률입니다.",
        "hostCpuUsage": "CPU 사용률",
        "hostMemoryUsage": "메모리 사용률",
        "hostStorageUsage": "스토리지 사용률",
        "resourceTrendTitlePattern": "리소스 {range} 추이",
        "resourceTrendRange1h": "1시간",
        "resourceTrendRange3h": "3시간",
        "resourceTrendRange6h": "6시간",
        "resourceTrendRange12h": "12시간",
        "resourceTrendCpuUsage": "CPU 사용 현황",
        "resourceTrendMemoryUsage": "메모리 사용 현황",
        "resourceTrendStorageIops": "스토리지 IOPS",
        "resourceTrendNetworkTraffic": "네트워크 트래픽",
        "resourceTrendNetworkDropsErrors": "네트워크 드롭 / 오류",
        "resourceTrendAverage": "평균",
        "resourceTrendMax": "최대",
        "resourceTrendDetailsAria": "상세 통계",
        "resourceTrendRangeAria": "리소스 추이 시간 범위",
        "resourceTrendLoading": "추이 데이터를 조회하는 중입니다.",
        "resourceTrendRefreshing": "추이 데이터를 갱신하는 중입니다.",
        "resourceTrendUnavailable": "Wall Prometheus 추이 데이터를 조회하지 못했습니다.",
        "resourceTrendEmpty": "표시할 리소스 추이 데이터가 없습니다.",
        "resourceTrendSeriesEmpty": "수집된 추이 데이터가 없습니다.",
        "resourceTrendCountUnit": "회",
        "hostNetworkSummary": "네트워크 요약",
        "hostNetworkSummaryDescription": "대표 주소와 인터페이스 수 요약입니다.",
        "hostIpCount": "IP 주소",
        "hostInterfaceCount": "인터페이스",
        "hostMacCount": "MAC 주소",
        "hostNetworkCount": "네트워크",
        "hostRepresentativeIp": "대표 IP",
        "hostMainInterface": "주요 인터페이스",
        "hostNetworkDetailsMissing": "수집된 네트워크 상세 정보가 부족합니다.",
        "hostSocketsProcesses": "소켓 & 프로세스",
        "hostSocketsProcessesDescription": "소켓과 주요 포트 요약입니다.",
        "hostTotalSockets": "전체 소켓 수",
        "hostOpenPorts": "열린 포트 수",
        "hostListenPorts": "수신 포트",
        "hostExternalConnections": "외부 연결",
        "hostNoSocketInfo": "수집된 소켓 정보가 없습니다.",
        "hostMoreSocketInfo": "전체 목록은 소켓 상세에서 확인합니다.",
        "hostSystemTags": "시스템 태그",
        "hostSystemTagsDescription": "수집된 호스트 분류 태그입니다.",
        "hostNoTags": "수집된 태그가 없습니다.",
        "hostRawInfo": "원시 정보 보기",
        "vmBasicInfo": "VM 기본 정보",
        "vmOverviewDescription": "식별 정보, 표시 이름, 실행 상태, 게스트 OS 정보입니다.",
        "vmName": "VM 이름",
        "vmLibvirtName": "Libvirt 이름",
        "vmInstanceName": "인스턴스 이름",
        "vmId": "VM ID",
        "vmType": "VM 유형",
        "vmPrivateIp": "프라이빗 IP",
        "vmPublicIp": "공용 IP",
        "vmCpu": "CPU",
        "vmMemory": "Memory",
        "vmServiceOffering": "서비스 오퍼링",
        "vmResourceUsageDescription": "이 VM에서 수집된 vCPU, 메모리, 스토리지 정보입니다.",
        "vmConnectedResourcesDescription": "이 VM과 연결된 호스트 및 네트워크 토폴로지 객체입니다.",
        "vmNetworkSummaryDescription": "NIC, IP, MAC, Mold 네트워크 정보입니다.",
        "vmMoldContextDescription": "Mold 인벤토리에서 수집한 배치 및 테넌트 메타데이터입니다.",
        "vmNics": "NIC",
        "vmNoNicInfo": "수집된 NIC 정보가 없습니다.",

        "networkLinkLayer": "네트워크 링크 계층",
        "connectionDisplay": "연결 표시",
        "connectionDisplayLayer2Name": "물리 네트워크 계층",
        "connectionDisplayVLayer2Name": "가상 네트워크 계층",
        "connectionDisplayLayer2Description": "스위치와 물리 장비 간 링크를 표시합니다.",
        "connectionDisplayVLayer2Description": "VM, 가상 스위치, 가상 네트워크 링크를 표시합니다.",
        "connectionDisplayPhysicalBadge": "물리",
        "connectionDisplayVirtualBadge": "가상",
        "connectionDisplayServiceName": "서비스",
        "connectionDisplayNodeName": "노드",
        "connectionDisplayDaemonSetName": "데몬셋",
        "connectionDisplayRelatedResourceSummary": "관련 리소스 연결",
        "connectionDisplayPodNodeSummary": "파드/노드 연결",
        "connectionDisplayServiceDescription": "Kubernetes Service와 관련 리소스 간 연결을 표시합니다.",
        "connectionDisplayNodeDescription": "Kubernetes Node와 관련 리소스 간 연결을 표시합니다.",
        "connectionDisplayDaemonSetDescription": "Kubernetes DaemonSet과 Pod/Node 간 연결을 표시합니다.",
        "connectionDisplayGenericLayerNamePattern": "{name} 연결",
        "connectionDisplayAdditionalLayerSummary": "추가 링크 계층",
        "connectionDisplayAdditionalLayerDescription": "수집된 Graph 데이터에서 제공된 추가 링크 계층입니다.",
        "connectionDisplayVisibleLabel": "모든 노드 링크 표시",
        "connectionDisplayRelatedLabel": "선택 노드 관련 링크 표시",
        "connectionDisplayHiddenLabel": "계층 숨김",
        "connectionDisplayVisibleDescription": "모든 노드의 링크를 표시합니다.",
        "connectionDisplayRelatedDescription": "선택한 노드와 직접 연결된 링크만 표시합니다.",
        "connectionDisplayHiddenDescription": "해당 링크 계층을 숨깁니다.",
        "connectionDisplayUsageRelatedTitle": "관련 링크 표시",
        "connectionDisplayUsageRelatedPoint1": "선택한 노드와 연결된 링크만 표시",
        "connectionDisplayUsageRelatedPoint2": "관련 없는 링크를 줄임",
        "connectionDisplayUsageVisibleTitle": "전체 링크 표시",
        "connectionDisplayUsageVisiblePoint1": "전체 네트워크 흐름 확인",
        "connectionDisplayUsageVisiblePoint2": "전체 상태 점검에 유용",
        "connectionDisplayUsageHiddenTitle": "계층 숨김",
        "connectionDisplayUsageHiddenPoint1": "불필요한 계층 숨김",
        "connectionDisplayUsageHiddenPoint2": "토폴로지 노이즈 감소",
        "connectionDisplayUsageToggle": "사용 예시 보기",
        "connectionDisplayVisibleShort": "전체 링크",
        "connectionDisplayRelatedShort": "관련 링크",
        "connectionDisplayHiddenShort": "숨김",
        "connectionDisplayKubernetesDescription": "Kubernetes 리소스 간 연결 표시 방식을 선택합니다.",
        "connectionDisplayInfrastructureDescription": "표시할 연결 계층과 트래픽 범위를 선택합니다.",
        "connectionDisplayRelatedTooltip": "선택한 노드와 직접 연결된 링크만 표시합니다.",
        "connectionDisplayInfoTooltip": "표시할 네트워크 연결 범위와 트래픽 표시 방식을 선택합니다.",
        "connectionDisplayAdditionalHintPattern": "추가 {count}개는 가로로 스크롤해 확인",
        "connectionDisplayRangeTitle": "표시 범위",
        "connectionDisplayCurrentState": "현재 상태",
        "connectionDisplayKubernetesNotice": "수집되는 자원에 따라 추가 링크 계층이 표시될 수 있습니다.",
        "recentViewedNodes": "최근 본 노드",
        "recentViewedNodesEmpty": "클릭한 노드가 여기에 표시됩니다.",
        "recentViewedNodeNotFound": "현재 토폴로지에 존재하지 않는 노드입니다.",
        "expand": "펼치기",
        "collapse": "접기",
        "searchNodeByNameExample": "노드 이름(예: ccvm)으로 검색",
        "searchKubernetesByNameExample": "클러스터, 노드, 파드 이름으로 검색",
        "layerFilter": "레이어 필터",
        "topologyLayer": "토폴로지 레이어",
        "infrastructureLayerSummary": "네트워크 · 호스트 · VM",
        "kubernetesLayerSummary": "클러스터 · 노드 · 파드",
        "close": "닫기",
        "removeFromSelection": "선택 해제",
        "pinNode": "노드 위치로 이동",
        "openConsole": "콘솔 열기",
        "setting": "설정",
        "refresh": "새로고침",
        "loading": "불러오는 중",
        "kubernetesCollection": "Kubernetes 수집",
        "kubernetesCollectionDescription": "Mold에 등록된 클러스터를 자동 표시합니다. Netdive 수집 대상은 여러 개 선택할 수 있습니다.",
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
        "kubernetesManagerTitle": "Kubernetes 토폴로지",
        "kubernetesManagerDescription": "현재 로드된 Kubernetes 토폴로지 리소스 요약입니다.",
        "kubernetesWorkloadTypeFilter": "워크로드 타입",
        "kubernetesWorkloadTypeFilterDescription": "파드는 유지하고 Workload Controller 노드만 필터링합니다.",
        "kubernetesTopologyClusters": "클러스터",
        "kubernetesTopologyNodes": "노드",
        "kubernetesTopologyNamespaces": "네임스페이스",
        "kubernetesTopologyWorkloadControllers": "워크로드 컨트롤러",
        "kubernetesTopologyPods": "파드",
        "kubernetesTopologyServices": "서비스",
        "kubernetesClusterBasicInfo": "클러스터 기본 정보",
        "kubernetesClusterOverview": "클러스터 개요",
        "kubernetesAdvancedInformation": "고급 정보",
        "kubernetesClusterStatus": "클러스터 상태",
        "kubernetesClusterActive": "활성",
        "kubernetesClusterUid": "클러스터 UID",
        "kubernetesVersion": "쿠버네티스 버전",
        "kubernetesApiConnectionStatus": "API 연결 상태",
        "kubernetesNodeOperationalStatus": "노드 운영 상태",
        "kubernetesNodeReady": "Ready",
        "kubernetesNodeNotReady": "NotReady",
        "kubernetesNodeNoCurrentImpact": "현재 워크로드 영향 없음",
        "kubernetesNodeUnavailableConclusion": "이 노드에 배치된 워크로드가 영향을 받을 수 있습니다",
        "kubernetesNodeStatusUnavailable": "노드 상태를 판단할 수집 정보가 부족합니다",
        "kubernetesNodeServiceImpact": "서비스 {count}개 영향",
        "kubernetesPlacedPods": "배치 파드",
        "kubernetesProblemPods": "문제 파드",
        "kubernetesSchedulingShort": "스케줄링",
        "kubernetesAllowed": "허용",
        "kubernetesBlocked": "차단",
        "kubernetesNodeConditions": "노드 상태 조건",
        "kubernetesNodeConditionsUnavailable": "수집된 노드 상태 조건 정보가 없습니다.",
        "kubernetesNoReason": "확인된 사유 없음",
        "kubernetesSchedulingAndTaints": "스케줄링 및 Taints",
        "kubernetesScheduling": "스케줄링 상태",
        "kubernetesSchedulingAllowed": "스케줄링 허용",
        "kubernetesNone": "없음",
        "kubernetesMaxPodCount": "최대 파드 수",
        "kubernetesCurrentPodCount": "현재 파드",
        "kubernetesCapacityAllocatable": "자원 용량 및 사용 가능 자원",
        "kubernetesCapacity": "총 용량",
        "kubernetesPodCapacity": "Pod 수용 한도",
        "kubernetesNodeCapacityUnavailable": "수집된 노드 자원 정보가 없습니다.",
        "kubernetesNodeWorkloads": "노드 워크로드 및 영향",
        "kubernetesNodeResources": "노드 리소스",
        "kubernetesNodeConditionAuxiliary": "노드 운영 정보",
        "kubernetesCurrentMaxPods": "현재 / 최대 파드",
        "kubernetesNodeWorkloadStatus": "워크로드 현황",
        "kubernetesRunningPods": "Running 파드",
        "kubernetesRestartedPods": "재시작 파드",
        "kubernetesImpactedPods": "영향 파드",
        "kubernetesSingleReplicaWorkloads": "단일 Replica 워크로드",
        "kubernetesSingleReplicaWorkloadsDescription": "복제본이 1개뿐인 워크로드입니다. 노드 장애 시 서비스 중단 가능성이 있습니다.",
        "kubernetesLocalStorageWorkloads": "로컬 스토리지 의존 워크로드",
        "kubernetesLocalStorageWorkloadsDescription": "노드 로컬 디스크를 사용하는 워크로드입니다. 다른 노드로 이동 시 데이터 접근에 제약이 있을 수 있습니다.",
        "kubernetesInfrastructureRelationship": "인프라 연결 관계",
        "kubernetesPhysicalHost": "물리 호스트",
        "kubernetesRelationshipConfidence": "관계 신뢰도",
        "kubernetesRelationshipConfirmed": "확인됨",
        "kubernetesRelationshipInferred": "추정됨",
        "kubernetesRelationshipUnknown": "연결 관계 미확인",
        "kubernetesConditionInterpretedStatus": "상태",
        "kubernetesConditionRawValue": "원본",
        "kubernetesNodeRecentEvents": "최근 이벤트",
        "kubernetesNodeNoImportantEvents": "최근 발생한 중요 이벤트가 없습니다.",
        "kubernetesNotCollectedShort": "미수집",
        "kubernetesNodeBasicInfo": "노드 기본 정보",
        "kubernetesNodeName": "노드 이름",
        "kubernetesNodeRoles": "역할",
        "kubernetesKernelVersion": "커널 버전",
        "kubernetesArchitecture": "아키텍처",
        "kubernetesContainerRuntime": "컨테이너 런타임",
        "kubernetesNodeDetailFallback": "실시간 노드 상세 정보를 수집하지 못해 확인 가능한 토폴로지 정보를 표시합니다.",
        "kubernetesNamespaceOperationalStatus": "네임스페이스 운영 상태",
        "kubernetesNamespaceNoCurrentImpact": "현재 워크로드 영향 없음",
        "kubernetesNamespaceStatusUnavailable": "네임스페이스 상태를 판단할 수집 정보가 부족합니다",
        "kubernetesNamespaceTerminatingConclusion": "네임스페이스 삭제가 진행 중입니다",
        "kubernetesNamespaceEndpointImpact": "사용 가능한 Endpoint가 없는 서비스 {count}개",
        "kubernetesNamespaceProblemConclusion": "확인이 필요한 파드 {count}개",
        "kubernetesNamespaceWorkloads": "워크로드 및 리소스",
        "kubernetesNamespaceAvailability": "배치 및 가용성",
        "kubernetesScheduledNodes": "배치 노드",
        "kubernetesEndpointUnavailableServices": "Endpoint 없는 서비스",
        "kubernetesNamespacePlacement": "파드 배치",
        "kubernetesNamespacePlacementConcentratedDescription": "모든 Running Pod가 하나의 노드에 배치되어 있습니다.",
        "kubernetesNamespacePlacementDistributedDescription": "Running Pod가 여러 노드에 분산 배치되어 있습니다.",
        "kubernetesNamespaceResourcePolicy": "자원 Requests 및 Limits",
        "kubernetesNamespaceResourcePolicyEmpty": "이 네임스페이스에는 Resource Requests 및 Limits가 설정되어 있지 않습니다.",
        "kubernetesTopologyFallbackStatus": "토폴로지 기준",
        "kubernetesNamespaceRecentEvents": "최근 이벤트",
        "kubernetesNamespaceNoImportantEvents": "최근 발생한 중요 이벤트가 없습니다.",
        "kubernetesEventOccurrenceCount": "최근 {count}회 발생",
        "kubernetesEventJustNow": "방금 전",
        "kubernetesEventMinutesAgo": "{count}분 전",
        "kubernetesEventHoursAgo": "{count}시간 전",
        "kubernetesEventDaysAgo": "{count}일 전",
        "kubernetesResource": "리소스",
        "kubernetesCpuRequests": "CPU Requests",
        "kubernetesCpuLimits": "CPU Limits",
        "kubernetesMemoryRequests": "메모리 Requests",
        "kubernetesMemoryLimits": "메모리 Limits",
        "kubernetesNamespaceBasicInfo": "네임스페이스 기본 정보",
        "kubernetesNamespaceName": "네임스페이스 이름",
        "kubernetesNamespacePhase": "Phase",
        "kubernetesNamespaceDetailFallback": "실시간 네임스페이스 상세 정보를 수집하지 못해 확인 가능한 토폴로지 정보를 표시합니다.",
        "kubernetesPodOperationalStatus": "파드 운영 상태",
        "kubernetesPodResources": "파드 리소스",
        "kubernetesPodVolumesAndNetwork": "볼륨 및 네트워크",
        "kubernetesPodRecentEvents": "최근 이벤트",
        "kubernetesPodNoCurrentImpact": "모든 컨테이너가 정상 실행 중입니다",
        "kubernetesPodWarningConclusion": "확인이 필요한 컨테이너가 있습니다",
        "kubernetesPodCriticalConclusion": "실패 또는 종료된 컨테이너가 감지되었습니다",
        "kubernetesPodStatusUnavailable": "파드 상태를 판단할 수집 정보가 부족합니다",
        "kubernetesContainers": "컨테이너",
        "kubernetesRestarts": "재시작",
        "kubernetesConnectedServices": "연결 서비스",
        "kubernetesContainerStatus": "컨테이너 상태",
        "kubernetesPodContainersUnavailable": "수집된 컨테이너 상태 정보가 없습니다.",
        "kubernetesResourceConfigurationNone": "자원 Requests 및 Limits 없음",
        "kubernetesConfiguredProbes": "Probe",
        "kubernetesPodConditions": "파드 Condition",
        "kubernetesPodConditionsUnavailable": "수집된 파드 Condition 정보가 없습니다.",
        "kubernetesSchedulingRelationships": "스케줄링 및 연결 관계",
        "kubernetesScheduledNode": "배치 노드",
        "kubernetesOwner": "소유 워크로드",
        "kubernetesSelectedByServices": "연결 서비스",
        "kubernetesStorageAndQos": "스토리지 및 QoS",
        "kubernetesVolumes": "볼륨",
        "kubernetesPodBasicInfo": "파드 기본 정보",
        "kubernetesPodName": "파드 이름",
        "kubernetesStartedAt": "시작 시간",
        "kubernetesPodDetailFallback": "실시간 파드 상세 정보를 수집하지 못해 확인 가능한 토폴로지 정보를 표시합니다.",
        "kubernetesServiceOperationalStatus": "서비스 운영 상태",
        "kubernetesServiceStatusDanger": "위험",
        "kubernetesServiceReadyEndpointsServing": "Ready Endpoint {count}개가 트래픽을 제공 중입니다",
        "kubernetesServiceNoReadyEndpointAvailable": "Ready 상태인 Endpoint가 없습니다",
        "kubernetesServiceNoEndpoints": "서비스에 연결된 Endpoint가 없습니다",
        "kubernetesServicePorts": "서비스 포트",
        "kubernetesAllEndpoints": "전체 Endpoint",
        "kubernetesReadyEndpoints": "Ready Endpoint",
        "kubernetesTargetPods": "대상 파드",
        "kubernetesNodePrefix": "노드 ·",
        "kubernetesAvailabilityWarning": "가용성 주의",
        "kubernetesAvailabilityNormal": "가용성 정상",
        "kubernetesServiceType": "서비스 유형",
        "kubernetesTargetPort": "대상 포트",
        "kubernetesAdditionalItems": "외 {count}개",
        "kubernetesAvailabilitySingleEndpoint": "단일 Endpoint",
        "kubernetesAvailabilitySingleEndpointSummary": "장애 대응 여유 없음",
        "kubernetesAvailabilitySingleEndpointDescription": "노드 장애 시 서비스 연결이 중단될 수 있습니다.",
        "kubernetesAvailabilityDistributionWarning": "분산 주의",
        "kubernetesAvailabilityDistributionWarningSummary": "모든 Ready Endpoint가 단일 노드에 집중",
        "kubernetesEndpointDistributionWarning": "Endpoint 노드 분산 주의",
        "kubernetesEndpointDistributionWarningDescription": "Ready Endpoint {count}개가 단일 노드에 배치되어 있어 노드 장애 시 서비스 연결에 영향을 줄 수 있습니다.",
        "kubernetesAvailabilityDistributed": "분산 정상",
        "kubernetesAvailabilityDistributedSummary": "{count}개 노드에 분산",
        "kubernetesAvailabilityDistributedDescription": "Ready Endpoint가 {count}개 노드에 분산되어 있습니다.",
        "kubernetesServiceEndpointAvailability": "Endpoint 및 가용성",
        "kubernetesServiceAvailabilitySummary": "가용성 요약",
        "kubernetesServicePortsTraffic": "포트 및 트래픽",
        "kubernetesServiceRecentEvents": "최근 이벤트",
        "kubernetesConnectionRelationships": "연결 관계",
        "kubernetesConnectedResourceGroup": "Kubernetes",
        "kubernetesInfrastructureResourceGroup": "인프라 자원",
        "kubernetesServiceEndpointsAvailable": "Ready Endpoint가 트래픽을 제공 중입니다",
        "kubernetesServiceNoReadyEndpoints": "Ready Endpoint가 모두 손실되었습니다",
        "kubernetesServicePartialEndpoints": "확인이 필요한 Endpoint가 있습니다",
        "kubernetesServiceStatusUnavailable": "Endpoint 가용성 정보가 수집되지 않았습니다",
        "kubernetesServiceExternalNameConfigured": "ExternalName 라우팅이 구성되어 있습니다",
        "kubernetesServicePodsReadyInferred": "연결 파드가 Ready입니다 (수집 관계 기준)",
        "kubernetesServicePodsProblemInferred": "확인이 필요한 연결 파드가 있습니다 (수집 관계 기준)",
        "kubernetesPorts": "포트",
        "kubernetesServicePortsAndRouting": "포트 및 라우팅",
        "kubernetesServicePortsUnavailable": "수집된 서비스 포트 정보가 없습니다.",
        "kubernetesPortName": "이름",
        "kubernetesServicePort": "서비스 포트",
        "kubernetesServiceEndpointsUnavailable": "EndpointSlice가 수집되지 않았고 연결 파드도 확인할 수 없습니다.",
        "kubernetesServiceNetworkExposure": "네트워크 노출",
        "kubernetesExternalTrafficPolicy": "외부 트래픽 정책",
        "kubernetesInternalTrafficPolicy": "내부 트래픽 정책",
        "kubernetesSessionAffinity": "세션 어피니티",
        "kubernetesNotApplicable": "해당 없음",
        "kubernetesServiceSelectionAndResilience": "선택 및 복원력",
        "kubernetesRelationshipSource": "관계 확인 소스",
        "kubernetesEndpointData": "Endpoint 데이터",
        "kubernetesCollected": "수집됨",
        "kubernetesEndpointNodeDistribution": "Endpoint 노드 분산",
        "kubernetesSingleNodeConcentration": "모든 Ready Endpoint가 단일 노드에 집중",
        "kubernetesDistributedOrSingleEndpoint": "다중 Endpoint의 단일 노드 집중 없음",
        "kubernetesEvaluationUnavailable": "평가 불가",
        "kubernetesPublishNotReadyAddresses": "NotReady 주소 게시",
        "kubernetesServiceBasicInfo": "서비스 기본 정보",
        "kubernetesServiceName": "서비스 이름",
        "kubernetesServiceDetailFallback": "실시간 EndpointSlice 상세 정보를 수집하지 못해 확인 가능한 서비스 및 수집 관계 정보를 표시합니다.",
        "kubernetesOperationalStatusShort": "운영 상태",
        "kubernetesWorkloadNormalConclusion": "요구된 워크로드 용량이 정상 제공 중입니다",
        "kubernetesWorkloadWarningConclusion": "Replica 또는 파드 가용성 확인이 필요합니다",
        "kubernetesWorkloadFailedConclusion": "실패한 워크로드 실행이 있습니다",
        "kubernetesDesiredReplicas": "목표 복제본",
        "kubernetesAvailableReplicas": "가용 복제본",
        "kubernetesUpdatedReplicas": "업데이트 복제본",
        "kubernetesUnavailableReplicas": "미가용 복제본",
        "kubernetesReadyReplicas": "준비 복제본",
        "kubernetesCurrentReplicas": "현재 복제본",
        "kubernetesDesiredNodes": "Desired 노드",
        "kubernetesReadyNodes": "Ready 노드",
        "kubernetesAvailableNodes": "Available 노드",
        "kubernetesMisscheduledNodes": "비대상 배치",
        "kubernetesCurrentNodes": "Current 노드",
        "kubernetesUpdatedNodes": "Updated 노드",
        "kubernetesUnavailableNodes": "Unavailable 노드",
        "kubernetesParallelism": "병렬 실행 수",
        "kubernetesSchedule": "스케줄",
        "kubernetesSuspend": "일시 중지",
        "kubernetesActiveJobs": "Active Job",
        "kubernetesLastSchedule": "최근 스케줄",
        "kubernetesLastSuccessful": "최근 성공",
        "kubernetesDeploymentStrategy": "배포 전략",
        "kubernetesUpdateStrategy": "업데이트 전략",
        "kubernetesProgress": "롤아웃 상태",
        "kubernetesInProgress": "진행 중",
        "kubernetesStable": "안정",
        "kubernetesRolloutComplete": "롤아웃 완료",
        "kubernetesRolloutInProgress": "롤아웃 진행 중",
        "kubernetesRolloutDelayed": "롤아웃 지연",
        "kubernetesRolloutFailed": "롤아웃 실패",
        "kubernetesRolloutPaused": "롤아웃 일시 중지",
        "kubernetesRevisionStatus": "Revision 상태",
        "kubernetesRevisionSynced": "Revision 동기화 완료",
        "kubernetesRevisionUpdating": "Revision 업데이트 진행 중",
        "kubernetesWorkloadUpdating": "업데이트 중",
        "kubernetesWorkloadCapacityReady": "요구된 워크로드 용량이 정상 제공 중입니다.",
        "kubernetesWorkloadPartialReplicas": "일부 Replica가 아직 준비되지 않았습니다.",
        "kubernetesWorkloadNoAvailableReplicas": "사용 가능한 Replica가 없습니다.",
        "kubernetesWorkloadNoReadyReplicas": "Ready 상태인 Replica가 없습니다.",
        "kubernetesWorkloadRevisionApplying": "새로운 Revision 또는 Replica를 적용 중입니다.",
        "kubernetesCompletionMode": "완료 모드",
        "kubernetesWorkloadConfiguration": "워크로드 구성",
        "kubernetesConnectedPods": "대상 파드",
        "kubernetesNoConnectedPods": "연결된 Pod를 확인할 수 없습니다.",
        "kubernetesSinglePod": "단일 Pod",
        "kubernetesPlacementAndRelations": "배치 및 연결 관계",
        "kubernetesPlacementNodes": "배치 노드",
        "kubernetesPodDistribution": "Pod 분산",
        "kubernetesPodOwners": "파드 Owner",
        "kubernetesWorkloadConditions": "상태 조건",
        "kubernetesNoConditions": "수집된 상태 조건이 없습니다.",
        "kubernetesWorkloadBasicInfo": "워크로드 기본 정보",
        "kubernetesWorkloadType": "유형",
        "kubernetesReplicaRollout": "Replica 및 롤아웃",
        "kubernetesCurrentReplicaSet": "현재 ReplicaSet",
        "kubernetesPreviousReplicaSets": "이전 ReplicaSet",
        "kubernetesPodManagementPolicy": "Pod 관리 정책",
        "kubernetesStartOrdinal": "시작 Ordinal",
        "kubernetesContainersImages": "컨테이너 및 이미지",
        "kubernetesContainerImage": "이미지",
        "kubernetesImageUnavailable": "이미지 정보 없음",
        "kubernetesInformationUnavailable": "정보 없음",
        "kubernetesImagePullPolicy": "이미지 Pull 정책",
        "kubernetesContainerPorts": "컨테이너 포트",
        "kubernetesResourceConfiguration": "리소스 설정",
        "kubernetesConditionStatus": "상태",
        "kubernetesStorageConfiguration": "스토리지 구성",
        "kubernetesPvcTemplate": "PVC Template",
        "kubernetesRequestedCapacity": "요청 용량",
        "kubernetesWorkloadPodsResources": "Pod 및 리소스",
        "kubernetesWorkloadRecentEvents": "최근 이벤트",
        "kubernetesWorkloadName": "워크로드 이름",
        "yes": "예",
        "no": "아니요",
        "kubernetesCreatedAt": "생성 시간",
        "kubernetesClusterResources": "클러스터 리소스",
        "kubernetesClusterResourcesDescription": "넷다이브가 이 클러스터 토폴로지에서 관측한 리소스입니다.",
        "kubernetesClusterNodeDescription": "클러스터 컴퓨트 노드",
        "kubernetesClusterNamespaceDescription": "워크로드 격리 범위",
        "kubernetesClusterPodDescription": "실행 중인 워크로드 단위",
        "kubernetesClusterServiceDescription": "서비스 연결 지점",
        "kubernetesNetdiveObservation": "넷다이브 관측 정보",
        "kubernetesNetdiveObservationDescription": "수집 소스와 토폴로지 갱신 정보입니다.",
        "kubernetesCollector": "수집기",
        "kubernetesTopologyOrigin": "토폴로지 원본",
        "kubernetesTopologyRevision": "토폴로지 리비전",
        "kubernetesMetadata": "쿠버네티스 메타데이터",
        "kubernetesLabels": "레이블",
        "kubernetesAnnotations": "어노테이션",
        "kubernetesNoLabels": "수집된 레이블이 없습니다.",
        "kubernetesNoAnnotations": "수집된 어노테이션이 없습니다.",
        "kubernetesClusterMoldMissing": "현재 Mold 클러스터 인벤토리와 일치하는 항목이 없습니다.",
        "kubernetesClusterHealth": "클러스터 상태 요약",
        "kubernetesClusterHealthDescription": "실시간 Kubernetes 상태와 Mold 인벤토리를 함께 표시합니다.",
        "kubernetesControlPlaneStatus": "Control Plane 상태",
        "kubernetesNodeStatus": "노드 상태",
        "kubernetesPodStatus": "파드 상태",
        "kubernetesAbnormalOverview": "이상 현황",
        "kubernetesStatusDistribution": "상태 분포",
        "kubernetesNoServiceImpact": "영향 없음",
        "kubernetesServiceAffected": "영향",
        "kubernetesDataCollectionStatus": "데이터 수집 상태",
        "kubernetesNoCollectionRecord": "최근 수집 기록 없음",
        "kubernetesLastCollected": "최근 수집 시간",
        "kubernetesResourceStatus": "리소스 현황",
        "kubernetesResourceStatusDescription": "노드, 네임스페이스, 파드, 서비스의 현재 상태입니다.",
        "kubernetesWorkloadScopes": "워크로드 격리 범위",
        "kubernetesServiceEndpoints": "서비스 연결 지점",
        "kubernetesResourceCapacity": "클러스터 자원 현황",
        "kubernetesResourceCapacityDescription": "사용률, Requests, Limits와 할당 가능 여유량입니다.",
        "kubernetesCpuUsage": "CPU 사용률",
        "kubernetesMemoryUsage": "메모리 사용률",
        "kubernetesMetricsUnavailable": "사용률 미수집",
        "kubernetesResourceRequests": "전체 Requests",
        "kubernetesResourceLimits": "전체 Limits",
        "kubernetesResourceHeadroom": "Requests 기준 여유량",
        "kubernetesMoldProvisioned": "Mold 프로비저닝 자원",
        "kubernetesMajorRisks": "운영 경보 및 인프라 위험",
        "kubernetesRiskResilience": "위험 및 복원력",
        "kubernetesControlPlaneResilience": "Control Plane 복원력",
        "kubernetesSingleConfiguration": "단일 구성",
        "kubernetesMultipleConfiguration": "다중 구성",
        "kubernetesRiskNotReadyNodes": "NotReady 노드",
        "kubernetesRiskNotReadyNodesDescription": "Ready 상태가 아닌 노드가 있습니다.",
        "kubernetesRiskFailedPods": "Failed 파드",
        "kubernetesRiskFailedPodsDescription": "실패 상태의 파드가 있습니다.",
        "kubernetesRiskPendingPods": "Pending 파드",
        "kubernetesRiskPendingPodsDescription": "스케줄링 또는 시작을 기다리는 파드가 있습니다.",
        "kubernetesAffectedServices": "영향받는 서비스",
        "kubernetesAffectedServicesDescription": "장애 노드 또는 파드가 서비스에 영향을 줍니다.",
        "kubernetesNoMajorRisks": "감지된 주요 위험이 없습니다.",
        "kubernetesNetdiveImpact": "Netdive 영향도 분석",
        "kubernetesNetdiveImpactDescription": "Kubernetes 리소스를 물리 호스트 및 네트워크 경로와 연계해 분석합니다.",
        "kubernetesPhysicalHostConcentration": "물리 호스트 집중도",
        "kubernetesSwitchConcentration": "동일 스위치 집중도",
        "kubernetesExternalPaths": "클러스터 외부 연결 경로",
        "kubernetesClusterImpact": "클러스터 전체 영향도",
        "kubernetesPlacementUnknown": "매핑 미확인",
        "kubernetesRecentChanges": "최근 상태 변화",
        "kubernetesRecentChangesViewAll": "전체 보기",
        "kubernetesRecentChangesAllTitle": "최근 상태 변화 전체 보기",
        "kubernetesNoRecentChanges": "최근 24시간 동안 감지된 상태 변화가 없습니다.",
        "kubernetesZone": "Mold 존",
        "kubernetesNetwork": "Mold 네트워크",
        "kubernetesServiceOffering": "서비스 오퍼링",
        "kubernetesSummaryFallback": "일부 실시간 메트릭을 수집할 수 없어 현재 확인 가능한 토폴로지 및 Mold 인벤토리 정보를 기준으로 표시합니다.",
        "kubernetesOperationalStatus": "클러스터 운영 상태",
        "kubernetesStatus": "Kubernetes 상태",
        "kubernetesHealthNormal": "정상",
        "kubernetesHealthWarning": "주의",
        "kubernetesHealthCritical": "심각",
        "kubernetesHealthUnknown": "확인 불가",
        "kubernetesMetricsCollection": "메트릭 수집",
        "kubernetesMetricsNormal": "정상",
        "kubernetesMetricsNormalDescription": "CPU·메모리 메트릭을 정상적으로 수집하고 있습니다.",
        "kubernetesMetricsPreparing": "수집 준비 중",
        "kubernetesMetricsPreparingDescription": "클러스터 자원 메트릭 수집을 준비하고 있습니다.",
        "kubernetesMetricsApiUnavailable": "API 접근 불가",
        "kubernetesMetricsApiUnavailableDescription": "Prometheus 연동 또는 Federation 상태를 확인해 주세요.",
        "kubernetesMetricsNotConfigured": "메트릭 연동 미설정",
        "kubernetesMetricsNotConfiguredDescription": "메트릭 연동이 설정되지 않았거나 metrics-server 데이터를 사용할 수 없습니다.",
        "kubernetesMetricsCannotCollect": "클러스터 자원 메트릭을 수집할 수 없습니다.",
        "kubernetesCollectedJustNow": "방금 전",
        "kubernetesMinutesAgo": "분 전",
        "kubernetesHoursAgo": "시간 전",
        "kubernetesOperationalHealthyDescription": "Control Plane {control}대와 Worker Node {worker}대가 모두 정상이며, 실행 실패 또는 대기 중인 파드가 없습니다.",
        "kubernetesOperationalUnknownDescription": "현재 Kubernetes 운영 상태를 판단하기 위한 수집 데이터가 충분하지 않습니다.",
        "kubernetesWorkerNode": "Worker Node",
        "kubernetesUnitNode": "대",
        "kubernetesUnitItem": "개",
        "kubernetesDetectedSuffix": " 상태가 감지되었습니다.",
        "kubernetesServiceImpactSentence": "서비스 {count}개가 영향을 받을 수 있습니다.",
        "kubernetesRiskAvailability": "가용성",
        "kubernetesRiskWorkload": "워크로드",
        "kubernetesRiskResource": "자원",
        "kubernetesRiskNetwork": "네트워크",
        "kubernetesRiskStorage": "스토리지",
        "kubernetesRiskInfrastructure": "인프라",
        "kubernetesRiskChecksDescription": "노드 상태, 파드 실패, 자원 부족, 서비스 Endpoint, 물리 호스트 및 네트워크 경로 집중도를 확인했습니다.",
        "kubernetesHostConcentrationRisk": "물리 호스트 집중",
        "kubernetesHostConcentrationRiskDescription": "확인된 모든 Kubernetes 노드가 하나의 물리 호스트에 집중되어 있습니다.",
        "kubernetesSwitchConcentrationRisk": "네트워크 경로 집중",
        "kubernetesSwitchConcentrationRiskDescription": "확인된 모든 Kubernetes 노드가 동일 스위치 경로에 집중되어 있습니다.",
        "kubernetesCurrentAffectedServices": "현재 영향받는 서비스",
        "kubernetesPhysicalHostDistribution": "물리 호스트 분산 상태",
        "kubernetesNetworkPathDistribution": "네트워크 경로 분산 상태",
        "kubernetesDistributionGood": "양호",
        "kubernetesDistributionCaution": "주의",
        "kubernetesKnownHostBasis": "확인된 물리 호스트 기준으로 ",
        "kubernetesKnownNetworkBasis": "확인된 네트워크 경로 기준으로 ",
        "kubernetesHostDistributionGoodDescription": "Kubernetes 노드 {nodes}개가 서로 다른 물리 호스트 {targets}개에 분산되어 있습니다.",
        "kubernetesHostDistributionCautionDescription": "Kubernetes 노드의 {percent}%가 하나의 물리 호스트에 집중되어 있습니다.",
        "kubernetesNetworkDistributionGoodDescription": "Kubernetes 노드 {nodes}개가 서로 다른 스위치 경로 {targets}개에 분산되어 있습니다.",
        "kubernetesNetworkDistributionCautionDescription": "Kubernetes 노드의 {percent}%가 동일 스위치 경로에 연결되어 있습니다.",
        "kubernetesHostPlacementUnknown": "수집된 물리 호스트 매핑 정보가 없습니다.",
        "kubernetesNetworkPlacementUnknown": "수집된 네트워크 경로 매핑 정보가 없습니다.",
        "kubernetesImpactDetected": "영향 감지",
        "kubernetesImpactNone": "현재 영향 없음",
        "kubernetesAffectedServiceDetectedDescription": "노드 또는 파드 장애로 현재 서비스 {count}개가 영향을 받을 수 있습니다.",
        "kubernetesAffectedServiceNormalDescription": "노드 또는 파드 장애로 현재 영향을 받는 것으로 확인된 서비스가 없습니다.",
        "kubernetesExternalPathUnknownDescription": "현재 수집 데이터에서 외부 연결 경로를 확인할 수 없습니다.",
        "kubernetesExternalPathSingleDescription": "확인된 외부 연결 경로가 하나뿐입니다.",
        "kubernetesExternalPathMultipleDescription": "외부 연결 경로 {count}개가 확인되었습니다.",
        "kubernetesExternalPathNoneDescription": "외부에 노출된 연결 경로가 확인되지 않았습니다.",
        "kubernetesCurrentFailureImpact": "현재 장애 영향도",
        "kubernetesPotentialInfrastructureRisk": "구조적 위험도",
        "kubernetesCurrentFailureImpactTooltip": "NotReady 노드, 비정상 파드, 현재 영향받는 서비스를 기준으로 계산합니다.",
        "kubernetesPotentialInfrastructureRiskTooltip": "운영 상태와 분리하여 평가된 물리 호스트 집중, 스위치 경로 집중, 단일 Control Plane, 단일 외부 연결 경로만으로 계산합니다.",
        "kubernetesImpactLow": "낮음",
        "kubernetesImpactCaution": "주의",
        "kubernetesImpactHigh": "높음",
        "kubernetesImpactCritical": "심각",
        "kubernetesFocusNodes": "이 클러스터의 노드만 토폴로지에 표시",
        "kubernetesFocusNamespaces": "이 클러스터의 네임스페이스만 토폴로지에 표시",
        "kubernetesFocusPods": "이 클러스터의 파드만 토폴로지에 표시",
        "kubernetesFocusServices": "이 클러스터의 서비스 목록 열기",
        "kubernetesCurrentUsage": "현재 사용량",
        "kubernetesUsageRate": "사용률",
        "kubernetesAllocatableLabel": "사용 가능 자원",
        "kubernetesRequestRate": "예약률",
        "kubernetesReservationRateDescription": "예약률 = Requests / Kubernetes 사용 가능 자원입니다. 실시간 사용률이 아닙니다.",
        "kubernetesReservable": "예약 가능량",
        "kubernetesMemory": "메모리",
        "kubernetesMoldVmAllocation": "Mold VM 리소스",
        "kubernetesAllocatableCapacity": "Kubernetes 사용 가능 자원",
        "kubernetesCurrentUsageDescription": "Metrics Server 기준의 현재 CPU/메모리 사용량입니다.",
        "kubernetesAllocatableDescription": "Kubernetes Allocatable 값입니다. 노드 전체 자원에서 운영체제와 Kubernetes 시스템 예약분을 제외하고 Pod가 사용할 수 있는 자원입니다.",
        "kubernetesRequestDescription": "설정된 Requests 합계입니다. 값이 설정된 컨테이너만 합산하며 미설정 컨테이너는 포함하지 않습니다.\n\n현재 사용량(Current)과는 다른 값입니다.",
        "kubernetesLimitDescription": "설정된 Limits 합계입니다. 값이 설정된 컨테이너만 합산하며 미설정 컨테이너는 포함하지 않습니다.\n\n따라서 Limits가 Requests보다 작게 표시될 수 있으며, 이는 데이터 오류가 아니라 Kubernetes의 정상적인 동작입니다.",
        "kubernetesReservableDescription": "Allocatable에서 Requests를 뺀 값입니다. 새로운 Pod가 Request로 예약할 수 있는 남은 자원이며, 현재 사용량 기준 값은 아닙니다.",
        "kubernetesCpuUnitDescription": "1 Core = 1000m",
        "kubernetesMemoryUnitDescription": "메모리 값은 GiB로 통일하여 표시하며 Kubernetes 원본 단위는 Tooltip에서 확인할 수 있습니다.",
        "kubernetesCpuReservationRate": "CPU 예약률",
        "kubernetesMemoryReservationRate": "메모리 예약률",
        "kubernetesDisplayedValue": "표시 값",
        "kubernetesOriginalValue": "원본 값",
        "kubernetesMoldVmAllocationDescription": "Mold에서 Kubernetes 클러스터 VM에 할당한 총 vCPU와 메모리입니다.",
        "kubernetesAllocatableCapacityDescription": "Kubernetes가 Pod에 실제로 제공할 수 있는 전체 자원입니다.",
        "kubernetesGroupedEvents": "{count}개 이벤트",
        "kubernetesAdditionalEvents": "+{count}개",
        "kubernetesRelatedEvents": "관련 이벤트 {count}개",
        "kubernetesCollapseEvents": "접기",
        "kubernetesEventInfo": "정보",
        "kubernetesUnknown": "확인 불가",
        "kubernetesNotCollected": "수집되지 않음",
        "kubernetesNoConnectionInfo": "연결 정보 없음",
        "kubernetesMoldDeploymentStatus": "Mold 배포 상태",
        "kubernetesSummaryFallbackDetail": "CPU·메모리 사용률과 최근 수집 시각은 표시되지 않을 수 있습니다.",
        "kubernetesSingleHost": "단일 호스트",
        "kubernetesSingleSwitch": "단일 스위치",
        "kubernetesRiskReview": "확인",
        "kubernetesHeroControlPlaneFailure": "Control Plane {count}대 장애",
        "kubernetesHeroWorkerFailure": "Worker Node {count}대 장애",
        "kubernetesHeroPodFailure": "Failed 파드 {count}개",
        "kubernetesHeroServiceImpact": "서비스 {count}개 영향",
        "kubernetesHeroNetworkConcentration": "네트워크 경로 집중",
        "kubernetesHeroHostConcentration": "물리 호스트 집중",
        "kubernetesHeroPendingPods": "Pending 파드 {count}개",
        "kubernetesHeroNoImpact": "현재 영향 없음",
        "kubernetesAffectedServiceKpi": "영향받은 서비스",
        "kubernetesPotentialRiskKpi": "잠재 위험",
        "kubernetesCurrentState": "현재 상태",
        "kubernetesPlacementRisk": "배치 위험",
        "kubernetesHostDistributionShort": "호스트 분산",
        "kubernetesNetworkPathShort": "네트워크 경로",
        "kubernetesConcentrated": "집중",
        "kubernetesDistributed": "분산",
        "kubernetesCurrentAlerts": "현재 경보",
        "kubernetesNoCurrentAlerts": "현재 감지된 운영 경보 없음",
        "kubernetesPotentialRisks": "잠재 위험",
        "kubernetesNoPotentialRisks": "평가 가능한 잠재 위험이 감지되지 않음",
        "kubernetesResilienceGood": "양호",
        "kubernetesResilienceRecommended": "보완 권장",
        "kubernetesResilienceVulnerable": "취약",
        "kubernetesResilienceVeryVulnerable": "매우 취약",
        "kubernetesResilienceUnavailable": "평가 불가",
        "kubernetesSingleControlPlaneRisk": "단일 Control Plane 구성",
        "kubernetesSingleControlPlaneRiskDescription": "확인된 Control Plane 노드가 1대뿐입니다.",
        "kubernetesSingleExternalPathRisk": "단일 외부 연결 경로",
        "kubernetesSingleExternalPathRiskDescription": "현재 확인된 외부 연결 경로가 하나뿐입니다.",
        "kubernetesSinglePath": "단일 경로",
        "kubernetesMultiplePaths": "다중 경로",
        "kubernetesNoExternalExposure": "외부 노출 없음",
        "kubernetesAnalysisConfidence": "분석 신뢰도",
        "kubernetesConfidenceLimited": "제한적",
        "kubernetesConfidenceSufficient": "충분",
        "kubernetesConfidenceLimitedDescription": "전체 물리 호스트 또는 네트워크 이중화 경로가 수집되지 않았을 수 있습니다.",
        "kubernetesConfidencePartial": "부분적",
        "kubernetesConfidenceInsufficient": "부족",
        "kubernetesConfidenceUnavailable": "판단 불가",
        "kubernetesConfidenceSufficientSummary": "필수 데이터 수집 완료",
        "kubernetesConfidencePartialSummary": "일부 필수 데이터 누락",
        "kubernetesConfidenceInsufficientSummary": "주요 필수 데이터 누락",
        "kubernetesConfidenceUnavailableSummary": "수집 상태 확인 불가",
        "kubernetesConfidenceDefinition": "현재 위험 및 복원력 결과를 산출하는 데 필요한 상태, 배치, 연결 관계 데이터의 수집 충족도를 나타냅니다.",
        "kubernetesConfidenceSufficientDescription": "분석에 필요한 필수 데이터가 모두 수집되었습니다.",
        "kubernetesConfidencePartialDescription": "일부 필수 데이터가 누락되어 일부 분석 결과가 제한될 수 있습니다.",
        "kubernetesConfidenceInsufficientDescription": "여러 필수 데이터가 누락되어 분석 결과의 신뢰도가 낮습니다.",
        "kubernetesConfidenceUnavailableDescription": "데이터 수집 상태를 확인할 수 없습니다.",
        "kubernetesConfidenceCurrent": "현재 분석 신뢰도: {state}",
        "kubernetesConfidenceCollectedData": "수집됨",
        "kubernetesConfidenceMissingData": "누락",
        "kubernetesConfidenceNoMissingData": "누락된 필수 데이터 없음",
        "kubernetesConfidenceDataNodeReady": "노드 상태 및 Ready 여부",
        "kubernetesConfidenceDataControlPlane": "Control Plane 구성 및 정상 상태",
        "kubernetesConfidenceDataPodStatus": "파드 및 문제 파드 상태",
        "kubernetesConfidenceDataAffectedServices": "영향받는 서비스",
        "kubernetesConfidenceDataHostDistribution": "호스트 분산 정보",
        "kubernetesConfidenceDataNetworkPath": "네트워크 경로 정보",
        "kubernetesConfidenceDataExternalPath": "외부 연결 경로",
        "kubernetesConfidenceDataNetworkUnavailable": "NetworkUnavailable 상태",
        "kubernetesConfidenceDataMemoryPressure": "MemoryPressure 상태",
        "kubernetesConfidenceDataDiskPressure": "DiskPressure 상태",
        "kubernetesConfidenceDataPidPressure": "PIDPressure 상태",
        "kubernetesConfidenceDataPodCapacity": "현재 파드 및 최대 파드 수",
        "kubernetesConfidenceDataSingleReplica": "단일 Replica 워크로드",
        "kubernetesConfidenceDataLocalStorage": "로컬 스토리지 의존 워크로드",
        "kubernetesConfidenceDataMoldVm": "Mold VM 연결 정보",
        "kubernetesConfidenceDataPhysicalHost": "물리 호스트 연결 정보",
        "kubernetesNodeSelectorSearchPlaceholder": "노드명 또는 클러스터명 검색",
        "kubernetesNodeSelectorHighlightAll": "전체 노드 강조",
        "kubernetesNodeSelectorEmpty": "이 호스트와 연결된 Kubernetes 노드가 없습니다.",
        "kubernetesNodeSelectorNoResults": "검색 결과가 없습니다.",
        "kubernetesNodeSelectorMoreSuffix": "개 더",
        "kubernetesNodeSelectorClusterCountLabel": "전체 클러스터",
        "kubernetesNodeSelectorNodeCountLabel": "노드",
        "kubernetesNodeSelectorClusterLabel": "클러스터",
        "kubernetesNodeSelectorNodeLabel": "노드",
        "kubernetesNodeSelectorExpandAll": "전체 펼치기",
        "kubernetesNodeSelectorCollapseAll": "전체 접기",
        "kubernetesNodeSelectorExpandAllClusters": "전체 클러스터 펼치기",
        "kubernetesNodeSelectorCollapseAllClusters": "전체 클러스터 접기",
        "kubernetesNodeSelectorTopologyHighlight": "토폴로지에서 강조",
        "kubernetesNodeExplorerTitle": "Kubernetes 노드 탐색",
        "kubernetesNodeExplorerDescriptionPattern": "이 호스트({host})에 배치된 Kubernetes 노드 목록입니다.",
        "kubernetesNodeSelectorWorkerNodePattern": "Worker 노드 {count}",
        "kubernetesNodeSelectorControlPlaneNodePattern": "Control Plane 노드 {count}",
        "kubernetesNodeSelectorRoleNodePattern": "{role} 노드 {count}",
        "kubernetesNodeSelectorControlPlaneWorkerPattern": "Control Plane {controlPlane} · Worker {worker}",
        "kubernetesNodeSelectorCountSuffix": "개",
        "kubernetesNodeSelectorRemainingPrefix": "외",
        "kubernetesNodeSelectorRemainingSuffix": "개 노드",
        "move": "이동",
        "filter": "필터",
        "role": "역할",
        "status": "상태",
        "kubernetesTotalClusters": "전체 클러스터",
        "kubernetesCollectionManagementSection": "Kubernetes 수집 관리",
        "kubernetesClusterList": "클러스터 목록",
        "kubernetesClusterListDescription": "Kubernetes 연결 테스트와 Netdive 수집 상태를 확인합니다.",
        "kubernetesAutoCollectionStarting": "Mold에서 새로 발견한 클러스터의 수집을 자동으로 시작하는 중입니다...",
        "kubernetesAutoCollectionStarted": "Mold에서 새로 발견한 클러스터의 수집을 자동으로 시작했습니다.",
        "kubernetesAutoCollectionFailed": "Mold에서 새로 발견한 클러스터의 수집을 자동으로 시작하지 못했습니다.",
        "kubernetesCollectionPolicy": "수집 정책",
        "kubernetesCollectionPolicyDescription": "Netdive가 Kubernetes 토폴로지 구성을 위해 수집하는 리소스 범위입니다.",
        "kubernetesCollectionPolicyNotice": "secret, configmap은 민감정보와 설정 데이터 노출을 줄이기 위해 기본 제외됩니다.",
        "kubernetesTestAll": "전체 연결 테스트",
        "kubernetesTestAllRunning": "전체 연결 테스트 중...",
        "kubernetesTestAllSuccess": "모든 Kubernetes 연결 테스트에 성공했습니다.",
        "kubernetesTestAllFailed": "일부 Kubernetes 연결 테스트에 실패했습니다.",
        "kubernetesTestAllFailedSuffix": "개 연결 테스트 실패",
        "kubernetesClusterName": "클러스터 이름",
        "kubernetesMoldClusterId": "Mold 클러스터 ID",
        "kubernetesApiServer": "API Server",
        "kubernetesLastConnectionTest": "마지막 연결 테스트",
        "kubernetesLastCollectionStatus": "마지막 수집 상태",
        "kubernetesActions": "작업",
        "kubernetesEnableConfirmTitle": "수집 활성화 확인",
        "kubernetesEnableConfirmDescription": "수집을 활성화하면 kubeconfig가 생성되고 Netdive K8s probe가 시작됩니다.",
        "kubernetesDisableConfirmTitle": "수집 중지 확인",
        "kubernetesDisableConfirmDescription": "이 Kubernetes 클러스터를 Netdive 토폴로지 수집 대상에서 제외합니다.",
        "kubernetesStepKubeconfig": "kubeconfig 준비 중",
        "kubernetesStepConnection": "연결 확인 중",
        "kubernetesNoTestResult": "연결 테스트를 실행하면 항목별 결과가 표시됩니다.",
        "kubernetesDefaultEnabledProbes": "기본 수집 대상",
        "kubernetesDefaultEnabledProbesDescription": "토폴로지 구성에 필요한 Kubernetes 리소스입니다.",
        "kubernetesDefaultDisabledProbes": "기본 제외 대상",
        "kubernetesDefaultDisabledProbesDescription": "민감정보 또는 설정 데이터 노출 가능성이 있어 기본 제외됩니다.",
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
        "testing": "확인 중",
        "waiting": "대기 중",
        "kubernetesTestDescription": "Kubernetes API 연결과 기본 조회 권한을 확인합니다.",
        "kubernetesAllTestsPassed": "모든 테스트 통과",
        "kubernetesCheckedCountSuffix": "확인 완료",
        "kubernetesFailedCountSuffix": "개 항목 실패",
        "collectionSection": "수집",
        "viewSettingsSection": "보기 설정",
        "helpSection": "도움말",
        "infrastructureMenu": "인프라스트럭처",
        "infrastructureMenuSummary": "스위치 · 호스트 · VM",
        "infrastructurePanelTitle": "인프라스트럭처 토폴로지",
        "infrastructurePanelDescription": "현재 로드된 호스트, 네트워크, VM 토폴로지 요약입니다.",
        "infrastructureHosts": "호스트",
        "infrastructureUserVMs": "사용자 VM",
        "infrastructureSystemVMs": "시스템 VM",
        "infrastructureNetworkLinks": "네트워크 링크",
        "infrastructureOverview": "토폴로지 개요",
        "infrastructureOverviewDescription": "현재 Netdive graph 기준으로 집계합니다.",
        "infrastructureNetworkObjects": "네트워크 객체",
        "infrastructureNetworkObjectsDescription": "브리지, 네트워크, 인터페이스 객체",
        "infrastructureRouters": "가상 라우터",
        "infrastructureRoutersDescription": "네트워크 경로를 담당하는 시스템 VM",
        "infrastructureUserVMsDescription": "사용자 워크로드 VM",
        "infrastructureSystemVMsDescription": "인프라 운영용 시스템 VM",
        "infrastructureTotalNodes": "전체 인프라 노드",
        "infrastructureTotalNodesDescription": "현재 표시 가능한 전체 인프라 노드",
        "infrastructureShowAll": "전체 보기",
        "infrastructureShowAllDescription": "토폴로지 강조를 해제하고 전체 인프라 노드를 표시합니다.",
        "infrastructureViewAll": "전체 기준",
        "infrastructureViewHosts": "호스트별",
        "infrastructureNoHosts": "수집된 호스트 정보가 없습니다.",
        "all": "전체",
        "kubernetesCollectionMenu": "Kubernetes",
        "kubernetesMenuSummary": "클러스터 · 노드 · 파드",
        "clusterCountPrefix": "클러스터",
        "clusterCountSuffix": "개",
        "screenConfig": "화면 구성",
        "screenConfigDescription": "토폴로지 표시 옵션을 관리합니다.",
        "screenConfigComingSoon": "준비 중",
        "preferences": "환경 설정",
        "preferencesDescription": "서비스 환경을 사용자에 맞게 설정합니다.",
        "language": "언어",
        "initialTopologyLayer": "기본 토폴로지",
        "initialTopologyLayerDescription": "※ 변경 사항은 다음 접속 또는 새로고침 후 적용됩니다.",
        "restoreDefaults": "기본값",
        "showInfrastructureLayer": "인프라스트럭처 레이어 표시",
        "showKubernetesLayer": "Kubernetes 레이어 표시",
        "showNetworkLinkLayer": "네트워크 링크 계층 표시",
        "showTrafficLabels": "트래픽 라벨 표시",
        "nodeLabelDisplayMode": "노드 라벨 표시 방식",
        "showGroupNodes": "그룹 노드 표시",
        "helpPanelDescription": "Netdive 토폴로지 화면 안내입니다.",
        "aboutPanelDescription": "인프라스트럭처와 Kubernetes 토폴로지를 시각화합니다.",
        "version": "버전",
        "productFamily": "제품군",
        "vendor": "제공사",
        "documentation": "문서 보기",
        "kubernetesCheck-kubeconfig": "kubeconfig 생성/읽기",
        "kubernetesCheck-apiserver": "API Server 접근",
        "kubernetesCheck-client": "Kubernetes client 확인",
        "kubernetesClientCreated": "Kubernetes client를 생성했습니다.",
        "kubernetesCheck-version": "/version 호출",
        "kubernetesCheck-namespaces": "namespace 목록 조회",
        "kubernetesCheck-nodes": "node 목록 조회",
        "kubernetesCheck-pods": "pod 목록 조회",
        "kubernetesCheck-services": "service 목록 조회",
        "kubernetesCheck-networkpolicies": "networkpolicy 목록 조회",

        "help": "도움말",
        "helpSection-menu": "메뉴",
        "helpSection-toolbar": "툴바",
        "helpSection-topology": "토폴로지",
        "helpMenuTitle": "좌측 메뉴",
        "helpMenuDescription": "좌측 메뉴는 수집, 보기 설정, 환경 설정, 도움말 기능으로 진입하는 영역입니다.",
        "helpMenuPointCollection": "인프라스트럭처는 기본 호스트, 네트워크, VM 토폴로지 화면으로 돌아갑니다.",
        "helpMenuPointKubernetes": "Kubernetes는 클러스터 수집 관리, 연결 테스트, 수집 정책을 제공합니다.",
        "helpMenuPointView": "Kubernetes는 수집 관리를 열고, 화면 구성과 환경 설정은 표시 옵션을 관리합니다.",
        "helpMenuPointPreferences": "환경 설정에서는 언어와 화면 테마를 관리합니다.",
        "helpMenuPointHelp": "Help와 About은 토폴로지 화면을 떠나지 않고 사이드 패널로 열립니다.",
        "helpToolbarTitle": "상단 툴바",
        "helpToolbarDescription": "상단 툴바는 토폴로지를 탐색할 때 자주 쓰는 빠른 동작을 제공합니다.",
        "helpToolbarPointLogo": "로고 영역은 Netdive 화면과 현재 작업 컨텍스트를 식별합니다.",
        "helpToolbarPointSearch": "호스트, VM, 인터페이스, Kubernetes 객체, 표시 이름을 검색합니다.",
        "helpToolbarPointExpand": "펼치기/접기 버튼으로 토폴로지 노드를 빠르게 열거나 그룹화합니다.",
        "helpToolbarPointStatus": "연결 상태와 알림 아이콘으로 현재 UI/세션 상태를 확인합니다.",
        "helpToolbarPointDrawer": "메뉴 버튼은 현재 토폴로지를 유지한 채 좌측 탐색 패널을 엽니다.",
        "helpTopologyTitle": "토폴로지 캔버스",
        "helpTopologyDescription": "캔버스는 인프라스트럭처와 Kubernetes 관계를 계층형으로 시각화합니다.",
        "helpTopologyPointLayers": "좌측 계층 라벨에서 노드가 호스트, NIC, 브리지, VM, Kubernetes 중 어디에 속하는지 확인합니다.",
        "helpTopologyPointNode": "노드를 선택하면 라벨이 앞으로 올라오고 우측 상세 패널에서 정보를 확인합니다.",
        "helpTopologyPointLink": "링크는 소유 관계, 네트워크 연결, 트래픽 흐름을 원본 그래프 변경 없이 표현합니다.",
        "helpTopologyPointDetail": "우측 상세 패널은 선택한 노드의 속성, 테이블, 사용 가능한 기능을 표시합니다.",
        "helpKubernetesTitle": "Kubernetes 수집",
        "helpKubernetesDescription": "Mold에 등록된 Kubernetes 클러스터를 표시하고 수집된 Kubernetes 리소스를 토폴로지에 반영합니다.",
        "helpKubernetesPointCollection": "좌측 Kubernetes 메뉴에서 수집 활성화, 새로고침, 연결 테스트를 실행합니다.",
        "helpKubernetesPointTopology": "Kubernetes 토폴로지는 클러스터, 노드, 네임스페이스, 워크로드 컨트롤러, 파드와 스토리지 자원만 표시합니다.",
        "helpKubernetesPointPolicy": "수집 정책에서 기본 수집 대상과 secret/configmap 같은 기본 제외 대상을 확인합니다.",
        "helpViewTitle": "보기와 표시 옵션",
        "helpViewDescription": "큰 환경에서도 토폴로지를 읽기 쉽게 보도록 표시 옵션을 조정합니다.",
        "helpViewPointLayerFilter": "필요한 대상에 따라 인프라스트럭처, Kubernetes, 네트워크 링크 계층을 확인합니다.",
        "helpViewPointTraffic": "트래픽 라벨은 그래프 데이터를 바꾸지 않고 활성 링크를 파악하는 데 사용합니다.",
        "helpViewPointTheme": "언어와 화면 테마는 환경 설정에서 관리합니다.",
        "helpDocsTitle": "자세한 안내가 필요하신가요?",
        "helpDocsDescription": "설치와 운영 상세 내용은 온라인 가이드에서 확인합니다.",
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
        "capture-target-k8s-node": "쿠버네티스 노드",
        "capture-target-k8s-pod": "쿠버네티스 파드",
        "capture-target-k8s-service": "쿠버네티스 서비스",
        "capture-target-k8s-namespace": "쿠버네티스 네임스페이스",
        "capture-target-k8s-daemonset": "쿠버네티스 데몬셋",
        "capture-target-k8s-deployment": "쿠버네티스 디플로이먼트",
        "capture-target-k8s-cluster": "쿠버네티스 클러스터",
        "capture-target-k8s-resource": "쿠버네티스 리소스",
        "capture-target-policy-title": "계층별 캡처 정책 보기",
        "capture-target-policy-direct": "직접 캡처 가능",
        "capture-target-policy-unavailable": "직접 캡처 불가",
        "capture-target-policy-capturable-layers": "NIC / 본딩 인터페이스 / 호스트 브릿지",
        "capture-target-policy-logical-layers": "호스트 / 스위치 / 사용자 가상머신 / 시스템 가상머신",
        "capture-target-policy-k8s-layers": "쿠버네티스 노드 / 네임스페이스 / 파드",
        "capture-target-policy-k8s-logical-targets": "쿠버네티스 서비스 / 네임스페이스 / 데몬셋",
        "capture-target-policy-infra-desc": "캡처 가능한 TID와 캡처 타입이 있는 인프라 계층 객체에서 실행합니다.",
        "capture-target-policy-logical-desc": "논리/상위 계층 객체이므로 관련 NIC, 본딩 인터페이스, 호스트 브릿지에서 캡처합니다.",
        "capture-target-policy-k8s-desc": "쿠버네티스 계층은 관련 인프라 캡처 대상을 선택해 실행합니다.",
        "capture-target-policy-k8s-logical-desc": "관련 파드, 노드, 인프라 객체를 먼저 확인합니다.",

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
        "capture-rawPacketLimit-explained": "PCAP 다운로드를 위해 각 통신 흐름(flow)마다 저장할 원시 패킷 수를 제한합니다. 0~10 사이로 설정할 수 있으며, 0은 원시 패킷을 저장하지 않습니다.",
        "capture-headerSize-tooltip": "캡처할 패킷의 앞부분(헤더)을 얼마나 포함할지 바이트 단위로 설정합니다.",
        "capture-headerSize-explained": "헤더는 패킷의 출발지/목적지 정보, 프로토콜 정보 등이 담긴 부분입니다. 이 옵션은 분석을 위해 얼마만큼 캡처할지 바이트 단위로 지정합니다. 비워두면 기본값이 적용됩니다.",
        "capture-type-pcap": "기본적인 캡처 방식으로, 대부분 환경에서 동작하며 설정이 간단합니다.",
        "capture-type-afpacket": "리눅스 전용 고속 캡처 방식으로, PCAP보다 성능이 조금 더 좋지만 설정이 까다로울 수 있습니다.",
        "capture-type-ebpf": "커널 수준에서 동작하는 고성능 캡처 방식으로, 시스템 부하가 적고 최근 리눅스에 적합합니다.",
        "capture-type-sflow": "스위치/라우터에서 전송하는 샘플링 기반 흐름 데이터를 수집합니다. 장비 설정이 필요합니다.",
        "capture-type-dpdk": "매우 빠른 패킷 처리를 위한 전문 기술로, 고성능 시스템에서만 사용합니다. 설정이 복잡할 수 있습니다.",
        "capture-type-ovsmirror": "OVS의 포트 트래픽을 복제하여 캡처합니다. 가상환경에서 유용합니다.",
        "capture-headerSize-validation-error": "헤더 크기는 14 이상 4096 이하의 숫자여야 합니다.",
        "capture-rawPacketLimit-validation-error": "유효한 값은 0~10 사이의 숫자입니다.",

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
        "collapseAllNodes": "모든 노드 축소",
        "hostListeningServices": "수신 대기 서비스",
        "hostTopSocketProcesses": "소켓 프로세스",
        "hostConnectionStates": "연결 상태",
        "hostSocketMoreItems": "개 더 있음",
        "hostSocketViewAll": "전체 보기 >",
        "hostSocketProcessColumn": "프로세스",
        "hostSocketCountColumn": "개수",
        "hostSocketRatioColumn": "비중",
        "hostSocketServiceColumn": "서비스",
        "hostSocketPortProtocolColumn": "포트 / 프로토콜",
        "hostSocketProtocolTcp": "TCP",
        "hostSocketProtocolUdp": "UDP",
        "hostSocketStateListen": "수신 대기",
        "hostSocketStateEstablished": "연결됨",
        "hostSocketStateTimeWait": "종료 대기",
        "hostSocketStateCloseWait": "종료 확인 대기",
        "hostSocketNoProcess": "알 수 없는 프로세스",
        "hostSocketNoService": "수신 대기 서비스 없음",
        "hostSocketNoConnectionState": "연결 상태 없음",
        "hostSocketCollapse": "접기",
        "topologyZoomOut": "축소",
        "topologyZoomIn": "확대",
        "topologyZoomReset": "100% 초기화",
        "topologyZoomFit": "화면 맞춤",
        "topologyZoomFitShort": "맞춤"
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

    groupSize?(node?: Node): number
    groupThreshold?(node?: Node): number
    groupType?(node: Node): string | undefined
    groupName?(node: Node, count?: number): string | undefined
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

    groupSize(node?: Node): number {
        var size = this.default.groupSize(node)
        for (let c of this.configs) {
            if (c.config.groupSize) {
                size = c.config.groupSize(node)
            }
        }
        return size
    }

    groupThreshold(node?: Node): number {
        var threshold = this.default.groupThreshold(node)
        for (let c of this.configs) {
            if (c.config.groupThreshold) {
                threshold = c.config.groupThreshold(node)
            }
        }
        return threshold
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

    groupName(node: Node, count?: number): string | undefined {
        var groupName = this.default.groupName(node, count)
        for (let c of this.configs) {
            if (c.config.groupName) {
                groupName = c.config.groupName(node, count)
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
        var name = String(node.data.Name || node.id || '')
        var ifName = node.data.IfName

        if (String(node.data.Type || '').toLowerCase() === 'switch') {
            name = switchDisplayName(node.data, name)
        }

        const isKubernetesNode = String(node.data.Manager || '').toLowerCase() === 'k8s'
            && String(node.data.Type || '').toLowerCase() === 'node'
        if (String(node.data.Type || '').toLowerCase() !== 'switch' && !isKubernetesNode && name.length > 24) {
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
                attrs.icon = "\uf542"
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
                attrs.icon = "\uf233"
                attrs.weight = WEIGHT_K8S_NODE
                break
            case "namespace":
                attrs.icon = "\uf07b"
                attrs.weight = WEIGHT_K8S_NAMESPACE
                break
            case "persistentvolumeclaim":
                attrs.href = "assets/icons/persistentvolumeclaim.png"
                attrs.weight = WEIGHT_K8S_STORAGE
                break
            case "persistentvolume":
                attrs.href = "assets/icons/persistentvolume.png"
                attrs.weight = WEIGHT_K8S_STORAGE
                break
            case "storageclass":
                attrs.href = "assets/icons/storageclass.png"
                attrs.weight = WEIGHT_K8S_STORAGE
                break
            case "daemonset":
            case "deployment":
            case "statefulset":
            case "job":
            case "cronjob":
                const workloadType = String(node.data.Type || '').toLowerCase()
                const workloadIcons: Record<string, string> = {
                    deployment: "assets/icons/deployment-controller.svg",
                    daemonset: "assets/icons/daemonset-controller.svg",
                    job: "assets/icons/job.png",
                    cronjob: "assets/icons/cronjob.png"
                }
                const workloadGlyphs: Record<string, string> = {
                    // StatefulSet represents persistent, stateful workloads. Use the
                    // Font Awesome database glyph instead of the castle-like legacy PNG.
                    statefulset: "\uf1c0"
                }
                if (workloadGlyphs[workloadType]) {
                    attrs.icon = workloadGlyphs[workloadType]
                } else {
                    attrs.href = workloadIcons[workloadType] || `assets/icons/${workloadType}.png`
                }
                attrs.iconClass = `k8s-workload-icon k8s-${workloadType}-icon`
                attrs.weight = WEIGHT_K8S_WORKLOAD
                attrs.name = kubernetesWorkloadNodeText(node.data.Name || node.id, workloadType).accessibleName
                break
            case "replicaset":
                attrs.href = "assets/icons/replicaset.png"
                attrs.weight = WEIGHT_K8S_WORKLOAD
                break
            case "configmap":
                attrs.href = "assets/icons/configmap.png"
                attrs.weight = WEIGHT_K8S_OTHER
                break
            case "secret":
                attrs.href = "assets/icons/secret.png"
                attrs.weight = WEIGHT_K8S_OTHER
                break
            case "endpoints":
            case "endpointslice":
                attrs.href = "assets/icons/endpoints.png"
                attrs.weight = WEIGHT_K8S_OTHER
                break
            case "ingress":
                attrs.href = "assets/icons/ingress.png"
                attrs.weight = WEIGHT_K8S_OTHER
                break
            case "networkpolicy":
                attrs.href = "assets/icons/networkpolicy.png"
                attrs.weight = WEIGHT_K8S_OTHER
                break
            case "serviceaccount":
                attrs.icon = "\uf2bd"
                attrs.weight = WEIGHT_K8S_OTHER
                break
            case "horizontalpodautoscaler":
            case "hpa":
                attrs.icon = "\uf201"
                attrs.weight = WEIGHT_K8S_OTHER
                break
            case "poddisruptionbudget":
            case "pdb":
                attrs.icon = "\uf3ed"
                attrs.weight = WEIGHT_K8S_OTHER
                break
            case "replicationcontroller":
                attrs.href = "assets/icons/replicationcontroller.png"
                attrs.weight = WEIGHT_K8S_OTHER
                break
            case "pod":
                attrs.icon = "\uf1b3"
                attrs.weight = WEIGHT_K8S_POD
                break
            case "container":
                attrs.icon = "\uf1b3"
                attrs.weight = WEIGHT_K8S_CONTAINER
                break
            case "service":
                attrs.href = "assets/icons/service.svg"
                attrs.weight = WEIGHT_K8S_SERVICE
                if (node.data?.IsTopologyGroup) attrs.name = String(node.data.Name || attrs.name)
                break
            default:
                attrs.icon = "\uf542"
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
                attrs.href = "assets/icons/network-switch.svg"
                attrs.iconClass = "network-switch-icon"
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
            attrs.badges = [{
                text: "\uf111",
                fill: "#ef4444",
                stroke: "#ffffff",
                className: "node-badge-capture"
            }]
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
            case WEIGHT_PHY_NET:
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
            case WEIGHT_VIRT_NET:
                attrs.icon = "\uf538"
                break
            case WEIGHT_PHY_PORTS:
                attrs.icon = "\uf796"
                break
            case WEIGHT_NONE:
                attrs.icon = "\uf538"
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
        window.App.syncGroupVisibleNodeIDs()
    }

    nodeMenu(node: Node): Array<MenuItem> {
        var captures = node.data.Captures?.length
        const alreadyCaptured = captures > 0;

        // 캡처 비허용 타입 정의
        const nodeType = typeof node.data.Type === "string" ? node.data.Type.toLowerCase() : "";
        const manager = typeof node.data.Manager === "string" ? node.data.Manager.toLowerCase() : "";
        const disallowedCaptureTypes = ["switch", "switchport", "host", "libvirt", "tuntap", "system", "ovsbridge", "ovsport"];
        const isDisallowed = manager === "k8s" || !node.data.TID || disallowedCaptureTypes.includes(nodeType);

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
        if (isKubernetesTopologyData(data)) {
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
        if (String(node?.data?.Type || '').toLowerCase() === 'switch') {
            return switchDisplayName(node.data, typeof name === 'string' ? name : node.id)
        }
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

    groupSize(node?: Node): number {
        const workloadTypes = new Set(["deployment", "statefulset", "daemonset", "job", "cronjob"])
        const nodeType = String(node?.data?.Type || '').toLowerCase()
        return node && node.data?.Manager === "k8s" && workloadTypes.has(nodeType) ? 10 : 3
    }

    groupThreshold(node?: Node): number {
        const workloadTypes = new Set(["deployment", "statefulset", "daemonset", "job", "cronjob"])
        if (!node || node.data?.Manager !== "k8s") return 3
        const nodeType = String(node.data?.Type || '').toLowerCase()
        if (nodeType === "pod") {
            // Workload -> Pod keeps the Kubernetes OwnerReference hierarchy
            // directly. Pod count must never introduce an intermediate group
            // anywhere in the Kubernetes topology.
            return 2147483647
        }
        if (!workloadTypes.has(nodeType)) return 3
        const controllerCount = (node.parent?.children || []).filter(child => child.data?.Manager === "k8s" && workloadTypes.has(String(child.data?.Type || '').toLowerCase())).length
        return controllerCount > 10 ? 0 : 10
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
            case "statefulset":
            case "job":
                return nodeType
            case "endpoints":
            case "ingress":
            case "persistentvolume":
            case "persistentvolumeclaim":
            case "storageclass":
                return nodeType
            case "pod":
            case "networkpolicy":
            case "replicaset":
            case "replicationcontroller":
            case "secret":
                return "app"
            default:
                return nodeType
        }
    }

    groupName(node: Node, count?: number): string | undefined {
        const primitiveGroupName = (value: any): string => {
            if (typeof value === "string") return value.trim()
            if (typeof value === "number" || typeof value === "boolean") return String(value)
            return ""
        }
        const withGroupSuffix = (name: any, fallback = "Resource"): string => {
            const trimmed = primitiveGroupName(name) || fallback
            const suffix = primitiveGroupName(translate("groupSuffix")) || "Group"
            return /(?:group|그룹)$/i.test(trimmed) ? trimmed : `${trimmed} ${suffix}`
        }

        if (node.data.K8s) {
            const workloadTypes = new Set(["deployment", "statefulset", "daemonset", "job", "cronjob"])
            if (workloadTypes.has(String(node.data.Type || '').toLowerCase())) {
                const kindLabels: Record<string, string> = { deployment: "Deployment", statefulset: "StatefulSet", daemonset: "DaemonSet", job: "Job", cronjob: "CronJob" }
                const kind = kindLabels[String(node.data.Type || '').toLowerCase()] || String(node.data.Type)
                return withGroupSuffix(kind)
            }
            if (String(node.data.Type || '').toLowerCase() === 'pod'
                && workloadTypes.has(String(node.parent?.data?.Type || '').toLowerCase())) {
                return withGroupSuffix(translate("k8s-pod-group"))
            }
            var labels = node.data.K8s.Labels
            if (labels) {
                var app = labels["k8s-app"] || labels["app"]
                const appGroupName = primitiveGroupName(app)
                if (appGroupName) {
                    return withGroupSuffix(appGroupName)
                }
            }

            switch (node.data.Type) {
                case "cluster":
                    return withGroupSuffix(translate("k8s-cluster-group"))
                case "node":
                    return withGroupSuffix(translate("k8s-node-group"))
                case "namespace":
                    return withGroupSuffix(translate("k8s-namespace-group"))
                case "storageclass":
                    return withGroupSuffix("StorageClass")
                case "persistentvolumeclaim":
                    return withGroupSuffix("PVC")
                case "persistentvolume":
                    return withGroupSuffix("PV")
                case "pod":
                    return withGroupSuffix(translate("k8s-pod-group"))
                case "endpoints":
                case "ingress":
                case "networkpolicy":
                    return withGroupSuffix(translate("k8s-app-group"))
                default:
                    return withGroupSuffix(translate("k8s-app-group"))
            }
        }

        var nodeType = this.groupType(node)
        if (!nodeType) {
            return
        }

        var regexpVirtRouter: RegExp = /^r-/
        var regexpSystemVm: RegExp = /^(s-|v-)/

        if (regexpVirtRouter.test(node.data.Name)) {
            nodeType = "virt-router"
        }else if (regexpSystemVm.test(node.data.Name) || node.data.Name === "ccvm" || node.data.Name === "scvm") {
            nodeType = "system-vm"
        }

        if (node.data.Type === "bridge") {
            nodeType = node.getWeight() === WEIGHT_VIRT_BRIDGES ? "virt-bridge" : "host-bridge"
        }

        const normalizedNodeType = primitiveGroupName(nodeType) || "resource"
        const groupKey = normalizedNodeType.toLowerCase() + "(s)"
        if (groupKey === "device(s)") {
            return withGroupSuffix(translate(node.getWeight() === WEIGHT_PHY_NIC ? "device(s)-nic" : "device(s)-network"))
        }
        const translated = translate(groupKey)
        const groupName = translated === groupKey ? normalizedNodeType.replace(/\(s\)$/i, '') : translated
        return withGroupSuffix(groupName)
    }

    weightTitles(): Map<number, string> {
        var wt = new Map<number, string>()


        wt.set(WEIGHT_K8S_FEDERATION, translate("k8s-Federations"))
        wt.set(WEIGHT_K8S_CLUSTER, translate("k8s-clusters"))
        wt.set(WEIGHT_K8S_NODE, translate("k8s-nodes"))
        wt.set(WEIGHT_K8S_NAMESPACE, translate("k8s-namespaces"))
        wt.set(WEIGHT_K8S_WORKLOAD, translate("k8s-workloads"))
        wt.set(WEIGHT_K8S_POD, translate("k8s-pods"))
        wt.set(WEIGHT_K8S_STORAGE, translate("k8s-storage"))
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
        var metric = sourceMetric.metric || targetMetric.metric
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
