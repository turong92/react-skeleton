import { afterEach, describe, expect, it, vi } from 'vitest'
import { applySink, canChooseOutput, grantOutputLabels, listOutputDevices } from './outputDevice'

describe('applySink', () => {
  it('asks the element to use the device', () => {
    const setSinkId = vi.fn(() => Promise.resolve())
    void applySink({ setSinkId }, 'speaker')
    expect(setSinkId).toHaveBeenCalledWith('speaker')
  })

  it('says whether the device took: true when accepted, false when refused', async () => {
    const ok = { setSinkId: vi.fn(() => Promise.resolve()) }
    const refused = { setSinkId: vi.fn(() => Promise.reject(new Error('NotFoundError'))) }
    const throws = {
      setSinkId: () => {
        throw new Error('x')
      },
    }
    expect(await applySink(ok, 'a')).toBe(true)
    expect(await applySink(refused, 'gone')).toBe(false)
    expect(await applySink(throws, 'gone')).toBe(false)
  })

  it('has nothing to refuse on an element without setSinkId', async () => {
    expect(await applySink({}, 'x')).toBe(true)
    expect(await applySink(null, 'x')).toBe(true)
  })
})

describe('canChooseOutput', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is false when the browser has no setSinkId and true when it has', () => {
    vi.stubGlobal('HTMLMediaElement', class {})
    expect(canChooseOutput()).toBe(false)
    vi.stubGlobal(
      'HTMLMediaElement',
      class {
        setSinkId() {
          return Promise.resolve()
        }
      },
    )
    expect(canChooseOutput()).toBe(true)
  })

  it('is false where there is no browser (server)', () => {
    expect(canChooseOutput()).toBe(false)
  })
})

const info = (kind: string, deviceId: string, label = '') => ({ kind, deviceId, label })

describe('listOutputDevices', () => {
  it('keeps only audio outputs', async () => {
    const media = {
      enumerateDevices: vi.fn(async () => [
        info('audioinput', 'mic', 'Mic'),
        info('audiooutput', 'bt', 'Speaker'),
        info('videoinput', 'cam', 'Cam'),
      ]),
    }
    expect(await listOutputDevices(media)).toEqual([{ deviceId: 'bt', label: 'Speaker' }])
  })

  it('is empty when the browser cannot list devices', async () => {
    expect(await listOutputDevices(undefined)).toEqual([])
    expect(
      await listOutputDevices({ enumerateDevices: () => Promise.reject(new Error('x')) }),
    ).toEqual([])
  })
})

describe('grantOutputLabels', () => {
  it('opens the microphone once and stops its tracks right away', async () => {
    const stop = vi.fn()
    const media = { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }, { stop }] })) }
    await grantOutputLabels(media)
    expect(media.getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(stop).toHaveBeenCalledTimes(2)
  })

  it('does not throw when the person says no', async () => {
    const media = { getUserMedia: vi.fn(() => Promise.reject(new Error('NotAllowedError'))) }
    await expect(grantOutputLabels(media)).resolves.toBeUndefined()
  })
})
