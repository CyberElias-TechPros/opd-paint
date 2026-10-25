/**
 * Node ESM hooks for running the TypeScript sources directly.
 *
 * Node strips types but follows strict ESM rules, while the app source is
 * written for the bundler: imports are extensionless and JSON is imported
 * without an attribute. These hooks bridge exactly those two gaps and nothing
 * else, so `npm test` exercises the real source rather than a copy of it.
 * Nothing in the shipped bundle goes through this file.
 */
import { readFile } from 'node:fs/promises'

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    for (const suffix of ['.ts', '.tsx', '.json', '/index.ts', '/index.tsx']) {
      try {
        return await next(specifier + suffix, context)
      } catch {
        // try the next candidate
      }
    }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (url.endsWith('.json')) {
    const raw = await readFile(new URL(url), 'utf8')
    return { format: 'module', source: `export default ${raw}`, shortCircuit: true }
  }
  return next(url, context)
}
