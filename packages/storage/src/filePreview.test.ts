import { describe, expect, it, vi } from 'vitest'
import { createFilePreview } from './filePreview'

const urls = () => {
  let n = 0
  return {
    createObjectURL: vi.fn(() => `blob:preview-${(n += 1)}`),
    revokeObjectURL: vi.fn(),
  }
}
const png = new File([new Uint8Array(4)], 'cat.png', { type: 'image/png' })

describe('createFilePreview (the state machine under useFilePreview)', () => {
  it('shows an image file as an object url and revokes it when the file is replaced', () => {
    const api = urls()
    const preview = createFilePreview(api)
    expect(preview.show(png)).toBe('blob:preview-1')
    expect(api.revokeObjectURL).not.toHaveBeenCalled()
    expect(preview.show(new File([new Uint8Array(1)], 'b.png', { type: 'image/png' }))).toBe(
      'blob:preview-2',
    )
    expect(api.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1')
  })

  it('revokes on dispose (unmount) and on show(null)', () => {
    const api = urls()
    const preview = createFilePreview(api)
    preview.show(png)
    expect(preview.show(null)).toBeNull()
    expect(api.revokeObjectURL).toHaveBeenCalledTimes(1)
    preview.show(png)
    preview.dispose()
    expect(api.revokeObjectURL).toHaveBeenLastCalledWith('blob:preview-2')
    expect(api.revokeObjectURL).toHaveBeenCalledTimes(2)
  })

  it('a file that is not an image gets no url at all', () => {
    const api = urls()
    const pdf = new File([new Uint8Array(4)], 'a.pdf', { type: 'application/pdf' })
    expect(createFilePreview(api).show(pdf)).toBeNull()
    expect(api.createObjectURL).not.toHaveBeenCalled()
  })
})
