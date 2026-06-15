/// <reference types="vite/client" />
import { Capacitor } from '@capacitor/core'

/**
 * Runtime URL helpers used by the offline route planner.
 *
 * Duplicated from `apps/web/src/api/denizli.ts` so that the planner lib does
 * not depend on Vite-only `@/...` aliases. The planner lib is bundled by Vite
 * at the app level, so `import.meta.env` resolves correctly.
 */

const BACKEND_ORIGIN: string = (() => {
  const envUrl = import.meta.env.VITE_BACKEND_URL
  if (!envUrl) return ''
  try {
    return new URL(envUrl).origin
  } catch {
    return ''
  }
})()

const isNative = Capacitor.isNativePlatform()

/**
 * Resolve a backend path to a URL that is reachable from the current runtime.
 */
export function resolveBackendUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (isNative && BACKEND_ORIGIN) {
    return `${BACKEND_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
  }
  return path
}

/**
 * Resolve any URL (backend or bundled asset) to something reachable from the
 * current runtime.
 */
export function resolveRuntimeUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const normalised = path.startsWith('/') ? path : `/${path}`
  if (isNative) {
    if (normalised.startsWith('/api/') && BACKEND_ORIGIN) {
      return `${BACKEND_ORIGIN}${normalised}`
    }
    const webOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://localhost'
    return `${webOrigin}${normalised}`
  }
  return path
}

export const backendOrigin = BACKEND_ORIGIN
