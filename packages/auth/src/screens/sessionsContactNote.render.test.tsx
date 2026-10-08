import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koAuthLabels } from './labels.ko'
import { SessionsSection } from './SessionsSection'

const session = (id: string, current: boolean) => ({
  id,
  current,
  deviceName: id,
  userAgent: 'x',
  ip: '1.2.3.4',
  createdAt: '2026-10-08T00:00:00Z',
  lastUsedAt: '2026-10-08T00:00:00Z',
})
const sessions = [session('Mac', true), session('Phone', false)]
const html = (contactNote: boolean) =>
  renderToStaticMarkup(
    <SessionsSection
      sessions={sessions}
      onRevoke={async () => undefined}
      onRevokeOthers={async () => undefined}
      contactNote={contactNote}
      labels={koAuthLabels}
    />,
  )

describe('sessions section on an app with a contact email', () => {
  it('says that signing out of all devices also clears the contact email (the owner recovery clears it)', () => {
    expect(html(true)).toContain('모든 기기에서 로그아웃하면 연락받을 이메일도 지워져요')
  })

  it('says nothing about it on an app without the feature', () => {
    expect(html(false)).not.toContain('연락받을 이메일')
  })
})
