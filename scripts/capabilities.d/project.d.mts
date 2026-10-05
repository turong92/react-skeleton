import type { Catalog } from './lib.mjs'
export function keepIdsFor(catalog: Catalog, root: string, appFrom: string): string[]
export function projectCatalog(
  catalog: Catalog,
  options: {
    root: string
    projectName: string
    appFrom: string
    appTo: string
    keepIds?: string[]
    scope?: string
    version?: string
    pointer?: string
  },
): Catalog
