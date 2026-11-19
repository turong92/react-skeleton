import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@skeleton/ui'
import { expect, within } from 'storybook/test'
import { ManagerDemo as Demo } from './stories/ManagerDemo'
import { profile } from './test/fixtures'
import type { ProfilePicturePicker } from './types'

/**
 * 닉네임마다 따로인 사진 - 고르는 칸은 앱이 꽂는다(`picturePicker`, 보통 `ImageUploadField max={1}`). 서버가 사진 기능을 켰을 때만(프로필에 `avatarKey` 키가 있음) 줄마다 「사진」 단추가 생기고,
 * 올리거나 지우면 바로 저장한다. 서버가 거절하면(400) 줄 안에서 우리 문구로 말한다. 여기서는 단추로 업로드 결과를 흉내 낸다.
 */
const fakePicker: ProfilePicturePicker = ({ value, onChange }) => (
  <div>
    <p>{`picked: ${value ?? 'none'}`}</p>
    <Button variant="secondary" size="sm" onClick={() => onChange('uploads/o/new/file.png')}>
      Pick photo
    </Button>
    <Button variant="secondary" size="sm" onClick={() => onChange('uploads/o/bad/file.png')}>
      Pick unusable photo
    </Button>
    <Button variant="secondary" size="sm" onClick={() => onChange(null)}>
      Remove photo
    </Button>
  </div>
)

const ann = { ...profile('prf_a', 'Ann', '0001'), avatarKey: null }
const bea = { ...profile('prf_b', 'Bea', '0002'), avatarKey: null }

const meta = {
  title: 'Packages/author-profile/AuthorProfileManager/Pictures',
  component: Demo,
  parameters: { layout: 'padded' },
  args: { profiles: [ann, bea], picturePicker: fakePicker },
  render: (args) => <Demo {...args} />,
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const PictureButtonPerRow: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('button', { name: 'Change picture of Ann#0001' }),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Change picture of Bea#0002' })).toBeVisible()
  },
}

/** 서버가 사진 기능을 켜지 않았으면(프로필에 `avatarKey` 키 없음) 앱이 칸을 꽂아도 단추가 없다 */
export const NoPictureButtonWithoutServerSupport: Story = {
  args: { profiles: [profile('prf_a', 'Ann', '0001')] },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Change Ann#0001' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /picture/i })).toBeNull()
  },
}

export const PickingSavesAtOnce: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Change picture of Ann#0001' }))
    const panel = within(await canvas.findByRole('group', { name: 'Picture of Ann#0001' }))
    await expect(panel.getByText('picked: none')).toBeVisible()
    await userEvent.click(panel.getByRole('button', { name: 'Pick photo' }))
    await expect(await panel.findByText('picked: uploads/o/new/file.png')).toBeVisible()
    await userEvent.click(panel.getByRole('button', { name: 'Remove photo' }))
    await expect(await panel.findByText('picked: none')).toBeVisible()
  },
}

/** 서버가 거절하면(필드 없는 400) 그 줄에서만 우리 문구로 말한다 - 다른 줄로 새지 않는다 */
export const RejectedPictureIsSaidOnItsOwnRow: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Change picture of Ann#0001' }))
    const panel = within(await canvas.findByRole('group', { name: 'Picture of Ann#0001' }))
    await userEvent.click(panel.getByRole('button', { name: 'Pick unusable photo' }))
    await expect(await panel.findByText(/This photo cannot be used/)).toBeVisible()
    await expect(canvas.getAllByText(/This photo cannot be used/)).toHaveLength(1)
  },
}

/** 변환 중이면(`avatar.pending`) 「준비하고 있어요」 */
export const PendingPictureSaysSo: Story = {
  args: { pendingAvatar: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Change picture of Ann#0001' }))
    const panel = within(await canvas.findByRole('group', { name: 'Picture of Ann#0001' }))
    await userEvent.click(panel.getByRole('button', { name: 'Pick photo' }))
    await expect(await panel.findByText(/Your picture is being prepared/)).toBeVisible()
  },
}

/** 이름 바꾸기를 열어도 사진 칸은 그대로 달려 있다 - 언마운트하면 올리던 사진이 취소된다(회귀) */
export const OpeningRenameKeepsThePictureMounted: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Change picture of Ann#0001' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Change Ann#0001' }))
    await expect(canvas.getByRole('group', { name: 'Picture of Ann#0001' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Change picture of Ann#0001' })).toBeVisible()
  },
}
