import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AccountDeletedScreen } from './AccountDeletedScreen'
import { koAuthLabels } from './labels.ko'

const html = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

describe('AccountDeletedScreen', () => {
  it('says the deletion was received, with the date, and offers the way to the sign-in screen', () => {
    const out = html(
      <AccountDeletedScreen
        purgeAfter="2026-11-06T00:00:00Z"
        signInTo="/login"
        labels={koAuthLabels}
        formatDate={() => '2026. 11. 6.'}
      />,
    )
    expect(out).toContain('탈퇴가 접수됐어요')
    expect(out).toContain('2026. 11. 6.')
    expect(out).toContain('href="/login"')
    expect(out).toContain('로그인 화면으로')
  })

  it('mentions cancelling by signing in again only when the server has self-restore on', () => {
    const base = { purgeAfter: '2026-11-06T00:00:00Z', signInTo: '/login', labels: koAuthLabels }
    expect(html(<AccountDeletedScreen {...base} selfRestore />)).toContain(
      '그 전에 다시 로그인하면 취소할 수 있어요',
    )
    expect(html(<AccountDeletedScreen {...base} />)).not.toContain('취소할 수 있어요')
  })

  it('still reads well when the date is unknown (a reload lost the router state)', () => {
    const out = html(<AccountDeletedScreen signInTo="/login" labels={koAuthLabels} />)
    expect(out).toContain('탈퇴가 접수됐어요')
    expect(out).not.toContain('undefined')
  })
})
