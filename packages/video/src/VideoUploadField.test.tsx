import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koVideoUploadLabels } from './labels'
import { fakeItem } from './test/item'
import type { VideoItem } from './types'
import { VideoUploadField } from './VideoUploadField'
import { videosKey } from './useVideos'
import type { VideoApi } from './videoApi'

const api = {} as VideoApi

function render(items: VideoItem[], props: Partial<Parameters<typeof VideoUploadField>[0]> = {}) {
  const client = new QueryClient()
  client.setQueryData(videosKey('clip'), items)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <VideoUploadField api={api} purpose="clip" {...props} />
    </QueryClientProvider>,
  )
}

describe('VideoUploadField', () => {
  it('offers a visible choose button when nothing is uploaded yet', () => {
    const html = render([])
    expect(html).toContain('Choose a video')
    expect(html).toContain('accept="video/mp4,video/quicktime,.mp4,.mov"')
    expect(html).not.toContain('<li')
  })

  it('shows each stage in words: preparing with percent, playable, other-device version, failed reason, abandoned', () => {
    const html = render([
      fakeItem({ id: 'a', status: 'REMUXING', progress: 40 }),
      fakeItem({ id: 'b' }),
      fakeItem({ id: 'c', compat: 'RUNNING' }),
      fakeItem({ id: 'd', status: 'FAILED', failCode: 'UNSUPPORTED_FORMAT' }),
      fakeItem({ id: 'e', status: 'UPLOADING' }),
    ])
    expect(html).toContain('Preparing 40%')
    expect(html).toContain('Ready to play')
    expect(html).toContain('Preparing a version for other devices')
    expect(html).toContain('This video format is not supported.')
    expect(html).toContain('This upload was interrupted')
    expect(html.match(/<button[^>]*>Remove<\/button>/g)).toHaveLength(5)
    expect(html).toContain('aria-label="Remove Video 1"')
  })

  it('hides deleted videos and closes the picker when the maximum is reached', () => {
    const html = render([fakeItem({ id: 'a' }), fakeItem({ id: 'z', status: 'DELETED' })], {
      max: 1,
    })
    expect(html.match(/<li/g)).toHaveLength(1)
    expect(html).toContain('You can add up to 1.')
    expect(html).toMatch(/<button[^>]*disabled/)
  })

  it("lists only the videos the page asks for, so another note's video neither shows nor fills the maximum", () => {
    const html = render([fakeItem({ id: 'mine' }), fakeItem({ id: 'theirs' })], {
      max: 1,
      include: (video) => video.id === 'theirs-not-here',
    })
    expect(html).not.toContain('<li')
    expect(html).not.toContain('You can add up to 1.')
    expect(html).not.toMatch(/<button[^>]*disabled/)
  })

  it('writes the labels it is given', () => {
    const html = render([fakeItem({ status: 'FAILED', failCode: 'CORRUPT' })], {
      labels: koVideoUploadLabels,
    })
    expect(html).toContain('영상 고르기')
    expect(html).toContain('파일이 손상되어')
  })
})
