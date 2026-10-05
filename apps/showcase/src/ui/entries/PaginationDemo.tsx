import { useState } from 'react'
import { Pagination } from '@skeleton/ui'
import { Case } from '../../components/Section'

export function PaginationDemo() {
  const [page, setPage] = useState(3)
  return (
    <Case label="interactive (page index 0-based)">
      <Pagination page={page} totalPages={12} onPageChange={setPage} />
    </Case>
  )
}
