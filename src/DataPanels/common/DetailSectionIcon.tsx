import * as React from 'react'
import { InfoCircleOutlined, ControlOutlined, HeartOutlined, DashboardOutlined, ApartmentOutlined, CheckCircleOutlined, SafetyOutlined, ContainerOutlined, BuildOutlined, ClusterOutlined, RocketOutlined, AuditOutlined, ApiOutlined, SwapOutlined, HistoryOutlined, GlobalOutlined, DeploymentUnitOutlined, ShareAltOutlined, AppstoreOutlined, DatabaseOutlined, SettingOutlined, PartitionOutlined, LineChartOutlined, BarChartOutlined, CloudServerOutlined, CodeOutlined, FundProjectionScreenOutlined, ToolOutlined, ThunderboltOutlined, NodeIndexOutlined } from '@ant-design/icons'

// Reuse icons for the same information role across infrastructure and Kubernetes.
const sectionIcons = {
    basic: InfoCircleOutlined,
    advanced: ControlOutlined,
    operational: HeartOutlined,
    resources: DashboardOutlined,
    related: ApartmentOutlined,
    conditions: CheckCircleOutlined,
    risk: SafetyOutlined,
    containers: ContainerOutlined,
    workloads: BuildOutlined,
    groups: ClusterOutlined,
    rollout: RocketOutlined,
    policy: AuditOutlined,
    endpoints: ApiOutlined,
    ports: SwapOutlined,
    events: HistoryOutlined,
    addresses: GlobalOutlined,
    network: DeploymentUnitOutlined,
    processes: ShareAltOutlined,
    services: AppstoreOutlined,
    volumes: DatabaseOutlined,
    configuration: SettingOutlined,
    portMapping: PartitionOutlined,
    recentMetrics: LineChartOutlined,
    accumulatedMetrics: BarChartOutlined,
    management: CloudServerOutlined,
    jvm: CodeOutlined,
    serverResources: FundProjectionScreenOutlined,
    features: ToolOutlined,
    linkStatus: ThunderboltOutlined,
    neighbor: NodeIndexOutlined
}

export type DetailSectionRole = keyof typeof sectionIcons

export const DetailSectionIcon = ({ role }: { role: DetailSectionRole }) => {
    const Icon = sectionIcons[role]
    return <Icon className="netdive-detail-section-icon" aria-hidden="true" />
}
