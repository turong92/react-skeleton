import { ApiRequestError } from '@skeleton/api-client'
import type { AuthorProfileApi } from '../authorProfileApi'
import type { AuthorProfile } from '../types'

/*
 * 스토리 · 시험용 가짜 서버 — 백엔드 modules/author-profile 의 계약(`GET /config` · `GET /` · `POST /` · `PATCH /{id}` · `DELETE /{id}`)을 메모리에서 흉내 낸다.
 * 이름 칸 오류 코드는 닉네임과 같다(Required · Size · Pattern · Reserved). 이름이 겹치는 것은 막지 않고 꼬리표로 구분한다(`uniqueNames` 는 중복 금지 방식 서버).
 * 계정 id 는 어디에도 없다 — 프로필 id(`prf_…`)와 이름 · 꼬리표뿐.
 */
export type FakeAuthorProfilesOptions = {
  profiles?: AuthorProfile[]
  maxPerAccount?: number
  nameMaxLength?: number
  /** 같은 이름(대소문자 무시)을 409 NAME_TAKEN 으로 막는 서버 */
  uniqueNames?: boolean
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
  uniqueNames = false,
  rateLimited = false,
  latencyMs = 0,
}: FakeAuthorProfilesOptions = {}) {
  let store = [...profiles]
  let sequence = 0
  const wait = () => (latencyMs ? new Promise((done) => setTimeout(done, latencyMs)) : undefined)
  const nextTag = () => String(++sequence).padStart(4, '0')

  const checkName = (raw: string, ignoreId?: string) => {
    const name = raw.trim()
    if (name.length === 0) throw fieldError('Required')
    if ([...name].length > nameMaxLength) throw fieldError('Size')
    if (/[#@]/.test(name)) throw fieldError('Pattern')
    if (RESERVED.has(name.toLowerCase())) throw fieldError('Reserved')
    if (
      uniqueNames &&
      store.some((p) => p.id !== ignoreId && p.name.toLowerCase() === name.toLowerCase())
    )
      throw problem(409, 'AUTHOR_PROFILE.NAME_TAKEN')
    return name
  }
  const find = (id: string) => {
    const found = store.find((p) => p.id === id)
    if (!found) throw problem(404, 'AUTHOR_PROFILE.NOT_FOUND')
    return found
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
      const current = find(id)
      if (rateLimited) throw tooMany()
      const checked = checkName(name, id)
      // 키(이름)가 같으면 꼬리표를 유지하고, 다르면 새로 추첨한다
      const renamed = {
        ...current,
        name: checked,
        tag: checked.toLowerCase() === current.name.toLowerCase() ? current.tag : nextTag(),
      }
      store = store.map((p) => (p.id === id ? renamed : p))
      return renamed
    },
    async remove(id) {
      await wait()
      find(id)
      store = store.filter((p) => p.id !== id)
    },
  }
  return { api, profiles: () => [...store] }
}
