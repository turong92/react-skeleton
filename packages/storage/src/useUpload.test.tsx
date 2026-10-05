import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Uploader } from './uploader'
import { useUpload } from './useUpload'

describe('useUpload', () => {
  it('starts idle at 0% and never uploads by itself', () => {
    const uploader: Uploader = { upload: vi.fn() }
    function Probe() {
      const upload = useUpload(uploader)
      return (
        <p>
          {upload.status}:{upload.progress}:{typeof upload.upload}:{typeof upload.abort}:
          {typeof upload.reset}
        </p>
      )
    }
    expect(renderToStaticMarkup(<Probe />)).toBe('<p>idle:0:function:function:function</p>')
    expect(uploader.upload).not.toHaveBeenCalled()
  })
})
