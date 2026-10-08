import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createLoginIdRequiredController } from '../loginIdRequired'
import { koAuthLabels } from './labels.ko'
import { LoginIdGate } from './LoginIdGate'
import { LoginIdRequiredScreen } from './LoginIdRequiredScreen'

// 막의 자리는 라우터 밖이다(앱 맨 위 - `LoginIdGate` JSDoc) - 여기서는 일부러 Router 로 감싸지 않는다
const noop = async () => undefined
const api = { checkLoginId: async () => ({ normalized: 'x', available: true }) }
const gateApi = {
  me: async () => ({ loginId: null }) as never,
  setLoginId: async () => ({}) as never,
  checkLoginId: api.checkLoginId,
  discardAccount: noop,
}

describe('the login id gate renders outside any router (it sits above the routes)', () => {
  it('the screen draws "account settings" as a plain underlined link to the settings path', () => {
    const out = renderToStaticMarkup(
      <LoginIdRequiredScreen
        rules={{ minLength: 4, maxLength: 20 }}
        api={api}
        labels={koAuthLabels}
        onSubmit={noop}
        onChosen={() => undefined}
        onAlreadySet={() => undefined}
        onSignOut={() => undefined}
        settingsTo="/me/account"
      />,
    )
    expect(out).toMatch(
      /<a [^>]*class="[^"]*link[^"]*"[^>]*href="\/me\/account"[^>]*>계정 설정<\/a>/,
    )
  })

  it('a required gate with a held call renders without a router', () => {
    const controller = createLoginIdRequiredController()
    controller.require()
    const out = renderToStaticMarkup(
      <LoginIdGate
        controller={controller}
        api={gateApi}
        accountId="a"
        labels={koAuthLabels}
        onSignOut={() => undefined}
        onDiscarded={() => undefined}
      >
        <p>앱 화면</p>
      </LoginIdGate>,
    )
    expect(out).toContain('아이디를 정해 주세요')
    expect(out).toMatch(/href="\/account"[^>]*>계정 설정<\/a>/)
  })

  it('nothing the gate draws imports the router', () => {
    for (const file of [
      'LoginIdGate.tsx',
      'LoginIdRequiredScreen.tsx',
      'LoginIdChoice.tsx',
      'LoginIdField.tsx',
      'DiscardPath.tsx',
      'EmailWriteNotice.tsx',
    ]) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
      expect(source, file).not.toMatch(/from 'react-router/)
    }
  })
})
