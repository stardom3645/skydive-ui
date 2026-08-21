import * as React from 'react'
import { Menu, Typography } from 'antd'
import {
    AimOutlined,
    CopyOutlined,
    DownOutlined,
    EyeOutlined,
    UpOutlined,
    WarningOutlined,
    NodeIndexOutlined
} from '@ant-design/icons'

export type TopologyContextMenuSection = 'navigation' | 'topology'

export interface TopologyContextMenuAction {
    key: string
    text: string
    section: TopologyContextMenuSection
    callback: () => void
}

interface Props {
    nodeName: string
    actions: TopologyContextMenuAction[]
    onAction: (action: TopologyContextMenuAction) => void
}

const actionIcon = (key: string): React.ReactNode => ({
    detail: <EyeOutlined />,
    center: <AimOutlined />,
    connections: <NodeIndexOutlined />,
    copy: <CopyOutlined />,
    expand: <DownOutlined />,
    collapse: <UpOutlined />,
    problems: <WarningOutlined />
}[key] || <EyeOutlined />)

/** Mold-style Ant Menu shared by every topology resource and group node. */
export const TopologyContextMenu = ({ nodeName, actions, onAction }: Props) => {
    const renderSection = (section: TopologyContextMenuSection, label: string) => {
        const items = actions.filter(action => action.section === section)
        if (items.length === 0) return null
        return <Menu.ItemGroup key={section} title={label}>
            {items.map(action => <Menu.Item key={action.key} icon={actionIcon(action.key)}>
                {action.text}
            </Menu.Item>)}
        </Menu.ItemGroup>
    }

    return <div
        className="netdive-mold-dropdown ant-dropdown netdive-resource-context-menu"
        role="presentation"
        onContextMenu={event => event.preventDefault()}>
        <div className="netdive-resource-context-menu__header">
            <Typography.Text className="netdive-resource-context-menu__name">
                {nodeName}
            </Typography.Text>
        </div>
        <Menu
            className="netdive-resource-action-menu"
            selectable={false}
            onClick={({ key }) => {
                const action = actions.find(candidate => candidate.key === String(key))
                if (action) onAction(action)
            }}>
            {renderSection('navigation', '탐색')}
            {actions.some(action => action.section === 'navigation')
                && actions.some(action => action.section === 'topology')
                && <Menu.Divider />}
            {renderSection('topology', '토폴로지')}
        </Menu>
    </div>
}

export default TopologyContextMenu
