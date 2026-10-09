import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Button } from '../Button/Button'
import { SettingsGroup, SettingsRow } from './SettingsRow'

/**
 * 설정의 카드 한 장(`SettingsGroup`)과 그 안의 항목 한 줄(`SettingsRow`) - 왼쪽 이름, 가운데 현재 값, 오른쪽 테두리 단추.
 * 좁은 화면에서는 이름이 위, 값과 단추가 아래 줄로 접힌다. 긴 설명 · 입력은 줄에 두지 않고 단추가 여는 대화상자에 둔다.
 */
const meta = {
  title: 'UI/SettingsRow',
  component: SettingsGroup,
  args: { id: 'security', title: 'Sign-in & security', children: null },
} satisfies Meta<typeof SettingsGroup>
export default meta
type Story = StoryObj<typeof meta>

export const Rows: Story = {
  render: (args) => (
    <SettingsGroup {...args}>
      <SettingsRow
        label="Password"
        value="In use"
        action={
          <Button variant="secondary" size="sm">
            Change
          </Button>
        }
      />
      <SettingsRow
        label="Delete account"
        action={
          <Button variant="danger" size="sm">
            Delete my account
          </Button>
        }
      >
        <p>Saved</p>
      </SettingsRow>
    </SettingsGroup>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region', { name: 'Sign-in & security' })).toBeVisible()
    const row = canvas.getByRole('group', { name: 'Password' })
    await expect(row).toHaveTextContent('In use')
    // 쉬는 상태에서도 테두리가 있는 단추다(글자만 있는 단추 금지)
    await expect(canvas.getByRole('button', { name: 'Change' })).toHaveAttribute(
      'data-variant',
      'secondary',
    )
    await expect(canvas.getByText('Saved')).toBeVisible()
  },
}
