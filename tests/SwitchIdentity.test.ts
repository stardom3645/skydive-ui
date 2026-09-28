import { expect } from 'chai'

import { collectRawSwitchIdentity, parseSwitchIdentity, switchVendorRules } from '../src/SwitchIdentity'
import { SWITCH_MODEL_CATALOG } from './fixtures/SwitchModelCatalog'

describe('switch identity parsing pipeline', () => {
    it('keeps at least 500 known model fixtures across every required vendor family', () => {
        expect(SWITCH_MODEL_CATALOG.length).to.be.at.least(500)
        expect(new Set(SWITCH_MODEL_CATALOG.map(fixture => fixture.vendor)).size).to.equal(20)
        expect(switchVendorRules().map(rule => rule.vendor)).to.have.members([
            'Cisco', 'HPE Aruba Networking', 'Juniper Networks', 'Dell Technologies', 'Arista Networks',
            'Extreme Networks', 'NVIDIA', 'Huawei', 'H3C', 'CommScope', 'Ubiquiti', 'MikroTik',
            'NETGEAR', 'TP-Link Omada', 'D-Link', 'FS', 'Edgecore Networks', 'Allied Telesis',
            'Alcatel-Lucent Enterprise', 'Zyxel Networks'
        ])
    })

    const vendorFixtures = Array.from(new Set(SWITCH_MODEL_CATALOG.map(fixture => fixture.vendor)))
    vendorFixtures.forEach(vendor => {
        const fixtures = SWITCH_MODEL_CATALOG.filter(fixture => fixture.vendor === vendor)
        it(`recognizes ${vendor} models and common raw string variants`, () => {
            fixtures.forEach(fixture => {
                const structured = parseSwitchIdentity({ Vendor: vendor, Model: fixture.rawModel })
                expect(structured.vendor, `${vendor} structured vendor`).to.equal(vendor)
                expect(structured.displayModel, `${vendor} structured ${fixture.rawModel}`).to.equal(fixture.displayModel)

                const prefixed = parseSwitchIdentity({ LLDP: { Description: `${vendor} ${fixture.rawModel}` } })
                expect(prefixed.vendor, `${vendor} prefixed vendor`).to.equal(vendor)
                expect(prefixed.displayModel, `${vendor} prefixed ${fixture.rawModel}`).to.equal(fixture.displayModel)

                const withOS = parseSwitchIdentity({
                    LLDP: { Description: `${vendor} ${fixture.rawModel}, Network Operating System Version 10.4.2` }
                })
                expect(withOS.displayModel, `${vendor} OS description ${fixture.rawModel}`).to.equal(fixture.displayModel)

                const lowerCase = parseSwitchIdentity({
                    Vendor: vendor.toLowerCase(),
                    Model: fixture.rawModel.toLowerCase()
                })
                expect(lowerCase.displayModel, `${vendor} lowercase ${fixture.rawModel}`).to.equal(fixture.displayModel)
            })
        })
    })

    it('collects raw LLDP, SNMP and ENTITY-MIB values without overwriting them', () => {
        expect(collectRawSwitchIdentity({
            LLDP: { SysName: 'access-01', Description: 'LLDP description' },
            SNMP: {
                sysName: 'access-01.example',
                sysDescr: 'SNMP description',
                sysObjectID: '.1.3.6.1.4.1.9.1.2494',
                EntityMIB: [{ entPhysicalModelName: 'C9300-48P', entPhysicalDescr: 'Cisco Catalyst chassis' }]
            }
        })).to.deep.equal({
            lldpSysName: 'access-01',
            lldpSysDescr: 'LLDP description',
            snmpSysName: 'access-01.example',
            snmpSysDescr: 'SNMP description',
            snmpSysObjectID: '.1.3.6.1.4.1.9.1.2494',
            entPhysicalModelName: 'C9300-48P',
            entPhysicalDescr: 'Cisco Catalyst chassis',
            explicitVendor: '',
            explicitModel: ''
        })
    })

    it('prioritizes entPhysicalModelName over less precise sysDescr and LLDP values', () => {
        const identity = parseSwitchIdentity({
            LLDP: { Description: 'Cisco IOS XE Software, Catalyst C9200-24T' },
            SNMP: {
                sysDescr: 'Cisco IOS XE Software',
                sysObjectID: '.1.3.6.1.4.1.9.1.2494',
                EntityMIB: { entPhysicalModelName: 'C9300-48P', entPhysicalDescr: 'Cisco Catalyst 9300 chassis' }
            }
        })
        expect(identity).to.include({ vendor: 'Cisco', rawModel: 'C9300-48P', displayModel: 'C9300-48P', source: 'entity-model' })
    })

    it('selects the ENTITY-MIB chassis instead of a fan or power-supply entry', () => {
        const identity = parseSwitchIdentity({
            SNMP: {
                sysObjectID: '.1.3.6.1.4.1.9.1.2494',
                EntityMIB: [
                    { entPhysicalClass: 'fan', entPhysicalModelName: 'FAN-T1', entPhysicalDescr: 'Fan tray' },
                    { entPhysicalClass: 3, entPhysicalModelName: 'C9300-48UXM', entPhysicalDescr: 'Cisco Catalyst chassis' },
                    { entPhysicalClass: 'powerSupply', entPhysicalModelName: 'PWR-C1-1100WAC', entPhysicalDescr: 'Power supply' }
                ]
            }
        })
        expect(identity).to.include({ vendor: 'Cisco', rawModel: 'C9300-48UXM', displayModel: 'C9300-48UXM', source: 'entity-model' })
    })

    it('uses sysObjectID for vendor detection while requiring another source for the model', () => {
        expect(parseSwitchIdentity({ SNMP: {
            sysObjectID: '.1.3.6.1.4.1.2636.1.1.1.2.137',
            sysDescr: 'Junos 23.4R2.13 built 2025-01-10 Model: EX4400-48P'
        } })).to.include({ vendor: 'Juniper Networks', displayModel: 'EX4400-48P' })

        expect(parseSwitchIdentity({ SNMP: {
            sysObjectID: '.1.3.6.1.4.1.2636.1.1.1.2.137',
            sysDescr: 'Junos 23.4R2.13 built 2025-01-10'
        } })).to.include({ vendor: 'Juniper Networks', displayModel: '' })
    })

    it('normalizes rebranded vendor aliases to one current vendor family', () => {
        expect(parseSwitchIdentity({ Vendor: 'Mellanox Technologies', Model: 'MSN2700-CS2F' }))
            .to.include({ vendor: 'NVIDIA', rawModel: 'MSN2700-CS2F', displayModel: 'SN2700' })
        expect(parseSwitchIdentity({ Vendor: 'Aruba Networks', Model: '6300M-48G-4SFP56' }).vendor)
            .to.equal('HPE Aruba Networking')
        expect(parseSwitchIdentity({ Vendor: 'Brocade Communications', Model: 'ICX7450-48P' }).vendor)
            .to.equal('CommScope')
        expect(parseSwitchIdentity({ Vendor: 'RUCKUS', Model: 'ICX8200-48ZP' }).vendor)
            .to.equal('CommScope')
    })

    it('preserves meaningful model suffixes and symbols', () => {
        expect(parseSwitchIdentity({ Vendor: 'Dell', Model: 'S5248F-ON' }).displayModel).to.equal('S5248F-ON')
        expect(parseSwitchIdentity({ Vendor: 'Juniper', Model: 'EX4400-48P' }).displayModel).to.equal('EX4400-48P')
        expect(parseSwitchIdentity({ Vendor: 'Cisco', Model: 'N9K-C93180YC-FX3' }).displayModel).to.equal('N9K-C93180YC-FX3')
        expect(parseSwitchIdentity({ Vendor: 'MikroTik', Model: 'CRS326-24S+2Q+RM' }).displayModel).to.equal('CRS326-24S+2Q+RM')
    })

    it('does not mistake versions, IP addresses, MAC addresses or CPU names for models', () => {
        ;[
            'Linux localhost 5.15.0-91-generic x86_64',
            'Network Operating System Version 10.5.5.8',
            'Management address 10.10.0.254',
            'Chassis ID 98:03:9b:ff:e6:40',
            'Copyright 2026 All Rights Reserved'
        ].forEach(description => {
            expect(parseSwitchIdentity({ LLDP: { Description: description } }).displayModel, description).to.equal('')
        })
    })

    it('keeps a safe structured fallback for an unknown future vendor model', () => {
        expect(parseSwitchIdentity({ Vendor: 'Future Networks', Model: 'FNX-48Y8C-R2' }))
            .to.include({ vendor: 'Future Networks', rawModel: 'FNX-48Y8C-R2', displayModel: 'FNX-48Y8C-R2', source: 'fallback' })
    })
})
