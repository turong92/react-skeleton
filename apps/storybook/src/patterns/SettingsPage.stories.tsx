import { Button, Card, Dialog, Field, Input, PageHeader, Select, Switch } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type FormEvent } from 'react'
import { expect, fn, screen, waitFor } from 'storybook/test'

/*
 * 설정 화면 틀 — 즉시 적용되는 스위치 · 저장 버튼이 있는 프로필 폼 · 위험 구역(확인 대화상자).
 * 즉시 적용(Switch)과 모아서 저장(Field + Save)을 섞지 않는다: 한 카드는 한 방식. 저장 결과는 `role="status"` 한 줄로 알린다.
 * 복사해서 쓸 때: `onToggle` · `onSave` · `onDeleteAccount` 는 각각 `useMutation` 으로 연결한다.
 */
type Profile = { displayName: string; language: string }
type Props = {
  profile: Profile
  onToggle: (key: 'email' | 'push', value: boolean) => void
  onSave: (profile: Profile) => Promise<void>
  onDeleteAccount: () => void
}

const stack = { display: 'grid', gap: 'var(--space-lg)', maxWidth: '40rem' } as const

function SettingsPage({ profile, onToggle, onSave, onDeleteAccount }: Props) {
  const [draft, setDraft] = useState(profile)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await onSave(draft)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={stack}>
      <PageHeader title="Settings" />
      <Card title="Notifications">
        <div style={stack}>
          <Switch
            label="Email"
            description="A weekly summary"
            onChange={(e) => onToggle('email', e.target.checked)}
          />
          <Switch label="Push" onChange={(e) => onToggle('push', e.target.checked)} />
        </div>
      </Card>
      <Card title="Profile">
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
        </form>
      </Card>
      <Card title="Danger zone">
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete account
        </Button>
      </Card>
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
