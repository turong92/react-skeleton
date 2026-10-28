import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { paymentKeys } from '../queries'
import type { CatalogAdminApi } from './catalogAdminApi'
import type {
  AddCatalogPriceInput,
  CreateCatalogProductInput,
  UpdateCatalogProductInput,
} from './catalogAdminTypes'

/** 운영 카탈로그 키 - 사용자 쪽과 같은 뿌리(`['payment']`) 아래 `admin` 가지 */
export const catalogAdminKeys = {
  all: [...paymentKeys.all, 'admin', 'catalog'] as const,
  products: () => [...catalogAdminKeys.all, 'products'] as const,
  providers: () => [...catalogAdminKeys.all, 'providers'] as const,
}

/**
 * 목록 쿼리의 공통 옵션 - 다시 시도하지 않고, 404(`catalog.admin.enabled` 가 꺼진 서버) · 403(권한 없음)은 오류 토스트로 알리지 않는다
 * (화면이 제자리에서 말한다 - 앱의 `createQueryClient` 가 `meta.quietStatuses` 를 읽는다)
 */
const LIST_OPTIONS = { retry: false, meta: { quietStatuses: [403, 404] } } as const

export const catalogAdminProductsQuery = (api: Pick<CatalogAdminApi, 'products'>) => ({
  queryKey: catalogAdminKeys.products(),
  queryFn: () => api.products(),
  ...LIST_OPTIONS,
})

export const catalogAdminProvidersQuery = (api: Pick<CatalogAdminApi, 'providers'>) => ({
  queryKey: catalogAdminKeys.providers(),
  queryFn: () => api.providers(),
  ...LIST_OPTIONS,
})

/**
 * 변경이 성공하면 `['payment']` 뿌리를 무효화한다 - 운영 목록뿐 아니라 같은 브라우저의 가격표 · 구독 화면(공개 카탈로그 · 플랜)도 새로 읽는다
 */
export function catalogAdminMutations(api: CatalogAdminApi, client: QueryClient) {
  const done = () => client.invalidateQueries({ queryKey: paymentKeys.all })
  return {
    createProduct: {
      mutationFn: (input: CreateCatalogProductInput) => api.createProduct(input),
      onSuccess: done,
    },
    updateProduct: {
      mutationFn: (v: { code: string; input: UpdateCatalogProductInput }) =>
        api.updateProduct(v.code, v.input),
      onSuccess: done,
    },
    addPrice: {
      mutationFn: (v: { productCode: string; input: AddCatalogPriceInput }) =>
        api.addPrice(v.productCode, v.input),
      onSuccess: done,
    },
    stopPrice: { mutationFn: (code: string) => api.stopPrice(code), onSuccess: done },
    setSaleEnd: {
      mutationFn: (v: { code: string; saleEndsAt: string | null }) =>
        api.setSaleEnd(v.code, v.saleEndsAt),
      onSuccess: done,
    },
    setProviderRef: {
      mutationFn: (v: { code: string; provider: string; externalId: string }) =>
        api.setProviderRef(v.code, v.provider, v.externalId),
      onSuccess: done,
    },
    removeProviderRef: {
      mutationFn: (v: { code: string; provider: string }) =>
        api.removeProviderRef(v.code, v.provider),
      onSuccess: done,
    },
  }
}

/** 상품 목록(판매 중지한 상품 · 지난 가격 포함) */
export function useAdminCatalogProducts(api: Pick<CatalogAdminApi, 'products'>) {
  return useQuery(catalogAdminProductsQuery(api))
}

/** 가격 id 를 쓰는 켜진 결제사 - 링크 칸을 그릴지 */
export function useCatalogProviders(api: Pick<CatalogAdminApi, 'providers'>) {
  return useQuery(catalogAdminProvidersQuery(api))
}

/** 만들기 · 고치기 · 가격 더하기 · 중지 · 끝 시각 · 결제사 링크 - 성공하면 목록을 다시 읽는다 */
export function useCatalogAdminMutations(api: CatalogAdminApi) {
  const client = useQueryClient()
  const options = catalogAdminMutations(api, client)
  return {
    createProduct: useMutation(options.createProduct),
    updateProduct: useMutation(options.updateProduct),
    addPrice: useMutation(options.addPrice),
    stopPrice: useMutation(options.stopPrice),
    setSaleEnd: useMutation(options.setSaleEnd),
    setProviderRef: useMutation(options.setProviderRef),
    removeProviderRef: useMutation(options.removeProviderRef),
  }
}
