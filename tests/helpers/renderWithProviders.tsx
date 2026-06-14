import { TransitProvider } from '@/lib/transit-context'
import { type RenderOptions, type RenderResult, render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial entries for MemoryRouter (default: ['/']). */
  route?: string
  /**
   * Optional route path when the component needs to be mounted behind a
   * concrete pattern (for example `/hatlar/:lineCode`). Defaults to `*`.
   */
  path?: string
  /** Disable the default TransitProvider wrapper. */
  withTransit?: boolean
}

/**
 * Render a component wrapped in the set of providers used throughout the app:
 * router + TransitProvider. Prefer this over bare `render()` so tests stay
 * close to runtime conditions.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '*', withTransit = true, ...options }: RenderWithProvidersOptions = {},
): RenderResult {
  const content = withTransit ? <TransitProvider>{ui}</TransitProvider> : ui
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={children as ReactElement} />
      </Routes>
    </MemoryRouter>
  )

  return render(content, { wrapper: Wrapper, ...options })
}
