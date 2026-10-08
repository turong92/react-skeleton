import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { koAuthLabels } from './labels.ko'
import { loginIdCheckState, type LoginIdAnswers } from './loginIdAvailability'
import { LoginIdField } from './LoginIdField'
import { useLoginIdAvailability } from './useLoginIdAvailability'

/* 설계 §13.1 의 상태 표 — 칸의 속성 · 상태 줄의 글자 · 칸 옆 오류. 시간이 흐르는 쪽은 loginIdAvailability.test.ts */
const rules = { minLength: 4, maxLength: 20 }

function render(
  value: string,
  options: { answers?: LoginIdAnswers; touched?: boolean; serverError?: string } = {},
) {
  const state = loginIdCheckState({
    value,
    rules,
    answers: options.answers ?? {},
    touched: options.touched ?? false,
  })
  return renderToStaticMarkup(
    <LoginIdField
      value={value}
      onChange={() => undefined}
      check={{ ...state, touch: () => undefined }}
      rules={rules}
      labels={koAuthLabels}
      serverError={options.serverError}
    />,
  )
}

describe('LoginIdField — the input', () => {
  const html = render('')
  it('is a username input that the browser leaves alone', () => {
    expect(html).toContain('autoComplete="username"')
    expect(html).toContain('autoCapitalize="none"')
    expect(html).toContain('spellCheck="false"')
  })
  it('has its label tied to the input and the hint tied by aria-describedby', () => {
    const id = /<label for="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`id="${id}"`)
    expect(html).toContain('아이디')
    expect(html).toContain(koAuthLabels.loginIdHint(4, 20))
    expect(html).toMatch(new RegExp(`aria-describedby="[^"]*${id}-hint`))
  })
  it('keeps one polite live region for the status line, tied to the input too', () => {
    const statusId = /<p id="([^"]+)" aria-live="polite"/.exec(html)?.[1]
    expect(statusId).toBeTruthy()
    expect(html).toMatch(new RegExp(`aria-describedby="[^"]*${statusId}`))
  })
})

describe('LoginIdField — the five states, in words', () => {
  it('format wrong: silent until the field was left, then the problem sits beside the field', () => {
    const quiet = render('ab')
    expect(quiet).not.toContain(koAuthLabels.problemLoginIdSize(4, 20))
    expect(quiet).not.toContain('role="alert"')
    const shown = render('ab', { touched: true })
    expect(shown).toContain(koAuthLabels.problemLoginIdSize(4, 20))
    expect(shown).toMatch(/role="alert"[^>]*>[^<]*아이디는 4~20자/)
    expect(shown).toContain('aria-invalid="true"')
  })

  it('checking: says so in words', () => {
    expect(render('sumin')).toContain('확인하는 중…')
  })

  it('available: says so; with capitals it also says what will be saved', () => {
    const plain = render('sumin.kim', { answers: { 'sumin.kim': 'available' } })
    expect(plain).toContain('쓸 수 있는 아이디예요')
    expect(plain).not.toContain('(으)로 저장돼요')
    const capitals = render('Sumin.Kim', { answers: { 'sumin.kim': 'available' } })
    expect(capitals).toContain('쓸 수 있는 아이디예요')
    expect(capitals).toContain('sumin.kim (으)로 저장돼요')
  })

  it('taken: the error sits beside the field at once, not as a status line', () => {
    const html = render('admin', { answers: { admin: 'taken' } })
    expect(html).toMatch(/role="alert"[^>]*>이미 쓰고 있거나 쓸 수 없는 아이디예요/)
    expect(html).not.toContain('쓸 수 있는 아이디예요')
  })

  it('could not check: says it will be checked on submit', () => {
    expect(render('sumin', { answers: { sumin: 'unknown' } })).toContain(
      '지금은 확인할 수 없어요. 내면 확인해 드려요.',
    )
  })

  it('a server error from the parent (409 · field error) goes beside the field and wins', () => {
    const html = render('sumin', {
      answers: { sumin: 'available' },
      serverError: '서버가 거절했어요',
    })
    expect(html).toMatch(/role="alert"[^>]*>서버가 거절했어요/)
    expect(html).not.toContain('쓸 수 있는 아이디예요') // 거절된 칸에 「쓸 수 있다」를 같이 말하지 않는다
  })

  it('every state has a glyph that screen readers skip, so colour is never the only sign', () => {
    const cases: LoginIdAnswers[] = [{}, { sumin: 'available' }, { sumin: 'unknown' }]
    for (const answers of cases) {
      expect(render('sumin', { answers })).toMatch(/aria-hidden="true"[^>]*>[✓○!]/)
    }
  })
})

describe('useLoginIdAvailability on the server', () => {
  it('starts as "checking" for a well-formed value and asks nothing while rendering', () => {
    const checkLoginId = vi.fn()
    function Probe({ value }: { value: string }) {
      const check = useLoginIdAvailability({ api: { checkLoginId }, value, rules })
      return <p>{`${check.status}|${check.normalized}|${check.canSubmit}`}</p>
    }
    expect(renderToStaticMarkup(<Probe value=" Sumin " />)).toBe('<p>checking|sumin|true</p>')
    expect(renderToStaticMarkup(<Probe value="x" />)).toBe('<p>invalid|x|false</p>')
    expect(checkLoginId).not.toHaveBeenCalled()
  })
})
