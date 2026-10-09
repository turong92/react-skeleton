import { describe, expect, it } from 'vitest'
import en from './en'
import ko from './ko'

/*
 * 응원하기 여정의 낱말(스펙 §11.2) — 한 낱말로 통일한다: 결제 · 환불 · 응원 · 「내 응원 내역」 · (운영자) 확인 필요 · 환불 요청.
 * 이 사전의 응원 · 결제 키(`cheer.*` · `nav.cheer` · `settings.cheers*`)와 운영자 결제 화면 키(`admin.payments.*` · `nav.adminPayments`)가 「쓰지 않는 말」을 쓰지 않는지 본다.
 * (`취소` 는 어디에도 쓰지 않는다 — 돈을 돌려받는 일은 늘 「환불」. 패키지 문구는 패키지 자기 시험이 본다.)
 */
const KO_FORBIDDEN = [
  '주문',
  '구매',
  '오더',
  '트랜잭션',
  '캔슬',
  '승인',
  '펜딩',
  '처리 중',
  '처리 대기',
  '접수',
  '반려',
  '샌드박스',
  '테스트 모드',
  '동기화',
  '대사',
  '후원',
  '기부',
  '도네이션',
  '성공',
  '실패',
  '만료',
  '취소',
]
const EN_FORBIDDEN = [
  /\borders?\b/i,
  /purchase/i,
  /transaction/i,
  /sandbox/i,
  /test mode/i,
  /\bsync/i,
  /approv/i,
  /pending/i,
  /success/i,
  /\bfail/i,
  /donat/i,
  /expire/i,
  /reject/i,
  /cancel/i,
]
const ownKeys = (dictionary: Record<string, string>) =>
  Object.entries(dictionary).filter(([key]) =>
    /^(cheer\.|nav\.cheer$|settings\.cheers|admin\.payments\.|nav\.adminPayments$)/.test(key),
  )
const squash = (text: string) => text.replace(/\s+/g, '')

describe('the cheer journey words', () => {
  const koText = ownKeys(ko)
  const enText = ownKeys(en)

  it('there are cheer keys to look at (the scan is not over an empty list), the same in both languages', () => {
    expect(koText.length).toBeGreaterThan(15)
    expect(enText.map(([key]) => key)).toEqual(koText.map(([key]) => key))
  })

  it.each(KO_FORBIDDEN)('ko never says 「%s」', (word) => {
    const hit = koText.filter(([, text]) => squash(text).includes(squash(word)))
    expect(hit.map(([key]) => key)).toEqual([])
  })

  it.each(EN_FORBIDDEN.map((re) => [String(re), re] as const))('en never matches %s', (_, re) => {
    const hit = enText.filter(([, text]) => re.test(text))
    expect(hit.map(([key]) => key)).toEqual([])
  })

  it('the operator payment screens have their keys in both languages (the scan above covers them)', () => {
    const operator = (dictionary: Record<string, string>) =>
      Object.keys(dictionary).filter((key) => /^(admin\.payments\.|nav\.adminPayments$)/.test(key))
    expect(operator(ko).length).toBeGreaterThan(8)
    expect(operator(en)).toEqual(operator(ko))
  })

  it('says the table words for the things people look for', () => {
    expect(ko['nav.cheer']).toBe('응원하기')
    expect(ko['cheer.submit']).toBe('응원하기')
    expect(ko['cheer.history.title']).toBe('내 응원 내역')
    expect(ko['settings.cheersLink']).toBe('내 응원 내역')
    expect(ko['admin.payments.tabReview']).toBe('확인 필요')
    expect(ko['admin.payments.tabRefunds']).toBe('환불 요청')
  })
})
