import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koAuthLabels } from './labels.ko'
import { NeedsEmailCard } from './NeedsEmailCard'

const card = (extra: Partial<React.ComponentProps<typeof NeedsEmailCard>> = {}) =>
  renderToStaticMarkup(
    <NeedsEmailCard id="password" title="비밀번호" labels={koAuthLabels} {...extra} />,
  )

describe('NeedsEmailCard (a settings section the server closes until an address is registered - write-time mode)', () => {
  it('keeps the section id and title so the index still points at it, and says why in words', () => {
    const out = card()
    expect(out).toContain('id="password"')
    expect(out).toContain('비밀번호')
    expect(out).toContain('이메일을 등록한 뒤에 할 수 있어요.')
    // 입력은 없다 - 눌러 봐야 403 이 나는 것을 그리지 않는다
    expect(out).not.toContain('<input')
  })

  it('offers a bordered button to the email section when there is one to go to', () => {
    const out = card({ onGo: () => undefined })
    expect(out).toMatch(/<button[^>]*data-variant="secondary"[^>]*>이메일 등록<\/button>/)
  })

  it('draws no button when the email section is off', () => {
    expect(card()).not.toContain('<button')
  })
})
