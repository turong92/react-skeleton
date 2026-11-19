import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { StoredImage } from './StoredImage'
import { fakeStoredImage } from './stories/fakeStorage'

/**
 * 저장된 이미지 — 서버가 준 변환본(`thumb` · `display`)과 폭 · 높이로 반응형 `<img>` 를 그린다.
 * 둘 다 있으면 `srcset`, 한쪽뿐이면 그 하나. 폭 · 높이로 자리를 미리 잡아 이미지가 오기 전에 화면이 밀리지 않는다.
 */
const both = fakeStoredImage('uploads/u/cat.png')

const meta = {
  title: 'Packages/storage/StoredImage',
  component: StoredImage,
  args: { image: both, alt: 'A cat', sizes: '(min-width: 640px) 400px, 100vw' },
} satisfies Meta<typeof StoredImage>
export default meta
type Story = StoryObj<typeof meta>

export const ThumbAndDisplay: Story = {
  play: async ({ canvas }) => {
    const img = canvas.getByRole('img', { name: 'A cat' })
    await expect(img).toHaveAttribute('srcset', expect.stringMatching(/ 400w, .* 1200w$/))
    await expect(img).toHaveAttribute('width', '1200')
    await expect(img).toHaveAttribute('height', '800')
    await expect(img).toHaveAttribute('loading', 'lazy')
  },
}

export const OnlyThumb: Story = {
  args: { image: { width: 1200, height: 800, thumb: both.thumb } },
  play: async ({ canvas }) => {
    const img = canvas.getByRole('img', { name: 'A cat' })
    await expect(img).not.toHaveAttribute('srcset')
    await expect(img).toHaveAttribute('src', both.thumb?.url ?? '')
  },
}

/** 움직이는 이미지의 변환 결과(`display.alternates` 의 `video/mp4`) - 소리 없는 반복 영상으로 GIF 처럼 보인다 */
export const AnimatedAsVideo: Story = {
  args: {
    image: {
      width: 480,
      height: 270,
      thumb: both.thumb,
      display: {
        url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        width: 480,
        height: 270,
        contentType: 'image/gif',
        alternates: [{ url: 'data:video/mp4;base64,', contentType: 'video/mp4' }],
      },
    },
    alt: 'A dancing cat',
  },
  play: async ({ canvas }) => {
    const video = canvas.getByLabelText('A dancing cat')
    await expect(video.tagName).toBe('VIDEO')
    for (const name of ['autoplay', 'loop', 'playsinline'])
      await expect(video).toHaveAttribute(name)
    // React 는 muted 를 속성이 아닌 프로퍼티로 둔다
    await expect((video as HTMLVideoElement).muted).toBe(true)
    await expect(video).toHaveAttribute('poster', both.thumb?.url ?? '')
  },
}
