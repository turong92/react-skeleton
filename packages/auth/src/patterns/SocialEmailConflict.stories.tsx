import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { SocialCallbackScreen } from '../screens/SocialCallbackScreen'
import { koAuthLabels } from '../screens/labels.ko'
import { apiError } from '../stories/fakeAccountApi'
import { withRouter } from '../stories/withRouter'

/**
 * 같은 이메일로 이미 가입한 사람이 소셜 로그인을 처음 하면 서버가 `409 ACCOUNT.SOCIAL_EMAIL_CONFLICT`(본문 `data` 없음 — 어떤 방법으로 가입했는지는 알려 주지 않는다)로 거절한다.
 * **자동으로 합치지 않는다.** 화면은 막다른 오류가 아니라 안내다 — 가입할 때 쓴 방법으로 로그인한 뒤 계정 설정의 「로그인 수단」에서 그 소셜을 직접 연결하게 한다.
 * 「로그인하러 가기」로 로그인하면 설정의 로그인 수단 구역으로 가서 그 제공자의 「연결」이 강조된다(의도는 router state 로만 — 저장소 · 주소 쿼리에 넣지 않는다).
 * 소셜 로그인 콜백 페이지(`SocialCallbackPage`)가 `homeTo` · `linkTo` · `provider` 를 이어 준다
 */
const meta = {
  title: 'Patterns/Auth/Social email conflict',
  decorators: [withRouter],
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const conflict = apiError('ACCOUNT.SOCIAL_EMAIL_CONFLICT', 409)
const linkTo = { pathname: '/account', hash: '#methods' }

export const Guide: Story = {
  render: () => (
    <SocialCallbackScreen
      state={{ status: 'error', error: conflict }}
      signInTo="/login"
      homeTo="/"
      linkTo={linkTo}
      provider="google"
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'An account with this email already exists' }),
    ).toBeVisible()
    await expect(canvas.getByText(/press "Link Google"/)).toBeVisible()
    // 눌리는 것은 단추 모양 — 글자만 있는 링크가 아니다
    await expect(canvas.getByRole('button', { name: 'Go to sign in' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Back to start' })).toBeVisible()
    await expect(canvas.queryByRole('link')).toBeNull()
  },
}

export const GuideKorean: Story = {
  render: () => (
    <SocialCallbackScreen
      state={{ status: 'error', error: conflict }}
      signInTo="/login"
      homeTo="/"
      linkTo={linkTo}
      provider="kakao"
      labels={koAuthLabels}
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: '이미 이 이메일로 가입한 계정이 있어요' }),
    ).toBeVisible()
    await expect(
      canvas.getByText(/'카카오 연결'을 누르면, 다음부터 카카오 로그인도 쓸 수 있어요/),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: '로그인하러 가기' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: '처음으로' })).toBeVisible()
  },
}
