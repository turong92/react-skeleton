import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { koLegalLabels } from './labels'
import { SignUpConsents, type ConsentSlot } from './SignUpConsents'
import { createFakeLegalApi, type FakeLegalOptions } from './stories/fakeLegalApi'
import { WithQuery } from './stories/WithQuery'

/**
 * 가입 폼의 동의 자리 — 서버의 문서 목록으로 체크박스를 만들고, 체크한 줄(종류 · 판 · 언어)을 슬롯으로 올린다.
 * `@skeleton/auth` 의 `SignUpScreen.renderConsents` 에 그대로 꽂는다.
 */
function Demo({
  fake,
  slot,
  locale = 'ko',
}: {
  fake?: FakeLegalOptions
  slot: ConsentSlot
  locale?: string
}) {
  const api = useMemo(() => createFakeLegalApi(fake), [fake])
  return (
    <WithQuery>
      <SignUpConsents api={api} slot={slot} locale={locale} labels={koLegalLabels} />
    </WithQuery>
  )
}

const slot = (): ConsentSlot => ({ onChange: fn(), showError: false, refreshKey: 0 })

const meta = {
  title: 'Packages/Legal/Sign-up consents',
  component: Demo,
  args: { slot: slot() },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const RequiredBlockOptionalDoesNot: Story = {
  args: { slot: slot() },
  play: async ({ canvas, args, userEvent }) => {
    await expect(await canvas.findByRole('checkbox', { name: /\[필수\] 이용약관/ })).toBeVisible()
    await waitFor(
      () => expect(args.slot.onChange).toHaveBeenLastCalledWith([], false), // 필수를 체크하기 전에는 제출 불가
    )
    await userEvent.click(canvas.getByRole('checkbox', { name: /\[필수\] 이용약관/ }))
    await userEvent.click(canvas.getByRole('checkbox', { name: /\[필수\] 개인정보/ }))
    await waitFor(() =>
      expect(args.slot.onChange).toHaveBeenLastCalledWith(
        [
          { id: 'terms', version: '2026-10-01', locale: 'ko' },
          { id: 'privacy', version: '2026-10-01', locale: 'ko' },
        ],
        true, // 선택(마케팅)은 안 켜도 제출된다 — 요청에도 안 들어간다
      ),
    )
  },
}

export const AgreeAllIncludesTheOptionalOneWithItsVersion: Story = {
  args: { slot: slot() },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(await canvas.findByRole('checkbox', { name: '전체 동의' }))
    await waitFor(() =>
      expect(args.slot.onChange).toHaveBeenLastCalledWith(
        expect.arrayContaining([{ id: 'marketing', version: 'v3', locale: 'ko' }]),
        true,
      ),
    )
  },
}

export const ReadingTheDocumentInADialog: Story = {
  args: { slot: slot() },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '이용약관 보기' }))
    const dialog = await screen.findByRole('dialog', { name: '이용약관' })
    await expect(await within(dialog).findByText(/샘플 서비스/)).toBeVisible() // 서버의 마크다운이 그려진다
    await expect(within(dialog).getByText(/2026-10-01 판/)).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  },
}

export const EnglishUsesTheEnglishTexts: Story = {
  args: { slot: slot(), locale: 'en' },
  render: (args) => <Demo {...args} />,
  play: async ({ canvas, args }) => {
    await expect(await canvas.findByRole('checkbox', { name: /Terms of Service/ })).toBeVisible()
    await waitFor(() => expect(args.slot.onChange).toHaveBeenCalled())
  },
}

export const BackendWithoutTheModuleShowsNothingAndDoesNotBlock: Story = {
  args: { slot: slot(), fake: { noModule: true } },
  play: async ({ canvas, args }) => {
    await waitFor(() => expect(args.slot.onChange).toHaveBeenLastCalledWith([], true)) // 404 = 동의가 필요 없는 백엔드
    await expect(canvas.queryByRole('checkbox')).toBeNull()
  },
}

/** 출시된 백엔드는 모르는 경로를 **401** 로 답한다(공개 경로가 아니라서) — 404 만 「모듈 없음」으로 읽으면 가입이 막힌다(e2e 로 확인) */
export const BackendAnswering401ForTheUnknownPathDoesNotBlockEither: Story = {
  args: { slot: slot(), fake: { noModule: 401 } },
  play: async ({ canvas, args }) => {
    await waitFor(() => expect(args.slot.onChange).toHaveBeenLastCalledWith([], true))
    await expect(canvas.queryByRole('checkbox')).toBeNull()
    await expect(canvas.queryByText('약관을 불러오지 못했어요.')).toBeNull()
  },
}

export const FailedLoadBlocksAndOffersRetry: Story = {
  args: { slot: slot(), fake: { documentsFail: true } },
  play: async ({ canvas, args }) => {
    await expect(await canvas.findByText('약관을 불러오지 못했어요.')).toBeVisible()
    await expect(args.slot.onChange).toHaveBeenLastCalledWith([], false)
    await expect(canvas.getByRole('button', { name: '다시 시도' })).toBeVisible()
  },
}
