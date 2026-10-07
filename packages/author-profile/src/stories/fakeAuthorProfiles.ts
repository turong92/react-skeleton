import { ApiRequestError } from '@skeleton/api-client'
import type { AuthorProfileApi } from '../authorProfileApi'
import type { AuthorProfile } from '../types'

/*
 * 스토리 · 시험용 가짜 서버 — 백엔드 modules/author-profile 의 계약(`GET /config` · `GET /` · `POST /` · `PATCH /{id}` · `DELETE /{id}`)을 메모리에서 흉내 낸다.
 * 이름 칸 오류 코드는 닉네임과 같다(Required · Size · Pattern · Reserved). 내 프로필끼리 이름이 겹치는 것은 막지 않고 꼬리표로 구분한다 — 막는 것은 **남이 가진 이름**(`takenNames`)이다.
 * 계정 id 는 어디에도 없다 — 프로필 id(`prf_…`)와 이름 · 꼬리표뿐.
 */
export type FakeAuthorProfilesOptions = {
  profiles?: AuthorProfile[]
  maxPerAccount?: number
  nameMaxLength?: number
  /** 남이 이미 가진 이름들 — 대소문자를 가리지 않고 409 NAME_TAKEN(만들기 · 이름 바꾸기) */
  takenNames?: string[]
  /** 다음 한 번의 해당 호출을 이 `AUTHOR_PROFILE.*` 코드로 실패시킨다(한 번뿐) — 서버가 아는 사실이 화면과 어긋난 순간을 보인다 */
  failNext?: Partial<Record<'create' | 'rename' | 'remove', string>>
  /** 만들기 · 이름 바꾸기가 429 RATE_LIMITED */
  rateLimited?: boolean
  /** 모든 호출이 이 시간만큼 걸린다(보내는 중 상태를 보이려고) */
  latencyMs?: number
}

const RESERVED = new Set(['admin', 'administrator', 'system'])

function problem(
  status: number,
  code: string,
  extra: Partial<ConstructorParameters<typeof ApiRequestError>[0]> = {},
) {
  return new ApiRequestError(
    { code, title: code, status, timestamp: '2026-01-01T00:00:00Z', ...extra },
    'trace',
    'span',
    '00-trace-span-01',
  )
}

const fieldError = (code: string) =>
  problem(400, 'COMMON.VALIDATION_FAILED', { errors: [{ field: 'name', code }] })

export function createFakeAuthorProfiles({
  profiles = [],
  maxPerAccount = 5,
  nameMaxLength = 60,
  takenNames = [],
  failNext: failNextOption = {},
  rateLimited = false,
  latencyMs = 0,
}: FakeAuthorProfilesOptions = {}) {
  const failNext = { ...failNextOption } // 한 번 쓰면 지운다 — 넘겨받은 객체를 고치지 않는다
  let store = [...profiles]
  let sequence = 0
  const wait = () => (latencyMs ? new Promise((done) => setTimeout(done, latencyMs)) : undefined)
  const nextTag = () => String(++sequence).padStart(4, '0')

  const checkName = (raw: string) => {
    const name = raw.trim()
    if (name.length === 0) throw fieldError('Required')
    if ([...name].length > nameMaxLength) throw fieldError('Size')
    if (/[#@]/.test(name)) throw fieldError('Pattern')
    if (RESERVED.has(name.toLowerCase())) throw fieldError('Reserved')
    if (takenNames.some((taken) => taken.toLowerCase() === name.toLowerCase()))
      throw problem(409, 'AUTHOR_PROFILE.NAME_TAKEN')
    return name
  }
  const find = (id: string) => {
    const found = store.find((p) => p.id === id)
    if (!found) throw problem(404, 'AUTHOR_PROFILE.NOT_FOUND')
    return found
  }
  const STATUS: Record<string, number> = {
    'AUTHOR_PROFILE.NOT_FOUND': 404,
    'AUTHOR_PROFILE.LIMIT_REACHED': 409,
    'AUTHOR_PROFILE.NAME_TAKEN': 409,
    'AUTHOR_PROFILE.RATE_LIMITED': 429,
  }
  /** `failNext` 에 이 호출이 있으면 한 번만 그 코드로 던진다 */
  const failOnce = (kind: 'create' | 'rename' | 'remove', id?: string) => {
    const code = failNext[kind]
    if (code === undefined) return
    delete failNext[kind]
    // NOT_FOUND 는 「다른 탭에서 이미 지웠다」 — 서버에는 이제 없다(다시 가져온 목록에서 사라진다)
    if (code === 'AUTHOR_PROFILE.NOT_FOUND' && id) store = store.filter((p) => p.id !== id)
    throw problem(STATUS[code] ?? 500, code)
  }
  const tooMany = () =>
    problem(429, 'AUTHOR_PROFILE.RATE_LIMITED', { data: { retryAfterSeconds: 120 } })

  const api: AuthorProfileApi = {
    async getConfig() {
      await wait()
      return { maxPerAccount, nameMaxLength }
    },
    async list() {
      await wait()
      return [...store]
    },
    async create({ name }) {
      await wait()
      failOnce('create')
      if (rateLimited) throw tooMany()
      const checked = checkName(name)
      if (store.length >= maxPerAccount) throw problem(409, 'AUTHOR_PROFILE.LIMIT_REACHED')
      const created: AuthorProfile = {
        id: `prf_fake${++sequence}`,
        name: checked,
        tag: nextTag(),
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString(),
      }
      store = [...store, created]
      return created
    },
    async rename(id, { name }) {
      await wait()
      failOnce('rename', id)
      const current = find(id)
      if (rateLimited) throw tooMany()
      const checked = checkName(name)
      // 키(이름)가 같으면 꼬리표를 유지하고, 다르면 새로 추첨한다
      const renamed = {
        ...current,
        name: checked,
        tag: checked.toLowerCase() === current.name?.toLowerCase() ? current.tag : nextTag(),
      }
      store = store.map((p) => (p.id === id ? renamed : p))
      return renamed
    },
    async remove(id) {
      await wait()
      failOnce('remove', id)
      find(id)
      store = store.filter((p) => p.id !== id)
    },
  }
  return { api, profiles: () => [...store] }
}
