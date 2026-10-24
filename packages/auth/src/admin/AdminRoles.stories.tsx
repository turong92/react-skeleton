import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { ApiRequestError } from '@skeleton/api-client'
import { createFakeRolesApi, fakeRoles } from '../stories/fakeRolesApi'
import { koAdminRolesLabels } from './rolesLabels'
import { AdminRoles } from './AdminRoles'
import type { AdminRolesApi } from './rolesApi'

/**
 * 역할 관리 표(`@skeleton/auth/admin` - 선택). 목록 · 만들기 · 고치기 · 지우기, 권한은 모듈별 체크 묶음(모르는 키는 키 그대로).
 * 전권 역할(`protected`)은 단추가 잠기고 이유가 옆에 적힌다. 서버 오류 `AUTHZ.*` 는 창 안에 코드별 문장으로 보인다.
 * 백엔드 `skeleton.authz.admin.enabled=true` + `authz.roles` 권한일 때만 열린다.
 */
function Demo({ prepare }: { prepare?: (api: ReturnType<typeof createFakeRolesApi>) => void }) {
  const api = useMemo(() => {
    const created = createFakeRolesApi()
    prepare?.(created)
    return created
  }, [prepare])
  return <AdminRoles api={api} />
}

const meta = {
  title: 'Patterns/Auth/Admin roles',
  component: AdminRoles,
  args: { api: createFakeRolesApi() },
} satisfies Meta<typeof AdminRoles>
export default meta
type Story = StoryObj<typeof meta>

export const List: Story = {
  render: () => <Demo />,
  play: async ({ canvas }) => {
    const table = within(await canvas.findByRole('table', { name: 'Roles and their permissions' }))
    await expect(table.getByText('MODERATOR')).toBeVisible()
    await expect(table.getByText('Hide posts and comments')).toBeVisible()
    await expect(table.getByText('Everything')).toBeVisible()
  },
}

/** 전권 행: 편집 · 삭제는 `aria-disabled` 로 잠기고(Tab 으로 닿고 눌러도 아무 일 없다) 이유가 적힌다 */
export const FullAccessRowIsLocked: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    const edit = await canvas.findByRole('button', { name: 'Edit ADMIN' })
    await expect(edit).toHaveAttribute('aria-disabled', 'true')
    await expect(edit).toHaveAccessibleDescription(
      'Full-access role - it cannot be changed or deleted.',
    )
    await userEvent.click(edit)
    await expect(canvas.queryByRole('dialog')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Delete ADMIN' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(canvas.getByRole('button', { name: 'Edit MODERATOR' })).not.toHaveAttribute(
      'aria-disabled',
    )
  },
}

/** 만들기: 이름 · 설명 · 체크 두 개 → 저장 → 목록에 보인다 */
export const CreateARole: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Create a role' }))
    const dialog = within(await canvas.findByRole('dialog', { name: 'Create a role' }))
    await userEvent.type(dialog.getByLabelText('Role name'), 'cs')
    await userEvent.type(dialog.getByLabelText('Description'), 'Support')
    await userEvent.click(dialog.getByLabelText('View payments'))
    await userEvent.click(dialog.getByLabelText('Approve and make refunds'))
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    const table = within(await canvas.findByRole('table'))
    await waitFor(() => expect(table.getByText('CS')).toBeVisible())
    await expect(table.getByText('View payments')).toBeVisible()
    await expect(table.getByText('Approve and make refunds')).toBeVisible()
  },
}

export const EditAndSave: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Edit MODERATOR' }))
    const dialog = within(await canvas.findByRole('dialog', { name: 'Edit MODERATOR' }))
    await expect(dialog.getByLabelText('Role name')).toHaveAttribute('readonly')
    await expect(dialog.getByLabelText('Hide posts and comments')).toBeChecked()
    await userEvent.click(dialog.getByLabelText('View payments'))
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await expect(within(await canvas.findByRole('table')).getByText('View payments')).toBeVisible()
  },
}

/** 가진 계정이 있는 역할을 지우면 409 ROLE_IN_USE - 창 안에 이유가 보이고 역할은 그대로 */
export const DeleteInUseSaysWhy: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Delete MODERATOR' }))
    const dialog = within(await canvas.findByRole('dialog', { name: 'Delete MODERATOR?' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }))
    await expect(await dialog.findByText(/Accounts still have this role/)).toBeVisible()
    await expect(within(canvas.getByRole('table')).getByText('MODERATOR')).toBeVisible()
  },
}

export const DeleteAnUnusedRole: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Delete EMPTY' }))
    const dialog = within(await canvas.findByRole('dialog', { name: 'Delete EMPTY?' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(within(canvas.getByRole('table')).queryByText('EMPTY')).toBeNull())
  },
}

export const DuplicateNameSaysSo: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Create a role' }))
    const dialog = within(await canvas.findByRole('dialog', { name: 'Create a role' }))
    await userEvent.type(dialog.getByLabelText('Role name'), 'moderator')
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    await expect(await dialog.findByText('A role with this name already exists.')).toBeVisible()
  },
}

/** 서버만 아는 규칙 - 권한 상승(403) · 자기 잠금(409) - 은 코드마다 다른 문장 */
export const EscalationAndSelfLockout: Story = {
  render: () => <Demo prepare={(api) => api.failNext('AUTHZ.ESCALATION', 403)} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Edit MODERATOR' }))
    const dialog = within(await canvas.findByRole('dialog', { name: 'Edit MODERATOR' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    await expect(
      await dialog.findByText('You can only give a role permissions that you hold yourself.'),
    ).toBeVisible()
  },
}

export const Korean: Story = {
  render: () => <AdminRoles api={createFakeRolesApi(fakeRoles())} labels={koAdminRolesLabels} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: '역할 만들기' })).toBeVisible()
    await expect(canvas.getByText('글 · 댓글 숨기기')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'ADMIN 고치기' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
}

/** 저장된 계정이 더는 권한이 없으면 서버는 403 - 로그아웃 없이 「접근 차단」 */
export const BlockedOperator: Story = {
  render: () => {
    const forbidden = () =>
      Promise.reject(
        new ApiRequestError(
          { code: 'COMMON.FORBIDDEN', title: 'Forbidden', status: 403, timestamp: 't' },
          'trace',
          'span',
          'tp',
        ),
      )
    return (
      <AdminRoles api={{ list: forbidden, permissions: forbidden } as unknown as AdminRolesApi} />
    )
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Access blocked' })).toBeVisible()
  },
}
