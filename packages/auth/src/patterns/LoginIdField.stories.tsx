import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@skeleton/ui'
import { useMemo, useState } from 'react'
import { expect, fn, waitFor } from 'storybook/test'
import type { LoginIdAvailability } from '../account/types'
import { koAuthLabels } from '../screens/labels.ko'
import { LoginIdField } from '../screens/LoginIdField'
import { useLoginIdAvailability } from '../screens/useLoginIdAvailability'
import { createFakeAccountApi } from '../stories/fakeAccountApi'

/**
 * 아이디 칸 — 가입 · 인증 단계 재입력 · 아이디 게이트 · 설정이 같이 쓰는 조각(`LoginIdField` + 훅 `useLoginIdAvailability`).
 * 칸 아래에 안내 한 줄과 **상태 한 줄**(글자 + 아이콘, `aria-live="polite"`): 상태는 색이 아니라 글자로 말한다.
 * 입력이 멈춘 뒤 0.4초에 형식이 맞을 때만 서버에 묻고, 값이 바뀌면 늦게 온 답은 버린다. 부모는 `check.canSubmit` · `check.normalized` 로 내고,
 * 제출 단추에서 `check.touch()` 를 불러 형식 오류를 드러내며, 서버 오류(409 · 필드 오류)는 `serverError` 로 칸 옆에 꽂는다.
 *
 * | 상태 | 글자 | 내기 |
 * | --- | --- | --- |
 * | 형식이 안 맞음 | 무엇이 틀렸나(칸을 벗어나거나 내려 할 때) | 막힘 |
 * | 확인하는 중 | 확인하는 중… | 됨 |
 * | 쓸 수 있다 | 쓸 수 있는 아이디예요 (+ 대문자면 「… (으)로 저장돼요」) | 됨 |
 * | 쓸 수 없다 | 칸 옆 오류 | 막힘 |
 * | 확인하지 못했다(429 · 네트워크) | 지금은 확인할 수 없어요. 내면 확인해 드려요. | 됨 |
 */
const rules = { minLength: 4, maxLength: 20 }
const fake = () => createFakeAccountApi({ loginId: { ...rules, taken: ['admin'] } })

type Api = { checkLoginId: (loginId: string) => Promise<LoginIdAvailability> }

type DemoProps = {
  api?: Api
  initial?: string
  serverError?: string
  /** 화면 폭(px) — 좁은 화면에서 가로로 밀리지 않는지 본다 */
  width?: number
  onSubmit: (normalized: string) => void
}

/** 부모가 하는 일의 견본 — 값을 쥐고, 훅을 부르고, 제출에서 `touch()` 한 뒤 `canSubmit` 이면 `normalized` 를 낸다 */
function Demo({ api, initial = '', serverError, width, onSubmit }: DemoProps) {
  const fallback = useMemo(() => fake(), [])
  const [value, setValue] = useState(initial)
  const check = useLoginIdAvailability({ api: api ?? fallback, value, rules })
  return (
    <form
      noValidate
      style={{ width, maxWidth: '100%' }}
      onSubmit={(event) => {
        event.preventDefault()
        check.touch()
        if (check.canSubmit) onSubmit(check.normalized)
      }}
    >
      <LoginIdField
        value={value}
        onChange={setValue}
        check={check}
        rules={rules}
        labels={koAuthLabels}
        serverError={serverError}
      />
      <Button type="submit">{koAuthLabels.loginIdRequiredSubmit}</Button>
    </form>
  )
}

const meta = {
  title: 'Patterns/Auth/Login id field',
  component: Demo,
  args: { onSubmit: fn() },
} satisfies Meta<typeof Demo>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText(/아이디/)
    await expect(input).toHaveAttribute('autocomplete', 'username')
    await expect(input).toHaveAttribute('autocapitalize', 'none')
    await expect(input).toHaveAttribute('spellcheck', 'false')
    await expect(canvas.getByText(/영문 · 숫자 · 마침표/)).toBeVisible()
    await expect(input).toHaveAccessibleDescription(/영문 · 숫자/)
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

export const FormatProblem: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByLabelText(/아이디/)
    await userEvent.type(input, 'ab')
    await expect(canvas.queryByRole('alert')).toBeNull() // 칸을 벗어나기 전에는 조용하다
    await userEvent.tab()
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      '아이디는 4~20자로 정해 주세요',
    )
    await expect(input).toBeInvalid()
    await userEvent.clear(input)
    await userEvent.type(input, 'sumin@kim')
    await expect(await canvas.findByRole('alert')).toHaveTextContent('영문 · 숫자 · 마침표(.)')
    await userEvent.click(canvas.getByRole('button', { name: '이 아이디로 정하기' }))
    await expect(args.onSubmit).not.toHaveBeenCalled() // 내기 막힘
  },
}

export const SubmitRevealsTheProblem: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '이 아이디로 정하기' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent('아이디를 입력해 주세요')
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const Checking: Story = {
  args: { api: { checkLoginId: () => new Promise<LoginIdAvailability>(() => undefined) } },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/아이디/), 'sumin.kim')
    await expect(await canvas.findByText('확인하는 중…')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '이 아이디로 정하기' }))
    await expect(args.onSubmit).toHaveBeenCalledWith('sumin.kim') // 내기 됨 — 서버가 판정한다
  },
}

export const Available: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByLabelText(/아이디/)
    await userEvent.type(input, 'sumin.kim')
    await expect(await canvas.findByText('쓸 수 있는 아이디예요')).toBeVisible()
    await expect(canvas.queryByText(/으\)로 저장돼요/)).toBeNull()
    await userEvent.clear(input)
    await userEvent.type(input, 'Sumin.Kim')
    await expect(await canvas.findByText(/sumin\.kim \(으\)로 저장돼요/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '이 아이디로 정하기' }))
    await expect(args.onSubmit).toHaveBeenCalledWith('sumin.kim')
  },
}

export const Taken: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByLabelText(/아이디/)
    await userEvent.type(input, 'Admin')
    const alert = await canvas.findByRole('alert') // 칸을 벗어나지 않아도 바로 나온다
    await expect(alert).toHaveTextContent('이미 쓰고 있거나 쓸 수 없는 아이디예요')
    await expect(input).toBeInvalid()
    await userEvent.click(canvas.getByRole('button', { name: '이 아이디로 정하기' }))
    await expect(args.onSubmit).not.toHaveBeenCalled() // 내기 막힘
  },
}

export const CouldNotCheck: Story = {
  args: {
    api: {
      checkLoginId: async () => {
        throw new Error('429')
      },
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/아이디/), 'sumin.kim')
    await expect(
      await canvas.findByText('지금은 확인할 수 없어요. 내면 확인해 드려요.'),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '이 아이디로 정하기' }))
    await expect(args.onSubmit).toHaveBeenCalledWith('sumin.kim') // 내기 됨 — 서버가 판정한다
  },
}

export const ServerErrorBesideTheField: Story = {
  args: { initial: 'sumin.kim', serverError: '그 사이 다른 분이 이 아이디를 정했어요.' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('그 사이 다른 분이')
    await expect(canvas.getByLabelText(/아이디/)).toBeInvalid()
  },
}

const asked = fn(async (id: string) => ({ normalized: id, available: true }))
export const OnlyTheLastInputAsks: Story = {
  args: { api: { checkLoginId: asked } },
  play: async ({ canvas, userEvent }) => {
    asked.mockClear()
    await userEvent.type(canvas.getByLabelText(/아이디/), 'sumin.kim')
    await expect(await canvas.findByText('쓸 수 있는 아이디예요')).toBeVisible()
    // 글자마다 묻지 않았다 — 멈춘 뒤 마지막 값 하나만
    await expect(asked).toHaveBeenCalledTimes(1)
    await expect(asked).toHaveBeenCalledWith('sumin.kim')
  },
}

/** 375px · 320px — 긴 아이디와 긴 안내도 가로로 밀리지 않는다 */
const noSidewaysScroll = async () => {
  await waitFor(() =>
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    ),
  )
}

export const Narrow375: Story = {
  args: { width: 375 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/아이디/), 'Sumin.Kim.With.A.Rather.Long')
    await userEvent.tab()
    await canvas.findByRole('alert')
    await noSidewaysScroll()
  },
}

export const Narrow320: Story = {
  args: { width: 320 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/아이디/), 'Sumin.Kim.Lng')
    await expect(await canvas.findByText(/으\)로 저장돼요/)).toBeVisible()
    await noSidewaysScroll()
  },
}
