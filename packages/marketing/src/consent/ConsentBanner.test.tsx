import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConsentBanner } from './ConsentBanner'
import { createConsentStore } from './consentStore'

const categories = [
  { id: 'necessary', label: 'Necessary', description: 'Keeps you signed in', required: true },
  { id: 'analytics', label: 'Analytics', description: 'Counts visits' },
]

describe('ConsentBanner', () => {
  it('draws nothing on the server: the server cannot know the visitor choice, and the banner must not flash for people who already chose', () => {
    const store = createConsentStore({ categories: ['necessary', 'analytics'], version: '1' })
    expect(renderToStaticMarkup(<ConsentBanner store={store} categories={categories} />)).toBe('')
  })
})
