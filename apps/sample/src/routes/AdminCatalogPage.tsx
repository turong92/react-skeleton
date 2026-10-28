import {
  adminAccessProblem,
  AdminCatalogTable,
  AdminProductEditor,
  useAdminCatalogProducts,
  useCatalogAdminMutations,
} from '@skeleton/payment/admin'
import { Button, Dialog, PageHeader } from '@skeleton/ui'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { paymentLabelsFor } from '../cheer/paymentLabels'
import { catalogAdminApi } from '../catalogAdmin/api'
import { PRODUCT_LANGUAGES } from '../catalogAdmin/languages'
import { languageOf, useT } from '../i18n'
import { AdminAccessNotice } from '../paymentAdmin/AdminAccessNotice'
import styles from './AdminCatalogPage.module.css'

/**
 * 운영 상품 · 가격(`/admin/catalog`) — 상품 목록(`AdminCatalogTable`)과 「상품 만들기」(`AdminProductEditor`). 한 건은 `/admin/catalog/:code`.
 * 백엔드 `skeleton.catalog.admin.enabled=true`(이 앱은 켠다) + 권한 `catalog.manage`. 필요 없는 프로젝트는 이 파일과 라우트 · 메뉴 한 줄을 지운다.
 */
export function AdminCatalogPage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const labels = paymentLabelsFor(t, language)
  const navigate = useNavigate()
  const products = useAdminCatalogProducts(catalogAdminApi)
  const { createProduct } = useCatalogAdminMutations(catalogAdminApi)
  const [creating, setCreating] = useState(false)

  const problem = adminAccessProblem(products.error)
  if (problem) return <AdminAccessNotice problem={problem} tool="catalog" />

  return (
    <div className={styles.page}>
      <PageHeader
        title={t('admin.catalog.title')}
        description={t('admin.catalog.subtitle')}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              createProduct.reset() // 묵은 오류가 새로 연 창에 보이지 않게
              setCreating(true)
            }}
          >
            {labels.admin.catalog.editor.create}
          </Button>
        }
      />
      <AdminCatalogTable
        products={products.data ?? []}
        loading={products.isPending}
        error={products.isError}
        onRetry={() => void products.refetch()}
        locale={language}
        labels={labels}
        renderAction={(product, label, accessibleName, buttonLikeClassName) => (
          <Link
            to={`/admin/catalog/${encodeURIComponent(product.code)}`}
            className={buttonLikeClassName}
            aria-label={accessibleName}
          >
            {label}
          </Link>
        )}
      />
      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title={labels.admin.catalog.editor.create}
        closeLabel={labels.admin.catalog.addPrice.close}
      >
        <AdminProductEditor
          mode="create"
          languages={PRODUCT_LANGUAGES}
          busy={createProduct.isPending}
          error={createProduct.error}
          labels={labels}
          onSubmit={(input) =>
            createProduct.mutate(input, {
              onSuccess: (created) => {
                setCreating(false)
                void navigate(`/admin/catalog/${encodeURIComponent(created.code)}`)
              },
            })
          }
        />
      </Dialog>
    </div>
  )
}
