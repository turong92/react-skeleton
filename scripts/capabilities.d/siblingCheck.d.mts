import type { Catalog } from './lib.mjs'
export function gradleClosure(kotlinRoot: string, app: string): string[]
export function checkAgainstKotlin(
  react: Catalog,
  kotlin: Record<string, unknown>,
  kotlinRoot: string,
): string[]
export function loadKotlin(root: string): Record<string, unknown>
