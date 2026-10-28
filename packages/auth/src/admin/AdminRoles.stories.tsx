import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { ApiRequestError } from '@skeleton/api-client'
import { createFakeRolesApi, fakeRoles } from '../stories/fakeRolesApi'
import { koAdminRolesLabels } from './rolesLabels'
import { AdminRoles } from './AdminRoles'
import type { AdminRole, AdminRolesApi } from './rolesApi'

/**
 * 역할 관리 표(`@skeleton/auth/admin` - 선택). 목록 · 만들기 · 고치기 · 지우기, 권한은 모듈별 체크 묶음(모르는 키는 키 그대로).
 * 전권 역할(`protected`)은 단추가 잠기고 이유가 옆에 적힌다. 서버 오류 `AUTHZ.*` 는 창 안에 코드별 문장으로 보인다.
 * 백엔드 `skeleton.authz.admin.enabled=true` + `authz.roles` 권한일 때만 열린다.
 */
function Demo({
  prepare,
  callerPermissions,
  roles,
}: {
  prepare?: (api: ReturnType<typeof createFakeRolesApi>) => void
  callerPermissions?: string[]
  roles?: AdminRole[]
}) {
  const api = useMemo(() => {
    const created = createFakeRolesApi(roles)
    prepare?.(created)
    return created
  }, [prepare, roles])
  return <AdminRoles api={api} callerPermissions={callerPermissions} />
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

/** 내게 없는 권한(`board.moderate`)의 체크 상자는 잠기고(켜기도 끄기도 못 한다) 이유가 보이며, 그런 권한을 가진 역할은 지울 수 없다(서버도 403) */
export const PermissionsBeyondMineAreLocked: Story = {
  render: () => <Demo callerPermissions={['authz.roles', 'payment.read']} />,
  play: async ({ canvas, userEvent }) => {
    const del = await canvas.findByRole('button', { name: 'Delete MODERATOR' })
    await expect(del).toHaveAttribute('aria-disabled', 'true')
    await expect(del).toHaveAccessibleDescription(
      'It has permissions you do not hold, so you cannot delete it.',
    )
    await expect(canvas.getByRole('button', { name: 'Delete EMPTY' })).not.toHaveAttribute(
      'aria-disabled',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Edit MODERATOR' }))
    const dialog = within(await canvas.findByRole('dialog', { name: 'Edit MODERATOR' }))
    const mine = dialog.getByLabelText('Hide posts and comments')
    await expect(mine).toBeDisabled()
    await expect(mine).toBeChecked()
    await expect(mine).toHaveAccessibleDescription(
      'You do not hold this permission, so you cannot change it.',
    )
    await expect(dialog.getByLabelText('View payments')).toBeEnabled()
  },
}

/** 위계: STAFF 가 CS 를 포함한다 - CS 의 권한은 STAFF 창에서 체크 · 잠금 · 「CS에서 물려받음」 으로 보이고, 표에는 포함하는 역할이 알약으로 */
const hierarchy = (): AdminRole[] => [
  ...fakeRoles(),
  {
    name: 'CS',
    description: 'Support',
    permissions: ['payment.read', 'payment.refund'],
    protected: false,
    holders: 0,
  },
  {
    name: 'STAFF',
    description: 'Staff',
    permissions: ['board.moderate'],
    protected: false,
    holders: 0,
    includes: ['CS'],
  },
]

export const InheritedPermissionsAreLocked: Story = {
  render: () => <Demo roles={hierarchy()} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Edit STAFF' }))
    const dialog = within(await canvas.findByRole('dialog', { name: 'Edit STAFF' }))
    await expect(dialog.getByLabelText('CS')).toBeChecked()
    const inherited = dialog.getByLabelText('View payments')
    await expect(inherited).toBeChecked()
    await expect(inherited).toBeDisabled()
    await expect(inherited).toHaveAccessibleDescription('Inherited from CS')
    await expect(dialog.getByLabelText('Hide posts and comments')).toBeEnabled()
  },
}

/** 이미 STAFF 가 CS 를 포함하니 CS 창에서 STAFF 는 고를 수 없다 - 이유가 옆에 적힌다(서버도 409 ROLE_CYCLE) */
export const CycleCandidateIsDisabledWithReason: Story = {
  render: () => <Demo roles={hierarchy()} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Edit CS' }))
    const dialog = within(await canvas.findByRole('dialog', { name: 'Edit CS' }))
    const staff = dialog.getByLabelText('STAFF')
    await expect(staff).toBeDisabled()
    await expect(staff).toHaveAccessibleDescription(
      'It already includes this role, so including it would make a loop.',
    )
    await expect(dialog.queryByLabelText('CS')).toBeNull()
  },
}

/** 포함 역할을 고르고 저장하면 PUT 본문에 includes 가 실리고, 그 권한은 물려받은 것이라 own 권한으로는 보내지 않는다 */
export const SaveSendsIncludes: Story = {
  render: () => {
    const prepare = (api: ReturnType<typeof createFakeRolesApi>) => {
      const update = api.update
      api.update = async (name, input) => {
        lastUpdate = input
        return update(name, input)
      }
    }
    return <Demo roles={hierarchy()} prepare={prepare} />
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Edit EMPTY' }))
    const dialog = within(await canvas.findByRole('dialog', { name: 'Edit EMPTY' }))
    await userEvent.click(dialog.getByLabelText('CS'))
    await expect(dialog.getByLabelText('View payments')).toBeChecked()
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await expect(lastUpdate).toEqual({ description: '', permissions: [], includes: ['CS'] })
  },
}
let lastUpdate: unknown

/** 다른 역할이 포함 중인 역할을 지우면 409 ROLE_INCLUDED - 이유가 창 안에 보인다 */
export const DeleteIncludedRoleSaysWhy: Story = {
  render: () => <Demo roles={hierarchy()} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Delete CS' }))
    const dialog = within(await canvas.findByRole('dialog', { name: 'Delete CS?' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }))
    await expect(await dialog.findByText(/Another role includes this one/)).toBeVisible()
  },
}
