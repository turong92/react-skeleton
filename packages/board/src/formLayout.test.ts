/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * 작성자 선택기가 한 줄 확인(문장 + 단추 둘)을 펼치면 선택기 자리가 키가 커진다 — 제출 단추가 그 키로 늘어나 어색한 큰 단추가 되지 않도록
 * 액션 줄은 위쪽에 맞춘다(`align-items: flex-start`). 시각은 sample 의 e2e 캡처가 보고, 여기서는 규칙이 지워지지 않게 지킨다.
 */
const rule = (file: string) =>
  readFileSync(new URL(file, import.meta.url), 'utf8').match(/\.actions\s*\{([^}]*)\}/)?.[1] ?? ''

describe('form action rows keep the submit button its own height', () => {
  it.each(['./CommentForm.module.css', './PostEditor.module.css'])('%s', (file) => {
    expect(rule(file)).toMatch(/align-items:\s*flex-start/)
  })
})
