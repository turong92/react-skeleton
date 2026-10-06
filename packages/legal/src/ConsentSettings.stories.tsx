import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { expect, screen, waitFor, within } from 'storybook/test'
import { ConsentSettings } from './ConsentSettings'
import { koLegalLabels } from './labels'
import { createFakeLegalApi, type FakeLegalOptions } from './stories/fakeLegalApi'
import { WithQuery } from './stories/WithQuery'

/** 설정의 약관 동의 절 — 문서마다 상태 · 동의한 판 · 보기, 선택 동의 켜고 끄기(철회), 이력 */
function Demo({ fake }: { fake?: FakeLegalOptions }) {
  const api = useMemo(() => createFakeLegalApi(fake), [fake])
  return (
    <WithQuery>
      <ConsentSettings api={api} locale="ko" labels={koLegalLabels} />
    </WithQuery>
  )
}

const meta = { title: 'Packages/Legal/Consent settings', component: Demo } satisfies Meta<
  typeof Demo
>
export default meta
type Story = StoryObj<typeof meta>

export const RequiredCannotBeWithdrawn: Story = {
  args: { fake: { marketing: 'agreed' } },
  play: async ({ canvas }) => {
    const section = within(await canvas.findByRole('region', { name: '약관 동의' }))
    await expect(await section.findByText('이용약관')).toBeVisible()
    await expect(section.getAllByText(/서비스 이용에 필요한 동의예요/)).toHaveLength(2) // 필수 둘에는 스위치가 없다
    await expect(section.getAllByRole('switch')).toHaveLength(1) // 선택(마케팅)만
  },
}

export const WithdrawAndAgreeAgainMarketing: Story = {
  args: { fake: { marketing: 'agreed' } },
  play: async ({ canvas, userEvent }) => {
    const sw = await canvas.findByRole('switch', { name: '마케팅 정보 수신 동의' })
    await expect(sw).toBeChecked()
    await userEvent.click(sw)
    await waitFor(() =>
      expect(canvas.getByRole('switch', { name: '마케팅 정보 수신 동의' })).not.toBeChecked(),
    )
    await expect(canvas.getByText('철회함')).toBeVisible()
    await userEvent.click(canvas.getByRole('switch', { name: '마케팅 정보 수신 동의' }))
    await waitFor(() =>
      expect(canvas.getByRole('switch', { name: '마케팅 정보 수신 동의' })).toBeChecked(),
    )
  },
}

export const HistoryShowsAgreementAndWithdrawal: Story = {
  args: { fake: { marketing: 'withdrawn' } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '동의 이력' }))
    const table = await canvas.findByRole('table', { name: '동의 이력' })
    await expect(within(table).getAllByText('철회').length).toBeGreaterThan(0)
    await expect(within(table).getAllByText('동의').length).toBeGreaterThan(0)
  },
}

export const ReadTheDocument: Story = {
  args: { fake: {} },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '개인정보 처리방침 보기' }))
    const dialog = await screen.findByRole('dialog', { name: '개인정보 처리방침' })
    await expect(await within(dialog).findByText(/수집하는 항목/)).toBeVisible()
  },
}
