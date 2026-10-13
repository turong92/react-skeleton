import { paymentKeys, type PaymentConfig } from '@skeleton/payment'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CountryPolicyNotice } from './CountryPolicyNotice'

const base: PaymentConfig = {
  available: true,
  testMode: true,
  refundRequestsEnabled: true,
  country: 'KR',
  provider: 'toss',
  cancelPolicy: { key: 'korea', penaltyPercent: 10, withdrawalDays: 7 },
}

function render(config: PaymentConfig) {
  const client = new QueryClient()
  client.setQueryData(paymentKeys.config(), config)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CountryPolicyNotice />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('the dev country picker', () => {
  it('is not there unless the server switched the dev country on, and is marked as development-only when it is', () => {
    expect(render(base)).not.toContain('<select')
    const on = render({ ...base, devCountrySwitch: true })
    expect(on).toContain('<select')
    expect(on).toContain('개발용')
    expect(on).toContain('value="US"')
  })
})
