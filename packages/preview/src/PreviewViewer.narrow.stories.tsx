import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { page } from 'vitest/browser'
import { defaultPreviewLabels } from './labels.en'
import { koPreviewLabels } from './labels.ko'
import { ViewerStoryHost as Host } from './stories/ViewerStoryHost'

/**
 * 크게 보기 — 좁은 결(<1024): 무대가 화면 전부, 위 가운데 유리 알약(닫기 · 요약 · 펴기)과 그 아래 쌓인 안내, 오른쪽 아래 배율 패드.
 * 폰 화면의 기기 「폰」은 꽉 찬 화면(틀 · 패드 · 축소 알약 없음, 만지기 켠 채). 알약을 펴면 한 판(태블릿 세로는 폭 700 두 칸). 앱 보기 조건은 `extra.panel` · `extra.summary`.
 */
const meta = {
  title: 'Packages/preview/PreviewViewerNarrow',
  component: Host,
  parameters: { layout: 'fullscreen' },
  args: {
    as: 'dialog',
    title: 'Large preview',
    onClose: fn(),
    onOpenWindow: fn(),
  },
  globals: { viewport: { value: 'phone', isRotated: false } },
} satisfies Meta<typeof Host>
export default meta
type Story = StoryObj<typeof meta>
type Canvas = Parameters<NonNullable<Story['play']>>[0]['canvas']

const L = defaultPreviewLabels

const numbered = (make: (n: number) => string) =>
  new RegExp(
    `^${make(0)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace('0', '\\d+')}$`,
  )

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

const frameBox = (canvas: Canvas) =>
  canvas.getByTitle(L.frameTitle).closest('[data-kind]')!.getBoundingClientRect()

/** 알약 — 위 가운데, 안에 다 들어옴(닫기 · 펴기 보임), 가로 넘침 없음. 알약 상자를 돌려준다 */
async function assertPill(canvas: Canvas, labels = L) {
  const expand = await waitFor(() => canvas.getByRole('button', { name: labels.expand }))
  const pill = expand.parentElement!
  const rect = pill.getBoundingClientRect()
  await expect(rect.left).toBeGreaterThanOrEqual(0)
  await expect(rect.right).toBeLessThanOrEqual(window.innerWidth + 1)
  await expect(Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2)).toBeLessThan(2)
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  const close = canvas.getByRole('button', { name: labels.close })
  await expect(close.getBoundingClientRect().left).toBeGreaterThanOrEqual(rect.left - 1)
  await expect(expand.getBoundingClientRect().right).toBeLessThanOrEqual(rect.right + 1)
  return rect
}

/** 화면 크기를 바꿔 돌리고 끝에 되돌린다 */
async function withViewport(width: number, height: number, run: () => Promise<void>) {
  const before = { width: window.innerWidth, height: window.innerHeight }
  await page.viewport(width, height)
  try {
    await run()
  } finally {
    await page.viewport(before.width, before.height)
  }
}

/** 꽉 찬 폰 — 틀 없음 · 화면 상자 = 화면 · 배율 패드 없음 · 알약은 위 가운데 */
export const Phone: Story = {
  play: async ({ canvas }) => {
    await assertPill(canvas)
    const root = document.documentElement
    await waitFor(() => {
      expect(Math.abs(frameBox(canvas).width - root.clientWidth)).toBeLessThan(0.5)
      expect(Math.abs(frameBox(canvas).height - root.clientHeight)).toBeLessThan(0.5)
    })
    await expect(canvas.getByTitle(L.frameTitle).closest('[data-kind]')).toHaveAttribute(
      'data-kind',
      'plain',
    )
    await expect(canvas.queryByRole('group', { name: L.size })).toBeNull()
    await expect(canvas.queryByRole('button', { name: numbered(L.shrunk) })).toBeNull()
  },
}

export const PhonePanel: Story = {
  play: async ({ canvas, userEvent }) => {
    const expand = await canvas.findByRole('button', { name: L.expand })
    await userEvent.click(expand)
    const panel = await canvas.findByRole('region', { name: L.panelTitle })
    await expect(panel).toBeVisible()
    const rect = panel.getBoundingClientRect()
    await expect(rect.left).toBeGreaterThanOrEqual(0)
    await expect(rect.right).toBeLessThanOrEqual(window.innerWidth)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    const fold = within(panel).getByRole('button', { name: L.collapse })
    await waitFor(() => expect(fold).toHaveFocus())
    await expect(canvas.getByRole('switch', { name: L.touch })).toBeChecked()
    await expect(canvas.getByRole('switch', { name: L.touch })).toHaveAccessibleDescription(
      L.touchNote,
    )
    await userEvent.click(fold)
    await waitFor(() => expect(canvas.queryByRole('region', { name: L.panelTitle })).toBeNull())
    await waitFor(() => expect(canvas.getByRole('button', { name: L.expand })).toHaveFocus())
  },
}

/** 판이 열린 동안 Esc 는 판만 접는다 — 대화상자는 열린 채, `onClose` 는 불리지 않는다 */
export const PhoneEscFoldsPanel: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(await canvas.findByRole('button', { name: L.expand }))
    const panel = await canvas.findByRole('region', { name: L.panelTitle })
    await waitFor(() =>
      expect(within(panel).getByRole('button', { name: L.collapse })).toHaveFocus(),
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(canvas.queryByRole('region', { name: L.panelTitle })).toBeNull())
    await expect(screen.getByRole('dialog', { name: 'Large preview' })).toBeVisible()
    await expect(args.onClose).not.toHaveBeenCalled()
  },
}

export const PhonePc: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas }) => {
    const pill = await assertPill(canvas)
    await expect(canvas.getByText(L.devices.pc)).toBeVisible()
    const notice = await canvas.findByRole('button', { name: numbered(L.shrunk) })
    const pad = canvas.getByRole('group', { name: L.size })
    const box = frameBox(canvas)
    for (const other of [pill, notice.getBoundingClientRect(), pad.getBoundingClientRect()]) {
      await expect(overlaps(box, other)).toBe(false)
    }
    await expect(box.right).toBeLessThanOrEqual(window.innerWidth)
  },
}

/** 배율을 바꾸면 맞추기가 풀리고, 맞추기 단추가 다시 맞춘다 */
export const PhonePcFitButton: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas, userEvent }) => {
    const fit = await canvas.findByRole('button', { name: L.fitButton })
    await expect(fit).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(canvas.getByRole('button', { name: L.zoomIn }))
    await waitFor(() => expect(fit).toHaveAttribute('aria-pressed', 'false'))
    await userEvent.click(fit)
    await waitFor(() => expect(fit).toHaveAttribute('aria-pressed', 'true'))
  },
}

/** 태블릿 세로 화면 — 판은 폭 700 이하로 가운데, 두 칸이 옆으로 놓인다 */
export const TabletPortraitPanel: Story = {
  globals: { viewport: { value: 'tablet', isRotated: false } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: L.expand }))
    const panel = await canvas.findByRole('region', { name: L.panelTitle })
    const rect = panel.getBoundingClientRect()
    await expect(rect.width).toBeLessThanOrEqual(700)
    await expect(Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2)).toBeLessThan(2)
    const cols = panel.querySelectorAll('[data-col]')
    await expect(cols).toHaveLength(2)
    await expect(cols[0].getBoundingClientRect().top).toBe(cols[1].getBoundingClientRect().top)
    await expect(cols[0].getBoundingClientRect().right).toBeLessThanOrEqual(
      cols[1].getBoundingClientRect().left,
    )
    // 폰이 아닌 화면의 기기 「폰」은 틀에 담긴다
    await expect(canvas.getByTitle(L.frameTitle).closest('[data-kind]')).toHaveAttribute(
      'data-kind',
      'phone',
    )
    // 판이 차지한 높이를 뺀 남은 칸에 맞춘다 — 기기가 판 밑에 깔리지 않는다
    await waitFor(() =>
      expect(overlaps(frameBox(canvas), panel.getBoundingClientRect())).toBe(false),
    )
    await expect(frameBox(canvas).bottom).toBeLessThanOrEqual(window.innerHeight)
  },
}

/** 폰 가로(낮은 화면) — 꽉 찬 폰 */
export const PhoneLandscape: Story = {
  play: async ({ canvas }) => {
    await withViewport(844, 390, async () => {
      await assertPill(canvas)
      await expect(canvas.getByTitle(L.frameTitle).closest('[data-kind]')).toHaveAttribute(
        'data-kind',
        'plain',
      )
    })
  },
}

/** 폰 가로에서 폰이 아닌 기기 — 틀이 남고 알약 · 패드를 뺀 칸에 든다 */
export const PhoneLandscapePc: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas }) => {
    await withViewport(844, 390, async () => {
      const pill = await assertPill(canvas)
      await waitFor(() => {
        const box = frameBox(canvas)
        expect(box.height).toBeGreaterThan(40)
        expect(overlaps(box, pill)).toBe(false)
      })
    })
  },
}

export const PhoneDark: Story = {
  globals: { theme: 'dark', viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvas }) => {
    await assertPill(canvas)
  },
}

export const PhoneKo: Story = {
  args: { labels: koPreviewLabels, title: '크게 보기' },
  play: async ({ canvas }) => {
    await assertPill(canvas, koPreviewLabels)
  },
}

/** 앱의 보기 조건 — `extra.panel` 은 판 안, `extra.summary` 는 맞추기 동안 알약에. 배율을 바꾸면 요약은 빠지고 배율이 보인다 */
export const PhoneExtra: Story = {
  args: { initialDevice: 'pc', withExtra: true },
  play: async ({ canvas, userEvent }) => {
    await assertPill(canvas)
    const pill = canvas.getByRole('button', { name: L.expand }).parentElement!
    await expect(within(pill).getByText(`${L.devices.pc} · Daytime`)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: L.zoomIn }))
    await waitFor(() => expect(within(pill).queryByText(/Daytime/)).toBeNull())
    await expect(within(pill).getByText(new RegExp(`${L.devices.pc} · \\d+%`))).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: L.expand }))
    const panel = await canvas.findByRole('region', { name: L.panelTitle })
    await expect(within(panel).getByRole('combobox', { name: 'View mode' })).toBeVisible()
  },
}
