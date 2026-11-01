import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { ContactDemo } from './stories/Demos'

/**
 * 문의 · 의견 폼 — 종류 하나 고르기 · 내용(10~2000자) · 답장 받을 이메일(선택) · (필요하면) 앱이 꽂는 사람 확인.
 * 틀린 곳은 한 번 보내 보려 한 뒤부터 칸에서 말하고, 보내고 나면 `onSent({ hasEmail })` — 「잘 받았어요」 화면은 앱이 정한다.
 * 로그인한 사람은 확인된 이메일이 채워지고 사람 확인이 없다.
 */
const meta = {
  title: 'Packages/inquiry/ContactForm',
  component: ContactDemo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ContactDemo>
export default meta
type Story = StoryObj<typeof meta>

export const SendsAKindAndAMessage: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: '제안' }))
    await userEvent.type(
      canvas.getByLabelText(/내용/),
      '다크 모드가 있으면 좋겠어요, 밤에 눈이 아파요',
    )
    await userEvent.type(canvas.getByLabelText(/답장 받을 이메일/), 'me@example.com')
    await userEvent.click(canvas.getByRole('button', { name: '보내기' }))
    await expect(await canvas.findByRole('status', { name: 'log' })).toHaveTextContent(
      'sent:FEATURE:reply',
    )
    await expect(canvas.getByLabelText(/내용/)).toHaveValue('')
  },
}

export const ChecksTheFieldsBeforeSending: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/내용/), '짧아요')
    await userEvent.type(canvas.getByLabelText(/답장 받을 이메일/), 'not-an-email')
    await expect(canvas.queryByText(/자로 적어 주세요/)).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: '보내기' }))
    await expect(await canvas.findByText('10~2000자로 적어 주세요.')).toBeVisible()
    await expect(canvas.getByText('이메일 주소 모양이 아니에요.')).toBeVisible()
    await expect(canvas.getByRole('status', { name: 'log' })).toHaveTextContent('')
  },
}

export const SignedInStartsWithTheVerifiedEmail: Story = {
  args: { signedIn: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByLabelText(/답장 받을 이메일/)).toHaveValue('user@example.com')
    await expect(canvas.getByText('이 문의에 답장하는 데만 써요.')).toBeVisible()
  },
}

export const WaitsForTheHumanCheck: Story = {
  args: { withCaptcha: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      await canvas.findByLabelText(/내용/),
      '사람 확인을 거쳐서 보내는 질문이에요',
    )
    await userEvent.click(canvas.getByRole('button', { name: '보내기' }))
    await expect(
      await canvas.findByText('사람인지 확인하지 못했어요. 다시 시도해 주세요.'),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '사람입니다' }))
    await userEvent.click(canvas.getByRole('button', { name: '보내기' }))
    await expect(await canvas.findByRole('status', { name: 'log' })).toHaveTextContent(
      'sent:QUESTION:no-reply:tok',
    )
  },
}

export const ATooManyAnswerAsksToWait: Story = {
  args: { failWith: 'INQUIRY.TOO_MANY', withCaptcha: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText(/내용/), '너무 자주 보내서 막히는 질문이에요')
    await userEvent.click(canvas.getByRole('button', { name: '사람입니다' }))
    await userEvent.click(canvas.getByRole('button', { name: '보내기' }))
    await expect(
      await canvas.findByText('문의가 너무 잦아요. 잠시 뒤에 다시 보내 주세요.'),
    ).toBeVisible()
    // 사람 확인 토큰은 한 번만 쓰인다 — 실패하면 새로 받는다
    await expect(canvas.getByRole('status', { name: 'log' })).toHaveTextContent('captcha-reset')
  },
}
