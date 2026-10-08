/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO } from './support/loadWorkspaces'

/*
 * 막(아이디 · 이메일) 안에서 그려지는 조각은 라우터 바깥에서도 그려져야 한다(앱 맨 위 - `LoginIdGate` JSDoc).
 * 파일을 읽는 검사는 패키지 안에 둘 수 없다(찍힌 프로젝트의 패키지에는 node 타입이 없다) - 그래서 루트에 둔다.
 * 패키지 쪽 `loginIdRequired.noRouter.test.tsx` 가 Router 없이 실제로 그려 보는 쪽을 맡는다.
 */
const SCREENS = 'packages/auth/src/screens'
const FILES = [
  'LoginIdGate.tsx',
  'LoginIdRequiredScreen.tsx',
  'LoginIdChoice.tsx',
  'LoginIdField.tsx',
  'DiscardPath.tsx',
  'EmailWriteNotice.tsx',
]

describe.skipIf(!existsSync(join(REPO, SCREENS)))(
  'what the gates draw never imports the router',
  () => {
    it.each(FILES)('%s has no react-router import', (file) => {
      const source = readFileSync(join(REPO, SCREENS, file), 'utf8')
      expect(source, file).not.toMatch(/from 'react-router/)
    })
  },
)
