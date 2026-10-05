import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { SocialLoginFlow } from './social'
import { useSocialLoginCallback } from './useSocialLoginCallback'

describe('useSocialLoginCallback', () => {
  it('starts pending on the callback page and does not run the login while rendering on the server', () => {
    const flow: SocialLoginFlow = { start: vi.fn(), complete: vi.fn() }
    function Probe() {
      return <p>{useSocialLoginCallback(flow, '?code=c&state=s').status}</p>
    }
    expect(renderToStaticMarkup(<Probe />)).toBe('<p>pending</p>')
    expect(flow.complete).not.toHaveBeenCalled()
  })
})
