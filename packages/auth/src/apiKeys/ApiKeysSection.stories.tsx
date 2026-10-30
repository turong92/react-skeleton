import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { koAuthLabels } from '../screens/labels.ko'
import type { ReauthSubject } from '../reauth/kind'
import {
  createFakeApiKeysApi,
  FAKE_KEY_PASSWORD,
  FAKE_KEY_TOKEN,
  FAKE_SCOPE_LABELS,
} from '../stories/fakeApiKeysApi'
import { WithQuery } from '../stories/WithQuery'
import { ApiKeysSection } from './ApiKeysSection'
import { koApiKeysLabels } from './labels'

/**
 * 내 API 키 — 설정 구역. 목록(상태 · 범위 · 만료 · 마지막 사용, 운영자가 회수한 키는 「운영자가 회수」),
 * 「키 만들기」(이름 · 범위 · 만료 · 다시 인증 → 토큰을 **한 번만** 보여 주고 복사), 「회수」 확인.
 * 범위 이름은 앱이 `scopeLabels` 로 정한다. 앱이 키 수명 상한(`maxLifetimeDays`)을 두면 「없음」이 숨는다. 설정 화면(Patterns/설정)의 줄 모양을 따른다
 */
const subject: ReauthSubject = { hasPassword: true, email: 'ann@example.com', providers: [] }

const meta = {
  title: 'Packages/auth/ApiKeysSection',
  component: ApiKeysSection,
  parameters: { layout: 'padded' },
  args: {
    api: createFakeApiKeysApi().api,
    subject,
    scopeLabels: FAKE_SCOPE_LABELS,
    labels: koApiKeysLabels,
    authLabels: koAuthLabels,
    now: () => Date.parse('2026-10-31T00:00:00Z'),
  },
  decorators: [
    (Story) => (
      <WithQuery>
        <Story />
      </WithQuery>
    ),
  ],
} satisfies Meta<typeof ApiKeysSection>
export default meta
type Story = StoryObj<typeof meta>

export const List: Story = {
  render: (args) => <ApiKeysSection {...args} api={createFakeApiKeysApi().api} />,
  play: async ({ canvas }) => {
    await canvas.findByText('CI 서버')
    await expect(canvas.getAllByText('범위: 노트 읽기').length).toBeGreaterThan(0)
    await expect(canvas.getByText('사용 중')).toBeVisible()
    await expect(canvas.getByText('만료')).toBeVisible()
    // 회수된 키: 운영자가 회수 / 내가 회수
    await expect(canvas.getByText('운영자가 회수')).toBeVisible()
    await expect(canvas.getByText('내가 회수')).toBeVisible()
    // 활성 키에만 회수 단추(눌리는 단추)가 있다
    await expect(canvas.getAllByRole('button', { name: /회수$/ })).toHaveLength(1)
  },
}

export const CreateShowsTheTokenOnce: Story = {
  render: (args) => <ApiKeysSection {...args} api={createFakeApiKeysApi().api} />,
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('CI 서버')
    await userEvent.click(canvas.getByRole('button', { name: '키 만들기' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'API 키 만들기' }))
    const submit = dialog.getByRole('button', { name: '키 만들기' })
    await expect(submit).toBeDisabled()
    await userEvent.type(dialog.getByLabelText(/^이름/), '배포 봇')
    await userEvent.click(await dialog.findByRole('checkbox', { name: /노트 읽기/ }))
    await userEvent.type(dialog.getByLabelText(/^현재 비밀번호/), FAKE_KEY_PASSWORD)
    await waitFor(() => expect(submit).toBeEnabled())
    await userEvent.click(submit)
    // 토큰은 이 한 번만 - 복사 단추와 「다시 볼 수 없어요」
    const token = await screen.findByTestId('api-key-token')
    await expect(token).toHaveTextContent(FAKE_KEY_TOKEN)
    await expect(screen.getByText('이 키는 다시 볼 수 없어요.')).toBeVisible()
    await expect(screen.getByRole('button', { name: '복사' })).toBeVisible()
    // 닫으면 토큰은 화면에 없다(캐시는 queries.test.ts) - 다시 열어도 처음 입력 단계다
    await userEvent.click(screen.getByRole('button', { name: '복사했어요' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(screen.queryByText(FAKE_KEY_TOKEN)).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: '키 만들기' }))
    const again = within(await screen.findByRole('dialog', { name: 'API 키 만들기' }))
    await expect(again.getByLabelText(/^이름/)).toHaveValue('')
    await expect(screen.queryByTestId('api-key-token')).toBeNull()
    // 새 키가 목록에 있다
    await userEvent.click(again.getByRole('button', { name: '취소' }))
    await expect(await canvas.findByText('배포 봇')).toBeVisible()
  },
}

export const WrongPassword: Story = {
  render: (args) => <ApiKeysSection {...args} api={createFakeApiKeysApi().api} />,
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('CI 서버')
    await userEvent.click(canvas.getByRole('button', { name: '키 만들기' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'API 키 만들기' }))
    await userEvent.type(dialog.getByLabelText(/^이름/), '봇')
    await userEvent.click(await dialog.findByRole('checkbox', { name: /노트 읽기/ }))
    await userEvent.type(dialog.getByLabelText(/^현재 비밀번호/), 'nope')
    await userEvent.click(dialog.getByRole('button', { name: '키 만들기' }))
    await expect(await dialog.findByText(koAuthLabels.errorCurrentPassword)).toBeVisible()
    await expect(screen.queryByTestId('api-key-token')).toBeNull()
  },
}

export const LimitReached: Story = {
  render: (args) => <ApiKeysSection {...args} api={createFakeApiKeysApi({ limit: 1 }).api} />,
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('CI 서버')
    await userEvent.click(canvas.getByRole('button', { name: '키 만들기' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'API 키 만들기' }))
    await userEvent.type(dialog.getByLabelText(/^이름/), '봇')
    await userEvent.click(await dialog.findByRole('checkbox', { name: /노트 읽기/ }))
    await userEvent.type(dialog.getByLabelText(/^현재 비밀번호/), FAKE_KEY_PASSWORD)
    await userEvent.click(dialog.getByRole('button', { name: '키 만들기' }))
    await expect(await dialog.findByText(/한도에 닿았어요/)).toBeVisible()
  },
}

export const ExpiryHidesNeverUnderACap: Story = {
  render: (args) => (
    <ApiKeysSection {...args} api={createFakeApiKeysApi().api} maxLifetimeDays={365} />
  ),
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('CI 서버')
    await userEvent.click(canvas.getByRole('button', { name: '키 만들기' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'API 키 만들기' }))
    const options = within(dialog.getByLabelText('만료')).getAllByRole('option')
    await expect(options.map((o) => o.textContent)).toEqual(['30일 뒤', '90일 뒤', '365일 뒤'])
  },
}

export const ExpiryOffersNeverWithoutACap: Story = {
  render: (args) => <ApiKeysSection {...args} api={createFakeApiKeysApi().api} />,
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('CI 서버')
    await userEvent.click(canvas.getByRole('button', { name: '키 만들기' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'API 키 만들기' }))
    const options = within(dialog.getByLabelText('만료')).getAllByRole('option')
    await expect(options.map((o) => o.textContent)).toEqual([
      '30일 뒤',
      '90일 뒤',
      '365일 뒤',
      '없음',
    ])
  },
}

export const RevokeConfirm: Story = {
  render: (args) => <ApiKeysSection {...args} api={createFakeApiKeysApi().api} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'CI 서버 회수' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'CI 서버 키를 회수할까요?' }))
    await userEvent.click(dialog.getByRole('button', { name: '회수' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'CI 서버 회수' })).toBeNull())
    await expect(canvas.getAllByText('내가 회수')).toHaveLength(2)
  },
}
