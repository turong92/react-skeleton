import type { Catalog } from './lib.mjs'
export function planPackages(
  root: string,
  options?: { requested?: string[]; workbench?: boolean; ssr?: boolean; sample?: boolean },
): string[]
export function acceptedOptions(root: string): Set<string>
export function checkStampFlags(catalog: Catalog, root: string): string[]
export function checkDecisions(catalog: Catalog, root: string): string[]
export function checkRecipe(catalog: Catalog, root: string): string[]
export function checkKotlinNames(catalog: Catalog, readmePath: string): string[]
export function recipeCommands(
  root: string,
): { id: string; reactLine: string; reactArgs: string[]; kotlinLine: string | null }[]
