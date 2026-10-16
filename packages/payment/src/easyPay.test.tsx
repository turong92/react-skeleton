import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { easyPaysFor } from './easyPay'
import { EasyPayButtons } from './EasyPayButtons'
import { koPaymentLabels } from './labels'

const noop = () => undefined

describe('easyPaysFor (the list the screen draws before any order exists)', () => {
  it('reads the provider’s own list from GET /config; a server without the field, or a list for another provider, gives nothing', () => {
    const config = { available: true, testMode: true, refundRequestsEnabled: false }
    expect(
      easyPaysFor({ ...config, easyPays: { toss: ['NAVERPAY', 'KAKAOPAY'] } }, 'toss'),
    ).toEqual(['NAVERPAY', 'KAKAOPAY'])
    expect(easyPaysFor({ ...config, easyPays: { toss: ['NAVERPAY'] } }, 'paddle')).toEqual([])
    expect(easyPaysFor(config, 'toss')).toEqual([])
    expect(easyPaysFor(undefined, 'toss')).toEqual([])
    expect(easyPaysFor({ ...config, easyPays: { toss: ['NAVERPAY'] } }, undefined)).toEqual([])
  })

  it('drops a code this package has no name for instead of drawing a nameless button', () => {
    const config = { available: true, testMode: false, refundRequestsEnabled: false }
    expect(
      easyPaysFor({ ...config, easyPays: { toss: ['NAVERPAY', 'FUTUREPAY'] } }, 'toss'),
    ).toEqual(['NAVERPAY'])
  })
})

describe('EasyPayButtons', () => {
  it('draws nothing for an empty list - the screen is exactly what it was', () => {
    expect(renderToStaticMarkup(<EasyPayButtons codes={[]} onPick={noop} />)).toBe('')
  })

  it('draws one real button per code, named by the labels, in order', () => {
    const html = renderToStaticMarkup(
      <EasyPayButtons
        codes={['NAVERPAY', 'KAKAOPAY', 'TOSSPAY']}
        onPick={noop}
        labels={koPaymentLabels}
      />,
    )
    const names = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => m[1])
    expect(names).toEqual(['네이버페이', '카카오페이', '토스페이'])
    expect(html).toContain('간편결제')
  })

  it('a held screen keeps every button reachable: aria-disabled and described by the reason, never the disabled attribute', () => {
    const html = renderToStaticMarkup(
      <EasyPayButtons codes={['NAVERPAY']} onPick={noop} ariaDisabled describedBy="why" />,
    )
    const button = html.match(/<button[^>]*>/)?.[0] ?? ''
    expect(button).toContain('aria-disabled="true"')
    expect(button).toContain('aria-describedby="why"')
    expect(button).not.toMatch(/\sdisabled/)
  })

  it('only the pressed code shows the spinner while its window opens', () => {
    const html = renderToStaticMarkup(
      <EasyPayButtons
        codes={['NAVERPAY', 'KAKAOPAY']}
        onPick={noop}
        disabled
        loadingCode="KAKAOPAY"
      />,
    )
    const buttons = html.match(/<button[^>]*>.*?<\/button>/g) ?? []
    expect(buttons[0]).not.toContain('aria-busy')
    expect(buttons[1]).toContain('aria-busy="true"')
  })

  it('disables every button while a payment is being opened', () => {
    const html = renderToStaticMarkup(
      <EasyPayButtons codes={['NAVERPAY']} onPick={noop} disabled />,
    )
    expect(html).toMatch(/<button[^>]* disabled/)
  })
})
