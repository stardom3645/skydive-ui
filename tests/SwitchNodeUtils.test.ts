import { expect } from 'chai'
import * as fs from 'fs'
import * as path from 'path'

import { switchDisplayName, switchSystemInfo } from '../src/SwitchNodeUtils'

describe('switch display name normalization', () => {
    it('keeps basic and advanced switch information free of duplicate model and management-address rows', () => {
        const panel = fs.readFileSync(path.resolve(__dirname, '../src/DataPanels/SwitchDetailPanel.tsx'), 'utf8')
        const advancedRows = panel.slice(panel.indexOf('private advancedRows()'), panel.indexOf('private topologyNodes()'))
        expect(advancedRows).not.to.include("key: 'model'")
        expect(advancedRows).not.to.include("key: 'managementAddress'")
        expect(advancedRows).to.include("key: 'manufacturer'")
        expect(advancedRows).to.include("key: 'description'")
    })

    it('prefers the LLDP system name over the system description', () => {
        expect(switchDisplayName({
            Name: '00:11:22:33:44:55',
            LLDP: {
                SysName: 'leaf-01',
                Description: 'Vendor Network OS. Copyright 2026. OS Version: 1.2.3'
            }
        })).to.equal('leaf-01')
    })

    it('keeps a concise collected node name when no LLDP system name exists', () => {
        expect(switchDisplayName({
            Name: 'spine-02.example.local',
            LLDP: { Description: 'Example NOS Software Version: 9.1' }
        })).to.equal('spine-02.example.local')
    })

    it('extracts a generic model fallback from a Dell system description', () => {
        const description = [
            'Dell SmartFabric OS10 Enterprise.',
            'Copyright (c) 1999-2023 by Dell Inc. All Rights Reserved.',
            'System Description: OS10 Enterprise.',
            'OS Version: 10.5.5.8.',
            'System Type: S4148F-ON'
        ].join('\n')
        expect(switchDisplayName({ Name: description, LLDP: { Description: description } }))
            .to.equal('S4148F-ON')
    })

    it('uses the hardware model when LLDP SysName is only a network OS product name', () => {
        expect(switchDisplayName({
            Name: 'OS10',
            LLDP: {
                SysName: 'OS10',
                Description: 'Dell SmartFabric OS10 Enterprise. OS Version: 10.5.5.8. System Type: S4148F-ON'
            }
        })).to.equal('S4148F-ON')
    })

    it('uses a labeled hardware model instead of a hostname when available', () => {
        expect(switchDisplayName({
            LLDP: {
                Description: 'Vendor OS; Hostname: edge-sw-07; Platform: X9000; Software Version: 4.2'
            }
        })).to.equal('X9000')
    })

    it('uses the chassis ID instead of an unstructured vendor banner', () => {
        expect(switchDisplayName({
            LLDP: {
                Description: 'Example Networks Operating System Copyright 2026 All Rights Reserved',
                ChassisID: '00:11:22:33:44:55'
            }
        }, 'node-id')).to.equal('00:11:22:33:44:55')
    })

    it('normalizes names from JSON-encoded LLDP metadata', () => {
        expect(switchDisplayName({ LLDP: JSON.stringify({ SystemName: ' leaf-03\n' }) }))
            .to.equal('leaf-03')
    })

    it('preserves and structures Dell system description details', () => {
        const description = [
            'Dell SmartFabric OS10 Enterprise.',
            'Copyright (c) 1999-2023 by Dell Inc. All Rights Reserved.',
            'System Description: OS10 Enterprise.',
            'OS Version: 10.5.5.8.',
            'System Type: S4148F-ON'
        ].join('\r\n')
        expect(switchSystemInfo({ LLDP: { Description: description } })).to.deep.equal({
            manufacturer: 'Dell Technologies',
            operatingSystem: 'OS10 Enterprise',
            osVersion: '10.5.5.8',
            model: 'S4148F-ON',
            description
        })
    })

    it('prefers structured vendor system fields over description inference', () => {
        expect(switchSystemInfo({
            LLDP: {
                Manufacturer: 'Arista Networks, Inc.',
                OperatingSystem: 'EOS',
                SoftwareVersion: '4.32.1F',
                Model: 'DCS-7050SX3',
                Description: 'unstructured raw description'
            }
        })).to.include({
            manufacturer: 'Arista Networks',
            operatingSystem: 'EOS',
            osVersion: '4.32.1F',
            model: 'DCS-7050SX3',
            description: 'unstructured raw description'
        })
    })
})
