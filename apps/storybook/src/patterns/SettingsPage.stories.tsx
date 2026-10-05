import {
  Button,
  Dialog,
  ErrorReference,
  Field,
  Input,
  PageHeader,
  RowMenu,
  SectionCard,
  SectionIndex,
  Select,
  SwitchRow,
} from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type FormEvent } from 'react'
import { expect, fn, screen, waitFor } from 'storybook/test'

/*
 * 설정 화면 틀 — 위쪽 목차(SectionIndex) · 즉시 적용 스위치(SwitchRow) · 저장 버튼이 있는 프로필 폼 · 줄마다 ⋯ 메뉴(RowMenu)가 달린 접이식 기기 목록 · 위험 구역(확인 대화상자).
 * 즉시 적용(SwitchRow)과 모아서 저장(Field + Save)을 섞지 않는다: 한 절은 한 방식. 저장 결과는 `role="status"` 한 줄로 알리고,
 * 실패하면 오류 문구 아래에 참조 번호(ErrorReference — 토스트는 사라져도 문의할 번호가 남는다)를 붙인다.
 * 글자는 모두 앱이 번역해 넘긴다(@skeleton/ui 는 prop 만 받는다). 복사해서 쓸 때: `onToggle` · `onSave` · `onSignOut` · `onDeleteAccount` 는 각각 `useMutation` 으로 연결한다.
 */
type Profile = { displayName: string; language: string }
type Props = {
  profile: Profile
  onToggle: (key: 'email' | 'push', value: boolean) => void
  onSave: (profile: Profile) => Promise<void>
  devices: { id: string; name: string; lastSeen: string }[]
  onSignOut: (deviceId: string) => void
  onDeleteAccount: () => void
}

const stack = { display: 'grid', gap: 'var(--space-lg)', maxWidth: '40rem' } as const

function SettingsPage({ profile, onToggle, onSave, devices, onSignOut, onDeleteAccount }: Props) {
  const [email, setEmail] = useState(false)
  const [push, setPush] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setFailure(null)
    try {
      await onSave(draft)
      setSaved(true)
    } catch (error) {
      setFailure(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={stack}>
      <PageHeader title="Settings" />
      <SectionIndex
        label="On this page"
        items={[
          { id: 'notifications', label: 'Notifications' },
          { id: 'profile', label: 'Profile' },
          { id: 'devices', label: 'Devices', count: devices.length },
          { id: 'danger', label: 'Danger zone' },
        ]}
        onJump={(id) => {
          if (id === 'devices') setDevicesOpen(true)
        }}
      />
      <SectionCard id="notifications" title="Notifications">
        <SwitchRow
          id="notify-email"
          title="Email"
          description="A weekly summary"
          checked={email}
          onChange={(next) => {
            setEmail(next)
            onToggle('email', next)
          }}
        />
        <SwitchRow
          id="notify-push"
          title="Push"
          checked={push}
          onChange={(next) => {
            setPush(next)
            onToggle('push', next)
          }}
        />
      </SectionCard>
      <SectionCard id="profile" title="Profile">
        <form onSubmit={save} style={stack} aria-label="Profile">
          <Field label="Display name" required>
            {(control) => (
              <Input
                {...control}
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
              />
            )}
          </Field>
          <Field label="Language">
            {(control) => (
              <Select
                {...control}
                value={draft.language}
                onChange={(e) => setDraft({ ...draft, language: e.target.value })}
              >
                <option value="en">English</option>
                <option value="ko">한국어</option>
              </Select>
            )}
          </Field>
          <div>
            <Button type="submit" loading={saving} loadingLabel="Saving">
              Save changes
            </Button>
          </div>
          {saved && <p role="status">Saved.</p>}
          {failure !== null && (
            <div role="alert" style={{ display: 'grid', gap: 'var(--space-xs)' }}>
              <p>Could not save. Try again, or contact support with this number.</p>
              <ErrorReference error={failure} reference="trace-7f3a9c" />
            </div>
          )}
        </form>
      </SectionCard>
      <SectionCard
        id="devices"
        title="Devices"
        collapsible
        expanded={devicesOpen}
        onToggle={setDevicesOpen}
        summary={`${devices.length} signed in`}
      >
        <ul
          style={{
            display: 'grid',
            gap: 'var(--space-sm)',
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}
        >
          {devices.map((device) => (
            <li
              key={device.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>
                {device.name} · {device.lastSeen}
              </span>
              <RowMenu
                label={`More for ${device.name}`}
                items={[
                  { key: 'sign-out', label: 'Sign out', onSelect: () => onSignOut(device.id) },
                ]}
              />
            </li>
          ))}
        </ul>
      </SectionCard>
      <SectionCard id="danger" title="Danger zone">
        <div>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Delete account
          </Button>
        </div>
      </SectionCard>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete your account?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onDeleteAccount()
                setConfirming(false)
              }}
            >
              Delete account
            </Button>
          </>
        }
      >
        <p>All your projects are deleted too.</p>
      </Dialog>
    </div>
  )
}

const meta = {
  title: 'Patterns/Settings page',
  component: SettingsPage,
  args: {
    profile: { displayName: 'Sumin', language: 'en' },
    onToggle: fn(),
    onSave: fn(async () => undefined),
    devices: [
      { id: 'd1', name: 'Laptop', lastSeen: 'now' },
      { id: 'd2', name: 'Phone', lastSeen: 'yesterday' },
    ],
    onSignOut: fn(),
    onDeleteAccount: fn(),
  },
} satisfies Meta<typeof SettingsPage>
export default meta
// 스토리가 plain 함수로 args 를 덮어쓸 수 있게 컴포넌트 props 로 타입을 잡는다
type Story = StoryObj<typeof SettingsPage>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('switch', { name: 'Email' }))
    await expect(args.onToggle).toHaveBeenCalledWith('email', true)
    await userEvent.click(canvas.getByRole('switch', { name: 'Email' }))
    await expect(args.onToggle).toHaveBeenLastCalledWith('email', false)
  },
}

export const SaveProfile: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const name = canvas.getByLabelText(/Display name/)
    await userEvent.clear(name)
    await userEvent.type(name, 'Sumin Lee')
    await userEvent.selectOptions(canvas.getByLabelText('Language'), 'ko')
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(await canvas.findByRole('status')).toHaveTextContent('Saved.')
    await expect(args.onSave).toHaveBeenCalledWith({ displayName: 'Sumin Lee', language: 'ko' })
  },
}

export const SaveFailsAndKeepsTheReference: Story = {
  args: { onSave: async () => Promise.reject(new Error('Internal error')) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    const alert = await canvas.findByRole('alert')
    await expect(alert).toHaveTextContent('Could not save')
    await expect(alert).toHaveTextContent('trace-7f3a9c')
    await expect(canvas.queryByText('Saved.')).toBeNull()
  },
}

export const SignOutOfADeviceFromItsMenu: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Devices' }))
    await userEvent.click(canvas.getByRole('button', { name: 'More for Phone' }))
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Sign out' }))
    await expect(args.onSignOut).toHaveBeenCalledWith('d2')
    await expect(canvas.getByRole('button', { name: 'More for Phone' })).toHaveFocus()
  },
}

export const IndexOpensTheCollapsedSection: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('Laptop · now')).not.toBeVisible()
    await userEvent.click(canvas.getByRole('link', { name: /Devices/ }))
    await waitFor(() => expect(canvas.getByText('Laptop · now')).toBeVisible())
  },
}

export const SavePending: Story = {
  args: { onSave: () => new Promise<void>(() => undefined) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: /Save changes/ })).toBeDisabled())
  },
}

export const DeleteAccountNeedsConfirmation: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Delete account' }))
    await expect(await screen.findByRole('dialog', { name: 'Delete your account?' })).toBeVisible()
    await expect(args.onDeleteAccount).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(canvas.getByRole('button', { name: 'Delete account' }))
    const confirm = (await screen.findAllByRole('button', { name: 'Delete account' })).at(-1)!
    await userEvent.click(confirm)
    await expect(args.onDeleteAccount).toHaveBeenCalledTimes(1)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  },
}
