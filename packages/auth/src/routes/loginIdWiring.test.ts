import { describe, expect, it } from 'vitest'
import { apiError } from '../test/apiFixtures'
import { createLoginIdRequiredController } from '../loginIdRequired'
import { loginIdSettingsProps } from './loginIdWiring'

describe('loginIdSettingsProps (what the account page hands the settings screen about the login id)', () => {
  it('gives nothing when the app uses neither the gate nor the discovered rules', () => {
    expect(loginIdSettingsProps({})).toEqual({})
  })

  it('hands the discovered length rules to the screen, so the hint and the verdict follow the server', () => {
    const rules = { minLength: 3, maxLength: 32 }
    expect(loginIdSettingsProps({ loginId: rules }).loginIdRules).toBe(rules)
  })

  it('choosing one in settings folds the gate and releases the held call', async () => {
    const controller = createLoginIdRequiredController()
    const held = controller.recover({
      path: '/notes',
      method: 'POST',
      error: apiError('ACCOUNT.LOGIN_ID_REQUIRED', 403),
    })
    expect(controller.getState().status).toBe('required')
    loginIdSettingsProps({ loginIdRequired: controller }).onLoginIdChosen?.()
    expect(controller.getState().status).toBe('idle')
    await expect(held).resolves.toBe(true)
  })
})
