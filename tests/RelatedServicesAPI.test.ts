import { strict as assert } from 'assert'
import { cubeHostURL, filterCubeHosts, serviceBrowserURL } from '../src/RelatedServicesLinks'

describe('Related services links', () => {
  it('builds Cube links from IPv4/IPv6 management IP and an explicit port', () => {
    assert.equal(cubeHostURL('10.10.31.1', 19100), 'https://10.10.31.1:19100/')
    assert.equal(cubeHostURL('2001:db8::1', 9090), 'https://[2001:db8::1]:9090/')
    assert.equal(cubeHostURL('[2001:db8::1]', 9090), 'https://[2001:db8::1]:9090/')
    assert.equal(cubeHostURL('10.10.31.1'), undefined)
  })
  it('disables missing/invalid IPs and ports instead of guessing an endpoint', () => {
    for (const ip of ['', '10.10.31.999', '10.10.31', 'host.example', '10.0.0.1/path', '10.0.0.1@other', '::bad::']) {
      assert.equal(cubeHostURL(ip, 9090), undefined, ip)
    }
    for (const port of [0, -1, 65536, NaN, 9.5]) assert.equal(cubeHostURL('10.10.31.1', port), undefined)
  })
  it('preserves configured protocols and rejects executable/credential-bearing service links', () => {
    assert.equal(serviceBrowserURL('http://mold.example:8080/client/'), 'http://mold.example:8080/client/')
    assert.equal(serviceBrowserURL('https://wall.example:8081'), 'https://wall.example:8081/')
    for (const raw of ['javascript:alert(1)', 'data:text/html,hello', 'https://admin:secret@wall.example', '/client/']) {
      assert.equal(serviceBrowserURL(raw), undefined)
    }
  })
  it('searches the complete host list by name or management IP without touching selection', () => {
    const hosts = [{ id: '1', name: 'ablecube31-1', managementIp: '10.10.31.1' },
      { id: '2', name: 'ablecube31-2', managementIp: '10.10.31.2' }]
    assert.deepEqual(filterCubeHosts(hosts, ' ABLECUBE31-2 '), [hosts[1]])
    assert.deepEqual(filterCubeHosts(hosts, '31.1'), [hosts[0]])
    assert.deepEqual(filterCubeHosts(hosts, 'missing'), [])
    assert.deepEqual(filterCubeHosts(hosts, ''), hosts)
    assert.equal(hosts.length, 2)
  })
})
