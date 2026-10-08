import * as React from 'react'
import type { Link, Node, NodeAttrs } from '../Topology'
import { translate } from '../Config'
import Tools from '../Tools'
import { topologyLinkTraffic } from '../TopologyLinkTraffic'
import { linkDetailMetadataRows } from './LinkDetailData'
import { DetailSectionIcon } from './common/DetailSectionIcon'
import { DetailBadge, DetailEmpty, DetailInfoNote, DetailKeyValueList, DetailLongValue,
    DetailMetricRow, DetailMetricSummaryRow, DetailResourceCard, DetailResourceGrid, DetailSection, InfrastructureTopologyIcon } from './common'
import './LinkDetailPanel.css'

interface Props {
    link: Link
    nodeAttrs: (node: Node) => NodeAttrs
    nodeDisplayName?: (node: Node) => string
    onNodeSelect?: (node: Node) => void
}

const relationKeys: Record<string, string> = {
    layer2: 'linkLayer2', vlayer2: 'linkVirtualLayer2', ownership: 'linkOwnership', vownership: 'linkVirtualOwnership'
}
const bandwidth = (value?: number) => value === undefined ? translate('linkMetricUnavailable') : Tools.prettyBandwidth(value)

const LinkDetailPanel = ({ link, nodeAttrs, nodeDisplayName, onNodeSelect }: Props) => {
    const [advanced, setAdvanced] = React.useState(false)
    const data = link.data || {}, traffic = topologyLinkTraffic(link)
    const name = (node: Node) => nodeDisplayName?.(node) || String(node.data?.Name || node.id)
    const relation = String(data.RelationType || '')
    const rows = [
        { key: 'relation', label: translate('linkRelationType'),
            value: relation ? <DetailBadge tone="info">{translate(relationKeys[relation] || relation)}</DetailBadge> : '-' },
        { key: 'source', label: translate('linkSourceType'),
            value: translate(data.ManualPortMapping ? 'linkManualMapping' : 'linkTopologyRelation') },
        ...(typeof data.Directed === 'boolean' ? [{ key: 'direction', label: translate('linkDirection'), value: translate(data.Directed ? 'linkDirected' : 'linkUndirected') }] : [])
    ]
    const metadata = [{ key: 'id', label: translate('linkId'), value: link.id, copyText: link.id },
        ...linkDetailMetadataRows(link)]
    return <div className="netdive-link-detail">
        <DetailSection icon={<DetailSectionIcon role="basic" />} title={translate('linkBasicInfo')}>
            <DetailKeyValueList rows={rows} copyTooltip={translate('copy')} />
        </DetailSection>
        <DetailSection icon={<DetailSectionIcon role="related" />} title={translate('linkEndpoints')}>
            <DetailResourceGrid className="netdive-link-detail__endpoints">{[link.source, link.target].map((node, index) =>
                <DetailResourceCard key={`${index}-${node.id}`}
                    label={translate(data.Directed ? index === 0 ? 'linkSourceObject' : 'linkTargetObject' : index === 0 ? 'linkEndpointA' : 'linkEndpointB')}
                    value={<DetailLongValue value={name(node)} maxLines={2} />}
                    description={String(node.data?.Type || '').toUpperCase()}
                    icon={<InfrastructureTopologyIcon node={node} nodeAttrs={nodeAttrs} />}
                    copyText={name(node)} copyTooltip={translate('copy')}
                    interactive={!!onNodeSelect} onClick={() => onNodeSelect?.(node)} />
            )}</DetailResourceGrid>
        </DetailSection>
        <DetailSection icon={<DetailSectionIcon role="recentMetrics" />} title={translate('linkTraffic')}>
            {traffic ? <>
                <DetailMetricRow label={translate('linkTrafficTotal')} value={bandwidth(traffic.total)}
                    primary unavailable={traffic.total === undefined} />
                <DetailMetricSummaryRow columns={2} items={[
                    { label: translate('linkReceived'), value: bandwidth(traffic.received) },
                    { label: translate('linkTransmitted'), value: bandwidth(traffic.transmitted) }
                ]} />
                <DetailKeyValueList density="compact" rows={[
                    { key: 'interface', label: translate('linkMetricSource'), value: name(traffic.node), copyText: name(traffic.node) },
                    { key: 'interval', label: translate('linkMetricInterval'), value: `${traffic.seconds}s` }
                ]} />
                <DetailInfoNote>{translate('linkTrafficNote')}</DetailInfoNote>
            </> : <DetailEmpty compact description={translate('linkNoTraffic')} />}
        </DetailSection>
        <DetailSection icon={<DetailSectionIcon role="advanced" />} title={translate('detailAdvancedInfo')}
            collapsible collapsed={!advanced} onToggle={() => setAdvanced(!advanced)}>
            <DetailKeyValueList rows={metadata} copyTooltip={translate('copy')} className="netdive-link-detail__metadata" />
        </DetailSection>
    </div>
}

export default LinkDetailPanel
