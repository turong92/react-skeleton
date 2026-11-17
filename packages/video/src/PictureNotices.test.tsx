import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PictureFailed, TapToWatch } from './PictureNotices'
import { defaultVideoPlayerLabels, koVideoPlayerLabels } from './labels'

const noop = () => {}

describe('TapToWatch', () => {
  it('is the play-cover button named after the tap, with a visible line saying so', () => {
    const html = renderToStaticMarkup(<TapToWatch labels={koVideoPlayerLabels} onClick={noop} />)
    expect(html).toMatch(/<button[^>]*aria-label="눌러서 영상 보기"/)
    expect(html).toContain('<svg')
    expect(html).toContain('눌러서 영상 보기</p>')
  })
})

describe('PictureFailed', () => {
  it('says the picture failed and that the sound goes on, with a retry button', () => {
    const html = renderToStaticMarkup(<PictureFailed labels={koVideoPlayerLabels} onRetry={noop} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('소리는 계속 나와요')
    expect(html).toMatch(/<button[^>]*>다시 시도<\/button>/)
  })

  it('has English defaults', () => {
    const html = renderToStaticMarkup(
      <PictureFailed labels={defaultVideoPlayerLabels} onRetry={noop} />,
    )
    expect(html).toContain('Try again')
  })
})
