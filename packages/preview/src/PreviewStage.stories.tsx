import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor } from 'storybook/test'
import { PREVIEW_DEVICES, type PreviewDevice } from './devices'
import { DESKTOP_BASE_OVERHANG } from './frame'
import { defaultPreviewLabels } from './labels.en'
import { koPreviewLabels } from './labels.ko'
import { PreviewStage, type PreviewStageProps } from './PreviewStage'
import type { PreviewSource } from './source'
import { createFakeFrameBridge, type FakeFrameBridge } from './test/fakeFrameBridge'
import { sampleHtml } from './stories/sampleHtml'
import { SampleScreen } from './stories/SampleScreen'

type FakeOptions = NonNullable<Parameters<typeof createFakeFrameBridge>[0]>

/** 무대 칸에서 다리를 꺼내 보는 길 — play 가 `bridges.get(칸)` 으로 같은 다리를 본다 */
const bridges = new WeakMap<Element, FakeFrameBridge>()

type HarnessProps = Omit<PreviewStageProps, 'source'> & {
  /** 칸 크기. 기본 폭 가득 · 높이 640 */
  boxWidth?: number
  boxHeight?: number
  /** 기본 `sampleHtml()` 을 싣는 다리 */
  bridgeOptions?: FakeOptions
  /** 직접 렌더 · 층 같은 다른 source — 있으면 다리 대신 쓴다 */
  source?: PreviewSource
  /** 기기를 바꾸는 단추 넷 */
  switcher?: boolean
  /** 처음엔 `display: none` — 단추로 보인다 */
  startHidden?: boolean
  /** 무대를 내리는 단추 */
  removable?: boolean
}

function Harness({
  boxWidth,
  boxHeight = 640,
  bridgeOptions,
  source,
  switcher = false,
  startHidden = false,
  removable = false,
  device: initialDevice,
  ...stage
}: HarnessProps) {
  const [bridge] = useState(() => createFakeFrameBridge({ html: sampleHtml(), ...bridgeOptions }))
  const [device, setDevice] = useState<PreviewDevice>(initialDevice)
  const [hidden, setHidden] = useState(startHidden)
  const [removed, setRemoved] = useState(false)
  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
        {switcher &&
          PREVIEW_DEVICES.map((d) => (
            <Button key={d} size="sm" onClick={() => setDevice(d)}>
              {defaultPreviewLabels.devices[d]}
            </Button>
          ))}
        {startHidden && (
          <Button size="sm" onClick={() => setHidden(false)}>
            Show
          </Button>
        )}
        {removable && (
          <Button size="sm" onClick={() => setRemoved(true)}>
            Remove
          </Button>
        )}
      </div>
      <div
        data-testid="box"
        ref={(el) => {
          if (el) bridges.set(el, bridge)
        }}
        style={{ height: boxHeight, width: boxWidth, display: hidden ? 'none' : undefined }}
      >
        {!removed && (
          <PreviewStage source={source ?? { kind: 'frame', bridge }} device={device} {...stage} />
        )}
      </div>
    </>
  )
}

/** 미리보기 무대 — 기기 하나(폰 · 태블릿 세로/가로 · PC)를 틀에 담아 칸에 맞춘다. 화면은 iframe 다리 또는 직접 렌더. PC 실제 크기는 칸 안 가로 스크롤(키보드로도 닿는 이름 있는 영역) */
const meta = {
  title: 'Packages/preview/PreviewStage',
  component: Harness,
  args: { device: 'phone' },
} satisfies Meta<typeof Harness>
export default meta
type Story = StoryObj<typeof meta>

const frameTitle = defaultPreviewLabels.frameTitle

export const Phone: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByTitle(frameTitle)).toBeInTheDocument())
  },
}

export const TabletPortrait: Story = {
  args: { device: 'tabletPortrait' },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByTitle(frameTitle)).toBeInTheDocument())
    await expect(canvas.getByTitle(frameTitle).getAttribute('width')).toBe('820')
  },
}

/** 폭 맞추기 — PC 받침이 양옆으로 나와도 칸 안에 든다(칸이 잘라 베젤 폭으로 보이지 않는다) */
export const PcFit: Story = {
  args: { device: 'pc', pcWidth: 1920, boxWidth: 700 },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => expect(canvas.getByTitle(frameTitle)).toBeInTheDocument())
    const stage = canvasElement.querySelector<HTMLElement>('[data-kind="desktop"]')!
    const box = canvas.getByTestId('box').getBoundingClientRect()
    await waitFor(() => {
      const rect = stage.getBoundingClientRect()
      const overhang = rect.width * DESKTOP_BASE_OVERHANG
      expect(rect.left - overhang).toBeGreaterThanOrEqual(box.left - 0.5)
      expect(rect.right + overhang).toBeLessThanOrEqual(box.right + 0.5)
    })
  },
}

export const PcActual: Story = {
  args: { device: 'pc', pcZoom: 'actual' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region', { name: defaultPreviewLabels.pcScroll })).toBeVisible()
  },
}

/** PC 폭을 바꾸면 iframe 이 그 폭 그대로 그려진다(줄이는 건 바깥 상자 배율뿐) */
export const PcWide: Story = {
  args: { device: 'pc', pcWidth: 1920 },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByTitle(frameTitle)).toBeInTheDocument())
    await expect(canvas.getByTitle(frameTitle).getAttribute('width')).toBe('1920')
  },
}

/** 실제 크기에서 틀이 칸보다 넓으면 가로 스크롤이 가운데에서 시작한다 */
export const PcActualCentered: Story = {
  args: { device: 'pc', pcZoom: 'actual', pcWidth: 1440, boxWidth: 700 },
  play: async ({ canvas }) => {
    const region = canvas.getByRole('region', { name: defaultPreviewLabels.pcScroll })
    await waitFor(() => {
      expect(region.scrollWidth).toBeGreaterThan(region.clientWidth)
      expect(
        Math.abs(region.scrollLeft - (region.scrollWidth - region.clientWidth) / 2),
      ).toBeLessThan(2)
    })
  },
}

/** 칸이 틀보다 넓으면 스크롤 없이 가운데 */
export const PcActualNarrowerThanBox: Story = {
  args: { device: 'pc', pcZoom: 'actual', pcWidth: 1280, boxWidth: 1800 },
  play: async ({ canvas }) => {
    const region = canvas.getByRole('region', { name: defaultPreviewLabels.pcScroll })
    const frame = canvas.getByTitle(frameTitle)
    await waitFor(() => {
      const box = region.getBoundingClientRect()
      const rect = frame.getBoundingClientRect()
      expect(Math.abs(rect.left - box.left - (box.right - rect.right))).toBeLessThan(2)
    })
  },
}

/** 태블릿 가로 — iframe 이 1180×820 으로 그려진다 */
export const TabletLandscape: Story = {
  args: { device: 'tabletLandscape' },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByTitle(frameTitle)).toBeInTheDocument())
    const frame = canvas.getByTitle(frameTitle)
    await expect(frame.getAttribute('width')).toBe('1180')
    await expect(frame.getAttribute('height')).toBe('820')
  },
}

/** `phone` — 무대가 보이는 높이(lvh − 머리 줄)가 되고 기기는 폭 · 높이 모두 그 안에 맞는다 */
export const PhoneFills: Story = {
  args: { phone: true, boxWidth: 390 },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByTitle(frameTitle)).toBeInTheDocument())
    const stage = canvas.getByTitle(frameTitle).closest('[data-phone]')
    await expect(stage).not.toBeNull()
    await waitFor(() => {
      const frame = canvas.getByTitle(frameTitle).getBoundingClientRect()
      expect(frame.bottom - stage!.getBoundingClientRect().top).toBeLessThanOrEqual(
        stage!.getBoundingClientRect().height + 1,
      )
    })
  },
}

/** 칸이 기기보다 크면 `maxScale` 까지 키운다 — 큰 견본용(보기만 하니 Tab 이 안으로 들어가지 않는다) */
export const MaxScale: Story = {
  args: { boxWidth: 900, boxHeight: 1400, maxScale: 1.5, fitHeight: true, focusable: false },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => expect(canvas.getByTitle(frameTitle)).toBeInTheDocument())
    const frame = canvasElement.querySelector<HTMLElement>('[data-kind="phone"]')!
    await waitFor(() => {
      const width = frame.getBoundingClientRect().width
      expect(width).toBeGreaterThan(406)
      expect(width).toBeLessThanOrEqual(406 * 1.5 + 1)
    })
    await expect(canvas.getByTitle(frameTitle).getAttribute('tabindex')).toBe('-1')
  },
}

/** 직접 렌더 — 같은 번들의 화면을 iframe 없이 기기 뷰포트 크기 상자 안에 그린다 */
export const Render: Story = {
  args: { source: { kind: 'render', content: <SampleScreen /> } },
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector<HTMLElement>('[data-kind="phone"]')!
    const screen = canvasElement.querySelector<HTMLElement>('[data-source="render"]')!
    await waitFor(() => {
      const scale = frame.getBoundingClientRect().width / 406
      const rect = screen.getBoundingClientRect()
      expect(Math.abs(rect.width - 390 * scale)).toBeLessThanOrEqual(1)
      expect(Math.abs(rect.height - 844 * scale)).toBeLessThanOrEqual(1)
    })
    await expect(canvasElement.querySelector('iframe')).toBeNull()
  },
}

/** 직접 렌더 내용의 `position: fixed`(시트 · 모달)는 기기 화면 상자 안에 머문다 — 틀 위나 바깥 페이지로 나가지 않는다 */
export const RenderFixedStaysInside: Story = {
  args: { source: { kind: 'render', content: <SampleScreen fixedBar /> } },
  play: async ({ canvas, canvasElement }) => {
    const screen = canvasElement.querySelector<HTMLElement>('[data-source="render"]')!
    const bar = canvas.getByTestId('fixed-bar')
    await waitFor(() => {
      const box = screen.getBoundingClientRect()
      const rect = bar.getBoundingClientRect()
      expect(rect.top).toBeGreaterThanOrEqual(box.top - 0.5)
      expect(rect.bottom).toBeLessThanOrEqual(box.bottom + 0.5)
      expect(rect.left).toBeGreaterThanOrEqual(box.left - 0.5)
      expect(rect.right).toBeLessThanOrEqual(box.right + 0.5)
    })
  },
}

/** `attach` 하나만 구현한 다리 — 던지지 않고 그린다. 펴기 · 모달 · 스크롤만 꺼진다 */
export const MinimalBridge: Story = {
  args: { phone: true, bridgeOptions: { minimal: true } },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => expect(canvas.getByTitle(frameTitle)).toBeVisible())
    await expect(canvasElement.querySelector('[data-expanded]')).toBeNull()
  },
}

/** 다리가 문서 높이를 알리면 `phone` 무대가 펴진다 — iframe 높이 = 알린 높이 */
export const Expanded: Story = {
  args: { phone: true, bridgeOptions: { html: sampleHtml({ reportHeight: true, sections: 12 }) } },
  play: async ({ canvas, canvasElement }) => {
    const bridge = bridges.get(canvas.getByTestId('box'))!
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-expanded]')).not.toBeNull()
      expect(bridge.contentHeight).toBeGreaterThan(844)
      expect(canvas.getByTitle(frameTitle).getAttribute('height')).toBe(`${bridge.contentHeight}`)
    })
  },
}

/** 기기를 바꿔도 같은 iframe — 다시 싣지 않는다(다리는 `attach` 를 한 번만 받는다) */
export const DeviceChangeKeepsTheFrame: Story = {
  args: { switcher: true },
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByTitle(frameTitle)).toBeInTheDocument())
    const frame = canvas.getByTitle(frameTitle)
    const bridge = bridges.get(canvas.getByTestId('box'))!
    await userEvent.click(canvas.getByRole('button', { name: defaultPreviewLabels.devices.pc }))
    await waitFor(() => expect(frame.getAttribute('width')).toBe('1280'))
    await userEvent.click(
      canvas.getByRole('button', { name: defaultPreviewLabels.devices.tabletLandscape }),
    )
    await waitFor(() => expect(frame.getAttribute('width')).toBe('1180'))
    await expect(canvas.getByTitle(frameTitle)).toBe(frame)
    await expect(bridge.attachCount()).toBe(1)
  },
}

/** 닫힌 서랍처럼 크기 0 인 칸에 마운트돼도 배율이 0 · NaN 이 되지 않고, 칸이 보이면 다시 맞춘다 */
export const HiddenThenShown: Story = {
  args: { device: 'pc', startHidden: true, boxWidth: 500 },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Show' }))
    const frame = canvasElement.querySelector<HTMLElement>('[data-kind="desktop"]')!
    await waitFor(() => {
      const width = frame.getBoundingClientRect().width
      expect(width).toBeGreaterThan(0)
      expect(width).toBeLessThanOrEqual(500)
    })
  },
}

/** 무대를 내리면 다리에 남는 구독이 없다 */
export const UnmountReleasesListeners: Story = {
  args: {
    phone: true,
    removable: true,
    bridgeOptions: { html: sampleHtml({ reportHeight: true, sections: 12 }) },
  },
  play: async ({ canvas }) => {
    const bridge = bridges.get(canvas.getByTestId('box'))!
    await waitFor(() => expect(bridge.listenerCount()).toBeGreaterThan(0))
    await userEvent.click(canvas.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(bridge.listenerCount()).toBe(0))
  },
}

/** 문구는 prop — 한국어 */
export const Ko: Story = {
  args: { device: 'pc', pcZoom: 'actual', labels: koPreviewLabels },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region', { name: 'PC 화면 — 가로로 밀어 보기' })).toBeVisible()
  },
}
