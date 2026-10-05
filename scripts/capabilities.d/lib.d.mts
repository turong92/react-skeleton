// lib.mjs 의 타입(테스트가 TypeScript 라서) — 카탈로그는 JSON 이라 모양은 스키마(docs/capabilities.schema.json)가 지킨다.
export type CatalogEntry = Record<string, unknown>
export type Catalog = { capabilities: CatalogEntry[]; [key: string]: unknown }
export const CATALOG_FILE: string
export const SCHEMA_FILE: string
export const GENERATED: [string, (catalog: Catalog) => string][]
export function loadCatalog(root: string): Catalog
export function loadSchema(root: string): Record<string, unknown>
export function workspaces(
  root: string,
): { kind: string; dir: string; path: string; json: Record<string, unknown> }[]
export function exportedNames(file: string): Set<string>
export function checkSchema(catalog: Catalog, schema: Record<string, unknown>): string[]
export function checkCoverage(catalog: Catalog, root: string): string[]
export function checkPaths(catalog: Catalog, root: string): string[]
export function checkExports(catalog: Catalog, root: string): string[]
export function checkNeeds(catalog: Catalog, root: string): string[]
export function checkKeywords(catalog: Catalog): string[]
export function checkGenerated(catalog: Catalog, root: string): string[]
export function checkCatalog(root: string): string[]
