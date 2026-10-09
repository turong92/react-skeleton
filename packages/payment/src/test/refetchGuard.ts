import {
  MutationObserver,
  QueryObserver,
  type MutationObserverOptions,
  type QueryClient,
} from '@tanstack/react-query'
import { expect, vi } from 'vitest'
import { paymentKeys } from '../queries'

/**
 * 변경이 끝난 뒤 **다시 읽기가 끝나기 전**에 변경이 어떤 상태인가를 잰다 - 화면의 단추는 `isPending` 으로 잠기니, 다시 읽기가 끝날 때까지 `pending` 이어야
 * 방금 환불이 나갔는데 낡은 화면에서 같은 환불이 또 나가지 않는다(`onSettled` 가 무효화 약속을 **돌려주는** 것에 기댄다).
 * 뿌리 아래의 활성 조회 하나가 두 번째 읽기에서 끝나지 않는 약속을 돌려준다. 변경의 호출은 이미 끝났다고 보고 그 뒤를 본다.
 */
export async function statusWhileReReading<V>(
  client: QueryClient,
  options: MutationObserverOptions<unknown, Error, V>,
  variables: V,
): Promise<{ whileReading: string; after: string }> {
  let reads = 0
  let finishRead: () => void = () => undefined
  const probe = new QueryObserver(client, {
    queryKey: [...paymentKeys.all, 'probe'],
    queryFn: () => {
      reads += 1
      return reads === 1
        ? Promise.resolve('first')
        : new Promise<string>((resolve) => {
            finishRead = () => resolve('again')
          })
    },
    staleTime: Infinity,
  })
  const unsubscribe = probe.subscribe(() => undefined)
  await vi.waitFor(() => expect(probe.getCurrentResult().isSuccess).toBe(true))
  const mutation = new MutationObserver(client, options)
  const settled = mutation.mutate(variables).catch(() => undefined)
  await vi.waitFor(() => expect(reads).toBe(2)) // 다시 읽기가 시작됐다
  await new Promise((resolve) => setTimeout(resolve, 25)) // 변경이 기다리지 않는다면 이 사이에 끝난다
  const whileReading = mutation.getCurrentResult().status
  finishRead()
  await settled
  const after = mutation.getCurrentResult().status
  unsubscribe()
  return { whileReading, after }
}
