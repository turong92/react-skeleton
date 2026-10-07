import { describe, expect, it } from 'vitest'
import { formatIp } from './formatIp'

const label = 'Local address'

describe('formatIp', () => {
  it('shows loopback addresses (IPv4, IPv6, expanded or compressed) as this device', () => {
    for (const ip of [
      '127.0.0.1',
      '127.1.2.3',
      '::1',
      '0:0:0:0:0:0:0:1',
      '0000:0000:0000:0000:0000:0000:0000:0001',
      '::ffff:127.0.0.1',
    ])
      expect(formatIp(ip, label), ip).toBe(label)
  })

  it('the server now sends the compressed loopback itself (FINAL-5 R7) — same answer', () => {
    expect(formatIp('::1', label)).toBe(label)
    expect(formatIp('2001:db8::5', label)).toBe('2001:db8::5')
  })

  it('compresses other IPv6 addresses and leaves IPv4 alone', () => {
    expect(formatIp('2001:0db8:0000:0000:0000:0000:0000:0001', label)).toBe('2001:db8::1')
    expect(formatIp('fe80:0:0:0:abcd:0:0:1', label)).toBe('fe80::abcd:0:0:1')
    expect(formatIp('2001:db8:1:2:3:4:5:6', label)).toBe('2001:db8:1:2:3:4:5:6')
    expect(formatIp('203.0.113.7', label)).toBe('203.0.113.7')
  })

  it('keeps anything it does not understand, and null as null', () => {
    expect(formatIp('not-an-ip', label)).toBe('not-an-ip')
    expect(formatIp(null, label)).toBeNull()
  })
})
