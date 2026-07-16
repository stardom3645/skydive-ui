import HostBridgeDetailPanel from './HostBridgeDetailPanel'

// Host and virtual bridges share the same Netlink bridge metadata schema.
// Keep one renderer so both panels omit unavailable fields in exactly the same way.
export default HostBridgeDetailPanel
