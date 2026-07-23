import * as React from 'react'
import { RightOutlined } from '@ant-design/icons'

import { Node } from '../../Topology'
import './NodeContextBreadcrumb.css'

export interface NodeContextItem {
    id: string
    label: string
    node?: Node
}

export interface NodeContextIcon {
    icon: string
    href?: string
    iconClass?: string
}

interface Props {
    items: NodeContextItem[]
    icon: NodeContextIcon
    onNavigate?: (item: NodeContextItem) => void
}

const ContextItem = ({ item, onNavigate, className }: { item: NodeContextItem, onNavigate?: (item: NodeContextItem) => void, className: string }) => {
    if (onNavigate && item.node) {
        return <button type="button" className={className} title={item.label} onClick={() => onNavigate(item)}>{item.label}</button>
    }
    return <span className={className} title={item.label}>{item.label}</span>
}

const ContextIcon = ({ icon }: { icon: NodeContextIcon }) => {
    if (icon.href) {
        return <img className="netdive-node-context__icon-image" src={icon.href} alt="" aria-hidden="true" />
    }
    const familyClass = icon.iconClass === 'font-brands' ? 'font-brands' : 'font-free'
    return <span className={`netdive-node-context__icon-glyph ${familyClass} ${icon.iconClass || ''}`} aria-hidden="true">{icon.icon}</span>
}

const NodeContextBreadcrumb = ({ items, icon, onNavigate }: Props) => (
    <nav className="netdive-node-context" aria-label="Node context">
        <ContextIcon icon={icon} />
        <ol className="netdive-node-context__path">
            {items.map((item, index) =>
                <li key={`${item.id}-${index}`} className={index === items.length - 1 ? 'is-current' : ''}>
                    {index > 0 && <RightOutlined className="netdive-node-context__separator" aria-hidden="true" />}
                    <ContextItem item={item} onNavigate={index < items.length - 1 ? onNavigate : undefined} className="netdive-node-context__item" />
                </li>
            )}
        </ol>
    </nav>
)

export default NodeContextBreadcrumb
