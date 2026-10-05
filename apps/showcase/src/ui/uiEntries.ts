import { dataEntries } from './entries/data'
import { formEntries } from './entries/forms'
import { helperEntries } from './entries/helpers'
import { overlayEntries } from './entries/overlay'
import type { UiEntry } from './types'

/** 갤러리에 보이는 순서 */
export const uiEntries: Array<UiEntry & { importLine: string }> = [
  ...formEntries,
  ...dataEntries,
  ...overlayEntries,
  ...helperEntries,
].map((entry) => ({ ...entry, importLine: `import { ${entry.name} } from '@skeleton/ui'` }))
