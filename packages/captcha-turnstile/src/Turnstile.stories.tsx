import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, waitFor } from 'storybook/test'
import { attachTurnstileToken } from './attach'
import { createFakeTurnstile } from './stories/fakeTurnstile'
import { Turnstile } from './Turnstile'
import { useTurnstileToken } from './useTurnstileToken'

/**
 * Cloudflare Turnstile 위젯. 이 스토리는 스크립트 대신 가짜 `loader` 를 끼운다 — `solve()` 가 사람이 위젯을 푼 것처럼 토큰을 준다.
 * 정본 사용법: `useTurnstileToken()` 이 토큰을 들고 있고, 토큰이 `null` 인 동안은 제출 버튼을 막는다. 제출에는 `attachTurnstileToken`.
 */
function Form({ fake }: { fake: ReturnType<typeof createFakeTurnstile> }) {
  const captcha = useTurnstileToken()
  const [sent, setSent] = useState<string>()
  return (
    <>
      <Turnstile siteKey="demo-site-key" loader={fake.loader} {...captcha.widgetProps} />
      <p>
        Token: <output aria-label="Token">{captcha.token ?? 'none'}</output>
      </p>
      <Button
        disabled={captcha.token === null}
        onClick={() => {
          setSent(JSON.stringify(attachTurnstileToken({ email: 'a@b.c' }, captcha.token ?? '')))
          captcha.reset()
        }}
      >
        Submit
      </Button>
      {sent && <pre aria-label="Sent body">{sent}</pre>}
      <Button variant="secondary" size="sm" onClick={fake.solve}>
        Solve widget (fake)
      </Button>
      <Button variant="ghost" size="sm" onClick={fake.expire}>
        Expire token
      </Button>
    </>
  )
}

const meta = {
  title: 'Packages/captcha-turnstile/Turnstile',
  component: Turnstile,
  args: { siteKey: 'demo-site-key', onToken: () => undefined },
} satisfies Meta<typeof Turnstile>
export default meta
type Story = StoryObj<typeof meta>

export const SolveSubmitAndExpire: Story = {
  render: () => <Form fake={createFakeTurnstile()} />,
  play: async ({ canvas, userEvent }) => {
    const submit = canvas.getByRole('button', { name: 'Submit' })
    // 위젯이 그려질 때까지 기다린 뒤: 토큰이 없는 동안은 제출이 막힌다
    await waitFor(() => expect(document.querySelector('[data-turnstile]')).not.toBeNull())
    await expect(submit).toBeDisabled()
    await userEvent.click(canvas.getByRole('button', { name: 'Solve widget (fake)' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Token')).toHaveTextContent('fake-turnstile-token'),
    )
    await expect(submit).toBeEnabled()
    // 만료되면 다시 막힌다
    await userEvent.click(canvas.getByRole('button', { name: 'Expire token' }))
    await expect(submit).toBeDisabled()
    await userEvent.click(canvas.getByRole('button', { name: 'Solve widget (fake)' }))
    await waitFor(() => expect(submit).toBeEnabled())
    await userEvent.click(submit)
    await expect(canvas.getByLabelText('Sent body')).toHaveTextContent('cf-turnstile-response')
    // 토큰은 한 번만 쓰인다 — 제출 뒤에는 비워진다
    await expect(canvas.getByLabelText('Token')).toHaveTextContent('none')
  },
}
