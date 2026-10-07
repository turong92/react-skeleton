import { describe, expect, it } from 'vitest'
import { mergeLabels } from './screens/labels'
import { koAuthLabels } from './screens/labels.ko'

describe('code countdown labels', () => {
  it('English', () => {
    const l = mergeLabels()
    expect(l.codeTimeLeft('09:42')).toBe('Time left 09:42')
    expect(l.codeTimeMinute).toBe('One minute left')
    expect(l.codeTimeTen).toBe('10 seconds left')
    expect(l.codeTimeUp).toBe('Time is up. Please get a new code.')
    expect(l.codeResendWaiting(27)).toBe('Send a new code (27 s)')
  })

  it('Korean', () => {
    const l = mergeLabels(koAuthLabels)
    expect(l.codeTimeLeft('09:42')).toBe('남은 시간 09:42')
    expect(l.codeTimeMinute).toBe('1분 남았어요')
    expect(l.codeTimeTen).toBe('10초 남았어요')
    expect(l.codeTimeUp).toBe('시간이 지났어요. 인증번호를 다시 받아 주세요')
    expect(l.codeResendWaiting(27)).toBe('다시 받기 (27초)')
  })
})
