import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { ProviderDemo } from './stories/Demos'

/**
 * 주소의 slug 를 워크스페이스로 푼다 — 풀린 뒤에만 앱을 그리고, 그때 팀 id 를 요청 헤더 쪽(`createWorkspaceHeaders`)에 싣는다.
 * 옛 slug 로 들어오면 앱이 주소를 바꾸도록 `onCanonicalSlug(지금 slug)` 를 부른다. 멤버가 아니면(없는 팀과 같은 404) 「찾을 수 없음」
 */
const meta = {
  title: 'Packages/workspace/WorkspaceProvider',
  component: ProviderDemo,
  parameters: { layout: 'padded' },
  args: { slug: 'acme' },
} satisfies Meta<typeof ProviderDemo>
export default meta
type Story = StoryObj<typeof meta>

export const ResolvesTheAddressAndSetsTheHeaderBeforeTheAppAsks: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('app:Acme')).toBeVisible()
    await expect(canvas.getByText('header:{"X-Workspace-Id":"ws_1"}')).toBeVisible()
    await expect(canvas.getByRole('status', { name: 'log' })).toHaveTextContent('remember:acme')
    await expect(canvas.getByRole('status', { name: 'log' })).not.toHaveTextContent('address:')
  },
}

export const AnOtherTeamOtherHeader: Story = {
  args: { slug: 'globex' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('app:Globex')).toBeVisible()
    await expect(canvas.getByText('header:{"X-Workspace-Id":"ws_2"}')).toBeVisible()
  },
}

export const AnOldAddressIsSwappedForTheCurrentOne: Story = {
  args: { slug: 'acme-old' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('app:Acme')).toBeVisible()
    await expect(canvas.getByRole('status', { name: 'log' })).toHaveTextContent('address:acme')
    await expect(canvas.getByRole('status', { name: 'log' })).toHaveTextContent('remember:acme')
  },
}

export const NotAMemberLooksLikeMissing: Story = {
  args: { slug: 'initech' },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: '워크스페이스를 찾을 수 없어요' }),
    ).toBeVisible()
    await expect(canvas.queryByText(/^app:/)).toBeNull()
    await expect(canvas.queryByText(/^header:/)).toBeNull()
  },
}
