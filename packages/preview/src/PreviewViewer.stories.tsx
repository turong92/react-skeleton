import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, waitFor, within } from 'storybook/test'
import { defaultPreviewLabels } from './labels.en'
import { koPreviewLabels } from './labels.ko'
import { ViewerStoryHost as Host } from './stories/ViewerStoryHost'
import { PREVIEW_VIEWPORTS } from './stories/viewports'

/**
 * 크게 보기 — 넓은 결(≥1024): 무대가 화면 전부(기기 틀에 담긴 화면), 아래 가운데 떠 있는 막대(기기 · 앱 보기 조건 · 배율 · 만지기 · 다시 재생 · 새 창 · 닫기),
 * 왼쪽 위 「n% 로 줄여 보는 중 — 실제 크기로 보기」, 위 가운데 조작 안내 → 오류 → 안내 순서로 쌓인 알약.
 * 화면은 iframe 다리(`createFakeFrameBridge`) 또는 직접 렌더(`render`). 앱 보기 조건은 `extra` 로 꽂는다.
 */
const meta = {
  title: 'Packages/preview/PreviewViewer',
  component: Host,
  parameters: { layout: 'fullscreen', viewport: PREVIEW_VIEWPORTS },
  args: {
    as: 'dialog',
    title: 'Large preview',
    onClose: fn(),
    onOpenWindow: fn(),
  },
  globals: { viewport: { value: 'desktop', isRotated: false } },
} satisfies Meta<typeof Host>
export default meta
type Story = StoryObj<typeof meta>

type Canvas = Parameters<NonNullable<Story['play']>>[0]['canvas']
const L = defaultPreviewLabels

/** 숫자가 들어가는 문구를 이름으로 찾는 식 — 문구를 복사하지 않고 함수 라벨에서 만든다 */
const numbered = (make: (n: number) => string) =>
  new RegExp(
    `^${make(0)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace('0', '\\d+')}$`,
  )

/** 막대가 화면 아래 가운데 · 안에 다 들어옴, 가로 넘침 없음 */
async function assertWide(canvas: Canvas, controls = L.controls) {
  const bar = await waitFor(() => canvas.getByRole('group', { name: controls }))
  const rect = bar.getBoundingClientRect()
  await expect(rect.left).toBeGreaterThanOrEqual(0)
  await expect(rect.right).toBeLessThanOrEqual(window.innerWidth + 1)
  await expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight)
  await expect(Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2)).toBeLessThan(2)
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  return bar
}

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

export const DesktopPc: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas, userEvent }) => {
    const bar = await assertWide(canvas)
    await expect(within(bar).getByRole('group', { name: L.device })).toBeVisible()
    const frame = await canvas.findByTitle(L.frameTitle)
    const pill = await canvas.findByRole('button', { name: numbered(L.shrunk) })
    const box = frame.closest('[data-kind]')!.getBoundingClientRect()
    await expect(overlaps(box, pill.getBoundingClientRect())).toBe(false)
    await expect(overlaps(box, bar.getBoundingClientRect())).toBe(false)
    await userEvent.click(pill)
    await waitFor(() =>
      expect(Math.abs(frame.getBoundingClientRect().width - 1440)).toBeLessThan(2),
    )
  },
}

export const DesktopTabletLandscapeTouch: Story = {
  args: {
    initialDevice: 'tabletLandscape',
    error: 'The preview could not be drawn. Showing the last one.',
    warning: 'Some text is not translated yet.',
    onTouchChange: fn(),
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(await canvas.findByRole('button', { name: L.touch }))
    await expect(canvas.getByRole('button', { name: L.touch })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await waitFor(() => expect(canvasElement.querySelector('[data-zoom-shield]')).toBeNull())
    await expect(args.onTouchChange).toHaveBeenLastCalledWith(true)
    await expect(canvas.getByText(L.hintTouch)).toBeVisible()
    await expect(canvas.getByRole('alert')).toBeVisible()
    await expect(canvas.getByRole('status')).toBeVisible()
    await expect(canvas.getByTitle(L.frameTitle)).toHaveAttribute('width', '1180')
    await assertWide(canvas)
  },
}

export const DesktopReplay: Story = {
  args: { initialDevice: 'pc', onReplay: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(await canvas.findByRole('button', { name: L.replay }))
    await expect(args.onReplay).toHaveBeenCalledTimes(1)
  },
}

export const DesktopNoExtras: Story = {
  args: { initialDevice: 'pc', onOpenWindow: undefined },
  play: async ({ canvas }) => {
    await assertWide(canvas)
    await expect(canvas.queryByRole('button', { name: L.replay })).toBeNull()
    await expect(canvas.queryByRole('button', { name: L.openWindow })).toBeNull()
    await expect(canvas.queryByRole('combobox', { name: 'View mode' })).toBeNull()
  },
}

/** 앱의 보기 조건(`extra.bar`)이 막대 안 기기 그룹과 배율 그룹 사이에 선다 */
export const DesktopExtra: Story = {
  args: { initialDevice: 'pc', withExtra: true },
  play: async ({ canvas }) => {
    const bar = await assertWide(canvas)
    const devices = within(bar).getByRole('group', { name: L.device })
    const extra = within(bar).getByRole('combobox', { name: 'View mode' })
    const zoom = within(bar).getByRole('combobox', { name: L.size })
    await expect(
      devices.compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await expect(
      extra.compareDocumentPosition(zoom) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  },
}

export const Page: Story = {
  args: { as: 'page', initialDevice: 'pc' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('main')).toBeVisible()
    await expect(canvas.queryByRole('dialog')).toBeNull()
    await assertWide(canvas)
  },
}

export const DesktopDark: Story = {
  args: { initialDevice: 'pc' },
  globals: { theme: 'dark', viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvas }) => {
    await assertWide(canvas)
  },
}

export const DesktopKo: Story = {
  args: { initialDevice: 'pc', labels: koPreviewLabels, title: '크게 보기' },
  play: async ({ canvas }) => {
    await assertWide(canvas, koPreviewLabels.controls)
  },
}

/** 직접 렌더 내용의 상태(누른 횟수)는 기기를 바꿔도 남는다 — 다시 마운트되지 않는다 */
export const RenderKeepsStateAcrossDevices: Story = {
  args: { render: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: L.touch }))
    const count = await canvas.findByRole('button', { name: /^Count: / })
    await userEvent.click(count)
    await userEvent.click(canvas.getByRole('button', { name: /^Count: / }))
    await expect(canvas.getByRole('button', { name: 'Count: 2' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: L.devices.tabletPortrait }))
    await waitFor(() =>
      expect(canvas.getByTitle(L.devices.tabletPortrait)).toHaveAttribute('aria-pressed', 'true'),
    )
    await expect(canvas.getByRole('button', { name: 'Count: 2' })).toBeVisible()
  },
}

/** 크게 보기를 Esc 로 닫으면 페이지가 돌아온다 — 문서 스크롤 잠금이 연 때 값으로 풀리고 포커스가 연 단추로 돌아온다 */
export const EscClosesAndRestoresThePage: Story = {
  args: { autoOpen: false },
  play: async ({ canvas, userEvent, args }) => {
    const opener = canvas.getByRole('button', { name: 'Open viewer' })
    const before = document.documentElement.style.overflow
    await userEvent.click(opener)
    const dialog = (await screen.findByRole('dialog', {
      name: 'Large preview',
    })) as HTMLDialogElement
    await expect(document.documentElement.style.overflow).toBe('hidden')
    const closed = new Promise((resolve) =>
      dialog.addEventListener('close', resolve, { once: true }),
    )
    dialog.requestClose() // Esc
    await closed
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(args.onClose).toHaveBeenCalledTimes(1)
    await expect(document.documentElement.style.overflow).toBe(before)
    await expect(opener).toHaveFocus()
  },
}

export const StartsFocusedOnStage: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas }) => {
    const stage = await canvas.findByRole('group', { name: L.stage })
    await waitFor(() => expect(stage).toHaveFocus())
  },
}

/** 직접 렌더 + 만지기 — 화면 안 스크롤 · 입력칸이 무대에 가로채이지 않는다(휠 · 0-=+ 키는 안쪽이 받고 배율 · 위치는 그대로) */
export const RenderTouchLeavesInnerInputAlone: Story = {
  args: { render: true },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: L.touch }))
    const inner = await canvas.findByTestId('inner-scroll')
    const canvasBox = canvasElement.querySelector<HTMLElement>('[data-canvas]')!
    const before = canvasBox.style.transform
    const wheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
    inner.dispatchEvent(wheel)
    await expect(wheel.defaultPrevented).toBe(false)
    const note = canvas.getByRole('textbox', { name: 'Note' })
    await userEvent.type(note, '0-=+')
    await expect(note).toHaveValue('0-=+')
    await expect(canvasBox.style.transform).toBe(before)
  },
}

/** 실제 크기로 키운 뒤 무대에 포커스하고 ArrowLeft 를 누르면 화면이 옮겨진다 */
export const ArrowKeyPans: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: numbered(L.shrunk) }))
    const canvasBox = canvasElement.querySelector<HTMLElement>('[data-canvas]')!
    const stage = canvas.getByRole('group', { name: L.stage })
    stage.focus()
    const before = canvasBox.style.transform
    await userEvent.keyboard('{ArrowLeft}')
    await waitFor(() => expect(canvasBox.style.transform).not.toBe(before))
  },
}

/** 첫 조작(키) 뒤 조작 안내가 빠진다 */
export const HintGoesAfterFirstKey: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText(L.hintPan)).toBeVisible()
    canvas.getByRole('group', { name: L.stage }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    await waitFor(() => expect(canvas.queryByText(L.hintPan)).toBeNull())
  },
}

/** 만지기를 켰다 끄면 포커스가 무대로 돌아온다 */
export const TouchOffFocusesStage: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas, userEvent }) => {
    const touch = await canvas.findByRole('button', { name: L.touch })
    await userEvent.click(touch)
    await userEvent.click(touch)
    await waitFor(() => expect(canvas.getByRole('group', { name: L.stage })).toHaveFocus())
  },
}

/*
 * 무대 조작(끌기 · 휠 · Ctrl+휠 · 핀치 · 끝에서 멈춤) — 값은 계산에서 나온다.
 * 기준 화면 1440x900(PREVIEW_VIEWPORTS.desktop), PC 1440 · 기본 막대 · 실제 크기(배율 1)로 연 상태:
 *  - 기기 바깥 폭 1440 + 틀 12 = 1452, 받침까지 칠한 폭 1452 x 1.06 = 1539 > 칸 폭 1440 - 32 = 1408 → 가로 이동 폭 131(시작은 가운데 -65.5)
 *  - 칸 높이 = 900 - 위 안내(24 + max(안내, 44)) - 아래 108 이하, 콘텐츠 높이 900 + 24 = 924 → 세로 이동 폭 200 이상(시작은 위 끝 0)
 * 그래서 끌기 -10/-20 · 휠 +10/+30 은 끝에 걸리지 않고 그대로 옮겨진다(`usePanZoom.test.ts` 의 clampPan 계산과 같은 식).
 * 배율은 iframe 의 화면 폭(= 1440 x 배율)으로 잰다 — 첫 실제 크기 폭을 기준으로 비율만 단정한다.
 */
const translateOf = (el: HTMLElement) => {
  const m = /translate\(\s*([^,]+?)px\s*,\s*([^)]+?)px\s*\)/.exec(el.style.transform)
  if (!m) throw new Error(`no translate in "${el.style.transform}"`)
  return { x: parseFloat(m[1]!), y: parseFloat(m[2]!) }
}

const pointerEvent = (type: string, pointerId: number, x: number, y: number) =>
  new PointerEvent(type, {
    pointerId,
    pointerType: 'mouse',
    button: 0,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  })

/** 줄어든 알약을 눌러 실제 크기(배율 1)로 키우고, 무대 · 옮겨지는 상자 · 그 폭을 돌려준다 */
async function openAtActualSize(
  canvas: Canvas,
  canvasElement: HTMLElement,
  userEvent: { click: (el: Element) => Promise<void> },
) {
  await userEvent.click(await canvas.findByRole('button', { name: numbered(L.shrunk) }))
  const iframe = await canvas.findByTitle(L.frameTitle)
  await waitFor(() => expect(Math.abs(iframe.getBoundingClientRect().width - 1440)).toBeLessThan(2))
  const stage = canvas.getByRole('group', { name: L.stage })
  const box = canvasElement.querySelector<HTMLElement>('[data-canvas]')!
  const width = () => iframe.getBoundingClientRect().width
  return { stage, box, width, base: width() }
}

/** 끌기 — 누르고 (-10, -20) 움직이면 상자가 그만큼 옮겨지고, 뗀 뒤 움직임은 무시된다 */
export const DragPans: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const { stage, box } = await openAtActualSize(canvas, canvasElement, userEvent)
    const before = translateOf(box)
    stage.dispatchEvent(pointerEvent('pointerdown', 1, 500, 400))
    stage.dispatchEvent(pointerEvent('pointermove', 1, 490, 380))
    await waitFor(() => expect(translateOf(box).x).toBeCloseTo(before.x - 10, 1))
    await expect(translateOf(box).y).toBeCloseTo(before.y - 20, 1)
    stage.dispatchEvent(pointerEvent('pointerup', 1, 490, 380))
    const released = box.style.transform
    stage.dispatchEvent(pointerEvent('pointermove', 1, 400, 300))
    await new Promise((resolve) => setTimeout(resolve, 50))
    await expect(box.style.transform).toBe(released)
  },
}

/** 휠 — deltaX +10 · deltaY +30 이면 화면이 (-10, -30) 옮겨진다(휠 아래로 = 내용이 위로) */
export const WheelPans: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const { stage, box } = await openAtActualSize(canvas, canvasElement, userEvent)
    const before = translateOf(box)
    const wheel = new WheelEvent('wheel', {
      deltaX: 10,
      deltaY: 30,
      bubbles: true,
      cancelable: true,
    })
    stage.dispatchEvent(wheel)
    await expect(wheel.defaultPrevented).toBe(true)
    await waitFor(() => expect(translateOf(box).y).toBeCloseTo(before.y - 30, 1))
    await expect(translateOf(box).x).toBeCloseTo(before.x - 10, 1)
  },
}

/** 끝까지 옮기면 더 안 간다 — 아래 · 오른쪽 끝, 위 · 왼쪽 끝 모두 같은 휠을 한 번 더 줘도 그대로 */
export const WheelStopsAtTheEdges: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const { stage, box } = await openAtActualSize(canvas, canvasElement, userEvent)
    const wheel = (deltaX: number, deltaY: number) =>
      stage.dispatchEvent(
        new WheelEvent('wheel', { deltaX, deltaY, bubbles: true, cancelable: true }),
      )
    for (const [dx, dy] of [
      [100000, 100000],
      [-100000, -100000],
    ] as const) {
      const start = box.style.transform
      wheel(dx, dy)
      await waitFor(() => expect(box.style.transform).not.toBe(start))
      const edge = box.style.transform
      wheel(dx, dy)
      await new Promise((resolve) => setTimeout(resolve, 50))
      await expect(box.style.transform).toBe(edge)
    }
    // 위 · 왼쪽 끝: 세로는 칸 위 끝(위 안내 자리)에 정확히 붙는다 — translate y = 칸 위 틈 = 24 + max(안내, 44) 이상, 아래로 더 안 내려간다
    await expect(translateOf(box).y).toBeGreaterThanOrEqual(24 + 44)
  },
}

/** Ctrl+휠 — deltaY -100 이면 배율 x exp(0.2)(WHEEL_ZOOM 0.002 x 100), 아주 크면 위 2 · 아래 0.5(맞추기 0.5 보다 커서)에서 멈춘다 */
export const CtrlWheelZooms: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const { stage, width, base } = await openAtActualSize(canvas, canvasElement, userEvent)
    const ctrlWheel = (deltaY: number) =>
      stage.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY,
          ctrlKey: true,
          clientX: 700,
          clientY: 400,
          bubbles: true,
          cancelable: true,
        }),
      )
    ctrlWheel(-100)
    await waitFor(() => expect(width() / base).toBeCloseTo(Math.exp(0.2), 2))
    ctrlWheel(-100000)
    await waitFor(() => expect(width() / base).toBeCloseTo(2, 2))
    ctrlWheel(100000)
    await waitFor(() => expect(width() / base).toBeCloseTo(0.5, 2))
  },
}

/** 핀치 — 두 포인터 사이 거리 200 → 300 이면 배율 x1.5, 더 벌려 x2.5 가 되려 해도 2 에서 멈춘다 */
export const PinchZooms: Story = {
  args: { initialDevice: 'pc' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const { stage, width, base } = await openAtActualSize(canvas, canvasElement, userEvent)
    stage.dispatchEvent(pointerEvent('pointerdown', 1, 600, 400))
    stage.dispatchEvent(pointerEvent('pointerdown', 2, 800, 400))
    stage.dispatchEvent(pointerEvent('pointermove', 1, 500, 400)) // 거리 200 → 300
    await waitFor(() => expect(width() / base).toBeCloseTo(1.5, 2))
    stage.dispatchEvent(pointerEvent('pointermove', 1, 300, 400)) // 300 → 500 = x1.667, 1.5 x 1.667 = 2.5 → 2
    await waitFor(() => expect(width() / base).toBeCloseTo(2, 2))
    stage.dispatchEvent(pointerEvent('pointerup', 1, 300, 400))
    stage.dispatchEvent(pointerEvent('pointerup', 2, 800, 400))
  },
}
