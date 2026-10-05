import { describe, expect, it } from 'vitest'
import { seoFiles } from './vite'

function run(options: Parameters<typeof seoFiles>[0]) {
  const emitted: Array<{ fileName: string; source: string }> = []
  const warnings: string[] = []
  const plugin = seoFiles(options)
  plugin.generateBundle.call({
    emitFile: (file: { type: 'asset'; fileName: string; source: string }) => {
      emitted.push({ fileName: file.fileName, source: file.source })
      return 'id'
    },
    warn: (message: string) => void warnings.push(message),
  })
  return { plugin, emitted, warnings }
}

describe('seoFiles (Vite plugin)', () => {
  it('emits sitemap.xml and robots.txt into the bundle', () => {
    const { plugin, emitted } = run({
      baseUrl: 'https://notes.example.com',
      routes: ['/', '/terms'],
    })
    expect(plugin.name).toBe('skeleton-seo-files')
    expect(emitted.map((file) => file.fileName).sort()).toEqual(['robots.txt', 'sitemap.xml'])
    expect(emitted.find((file) => file.fileName === 'sitemap.xml')!.source).toContain(
      '<loc>https://notes.example.com/terms</loc>',
    )
    expect(emitted.find((file) => file.fileName === 'robots.txt')!.source).toContain(
      'Sitemap: https://notes.example.com/sitemap.xml',
    )
  })

  it('without a baseUrl it cannot make a sitemap (urls must be absolute): robots.txt only, and says why', () => {
    const { emitted, warnings } = run({ routes: ['/'] })
    expect(emitted.map((file) => file.fileName)).toEqual(['robots.txt'])
    expect(warnings.join(' ')).toMatch(/baseUrl/)
  })

  it('robots options pass through (staging builds block indexing)', () => {
    const { emitted } = run({
      baseUrl: 'https://notes.example.com',
      routes: ['/'],
      robots: { allowIndexing: false },
    })
    expect(emitted.find((file) => file.fileName === 'robots.txt')!.source).toBe(
      'User-agent: *\nDisallow: /\n',
    )
    expect(emitted.find((file) => file.fileName === 'sitemap.xml')).toBeDefined()
  })
})
