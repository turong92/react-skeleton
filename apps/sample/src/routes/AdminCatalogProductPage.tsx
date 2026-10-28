import {
  adminAccessProblem,
  AddPriceDialog,
  AdminPriceList,
  AdminProductEditor,
  productTextOf,
  SaleEndDialog,
  StopPriceDialog,
  useAdminCatalogProducts,
  useCatalogAdminMutations,
  useCatalogProviders,
  type AdminCatalogPrice,
} from '@skeleton/payment/admin'
import { Card, PageHeader, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { paymentLabelsFor } from '../cheer/paymentLabels'
import { catalogAdminApi } from '../catalogAdmin/api'
import { PRODUCT_LANGUAGES } from '../catalogAdmin/languages'
import { LinkButton } from '../components/LinkButton'
import { LoadError } from '../components/LoadError'
import { languageOf, useT } from '../i18n'
import { AdminAccessNotice } from '../paymentAdmin/AdminAccessNotice'
import styles from './AdminCatalogPage.module.css'

/**
 * 운영 상품 한 건(`/admin/catalog/:code`) — 상품 정보 폼(`AdminProductEditor`), 가격 표(`AdminPriceList`), 「가격 더하기」(`AddPriceDialog`)와 「판매 중지」(`StopPriceDialog`).
 * 결제사 가격 id 링크 칸은 서버가 가격 id 를 쓰는 결제사(`GET /admin/catalog/providers`)를 알릴 때만 생긴다. 가격 줄은 고치지 않는다.
 */
export function AdminCatalogProductPage() {
  const { code = '' } = useParams()
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = paymentLabelsFor(t, language)
  const products = useAdminCatalogProducts(catalogAdminApi)
  const providers = useCatalogProviders(catalogAdminApi)
  const m = useCatalogAdminMutations(catalogAdminApi)
  const [adding, setAdding] = useState(false)
  const [changingSale, setChangingSale] = useState<AdminCatalogPrice | null>(null)
  const [stopping, setStopping] = useState<AdminCatalogPrice | null>(null)

  const problem = adminAccessProblem(products.error)
  if (problem) return <AdminAccessNotice problem={problem} tool="catalog" />
  if (products.isPending) return <Spinner label={t('common.loading')} />
  if (products.data === undefined)
    return <LoadError error={products.error} onRetry={() => void products.refetch()} />

  const back = (
    <LinkButton to="/admin/catalog" variant="secondary">
      {t('admin.catalog.back')}
    </LinkButton>
  )
  const product = products.data.find((candidate) => candidate.code === code)
  if (!product)
    return (
      <div className={styles.page}>
        <PageHeader
          back={back}
          title={t('admin.catalog.notFoundTitle')}
          description={t('admin.catalog.notFoundBody')}
        />
      </div>
    )

  const refBusy = m.setProviderRef.isPending
    ? `${m.setProviderRef.variables.code}:${m.setProviderRef.variables.provider}`
    : m.removeProviderRef.isPending
      ? `${m.removeProviderRef.variables.code}:${m.removeProviderRef.variables.provider}`
      : null

  return (
    <div className={styles.page}>
      <PageHeader
        back={back}
        title={productTextOf(product, language).name}
        description={`${labels.admin.catalog.kinds[product.kind]} · ${product.code}`}
      />
      <Card title={t('admin.catalog.infoTitle')}>
        <AdminProductEditor
          mode="edit"
          product={product}
          languages={PRODUCT_LANGUAGES}
          busy={m.updateProduct.isPending}
          error={m.updateProduct.error}
          labels={labels}
          onSubmit={(input) => m.updateProduct.mutate({ code: product.code, input })}
        />
      </Card>
      <AdminPriceList
        prices={product.prices}
        providers={providers.data ?? []}
        busyRef={refBusy}
        locale={language}
        labels={labels}
        onAdd={() => {
          m.addPrice.reset()
          setAdding(true)
        }}
        onChangeSale={(price) => {
          m.setSaleEnd.reset()
          setChangingSale(price)
        }}
        onStop={(price) => {
          m.stopPrice.reset()
          setStopping(price)
        }}
        onSetProviderRef={(price, provider, externalId) =>
          m.setProviderRef.mutate({ code: price.code, provider, externalId })
        }
        onRemoveProviderRef={(price, provider) =>
          m.removeProviderRef.mutate({ code: price.code, provider })
        }
      />
      <AddPriceDialog
        open={adding}
        onClose={() => setAdding(false)}
        kind={product.kind}
        busy={m.addPrice.isPending}
        error={m.addPrice.error}
        labels={labels}
        onSubmit={(input) =>
          m.addPrice.mutate(
            { productCode: product.code, input },
            { onSuccess: () => setAdding(false) },
          )
        }
      />
      {changingSale && (
        <SaleEndDialog
          open
          onClose={() => setChangingSale(null)}
          price={changingSale}
          busy={m.setSaleEnd.isPending}
          error={m.setSaleEnd.error}
          locale={language}
          labels={labels}
          onSubmit={(saleEndsAt) =>
            m.setSaleEnd.mutate(
              { code: changingSale.code, saleEndsAt },
              { onSuccess: () => setChangingSale(null) },
            )
          }
        />
      )}
      {stopping && (
        <StopPriceDialog
          open
          onClose={() => setStopping(null)}
          price={stopping}
          busy={m.stopPrice.isPending}
          error={m.stopPrice.error}
          locale={language}
          labels={labels}
          onConfirm={() =>
            m.stopPrice.mutate(stopping.code, { onSuccess: () => setStopping(null) })
          }
        />
      )}
    </div>
  )
}
