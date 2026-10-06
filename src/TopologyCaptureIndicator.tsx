import * as React from 'react'
import { Badge, ConfigProvider } from 'antd'

/** HTML Ant status inside the SVG graph, above the node's title area. */
export const TopologyCaptureIndicator = ({ y }: { y: number }) => (
    <foreignObject x={-48} y={y - 32} width={96} height={28}>
        <ConfigProvider theme={{ token: { fontSize: 14 } }}>
            <div className="netdive-topology-capture-status" role="status" aria-label="패킷 캡처 진행 중">
                <Badge status="processing" text="캡처 중" />
            </div>
        </ConfigProvider>
    </foreignObject>
)
